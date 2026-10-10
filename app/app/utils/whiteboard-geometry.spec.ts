import { describe, expect, it } from 'vitest'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  ERASER_RADIUS,
  extendStroke,
  isStrokeFull,
  lastStrokePoint,
  MAX_STROKE_POINTS,
  MIN_POINT_DISTANCE,
  pointsBetween,
  strokeIsWithin,
  toBoardPoint,
} from './whiteboard-geometry'

describe('toBoardPoint', () => {
  it('rounds to whole board units', () => {
    expect(toBoardPoint(10.4, 20.6)).toEqual([10, 21])
  })

  it('clamps a position outside the board to its edge', () => {
    expect(toBoardPoint(-50, BOARD_HEIGHT + 50)).toEqual([0, BOARD_HEIGHT])
    expect(toBoardPoint(BOARD_WIDTH + 1, -1)).toEqual([BOARD_WIDTH, 0])
  })
})

describe('lastStrokePoint', () => {
  it('returns the last pair of the flat array', () => {
    expect(lastStrokePoint([1, 2, 3, 4])).toEqual([3, 4])
  })
})

describe('extendStroke', () => {
  it('appends a point that is far enough from the last one', () => {
    expect(extendStroke([100, 100], [100 + MIN_POINT_DISTANCE, 100])).toEqual([
      100,
      100,
      100 + MIN_POINT_DISTANCE,
      100,
    ])
  })

  it('returns the same array for a point too close to the last one', () => {
    const points = [100, 100]
    expect(extendStroke(points, [100 + MIN_POINT_DISTANCE - 1, 100])).toBe(points)
  })

  it('does not change the array it was given', () => {
    const points = [100, 100]
    extendStroke(points, [500, 500])
    expect(points).toEqual([100, 100])
  })
})

describe('isStrokeFull', () => {
  it('is true once the stroke has the most points the database accepts', () => {
    expect(isStrokeFull(new Array((MAX_STROKE_POINTS - 1) * 2).fill(0))).toBe(false)
    expect(isStrokeFull(new Array(MAX_STROKE_POINTS * 2).fill(0))).toBe(true)
  })
})

describe('strokeIsWithin', () => {
  const line = { color: '#212121', width: 20, points: [1000, 1000, 2000, 1000] }

  it('finds a stroke between two of its points, not only at them', () => {
    expect(strokeIsWithin(line, [1500, 1000 + ERASER_RADIUS], ERASER_RADIUS)).toBe(true)
  })

  it('counts half the pen width as part of the stroke', () => {
    expect(strokeIsWithin(line, [1500, 1000 + ERASER_RADIUS + 10], ERASER_RADIUS)).toBe(true)
    expect(strokeIsWithin(line, [1500, 1000 + ERASER_RADIUS + 11], ERASER_RADIUS)).toBe(false)
  })

  it('does not reach past the ends of the stroke', () => {
    expect(strokeIsWithin(line, [2000 + ERASER_RADIUS + 11, 1000], ERASER_RADIUS)).toBe(false)
  })

  it('finds a dot (a stroke of one point)', () => {
    const dot = { color: '#212121', width: 20, points: [500, 500] }
    expect(strokeIsWithin(dot, [500 + ERASER_RADIUS, 500], ERASER_RADIUS)).toBe(true)
    expect(strokeIsWithin(dot, [500 + ERASER_RADIUS + 11, 500], ERASER_RADIUS)).toBe(false)
  })
})

describe('pointsBetween', () => {
  it('fills a long move with positions at most a step apart, ending at the target', () => {
    expect(pointsBetween([0, 0], [300, 0], 100)).toEqual([
      [100, 0],
      [200, 0],
      [300, 0],
    ])
  })

  it('returns just the target for a move shorter than a step, or none at all', () => {
    expect(pointsBetween([0, 0], [50, 0], 100)).toEqual([[50, 0]])
    expect(pointsBetween([70, 70], [70, 70], 100)).toEqual([[70, 70]])
  })
})
