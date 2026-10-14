<script setup lang="ts">
import { mdiPlus } from "@quasar/extras/mdi-v7";

/** Inviting needs a dialog, which the dashboard page holds; the roster only
 * reports that it was asked for. */
const emit = defineEmits<{ invite: [] }>();

const householdStore = useHouseholdStore();

const AVATAR_SIZE = 48;

/** The same size for the place next to the members that is still empty. */
const emptyPlaceSize = `${AVATAR_SIZE}px`;
</script>

<template>
  <div class="member-roster">
    <!-- Renders what the store holds; the dashboard page decides when the
         members are fetched. role="list" because Safari stops announcing a
         list once its bullets are styled away. -->
    <ul
      role="list"
      aria-label="Household members"
      :data-testid="TEST_IDS.household.members"
      class="member-roster__members"
    >
      <li
        v-for="member in householdStore.members"
        :key="member.user_id"
        class="member-roster__member column items-center"
        :data-testid="TEST_IDS.household.member"
      >
        <!-- The whole address is the avatar's name and tooltip. The caption
             is only the part before the @, which fits under an avatar. -->
        <user-avatar
          :email="member.email"
          :size="AVATAR_SIZE"
          :label="member.email"
          :data-testid="TEST_IDS.household.memberAvatar"
        />
        <span class="member-roster__name text-caption ellipsis">
          {{ emailLocalPart(member.email) }}
        </span>
      </li>
    </ul>
    <!-- Where the next member would stand, but beside the list, not in it:
         it is no member. No color, so it gets the theme's highlight for a
         flat button (assets/css/hover-contrast.css). -->
    <q-btn
      flat
      no-caps
      padding="0"
      :data-testid="TEST_IDS.household.inviteButton"
      class="member-roster__member"
      @click="emit('invite')"
    >
      <span class="column items-center">
        <span class="member-roster__empty-place">
          <q-icon :name="mdiPlus" size="24px" aria-hidden="true" />
        </span>
        <span class="text-caption">Invite</span>
      </span>
    </q-btn>
  </div>

  <p
    v-if="householdStore.membersError"
    class="text-negative"
    :data-testid="TEST_IDS.errorMessage"
  >
    Couldn't load the household members. Reload the page to try again.
  </p>
</template>

<style scoped>
/* The button follows the members in their row; once they fill more than
   one row, it stands below them. */
.member-roster,
.member-roster__members {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.member-roster {
  margin: 8px 0 0;
  /* An avatar and one line of caption, so the page keeps its layout while
     the members are still on their way. */
  min-height: 68px;
}

.member-roster__members {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Wider than the avatar, to leave room for a name. */
.member-roster__member {
  width: 72px;
}

.member-roster__name {
  max-width: 100%;
}

/* A circle of an avatar's size with nobody in it yet. */
.member-roster__empty-place {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: v-bind(emptyPlaceSize);
  height: v-bind(emptyPlaceSize);
  border: 2px dashed var(--theme-outline);
  border-radius: 50%;
}
</style>
