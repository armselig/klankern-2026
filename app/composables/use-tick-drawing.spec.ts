import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TICK_DRAWING_ANIMATION,
  TICK_SPRING_ANIMATION,
  useTickDrawing,
} from "./use-tick-drawing";

/** The only field `endDrawing` reads from the browser's event. */
function animationEnd(animationName: string) {
  return { animationName } as AnimationEvent;
}

describe("useTickDrawing", () => {
  it("is not drawing before the person taps", () => {
    const { drawing } = useTickDrawing();

    expect(drawing.value).toBe(false);
  });

  it("starts drawing when the person ticks", () => {
    const { drawing, startFromTap } = useTickDrawing();

    startFromTap(true);

    expect(drawing.value).toBe(true);
  });

  it("does not draw when the person unticks", () => {
    const { drawing, startFromTap } = useTickDrawing();

    startFromTap(false);

    expect(drawing.value).toBe(false);
  });

  it("stops a drawing in progress when the person unticks", () => {
    const { drawing, startFromTap } = useTickDrawing();
    startFromTap(true);

    startFromTap(false);

    expect(drawing.value).toBe(false);
  });

  it("ends the drawing when the strike-through animation ends", () => {
    const { drawing, startFromTap, endDrawing } = useTickDrawing();
    startFromTap(true);

    endDrawing(animationEnd(TICK_DRAWING_ANIMATION));

    expect(drawing.value).toBe(false);
  });

  it("keeps drawing when the box's overshoot animation ends first", () => {
    const { drawing, startFromTap, endDrawing } = useTickDrawing();
    startFromTap(true);

    endDrawing(animationEnd(TICK_SPRING_ANIMATION));

    expect(drawing.value).toBe(true);
  });

  it("ends with the overshoot where no strike-through is drawn", () => {
    const { drawing, startFromTap, endDrawing } = useTickDrawing(
      TICK_SPRING_ANIMATION,
    );
    startFromTap(true);

    endDrawing(animationEnd(TICK_DRAWING_ANIMATION));
    expect(drawing.value).toBe(true);

    endDrawing(animationEnd(TICK_SPRING_ANIMATION));
    expect(drawing.value).toBe(false);
  });
});

describe("the animations' names", () => {
  it.each([TICK_DRAWING_ANIMATION, TICK_SPRING_ANIMATION])(
    "%s is the name of a @keyframes rule in motion.css",
    (name) => {
      const css = readFileSync(
        resolve(process.cwd(), "app/assets/css/motion.css"),
        "utf8",
      );

      expect(css).toMatch(new RegExp(`@keyframes\\s+${name}\\s*\\{`));
    },
  );
});
