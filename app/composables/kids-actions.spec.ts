import { describe, expect, it, vi } from "vitest";
import {
  fetchHouseholdChildren,
  fetchMealReactions,
  insertHouseholdChild,
  insertMealReaction,
  KIDS_PAGE_SIZE,
  renameHouseholdChildRemote,
  softDeleteHouseholdChildRemote,
  softDeleteMealReactionRemote,
  updateMealReactionRemote,
} from "./kids-actions";
import {
  fakeClient,
  fakeClientWithQueries,
  fakeQueryBuilder,
} from "../../tests/support/fake-supabase-client";

describe.each([
  ["fetchHouseholdChildren", fetchHouseholdChildren, "household_children"],
  ["fetchMealReactions", fetchMealReactions, "meal_reactions"],
] as const)("%s", (_name, fetchRows, table) => {
  it("returns the household's rows that are not removed", async () => {
    const rows = [{ id: "a" }, { id: "b" }];
    const query = fakeQueryBuilder({ data: rows, error: null });
    const { client, from } = fakeClientWithQueries([query]);

    expect(await fetchRows(client as never, "h1")).toEqual(rows);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith(table);
    expect(query.calls.eq).toEqual(["household_id", "h1"]);
    expect(query.calls.is).toEqual(["deleted_at", null]);
    expect(query.calls.order).toEqual(["id"]);
    expect(query.calls.limit).toEqual([KIDS_PAGE_SIZE]);
    expect(query.calls.gt).toBeUndefined();
  });

  it("keeps fetching after a full page, continuing after its last id", async () => {
    const fullPage = Array.from({ length: KIDS_PAGE_SIZE }, (_, index) => ({
      id: `id-${index}`,
    }));
    const first = fakeQueryBuilder({ data: fullPage, error: null });
    const second = fakeQueryBuilder({ data: [{ id: "last" }], error: null });
    const { client, from } = fakeClientWithQueries([first, second]);

    const rows = await fetchRows(client as never, "h1");

    expect(rows).toHaveLength(KIDS_PAGE_SIZE + 1);
    expect(rows.at(-1)).toEqual({ id: "last" });
    expect(from).toHaveBeenCalledTimes(2);
    expect(first.calls.gt).toBeUndefined();
    expect(second.calls.gt).toEqual(["id", `id-${KIDS_PAGE_SIZE - 1}`]);
  });

  it("returns nothing for a household without rows", async () => {
    const { client } = fakeClientWithQueries([
      fakeQueryBuilder({ data: [], error: null }),
    ]);

    expect(await fetchRows(client as never, "h1")).toEqual([]);
  });

  it("returns nothing when the answer has no data", async () => {
    const { client } = fakeClientWithQueries([
      fakeQueryBuilder({ data: null, error: null }),
    ]);

    expect(await fetchRows(client as never, "h1")).toEqual([]);
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const { client } = fakeClientWithQueries([
      fakeQueryBuilder({ data: null, error }),
    ]);

    await expect(fetchRows(client as never, "h1")).rejects.toBe(error);
  });

  it("throws the error of a later page and returns no part of the rows", async () => {
    const error = { message: "boom" };
    const fullPage = Array.from({ length: KIDS_PAGE_SIZE }, (_, index) => ({
      id: `id-${index}`,
    }));
    const { client } = fakeClientWithQueries([
      fakeQueryBuilder({ data: fullPage, error: null }),
      fakeQueryBuilder({ data: null, error }),
    ]);

    await expect(fetchRows(client as never, "h1")).rejects.toBe(error);
  });
});

