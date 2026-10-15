import { describe, expect, it, vi } from "vitest";
import type { Recipe } from "~/types/recipe";
import type { MealToPutOnList } from "~/utils/shopping-run";
import {
  putMealsOnShoppingList,
  type ShoppingListWrites,
} from "./meals-on-shopping-list";

function pending(
  id: string,
  title: string,
  ingredients: Recipe["ingredients"],
): MealToPutOnList {
  const recipe: Recipe = {
    id: `recipe-${id}`,
    household_id: "house-1",
    title,
    servings: null,
    ingredients,
    instructions: "",
    kids_version: null,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
  };
  return { meal: { id }, recipe };
}

const flour = { id: "i1", name: "Flour", quantity: "250 g" };
const milk = { id: "i2", name: "Milk", quantity: null };
const eggs = { id: "i3", name: "Eggs", quantity: "3" };

/** Writes that save everything asked and record the order of the calls. */
function writes(overrides: Partial<ShoppingListWrites> = {}) {
  const calls: string[] = [];
  const fake: ShoppingListWrites = {
    addAll: vi.fn(async (entries: { title: string }[]) => {
      calls.push(`addAll:${entries.map((entry) => entry.title).join(",")}`);
      return entries.length;
    }),
    markMealOnList: vi.fn(async (id: string) => {
      calls.push(`mark:${id}`);
    }),
    ...overrides,
  };
  return { fake, calls };
}

describe("putMealsOnShoppingList", () => {
  it("puts every meal's ingredients on the list and marks the meals in order", async () => {
    const { fake, calls } = writes();

    const outcome = await putMealsOnShoppingList(
      [
        pending("a", "Pancakes", [flour, milk]),
        pending("b", "Omelette", [eggs]),
      ],
      fake,
    );

    expect(outcome).toEqual({ items: 3, meals: 2, failure: null });
    expect(calls).toEqual([
      "addAll:Flour,Milk",
      "mark:a",
      "addAll:Eggs",
      "mark:b",
    ]);
    expect(fake.addAll).toHaveBeenNthCalledWith(1, [
      { title: "Flour", quantity: "250 g" },
      { title: "Milk", quantity: null },
    ]);
  });

  it("does nothing for no meals", async () => {
    const { fake } = writes();

    expect(await putMealsOnShoppingList([], fake)).toEqual({
      items: 0,
      meals: 0,
      failure: null,
    });
    expect(fake.addAll).not.toHaveBeenCalled();
    expect(fake.markMealOnList).not.toHaveBeenCalled();
  });

  it("marks a meal without ingredients without calling addAll", async () => {
    const { fake, calls } = writes();

    const outcome = await putMealsOnShoppingList(
      [pending("a", "Water", [])],
      fake,
    );

    expect(outcome).toEqual({ items: 0, meals: 1, failure: null });
    expect(fake.addAll).not.toHaveBeenCalled();
    expect(calls).toEqual(["mark:a"]);
  });

  it("stops when addAll saves fewer than asked, marks nothing for that meal and names it", async () => {
    const { fake, calls } = writes({
      addAll: vi.fn(async (entries) => {
        calls.push("addAll");
        return entries.length - 1;
      }),
    });
    const later = pending("c", "Omelette", [eggs]);

    const outcome = await putMealsOnShoppingList(
      [pending("a", "Pancakes", [flour, milk]), later],
      fake,
    );

    expect(outcome).toEqual({
      items: 1,
      meals: 0,
      failure: {
        title: "Pancakes",
        reason: "Not every ingredient could be saved.",
      },
    });
    expect(fake.markMealOnList).not.toHaveBeenCalled();
    expect(fake.addAll).toHaveBeenCalledTimes(1);
  });

  it("keeps the meals done before a partial save", async () => {
    const addAll = vi
      .fn<ShoppingListWrites["addAll"]>()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    const { fake } = writes({ addAll });

    const outcome = await putMealsOnShoppingList(
      [pending("a", "Omelette", [eggs]), pending("b", "Pancakes", [flour])],
      fake,
    );

    expect(outcome.meals).toBe(1);
    expect(outcome.items).toBe(1);
    expect(outcome.failure?.title).toBe("Pancakes");
    expect(fake.markMealOnList).toHaveBeenCalledTimes(1);
    expect(fake.markMealOnList).toHaveBeenCalledWith("a");
  });

  it("stops with the error text when marking a meal throws, and leaves the later meals untouched", async () => {
    const markMealOnList = vi
      .fn<ShoppingListWrites["markMealOnList"]>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ message: "row-level security" });
    const { fake } = writes({ markMealOnList });

    const outcome = await putMealsOnShoppingList(
      [
        pending("a", "Omelette", [eggs]),
        pending("b", "Pancakes", [flour]),
        pending("c", "Soup", [milk]),
      ],
      fake,
    );

    expect(outcome).toEqual({
      items: 2,
      meals: 1,
      failure: { title: "Pancakes", reason: "row-level security" },
    });
    expect(fake.addAll).toHaveBeenCalledTimes(2);
    expect(markMealOnList).toHaveBeenCalledTimes(2);
    expect(markMealOnList).not.toHaveBeenCalledWith("c");
  });

  it("reports a thrown addAll the same way", async () => {
    const { fake } = writes({
      addAll: vi.fn().mockRejectedValue(new Error("offline")),
    });

    const outcome = await putMealsOnShoppingList(
      [pending("a", "Pancakes", [flour])],
      fake,
    );

    expect(outcome.failure).toEqual({ title: "Pancakes", reason: "offline" });
    expect(fake.markMealOnList).not.toHaveBeenCalled();
  });
});
