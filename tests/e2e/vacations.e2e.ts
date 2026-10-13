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
  signIn,
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
    await signIn(pageA, userA);
    await signIn(pageB, userB);

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
      await expect(tile).toContainText("33 open");
      await expect(tile.getByRole("listitem")).toHaveText([
        title,
        "in 10 days",
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
