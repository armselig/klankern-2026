<script setup lang="ts">
import {
  mdiCartOutline,
  mdiChefHat,
  mdiDraw,
  mdiFormatListChecks,
} from "@quasar/extras/mdi-v7";

const householdStore = useHouseholdStore();

onMounted(() => householdStore.fetchMine());

// The members are fetched here, not by the roster: fetchMine() swaps the
// whole card for the spinner and back, so the roster is mounted twice on a
// visit and would fetch twice. Watching the id fetches once per visit, and
// also when a household is created on this page, which mounts nothing anew.
watch(
  () => householdStore.household?.id,
  () => void householdStore.fetchMembers(),
  { immediate: true },
);
</script>

<template>
  <q-page padding class="flex flex-center">
    <q-spinner v-if="householdStore.loading" color="primary" size="2em" />

    <create-household-form v-else-if="!householdStore.household" />

    <q-card v-else style="width: 100%; max-width: 480px">
      <q-card-section>
        <h2 class="text-h6 q-my-none">{{ householdStore.household.name }}</h2>
        <member-roster />
      </q-card-section>
      <q-card-section>
        <!-- A wrapping row: the buttons don't fit one line on a phone. -->
        <div class="row q-gutter-sm">
          <q-btn
            :to="ROUTES.todos"
            color="primary"
            :icon="mdiFormatListChecks"
            label="To-dos"
            unelevated
          />
          <q-btn
            :to="ROUTES.shopping"
            color="primary"
            :icon="mdiCartOutline"
            label="Shopping"
            unelevated
          />
          <q-btn
            :to="ROUTES.whiteboard"
            color="primary"
            :icon="mdiDraw"
            label="Whiteboard"
            unelevated
          />
          <q-btn
            :to="ROUTES.recipes"
            color="primary"
            :icon="mdiChefHat"
            label="Recipes"
            unelevated
          />
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>
