import { describe, expect, it } from "vitest";
import type { MealPlanEntry } from "~/types/meal-plan";
import type { TonightState } from "./dinner-order";
import { tonightLines } from "./tonight-lines";

const TITLES = new Map([
  ["r1", "Pancakes"],
  ["r2", "Soup"],
]);

function entry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: "entry-1",
    household_id: "house-1",
    date: "2026-10-15",
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

function suggested(daysAgo: number | null, place = 1, total = 3): TonightState {
  return {
    kind: "suggested",
    candidate: {
      recipe: { id: "r1", title: "Pancakes" },
      lastCooked: null,
    },
    place,
    total,
    daysAgo,
  };
}

describe("tonightLines", () => {
  it("names a planned recipe and says it is planned", () => {
    expect(
      tonightLines(
        {
          kind: "planned",
          dinners: [entry({ recipe_id: "r1" })],
          recipeRemoved: false,
        },
        TITLES,
      ),
    ).toEqual({
      headline: "Pancakes",
      secondary: "Planned",
      headlineMuted: false,
    });
  });

  it("prefers the entry's title", () => {
    const lines = tonightLines(
      {
        kind: "planned",
        dinners: [entry({ title: "Takeaway", recipe_id: null })],
        recipeRemoved: false,
      },
      TITLES,
    );
    expect(lines.headline).toBe("Takeaway");
  });

  it("counts the other planned dinners", () => {
    const lines = tonightLines(
      {
        kind: "planned",
        dinners: [
          entry({ id: "a", recipe_id: "r1" }),
          entry({ id: "b", recipe_id: "r2" }),
          entry({ id: "c", title: "Salad" }),
        ],
        recipeRemoved: false,
      },
      TITLES,
    );
    expect(lines.secondary).toBe("Planned, and 2 more");
  });

  it("mutes the headline of a planned recipe that was removed", () => {
    expect(
      tonightLines(
        {
          kind: "planned",
          dinners: [entry({ recipe_id: "gone" })],
          recipeRemoved: true,
        },
        TITLES,
      ),
    ).toEqual({
      headline: "Recipe was removed",
      secondary: "Planned",
      headlineMuted: true,
    });
  });

  it("names the skipped dinner and asks to plan something else", () => {
    expect(
      tonightLines(
        { kind: "skipped", dinner: entry({ recipe_id: "r2" }) },
        TITLES,
      ),
    ).toEqual({
      headline: "Soup",
      secondary: "Skipped. Plan something else?",
      headlineMuted: false,
    });
  });

  it("says a skipped dinner's recipe was removed", () => {
    const lines = tonightLines(
      { kind: "skipped", dinner: entry({ recipe_id: "gone" }) },
      TITLES,
    );
    expect(lines.headline).toBe("Recipe was removed");
  });

  it("suggests with how long ago it was cooked and its place", () => {
    expect(tonightLines(suggested(12, 2, 5), TITLES)).toEqual({
      headline: "Pancakes",
      secondary: "last cooked 12 days ago · 2 of 5",
      headlineMuted: false,
    });
  });

  it("says yesterday for one day ago", () => {
    expect(tonightLines(suggested(1), TITLES).secondary).toBe(
      "last cooked yesterday · 1 of 3",
    );
  });

  it("says the lookback for a recipe not cooked within it", () => {
    expect(tonightLines(suggested(null), TITLES).secondary).toBe(
      "not in 8 weeks · 1 of 3",
    );
  });

  it("says there is only one dinner to choose from", () => {
    expect(
      tonightLines(
        {
          kind: "only-one",
          candidate: {
            recipe: { id: "r1", title: "Pancakes" },
            lastCooked: null,
          },
        },
        TITLES,
      ),
    ).toEqual({
      headline: "Pancakes",
      secondary: "Only 1 dinner to choose from",
      headlineMuted: false,
    });
  });

  it("mutes the headline when there is nothing to suggest", () => {
    expect(tonightLines({ kind: "empty" }, TITLES)).toEqual({
      headline: "Nothing to suggest yet",
      secondary: "Save a recipe or write what you eat.",
      headlineMuted: true,
    });
  });
});
