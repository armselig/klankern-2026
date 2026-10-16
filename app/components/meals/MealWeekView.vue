<script setup lang="ts">
import { mdiChevronLeft, mdiChevronRight } from "@quasar/extras/mdi-v7";
import { Notify } from "quasar";

/**
 * A week of the household's meals, Monday to Sunday. The week is in the
 * address (`?week=`), so a week can be linked to and the browser's back
 * button goes to the week before. The days themselves are MealDays.vue's,
 * which folds the days before yesterday in this week; "Fill my week" is
 * useWeekFill's and stands in the days' row of actions. `?fill=1`, which the Tonight tile links
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
    <div class="meal-week__head">
      <page-heading
        id="meals-heading"
        feature="meals"
        class="meal-week__heading"
        :data-testid="TEST_IDS.meals.heading"
      >
        {{ weekHeading(monday, today) }}
      </page-heading>
      <nav aria-label="Weeks" class="meal-week__nav">
        <q-btn
          v-if="!isThisWeek"
          flat
          no-caps
          label="This week"
          :to="{ query: {} }"
          class="touch-target"
          :data-testid="TEST_IDS.meals.thisWeek"
        />
        <q-btn
          flat
          round
          :icon="mdiChevronLeft"
          aria-label="Previous week"
          :to="{ query: { week: addDays(monday, -7) } }"
          class="touch-target"
          :data-testid="TEST_IDS.meals.previousWeek"
        />
        <q-btn
          flat
          round
          :icon="mdiChevronRight"
          aria-label="Next week"
          :to="{ query: { week: addDays(monday, 7) } }"
          class="touch-target"
          :data-testid="TEST_IDS.meals.nextWeek"
        />
      </nav>
    </div>

    <meal-days
      :household-id="householdId"
      :days="days"
      :today="today"
      :drafts="fill.draftRows"
      :can-reroll="fill.canReroll"
      :fold-earlier="isThisWeek"
      @toggle-draft-lock="fill.toggleLock"
      @reroll-draft="fill.reroll"
    >
      <template #actions>
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
      </template>
    </meal-days>
  </section>
</template>

<style scoped>
/* The heading and the weeks' buttons on one line. */
.meal-week__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 4px;
  margin-bottom: 8px;
}

.meal-week__heading {
  flex: 1 1 auto;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 2rem;
  letter-spacing: normal;
}

.meal-week__nav {
  display: flex;
  align-items: center;
}
</style>
