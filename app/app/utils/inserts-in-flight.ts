/**
 * Remembers the optimistic adds whose insert is still on its way to the
 * server. A check or remove of such an item has to wait for it: sent
 * earlier, its update would find no row and change nothing, and the item
 * would come back unchanged on the next load.
 *
 * Kept outside the stores' state on purpose: promises aren't state to render
 * or serialize.
 */
export function createInsertsInFlight() {
  const inserts = new Map<string, Promise<unknown>>()

  return {
    /** Registers an item's insert until it settles, and returns it unchanged. */
    track<T>(id: string, insert: Promise<T>): Promise<T> {
      inserts.set(id, insert)
      insert.then(
        () => inserts.delete(id),
        () => inserts.delete(id),
      )
      return insert
    },

    /** Resolves once the item's insert has settled, whether it worked or not
     * -- right away if there is none. Never rejects. */
    settled(id: string): Promise<void> {
      return Promise.resolve(inserts.get(id)).then(
        () => undefined,
        () => undefined,
      )
    },
  }
}
