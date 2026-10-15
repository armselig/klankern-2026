import { describe, expect, it } from "vitest";
import type { ItemsById } from "~/types/list";
import type { MealPlanEntry, MealPlanRealtimeEvent } from "~/types/meal-plan";
import {
  addLoadedRange,
  applyMealPlanRealtimeEvent,
  applyMealPlanSkip,
  mergeMealPlanResync,
  visibleMealPlanEntries,
} from "./meal-plan-state";

const HOUSEHOLD = "house-1";

function entry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: "entry-1",
    household_id: HOUSEHOLD,
    date: "2026-10-15",
    slot: "dinner",
    recipe_id: null,
    title: "Soup",
    position: 1,
    on_shopping_list_at: null,
    skipped_at: null,
    created_by: "user-1",
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function byId(...entries: MealPlanEntry[]): ItemsById<MealPlanEntry> {
  return Object.fromEntries(entries.map((e) => [e.id, e]));
}

function event(
  row: MealPlanEntry,
  eventType: MealPlanRealtimeEvent["eventType"] = "UPDATE",
): MealPlanRealtimeEvent {
  return { eventType, new: row, commitTimestamp: "2026-10-15T10:00:00.000Z" };
}

const DELETED = "2026-10-15T09:00:00Z";

describe("applyMealPlanRealtimeEvent", () => {
  it("adds an entry another member planned", () => {
    expect(
      applyMealPlanRealtimeEvent({}, event(entry(), "INSERT"), HOUSEHOLD),
    ).toEqual(byId(entry()));
  });

  it("makes the echo of our own write a no-op", () => {
    const state = byId(entry());
    expect(
      applyMealPlanRealtimeEvent(state, event(entry(), "INSERT"), HOUSEHOLD),
    ).toEqual(state);
  });

  it("updates an entry that is in state", () => {
    const next = applyMealPlanRealtimeEvent(
      byId(entry()),
      event(entry({ skipped_at: "2026-10-15T10:00:00Z" })),
      HOUSEHOLD,
    );
    expect(next["entry-1"]!.skipped_at).toBe("2026-10-15T10:00:00Z");
  });

  it("ignores an entry of another household", () => {
    const state = byId(entry());
    expect(
      applyMealPlanRealtimeEvent(
        state,
        event(entry({ id: "other", household_id: "house-2" })),
        HOUSEHOLD,
      ),
    ).toBe(state);
  });

  it("ignores every event before a household is known", () => {
    const state = byId();
    expect(applyMealPlanRealtimeEvent(state, event(entry()), null)).toBe(state);
  });

  it("does not undo a local soft delete", () => {
    const state = byId(entry({ deleted_at: DELETED }));
    expect(applyMealPlanRealtimeEvent(state, event(entry()), HOUSEHOLD)).toBe(
      state,
    );
  });

  it("applies a remote soft delete", () => {
    const next = applyMealPlanRealtimeEvent(
      byId(entry()),
      event(entry({ deleted_at: DELETED })),
      HOUSEHOLD,
    );
    expect(next["entry-1"]!.deleted_at).toBe(DELETED);
  });

  it("keeps an entry on a day that was never fetched", () => {
    const far = entry({ id: "far", date: "2030-01-01" });
    expect(
      applyMealPlanRealtimeEvent({}, event(far, "INSERT"), HOUSEHOLD),
    ).toEqual(byId(far));
  });
});

describe("mergeMealPlanResync", () => {
  const ranges = [{ from: "2026-10-10", to: "2026-10-20" }];

  it("takes the fetched entries when nothing is local", () => {
    expect(mergeMealPlanResync({}, [entry()], [], ranges)).toEqual(
      byId(entry()),
    );
  });

  it("is empty for nothing local and nothing fetched", () => {
    expect(mergeMealPlanResync({}, [], [], ranges)).toEqual({});
  });

  it("keeps entries on days outside the fetched ranges", () => {
    const outside = entry({ id: "outside", date: "2026-09-01" });
    const merged = mergeMealPlanResync(byId(outside), [], [], ranges);
    expect(merged).toEqual(byId(outside));
  });

  it("keeps entries on the first and last day of a range out of the drop", () => {
    const first = entry({ id: "first", date: "2026-10-10" });
    const last = entry({ id: "last", date: "2026-10-20" });
    expect(mergeMealPlanResync(byId(first, last), [], [], ranges)).toEqual({});
  });

  it("drops an entry inside the ranges that the fetch does not have", () => {
    expect(mergeMealPlanResync(byId(entry()), [], [], ranges)).toEqual({});
  });

  it("lets the fetch replace a local entry inside the ranges", () => {
    const fetched = entry({ title: "Stew" });
    expect(
      mergeMealPlanResync(byId(entry()), [fetched], [], ranges)["entry-1"],
    ).toEqual(fetched);
  });

  it("keeps the local version of an id in keepLocalIds", () => {
    const local = entry({ title: "Local" });
    const merged = mergeMealPlanResync(
      byId(local),
      [entry({ title: "Fetched" })],
      ["entry-1"],
      ranges,
    );
    expect(merged["entry-1"]).toEqual(local);
  });

  it("keeps a pending add that the fetch does not have yet", () => {
    const merged = mergeMealPlanResync(byId(entry()), [], ["entry-1"], ranges);
    expect(merged).toEqual(byId(entry()));
  });

  it("keeps a local tombstone over a fetch that still has the entry live", () => {
    const tombstone = entry({ deleted_at: DELETED });
    const merged = mergeMealPlanResync(byId(tombstone), [entry()], [], ranges);
    expect(merged["entry-1"]).toEqual(tombstone);
  });

  it("keeps a local tombstone the fetch does not have", () => {
    const tombstone = entry({ deleted_at: DELETED });
    expect(mergeMealPlanResync(byId(tombstone), [], [], ranges)).toEqual(
      byId(tombstone),
    );
  });

  it("adds entries other members planned", () => {
    const added = entry({ id: "new" });
    expect(
      Object.keys(
        mergeMealPlanResync(byId(entry()), [entry(), added], [], ranges),
      ).sort(),
    ).toEqual(["entry-1", "new"]);
  });
});

