import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { ROUTES } from "../../app/utils/routes";
import {
  fillRecipeForm,
  ingredientRow,
  listItem,
  NO_RECIPES_TEXT,
  openList,
  openRecipes,
  recipeLink,
  saveRecipeForm,
  openSignedIn,
} from "../support/e2e-ui";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  joinHousehold,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// Milestone 10: two members in two browser contexts write, edit and remove
// recipes and see each other's changes live, and a recipe's ingredients go
// onto the shared shopping list. Reconnecting is not tested again here:
// recipes use the same resync as the lists (realtime-sync.e2e.ts).

/**
 * Instructions long enough, and random enough, that Postgres stores them out
 * of line. An edit that doesn't change them then reaches the other member
 * without them (see RecipeChange), which is what the rename below relies on.
 */
const LONG_INSTRUCTIONS = [
  "Mix everything.",
  ...Array.from({ length: 300 }, () => randomUUID()),
  "Fry until golden.",
].join("\n");

function recipeHeading(page: Page, title: string) {
  return page.getByRole("heading", { level: 2, name: title, exact: true });
}

test.describe("shared recipes", () => {
  let userA: TestUser;
  let userB: TestUser;
  let outsider: TestUser;
  let householdId: string;
  let otherHouseholdId: string;
  let otherRecipeId: string;

  test.beforeAll(async () => {
    [userA, userB, outsider] = await Promise.all([
      createTestUser("e2e-recipes-a"),
      createTestUser("e2e-recipes-b"),
      createTestUser("e2e-recipes-c"),
    ]);
    householdId = await createHousehold(userA.client, `E2E recipes ${runId}`);
    await joinHousehold(userA, userB, householdId);

    otherHouseholdId = await createHousehold(
      outsider.client,
      `E2E other recipes ${runId}`,
    );
    const { data: recipe, error } = await outsider.client
      .from("recipes")
      .insert({
        household_id: otherHouseholdId,
        title: "Somebody else's soup",
        created_by: outsider.userId,
      })
      .select("id")
      .single();
    if (error || !recipe) throw error ?? new Error("recipe insert failed");
    otherRecipeId = recipe.id as string;
  });

  test.afterAll(async () => {
    await deleteTestData(
      [householdId, otherHouseholdId],
      [userA, userB, outsider],
    );
  });

  test("recipes, their edits and removals appear live on the other member, and ingredients go onto the shopping list", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    for (const [page, user] of [
      [pageA, userA],
      [pageB, userB],
    ] as const) {
      await openSignedIn(page, user);
      await openRecipes(page);
      await expect(page.getByText(NO_RECIPES_TEXT)).toBeVisible();
    }

    await test.step("a recipe written by A appears in B's list", async () => {
      await pageA.getByRole("link", { name: "New recipe" }).click();
      await fillRecipeForm(pageA, {
        title: "Pancakes",
        servings: "4",
        ingredients: [["Flour", "250 g"], ["Eggs", "3"], ["Salt"]],
        instructions: "Mix.\nFry.",
      });
      await saveRecipeForm(pageA);
      await expect(recipeHeading(pageA, "Pancakes")).toBeVisible();

      await expect(recipeLink(pageB, "Pancakes")).toBeVisible();
      // Once on A too: the Realtime echo of A's own recipe is deduplicated.
      await pageA.getByRole("link", { name: "All recipes" }).click();
      await expect(recipeLink(pageA, "Pancakes")).toHaveCount(1);
    });

    await test.step("B reads the recipe as A wrote it", async () => {
      await recipeLink(pageB, "Pancakes").click();
      await expect(recipeHeading(pageB, "Pancakes")).toBeVisible();
      await expect(pageB).toHaveTitle("Pancakes · Klankern");
      await expect(pageB.getByText("Servings: 4")).toBeVisible();
      for (const name of ["Flour (250 g)", "Eggs (3)", "Salt"])
        await expect(listItem(pageB, name)).toBeChecked();
      // The line break between the two steps is kept.
      await expect(pageB.getByText("Mix.\nFry.")).toBeVisible();
    });

    await test.step("an edit by A changes the recipe B has open", async () => {
      await recipeLink(pageA, "Pancakes").click();
      await pageA.getByRole("link", { name: "Edit" }).click();
      await expect(pageA.getByLabel("Title")).toHaveValue("Pancakes");
      await expect(
        ingredientRow(pageA, 3).getByLabel("Ingredient", { exact: true }),
      ).toHaveValue("Salt");
      await pageA.getByRole("button", { name: "Remove ingredient 3" }).click();
      await fillRecipeForm(pageA, {
        title: "Crêpes",
        instructions: LONG_INSTRUCTIONS,
      });
      await saveRecipeForm(pageA);

      await expect(recipeHeading(pageB, "Crêpes")).toBeVisible();
      await expect(listItem(pageB, "Salt")).toHaveCount(0);
      await expect(listItem(pageB, "Eggs (3)")).toBeVisible();
      await expect(pageB.getByText("Fry until golden.")).toBeVisible();
    });

    await test.step("a rename alone leaves B the ingredients and the long instructions", async () => {
      await pageA.getByRole("link", { name: "Edit" }).click();
      await fillRecipeForm(pageA, { title: "Thin pancakes" });
      await saveRecipeForm(pageA);

      await expect(recipeHeading(pageB, "Thin pancakes")).toBeVisible();
      await expect(listItem(pageB, "Flour (250 g)")).toBeVisible();
      await expect(pageB.getByText("Fry until golden.")).toBeVisible();
    });

    await test.step("the recipe's own address loads it", async () => {
      await pageB.reload();
      await expect(recipeHeading(pageB, "Thin pancakes")).toBeVisible();
      await expect(listItem(pageB, "Flour (250 g)")).toBeChecked();
      await expect(pageB.getByText("Fry until golden.")).toBeVisible();
    });

    await test.step("the ingredients B leaves ticked appear on A's shopping list", async () => {
      await pageA.getByRole("link", { name: "Klankern" }).click();
      await openList(pageA, "Shopping");

      await listItem(pageB, "Eggs (3)").click();
      await pageB.getByRole("button", { name: "Add to shopping list" }).click();
      await expect(
        pageB.getByText("1 item added to the shopping list"),
      ).toBeVisible();

      await expect(listItem(pageA, "Flour (250 g)")).not.toBeChecked();
      await expect(listItem(pageA, "Eggs (3)")).toHaveCount(0);
    });

    await test.step("a removal by A takes B off the recipe's form", async () => {
      await pageB.getByRole("link", { name: "Edit" }).click();
      await expect(pageB.getByLabel("Title")).toHaveValue("Thin pancakes");

      await pageA.getByRole("link", { name: "Klankern" }).click();
      await openRecipes(pageA);
      await recipeLink(pageA, "Thin pancakes").click();
      await pageA.getByRole("button", { name: "Delete" }).click();
      await pageA.getByRole("button", { name: "Delete" }).last().click();
      await expect(pageA).toHaveURL(new RegExp(`${ROUTES.recipes}$`));
      await expect(pageA.getByText(NO_RECIPES_TEXT)).toBeVisible();

      await expect(pageB).toHaveURL(new RegExp(`${ROUTES.recipes}$`));
      await expect(pageB.getByText("This recipe was removed.")).toBeVisible();
      await expect(pageB.getByText(NO_RECIPES_TEXT)).toBeVisible();
    });

    await test.step("the removed recipe stays gone after a reload", async () => {
      await pageB.reload();
      await expect(pageB.getByText(NO_RECIPES_TEXT)).toBeVisible();
    });

    await contextA.close();
    await contextB.close();
  });

  test("another household's recipe and an unknown one are not found", async ({
    page,
  }) => {
    await openSignedIn(page, userB);

    for (const id of [otherRecipeId, randomUUID()]) {
      await page.goto(ROUTES.recipe(id));
      await expect(
        page.getByRole("heading", { name: "Recipe not found" }),
      ).toBeVisible();
      await expect(page.getByText("Somebody else's soup")).toHaveCount(0);

      await page.goto(ROUTES.recipeEdit(id));
      await expect(
        page.getByText("This recipe doesn't exist, or it was removed."),
      ).toBeVisible();
      await expect(page.getByLabel("Title")).toHaveCount(0);
    }
  });
});
