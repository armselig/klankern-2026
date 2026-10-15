// Regression: ISSUE-001 — the focus after "Mark as cooked" (QA suspected it
// lost; it is on the entry's button, see below)
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/qa-report-localhost-2026-10-15.md
import { expect, test } from "@playwright/test";
import { localDateOf } from "../../app/utils/local-date";
import { ROUTES } from "../../app/utils/routes";
import { TEST_IDS } from "../../app/utils/test-ids";
import {
  chooseFromMealEntryMenu,
  mealEntry,
  openSignedIn,
} from "../support/e2e-ui";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// A menu entry that leaves its row in place gives the focus back to the
// row's "More" button: the menu that held it is gone. Quasar puts it on the
// button's own focus helper (a span inside the button), as it does for every
// menu, so the test asks whether the focus is inside the button.

test.describe("the meal plan's entry menu", () => {
  let user: TestUser;
  let householdId: string;

  test.beforeAll(async () => {
    user = await createTestUser("e2e-meals-focus");
    householdId = await createHousehold(
      user.client,
      `E2E meals focus ${runId}`,
    );
    const { error } = await user.client.from("meal_plan_entries").insert({
      household_id: householdId,
      date: localDateOf(new Date()),
      slot: "dinner",
      title: "Soup",
      position: 1,
      skipped_at: new Date().toISOString(),
      created_by: user.userId,
    });
    if (error) throw error;
  });

  test.afterAll(async () => {
    await deleteTestData([householdId], [user]);
  });

  test("Mark as cooked gives the focus back to the entry", async ({ page }) => {
    await openSignedIn(page, user);
    await page.goto(ROUTES.meals);
    const soup = mealEntry(page, "Soup");
    await expect(soup).toContainText("Skipped");

    const saved = page.waitForResponse(
      (response) =>
        response.url().includes("/rest/v1/meal_plan_entries") &&
        response.request().method() === "PATCH",
    );
    await chooseFromMealEntryMenu(page, "Soup", "markCooked");
    expect((await saved).ok()).toBe(true);

    await expect(soup).not.toContainText("Skipped");
    await expect(
      soup.getByTestId(TEST_IDS.meals.entryMore).locator(":focus"),
    ).toHaveCount(1);
  });
});
