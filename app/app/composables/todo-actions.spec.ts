import { describe, expect, it } from "vitest";
import {
  fetchOrCreateTodoList,
  fetchTodoItems,
  insertTodoItem,
  setTodoItemDone,
  softDeleteTodoItemRemote,
} from "./todo-actions";
import {
  fakeClient,
  fakeClientWithQueries,
  fakeQueryBuilder,
} from "../../tests/support/fake-supabase-client";

describe("fetchOrCreateTodoList", () => {
  const list = {
    id: "list-1",
    household_id: "h1",
    name: "Todos",
    created_at: "now",
  };

  it("returns the existing list without creating one", async () => {
    const query = fakeQueryBuilder({ data: list, error: null });
    const client = fakeClient({ from: () => query.builder });

    expect(await fetchOrCreateTodoList(client as never, "h1")).toEqual(list);
    expect(query.calls.eq).toEqual(["household_id", "h1"]);
    expect(query.calls.upsert).toBeUndefined();
  });

  it("creates a list when none exists yet, and reads it back", async () => {
    const lookup = fakeQueryBuilder({ data: null, error: null });
    const create = fakeQueryBuilder({ data: null, error: null });
    const readBack = fakeQueryBuilder({ data: list, error: null });
    const { client, from } = fakeClientWithQueries([lookup, create, readBack]);

    expect(await fetchOrCreateTodoList(client as never, "h1")).toEqual(list);
    expect(from).toHaveBeenCalledWith("todo_lists");
    // Ignoring the conflict is what makes two simultaneous first visits safe.
    expect(create.calls.upsert).toEqual([
      { household_id: "h1" },
      { onConflict: "household_id", ignoreDuplicates: true },
    ]);
    // No RETURNING on the insert: an ignored insert returns no row.
    expect(create.calls.select).toBeUndefined();
    expect(readBack.calls.eq).toEqual(["household_id", "h1"]);
  });

  it("throws when creating the list fails", async () => {
    const error = { message: "boom" };
    const { client } = fakeClientWithQueries([
      fakeQueryBuilder({ data: null, error: null }),
      fakeQueryBuilder({ data: null, error }),
    ]);

    await expect(fetchOrCreateTodoList(client as never, "h1")).rejects.toBe(
      error,
    );
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
