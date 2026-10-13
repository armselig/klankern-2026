<script setup lang="ts">
import type { TaskFilter, TaskShare, VacationPerson } from "~/types/vacation";

/**
 * "Who has what": the open tasks of every person on the trip, out in the
 * open, so it shows who carries how much and who carries nothing. A strip
 * of names with their numbers, not a row per person: with a row each, four
 * people filled 42% of a phone's screen and no task was on it without
 * scrolling.
 *
 * Each line is a button that leaves that person's open tasks on the page,
 * or those nobody has, until it is pressed again: the numbers raise the
 * question whose tasks they are, and this is where it comes up.
 */
const props = defineProps<{
  /** One line per person, and the tasks that are nobody's (see taskShares). */
  shares: TaskShare[];
  /** The person the signed-in member is on this trip, or null. */
  me: VacationPerson | null;
  /** The members' email addresses by user id, for their avatars. */
  emails: Record<string, string>;
  /** Whose open tasks the page shows alone, or null for all tasks. */
  shown: TaskFilter | null;
  /** What to say under the lines while the tasks are filtered. */
  hint: string | null;
}>();
const emit = defineEmits<{
  changePeople: [];
  /** A line was pressed: show its tasks alone, or with null all again. */
  show: [filter: TaskFilter | null];
}>();

const changeButton = useTemplateRef<{ $el: HTMLElement }>("changeButton");

const view = computed(() => shareView(props.shares));

function isShown(share: TaskShare): boolean {
  return !!props.shown && props.shown.person?.id === share.person?.id;
}

function toggleShown(share: TaskShare) {
  emit("show", isShown(share) ? null : { person: share.person });
}

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

    <p v-if="view === 'no-people'" class="text-muted q-my-none">
      Nobody is on this trip yet. Add the people who are coming, and tasks can
      be given to them.
    </p>
    <p v-else-if="view === 'nothing-open'" class="text-muted q-my-none">
      Nothing open.
    </p>

    <template v-else>
      <!-- role="list" because Safari stops announcing a list once its
           bullets are styled away. -->
      <ul role="list" class="fair-share">
        <li v-for="share in shares" :key="share.person?.id ?? 'nobody'">
          <q-btn
            flat
            no-caps
            class="touch-target fair-share__line"
            :class="{ 'fair-share__line--shown': isShown(share) }"
            :aria-pressed="isShown(share)"
            @click="toggleShown(share)"
          >
            <template v-if="share.person">
              <person-avatar :email="emailOf(share.person)" :size="24" />
              <span class="fair-share__name">{{ share.person.name }}</span>
              <!-- Beside the name, not in it: a long name is cut short, and
                   "(you)" has to stay. -->
              <span v-if="share.person.id === me?.id" class="fair-share__you">{{
                " (you)"
              }}</span>
            </template>
            <!-- Not muted, as it was before it could be pressed: under the
                 veil of hover and focus muted text is below 4.5:1. -->
            <span v-else class="fair-share__name">Nobody yet</span>
            <!-- The space is for the button's name, "Mia 1": between the
                 parts of a flex row it takes no room. -->
            {{ " " }}<span class="fair-share__open">{{ share.open }}</span>
          </q-btn>
        </li>
      </ul>
      <p v-if="hint" class="fair-share__hint text-muted">{{ hint }}</p>
    </template>
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

/* A line's own padding is the space between two of them, and the list
   reaches that far out of the page's column, so the first avatar stands
   under the heading. */
.fair-share {
  display: flex;
  flex-wrap: wrap;
  margin: 0 -8px;
  padding: 0;
  list-style: none;
}

.fair-share li {
  min-width: 0;
}

.fair-share__line {
  padding: 0 8px;
  font-weight: 400;
}

/* Quasar wraps a button's content; a line stays one. */
.fair-share__line :deep(.q-btn__content) {
  flex-wrap: nowrap;
  gap: 6px;
}

/* The pressed line is told by a frame and not by a fill, so it does not
   depend on a color alone and its text keeps its contrast. */
.fair-share__line--shown {
  box-shadow: inset 0 0 0 2px currentColor;
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

.fair-share__hint {
  margin: 4px 0 0;
  font-size: 0.8125rem;
}
</style>
