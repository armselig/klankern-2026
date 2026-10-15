import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { addDays, localDateOf } from "../../app/utils/local-date";
import { ROUTES } from "../../app/utils/routes";
import { TEST_IDS } from "../../app/utils/test-ids";
import {
  chooseFromMealEntryMenu,
  dashboardTile,
  dashboardTileLink,
  mealEntry,
  moveDayButton,
  moveSlotRadio,
  openSignedIn,
} from "../support/e2e-ui";
import { recipeRow, vacationJson } from "../support/rls-rows";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// The meal plan: the Tonight tile proposes, the member plans, skips and takes
// the skip back; the week page adds and removes meals with Undo, moves them,
// makes a recipe of a title and puts the ingredients on the shopping list;
// a trip's page leads to the plan of its days.

/** Does what writes a plan entry and waits until the server has answered.
 * The plan updates optimistically, so the page alone doesn't show when a
 * write is done, and a reload cancels a write still in flight. */
async function untilPlanSaved(
  page: Page,
  method: "POST" | "PATCH",
  action: () => Promise<void>,
) {
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/meal_plan_entries") &&
      response.request().method() === method,
  );
  await action();
  expect((await saved).ok()).toBe(true);
}

/**
 * Yesterday at the given hour on the device, for Playwright's clock. The
 * moment has to lie in the past: the session's token expires an hour after
 * the real time, and the app checks that against the browser's clock
 * (`getClaims`), so a clock pinned further ahead signs the member out. On CI
 * the device is in UTC, and "today at 12:30" was hours ahead of a morning run.
 */
function yesterdayAt(hour: number): Date {
  const moment = new Date();
  moment.setDate(moment.getDate() - 1);
  moment.setHours(hour, 30, 0, 0);
  return moment;
}

function tonight(page: Page) {
  const tile = dashboardTile(page, "tonight");
  return {
    headline: tile.getByTestId(TEST_IDS.tonight.headline),
    secondary: tile.getByTestId(TEST_IDS.tonight.secondary),
    button: (id: keyof typeof TEST_IDS.tonight) =>
      tile.getByTestId(TEST_IDS.tonight[id]),
  };
}

