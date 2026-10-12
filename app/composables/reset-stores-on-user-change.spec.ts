import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { resetStoresOnUserChange } from "./reset-stores-on-user-change";

function setup(initialUserId: string | null) {
  const userId = ref<string | null>(initialUserId);
  const stores = [{ $reset: vi.fn() }, { $reset: vi.fn() }];
  resetStoresOnUserChange(userId, stores);
  return { userId, stores };
}

describe("resetStoresOnUserChange", () => {
  it("does not reset anything for the user already signed in", () => {
    const { stores } = setup("user-a");
    for (const store of stores) expect(store.$reset).not.toHaveBeenCalled();
  });

  it("resets every store on sign-out, before anything else sees the change", () => {
    const { userId, stores } = setup("user-a");
    userId.value = null;
    // Synchronous: no tick awaited.
    for (const store of stores) expect(store.$reset).toHaveBeenCalledTimes(1);
  });

  it("resets again when another user signs in", () => {
    const { userId, stores } = setup(null);
    userId.value = "user-b";
    for (const store of stores) expect(store.$reset).toHaveBeenCalledTimes(1);
  });

  it("ignores updates that keep the same user (e.g. a refreshed token)", () => {
    const { userId, stores } = setup("user-a");
    userId.value = "user-a";
    for (const store of stores) expect(store.$reset).not.toHaveBeenCalled();
  });
});
