<script setup lang="ts">
import type { TaskShare, VacationPerson } from "~/types/vacation";

/**
 * "Who has what": the open tasks of every person on the trip, out in the
 * open, so it shows who carries how much and who carries nothing. A strip
 * of names with their numbers, not a row per person: with a row each, four
 * people filled 42% of a phone's screen and no task was on it without
 * scrolling.
 */
const props = defineProps<{
  /** One line per person, and the tasks that are nobody's (see taskShares). */
  shares: TaskShare[];
  /** The person the signed-in member is on this trip, or null. */
  me: VacationPerson | null;
  /** The members' email addresses by user id, for their avatars. */
  emails: Record<string, string>;
}>();
const emit = defineEmits<{ changePeople: [] }>();

const changeButton = useTemplateRef<{ $el: HTMLElement }>("changeButton");

const nothingOpen = computed(() =>
  props.shares.every((share) => share.open === 0),
);
const hasPeople = computed(() => props.shares.some((share) => share.person));

function emailOf(person: VacationPerson): string | null {
  return person.user_id ? (props.emails[person.user_id] ?? null) : null;
}

defineExpose({
  /** Puts the focus on "Change people", when the list of names closes. */
  focusChangePeople: () => changeButton.value?.$el.focus(),
});
</script>

<template>
  <section>
    <h3 class="fair-share__heading">
      <span>Who has what</span>
      <q-btn
        ref="changeButton"
        flat
        label="Change people"
        class="touch-target"
        @click="emit('changePeople')"
      />
    </h3>

    <p v-if="!hasPeople" class="text-muted q-my-none">
      Nobody is on this trip yet. Add the people who are coming, and tasks can
      be given to them.
    </p>
    <p v-else-if="nothingOpen" class="text-muted q-my-none">Nothing open.</p>

    <!-- role="list" because Safari stops announcing a list once its bullets
         are styled away. -->
    <ul v-else role="list" class="fair-share">
      <li v-for="share in shares" :key="share.person?.id ?? 'nobody'">
        <template v-if="share.person">
          <person-avatar :email="emailOf(share.person)" :size="24" />
          <span class="fair-share__name">{{ share.person.name }}</span>
          <!-- Beside the name, not in it: a long name is cut short, and
               "(you)" has to stay. -->
          <span v-if="share.person.id === me?.id" class="fair-share__you">{{
            " (you)"
          }}</span>
        </template>
        <span v-else class="fair-share__name text-muted">Nobody yet</span>
        <span class="fair-share__open">{{ share.open }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
/* Quasar styles a bare h3 as a 3rem display line. */
.fair-share__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 16px 0 4px;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5rem;
  letter-spacing: normal;
}

.fair-share {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Nothing here is pressed, so a line is as high as its text needs, not
   the 44px of a control. */
.fair-share li {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 36px;
}

.fair-share__name {
  max-width: 6.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Its leading space is kept: the gap between the two is the flex gap of
   the others, and the text reads "Anna (you)" to a screen reader. */
.fair-share__you {
  margin-left: -6px;
  white-space: pre;
}

.fair-share__open {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
</style>
