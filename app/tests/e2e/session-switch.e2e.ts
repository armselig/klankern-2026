import { expect, test } from "@playwright/test";
import {
  addShoppingItem,
  addTodo,
  EMPTY_LIST_TEXT,
  enterLoginCode,
  listItem,
  memberAvatar,
  openList,
  signIn,
  signOut,
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

    await test.step("A adds items to both lists", async () => {
      await signIn(page, userA);
      await openList(page, "To-dos");
      await untilSaved(page, async () => {
        await addTodo(page, "Only for A");
        await listItem(page, "Only for A").click();
      });
      await page.getByRole("link", { name: "Klankern" }).click();
      await openList(page, "Shopping");
      await untilSaved(page, async () => {
        await addShoppingItem(page, "Only for A too");
        await listItem(page, "Only for A too").click();
      });
    });

    await test.step("A signs out; B signs in on the same page, without a page load", async () => {
      await signOut(page);
      joinedChannels.length = 0;
      await enterLoginCode(page, userB.email, "Verify");
      await expect(page.getByText(userB.email)).toBeVisible();
      await waitForSessionCookie(page);
      await expect(page.getByText(`E2E switch B ${runId}`)).toBeVisible();
      await expect(page.getByText(`E2E switch A ${runId}`)).toHaveCount(0);
      // A's dashboard had loaded A's members; none of them may be left.
      await expect(memberAvatar(page, userB.email)).toBeVisible();
      await expect(memberAvatar(page, userA.email)).toHaveCount(0);
    });

    for (const list of ["To-dos", "Shopping"] as const) {
      await test.step(`B's ${list} list is B's own`, async () => {
        await page.getByRole("link", { name: "Klankern" }).click();
        await openList(page, list);
        await expect(page.getByText(EMPTY_LIST_TEXT)).toBeVisible();
        await expect(page.getByRole("checkbox")).toHaveCount(0);
        await expect(page.locator(".text-negative")).toHaveCount(0);
      });
    }

    await test.step("B's session never joined A's household channel", async () => {
      expect(joinedChannels).toContain(`household:${householdBId}`);
      expect(joinedChannels).not.toContain(`household:${householdAId}`);
    });
  });
});
