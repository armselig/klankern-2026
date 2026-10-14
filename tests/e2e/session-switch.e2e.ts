import { expect, test } from "@playwright/test";
import { addDays, localDateOf } from "../../app/utils/local-date";
import { TEST_IDS } from "../../app/utils/test-ids";

import {
  accountButton,
  addShoppingItem,
  addTodo,
  addVacation,
  dashboardTile,
  dashboardTileEmpty,
  homeLink,
  listEmpty,
  listItems,
  enterLoginCode,
  listItem,
  memberAvatar,
  vacationListEmpty,
  openList,
  openVacations,
  openSignedIn,
  signOut,
  stubOtpRequest,
  untilSaved,
  waitForSessionCookie,
} from "../support/e2e-ui";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// Two people from different households share one browser tab, e.g. a family
// tablet: after one signs out and the other signs in -- without a page load
// in between, so the stores stay in memory -- nothing of the first
// household may show up or stay subscribed.

test.describe("switching users in the same tab", () => {
  let userA: TestUser;
  let userB: TestUser;
  let householdAId: string;
  let householdBId: string;

  test.beforeAll(async () => {
    [userA, userB] = await Promise.all([
      createTestUser("e2e-switch-a"),
      createTestUser("e2e-switch-b"),
    ]);
    [householdAId, householdBId] = await Promise.all([
      createHousehold(userA.client, `E2E switch A ${runId}`),
      createHousehold(userB.client, `E2E switch B ${runId}`),
    ]);
  });

  test.afterAll(async () => {
    await deleteTestData([householdAId, householdBId], [userA, userB]);
  });

  test("the second user sees only their own household, lists and channel", async ({
    page,
  }) => {
    const joinedChannels: string[] = [];
    page.on("websocket", (socket) =>
      socket.on("framesent", ({ payload }) => {
        const frame = String(payload);
        const topic = /"realtime:(household:[^"]+)","phx_join"/.exec(
          frame,
        )?.[1];
        if (topic) joinedChannels.push(topic);
      }),
    );

    await test.step("A adds items to both lists, and a vacation", async () => {
      await openSignedIn(page, userA);
      await openList(page, "todos");
      // Left open: the dashboard previews only what is still to do.
      await addTodo(page, "Still open for A");
      await untilSaved(page, async () => {
        await addTodo(page, "Only for A");
        await listItem(page, "Only for A").click();
      });
      await homeLink(page).click();
      await expect(dashboardTile(page, "todos")).toContainText(
        "Still open for A",
      );
      await openList(page, "shopping");
      await untilSaved(page, async () => {
        await addShoppingItem(page, "Only for A too");
        await listItem(page, "Only for A too").click();
      });
      await homeLink(page).click();
      await openVacations(page);
      const today = localDateOf(new Date());
      await addVacation(page, {
        title: "Only A's trip",
        from: addDays(today, 10),
        until: addDays(today, 17),
      });
      await homeLink(page).click();
      await expect(dashboardTile(page, "vacations")).toContainText(
        "Only A's trip",
      );
    });

    await test.step("A signs out; B signs in on the same page, without a page load", async () => {
      await signOut(page);
      joinedChannels.length = 0;
      // A started with a session, not through the form, so the request for
      // a code is answered here for the first time.
      await stubOtpRequest(page);
      await enterLoginCode(page, userB.email);
      await expect(accountButton(page, userB.email)).toBeVisible();
      await waitForSessionCookie(page);
      await expect(page.getByTestId(TEST_IDS.household.name)).toHaveText(
        `E2E switch B ${runId}`,
      );

      // A's dashboard had loaded A's members; none of them may be left.
      await expect(memberAvatar(page, userB.email)).toBeVisible();
      await expect(memberAvatar(page, userA.email)).toHaveCount(0);
      // Nor anything of A's lists in the tiles, which A's dashboard showed.
      await expect(dashboardTileEmpty(page, "todos")).toBeVisible();

      await expect(page.getByText("Still open for A")).toHaveCount(0);
      await expect(dashboardTileEmpty(page, "vacations")).toBeVisible();

      await expect(page.getByText("Only A's trip")).toHaveCount(0);
    });

    for (const list of ["todos", "shopping"] as const) {
      await test.step(`B's ${list} list is B's own`, async () => {
        await homeLink(page).click();
        await openList(page, list);
        await expect(listEmpty(page)).toBeVisible();
        await expect(listItems(page)).toHaveCount(0);
        await expect(page.getByTestId(TEST_IDS.errorMessage)).toHaveCount(0);
      });
    }

    await test.step("B's vacations are B's own", async () => {
      await homeLink(page).click();
      await openVacations(page);
      await expect(vacationListEmpty(page)).toBeVisible();

      await expect(page.getByText("Only A's trip")).toHaveCount(0);
      await expect(page.getByTestId(TEST_IDS.errorMessage)).toHaveCount(0);
    });

    await test.step("B's session never joined A's household channel", async () => {
      expect(joinedChannels).toContain(`household:${householdBId}`);
      expect(joinedChannels).not.toContain(`household:${householdAId}`);
    });
  });
});
