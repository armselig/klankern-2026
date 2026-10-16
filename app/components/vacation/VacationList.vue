<script setup lang="ts">
import { mdiPlus } from "@quasar/extras/mdi-v7";
import type { Vacation } from "~/types/vacation";

const props = defineProps<{ householdId: string }>();
const vacationStore = useVacationStore();

onMounted(() => vacationStore.load(props.householdId));

/** The day the list was opened on; see VacationView. */
const today = localDateOf(new Date());

const groups = computed(() => vacationStore.groups(today));
const isEmpty = computed(
  () => groups.value.current.length === 0 && groups.value.past.length === 0,
);

/** The line under a current vacation's title: its dates, where it stands
 * and what is still open. */
function currentLine(vacation: Vacation): string {
  const open = openTaskCount(vacationStore.tasksOf(vacation.id));
  return [
    vacationDates(vacation, today),
    stageLine(vacation, today),
    `${open} open`,
  ].join(" · ");
}
</script>

<template>
  <div>
    <q-spinner v-if="vacationStore.loading" color="primary" />

    <template v-else-if="vacationStore.householdId">
      <p
        v-if="isEmpty"
        class="text-muted"
        :data-testid="TEST_IDS.vacation.list.empty"
      >
        No vacations yet. Add your next trip, then what has to be done before,
        during and after it.
      </p>

      <q-btn
        :to="ROUTES.vacationNew"
        color="primary"
        :icon="mdiPlus"
        label="Add vacation"
        :data-testid="TEST_IDS.vacation.list.add"
        unelevated
        class="touch-target q-mb-md"
      />

      <!-- Lists of links, so plain uls: a q-item that is a link is no list
           item to a screen reader, and a q-list would hold no items. The
           upper one has no heading: it holds what is coming, what is
           running and what is over but not unpacked. -->
      <ul v-if="groups.current.length > 0" role="list" class="vacation-list">
        <li v-for="vacation in groups.current" :key="vacation.id">
          <q-item
            :to="ROUTES.vacation(vacation.id)"
            :data-testid="TEST_IDS.vacation.list.link"
          >
            <q-item-section>
              <q-item-label class="vacation-list__title">
                {{ vacation.title }}
              </q-item-label>
              <q-item-label caption class="text-muted">
                {{ currentLine(vacation) }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </li>
      </ul>

      <template v-if="groups.past.length > 0">
        <h3 class="vacation-list__heading">Past</h3>
        <ul role="list" class="vacation-list">
          <li v-for="vacation in groups.past" :key="vacation.id">
            <q-item
              :to="ROUTES.vacation(vacation.id)"
              :data-testid="TEST_IDS.vacation.list.link"
            >
              <q-item-section>
                <q-item-label class="vacation-list__title">
                  {{ vacation.title }}
                </q-item-label>
                <q-item-label caption class="text-muted">
                  {{ vacationDates(vacation, today) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </li>
        </ul>
      </template>
    </template>

    <p
      v-if="vacationStore.error"
      role="alert"
      class="text-negative q-mt-md"
      :data-testid="TEST_IDS.errorMessage"
    >
      {{ vacationStore.error }}
    </p>
  </div>
</template>

<style scoped>
.vacation-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--theme-outline);
  border-radius: var(--radius-card);
}

.vacation-list li + li {
  border-top: 1px solid var(--theme-outline);
}

/* A title is one long word at worst; it wraps rather than widening the
   page. */
.vacation-list__title {
  overflow-wrap: anywhere;
}

/* Quasar styles a bare h3 as a 3rem display line. */
.vacation-list__heading {
  margin: 16px 0 4px;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5rem;
  letter-spacing: normal;
}
</style>
