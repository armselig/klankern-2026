import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";
import type { Recipe } from "~/types/recipe";
import type { ShoppingItem } from "~/types/shopping";
import type { TodoItem } from "~/types/todo";
import type { BoardStroke } from "~/types/whiteboard";
import { subscribeToHouseholdChanges } from "./household-realtime";

type ChangeCallback = (payload: {
  eventType: string;
  new: unknown;
  commit_timestamp: string;
}) => void;
type StatusCallback = (status: string) => void;

function fakeRealtimeClient() {
  const registrations: {
    type: string;
    filter: Record<string, string>;
    callback: ChangeCallback;
  }[] = [];
  let statusCallback: StatusCallback = () => {};
  const channel = {
    on: (
      type: string,
      filter: Record<string, string>,
      callback: ChangeCallback,
    ) => {
      registrations.push({ type, filter, callback });
      return channel;
    },
    subscribe: (callback: StatusCallback) => {
      statusCallback = callback;
      return channel;
    },
  };
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };
  return {
    client: client as unknown as SupabaseClient<Database>,
    channel,
    registrations,
    removeChannel: client.removeChannel,
    channelFactory: client.channel,
    emitStatus: (status: string) => statusCallback(status),
  };
}

const committedAt = "2026-01-01T00:00:00.000Z";
const committedLater = "2026-01-01T00:00:01.000Z";

