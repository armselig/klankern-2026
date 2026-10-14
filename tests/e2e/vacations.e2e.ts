import { expect, test } from "@playwright/test";
import { addDays, localDateOf } from "../../app/utils/local-date";
import { TEST_IDS } from "../../app/utils/test-ids";
import { VACATION_DETAILS_MESSAGES } from "../../app/utils/vacation-state";

import {
  EARLIER_TRIP_DONE_TASK,
  EARLIER_TRIP_REMOVED_TASK,
  EARLIER_TRIP_TITLE,
  addEarlierTrip,
} from "../support/earlier-trip";
import { controlRealtimeSocket } from "../support/realtime-socket";
import {
  addTaskField,
  addVacation,
  chooseFromTaskMenu,
  dashboardTileEmpty,
  dashboardTileEntries,
  giveTaskTo,
  openVacations,
  phaseButton,
  phaseSummary,
  phaseTasks,
  openSignedIn,
  openTaskMenu,
  shareLines,
  taskMenu,
  taskMenuEntry,
  taskMoreButton,
  taskRow,
  taskWhoButton,
  untilTaskSaved,
  vacationLink,
  vacationListEmpty,
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

// The vacation planner, one journey per slice. Slice 1: a trip checklist,
// copied from an earlier trip, which two members see and change live.

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

  test("a vacation is added with an earlier trip's tasks and changed by both members", async ({
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
      await expect(dashboardTileEmpty(pageB, "vacations")).toBeVisible();

      await openVacations(pageA);
      await expect(vacationListEmpty(pageA)).toBeVisible();
    });

    await test.step("A adds a vacation, and it starts with the earlier trip's tasks", async () => {
      await addEarlierTrip(userA, householdId);
      // Loaded afresh: Realtime delivers the trip's rows out of order, and
      // the form copies the tasks the page holds when it is saved.
      await pageA.reload();
      await expect(vacationLink(pageA, EARLIER_TRIP_TITLE)).toBeVisible();

      // The trip added last is the form's choice to start with, which the
      // helper leaves as it is.
      await addVacation(pageA, {
        title,
        from,
        until,
        expectCopyFrom: EARLIER_TRIP_TITLE,
      });
      await expect(
        pageA.getByTestId(TEST_IDS.vacation.header.title),
      ).toHaveText(title);

      await expect(
        pageA.getByTestId(TEST_IDS.vacation.header.summary),
      ).toContainText("in 10 days");

      // The page follows the trip: the phase of today is open, the later
      // ones are folded to their heading and count.
      await expect(phaseButton(pageA, "before")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await expect(phaseSummary(pageA, "before")).toHaveText("23 open");
      await expect(phaseTasks(pageA, "before")).toHaveCount(23);

      // Ticked there, open here; removed there, not copied.
      await expect(
        vacationTask(pageA, EARLIER_TRIP_DONE_TASK),
      ).not.toBeChecked();
      await expect(vacationTask(pageA, EARLIER_TRIP_REMOVED_TASK)).toHaveCount(
        0,
      );
      await expect(
        vacationTask(pageA, "Coffee pot and espresso powder"),
      ).toBeVisible();

      await expect(phaseButton(pageA, "during")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(phaseSummary(pageA, "during")).toHaveText("6 open");
      await expect(phaseSummary(pageA, "after")).toHaveText("4 open");
      await expect(vacationTask(pageA, "Return the key")).toHaveCount(0);

      await phaseButton(pageA, "during").click();
      await expect(vacationTask(pageA, "Return the key")).toBeVisible();
      await phaseButton(pageA, "during").click();
      await expect(vacationTask(pageA, "Return the key")).toHaveCount(0);
    });

    await test.step("B sees it on the tile without reloading, and opens it", async () => {
      await expect(dashboardTileEntries(pageB, "vacations")).toHaveText([
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
      const field = addTaskField(pageA, "before");

      await field.fill("Sunscreen");
      await pageA.keyboard.press("Enter");
      await expect(vacationTask(pageA, "Sunscreen")).toHaveCount(1);
      await expect(field).toBeFocused();
      await expect(field).toHaveValue("");
      await expect(vacationTask(pageB, "Sunscreen")).toBeVisible();
      await expect(phaseSummary(pageB, "before")).toHaveText("24 open");
    });

    await test.step("A renames the task in its row, and the focus returns to its menu button", async () => {
      await chooseFromTaskMenu(pageA, "Sunscreen", "edit");
      const field = pageA.getByTestId(TEST_IDS.vacation.task.titleInput);
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
      await chooseFromTaskMenu(pageA, "Books", "edit");
      await pageA
        .getByTestId(TEST_IDS.vacation.task.titleInput)
        .fill("Magazines");
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
      await expect(phaseTasks(pageB, "before").last()).toHaveAccessibleName(
        "Clothes",
      );
      await expect(phaseSummary(pageB, "before")).toHaveText("23 open");

      await expect(vacationTask(pageA, "Clothes")).toBeChecked();
      await expect(phaseTasks(pageA, "before").last()).toHaveAccessibleName(
        "Clothes",
      );
    });

    await test.step("a task removed by A is gone on B, and the focus moves to the next row", async () => {
      await chooseFromTaskMenu(pageA, "Toothbrushes", "remove");
      await expect(vacationTask(pageA, "Toothbrushes")).toHaveCount(0);
      await expect(vacationTask(pageA, "iPad")).toBeFocused();
      await expect(vacationTask(pageB, "Toothbrushes")).toHaveCount(0);
      await expect(phaseSummary(pageB, "before")).toHaveText("22 open");
    });

    await test.step("A renames the vacation in place, and B sees the new title", async () => {
      await pageA.getByTestId(TEST_IDS.vacation.header.edit).click();
      const field = pageA.getByTestId(TEST_IDS.vacation.header.titleInput);

      await expect(field).toHaveValue(title);
      await field.fill("Week by the sea");
      await pageA.getByTestId(TEST_IDS.vacation.header.save).click();
      await expect(
        pageA.getByTestId(TEST_IDS.vacation.header.title),
      ).toHaveText("Week by the sea");

      await expect(
        pageA.getByTestId(TEST_IDS.vacation.header.edit),
      ).toBeFocused();
      await expect(
        pageB.getByTestId(TEST_IDS.vacation.header.title),
      ).toHaveText("Week by the sea");
    });

    await test.step("an end before the start is not saved", async () => {
      await pageA.getByTestId(TEST_IDS.vacation.header.edit).click();
      const untilField = pageA.getByTestId(TEST_IDS.vacation.header.until);

      await untilField.fill(addDays(from, -1));
      await pageA.getByTestId(TEST_IDS.vacation.header.save).click();
      // The app's own message: a typed day has no `min` the browser checks.
      await expect(pageA.getByTestId(TEST_IDS.errorMessage)).toHaveText(
        VACATION_DETAILS_MESSAGES.dates,
      );
      await expect(untilField).toBeVisible();
      await pageA.getByTestId(TEST_IDS.vacation.header.cancel).click();
      await expect(
        pageA.getByTestId(TEST_IDS.vacation.header.summary),
      ).toContainText("in 10 days");
    });

    await test.step("what B changed while A was disconnected shows up after the reconnect", async () => {
      socketA.goOffline();
      await addTaskField(pageB, "before").fill("Passports");

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
        pageA.getByTestId(TEST_IDS.vacation.header.title),
      ).toHaveText("Week by the sea");

      await expect(vacationTask(pageA, "iPad")).toBeChecked();
      await expect(vacationTask(pageA, "Clothes")).toBeChecked();
      await expect(vacationTask(pageA, "Sunscreen for the kids")).toBeVisible();
      await expect(vacationTask(pageA, "Passports")).toBeVisible();
      await expect(vacationTask(pageA, "Toothbrushes")).toHaveCount(0);
      // 23 copied, two added, one removed, two ticked.
      await expect(phaseSummary(pageA, "before")).toHaveText("22 open");
    });

    await test.step("A removes the vacation after a confirmation, and B's page says it is gone", async () => {
      await pageA.getByTestId(TEST_IDS.vacation.header.edit).click();
      await pageA.getByTestId(TEST_IDS.vacation.header.remove).click();
      const dialog = pageA.getByRole("dialog");
      // 33 copied, two added, one removed.
      await expect(dialog).toContainText(
        'This removes "Week by the sea" and its 34 tasks for the whole family.',
      );
      await dialog.getByTestId(TEST_IDS.confirmDialog.ok).click();
      await expect(pageA).toHaveURL(/\/vacations$/);
      await expect(vacationLink(pageA, "Week by the sea")).toHaveCount(0);
      await expect(vacationLink(pageA, EARLIER_TRIP_TITLE)).toBeVisible();

      await expect(
        pageB.getByTestId(TEST_IDS.vacation.view.notFound),
      ).toBeVisible();

      await pageB.getByTestId(TEST_IDS.vacation.view.back).click();
      await expect(vacationLink(pageB, EARLIER_TRIP_TITLE)).toBeVisible();
      await expect(vacationLink(pageB, "Week by the sea")).toHaveCount(0);
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
    // The trip's tasks are copied from it by the form's own choice.
    await addEarlierTrip(userA, householdId);
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

    const reason = "I'm already busy enough washing all the clothes.";

    await test.step("A adds a vacation with both members and a child", async () => {
      await openVacations(pageA);
      await pageA.getByTestId(TEST_IDS.vacation.list.add).click();
      await pageA
        .getByTestId(TEST_IDS.vacation.form.title)
        .fill("Winter week by the sea");

      await pageA
        .getByTestId(TEST_IDS.vacation.form.from)
        .fill(addDays(today, 10));

      await pageA
        .getByTestId(TEST_IDS.vacation.form.until)
        .fill(addDays(today, 17));

      const coming = pageA.getByTestId(TEST_IDS.vacation.form.person);
      await expect(coming.filter({ hasText: nameA })).toBeChecked();
      await expect(coming.filter({ hasText: nameB })).toBeChecked();

      // Enter in the name's field adds the name; it doesn't save the form.
      await pageA.getByTestId(TEST_IDS.vacation.form.addName).fill("Mia");
      await pageA.keyboard.press("Enter");
      await expect(coming.filter({ hasText: "Mia" })).toBeChecked();

      await expect(pageA).toHaveURL(/\/vacations\/new$/);
      await pageA.getByTestId(TEST_IDS.vacation.form.submit).click();

      await expect(pageA).toHaveURL(/\/vacations\/[0-9a-f-]{36}$/);

      await expect(shareLines(pageA)).toHaveText([
        // The member's own line, the other member's, the child's, and last
        // the line of the tasks nobody has.
        new RegExp(`${nameA}.*0$`),
        new RegExp(`${nameB}.*0$`),
        /Mia.*0$/,
        /33$/,
      ]);
    });

    await test.step("B opens it and sees the same", async () => {
      await openVacations(pageB);
      await vacationLink(pageB, "Winter week by the sea").click();
      await expect(shareLines(pageB)).toHaveCount(4);
    });

    await test.step("A gives a task to B, who sees it as theirs", async () => {
      // A row's person button says in its name whose the task is.
      await expect(taskWhoButton(pageA, "Clothes")).toHaveAccessibleName(
        "Nobody yet: Clothes",
      );
      await giveTaskTo(pageA, "Clothes", { name: nameB });

      // The row's person button now carries B's picture and name.
      await expect(taskWhoButton(pageA, "Clothes")).toHaveAccessibleName(
        `${nameB}: Clothes`,
      );

      await expect(shareLines(pageA).nth(1)).toHaveText(/1$/);

      await expect(taskWhoButton(pageB, "Clothes")).toHaveAccessibleName(
        "Yours: Clothes",
      );

      // "Reject" is in the menu of the member's own task, and of no other.
      await openTaskMenu(pageB, "Clothes");
      await expect(taskMenuEntry(pageB, "reject")).toBeVisible();

      await pageB.keyboard.press("Escape");
      await openTaskMenu(pageA, "Clothes");
      await expect(taskMenu(pageA)).toBeVisible();

      await expect(taskMenuEntry(pageA, "reject")).toHaveCount(0);

      await pageA.keyboard.press("Escape");
    });

    await test.step("B rejects it with a reason; the focus moves to the row's person button", async () => {
      await chooseFromTaskMenu(pageB, "Clothes", "reject");
      const dialog = pageB.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // A reason of spaces is none.
      const reasonField = dialog.getByTestId(TEST_IDS.vacation.reject.reason);
      await reasonField.fill("  ");
      await dialog.getByTestId(TEST_IDS.vacation.reject.submit).click();
      await expect(reasonField).toHaveAttribute("aria-invalid", "true");
      await reasonField.fill(reason);
      await dialog.getByTestId(TEST_IDS.vacation.reject.submit).click();

      await expect(dialog).toHaveCount(0);

      await expect(
        taskRow(pageB, "Clothes").getByTestId(TEST_IDS.vacation.task.reason),
      ).toHaveText(`${nameB} said no: “${reason}”`);
      await expect(taskWhoButton(pageB, "Clothes")).toBeFocused();
      await expect(taskWhoButton(pageB, "Clothes")).toHaveAccessibleName(
        "Nobody yet: Clothes",
      );
    });

    await test.step("A sees the rejection without reloading, and takes the task", async () => {
      const rejection = taskRow(pageA, "Clothes").getByTestId(
        TEST_IDS.vacation.task.reason,
      );
      await expect(rejection).toHaveText(`${nameB} said no: “${reason}”`);

      await expect(shareLines(pageA).nth(1)).toHaveText(/0$/);

      await giveTaskTo(pageA, "Clothes", "me");

      await expect(taskWhoButton(pageA, "Clothes")).toHaveAccessibleName(
        "Yours: Clothes",
      );

      await expect(rejection).toHaveCount(0);

      await expect(shareLines(pageA).first()).toHaveText(/1$/);
    });

    await test.step('a task of a person without an account has no "Reject", and any member ticks it', async () => {
      await giveTaskTo(pageA, "Books", { name: "Mia" });

      await expect(taskWhoButton(pageB, "Books")).toHaveAccessibleName(
        "Mia: Books",
      );

      for (const page of [pageA, pageB]) {
        await openTaskMenu(page, "Books");
        await expect(taskMenu(page)).toBeVisible();
        await expect(taskMenuEntry(page, "reject")).toHaveCount(0);

        await page.keyboard.press("Escape");
      }
      await vacationTask(pageB, "Books").click();
      await expect(vacationTask(pageA, "Books")).toBeChecked();
    });

    await test.step('a line of "Who has what" leaves that line\'s open tasks and hides the add fields', async () => {
      const myLine = shareLines(pageA).filter({ hasText: nameA });
      // The line of the tasks nobody has comes after the people's.
      const nobodysLine = shareLines(pageA).last();

      await myLine.click();
      await expect(myLine).toHaveAttribute("aria-pressed", "true");
      await expect(phaseTasks(pageA, "before")).toHaveCount(1);
      await expect(phaseSummary(pageA, "before")).toHaveText("1 of yours open");

      await expect(
        pageA.getByTestId(TEST_IDS.vacation.share.hint),
      ).toBeVisible();

      await expect(addTaskField(pageA, "before")).toHaveCount(0);

      await expect(phaseSummary(pageA, "during")).toHaveText(
        "Nothing of yours here.",
      );

      // Another line takes over; the one before is released.
      await nobodysLine.click();
      await expect(myLine).toHaveAttribute("aria-pressed", "false");
      await expect(phaseSummary(pageA, "before")).toHaveText(
        /^\d+ without a person$/,
      );

      await expect(phaseSummary(pageA, "during")).toHaveText(
        "6 without a person",
      );

      await nobodysLine.click();
      await expect(phaseTasks(pageA, "before")).toHaveCount(23);
      await expect(addTaskField(pageA, "before")).toBeVisible();
    });

    await test.step('a person who is taken off leaves "Who has what", and their task is nobody\'s', async () => {
      await giveTaskTo(pageA, "iPad", { name: "Mia" });

      await expect(shareLines(pageA).nth(2)).toHaveText(/Mia.*1$/);
      // The closed menu gives the focus back to the row's button late: only
      // once the button's tooltip has gone too. Going on before that, the
      // focus arrives there afterwards and is taken from "Change people"
      // below, which failed on a slow runner. The focus is on a span inside
      // the button, so the button itself never counts as focused.
      await expect
        .poll(() =>
          taskWhoButton(pageA, "iPad").evaluate((button) =>
            button.contains(document.activeElement),
          ),
        )
        .toBe(true);

      await pageA.getByTestId(TEST_IDS.vacation.share.changePeople).click();
      // Only the name of a person without an account is a field.
      const nameField = pageA.getByTestId(TEST_IDS.vacation.people.nameInput);
      await expect(nameField).toHaveCount(1);
      await expect(nameField).toHaveValue("Mia");
      await pageA
        .getByTestId(TEST_IDS.vacation.people.row)
        .filter({ has: nameField })
        .getByTestId(TEST_IDS.vacation.people.coming)
        .click();
      await pageA.getByTestId(TEST_IDS.vacation.people.done).click();

      await expect(
        pageA.getByTestId(TEST_IDS.vacation.share.changePeople),
      ).toBeFocused();
      await expect(shareLines(pageA)).toHaveCount(3);
      await expect(shareLines(pageB)).toHaveCount(3);
      // The task Mia had offers itself again.
      await expect(taskWhoButton(pageB, "iPad")).toHaveAccessibleName(
        "Nobody yet: iPad",
      );
    });

    await contextA.close();
    await contextB.close();
  });
});
