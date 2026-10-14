import { expect, test, type Page } from "@playwright/test";
import { ROUTES } from "../../app/utils/routes";
import { TEST_IDS } from "../../app/utils/test-ids";

import {
  accountButton,
  dashboardTileLink,
  enterLoginCode,
  memberAvatar,
  openAccountMenu,
  signIn,
  stubOtpRequest,
  waitForSessionCookie,
} from "../support/e2e-ui";
import {
  createHousehold,
  createInviteCode,
  createTestUser,
  deleteTestData,
  findHouseholdId,
  insertInvite,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// Milestone 3: setting up a household and joining one through an invite
// link, the flows the fixtures otherwise shortcut through RPCs.

const HOME_URL = /\/$/;
const INVALID_INVITE_TEXT =
  "This invite link is invalid or has expired. Ask for a new one.";

/** Signs in on the join page itself, the way an invited family member does. */
async function joinSignedOut(page: Page, code: string, user: TestUser) {
  await stubOtpRequest(page);
  await page.goto(ROUTES.join(code));
  await enterLoginCode(page, user.email);
}

test.describe("household setup and invites", () => {
  const householdIds: (string | undefined)[] = [];
  const users: TestUser[] = [];

  /** A fresh user per test, so "no household yet" holds wherever a test
   * needs it. Numbered, because emails must be unique within a run. */
  async function newUser(label: string) {
    const user = await createTestUser(`${label}-${users.length + 1}`);
    users.push(user);
    return user;
  }

  async function newOwnerWithHousehold(name: string) {
    const owner = await newUser("e2e-owner");
    householdIds.push(await createHousehold(owner.client, name));
    return { owner, householdId: householdIds.at(-1)! };
  }

  test.afterAll(async () => {
    // Households created through the UI are found through their member.
    for (const user of users) householdIds.push(await findHouseholdId(user));
    await deleteTestData([...new Set(householdIds)], users);
  });

  test("a new user creates a household and gets to the lists", async ({
    page,
  }) => {
    const user = await newUser("e2e-new");
    const name = `E2E new ${runId}`;
    await signIn(page, user);

    await test.step("a list page without a household points to the dashboard", async () => {
      await page.goto(ROUTES.todos);
      await expect(
        page.getByTestId(TEST_IDS.household.requiredNotice),
      ).toBeVisible();
      await page.getByTestId(TEST_IDS.household.requiredLink).click();
    });

    await test.step("the dashboard asks for a household name and creates it", async () => {
      await expect(
        page.getByTestId(TEST_IDS.household.createForm),
      ).toBeVisible();
      await page.getByTestId(TEST_IDS.household.nameInput).fill(name);
      await page.getByTestId(TEST_IDS.household.createButton).click();
      await expect(page.getByTestId(TEST_IDS.household.name)).toHaveText(name);
      await expect(dashboardTileLink(page, "todos")).toBeVisible();
      await expect(dashboardTileLink(page, "shopping")).toBeVisible();

      // The new household's only member so far, without a page load.
      await expect(memberAvatar(page, user.email)).toBeVisible();
    });

    await test.step("the household is still there after a reload", async () => {
      await page.reload();
      await expect(page.getByTestId(TEST_IDS.household.name)).toHaveText(name);
    });
  });

  test("a signed-out family member joins through the invite link", async ({
    browser,
  }) => {
    const name = `E2E invite ${runId}`;
    const { owner, householdId } = await newOwnerWithHousehold(name);
    const member = await newUser("e2e-member");

    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await signIn(ownerPage, owner);

    const inviteUrl =
      await test.step("the owner gets an invite link", async () => {
        await openAccountMenu(ownerPage);
        await ownerPage.getByTestId(TEST_IDS.account.invite).click();

        const linkField = ownerPage.getByTestId(TEST_IDS.invite.link);
        await expect(linkField).toHaveValue(
          new RegExp(`${ROUTES.joinPrefix}.+`),
        );
        return new URL(await linkField.inputValue());
      });

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();

    await test.step('the join page has its own sign-in and no "Log in" detour', async () => {
      await stubOtpRequest(memberPage);
      await memberPage.goto(inviteUrl.pathname);
      await expect(memberPage.getByTestId(TEST_IDS.join.heading)).toBeVisible();

      await expect(
        memberPage.getByTestId(TEST_IDS.layout.loginLink),
      ).toHaveCount(0);
    });

    await test.step("signing in on the join page joins the household", async () => {
      await enterLoginCode(memberPage, member.email);
      await expect(memberPage).toHaveURL(HOME_URL);
      await expect(memberPage.getByTestId(TEST_IDS.household.name)).toHaveText(
        name,
      );

      await expect(accountButton(memberPage, member.email)).toBeVisible();
      expect(await findHouseholdId(member)).toBe(householdId);
    });

    await ownerContext.close();
    await memberContext.close();
  });

  test("a signed-in user who opens an invite link joins right away", async ({
    page,
  }) => {
    const name = `E2E signed-in join ${runId}`;
    const { owner, householdId } = await newOwnerWithHousehold(name);
    const member = await newUser("e2e-member");
    const code = await createInviteCode(owner, householdId);

    await signIn(page, member);
    await expect(page.getByTestId(TEST_IDS.household.createForm)).toBeVisible();

    await page.goto(ROUTES.join(code));
    await expect(page).toHaveURL(HOME_URL);
    await expect(page.getByTestId(TEST_IDS.household.name)).toHaveText(name);

    expect(await findHouseholdId(member)).toBe(householdId);
  });

  test("an unknown, expired or used-up invite code shows an error", async ({
    page,
  }) => {
    const { owner, householdId } = await newOwnerWithHousehold(
      `E2E bad invite ${runId}`,
    );
    const member = await newUser("e2e-member");
    const codes = {
      unknown: `unknown-${runId}`,
      expired: await insertInvite(householdId, owner.userId, {
        expires_at: new Date(Date.now() - 1000).toISOString(),
      }),
      "used up": await insertInvite(householdId, owner.userId, {
        max_uses: 1,
        use_count: 1,
      }),
    };

    await test.step("signed out: the code is rejected after signing in", async () => {
      await joinSignedOut(page, codes.unknown, member);
      await expect(page.getByTestId(TEST_IDS.errorMessage)).toHaveText(
        INVALID_INVITE_TEXT,
      );

      await waitForSessionCookie(page);
    });

    for (const kind of ["expired", "used up"] as const) {
      await test.step(`signed in: an ${kind} code is rejected`, async () => {
        await page.goto(ROUTES.join(codes[kind]));
        await expect(page.getByTestId(TEST_IDS.errorMessage)).toHaveText(
          INVALID_INVITE_TEXT,
        );
      });
    }

    expect(await findHouseholdId(member)).toBeUndefined();
  });
});
