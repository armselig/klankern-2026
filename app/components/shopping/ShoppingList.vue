<script setup lang="ts">
import { mdiPlus } from "@quasar/extras/mdi-v7";

const props = defineProps<{ householdId: string }>();
const shoppingStore = useShoppingStore();

onMounted(() => shoppingStore.load(props.householdId));

const newTitle = ref("");
const newQuantity = ref("");
const titleInput = useTemplateRef<{ focus: () => void }>("titleInput");

/** Adds the typed item and puts focus back in the item field, so several
 * items can be entered in a row. An empty quantity is stored as null. */
async function add() {
  const title = newTitle.value.trim();
  if (!title) return;
  const quantity = newQuantity.value.trim() || null;
  newTitle.value = "";
  newQuantity.value = "";
  titleInput.value?.focus();
  await shoppingStore.add(title, quantity);
}
</script>

<template>
  <div>
    <q-form class="row q-gutter-sm q-mb-md" @submit.prevent="add">
      <q-input
        ref="titleInput"
        v-model="newTitle"
        label="Item"
        :data-testid="TEST_IDS.shopping.titleInput"
        class="col"
        autofocus
      />
      <q-input
        v-model="newQuantity"
        label="Quantity (optional)"
        :data-testid="TEST_IDS.shopping.quantityInput"
        class="col-4"
      />
      <q-btn
        type="submit"
        color="primary"
        :icon="mdiPlus"
        label="Add"
        unelevated
      />
    </q-form>

    <q-spinner v-if="shoppingStore.loading" color="primary" />

    <q-list v-else bordered separator :data-testid="TEST_IDS.list.items">
      <shopping-item
        v-for="item in shoppingStore.visible"
        :key="item.id"
        :item="item"
        @toggle="shoppingStore.toggle"
        @remove="shoppingStore.remove"
      />
      <q-item v-if="shoppingStore.visible.length === 0">
        <q-item-section>
          <empty-state feature="shopping">
            <span class="text-muted" :data-testid="TEST_IDS.list.empty"
              >Nothing on the list yet.</span
            >
          </empty-state>
        </q-item-section>
      </q-item>
    </q-list>

    <p
      v-if="shoppingStore.error"
      class="text-negative"
      :data-testid="TEST_IDS.errorMessage"
    >
      {{ shoppingStore.error }}
    </p>
  </div>
</template>
