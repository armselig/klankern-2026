import { describe, expect, it } from "vitest";
import type { BoardStroke, BoardStrokeRealtimeEvent } from "~/types/whiteboard";
import {
  applyStrokeRealtimeEvent,
  lastUndoableStrokeId,
  softDeleteAllStrokes,
  visibleStrokes,
} from "./whiteboard-state";

function stroke(overrides: Partial<BoardStroke> = {}): BoardStroke {
  return {
    id: "stroke-1",
    board_id: "board-1",
    household_id: "house-1",
    color: "#212121",
    width: 32,
    points: [0, 0, 100, 100],
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function event(
  row: BoardStrokeRealtimeEvent["new"],
  eventType: BoardStrokeRealtimeEvent["eventType"] = "INSERT",
): BoardStrokeRealtimeEvent {
  return { eventType, new: row, commitTimestamp: "2026-01-01T00:00:00.000Z" };
}

const deletedAt = "2026-01-01T00:01:00.000Z";

describe("applyStrokeRealtimeEvent", () => {
  it("adds another member's stroke", () => {
    const incoming = stroke({ id: "stroke-2" });
    expect(applyStrokeRealtimeEvent({}, event(incoming), "board-1")).toEqual({
      "stroke-2": incoming,
    });
  });

  it("does not duplicate the echo of our own stroke", () => {
    const own = stroke();
    const state = applyStrokeRealtimeEvent(
      { [own.id]: own },
      event(own),
      "board-1",
    );
    expect(Object.keys(state)).toEqual([own.id]);
  });

  it("ignores strokes of another board and everything before the board is loaded", () => {
    const state = { "stroke-1": stroke() };
    const other = stroke({ id: "stroke-2", board_id: "board-2" });
    expect(applyStrokeRealtimeEvent(state, event(other), "board-1")).toBe(
      state,
    );
    expect(
      applyStrokeRealtimeEvent(state, event(stroke({ id: "stroke-2" })), null),
    ).toBe(state);
  });

  it("applies a remote erase", () => {
    const state = { "stroke-1": stroke() };
    const result = applyStrokeRealtimeEvent(
      state,
      event(stroke({ deleted_at: deletedAt }), "UPDATE"),
      "board-1",
    );
    expect(result["stroke-1"]!.deleted_at).toBe(deletedAt);
  });

  it("keeps the local points when an update arrives without them", () => {
    const local = stroke();
    const { points: _omitted, ...withoutPoints } = stroke({
      deleted_at: deletedAt,
    });
    const result = applyStrokeRealtimeEvent(
      { [local.id]: local },
      event(withoutPoints, "UPDATE"),
      "board-1",
    );
    expect(result[local.id]).toEqual({ ...local, deleted_at: deletedAt });
  });

  it("keeps an erased stroke it never saw as a tombstone without points", () => {
    const { points: _omitted, ...withoutPoints } = stroke({
      deleted_at: deletedAt,
    });
    const result = applyStrokeRealtimeEvent(
      {},
      event(withoutPoints, "UPDATE"),
      "board-1",
    );
    expect(result["stroke-1"]).toEqual({ ...withoutPoints, points: [] });
    expect(visibleStrokes(result)).toEqual([]);
  });

  it("never brings back a stroke that was removed locally", () => {
    const state = { "stroke-1": stroke({ deleted_at: deletedAt }) };
    expect(applyStrokeRealtimeEvent(state, event(stroke()), "board-1")).toBe(
      state,
    );
  });
});

describe("visibleStrokes", () => {
  it("leaves out removed strokes", () => {
    const state = {
      a: stroke({ id: "a" }),
      b: stroke({ id: "b", deleted_at: deletedAt }),
    };
    expect(visibleStrokes(state).map((s) => s.id)).toEqual(["a"]);
  });

  it("orders by creation time across the timestamp formats in use", () => {
    const state = {
      // As written by the client for an optimistic stroke ...
      newest: stroke({ id: "newest", created_at: "2026-01-01T00:00:02.000Z" }),
      // ... and as returned by the database.
      oldest: stroke({
        id: "oldest",
        created_at: "2026-01-01T00:00:00.5+00:00",
      }),
      middle: stroke({
        id: "middle",
        created_at: "2026-01-01T00:00:01.123456+00:00",
      }),
    };
    expect(visibleStrokes(state).map((s) => s.id)).toEqual([
      "oldest",
      "middle",
      "newest",
    ]);
  });

  it("breaks a tie by id, so every member gets the same order", () => {
    const state = { b: stroke({ id: "b" }), a: stroke({ id: "a" }) };
    expect(visibleStrokes(state).map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("lastUndoableStrokeId", () => {
  it("is the newest stroke the member drew", () => {
    const state = { a: stroke({ id: "a" }), b: stroke({ id: "b" }) };
    expect(lastUndoableStrokeId(state, ["a", "b"])).toBe("b");
  });

  it("skips strokes that are already removed or no longer in state", () => {
    const state = {
      a: stroke({ id: "a" }),
      b: stroke({ id: "b", deleted_at: deletedAt }),
    };
    expect(lastUndoableStrokeId(state, ["a", "b", "gone"])).toBe("a");
  });

  it("is null when the member has nothing left on the board", () => {
    expect(lastUndoableStrokeId({ a: stroke({ id: "a" }) }, [])).toBeNull();
    expect(
      lastUndoableStrokeId({ a: stroke({ id: "a", deleted_at: deletedAt }) }, [
        "a",
      ]),
    ).toBeNull();
  });
});

describe("softDeleteAllStrokes", () => {
  it("turns every stroke into a tombstone", () => {
    const result = softDeleteAllStrokes({
      a: stroke({ id: "a" }),
      b: stroke({ id: "b" }),
    });
    expect(Object.keys(result)).toEqual(["a", "b"]);
    expect(visibleStrokes(result)).toEqual([]);
  });

  it("keeps the time of an earlier removal", () => {
    const result = softDeleteAllStrokes({
      a: stroke({ id: "a", deleted_at: deletedAt }),
    });
    expect(result.a!.deleted_at).toBe(deletedAt);
  });
});
