import { describe, expect, it } from "vitest";
import {
  givenTaskMessage,
  myTasksLink,
  openTasksMessage,
  readVacationLink,
  rejectedTaskMessage,
  taskLink,
  withoutVacationLink,
} from "./vacation-link";

const ORIGIN = "https://klankern.example";

describe("the links", () => {
  it("builds a link that names the task", () => {
    expect(taskLink(ORIGIN, "v1", "t1")).toBe(
      "https://klankern.example/vacations/v1?task=t1",
    );
  });

  it("builds a link that asks for the member's own tasks", () => {
    expect(myTasksLink(ORIGIN, "v1")).toBe(
      "https://klankern.example/vacations/v1?mine=1",
    );
  });

  it("reads back what each link asks for", () => {
    const task = new URL(taskLink(ORIGIN, "v1", "t1")).searchParams;
    expect(readVacationLink(Object.fromEntries(task))).toEqual({
      taskId: "t1",
      onlyMine: false,
    });
    const mine = new URL(myTasksLink(ORIGIN, "v1")).searchParams;
    expect(readVacationLink(Object.fromEntries(mine))).toEqual({
      taskId: null,
      onlyMine: true,
    });
  });

  it("asks for nothing without parameters, or with ones it doesn't know", () => {
    expect(readVacationLink({})).toEqual({ taskId: null, onlyMine: false });
    expect(readVacationLink({ task: "", mine: "yes", other: "x" })).toEqual({
      taskId: null,
      onlyMine: false,
    });
  });

  it("takes the first of a parameter given twice", () => {
    expect(readVacationLink({ task: ["t1", "t2"] }).taskId).toBe("t1");
  });

  it("takes its own parameters out of a query and leaves the others", () => {
    expect(withoutVacationLink({ task: "t1", mine: "1", other: "x" })).toEqual({
      other: "x",
    });
    expect(withoutVacationLink({})).toEqual({});
  });
});

describe("the sentences", () => {
  const link = "https://klankern.example/vacations/v1?task=t1";

  it("names the task and the vacation, with the link inside the sentence", () => {
    expect(
      givenTaskMessage("Wash the clothes", "Winter week by the sea", link),
    ).toBe(
      `"Wash the clothes" is yours for Winter week by the sea. Take a look: ${link}`,
    );
  });

  it("carries the reason of a rejection", () => {
    expect(
      rejectedTaskMessage("Wash the clothes", "Winter week", "No time.", link),
    ).toBe(
      `I said no to "Wash the clothes" for Winter week: "No time." Who takes it? ${link}`,
    );
  });

  it("has a singular and a plural for a person's open tasks", () => {
    expect(openTasksMessage(1, "Winter week", link)).toBe(
      `You have 1 open task for Winter week: ${link}`,
    );
    expect(openTasksMessage(3, "Winter week", link)).toBe(
      `You have 3 open tasks for Winter week: ${link}`,
    );
  });
});
