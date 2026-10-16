/**
 * Sends an item's writes to the server one after the other, in the order
 * they were made. Two quick taps on a box (an untick, then a tick) would
 * otherwise be two requests on their way at once, and the server may commit
 * the later one first: the stored state is then the one the person left
 * behind, and the Realtime echoes bring it back to every phone.
 *
 * A write that fails doesn't stop the ones after it; each write's own
 * caller handles its failure. Kept outside the stores' state on purpose,
 * like createInsertsInFlight: promises aren't state to render or serialize.
 */
export function createWritesInOrder() {
  const lastById = new Map<string, Promise<unknown>>();

  return {
    /** Runs `write` once the item's previous write has settled, and returns
     * what it returns (or rejects with its error). */
    run<T>(id: string, write: () => Promise<T>): Promise<T> {
      const previous = lastById.get(id) ?? Promise.resolve();
      const next = previous.then(write, write);
      const settled = next.then(
        () => undefined,
        () => undefined,
      );
      lastById.set(id, settled);
      // Forget the item once nothing is queued after this write.
      void settled.then(() => {
        if (lastById.get(id) === settled) lastById.delete(id);
      });
      return next;
    },
  };
}