describe("addLoadedRange", () => {
  it("starts the list", () => {
    expect(
      addLoadedRange([], { from: "2026-10-01", to: "2026-10-07" }),
    ).toEqual([{ from: "2026-10-01", to: "2026-10-07" }]);
  });

  it("keeps separate ranges, sorted", () => {
    expect(
      addLoadedRange([{ from: "2026-11-01", to: "2026-11-07" }], {
        from: "2026-10-01",
        to: "2026-10-07",
      }),
    ).toEqual([
      { from: "2026-10-01", to: "2026-10-07" },
      { from: "2026-11-01", to: "2026-11-07" },
    ]);
  });

  it("joins an overlapping range", () => {
    expect(
      addLoadedRange([{ from: "2026-10-01", to: "2026-10-10" }], {
        from: "2026-10-05",
        to: "2026-10-15",
      }),
    ).toEqual([{ from: "2026-10-01", to: "2026-10-15" }]);
  });

  it("joins a touching range, on either side", () => {
    expect(
      addLoadedRange([{ from: "2026-10-08", to: "2026-10-14" }], {
        from: "2026-10-01",
        to: "2026-10-07",
      }),
    ).toEqual([{ from: "2026-10-01", to: "2026-10-14" }]);
    expect(
      addLoadedRange([{ from: "2026-10-01", to: "2026-10-07" }], {
        from: "2026-10-08",
        to: "2026-10-14",
      }),
    ).toEqual([{ from: "2026-10-01", to: "2026-10-14" }]);
  });

  it("does not join a range one day apart", () => {
    expect(
      addLoadedRange([{ from: "2026-10-01", to: "2026-10-07" }], {
        from: "2026-10-09",
        to: "2026-10-14",
      }),
    ).toHaveLength(2);
  });

  it("swallows a range inside the added one and bridges several", () => {
    expect(
      addLoadedRange(
        [
          { from: "2026-12-01", to: "2026-12-07" },
          { from: "2026-10-05", to: "2026-10-06" },
          { from: "2026-11-01", to: "2026-11-07" },
        ],
        { from: "2026-10-01", to: "2026-11-30" },
      ),
    ).toEqual([{ from: "2026-10-01", to: "2026-12-07" }]);
  });

  it("does not change the list it was given", () => {
    const ranges = [{ from: "2026-10-01", to: "2026-10-07" }];
    addLoadedRange(ranges, { from: "2026-10-05", to: "2026-10-20" });
    expect(ranges).toEqual([{ from: "2026-10-01", to: "2026-10-07" }]);
  });
});

describe("visibleMealPlanEntries", () => {
  it("is empty for no entries", () => {
    expect(visibleMealPlanEntries({}, [])).toEqual([]);
  });

  it("hides deleted entries and held ones", () => {
    const state = byId(
      entry({ id: "live" }),
      entry({ id: "deleted", deleted_at: DELETED }),
      entry({ id: "held" }),
    );
    expect(visibleMealPlanEntries(state, ["held"]).map((e) => e.id)).toEqual([
      "live",
    ]);
  });

  it("orders by date, position, creation and id", () => {
    const state = byId(
      entry({ id: "d", date: "2026-10-16", position: 1 }),
      entry({ id: "c", date: "2026-10-15", position: 2 }),
      entry({
        id: "b2",
        date: "2026-10-15",
        position: 1,
        created_at: "2026-10-02T00:00:00Z",
      }),
      entry({
        id: "b1",
        date: "2026-10-15",
        position: 1,
        created_at: "2026-10-01T00:00:00Z",
      }),
      entry({ id: "a", date: "2026-10-14", position: 9 }),
      entry({
        id: "b0",
        date: "2026-10-15",
        position: 1,
        created_at: "2026-10-01T00:00:00Z",
      }),
    );
    expect(visibleMealPlanEntries(state, []).map((e) => e.id)).toEqual([
      "a",
      "b0",
      "b1",
      "b2",
      "c",
      "d",
    ]);
  });
});

describe("applyMealPlanSkip", () => {
  it("lays the skip over the entry", () => {
    const next = applyMealPlanSkip(
      byId(entry()),
      "entry-1",
      "2026-10-15T10:00:00Z",
    );
    expect(next["entry-1"]!.skipped_at).toBe("2026-10-15T10:00:00Z");
  });

  it("takes the skip back with null", () => {
    const next = applyMealPlanSkip(
      byId(entry({ skipped_at: "2026-10-15T10:00:00Z" })),
      "entry-1",
      null,
    );
    expect(next["entry-1"]!.skipped_at).toBeNull();
  });

  it("does nothing for an unknown entry", () => {
    const state = byId(entry());
    expect(applyMealPlanSkip(state, "unknown", "2026-10-15T10:00:00Z")).toBe(
      state,
    );
  });

  it("does nothing for a deleted entry", () => {
    const state = byId(entry({ deleted_at: DELETED }));
    expect(applyMealPlanSkip(state, "entry-1", "2026-10-15T10:00:00Z")).toBe(
      state,
    );
  });
});
