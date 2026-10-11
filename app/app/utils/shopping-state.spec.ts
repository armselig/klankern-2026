import { describe, expect, it } from "vitest";
import type { ShoppingItem } from "~/types/shopping";
import { visibleShoppingItems } from "./shopping-state";

function item(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id: "item-1",
    list_id: "list-1",
    household_id: "house-1",
    title: "Apples",
    quantity: null,
    checked: false,
    position: 1,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("visibleShoppingItems", () => {
  it("lists unchecked items first, then checked ones, each group by position", () => {
    const state = {
      a: item({ id: "a", position: 1, checked: true }),
      b: item({ id: "b", position: 2 }),
      c: item({ id: "c", position: 3, checked: true }),
      d: item({ id: "d", position: 4 }),
    };
    expect(visibleShoppingItems(state).map((i) => i.id)).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
  });

  it("excludes soft-deleted items", () => {
    const state = {
      a: item({ id: "a" }),
      b: item({ id: "b", deleted_at: "2026-01-02T00:00:00Z" }),
    };
    expect(visibleShoppingItems(state).map((i) => i.id)).toEqual(["a"]);
  });
});
