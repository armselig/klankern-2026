<script setup lang="ts">
const householdStore = useHouseholdStore();
const name = ref("");

async function submit() {
  if (!name.value.trim()) return;
  await householdStore.create(name.value.trim());
}
</script>

<template>
  <q-card style="width: 100%; max-width: 360px">
    <q-card-section>
      <h2 class="text-h6 q-my-none">Set up your household</h2>
      <p>Give your household a name to start sharing lists with your family.</p>
    </q-card-section>

    <q-card-section>
      <q-form @submit.prevent="submit">
        <q-input v-model="name" label="Household name" autofocus required />
        <div class="q-mt-md">
          <q-btn
            type="submit"
            color="primary"
            label="Create household"
            :loading="householdStore.loading"
            unelevated
          />
        </div>
      </q-form>
    </q-card-section>

    <q-card-section v-if="householdStore.error" class="text-negative">
      {{ householdStore.error }}
    </q-card-section>
  </q-card>
</template>
