import { describe, expect, it } from "vitest";
import type { Recipe, RecipeChange, RecipeRealtimeEvent } from "~/types/recipe";
import {
  applyRecipeEdit,
  applyRecipeRealtimeEvent,
  recipeEventNeedsFetch,
  revertRecipeEdit,
  visibleRecipes,
} from "./recipe-state";

const HOUSEHOLD = "house-1";

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "recipe-1",
    household_id: HOUSEHOLD,
    title: "Pancakes",
    servings: "4",
    ingredients: [{ id: "i1", name: "Flour", quantity: "250 g" }],
    instructions: "Mix.\nFry.",
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

/** A row as an UPDATE delivers it when the large columns weren't touched. */
function withoutLargeColumns(row: Recipe): RecipeChange {
  const {
    ingredients: _ingredients,
    instructions: _instructions,
    ...rest
  } = row;
  return rest;
}

function event(
  row: RecipeChange,
  eventType: RecipeRealtimeEvent["eventType"] = "UPDATE",
): RecipeRealtimeEvent {
  return { eventType, new: row, commitTimestamp: "2026-01-01T00:00:00.000Z" };
}

describe("applyRecipeRealtimeEvent", () => {
  it("adds a recipe another member wrote", () => {
    const next = applyRecipeRealtimeEvent(
      {},
      event(recipe(), "INSERT"),
      HOUSEHOLD,
    );
    expect(next).toEqual({ "recipe-1": recipe() });
  });

  it("makes the echo of our own write a no-op (same id, no duplicate)", () => {
    const state = { "recipe-1": recipe() };
    const next = applyRecipeRealtimeEvent(
      state,
      event(recipe(), "INSERT"),
      HOUSEHOLD,
    );
    expect(Object.keys(next)).toEqual(["recipe-1"]);
  });

  it("ignores another household's recipe", () => {
    const state = {};
    const other = recipe({ household_id: "house-2" });
    expect(
      applyRecipeRealtimeEvent(state, event(other, "INSERT"), HOUSEHOLD),
    ).toBe(state);
  });

  it("ignores everything before the recipes are loaded", () => {
    const state = {};
    expect(
      applyRecipeRealtimeEvent(state, event(recipe(), "INSERT"), null),
    ).toBe(state);
  });

  it("keeps the ingredients and instructions an update leaves out", () => {
    const state = { "recipe-1": recipe() };
    const renamed = withoutLargeColumns(recipe({ title: "Crêpes" }));

    const next = applyRecipeRealtimeEvent(state, event(renamed), HOUSEHOLD);

    expect(next["recipe-1"]).toEqual(recipe({ title: "Crêpes" }));
  });

  it("takes the ingredients and instructions an update carries", () => {
    const state = { "recipe-1": recipe() };
    const edited = recipe({ ingredients: [], instructions: "Just fry." });

    const next = applyRecipeRealtimeEvent(state, event(edited), HOUSEHOLD);

    expect(next["recipe-1"]).toEqual(edited);
  });

  it("soft-deletes a recipe whose removal leaves out the large columns", () => {
    const state = { "recipe-1": recipe() };
    const removed = withoutLargeColumns(
      recipe({ deleted_at: "2026-01-02T00:00:00Z" }),
    );

    const next = applyRecipeRealtimeEvent(state, event(removed), HOUSEHOLD);

    expect(next["recipe-1"]).toEqual(
      recipe({ deleted_at: "2026-01-02T00:00:00Z" }),
    );
  });

  it("does not undo a local soft delete", () => {
    const state = {
      "recipe-1": recipe({ deleted_at: "2026-01-02T00:00:00Z" }),
    };
    expect(applyRecipeRealtimeEvent(state, event(recipe()), HOUSEHOLD)).toBe(
      state,
    );
  });

  it("keeps the removal of a recipe it never had as a tombstone without content", () => {
    const removed = withoutLargeColumns(
      recipe({ deleted_at: "2026-01-02T00:00:00Z" }),
    );

    const next = applyRecipeRealtimeEvent({}, event(removed), HOUSEHOLD);

    expect(next["recipe-1"]).toEqual(
      recipe({
        deleted_at: "2026-01-02T00:00:00Z",
        ingredients: [],
        instructions: "",
      }),
    );
  });

  it("does not show part of a live recipe it never had", () => {
    const state = {};
    const renamed = withoutLargeColumns(recipe({ title: "Crêpes" }));
    expect(applyRecipeRealtimeEvent(state, event(renamed), HOUSEHOLD)).toBe(
      state,
    );
  });
});

