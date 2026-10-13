<script setup lang="ts">
import {
  mdiBagSuitcaseOutline,
  mdiCartOutline,
  mdiChefHat,
  mdiDraw,
  mdiFormatListChecks,
} from "@quasar/extras/mdi-v7";

const householdStore = useHouseholdStore();
const todoStore = useTodoStore();
const shoppingStore = useShoppingStore();
const whiteboardStore = useWhiteboardStore();
const recipeStore = useRecipeStore();
const vacationStore = useVacationStore();

const inviteOpen = ref(false);

onMounted(() => householdStore.fetchMine());

// Everything the dashboard shows is fetched here, not by the roster or the
// tiles, which only render: the page knows the household. Watching its id
// fetches once per visit, and also when a household is created on this
// page, which mounts nothing anew. On a later visit the stores are loaded
// already, and load() only repairs them in the background.
watch(
  () => householdStore.household?.id,
  (householdId) => {
    void householdStore.fetchMembers();
    if (!householdId) return;
    void todoStore.load(householdId);
    void shoppingStore.load(householdId);
    void whiteboardStore.load(householdId);
    void recipeStore.load(householdId);
    void vacationStore.load(householdId);
  },
  { immediate: true },
);

const todoPreview = computed(() => previewOfList(todoStore.open));
const shoppingPreview = computed(() => previewOfList(shoppingStore.toBuy));
const recipePreview = computed(() => previewOfList(recipeStore.visible));

/** The day the dashboard was opened on; it decides which vacations are
 * current and where the first of them stands. */
const today = localDateOf(new Date());
const user = useSupabaseUser();
const vacationPreview = computed(() =>
  vacationTilePreview(
    vacationStore.vacationsById,
    vacationStore.tasksById,
    today,
    (vacationId) =>
      myShareOf(
        vacationStore.tasksOf(vacationId),
        personOfUser(vacationStore.peopleOf(vacationId), user.value?.sub),
        vacationStore.peopleById,
      ),
  ),
);

// A store's error can also be that of a single write on its own page. A
// tile only says that it has nothing to show: the store was never loaded.
const todosFailed = computed(() => !todoStore.listId && !!todoStore.error);
const shoppingFailed = computed(
  () => !shoppingStore.listId && !!shoppingStore.error,
);
const whiteboardFailed = computed(
  () => !whiteboardStore.boardId && !!whiteboardStore.error,
);
const recipesFailed = computed(
  () => !recipeStore.householdId && !!recipeStore.error,
);
const vacationsFailed = computed(
  () => !vacationStore.householdId && !!vacationStore.error,
);
</script>

<template>
  <q-page padding :class="{ 'flex flex-center': !householdStore.household }">
    <!-- The spinner and the form stand in the middle of the screen; the
         dashboard starts at the top. The spinner only shows while there is
         no household to show: fetchMine() runs on every visit, and the
         dashboard of a household that is known already stays on screen
         meanwhile. -->
    <q-spinner
      v-if="householdStore.loading && !householdStore.household"
      color="primary"
      size="2em"
    />

    <create-household-form v-else-if="!householdStore.household" />

    <div v-else class="dashboard">
      <h2 class="text-h6 q-my-none">{{ householdStore.household.name }}</h2>
      <member-roster @invite="inviteOpen = true" />

      <!-- A list of links, as a navigation is; a plain ul, because a q-list
           would hold no q-items. role="list" because Safari stops
           announcing a list once its bullets are styled away. -->
      <nav aria-label="Lists, whiteboard, recipes and vacations">
        <ul role="list" class="dashboard__tiles">
          <li>
            <dashboard-tile
              title="To-dos"
              :to="ROUTES.todos"
              :icon="mdiFormatListChecks"
              :loading="todoStore.loading"
              :failed="todosFailed"
            >
              <tile-list-preview
                :preview="todoPreview"
                count-label="open"
                empty-text="Nothing to do."
              />
            </dashboard-tile>
          </li>
          <li>
            <dashboard-tile
              title="Shopping"
              :to="ROUTES.shopping"
              :icon="mdiCartOutline"
              :loading="shoppingStore.loading"
              :failed="shoppingFailed"
            >
              <tile-list-preview
                :preview="shoppingPreview"
                count-label="to buy"
                empty-text="Nothing to buy."
              />
            </dashboard-tile>
          </li>
          <li>
            <dashboard-tile
              title="Whiteboard"
              :to="ROUTES.whiteboard"
              :icon="mdiDraw"
              :loading="whiteboardStore.loading"
              :failed="whiteboardFailed"
            >
              <whiteboard-preview
                v-if="whiteboardStore.visible.length > 0"
                :strokes="whiteboardStore.visible"
              />
              <p v-else class="text-muted q-my-none">Nothing drawn yet.</p>
            </dashboard-tile>
          </li>
          <li>
            <dashboard-tile
              title="Recipes"
              :to="ROUTES.recipes"
              :icon="mdiChefHat"
              :loading="recipeStore.loading"
              :failed="recipesFailed"
            >
              <tile-list-preview
                :preview="recipePreview"
                count-label="saved"
                empty-text="None saved yet."
              />
            </dashboard-tile>
          </li>
          <li>
            <dashboard-tile
              title="Vacations"
              :to="ROUTES.vacations"
              :icon="mdiBagSuitcaseOutline"
              :loading="vacationStore.loading"
              :failed="vacationsFailed"
            >
              <vacation-tile
                v-if="vacationPreview"
                :lines="vacationPreview"
                :all-to="ROUTES.vacations"
              />
              <p v-else class="text-muted q-my-none">No vacation planned.</p>
            </dashboard-tile>
          </li>
        </ul>
      </nav>

      <!-- Beside the roster, whose button opens it: the roster only renders. -->
      <invite-dialog v-model="inviteOpen" />
    </div>
  </q-page>
</template>

<style scoped>
/* One column of a phone's width, also on a wider screen. */
.dashboard {
  max-width: 480px;
  margin: 0 auto;
}

/* Two tiles side by side, on the reference phone as well. */
.dashboard__tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}

/* A tile fills its cell, so the two of a row are equally high. */
.dashboard__tiles > li {
  display: flex;
  min-width: 0;
}
</style>
