<script setup lang="ts">
/**
 * Asks for a child's name, to add a child or to rename one. It only reports
 * the name; saving is the page's.
 */
const props = defineProps<{
  /** "Add a child", or "Rename Mila". */
  title: string;
  /** The name the field starts with: empty for a new child. */
  initialName: string;
}>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ save: [name: string]; hide: [] }>();

const name = ref("");
const blank = ref(false);

watch(
  open,
  (isOpen) => {
    if (!isOpen) return;
    name.value = props.initialName;
    blank.value = false;
  },
  { immediate: true },
);

function save() {
  const trimmed = name.value.trim();
  if (!trimmed) {
    blank.value = true;
    return;
  }
  emit("save", trimmed);
  open.value = false;
}
</script>

<template>
  <q-dialog v-model="open" @hide="emit('hide')">
    <q-card class="child-name-dialog">
      <form class="child-name-dialog__form" @submit.prevent="save">
        <h2
          class="text-h6 q-my-none"
          :data-testid="TEST_IDS.kids.nameDialog.title"
        >
          {{ title }}
        </h2>
        <q-input
          v-model="name"
          label="Name"
          :maxlength="CHILD_NAME_LIMIT"
          autofocus
          outlined
          :data-testid="TEST_IDS.kids.nameDialog.input"
          @update:model-value="blank = false"
        />
        <p
          v-if="blank"
          class="text-negative q-my-none"
          role="alert"
          :data-testid="TEST_IDS.kids.nameDialog.error"
        >
          Write the child's name
        </p>
        <p class="text-muted q-my-none">
          Only your household sees it. Kids don't sign in.
        </p>
        <div class="child-name-dialog__actions">
          <q-btn
            flat
            no-caps
            class="touch-target"
            label="Cancel"
            @click="open = false"
          />
          <q-btn
            type="submit"
            unelevated
            no-caps
            color="primary"
            class="touch-target"
            label="Save"
            :data-testid="TEST_IDS.kids.nameDialog.save"
          />
        </div>
      </form>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.child-name-dialog {
  width: min(24rem, 100vw - 32px);
}

.child-name-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.child-name-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
