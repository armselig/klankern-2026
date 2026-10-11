import { describe, expect, it } from "vitest";
import { errorMessage } from "./error-message";

describe("errorMessage", () => {
  it("reads the message of an Error", () => {
    expect(errorMessage(new Error("not_authenticated"))).toBe(
      "not_authenticated",
    );
  });

  it("reads the message of a plain error object, the way supabase-js returns PostgREST errors", () => {
    expect(
      errorMessage({ message: "invalid_or_expired_invite", code: "P0001" }),
    ).toBe("invalid_or_expired_invite");
  });

  it("falls back to unknown_error for anything without a message", () => {
    expect(errorMessage("boom")).toBe("unknown_error");
    expect(errorMessage(null)).toBe("unknown_error");
    expect(errorMessage({ message: 42 })).toBe("unknown_error");
  });
});
