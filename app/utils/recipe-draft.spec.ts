import { describe, expect, it } from "vitest";
import type { RecipeContent } from "~/types/recipe";
import {
  changedRecipeFields,
  emptyIngredientDraft,
  emptyRecipeDraft,
  recipeContentFrom,
  recipeDraftFrom,
} from "./recipe-draft";

const content: RecipeContent = {
  title: "Pancakes",
  servings: "4",
  ingredients: [
    { id: "i1", name: "Flour", quantity: "250 g" },
    { id: "i2", name: "Eggs", quantity: null },
  ],
  instructions: "Mix.\nFry.",
  kids_version: "Without the pepper.",
};

describe("emptyRecipeDraft", () => {
  it("starts with one empty ingredient row", () => {
    const draft = emptyRecipeDraft();
    expect(draft).toEqual({
      title: "",
      servings: "",
      ingredients: [{ id: expect.any(String), name: "", quantity: "" }],
      instructions: "",
      kidsVersion: "",
    });
  });
});

describe("emptyIngredientDraft", () => {
  it("gives every row an id of its own, in the form the table accepts", () => {
    const first = emptyIngredientDraft();
    const second = emptyIngredientDraft();
    expect(first.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(second.id).not.toBe(first.id);
  });
});

describe("recipeDraftFrom", () => {
  it("turns a missing kids' version into empty text", () => {
    expect(
      recipeDraftFrom({ ...content, kids_version: null }).kidsVersion,
    ).toBe("");
  });

  it("turns missing servings and quantities into empty text", () => {
    expect(recipeDraftFrom({ ...content, servings: null })).toEqual({
      title: "Pancakes",
      servings: "",
      ingredients: [
        { id: "i1", name: "Flour", quantity: "250 g" },
        { id: "i2", name: "Eggs", quantity: "" },
      ],
      instructions: "Mix.\nFry.",
      kidsVersion: "Without the pepper.",
    });
  });

  it("copies the ingredients, so editing the draft leaves the recipe alone", () => {
    const draft = recipeDraftFrom(content);
    draft.ingredients[0]!.name = "Spelt flour";
    draft.ingredients.pop();
    expect(content.ingredients).toHaveLength(2);
    expect(content.ingredients[0]!.name).toBe("Flour");
  });
});

describe("recipeContentFrom", () => {
  it("is the recipe a draft was made from, when nothing was edited", () => {
    expect(recipeContentFrom(recipeDraftFrom(content))).toEqual(content);
  });

  it("trims text and saves an empty servings or quantity field as null", () => {
    expect(
      recipeContentFrom({
        title: "  Pancakes ",
        servings: "   ",
        ingredients: [{ id: "i1", name: " Flour ", quantity: " " }],
        instructions: "\nMix.\n\nFry.\n\n",
        kidsVersion: "  ",
      }),
    ).toEqual({
      title: "Pancakes",
      servings: null,
      ingredients: [{ id: "i1", name: "Flour", quantity: null }],
      instructions: "Mix.\n\nFry.",
      kids_version: null,
    });
  });

  it("drops ingredient rows without a name, keeping the others in order", () => {
    const saved = recipeContentFrom({
      ...recipeDraftFrom(content),
      ingredients: [
        { id: "i1", name: "Flour", quantity: "" },
        { id: "i2", name: "  ", quantity: "2" },
        { id: "i3", name: "Eggs", quantity: "3" },
      ],
    });
    expect(saved.ingredients).toEqual([
      { id: "i1", name: "Flour", quantity: null },
      { id: "i3", name: "Eggs", quantity: "3" },
    ]);
  });
});

describe("changedRecipeFields", () => {
  it("is empty when nothing changed", () => {
    const same = recipeContentFrom(recipeDraftFrom(content));
    expect(changedRecipeFields(content, same)).toEqual({});
  });

  it("holds the kids' version when it changed", () => {
    expect(
      changedRecipeFields(content, { ...content, kids_version: null }),
    ).toEqual({ kids_version: null });
  });

  it("holds only the changed text fields", () => {
    expect(
      changedRecipeFields(content, {
        ...content,
        title: "Crêpes",
        servings: null,
      }),
    ).toEqual({ title: "Crêpes", servings: null });
    expect(
      changedRecipeFields(content, { ...content, instructions: "Fry." }),
    ).toEqual({ instructions: "Fry." });
  });

  it.each([
    [
      "a changed name",
      [
        { id: "i1", name: "Spelt flour", quantity: "250 g" },
        { id: "i2", name: "Eggs", quantity: null },
      ],
    ],
    [
      "a changed quantity",
      [
        { id: "i1", name: "Flour", quantity: "250 g" },
        { id: "i2", name: "Eggs", quantity: "3" },
      ],
    ],
    ["a removed ingredient", [{ id: "i1", name: "Flour", quantity: "250 g" }]],
    [
      "an added ingredient",
      [...content.ingredients, { id: "i3", name: "Milk", quantity: null }],
    ],
    [
      "an ingredient replaced by another with the same text",
      [
        { id: "i1", name: "Flour", quantity: "250 g" },
        { id: "i9", name: "Eggs", quantity: null },
      ],
    ],
  ])("holds the whole ingredient list after %s", (_name, ingredients) => {
    expect(changedRecipeFields(content, { ...content, ingredients })).toEqual({
      ingredients,
    });
  });
});
