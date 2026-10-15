import type { ItemsById } from "~/types/list";
import type {
  LoadedDateRange,
  MealPlanEntry,
  MealPlanEntryChange,
  MealPlanRealtimeEvent,
} from "~/types/meal-plan";
import { addDays } from "./local-date";
import { upsertListItem } from "./list-state";

// Plan entries follow the same rules as list items (client-generated ids,
// soft deletes, resync); the store uses the reducers in list-state.ts for
// those. Here is only what differs: the store holds the days it has fetched,
// not the whole table.

/**
 * Folds a Realtime change into local state, like applyListRealtimeEvent: the
 * echo of our own write is a no-op, and nothing may undo a local soft delete.
 * An entry on a day that was never fetched is kept too: the store can't tell
 * it is outside what is shown, and a range fetched later has it already.
 */
export function applyMealPlanRealtimeEvent(
  entriesById: ItemsById<MealPlanEntry>,
  event: MealPlanRealtimeEvent,
  householdId: string | null,
): ItemsById<MealPlanEntry> {
  const incoming = event.new;
  if (!householdId || incoming.household_id !== householdId) return entriesById;
  if (entriesById[incoming.id]?.deleted_at && !incoming.deleted_at)
    return entriesById;
  return upsertListItem(entriesById, incoming);
}

/** Whether a day lies inside one of the fetched ranges. */
function isDayLoaded(ranges: LoadedDateRange[], day: string): boolean {
  return ranges.some((range) => range.from <= day && day <= range.to);
}

/**
 * Rebuilds the entries of the fetched `ranges` after a (re)connect, since
 * Realtime doesn't replay missed events. Like mergeListResync, an entry
 * missing from the fetch was deleted remotely and is dropped; `keepLocalIds`
 * and local tombstones win over the fetch. Unlike it, entries on days outside
 * every range are kept as they are: they were not part of this fetch.
 */
export function mergeMealPlanResync(
  entriesById: ItemsById<MealPlanEntry>,
  fetched: MealPlanEntry[],
  keepLocalIds: readonly string[],
  ranges: LoadedDateRange[],
): ItemsById<MealPlanEntry> {
  const merged: ItemsById<MealPlanEntry> = Object.fromEntries(
    fetched.map((entry) => [entry.id, entry]),
  );
  for (const local of Object.values(entriesById)) {
    if (
      keepLocalIds.includes(local.id) ||
      local.deleted_at ||
      !isDayLoaded(ranges, local.date)
    )
      merged[local.id] = local;
  }
  return merged;
}

/** Adds a fetched range to the loaded ones, joining those it overlaps or
 * touches so the list stays short. */
export function addLoadedRange(
  ranges: LoadedDateRange[],
  added: LoadedDateRange,
): LoadedDateRange[] {
  const result: LoadedDateRange[] = [];
  let joined = { ...added };
  for (const range of [...ranges].sort((a, b) =>
    a.from.localeCompare(b.from),
  )) {
    if (
      range.to < addDays(joined.from, -1) ||
      range.from > addDays(joined.to, 1)
    ) {
      result.push(range);
    } else {
      joined = {
        from: range.from < joined.from ? range.from : joined.from,
        to: range.to > joined.to ? range.to : joined.to,
      };
    }
  }
  result.push(joined);
  return result.sort((a, b) => a.from.localeCompare(b.from));
}

/** Entries that are not deleted and not held for removal, by day, slot,
 * position, creation and id: the order is the same on every device. */
export function visibleMealPlanEntries(
  entriesById: ItemsById<MealPlanEntry>,
  heldIds: readonly string[],
): MealPlanEntry[] {
  return Object.values(entriesById)
    .filter((entry) => !entry.deleted_at && !heldIds.includes(entry.id))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.position - b.position ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
}

/** Lays a change over an entry at once, before the server has it. */
export function applyMealPlanChange(
  entriesById: ItemsById<MealPlanEntry>,
  id: string,
  change: MealPlanEntryChange,
): ItemsById<MealPlanEntry> {
  const local = entriesById[id];
  if (!local || local.deleted_at) return entriesById;
  return upsertListItem(entriesById, { ...local, ...change });
}
