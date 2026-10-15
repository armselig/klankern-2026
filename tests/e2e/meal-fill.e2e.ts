import { expect, test } from "@playwright/test";
import { addDays, localDateOf } from "../../app/utils/local-date";
import { TEST_IDS } from "../../app/utils/test-ids";
import { dashboardTile, openSignedIn } from "../support/e2e-ui";
import { recipeRow } from "../support/rls-rows";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// "Fill my week": the Tonight tile says how many of the week's dinners are
// open and leads to the week, which proposes a dinner for each open day; a
// proposal is kept, proposed anew alone or with the rest, and planned.

/**
 * The last Monday before today at noon, for Playwright's clock: a week
 * whose every day lies ahead of the clock, so that the fill covers all of
 * them whatever day the test runs on. It lies in the past, as the clock has
 * to (see yesterdayAt in meal-plan.e2e.ts).
 */
function lastMondayNoon(): Date {
  const moment = new Date();
  const sinceMonday = (moment.getDay() + 6) % 7;
  moment.setDate(moment.getDate() - (sinceMonday || 7));
  moment.setHours(12, 0, 0, 0);
  return moment;
}

test.describe("Fill my week", () => {
  let user: TestUser;
  let householdId: string;
  const clock = lastMondayNoon();
  const monday = localDateOf(clock);

  test.beforeAll(async () => {
    user = await createTestUser("e2e-fill");
    householdId = await createHousehold(user.client, `E2E fill ${runId}`);
    const recipeIds: Record<string, string> = {};
    for (const title of ["Curry", "Pasta", "Soup"]) {
      const { data, error } = await user.client
        .from("recipes")
        .insert({ ...recipeRow(user, householdId), title })
        .select("id")
        .single();
      if (error) throw error;
      recipeIds[title] = data.id;
    }
    // Wednesday is planned already and is not proposed for.
    const { error } = await user.client.from("meal_plan_entries").insert({
      household_id: householdId,
      date: addDays(monday, 2),
      slot: "dinner",
      recipe_id: recipeIds.Pasta!,
      created_by: user.userId,
    });
    if (error) throw error;
  });

  test.afterAll(async () => {
    await deleteTestData([householdId], [user]);
  });

  test("proposes the open dinners, keeps, re-rolls and plans them", async ({
    page,
  }) => {
    await page.clock.setFixedTime(clock);
    await openSignedIn(page, user);
    const drafts = page.getByTestId(TEST_IDS.meals.draft.row);
    const draftNames = page.getByTestId(TEST_IDS.meals.draft.name);
    const choiceLine = page.getByTestId(TEST_IDS.meals.fill.choiceLine);

    await test.step("the tile counts the open dinners and leads to the fill", async () => {
      const tile = dashboardTile(page, "tonight");
      await expect(tile.getByTestId(TEST_IDS.tonight.unplanned)).toHaveText(
        "6 dinners not planned this week",
      );
      await tile.getByTestId(TEST_IDS.tonight.fillWeek).click();
      await expect(drafts).toHaveCount(6);
      // The tile's `fill` is gone from the address, so a reload doesn't
      // fill again.
      await expect(page).toHaveURL(new RegExp(`\\?week=${monday}$`));
    });

    await test.step("a small repertoire is said once", async () => {
      await expect(choiceLine).toContainText(
        "Only 3 dinners to choose from, so some come more than once.",
      );
      await page.getByTestId(TEST_IDS.meals.fill.dismissNote).click();
      await expect(choiceLine).toHaveText("Chosen from 3 dinners.");
    });

    await test.step("the dinners spread over the week", async () => {
      // Monday to Sunday without Wednesday's Pasta: each day takes the
      // recipe furthest from its other days, never cooked first, by title
      // on a tie. Seven dinners from three recipes need one a third time,
      // once every recipe has two.
      await expect(draftNames).toHaveText([
        "Curry",
        "Soup",
        "Curry",
        "Soup",
        "Pasta",
        "Curry",
      ]);
    });

    await test.step("Cancel drops the proposal, and a fill makes it again", async () => {
      await page.getByTestId(TEST_IDS.meals.fill.cancel).click();
      await expect(drafts).toHaveCount(0);
      await page.getByTestId(TEST_IDS.meals.fill.start).click();
      await expect(drafts).toHaveCount(6);
      await expect(choiceLine).toHaveText("Chosen from 3 dinners.");
    });

    await test.step("a kept dinner stays when the rest is proposed anew", async () => {
      const kept = await draftNames.first().textContent();
      const second = await draftNames.nth(1).textContent();
      const lock = drafts.first().getByTestId(TEST_IDS.meals.draft.lock);
      await lock.click();
      await expect(lock).toHaveAttribute("aria-pressed", "true");
      await expect(
        drafts.first().getByTestId(TEST_IDS.meals.draft.reroll),
      ).toBeDisabled();
      await page.getByTestId(TEST_IDS.meals.fill.rerollRest).click();
      await expect(draftNames.first()).toHaveText(kept!);
      await expect(draftNames.nth(1)).not.toHaveText(second!);
    });

    await test.step("one day is proposed anew on its own", async () => {
      const before = await draftNames.nth(2).textContent();
      await drafts.nth(2).getByTestId(TEST_IDS.meals.draft.reroll).click();
      await expect(draftNames.nth(2)).not.toHaveText(before!);
    });

    await test.step("Plan these plans every proposed dinner", async () => {
      await page.getByTestId(TEST_IDS.meals.fill.save).click();
      await expect(page.getByTestId(TEST_IDS.meals.fill.notice)).toHaveText(
        "Planned 6 dinners",
      );
      await expect(drafts).toHaveCount(0);
      await expect(page.getByTestId(TEST_IDS.meals.entry)).toHaveCount(7);
      // Nothing is open any more.
      await expect(page.getByTestId(TEST_IDS.meals.fill.start)).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId(TEST_IDS.meals.entry)).toHaveCount(7);
    });
  });
});
