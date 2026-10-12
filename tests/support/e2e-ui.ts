import { expect, type Page } from "@playwright/test";
import { ROUTES } from "../../app/utils/routes";
import { generateLoginCode, type TestUser } from "./supabase-fixtures";

// UI steps shared by the e2e specs. They drive the app through its real
// forms, so a renamed label or button breaks the tests like it would a user.

/**
 * Answers the "send code" request locally, so no email is sent. The code
 * comes from the Admin API instead (see `enterLoginCode`), and verifying it
 * still hits the real auth server.
 */
export async function stubOtpRequest(page: Page) {
  await page.route("**/auth/v1/otp**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
}

/**
 * Fills the email step and the code step of a sign-in form. Shared by the
 * login page ("Verify") and the join page ("Join household"), which use the
 * same two-step OTP flow.
 */
export async function enterLoginCode(
  page: Page,
  email: string,
  submitLabel: string,
) {
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await page
    .getByLabel("Code from the email")
    .fill(await generateLoginCode(email));
  await page.getByRole("button", { name: submitLabel }).click();
}

/**
 * Waits until the session is stored in its cookie. The header already shows
 * the user before supabase-js has written the cookie, and a full page load
 * in that gap starts signed out.
 */
export async function waitForSessionCookie(page: Page) {
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((cookie) =>
        cookie.name.endsWith("-auth-token"),
      ),
    )
    .toBe(true);
}

/**
 * Signs in through the real login form. Returns once the app has left the
 * login page, the header shows the user and the session is stored, so the
 * test may load or reload pages directly. The cookie alone is not enough: it
 * is written before the app navigates, and a reload in that gap stays on the
 * login page. The user is looked up in the header, by the account button's
 * name, because the code step shows the email too ("We sent a login code to
 * ...").
 */
export async function signIn(page: Page, user: TestUser) {
  await stubOtpRequest(page);
  await page.goto(ROUTES.login);
  await enterLoginCode(page, user.email, "Verify");
  await expect(page).toHaveURL(ROUTES.home);
  await expect(accountButton(page, user.email)).toBeVisible();
  await waitForSessionCookie(page);
}

/**
 * The header's account button of the user with this email. It shows only
 * the avatar, and its name carries the address, so it tells who is signed
 * in without opening the menu.
 */
export function accountButton(page: Page, email: string) {
  return page
    .getByRole("banner")
    .getByRole("button", { name: `Account, ${email}`, exact: true });
}

/** Opens the header's account menu, which holds "Invite a family member"
 * and "Sign out". */
export async function openAccountMenu(page: Page) {
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^Account/ })
    .click();
  await expect(page.getByRole("group", { name: "Account" })).toBeVisible();
}

/** Signs out through the account menu and waits for the login page. */
export async function signOut(page: Page) {
  await openAccountMenu(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
}

/** The dashboard's list of the household's members. */
export function memberRoster(page: Page) {
  return page.getByRole("list", { name: "Household members" });
}

/** A member's avatar in that list. It is named by the member's email
 * address, whether it shows a photo or the app's own drawing. */
export function memberAvatar(page: Page, email: string) {
  return memberRoster(page).getByRole("img", { name: email });
}

/** The names of the dashboard's tiles, which are their links' names. */
export type DashboardTileName =
  "To-dos" | "Shopping" | "Whiteboard" | "Recipes";

/**
 * A tile of the dashboard, with everything it shows. Found by its link: the
 * tile itself has no name, and the entries it previews are list items too,
 * but none of them holds a link.
 */
export function dashboardTile(page: Page, name: DashboardTileName) {
  return page
    .getByRole("navigation", { name: "Lists, whiteboard and recipes" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name, exact: true }) });
}

/** The drawing in the whiteboard's tile; there is none for an empty board. */
export function whiteboardPreview(page: Page) {
  return dashboardTile(page, "Whiteboard").getByRole("img", {
    name: "Preview of the whiteboard",
  });
}

/** Both lists render an item as a checkbox labelled with its text. */
export function listItem(page: Page, label: string) {
  return page.getByRole("checkbox", { name: label, exact: true });
}

/** Remove buttons all share one label, so find the one in the item's row. */
export async function removeListItem(page: Page, label: string) {
  await page
    .locator(".q-item")
    .filter({ has: listItem(page, label) })
    .getByRole("button", { name: "Remove" })
    .click();
}

export async function addTodo(page: Page, title: string) {
  await page.getByLabel("Add a to-do").fill(title);
  await page.keyboard.press("Enter");
}

export async function addShoppingItem(
  page: Page,
  title: string,
  quantity = "",
) {
  await page.getByLabel("Item", { exact: true }).fill(title);
  await page.getByLabel("Quantity (optional)").fill(quantity);
  await page.keyboard.press("Enter");
}

/**
 * Opens a list from the dashboard the way a user does, and waits until it
 * has loaded: the list replaces its spinner only then, and an add before
 * that is ignored.
 */
export async function openList(page: Page, linkName: "To-dos" | "Shopping") {
  await page.getByRole("link", { name: linkName }).click();
  const path = linkName === "To-dos" ? ROUTES.todos : ROUTES.shopping;
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole("list")).toBeVisible();
}

/**
 * Checks or removes a list item and waits for the server to confirm the
 * update. The lists update optimistically, so the UI alone doesn't show when
 * a write is done -- and a reload cancels a write still in flight. Only
 * PATCH counts: an earlier add's POST may still be finishing.
 */
