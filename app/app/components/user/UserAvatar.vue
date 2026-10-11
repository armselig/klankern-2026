<script setup lang="ts">
const props = defineProps<{
  email: string;
  /** Width and height in CSS pixels. */
  size: number;
  /** Names the person for assistive technology and as a tooltip. Left out
   * where something around the avatar names the person already (the
   * header's account button), which makes the avatar decoration. */
  label?: string;
}>();

/** How much of the ink colors the disc behind the rosette. Laid over white,
 * so the tint is the same on the white card and on the blue header. */
const DISC_TINT = 0.14;

const center = ROSETTE_BOX / 2;

const hash = useGravatarHash(() => props.email);

/** The app's own drawing. It is there as soon as the hash is, so an avatar
 * never waits for Gravatar, and it stays when Gravatar has no picture or
 * can't be reached. */
const rosette = computed(() => (hash.value ? avatarRosette(hash.value) : null));

/** Where the Gravatar picture is: asked for, shown, or not to be had (the
 * person has none, or the device is offline). */
const photo = ref<"pending" | "loaded" | "missing">("pending");

// Another address is another picture, which has to be asked for anew.
watch(hash, () => {
  photo.value = "pending";
});
</script>

<template>
  <!-- Grey until the hash is known; the rosette's disc then covers it. -->
  <q-avatar
    :size="`${size}px`"
    color="grey-4"
    class="user-avatar"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    :title="label"
  >
    <!-- Removed once the photo is shown: a Gravatar picture may be
         transparent, and the rosette would show through it. -->
    <svg
      v-if="rosette && photo !== 'loaded'"
      :viewBox="`0 0 ${ROSETTE_BOX} ${ROSETTE_BOX}`"
      width="100%"
      height="100%"
    >
      <circle :cx="center" :cy="center" :r="center" fill="#fff" />
      <circle
        :cx="center"
        :cy="center"
        :r="center"
        :fill="rosette.color"
        :fill-opacity="DISC_TINT"
      />
      <whiteboard-stroke :stroke="rosette" />
    </svg>
    <!-- Twice the size, for screens with two device pixels per CSS pixel.
         Lazy, so a slow gravatar.com never holds up the page's load event.
         No referrer: Gravatar needs the hash, not the page it is shown on. -->
    <img
      v-if="hash && photo !== 'missing'"
      :key="hash"
      :src="gravatarUrl(hash, size * 2)"
      alt=""
      :width="size"
      :height="size"
      loading="lazy"
      referrerpolicy="no-referrer"
      class="user-avatar__photo"
      @load="photo = 'loaded'"
      @error="photo = 'missing'"
    />
  </q-avatar>
</template>

<style scoped>
/* A circle wherever it stands: in a row that runs out of space, the
   neighbours give way, not the avatar. */
.user-avatar {
  flex-shrink: 0;
}

/* Over the rosette rather than beside it: while the photo is loading it is
   empty and the rosette shows through. */
.user-avatar__photo {
  position: absolute;
  inset: 0;
}
</style>
