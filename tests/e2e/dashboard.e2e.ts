import { expect, test } from "@playwright/test";
import { ROUTES } from "../../app/utils/routes";
import {
  addShoppingItem,
  addTodo,
  dashboardTile,
  dragOnWhiteboard,
  expectStrokeCount,
  fillRecipeForm,
  listItem,
  openList,
  openRecipes,
  openWhiteboard,
  saveRecipeForm,
  signIn,
  untilSaved,
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
    await signIn(pageA, userA);
    await signIn(pageB, userB);

    await test.step("a new household's tiles say that there is nothing yet", async () => {
      await expect(dashboardTile(pageA, "To-dos")).toContainText(
        "Nothing to do.",
      );
      await expect(dashboardTile(pageA, "Shopping")).toContainText(
        "Nothing to buy.",
      );
      await expect(dashboardTile(pageA, "Whiteboard")).toContainText(
        "Nothing drawn yet.",
      );
      await expect(dashboardTile(pageA, "Recipes")).toContainText(
        "None saved yet.",
      );
    });

    await test.step("a to-do added by B is counted and named, and gone once done", async () => {
      await openList(pageB, "To-dos");
      await addTodo(pageB, "Call the plumber");
      const todos = dashboardTile(pageA, "To-dos");
      await expect(todos).toContainText("1 open");
      await expect(todos.getByRole("listitem")).toHaveText([
        "Call the plumber",
      ]);

      await untilSaved(pageB, () =>
        listItem(pageB, "Call the plumber").click(),
      );
      await expect(todos).toContainText("Nothing to do.");
    });

    await test.step("a longer list is cut short, and says by how much", async () => {
      await pageB.getByRole("link", { name: "Klankern" }).click();
      await openList(pageB, "Shopping");
      for (const title of ["Milk", "Bread", "Tomatoes", "Butter", "Coffee"]) {
        await addShoppingItem(pageB, title);
        await expect(listItem(pageB, title)).toBeVisible();
      }
      const shopping = dashboardTile(pageA, "Shopping");
      await expect(shopping).toContainText("5 to buy");
      await expect(shopping.getByRole("listitem")).toHaveText([
        "Milk",
        "Bread",
        "Tomatoes",
        "and 2 more",
      ]);
    });

    await test.step("a stroke drawn by B shows in the whiteboard's tile", async () => {
      await pageB.getByRole("link", { name: "Klankern" }).click();
      await openWhiteboard(pageB);
      await dragOnWhiteboard(pageB, [
        [0.2, 0.2],
        [0.6, 0.6],
      ]);
      await expectStrokeCount(pageB, 1);
      await expect(
        whiteboardPreview(pageA).locator("polyline, circle"),
      ).toHaveCount(1);
    });

    await test.step("a recipe saved by B is counted and named", async () => {
      await pageB.getByRole("link", { name: "Klankern" }).click();
      await openRecipes(pageB);
      await pageB.getByRole("link", { name: "New recipe" }).click();
      await fillRecipeForm(pageB, { title: "Pancakes", instructions: "Fry." });
      await saveRecipeForm(pageB);
      const recipes = dashboardTile(pageA, "Recipes");
      await expect(recipes).toContainText("1 saved");
      await expect(recipes.getByRole("listitem")).toHaveText(["Pancakes"]);
    });

    await test.step("B's own dashboard shows the same without a page load", async () => {
      await pageB.getByRole("link", { name: "Klankern" }).click();
      await expect(dashboardTile(pageB, "To-dos")).toContainText(
        "Nothing to do.",
      );
      await expect(dashboardTile(pageB, "Shopping")).toContainText("5 to buy");
      await expect(whiteboardPreview(pageB)).toBeVisible();
      await expect(dashboardTile(pageB, "Recipes")).toContainText("1 saved");
    });

    await test.step("the roster's button opens the invite dialog and gets the focus back", async () => {
      // With the keyboard, whose user has to find the focus again afterwards.
      const invite = pageA.getByRole("button", { name: "Invite", exact: true });
      await invite.focus();
      await pageA.keyboard.press("Enter");
      await expect(pageA.getByLabel("Invite link")).toHaveValue(
        new RegExp(`${ROUTES.joinPrefix}.+`),
      );
      await pageA.keyboard.press("Escape");
      await expect(pageA.getByLabel("Invite link")).toHaveCount(0);
      await expect(invite).toBeFocused();
    });

    await test.step("a tile leads to its page wherever it is pressed", async () => {
      // On the count, far from the link's own text in the heading.
      const shopping = dashboardTile(pageA, "Shopping");
      const box = await shopping.boundingBox();
      if (!box) throw new Error("the shopping tile is not on screen");
      await shopping.click({
        position: { x: box.width / 2, y: box.height - 12 },
      });
      await expect(pageA).toHaveURL(new RegExp(`${ROUTES.shopping}$`));
      // The dashboard loaded the list already: it is there at once.
      await expect(listItem(pageA, "Coffee")).toBeVisible();
    });

    await contextA.close();
    await contextB.close();
  });
});