describe("recipeEventNeedsFetch", () => {
  const partial = withoutLargeColumns(recipe({ title: "Crêpes" }));

  it("is true for part of a live recipe that is not in state", () => {
    expect(recipeEventNeedsFetch({}, event(partial), HOUSEHOLD)).toBe(true);
  });

  it("is false when the recipe is in state, since the event is laid over it", () => {
    const state = { "recipe-1": recipe() };
    expect(recipeEventNeedsFetch(state, event(partial), HOUSEHOLD)).toBe(false);
  });

  it("is false for an event that carries the whole recipe", () => {
    expect(recipeEventNeedsFetch({}, event(recipe()), HOUSEHOLD)).toBe(false);
  });

  it("is false for a removal, which needs no content", () => {
    const removed = withoutLargeColumns(
      recipe({ deleted_at: "2026-01-02T00:00:00Z" }),
    );
    expect(recipeEventNeedsFetch({}, event(removed), HOUSEHOLD)).toBe(false);
  });

  it("is false for another household's recipe and before the recipes are loaded", () => {
    expect(recipeEventNeedsFetch({}, event(partial), "house-2")).toBe(false);
    expect(recipeEventNeedsFetch({}, event(partial), null)).toBe(false);
  });
});

describe("applyRecipeEdit", () => {
  it("changes only the edited fields", () => {
    const state = { "recipe-1": recipe() };
    const next = applyRecipeEdit(state, "recipe-1", { title: "Crêpes" });
    expect(next["recipe-1"]).toEqual(recipe({ title: "Crêpes" }));
  });

  it("leaves a deleted or unknown recipe alone", () => {
    const state = {
      "recipe-1": recipe({ deleted_at: "2026-01-02T00:00:00Z" }),
    };
    expect(applyRecipeEdit(state, "recipe-1", { title: "Crêpes" })).toBe(state);
    expect(applyRecipeEdit(state, "recipe-2", { title: "Crêpes" })).toBe(state);
  });
});

describe("revertRecipeEdit", () => {
  it("gives the edited fields their previous values", () => {
    const previous = recipe();
    const state = { "recipe-1": recipe({ title: "Crêpes", servings: null }) };

    const next = revertRecipeEdit(state, previous, {
      title: "Crêpes",
      servings: null,
    });

    expect(next["recipe-1"]).toEqual(previous);
  });

  it("keeps a change to another field that arrived in the meantime", () => {
    const previous = recipe();
    const state = {
      "recipe-1": recipe({ title: "Crêpes", instructions: "Just fry." }),
    };

    const next = revertRecipeEdit(state, previous, { title: "Crêpes" });

    expect(next["recipe-1"]).toEqual(recipe({ instructions: "Just fry." }));
  });

  it("keeps a removal that arrived in the meantime", () => {
    const previous = recipe();
    const state = {
      "recipe-1": recipe({
        title: "Crêpes",
        deleted_at: "2026-01-02T00:00:00Z",
      }),
    };

    const next = revertRecipeEdit(state, previous, { title: "Crêpes" });

    expect(next["recipe-1"]!.deleted_at).toBe("2026-01-02T00:00:00Z");
  });

  it("adds nothing back when the recipe is no longer in state", () => {
    const state = {};
    expect(revertRecipeEdit(state, recipe(), { title: "Crêpes" })).toBe(state);
  });
});

describe("visibleRecipes", () => {
  it("leaves out deleted recipes", () => {
    const state = {
      a: recipe({ id: "a" }),
      b: recipe({ id: "b", deleted_at: "2026-01-02T00:00:00Z" }),
    };
    expect(visibleRecipes(state).map((r) => r.id)).toEqual(["a"]);
  });

  it("sorts by title, ignoring case and accents", () => {
    const state = {
      a: recipe({ id: "a", title: "waffles" }),
      b: recipe({ id: "b", title: "Éclairs" }),
      c: recipe({ id: "c", title: "apple pie" }),
      d: recipe({ id: "d", title: "Dumplings" }),
    };
    expect(visibleRecipes(state).map((r) => r.title)).toEqual([
      "apple pie",
      "Dumplings",
      "Éclairs",
      "waffles",
    ]);
  });

  it("orders equal titles by id, so every member sees the same order", () => {
    const state = {
      b: recipe({ id: "b" }),
      a: recipe({ id: "a" }),
    };
    expect(visibleRecipes(state).map((r) => r.id)).toEqual(["a", "b"]);
  });
});
