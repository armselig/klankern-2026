import { expect, test } from "@playwright/test";
import { TEST_IDS } from "../../app/utils/test-ids";

import {
  addShoppingItem,
  addTodo,
  delayItemInserts,
  exactly,
  listEmpty,
  listItem,
  listItems,
  openList,
  removeListItem,
  removeListItemButton,
  openSignedIn,
  untilAdded,
  untilSaved,
} from "../support/e2e-ui";
import {
  admin,
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// Milestones 4 and 6 for a single member: adding, checking and removing
// items is saved, and the add forms stay usable for entering several items
// in a row.

test.describe("lists for a single member", () => {
  let user: TestUser;
  let householdId: string;

  test.beforeAll(async () => {
    user = await createTestUser("e2e-lists");
    householdId = await createHousehold(user.client, `E2E lists ${runId}`);
  });

  test.afterAll(async () => {
    await deleteTestData([householdId], [user]);
  });

  test("to-dos: add, check and remove are saved across a reload", async ({
    page,
  }) => {
    await openSignedIn(page, user);
    await openList(page, "todos");
    await expect(listEmpty(page)).toBeVisible();
    const input = page.getByTestId(TEST_IDS.todos.titleInput);

    await test.step("an empty title is ignored", async () => {
      await input.fill("   ");
      await page.getByTestId(TEST_IDS.todos.addButton).click();
      await expect(listEmpty(page)).toBeVisible();
    });

    await test.step("Enter adds and keeps focus in the input", async () => {
      await addTodo(page, "Water the plants");
      await expect(listItem(page, "Water the plants")).toBeVisible();
      await expect(input).toBeFocused();
      await expect(input).toHaveValue("");
    });

    await test.step("the Add button adds too, in list order", async () => {
      await input.fill("Take out the bins");
      await page.getByTestId(TEST_IDS.todos.addButton).click();
      await expect(listItems(page)).toHaveText([
        "Water the plants",
        "Take out the bins",
      ]);
    });

    // A string icon name would render as text (or need an icon font) instead.
    await test.step("the remove button is a drawn icon, named for screen readers", async () => {
      const removeButton = removeListItemButton(page, "Water the plants");
      await expect(removeButton).toHaveAccessibleName("Remove");

      await expect(removeButton.locator("svg")).toBeVisible();
      await expect(removeButton).toHaveText("");
    });

    await test.step("check one, remove the other", async () => {
      await untilSaved(page, () => listItem(page, "Water the plants").click());
      await expect(listItem(page, "Water the plants")).toBeChecked();
      await untilSaved(page, () => removeListItem(page, "Take out the bins"));
      await expect(listItem(page, "Take out the bins")).toHaveCount(0);
    });

    await test.step("a reload shows the saved state", async () => {
      await page.reload();
      await expect(listItem(page, "Water the plants")).toBeChecked();
      await expect(listItems(page)).toHaveCount(1);
    });
  });

  test("shopping: add with and without quantity, check and remove are saved", async ({
    page,
  }) => {
    await openSignedIn(page, user);
    await openList(page, "shopping");
    await expect(listEmpty(page)).toBeVisible();
    const input = page.getByTestId(TEST_IDS.shopping.titleInput);

    await test.step("an empty item is ignored", async () => {
      await addShoppingItem(page, "   ", "2");
      await expect(listEmpty(page)).toBeVisible();
    });

    await test.step("adding clears both fields and keeps focus in the item field", async () => {
      await addShoppingItem(page, "Apples", "6");
      await expect(listItem(page, "Apples (6)")).toBeVisible();
      await expect(input).toBeFocused();
      await expect(input).toHaveValue("");
      await expect(
        page.getByTestId(TEST_IDS.shopping.quantityInput),
      ).toHaveValue("");
      await addShoppingItem(page, "Bread");
      // Saved before the reload below: nothing else waits for this one, as
      // ticking and removing wait for the other two.
      await untilAdded(page, () => addShoppingItem(page, "Milk"));
      await expect(listItems(page)).toHaveText(["Apples (6)", "Bread", "Milk"]);
    });

    await test.step("check one, remove another", async () => {
      await untilSaved(page, () => listItem(page, "Apples (6)").click());
      await untilSaved(page, () => removeListItem(page, "Bread"));
      await expect(listItems(page)).toHaveText(["Milk", "Apples (6)"]);
    });

    await test.step("a reload shows the saved state, checked items last", async () => {
      await page.reload();
      await expect(listItems(page)).toHaveText(["Milk", "Apples (6)"]);
      await expect(listItem(page, "Apples (6)")).toBeChecked();
    });
  });

  // The suite runs with reduced motion, and a row is gone at once. Here the
  // motion is on, and slowed by a style so that the test can look while a
  // row leaves and while a tick is drawn: Vue ends a leave by the computed
  // duration as well as by its event.
  test.describe("with motion on", () => {
    test.use({ reducedMotion: "no-preference" });

    test("a leaving row is not counted, a drawn tick keeps the row's name", async ({
      page,
    }) => {
      const kept = `Kept ${runId}`;
      const ticked = `Ticked ${runId}`;
      const removed = `Removed ${runId}`;
      await openSignedIn(page, user);
      await openList(page, "todos");
      await addTodo(page, kept);
      await addTodo(page, ticked);
      await untilAdded(page, () => addTodo(page, removed));
      await page.addStyleTag({
        content: `.list-row-leave-active { transition-duration: 3s !important; }
          .list-tick--drawing * { animation-duration: 3s !important; }`,
      });
      const count = await listItems(page).count();

      await test.step("a leaving row is inert and not counted", async () => {
        const leaving = page
          .locator("[inert]")
          .getByTestId(TEST_IDS.list.checkbox);
        await removeListItem(page, removed);
        await expect(leaving).toHaveText(exactly(removed));
        // Counted once, not retried: a retried count would pass as soon as
        // the row is gone. The row must still be leaving after the count.
        expect(await listItems(page).count()).toBe(count - 1);
        expect(await listItem(page, removed).count()).toBe(0);
        expect(await leaving.count()).toBe(1);
        await expect(leaving).toHaveCount(0);
      });

      await test.step("the person's tick is drawn, and the row keeps its name", async () => {
        await listItem(page, ticked).click();
        const item = listItem(page, ticked);
        await expect(item).toHaveClass(/list-tick--drawing/);
        await expect(item).toHaveAccessibleName(ticked);
        await expect(item).not.toHaveClass(/list-tick--drawing/);
        await expect(item).toBeChecked();
        await expect(item).toHaveAccessibleName(ticked);
      });
    });
  });

  /** The saved state of an item, read past RLS, to see what reached the database. */
  async function savedItem(
    table: "todo_items" | "shopping_items",
    title: string,
  ) {
    const { data } = await admin
      .from(table)
      .select("*")
      .eq("household_id", householdId)
      .eq("title", title)
      .maybeSingle();
    return data as {
      done?: boolean;
      checked?: boolean;
      deleted_at: string | null;
    } | null;
  }

  // An item can be checked or removed before its add is saved (slow
  // network). The check must not be undone when the add is confirmed, and
  // neither change may reach the server before the item exists there.
  for (const list of [
    {
      key: "todos",
      name: "to-dos",
      table: "todo_items",
      flag: "done",
      add: addTodo,
    },

    {
      key: "shopping",
      name: "shopping",
      table: "shopping_items",
      flag: "checked",
      add: addShoppingItem,
    },
  ] as const) {
    test(`${list.name}: checking or removing an item while its add is saving`, async ({
      page,
    }) => {
      const checkedTitle = `Checked early ${runId}`;
      const removedTitle = `Removed early ${runId}`;
      await openSignedIn(page, user);
      await openList(page, list.key);
      await delayItemInserts(page, 1_500);

      await list.add(page, checkedTitle);
      await listItem(page, checkedTitle).click();
      await list.add(page, removedTitle);
      await removeListItem(page, removedTitle);

      await expect
        .poll(
          async () => (await savedItem(list.table, checkedTitle))?.[list.flag],
        )
        .toBe(true);
      await expect
        .poll(
          async () =>
            (await savedItem(list.table, removedTitle))?.deleted_at ?? null,
        )
        .not.toBeNull();
      await expect(listItem(page, checkedTitle)).toBeChecked();
      await expect(listItem(page, removedTitle)).toHaveCount(0);

      await page.reload();
      await expect(listItem(page, checkedTitle)).toBeChecked();
      await expect(listItem(page, removedTitle)).toHaveCount(0);
    });
  }
});
