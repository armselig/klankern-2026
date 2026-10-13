import { describe, expect, it, vi } from "vitest";
import { shareOrCopy } from "./share-or-copy";

function abort() {
  return Object.assign(new Error("closed"), { name: "AbortError" });
}

describe("shareOrCopy", () => {
  it("hands the message to the share sheet when there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();

    expect(await shareOrCopy({ share, clipboard: { writeText } }, "Hi")).toBe(
      "shared",
    );
    expect(share).toHaveBeenCalledWith({ text: "Hi" });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies where there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    expect(await shareOrCopy({ clipboard: { writeText } }, "Hi")).toBe(
      "copied",
    );
    expect(writeText).toHaveBeenCalledWith("Hi");
  });

  it("does nothing more when the member closes the share sheet", async () => {
    const share = vi.fn().mockRejectedValue(abort());
    const writeText = vi.fn();

    expect(await shareOrCopy({ share, clipboard: { writeText } }, "Hi")).toBe(
      "closed",
    );
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies when the share sheet refuses", async () => {
    const share = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    const writeText = vi.fn().mockResolvedValue(undefined);

    expect(await shareOrCopy({ share, clipboard: { writeText } }, "Hi")).toBe(
      "copied",
    );
  });

  it("leaves it to the caller when the clipboard refuses too, or is missing", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));

    expect(await shareOrCopy({ clipboard: { writeText } }, "Hi")).toBe(
      "manual",
    );
    expect(await shareOrCopy({}, "Hi")).toBe("manual");
  });
});
