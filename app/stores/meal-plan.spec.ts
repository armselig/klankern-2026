import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import type { MealPlanEntry } from "~/types/meal-plan";
import { MEAL_PLAN_PAGE_SIZE } from "~/composables/meal-plan-actions";
import { HELD_REMOVAL_MS, useMealPlanStore } from "./meal-plan";
import {
  fakeClient,
  fakeQueryBuilder,
} from "../../tests/support/fake-supabase-client";

const HOUSEHOLD = "house-1";
const WEEK = { from: "2026-10-12", to: "2026-10-18" };
const NEXT_MONTH = { from: "2026-11-02", to: "2026-11-08" };

type QueryResult = { data: unknown; error: unknown };

/** What the store asked of the fake client, one record per query. */
interface Request {
  op: "select" | "insert" | "update";
  payload?: unknown;
  range: { gte?: unknown; lte?: unknown };
  filters: Record<string, unknown>;
}

let idCounter = 0;
/** Ids differ between tests: the store keeps its Realtime order at module level. */
function entry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  idCounter += 1;
  return {
    id: `entry-${idCounter}`,
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

/** A promise a test settles itself, to hold a request in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/**
 * The shared fake client, with every query answered by `answer`. The shared
 * query builder resolves at once with a fixed result and has no `gte`/`lte`,
 * so each query it makes gets those, a record of what it was asked, and an
 * answer that may come later.
 */
function setUpClient(
  answer: (request: Request) => Promise<QueryResult> | QueryResult,
) {
  const requests: Request[] = [];
  const client = fakeClient({
    from: () => {
      const { builder } = fakeQueryBuilder({ data: null, error: null });
      const request: Request = { op: "select", range: {}, filters: {} };
      requests.push(request);
      builder.insert = (payload: unknown) => {
        request.op = "insert";
        request.payload = payload;
        return builder;
      };
      builder.update = (payload: unknown) => {
        request.op = "update";
        request.payload = payload;
        return builder;
      };
      builder.gte = (...args: unknown[]) => {
        request.range.gte = args;
        return builder;
      };
      builder.lte = (...args: unknown[]) => {
        request.range.lte = args;
        return builder;
      };
      builder.eq = (column: string, value: unknown) => {
        request.filters[column] = value;
        return builder;
      };
      builder.then = (
        resolve: (value: QueryResult) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(answer(request)).then(resolve, reject);
      return builder;
    },
  });
  vi.stubGlobal("useSupabaseClient", () => client);
  return { requests };
}

const ok = (data: unknown = null): QueryResult => ({ data, error: null });
const fail = (message: string): QueryResult => ({
  data: null,
  error: { message },
});

/** A server holding `rows`: selects answer with the rows in the range. */
function serverWith(rows: MealPlanEntry[]) {
  return (request: Request): QueryResult => {
    if (request.op === "insert")
      return ok(entry(request.payload as Partial<MealPlanEntry>));
    if (request.op !== "select") return ok();
    const [, from] = request.range.gte as [string, string];
    const [, to] = request.range.lte as [string, string];
    return ok(rows.filter((row) => row.date >= from && row.date <= to));
  };
}

function realtimeEvent(row: MealPlanEntry, commitTimestamp: string) {
  return { eventType: "UPDATE" as const, new: row, commitTimestamp };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.stubGlobal("useSupabaseUser", () => ref({ sub: "user-1" }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useMealPlanStore load", () => {
  it("replaces state on the first load and holds the range", async () => {
    const soup = entry();
    setUpClient(serverWith([soup]));
    const store = useMealPlanStore();

    await store.load(HOUSEHOLD, WEEK);

    expect(store.householdId).toBe(HOUSEHOLD);
    expect(store.entriesById).toEqual({ [soup.id]: soup });
    expect(store.loadedRanges).toEqual([WEEK]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.isLoaded(WEEK)).toBe(true);
  });

  it("shows the spinner only while the first fetch runs", async () => {
    const answer = deferred<QueryResult>();
    setUpClient(() => answer.promise);
    const store = useMealPlanStore();

    const loading = store.load(HOUSEHOLD, WEEK);
    expect(store.loading).toBe(true);
    answer.resolve(ok([]));
    await loading;
    expect(store.loading).toBe(false);
  });

  it("is not loaded for a range that was not fetched", async () => {
    setUpClient(serverWith([]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    expect(store.isLoaded(NEXT_MONTH)).toBe(false);
  });

  it("merges a second range into state and holds both ranges", async () => {
    const thisWeek = entry({ date: "2026-10-15" });
    const later = entry({ date: "2026-11-03" });
    setUpClient(serverWith([thisWeek, later]));
    const store = useMealPlanStore();

    await store.load(HOUSEHOLD, WEEK);
    await store.load(HOUSEHOLD, NEXT_MONTH);

    expect(Object.keys(store.entriesById).sort()).toEqual(
      [thisWeek.id, later.id].sort(),
    );
    expect(store.loadedRanges).toEqual([WEEK, NEXT_MONTH]);
  });

  it("keeps a local add that the second fetch does not have", async () => {
    const { requests } = setUpClient(serverWith([]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    await store.add({
      date: "2026-10-15",
      slot: "dinner",
      recipeId: null,
      title: "Stew",
    });
    requests.length = 0;

    await store.load(HOUSEHOLD, NEXT_MONTH);

    expect(store.visible.map((e) => e.title)).toEqual(["Stew"]);
  });

  it("resyncs instead of fetching behind a spinner for a range that is loaded", async () => {
    const { requests } = setUpClient(serverWith([]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    requests.length = 0;

    const inside = { from: "2026-10-13", to: "2026-10-14" };
    const reloading = store.load(HOUSEHOLD, inside);
    expect(store.loading).toBe(false);
    await reloading;

    // It repairs every range held, not the days asked for.
    expect(requests).toHaveLength(1);
    expect(requests[0]!.range.gte).toEqual(["date", WEEK.from]);
    expect(requests[0]!.range.lte).toEqual(["date", WEEK.to]);
  });

  it("starts over for another household", async () => {
    const mine = entry();
    const theirs = entry({ household_id: "house-2" });
    setUpClient(serverWith([mine]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    setUpClient(serverWith([theirs]));

    await store.load("house-2", WEEK);

    expect(store.householdId).toBe("house-2");
    expect(Object.keys(store.entriesById)).toEqual([theirs.id]);
  });

  it("pages through more than 1000 rows across the requests", async () => {
    const rows = Array.from({ length: 1020 }, (_, i) =>
      entry({ id: `row-${String(i).padStart(5, "0")}` }),
    );
    let page = 0;
    const { requests } = setUpClient(() => {
      const chunk = rows.slice(
        page * MEAL_PLAN_PAGE_SIZE,
        (page + 1) * MEAL_PLAN_PAGE_SIZE,
      );
      page += 1;
      return ok(chunk);
    });
    const store = useMealPlanStore();

    await store.load(HOUSEHOLD, WEEK);

    expect(requests).toHaveLength(3);
    expect(Object.keys(store.entriesById)).toHaveLength(1020);
  });

  it("sets the error and holds nothing when the fetch fails", async () => {
    setUpClient(() => fail("offline"));
    const store = useMealPlanStore();

    await store.load(HOUSEHOLD, WEEK);

    expect(store.error).toBe("offline");
    expect(store.householdId).toBeNull();
    expect(store.loadedRanges).toEqual([]);
    expect(store.loading).toBe(false);
  });
});

describe("useMealPlanStore resync", () => {
  it("does nothing before the first load", async () => {
    const { requests } = setUpClient(serverWith([]));
    await useMealPlanStore().resync();
    expect(requests).toEqual([]);
  });

  it("drops an entry removed remotely inside the ranges", async () => {
    const gone = entry();
    let rows = [gone];
    setUpClient((request) => serverWith(rows)(request));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    rows = [];

    await store.resync();

    expect(store.entriesById).toEqual({});
  });

  it("keeps an entry outside the ranges that came by Realtime", async () => {
    setUpClient(serverWith([]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    const far = entry({ date: "2030-01-01" });
    store.applyRealtimeEvent(realtimeEvent(far, "2026-10-15T10:00:00.000Z"));

    await store.resync();

    expect(store.entriesById[far.id]).toEqual(far);
  });

  it("does not drop an add whose insert is still in flight", async () => {
    const insert = deferred<QueryResult>();
    const { requests } = setUpClient((request) =>
      request.op === "insert" ? insert.promise : ok([]),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    const adding = store.add({
      date: "2026-10-15",
      slot: "dinner",
      recipeId: null,
      title: "Stew",
    });
    await vi.waitFor(() =>
      expect(requests.some((r) => r.op === "insert")).toBe(true),
    );
    await store.resync();
    expect(store.visible.map((e) => e.title)).toEqual(["Stew"]);

    const sent = requests.find((r) => r.op === "insert")!.payload as {
      id: string;
    };
    insert.resolve(ok(entry({ id: sent.id, title: "Stew" })));
    await adding;
  });

  it("keeps an entry changed by Realtime while the fetch was in flight", async () => {
    const original = entry({ title: "Soup" });
    const gate = deferred<undefined>();
    let hold = false;
    setUpClient(async (request) => {
      if (request.op === "select" && hold) await gate.promise;
      return serverWith([original])(request);
    });
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    hold = true;
    const syncing = store.resync();
    store.applyRealtimeEvent(
      realtimeEvent({ ...original, title: "Stew" }, "2026-10-15T10:00:00.000Z"),
    );
    gate.resolve(undefined);
    await syncing;

    expect(store.entriesById[original.id]!.title).toBe("Stew");
  });
});

describe("useMealPlanStore add", () => {
  const choice = {
    date: "2026-10-15",
    slot: "dinner" as const,
    recipeId: null,
    title: "Stew",
  };

  it("throws before a household is loaded", async () => {
    setUpClient(serverWith([]));
    await expect(useMealPlanStore().add(choice)).rejects.toThrow(
      "not_initialized",
    );
  });

  it("shows the entry at once and swaps in the saved row", async () => {
    const insert = deferred<QueryResult>();
    const { requests } = setUpClient((request) =>
      request.op === "insert" ? insert.promise : ok([]),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    const adding = store.add(choice);
    expect(store.visible).toHaveLength(1);
    expect(store.visible[0]).toMatchObject({
      title: "Stew",
      household_id: HOUSEHOLD,
      created_by: "user-1",
      position: 1,
    });
    const id = store.visible[0]!.id;
    expect(store.pendingIds).toEqual([id]);

    await vi.waitFor(() =>
      expect(requests.some((r) => r.op === "insert")).toBe(true),
    );
    expect(requests.find((r) => r.op === "insert")!.payload).toMatchObject({
      id,
      household_id: HOUSEHOLD,
      date: "2026-10-15",
      slot: "dinner",
      title: "Stew",
      created_by: "user-1",
    });
    insert.resolve(ok(entry({ id, title: "Stew", position: 1 })));

    expect(await adding).toBe(true);
    expect(store.visible).toHaveLength(1);
    expect(store.pendingIds).toEqual([]);
  });

  it("positions a new entry after the others in its slot and day only", async () => {
    setUpClient((request) => (request.op === "insert" ? ok(entry()) : ok([])));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    const first = store.add(choice);
    const second = store.add(choice);
    const lunch = store.add({ ...choice, slot: "lunch" });
    const otherDay = store.add({ ...choice, date: "2026-10-16" });
    const positions = Object.values(store.entriesById).map((e) => [
      e.slot,
      e.date,
      e.position,
    ]);
    await Promise.all([first, second, lunch, otherDay]);

    expect(positions).toEqual([
      ["dinner", "2026-10-15", 1],
      ["dinner", "2026-10-15", 2],
      ["lunch", "2026-10-15", 1],
      ["dinner", "2026-10-16", 1],
    ]);
  });

  it("takes the entry back and sets the error when the insert fails", async () => {
    setUpClient((request) =>
      request.op === "insert" ? fail("not allowed") : ok([]),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    expect(await store.add(choice)).toBe(false);

    expect(store.visible).toEqual([]);
    expect(store.entriesById).toEqual({});
    expect(store.error).toBe("not allowed");
    expect(store.pendingIds).toEqual([]);
  });

  it("does not duplicate when the Realtime echo arrives before the answer", async () => {
    const insert = deferred<QueryResult>();
    const { requests } = setUpClient((request) =>
      request.op === "insert" ? insert.promise : ok([]),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    const adding = store.add(choice);
    const id = store.visible[0]!.id;
    const saved = entry({ id, title: "Stew" });
    store.applyRealtimeEvent({
      eventType: "INSERT",
      new: saved,
      commitTimestamp: "2026-10-15T10:00:00.000Z",
    });
    expect(store.visible).toHaveLength(1);
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    insert.resolve(ok(saved));
    await adding;

    expect(store.visible).toHaveLength(1);
  });
});

describe("useMealPlanStore setSkipped", () => {
  it("marks the entry at once and sends skipped_at", async () => {
    const soup = entry();
    const update = deferred<QueryResult>();
    const { requests } = setUpClient((request) =>
      request.op === "update" ? update.promise : serverWith([soup])(request),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    const skipping = store.setSkipped(soup.id, true);
    expect(store.entriesById[soup.id]!.skipped_at).not.toBeNull();
    await vi.waitFor(() =>
      expect(requests.some((r) => r.op === "update")).toBe(true),
    );
    const update_ = requests.find((r) => r.op === "update")!;
    expect(update_.filters).toEqual({ id: soup.id });
    expect(update_.payload).toEqual({
      skipped_at: store.entriesById[soup.id]!.skipped_at,
    });
    update.resolve(ok());
    await skipping;

    expect(store.entriesById[soup.id]!.skipped_at).not.toBeNull();
    expect(store.error).toBeNull();
  });

  it("clears the mark with false", async () => {
    const skipped = entry({ skipped_at: "2026-10-15T10:00:00Z" });
    const { requests } = setUpClient(serverWith([skipped]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    await store.setSkipped(skipped.id, false);

    expect(store.entriesById[skipped.id]!.skipped_at).toBeNull();
    expect(requests.at(-1)!.payload).toEqual({ skipped_at: null });
  });

  it("puts the previous mark back and sets the error when the server refuses", async () => {
    const soup = entry();
    setUpClient((request) =>
      request.op === "update" ? fail("refused") : serverWith([soup])(request),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    await store.setSkipped(soup.id, true);

    expect(store.entriesById[soup.id]!.skipped_at).toBeNull();
    expect(store.error).toBe("refused");
    expect(store.pendingIds).toEqual([]);
  });

  it("restores a mark that was set before when clearing it is refused", async () => {
    const skipped = entry({ skipped_at: "2026-10-15T10:00:00Z" });
    setUpClient((request) =>
      request.op === "update"
        ? fail("refused")
        : serverWith([skipped])(request),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    await store.setSkipped(skipped.id, false);

    expect(store.entriesById[skipped.id]!.skipped_at).toBe(
      "2026-10-15T10:00:00Z",
    );
  });

  it("does nothing for an unknown or deleted entry", async () => {
    const gone = entry({ deleted_at: "2026-10-15T09:00:00Z" });
    const { requests } = setUpClient(serverWith([]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    store.applyRealtimeEvent(realtimeEvent(gone, "2026-10-15T10:00:00.000Z"));
    requests.length = 0;

    await store.setSkipped("unknown", true);
    await store.setSkipped(gone.id, true);

    expect(requests).toEqual([]);
  });
});

describe("useMealPlanStore update", () => {
  const updatesOf = (requests: Request[]) =>
    requests.filter((request) => request.op === "update");

  it("changes the columns at once and sends only those", async () => {
    const soup = entry();
    const answer = deferred<QueryResult>();
    const { requests } = setUpClient((request) =>
      request.op === "update" ? answer.promise : serverWith([soup])(request),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    const updating = store.update(soup.id, { title: "Stew" });
    expect(store.entriesById[soup.id]).toEqual({ ...soup, title: "Stew" });
    expect(store.pendingIds).toEqual([soup.id]);
    await vi.waitFor(() => expect(updatesOf(requests)).toHaveLength(1));
    expect(updatesOf(requests)[0]!.filters).toEqual({ id: soup.id });
    expect(updatesOf(requests)[0]!.payload).toEqual({ title: "Stew" });
    answer.resolve(ok());

    expect(await updating).toBe(true);
    expect(store.entriesById[soup.id]!.title).toBe("Stew");
    expect(store.pendingIds).toEqual([]);
    expect(store.error).toBeNull();
  });

  it("takes back only the changed columns when the server refuses", async () => {
    const soup = entry({ title: "Soup" });
    const answer = deferred<QueryResult>();
    const { requests } = setUpClient((request) =>
      request.op === "update" ? answer.promise : serverWith([soup])(request),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    const updating = store.update(soup.id, {
      skipped_at: "2026-10-15T10:00:00Z",
    });
    await vi.waitFor(() => expect(updatesOf(requests)).toHaveLength(1));
    // Another device renames the entry while the request is on its way.
    store.applyRealtimeEvent(
      realtimeEvent(
        { ...soup, title: "Stew", skipped_at: "2026-10-15T10:00:00Z" },
        "2026-10-15T10:00:01.000Z",
      ),
    );
    answer.resolve(fail("refused"));

    expect(await updating).toBe(false);
    expect(store.entriesById[soup.id]!.skipped_at).toBeNull();
    expect(store.entriesById[soup.id]!.title).toBe("Stew");
    expect(store.error).toBe("refused");
    expect(store.pendingIds).toEqual([]);
  });

  it("takes back every column of a change that touches several", async () => {
    const soup = entry({ recipe_id: null, title: "Soup" });
    setUpClient((request) =>
      request.op === "update" ? fail("refused") : serverWith([soup])(request),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    await store.update(soup.id, { recipe_id: "recipe-1", title: null });

    expect(store.entriesById[soup.id]).toEqual(soup);
  });

  it("clears an earlier error when it starts", async () => {
    const soup = entry();
    setUpClient(serverWith([soup]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    store.error = "old";

    await store.update(soup.id, { title: "Stew" });

    expect(store.error).toBeNull();
  });

  it("waits for the insert of an entry that is still being saved", async () => {
    const insert = deferred<QueryResult>();
    const { requests } = setUpClient((request) =>
      request.op === "insert" ? insert.promise : ok([]),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    const adding = store.add({
      date: "2026-10-15",
      slot: "dinner",
      recipeId: null,
      title: "Stew",
    });
    const id = store.visible[0]!.id;
    await vi.waitFor(() =>
      expect(requests.some((r) => r.op === "insert")).toBe(true),
    );

    const updating = store.update(id, { title: "Pasta" });
    await Promise.resolve();
    expect(store.entriesById[id]!.title).toBe("Pasta");
    expect(updatesOf(requests)).toEqual([]);
    insert.resolve(ok(entry({ id, title: "Stew" })));
    await Promise.all([adding, updating]);

    expect(updatesOf(requests)).toHaveLength(1);
    expect(requests.at(-1)!.op).toBe("update");
  });

  it("returns false and sends nothing for an unknown or deleted entry", async () => {
    const gone = entry({ deleted_at: "2026-10-15T09:00:00Z" });
    const { requests } = setUpClient(serverWith([]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    store.applyRealtimeEvent(realtimeEvent(gone, "2026-10-15T10:00:00.000Z"));
    requests.length = 0;

    expect(await store.update("unknown", { title: "Stew" })).toBe(false);
    expect(await store.update(gone.id, { title: "Stew" })).toBe(false);

    expect(requests).toEqual([]);
    expect(store.entriesById[gone.id]!.title).toBe("Soup");
  });
});

describe("useMealPlanStore move", () => {
  async function loadedStoreWith(...rows: MealPlanEntry[]) {
    const server = setUpClient(serverWith(rows));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    server.requests.length = 0;
    return { store, requests: server.requests };
  }

  it("puts the entry at once on the other day and slot, after the live entries there", async () => {
    const moving = entry({ date: "2026-10-15", slot: "dinner", position: 1 });
    const first = entry({ date: "2026-10-16", slot: "lunch", position: 2 });
    const last = entry({ date: "2026-10-16", slot: "lunch", position: 5 });
    const removed = entry({
      date: "2026-10-16",
      slot: "lunch",
      position: 9,
      deleted_at: "2026-10-15T09:00:00Z",
    });
    const otherSlot = entry({
      date: "2026-10-16",
      slot: "dinner",
      position: 7,
    });
    const answer = deferred<QueryResult>();
    const { requests } = setUpClient((request) =>
      request.op === "update"
        ? answer.promise
        : serverWith([moving, first, last, removed, otherSlot])(request),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    const moved = store.move(moving.id, "2026-10-16", "lunch");
    expect(store.entriesById[moving.id]).toMatchObject({
      date: "2026-10-16",
      slot: "lunch",
      position: 6,
    });
    await vi.waitFor(() =>
      expect(requests.some((r) => r.op === "update")).toBe(true),
    );
    expect(requests.find((r) => r.op === "update")!.payload).toEqual({
      date: "2026-10-16",
      slot: "lunch",
      position: 6,
    });
    answer.resolve(ok());

    expect(await moved).toBe(true);
  });

  it("takes position 1 in an empty slot", async () => {
    const moving = entry({ position: 4 });
    const { store } = await loadedStoreWith(moving);

    await store.move(moving.id, "2026-10-17", "breakfast");

    expect(store.entriesById[moving.id]).toMatchObject({
      date: "2026-10-17",
      slot: "breakfast",
      position: 1,
    });
  });

  it("does not count the entry itself when it moves within its own slot", async () => {
    const other = entry({ position: 2 });
    const moving = entry({ position: 8 });
    const { store } = await loadedStoreWith(other, moving);

    await store.move(moving.id, other.date, "dinner");

    expect(store.entriesById[moving.id]!.position).toBe(3);
  });

  it("keeps the note that the ingredients are on the shopping list", async () => {
    const noted = entry({ on_shopping_list_at: "2026-10-14T10:00:00Z" });
    const { store, requests } = await loadedStoreWith(noted);

    await store.move(noted.id, "2026-10-16", "lunch");

    expect(store.entriesById[noted.id]!.on_shopping_list_at).toBe(
      "2026-10-14T10:00:00Z",
    );
    expect(requests.at(-1)!.payload).not.toHaveProperty("on_shopping_list_at");
  });

  it("puts the entry back where it was when the server refuses", async () => {
    const soup = entry({ date: "2026-10-15", slot: "dinner", position: 3 });
    setUpClient((request) =>
      request.op === "update" ? fail("refused") : serverWith([soup])(request),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    expect(await store.move(soup.id, "2026-10-16", "lunch")).toBe(false);

    expect(store.entriesById[soup.id]).toEqual(soup);
    expect(store.error).toBe("refused");
  });

  it("returns false for an unknown entry", async () => {
    const { store, requests } = await loadedStoreWith();
    expect(await store.move("unknown", "2026-10-16", "lunch")).toBe(false);
    expect(requests).toEqual([]);
  });
});

describe("useMealPlanStore makeRecipeOf", () => {
  it("sets the recipe and clears the title and the shopping note in one update", async () => {
    const titled = entry({
      title: "Soup",
      recipe_id: null,
      on_shopping_list_at: "2026-10-14T10:00:00Z",
    });
    const { requests } = setUpClient(serverWith([titled]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    requests.length = 0;

    expect(await store.makeRecipeOf(titled.id, "recipe-1")).toBe(true);

    expect(store.entriesById[titled.id]).toMatchObject({
      recipe_id: "recipe-1",
      title: null,
      on_shopping_list_at: null,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.op).toBe("update");
    expect(requests[0]!.filters).toEqual({ id: titled.id });
    expect(requests[0]!.payload).toEqual({
      recipe_id: "recipe-1",
      title: null,
      on_shopping_list_at: null,
    });
  });

  it("restores the title and the shopping note when the server refuses", async () => {
    const titled = entry({
      title: "Soup",
      on_shopping_list_at: "2026-10-14T10:00:00Z",
    });
    setUpClient((request) =>
      request.op === "update" ? fail("refused") : serverWith([titled])(request),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    expect(await store.makeRecipeOf(titled.id, "recipe-1")).toBe(false);

    expect(store.entriesById[titled.id]).toEqual(titled);
    expect(store.error).toBe("refused");
  });

  it("sends the update for an entry that is not in state", async () => {
    // The recipe form may have been reloaded, which empties the store.
    const { requests } = setUpClient(serverWith([]));
    const store = useMealPlanStore();

    expect(await store.makeRecipeOf("elsewhere", "recipe-1")).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.op).toBe("update");
    expect(requests[0]!.filters).toEqual({ id: "elsewhere" });
    expect(requests[0]!.payload).toEqual({
      recipe_id: "recipe-1",
      title: null,
      on_shopping_list_at: null,
    });
    expect(store.entriesById).toEqual({});
  });

  it("returns false and sets the error when that update is refused", async () => {
    setUpClient(() => fail("refused"));
    const store = useMealPlanStore();

    expect(await store.makeRecipeOf("elsewhere", "recipe-1")).toBe(false);
    expect(store.error).toBe("refused");
  });
});

describe("useMealPlanStore markOnShoppingList", () => {
  it("notes the time at once and sends on_shopping_list_at", async () => {
    const soup = entry();
    const { requests } = setUpClient(serverWith([soup]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    await store.markOnShoppingList(soup.id);

    const noted = store.entriesById[soup.id]!.on_shopping_list_at;
    expect(noted).not.toBeNull();
    expect(requests.at(-1)!.op).toBe("update");
    expect(requests.at(-1)!.payload).toEqual({ on_shopping_list_at: noted });
  });

  it("rejects with the server's message and takes the note back when refused", async () => {
    const soup = entry();
    setUpClient((request) =>
      request.op === "update" ? fail("refused") : serverWith([soup])(request),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    await expect(store.markOnShoppingList(soup.id)).rejects.toThrow("refused");

    expect(store.entriesById[soup.id]!.on_shopping_list_at).toBeNull();
    expect(store.error).toBe("refused");
  });

  it("rejects for an unknown entry without sending anything", async () => {
    const { requests } = setUpClient(serverWith([]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    requests.length = 0;

    await expect(store.markOnShoppingList("unknown")).rejects.toThrow(
      "not_saved",
    );
    expect(requests).toEqual([]);
  });
});

describe("useMealPlanStore remove", () => {
  it("soft deletes at once and sends deleted_at, not a delete", async () => {
    const soup = entry();
    const { requests } = setUpClient(serverWith([soup]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    await store.remove(soup.id);

    expect(store.entriesById[soup.id]!.deleted_at).not.toBeNull();
    expect(store.visible).toEqual([]);
    const update = requests.at(-1)!;
    expect(update.op).toBe("update");
    expect(update.payload).toHaveProperty("deleted_at");
  });

  it("brings the entry back and sets the error when the server refuses", async () => {
    const soup = entry();
    setUpClient((request) =>
      request.op === "update" ? fail("refused") : serverWith([soup])(request),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    await store.remove(soup.id);

    expect(store.visible.map((e) => e.id)).toEqual([soup.id]);
    expect(store.error).toBe("refused");
  });

  it("waits for the insert of an entry that is still being saved", async () => {
    const insert = deferred<QueryResult>();
    const { requests } = setUpClient((request) =>
      request.op === "insert" ? insert.promise : ok([]),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    const adding = store.add({
      date: "2026-10-15",
      slot: "dinner",
      recipeId: null,
      title: "Stew",
    });
    const id = store.visible[0]!.id;
    await vi.waitFor(() =>
      expect(requests.some((r) => r.op === "insert")).toBe(true),
    );

    const removing = store.remove(id);
    await Promise.resolve();
    expect(requests.some((r) => r.op === "update")).toBe(false);
    insert.resolve(ok(entry({ id })));
    await Promise.all([adding, removing]);

    expect(requests.at(-1)!.op).toBe("update");
    expect(store.entriesById[id]!.deleted_at).not.toBeNull();
  });
});

describe("useMealPlanStore held removal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  async function loadedStoreWith(...rows: MealPlanEntry[]) {
    const server = setUpClient(serverWith(rows));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    server.requests.length = 0;
    return { store, requests: server.requests };
  }

  const updates = (requests: Request[]) =>
    requests.filter((request) => request.op === "update");

  it("hides the entry at once and sends nothing yet", async () => {
    const soup = entry();
    const { store, requests } = await loadedStoreWith(soup);

    store.holdRemoval(soup.id);

    expect(store.visible).toEqual([]);
    expect(store.heldRemovalIds).toEqual([soup.id]);
    expect(store.entriesById[soup.id]!.deleted_at).toBeNull();
    await vi.advanceTimersByTimeAsync(HELD_REMOVAL_MS - 1);
    expect(requests).toEqual([]);
  });

  it("shows the entry again on Undo and never sends the removal", async () => {
    const soup = entry();
    const { store, requests } = await loadedStoreWith(soup);
    store.holdRemoval(soup.id);

    store.undoRemoval(soup.id);
    await vi.advanceTimersByTimeAsync(HELD_REMOVAL_MS * 2);

    expect(store.visible.map((e) => e.id)).toEqual([soup.id]);
    expect(store.heldRemovalIds).toEqual([]);
    expect(requests).toEqual([]);
  });

  it("sends the soft delete when the hold ends", async () => {
    const soup = entry();
    const { store, requests } = await loadedStoreWith(soup);
    store.holdRemoval(soup.id);

    await vi.advanceTimersByTimeAsync(HELD_REMOVAL_MS);

    expect(updates(requests)).toHaveLength(1);
    expect(updates(requests)[0]!.filters).toEqual({ id: soup.id });
    expect(updates(requests)[0]!.payload).toHaveProperty("deleted_at");
    expect(store.heldRemovalIds).toEqual([]);
    expect(store.entriesById[soup.id]!.deleted_at).not.toBeNull();
    expect(store.visible).toEqual([]);
  });

  it("sends the first removal at once when a second one is held", async () => {
    const first = entry({ position: 1 });
    const second = entry({ position: 2 });
    const { store, requests } = await loadedStoreWith(first, second);
    store.holdRemoval(first.id);

    store.holdRemoval(second.id);
    await vi.advanceTimersByTimeAsync(0);

    expect(updates(requests)).toHaveLength(1);
    expect(updates(requests)[0]!.filters).toEqual({ id: first.id });
    expect(store.heldRemovalIds).toEqual([second.id]);

    // Only the latest one can be undone.
    store.undoRemoval(second.id);
    await vi.advanceTimersByTimeAsync(HELD_REMOVAL_MS);
    expect(updates(requests)).toHaveLength(1);
    expect(store.visible.map((e) => e.id)).toEqual([second.id]);
  });

  it("does not send a removal a second time when its timer would fire later", async () => {
    const first = entry();
    const second = entry();
    const { store, requests } = await loadedStoreWith(first, second);
    store.holdRemoval(first.id);
    store.holdRemoval(second.id);

    await vi.advanceTimersByTimeAsync(HELD_REMOVAL_MS * 2);

    expect(updates(requests)).toHaveLength(2);
  });

  it("sends every held removal on flushHeldRemovals", async () => {
    const soup = entry();
    const { store, requests } = await loadedStoreWith(soup);
    store.holdRemoval(soup.id);

    await store.flushHeldRemovals();

    expect(updates(requests)).toHaveLength(1);
    expect(store.heldRemovalIds).toEqual([]);
    await vi.advanceTimersByTimeAsync(HELD_REMOVAL_MS);
    expect(updates(requests)).toHaveLength(1);
  });

  it("does nothing for flushHeldRemovals without a hold", async () => {
    const { store, requests } = await loadedStoreWith(entry());
    await store.flushHeldRemovals();
    expect(requests).toEqual([]);
  });

  it("does not hold an unknown or deleted entry", async () => {
    const gone = entry({ deleted_at: "2026-10-15T09:00:00Z" });
    const { store } = await loadedStoreWith();
    store.applyRealtimeEvent(realtimeEvent(gone, "2026-10-15T10:00:00.000Z"));

    store.holdRemoval("unknown");
    store.holdRemoval(gone.id);

    expect(store.heldRemovalIds).toEqual([]);
  });

  it("keeps the entry hidden through a resync during the hold", async () => {
    const soup = entry();
    const { store } = await loadedStoreWith(soup);
    store.holdRemoval(soup.id);

    await store.resync();

    expect(store.entriesById[soup.id]).toBeDefined();
    expect(store.visible).toEqual([]);
    expect(store.heldRemovalIds).toEqual([soup.id]);
  });

  it("keeps the entry hidden through a Realtime event during the hold", async () => {
    const soup = entry();
    const { store } = await loadedStoreWith(soup);
    store.holdRemoval(soup.id);

    store.applyRealtimeEvent(
      realtimeEvent({ ...soup, title: "Stew" }, "2026-10-15T10:00:00.000Z"),
    );

    expect(store.entriesById[soup.id]!.title).toBe("Stew");
    expect(store.visible).toEqual([]);
  });

  it("keeps a removed entry dead when a resync fetch still returns it", async () => {
    const soup = entry();
    const { store } = await loadedStoreWith(soup);
    store.holdRemoval(soup.id);
    await vi.advanceTimersByTimeAsync(HELD_REMOVAL_MS);

    // The fake server still holds the entry live, as a stale fetch would.
    await store.resync();
    store.applyRealtimeEvent(realtimeEvent(soup, "2026-10-15T11:00:00.000Z"));

    expect(store.entriesById[soup.id]!.deleted_at).not.toBeNull();
    expect(store.visible).toEqual([]);
  });

  it("brings the entry back when the removal is refused after the hold", async () => {
    const soup = entry();
    setUpClient((request) =>
      request.op === "update" ? fail("refused") : serverWith([soup])(request),
    );
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);
    store.holdRemoval(soup.id);

    await vi.advanceTimersByTimeAsync(HELD_REMOVAL_MS);

    expect(store.visible.map((e) => e.id)).toEqual([soup.id]);
    expect(store.error).toBe("refused");
  });
});

describe("useMealPlanStore applyRealtimeEvent", () => {
  it("drops an event committed before the newest one seen for the entry", async () => {
    const soup = entry();
    setUpClient(serverWith([soup]));
    const store = useMealPlanStore();
    await store.load(HOUSEHOLD, WEEK);

    store.applyRealtimeEvent(
      realtimeEvent({ ...soup, title: "Newer" }, "2026-10-15T10:00:02.000Z"),
    );
    store.applyRealtimeEvent(
      realtimeEvent({ ...soup, title: "Older" }, "2026-10-15T10:00:01.000Z"),
    );

    expect(store.entriesById[soup.id]!.title).toBe("Newer");
  });

  it("ignores events before the first load", () => {
    setUpClient(serverWith([]));
    const store = useMealPlanStore();
    store.applyRealtimeEvent(
      realtimeEvent(entry(), "2026-10-15T10:00:00.000Z"),
    );
    expect(store.entriesById).toEqual({});
  });
});
