import { describe, expect, it, vi } from "vitest";
import { getCurrentUserId } from "./current-user";

/** A client with only the session lookup, answering as given. */
function clientWithSession(result: { data: unknown; error: unknown }) {
  const getSession = vi.fn().mockResolvedValue(result);
  const getUser = vi.fn();
  return { client: { auth: { getSession, getUser } }, getUser };
}

describe("getCurrentUserId", () => {
  it("reads the id from the session, without asking the auth service", async () => {
    const { client, getUser } = clientWithSession({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });

    expect(await getCurrentUserId(client as never)).toBe("user-1");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("throws without a session", async () => {
    const { client } = clientWithSession({
      data: { session: null },
      error: null,
    });

    await expect(getCurrentUserId(client as never)).rejects.toThrow(
      "not_authenticated",
    );
  });

  it("throws the error of the session lookup", async () => {
    const error = { message: "boom" };
    const { client } = clientWithSession({ data: { session: null }, error });

    await expect(getCurrentUserId(client as never)).rejects.toBe(error);
  });
});
