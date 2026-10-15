<script setup lang="ts">
import { mdiPlus } from "@quasar/extras/mdi-v7";
import type { HouseholdChild } from "~/types/kids";

/**
 * The household's children under its members: each with the letters of the
 * name on a disc (no Gravatar: a child's name never leaves the app), a menu
 * to rename or remove the child, a button to add one, and the link to what
 * the kids refused. It only renders and reports; the dashboard does the
 * writes.
 */
const props = defineProps<{ children: readonly HouseholdChild[] }>();
const emit = defineEmits<{
  add: [];
  rename: [child: HouseholdChild];
  remove: [child: HouseholdChild];
}>();

const AVATAR_SIZE = 48;
const emptyPlaceSize = `${AVATAR_SIZE}px`;

/** The child whose menu is open. Opened by the button's own press, not by
 * Quasar's listener, which also opens it when Enter is released on the
 * button (see VacationTask.vue). */
const menuChildId = ref<string | null>(null);

function toggleMenu(id: string) {
  menuChildId.value = menuChildId.value === id ? null : id;
}

function choose(action: "rename" | "remove", child: HouseholdChild) {
  menuChildId.value = null;
  if (action === "rename") emit("rename", child);
  else emit("remove", child);
}

const childButtons = new Map<string, HTMLElement>();
function rememberButton(id: string, button: unknown) {
  const element = (button as { $el?: HTMLElement } | null)?.$el;
  if (element) childButtons.set(id, element);
  else childButtons.delete(id);
}

defineExpose({
  /** Puts the focus back on a child's button after a dialog opened from its
   * menu has gone; on the add button when the child is gone. */
  focusChild: (id: string) =>
    (childButtons.get(id) ?? addButton.value?.$el)?.focus(),
});
const addButton = useTemplateRef<{ $el: HTMLElement }>("addButton");

const hasChildren = computed(() => props.children.length > 0);
</script>

<template>
  <section
    class="kid-roster"
    aria-labelledby="kid-roster-heading"
    :data-testid="TEST_IDS.kids.roster"
  >
    <h3 id="kid-roster-heading" class="kid-roster__heading">Kids</h3>
    <div class="kid-roster__row">
      <ul
        v-if="hasChildren"
        role="list"
        aria-labelledby="kid-roster-heading"
        class="kid-roster__children"
      >
        <li
          v-for="child in children"
          :key="child.id"
          :data-testid="TEST_IDS.kids.child"
        >
          <q-btn
            :ref="(button) => rememberButton(child.id, button)"
            flat
            no-caps
            padding="0"
            class="kid-roster__place"
            :aria-label="`${child.name}: rename or remove`"
            :aria-expanded="menuChildId === child.id"
            :data-testid="TEST_IDS.kids.childButton"
            @click="toggleMenu(child.id)"
          >
            <span class="column items-center">
              <person-avatar
                :email="null"
                :size="AVATAR_SIZE"
                :person="{ id: child.id, name: child.name, user_id: null }"
              />
              <span
                class="kid-roster__name text-caption ellipsis"
                :data-testid="TEST_IDS.kids.childName"
              >
                {{ child.name }}
              </span>
            </span>
            <q-menu
              :model-value="menuChildId === child.id"
              no-parent-event
              anchor="bottom left"
              self="top left"
              role="group"
              :aria-label="child.name"
              :data-testid="TEST_IDS.kids.childMenu.group"
              @update:model-value="
                (open: boolean) => {
                  if (!open && menuChildId === child.id) menuChildId = null;
                }
              "
            >
              <div class="column kid-roster__menu">
                <q-btn
                  flat
                  no-caps
                  align="left"
                  label="Rename"
                  class="touch-target"
                  :data-testid="TEST_IDS.kids.childMenu.rename"
                  @click="choose('rename', child)"
                />
                <q-btn
                  flat
                  no-caps
                  align="left"
                  label="Remove"
                  class="touch-target"
                  :data-testid="TEST_IDS.kids.childMenu.remove"
                  @click="choose('remove', child)"
                />
              </div>
            </q-menu>
          </q-btn>
        </li>
      </ul>
      <!-- Beside the list, not in it: it is no child. No color, so it gets
           the theme's highlight for a flat button. -->
      <q-btn
        ref="addButton"
        flat
        no-caps
        padding="0"
        class="kid-roster__place"
        :data-testid="TEST_IDS.kids.addButton"
        @click="emit('add')"
      >
        <span class="column items-center">
          <span class="kid-roster__empty-place">
            <q-icon :name="mdiPlus" size="24px" aria-hidden="true" />
          </span>
          <span class="text-caption">Add child</span>
        </span>
      </q-btn>
    </div>
    <nuxt-link
      v-if="hasChildren"
      :to="ROUTES.kids"
      class="kid-roster__link"
      :data-testid="TEST_IDS.kids.recordLink"
      >What the kids refused</nuxt-link
    >
  </section>
</template>

<style scoped>
.kid-roster {
  margin-top: 12px;
}

/* Quasar styles a bare h3 as a display line. */
.kid-roster__heading {
  margin: 0 0 4px;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.5rem;
  letter-spacing: normal;
}

/* As the members' roster: the add button follows the children in their
   row. */
.kid-roster__row,
.kid-roster__children {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.kid-roster__children {
  margin: 0;
  padding: 0;
  list-style: none;
}

.kid-roster__place {
  width: 72px;
}

.kid-roster__name {
  max-width: 72px;
}

.kid-roster__menu {
  min-width: 10rem;
}

.kid-roster__empty-place {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: v-bind(emptyPlaceSize);
  height: v-bind(emptyPlaceSize);
  border: 2px dashed var(--theme-outline);
  border-radius: 50%;
}

/* A link of its own line, as tall as a thumb needs. */
.kid-roster__link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}
</style>
