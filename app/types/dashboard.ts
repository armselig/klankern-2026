/** An entry a dashboard tile can name: a to-do, a shopping item, a recipe. */
export interface TitledEntry {
  id: string;
  title: string;
}

/**
 * What a dashboard tile says about a list: how many entries it has, the
 * first of them, and how many are left out.
 */
export interface ListPreview<T extends TitledEntry> {
  count: number;
  shown: T[];
  /** Entries beyond the shown ones; 0 when all of them are shown. */
  more: number;
}
