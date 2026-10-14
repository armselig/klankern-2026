import { expect, test, type Page } from "@playwright/test";
import type { VacationKind, VacationPhase } from "../../app/types/vacation";
import type { WhiteboardTool } from "../../app/types/whiteboard";
import { INK_VALUES } from "../../app/utils/ink";
import { ROUTES } from "../../app/utils/routes";
import { TEST_IDS, type DashboardTileKey } from "../../app/utils/test-ids";
import { VACATION_KINDS } from "../../app/utils/vacation-state";
import {
  PEN_COLORS,
  PEN_WIDTHS,
  WHITEBOARD_TOOLS,
} from "../../app/utils/whiteboard-pen";
import {
  generateLoginCode,
  sessionCookies,
  type TestUser,
} from "./supabase-fixtures";

// UI steps shared by the e2e specs. They drive the app through its real
// forms and find every element by its test id (TEST_IDS, bound in the
// templates as `data-testid`), so a reworded or translated label breaks no
// test. An id names a kind of element; where there are several, a row or a
// link is picked by the text the test typed into it. What an element is
// called for a screen reader is no longer checked by finding it: the specs
// assert a name where it carries meaning, and a11y.e2e.ts still walks the
// pages by role and name.

/** The pattern for an element whose whole text is `text`: a filter by a
 * plain string also matches every longer text that contains it. */
export function exactly(text: string) {
  return new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
}

/**
 * A radio of one of Quasar's option groups, found by its place among the
 * group's options: the group builds its radios itself and gives them no
 * attribute of their own that could carry a test id.
 */
function optionRadio<Value>(
  page: Page,
  groupTestId: string,
  options: readonly Value[],
  value: Value,
) {
  const index = options.indexOf(value);
  if (index < 0) throw new Error(`the group has no option ${String(value)}`);
  return page.getByTestId(groupTestId).getByRole("radio").nth(index);
}

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
 * login page and the join page, which use the same two-step OTP flow and
 * the same test ids for it.
 */
