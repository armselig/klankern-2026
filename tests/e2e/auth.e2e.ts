import { expect, test } from "@playwright/test";
import { ROUTES } from "../../app/utils/routes";
import { TEST_IDS } from "../../app/utils/test-ids";

import {
  accountButton,
  enterLoginCode,
  signIn,
  signOut,
  stubOtpRequest,
  waitForSessionCookie,
} from "../support/e2e-ui";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// Milestone 3: the auth guard (redirectOptions in nuxt.config.ts) and the
// login form, including its error path.

const LOGIN_URL = new RegExp(`${ROUTES.login}(\\?.*)?$`);
const PROTECTED_ROUTES = [
  ROUTES.home,
  ROUTES.todos,
  ROUTES.shopping,
  ROUTES.whiteboard,
  ROUTES.recipes,
  ROUTES.recipeNew,
  ROUTES.recipe("some-id"),
  ROUTES.recipeEdit("some-id"),
  ROUTES.vacations,
  ROUTES.vacationNew,
  ROUTES.vacation("some-id"),
];

test.describe("auth", () => {
  let user: TestUser;
  let householdId: string;

  test.beforeAll(async () => {
    user = await createTestUser("e2e-auth");
    householdId = await createHousehold(user.client, `E2E auth ${runId}`);
  });

  test.afterAll(async () => {
    await deleteTestData([householdId], [user]);
  });

  test("signed out, protected pages redirect to the login page; join links do not", async ({
    page,
  }) => {
    for (const path of PROTECTED_ROUTES) {
      await test.step(`${path} redirects`, async () => {
        await page.goto(path);
        await expect(page).toHaveURL(LOGIN_URL);
        await expect(page.getByTestId(TEST_IDS.login.heading)).toBeVisible();
      });
    }

    await test.step("a join link stays on the join page", async () => {
      await page.goto(ROUTES.join("some-code"));
      await expect(page.getByTestId(TEST_IDS.join.heading)).toBeVisible();

      await expect(page).toHaveURL(new RegExp(`${ROUTES.join("some-code")}$`));
    });
  });

  test("the session survives a reload, and sign-out locks the pages again", async ({
    page,
  }) => {
    await signIn(page, user);

    await test.step("a full reload keeps the user signed in", async () => {
      await page.reload();
      await expect(accountButton(page, user.email)).toBeVisible();
      // The button shows only a picture; its name says whose account it is.
      await expect(accountButton(page, user.email)).toHaveAccessibleName(
        `Account, ${user.email}`,
      );
      await expect(page.getByTestId(TEST_IDS.household.name)).toHaveText(
        `E2E auth ${runId}`,
      );
    });

    await test.step("after sign-out, protected pages redirect again", async () => {
      await signOut(page);
      for (const path of PROTECTED_ROUTES) {
        await page.goto(path);
        await expect(page).toHaveURL(LOGIN_URL);
      }
    });
  });

  test("a link opened signed out leads to its page after sign-in, and sign-out forgets it", async ({
    page,
  }) => {
    // A link someone was sent: a page of the app with a parameter in the
    // address. On a phone it opens in the browser, which may not be signed in.
    const asked = `${ROUTES.vacation("some-id")}?task=some-task`;
    const remembered = async () =>
      (await page.context().cookies()).find((cookie) =>
        cookie.name.endsWith("-redirect-path"),
      )?.value;

    await stubOtpRequest(page);
    await page.goto(asked);
    await expect(page).toHaveURL(LOGIN_URL);

    // Filled in here and not by signIn, which expects the dashboard: where
    // sign-in leads is what this case is about.
    await enterLoginCode(page, user.email);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.vacation("some-id")}`));
    expect(new URL(page.url()).search).toBe("?task=some-task");
    await expect(accountButton(page, user.email)).toBeVisible();
    await waitForSessionCookie(page);
    // Read once: the next sign-in on this device starts at the dashboard.
    expect(await remembered()).toBeFalsy();

    await test.step("a page asked for and never reached is forgotten at sign-out", async () => {
      await signOut(page);
      await page.goto(ROUTES.todos);
      await expect(page).toHaveURL(LOGIN_URL);
      expect(decodeURIComponent((await remembered()) ?? "")).toBe(ROUTES.todos);
      // Someone signs in elsewhere on the page, as the join page does, and
      // out again: the remembered page must not wait for the next person.
      await enterLoginCode(page, user.email);
      await expect(page).toHaveURL(new RegExp(`${ROUTES.todos}$`));
      await page.goto(ROUTES.home);
      await signOut(page);
      expect(await remembered()).toBeFalsy();
    });
  });

  test("a wrong code shows an error and keeps the code step; the email can be changed", async ({
    page,
  }) => {
    await stubOtpRequest(page);
    await page.goto(ROUTES.login);
    await page.getByTestId(TEST_IDS.signIn.email).fill(user.email);
    await page.getByTestId(TEST_IDS.signIn.sendCode).click();

    await expect(page.getByTestId(TEST_IDS.signIn.sentNotice)).toContainText(
      user.email,
    );

    await test.step("a wrong code is rejected by the auth server", async () => {
      await page.getByTestId(TEST_IDS.signIn.code).fill("00000000");
      await page.getByTestId(TEST_IDS.signIn.submit).click();
      // The auth server's own words, shown as they come.
      await expect(page.getByTestId(TEST_IDS.errorMessage)).toContainText(
        /expired or is invalid/i,
      );

      await expect(page.getByTestId(TEST_IDS.signIn.code)).toBeVisible();
      await expect(page).toHaveURL(LOGIN_URL);
    });

    await test.step('"Use a different email" returns to the email step', async () => {
      await page.getByTestId(TEST_IDS.signIn.changeEmail).click();
      await expect(page.getByTestId(TEST_IDS.signIn.email)).toHaveValue(
        user.email,
      );
      await expect(page.getByTestId(TEST_IDS.signIn.sendCode)).toBeVisible();
    });
  });
});
