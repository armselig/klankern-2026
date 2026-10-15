import { describe, expect, it } from "vitest";
import type { MealPlanEntry, MealSlot } from "~/types/meal-plan";
import { dinnerSuggestionOrder } from "./dinner-order";
import { addDays, type LocalDate } from "./local-date";
import {
  MAX_USES_PER_WEEK,
  repertoireSuggester,
  type SuggestionContext,
} from "./meal-suggester";

/** A Monday; the week runs to Sunday 2026-10-25. */
const MONDAY = "2026-10-19";
const WEEK: LocalDate[] = Array.from({ length: 7 }, (_, i) =>
  addDays(MONDAY, i),
);

interface TestRecipe {
  id: string;
  title: string;
}

type TestEntry = Pick<
  MealPlanEntry,
  "date" | "slot" | "recipe_id" | "skipped_at" | "deleted_at"
>;

function recipe(id: string, title = id): TestRecipe {
  return { id, title };
}

/** A live dinner of a recipe on a day. */
function dinner(
  recipeId: string | null,
  date: LocalDate,
  overrides: Partial<TestEntry> = {},
): TestEntry {
  return {
    date,
    slot: "dinner",
    recipe_id: recipeId,
    skipped_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function context(
  recipes: TestRecipe[],
  entries: TestEntry[] = [],
  demoted: string[] = [],
): SuggestionContext<TestRecipe> {
  return { recipes, entries, demoted: new Set(demoted) };
}

function fill(
  ctx: SuggestionContext<TestRecipe>,
  days: LocalDate[],
  kept: Record<LocalDate, string> = {},
  avoid?: Record<LocalDate, string[]>,
): LocalDate[] {
  const proposed = repertoireSuggester.fillDinners(ctx, { days, kept, avoid });
  return days.map((day) => proposed[day] ?? "");
}

function countsOf(ids: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

describe("repertoireSuggester.dinnerOrder", () => {
  it("gives the order of dinnerSuggestionOrder", () => {
    const recipes = [recipe("a"), recipe("b"), recipe("c")];
    const entries = [dinner("a", "2026-10-10"), dinner("b", "2026-10-01")];
    const order = repertoireSuggester.dinnerOrder(
      context(recipes, entries),
      MONDAY,
    );
    expect(order).toEqual(dinnerSuggestionOrder(recipes, entries, MONDAY));
    expect(order.map((candidate) => candidate.recipe.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("puts the demoted recipes last", () => {
    const order = repertoireSuggester.dinnerOrder(
      context([recipe("a"), recipe("b")], [], ["a"]),
      MONDAY,
    );
    expect(order.map((candidate) => candidate.recipe.id)).toEqual(["b", "a"]);
  });
});

describe("repertoireSuggester.fillDinners", () => {
  it("proposes nothing without recipes", () => {
    expect(
      repertoireSuggester.fillDinners(context([]), { days: WEEK, kept: {} }),
    ).toEqual({});
  });

  it("proposes nothing without days", () => {
    expect(
      repertoireSuggester.fillDinners(context([recipe("a")]), {
        days: [],
        kept: {},
      }),
    ).toEqual({});
  });

  it("spreads 5 recipes over 7 days, none more than twice", () => {
    const recipes = ["a", "b", "c", "d", "e"].map((id) => recipe(id));
    const picks = fill(context(recipes), WEEK);
    expect(picks).toEqual(["a", "b", "c", "d", "e", "a", "b"]);
    for (const count of countsOf(picks).values())
      expect(count).toBeLessThanOrEqual(MAX_USES_PER_WEEK);
  });

  it("gives the first days recipes never cooked before ones cooked recently", () => {
    const recipes = [recipe("a"), recipe("b"), recipe("c")];
    const entries = [dinner("a", "2026-10-18"), dinner("c", "2026-10-10")];
    const picks = fill(context(recipes, entries), WEEK.slice(0, 3));
    expect(picks[0]).toBe("b");
    expect(picks[1]).toBe("c");
  });

  it("prefers the recipe furthest from its nearest use, before or after the day", () => {
    const recipes = [recipe("a"), recipe("b"), recipe("c")];
    const entries = [
      dinner("a", "2026-10-24"),
      dinner("b", "2026-10-17"),
      dinner("c", "2026-10-20"),
    ];
    expect(fill(context(recipes, entries), [MONDAY])).toEqual(["a"]);
  });

  it("counts a recipe planned later in the week as near", () => {
    const recipes = [recipe("a"), recipe("b")];
    const entries = [dinner("a", "2026-10-22")];
    expect(fill(context(recipes, entries), ["2026-10-20"])).toEqual(["b"]);
  });

  it("ranks by fewest uses in the week when the distance is equal", () => {
    const recipes = [recipe("a", "Zucchini bake"), recipe("b", "Apple pie")];
    // Both are 3 days from the 21st; only b is used inside the week.
    const entries = [dinner("a", "2026-10-18"), dinner("b", "2026-10-24")];
    expect(fill(context(recipes, entries), ["2026-10-21"])).toEqual(["a"]);
  });

  it("ranks by title, ignoring case, when nothing else tells recipes apart", () => {
    const recipes = [
      recipe("1", "cherry cake"),
      recipe("2", "Banana bread"),
      recipe("3", "apple pie"),
    ];
    expect(fill(context(recipes), [MONDAY])).toEqual(["3"]);
  });

  it("ranks by id when titles are equal", () => {
    const recipes = [recipe("9", "Soup"), recipe("2", "soup")];
    expect(fill(context(recipes), [MONDAY])).toEqual(["2"]);
  });

  it("does not let the order of the recipes change the result", () => {
    const recipes = ["a", "b", "c", "d"].map((id) => recipe(id));
    expect(fill(context([...recipes].reverse()), WEEK)).toEqual(
      fill(context(recipes), WEEK),
    );
  });

  it.each<[string, Partial<TestEntry>]>([
    ["skipped", { skipped_at: "2026-10-18T10:00:00Z" }],
    ["removed", { deleted_at: "2026-10-18T10:00:00Z" }],
    ["a title-only entry", { recipe_id: null }],
    ["a lunch", { slot: "lunch" satisfies MealSlot }],
  ])("ignores %s entries", (_name, overrides) => {
    const recipes = [recipe("a"), recipe("b")];
    const entries = [dinner("a", "2026-10-18", overrides)];
    expect(fill(context(recipes, entries), [MONDAY])).toEqual(["a"]);
  });

  it("counts a live dinner the day before, as the ignored cases are checked against", () => {
    const recipes = [recipe("a"), recipe("b")];
    expect(
      fill(context(recipes, [dinner("a", "2026-10-18")]), [MONDAY]),
    ).toEqual(["b"]);
  });

  it("counts a use exactly 8 weeks back and treats an older one as never", () => {
    const recipes = [recipe("a"), recipe("b")];
    const counted = [dinner("a", "2026-08-24")];
    expect(fill(context(recipes, counted), [MONDAY])).toEqual(["b"]);
    const tooOld = [dinner("a", "2026-08-23"), dinner("b", "2026-08-24")];
    expect(fill(context(recipes, tooOld), [MONDAY])).toEqual(["a"]);
  });

  it("counts kept picks as uses", () => {
    const recipes = [recipe("a"), recipe("b")];
    expect(fill(context(recipes), ["2026-10-20"])).toEqual(["a"]);
    expect(fill(context(recipes), ["2026-10-20"], { [MONDAY]: "a" })).toEqual([
      "b",
    ]);
  });

  it("counts a pick for an earlier day as planned for the later ones", () => {
    const picks = fill(context([recipe("a"), recipe("b")]), WEEK.slice(0, 2));
    expect(picks).toEqual(["a", "b"]);
  });

  it("proposes demoted recipes last", () => {
    const recipes = [recipe("a"), recipe("b"), recipe("c")];
    expect(fill(context(recipes, [], ["a"]), [MONDAY])).toEqual(["b"]);
  });

  it("still uses a demoted recipe when nothing else remains", () => {
    expect(fill(context([recipe("a")], [], ["a"]), WEEK.slice(0, 2))).toEqual([
      "a",
      "a",
    ]);
    const recipes = [recipe("a"), recipe("b")];
    expect(fill(context(recipes, [], ["a"]), WEEK.slice(0, 3))).toEqual([
      "b",
      "b",
      "a",
    ]);
  });

  it("does not count uses in the weeks before or after towards the cap", () => {
    const recipes = [recipe("a"), recipe("b")];
    const entries = [
      dinner("a", "2026-10-17"),
      dinner("a", "2026-10-18"),
      dinner("a", "2026-10-26"),
      dinner("a", "2026-10-27"),
      dinner("b", "2026-10-21"),
    ];
    expect(fill(context(recipes, entries), ["2026-10-22"])).toEqual(["a"]);
  });

  it("relaxes the cap with one recipe over a week", () => {
    expect(fill(context([recipe("a")]), WEEK)).toEqual(Array(7).fill("a"));
  });

  it("relaxes the cap with two recipes over a week, filling every day", () => {
    const picks = fill(context([recipe("a"), recipe("b")]), WEEK);
    expect(picks).not.toContain("");
    expect(picks.slice(0, 4)).toEqual(["a", "b", "a", "b"]);
    const counts = countsOf(picks);
    expect(Math.abs(counts.get("a")! - counts.get("b")!)).toBeLessThanOrEqual(
      1,
    );
  });

  it("leaves out a recipe planned twice in the week already, where others remain", () => {
    const recipes = [recipe("a"), recipe("b")];
    const entries = [dinner("a", "2026-10-19"), dinner("a", "2026-10-25")];
    // a is furthest from the 22nd, but it is planned twice already.
    expect(fill(context(recipes, entries), ["2026-10-22"])).toEqual(["b"]);
  });

  it("avoids the recipes given for a day, where others remain", () => {
    const recipes = [recipe("a"), recipe("b"), recipe("c")];
    expect(fill(context(recipes), [MONDAY], {}, { [MONDAY]: ["a"] })).toEqual([
      "b",
    ]);
    expect(
      fill(context(recipes), [MONDAY], {}, { [MONDAY]: ["a", "b"] }),
    ).toEqual(["c"]);
  });

  it("avoids at least the last of them when all are avoided, so a re-roll moves on", () => {
    const recipes = [recipe("a"), recipe("b"), recipe("c")];
    const avoid = { [MONDAY]: ["c", "a", "b"] };
    expect(fill(context(recipes), [MONDAY], {}, avoid)).toEqual(["a"]);
    const two = { [MONDAY]: ["a", "b"] };
    expect(
      fill(context([recipe("a"), recipe("b")]), [MONDAY], {}, two),
    ).toEqual(["a"]);
  });

  it("moves on to a recipe used twice already rather than repeat the avoided one", () => {
    const recipes = [recipe("a"), recipe("b")];
    const kept = { "2026-10-20": "b", "2026-10-21": "b" };
    expect(fill(context(recipes), [MONDAY], kept, { [MONDAY]: ["a"] })).toEqual(
      ["b"],
    );
  });

  it("keeps the cap over recipes proposed before, other than the current one", () => {
    const recipes = [recipe("a"), recipe("b"), recipe("c")];
    const kept = { "2026-10-20": "b", "2026-10-21": "b", "2026-10-22": "c" };
    expect(
      fill(context(recipes), [MONDAY], kept, { [MONDAY]: ["c", "a"] }),
    ).toEqual(["c"]);
  });

  it("cannot avoid the only recipe", () => {
    expect(
      fill(context([recipe("a")]), [MONDAY], {}, { [MONDAY]: ["a"] }),
    ).toEqual(["a"]);
  });

  it("applies avoid to its own day only", () => {
    const recipes = [recipe("a"), recipe("b")];
    expect(
      fill(context(recipes), [MONDAY, "2026-10-20"], {}, { [MONDAY]: ["a"] }),
    ).toEqual(["b", "a"]);
  });
});
