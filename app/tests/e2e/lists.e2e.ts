import { expect, test } from "@playwright/test";
import {
  addShoppingItem,
  addTodo,
  delayItemInserts,
  EMPTY_LIST_TEXT,
  listItem,
  openList,
  removeListItem,
  signIn,
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
    await signIn(page, user);
    await openList(page, "To-dos");
    await expect(page.getByText(EMPTY_LIST_TEXT)).toBeVisible();
    const input = page.getByLabel("Add a to-do");

    await test.step("an empty title is ignored", async () => {
      await input.fill("   ");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByText(EMPTY_LIST_TEXT)).toBeVisible();
    });

    await test.step("Enter adds and keeps focus in the input", async () => {
      await addTodo(page, "Water the plants");
      await expect(listItem(page, "Water the plants")).toBeVisible();
      await expect(input).toBeFocused();
      await expect(input).toHaveValue("");
    });

    await test.step("the Add button adds too, in list order", async () => {
      await input.fill("Take out the bins");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByRole("checkbox")).toHaveText([
        "Water the plants",
        "Take out the bins",
      ]);
    });

    // A string icon name would render as text (or need an icon font) instead.
    await test.step("the remove button is a drawn icon, named for screen readers", async () => {
      const removeButton = page.getByRole("button", { name: "Remove" }).first();
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
      await expect(page.getByRole("checkbox")).toHaveCount(1);
    });
  });

  test("shopping: add with and without quantity, check and remove are saved", async ({
    page,
  }) => {
    await signIn(page, user);
    await openList(page, "Shopping");
    await expect(page.getByText(EMPTY_LIST_TEXT)).toBeVisible();
    const input = page.getByLabel("Item", { exact: true });

    await test.step("an empty item is ignored", async () => {
      await addShoppingItem(page, "   ", "2");
      await expect(page.getByText(EMPTY_LIST_TEXT)).toBeVisible();
    });

    await test.step("adding clears both fields and keeps focus in the item field", async () => {
      await addShoppingItem(page, "Apples", "6");
      await expect(listItem(page, "Apples (6)")).toBeVisible();
      await expect(input).toBeFocused();
      await expect(input).toHaveValue("");
      await expect(page.getByLabel("Quantity (optional)")).toHaveValue("");
      await addShoppingItem(page, "Bread");
      await addShoppingItem(page, "Milk");
      await expect(page.getByRole("checkbox")).toHaveText([
        "Apples (6)",
        "Bread",
        "Milk",
      ]);
    });

    await test.step("check one, remove another", async () => {
      await untilSaved(page, () => listItem(page, "Apples (6)").click());
      await untilSaved(page, () => removeListItem(page, "Bread"));
      await expect(page.getByRole("checkbox")).toHaveText([
        "Milk",
        "Apples (6)",
      ]);
    });

    await test.step("a reload shows the saved state, checked items last", async () => {
      await page.reload();
      await expect(page.getByRole("checkbox")).toHaveText([
        "Milk",
        "Apples (6)",
      ]);
      await expect(listItem(page, "Apples (6)")).toBeChecked();
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
    { name: "To-dos", table: "todo_items", flag: "done", add: addTodo },
    {
      name: "Shopping",
      table: "shopping_items",
      flag: "checked",
      add: addShoppingItem,
    },
  ] as const) {
    test(`${list.name.toLowerCase()}: checking or removing an item while its add is saving`, async ({
      page,
    }) => {
      const checkedTitle = `Checked early ${runId}`;
      const removedTitle = `Removed early ${runId}`;
      await signIn(page, user);
      await openList(page, list.name);
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
