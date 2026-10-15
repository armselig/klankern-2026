import { describe, expect, it } from "vitest";
import type { MealPlanEntry } from "~/types/meal-plan";
import {
  fetchMealPlanEntries,
  insertMealPlanEntry,
  MEAL_PLAN_PAGE_SIZE,
  softDeleteMealPlanEntryRemote,
  updateMealPlanEntry,
} from "./meal-plan-actions";
import {
  fakeClient,
  fakeClientWithQueries,
  fakeQueryBuilder,
} from "../../tests/support/fake-supabase-client";

const RANGE = { from: "2026-10-01", to: "2026-10-31" };

function entry(id: string): MealPlanEntry {
  return {
    id,
    household_id: "h1",
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
  };
}

/** `count` entries with ascending ids, as the id-ordered query returns them. */
function page(from: number, count: number): MealPlanEntry[] {
  return Array.from({ length: count }, (_, i) =>
    entry(`id-${String(from + i).padStart(5, "0")}`),
  );
}

/**
 * A query for the fake client's queue. The shared builder has no `gte` and
 * `lte`, which the date range uses, so they are added here and recorded.
 */
function rangeQuery(data: unknown, error: unknown = null) {
  const query = fakeQueryBuilder({ data, error });
  const range: { gte?: unknown[]; lte?: unknown[] } = {};
  query.builder.gte = (...args: unknown[]) => {
    range.gte = args;
    return query.builder;
  };
  query.builder.lte = (...args: unknown[]) => {
    range.lte = args;
    return query.builder;
  };
  return { ...query, range };
}

describe("fetchMealPlanEntries", () => {
  it("asks for the household's live entries on the days of the range", async () => {
    const query = rangeQuery([entry("a")]);
    const { client, from } = fakeClientWithQueries([query]);

    expect(await fetchMealPlanEntries(client as never, "h1", RANGE)).toEqual([
      entry("a"),
    ]);
    expect(from).toHaveBeenCalledWith("meal_plan_entries");
    expect(query.calls.eq).toEqual(["household_id", "h1"]);
    expect(query.range.gte).toEqual(["date", RANGE.from]);
    expect(query.range.lte).toEqual(["date", RANGE.to]);
    expect(query.calls.is).toEqual(["deleted_at", null]);
    expect(query.calls.order).toEqual(["id"]);
    expect(query.calls.limit).toEqual([MEAL_PLAN_PAGE_SIZE]);
    expect(query.calls.gt).toBeUndefined();
  });

  it("returns an empty list for a range without entries, in one request", async () => {
    const { client, from } = fakeClientWithQueries([rangeQuery([])]);
    expect(await fetchMealPlanEntries(client as never, "h1", RANGE)).toEqual(
      [],
    );
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("pages by id past 1000 rows and returns every row once", async () => {
    const pages = [
      rangeQuery(page(0, MEAL_PLAN_PAGE_SIZE)),
      rangeQuery(page(500, MEAL_PLAN_PAGE_SIZE)),
      rangeQuery(page(1000, 20)),
    ];
    const { client, from } = fakeClientWithQueries(pages);

    const entries = await fetchMealPlanEntries(client as never, "h1", RANGE);

    expect(entries).toHaveLength(1020);
    expect(new Set(entries.map((e) => e.id)).size).toBe(1020);
    expect(from).toHaveBeenCalledTimes(3);
    expect(pages[0]!.calls.gt).toBeUndefined();
    expect(pages[1]!.calls.gt).toEqual(["id", "id-00499"]);
    expect(pages[2]!.calls.gt).toEqual(["id", "id-00999"]);
    // Every page keeps the filters of the first.
    for (const query of pages) {
      expect(query.range.gte).toEqual(["date", RANGE.from]);
      expect(query.range.lte).toEqual(["date", RANGE.to]);
    }
  });

  it("asks once more after a last page that is exactly full", async () => {
    const { client, from } = fakeClientWithQueries([
      rangeQuery(page(0, MEAL_PLAN_PAGE_SIZE)),
      rangeQuery([]),
    ]);
    const entries = await fetchMealPlanEntries(client as never, "h1", RANGE);
    expect(entries).toHaveLength(MEAL_PLAN_PAGE_SIZE);
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("throws when a later page fails, rather than returning a part", async () => {
    const failure = { message: "boom" };
    const { client } = fakeClientWithQueries([
      rangeQuery(page(0, MEAL_PLAN_PAGE_SIZE)),
      rangeQuery(null, failure),
    ]);
    await expect(
      fetchMealPlanEntries(client as never, "h1", RANGE),
    ).rejects.toBe(failure);
  });
});

describe("insertMealPlanEntry", () => {
  const added = {
    id: "new-id",
    householdId: "h1",
    date: "2026-10-15",
    slot: "dinner" as const,
    position: 2,
    recipeId: null,
    title: "Soup",
  };

  it("inserts with the client's id and the signed-in user, and returns the row", async () => {
    const query = fakeQueryBuilder({ data: entry("new-id"), error: null });
    const client = fakeClient({ userId: "user-7", from: () => query.builder });

    expect(await insertMealPlanEntry(client as never, added)).toEqual(
      entry("new-id"),
    );
    expect(query.calls.insert).toEqual([
      {
        id: "new-id",
        household_id: "h1",
        date: "2026-10-15",
        slot: "dinner",
        position: 2,
        recipe_id: null,
        title: "Soup",
        created_by: "user-7",
      },
    ]);
  });

  it("throws the error the server gives", async () => {
    const failure = { message: "new row violates row-level security policy" };
    const query = fakeQueryBuilder({ data: null, error: failure });
    const client = fakeClient({ from: () => query.builder });
    await expect(insertMealPlanEntry(client as never, added)).rejects.toBe(
      failure,
    );
  });
});

describe("updateMealPlanEntry", () => {
  it("sends only the columns given, for the entry", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });
    await updateMealPlanEntry(client as never, "e1", {
      date: "2026-10-16",
      slot: "lunch",
      position: 2,
    });
    expect(query.calls.update).toEqual([
      { date: "2026-10-16", slot: "lunch", position: 2 },
    ]);
    expect(query.calls.eq).toEqual(["id", "e1"]);
  });

  it("clears a column with null", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });
    await updateMealPlanEntry(client as never, "e1", { skipped_at: null });
    expect(query.calls.update).toEqual([{ skipped_at: null }]);
  });

  it("throws the error the server gives", async () => {
    const failure = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error: failure });
    const client = fakeClient({ from: () => query.builder });
    await expect(
      updateMealPlanEntry(client as never, "e1", { skipped_at: null }),
    ).rejects.toBe(failure);
  });
});

describe("softDeleteMealPlanEntryRemote", () => {
  it("sets deleted_at on the entry instead of deleting the row", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });
    await softDeleteMealPlanEntryRemote(client as never, "e1");
    const [change] = query.calls.update as [{ deleted_at: string }];
    expect(Date.parse(change.deleted_at)).not.toBeNaN();
    expect(query.calls.eq).toEqual(["id", "e1"]);
  });

  it("throws the error the server gives", async () => {
    const failure = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error: failure });
    const client = fakeClient({ from: () => query.builder });
    await expect(
      softDeleteMealPlanEntryRemote(client as never, "e1"),
    ).rejects.toBe(failure);
  });
});
