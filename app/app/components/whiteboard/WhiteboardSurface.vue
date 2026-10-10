<script setup lang="ts">
import type { BoardStroke, StrokeShape, WhiteboardTool } from '~/types/whiteboard'
import type { BoardPoint } from '~/utils/whiteboard-geometry'

const props = defineProps<{
  strokes: BoardStroke[]
  tool: WhiteboardTool
  color: string
  width: number
}>()
const emit = defineEmits<{ draw: [stroke: StrokeShape]; erase: [id: string] }>()

const surface = useTemplateRef<SVGSVGElement>('surface')

/** The pointer a gesture started with. Further fingers are ignored until it
 * lifts, so a resting palm doesn't draw. */
const activePointerId = ref<number | null>(null)
/** The stroke under the pen, shown but not yet saved; null while erasing.
 * Shallow: the array is replaced on every change and handed on as it is. */
const draftPoints = shallowRef<number[] | null>(null)
/** Where the eraser was at the previous pointer event of the gesture. */
let lastEraserPoint: BoardPoint | null = null

const label = computed(() => {
  const count = props.strokes.length
  return `Whiteboard, ${count} ${count === 1 ? 'stroke' : 'strokes'}`
})

const draft = computed<StrokeShape | null>(() =>
  draftPoints.value ? { color: props.color, width: props.width, points: draftPoints.value } : null,
)

/** Converts a pointer position to board units through the SVG's own
 * transform, which accounts for the element's size, its position and the
 * bars the browser adds when the element's box is not 4:3. */
function boardPointOf(event: PointerEvent): BoardPoint | null {
  const toBoard = surface.value?.getScreenCTM()?.inverse()
  if (!toBoard) return null
  const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(toBoard)
  return toBoardPoint(x, y)
}

/** Erases every stroke the eraser passed over since the previous event. */
function eraseAlongTo(point: BoardPoint) {
  for (const position of pointsBetween(lastEraserPoint ?? point, point, ERASER_RADIUS)) {
    for (const stroke of props.strokes) {
      if (strokeIsWithin(stroke, position, ERASER_RADIUS)) emit('erase', stroke.id)
    }
  }
  lastEraserPoint = point
}

function startGesture(event: PointerEvent) {
  if (activePointerId.value !== null || !event.isPrimary || event.button !== 0) return
  const point = boardPointOf(event)
  if (!point) return
  // Keeps the events coming when the pointer leaves the board mid-stroke.
  surface.value?.setPointerCapture(event.pointerId)
  activePointerId.value = event.pointerId
  if (props.tool === 'pen') draftPoints.value = [...point]
  else eraseAlongTo(point)
}

function continueGesture(event: PointerEvent) {
  if (event.pointerId !== activePointerId.value) return
  const point = boardPointOf(event)
  if (!point) return
  // A gesture stays what it started as, whatever the toolbar says since.
  if (!draftPoints.value) {
    eraseAlongTo(point)
    return
  }
  const points = extendStroke(draftPoints.value, point)
  if (isStrokeFull(points)) {
    // Saved as it is; the line continues in a new stroke from the same point.
    emit('draw', { color: props.color, width: props.width, points })
    draftPoints.value = [...lastStrokePoint(points)]
  } else {
    draftPoints.value = points
  }
}

function endGesture() {
  activePointerId.value = null
  draftPoints.value = null
  lastEraserPoint = null
}

function finishGesture(event: PointerEvent) {
  if (event.pointerId !== activePointerId.value) return
  if (draft.value) emit('draw', draft.value)
  endGesture()
}

/** The browser took the gesture over (e.g. a system swipe): what was drawn
 * so far was not meant as a stroke. */
function cancelGesture(event: PointerEvent) {
  if (event.pointerId === activePointerId.value) endGesture()
}
</script>

<template>
  <!-- An image to assistive technology: the strokes have no text to offer
       beyond their number. Freehand drawing needs a pointer; everything
       else on the page is in the toolbar and works with a keyboard. -->
  <svg
    ref="surface"
    role="img"
    :aria-label="label"
    :viewBox="`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`"
    preserveAspectRatio="xMinYMin meet"
    class="whiteboard-surface"
    @pointerdown="startGesture"
    @pointermove="continueGesture"
    @pointerup="finishGesture"
    @pointercancel="cancelGesture"
  >
    <!-- The board itself. Its outline keeps one screen width however far the
         board is scaled down; half of it lies outside the viewBox. -->
    <rect
      :width="BOARD_WIDTH"
      :height="BOARD_HEIGHT"
      fill="#fff"
      stroke="#757575"
      stroke-width="2"
      vector-effect="non-scaling-stroke"
    />
    <WhiteboardStroke v-for="stroke in strokes" :key="stroke.id" :stroke="stroke" />
    <WhiteboardStroke v-if="draft" :stroke="draft" />
  </svg>
</template>

<style scoped>
.whiteboard-surface {
  display: block;
  width: 100%;
  /* Leaves room for the header, the toolbar and the fixed footer, so the
     whole board is on screen at once; on a very low screen it keeps a usable
     size and the page scrolls instead. */
  max-height: max(calc(100vh - 18rem), 16rem);
  /* Without this a touch scrolls the page instead of drawing. */
  touch-action: none;
  user-select: none;
}
</style>