export async function enterLoginCode(page: Page, email: string) {
  await page.getByTestId(TEST_IDS.signIn.email).fill(email);
  await page.getByTestId(TEST_IDS.signIn.sendCode).click();
  await page
    .getByTestId(TEST_IDS.signIn.code)
    .fill(await generateLoginCode(email));
  await page.getByTestId(TEST_IDS.signIn.submit).click();
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
 * name, because the code step shows the email too.
 */
export async function signIn(page: Page, user: TestUser) {
  await stubOtpRequest(page);
  await page.goto(ROUTES.login);
  await enterLoginCode(page, user.email);
  await expect(page).toHaveURL(ROUTES.home);
  await expect(accountButton(page, user.email)).toBeVisible();
  await waitForSessionCookie(page);
}

/**
 * Opens the dashboard signed in, without the login form: the browser gets a
 * session of the user's as the app would have stored it. For every test
 * that needs a signed-in member and is not about signing in. Supabase
 * limits how many emailed codes are verified in five minutes, and the suite
 * as a whole went past that with a form sign-in in every test (see
 * sessionCookies). Returns as signIn does: on the dashboard, with the
 * header showing the user.
 */
export async function openSignedIn(page: Page, user: TestUser) {
  const appUrl = test.info().project.use.baseURL;
  if (!appUrl) throw new Error("the project has no baseURL");
  await page.context().addCookies(await sessionCookies(user, appUrl));
  await page.goto(ROUTES.home);
  await expect(page).toHaveURL(ROUTES.home);
  await expect(accountButton(page, user.email)).toBeVisible();
}

/**
 * The header's account button of the user with this email. It shows only
 * the avatar, and its name carries the address, so it tells who is signed
 * in without opening the menu.
 */
export function accountButton(page: Page, email: string) {
  return page.getByTestId(TEST_IDS.account.button).and(page.getByLabel(email));
}

/** Opens the header's account menu, which holds the invitation and the
 * sign-out. */
export async function openAccountMenu(page: Page) {
  await page.getByTestId(TEST_IDS.account.button).click();
  await expect(page.getByTestId(TEST_IDS.account.menu)).toBeVisible();
}

/** Opens the header's version menu, the signed-out counterpart of the
 * account menu. */
export async function openVersionMenu(page: Page) {
  await page.getByTestId(TEST_IDS.layout.versionButton).click();
  await expect(page.getByTestId(TEST_IDS.layout.versionMenu)).toBeVisible();
}

/** Signs out through the account menu and waits for the login page. */
export async function signOut(page: Page) {
  await openAccountMenu(page);
  await page.getByTestId(TEST_IDS.account.signOut).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
}

/** The dashboard's list of the household's members. */
export function memberRoster(page: Page) {
  return page.getByTestId(TEST_IDS.household.members);
}

/** A member's avatar in that list. It is named by the member's email
 * address, whether it shows a photo or the app's own drawing. */
export function memberAvatar(page: Page, email: string) {
  return memberRoster(page)
    .getByTestId(TEST_IDS.household.memberAvatar)
    .and(page.getByLabel(email, { exact: true }));
}

/** A tile of the dashboard, with everything it shows. */
export function dashboardTile(page: Page, tile: DashboardTileKey) {
  return page.getByTestId(TEST_IDS.dashboard.tile[tile]);
}

/** A tile's link to its page, which is its heading. */
export function dashboardTileLink(page: Page, tile: DashboardTileKey) {
  return dashboardTile(page, tile).getByTestId(TEST_IDS.dashboard.tileLink);
}

/** The lines a tile previews, the one that says how many more included. */
export function dashboardTileEntries(page: Page, tile: DashboardTileKey) {
  return dashboardTile(page, tile).getByTestId(TEST_IDS.dashboard.tileEntry);
}

/** What a tile says in place of a preview when there is nothing to show. */
export function dashboardTileEmpty(page: Page, tile: DashboardTileKey) {
  return dashboardTile(page, tile).getByTestId(TEST_IDS.dashboard.tileEmpty);
}

/** The wordmark in the header, which leads back to the dashboard. */
export function homeLink(page: Page) {
  return page.getByTestId(TEST_IDS.layout.homeLink);
}

/** The drawing in the whiteboard's tile; there is none for an empty board. */
export function whiteboardPreview(page: Page) {
  return dashboardTile(page, "whiteboard").getByTestId(
    TEST_IDS.whiteboard.preview,
  );
}

/** Every item of the list on the page, in its order. Both lists render an
 * item as a checkbox whose text is the item's. */
export function listItems(page: Page) {
  return page.getByTestId(TEST_IDS.list.checkbox);
}

/** The item with this text. */
export function listItem(page: Page, label: string) {
  return listItems(page).filter({ hasText: exactly(label) });
}

/** The remove button of an item, which is the one in the item's row. */
export function removeListItemButton(page: Page, label: string) {
  return page
    .getByTestId(TEST_IDS.list.row)
    .filter({ has: listItem(page, label) })
    .getByTestId(TEST_IDS.list.remove);
}

export async function removeListItem(page: Page, label: string) {
  await removeListItemButton(page, label).click();
}

/** The line a list shows in place of its items when it has none. */
export function listEmpty(page: Page) {
  return page.getByTestId(TEST_IDS.list.empty);
}

export async function addTodo(page: Page, title: string) {
  await page.getByTestId(TEST_IDS.todos.titleInput).fill(title);
  await page.keyboard.press("Enter");
}

export async function addShoppingItem(
  page: Page,
  title: string,
  quantity = "",
) {
  await page.getByTestId(TEST_IDS.shopping.titleInput).fill(title);
  await page.getByTestId(TEST_IDS.shopping.quantityInput).fill(quantity);
  await page.keyboard.press("Enter");
}

/**
 * Opens a list from the dashboard the way a user does, and waits until it
 * has loaded: the list replaces its spinner only then, and an add before
 * that is ignored.
 */
export async function openList(page: Page, list: "todos" | "shopping") {
  await dashboardTileLink(page, list).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES[list]}$`));
  await expect(page.getByTestId(TEST_IDS.list.items)).toBeVisible();
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
 * Does what adds a list item and waits until the server has answered its
 * insert. A reload right after an add cancels an insert still on its way,
 * and the item is then never saved; on CI one took more than two seconds.
 * The item shows at once either way, since the add is optimistic.
 */
export async function untilAdded(page: Page, action: () => Promise<void>) {
  const added = page.waitForResponse(
    (response) =>
      /\/rest\/v1\/(todo|shopping)_items/.test(response.url()) &&
      response.request().method() === "POST",
  );
  await action();
  expect((await added).ok()).toBe(true);
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
  return page.getByTestId(TEST_IDS.whiteboard.surface);
}

/** The strokes on the board, oldest first. */
export function whiteboardStrokes(page: Page) {
  return whiteboard(page).getByTestId(TEST_IDS.whiteboard.stroke);
}

/** The toolbar's radio for the pen or the eraser. */
export function whiteboardToolRadio(page: Page, tool: WhiteboardTool) {
  return optionRadio(
    page,
    TEST_IDS.whiteboard.tools,
    WHITEBOARD_TOOLS.map((option) => option.value),
    tool,
  );
}

/** The toolbar's radio for a pen color. */
export function penColorRadio(page: Page, color: keyof typeof INK_VALUES) {
  return optionRadio(
    page,
    TEST_IDS.whiteboard.colors,
    PEN_COLORS.map((option) => option.value),
    INK_VALUES[color],
  );
}

/** The toolbar's radio for a pen width, in board units. */
export function penWidthRadio(page: Page, width: number) {
  return optionRadio(
    page,
    TEST_IDS.whiteboard.widths,
    PEN_WIDTHS.map((option) => option.value),
    width,
  );
}

export async function expectStrokeCount(page: Page, count: number) {
  await expect(whiteboard(page)).toHaveAccessibleName(
    `Whiteboard, ${count} ${count === 1 ? "stroke" : "strokes"}`,
  );
}

/** Opens the whiteboard from the dashboard and waits until it has loaded. */
export async function openWhiteboard(page: Page) {
  await dashboardTileLink(page, "whiteboard").click();
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
  const board = whiteboard(page).getByTestId(TEST_IDS.whiteboard.board);
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

/** The line the recipe list shows when the household has no recipes. */
export function recipeListEmpty(page: Page) {
  return page.getByTestId(TEST_IDS.recipe.list.empty);
}

/** A recipe's link in the list of recipes. */
export function recipeLink(page: Page, title: string) {
  return page
    .getByTestId(TEST_IDS.recipe.list.link)
    .filter({ hasText: exactly(title) });
}

/** Opens the recipes from the dashboard and waits until they have loaded:
 * the list, or the line that stands in for an empty one, shows only then. */
export async function openRecipes(page: Page) {
  await dashboardTileLink(page, "recipes").click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.recipes}$`));
  await expect(
    page.getByTestId(TEST_IDS.recipe.list.items).or(recipeListEmpty(page)),
  ).toBeVisible();
}

