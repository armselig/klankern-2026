import { describe, expect, it } from "vitest";
import { nextPosition, positionBetween } from "./position";

describe("nextPosition", () => {
  it("returns 1 for an empty list", () => {
    expect(nextPosition([])).toBe(1);
  });

  it("returns one more than the highest existing position", () => {
    expect(
      nextPosition([{ position: 1 }, { position: 3 }, { position: 2 }]),
    ).toBe(4);
  });
});

describe("positionBetween", () => {
  it("returns 1 when inserting into an empty list (both neighbors null)", () => {
    expect(positionBetween(null, null)).toBe(1);
  });

  it("returns half the following position when inserting at the start", () => {
    expect(positionBetween(null, 4)).toBe(2);
  });

  it("returns one more than the preceding position when inserting at the end", () => {
    expect(positionBetween(5, null)).toBe(6);
  });

  it("returns the midpoint when inserting between two items", () => {
    expect(positionBetween(2, 4)).toBe(3);
  });

  it("still returns a usable midpoint for adjacent fractional positions", () => {
    expect(positionBetween(2, 2.0001)).toBeCloseTo(2.00005);
  });
});
