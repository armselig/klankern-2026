/**
 * Collects the ids of items that change while a resync fetch is in flight.
 * The fetched rows are a snapshot from when the server answered, so they may
 * predate such a change -- a write saved in the meantime, or a Realtime event
 * that arrived in the meantime -- and must not overwrite its local version.
 * `pendingIds` alone can't tell: a write that finished before the fetch
 * returns is no longer pending.
 *
 * Kept outside the stores' state on purpose, like createInsertsInFlight: the
 * open collections are bookkeeping, not state to render or serialize.
 */
export function createChangesDuringFetch() {
  const open = new Set<Set<string>>();

  return {
    /** Starts collecting for one fetch. Overlapping fetches each collect on
     * their own, so finishing one doesn't stop the other's. */
    start() {
      const changed = new Set<string>();
      open.add(changed);
      return {
        /** Stops collecting and returns what changed since start(). */
        stop(): string[] {
          open.delete(changed);
          return [...changed];
        },
      };
    },

    /** Notes a changed item for every fetch in flight; a no-op without one. */
    record(id: string) {
      for (const changed of open) changed.add(id);
    },
  };
}