/** A row of the recipe form's ingredients, counted from 1. */
export function ingredientRow(page: Page, number: number) {
  return page.getByTestId(TEST_IDS.recipe.form.ingredientRow).nth(number - 1);
}

/** An ingredient on a recipe's page: a checkbox whose text is the
 * ingredient's, with its quantity. */
export function recipeIngredient(page: Page, label: string) {
  return page
    .getByTestId(TEST_IDS.recipe.view.ingredient)
    .filter({ hasText: exactly(label) });
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
  const form = TEST_IDS.recipe.form;
  if (entry.title !== undefined)
    await page.getByTestId(form.title).fill(entry.title);
  if (entry.servings !== undefined)
    await page.getByTestId(form.servings).fill(entry.servings);
  for (const [index, [name, quantity = ""]] of (
    entry.ingredients ?? []
  ).entries()) {
    const row = ingredientRow(page, index + 1);
    if ((await row.count()) === 0)
      await page.getByTestId(form.addIngredient).click();
    await row.getByTestId(form.ingredientName).fill(name);
    await row.getByTestId(form.ingredientQuantity).fill(quantity);
  }
  if (entry.instructions !== undefined)
    await page.getByTestId(form.instructions).fill(entry.instructions);
}

/** Saves the open recipe form and waits for the recipe's own page, which
 * the app shows only once the server has the recipe. */
