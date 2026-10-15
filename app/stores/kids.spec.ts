import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import type {
  HouseholdChild,
  HouseholdChildRealtimeEvent,
  MealReaction,
  MealReactionRealtimeEvent,
} from "~/types/kids";
import { liveReactionOf } from "~/utils/kids-state";
import { useKidsStore } from "./kids";
import {
  fakeClient,
  fakeQueryBuilder,
} from "../../tests/support/fake-supabase-client";

const HOUSEHOLD = "house-1";
const DELETED = "2026-10-15T09:00:00Z";

type QueryResult = { data: unknown; error: unknown };

/** What the store asked of the fake client, one record per query. */
interface Request {
  table: string;
  op: "select" | "insert" | "update";
  payload?: Record<string, unknown>;
  filters: Record<string, unknown>;
}

let idCounter = 0;
/** Ids differ between tests: the store keeps its Realtime order at module level. */
function child(overrides: Partial<HouseholdChild> = {}): HouseholdChild {
  idCounter += 1;
  return {
    id: `child-${idCounter}`,
    household_id: HOUSEHOLD,
    name: "Mila",
    created_by: "user-1",
    created_at: "2026-10-01T12:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function reaction(overrides: Partial<MealReaction> = {}): MealReaction {
  idCounter += 1;
  return {
    id: `reaction-${idCounter}`,
    household_id: HOUSEHOLD,
    entry_id: "entry-1",
    child_id: "child-1",
    reaction: "refused",
    created_by: "user-1",
    created_at: "2026-10-10T18:00:00Z",
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
 * query builder resolves at once with a fixed result, so each query it makes
 * gets a record of the table, the operation and its filters, and an answer
 * that may come later.
 */
function setUpClient(
  answer: (request: Request) => Promise<QueryResult> | QueryResult,
) {
  const requests: Request[] = [];
  const client = fakeClient({
    from: (table: string) => {
      const { builder } = fakeQueryBuilder({ data: null, error: null });
      const request: Request = { table, op: "select", filters: {} };
      requests.push(request);
      builder.insert = (payload: Record<string, unknown>) => {
        request.op = "insert";
        request.payload = payload;
        return builder;
      };
      builder.update = (payload: Record<string, unknown>) => {
        request.op = "update";
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

/** A server holding `children` and `reactions`: selects answer with them,
 * and an insert answers with the row it was given. */
function serverWith(children: HouseholdChild[], reactions: MealReaction[]) {
  return (request: Request): QueryResult => {
    if (request.op === "insert")
      return ok({
        created_at: "2026-10-15T12:00:00Z",
        deleted_at: null,
        ...request.payload,
      });
    if (request.op !== "select") return ok();
    return ok(request.table === "household_children" ? children : reactions);
  };
}

const inserts = (requests: Request[]) =>
  requests.filter((request) => request.op === "insert");
const updates = (requests: Request[]) =>
  requests.filter((request) => request.op === "update");

function childEvent(
  row: HouseholdChild,
  commitTimestamp: string,
  eventType: HouseholdChildRealtimeEvent["eventType"] = "UPDATE",
): HouseholdChildRealtimeEvent {
  return { eventType, new: row, commitTimestamp };
}

function reactionEvent(
  row: MealReaction,
  commitTimestamp: string,
  eventType: MealReactionRealtimeEvent["eventType"] = "UPDATE",
): MealReactionRealtimeEvent {
  return { eventType, new: row, commitTimestamp };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.stubGlobal("useSupabaseUser", () => ref({ sub: "user-1" }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useKidsStore load", () => {
  it("replaces state with both tables on the first load", async () => {
    const mila = child();
    const refusal = reaction({ child_id: mila.id });
    setUpClient(serverWith([mila], [refusal]));
    const store = useKidsStore();

    await store.load(HOUSEHOLD);

    expect(store.householdId).toBe(HOUSEHOLD);
    expect(store.childrenById).toEqual({ [mila.id]: mila });
    expect(store.reactionsById).toEqual({ [refusal.id]: refusal });
    expect(store.children).toEqual([mila]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("shows the spinner only while the first fetch runs", async () => {
    const answer = deferred<QueryResult>();
    setUpClient(() => answer.promise);
    const store = useKidsStore();

    const loading = store.load(HOUSEHOLD);
    expect(store.loading).toBe(true);
    answer.resolve(ok([]));
    await loading;
    expect(store.loading).toBe(false);
  });

  it("resyncs instead of fetching behind a spinner on a second load", async () => {
    const mila = child();
    const { requests } = setUpClient(serverWith([mila], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    requests.length = 0;
    const jo = child({ name: "Jo" });
    setUpClient(serverWith([mila, jo], []));

    const reloading = store.load(HOUSEHOLD);
    expect(store.loading).toBe(false);
    await reloading;

    expect(Object.keys(store.childrenById).sort()).toEqual(
      [mila.id, jo.id].sort(),
    );
  });

  it("starts over for another household", async () => {
    const mine = child();
    const theirs = child({ household_id: "house-2" });
    setUpClient(serverWith([mine], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    setUpClient(serverWith([theirs], []));

    await store.load("house-2");

    expect(store.householdId).toBe("house-2");
    expect(Object.keys(store.childrenById)).toEqual([theirs.id]);
  });

  it("sets the error and holds nothing when the reactions fail but the children came", async () => {
    setUpClient((request) =>
      request.table === "meal_reactions" ? fail("offline") : ok([child()]),
    );
    const store = useKidsStore();

    await store.load(HOUSEHOLD);

    expect(store.error).toBe("offline");
    expect(store.householdId).toBeNull();
    expect(store.childrenById).toEqual({});
    expect(store.reactionsById).toEqual({});
    expect(store.loading).toBe(false);
  });

  it("clears an earlier error when a load starts", async () => {
    setUpClient(() => fail("offline"));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    setUpClient(serverWith([], []));

    await store.load(HOUSEHOLD);

    expect(store.error).toBeNull();
    expect(store.householdId).toBe(HOUSEHOLD);
  });
});

describe("useKidsStore resync", () => {
  it("does nothing before the first load", async () => {
    const { requests } = setUpClient(serverWith([], []));
    const store = useKidsStore();

    await store.resync();

    expect(requests).toEqual([]);
  });

  it("leaves state as it was when one of the two fetches fails", async () => {
    const mila = child();
    setUpClient(serverWith([mila], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    const jo = child({ name: "Jo" });
    setUpClient((request) =>
      request.table === "meal_reactions" ? fail("offline") : ok([mila, jo]),
    );

    await store.resync();

    expect(store.error).toBe("offline");
    expect(Object.keys(store.childrenById)).toEqual([mila.id]);
  });

  it("keeps a local add the fetch does not have yet", async () => {
    setUpClient(serverWith([], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    const insert = deferred<QueryResult>();
    setUpClient((request) =>
      request.op === "insert" ? insert.promise : ok([]),
    );
    const adding = store.addChild("Mila");

    await store.resync();

    expect(store.children.map((c) => c.name)).toEqual(["Mila"]);
    insert.resolve(ok({ id: store.children[0]!.id, name: "Mila" }));
    await adding;
  });

  it("keeps the version of a row an event changed while the fetch was in flight", async () => {
    const mila = child();
    setUpClient(serverWith([mila], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    const answer = deferred<QueryResult>();
    setUpClient((request) =>
      request.table === "household_children" ? answer.promise : ok([]),
    );

    const resyncing = store.resync();
    store.applyChildEvent(
      childEvent({ ...mila, name: "Milena" }, "2026-10-15T10:00:00.000Z"),
    );
    answer.resolve(ok([mila]));
    await resyncing;

    expect(store.childrenById[mila.id]!.name).toBe("Milena");
  });

  it("drops a child the server no longer lists", async () => {
    const mila = child();
    setUpClient(serverWith([mila], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    setUpClient(serverWith([], []));

    await store.resync();

    expect(store.children).toEqual([]);
  });
});

describe("useKidsStore applyChildEvent", () => {
  it("ignores events before the first load", () => {
    setUpClient(serverWith([], []));
    const store = useKidsStore();

    store.applyChildEvent(childEvent(child(), "2026-10-15T10:00:00.000Z"));

    expect(store.childrenById).toEqual({});
  });

  it("adds a child another member added", async () => {
    setUpClient(serverWith([], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    const jo = child({ name: "Jo" });

    store.applyChildEvent(childEvent(jo, "2026-10-15T10:00:00.000Z", "INSERT"));

    expect(store.childrenById[jo.id]).toEqual(jo);
  });

  it("ignores another household's child", async () => {
    setUpClient(serverWith([], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);

    store.applyChildEvent(
      childEvent(
        child({ household_id: "house-2" }),
        "2026-10-15T10:00:00.000Z",
      ),
    );

    expect(store.childrenById).toEqual({});
  });

  it("does not undo a local soft delete", async () => {
    const mila = child();
    setUpClient(serverWith([mila], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    await store.removeChild(mila.id);

    store.applyChildEvent(childEvent(mila, "2026-10-15T10:00:00.000Z"));

    expect(store.childrenById[mila.id]!.deleted_at).not.toBeNull();
    expect(store.children).toEqual([]);
  });

  it("takes a removal another member made", async () => {
    const mila = child();
    setUpClient(serverWith([mila], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);

    store.applyChildEvent(
      childEvent({ ...mila, deleted_at: DELETED }, "2026-10-15T10:00:00.000Z"),
    );

    expect(store.children).toEqual([]);
  });

  it("drops an event committed before the newest one seen for the child", async () => {
    const mila = child();
    setUpClient(serverWith([mila], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);

    store.applyChildEvent(
      childEvent({ ...mila, name: "Newer" }, "2026-10-15T10:00:02.000Z"),
    );
    store.applyChildEvent(
      childEvent({ ...mila, name: "Older" }, "2026-10-15T10:00:01.000Z"),
    );

    expect(store.childrenById[mila.id]!.name).toBe("Newer");
  });
});

describe("useKidsStore applyReactionEvent", () => {
  it("ignores events before the first load", () => {
    setUpClient(serverWith([], []));
    const store = useKidsStore();

    store.applyReactionEvent(
      reactionEvent(reaction(), "2026-10-15T10:00:00.000Z"),
    );

    expect(store.reactionsById).toEqual({});
  });

  it("adds a reaction another member recorded", async () => {
    setUpClient(serverWith([], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    const refusal = reaction();

    store.applyReactionEvent(
      reactionEvent(refusal, "2026-10-15T10:00:00.000Z", "INSERT"),
    );

    expect(store.reactionsById[refusal.id]).toEqual(refusal);
  });

  it("ignores another household's reaction", async () => {
    setUpClient(serverWith([], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);

    store.applyReactionEvent(
      reactionEvent(
        reaction({ household_id: "house-2" }),
        "2026-10-15T10:00:00.000Z",
      ),
    );

    expect(store.reactionsById).toEqual({});
  });

  it("does not undo a local soft delete", async () => {
    const refusal = reaction({ child_id: "child-9" });
    setUpClient(serverWith([], [refusal]));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    await store.setReaction("entry-1", "child-9", "ate");

    store.applyReactionEvent(
      reactionEvent(refusal, "2026-10-15T10:00:00.000Z"),
    );

    expect(store.reactionsById[refusal.id]!.deleted_at).not.toBeNull();
  });

  it("drops an event committed before the newest one seen for the reaction", async () => {
    const refusal = reaction();
    setUpClient(serverWith([], [refusal]));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);

    store.applyReactionEvent(
      reactionEvent(
        { ...refusal, reaction: "picked_at" },
        "2026-10-15T10:00:02.000Z",
      ),
    );
    store.applyReactionEvent(
      reactionEvent(
        { ...refusal, reaction: "refused" },
        "2026-10-15T10:00:01.000Z",
      ),
    );

    expect(store.reactionsById[refusal.id]!.reaction).toBe("picked_at");
  });
});

describe("useKidsStore addChild", () => {
  it("throws before the first load", async () => {
    setUpClient(serverWith([], []));
    const store = useKidsStore();
    await expect(store.addChild("Mila")).rejects.toThrow("not_initialized");
  });

  it("shows the child at once, trimmed, and keeps the confirmed row", async () => {
    setUpClient(serverWith([], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    const insert = deferred<QueryResult>();
    const { requests } = setUpClient(() => insert.promise);

    const adding = store.addChild("  Mila  ");

    expect(store.children.map((c) => c.name)).toEqual(["Mila"]);
    expect(store.pendingIds).toEqual([store.children[0]!.id]);
    insert.resolve(
      ok({
        id: store.children[0]!.id,
        household_id: HOUSEHOLD,
        name: "Mila",
        created_by: "user-1",
        created_at: "2026-10-15T12:00:00Z",
        deleted_at: null,
      }),
    );
    expect(await adding).toBe(true);

    expect(store.children).toHaveLength(1);
    expect(store.children[0]!.created_at).toBe("2026-10-15T12:00:00Z");
    expect(store.pendingIds).toEqual([]);
    expect(inserts(requests)).toHaveLength(1);
    expect(inserts(requests)[0]!.payload).toMatchObject({
      id: store.children[0]!.id,
      household_id: HOUSEHOLD,
      name: "Mila",
    });
  });

  it("takes the child back and sets the error when the server refuses", async () => {
    setUpClient(serverWith([], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    setUpClient(() => fail("refused"));

    const saved = await store.addChild("Mila");

    expect(saved).toBe(false);
    expect(store.error).toBe("refused");
    expect(store.childrenById).toEqual({});
    expect(store.pendingIds).toEqual([]);
  });

  it("does not duplicate the child when the Realtime echo arrives first", async () => {
    setUpClient(serverWith([], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    const insert = deferred<QueryResult>();
    setUpClient(() => insert.promise);

    const adding = store.addChild("Mila");
    const optimistic = store.children[0]!;
    store.applyChildEvent(
      childEvent(optimistic, "2026-10-15T10:00:00.000Z", "INSERT"),
    );
    insert.resolve(ok(optimistic));
    await adding;

    expect(Object.keys(store.childrenById)).toEqual([optimistic.id]);
  });
});

describe("useKidsStore renameChild", () => {
  it("renames at once, trimmed, and sends the new name", async () => {
    const mila = child();
    setUpClient(serverWith([mila], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    const { requests } = setUpClient(serverWith([mila], []));

    const saved = await store.renameChild(mila.id, "  Milena ");

    expect(saved).toBe(true);
    expect(store.childrenById[mila.id]!.name).toBe("Milena");
    const [update] = updates(requests);
    expect(update!.table).toBe("household_children");
    expect(update!.payload).toEqual({ name: "Milena" });
    expect(update!.filters).toEqual({ id: mila.id });
  });

  it("puts the old name back and sets the error when the server refuses", async () => {
    const mila = child();
    setUpClient(serverWith([mila], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    setUpClient(() => fail("refused"));

    const saved = await store.renameChild(mila.id, "Milena");

    expect(saved).toBe(false);
    expect(store.childrenById[mila.id]!.name).toBe("Mila");
    expect(store.error).toBe("refused");
    expect(store.pendingIds).toEqual([]);
  });

  it("returns false and sends nothing for an unknown or removed child", async () => {
    const gone = child({ deleted_at: DELETED });
    setUpClient(serverWith([], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    store.childrenById = { [gone.id]: gone };
    const { requests } = setUpClient(serverWith([], []));

    expect(await store.renameChild("unknown", "X")).toBe(false);
    expect(await store.renameChild(gone.id, "X")).toBe(false);
    expect(requests).toEqual([]);
  });

  it("waits for the add to be saved before it sends the rename", async () => {
    setUpClient(serverWith([], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    const insert = deferred<QueryResult>();
    const { requests } = setUpClient((request) =>
      request.op === "insert" ? insert.promise : ok(),
    );
    const adding = store.addChild("Mila");
    const id = store.children[0]!.id;

    const renaming = store.renameChild(id, "Milena");
    await Promise.resolve();
    expect(updates(requests)).toEqual([]);
    insert.resolve(ok({ ...store.children[0]! }));
    await adding;
    await renaming;

    expect(updates(requests)).toHaveLength(1);
  });
});

describe("useKidsStore removeChild", () => {
  it("soft deletes at once and sends deleted_at, not a delete", async () => {
    const mila = child();
    setUpClient(serverWith([mila], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    const { requests } = setUpClient(serverWith([mila], []));

    const saved = await store.removeChild(mila.id);

    expect(saved).toBe(true);
    expect(store.children).toEqual([]);
    expect(store.childrenById[mila.id]!.deleted_at).not.toBeNull();
    const [update] = updates(requests);
    expect(update!.table).toBe("household_children");
    expect(update!.payload).toHaveProperty("deleted_at");
    expect(update!.filters).toEqual({ id: mila.id });
  });

  it("keeps the child removed and sets the error when the server refuses", async () => {
    const mila = child();
    setUpClient(serverWith([mila], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    setUpClient(() => fail("refused"));

    const saved = await store.removeChild(mila.id);

    expect(saved).toBe(false);
    expect(store.children).toEqual([]);
    expect(store.error).toBe("refused");
    expect(store.pendingIds).toEqual([]);
  });

  it("returns false and sends nothing for an unknown or already removed child", async () => {
    const gone = child({ deleted_at: DELETED });
    setUpClient(serverWith([], []));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    store.childrenById = { [gone.id]: gone };
    const { requests } = setUpClient(serverWith([], []));

    expect(await store.removeChild("unknown")).toBe(false);
    expect(await store.removeChild(gone.id)).toBe(false);

    expect(requests).toEqual([]);
  });
});

describe("useKidsStore setReaction", () => {
  const ENTRY = "entry-1";

  /** A loaded store, optionally holding a reaction of CHILD to ENTRY. */
  async function loadedStore(held: MealReaction[] = []) {
    setUpClient(serverWith([], held));
    const store = useKidsStore();
    await store.load(HOUSEHOLD);
    return store;
  }

  it("throws before the first load", async () => {
    setUpClient(serverWith([], []));
    const store = useKidsStore();
    await expect(store.setReaction(ENTRY, "c", "refused")).rejects.toThrow(
      "not_initialized",
    );
  });

  it("inserts a new row when there was none", async () => {
    const store = await loadedStore();
    const { requests } = setUpClient(serverWith([], []));

    const saved = await store.setReaction(ENTRY, "child-x", "refused");

    expect(saved).toBe(true);
    const [insert] = inserts(requests);
    expect(insert!.table).toBe("meal_reactions");
    expect(insert!.payload).toMatchObject({
      household_id: HOUSEHOLD,
      entry_id: ENTRY,
      child_id: "child-x",
      reaction: "refused",
      created_by: "user-1",
    });
    const live = liveReactionOf(store.reactionsById, ENTRY, "child-x");
    expect(live?.reaction).toBe("refused");
    expect(live?.id).toBe(insert!.payload!.id);
    expect(updates(requests)).toEqual([]);
  });

  it("shows the new reaction before the server has answered", async () => {
    const store = await loadedStore();
    const insert = deferred<QueryResult>();
    setUpClient(() => insert.promise);

    const saving = store.setReaction(ENTRY, "child-x", "picked_at");

    const live = liveReactionOf(store.reactionsById, ENTRY, "child-x");
    expect(live?.reaction).toBe("picked_at");
    expect(store.pendingIds).toEqual([live!.id]);
    insert.resolve(ok({ ...live! }));
    expect(await saving).toBe(true);
    expect(store.pendingIds).toEqual([]);
  });

  it("takes the insert back and sets the error when the server refuses it", async () => {
    const store = await loadedStore();
    setUpClient(() => fail("refused"));

    const saved = await store.setReaction(ENTRY, "child-x", "refused");

    expect(saved).toBe(false);
    expect(store.error).toBe("refused");
    expect(store.reactionsById).toEqual({});
  });

  it("changes the live row from refused to picked at without a new row", async () => {
    const refusal = reaction({ child_id: "child-x" });
    const store = await loadedStore([refusal]);
    const { requests } = setUpClient(serverWith([], [refusal]));

    const saved = await store.setReaction(ENTRY, "child-x", "picked_at");

    expect(saved).toBe(true);
    expect(inserts(requests)).toEqual([]);
    const [update] = updates(requests);
    expect(update!.table).toBe("meal_reactions");
    expect(update!.payload).toEqual({ reaction: "picked_at" });
    expect(update!.filters).toEqual({ id: refusal.id });
    expect(Object.keys(store.reactionsById)).toEqual([refusal.id]);
    expect(store.reactionsById[refusal.id]!.reaction).toBe("picked_at");
  });

  it("puts the old reaction back and sets the error when the update is refused", async () => {
    const refusal = reaction({ child_id: "child-x" });
    const store = await loadedStore([refusal]);
    setUpClient(() => fail("refused"));

    const saved = await store.setReaction(ENTRY, "child-x", "picked_at");

    expect(saved).toBe(false);
    expect(store.error).toBe("refused");
    expect(store.reactionsById[refusal.id]!.reaction).toBe("refused");
    expect(store.pendingIds).toEqual([]);
  });

  it("soft deletes the live row when the choice goes back to ate", async () => {
    const picked = reaction({ child_id: "child-x", reaction: "picked_at" });
    const store = await loadedStore([picked]);
    const { requests } = setUpClient(serverWith([], [picked]));

    const saved = await store.setReaction(ENTRY, "child-x", "ate");

    expect(saved).toBe(true);
    expect(inserts(requests)).toEqual([]);
    const [update] = updates(requests);
    expect(update!.payload).toHaveProperty("deleted_at");
    expect(update!.payload).not.toHaveProperty("reaction");
    expect(update!.filters).toEqual({ id: picked.id });
    expect(store.reactionsById[picked.id]!.deleted_at).not.toBeNull();
    expect(liveReactionOf(store.reactionsById, ENTRY, "child-x")).toBeNull();
  });

  it("keeps the reaction taken back and sets the error when the server refuses", async () => {
    const picked = reaction({ child_id: "child-x", reaction: "picked_at" });
    const store = await loadedStore([picked]);
    setUpClient(() => fail("refused"));

    const saved = await store.setReaction(ENTRY, "child-x", "ate");

    expect(saved).toBe(false);
    expect(store.error).toBe("refused");
    expect(store.reactionsById[picked.id]!.deleted_at).not.toBeNull();
  });

  it("inserts a new row, never reviving the tombstone, after a reaction was taken back", async () => {
    const refusal = reaction({ child_id: "child-x" });
    const store = await loadedStore([refusal]);
    const { requests } = setUpClient(serverWith([], [refusal]));
    await store.setReaction(ENTRY, "child-x", "ate");
    requests.length = 0;

    const saved = await store.setReaction(ENTRY, "child-x", "refused");

    expect(saved).toBe(true);
    const [insert] = inserts(requests);
    expect(insert!.payload!.id).not.toBe(refusal.id);
    expect(updates(requests)).toEqual([]);
    expect(store.reactionsById[refusal.id]!.deleted_at).not.toBeNull();
    const live = liveReactionOf(store.reactionsById, ENTRY, "child-x");
    expect(live?.id).toBe(insert!.payload!.id);
    expect(Object.keys(store.reactionsById)).toHaveLength(2);
  });

  it("sends nothing and returns true for the choice it already has", async () => {
    const refusal = reaction({ child_id: "child-x" });
    const store = await loadedStore([refusal]);
    const { requests } = setUpClient(serverWith([], [refusal]));

    expect(await store.setReaction(ENTRY, "child-x", "refused")).toBe(true);
    expect(await store.setReaction(ENTRY, "child-y", "ate")).toBe(true);
    expect(requests).toEqual([]);
    expect(Object.keys(store.reactionsById)).toEqual([refusal.id]);
  });

  it("keeps the reactions of one child apart from another's", async () => {
    const refusal = reaction({ child_id: "child-x" });
    const store = await loadedStore([refusal]);
    setUpClient(serverWith([], [refusal]));

    await store.setReaction(ENTRY, "child-y", "picked_at");

    expect(store.reactionsById[refusal.id]!.reaction).toBe("refused");
    expect(
      liveReactionOf(store.reactionsById, ENTRY, "child-y")?.reaction,
    ).toBe("picked_at");
  });
});
