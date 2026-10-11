<script setup lang="ts">
const householdStore = useHouseholdStore()

const AVATAR_SIZE = 48
</script>

<template>
  <!-- Renders what the store holds; the dashboard page decides when the
       members are fetched. role="list" because Safari stops announcing a
       list once its bullets are styled away. -->
  <ul role="list" aria-label="Household members" class="member-roster">
    <li
      v-for="member in householdStore.members"
      :key="member.user_id"
      class="member-roster__member column items-center"
    >
      <!-- The whole address is the avatar's name and tooltip. The caption
           is only the part before the @, which fits under an avatar. -->
      <UserAvatar :email="member.email" :size="AVATAR_SIZE" :label="member.email" />
      <span class="member-roster__name text-caption ellipsis">
        {{ emailLocalPart(member.email) }}
      </span>
    </li>
  </ul>

  <p v-if="householdStore.membersError" class="text-negative">
    Couldn't load the household members. Reload the page to try again.
  </p>
</template>

<style scoped>
.member-roster {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  /* An avatar and one line of caption, so the card keeps its height while
     the members are still on their way. */
  min-height: 68px;
}

/* Wider than the avatar, to leave room for a name. */
.member-roster__member {
  width: 72px;
}

.member-roster__name {
  max-width: 100%;
}
</style>
