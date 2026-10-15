import type { ItemsById } from "~/types/list";
import type {
  ChildRecord,
  ChildRefusal,
  HouseholdChild,
  MealReaction,
  MealReactionChoice,
  RecipeReactionCount,
} from "~/types/kids";
import type { MealPlanEntry } from "~/types/meal-plan";
import { addDays, type LocalDate } from "./local-date";
import { COOKED_LOOKBACK_WEEKS } from "./meal-week";

// The children and their reactions follow the same rules as list items
// (client-generated ids, soft deletes, resync); the store uses the reducers
// in list-state.ts and vacation-state.ts for those. Here is what differs: a
// child's reaction is recorded by exception ("ate it" is no row), and what
// the reactions mean is counted over the meal plan's entries.
//
// Every function that depends on the day takes it as a parameter, so the
// tile, the record and the tests can't disagree and need no clock.

/** The largest name the table accepts (see migration 0021), so a field can
 * stop at it instead of letting the save fail. */
export const CHILD_NAME_LIMIT = 100;

/** How often a child has to refuse a recipe within the lookback before the
 * Tonight tile proposes it last and says so. Once can be a bad day. */
export const REFUSALS_TO_DEMOTE = 2;

/** What a member reads for each choice, in the order the dialog offers them. */
export const REACTION_CHOICES: readonly {
  value: MealReactionChoice;
  label: string;
}[] = [
  { value: "ate", label: "Ate it" },
  { value: "picked_at", label: "Picked at" },
  { value: "refused", label: "Refused" },
];

/** The live children in the order they were added, ties by name and id, so
 * every device lists them alike. */
export function liveChildren(
  childrenById: ItemsById<HouseholdChild>,
): HouseholdChild[] {
  return Object.values(childrenById)
    .filter((child) => !child.deleted_at)
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
        a.id.localeCompare(b.id),
    );
}

/** The live reaction of a child to an entry, or null: the child ate it. */
export function liveReactionOf(
  reactionsById: ItemsById<MealReaction>,
  entryId: string,
  childId: string,
): MealReaction | null {
  for (const reaction of Object.values(reactionsById)) {
    if (
      !reaction.deleted_at &&
      reaction.entry_id === entryId &&
      reaction.child_id === childId
    )
      return reaction;
  }
  return null;
}

/** What each live child made of an entry, as the dialog shows it. */
export function reactionChoicesOf(
  reactionsById: ItemsById<MealReaction>,
  children: readonly HouseholdChild[],
  entryId: string,
): Record<string, MealReactionChoice> {
  return Object.fromEntries(
    children.map((child) => [
      child.id,
      liveReactionOf(reactionsById, entryId, child.id)?.reaction ?? "ate",
    ]),
  );
}

/**
 * Whether the kids' reactions to an entry can be recorded on `today`: a
 * dinner from a recipe, on that day or before, that was cooked. A title
 * ("toast") takes no part in the suggestions, so a reaction to it would
 * change nothing.
 */
export function canRecordReactions(
  entry: Pick<
    MealPlanEntry,
    "slot" | "recipe_id" | "date" | "skipped_at" | "deleted_at"
  >,
  today: LocalDate,
): boolean {
  return (
    entry.slot === "dinner" &&
    entry.recipe_id !== null &&
    entry.date <= today &&
    !entry.skipped_at &&
    !entry.deleted_at
  );
}

/**
 * The line under an entry that says who did not eat it: "Refused: Mila ·
 * Picked at: Jo". Null when every child ate it, which is the usual case,
 * so a row has a second line only for an exception.
 */
