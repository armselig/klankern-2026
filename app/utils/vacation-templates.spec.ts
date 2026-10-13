import { describe, expect, it } from "vitest";
import type { VacationKind, VacationPhase } from "~/types/vacation";
import { VACATION_PHASES, templateTasks } from "./vacation-templates";

const KINDS: VacationKind[] = ["house", "hotel"];

function titlesOf(kind: VacationKind, phase: VacationPhase): string[] {
  return templateTasks(kind)
    .filter((task) => task.phase === phase)
    .map((task) => task.title);
}

describe("templateTasks", () => {
  it.each(KINDS)("gives every %s task a title the database accepts", (kind) => {
    for (const task of templateTasks(kind)) {
      // The table's check: not blank, at most 200 characters.
      expect(task.title).toMatch(/\S/);
      expect(task.title.length).toBeLessThanOrEqual(200);
      expect(task.title).toBe(task.title.trim());
    }
  });

  it.each(KINDS)("uses only the three phases for %s", (kind) => {
    for (const task of templateTasks(kind)) {
      expect(VACATION_PHASES).toContain(task.phase);
    }
  });

  it.each(KINDS)(
    "numbers the %s tasks of each phase from 1 without a gap",
    (kind) => {
      for (const phase of VACATION_PHASES) {
        const positions = templateTasks(kind)
          .filter((task) => task.phase === phase)
          .map((task) => task.position);
        expect(positions).toEqual(positions.map((_, index) => index + 1));
      }
    },
  );

  it.each(KINDS)("names no %s task twice within a phase", (kind) => {
    for (const phase of VACATION_PHASES) {
      const titles = titlesOf(kind, phase);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it("fills a house with 33 tasks and a hotel with 25", () => {
    expect(templateTasks("house")).toHaveLength(33);
    expect(templateTasks("hotel")).toHaveLength(25);
  });

  it("gives the hotel the house's tasks in the same order, minus the house's own", () => {
    for (const phase of VACATION_PHASES) {
      const hotel = titlesOf("hotel", phase);
      const house = titlesOf("house", phase);
      expect(house.filter((title) => hotel.includes(title))).toEqual(hotel);
    }
  });

  it("leaves what a kitchen and a rented house need out of the hotel", () => {
    const hotel = templateTasks("hotel").map((task) => task.title);
    const houseOnly = templateTasks("house")
      .map((task) => task.title)
      .filter((title) => !hotel.includes(title));
    expect(houseOnly).toEqual([
      "Cooking and kitchen utensils",
      "Coffee pot and espresso powder",
      "Plan the meals",
      "Shop for the first evening",
      "Empty the fridge",
      "Clean the house before leaving",
      "Take the rubbish out",
      "Return the key",
    ]);
  });

  it("keeps the household's list in its order before the trip", () => {
    expect(titlesOf("hotel", "before").slice(0, 3)).toEqual([
      "Clothes",
      "Toothbrushes",
      "iPad",
    ]);
    expect(titlesOf("house", "before").at(-1)).toBe(
      "Shop for the first evening",
    );
  });

  it("returns a new list on every call, so a caller can't change the template", () => {
    const first = templateTasks("house");
    first[0]!.title = "Changed";
    expect(templateTasks("house")[0]!.title).toBe("Clothes");
  });
});
