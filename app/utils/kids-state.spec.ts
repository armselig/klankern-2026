import { describe, expect, it } from "vitest";
import type { ItemsById } from "~/types/list";
import type { ChildRefusal, HouseholdChild, MealReaction } from "~/types/kids";
import type { MealPlanEntry } from "~/types/meal-plan";
import type { SyncedRow } from "~/types/synced-row";
import {
  canRecordReactions,
  childRecords,
  liveChildren,
  liveReactionOf,
  reactionChoicesOf,
  reactionNote,
  reactionWindow,
  REFUSALS_TO_DEMOTE,
  refusalLine,
  refusalsByRecipe,
  timesText,
} from "./kids-state";

const HOUSEHOLD = "house-1";
const DAY = "2026-10-15";
const DELETED = "2026-10-15T09:00:00Z";

/** Midday UTC, so the child's local day is the same in every time zone. */
function child(overrides: Partial<HouseholdChild> = {}): HouseholdChild {
  return {
    id: "child-1",
    household_id: HOUSEHOLD,
    name: "Mila",
    created_by: "user-1",
    created_at: "2026-01-01T12:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function entry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: "entry-1",
    household_id: HOUSEHOLD,
    date: "2026-10-10",
    slot: "dinner",
    recipe_id: "recipe-1",
    title: "Pancakes",
    position: 1,
    on_shopping_list_at: null,
    skipped_at: null,
    created_by: "user-1",
    created_at: "2026-10-01T12:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

let reactionCounter = 0;
function reaction(overrides: Partial<MealReaction> = {}): MealReaction {
  reactionCounter += 1;
  return {
    id: `reaction-${reactionCounter}`,
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

function byId<T extends SyncedRow>(...rows: T[]): ItemsById<T> {
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

/** `count` cooked dinners of one recipe on distinct days before DAY, each
 * with a reaction of the child, as entries and reactions. */
function reactionsToRecipe(
  recipeId: string,
  childId: string,
  kind: MealReaction["reaction"],
  count: number,
) {
  const entries: MealPlanEntry[] = [];
  const reactions: MealReaction[] = [];
  for (let i = 0; i < count; i++) {
    const planned = entry({
      id: `${recipeId}-${childId}-${kind}-${i}`,
      recipe_id: recipeId,
      date: `2026-10-0${i + 1}`,
    });
    entries.push(planned);
    reactions.push(
      reaction({ entry_id: planned.id, child_id: childId, reaction: kind }),
    );
  }
  return { entries, reactions };
}

describe("liveChildren", () => {
  it("returns nothing for no children", () => {
    expect(liveChildren({})).toEqual([]);
  });

  it("orders by when they were added, then name, then id", () => {
    const early = child({
      id: "c",
      name: "Zoe",
      created_at: "2026-01-01T12:00:00Z",
    });
    const lateB = child({
      id: "b",
      name: "Ben",
      created_at: "2026-02-01T12:00:00Z",
    });
    const lateA = child({
      id: "a",
      name: "ben",
      created_at: "2026-02-01T12:00:00Z",
    });
    const lateA2 = child({
      id: "a2",
      name: "Ben",
      created_at: "2026-02-01T12:00:00Z",
    });
    const lateAlma = child({
      id: "z",
      name: "alma",
      created_at: "2026-02-01T12:00:00Z",
    });

    expect(
      liveChildren(byId(lateB, lateA2, early, lateA, lateAlma)).map(
        (c) => c.id,
      ),
    ).toEqual(["c", "z", "a", "a2", "b"]);
  });

  it("leaves out a removed child", () => {
    const gone = child({ id: "gone", deleted_at: DELETED });
    expect(liveChildren(byId(child(), gone)).map((c) => c.id)).toEqual([
      "child-1",
    ]);
  });
});

describe("liveReactionOf", () => {
  it("is null when there is no row: the child ate it", () => {
    expect(liveReactionOf({}, "entry-1", "child-1")).toBeNull();
  });

  it("finds the live reaction of that child to that entry", () => {
    const mine = reaction();
    const other = reaction({ child_id: "child-2" });
    const elsewhere = reaction({ entry_id: "entry-2" });

    expect(
      liveReactionOf(byId(other, elsewhere, mine), "entry-1", "child-1"),
    ).toBe(mine);
  });

  it("ignores a reaction that was taken back", () => {
    const taken = reaction({ deleted_at: DELETED });
    expect(liveReactionOf(byId(taken), "entry-1", "child-1")).toBeNull();
  });

  it("finds the live row when a taken-back one sits beside it", () => {
    const taken = reaction({ deleted_at: DELETED });
    const live = reaction({ reaction: "picked_at" });
    expect(liveReactionOf(byId(taken, live), "entry-1", "child-1")).toBe(live);
  });
});

describe("reactionChoicesOf", () => {
  it("is empty without children", () => {
    expect(reactionChoicesOf({}, [], "entry-1")).toEqual({});
  });

  it("says ate for a child without a live row, and the reaction for the others", () => {
    const mila = child({ id: "mila" });
    const jo = child({ id: "jo" });
    const lena = child({ id: "lena" });
    const reactions = byId(
      reaction({ child_id: "mila", reaction: "refused" }),
      reaction({ child_id: "jo", reaction: "picked_at" }),
      reaction({ child_id: "lena", reaction: "refused", deleted_at: DELETED }),
    );

    expect(reactionChoicesOf(reactions, [mila, jo, lena], "entry-1")).toEqual({
      mila: "refused",
      jo: "picked_at",
      lena: "ate",
    });
  });
});

describe("canRecordReactions", () => {
  it("is true for a cooked dinner from a recipe", () => {
    expect(canRecordReactions(entry(), DAY)).toBe(true);
  });

  it("is true for a dinner planned for the day itself", () => {
    expect(canRecordReactions(entry({ date: DAY }), DAY)).toBe(true);
  });

  it("is false for a dinner planned after the day", () => {
    expect(canRecordReactions(entry({ date: "2026-10-16" }), DAY)).toBe(false);
  });

  it("is false for another slot", () => {
    expect(canRecordReactions(entry({ slot: "lunch" }), DAY)).toBe(false);
  });

  it("is false for a title without a recipe", () => {
    expect(canRecordReactions(entry({ recipe_id: null }), DAY)).toBe(false);
  });

  it("is false for a skipped dinner", () => {
    expect(
      canRecordReactions(entry({ skipped_at: "2026-10-10T17:00:00Z" }), DAY),
    ).toBe(false);
  });

  it("is false for a removed dinner", () => {
    expect(canRecordReactions(entry({ deleted_at: DELETED }), DAY)).toBe(false);
  });
});

describe("reactionNote", () => {
  const mila = child({ id: "mila", name: "Mila" });
  const jo = child({ id: "jo", name: "Jo" });
  const ana = child({ id: "ana", name: "Ana" });

  it("is null without children", () => {
    expect(reactionNote({}, [], "entry-1")).toBeNull();
  });

  it("is null when every child ate it", () => {
    expect(reactionNote({}, [mila, jo], "entry-1")).toBeNull();
  });

  it("is null when the only reaction was taken back", () => {
    const taken = reaction({ child_id: "mila", deleted_at: DELETED });
    expect(reactionNote(byId(taken), [mila], "entry-1")).toBeNull();
  });

  it("names who refused", () => {
    const reactions = byId(
      reaction({ child_id: "mila" }),
      reaction({ child_id: "ana" }),
    );
    expect(reactionNote(reactions, [mila, jo, ana], "entry-1")).toBe(
      "Refused: Mila, Ana",
    );
  });

  it("puts who refused before who picked at, in the children's order", () => {
    const reactions = byId(
      reaction({ child_id: "mila", reaction: "picked_at" }),
      reaction({ child_id: "jo", reaction: "refused" }),
      reaction({ child_id: "ana", reaction: "picked_at" }),
    );
    expect(reactionNote(reactions, [mila, jo, ana], "entry-1")).toBe(
      "Refused: Jo · Picked at: Mila, Ana",
    );
  });

  it("ignores the reactions to another entry", () => {
    const reactions = byId(reaction({ child_id: "mila", entry_id: "entry-2" }));
    expect(reactionNote(reactions, [mila], "entry-1")).toBeNull();
  });
});

describe("reactionWindow", () => {
  it("runs from 8 weeks back to the day", () => {
    expect(reactionWindow("2026-10-15")).toEqual({
      from: "2026-08-20",
      to: "2026-10-15",
    });
  });
});

describe("childRecords", () => {
  const mila = child({ id: "mila", name: "Mila" });
  const jo = child({ id: "jo", name: "Jo" });

  it("is empty without children", () => {
    expect(childRecords([], {}, [entry()], DAY)).toEqual([]);
  });

  it("gives a child without reactions an empty record", () => {
    expect(childRecords([mila], {}, [entry()], DAY)).toEqual([
      { child: mila, refused: [], pickedAt: [] },
    ]);
  });

  it("counts refusals and picked-at per recipe, in the order of the children", () => {
    const pancakes = reactionsToRecipe("pancakes", "jo", "refused", 1);
    const soup = reactionsToRecipe("soup", "mila", "picked_at", 2);
    const records = childRecords(
      [mila, jo],
      byId(...pancakes.reactions, ...soup.reactions),
      [...pancakes.entries, ...soup.entries],
      DAY,
    );

    expect(records).toEqual([
      {
        child: mila,
        refused: [],
        pickedAt: [{ recipeId: "soup", count: 2 }],
      },
      {
        child: jo,
        refused: [{ recipeId: "pancakes", count: 1 }],
        pickedAt: [],
      },
    ]);
  });

  it("sorts by count, most often first, ties by recipe id", () => {
    const rare = reactionsToRecipe("b-rare", "mila", "refused", 1);
    const often = reactionsToRecipe("z-often", "mila", "refused", 3);
    const tieA = reactionsToRecipe("a-tie", "mila", "refused", 1);

    const [record] = childRecords(
      [mila],
      byId(...rare.reactions, ...often.reactions, ...tieA.reactions),
      [...rare.entries, ...often.entries, ...tieA.entries],
      DAY,
    );

    expect(record!.refused).toEqual([
      { recipeId: "z-often", count: 3 },
      { recipeId: "a-tie", count: 1 },
      { recipeId: "b-rare", count: 1 },
    ]);
  });

  it("counts the day itself but not an entry before the window", () => {
    const today = entry({ id: "today", date: DAY });
    const edge = entry({ id: "edge", date: "2026-08-20", recipe_id: "edge" });
    const old = entry({ id: "old", date: "2026-08-19", recipe_id: "old" });
    const reactions = byId(
      reaction({ entry_id: "today", child_id: "mila" }),
      reaction({ entry_id: "edge", child_id: "mila" }),
      reaction({ entry_id: "old", child_id: "mila" }),
    );

    const [record] = childRecords([mila], reactions, [today, edge, old], DAY);

    expect(record!.refused.map((r) => r.recipeId).sort()).toEqual([
      "edge",
      "recipe-1",
    ]);
  });

  it("does not count a dinner after the day", () => {
    const future = entry({ id: "future", date: "2026-10-16" });
    const reactions = byId(reaction({ entry_id: "future", child_id: "mila" }));
    expect(childRecords([mila], reactions, [future], DAY)[0]!.refused).toEqual(
      [],
    );
  });

  it("counts entries from before the child was added", () => {
    const newcomer = child({
      id: "new",
      name: "Noor",
      created_at: "2026-10-05T12:00:00Z",
    });
    const before = entry({
      id: "before",
      date: "2026-10-04",
      recipe_id: "before",
    });
    const onTheDay = entry({ id: "on", date: "2026-10-05", recipe_id: "on" });
    const reactions = byId(
      reaction({ entry_id: "before", child_id: "new" }),
      reaction({ entry_id: "on", child_id: "new" }),
    );

    const [record] = childRecords(
      [newcomer],
      reactions,
      [before, onTheDay],
      DAY,
    );

    expect(record!.refused).toEqual([
      { recipeId: "before", count: 1 },
      { recipeId: "on", count: 1 },
    ]);
  });

  it("leaves out the reactions of a child that is not in the list", () => {
    const removed = child({ id: "gone", name: "Gone", deleted_at: DELETED });
    const reactions = byId(reaction({ child_id: removed.id }));

    // The caller passes the live children, so a removed one has no record.
    expect(childRecords([mila], reactions, [entry()], DAY)).toEqual([
      { child: mila, refused: [], pickedAt: [] },
    ]);
  });

  it("does not count a reaction that was taken back", () => {
    const reactions = byId(reaction({ child_id: "mila", deleted_at: DELETED }));
    expect(childRecords([mila], reactions, [entry()], DAY)[0]!.refused).toEqual(
      [],
    );
  });

  it("does not count skipped, removed or title-only entries, or a reaction to an unknown entry", () => {
    const skipped = entry({
      id: "skipped",
      skipped_at: "2026-10-10T17:00:00Z",
    });
    const removed = entry({ id: "removed", deleted_at: DELETED });
    const title = entry({ id: "title", recipe_id: null });
    const lunch = entry({ id: "lunch", slot: "lunch" });
    const reactions = byId(
      reaction({ entry_id: "skipped", child_id: "mila" }),
      reaction({ entry_id: "removed", child_id: "mila" }),
      reaction({ entry_id: "title", child_id: "mila" }),
      reaction({ entry_id: "lunch", child_id: "mila" }),
      reaction({ entry_id: "unknown", child_id: "mila" }),
    );

    expect(
      childRecords([mila], reactions, [skipped, removed, title, lunch], DAY),
    ).toEqual([{ child: mila, refused: [], pickedAt: [] }]);
  });
});

describe("refusalsByRecipe", () => {
  const mila = child({ id: "mila", name: "Mila" });
  const jo = child({ id: "jo", name: "Jo" });

  it("is empty without children, reactions or entries", () => {
    expect(refusalsByRecipe([], {}, [], DAY).size).toBe(0);
    expect(refusalsByRecipe([mila], {}, [entry()], DAY).size).toBe(0);
  });

  it("needs as many refusals by one child as the threshold", () => {
    expect(REFUSALS_TO_DEMOTE).toBe(2);
    const once = reactionsToRecipe("soup", "mila", "refused", 1);
    const twice = reactionsToRecipe("stew", "mila", "refused", 2);

    const result = refusalsByRecipe(
      [mila],
      byId(...once.reactions, ...twice.reactions),
      [...once.entries, ...twice.entries],
      DAY,
    );

    expect([...result.keys()]).toEqual(["stew"]);
    expect(result.get("stew")).toEqual([{ childName: "Mila", count: 2 }]);
  });

  it("does not add up the refusals of different children", () => {
    const byMila = reactionsToRecipe("soup", "mila", "refused", 1);
    const byJo = reactionsToRecipe("soup", "jo", "refused", 1);
    // Same entry ids would collide; the helper names them per child.
    const result = refusalsByRecipe(
      [mila, jo],
      byId(...byMila.reactions, ...byJo.reactions),
      [...byMila.entries, ...byJo.entries],
      DAY,
    );
    expect(result.size).toBe(0);
  });

  it("lists every child who refused a recipe often enough, in the children's order", () => {
    const byMila = reactionsToRecipe("soup", "mila", "refused", 2);
    const byJo = reactionsToRecipe("soup", "jo", "refused", 3);

    const result = refusalsByRecipe(
      [mila, jo],
      byId(...byMila.reactions, ...byJo.reactions),
      [...byMila.entries, ...byJo.entries],
      DAY,
    );

    expect(result.get("soup")).toEqual([
      { childName: "Mila", count: 2 },
      { childName: "Jo", count: 3 },
    ]);
  });

  it("does not count picked-at reactions", () => {
    const picked = reactionsToRecipe("soup", "mila", "picked_at", 3);
    expect(
      refusalsByRecipe([mila], byId(...picked.reactions), picked.entries, DAY)
        .size,
    ).toBe(0);
  });

  it("counts only days before the day", () => {
    const earlier = reactionsToRecipe("soup", "mila", "refused", 1);
    const today = entry({ id: "today", date: DAY, recipe_id: "soup" });
    const reactions = byId(
      ...earlier.reactions,
      reaction({ entry_id: "today", child_id: "mila" }),
    );

    const result = refusalsByRecipe(
      [mila],
      reactions,
      [...earlier.entries, today],
      DAY,
    );

    expect(result.size).toBe(0);
    // The next day, the refusal of today counts.
    expect(
      refusalsByRecipe(
        [mila],
        reactions,
        [...earlier.entries, today],
        "2026-10-16",
      ).get("soup"),
    ).toEqual([{ childName: "Mila", count: 2 }]);
  });

  it("counts yesterday and not what lies before the lookback", () => {
    const yesterday = entry({
      id: "yesterday",
      date: "2026-10-14",
      recipe_id: "soup",
    });
    const old = entry({ id: "old", date: "2026-08-19", recipe_id: "soup" });
    const edge = entry({ id: "edge", date: "2026-08-20", recipe_id: "stew" });
    const edge2 = entry({ id: "edge2", date: "2026-10-13", recipe_id: "stew" });
    const reactions = byId(
      reaction({ entry_id: "yesterday", child_id: "mila" }),
      reaction({ entry_id: "old", child_id: "mila" }),
      reaction({ entry_id: "edge", child_id: "mila" }),
      reaction({ entry_id: "edge2", child_id: "mila" }),
    );

    const result = refusalsByRecipe(
      [mila],
      reactions,
      [yesterday, old, edge, edge2],
      DAY,
    );

    expect([...result.keys()]).toEqual(["stew"]);
  });

  it("counts refusals from before the child was added", () => {
    const newcomer = child({
      id: "new",
      name: "Noor",
      created_at: "2026-10-05T12:00:00Z",
    });
    const early = reactionsToRecipe("soup", "new", "refused", 2);
    // Days 2026-10-01 and 2026-10-02 are before the child was added.
    expect(
      refusalsByRecipe([newcomer], byId(...early.reactions), early.entries, DAY)
        .size,
    ).toBe(1);
  });
});

describe("timesText", () => {
  it.each([
    [1, "once"],
    [2, "twice"],
    [3, "3 times"],
    [12, "12 times"],
  ])("writes %i as %s", (count, text) => {
    expect(timesText(count)).toBe(text);
  });
});

describe("refusalLine", () => {
  it("is null without refusals", () => {
    expect(refusalLine([])).toBeNull();
  });

  it("names one child", () => {
    expect(refusalLine([{ childName: "Mila", count: 2 }])).toBe(
      "Refused twice by Mila",
    );
  });

  it("joins two children with and", () => {
    const refusals: ChildRefusal[] = [
      { childName: "Mila", count: 2 },
      { childName: "Jo", count: 3 },
    ];
    expect(refusalLine(refusals)).toBe(
      "Refused twice by Mila and 3 times by Jo",
    );
  });

  it("separates three children with commas and the last with and", () => {
    const refusals: ChildRefusal[] = [
      { childName: "Mila", count: 2 },
      { childName: "Jo", count: 3 },
      { childName: "Ana", count: 4 },
    ];
    expect(refusalLine(refusals)).toBe(
      "Refused twice by Mila, 3 times by Jo and 4 times by Ana",
    );
  });
});
