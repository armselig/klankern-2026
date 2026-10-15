import { describe, expect, it } from "vitest";
import type { MealPlanEntry, MealSlot } from "~/types/meal-plan";
import {
  dinnerSuggestionOrder,
  tonightState,
  type TonightState,
} from "./dinner-order";

const DAY = "2026-10-15";

interface TestRecipe {
  id: string;
  title: string;
}

function recipe(id: string, title = id): TestRecipe {
  return { id, title };
}

function entry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: "entry-1",
    household_id: "house-1",
    date: DAY,
    slot: "dinner",
    recipe_id: null,
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

/** A dinner of a recipe on a day; the id is made from both. */
function cooked(
  recipeId: string,
  date: string,
  overrides: Partial<MealPlanEntry> = {},
): MealPlanEntry {
  return entry({
    id: `${recipeId}@${date}`,
    recipe_id: recipeId,
    date,
    ...overrides,
  });
}

function titlesOf(order: { recipe: TestRecipe }[]): string[] {
  return order.map((candidate) => candidate.recipe.id);
}

describe("dinnerSuggestionOrder", () => {
  it("is empty without recipes", () => {
    expect(dinnerSuggestionOrder([], [cooked("a", "2026-10-01")], DAY)).toEqual(
      [],
    );
  });

  it("puts recipes never cooked first, then the one cooked longest ago", () => {
    const recipes = [recipe("a"), recipe("b"), recipe("c")];
    const order = dinnerSuggestionOrder(
      recipes,
      [cooked("a", "2026-10-10"), cooked("b", "2026-10-01")],
      DAY,
    );
    expect(titlesOf(order)).toEqual(["c", "b", "a"]);
    expect(order.map((candidate) => candidate.lastCooked)).toEqual([
      null,
      "2026-10-01",
      "2026-10-10",
    ]);
  });

  it("uses the latest day a recipe was cooked", () => {
    const order = dinnerSuggestionOrder(
      [recipe("a"), recipe("b")],
      [
        cooked("a", "2026-09-01"),
        cooked("a", "2026-10-12"),
        cooked("b", "2026-10-05"),
      ],
      DAY,
    );
    expect(titlesOf(order)).toEqual(["b", "a"]);
    expect(order[1]!.lastCooked).toBe("2026-10-12");
  });

  it("breaks ties by title, ignoring case, then by id", () => {
    const order = dinnerSuggestionOrder(
      [recipe("3", "soup"), recipe("2", "Pasta"), recipe("1", "Pasta")],
      [],
      DAY,
    );
    expect(titlesOf(order)).toEqual(["1", "2", "3"]);
  });

  it("looks back 8 weeks: the day 56 days ago counts, the one before does not", () => {
    const order = dinnerSuggestionOrder(
      [recipe("a"), recipe("b")],
      [cooked("a", "2026-08-20"), cooked("b", "2026-08-19")],
      DAY,
    );
    expect(order.find((c) => c.recipe.id === "a")!.lastCooked).toBe(
      "2026-08-20",
    );
    expect(order.find((c) => c.recipe.id === "b")!.lastCooked).toBeNull();
  });

  it("does not count skipped or deleted entries", () => {
    const order = dinnerSuggestionOrder(
      [recipe("a"), recipe("b")],
      [
        cooked("a", "2026-10-10", { skipped_at: "2026-10-11T00:00:00Z" }),
        cooked("b", "2026-10-10", { deleted_at: "2026-10-11T00:00:00Z" }),
      ],
      DAY,
    );
    expect(order.map((candidate) => candidate.lastCooked)).toEqual([
      null,
      null,
    ]);
  });

  it("ignores entries with a title and no recipe", () => {
    const order = dinnerSuggestionOrder(
      [recipe("a")],
      [entry({ title: "Takeaway", date: "2026-10-10" })],
      DAY,
    );
    expect(order).toEqual([{ recipe: recipe("a"), lastCooked: null }]);
  });

  it("ignores slots other than dinner", () => {
    const slots: MealSlot[] = ["breakfast", "lunch", "snack"];
    for (const slot of slots) {
      const order = dinnerSuggestionOrder(
        [recipe("a")],
        [cooked("a", "2026-10-10", { slot }), cooked("a", DAY, { slot })],
        DAY,
      );
      expect(order[0]!.lastCooked).toBeNull();
    }
  });

  it("leaves out recipes planned for the day or later", () => {
    const order = dinnerSuggestionOrder(
      [recipe("a"), recipe("b"), recipe("c")],
      [cooked("a", DAY), cooked("b", "2026-10-20")],
      DAY,
    );
    expect(titlesOf(order)).toEqual(["c"]);
  });

  it("does not leave out a recipe planned for the day before", () => {
    const order = dinnerSuggestionOrder(
      [recipe("a")],
      [cooked("a", "2026-10-14")],
      DAY,
    );
    expect(titlesOf(order)).toEqual(["a"]);
  });

  it("keeps all recipes when every one is planned", () => {
    const order = dinnerSuggestionOrder(
      [recipe("b"), recipe("a")],
      [cooked("a", DAY), cooked("b", "2026-10-16")],
      DAY,
    );
    expect(titlesOf(order)).toEqual(["a", "b"]);
  });

  it("does not let a skipped plan for the day leave the recipe out", () => {
    const order = dinnerSuggestionOrder(
      [recipe("a"), recipe("b")],
      [cooked("a", DAY, { skipped_at: "2026-10-15T10:00:00Z" })],
      DAY,
    );
    expect(titlesOf(order)).toEqual(["a", "b"]);
  });

  it("does not change the recipes it was given", () => {
    const recipes = [recipe("b"), recipe("a")];
    dinnerSuggestionOrder(recipes, [], DAY);
    expect(recipes.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("tonightState", () => {
  const options = { isToday: true, skip: 0 };

  /** Recipes r1..rN, cooked on days that make r1 the oldest. */
  function recipes(count: number): TestRecipe[] {
    return Array.from({ length: count }, (_, i) =>
      recipe(`r${i + 1}`, `Recipe ${String(i + 1).padStart(2, "0")}`),
    );
  }
  function cookedEarlier(count: number): MealPlanEntry[] {
    return recipes(count).map((r, i) =>
      cooked(r.id, `2026-10-${String(i + 1).padStart(2, "0")}`),
    );
  }

  it("is planned for one recipe dinner of the day", () => {
    const state = tonightState(recipes(2), [cooked("r1", DAY)], DAY, options);
    expect(state).toMatchObject({ kind: "planned", recipeRemoved: false });
    expect(
      (state as Extract<TonightState, { kind: "planned" }>).dinners,
    ).toHaveLength(1);
  });

  it("is planned for several dinners, ordered by position", () => {
    const second = cooked("r2", DAY, { position: 2 });
    const first = cooked("r1", DAY, { position: 1 });
    const state = tonightState(recipes(2), [second, first], DAY, options);
    expect(state).toMatchObject({ kind: "planned" });
    expect(
      (state as Extract<TonightState, { kind: "planned" }>).dinners.map(
        (d) => d.id,
      ),
    ).toEqual([first.id, second.id]);
  });

  it("orders dinners at one position by creation, then id", () => {
    const later = entry({
      id: "b",
      position: 1,
      created_at: "2026-10-02T00:00:00Z",
      title: "Later",
    });
    const sameTimeB = entry({
      id: "z",
      position: 1,
      created_at: "2026-10-01T00:00:00Z",
      title: "Z",
    });
    const sameTimeA = entry({
      id: "y",
      position: 1,
      created_at: "2026-10-01T00:00:00Z",
      title: "Y",
    });
    const state = tonightState([], [later, sameTimeB, sameTimeA], DAY, options);
    expect(
      (state as Extract<TonightState, { kind: "planned" }>).dinners.map(
        (d) => d.id,
      ),
    ).toEqual(["y", "z", "b"]);
  });

  it("flags a headline recipe that is not among the recipes as removed", () => {
    const state = tonightState(recipes(2), [cooked("gone", DAY)], DAY, options);
    expect(state).toMatchObject({ kind: "planned", recipeRemoved: true });
  });

  it("does not call a title entry removed, whatever the recipes", () => {
    const state = tonightState(
      [],
      [entry({ title: "Takeaway" })],
      DAY,
      options,
    );
    expect(state).toMatchObject({ kind: "planned", recipeRemoved: false });
  });

  it("judges removal by the headline only", () => {
    const state = tonightState(
      recipes(1),
      [
        cooked("r1", DAY, { position: 1 }),
        cooked("gone", DAY, { position: 2 }),
      ],
      DAY,
      options,
    );
    expect(state).toMatchObject({ kind: "planned", recipeRemoved: false });
  });

  it("ignores deleted dinners, other days and other slots", () => {
    const state = tonightState(
      recipes(1),
      [
        cooked("r1", DAY, { deleted_at: "2026-10-15T08:00:00Z" }),
        cooked("r1", "2026-10-16"),
        cooked("r1", DAY, { slot: "lunch", id: "lunch" }),
      ],
      DAY,
      options,
    );
    expect(state.kind).toBe("only-one");
  });

  it("is planned with the standing dinners when another one was skipped", () => {
    const state = tonightState(
      recipes(2),
      [
        cooked("r1", DAY, { position: 1, skipped_at: "2026-10-15T10:00:00Z" }),
        cooked("r2", DAY, { position: 2 }),
      ],
      DAY,
      options,
    );
    expect(state).toMatchObject({ kind: "planned" });
    expect(
      (state as Extract<TonightState, { kind: "planned" }>).dinners.map(
        (d) => d.recipe_id,
      ),
    ).toEqual(["r2"]);
  });

  it("is skipped when today's only dinner was skipped", () => {
    const skipped = cooked("r1", DAY, { skipped_at: "2026-10-15T10:00:00Z" });
    expect(tonightState(recipes(2), [skipped], DAY, options)).toEqual({
      kind: "skipped",
      dinner: skipped,
    });
  });

  it("falls through to a suggestion for a skipped dinner when it is not today", () => {
    const skipped = cooked("r1", DAY, { skipped_at: "2026-10-15T10:00:00Z" });
    const state = tonightState(recipes(2), [skipped], DAY, {
      isToday: false,
      skip: 0,
    });
    expect(state.kind).toBe("suggested");
  });

  it("is empty without recipes or dinners", () => {
    expect(tonightState([], [], DAY, options)).toEqual({ kind: "empty" });
  });

  it("is only-one with one recipe", () => {
    expect(
      tonightState(recipes(1), [], DAY, { isToday: true, skip: 7 }),
    ).toEqual({
      kind: "only-one",
      candidate: { recipe: recipe("r1", "Recipe 01"), lastCooked: null },
    });
  });

  describe.each([2, 5, 14])("with %i recipes, all cooked once", (count) => {
    const all = recipes(count);
    const entries = cookedEarlier(count);

    it("suggests the one cooked longest ago first, with its place and age", () => {
      const state = tonightState(all, entries, DAY, options);
      expect(state).toEqual({
        kind: "suggested",
        candidate: { recipe: all[0], lastCooked: "2026-10-01" },
        place: 1,
        total: count,
        daysAgo: 14,
      });
    });

    it("moves on by one place for each skip", () => {
      const state = tonightState(all, entries, DAY, { isToday: true, skip: 1 });
      expect(state).toMatchObject({
        kind: "suggested",
        place: 2,
        total: count,
        daysAgo: 13,
      });
    });

    it("wraps around after as many skips as there are recipes", () => {
      expect(
        tonightState(all, entries, DAY, { isToday: true, skip: count }),
      ).toEqual(tonightState(all, entries, DAY, options));
      expect(
        tonightState(all, entries, DAY, { isToday: true, skip: count + 1 }),
      ).toMatchObject({ place: 2 });
    });
  });

  it("reports no age for a recipe not cooked within the lookback", () => {
    const state = tonightState(recipes(2), [], DAY, options);
    expect(state).toMatchObject({ kind: "suggested", daysAgo: null, place: 1 });
  });

  it("counts the order without the recipes planned for later days", () => {
    const state = tonightState(
      recipes(3),
      [cooked("r1", "2026-10-16")],
      DAY,
      options,
    );
    expect(state).toMatchObject({ kind: "suggested", total: 2 });
  });
});
