import { expect, test } from "@playwright/test";
import { addDays, localDateOf } from "../../app/utils/local-date";
import { ROUTES } from "../../app/utils/routes";
import { TEST_IDS } from "../../app/utils/test-ids";

import {
  addShoppingItem,
  addTodo,
  addVacation,
  dashboardTile,
  dashboardTileEmpty,
  dashboardTileEntries,
  dragOnWhiteboard,
  expectStrokeCount,
  fillRecipeForm,
  homeLink,
  listItem,
  openList,
  openRecipes,
  openVacations,
  openWhiteboard,
  saveRecipeForm,
  openSignedIn,
  untilSaved,
  vacationLink,
  whiteboardPreview,
} from "../support/e2e-ui";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  joinHousehold,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// The dashboard's tiles: each says what its page holds, follows the other
// members' changes live, and leads to the page wherever it is pressed.

test.describe("the dashboard's tiles", () => {
  let userA: TestUser;
  let userB: TestUser;
  let householdId: string;

  test.beforeAll(async () => {
    [userA, userB] = await Promise.all([
      createTestUser("e2e-dash-a"),
      createTestUser("e2e-dash-b"),
    ]);
    householdId = await createHousehold(userA.client, `E2E dash ${runId}`);
    await joinHousehold(userA, userB, householdId);
  });

  test.afterAll(async () => {
    await deleteTestData([householdId], [userA, userB]);
  });

  test("the tiles follow another member's changes and lead to their pages", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    // A stays on the dashboard and only watches; B makes the changes.
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await openSignedIn(pageA, userA);
    await openSignedIn(pageB, userB);

    await test.step("a new household's tiles say that there is nothing yet", async () => {
      await expect(dashboardTileEmpty(pageA, "todos")).toBeVisible();

      await expect(dashboardTileEmpty(pageA, "shopping")).toBeVisible();

      await expect(dashboardTileEmpty(pageA, "whiteboard")).toBeVisible();

      await expect(dashboardTileEmpty(pageA, "recipes")).toBeVisible();

      await expect(dashboardTileEmpty(pageA, "vacations")).toBeVisible();
    });

    await test.step("a to-do added by B is counted and named, and gone once done", async () => {
      await openList(pageB, "todos");
      await addTodo(pageB, "Call the plumber");
      const todosCount = dashboardTile(pageA, "todos").getByTestId(
        TEST_IDS.dashboard.tileCount,
      );
      await expect(todosCount).toHaveText("1 open");
      await expect(dashboardTileEntries(pageA, "todos")).toHaveText([
        "Call the plumber",
      ]);

      await untilSaved(pageB, () =>
        listItem(pageB, "Call the plumber").click(),
      );
      await expect(dashboardTileEmpty(pageA, "todos")).toBeVisible();
    });

    await test.step("a longer list is cut short, and says by how much", async () => {
      await homeLink(pageB).click();
      await openList(pageB, "shopping");
      for (const title of ["Milk", "Bread", "Tomatoes", "Butter", "Coffee"]) {
        await addShoppingItem(pageB, title);
        await expect(listItem(pageB, title)).toBeVisible();
      }
      await expect(
        dashboardTile(pageA, "shopping").getByTestId(
          TEST_IDS.dashboard.tileCount,
        ),
      ).toHaveText("5 to buy");
      await expect(dashboardTileEntries(pageA, "shopping")).toHaveText([
        "Milk",
        "Bread",
        "Tomatoes",
        "and 2 more",
      ]);
    });

    await test.step("a stroke drawn by B shows in the whiteboard's tile", async () => {
      await homeLink(pageB).click();
      await openWhiteboard(pageB);
      await dragOnWhiteboard(pageB, [
        [0.2, 0.2],
        [0.6, 0.6],
      ]);
      await expectStrokeCount(pageB, 1);
      await expect(
        whiteboardPreview(pageA).getByTestId(TEST_IDS.whiteboard.stroke),
      ).toHaveCount(1);
    });

    await test.step("a recipe saved by B is counted and named", async () => {
      await homeLink(pageB).click();
      await openRecipes(pageB);
      await pageB.getByTestId(TEST_IDS.recipe.list.add).click();
      await fillRecipeForm(pageB, { title: "Pancakes", instructions: "Fry." });
      await saveRecipeForm(pageB);
      await expect(
        dashboardTile(pageA, "recipes").getByTestId(
          TEST_IDS.dashboard.tileCount,
        ),
      ).toHaveText("1 saved");
      await expect(dashboardTileEntries(pageA, "recipes")).toHaveText([
        "Pancakes",
      ]);
    });

    await test.step("a vacation added by B is named with where it stands and its open tasks", async () => {
      const today = localDateOf(new Date());
      await homeLink(pageB).click();
      await openVacations(pageB);
      await addVacation(pageB, {
        title: "Easter at grandma's",
        kind: "hotel",
        from: addDays(today, 20),
        until: addDays(today, 24),
      });
      // The hotel template's tasks, all open, after the trip and its day.
      await expect(dashboardTileEntries(pageA, "vacations")).toHaveText([
        "Easter at grandma's",
        "in 20 days",
        "25 tasks open",
      ]);
    });

    await test.step("a second vacation that starts later is only counted", async () => {
      const today = localDateOf(new Date());
      await pageB.getByTestId(TEST_IDS.vacation.view.back).click();
      await addVacation(pageB, {
        title: "Summer at the lake",
        from: addDays(today, 200),
        until: addDays(today, 214),
      });
      await expect(dashboardTileEntries(pageA, "vacations")).toHaveText([
        "Easter at grandma's",
        "in 20 days",
        "25 tasks open",
        "and 1 more vacation",
      ]);
    });

    await test.step("B's own dashboard shows the same without a page load", async () => {
      await homeLink(pageB).click();
      await expect(dashboardTileEmpty(pageB, "todos")).toBeVisible();

      await expect(
        dashboardTile(pageB, "shopping").getByTestId(
          TEST_IDS.dashboard.tileCount,
        ),
      ).toHaveText("5 to buy");

      await expect(whiteboardPreview(pageB)).toBeVisible();
      await expect(
        dashboardTile(pageB, "recipes").getByTestId(
          TEST_IDS.dashboard.tileCount,
        ),
      ).toHaveText("1 saved");

      await expect(dashboardTileEntries(pageB, "vacations").nth(2)).toHaveText(
        "25 tasks open",
      );
    });

    await test.step("the roster's button opens the invite dialog and gets the focus back", async () => {
      // With the keyboard, whose user has to find the focus again afterwards.
      const invite = pageA.getByTestId(TEST_IDS.household.inviteButton);

      await invite.focus();
      await pageA.keyboard.press("Enter");
      await expect(pageA.getByTestId(TEST_IDS.invite.link)).toHaveValue(
        new RegExp(`${ROUTES.joinPrefix}.+`),
      );
      await pageA.keyboard.press("Escape");
      await expect(pageA.getByTestId(TEST_IDS.invite.link)).toHaveCount(0);
      await expect(invite).toBeFocused();
    });

    await test.step("a tile leads to its page wherever it is pressed", async () => {
      // On the count, far from the link's own text in the heading.
      const shopping = dashboardTile(pageA, "shopping");

      const box = await shopping.boundingBox();
      if (!box) throw new Error("the shopping tile is not on screen");
      await shopping.click({
        position: { x: box.width / 2, y: box.height - 12 },
      });
      await expect(pageA).toHaveURL(new RegExp(`${ROUTES.shopping}$`));
      // The dashboard loaded the list already: it is there at once.
      await expect(listItem(pageA, "Coffee")).toBeVisible();
    });

    await test.step("the vacations' tile leads to the trip from its lines, and to the list from the rest", async () => {
      await homeLink(pageA).click();
      const tile = dashboardTile(pageA, "vacations");

      // On the line about the tasks, away from the link's own text. By
      // position, as a finger presses: the link lies over the line. The
      // tile is the last one and below the fold of a small screen.
      await tile.scrollIntoViewIfNeeded();
      // The third line: after the title and the day.
      const line = await dashboardTileEntries(pageA, "vacations")
        .nth(2)
        .boundingBox();

      if (!line) throw new Error("the tile's line is not on screen");
      await pageA.mouse.click(line.x + 20, line.y + line.height / 2);
      await expect(pageA).toHaveURL(
        new RegExp(`${ROUTES.vacations}/[0-9a-f-]{36}$`),
      );
      await expect(
        pageA.getByTestId(TEST_IDS.vacation.header.title),
      ).toHaveText("Easter at grandma's");

      await homeLink(pageA).click();
      await tile.getByTestId(TEST_IDS.dashboard.vacationsAll).click();
      await expect(pageA).toHaveURL(new RegExp(`${ROUTES.vacations}$`));
      await expect(vacationLink(pageA, "Summer at the lake")).toBeVisible();
    });

    await contextA.close();
    await contextB.close();
  });
});
