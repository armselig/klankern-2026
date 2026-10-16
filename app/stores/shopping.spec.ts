import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { ShoppingItem } from "~/types/shopping";
import { useShoppingStore } from "./shopping";
import {
  fakeClient,
  fakeQueryBuilder,
} from "../../tests/support/fake-supabase-client";

const HOUSEHOLD = "house-1";
const LIST = "list-1";

type QueryResult = { data: unknown; error: unknown };

/** What the store asked of the fake client, one record per query. */
interface Request {
  table: string;
  payload?: Record<string, unknown>;
  filters: Record<string, unknown>;
}

let idCounter = 0;
/** Ids differ between tests: the store keeps its bookkeeping at module level. */
function shoppingItem(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  idCounter += 1;
  return {
    id: `shopping-${idCounter}`,
    list_id: LIST,
    household_id: HOUSEHOLD,
    title: "Milk",
    quantity: null,
    checked: false,
    position: 1,
    created_by: "user-1",
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

/** A promise a test settles itself, to hold a request in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** The shared fake client with every query answered by `answer`, recording
 * the table, payload and filters of each. */
function setUpClient(answer: () => Promise<QueryResult> | QueryResult) {
  const requests: Request[] = [];
  const client = fakeClient({
    from: (table: string) => {
      const { builder } = fakeQueryBuilder({ data: null, error: null });
      const request: Request = { table, filters: {} };
      requests.push(request);
      builder.update = (payload: Record<string, unknown>) => {
        request.payload = payload;
        return builder;
      };
      builder.eq = (column: string, value: unknown) => {
        request.filters[column] = value;
        return builder;
      };
      builder.then = (
        resolve: (value: QueryResult) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(answer()).then(resolve, reject);
      return builder;
    },
  });
  vi.stubGlobal("useSupabaseClient", () => client);
  return { requests };
}

const ok = (): QueryResult => ({ data: null, error: null });
const fail = (message: string): QueryResult => ({
  data: null,
  error: { message },
});

function storeHolding(item: ShoppingItem) {
  const store = useShoppingStore();
  store.$patch({
    householdId: HOUSEHOLD,
    listId: LIST,
    itemsById: { [item.id]: item },
  });
  return store;
}

beforeEach(() => {
  setActivePinia(createPinia());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useShoppingStore toggle", () => {
  it("ticks at once, keeps the tick once saved and sends checked for that id", async () => {
    const item = shoppingItem();
    const save = deferred<QueryResult>();
    const { requests } = setUpClient(() => save.promise);
    const store = storeHolding(item);

    const toggling = store.toggle(item.id);

    expect(store.itemsById[item.id]!.checked).toBe(true);
    save.resolve(ok());
    await toggling;
    expect(store.itemsById[item.id]!.checked).toBe(true);
    expect(store.error).toBeNull();
    expect(requests).toHaveLength(1);
    expect(requests[0]!.table).toBe("shopping_items");
    expect(requests[0]!.payload).toEqual({ checked: true });
    expect(requests[0]!.filters).toEqual({ id: item.id });
  });

  it("unticks the item again and sets the error when the save fails", async () => {
    const item = shoppingItem();
    const save = deferred<QueryResult>();
    setUpClient(() => save.promise);
    const store = storeHolding(item);

    const toggling = store.toggle(item.id);
    expect(store.itemsById[item.id]!.checked).toBe(true);
    save.resolve(fail("offline"));
    await toggling;

    expect(store.itemsById[item.id]!.checked).toBe(false);
    expect(store.error).toBe("offline");
    expect(store.pendingIds).toEqual([]);
  });

  it("ticks a checked item again when its untick fails", async () => {
    const item = shoppingItem({ checked: true });
    setUpClient(() => fail("offline"));
    const store = storeHolding(item);

    await store.toggle(item.id);

    expect(store.itemsById[item.id]!.checked).toBe(true);
    expect(store.error).toBe("offline");
  });

  it("sends a quick untick and tick in the order they were made", async () => {
    const item = shoppingItem({ checked: true });
    const firstSave = deferred<QueryResult>();
    let calls = 0;
    const { requests } = setUpClient(() =>
      calls++ === 0 ? firstSave.promise : ok(),
    );
    const store = storeHolding(item);

    const untick = store.toggle(item.id);
    const tick = store.toggle(item.id);
    // Every promise step the store takes has run by the next macrotask.
    await new Promise((resolve) => setTimeout(resolve, 0));
    // The tick waits for the untick's save, or the server could commit it
    // first and keep the untick.
    expect(requests).toHaveLength(1);

    firstSave.resolve(ok());
    await Promise.all([untick, tick]);
    expect(requests.map((request) => request.payload)).toEqual([
      { checked: false },
      { checked: true },
    ]);
    expect(store.itemsById[item.id]!.checked).toBe(true);
  });
});
