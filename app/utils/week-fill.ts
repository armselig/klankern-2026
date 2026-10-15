import type { MealPlanEntry } from "~/types/meal-plan";
import type { Recipe } from "~/types/recipe";
import type { LocalDate } from "./local-date";
import type { MealSuggester, SuggestionContext } from "./meal-suggester";

/** A dinner "Fill my week" proposes for a day, before it is planned. */
export interface DraftDinner {
  recipeId: string;
  /** Kept when the rest is proposed anew, and not proposed anew itself. */
  locked: boolean;
  /** The recipes proposed for the day so far, the current one last, so that
   * a re-roll moves on through all of them before it comes back. */
  seen: string[];
}

/**
 * The week's proposal: a dinner per open day. It lives on the device, in the
 * page, until it is planned or dropped: an unplanned proposal must neither
 * reach the other members' devices nor count as a planned dinner.
 */
export type WeekDraft = Readonly<Record<LocalDate, DraftDinner>>;

type DraftContext = SuggestionContext<Pick<Recipe, "id" | "title">>;

/**
 * The days "Fill my week" proposes a dinner for: those of `days` from
 * `firstDay` on that have no dinner at all. A day whose dinner was skipped
 * is decided and left alone, as are the days before `firstDay`, which is the
 * Tonight tile's day (tomorrow from 17:00 on).
 */
export function openDinnerDays(
  entries: readonly Pick<MealPlanEntry, "date" | "slot" | "deleted_at">[],
  days: readonly LocalDate[],
  firstDay: LocalDate,
): LocalDate[] {
  const withDinner = new Set(
    entries
      .filter((entry) => entry.slot === "dinner" && !entry.deleted_at)
      .map((entry) => entry.date),
  );
  return days.filter((day) => day >= firstDay && !withDinner.has(day));
}

/** A dinner for every open day, none of them locked. */
export function startWeekDraft(
  suggester: MealSuggester,
  context: DraftContext,
  openDays: readonly LocalDate[],
): WeekDraft {
  const proposed = suggester.fillDinners(context, { days: openDays, kept: {} });
  return Object.fromEntries(
    Object.entries(proposed).map(([day, recipeId]) => [
      day,
      { recipeId, locked: false, seen: [recipeId] },
    ]),
  );
}

/** The part of the draft that is still open: a day planned meanwhile, here
 * or on another device, is no longer proposed for. */
export function draftOnOpenDays(
  draft: WeekDraft,
  openDays: readonly LocalDate[],
): WeekDraft {
  return Object.fromEntries(
    Object.entries(draft).filter(([day]) => openDays.includes(day)),
  );
}

export function toggleDraftLock(draft: WeekDraft, day: LocalDate): WeekDraft {
  const dinner = draft[day];
  if (!dinner) return draft;
  return { ...draft, [day]: { ...dinner, locked: !dinner.locked } };
}

/** The draft with `day` proposed anew from what it has proposed so far. */
function withNewPick(
  dinner: DraftDinner,
  recipeId: string | undefined,
): DraftDinner {
  if (recipeId === undefined || recipeId === dinner.recipeId) return dinner;
  // Back at one proposed before: every recipe had its turn, start over.
  const seen = dinner.seen.includes(recipeId)
    ? [recipeId]
    : [...dinner.seen, recipeId];
  return { ...dinner, recipeId, seen };
}

/** Another dinner for one day; the other days' dinners count as planned. */
export function rerollDraftDay(
  suggester: MealSuggester,
  context: DraftContext,
  draft: WeekDraft,
  day: LocalDate,
): WeekDraft {
  const dinner = draft[day];
  if (!dinner || dinner.locked) return draft;
  const kept = Object.fromEntries(
    Object.entries(draft)
      .filter(([other]) => other !== day)
      .map(([other, { recipeId }]) => [other, recipeId]),
  );
  const proposed = suggester.fillDinners(context, {
    days: [day],
    kept,
    avoid: { [day]: dinner.seen },
  });
  return { ...draft, [day]: withNewPick(dinner, proposed[day]) };
}

/** Another dinner for every day that is not locked; the locked ones count
 * as planned. */
export function rerollUnlocked(
  suggester: MealSuggester,
  context: DraftContext,
  draft: WeekDraft,
): WeekDraft {
  const entries = Object.entries(draft).sort(([a], [b]) => a.localeCompare(b));
  const kept = Object.fromEntries(
    entries
      .filter(([, dinner]) => dinner.locked)
      .map(([day, { recipeId }]) => [day, recipeId]),
  );
  const open = entries.filter(([, dinner]) => !dinner.locked);
  const proposed = suggester.fillDinners(context, {
    days: open.map(([day]) => day),
    kept,
    avoid: Object.fromEntries(open.map(([day, dinner]) => [day, dinner.seen])),
  });
  return {
    ...draft,
    ...Object.fromEntries(
      open.map(([day, dinner]) => [day, withNewPick(dinner, proposed[day])]),
    ),
  };
}

/** What the Tonight tile says about the week's open dinners: "4 dinners
 * not planned this week". */
export function unplannedDinnersLine(
  count: number,
  isNextWeek: boolean,
): string {
  return `${count} ${count === 1 ? "dinner" : "dinners"} not planned ${
    isNextWeek ? "next week" : "this week"
  }`;
}

/** The line under a fill: how many recipes it chose from. When there are
 * fewer than days, so that some come more than once, it says so until the
 * member has dismissed that once. */
export function fillChoiceLine(
  recipeCount: number,
  dayCount: number,
  smallNoteDismissed: boolean,
): { text: string; dismissible: boolean } {
  const dinners = `${recipeCount} ${recipeCount === 1 ? "dinner" : "dinners"}`;
  if (recipeCount < dayCount && !smallNoteDismissed)
    return {
      text: `Only ${dinners} to choose from, so some come more than once.`,
      dismissible: true,
    };
  return { text: `Chosen from ${dinners}.`, dismissible: false };
}

/** The notice after "Plan these": how many were planned, or how many
 * could not be saved. */
export function plannedDinnersNotice(
  saved: number,
  total: number,
): { message: string; failed: boolean } {
  if (saved === total)
    return {
      message: `Planned ${total} ${total === 1 ? "dinner" : "dinners"}`,
      failed: false,
    };
  return {
    message: `Could not save ${total - saved} of ${total} dinners. Check your connection and try again.`,
    failed: true,
  };
}
