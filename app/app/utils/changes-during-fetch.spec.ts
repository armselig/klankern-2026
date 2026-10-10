import { describe, expect, it } from 'vitest'
import { createChangesDuringFetch } from './changes-during-fetch'

describe('createChangesDuringFetch', () => {
  it('returns the ids recorded while the fetch was in flight', () => {
    const changes = createChangesDuringFetch()
    const fetch = changes.start()
    changes.record('item-1')
    changes.record('item-2')
    changes.record('item-1')
    expect(fetch.stop()).toEqual(['item-1', 'item-2'])
  })

  it('ignores ids recorded before the fetch started or after it stopped', () => {
    const changes = createChangesDuringFetch()
    changes.record('before')
    const fetch = changes.start()
    expect(fetch.stop()).toEqual([])
    changes.record('after')
    expect(fetch.stop()).toEqual([])
  })

  it('collects separately for overlapping fetches', () => {
    const changes = createChangesDuringFetch()
    const first = changes.start()
    changes.record('item-1')
    const second = changes.start()
    changes.record('item-2')
    expect(first.stop()).toEqual(['item-1', 'item-2'])
    changes.record('item-3')
    expect(second.stop()).toEqual(['item-2', 'item-3'])
  })
})
