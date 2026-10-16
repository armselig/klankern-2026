import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { addDays, localDateOf } from "../../app/utils/local-date";
import { ROUTES } from "../../app/utils/routes";
import {
  accountButton,
  addShoppingItem,
  addTodo,
  dashboardTile,
  dashboardTileLink,
  dragOnWhiteboard,
  expectStrokeCount,
  fillRecipeForm,
  homeLink,
  listItem,
  memberAvatar,
  openAccountMenu,
  openVersionMenu,
  openList,
  openRecipes,
  openVacations,
  openWhiteboard,
  phaseButton,
  recipeLink,
  recipeListEmpty,
  saveRecipeForm,
  openSignedIn,
  taskMoreButton,
  untilSaved,
  vacationLink,
  vacationListEmpty,
  vacationTask,
  whiteboardPreview,
} from "../support/e2e-ui";
import { EARLIER_TRIP_TITLE, addEarlierTrip } from "../support/earlier-trip";
import { recipeRow } from "../support/rls-rows";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// The WCAG rule for this project, checked on every run: axe scans each page
// in a realistic state (lists with items, the invite dialog open). Only
// serious and critical findings fail the test, so it guards against real
// barriers rather than style nits.
//
// Every scan runs twice, once per color scheme: light and dark mode have a
// palette each (assets/css/theme.css), and a pair of colors that passes in
// one says nothing about the other.

/** The device settings the app has a palette for, and the veil that marks
 * hover and focus on the primary color in each, with its strength (see
 * assets/css/hover-contrast.css). */
const COLOR_SCHEMES = [
  {
    colorScheme: "light",
    bodyClass: /body--light/,
    veil: "rgba(0, 0, 0, 0.3)",
  },
  {
    colorScheme: "dark",
    bodyClass: /body--dark/,
    veil: "rgba(255, 255, 255, 0.65)",
  },
] as const;

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

/** A radius token of the theme in pixels, as the browser computes a corner:
 * the tokens are in rem, so they depend on the root's font size. */
async function radiusOf(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.borderRadius = `var(${name})`;
    document.body.append(probe);
    const radius = getComputedStyle(probe).borderTopLeftRadius;
    probe.remove();
    return radius;
  }, token);
}

/** Scans the page and records its blocking findings in a readable form.
 * Soft, so one run reports the findings of every page, not just the first. */
async function expectNoBlockingViolations(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    // The Nuxt DevTools button only exists in `nuxt dev`.
    .exclude("#nuxt-devtools-container")
    .analyze();
  const blocking = violations
    .filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ""))
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
  expect.soft(blocking, `accessibility violations on ${name}`).toEqual([]);
}

/**
 * Waits until a hovered or keyboard-focused control shows its highlight in
 * full. Quasar fades the highlight in (a veil over the control), and a scan
 * in the middle of that would measure a state nobody sees for long.
 */
async function untilHighlightShown(control: Locator) {
  const veil = control.locator(".q-focus-helper");
  await expect
    .poll(() => veil.evaluate((el) => getComputedStyle(el).opacity))
    .not.toBe("0");
  await control.evaluate((el) =>
    Promise.all(
      el
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    ),
  );
}

/**
 * Waits until nothing on the page is fading in or out any more. The account
 * menu fades, and a scan in the middle of that reports its half-transparent
 * text as too low in contrast.
 *
 * One look is not enough: a fade starts a frame or two after its element is
 * put into the page, so a look right after the element appeared can find
 * nothing running yet. The page has to stay still for a few frames in a row.
 * An animation without an end (a spinner) is not waited for.
 */
async function untilFadesEnd(page: Page) {
  await page.evaluate(async () => {
    const STILL_FRAMES = 3;
    const nextFrame = () =>
      new Promise((resolve) => requestAnimationFrame(resolve));
    for (let stillFrames = 0; stillFrames < STILL_FRAMES;) {
      const ending = document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().endTime !== Infinity,
        );
      if (ending.length === 0) stillFrames++;
      else {
        stillFrames = 0;
        await Promise.allSettled(ending.map((animation) => animation.finished));
      }
      await nextFrame();
    }
  });
}

