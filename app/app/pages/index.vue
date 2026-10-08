<script setup lang="ts">
const householdStore = useHouseholdStore()

onMounted(() => householdStore.fetchMine())
</script>

<template>
  <q-page padding class="flex flex-center">
    <q-spinner v-if="householdStore.loading" color="primary" size="2em" />

    <CreateHouseholdForm v-else-if="!householdStore.household" />

    <q-card v-else style="width: 100%; max-width: 480px">
      <q-card-section>
        <div class="text-h6">{{ householdStore.household.name }}</div>
      </q-card-section>
      <q-card-section>
        <InviteDialog />
      </q-card-section>
      <q-card-section>
        <q-btn :to="ROUTES.todos" color="primary" label="To-dos" unelevated />
        <q-btn :to="ROUTES.shopping" color="primary" label="Shopping" unelevated class="q-ml-sm" />
      </q-card-section>
    </q-card>
  </q-page>
</template>
