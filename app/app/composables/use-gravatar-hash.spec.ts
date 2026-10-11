import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { gravatarHash } from '~/utils/gravatar'
import { useGravatarHash } from './use-gravatar-hash'

vi.mock('~/utils/gravatar', () => ({ gravatarHash: vi.fn() }))

const hashEmail = vi.mocked(gravatarHash)

/** A hash the test finishes itself, to decide the order hashes arrive in. */
function pendingHash() {
  let resolve!: (hash: string) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<string>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

/** Lets the watcher run and the awaited hashes settle. */
async function settle() {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve))
}

describe('useGravatarHash', () => {
  beforeEach(() => {
    hashEmail.mockReset()
  })

  it('is null until the hash of the address is there', async () => {
    const pending = pendingHash()
    hashEmail.mockReturnValueOnce(pending.promise)

    const hash = useGravatarHash('anna@example.com')
    expect(hash.value).toBeNull()

    pending.resolve('hash-of-anna')
    await settle()
    expect(hash.value).toBe('hash-of-anna')
    expect(hashEmail).toHaveBeenCalledWith('anna@example.com')
  })

  it('stays null without an address, and hashes nothing', async () => {
    const hash = useGravatarHash(() => undefined)
    await settle()

    expect(hash.value).toBeNull()
    expect(hashEmail).not.toHaveBeenCalled()
  })

  it('follows the address when it changes', async () => {
    hashEmail.mockResolvedValueOnce('hash-of-anna').mockResolvedValueOnce('hash-of-ben')
    const email = ref('anna@example.com')

    const hash = useGravatarHash(email)
    await settle()
    expect(hash.value).toBe('hash-of-anna')

    email.value = 'ben@example.com'
    await settle()
    expect(hash.value).toBe('hash-of-ben')
  })

  it('drops a hash that arrives after the address has changed', async () => {
    const slowFirst = pendingHash()
    hashEmail.mockReturnValueOnce(slowFirst.promise).mockResolvedValueOnce('hash-of-ben')
    const email = ref('anna@example.com')

    const hash = useGravatarHash(email)
    email.value = 'ben@example.com'
    await settle()
    expect(hash.value).toBe('hash-of-ben')

    slowFirst.resolve('hash-of-anna')
    await settle()
    expect(hash.value).toBe('hash-of-ben')
  })

  it('stays null when the address cannot be hashed', async () => {
    hashEmail.mockRejectedValueOnce(new TypeError('crypto.subtle is undefined'))

    const hash = useGravatarHash('anna@example.com')
    await settle()

    expect(hash.value).toBeNull()
  })
})
