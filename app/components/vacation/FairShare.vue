<script setup lang="ts">
import { mdiShareVariantOutline } from "@quasar/extras/mdi-v7";
import type { TaskShare, VacationPerson } from "~/types/vacation";

/**
 * "Who has what": the open tasks of every person on the trip, out in the
 * open, so it shows who carries how much and who carries nothing.
 */
const props = defineProps<{
  /** One line per person, and the tasks that are nobody's (see taskShares). */
  shares: TaskShare[];
  /** The person the signed-in member is on this trip, or null. */
  me: VacationPerson | null;
  /** The members' email addresses by user id, for their avatars. */
  emails: Record<string, string>;
}>();
const emit = defineEmits<{
  changePeople: [];
  /** Send one message about everything a person has. */
  tell: [personId: string];
}>();

const changeButton = useTemplateRef<{ $el: HTMLElement }>("changeButton");

/** The longest bar is the full width; the others are measured against it. */
const most = computed(() =>
  Math.max(1, ...props.shares.map((share) => share.open)),
);
const nothingOpen = computed(() =>
  props.shares.every((share) => share.open === 0),
);
const hasPeople = computed(() => props.shares.some((share) => share.person));

function emailOf(person: VacationPerson): string | null {
  return person.user_id ? (props.emails[person.user_id] ?? null) : null;
}

/** A message can go to a person who can open its link: another person with
 * an account, who has something open. */
function canTell(share: TaskShare): boolean {
  return (
    !!share.person?.user_id &&
    share.person.id !== props.me?.id &&
    share.open > 0
  );
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
         are styled away. The number is text; the bar only repeats it. -->
    <ul v-else role="list" class="fair-share">
      <li v-for="share in shares" :key="share.person?.id ?? 'nobody'">
        <person-avatar
          v-if="share.person"
          :email="emailOf(share.person)"
          :size="24"
        />
        <span v-else class="fair-share__no-avatar" />
        <span class="fair-share__name" :class="{ 'text-muted': !share.person }">
          <template v-if="share.person">
            {{ share.person.name
            }}{{ share.person.id === me?.id ? " (you)" : "" }}
          </template>
          <template v-else>Nobody yet</template>
        </span>
        <span class="fair-share__track" aria-hidden="true">
          <span
            class="fair-share__bar"
            :style="{ width: `${(share.open / most) * 100}%` }"
          />
        </span>
        <span class="fair-share__open">{{ share.open }}</span>
        <q-btn
          v-if="canTell(share)"
          flat
          round
          :icon="mdiShareVariantOutline"
          :aria-label="`Tell ${share.person!.name} about their open tasks`"
          class="touch-target"
          @click="emit('tell', share.person!.id)"
        />
        <span v-else class="fair-share__no-button" />
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
  margin: 0;
  padding: 4px 8px 4px 12px;
  list-style: none;
  border: 1px solid var(--theme-outline);
  border-radius: 4px;
}

.fair-share li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}

.fair-share__no-avatar {
  flex: 0 0 24px;
}

.fair-share__name {
  flex: 0 0 76px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fair-share__track {
  flex: 1;
  height: 8px;
}

/* One muted color for every bar: a color per person would have to be
   calculated in both modes, and a person without an email address has
   none. */
.fair-share__bar {
  display: block;
  height: 8px;
  border-radius: 4px;
  background: var(--theme-text-muted);
}

.fair-share__open {
  flex: 0 0 20px;
  text-align: right;
}

.fair-share__no-button {
  flex: 0 0 44px;
}
</style>