test.describe("the meal plan", () => {
  let user: TestUser;
  let householdId: string;
  const recipeIds: Record<string, string> = {};

  test.beforeAll(async () => {
    user = await createTestUser("e2e-meals");
    householdId = await createHousehold(user.client, `E2E meals ${runId}`);
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
    await deleteTestData([householdId], [user]);
  });

  test("the Tonight tile proposes, plans, skips and switches to tomorrow", async ({
    page,
  }) => {
    await page.clock.setFixedTime(yesterdayAt(12));
    await openSignedIn(page, user);
    const tile = tonight(page);

    await test.step("it proposes the recipes in order, never cooked by title", async () => {
      await expect(dashboardTileLink(page, "tonight")).toHaveText("Tonight");
      await expect(tile.headline).toHaveText("Curry");
      await expect(tile.secondary).toHaveText("not in 8 weeks · 1 of 2");
      await tile.button("another").click();
      await expect(tile.headline).toHaveText("Pasta");
      await expect(tile.secondary).toHaveText("not in 8 weeks · 2 of 2");
    });

    await test.step("Plan this plans the proposal for tonight", async () => {
      await untilPlanSaved(page, "POST", () => tile.button("planThis").click());
      await expect(tile.headline).toHaveText("Pasta");
      await expect(tile.secondary).toHaveText("Planned");
    });

    await test.step("a skipped dinner can be taken back", async () => {
      await untilPlanSaved(page, "PATCH", () => tile.button("skip").click());
      await expect(tile.secondary).toHaveText("Skipped. Plan something else?");
      await untilPlanSaved(page, "PATCH", () =>
        tile.button("undoSkip").click(),
      );
      await expect(tile.secondary).toHaveText("Planned");
    });

    await test.step("from 17:00 the tile is about tomorrow", async () => {
      await page.clock.setFixedTime(yesterdayAt(17));
      await page.reload();
      await expect(dashboardTileLink(page, "tonight")).toHaveText("Tomorrow");
      // Tonight's Pasta counts as cooked, so the one not cooked comes first.
      await expect(tile.headline).toHaveText("Curry");
      await expect(tile.button("skip")).toHaveCount(0);
    });

    await test.step("the tile leads to the plan", async () => {
      await dashboardTileLink(page, "tonight").click();
      await expect(page).toHaveURL(ROUTES.meals);
      await expect(page.getByTestId(TEST_IDS.meals.entry)).toHaveText(/Pasta/);
    });
  });

  test("the week page adds a dinner as text and removes it with Undo", async ({
    page,
  }) => {
    await page.clock.setFixedTime(yesterdayAt(12));
    await openSignedIn(page, user);
    await page.goto(ROUTES.meals);
    const today = page
      .getByTestId(TEST_IDS.meals.day)
      .filter({ hasText: "Today" });
    const toast = mealEntry(page, "Toast");

    await test.step("a dinner is added as text", async () => {
      await today.getByTestId(TEST_IDS.meals.add).click();
      await page.getByTestId(TEST_IDS.meals.dialog.input).fill("Toast");
      await untilPlanSaved(page, "POST", () =>
        page.getByTestId(TEST_IDS.meals.dialog.addText).click(),
      );
      await expect(toast).toBeVisible();
    });

    await test.step("Undo takes a removal back before it is sent", async () => {
      await chooseFromMealEntryMenu(page, "Toast", "remove");
      await expect(toast).toHaveCount(0);
      await page.getByTestId(TEST_IDS.meals.undoRemoval).click();
      await expect(toast).toBeVisible();
    });

    await test.step("a removal is sent once the notice is gone", async () => {
      await untilPlanSaved(page, "PATCH", () =>
        chooseFromMealEntryMenu(page, "Toast", "remove"),
      );
      await page.reload();
      await expect(page.getByTestId(TEST_IDS.meals.day).first()).toBeVisible();
      await expect(toast).toHaveCount(0);
    });
  });

  test("a day that is not a Monday opens its week", async ({ page }) => {
    const now = yesterdayAt(12);
    await page.clock.setFixedTime(now);
    await openSignedIn(page, user);
    const day = localDateOf(now);
    await page.goto(`${ROUTES.meals}?week=${day}`);
    await expect(page.getByTestId(TEST_IDS.meals.day)).toHaveCount(7);
    await expect(
      page.getByTestId(TEST_IDS.meals.day).filter({ hasText: "Today" }),
    ).toHaveCount(1);
  });

  test("an entry moves to another day and slot, and its title becomes a recipe", async ({
    page,
  }) => {
    const now = yesterdayAt(12);
    await page.clock.setFixedTime(now);
    await openSignedIn(page, user);
    const tomorrow = addDays(localDateOf(now), 1);
    await page.goto(ROUTES.meals);
    const lasagne = mealEntry(page, "Lasagne");

    await test.step("a dinner is added as text", async () => {
      await page
        .getByTestId(TEST_IDS.meals.day)
        .filter({ hasText: "Today" })
        .getByTestId(TEST_IDS.meals.add)
        .click();
      await page.getByTestId(TEST_IDS.meals.dialog.input).fill("Lasagne");
      await untilPlanSaved(page, "POST", () =>
        page.getByTestId(TEST_IDS.meals.dialog.addText).click(),
      );
      await expect(lasagne).toBeVisible();
    });

    await test.step("closing the move dialog gives the focus back", async () => {
      await chooseFromMealEntryMenu(page, "Lasagne", "move");
      await page.getByRole("dialog").press("Escape");
      await expect(lasagne.getByTestId(TEST_IDS.meals.entryMore)).toBeFocused();
    });

    await test.step("it moves to tomorrow's lunch", async () => {
      await chooseFromMealEntryMenu(page, "Lasagne", "move");
      await moveSlotRadio(page, "lunch").click();
      await untilPlanSaved(page, "PATCH", () => moveDayButton(page, 1).click());
      // Tomorrow may be in the next week.
      await page.goto(`${ROUTES.meals}?week=${tomorrow}`);
      await expect(
        page
          .getByTestId(TEST_IDS.meals.slot)
          .filter({ has: lasagne })
          .getByTestId(TEST_IDS.meals.slotHeading),
      ).toHaveText("Lunch");
    });

    await test.step("a recipe made of it takes the title's place", async () => {
      await chooseFromMealEntryMenu(page, "Lasagne", "makeRecipe");
      await expect(page.getByTestId(TEST_IDS.recipe.form.title)).toHaveValue(
        "Lasagne",
      );
      await untilPlanSaved(page, "PATCH", () =>
        page.getByTestId(TEST_IDS.recipe.form.save).click(),
      );
      await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);
      await page.goto(`${ROUTES.meals}?week=${tomorrow}`);
      await expect(
        lasagne.getByTestId(TEST_IDS.meals.entryRecipeLink),
      ).toHaveText("Lasagne");
    });
  });

  test("the plan's ingredients go on the shopping list", async ({ page }) => {
    const now = yesterdayAt(12);
    await page.clock.setFixedTime(now);
    // Two weeks ahead, so no other test's entries are in the week.
    const day = addDays(localDateOf(now), 14);
    const { error } = await user.client.from("meal_plan_entries").insert([
      {
        household_id: householdId,
        date: day,
        slot: "dinner",
        recipe_id: recipeIds.Pasta,
        position: 1,
        created_by: user.userId,
      },
      {
        household_id: householdId,
        date: day,
        slot: "dinner",
        title: "Toast",
        position: 2,
        created_by: user.userId,
      },
    ]);
    if (error) throw error;
    await openSignedIn(page, user);
    await page.goto(`${ROUTES.meals}?week=${day}`);

    const button = page.getByTestId(TEST_IDS.meals.putOnList);
    await expect(button).toHaveText("Put 2 ingredients on the shopping list");
    await untilPlanSaved(page, "PATCH", () => button.click());
    await expect(page.getByTestId(TEST_IDS.meals.putOnListNotice)).toHaveText(
      "2 items added to the shopping list. Left out: 1 without a recipe",
    );
    await expect(button).toHaveCount(0);
  });

  test("a trip's page leads to the plan of the trip's days", async ({
    page,
  }) => {
    const now = yesterdayAt(12);
    await page.clock.setFixedTime(now);
    const start = addDays(localDateOf(now), 30);
    const vacation = {
      ...vacationJson(householdId),
      starts_on: start,
      ends_on: addDays(start, 2),
    };
    const { error } = await user.client.rpc("create_vacation", {
      p_vacation: vacation,
      p_tasks: [],
    });
    if (error) throw error;
    await openSignedIn(page, user);
    await page.goto(ROUTES.vacation(vacation.id));

    const link = page.getByTestId(TEST_IDS.vacation.meals.link);
    await expect(link).toContainText("No dinners planned");
    await link.click();
    await expect(page).toHaveURL(ROUTES.tripMeals(vacation.id));
    await expect(page.getByTestId(TEST_IDS.meals.trip.heading)).toContainText(
      "Trip to Denmark",
    );
    await expect(page.getByTestId(TEST_IDS.meals.day)).toHaveCount(3);

    await page.getByTestId(TEST_IDS.meals.add).first().click();
    await page.getByTestId(TEST_IDS.meals.dialog.input).fill("Pølser");
    await untilPlanSaved(page, "POST", () =>
      page.getByTestId(TEST_IDS.meals.dialog.addText).click(),
    );
    await page.goto(ROUTES.vacation(vacation.id));
    await expect(link).toContainText("1 dinner planned");
  });

  test("a trip that can't be loaded says so", async ({ page }) => {
    await page.clock.setFixedTime(yesterdayAt(12));
    await openSignedIn(page, user);
    await page.route("**/rest/v1/vacations?**", (route) => route.abort());
    await page.goto(ROUTES.tripMeals(randomUUID()));
    await expect(page.getByTestId(TEST_IDS.meals.failure)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.meals.loading)).toHaveCount(0);
  });
});
