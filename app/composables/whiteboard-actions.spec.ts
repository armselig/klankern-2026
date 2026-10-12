import { describe, expect, it, vi } from "vitest";
import {
  fetchBoardStrokes,
  fetchOrCreateBoard,
  insertBoardStroke,
  softDeleteAllBoardStrokes,
  softDeleteBoardStrokeRemote,
  STROKE_PAGE_SIZE,
} from "./whiteboard-actions";
import {
  fakeClient,
  fakeClientWithQueries,
  fakeQueryBuilder,
} from "../../tests/support/fake-supabase-client";

describe("fetchOrCreateBoard", () => {
  const board = {
    id: "board-1",
    household_id: "h1",
    name: "Whiteboard",
    created_at: "now",
  };

  it("returns the existing board without creating one", async () => {
    const query = fakeQueryBuilder({ data: board, error: null });
    const client = fakeClient({ from: () => query.builder });

    expect(await fetchOrCreateBoard(client as never, "h1")).toEqual(board);
    expect(query.calls.eq).toEqual(["household_id", "h1"]);
    expect(query.calls.upsert).toBeUndefined();
  });

  it("creates a board when none exists yet, and reads it back", async () => {
    const lookup = fakeQueryBuilder({ data: null, error: null });
    const create = fakeQueryBuilder({ data: null, error: null });
    const readBack = fakeQueryBuilder({ data: board, error: null });
    const { client, from } = fakeClientWithQueries([lookup, create, readBack]);

    expect(await fetchOrCreateBoard(client as never, "h1")).toEqual(board);
    expect(from).toHaveBeenCalledWith("boards");
    // Ignoring the conflict is what makes two simultaneous first visits safe.
    expect(create.calls.upsert).toEqual([
      { household_id: "h1" },
      { onConflict: "household_id", ignoreDuplicates: true },
    ]);
    // No RETURNING on the insert: an ignored insert returns no row.
    expect(create.calls.select).toBeUndefined();
    expect(readBack.calls.eq).toEqual(["household_id", "h1"]);
  });

  it("throws when creating the board fails", async () => {
    const error = { message: "boom" };
    const { client } = fakeClientWithQueries([
      fakeQueryBuilder({ data: null, error: null }),
      fakeQueryBuilder({ data: null, error }),
    ]);

    await expect(fetchOrCreateBoard(client as never, "h1")).rejects.toBe(error);
  });
});

describe("fetchBoardStrokes", () => {
  it("returns the non-deleted strokes of the board", async () => {
    const strokes = [{ id: "a" }, { id: "b" }];
    const query = fakeQueryBuilder({ data: strokes, error: null });
    const { client, from } = fakeClientWithQueries([query]);

    expect(await fetchBoardStrokes(client as never, "board-1")).toEqual(
      strokes,
    );
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("board_strokes");
    expect(query.calls.eq).toEqual(["board_id", "board-1"]);
    expect(query.calls.is).toEqual(["deleted_at", null]);
    expect(query.calls.order).toEqual(["id"]);
    expect(query.calls.limit).toEqual([STROKE_PAGE_SIZE]);
    expect(query.calls.gt).toBeUndefined();
  });

  it("keeps fetching after a full page, continuing after its last id", async () => {
    const fullPage = Array.from({ length: STROKE_PAGE_SIZE }, (_, index) => ({
      id: `id-${index}`,
    }));
    const first = fakeQueryBuilder({ data: fullPage, error: null });
    const second = fakeQueryBuilder({ data: [{ id: "last" }], error: null });
    const { client, from } = fakeClientWithQueries([first, second]);

    const strokes = await fetchBoardStrokes(client as never, "board-1");

    expect(strokes).toHaveLength(STROKE_PAGE_SIZE + 1);
    expect(strokes.at(-1)).toEqual({ id: "last" });
    expect(from).toHaveBeenCalledTimes(2);
    expect(second.calls.gt).toEqual(["id", `id-${STROKE_PAGE_SIZE - 1}`]);
  });

  it("asks once more after a board of exactly one page, and accepts an empty answer", async () => {
    const fullPage = Array.from({ length: STROKE_PAGE_SIZE }, (_, index) => ({
      id: `id-${index}`,
    }));
    const { client, from } = fakeClientWithQueries([
      fakeQueryBuilder({ data: fullPage, error: null }),
      fakeQueryBuilder({ data: [], error: null }),
    ]);

    expect(await fetchBoardStrokes(client as never, "board-1")).toHaveLength(
      STROKE_PAGE_SIZE,
    );
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const { client } = fakeClientWithQueries([
      fakeQueryBuilder({ data: null, error }),
    ]);

    await expect(fetchBoardStrokes(client as never, "board-1")).rejects.toBe(
      error,
    );
  });
});

describe("insertBoardStroke", () => {
  it("inserts with the client-supplied id and the resolved created_by", async () => {
    const row = { id: "stroke-1" };
    const query = fakeQueryBuilder({ data: row, error: null });
    const client = fakeClient({ userId: "user-1", from: () => query.builder });

    const result = await insertBoardStroke(client as never, {
      id: "stroke-1",
      boardId: "board-1",
      householdId: "h1",
      color: "#c62828",
      width: 16,
      points: [0, 0, 10, 10],
    });

    expect(result).toEqual(row);
    expect(query.calls.insert).toEqual([
      {
        id: "stroke-1",
        board_id: "board-1",
        household_id: "h1",
        color: "#c62828",
        width: 16,
        points: [0, 0, 10, 10],
        created_by: "user-1",
      },
    ]);
  });
});

describe("softDeleteBoardStrokeRemote", () => {
  it("sets deleted_at for the given id", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });

    await softDeleteBoardStrokeRemote(client as never, "stroke-1");

    expect(query.calls.eq).toEqual(["id", "stroke-1"]);
    expect(
      typeof (query.calls.update![0] as { deleted_at: string }).deleted_at,
    ).toBe("string");
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      softDeleteBoardStrokeRemote(client as never, "stroke-1"),
    ).rejects.toBe(error);
  });
});

describe("softDeleteAllBoardStrokes", () => {
  it("sets deleted_at on every stroke of the board that is not deleted yet", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const from = vi.fn(() => query.builder);
    const client = fakeClient({ from });

    await softDeleteAllBoardStrokes(client as never, "board-1");

    expect(from).toHaveBeenCalledWith("board_strokes");
    expect(query.calls.eq).toEqual(["board_id", "board-1"]);
    expect(query.calls.is).toEqual(["deleted_at", null]);
    expect(
      typeof (query.calls.update![0] as { deleted_at: string }).deleted_at,
    ).toBe("string");
  });
});
