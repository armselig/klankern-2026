/**
 * The time, updated once a minute: what a page that changes with the hour
 * needs, such as the Tonight tile switching to tomorrow at 17:00 or the
 * "Today" mark moving on at midnight, while the page stays open. The timer
 * ends with the calling component.
 */
export function useMinuteClock() {
  const now = ref(new Date());
  const timer = setInterval(() => {
    now.value = new Date();
  }, 60_000);
  onScopeDispose(() => clearInterval(timer));
  return now;
}
