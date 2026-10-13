import { expect, test } from "@playwright/test";
import { addDays, localDateOf } from "../../app/utils/local-date";
import { controlRealtimeSocket } from "../support/realtime-socket";
import {
  addVacation,
  chooseFromTaskMenu,
  dashboardTile,
  NO_VACATIONS_TEXT,
  openVacations,
  phaseButton,
  openSignedIn,
  taskMoreButton,
  untilTaskSaved,
  vacationLink,
  vacationPhase,
  vacationTask,
} from "../support/e2e-ui";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  joinHousehold,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";

// The vacation planner, one journey per slice. Slice 1: a trip checklist
// from a template, which two members see and change live.

test.describe("a vacation's checklist, for two members", () => {
  let userA: TestUser;
  let userB: TestUser;
  let householdId: string;

  test.beforeAll(async () => {
    [userA, userB] = await Promise.all([
      createTestUser("e2e-vac-a"),
      createTestUser("e2e-vac-b"),
    ]);
    householdId = await createHousehold(userA.client, `E2E vac ${runId}`);
    await joinHousehold(userA, userB, householdId);
  });

  test.afterAll(async () => {
    await deleteTestData([householdId], [userA, userB]);
  });

  test("a vacation is added from the house template and changed by both members", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const socketA = await controlRealtimeSocket(contextA);
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await openSignedIn(pageA, userA);
    await openSignedIn(pageB, userB);

    // Ten days ahead, so the trip is "before" whatever day the test runs on.
    const today = localDateOf(new Date());
    const from = addDays(today, 10);
    const until = addDays(today, 17);
    const title = "Winter week by the sea";

    await test.step("a new household has no vacation, on the tile and in the list", async () => {
      await expect(dashboardTile(pageB, "Vacations")).toContainText(
        "No vacation planned.",
      );
      await openVacations(pageA);
      await expect(pageA.getByText(NO_VACATIONS_TEXT)).toBeVisible();
    });

    await test.step("A adds a vacation, and it is filled from the house template", async () => {
      await addVacation(pageA, { title, from, until });
      await expect(
        pageA.getByRole("heading", { name: title, level: 2 }),
      ).toBeVisible();
      await expect(pageA.getByText("in 10 days")).toBeVisible();

      // The page follows the trip: the phase of today is open, the later
      // ones are folded to their heading and count.
      const before = vacationPhase(pageA, "Before");
      await expect(phaseButton(pageA, "Before")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await expect(before).toContainText("23 open");
      await expect(before.getByRole("checkbox")).toHaveCount(23);
      await expect(vacationTask(pageA, "Clothes")).toBeVisible();
      await expect(
        vacationTask(pageA, "Coffee pot and espresso powder"),
      ).toBeVisible();

      await expect(phaseButton(pageA, "During")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(vacationPhase(pageA, "During")).toContainText("6 open");
      await expect(vacationPhase(pageA, "Afterwards")).toContainText("4 open");
      await expect(vacationTask(pageA, "Return the key")).toHaveCount(0);

      await phaseButton(pageA, "During").click();
      await expect(vacationTask(pageA, "Return the key")).toBeVisible();
      await phaseButton(pageA, "During").click();
      await expect(vacationTask(pageA, "Return the key")).toHaveCount(0);
    });

    await test.step("B sees it on the tile without reloading, and opens it", async () => {
      const tile = dashboardTile(pageB, "Vacations");
      await expect(tile.getByRole("listitem")).toHaveText([
        title,
        "in 10 days",
        "33 tasks open",
      ]);
      await openVacations(pageB);
      await expect(vacationLink(pageB, title)).toContainText(
        "in 10 days · 33 open",
      );
      await vacationLink(pageB, title).click();
      await expect(vacationTask(pageB, "Clothes")).toBeVisible();
    });

    await test.step("a task added by A appears on B, and the field keeps the focus", async () => {
      const field = pageA.getByLabel("Add a task before the trip");
      await field.fill("Sunscreen");
      await pageA.keyboard.press("Enter");
      await expect(vacationTask(pageA, "Sunscreen")).toHaveCount(1);
      await expect(field).toBeFocused();
      await expect(field).toHaveValue("");
      await expect(vacationTask(pageB, "Sunscreen")).toBeVisible();
      await expect(vacationPhase(pageB, "Before")).toContainText("24 open");
    });

    await test.step("A renames the task in its row, and the focus returns to its menu button", async () => {
      await chooseFromTaskMenu(pageA, "Sunscreen", "Edit");
      const field = pageA.getByLabel("Task", { exact: true });
      await expect(field).toHaveValue("Sunscreen");
      await field.fill("Sunscreen for the kids");
      await pageA.keyboard.press("Enter");
      await expect(vacationTask(pageA, "Sunscreen for the kids")).toBeVisible();
      await expect(
        taskMoreButton(pageA, "Sunscreen for the kids"),
      ).toBeFocused();
      // The menu the edit was chosen from stays closed.
      await expect(
        taskMoreButton(pageA, "Sunscreen for the kids"),
      ).toHaveAttribute("aria-expanded", "false");
      await expect(vacationTask(pageB, "Sunscreen for the kids")).toBeVisible();
      await expect(vacationTask(pageB, "Sunscreen")).toHaveCount(0);
    });

    await test.step("Escape leaves the field without saving", async () => {
      await chooseFromTaskMenu(pageA, "Books", "Edit");
      await pageA.getByLabel("Task", { exact: true }).fill("Magazines");
      await pageA.keyboard.press("Escape");
      await expect(vacationTask(pageA, "Books")).toBeVisible();
      await expect(vacationTask(pageA, "Magazines")).toHaveCount(0);
      await expect(taskMoreButton(pageA, "Books")).toBeFocused();
      await expect(taskMoreButton(pageA, "Books")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    await test.step("a task ticked by B moves to the end, keeps the focus, and shows on A", async () => {
      const clothes = vacationTask(pageB, "Clothes");
      await clothes.focus();
      await pageB.keyboard.press("Space");
      await expect(clothes).toBeChecked();
      await expect(clothes).toBeFocused();
      await expect(
        vacationPhase(pageB, "Before").getByRole("checkbox").last(),
      ).toHaveAccessibleName("Clothes");
      await expect(vacationPhase(pageB, "Before")).toContainText("23 open");

      await expect(vacationTask(pageA, "Clothes")).toBeChecked();
      await expect(
        vacationPhase(pageA, "Before").getByRole("checkbox").last(),
      ).toHaveAccessibleName("Clothes");
    });

    await test.step("a task removed by A is gone on B, and the focus moves to the next row", async () => {
      await chooseFromTaskMenu(pageA, "Toothbrushes", "Remove");
      await expect(vacationTask(pageA, "Toothbrushes")).toHaveCount(0);
      await expect(vacationTask(pageA, "iPad")).toBeFocused();
      await expect(vacationTask(pageB, "Toothbrushes")).toHaveCount(0);
      await expect(vacationPhase(pageB, "Before")).toContainText("22 open");
    });

    await test.step("A renames the vacation in place, and B sees the new title", async () => {
      await pageA.getByRole("button", { name: "Edit", exact: true }).click();
      const field = pageA.getByLabel("Title");
      await expect(field).toHaveValue(title);
      await field.fill("Week by the sea");
      await pageA.getByRole("button", { name: "Save", exact: true }).click();
      await expect(
        pageA.getByRole("heading", { name: "Week by the sea", level: 2 }),
      ).toBeVisible();
      await expect(
        pageA.getByRole("button", { name: "Edit", exact: true }),
      ).toBeFocused();
      await expect(
        pageB.getByRole("heading", { name: "Week by the sea", level: 2 }),
      ).toBeVisible();
    });

    await test.step("an end before the start is not saved", async () => {
      await pageA.getByRole("button", { name: "Edit", exact: true }).click();
      const untilField = pageA.getByLabel("Until");
      await untilField.fill(addDays(from, -1));
      await pageA.getByRole("button", { name: "Save", exact: true }).click();
      // Chrome refuses the form itself, by the field's `min`; the app's own
      // message is for a browser that doesn't (see vacationDetailsProblem).
      await expect
        .poll(() =>
          untilField.evaluate(
            (field: HTMLInputElement) => field.validity.rangeUnderflow,
          ),
        )
        .toBe(true);
      await expect(untilField).toBeVisible();
      await pageA.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(pageA.getByText("in 10 days")).toBeVisible();
    });

    await test.step("what B changed while A was disconnected shows up after the reconnect", async () => {
      socketA.goOffline();
      await pageB.getByLabel("Add a task before the trip").fill("Passports");
      await pageB.keyboard.press("Enter");
      await expect(vacationTask(pageB, "Passports")).toBeVisible();
      // The task may not reach A while it is cut off, or this step proves
      // nothing about the resync. Live events arrive well within this wait.
      await pageA.waitForTimeout(3_000);
      await expect(vacationTask(pageA, "Passports")).toHaveCount(0);

      socketA.goOnline();
      await expect(vacationTask(pageA, "Passports")).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step("everything is still there after a reload", async () => {
      await untilTaskSaved(pageA, () => vacationTask(pageA, "iPad").click());
      await pageA.reload();
      await expect(
        pageA.getByRole("heading", { name: "Week by the sea", level: 2 }),
      ).toBeVisible();
      await expect(vacationTask(pageA, "iPad")).toBeChecked();
      await expect(vacationTask(pageA, "Clothes")).toBeChecked();
      await expect(vacationTask(pageA, "Sunscreen for the kids")).toBeVisible();
      await expect(vacationTask(pageA, "Passports")).toBeVisible();
      await expect(vacationTask(pageA, "Toothbrushes")).toHaveCount(0);
      // 23 of the template, two added, one removed, two ticked.
      await expect(vacationPhase(pageA, "Before")).toContainText("22 open");
    });

    await test.step("A removes the vacation after a confirmation, and B's page says it is gone", async () => {
      await pageA.getByRole("button", { name: "Edit", exact: true }).click();
      await pageA.getByRole("button", { name: "Remove vacation" }).click();
      const dialog = pageA.getByRole("dialog");
      // 33 of the template, two added, one removed.
      await expect(dialog).toContainText(
        'This removes "Week by the sea" and its 34 tasks for the whole family.',
      );
      await dialog.getByRole("button", { name: "Remove" }).click();
      await expect(pageA).toHaveURL(/\/vacations$/);
      await expect(pageA.getByText(NO_VACATIONS_TEXT)).toBeVisible();

      await expect(
        pageB.getByRole("heading", { name: "Vacation not found", level: 2 }),
      ).toBeVisible();
      await pageB.getByRole("link", { name: "All vacations" }).click();
      await expect(pageB.getByText(NO_VACATIONS_TEXT)).toBeVisible();
    });

    await contextA.close();
    await contextB.close();
  });
});

// Slice 2: the people on a trip, and tasks that are given, taken and
// rejected with a reason, out in the open.

test.describe("a vacation's tasks, shared between its people", () => {
  let userA: TestUser;
  let userB: TestUser;
  let householdId: string;

  test.beforeAll(async () => {
    [userA, userB] = await Promise.all([
      createTestUser("e2e-fair-a"),
      createTestUser("e2e-fair-b"),
    ]);
    householdId = await createHousehold(userA.client, `E2E fair ${runId}`);
    await joinHousehold(userA, userB, householdId);
  });

  test.afterAll(async () => {
    await deleteTestData([householdId], [userA, userB]);
  });

  test("a task is given, rejected with a reason and taken, and everyone sees it", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await openSignedIn(pageA, userA);
    await openSignedIn(pageB, userB);

    // A member's name on a trip starts as their address before the "@".
    const nameA = userA.email.split("@")[0]!;
    const nameB = userB.email.split("@")[0]!;
    const today = localDateOf(new Date());
    const whoHasWhat = (page: typeof pageA) =>
      page
        .locator("section")
        .filter({
          has: page.getByRole("heading", { name: "Who has what", level: 3 }),
        })
        .getByRole("listitem");
    const reason = "I'm already busy enough washing all the clothes.";

    await test.step("A adds a vacation with both members and a child", async () => {
      await openVacations(pageA);
      await pageA.getByRole("link", { name: "Add vacation" }).click();
      await pageA.getByLabel("Title").fill("Winter week by the sea");
      await pageA.getByLabel("From").fill(addDays(today, 10));
      await pageA.getByLabel("Until").fill(addDays(today, 17));
      await expect(
        pageA.getByRole("checkbox", { name: `${nameA} (you)` }),
      ).toBeChecked();
      await expect(pageA.getByRole("checkbox", { name: nameB })).toBeChecked();
      // Enter in the name's field adds the name; it doesn't save the form.
      await pageA.getByLabel("Add a name").fill("Mia");
      await pageA.keyboard.press("Enter");
      await expect(pageA.getByRole("checkbox", { name: "Mia" })).toBeChecked();
      await expect(pageA).toHaveURL(/\/vacations\/new$/);
      await pageA.getByRole("button", { name: "Add vacation" }).click();
      await expect(pageA).toHaveURL(/\/vacations\/[0-9a-f-]{36}$/);

      await expect(whoHasWhat(pageA)).toHaveText([
        new RegExp(`${nameA} \\(you\\).*0$`),
        new RegExp(`${nameB}.*0$`),
        /Mia.*0$/,
        /Nobody yet.*33$/,
      ]);
    });

    await test.step("B opens it and sees the same", async () => {
      await openVacations(pageB);
      await vacationLink(pageB, "Winter week by the sea").click();
      await expect(whoHasWhat(pageB)).toHaveCount(4);
    });

    await test.step("A gives a task to B, who sees it as theirs", async () => {
      await pageA.getByRole("button", { name: "Nobody yet: Clothes" }).click();
      await pageA
        .getByRole("group", { name: "Give to…: Clothes" })
        .getByRole("button", { name: nameB })
        .click();
      // The row's person button now carries B's picture and name.
      await expect(
        pageA.getByRole("button", { name: `${nameB}: Clothes` }),
      ).toBeVisible();
      await expect(whoHasWhat(pageA).nth(1)).toHaveText(/1$/);

      await expect(
        pageB.getByRole("button", { name: "Yours: Clothes" }),
      ).toBeVisible();
      // "Reject" is in the menu of the member's own task, and of no other.
      await taskMoreButton(pageB, "Clothes").click();
      await expect(
        pageB
          .getByRole("group", { name: "More: Clothes" })
          .getByRole("button", { name: "Reject" }),
      ).toBeVisible();
      await pageB.keyboard.press("Escape");
      await taskMoreButton(pageA, "Clothes").click();
      await expect(
        pageA.getByRole("group", { name: "More: Clothes" }),
      ).toBeVisible();
      await expect(
        pageA
          .getByRole("group", { name: "More: Clothes" })
          .getByRole("button", { name: "Reject" }),
      ).toHaveCount(0);
      await pageA.keyboard.press("Escape");
    });

    await test.step("B rejects it with a reason; the focus moves to the row's person button", async () => {
      await chooseFromTaskMenu(pageB, "Clothes", "Reject");
      const dialog = pageB.getByRole("dialog");
      await expect(dialog).toContainText("Everyone sees your reason.");
      // A reason of spaces is none.
      await dialog.getByLabel("Why not?").fill("  ");
      await dialog.getByRole("button", { name: "Reject task" }).click();
      await expect(dialog).toContainText("Say why, so the others know.");
      await dialog.getByLabel("Why not?").fill(reason);
      await dialog.getByRole("button", { name: "Reject task" }).click();
      await expect(dialog).toHaveCount(0);

      const rowB = pageB.locator(".q-item").filter({
        has: vacationTask(pageB, "Clothes"),
      });
      await expect(rowB).toContainText(`${nameB} said no: “${reason}”`);
      await expect(
        pageB.getByRole("button", { name: "Nobody yet: Clothes" }),
      ).toBeFocused();
    });

    await test.step("A sees the rejection without reloading, and takes the task", async () => {
      const row = pageA.locator(".q-item").filter({
        has: vacationTask(pageA, "Clothes"),
      });
      await expect(row).toContainText(`${nameB} said no: “${reason}”`);
      await expect(whoHasWhat(pageA).nth(1)).toHaveText(/0$/);

      await pageA.getByRole("button", { name: "Nobody yet: Clothes" }).click();
      await pageA
        .getByRole("group", { name: "Give to…: Clothes" })
        .getByRole("button", { name: "Me", exact: true })
        .click();
      await expect(
        pageA.getByRole("button", { name: "Yours: Clothes" }),
      ).toBeVisible();
      await expect(row).not.toContainText("said no");
      await expect(whoHasWhat(pageA).first()).toHaveText(/1$/);
    });

    await test.step('a task of a person without an account has no "Reject", and any member ticks it', async () => {
      await pageA.getByRole("button", { name: "Nobody yet: Books" }).click();
      await pageA
        .getByRole("group", { name: "Give to…: Books" })
        .getByRole("button", { name: "Mia" })
        .click();
      await expect(
        pageB.getByRole("button", { name: "Mia: Books" }),
      ).toBeVisible();
      for (const page of [pageA, pageB]) {
        await taskMoreButton(page, "Books").click();
        const menu = page.getByRole("group", { name: "More: Books" });
        await expect(menu).toBeVisible();
        await expect(menu.getByRole("button", { name: "Reject" })).toHaveCount(
          0,
        );
        await page.keyboard.press("Escape");
      }
      await vacationTask(pageB, "Books").click();
      await expect(vacationTask(pageA, "Books")).toBeChecked();
    });

    await test.step('a line of "Who has what" leaves that line\'s open tasks and hides the add fields', async () => {
      const line = (name: string | RegExp) =>
        whoHasWhat(pageA).getByRole("button", { name });
      const before = vacationPhase(pageA, "Before");

      await line(`${nameA} (you)`).click();
      await expect(line(`${nameA} (you)`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(before.getByRole("checkbox")).toHaveCount(1);
      await expect(before).toContainText("1 of yours open");
      await expect(
        pageA.getByText(
          "Only your open tasks. Press the name again to see all and add tasks.",
        ),
      ).toBeVisible();
      await expect(pageA.getByLabel("Add a task before the trip")).toHaveCount(
        0,
      );
      await expect(vacationPhase(pageA, "During")).toContainText(
        "Nothing of yours here.",
      );

      // Another line takes over; the one before is released.
      await line(/^Nobody yet/).click();
      await expect(line(`${nameA} (you)`)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(before).toContainText(/\d+ without a person/);
      await expect(vacationPhase(pageA, "During")).toContainText(
        "6 without a person",
      );

      await line(/^Nobody yet/).click();
      await expect(before.getByRole("checkbox")).toHaveCount(23);
      await expect(
        pageA.getByLabel("Add a task before the trip"),
      ).toBeVisible();
    });

    await test.step('a person who is taken off leaves "Who has what", and their task is nobody\'s', async () => {
      await pageA.getByRole("button", { name: "Nobody yet: iPad" }).click();
      await pageA
        .getByRole("group", { name: "Give to…: iPad" })
        .getByRole("button", { name: "Mia" })
        .click();
      await expect(whoHasWhat(pageA).nth(2)).toHaveText(/Mia.*1$/);
      // The closed menu gives the focus back to the row's button late: only
      // once the button's tooltip has gone too. Going on before that, the
      // focus arrives there afterwards and is taken from "Change people"
      // below, which failed on a slow runner. The focus is on a span inside
      // the button, so the button itself never counts as focused.
      await expect
        .poll(() =>
          pageA
            .getByRole("button", { name: "Mia: iPad" })
            .evaluate((button) => button.contains(document.activeElement)),
        )
        .toBe(true);

      await pageA.getByRole("button", { name: "Change people" }).click();
      // Only the name of a person without an account is a field.
      await expect(
        pageA.getByRole("textbox", { name: "Name of Mia" }),
      ).toHaveValue("Mia");
      await expect(
        pageA.getByRole("textbox", { name: `Name of ${nameB}` }),
      ).toHaveCount(0);
      await pageA.getByRole("checkbox", { name: "Mia is coming" }).click();
      await pageA.getByRole("button", { name: "Done" }).click();
      await expect(
        pageA.getByRole("button", { name: "Change people" }),
      ).toBeFocused();
      await expect(whoHasWhat(pageA)).toHaveCount(3);
      await expect(whoHasWhat(pageB)).toHaveCount(3);
      // The task Mia had offers itself again.
      await expect(
        pageB.getByRole("button", { name: "Nobody yet: iPad" }),
      ).toBeVisible();
    });

    await contextA.close();
    await contextB.close();
  });
});
