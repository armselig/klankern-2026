import { describe, expect, it } from "vitest";
import type { Recipe } from "~/types/recipe";
import type { VacationMeal } from "~/types/vacation";
import {
  ingredientCount,
  mealAddedLine,
  mealsOfVacation,
  mealsSummary,
  mealsToPutOnList,
  putOnListFailureLine,
  putOnListLabel,
  recipesMatching,
  type MealToPutOnList,
} from "./vacation-meals";

const HOUSEHOLD = "house-1";

function meal(overrides: Partial<VacationMeal> = {}): VacationMeal {
  return {
    id: "meal-1",
    vacation_id: "vacation-1",
    household_id: HOUSEHOLD,
    recipe_id: "recipe-1",
    position: 1,
    on_shopping_list_at: null,
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

function byId<T extends { id: string }>(...rows: T[]): Record<string, T> {
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

describe("mealsOfVacation", () => {
  it("returns nothing for no meals", () => {
    expect(mealsOfVacation({}, "vacation-1")).toEqual([]);
  });

  it("keeps only the live meals of that vacation", () => {
    const mine = meal({ id: "a" });
    const state = byId(
      mine,
      meal({ id: "b", vacation_id: "vacation-2" }),
      meal({ id: "c", deleted_at: "2026-10-02T00:00:00Z" }),
    );

    expect(mealsOfVacation(state, "vacation-1")).toEqual([mine]);
  });

  it("orders by position", () => {
    const state = byId(
      meal({ id: "a", position: 3 }),
      meal({ id: "b", position: 1 }),
      meal({ id: "c", position: 2 }),
    );

    expect(mealsOfVacation(state, "vacation-1").map((m) => m.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("orders equal positions by creation time, then by id", () => {
    const state = byId(
      meal({ id: "z", position: 1, created_at: "2026-10-01T00:00:00Z" }),
      meal({ id: "b", position: 1, created_at: "2026-10-01T00:00:05Z" }),
      meal({ id: "a", position: 1, created_at: "2026-10-01T00:00:05Z" }),
    );

    expect(mealsOfVacation(state, "vacation-1").map((m) => m.id)).toEqual([
      "z",
      "a",
      "b",
    ]);
  });

  it("orders fractional positions between their neighbours", () => {
    const state = byId(
      meal({ id: "a", position: 1 }),
      meal({ id: "b", position: 2 }),
      meal({ id: "c", position: 1.5 }),
    );

    expect(mealsOfVacation(state, "vacation-1").map((m) => m.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });
});

describe("mealsToPutOnList", () => {
  const pancakes = recipe();
  const find = (id: string) => (id === pancakes.id ? pancakes : null);

  it("pairs a meal that is not on the list with its recipe", () => {
    const pending = meal();

    expect(mealsToPutOnList([pending], find)).toEqual([
      { meal: pending, recipe: pancakes },
    ]);
  });

  it("skips a meal that is already on the list", () => {
    const stamped = meal({ on_shopping_list_at: "2026-10-03T00:00:00Z" });

    expect(mealsToPutOnList([stamped], find)).toEqual([]);
  });

  it("skips a meal whose recipe is gone", () => {
    const orphan = meal({ recipe_id: "recipe-gone" });

    expect(mealsToPutOnList([orphan], find)).toEqual([]);
  });

  it("keeps the order of the meals, a recipe used twice included", () => {
    const first = meal({ id: "a" });
    const second = meal({ id: "b" });

    expect(
      mealsToPutOnList([first, second], find).map((p) => p.meal.id),
    ).toEqual(["a", "b"]);
  });

  it("returns nothing for no meals", () => {
    expect(mealsToPutOnList([], find)).toEqual([]);
  });
});

describe("ingredientCount", () => {
  it("is 0 for nothing pending", () => {
    expect(ingredientCount([])).toBe(0);
  });

  it("adds the ingredients of every pending recipe, a recipe's repeats included", () => {
    const pending: MealToPutOnList[] = [
      { meal: meal({ id: "a" }), recipe: recipe() },
      { meal: meal({ id: "b" }), recipe: recipe() },
      { meal: meal({ id: "c" }), recipe: recipe({ ingredients: [] }) },
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

describe("mealsSummary", () => {
  it("gives the count alone while it is not known which meals wait", () => {
    expect(mealsSummary([meal({ id: "a" }), meal({ id: "b" })], null)).toBe(
      "2 meals",
    );
  });

  it("says there are no meals", () => {
    expect(mealsSummary([], 0)).toBe("No meals yet");
  });

  it("says a single meal is on the list", () => {
    expect(mealsSummary([meal()], 0)).toBe("1 meal, on the shopping list");
  });

  it("says all meals are on the list", () => {
    expect(mealsSummary([meal({ id: "a" }), meal({ id: "b" })], 0)).toBe(
      "2 meals, all on the shopping list",
    );
  });

  it("counts the meals that are waiting", () => {
    const meals = [meal({ id: "a" }), meal({ id: "b" }), meal({ id: "c" })];

    expect(mealsSummary(meals, 2)).toBe("3 meals, 2 not on the shopping list");
  });

  it("counts a single meal that is waiting", () => {
    expect(mealsSummary([meal()], 1)).toBe(
      "1 meal, 1 not on the shopping list",
    );
  });
});

describe("mealAddedLine", () => {
  it("names the recipe and how often the plan holds it", () => {
    expect(mealAddedLine("Pancakes", 2)).toBe(
      "Added: Pancakes (2 in the plan)",
    );
  });
});

describe("recipesMatching", () => {
  const recipes = [
    recipe({ id: "a", title: "Crème brûlée" }),
    recipe({ id: "b", title: "Pancakes" }),
    recipe({ id: "c", title: "Pan-fried fish" }),
  ];

  it("lists every recipe for an empty query", () => {
    expect(recipesMatching(recipes, "")).toEqual(recipes);
  });

  it("lists every recipe for a query of spaces, as a copy", () => {
    const result = recipesMatching(recipes, "   ");

    expect(result).toEqual(recipes);
    expect(result).not.toBe(recipes);
  });

  it("ignores case", () => {
    expect(recipesMatching(recipes, "PANCAKE").map((r) => r.id)).toEqual(["b"]);
  });

  it("ignores accents in the title and in the query", () => {
    expect(recipesMatching(recipes, "creme brulee").map((r) => r.id)).toEqual([
      "a",
    ]);
    expect(recipesMatching(recipes, "BRÛLÉE").map((r) => r.id)).toEqual(["a"]);
  });

  it("matches anywhere in the title and ignores surrounding spaces", () => {
    expect(recipesMatching(recipes, " pan ").map((r) => r.id)).toEqual([
      "b",
      "c",
    ]);
  });

  it("returns nothing when no title matches", () => {
    expect(recipesMatching(recipes, "soup")).toEqual([]);
  });

  it("returns nothing for no recipes", () => {
    expect(recipesMatching([], "pan")).toEqual([]);
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
