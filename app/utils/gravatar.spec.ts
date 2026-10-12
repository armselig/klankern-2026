import { describe, expect, it } from "vitest";
import { gravatarHash, gravatarUrl } from "./gravatar";

// The address and its hash are the example in Gravatar's documentation.
const DOCUMENTED_HASH =
  "84059b07d4be67b806386c0aad8070a23f18836bbaae342275dc0a83414c32ee";

describe("gravatarHash", () => {
  it("hashes the address trimmed and in lower case, as Gravatar does", async () => {
    expect(await gravatarHash("MyEmailAddress@example.com ")).toBe(
      DOCUMENTED_HASH,
    );
  });

  it("gives the same hash for the address already in that form", async () => {
    expect(await gravatarHash("myemailaddress@example.com")).toBe(
      DOCUMENTED_HASH,
    );
  });

  it("gives another hash for another address", async () => {
    expect(await gravatarHash("someone.else@example.com")).not.toBe(
      DOCUMENTED_HASH,
    );
  });
});

describe("gravatarUrl", () => {
  it("asks for the picture in the given size, and for a 404 when there is none", () => {
    expect(gravatarUrl(DOCUMENTED_HASH, 96)).toBe(
      `https://gravatar.com/avatar/${DOCUMENTED_HASH}?s=96&d=404`,
    );
  });
});
