import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { ROUTES } from "../../app/utils/routes";
import { TEST_IDS } from "../../app/utils/test-ids";
import {
  openAccountMenu,
  openSignedIn,
  openVersionMenu,
} from "../support/e2e-ui";
import {
  createTestUser,
  deleteTestData,
  type TestUser,
} from "../support/supabase-fixtures";

// The menus show the version that semantic-release writes into package.json
// with each release, so a deployed build can be matched to its entry in
// CHANGELOG.md: the version menu while signed out, the bottom of the account
// menu while signed in.

const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

test("the version menu shows the version from package.json", async ({
  page,
}) => {
  await page.goto(ROUTES.login);
  await openVersionMenu(page);
  await expect(page.getByTestId(TEST_IDS.layout.appVersion)).toHaveText(
    version,
  );
});

test.describe("signed in", () => {
  let user: TestUser;

  test.beforeAll(async () => {
    user = await createTestUser("e2e-app-version");
  });

  test.afterAll(async () => {
    await deleteTestData([], [user]);
  });

  test("the account menu shows the version from package.json", async ({
    page,
  }) => {
    await openSignedIn(page, user);
    await openAccountMenu(page);
    await expect(page.getByTestId(TEST_IDS.layout.appVersion)).toHaveText(
      version,
    );
  });
});
