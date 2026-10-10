/** A choice in the whiteboard toolbar: what is stored with the stroke, and
 * the name the toolbar shows and announces for it. */
export interface PenOption<T> {
  label: string
  value: T
}

/** A pen color, with the Quasar palette name closest to it for the toolbar's
 * own control. */
export interface PenColorOption extends PenOption<string> {
  color: string
}

export const DEFAULT_PEN_COLOR = '#212121'

/** The values are what gets stored: '#rrggbb' in lower case, the only format
 * the database accepts (migration 0012). */
export const PEN_COLORS: PenColorOption[] = [
  { label: 'Black', value: DEFAULT_PEN_COLOR, color: 'grey-10' },
  { label: 'Red', value: '#c62828', color: 'red-9' },
  { label: 'Blue', value: '#1565c0', color: 'blue-9' },
  { label: 'Green', value: '#2e7d32', color: 'green-9' },
]

export const DEFAULT_PEN_WIDTH = 32

/** Pen widths in board units (see utils/whiteboard-geometry.ts). */
export const PEN_WIDTHS: PenOption<number>[] = [
  { label: 'Thin', value: 16 },
  { label: 'Medium', value: DEFAULT_PEN_WIDTH },
  { label: 'Thick', value: 64 },
]
