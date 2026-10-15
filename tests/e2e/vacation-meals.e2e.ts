import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { addDays, localDateOf } from "../../app/utils/local-date";
import { ROUTES } from "../../app/utils/routes";
import { TEST_IDS } from "../../app/utils/test-ids";

import {
  headerKindRadio,
  mealRow,
  mealRows,
  openSignedIn,
  pickMealButton,
} from "../support/e2e-ui";
import { ingredient, recipeRow } from "../support/rls-rows";
import {
  admin,
  createHousehold,
  createTestUser,
  deleteTestData,
  joinHousehold,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// Slice 3 of the vacation planner: two members plan a trip's meals, put the
// ingredients on the shopping list and change the kind of stay.

test.describe("a trip's meals, for two members", () => {
  let userA: TestUser;
  let userB: TestUser;
  let householdId: string;
  let vacationId: string;
  let soupId: string;

  const soup = "Lentil soup";
  const pancakes = "Pancakes";

  test.beforeAll(async () => {
    [userA, userB] = await Promise.all([
      createTestUser("e2e-meals-a"),
      createTestUser("e2e-meals-b"),
    ]);
    householdId = await createHousehold(userA.client, `E2E meals ${runId}`);
    await joinHousehold(userA, userB, householdId);

    const today = localDateOf(new Date());
    vacationId = randomUUID();
    const created = await userA.client.rpc("create_vacation", {
      p_vacation: {
        id: vacationId,
        household_id: householdId,
        title: "Denmark",
        kind: "house",
        starts_on: addDays(today, 10),
        ends_on: addDays(today, 17),
      },
      p_tasks: [],
    });
    if (created.error) throw created.error;

    const recipes = await userA.client
      .from("recipes")
      .insert([
        {
          ...recipeRow(userA, householdId),
          title: soup,
          ingredients: [
            ingredient(1, "Lentils", "500 g"),
            ingredient(2, "Stock"),
          ],
        },
        {
          ...recipeRow(userA, householdId),
          title: pancakes,
          ingredients: [
            ingredient(1, "Flour"),
            ingredient(2, "Eggs"),
            ingredient(3, "Milk"),
          ],
        },
      ])
      .select("id, title");
    if (recipes.error) throw recipes.error;
    soupId = recipes.data.find((recipe) => recipe.title === soup)!.id;
  });

  test.afterAll(async () => {
    await deleteTestData([householdId], [userA, userB]);
  });

  test("meals are picked in a dialog, put on the shopping list and removed, and the kind is changed", async ({
    browser,
  }) => {
    const pageA = await (await browser.newContext()).newPage();
    const pageB = await (await browser.newContext()).newPage();
    await openSignedIn(pageA, userA);
    await openSignedIn(pageB, userB);

    const meals = TEST_IDS.vacation.meals;
    const link = pageA.getByTestId(meals.link);

    await test.step("the trip's page links to its meals, and the page says how to start", async () => {
      await pageA.goto(ROUTES.vacation(vacationId));
      await expect(link).toContainText("No meals yet");
      await link.click();
      await expect(pageA).toHaveURL(ROUTES.vacationMeals(vacationId));
      await expect(pageA.getByTestId(meals.noMeals)).toBeVisible();
      await pageB.goto(ROUTES.vacationMeals(vacationId));
      await expect(pageB.getByTestId(meals.noMeals)).toBeVisible();
    });

    await test.step("A picks recipes in a dialog that stays open, the same recipe twice", async () => {
      await pageA.getByTestId(meals.add).click();
      const search = pageA.getByTestId(meals.dialog.search);
      await search.fill("lent");
      await expect(pageA.getByTestId(meals.dialog.recipe)).toHaveCount(1);
      await pickMealButton(pageA, soup).click();
      await expect(pageA.getByTestId(meals.dialog.status)).toHaveText(
        `Added: ${soup} (1 in the plan)`,
      );
      await pickMealButton(pageA, soup).click();
      await expect(pageA.getByTestId(meals.dialog.status)).toHaveText(
        `Added: ${soup} (2 in the plan)`,
      );

      await search.fill("no such recipe");
      await expect(pageA.getByTestId(meals.dialog.noMatch)).toBeVisible();
      await search.fill("");
      await pickMealButton(pageA, pancakes).click();
      await pageA.getByTestId(meals.dialog.done).click();

      await expect(mealRows(pageA)).toHaveCount(3);
      await expect(mealRow(pageA, soup)).toHaveCount(2);
    });

    await test.step("B sees the meals at once, and the button counts the ingredients", async () => {
      await expect(mealRows(pageB)).toHaveCount(3);
      await expect(pageB.getByTestId(meals.summary)).toHaveText(
        "3 meals, 3 not on the shopping list",
      );
      await expect(pageB.getByTestId(meals.putOnList)).toContainText(
        "Put 7 ingredients on the shopping list",
      );
    });

    await test.step("B puts the ingredients on the shopping list, and A sees every meal marked", async () => {
      await pageB.getByTestId(meals.putOnList).click();
      await expect(pageB.getByTestId(meals.addedNotice)).toBeVisible();
      await expect(pageB.getByTestId(meals.allOnList)).toBeVisible();
      await expect(pageB.getByTestId(meals.onList)).toHaveCount(3);

      await expect(pageA.getByTestId(meals.onList)).toHaveCount(3);
      await expect(pageA.getByTestId(meals.putOnList)).toHaveCount(0);

      const { data: items, error } = await admin
        .from("shopping_items")
        .select("title")
        .eq("household_id", householdId)
        .is("deleted_at", null);
      expect(error).toBeNull();
      expect(items).toHaveLength(7);
    });

    await test.step("a meal added later is the only one the button counts", async () => {
      await pageA.getByTestId(meals.add).click();
      await pickMealButton(pageA, pancakes).click();
      await pageA.getByTestId(meals.dialog.done).click();
      await expect(pageA.getByTestId(meals.putOnList)).toContainText(
        "Put 3 ingredients on the shopping list",
      );
      await expect(pageA.getByTestId(meals.summary)).toHaveText(
        "4 meals, 1 not on the shopping list",
      );
    });

    await test.step("a meal that is not on the list goes at once, one that is asks first", async () => {
      await mealRows(pageA)
        .filter({ hasNot: pageA.getByTestId(meals.onList) })
        .getByTestId(meals.remove)
        .click();
      await expect(mealRows(pageA)).toHaveCount(3);

      await mealRow(pageA, pancakes).first().getByTestId(meals.remove).click();
      await expect(mealRows(pageA)).toHaveCount(3);
      await pageA.getByTestId(TEST_IDS.confirmDialog.ok).click();
      await expect(mealRows(pageA)).toHaveCount(2);
      await expect(mealRows(pageB)).toHaveCount(2);
    });

    await test.step("a removed recipe is said to be removed", async () => {
      const removal = await userA.client
        .from("recipes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", soupId);
      expect(removal.error).toBeNull();
      await expect(pageA.getByTestId(meals.removedRecipe)).toHaveCount(2);
    });

    await test.step("the kind of stay is changed from the trip's header", async () => {
      await pageA.goto(ROUTES.vacation(vacationId));
      await pageA.getByTestId(TEST_IDS.vacation.header.edit).click();
      await headerKindRadio(pageA, "hotel").click();
      await pageA.getByTestId(TEST_IDS.vacation.header.save).click();
      await expect(
        pageA.getByTestId(TEST_IDS.vacation.header.summary),
      ).toContainText("Hotel");
      await expect(link).toContainText("2 meals");
    });
  });
});
