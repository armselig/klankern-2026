import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CELEBRATION_BURST_MS,
  CELEBRATION_INTERVAL_MS,
  useCelebration,
} from "./use-celebration";

/** The checkbox's box at (10, 20), 20px square: its middle is (20, 30). */
const BOX = { left: 10, top: 20, width: 20, height: 20 } as DOMRect;

/** The time a list keeps is the module's, for the session: each test starts
 * an hour after the one before, so none sees another's last burst. */
let hour = 0;

beforeEach(() => {
  vi.useFakeTimers();
  hour += 1;
  vi.setSystemTime(new Date(2026, 9, 16, hour));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCelebration", () => {
  it("plays a burst from the middle of the pressed control", () => {
    const { burst, playFrom } = useCelebration("todos");

    expect(playFrom(BOX)).toBe(true);

    expect(burst.value).toMatchObject({ x: 20, y: 30 });
  });

  it("ends the burst after its time", () => {
    const { burst, playFrom } = useCelebration("todos");
    playFrom(BOX);

    vi.advanceTimersByTime(CELEBRATION_BURST_MS);

    expect(burst.value).toBeNull();
  });

  it("doesn't play again for the same list within a minute", () => {
    playFromList("todos");
    vi.advanceTimersByTime(CELEBRATION_INTERVAL_MS - 1);

    const { burst, playFrom } = useCelebration("todos");

    expect(playFrom(BOX)).toBe(false);
    expect(burst.value).toBeNull();
  });

  it("plays for another list within that minute", () => {
    playFromList("todos");

    expect(useCelebration("shopping").playFrom(BOX)).toBe(true);
  });

  it("plays again for the same list after a minute", () => {
    playFromList("todos");
    vi.advanceTimersByTime(CELEBRATION_INTERVAL_MS);

    expect(useCelebration("todos").playFrom(BOX)).toBe(true);
  });
});

/** A burst on `key` from a list that was left meanwhile. */
function playFromList(key: string) {
  expect(useCelebration(key).playFrom(BOX)).toBe(true);
}
