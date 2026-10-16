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

const { burst, playFrom: celebrateFrom } = useCelebration("shopping");

/**
 * The person's own tap on an item's box. When it ticks off the last open
 * item, a burst plays from the box, at most once a minute; the check looks
 * at the list before the tick, which the store makes at once. A tick that
 * arrives by Realtime comes through the store only and never plays one.
 */
function toggleFromTap(id: string, box: DOMRect) {
  if (ticksLastOpen(shoppingStore.toBuy, id)) celebrateFrom(box);
  void shoppingStore.toggle(id);
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

    <q-list
      v-else
      bordered
      separator
      class="list-rows"
      :data-testid="TEST_IDS.list.items"
    >
      <!-- No tag: the rows stay the list's own children, for its separators
           and its role. The motion is in assets/css/motion.css. -->
      <transition-group name="list-row" @before-leave="makeLeavingRowInert">
        <shopping-item
          v-for="item in shoppingStore.visible"
          :key="item.id"
          :item="item"
          @toggle="toggleFromTap"
          @remove="shoppingStore.remove"
        />
      </transition-group>
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

    <celebration-burst
      v-if="burst"
      :key="burst.id"
      :origin="burst"
      feature="shopping"
    />

    <p
      v-if="shoppingStore.error"
      class="text-negative"
      :data-testid="TEST_IDS.errorMessage"
    >
      {{ shoppingStore.error }}
    </p>
  </div>
</template>
