<script setup lang="ts">
import {
  mdiAccountPlusOutline,
  mdiChevronDown,
  mdiLogout,
} from "@quasar/extras/mdi-v7";
import type { QBtn } from "quasar";

const props = defineProps<{
  /** The signed-in user's address. */
  email: string;
}>();

/** Signing out needs the Supabase client, which the layout holds; the menu
 * only reports that it was asked for. */
const emit = defineEmits<{ signOut: [] }>();

const householdStore = useHouseholdStore();

const AVATAR_SIZE = 32;

const menuOpen = ref(false);
const inviteOpen = ref(false);
const trigger = useTemplateRef<QBtn>("trigger");

/** The button shows only the avatar, so its name says whose account it is. */
const triggerLabel = computed(() => `Account, ${props.email}`);

/** The dialog replaces the menu instead of opening on top of it. */
function openInviteDialog() {
  menuOpen.value = false;
  inviteOpen.value = true;
}

/** The dialog was opened from a menu entry that is gone by the time it
 * closes, so the keyboard focus would be left on nothing. It goes back to
 * the button the way into the dialog started from. */
function returnFocusToTrigger() {
  (trigger.value?.$el as HTMLElement | undefined)?.focus();
}

/** Closes the menu and hands the request to the layout, which owns the
 * Supabase client. */
function requestSignOut() {
  menuOpen.value = false;
  emit("signOut");
}
</script>

<template>
  <!-- The avatar is in the button, so it is on screen whether the menu is
       open or not. No label on the avatar itself: the button carries the
       name. The pill and the chevron say that it opens something, which a
       bare picture does not, least of all on a phone without hover. -->
  <q-btn
    ref="trigger"
    flat
    rounded
    no-wrap
    padding="6px 8px 6px 6px"
    class="account-menu__trigger"
    :class="{ 'account-menu__trigger--open': menuOpen }"
    :aria-label="triggerLabel"
    :aria-expanded="menuOpen"
  >
    <user-avatar
      :email="email"
      :size="AVATAR_SIZE"
      class="account-menu__avatar"
    />
    <q-icon
      :name="mdiChevronDown"
      size="20px"
      class="account-menu__chevron"
      aria-hidden="true"
    />
    <!-- Not over the open menu, whose first line says more. -->
    <q-tooltip v-if="!menuOpen">Account</q-tooltip>
    <!-- A group, not role="menu": that role allows only menu items, and
         the address is none. -->
    <q-menu
      v-model="menuOpen"
      anchor="bottom right"
      self="top right"
      :offset="[0, 4]"
      role="group"
      aria-label="Account"
    >
      <div class="account-menu column">
        <p class="account-menu__email">{{ email }}</p>
        <q-separator />
        <!-- Real buttons rather than list items, which have no role that
             says they can be pressed. -->
        <q-btn
          v-if="householdStore.household"
          flat
          align="left"
          :icon="mdiAccountPlusOutline"
          label="Invite a family member"
          @click="openInviteDialog"
        />
        <q-btn
          flat
          align="left"
          :icon="mdiLogout"
          label="Sign out"
          @click="requestSignOut"
        />
      </div>
    </q-menu>
  </q-btn>

  <!-- Beside the menu, not inside it: the menu's content is removed when it
       closes, and the dialog would go with it. -->
  <invite-dialog v-model="inviteOpen" @hide="returnFocusToTrigger" />
</template>

<style scoped>
/* 44px is the smallest comfortable target for a thumb. The darker blue
   gives the button a shape while nothing points at it. */
.account-menu__trigger {
  min-height: 44px;
  background: rgb(0 0 0 / 0.15);
}

/* Stays dark while the menu is open, so the two read as one thing. */
.account-menu__trigger--open {
  background: rgb(0 0 0 / 0.4);
}

.account-menu__trigger:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.account-menu__chevron {
  margin-left: 2px;
}

.account-menu__trigger--open .account-menu__chevron {
  transform: rotate(180deg);
}

/* A white ring around the picture, which hides the header's dark highlight
   where it lies. */
.account-menu__trigger:focus-visible .account-menu__avatar,
.account-menu__trigger--open .account-menu__avatar {
  box-shadow: 0 0 0 2px #fff;
}

/* As Quasar does: on a touch screen a hover would stick after the tap. */
@media (any-hover: hover) {
  .account-menu__trigger:hover .account-menu__avatar {
    box-shadow: 0 0 0 2px #fff;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .account-menu__chevron {
    transition: transform 0.15s ease-out;
  }
}

.account-menu {
  max-width: 320px;
}

/* The whole address, on as many lines as it needs: the header used to cut
   it short. */
.account-menu__email {
  margin: 0;
  padding: 12px 16px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
</style>
