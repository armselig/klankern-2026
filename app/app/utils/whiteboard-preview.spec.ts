import { describe, expect, it } from "vitest";
import type { StrokeShape } from "~/types/whiteboard";
import {
  PREVIEW_MIN_STROKE_WIDTH,
  strokeForPreview,
} from "./whiteboard-preview";

function stroke(width: number): StrokeShape {
  return { color: "#212121", width, points: [0, 0, 100, 100] };
}

describe("strokeForPreview", () => {
  it("widens a stroke that would be too thin to see", () => {
    const thin = stroke(16);
    expect(strokeForPreview(thin)).toEqual({
      ...thin,
      width: PREVIEW_MIN_STROKE_WIDTH,
    });
  });

  it("leaves the stored stroke as it is", () => {
    const thin = stroke(16);
    strokeForPreview(thin);
    expect(thin.width).toBe(16);
  });

  it("keeps a stroke that is wide enough", () => {
    const thick = stroke(64);
    expect(strokeForPreview(thick)).toBe(thick);
  });
});
