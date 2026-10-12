import { readonly, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { gravatarHash } from "~/utils/gravatar";

/**
 * The Gravatar hash of an email address, as a ref: hashing is asynchronous,
 * and a component can only render what it already has. `null` until the hash
 * is there, and for good when it can't be computed (no address, or no Web
 * Crypto because the page isn't served securely).
 *
 * A hash that arrives after the address has changed again is dropped;
 * otherwise a slow first hash could replace the newer one, and the avatar
 * would show the previous user. Imports from `vue` only, so it can be unit
 * tested without the Nuxt runtime.
 */
export function useGravatarHash(
  email: MaybeRefOrGetter<string | null | undefined>,
) {
  const hash = ref<string | null>(null);

  watch(
    () => toValue(email),
    async (address, _previousAddress, onCleanup) => {
      let outdated = false;
      onCleanup(() => {
        outdated = true;
      });
      hash.value = null;
      if (!address) return;
      try {
        const computed = await gravatarHash(address);
        if (!outdated) hash.value = computed;
      } catch {
        // Stays null: the avatar then shows its neutral disc.
      }
    },
    { immediate: true },
  );

  return readonly(hash);
}
