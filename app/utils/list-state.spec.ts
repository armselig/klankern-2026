import { describe, expect, it } from "vitest";
import type { ListRealtimeEvent } from "~/types/list";
import type { TodoItem } from "~/types/todo";
import {
  applyListRealtimeEvent,
  confirmListItem,
  mergeListResync,
  softDeleteListItem,
  ticksLastOpen,
  upsertListItem,
  visibleListItems,
} from "./list-state";

function item(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: "item-1",
    list_id: "list-1",
    household_id: "house-1",
    title: "Buy milk",
    done: false,
    position: 1,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("upsertListItem", () => {
  it("adds a new item under its id", () => {
    const result = upsertListItem({}, item());
    expect(result).toEqual({ "item-1": item() });
  });

  it("dedups: upserting the same id again (e.g. the server-confirmed echo of an optimistic insert) replaces, not duplicates", () => {
    const optimistic = item({ created_at: "pending" });
    const confirmed = item({ created_at: "2026-01-01T00:00:05Z" });

    let state = upsertListItem({}, optimistic);
    state = upsertListItem(state, confirmed);

    expect(Object.keys(state)).toEqual(["item-1"]);
    expect(state["item-1"]).toEqual(confirmed);
  });
});

describe("confirmListItem", () => {
  const optimistic = item({ created_at: "local", updated_at: "local" });
  const confirmed = item({ created_at: "server", updated_at: "server" });

  it("takes the confirmed row when nothing changed locally while saving", () => {
    const result = confirmListItem(
      { [optimistic.id]: optimistic },
      optimistic,
      confirmed,
    );
    expect(result[optimistic.id]).toEqual(confirmed);
  });

  it("keeps a check made while the add was saving", () => {
    const checked = { ...optimistic, done: true };
    const result = confirmListItem(
      { [optimistic.id]: checked },
      optimistic,
      confirmed,
    );
    expect(result[optimistic.id]).toEqual({ ...confirmed, done: true });
  });

  it("keeps a remove made while the add was saving", () => {
    const removed = { ...optimistic, deleted_at: "2026-01-02T00:00:00Z" };
    const result = confirmListItem(
      { [optimistic.id]: removed },
      optimistic,
      confirmed,
    );
    expect(result[optimistic.id]!.deleted_at).toBe("2026-01-02T00:00:00Z");
  });

  it("does not bring back an item that is no longer in state", () => {
    expect(confirmListItem({}, optimistic, confirmed)).toEqual({});
  });
});

describe("softDeleteListItem", () => {
  it("sets deleted_at on the targeted item and leaves others untouched", () => {
    const state = { "item-1": item(), "item-2": item({ id: "item-2" }) };
    const result = softDeleteListItem(state, "item-1");

    expect(result["item-1"]?.deleted_at).not.toBeNull();
    expect(result["item-2"]?.deleted_at).toBeNull();
  });

  it("is a no-op when the id is unknown", () => {
    const state = { "item-1": item() };
    expect(softDeleteListItem(state, "missing")).toBe(state);
  });
});

describe("visibleListItems", () => {
  it("excludes soft-deleted items", () => {
    const state = {
      "item-1": item({ id: "item-1" }),
      "item-2": item({ id: "item-2", deleted_at: "2026-01-02T00:00:00Z" }),
    };
    expect(visibleListItems(state).map((i) => i.id)).toEqual(["item-1"]);
  });

  it("sorts by position ascending", () => {
    const state = {
      a: item({ id: "a", position: 3 }),
      b: item({ id: "b", position: 1 }),
      c: item({ id: "c", position: 2 }),
    };
    expect(visibleListItems(state).map((i) => i.id)).toEqual(["b", "c", "a"]);
  });
});

function event(
  eventType: ListRealtimeEvent<TodoItem>["eventType"],
  row: TodoItem,
): ListRealtimeEvent<TodoItem> {
  return { eventType, new: row, commitTimestamp: "2026-01-01T00:00:00.000Z" };
}

describe("applyListRealtimeEvent", () => {
  it("adds an item inserted by another member", () => {
    const result = applyListRealtimeEvent(
      {},
      event("INSERT", item()),
      "list-1",
    );
    expect(result).toEqual({ "item-1": item() });
  });

  it("dedups the INSERT echo of an optimistic add", () => {
    const state = { "item-1": item({ created_at: "pending" }) };
    const result = applyListRealtimeEvent(
      state,
      event("INSERT", item()),
      "list-1",
    );

    expect(Object.keys(result)).toEqual(["item-1"]);
    expect(result["item-1"]).toEqual(item());
  });

  it("applies a remote toggle", () => {
    const state = { "item-1": item() };
    const result = applyListRealtimeEvent(
      state,
      event("UPDATE", item({ done: true })),
      "list-1",
    );
    expect(result["item-1"]?.done).toBe(true);
  });

  it("hides an item soft-deleted by another member", () => {
    const state = { "item-1": item() };
    const deleted = item({ deleted_at: "2026-01-02T00:00:00Z" });
    const result = applyListRealtimeEvent(
      state,
      event("UPDATE", deleted),
      "list-1",
    );

    expect(visibleListItems(result)).toEqual([]);
  });

  it("does not let a late INSERT or UPDATE resurrect a locally deleted item", () => {
    const state = { "item-1": item({ deleted_at: "2026-01-02T00:00:00Z" }) };

    expect(
      applyListRealtimeEvent(state, event("INSERT", item()), "list-1"),
    ).toBe(state);
    expect(
      applyListRealtimeEvent(
        state,
        event("UPDATE", item({ done: true })),
        "list-1",
      ),
    ).toBe(state);
  });

  it("ignores events for another list", () => {
    const state = { "item-1": item() };
    const other = item({ id: "item-2", list_id: "list-2" });
    expect(
      applyListRealtimeEvent(state, event("INSERT", other), "list-1"),
    ).toBe(state);
  });

  it("ignores every event while no list is loaded", () => {
    const state = {};
    expect(applyListRealtimeEvent(state, event("INSERT", item()), null)).toBe(
      state,
    );
  });
});

describe("mergeListResync", () => {
  it("takes the fetched rows as the new state", () => {
    const state = { "item-1": item({ title: "Old title" }) };
    const result = mergeListResync(state, [item({ title: "New title" })], []);
    expect(result).toEqual({ "item-1": item({ title: "New title" }) });
  });

  it("keeps an optimistic add the server has not confirmed yet", () => {
    const optimistic = item({ id: "pending-add" });
    const result = mergeListResync(
      { "pending-add": optimistic },
      [item()],
      ["pending-add"],
    );

    expect(result["pending-add"]).toEqual(optimistic);
    expect(result["item-1"]).toEqual(item());
  });

  it("keeps a pending local change over the fetched row", () => {
    const local = item({ done: true });
    const result = mergeListResync(
      { "item-1": local },
      [item({ done: false })],
      ["item-1"],
    );
    expect(result["item-1"]).toEqual(local);
  });

  it("keeps an item that arrived after the fetch was answered (missing from it)", () => {
    const arrived = item({ id: "item-2" });
    const state = { "item-1": item(), "item-2": arrived };
    const result = mergeListResync(state, [item()], ["item-2"]);
    expect(result["item-2"]).toEqual(arrived);
  });

  it("does not resurrect a locally deleted item the fetch still returns as live", () => {
    const tombstone = item({ deleted_at: "2026-01-02T00:00:00Z" });
    const result = mergeListResync({ "item-1": tombstone }, [item()], []);
    expect(visibleListItems(result)).toEqual([]);
  });

  it("drops an item deleted remotely while offline (missing from the fetch)", () => {
    const state = { "item-1": item(), "item-2": item({ id: "item-2" }) };
    const result = mergeListResync(state, [item()], []);
    expect(Object.keys(result)).toEqual(["item-1"]);
  });
});

describe("ticksLastOpen", () => {
  it("is true for the last open item", () => {
    expect(ticksLastOpen([item()], "item-1")).toBe(true);
  });

  it("is false while another item is still open", () => {
    expect(ticksLastOpen([item(), item({ id: "item-2" })], "item-1")).toBe(
      false,
    );
  });

  it("is false for an item that is not open (an untick)", () => {
    expect(ticksLastOpen([item({ id: "item-2" })], "item-1")).toBe(false);
  });

  it("is false when nothing is open", () => {
    expect(ticksLastOpen([], "item-1")).toBe(false);
  });
});