export function reactionNote(
  reactionsById: ItemsById<MealReaction>,
  children: readonly HouseholdChild[],
  entryId: string,
): string | null {
  const choices = reactionChoicesOf(reactionsById, children, entryId);
  const namesWith = (choice: MealReactionChoice) =>
    children
      .filter((child) => choices[child.id] === choice)
      .map((child) => child.name);
  const parts: string[] = [];
  const refused = namesWith("refused");
  const pickedAt = namesWith("picked_at");
  if (refused.length > 0) parts.push(`Refused: ${refused.join(", ")}`);
  if (pickedAt.length > 0) parts.push(`Picked at: ${pickedAt.join(", ")}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The days whose reactions count on `day`: the lookback of the
 * suggestions, the day itself included. */
export function reactionWindow(day: LocalDate): {
  from: LocalDate;
  to: LocalDate;
} {
  return { from: addDays(day, -COOKED_LOOKBACK_WEEKS * 7), to: day };
}

/** The reactions that count, per child, per kind and per recipe. */
type Tallies = Map<
  string,
  { refused: Map<string, number>; pickedAt: Map<string, number> }
>;

/**
 * Counts the reactions within `from` to `to`. A reaction counts when its
 * child is live, and its entry is a live, cooked dinner from a recipe
 * dated within the window, also before the child was added: only
 * exceptions are recorded, so an earlier day hides nothing, and a member
 * who adds the kids may record last week's refusals (decided 2026-10-15,
 * against the build spec).
 */
function tallyReactions(
  children: readonly HouseholdChild[],
  reactionsById: ItemsById<MealReaction>,
  entries: readonly MealPlanEntry[],
  window: { from: LocalDate; to: LocalDate },
): Tallies {
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const tallies: Tallies = new Map();
  for (const child of children)
    tallies.set(child.id, { refused: new Map(), pickedAt: new Map() });
  for (const reaction of Object.values(reactionsById)) {
    if (reaction.deleted_at) continue;
    const tally = tallies.get(reaction.child_id);
    const entry = entryById.get(reaction.entry_id);
    if (!tally || !entry || !canRecordReactions(entry, window.to)) continue;
    if (entry.date < window.from) continue;
    const counts =
      reaction.reaction === "refused" ? tally.refused : tally.pickedAt;
    const recipeId = entry.recipe_id!;
    counts.set(recipeId, (counts.get(recipeId) ?? 0) + 1);
  }
  return tallies;
}

/** The most often first, ties by recipe id so the order is stable; the page
 * sorts ties by title once it knows them. */
function byCount(counts: Map<string, number>): RecipeReactionCount[] {
  return [...counts]
    .map(([recipeId, count]) => ({ recipeId, count }))
    .sort((a, b) => b.count - a.count || a.recipeId.localeCompare(b.recipeId));
}

/** Every live child's record on `day`, over the lookback (see
 * reactionWindow), in the order of `children`. */
export function childRecords(
  children: readonly HouseholdChild[],
  reactionsById: ItemsById<MealReaction>,
  entries: readonly MealPlanEntry[],
  day: LocalDate,
): ChildRecord[] {
  const tallies = tallyReactions(
    children,
    reactionsById,
    entries,
    reactionWindow(day),
  );
  return children.map((child) => {
    const tally = tallies.get(child.id)!;
    return {
      child,
      refused: byCount(tally.refused),
      pickedAt: byCount(tally.pickedAt),
    };
  });
}

/**
 * What the Tonight tile needs about refusals on `day`: for every recipe
 * refused at least REFUSALS_TO_DEMOTE times by one child within the
 * lookback before that day, who refused it how often. The suggestions put
 * these recipes last. Only days before `day` count, as for "last cooked".
 */
export function refusalsByRecipe(
  children: readonly HouseholdChild[],
  reactionsById: ItemsById<MealReaction>,
  entries: readonly MealPlanEntry[],
  day: LocalDate,
): Map<string, ChildRefusal[]> {
  const tallies = tallyReactions(children, reactionsById, entries, {
    from: reactionWindow(day).from,
    to: addDays(day, -1),
  });
  const result = new Map<string, ChildRefusal[]>();
  for (const child of children) {
    for (const [recipeId, count] of tallies.get(child.id)!.refused) {
      if (count < REFUSALS_TO_DEMOTE) continue;
      result.set(recipeId, [
        ...(result.get(recipeId) ?? []),
        { childName: child.name, count },
      ]);
    }
  }
  return result;
}

/** "once", "twice", "3 times". */
export function timesText(count: number): string {
  if (count === 1) return "once";
  if (count === 2) return "twice";
  return `${count} times`;
}

/** The Tonight tile's line about a suggestion the kids refused: "Refused
 * twice by Mila", "Refused twice by Mila and 3 times by Jo". */
export function refusalLine(refusals: readonly ChildRefusal[]): string | null {
  if (refusals.length === 0) return null;
  const parts = refusals.map(
    ({ childName, count }) => `${timesText(count)} by ${childName}`,
  );
  const last = parts.pop()!;
  return `Refused ${parts.length > 0 ? `${parts.join(", ")} and ${last}` : last}`;
}
