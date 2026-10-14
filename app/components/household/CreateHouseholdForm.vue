<script setup lang="ts">
const householdStore = useHouseholdStore();
const name = ref("");

async function submit() {
  if (!name.value.trim()) return;
  await householdStore.create(name.value.trim());
}
</script>

<template>
  <q-card
    style="width: 100%; max-width: 360px"
    :data-testid="TEST_IDS.household.createForm"
  >
    <q-card-section>
      <h2 class="text-h6 q-my-none">Set up your household</h2>
      <p>Give your household a name to start sharing lists with your family.</p>
    </q-card-section>

    <q-card-section>
      <q-form @submit.prevent="submit">
        <q-input
          v-model="name"
          label="Household name"
          :data-testid="TEST_IDS.household.nameInput"
          autofocus
          required
        />
        <div class="q-mt-md">
          <q-btn
            type="submit"
            color="primary"
            label="Create household"
            :data-testid="TEST_IDS.household.createButton"
            :loading="householdStore.loading"
            unelevated
          />
        </div>
      </q-form>
    </q-card-section>

    <q-card-section
      v-if="householdStore.error"
      class="text-negative"
      :data-testid="TEST_IDS.errorMessage"
    >
      {{ householdStore.error }}
    </q-card-section>
  </q-card>
</template>
