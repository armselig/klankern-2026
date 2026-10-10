import { expect, test, type Page } from '@playwright/test'
import {
  dragOnWhiteboard,
  expectStrokeCount,
  openWhiteboard,
  signIn,
  whiteboardStrokes,
  type BoardFraction,
} from '../support/e2e-ui'
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  joinHousehold,
  runId,
  type TestUser,
} from '../support/supabase-fixtures'

// Milestone 9: two members in two browser contexts draw on the household's
// whiteboard and see each other's strokes, erases, undos and a cleared board
// live. Reconnecting is not tested again here: strokes use the same resync
// as the lists (realtime-sync.e2e.ts).

/** The stroke's shape as drawn in the page: the same on every screen, since
 * points are in board units. */
async function strokePoints(page: Page, index: number) {
  return whiteboardStrokes(page).nth(index).getAttribute('points')
}

/**
 * A zigzag across the lower half of the board, crossing x = 0.5 several
 * times, drawn with many mouse positions so the stroke has hundreds of
 * points. The erase of a large stroke can reach the other member without
 * its points (see BoardStrokeChange), so the eraser runs on this one; what
 * guards that rule is the unit test of applyStrokeRealtimeEvent, since an
 * erased stroke is hidden here either way.
 */
const ZIGZAG: BoardFraction[] = [
  [0.1, 0.6],
  [0.9, 0.65],
  [0.1, 0.7],
  [0.9, 0.75],
  [0.1, 0.8],
  [0.9, 0.85],
  [0.1, 0.9],
]
const ZIGZAG_STEPS_PER_SEGMENT = 80

test.describe('shared whiteboard', () => {
  let userA: TestUser
  let userB: TestUser
  let householdId: string

  test.beforeAll(async () => {
    ;[userA, userB] = await Promise.all([
      createTestUser('e2e-board-a'),
      createTestUser('e2e-board-b'),
    ])
    householdId = await createHousehold(userA.client, `E2E whiteboard ${runId}`)
    await joinHousehold(userA, userB, householdId)
  })

  test.afterAll(async () => {
    await deleteTestData([householdId], [userA, userB])
  })

  test('strokes, erases, undos and a cleared board appear live on the other member', async ({
    browser,
  }) => {
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    for (const [page, user] of [
      [pageA, userA],
      [pageB, userB],
    ] as const) {
      await signIn(page, user)
      await openWhiteboard(page)
      await expectStrokeCount(page, 0)
      await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Clear board' })).toBeDisabled()
    }

    await test.step('a stroke drawn by A appears on B, with its shape, color and width', async () => {
      await pageA.getByRole('radio', { name: 'Red' }).click()
      await pageA.getByRole('radio', { name: 'Thick' }).click()
      await dragOnWhiteboard(pageA, [
        [0.1, 0.1],
        [0.4, 0.3],
      ])

      await expectStrokeCount(pageB, 1)
      // Once on A too: the Realtime echo of A's own stroke is deduplicated.
      await expectStrokeCount(pageA, 1)
      const onB = whiteboardStrokes(pageB).first()
      await expect(onB).toHaveAttribute('stroke', '#c62828')
      await expect(onB).toHaveAttribute('stroke-width', '64')
      const points = await strokePoints(pageA, 0)
      expect(points!.split(' ').length).toBeGreaterThanOrEqual(4)
      expect(await strokePoints(pageB, 0)).toBe(points)
    })

    await test.step('a tap leaves a dot, and undo takes back only the own newest stroke', async () => {
      await dragOnWhiteboard(pageB, [[0.7, 0.2]])
      await expectStrokeCount(pageA, 2)
      await expect(whiteboardStrokes(pageA).nth(1)).toHaveJSProperty('tagName', 'circle')

      await pageB.getByRole('button', { name: 'Undo' }).click()
      await expectStrokeCount(pageB, 1)
      await expectStrokeCount(pageA, 1)
      // B has nothing of its own left; A's stroke is not B's to undo.
      await expect(pageB.getByRole('button', { name: 'Undo' })).toBeDisabled()
      await expect(pageA.getByRole('button', { name: 'Undo' })).toBeEnabled()
    })

    await test.step('the board is the same after a reload', async () => {
      const points = await strokePoints(pageA, 0)
      await pageB.reload()
      await expectStrokeCount(pageB, 1)
      expect(await strokePoints(pageB, 0)).toBe(points)
    })

    await test.step("the eraser removes another member's stroke for both", async () => {
      await dragOnWhiteboard(pageB, ZIGZAG, ZIGZAG_STEPS_PER_SEGMENT)
      await expectStrokeCount(pageA, 2)
      const points = await strokePoints(pageA, 1)
      expect(points!.split(' ').length).toBeGreaterThan(600)

      await pageA.getByRole('radio', { name: 'Eraser' }).click()
      // Straight down through the zigzag, clear of A's own stroke.
      await dragOnWhiteboard(pageA, [
        [0.5, 0.5],
        [0.5, 0.95],
      ])

      await expectStrokeCount(pageA, 1)
      await expectStrokeCount(pageB, 1)
      await expect(whiteboardStrokes(pageB).first()).toHaveAttribute('stroke', '#c62828')
    })

    await test.step('clearing the board asks first, then empties it for both', async () => {
      await pageB.getByRole('button', { name: 'Clear board' }).click()
      await pageB.getByRole('button', { name: 'Cancel' }).click()
      await expectStrokeCount(pageB, 1)

      await pageB.getByRole('button', { name: 'Clear board' }).click()
      await pageB.getByRole('button', { name: 'Clear', exact: true }).click()
      await expectStrokeCount(pageB, 0)
      await expectStrokeCount(pageA, 0)

      await pageA.reload()
      await expectStrokeCount(pageA, 0)
    })

    await contextA.close()
    await contextB.close()
  })
})
