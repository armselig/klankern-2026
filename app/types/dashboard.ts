/** An entry a dashboard tile can name: a to-do, a shopping item, a
 * recipe. */
export interface TitledEntry {
  id: string;
  title: string;
}

/**
 * What a dashboard tile says about a list: how many entries it has, the
 * first of them, and how many are left out.
 */
export interface ListPreview<T extends TitledEntry> {
  /** The number the tile shows: the number of the list's entries. */
  count: number;
  shown: T[];
  /** Entries beyond the shown ones; 0 when all of them are shown. */
  more: number;
}

/**
 * What the vacations' tile says, in the order a member asks: which trip is
 * next, when it is, and how much is left to do for it. Not a ListPreview: a
 * number on top would be read before the trip it counts tasks of, as "25
 * vacations open".
 */
export interface VacationTileLines {
  /** The vacation's title. */
  title: string;
  /** Where the trip stands today: "in 54 days", "day 2 of 8". */
  when: string;
  /** Its open tasks, in words: "25 tasks open". */
  tasks: string;
  /** What is the signed-in member's and what came back rejected, or null
   * when there is neither. */
  share: string | null;
  /** How many more vacations are current: "and 1 more vacation", or null. */
  more: string | null;
}
