<script setup lang="ts">
import { mdiChevronLeft, mdiChevronRight } from "@quasar/extras/mdi-v7";
import { Notify } from "quasar";

/**
 * A week of the household's meals, Monday to Sunday. The week is in the
 * address (`?week=`), so a week can be linked to and the browser's back
 * button goes to the week before. The days themselves are MealDays.vue's;
 * "Fill my week" is useWeekFill's. `?fill=1`, which the Tonight tile links
 * to, starts a fill once everything it needs is loaded.
 */
const props = defineProps<{ householdId: string }>();
const route = useRoute();
const router = useRouter();

const now = useMinuteClock();
const today = computed(() => localDateOf(now.value));
const monday = computed(() => weekFromParam(route.query.week, today.value));
const days = computed(() => weekDays(monday.value));
const isThisWeek = computed(() => monday.value === mondayOf(today.value));

// reactive() so that the template and this script read its refs unwrapped.
const fill = reactive(useWeekFill(toRef(props, "householdId"), monday, now));
const draftCount = computed(() => Object.keys(fill.draft ?? {}).length);
const canRerollRest = computed(
  () =>
    fill.canReroll &&
    Object.values(fill.draft ?? {}).some((dinner) => !dinner.locked),
);

// From the tile: fill once it can, and take `fill` out of the address, so
// that a reload or the back button doesn't fill again. A week with nothing
// to fill only loses the parameter.
watch(
  [() => route.query.fill, () => fill.ready],
  ([wanted, ready]) => {
    if (!wanted || !ready) return;
    fill.start();
    const { fill: _fill, ...query } = route.query;
    void router.replace({ query });
  },
  { immediate: true },
);

async function planDraft() {
  const notice = await fill.save();
  if (!notice) return;
  Notify.create({
    message: notice.message,
    // Not "positive": see RecipeView.vue.
    color: notice.failed ? "negative" : "primary",
    textColor: "on-accent",
    attrs: { "data-testid": TEST_IDS.meals.fill.notice },
  });
}
</script>

<template>
  <section aria-labelledby="meals-heading">
    <h2
      id="meals-heading"
      class="text-h6 q-my-none"
      :data-testid="TEST_IDS.meals.heading"
    >
      Meals, week of {{ formatDay(monday, true) }}
    </h2>
    <nav aria-label="Weeks" class="meal-week__nav">
      <q-btn
        flat
        no-caps
        :icon="mdiChevronLeft"
        label="Previous"
        aria-label="Previous week"
        :to="{ query: { week: addDays(monday, -7) } }"
        class="touch-target"
        :data-testid="TEST_IDS.meals.previousWeek"
      />
      <q-btn
        v-if="!isThisWeek"
        flat
        no-caps
        label="Today"
        aria-label="This week"
        :to="{ query: {} }"
        class="touch-target"
        :data-testid="TEST_IDS.meals.thisWeek"
      />
      <q-btn
        flat
        no-caps
        :icon-right="mdiChevronRight"
        label="Next"
        aria-label="Next week"
        :to="{ query: { week: addDays(monday, 7) } }"
        class="touch-target"
        :data-testid="TEST_IDS.meals.nextWeek"
      />
    </nav>

    <meal-fill-bar
      :drafting="fill.draft !== null"
      :can-fill="fill.canFill"
      :draft-count="draftCount"
      :choice-line="fill.choiceLine"
      :can-reroll-rest="canRerollRest"
      :saving="fill.saving"
      @fill="fill.start"
      @save="planDraft"
      @reroll-rest="fill.rerollRest"
      @cancel="fill.cancel"
      @dismiss-note="fill.dismissSmallNote"
    />

    <meal-days
      :household-id="householdId"
      :days="days"
      :today="today"
      :drafts="fill.draftRows"
      :can-reroll="fill.canReroll"
      @toggle-draft-lock="fill.toggleLock"
      @reroll-draft="fill.reroll"
    />
  </section>
</template>

<style scoped>
.meal-week__nav {
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
}
</style>
