import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { addDays, localDateOf } from "../../app/utils/local-date";
import { ROUTES } from "../../app/utils/routes";
import { TEST_IDS } from "../../app/utils/test-ids";
import {
  chooseFromMealEntryMenu,
  dashboardTile,
  kidOnRoster,
  mealEntry,
  openSignedIn,
  reactionRadio,
} from "../support/e2e-ui";
import { recipeRow } from "../support/rls-rows";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// The kids (meal planner, slice 2): a child is added and renamed on the
// dashboard; what a child made of a dinner is recorded from the entry's
// menu and shows under the entry and on /kids; a recipe a child refused
// twice is proposed last by the Tonight tile, which says so.

/** Does what writes to a table and waits until the server has answered:
 * the writes are optimistic, so the page alone doesn't show when one is
 * done, and a reload cancels a write still in flight. */
async function untilWritten(
  page: Page,
  table: string,
  method: "POST" | "PATCH",
  action: () => Promise<void>,
) {
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes(`/rest/v1/${table}`) &&
      response.request().method() === method,
  );
  await action();
  expect((await saved).ok()).toBe(true);
}

test.describe("the kids", () => {
  const today = localDateOf(new Date());
  /** Each test's own member and household, so that one test's dinners
   * don't change the order the other expects. */
  const households: { user: TestUser; householdId: string }[] = [];
  let user: TestUser;
  let householdId: string;
  let recipeIds: Record<string, string>;

  /** A dinner of a recipe on a day, written as the app writes one. */
  async function planDinner(title: string, date: string): Promise<string> {
    const id = randomUUID();
    const { error } = await user.client.from("meal_plan_entries").insert({
      id,
      household_id: householdId,
      date,
      slot: "dinner",
      recipe_id: recipeIds[title]!,
      created_by: user.userId,
    });
    if (error) throw error;
    return id;
  }

  test.beforeEach(async () => {
    user = await createTestUser(`e2e-kids-${households.length + 1}`);
    householdId = await createHousehold(user.client, `E2E kids ${runId}`);
    households.push({ user, householdId });
    recipeIds = {};
    for (const title of ["Pasta", "Curry"]) {
      const { data, error } = await user.client
        .from("recipes")
        .insert({ ...recipeRow(user, householdId), title })
        .select("id")
        .single();
      if (error) throw error;
      recipeIds[title] = data.id;
    }
  });

  test.afterAll(async () => {
    await deleteTestData(
      households.map(({ householdId }) => householdId),
      households.map(({ user }) => user),
    );
  });

  test("a child is added, renamed, and what they refused is recorded and counted", async ({
    page,
  }) => {
    await planDinner("Curry", addDays(today, -1));
    await openSignedIn(page, user);

    await test.step("a child is added on the dashboard", async () => {
      await page.getByTestId(TEST_IDS.kids.addButton).click();
      await page.getByTestId(TEST_IDS.kids.nameDialog.input).fill("Mia");
      await untilWritten(page, "household_children", "POST", () =>
        page.getByTestId(TEST_IDS.kids.nameDialog.save).click(),
      );
      await expect(kidOnRoster(page, "Mia")).toBeVisible();
    });

    await test.step("the child is renamed", async () => {
      await kidOnRoster(page, "Mia")
        .getByTestId(TEST_IDS.kids.childButton)
        .click();
      await page.getByTestId(TEST_IDS.kids.childMenu.rename).click();
      await page.getByTestId(TEST_IDS.kids.nameDialog.input).fill("Mila");
      await untilWritten(page, "household_children", "PATCH", () =>
        page.getByTestId(TEST_IDS.kids.nameDialog.save).click(),
      );
      await expect(kidOnRoster(page, "Mila")).toBeVisible();
      await expect(kidOnRoster(page, "Mia")).toHaveCount(0);
    });

    await test.step("a refusal is recorded from the dinner's menu", async () => {
      await page.goto(ROUTES.meals);
      await chooseFromMealEntryMenu(page, "Curry", "reactions");
      await expect(
        page.getByTestId(TEST_IDS.meals.reactionDialog.title),
      ).toHaveText("How did the kids eat Curry?");
      await expect(reactionRadio(page, "Mila", "ate")).toBeChecked();
      await reactionRadio(page, "Mila", "refused").click();
      await untilWritten(page, "meal_reactions", "POST", () =>
        page.getByTestId(TEST_IDS.meals.reactionDialog.save).click(),
      );
      await expect(
        mealEntry(page, "Curry").getByTestId(TEST_IDS.meals.entryReactionNote),
      ).toHaveText("Refused: Mila");
    });

    await test.step("the record on /kids counts it, and survives a reload", async () => {
      await page.goto(ROUTES.kids);
      const record = page.getByTestId(TEST_IDS.kids.page.record);
      await expect(record).toContainText("Mila");
      await expect(record.getByTestId(TEST_IDS.kids.page.refused)).toHaveText(
        /Curry\s*, once/,
      );
    });

    await test.step("taking it back leaves no line under the dinner", async () => {
      await page.goto(ROUTES.meals);
      await chooseFromMealEntryMenu(page, "Curry", "reactions");
      await expect(reactionRadio(page, "Mila", "refused")).toBeChecked();
      await reactionRadio(page, "Mila", "ate").click();
      await untilWritten(page, "meal_reactions", "PATCH", () =>
        page.getByTestId(TEST_IDS.meals.reactionDialog.save).click(),
      );
      await expect(
        mealEntry(page, "Curry").getByTestId(TEST_IDS.meals.entryReactionNote),
      ).toHaveCount(0);
    });
  });

  test("a recipe refused twice is proposed last, and the tile says why", async ({
    page,
  }) => {
    const { data: child, error } = await user.client
      .from("household_children")
      .insert({
        household_id: householdId,
        name: "Jo",
        created_by: user.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    // Without the refusals Curry, cooked longest ago, would come first.
    await planDinner("Pasta", addDays(today, -3));
    for (const daysAgo of [-10, -20]) {
      const entryId = await planDinner("Curry", addDays(today, daysAgo));
      const { error: reactionError } = await user.client
        .from("meal_reactions")
        .insert({
          household_id: householdId,
          entry_id: entryId,
          child_id: child.id,
          reaction: "refused",
          created_by: user.userId,
        });
      if (reactionError) throw reactionError;
    }

    await openSignedIn(page, user);
    const tile = dashboardTile(page, "tonight");
    // Nothing is planned for today or tomorrow, so the tile proposes,
    // before 17:00 and after.
    const headline = tile.getByTestId(TEST_IDS.tonight.headline);
    const refusal = tile.getByTestId(TEST_IDS.tonight.refusal);
    await expect(headline).toHaveText("Pasta");
    await expect(refusal).toHaveCount(0);
    await tile.getByTestId(TEST_IDS.tonight.another).click();
    await expect(headline).toHaveText("Curry");
    await expect(refusal).toHaveText("Refused twice by Jo");
  });
});
