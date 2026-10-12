import { createHash } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { memberAvatar, memberRoster, signIn } from "../support/e2e-ui";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  joinHousehold,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// Avatars: the header shows the signed-in user's, the dashboard one for
// every member of the household. The picture is the person's Gravatar when
// they have one; otherwise, or when Gravatar can't be reached, the app draws
// its own. The spec answers the requests to gravatar.com itself, so it
// doesn't depend on Gravatar and no test address needs a picture there.

const GRAVATAR_PICTURES = "**/gravatar.com/avatar/**";

/** A PNG of a single pixel, standing in for a person's photo. */
const PHOTO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** The hash Gravatar knows an address by, computed apart from the app. */
function gravatarHashOf(user: TestUser) {
  return createHash("sha256").update(user.email).digest("hex");
}

/**
 * Stands in for gravatar.com: the given users have a picture there, everyone
 * else gets the 404 the app asks for with `d=404`. Returns the pictures
 * requested so far, as path and query.
 */
async function answerGravatarFor(page: Page, usersWithPicture: TestUser[]) {
  const hashesWithPicture = new Set(usersWithPicture.map(gravatarHashOf));
  const requested: string[] = [];
  await page.unroute(GRAVATAR_PICTURES);
  await page.route(GRAVATAR_PICTURES, (route) => {
    const { pathname, search } = new URL(route.request().url());
    requested.push(pathname + search);
    return hashesWithPicture.has(pathname.split("/").at(-1)!)
      ? route.fulfill({ status: 200, contentType: "image/png", body: PHOTO })
      : route.fulfill({ status: 404 });
  });
  return requested;
}

async function expectDrawing(avatar: Locator) {
  await expect(avatar.locator("svg polyline")).toBeVisible();
  await expect(avatar.locator("img")).toHaveCount(0);
}

async function expectPhoto(avatar: Locator) {
  await expect(avatar.locator("img")).toBeVisible();
  await expect(avatar.locator("svg")).toHaveCount(0);
}

test.describe("avatars", () => {
  let owner: TestUser;
  let member: TestUser;
  let householdId: string;

  test.beforeAll(async () => {
    [owner, member] = await Promise.all([
      createTestUser("e2e-avatar-owner"),
      createTestUser("e2e-avatar-member"),
    ]);
    householdId = await createHousehold(owner.client, `E2E avatars ${runId}`);
    await joinHousehold(owner, member, householdId);
  });

  test.afterAll(async () => {
    await deleteTestData([householdId], [owner, member]);
  });

  test("every member has an avatar: their Gravatar, or the drawing", async ({
    page,
  }) => {
    // Decoration to assistive technology (the account button around it
    // carries the name), so it has no role to find it by.
    const headerAvatar = page.getByRole("banner").locator(".q-avatar");

    await test.step("without a Gravatar, everyone gets the drawing", async () => {
      const requested = await answerGravatarFor(page, []);
      await signIn(page, owner);

      await expectDrawing(headerAvatar);
      await expectDrawing(memberAvatar(page, owner.email));
      await expectDrawing(memberAvatar(page, member.email));
      // Whoever has been in the household longest comes first; each is
      // named by the part of their address before the @.
      await expect(memberRoster(page).getByRole("listitem")).toHaveText([
        owner.email.split("@")[0]!,
        member.email.split("@")[0]!,
      ]);

      // The pictures are asked for by the hash of the address, at twice the
      // avatar's size (32 px in the header, 48 px in the list).
      expect(requested).toContain(
        `/avatar/${gravatarHashOf(owner)}?s=64&d=404`,
      );
      expect(requested).toContain(
        `/avatar/${gravatarHashOf(owner)}?s=96&d=404`,
      );
      expect(requested).toContain(
        `/avatar/${gravatarHashOf(member)}?s=96&d=404`,
      );
    });

    await test.step("a member's Gravatar replaces their drawing", async () => {
      await answerGravatarFor(page, [member]);
      await page.reload();

      await expectPhoto(memberAvatar(page, member.email));
      await expectDrawing(memberAvatar(page, owner.email));
      await expectDrawing(headerAvatar);
    });
  });
});
