import { expect, test } from "@playwright/test";
import { addDays, localDateOf } from "../../app/utils/local-date";
import { ROUTES } from "../../app/utils/routes";
import { TEST_IDS } from "../../app/utils/test-ids";
import { mealEntry, openSignedIn } from "../support/e2e-ui";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// The week at a glance: the days before yesterday fold away, and a day's
// date adds any meal, with the slot chosen in the dialog.

/**
 * The last Thursday before today at noon, for Playwright's clock: a day on
 * which Monday and Tuesday fold, whatever day the test runs on. It lies in
 * the past, as the clock has to (see yesterdayAt in meal-plan.e2e.ts).
 */
function lastThursdayNoon(): Date {
  const moment = new Date();
  const sinceThursday = (moment.getDay() + 3) % 7;
  moment.setDate(moment.getDate() - (sinceThursday || 7));
  moment.setHours(12, 0, 0, 0);
  return moment;
}

test.describe("The week at a glance", () => {
  let user: TestUser;
  let householdId: string;
  const clock = lastThursdayNoon();
  const thursday = localDateOf(clock);

  test.beforeAll(async () => {
    user = await createTestUser("e2e-week");
    householdId = await createHousehold(user.client, `E2E week ${runId}`);
    const { error } = await user.client.from("meal_plan_entries").insert({
      household_id: householdId,
      date: addDays(thursday, -3),
      slot: "dinner",
      title: "Monday soup",
      created_by: user.userId,
    });
    if (error) throw error;
  });

  test.afterAll(async () => {
    await deleteTestData([householdId], [user]);
  });

  test("folds the earlier days and adds a lunch from a day's date", async ({
    page,
  }) => {
    await page.clock.setFixedTime(clock);
    await openSignedIn(page, user);
    await page.goto(ROUTES.meals);
    const earlier = page.getByTestId(TEST_IDS.meals.earlier);
    const mondaySoup = mealEntry(page, "Monday soup");

    await test.step("Monday and Tuesday are folded", async () => {
      await expect(earlier).toHaveText("Earlier this week · Mon to Tue");
      await expect(earlier).toHaveAttribute("aria-expanded", "false");
      await expect(mondaySoup).toBeHidden();
      await earlier.click();
      await expect(earlier).toHaveAttribute("aria-expanded", "true");
      await expect(mondaySoup).toBeVisible();
    });

    await test.step("the date adds a lunch", async () => {
      const today = page
        .getByTestId(TEST_IDS.meals.day)
        .filter({ hasText: "Today" });
      await today.getByTestId(TEST_IDS.meals.addToDay).click();
      const lunch = page
        .getByTestId(TEST_IDS.meals.dialog.slot)
        .and(page.locator('[value="lunch"]'));
      await lunch.check();
      await page.getByTestId(TEST_IDS.meals.dialog.input).fill("Sandwiches");
      const saved = page.waitForResponse(
        (response) =>
          response.url().includes("/rest/v1/meal_plan_entries") &&
          response.request().method() === "POST",
      );
      await page.getByTestId(TEST_IDS.meals.dialog.addText).click();
      expect((await saved).ok()).toBe(true);
      const sandwiches = today
        .getByTestId(TEST_IDS.meals.entry)
        .filter({ hasText: "Sandwiches" });
      await expect(sandwiches.getByTestId(TEST_IDS.meals.entrySlot)).toHaveText(
        "Lunch",
      );
      // The dinner is still open.
      await expect(today.getByTestId(TEST_IDS.meals.add)).toBeVisible();
    });
  });
});
