import { expect, test, type Page } from "@playwright/test";
import { localDateOf } from "../../app/utils/local-date";
import { ROUTES } from "../../app/utils/routes";
import { TEST_IDS } from "../../app/utils/test-ids";
import {
  dashboardTile,
  dashboardTileLink,
  openSignedIn,
} from "../support/e2e-ui";
import { recipeRow } from "../support/rls-rows";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// The meal plan: the Tonight tile proposes, the member plans, skips and takes
// the skip back, and the week page adds and removes dinners with Undo.

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

/** Today at the given hour on the device, for Playwright's clock. */
function todayAt(hour: number): Date {
  const moment = new Date();
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

  test.beforeAll(async () => {
    user = await createTestUser("e2e-meals");
    householdId = await createHousehold(user.client, `E2E meals ${runId}`);
    for (const title of ["Pasta", "Curry"]) {
      const { error } = await user.client
        .from("recipes")
        .insert({ ...recipeRow(user, householdId), title });
      if (error) throw error;
    }
  });

  test.afterAll(async () => {
    await deleteTestData([householdId], [user]);
  });

  test("the Tonight tile proposes, plans, skips and switches to tomorrow", async ({
    page,
  }) => {
    await page.clock.setFixedTime(todayAt(12));
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
      await page.clock.setFixedTime(todayAt(17));
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
    await page.clock.setFixedTime(todayAt(12));
    await openSignedIn(page, user);
    await page.goto(ROUTES.meals);
    const today = page
      .getByTestId(TEST_IDS.meals.day)
      .filter({ hasText: "Today" });
    const toast = page
      .getByTestId(TEST_IDS.meals.entry)
      .filter({ hasText: "Toast" });

    await test.step("a dinner is added as text", async () => {
      await today.getByTestId(TEST_IDS.meals.add).click();
      await page.getByTestId(TEST_IDS.meals.dialog.input).fill("Toast");
      await untilPlanSaved(page, "POST", () =>
        page.getByTestId(TEST_IDS.meals.dialog.addText).click(),
      );
      await expect(toast).toBeVisible();
    });

    await test.step("Undo takes a removal back before it is sent", async () => {
      await toast.getByTestId(TEST_IDS.meals.entryRemove).click();
      await expect(toast).toHaveCount(0);
      await page.getByTestId(TEST_IDS.meals.undoRemoval).click();
      await expect(toast).toBeVisible();
    });

    await test.step("a removal is sent once the notice is gone", async () => {
      await untilPlanSaved(page, "PATCH", () =>
        toast.getByTestId(TEST_IDS.meals.entryRemove).click(),
      );
      await page.reload();
      await expect(page.getByTestId(TEST_IDS.meals.day).first()).toBeVisible();
      await expect(toast).toHaveCount(0);
    });
  });

  test("a day that is not a Monday opens its week", async ({ page }) => {
    await page.clock.setFixedTime(todayAt(12));
    await openSignedIn(page, user);
    const day = localDateOf(new Date());
    await page.goto(`${ROUTES.meals}?week=${day}`);
    await expect(page.getByTestId(TEST_IDS.meals.day)).toHaveCount(7);
    await expect(
      page.getByTestId(TEST_IDS.meals.day).filter({ hasText: "Today" }),
    ).toHaveCount(1);
  });
});
