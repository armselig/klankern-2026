import { describe, expect, it } from "vitest";
import type { MealPlanEntry, MealSlot } from "~/types/meal-plan";
import type { LocalDate } from "./local-date";
import { repertoireSuggester } from "./meal-suggester";
import {
  draftOnOpenDays,
  fillChoiceLine,
  openDinnerDays,
  plannedDinnersNotice,
  rerollDraftDay,
  rerollUnlocked,
  startWeekDraft,
  toggleDraftLock,
  unplannedDinnersLine,
  type DraftDinner,
  type WeekDraft,
} from "./week-fill";

const MONDAY = "2026-10-19";
const TUESDAY = "2026-10-20";
const WEDNESDAY = "2026-10-21";
const THURSDAY = "2026-10-22";
const WEEK: LocalDate[] = [MONDAY, TUESDAY, WEDNESDAY, THURSDAY];

function entry(
  date: LocalDate,
  overrides: Partial<MealPlanEntry> = {},
): MealPlanEntry {
  return {
    id: `entry-${date}`,
    household_id: "house-1",
    date,
    slot: "dinner",
    recipe_id: null,
    title: "Takeaway",
    position: 1,
    on_shopping_list_at: null,
    skipped_at: null,
    created_by: "user-1",
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

const RECIPES = ["a", "b", "c"].map((id) => ({ id, title: id }));
const CONTEXT = { recipes: RECIPES, entries: [], demoted: new Set<string>() };

function picks(draft: WeekDraft): Record<LocalDate, string> {
  return Object.fromEntries(
    Object.entries(draft).map(([day, dinner]) => [day, dinner.recipeId]),
  );
}

function draftOf(
  dinners: Record<LocalDate, Partial<DraftDinner> & { recipeId: string }>,
): WeekDraft {
  return Object.fromEntries(
    Object.entries(dinners).map(([day, dinner]) => [
      day,
      { locked: false, seen: [dinner.recipeId], ...dinner },
    ]),
  );
}

describe("openDinnerDays", () => {
  it("is every day from the first day on when nothing is planned", () => {
    expect(openDinnerDays([], WEEK, MONDAY)).toEqual(WEEK);
  });

  it("is empty without days", () => {
    expect(openDinnerDays([entry(MONDAY)], [], MONDAY)).toEqual([]);
  });

  it("leaves out the days before the first day", () => {
    expect(openDinnerDays([], WEEK, WEDNESDAY)).toEqual([WEDNESDAY, THURSDAY]);
  });

  it("leaves out a day with a dinner", () => {
    expect(openDinnerDays([entry(TUESDAY)], WEEK, MONDAY)).toEqual([
      MONDAY,
      WEDNESDAY,
      THURSDAY,
    ]);
  });

  it("leaves out a day whose only dinner was skipped", () => {
    const skipped = entry(TUESDAY, { skipped_at: "2026-10-20T10:00:00Z" });
    expect(openDinnerDays([skipped], WEEK, MONDAY)).not.toContain(TUESDAY);
  });

  it("does not let a removed dinner block its day", () => {
    const removed = entry(TUESDAY, { deleted_at: "2026-10-20T10:00:00Z" });
    expect(openDinnerDays([removed], WEEK, MONDAY)).toContain(TUESDAY);
  });

  it("does not let other slots block a day", () => {
    const slots: MealSlot[] = ["breakfast", "lunch", "snack"];
    const entries = slots.map((slot) =>
      entry(TUESDAY, { slot, id: `entry-${slot}` }),
    );
    expect(openDinnerDays(entries, WEEK, MONDAY)).toContain(TUESDAY);
  });
});

describe("startWeekDraft", () => {
  it("proposes a recipe for every open day, none locked, with the pick seen", () => {
    const draft = startWeekDraft(repertoireSuggester, CONTEXT, [
      MONDAY,
      TUESDAY,
      WEDNESDAY,
    ]);
    expect(draft).toEqual({
      [MONDAY]: { recipeId: "a", locked: false, seen: ["a"] },
      [TUESDAY]: { recipeId: "b", locked: false, seen: ["b"] },
      [WEDNESDAY]: { recipeId: "c", locked: false, seen: ["c"] },
    });
  });

  it("is empty without recipes or open days", () => {
    expect(
      startWeekDraft(repertoireSuggester, { ...CONTEXT, recipes: [] }, WEEK),
    ).toEqual({});
    expect(startWeekDraft(repertoireSuggester, CONTEXT, [])).toEqual({});
  });
});

describe("draftOnOpenDays", () => {
  it("drops the days that are no longer open", () => {
    const draft = draftOf({
      [MONDAY]: { recipeId: "a" },
      [TUESDAY]: { recipeId: "b" },
    });
    expect(draftOnOpenDays(draft, [TUESDAY, WEDNESDAY])).toEqual({
      [TUESDAY]: draft[TUESDAY],
    });
  });

  it("is empty when no day is open", () => {
    expect(
      draftOnOpenDays(draftOf({ [MONDAY]: { recipeId: "a" } }), []),
    ).toEqual({});
  });
});

describe("toggleDraftLock", () => {
  it("locks an unlocked day and unlocks it again", () => {
    const draft = draftOf({ [MONDAY]: { recipeId: "a" } });
    const locked = toggleDraftLock(draft, MONDAY);
    expect(locked[MONDAY]!.locked).toBe(true);
    expect(toggleDraftLock(locked, MONDAY)).toEqual(draft);
  });

  it("does not change the draft it was given", () => {
    const draft = draftOf({ [MONDAY]: { recipeId: "a" } });
    toggleDraftLock(draft, MONDAY);
    expect(draft[MONDAY]!.locked).toBe(false);
  });

  it("leaves the draft alone for a day it has no dinner for", () => {
    const draft = draftOf({ [MONDAY]: { recipeId: "a" } });
    expect(toggleDraftLock(draft, TUESDAY)).toBe(draft);
  });
});

describe("rerollDraftDay", () => {
  const draft = draftOf({
    [MONDAY]: { recipeId: "a" },
    [TUESDAY]: { recipeId: "b" },
    [WEDNESDAY]: { recipeId: "c" },
  });

  it("leaves a locked day unchanged", () => {
    const locked = toggleDraftLock(draft, MONDAY);
    expect(rerollDraftDay(repertoireSuggester, CONTEXT, locked, MONDAY)).toBe(
      locked,
    );
  });

  it("leaves the draft alone for a day it has no dinner for", () => {
    expect(rerollDraftDay(repertoireSuggester, CONTEXT, draft, THURSDAY)).toBe(
      draft,
    );
  });

  it("proposes another recipe, away from the other days' picks, and remembers both", () => {
    const next = rerollDraftDay(repertoireSuggester, CONTEXT, draft, MONDAY);
    expect(next[MONDAY]).toEqual({
      recipeId: "c",
      locked: false,
      seen: ["a", "c"],
    });
    expect(next[TUESDAY]).toBe(draft[TUESDAY]);
    expect(next[WEDNESDAY]).toBe(draft[WEDNESDAY]);
  });

  it("goes through every recipe before it comes back, then starts the seen list over", () => {
    let current = draft;
    const recipeIds: string[] = [];
    const seenLists: string[][] = [];
    for (let i = 0; i < 4; i++) {
      current = rerollDraftDay(repertoireSuggester, CONTEXT, current, MONDAY);
      recipeIds.push(current[MONDAY]!.recipeId);
      seenLists.push(current[MONDAY]!.seen);
    }
    expect(recipeIds).toEqual(["c", "b", "a", "c"]);
    expect(seenLists).toEqual([["a", "c"], ["a", "c", "b"], ["a"], ["a", "c"]]);
  });

  it("does not change the draft it was given", () => {
    rerollDraftDay(repertoireSuggester, CONTEXT, draft, MONDAY);
    expect(picks(draft)).toEqual({
      [MONDAY]: "a",
      [TUESDAY]: "b",
      [WEDNESDAY]: "c",
    });
  });

  it("leaves the dinner unchanged with one recipe", () => {
    const single = { ...CONTEXT, recipes: [RECIPES[0]!] };
    const only = draftOf({ [MONDAY]: { recipeId: "a" } });
    expect(rerollDraftDay(repertoireSuggester, single, only, MONDAY)).toEqual(
      only,
    );
  });
});

describe("rerollUnlocked", () => {
  const draft = draftOf({
    [MONDAY]: { recipeId: "a" },
    [TUESDAY]: { recipeId: "b" },
    [WEDNESDAY]: { recipeId: "c" },
  });

  it("leaves the locked days untouched and counts them as planned", () => {
    const locked = toggleDraftLock(draft, TUESDAY);
    const next = rerollUnlocked(repertoireSuggester, CONTEXT, locked);
    expect(next[TUESDAY]).toBe(locked[TUESDAY]);
    expect(picks(next)).toEqual({
      [MONDAY]: "c",
      [TUESDAY]: "b",
      [WEDNESDAY]: "a",
    });
  });

  it("proposes new recipes for the unlocked days and remembers the old ones", () => {
    const next = rerollUnlocked(repertoireSuggester, CONTEXT, draft);
    for (const day of [MONDAY, TUESDAY, WEDNESDAY]) {
      expect(next[day]!.recipeId).not.toBe(draft[day]!.recipeId);
      expect(next[day]!.seen).toEqual([
        draft[day]!.recipeId,
        next[day]!.recipeId,
      ]);
      expect(next[day]!.locked).toBe(false);
    }
  });

  it("changes nothing when every day is locked", () => {
    const all = draftOf({
      [MONDAY]: { recipeId: "a", locked: true },
      [TUESDAY]: { recipeId: "b", locked: true },
    });
    expect(rerollUnlocked(repertoireSuggester, CONTEXT, all)).toEqual(all);
  });

  it("is empty for an empty draft", () => {
    expect(rerollUnlocked(repertoireSuggester, CONTEXT, {})).toEqual({});
  });
});

describe("unplannedDinnersLine", () => {
  it.each([
    [1, false, "1 dinner not planned this week"],
    [4, false, "4 dinners not planned this week"],
    [1, true, "1 dinner not planned next week"],
    [6, true, "6 dinners not planned next week"],
  ])("says %i for next week %s: %s", (count, isNextWeek, line) => {
    expect(unplannedDinnersLine(count, isNextWeek)).toBe(line);
  });
});

describe("fillChoiceLine", () => {
  it("notes that some come more than once when there are fewer recipes than days", () => {
    expect(fillChoiceLine(3, 7, false)).toEqual({
      text: "Only 3 dinners to choose from, so some come more than once.",
      dismissible: true,
    });
  });

  it("says 1 dinner in the singular", () => {
    expect(fillChoiceLine(1, 7, false).text).toBe(
      "Only 1 dinner to choose from, so some come more than once.",
    );
    expect(fillChoiceLine(1, 1, false).text).toBe("Chosen from 1 dinner.");
  });

  it("drops the note once it was dismissed", () => {
    expect(fillChoiceLine(3, 7, true)).toEqual({
      text: "Chosen from 3 dinners.",
      dismissible: false,
    });
  });

  it("has no note when there are as many recipes as days or more", () => {
    expect(fillChoiceLine(7, 7, false)).toEqual({
      text: "Chosen from 7 dinners.",
      dismissible: false,
    });
    expect(fillChoiceLine(12, 7, false).dismissible).toBe(false);
  });
});

describe("plannedDinnersNotice", () => {
  it("says how many were planned when all were saved", () => {
    expect(plannedDinnersNotice(5, 5)).toEqual({
      message: "Planned 5 dinners",
      failed: false,
    });
    expect(plannedDinnersNotice(1, 1).message).toBe("Planned 1 dinner");
  });

  it("says how many could not be saved when some were not", () => {
    expect(plannedDinnersNotice(2, 5)).toEqual({
      message:
        "Could not save 3 of 5 dinners. Check your connection and try again.",
      failed: true,
    });
  });

  it("is a failure when none were saved", () => {
    expect(plannedDinnersNotice(0, 3).failed).toBe(true);
  });
});
