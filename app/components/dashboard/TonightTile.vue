<script setup lang="ts">
import type { TonightState } from "~/utils/dinner-order";
import type { TonightLines } from "~/utils/tonight-lines";

/**
 * What the household eats tonight, or tomorrow from the evening on: the
 * planned dinner, or a recipe to cook with a way to take it and a way to ask
 * for another. It only renders; the page works out the state and saves.
 *
 * Like the vacations' tile, it is an exception to "keep everything else in a
 * tile plain text": its buttons lie over the tile's own link (see the style).
 */
defineProps<{
  kind: TonightState["kind"];
  lines: TonightLines;
  /** The tile shows today, not tomorrow; only then can a dinner be skipped. */
  isToday: boolean;
  /** Which child refused the suggestion how often ("Refused twice by
   * Mila"), or null. */
  refusal?: string | null;
}>();
const emit = defineEmits<{
  planThis: [];
  another: [];
  skip: [];
  undoSkip: [];
  addText: [];
}>();
</script>

<template>
  <p
    class="tonight-tile__headline q-my-none"
    :class="{ 'text-muted': lines.headlineMuted }"
    :data-testid="TEST_IDS.tonight.headline"
  >
    {{ lines.headline }}
  </p>
  <p
    class="tonight-tile__secondary text-muted q-my-none"
    :data-testid="TEST_IDS.tonight.secondary"
  >
    {{ lines.secondary }}
  </p>
  <p
    v-if="refusal"
    class="tonight-tile__secondary q-my-none"
    :data-testid="TEST_IDS.tonight.refusal"
  >
    {{ refusal }}
  </p>
  <!-- No color on the flat buttons: see hover-contrast.css. -->
  <div class="tonight-tile__actions">
    <template v-if="kind === 'suggested' || kind === 'only-one'">
      <q-btn
        unelevated
        no-caps
        color="primary"
        label="Plan this"
        class="touch-target"
        :data-testid="TEST_IDS.tonight.planThis"
        @click="emit('planThis')"
      />
      <q-btn
        v-if="kind === 'suggested'"
        flat
        no-caps
        label="Another one"
        class="touch-target"
        :data-testid="TEST_IDS.tonight.another"
        @click="emit('another')"
      />
    </template>
    <template v-else-if="kind === 'planned'">
      <q-btn
        v-if="isToday && !lines.headlineMuted"
        flat
        no-caps
        label="We didn't cook this"
        class="touch-target"
        :data-testid="TEST_IDS.tonight.skip"
        @click="emit('skip')"
      />
      <q-btn
        flat
        no-caps
        :label="lines.headlineMuted ? 'Plan something else' : 'Change'"
        :to="ROUTES.meals"
        class="touch-target"
        :data-testid="TEST_IDS.tonight.change"
      />
    </template>
    <template v-else-if="kind === 'skipped'">
      <q-btn
        flat
        no-caps
        label="Plan something else"
        :to="ROUTES.meals"
        class="touch-target"
        :data-testid="TEST_IDS.tonight.change"
      />
      <q-btn
        flat
        no-caps
        label="Undo"
        class="touch-target"
        :data-testid="TEST_IDS.tonight.undoSkip"
        @click="emit('undoSkip')"
      />
    </template>
    <template v-else>
      <q-btn
        flat
        no-caps
        label="Write what you eat"
        :to="ROUTES.recipeNew"
        class="touch-target"
        :data-testid="TEST_IDS.tonight.writeRecipe"
      />
      <q-btn
        flat
        no-caps
        label="Add a dinner as text"
        class="touch-target"
        :data-testid="TEST_IDS.tonight.addText"
        @click="emit('addText')"
      />
    </template>
  </div>
</template>

<style scoped>
.tonight-tile__headline {
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5rem;
  overflow-wrap: anywhere;
}

.tonight-tile__secondary {
  font-size: 0.8125rem;
  line-height: 1.25rem;
}

/* Above the tile's own link, which is stretched over the whole card: a
   press on a button is the button's, and the rest of the tile still leads
   to the plan. */
.tonight-tile__actions {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: auto;
}
</style>
