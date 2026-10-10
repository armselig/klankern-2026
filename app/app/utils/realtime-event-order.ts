/**
 * Remembers, per item, the commit time of the newest Realtime event seen, to
 * tell when an event arrives late. Realtime doesn't deliver the changes of
 * one row in commit order: an item's UPDATE can arrive before its INSERT
 * when both are committed within a few milliseconds. Applied in arrival
 * order, the older row would overwrite the newer one until the next reload.
 *
 * Kept outside the stores' state on purpose, like createInsertsInFlight: the
 * timestamps are bookkeeping, not state to render or serialize. They also
 * outlive a resync or store reset on purpose: an event from before either
 * can still arrive after it.
 */
export function createRealtimeEventOrder() {
  const newestCommitById = new Map<string, number>()

  return {
    /**
     * Says whether an event may be applied, and remembers its commit time if
     * so. Only an event committed before the newest one seen for its item is
     * refused. Equal times are accepted: commit times have millisecond
     * resolution, so the order of two such events is unknown and the later
     * arrival wins, as it did before. So is a time that can't be parsed,
     * rather than dropping changes over a format surprise.
     */
    accept(id: string, commitTimestamp: string): boolean {
      const committedAt = Date.parse(commitTimestamp)
      if (Number.isNaN(committedAt)) return true
      const newest = newestCommitById.get(id)
      if (newest !== undefined && committedAt < newest) return false
      newestCommitById.set(id, committedAt)
      return true
    },
  }
}