const row: TodoItem = {
  id: "item-1",
  list_id: "list-1",
  household_id: "house-1",
  title: "Buy milk",
  done: false,
  position: 1,
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

const shoppingRow: ShoppingItem = {
  id: "item-2",
  list_id: "list-2",
  household_id: "house-1",
  title: "Apples",
  quantity: "6",
  checked: false,
  position: 1,
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

const strokeRow: BoardStroke = {
  id: "stroke-1",
  board_id: "board-1",
  household_id: "house-1",
  color: "#212121",
  width: 32,
  points: [0, 0, 100, 100],
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

const recipeRow: Recipe = {
  id: "recipe-1",
  household_id: "house-1",
  title: "Pancakes",
  servings: "4",
  ingredients: [{ id: "ingredient-1", name: "Flour", quantity: "250 g" }],
  instructions: "Mix.\nFry.",
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

function listeners() {
  return {
    onTodoItemChange: vi.fn(),
    onShoppingItemChange: vi.fn(),
    onBoardStrokeChange: vi.fn(),
    onRecipeChange: vi.fn(),
    onSubscribed: vi.fn(),
  };
}

describe("subscribeToHouseholdChanges", () => {
  it("opens one channel per household", () => {
    const fake = fakeRealtimeClient();
    subscribeToHouseholdChanges(fake.client, "house-1", listeners());
    expect(fake.channelFactory).toHaveBeenCalledWith("household:house-1");
  });

  it("listens to INSERT and UPDATE on every synced table, filtered to the household -- never DELETE", () => {
    const fake = fakeRealtimeClient();
    subscribeToHouseholdChanges(fake.client, "house-1", listeners());

    const expected = [
      "todo_items",
      "shopping_items",
      "board_strokes",
      "recipes",
    ].flatMap((table) =>
      ["INSERT", "UPDATE"].map((event) => [
        "postgres_changes",
        { event, schema: "public", table, filter: "household_id=eq.house-1" },
      ]),
    );
    expect(fake.registrations.map((r) => [r.type, r.filter])).toEqual(expected);
  });

  /** Finds the callback registered for a table/event pair, independent of registration order. */
  function callbackFor(
    fake: ReturnType<typeof fakeRealtimeClient>,
    table: string,
    event: string,
  ) {
    const registration = fake.registrations.find(
      (r) => r.filter.table === table && r.filter.event === event,
    );
    if (!registration) throw new Error(`no listener for ${event} on ${table}`);
    return registration.callback;
  }

  it("passes to-do changes on as ListRealtimeEvents", () => {
    const fake = fakeRealtimeClient();
    const l = listeners();
    subscribeToHouseholdChanges(fake.client, "house-1", l);

    callbackFor(
      fake,
      "todo_items",
      "INSERT",
    )({ eventType: "INSERT", new: row, commit_timestamp: committedAt });
    callbackFor(
      fake,
      "todo_items",
      "UPDATE",
    )({
      eventType: "UPDATE",
      new: { ...row, done: true },
      commit_timestamp: committedLater,
    });

    expect(l.onTodoItemChange).toHaveBeenNthCalledWith(1, {
      eventType: "INSERT",
      new: row,
      commitTimestamp: committedAt,
    });
    expect(l.onTodoItemChange).toHaveBeenNthCalledWith(2, {
      eventType: "UPDATE",
      new: { ...row, done: true },
      commitTimestamp: committedLater,
    });
    expect(l.onShoppingItemChange).not.toHaveBeenCalled();
  });

  it("passes shopping changes on to the shopping listener", () => {
    const fake = fakeRealtimeClient();
    const l = listeners();
    subscribeToHouseholdChanges(fake.client, "house-1", l);

    callbackFor(
      fake,
      "shopping_items",
      "INSERT",
    )({ eventType: "INSERT", new: shoppingRow, commit_timestamp: committedAt });
    callbackFor(
      fake,
      "shopping_items",
      "UPDATE",
    )({
      eventType: "UPDATE",
      new: { ...shoppingRow, checked: true },
      commit_timestamp: committedLater,
    });

    expect(l.onShoppingItemChange).toHaveBeenNthCalledWith(1, {
      eventType: "INSERT",
      new: shoppingRow,
      commitTimestamp: committedAt,
    });
    expect(l.onShoppingItemChange).toHaveBeenNthCalledWith(2, {
      eventType: "UPDATE",
      new: { ...shoppingRow, checked: true },
      commitTimestamp: committedLater,
    });
    expect(l.onTodoItemChange).not.toHaveBeenCalled();
  });

  it("passes whiteboard strokes on to the stroke listener, with or without their points", () => {
    const fake = fakeRealtimeClient();
    const l = listeners();
    subscribeToHouseholdChanges(fake.client, "house-1", l);
    // An UPDATE of a large stroke arrives without the unchanged points.
    const { points: _omitted, ...erased } = {
      ...strokeRow,
      deleted_at: "2026-01-01T00:00:01Z",
    };

    callbackFor(
      fake,
      "board_strokes",
      "INSERT",
    )({ eventType: "INSERT", new: strokeRow, commit_timestamp: committedAt });
    callbackFor(
      fake,
      "board_strokes",
      "UPDATE",
    )({ eventType: "UPDATE", new: erased, commit_timestamp: committedLater });

    expect(l.onBoardStrokeChange).toHaveBeenNthCalledWith(1, {
      eventType: "INSERT",
      new: strokeRow,
      commitTimestamp: committedAt,
    });
    expect(l.onBoardStrokeChange).toHaveBeenNthCalledWith(2, {
      eventType: "UPDATE",
      new: erased,
      commitTimestamp: committedLater,
    });
    expect(l.onTodoItemChange).not.toHaveBeenCalled();
    expect(l.onShoppingItemChange).not.toHaveBeenCalled();
  });

  it("passes recipes on to the recipe listener, with or without their large columns", () => {
    const fake = fakeRealtimeClient();
    const l = listeners();
    subscribeToHouseholdChanges(fake.client, "house-1", l);
    // An UPDATE of a long recipe arrives without the columns it didn't change.
    const {
      ingredients: _ingredients,
      instructions: _instructions,
      ...renamed
    } = { ...recipeRow, title: "Crêpes" };

    callbackFor(
      fake,
      "recipes",
      "INSERT",
    )({ eventType: "INSERT", new: recipeRow, commit_timestamp: committedAt });
    callbackFor(
      fake,
      "recipes",
      "UPDATE",
    )({ eventType: "UPDATE", new: renamed, commit_timestamp: committedLater });

    expect(l.onRecipeChange).toHaveBeenNthCalledWith(1, {
      eventType: "INSERT",
      new: recipeRow,
      commitTimestamp: committedAt,
    });
    expect(l.onRecipeChange).toHaveBeenNthCalledWith(2, {
      eventType: "UPDATE",
      new: renamed,
      commitTimestamp: committedLater,
    });
    expect(l.onTodoItemChange).not.toHaveBeenCalled();
    expect(l.onShoppingItemChange).not.toHaveBeenCalled();
    expect(l.onBoardStrokeChange).not.toHaveBeenCalled();
  });

  it("asks for a resync on every SUBSCRIBED, including reconnects, and on nothing else", () => {
    const fake = fakeRealtimeClient();
    const l = listeners();
    subscribeToHouseholdChanges(fake.client, "house-1", l);

    fake.emitStatus("SUBSCRIBED");
    fake.emitStatus("CHANNEL_ERROR");
    fake.emitStatus("SUBSCRIBED");

    expect(l.onSubscribed).toHaveBeenCalledTimes(2);
  });

  it("returns an unsubscribe function that removes the channel", () => {
    const fake = fakeRealtimeClient();
    const unsubscribe = subscribeToHouseholdChanges(
      fake.client,
      "house-1",
      listeners(),
    );

    expect(fake.removeChannel).not.toHaveBeenCalled();
    unsubscribe();
    expect(fake.removeChannel).toHaveBeenCalledWith(fake.channel);
  });
});
