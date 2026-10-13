import { describe, expect, it } from "vitest";
import { isInAppPath } from "./in-app-path";

describe("isInAppPath", () => {
  it.each([
    "/",
    "/vacations",
    "/vacations/3f0c/",
    "/vacations/3f0c?task=9a1b",
    "/vacations/3f0c?mine=1#top",
  ])("accepts %s", (path) => {
    expect(isInAppPath(path)).toBe(true);
  });

  it.each([
    ["nothing", null],
    ["an empty path", ""],
    ["a full address", "https://example.org/vacations"],
    ["an address without a scheme", "//example.org/vacations"],
    ["a backslash after the slash", "/\\example.org"],
    ["a backslash further in", "/vacations\\..\\x"],
    ["a path that doesn't start at the root", "vacations"],
    ["a scheme of its own", "javascript:alert(1)"],
    ["a line break", "/vacations\n//example.org"],
    ["a tab", "/\t/example.org"],
  ])("refuses %s", (_name, path) => {
    expect(isInAppPath(path)).toBe(false);
  });
});
