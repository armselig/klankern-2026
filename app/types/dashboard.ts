/** An entry a dashboard tile can name: a to-do, a shopping item, a recipe,
 * a vacation. */
export interface TitledEntry {
  id: string;
  title: string;
  /** A line about the entry above it, not an entry of its own: a vacation's
   * "in 54 days". It is set in the muted text color and may wrap. */
  muted?: boolean;
}

/**
 * What a dashboard tile says about a list: how many entries it has, the
 * first of them, and how many are left out.
 */
export interface ListPreview<T extends TitledEntry> {
  /** The number the tile shows. For a list it is the number of its entries;
   * the vacations' tile counts the open tasks of the vacation it names. */
  count: number;
  shown: T[];
  /** Entries beyond the shown ones; 0 when all of them are shown. */
  more: number;
}