export async function saveRecipeForm(page: Page) {
  await page.getByTestId(TEST_IDS.recipe.form.save).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.recipes}/[0-9a-f-]{36}$`));
}

/** The line the list of vacations shows when the household has none. */
export function vacationListEmpty(page: Page) {
  return page.getByTestId(TEST_IDS.vacation.list.empty);
}

/** A vacation's link in the list of vacations. Its text is the title and,
 * after it, where the trip stands. */
export function vacationLink(page: Page, title: string) {
  return page
    .getByTestId(TEST_IDS.vacation.list.link)
    .filter({ hasText: title });
}

/** Opens the vacations from the dashboard and waits until they have loaded:
 * the button for a new one shows only then. */
export async function openVacations(page: Page) {
  await dashboardTileLink(page, "vacations").click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.vacations}$`));
  await expect(page.getByTestId(TEST_IDS.vacation.list.add)).toBeVisible();
}

/** The radio for a kind of stay in the form for a new vacation. */
export function vacationKindRadio(page: Page, kind: VacationKind) {
  return optionRadio(page, TEST_IDS.vacation.form.kinds, VACATION_KINDS, kind);
}

/** What a test types into the form for a new vacation. The dates are
 * calendar days as "YYYY-MM-DD", the form a date field takes. */
export interface VacationFormEntry {
  title: string;
  kind?: VacationKind;
  from: string;
  until: string;
  /** The title of the trip the form chose by itself to copy the tasks
   * of, checked before the save. */
  expectCopyFrom?: string;
}

/** Adds a vacation from the list of vacations and waits for its own page,
 * which the app shows only once the server has it with its tasks. */
export async function addVacation(page: Page, entry: VacationFormEntry) {
  const form = TEST_IDS.vacation.form;
  await page.getByTestId(TEST_IDS.vacation.list.add).click();
  await page.getByTestId(form.title).fill(entry.title);
  if (entry.kind) await vacationKindRadio(page, entry.kind).click();
  await page.getByTestId(form.from).fill(entry.from);
  await page.getByTestId(form.until).fill(entry.until);
  if (entry.expectCopyFrom !== undefined)
    // Quasar's select keeps the chosen option's label, the title and the
    // dates, as the value of the element with the test id.
    await expect(page.getByTestId(form.copyFrom)).toHaveValue(
      new RegExp(`^${RegExp.escape(entry.expectCopyFrom)} \\(`),
    );
  await page.getByTestId(form.submit).click();
  await expect(page).toHaveURL(
    new RegExp(`${ROUTES.vacations}/[0-9a-f-]{36}$`),
  );
}

/** A phase of a vacation's page with its heading, its tasks and its field
 * for a new one. */
export function vacationPhase(page: Page, phase: VacationPhase) {
  return page.getByTestId(TEST_IDS.vacation.phase[phase]);
}

/** The button in a phase's heading that folds and unfolds it. */
export function phaseButton(page: Page, phase: VacationPhase) {
  return vacationPhase(page, phase).getByTestId(TEST_IDS.vacation.phaseToggle);
}

/** What a phase's heading says about its tasks, such as how many are open. */
export function phaseSummary(page: Page, phase: VacationPhase) {
  return vacationPhase(page, phase).getByTestId(TEST_IDS.vacation.phaseSummary);
}

/** The tasks of a phase, in their order. */
export function phaseTasks(page: Page, phase: VacationPhase) {
  return vacationPhase(page, phase).getByTestId(
    TEST_IDS.vacation.task.checkbox,
  );
}

