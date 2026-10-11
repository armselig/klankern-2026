import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { ROUTES } from "../../app/utils/routes";
import {
  accountButton,
  addShoppingItem,
  addTodo,
  dashboardTile,
  dragOnWhiteboard,
  expectStrokeCount,
  fillRecipeForm,
  listItem,
  memberAvatar,
  NO_RECIPES_TEXT,
  openAccountMenu,
  openList,
  openRecipes,
  openWhiteboard,
  recipeLink,
  saveRecipeForm,
  signIn,
  untilSaved,
  whiteboardPreview,
} from "../support/e2e-ui";
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

      await page.goto(ROUTES.join("some-code"));
      await expect(
        page.getByText("Join your household", { exact: true }),
      ).toBeVisible();
      await expectNoBlockingViolations(page, "the join page");
    });

    test("signed-in pages have no serious accessibility violations", async ({
      page,
    }) => {
      await signIn(page, user);
      await expect(page.getByText(`E2E a11y ${runId}`)).toBeVisible();
      await expect(page).toHaveTitle("Klankern");
      // The members and the tiles' content arrive after the household; the
      // scan should see them.
      await expect(memberAvatar(page, user.email)).toBeVisible();
      await expect(dashboardTile(page, "To-dos")).toContainText(
        "Nothing to do.",
      );
      await expect(dashboardTile(page, "Shopping")).toContainText(
        "Nothing to buy.",
      );
      await expect(dashboardTile(page, "Whiteboard")).toContainText(
        "Nothing drawn yet.",
      );
      await expect(dashboardTile(page, "Recipes")).toContainText(
        "None saved yet.",
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

      await openList(page, "To-dos");
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
      await openList(page, "Shopping");
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
      await expect(dashboardTile(page, "To-dos")).toContainText("1 open");
      await expect(dashboardTile(page, "Shopping")).toContainText("1 to buy");
      await expect(whiteboardPreview(page)).toBeVisible();
      await expectNoBlockingViolations(page, "the dashboard with filled tiles");
      await openRecipes(page);
      await expect(page).toHaveTitle("Recipes · Klankern");
      await expect(page.getByText(NO_RECIPES_TEXT)).toBeVisible();
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
      await expect(
        page.getByText("2 items added to the shopping list"),
      ).toBeVisible();
      await untilFadesEnd(page);
      await expectNoBlockingViolations(
        page,
        "a recipe with the notice of added items",
      );

      await page.getByRole("link", { name: "All recipes" }).click();
      await expect(recipeLink(page, "Pancakes")).toBeVisible();
      await expectNoBlockingViolations(page, "the recipe list");
    });
  });
}