for (const { colorScheme, bodyClass, veil } of COLOR_SCHEMES) {
  test.describe(`accessibility in ${colorScheme} mode`, () => {
    test.use({ colorScheme });

    let user: TestUser;
    let householdId: string;

    test.beforeAll(async () => {
      user = await createTestUser("e2e-a11y");
      householdId = await createHousehold(user.client, `E2E a11y ${runId}`);
    });

    test.afterAll(async () => {
      await deleteTestData([householdId], [user]);
    });

    test("signed-out pages have no serious accessibility violations", async ({
      page,
    }) => {
      await page.goto(ROUTES.login);
      await expect(page.getByText("Sign in to Klankern")).toBeVisible();
      // Otherwise a scan in dark mode could pass on the light palette.
      await expect(page.locator("body")).toHaveClass(bodyClass);
      await expectNoBlockingViolations(page, "the login page");
      await openVersionMenu(page);
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the version menu");

      await page.goto(ROUTES.join("some-code"));
      await expect(
        page.getByText("Join your household", { exact: true }),
      ).toBeVisible();
      await expectNoBlockingViolations(page, "the join page");
    });

    test("signed-in pages have no serious accessibility violations", async ({
      page,
    }) => {
      // One walk through every signed-in page, scanned in each state: with
      // the week's proposal it took more than the default 2 minutes on CI.
      test.setTimeout(240_000);
      await openSignedIn(page, user);
      await expect(page.getByText(`E2E a11y ${runId}`)).toBeVisible();
      await expect(page).toHaveTitle("Klankern");
      // The members and the tiles' content arrive after the household; the
      // scan should see them.
      await expect(memberAvatar(page, user.email)).toBeVisible();
      await expect(dashboardTile(page, "todos")).toContainText(
        "Nothing to do.",
      );
      await expect(dashboardTile(page, "shopping")).toContainText(
        "Nothing to buy.",
      );
      await expect(dashboardTile(page, "whiteboard")).toContainText(
        "Nothing drawn yet.",
      );
      await expect(dashboardTile(page, "recipes")).toContainText(
        "None saved yet.",
      );
      await expect(dashboardTile(page, "vacations")).toContainText(
        "No vacation planned.",
      );
      await expectNoBlockingViolations(page, "the dashboard");

      // A tile marks hover and keyboard focus with an outline; scanned with
      // each, so that a highlight laid over a tile's text one day is seen.
      await test.step("a highlighted tile keeps its contrast", async () => {
        const todosLink = page.getByRole("link", { name: "To-dos" });
        await todosLink.hover();
        await expectNoBlockingViolations(
          page,
          "the dashboard with a tile hovered",
        );

        // Tab from "To-dos" moves the keyboard focus to "Shopping".
        await todosLink.focus();
        await page.keyboard.press("Tab");
        await expect(
          page.getByRole("link", { name: "Shopping" }),
        ).toBeFocused();
        await expectNoBlockingViolations(
          page,
          "the dashboard with a tile focused",
        );
      });

      // The outline of a highlighted tile and of the highlighted wordmark is
      // drawn along a corner written into their own styles; it has to follow
      // the theme's radii, or it misses the card's corner.
      await test.step("the highlights' corners follow the theme's radii", async () => {
        const cardRadius = await radiusOf(page, "--radius-card");
        expect
          .soft(
            await dashboardTileLink(page, "todos").evaluate(
              (link) => getComputedStyle(link, "::after").borderTopLeftRadius,
            ),
            "the corner of a tile's highlight",
          )
          .toBe(cardRadius);
        await expect
          .soft(homeLink(page), "the corner of the wordmark's highlight")
          .toHaveCSS(
            "border-top-left-radius",
            await radiusOf(page, "--radius-control"),
          );
      });

      // The pen strokes under the wordmark and the tiles' headings are
      // drawn by one component; a stroke placed on a tile's link would make
      // the link's stretched area its heading's alone.
      await test.step("the pen strokes leave the links as they were", async () => {
        const wordmark = await homeLink(page).boundingBox();
        const stroke = await homeLink(page).locator("svg").boundingBox();
        expect
          .soft(stroke?.width, "the wordmark's stroke spans the word")
          .toBeCloseTo((wordmark?.width ?? 0) - 16, 0);
        const todosCard = dashboardTile(page, "todos").locator(".q-card");
        // elementFromPoint() sees only what is in the viewport.
        await todosCard.scrollIntoViewIfNeeded();
        const card = await todosCard.boundingBox();
        const atCorner = await page.evaluate(
          ([x, y]) =>
            document
              .elementFromPoint(x!, y!)
              ?.closest("a")
              ?.textContent?.trim() ?? null,
          [card!.x + card!.width - 8, card!.y + card!.height - 8],
        );
        expect
          .soft(atCorner, "a press in a tile's corner is its link's")
          .toBe("To-dos");
      });

      await test.step("a highlighted header button shows the theme's veil", async () => {
        // axe can't judge anything in the header: the header's shadow layer
        // lies over it, so axe reports the background as undetermined. A
        // button there has the same highlight as a filled one (see the
        // to-do page below), so the check is that its highlight is the
        // theme's veil as well, shown in full: Quasar's own would be a
        // share of the text color at 15 percent.
        const headerButton = accountButton(page, user.email);
        await headerButton.hover();
        await untilHighlightShown(headerButton);
        const headerHighlight = headerButton.locator(".q-focus-helper");
        await expect
          .soft(headerHighlight, "the highlight of a header button")
          .toHaveCSS("background-color", veil);
        await expect
          .soft(headerHighlight, "the strength of a header button's highlight")
          .toHaveCSS("opacity", "1");
      });

      await openAccountMenu(page);
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the account menu");
      await page
        .getByRole("button", { name: "Invite a family member" })
        .click();
      await expect(page.getByLabel("Invite link")).toHaveValue(/.+/);
      // The dialog takes the menu's place; the scan waits until it is gone.
      await expect(page.getByRole("group", { name: "Account" })).toHaveCount(0);
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the invite dialog");
      await page.getByRole("button", { name: "Close" }).click();
      // The menu entry that opened the dialog is gone; the focus must not be
      // lost with it.
      await expect(accountButton(page, user.email)).toBeFocused();

      await openList(page, "todos");
      await expect(page).toHaveTitle("To-dos · Klankern");
      await expectNoBlockingViolations(page, "the empty to-do list");

      // In light mode the text on the primary color is close to the contrast
      // limit, and a highlight that moves the background towards the text
      // takes it below (see assets/css/hover-contrast.css). Checked for hover
      // and for keyboard focus, which is marked more strongly than hover.
      await test.step("highlighted controls on the primary color keep their contrast", async () => {
        const addButton = page.getByRole("button", {
          name: "Add",
          exact: true,
        });
        await addButton.hover();
        await untilHighlightShown(addButton);
        await expectNoBlockingViolations(
          page,
          "the to-do list with a filled button hovered",
        );

        // Off the button, so the focus is scanned without the hover. Tab
        // from the field moves the keyboard focus to "Add".
        await page.mouse.move(0, 0);
        await page.getByLabel("Add a to-do").focus();
        await page.keyboard.press("Tab");
        await expect(addButton).toBeFocused();
        await untilHighlightShown(addButton);
        await expectNoBlockingViolations(
          page,
          "the to-do list with a filled button focused",
        );
      });

      await addTodo(page, "Open item");
      await addTodo(page, "Done item");
      await untilSaved(page, () => listItem(page, "Done item").click());
      await expectNoBlockingViolations(page, "the to-do list");

      await page.getByRole("link", { name: "Klankern" }).click();
      await openList(page, "shopping");
      await addShoppingItem(page, "Apples", "6");
      await addShoppingItem(page, "Bread");
      await untilSaved(page, () => listItem(page, "Bread").click());
      await expectNoBlockingViolations(page, "the shopping list");

      await page.getByRole("link", { name: "Klankern" }).click();
      await openWhiteboard(page);
      await expect(page).toHaveTitle("Whiteboard · Klankern");
      await expectNoBlockingViolations(page, "the empty whiteboard");
      await dragOnWhiteboard(page, [
        [0.2, 0.2],
        [0.6, 0.6],
      ]);
      await expectStrokeCount(page, 1);
      await page.getByRole("radio", { name: "Eraser" }).click();
      await expectNoBlockingViolations(
        page,
        "the whiteboard with the eraser selected",
      );

      // A flat button's highlight is in its text's color and moves the
      // background towards the text (see assets/css/hover-contrast.css), so
      // "Cancel" is scanned with it. The dialog opens with the focus on
      // "Clear"; Shift+Tab moves it to "Cancel" as a keyboard would.
      await test.step("the clear dialog's flat button keeps its contrast when highlighted", async () => {
        await page.getByRole("button", { name: "Clear board" }).click();
        const cancel = page.getByRole("button", { name: "Cancel" });
        await expect(cancel).toBeVisible();
        await untilFadesEnd(page);
        await expectNoBlockingViolations(page, "the clear dialog");

        await page.keyboard.press("Shift+Tab");
        await expect(cancel).toBeFocused();
        await untilHighlightShown(cancel);
        await expectNoBlockingViolations(
          page,
          "the clear dialog with Cancel focused",
        );

        await page.getByRole("button", { name: "Clear", exact: true }).focus();
        await cancel.hover();
        await untilHighlightShown(cancel);
        await expectNoBlockingViolations(
          page,
          "the clear dialog with Cancel hovered",
        );
        await cancel.click();
      });

      await page.getByRole("link", { name: "Klankern" }).click();
      // The tiles with what the steps above left behind: counts, entries
      // and the drawing.
      await expect(dashboardTile(page, "todos")).toContainText("1 open");
      await expect(dashboardTile(page, "shopping")).toContainText("1 to buy");
      await expect(whiteboardPreview(page)).toBeVisible();
      await expectNoBlockingViolations(page, "the dashboard with filled tiles");
      await openRecipes(page);
      await expect(page).toHaveTitle("Recipes · Klankern");
      await expect(recipeListEmpty(page)).toBeVisible();
      await expectNoBlockingViolations(page, "the empty recipe list");

      await page.getByRole("link", { name: "New recipe" }).click();
      await expect(page).toHaveTitle("New recipe · Klankern");
      // Saved without a title first, to scan the form with its error shown.
      await page.getByLabel("Title").fill(" ");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Give the recipe a title.")).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the recipe form with an error");

      await fillRecipeForm(page, {
        title: "Pancakes",
        servings: "4",
        ingredients: [["Flour", "250 g"], ["Eggs"]],
        instructions: "Mix.\nFry.",
      });
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the filled recipe form");

      await saveRecipeForm(page);
      await expect(page).toHaveTitle("Pancakes · Klankern");
      await expect(
        page.getByRole("checkbox", { name: "Flour (250 g)" }),
      ).toBeChecked();
      await expectNoBlockingViolations(page, "a recipe");

      // A notice is gone after a few seconds, so it is scanned while it
      // shows, once it has faded in.
      await page.getByRole("button", { name: "Add to shopping list" }).click();
      const notice = page.getByText("2 items added to the shopping list");
      await expect(notice).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(
        page,
        "a recipe with the notice of added items",
      );
      // Gone before the next scans: a notice that is fading out is
      // translucent, and on a slow runner one was still there when the
      // empty list of vacations was scanned, below 4.5:1.
      await expect(notice).toHaveCount(0);

      await page.getByRole("link", { name: "All recipes" }).click();
      await expect(recipeLink(page, "Pancakes")).toBeVisible();
      await expectNoBlockingViolations(page, "the recipe list");

      await page.getByRole("link", { name: "Klankern" }).click();
      await openVacations(page);
      await expect(page).toHaveTitle("Vacations · Klankern");
      await expect(vacationListEmpty(page)).toBeVisible();
      await expectNoBlockingViolations(page, "the empty list of vacations");

      // An earlier trip, whose tasks the new one starts with.
      // Loaded afresh, so the page holds all of its tasks (see vacations.e2e.ts).
      await addEarlierTrip(user, householdId);
      await page.reload();
      await expect(vacationLink(page, EARLIER_TRIP_TITLE)).toBeVisible();

      const today = localDateOf(new Date());
      await page.getByRole("link", { name: "Add vacation" }).click();
      await expect(page).toHaveTitle("New vacation · Klankern");
      // Saved with a title of spaces first, to scan the form with its error.
      await page.getByLabel("Title").fill(" ");
      await page.getByLabel("From", { exact: true }).fill(addDays(today, 10));

      // Quasar's calendar for a day, and its select for the tasks.
      await page.getByRole("button", { name: "Until: pick a day" }).click();
      const calendar = page.getByRole("dialog", { name: "Until: pick a day" });
      await expect(calendar).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the calendar for a day");
      await page.keyboard.press("Escape");
      await expect(calendar).toHaveCount(0);
      await page.getByLabel("Until", { exact: true }).fill(addDays(today, 17));

      await page
        .getByRole("combobox", { name: "Start with the tasks of" })
        .click();
      await expect(page.getByRole("listbox")).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the choice of tasks to copy");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("listbox")).toHaveCount(0);

      await page.getByRole("button", { name: "Add vacation" }).click();
      await expect(page.getByText("Give the vacation a title.")).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the vacation form with an error");

      await page.getByLabel("Title").fill("Winter week by the sea");
      await page.getByRole("button", { name: "Add vacation" }).click();
      await expect(page).toHaveTitle("Winter week by the sea · Klankern");
      // With a done task among the open ones, and a folded phase opened.
      await vacationTask(page, "Clothes").click();
      await expect(vacationTask(page, "Clothes")).toBeChecked();
      await phaseButton(page, "during").click();
      await expect(vacationTask(page, "Return the key")).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "a vacation");

      await taskMoreButton(page, "Toothbrushes").click();
      const taskMenu = page.getByRole("group", { name: "More: Toothbrushes" });
      await expect(taskMenu).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "a task's menu");

      await taskMenu.getByRole("button", { name: "Edit" }).click();
      await expect(page.getByLabel("Task", { exact: true })).toBeFocused();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "a task being renamed");
      await page.keyboard.press("Escape");

      // The people of the trip: the member took a task, so its row shows a
      // picture.
      await page
        .getByRole("button", { name: "Nobody yet: Toothbrushes" })
        .click();
      const people = page.getByRole("group", {
        name: "Give to…: Toothbrushes",
      });
      await expect(people).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the list of people to give to");
      await people.getByRole("button", { name: "Me", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Yours: Toothbrushes" }),
      ).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "a vacation with a task taken");

      await taskMoreButton(page, "Toothbrushes").click();
      await page
        .getByRole("group", { name: "More: Toothbrushes" })
        .getByRole("button", { name: "Reject" })
        .click();
      await expect(page.getByLabel("Why not?")).toBeFocused();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the reject dialog");
      await page.getByLabel("Why not?").fill("No room in the bag.");
      await page.getByRole("button", { name: "Reject task" }).click();
      await expect(
        page.getByText(/said no: “No room in the bag\.”/),
      ).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "a rejected task with its reason");

      // A pressed line of "Who has what": its frame, and the line under it.
      const nobodysLine = page.getByRole("button", {
        name: /^Nobody yet ?\d+$/,
      });
      await nobodysLine.click();
      await expect(
        page.getByText(/^Only the open tasks nobody has\./),
      ).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the tasks of one line alone");
      await nobodysLine.click();

      await page.getByRole("button", { name: "Change people" }).click();
      await page.getByLabel("Add a name").fill("Mia");
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("checkbox", { name: "Mia is coming" }),
      ).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the people of a vacation");
      await page.getByRole("button", { name: "Done" }).click();

      // The trip's meals: the plan of its days, empty, then with a dinner,
      // the notice of the shopping run, an entry's menu and the dialog that
      // moves an entry.
      await page.getByRole("link", { name: /^Meals/ }).click();
      await expect(page).toHaveTitle("Meals · Klankern");
      await expect(
        page.getByRole("heading", { name: /^Trip to Winter week by the sea/ }),
      ).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the meals of a trip, empty");

      await page
        .getByRole("button", { name: /^Add dinner on / })
        .first()
        .click();
      await page.getByRole("button", { name: "Pancakes" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Pancakes" })).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the meals of a trip");

      await page
        .getByRole("button", {
          name: /^Put 2 ingredients on the shopping list/,
        })
        .click();
      // The notice is scanned while it shows, once it has faded in, and is
      // gone before the next scans (see the recipe above).
      const added = page.getByText(/^2 items added to the shopping list/);
      await expect(added).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(
        page,
        "the meals of a trip with the notice of added items",
      );
      await expect(added).toHaveCount(0);

      await page.getByRole("button", { name: "More: Pancakes" }).click();
      await expect(
        page.getByRole("group", { name: "More: Pancakes" }),
      ).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the menu of a planned meal");
      await page.getByRole("button", { name: "Move", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Move Pancakes" }),
      ).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the dialog that moves a meal");
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page.goBack();
      await expect(page.getByRole("link", { name: /^Meals/ })).toContainText(
        "1 dinner planned",
      );
      await expectNoBlockingViolations(
        page,
        "a vacation with its meals linked",
      );

      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await expect(page.getByLabel("Title")).toBeFocused();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "a vacation being edited");

      await page.getByRole("button", { name: "Remove vacation" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(
        page,
        "the dialog that removes a vacation",
      );
      await page.getByRole("button", { name: "Cancel" }).last().click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page.getByRole("link", { name: "All vacations" }).click();
      await expect(vacationLink(page, "Winter week by the sea")).toBeVisible();
      await expectNoBlockingViolations(page, "the list of vacations");

      await page.getByRole("link", { name: "Klankern" }).click();
      await expect(dashboardTile(page, "vacations")).toContainText(
        "Winter week by the sea",
      );
      await expectNoBlockingViolations(page, "the dashboard with a vacation");

      // The one recipe is what the Tonight tile proposes.
      await expect(dashboardTile(page, "tonight")).toContainText("Pancakes");
      await expectNoBlockingViolations(page, "the dashboard with a dinner");

      // Named "Tomorrow" from 17:00 on.
      await page.getByRole("link", { name: /^(Tonight|Tomorrow)$/ }).click();
      await expect(page).toHaveTitle("Meals · Klankern");
      // The days are drawn: each has its date's add button, and the days
      // before yesterday are folded.
      await expect(
        page.getByRole("button", { name: /^Add to / }).first(),
      ).toBeVisible();
      await expectNoBlockingViolations(page, "the meal plan");

      await page
        .getByRole("button", { name: /^Add to / })
        .first()
        .click();
      await expect(page.getByLabel("What will you eat?")).toBeFocused();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(
        page,
        "the dialog that adds a meal of any slot",
      );
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page
        .getByRole("button", { name: /^Add dinner on / })
        .first()
        .click();
      await expect(page.getByLabel("What will you eat?")).toBeFocused();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the dialog that adds a dinner");
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // "Fill my week" on next week: the proposal with its locks and
      // re-rolls, and the note about one recipe. The trip above may have a
      // dinner on one of its days.
      await page.goto(
        `${ROUTES.meals}?week=${addDays(localDateOf(new Date()), 7)}`,
      );
      await page.getByRole("button", { name: "Fill my week" }).click();
      await expect(
        page.getByRole("button", { name: /^Keep the dinner for / }).first(),
      ).toBeVisible();
      await expectNoBlockingViolations(page, "the week's proposal");
      await page.getByRole("button", { name: "Cancel" }).click();

      // The kids: a child is added on the dashboard, a refusal recorded on
      // a dinner of yesterday, and the record read on /kids.
      await page.getByRole("link", { name: "Klankern" }).click();
      await page.getByRole("button", { name: "Add child" }).click();
      await expect(page.getByLabel("Name")).toBeFocused();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the dialog that adds a child");
      await page.getByLabel("Name").fill("Mia");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Mia: rename or remove" }),
      ).toBeVisible();
      await expectNoBlockingViolations(page, "the dashboard with a child");

      const yesterday = addDays(localDateOf(new Date()), -1);
      const { data: soup, error: soupError } = await user.client
        .from("recipes")
        .insert({ ...recipeRow(user, householdId), title: "Lentil soup" })
        .select("id")
        .single();
      if (soupError) throw soupError;
      const { error: dinnerError } = await user.client
        .from("meal_plan_entries")
        .insert({
          household_id: householdId,
          date: yesterday,
          slot: "dinner",
          recipe_id: soup.id,
          created_by: user.userId,
        });
      if (dinnerError) throw dinnerError;
      await page.goto(`${ROUTES.meals}?week=${yesterday}`);
      await page.getByRole("button", { name: "More: Lentil soup" }).click();
      await page.getByRole("button", { name: "How did the kids eat?" }).click();
      await expect(
        page.getByRole("radio", { name: "Ate it" }).first(),
      ).toBeChecked();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "the dialog for the kids' meal");
      await page.getByRole("radio", { name: "Refused" }).click();
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText("Refused: Mia")).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(page, "a dinner a child refused");

      await page.goto(ROUTES.kids);
      await expect(page).toHaveTitle("Kids · Klankern");
      await expect(
        page.getByRole("link", { name: "Lentil soup" }),
      ).toBeVisible();
      await expectNoBlockingViolations(page, "what the kids refused");
    });
  });
}
