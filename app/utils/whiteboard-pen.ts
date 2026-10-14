import type { WhiteboardTool } from "~/types/whiteboard";
import { INK_VALUES } from "./ink";

/** A choice in the whiteboard toolbar: what is stored with the stroke, and
 * the name the toolbar shows and announces for it. */
export interface PenOption<T> {
  label: string;
  value: T;
}

/** A pen color, with the name of its theme color for the toolbar's own
 * control (`text-ink-<name>` in assets/css/theme.css). */
export interface PenColorOption extends PenOption<string> {
  color: string;
}

export const WHITEBOARD_TOOLS: PenOption<WhiteboardTool>[] = [
  { label: "Pen", value: "pen" },
  { label: "Eraser", value: "eraser" },
];

export const DEFAULT_PEN_COLOR: string = INK_VALUES.black;

/** The values are what gets stored; what a stroke is drawn with follows the
 * theme (see utils/ink.ts). */
export const PEN_COLORS: PenColorOption[] = [
  { label: "Black", value: DEFAULT_PEN_COLOR, color: "ink-black" },
  { label: "Red", value: INK_VALUES.red, color: "ink-red" },
  { label: "Blue", value: INK_VALUES.blue, color: "ink-blue" },
  { label: "Green", value: INK_VALUES.green, color: "ink-green" },
];

export const DEFAULT_PEN_WIDTH = 32;

/** Pen widths in board units (see utils/whiteboard-geometry.ts). */
export const PEN_WIDTHS: PenOption<number>[] = [
  { label: "Thin", value: 16 },
  { label: "Medium", value: DEFAULT_PEN_WIDTH },
  { label: "Thick", value: 64 },
];
