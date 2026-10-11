import { describe, expect, it } from "vitest";
import {
  fetchRecipe,
  fetchRecipes,
  insertRecipe,
  RECIPE_PAGE_SIZE,
  softDeleteRecipeRemote,
  updateRecipeRemote,
} from "./recipe-actions";
import {
  fakeClient,
  fakeClientWithQueries,
  fakeQueryBuilder,
} from "../../tests/support/fake-supabase-client";

describe("fetchRecipes", () => {
  it("returns the non-deleted recipes of the household", async () => {
    const recipes = [{ id: "a" }, { id: "b" }];
    const query = fakeQueryBuilder({ data: recipes, error: null });
    const { client, from } = fakeClientWithQueries([query]);

    expect(await fetchRecipes(client as never, "h1")).toEqual(recipes);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("recipes");
    expect(query.calls.eq).toEqual(["household_id", "h1"]);
    expect(query.calls.is).toEqual(["deleted_at", null]);
    expect(query.calls.order).toEqual(["id"]);
    expect(query.calls.limit).toEqual([RECIPE_PAGE_SIZE]);
    expect(query.calls.gt).toBeUndefined();
  });

  it("keeps fetching after a full page, continuing after its last id", async () => {
    const fullPage = Array.from({ length: RECIPE_PAGE_SIZE }, (_, index) => ({
      id: `id-${index}`,
    }));
    const first = fakeQueryBuilder({ data: fullPage, error: null });
    const second = fakeQueryBuilder({ data: [{ id: "last" }], error: null });
    const { client, from } = fakeClientWithQueries([first, second]);

    const recipes = await fetchRecipes(client as never, "h1");

    expect(recipes).toHaveLength(RECIPE_PAGE_SIZE + 1);
    expect(recipes.at(-1)).toEqual({ id: "last" });
    expect(from).toHaveBeenCalledTimes(2);
    expect(second.calls.gt).toEqual(["id", `id-${RECIPE_PAGE_SIZE - 1}`]);
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const { client } = fakeClientWithQueries([
      fakeQueryBuilder({ data: null, error }),
    ]);

    await expect(fetchRecipes(client as never, "h1")).rejects.toBe(error);
  });
});

describe("fetchRecipe", () => {
  it("returns the recipe with the given id, unless it is deleted", async () => {
    const recipe = { id: "recipe-1", title: "Pancakes" };
    const query = fakeQueryBuilder({ data: recipe, error: null });
    const client = fakeClient({ from: () => query.builder });

    expect(await fetchRecipe(client as never, "recipe-1")).toEqual(recipe);
    expect(client.from).toHaveBeenCalledWith("recipes");
    expect(query.calls.eq).toEqual(["id", "recipe-1"]);
    expect(query.calls.is).toEqual(["deleted_at", null]);
  });

  it("returns null when there is no such recipe", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });

    expect(await fetchRecipe(client as never, "recipe-1")).toBeNull();
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(fetchRecipe(client as never, "recipe-1")).rejects.toBe(error);
  });
});

describe("insertRecipe", () => {
  it("inserts with the client-supplied id and the resolved created_by", async () => {
    const row = { id: "recipe-1", title: "Pancakes" };
    const query = fakeQueryBuilder({ data: row, error: null });
    const client = fakeClient({ userId: "user-1", from: () => query.builder });
    const ingredients = [{ id: "i1", name: "Flour", quantity: "250 g" }];

    const result = await insertRecipe(client as never, {
      id: "recipe-1",
      householdId: "h1",
      title: "Pancakes",
      servings: "4",
      ingredients,
      instructions: "Mix.\nFry.",
    });

    expect(result).toEqual(row);
    expect(query.calls.insert).toEqual([
      {
        id: "recipe-1",
        household_id: "h1",
        title: "Pancakes",
        servings: "4",
        ingredients,
        instructions: "Mix.\nFry.",
        created_by: "user-1",
      },
    ]);
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      insertRecipe(client as never, {
        id: "recipe-1",
        householdId: "h1",
        title: "Pancakes",
        servings: null,
        ingredients: [],
        instructions: "",
      }),
    ).rejects.toBe(error);
  });
});

describe("updateRecipeRemote", () => {
  it("sends only the given fields, to the recipe that is not deleted", async () => {
    const query = fakeQueryBuilder({
      data: [{ id: "recipe-1" }],
      error: null,
    });
    const client = fakeClient({ from: () => query.builder });

    await updateRecipeRemote(client as never, "recipe-1", {
      title: "Crêpes",
    });

    expect(query.calls.update).toEqual([{ title: "Crêpes" }]);
    expect(query.calls.eq).toEqual(["id", "recipe-1"]);
    expect(query.calls.is).toEqual(["deleted_at", null]);
  });

  it("throws when the recipe was removed in the meantime, since nothing was saved", async () => {
    const query = fakeQueryBuilder({ data: [], error: null });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      updateRecipeRemote(client as never, "recipe-1", { title: "Crêpes" }),
    ).rejects.toThrow("This recipe was removed in the meantime.");
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      updateRecipeRemote(client as never, "recipe-1", { title: "Crêpes" }),
    ).rejects.toBe(error);
  });
});

describe("softDeleteRecipeRemote", () => {
  it("sets deleted_at for the given id", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });

    await softDeleteRecipeRemote(client as never, "recipe-1");

    expect(query.calls.eq).toEqual(["id", "recipe-1"]);
    expect(
      typeof (query.calls.update![0] as { deleted_at: string }).deleted_at,
    ).toBe("string");
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      softDeleteRecipeRemote(client as never, "recipe-1"),
    ).rejects.toBe(error);
  });
});
