import { describe, expect, it } from 'vitest'
import { AVATAR_INKS, avatarRosette, ROSETTE_BOX } from './avatar-rosette'

/** A hash whose first bytes are the given ones, i.e. the bytes that select
 * the ink, the lobes, the loops' direction, their depth and the rotation. */
function hashStartingWith(...bytes: number[]): string {
  return bytes
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .padEnd(64, '0')
}

/** One hash per combination of traits a rosette can have. */
function everyVariant(): string[] {
  const hashes: string[] = []
  for (let ink = 0; ink < AVATAR_INKS.length; ink++) {
    for (let lobes = 0; lobes < 4; lobes++) {
      for (let direction = 0; direction < 2; direction++) {
        for (let depth = 0; depth < 3; depth++) {
          for (let rotation = 0; rotation < 2; rotation++) {
            hashes.push(hashStartingWith(ink, lobes, direction, depth, rotation))
          }
        }
      }
    }
  }
  return hashes
}

describe('avatarRosette', () => {
  it('draws the same rosette for the same hash', () => {
    const hash = hashStartingWith(5, 2, 1, 2, 1)
    expect(avatarRosette(hash)).toEqual(avatarRosette(hash))
  })

  it('draws a different picture for every combination of traits', () => {
    const pictures = everyVariant().map((hash) => JSON.stringify(avatarRosette(hash)))
    expect(new Set(pictures).size).toBe(pictures.length)
  })

  it('picks the ink from the first byte and wraps around the list', () => {
    expect(avatarRosette(hashStartingWith(1)).color).toBe(AVATAR_INKS[1])
    expect(avatarRosette(hashStartingWith(AVATAR_INKS.length + 1)).color).toBe(AVATAR_INKS[1])
  })

  it('keeps every stroke, with its width, inside the disc', () => {
    const center = ROSETTE_BOX / 2
    for (const hash of everyVariant()) {
      const { points, width } = avatarRosette(hash)
      for (let i = 0; i < points.length; i += 2) {
        const fromCenter = Math.hypot(points[i]! - center, points[i + 1]! - center)
        expect(fromCenter + width / 2).toBeLessThanOrEqual(center)
      }
    }
  })

  it('closes the stroke and uses whole units, like a board stroke', () => {
    for (const hash of everyVariant()) {
      const { points } = avatarRosette(hash)
      expect(points.slice(-2)).toEqual(points.slice(0, 2))
      expect(points.every(Number.isInteger)).toBe(true)
    }
  })

  it('still draws a rosette for a text that is no hash', () => {
    const { color, points } = avatarRosette('not a hash')
    expect(color).toBe(AVATAR_INKS[0])
    expect(points.length).toBeGreaterThan(2)
  })
})
