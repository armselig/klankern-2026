import { describe, expect, it, vi } from "vitest";
import {
  fetchOrCreateTodoList,
  fetchTodoItems,
  insertTodoItem,
  setTodoItemDone,
  softDeleteTodoItemRemote,
} from "./todo-actions";
import {
  fakeClient,
  fakeQueryBuilder,
} from "../../tests/support/fake-supabase-client";

describe("fetchOrCreateTodoList", () => {
  it("returns the existing list without creating one", async () => {
    const list = {
      id: "list-1",
      household_id: "h1",
      name: "Todos",
      created_at: "now",
    };
    const query = fakeQueryBuilder({ data: list, error: null });
    const client = fakeClient({ from: () => query.builder });

    expect(await fetchOrCreateTodoList(client as never, "h1")).toEqual(list);
    expect(query.calls.insert).toBeUndefined();
  });

  it("creates a list when none exists yet", async () => {
    const created = {
      id: "list-1",
      household_id: "h1",
      name: "Todos",
      created_at: "now",
    };
    // maybeSingle() resolves null (no existing list) on the first call; the
    // insert().select().single() chain resolves the created row. Since our
    // fake builder is one shared object per `.from()` call, use two tables.
    let call = 0;
    const from = vi.fn(() => {
      call++;
      return call === 1
        ? fakeQueryBuilder({ data: null, error: null }).builder
        : fakeQueryBuilder({ data: created, error: null }).builder;
    });
    const client = fakeClient({ from });

    expect(await fetchOrCreateTodoList(client as never, "h1")).toEqual(created);
  });
});

describe("fetchTodoItems", () => {
  it("returns only non-deleted items, ordered by position", async () => {
    const items = [{ id: "a", position: 1 }];
    const query = fakeQueryBuilder({ data: items, error: null });
    const client = fakeClient({ from: () => query.builder });

    expect(await fetchTodoItems(client as never, "list-1")).toEqual(items);
    expect(query.calls.eq).toEqual(["list_id", "list-1"]);
    expect(query.calls.is).toEqual(["deleted_at", null]);
  });
});

describe("insertTodoItem", () => {
  it("inserts with the client-supplied id and the resolved created_by", async () => {
    const row = { id: "item-1", title: "Buy milk" };
    const query = fakeQueryBuilder({ data: row, error: null });
    const client = fakeClient({ userId: "user-1", from: () => query.builder });

    const result = await insertTodoItem(client as never, {
      id: "item-1",
      listId: "list-1",
      householdId: "h1",
      title: "Buy milk",
      position: 1,
    });

    expect(result).toEqual(row);
    expect(query.calls.insert).toEqual([
      {
        id: "item-1",
        list_id: "list-1",
        household_id: "h1",
        title: "Buy milk",
        position: 1,
        created_by: "user-1",
      },
    ]);
  });
});

describe("setTodoItemDone", () => {
  it("updates the done flag for the given id", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });

    await setTodoItemDone(client as never, "item-1", true);

    expect(query.calls.update).toEqual([{ done: true }]);
    expect(query.calls.eq).toEqual(["id", "item-1"]);
  });

  it("throws on error", async () => {
    const error = new Error("boom");
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(setTodoItemDone(client as never, "item-1", true)).rejects.toBe(
      error,
    );
  });
});

describe("softDeleteTodoItemRemote", () => {
  it("sets deleted_at for the given id", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });

    await softDeleteTodoItemRemote(client as never, "item-1");

    expect(query.calls.eq).toEqual(["id", "item-1"]);
    expect(
      typeof (query.calls.update![0] as { deleted_at: string }).deleted_at,
    ).toBe("string");
  });
});
