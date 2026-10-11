import { describe, expect, it } from "vitest";
import { emailLocalPart } from "./email";

describe("emailLocalPart", () => {
  it("returns what stands in front of the @", () => {
    expect(emailLocalPart("anna.does@example.com")).toBe("anna.does");
  });

  it("cuts at the last @, since a quoted name may contain one", () => {
    expect(emailLocalPart('"anna@home"@example.com')).toBe('"anna@home"');
  });

  it("returns a text without a name in front of the @ unchanged", () => {
    expect(emailLocalPart("anna")).toBe("anna");
    expect(emailLocalPart("@example.com")).toBe("@example.com");
  });
});