describe("insertHouseholdChild", () => {
  const child = { id: "child-1", householdId: "h1", name: "Mila" };

  it("inserts with the client-supplied id and the resolved created_by", async () => {
    const row = { id: "child-1", name: "Mila" };
    const query = fakeQueryBuilder({ data: row, error: null });
    const client = fakeClient({ userId: "user-1", from: () => query.builder });

    expect(await insertHouseholdChild(client as never, child)).toEqual(row);
    expect(client.from).toHaveBeenCalledWith("household_children");
    expect(query.calls.insert).toEqual([
      {
        id: "child-1",
        household_id: "h1",
        name: "Mila",
        created_by: "user-1",
      },
    ]);
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(insertHouseholdChild(client as never, child)).rejects.toBe(
      error,
    );
  });

  it("writes nothing when nobody is signed in", async () => {
    const client = fakeClient({});
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(insertHouseholdChild(client as never, child)).rejects.toThrow(
      "not_authenticated",
    );
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("renameHouseholdChildRemote", () => {
  it("sends the name to the child with that id", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });

    await renameHouseholdChildRemote(client as never, "child-1", "Milena");

    expect(client.from).toHaveBeenCalledWith("household_children");
    expect(query.calls.update).toEqual([{ name: "Milena" }]);
    expect(query.calls.eq).toEqual(["id", "child-1"]);
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      renameHouseholdChildRemote(client as never, "child-1", "Milena"),
    ).rejects.toBe(error);
  });
});

describe("softDeleteHouseholdChildRemote", () => {
  it("sets deleted_at on the child and never deletes the row", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-15T12:00:00Z") });
    try {
      const query = fakeQueryBuilder({ data: null, error: null });
      const client = fakeClient({ from: () => query.builder });

      await softDeleteHouseholdChildRemote(client as never, "child-1");

      expect(client.from).toHaveBeenCalledWith("household_children");
      expect(query.calls.update).toEqual([
        { deleted_at: "2026-10-15T12:00:00.000Z" },
      ]);
      expect(query.calls.eq).toEqual(["id", "child-1"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      softDeleteHouseholdChildRemote(client as never, "child-1"),
    ).rejects.toBe(error);
  });
});

describe("insertMealReaction", () => {
  const reaction = {
    id: "reaction-1",
    householdId: "h1",
    entryId: "entry-1",
    childId: "child-1",
    reaction: "refused",
  } as const;

  it("inserts with the client-supplied id and the resolved created_by", async () => {
    const row = { id: "reaction-1", reaction: "refused" };
    const query = fakeQueryBuilder({ data: row, error: null });
    const client = fakeClient({ userId: "user-1", from: () => query.builder });

    expect(await insertMealReaction(client as never, reaction)).toEqual(row);
    expect(client.from).toHaveBeenCalledWith("meal_reactions");
    expect(query.calls.insert).toEqual([
      {
        id: "reaction-1",
        household_id: "h1",
        entry_id: "entry-1",
        child_id: "child-1",
        reaction: "refused",
        created_by: "user-1",
      },
    ]);
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(insertMealReaction(client as never, reaction)).rejects.toBe(
      error,
    );
  });
});

describe("updateMealReactionRemote", () => {
  it("sends the reaction to the row with that id", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });

    await updateMealReactionRemote(client as never, "reaction-1", "picked_at");

    expect(client.from).toHaveBeenCalledWith("meal_reactions");
    expect(query.calls.update).toEqual([{ reaction: "picked_at" }]);
    expect(query.calls.eq).toEqual(["id", "reaction-1"]);
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      updateMealReactionRemote(client as never, "reaction-1", "picked_at"),
    ).rejects.toBe(error);
  });
});

describe("softDeleteMealReactionRemote", () => {
  it("sets deleted_at on the reaction and never deletes the row", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-15T12:00:00Z") });
    try {
      const query = fakeQueryBuilder({ data: null, error: null });
      const client = fakeClient({ from: () => query.builder });

      await softDeleteMealReactionRemote(client as never, "reaction-1");

      expect(client.from).toHaveBeenCalledWith("meal_reactions");
      expect(query.calls.update).toEqual([
        { deleted_at: "2026-10-15T12:00:00.000Z" },
      ]);
      expect(query.calls.eq).toEqual(["id", "reaction-1"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      softDeleteMealReactionRemote(client as never, "reaction-1"),
    ).rejects.toBe(error);
  });
});