export async function untilSaved(page: Page, action: () => Promise<void>) {
  const saved = page.waitForResponse(
    (response) =>
      /\/rest\/v1\/(todo|shopping)_items/.test(response.url()) &&
      response.request().method() === "PATCH",
  );
  await action();
  expect((await saved).ok()).toBe(true);
}

/**
 * Holds back every list-item insert for `ms` before sending it, so a test
 * can act on an item whose add is still being saved, like on a slow network.
 */
export async function delayItemInserts(page: Page, ms: number) {
  await page.route(/\/rest\/v1\/(todo|shopping)_items/, async (route) => {
    if (route.request().method() === "POST")
      await new Promise((resolve) => setTimeout(resolve, ms));
    await route.fallback();
  });
}

/**
 * The whiteboard's drawing surface. Its accessible name carries the number
 * of strokes ("Whiteboard, 2 strokes"), which is what the specs assert on:
 * it is what a screen reader user gets, and it doesn't count the stroke
 * still under the pen.
 */
export function whiteboard(page: Page) {
  return page.getByRole("img", { name: /^Whiteboard, / });
}

/** The strokes on the board, oldest first. */
export function whiteboardStrokes(page: Page) {
  return whiteboard(page).locator("polyline, circle");
}

export async function expectStrokeCount(page: Page, count: number) {
  await expect(whiteboard(page)).toHaveAccessibleName(
    `Whiteboard, ${count} ${count === 1 ? "stroke" : "strokes"}`,
  );
}

/** Opens the whiteboard from the dashboard and waits until it has loaded. */
export async function openWhiteboard(page: Page) {
  await page.getByRole("link", { name: "Whiteboard" }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.whiteboard}$`));
  await expect(whiteboard(page)).toBeVisible();
}

/** A position on the board as fractions of its width and height (0 to 1). */
export type BoardFraction = [x: number, y: number];

/**
 * Drags the mouse over the board along `path`, with the tool selected in the
 * toolbar: the pen draws one stroke, the eraser removes what it crosses. The
 * positions are relative to the board's own rectangle, because the surface
 * around it can be wider than the board. `stepsPerSegment` is the number of
 * mouse positions reported per segment, i.e. roughly the points of a stroke.
 */
export async function dragOnWhiteboard(
  page: Page,
  path: BoardFraction[],
  stepsPerSegment = 5,
) {
  const board = whiteboard(page).locator("rect");
  // The mouse only reaches what is in the viewport, and it doesn't scroll.
  await board.scrollIntoViewIfNeeded();
  const box = await board.boundingBox();
  if (!box) throw new Error("the whiteboard is not on screen");
  const [start, ...rest] = path.map(([x, y]) => ({
    x: box.x + x * box.width,
    y: box.y + y * box.height,
  }));
  if (!start) throw new Error("a drag needs a starting position");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const position of rest) {
    await page.mouse.move(position.x, position.y, { steps: stepsPerSegment });
  }
  await page.mouse.up();
}

/** The text both lists show when they have no items. */
export const EMPTY_LIST_TEXT = "Nothing on the list yet.";

/** The text the recipe list shows when the household has no recipes. */
export const NO_RECIPES_TEXT = "No recipes yet.";

/** A recipe's link in the list of recipes. */
export function recipeLink(page: Page, title: string) {
  return page
    .getByRole("main")
    .getByRole("listitem")
    .getByRole("link", { name: title, exact: true });
}

/** Opens the recipes from the dashboard and waits until they have loaded:
 * the list, or the text that stands in for an empty one, shows only then. */
export async function openRecipes(page: Page) {
  await page.getByRole("link", { name: "Recipes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.recipes}$`));
  await expect(
    page
      .getByRole("main")
      .getByRole("list")
      .or(page.getByText(NO_RECIPES_TEXT)),
  ).toBeVisible();
}

/** A row of the recipe form's ingredients, counted from 1 as its name is. */
export function ingredientRow(page: Page, number: number) {
  return page.getByRole("group", {
    name: `Ingredient ${number}`,
    exact: true,
  });
}

/** What a test types into the recipe form; a field left out is not touched. */
export interface RecipeFormEntry {
  title?: string;
  servings?: string;
  /** Typed into the rows from the first one on; rows are added as needed. */
  ingredients?: [name: string, quantity?: string][];
  instructions?: string;
}

/** Fills the recipe form, which has to be open, without saving it. */
export async function fillRecipeForm(page: Page, entry: RecipeFormEntry) {
  if (entry.title !== undefined)
    await page.getByLabel("Title").fill(entry.title);
  if (entry.servings !== undefined)
    await page.getByLabel("Servings (optional)").fill(entry.servings);
  for (const [index, [name, quantity = ""]] of (
    entry.ingredients ?? []
  ).entries()) {
    const row = ingredientRow(page, index + 1);
    if ((await row.count()) === 0)
      await page.getByRole("button", { name: "Add ingredient" }).click();
    await row.getByLabel("Ingredient", { exact: true }).fill(name);
    await row.getByLabel("Quantity (optional)").fill(quantity);
  }
  if (entry.instructions !== undefined)
    await page.getByLabel("Instructions").fill(entry.instructions);
}

/** Saves the open recipe form and waits for the recipe's own page, which
 * the app shows only once the server has the recipe. */
export async function saveRecipeForm(page: Page) {
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.recipes}/[0-9a-f-]{36}$`));
}
