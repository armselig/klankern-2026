<script setup lang="ts">
import type { RecipeReactionCount } from "~/types/kids";

/**
 * Each child's record: the recipes the child refused or picked at in the
 * suggestions' lookback, with how often. Counts, not a score, and only the
 * exceptions: a recipe the child ate is not listed. It loads what it shows
 * and renders; the counting is in utils/kids-state.ts.
 */
const props = defineProps<{ householdId: string }>();
const kidsStore = useKidsStore();
const recipeStore = useRecipeStore();
const mealPlanStore = useMealPlanStore();

const now = useMinuteClock();
const today = computed(() => localDateOf(now.value));
const lookback = computed(() => reactionWindow(today.value));

watch(
  lookback,
  (wanted) => void mealPlanStore.load(props.householdId, wanted),
  {
    immediate: true,
  },
);
onMounted(() => {
  void kidsStore.load(props.householdId);
  void recipeStore.load(props.householdId);
});

const loaded = computed(
  () =>
    kidsStore.householdId === props.householdId &&
    recipeStore.householdId === props.householdId &&
    mealPlanStore.householdId === props.householdId &&
    mealPlanStore.isLoaded(lookback.value),
);
const failed = computed(
  () =>
    !loaded.value &&
    !kidsStore.loading &&
    !recipeStore.loading &&
    !mealPlanStore.loading &&
    !!(kidsStore.error || recipeStore.error || mealPlanStore.error),
);

const records = computed(() =>
  childRecords(
    kidsStore.children,
    kidsStore.reactionsById,
    mealPlanStore.visible,
    today.value,
  ),
);

/** A count's line, the recipe's title known: the most often first, then by
 * title. A removed recipe keeps its counts under a plain name. */
function lines(counts: RecipeReactionCount[]) {
  return counts
    .map(({ recipeId, count }) => ({
      recipeId,
      title: recipeStore.find(recipeId)?.title ?? null,
      times: timesText(count),
      count,
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        (a.title ?? "").localeCompare(b.title ?? "", undefined, {
          sensitivity: "base",
        }),
    );
}
</script>

<template>
  <section aria-labelledby="kids-heading">
    <h2
      id="kids-heading"
      class="text-h6 q-my-none"
      :data-testid="TEST_IDS.kids.page.heading"
    >
      What the kids refused
    </h2>
    <p class="text-muted">
      In the last {{ COOKED_LOOKBACK_WEEKS }} weeks. Record it from a dinner's
      menu in the plan.
    </p>

    <q-spinner
      v-if="!loaded && !failed"
      color="primary"
      size="2em"
      :data-testid="TEST_IDS.kids.page.loading"
    />
    <p
      v-else-if="failed"
      class="text-negative"
      :data-testid="TEST_IDS.kids.page.failure"
    >
      Couldn't load the records. Reload the page to try again.
    </p>
    <p v-else-if="records.length === 0" :data-testid="TEST_IDS.kids.page.none">
      No kids added yet. Add them on
      <nuxt-link :to="ROUTES.home">the dashboard</nuxt-link>.
    </p>
    <ul v-else role="list" class="kid-records">
      <li
        v-for="record in records"
        :key="record.child.id"
        class="kid-records__child"
        :data-testid="TEST_IDS.kids.page.record"
      >
        <h3 class="kid-records__name">
          <person-avatar
            :email="null"
            :size="32"
            :person="{
              id: record.child.id,
              name: record.child.name,
              user_id: null,
            }"
          />
          {{ record.child.name }}
        </h3>
        <p
          v-if="record.refused.length === 0 && record.pickedAt.length === 0"
          class="text-muted q-my-none"
          :data-testid="TEST_IDS.kids.page.nothing"
        >
          Nothing refused or picked at.
        </p>
        <template
          v-for="group in [
            {
              label: 'Refused',
              counts: record.refused,
              testId: TEST_IDS.kids.page.refused,
            },
            {
              label: 'Picked at',
              counts: record.pickedAt,
              testId: TEST_IDS.kids.page.pickedAt,
            },
          ]"
          :key="group.label"
        >
          <template v-if="group.counts.length > 0">
            <h4 class="kid-records__group">{{ group.label }}</h4>
            <ul
              role="list"
              class="kid-records__lines"
              :data-testid="group.testId"
            >
              <li v-for="line in lines(group.counts)" :key="line.recipeId">
                <nuxt-link
                  v-if="line.title"
                  :to="ROUTES.recipe(line.recipeId)"
                  >{{ line.title }}</nuxt-link
                >
                <span v-else class="text-muted">Recipe was removed</span>
                <span class="text-muted">, {{ line.times }}</span>
              </li>
            </ul>
          </template>
        </template>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.kid-records,
.kid-records__lines {
  margin: 0;
  padding: 0;
  list-style: none;
}

.kid-records__child + .kid-records__child {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--theme-outline);
}

/* Quasar styles bare h3 and h4 as display lines. */
.kid-records__name,
.kid-records__group {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5rem;
  letter-spacing: normal;
}

.kid-records__name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.kid-records__group {
  margin-top: 8px;
  font-size: 0.875rem;
  color: var(--theme-text-muted);
}

/* A line per recipe, tall enough for a thumb on its link. */
.kid-records__lines li {
  display: flex;
  align-items: center;
  min-height: 44px;
  overflow-wrap: anywhere;
}
</style>