/** The field for a new task of a phase. */
export function addTaskField(page: Page, phase: VacationPhase) {
  return vacationPhase(page, phase).getByTestId(TEST_IDS.vacation.addTask);
}

/** A task is a checkbox whose text is its title, as a list's item is. */
export function vacationTask(page: Page, title: string) {
  return page
    .getByTestId(TEST_IDS.vacation.task.checkbox)
    .filter({ hasText: exactly(title) });
}

/** A task's row: its checkbox, its buttons and, under them, the reason of
 * a rejection. */
export function taskRow(page: Page, title: string) {
  return page
    .getByTestId(TEST_IDS.vacation.task.row)
    .filter({ has: vacationTask(page, title) });
}

/** The button that opens a task's menu. */
export function taskMoreButton(page: Page, title: string) {
  return taskRow(page, title).getByTestId(TEST_IDS.vacation.task.more);
}

/** A task's menu, once it is open. It is not inside the task's row: Quasar
 * puts a menu at the end of the page. Open it with `openTaskMenu`, so that
 * it is the only one there. */
export function taskMenu(page: Page) {
  return page.getByTestId(TEST_IDS.vacation.taskMenu.group);
}

/**
 * Opens a task's menu. Waits first until no other task's menu is left: one
 * that was just closed stays in the page while it fades, and the menus all
 * have the same test id.
 */
export async function openTaskMenu(page: Page, title: string) {
  await expect(taskMenu(page)).toHaveCount(0);
  await taskMoreButton(page, title).click();
}

/** An entry of a task's menu, by the key of its id. */
export type TaskMenuEntry = Exclude<
  keyof typeof TEST_IDS.vacation.taskMenu,
  "group"
>;

/** An entry of the task menu that is open. */
export function taskMenuEntry(page: Page, entry: TaskMenuEntry) {
  return taskMenu(page).getByTestId(TEST_IDS.vacation.taskMenu[entry]);
}

/** Opens a task's menu and presses one of its entries. */
export async function chooseFromTaskMenu(
  page: Page,
  title: string,
  entry: TaskMenuEntry,
) {
  await openTaskMenu(page, title);
  await taskMenuEntry(page, entry).click();
}

/** The button in a task's row that shows who has the task and opens the
 * list of people to give it to. Its accessible name says whose it is. */
export function taskWhoButton(page: Page, title: string) {
  return taskRow(page, title).getByTestId(TEST_IDS.vacation.task.who);
}

/** The list of people a task can be given to, once it is open. Like the
 * task's menu it is at the end of the page. */
export function giveMenu(page: Page) {
  return page.getByTestId(TEST_IDS.vacation.giveMenu.group);
}

/**
 * Opens the list of people for a task and gives the task to one of them:
 * to the member who is signed in ("me"), or to the person with this name.
 */
export async function giveTaskTo(
  page: Page,
  title: string,
  who: "me" | { name: string },
) {
  // A list that was just closed stays in the page while it fades.
  await expect(giveMenu(page)).toHaveCount(0);
  await taskWhoButton(page, title).click();
  const entry =
    who === "me"
      ? giveMenu(page).getByTestId(TEST_IDS.vacation.giveMenu.me)
      : giveMenu(page)
          .getByTestId(TEST_IDS.vacation.giveMenu.person)
          .filter({ hasText: who.name });
  await entry.click();
}

/** The lines of "Who has what", one per person and a last one for the
 * tasks nobody has. Each is a button that shows only that line's tasks. */
export function shareLines(page: Page) {
  return page.getByTestId(TEST_IDS.vacation.share.line);
}

/**
 * Changes a task and waits for the server to confirm the update, as
 * untilSaved does for a list item: the page updates optimistically, and a
 * reload cancels a write still in flight.
 */
export async function untilTaskSaved(page: Page, action: () => Promise<void>) {
  const saved = page.waitForResponse(
    (response) =>
      /\/rest\/v1\/vacation_tasks/.test(response.url()) &&
      response.request().method() === "PATCH",
  );
  await action();
  expect((await saved).ok()).toBe(true);
}
