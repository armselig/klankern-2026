import { describe, expect, it } from "vitest";
import { AVATAR_INKS } from "./avatar-rosette";
import { personBadge } from "./person-badge";

describe("personBadge", () => {
  it("shows the first two letters of the name, the first in upper case", () => {
    expect(personBadge({ id: "a", name: "mia" }).letters).toBe("Mi");
    expect(personBadge({ id: "a", name: "  émile" }).letters).toBe("Ém");
  });

  it("tells apart two names that start with the same letter", () => {
    expect(personBadge({ id: "a", name: "Mia" }).letters).not.toBe(
      personBadge({ id: "a", name: "Max" }).letters,
    );
  });

  it("shows one letter for a name of one", () => {
    expect(personBadge({ id: "a", name: "J" }).letters).toBe("J");
  });

  it("keeps a letter outside the basic plane whole", () => {
    expect(personBadge({ id: "a", name: "😀Tom" }).letters).toBe("😀T");
  });

  it("has a question mark for a name of spaces", () => {
    expect(personBadge({ id: "a", name: "  " }).letters).toBe("?");
  });

  it("keeps a person's ink when the name changes", () => {
    const id = "5f0c1a2e-6a53-4a55-9d2b-0f3b7c1d9e10";
    expect(personBadge({ id, name: "Mia" }).color).toBe(
      personBadge({ id, name: "Tom" }).color,
    );
  });

  it("picks one of the avatars' inks, and not the same for every id", () => {
    const colors = ["a", "b", "c", "d", "e", "f", "g", "h"].map(
      (id) => personBadge({ id, name: "Mia" }).color,
    );
    expect(new Set(colors).size).toBe(AVATAR_INKS.length);
    for (const color of colors) expect(AVATAR_INKS).toContain(color);
  });
});
