import { describe, expect, it } from "vitest";
import type { TitledEntry } from "~/types/dashboard";
import { LIST_PREVIEW_LINES, previewOfList } from "./list-preview";

function entries(count: number): TitledEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `entry-${index + 1}`,
    title: `Entry ${index + 1}`,
  }));
}

describe("previewOfList", () => {
  it("has nothing to show for an empty list", () => {
    expect(previewOfList([])).toEqual({ count: 0, shown: [], more: 0 });
  });

  it("shows a list whole when it fits the lines", () => {
    const list = entries(LIST_PREVIEW_LINES);
    expect(previewOfList(list)).toEqual({
      count: LIST_PREVIEW_LINES,
      shown: list,
      more: 0,
    });
  });

  it("gives the last line to the rest when the list is longer", () => {
    const list = entries(LIST_PREVIEW_LINES + 1);
    const preview = previewOfList(list);
    expect(preview.count).toBe(LIST_PREVIEW_LINES + 1);
    expect(preview.shown).toEqual(list.slice(0, LIST_PREVIEW_LINES - 1));
    // Never "and 1 more": that line could have held the entry itself.
    expect(preview.more).toBe(2);
  });

  it("keeps the order of the list", () => {
    expect(previewOfList(entries(9), 3).shown.map((e) => e.id)).toEqual([
      "entry-1",
      "entry-2",
    ]);
  });

  it("counts what it leaves out", () => {
    expect(previewOfList(entries(9), 3).more).toBe(7);
  });
});
