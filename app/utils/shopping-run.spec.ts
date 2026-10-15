import { describe, expect, it } from "vitest";
import type { MealPlanEntry } from "~/types/meal-plan";
import type { Recipe } from "~/types/recipe";
import {
  ingredientCount,
  type MealToPutOnList,
  planShoppingRun,
  putOnListFailureLine,
  putOnListLabel,
  shoppingRunNotice,
} from "./shopping-run";

const HOUSEHOLD = "house-1";
const TODAY = "2026-10-15";

function entry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: "entry-1",
    household_id: HOUSEHOLD,
    date: TODAY,
    slot: "dinner",
    recipe_id: "recipe-1",
    title: null,
    position: 1,
    on_shopping_list_at: null,
    skipped_at: null,
    created_by: "user-1",
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "recipe-1",
    household_id: HOUSEHOLD,
    title: "Pancakes",
    servings: "4",
    ingredients: [
      { id: "i1", name: "Flour", quantity: "250 g" },
      { id: "i2", name: "Milk", quantity: null },
    ],
    instructions: "Mix.\nFry.",
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

const pancakes = recipe();
const find = (id: string) => (id === pancakes.id ? pancakes : null);

describe("planShoppingRun", () => {
  it("takes the entries with a recipe from today on", () => {
    const run = planShoppingRun(
      [entry({ id: "a" }), entry({ id: "b", date: "2026-10-20" })],
      TODAY,
      find,
    );

    expect(run.pending.map((p) => p.meal.id)).toEqual(["a", "b"]);
    expect(run.pending[0]!.recipe).toBe(pancakes);
    expect(run.leftOut).toEqual({
      skipped: 0,
      withoutRecipe: 0,
      recipeRemoved: 0,
    });
  });

  it("takes a recipe planned three times three times", () => {
    const run = planShoppingRun(
      [entry({ id: "a" }), entry({ id: "b" }), entry({ id: "c" })],
      TODAY,
      find,
    );

    expect(run.pending).toHaveLength(3);
  });

  it("leaves out earlier days, entries on the list and deleted ones without counting them", () => {
    const run = planShoppingRun(
      [
        entry({ id: "past", date: "2026-10-14" }),
        entry({ id: "listed", on_shopping_list_at: "2026-10-14T10:00:00Z" }),
        entry({ id: "gone", deleted_at: "2026-10-14T10:00:00Z" }),
      ],
      TODAY,
      find,
    );

    expect(run.pending).toEqual([]);
    expect(run.leftOut).toEqual({
      skipped: 0,
      withoutRecipe: 0,
      recipeRemoved: 0,
    });
  });

  it("counts skipped entries, title entries and removed recipes", () => {
    const run = planShoppingRun(
      [
        entry({ id: "skipped", skipped_at: "2026-10-15T10:00:00Z" }),
        entry({ id: "toast", recipe_id: null, title: "toast" }),
        entry({ id: "pasta", recipe_id: null, title: "pasta" }),
        entry({ id: "removed", recipe_id: "recipe-gone" }),
        entry({ id: "kept" }),
      ],
      TODAY,
      find,
    );

    expect(run.pending.map((p) => p.meal.id)).toEqual(["kept"]);
    expect(run.leftOut).toEqual({
      skipped: 1,
      withoutRecipe: 2,
      recipeRemoved: 1,
    });
  });
});

describe("ingredientCount", () => {
  it("is 0 for nothing pending", () => {
    expect(ingredientCount([])).toBe(0);
  });

  it("adds the ingredients of every pending recipe, a recipe's repeats included", () => {
    const pending: MealToPutOnList[] = [
      { meal: { id: "a" }, recipe: recipe() },
      { meal: { id: "b" }, recipe: recipe() },
      { meal: { id: "c" }, recipe: recipe({ ingredients: [] }) },
    ];

    expect(ingredientCount(pending)).toBe(4);
  });
});

describe("putOnListLabel", () => {
  it("uses the singular for one ingredient", () => {
    expect(putOnListLabel(1)).toBe("Put 1 ingredient on the shopping list");
  });

  it.each([0, 2, 12])("uses the plural for %i ingredients", (count) => {
    expect(putOnListLabel(count)).toBe(
      `Put ${count} ingredients on the shopping list`,
    );
  });
});

describe("shoppingRunNotice", () => {
  const nothingLeftOut = { skipped: 0, withoutRecipe: 0, recipeRemoved: 0 };

  it("says how many items were added, in the singular for one", () => {
    expect(shoppingRunNotice(1, nothingLeftOut)).toEqual([
      "1 item added to the shopping list",
    ]);
    expect(shoppingRunNotice(7, nothingLeftOut)).toEqual([
      "7 items added to the shopping list",
    ]);
  });

  it("adds one line with every reason an entry was left out", () => {
    expect(
      shoppingRunNotice(4, { skipped: 1, withoutRecipe: 2, recipeRemoved: 1 }),
    ).toEqual([
      "4 items added to the shopping list",
      "Left out: 2 without a recipe, 1 skipped, 1 whose recipe was removed",
    ]);
  });

  it("names only the reasons that occurred", () => {
    expect(
      shoppingRunNotice(4, { skipped: 0, withoutRecipe: 0, recipeRemoved: 2 }),
    ).toEqual([
      "4 items added to the shopping list",
      "Left out: 2 whose recipe was removed",
    ]);
  });
});

describe("putOnListFailureLine", () => {
  it("says the button tries again when no meal was done", () => {
    expect(putOnListFailureLine("Pancakes", 0)).toBe(
      "Couldn't add Pancakes. The button tries again.",
    );
  });

  it("says one meal was added", () => {
    expect(putOnListFailureLine("Pancakes", 1)).toBe(
      "Couldn't add Pancakes. 1 meal was added; the button adds the rest.",
    );
  });

  it("says several meals were added", () => {
    expect(putOnListFailureLine("Pancakes", 3)).toBe(
      "Couldn't add Pancakes. 3 meals were added; the button adds the rest.",
    );
  });
});
