import { describe, expect, it } from 'vitest'
import { createInsertsInFlight } from './inserts-in-flight'

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Whether a promise has settled after the pending microtasks have run. */
async function hasSettled(promise: Promise<unknown>) {
  let settled = false
  void promise.then(() => (settled = true))
  await new Promise((resolve) => setTimeout(resolve, 0))
  return settled
}

describe('createInsertsInFlight', () => {
  it('settles right away for an item without an insert in flight', async () => {
    const inserts = createInsertsInFlight()
    expect(await hasSettled(inserts.settled('item-1'))).toBe(true)
  })

  it("waits for the item's insert to succeed", async () => {
    const inserts = createInsertsInFlight()
    const insert = deferred<string>()
    void inserts.track('item-1', insert.promise)

    const settled = inserts.settled('item-1')
    expect(await hasSettled(settled)).toBe(false)
    insert.resolve('confirmed')
    expect(await hasSettled(settled)).toBe(true)
  })

  it('also settles, without rejecting, when the insert fails', async () => {
    const inserts = createInsertsInFlight()
    const insert = deferred<string>()
    inserts.track('item-1', insert.promise).catch(() => {})

    const settled = inserts.settled('item-1')
    insert.reject(new Error('insert failed'))
    await expect(settled).resolves.toBeUndefined()
  })

  it('only waits for the insert of the given item', async () => {
    const inserts = createInsertsInFlight()
    void inserts.track('item-1', deferred<string>().promise)
    expect(await hasSettled(inserts.settled('item-2'))).toBe(true)
  })
})
