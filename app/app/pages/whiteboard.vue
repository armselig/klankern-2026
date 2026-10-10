<script setup lang="ts">
useHead({ title: 'Whiteboard' })

const householdStore = useHouseholdStore()

onMounted(async () => {
  if (!householdStore.household) await householdStore.fetchMine()
})
</script>

<template>
  <q-page padding>
    <q-spinner v-if="householdStore.loading" color="primary" size="2em" />
    <div v-else-if="householdStore.household" style="max-width: 960px">
      <h1 class="text-h6">Whiteboard</h1>
      <SharedWhiteboard :household-id="householdStore.household.id" />
    </div>
    <p v-else>
      You need a household first -- go to
      <NuxtLink :to="ROUTES.home">the dashboard</NuxtLink>
      to create or join one.
    </p>
  </q-page>
</template>
