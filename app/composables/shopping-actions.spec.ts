import { describe, expect, it, vi } from "vitest";
import {
  fetchOrCreateShoppingList,
  fetchShoppingItems,
  insertShoppingItem,
  setShoppingItemChecked,
  softDeleteShoppingItemRemote,
} from "./shopping-actions";
import {
  fakeClient,
  fakeClientWithQueries,
  fakeQueryBuilder,
} from "../../tests/support/fake-supabase-client";

describe("fetchOrCreateShoppingList", () => {
  const list = {
    id: "list-1",
    household_id: "h1",
    name: "Shopping",
    created_at: "now",
  };

  it("returns the existing list without creating one", async () => {
    const query = fakeQueryBuilder({ data: list, error: null });
    const client = fakeClient({ from: () => query.builder });

    expect(await fetchOrCreateShoppingList(client as never, "h1")).toEqual(
      list,
    );
    expect(query.calls.eq).toEqual(["household_id", "h1"]);
    expect(query.calls.upsert).toBeUndefined();
  });

  it("creates a list when none exists yet, and reads it back", async () => {
    const lookup = fakeQueryBuilder({ data: null, error: null });
    const create = fakeQueryBuilder({ data: null, error: null });
    const readBack = fakeQueryBuilder({ data: list, error: null });
    const { client, from } = fakeClientWithQueries([lookup, create, readBack]);

    expect(await fetchOrCreateShoppingList(client as never, "h1")).toEqual(
      list,
    );
    expect(from).toHaveBeenCalledWith("shopping_lists");
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

    await expect(fetchOrCreateShoppingList(client as never, "h1")).rejects.toBe(
      error,
    );
  });
});

describe("fetchShoppingItems", () => {
  it("returns only non-deleted items of the list, ordered by position", async () => {
    const items = [{ id: "a", position: 1 }];
    const query = fakeQueryBuilder({ data: items, error: null });
    const from = vi.fn(() => query.builder);
    const client = fakeClient({ from });

    expect(await fetchShoppingItems(client as never, "list-1")).toEqual(items);
    expect(from).toHaveBeenCalledWith("shopping_items");
    expect(query.calls.eq).toEqual(["list_id", "list-1"]);
    expect(query.calls.is).toEqual(["deleted_at", null]);
    expect(query.calls.order).toEqual(["position"]);
  });
});

describe("insertShoppingItem", () => {
  it("inserts with the client-supplied id, quantity and the resolved created_by", async () => {
    const row = { id: "item-1", title: "Apples", quantity: "6" };
    const query = fakeQueryBuilder({ data: row, error: null });
    const client = fakeClient({ userId: "user-1", from: () => query.builder });

    const result = await insertShoppingItem(client as never, {
      id: "item-1",
      listId: "list-1",
      householdId: "h1",
      title: "Apples",
      quantity: "6",
      position: 1,
    });

    expect(result).toEqual(row);
    expect(query.calls.insert).toEqual([
      {
        id: "item-1",
        list_id: "list-1",
        household_id: "h1",
        title: "Apples",
        quantity: "6",
        position: 1,
        created_by: "user-1",
      },
    ]);
  });

  it("stores a missing quantity as null", async () => {
    const query = fakeQueryBuilder({ data: { id: "item-1" }, error: null });
    const client = fakeClient({ from: () => query.builder });

    await insertShoppingItem(client as never, {
      id: "item-1",
      listId: "list-1",
      householdId: "h1",
      title: "Bread",
      quantity: null,
      position: 1,
    });

    expect(
      (query.calls.insert![0] as { quantity: unknown }).quantity,
    ).toBeNull();
  });
});

describe("setShoppingItemChecked", () => {
  it("updates the checked flag for the given id", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });

    await setShoppingItemChecked(client as never, "item-1", true);

    expect(query.calls.update).toEqual([{ checked: true }]);
    expect(query.calls.eq).toEqual(["id", "item-1"]);
  });

  it("throws on error", async () => {
    const error = new Error("boom");
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      setShoppingItemChecked(client as never, "item-1", true),
    ).rejects.toBe(error);
  });
});

describe("softDeleteShoppingItemRemote", () => {
  it("sets deleted_at for the given id", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });

    await softDeleteShoppingItemRemote(client as never, "item-1");

    expect(query.calls.eq).toEqual(["id", "item-1"]);
    expect(
      typeof (query.calls.update![0] as { deleted_at: string }).deleted_at,
    ).toBe("string");
  });
});
