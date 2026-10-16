import { describe, expect, it } from "vitest";
import { createWritesInOrder } from "./writes-in-order";

/** A promise a test settles itself, to hold a write in flight. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createWritesInOrder", () => {
  it("starts an item's second write only once its first has settled", async () => {
    const writes = createWritesInOrder();
    const first = deferred();
    const started: string[] = [];

    const one = writes.run("item-1", () => {
      started.push("untick");
      return first.promise;
    });
    const two = writes.run("item-1", async () => {
      started.push("tick");
    });
    await Promise.resolve();
    expect(started).toEqual(["untick"]);

    first.resolve();
    await Promise.all([one, two]);
    expect(started).toEqual(["untick", "tick"]);
  });

  it("runs the next write after one that failed, and hands each its own result", async () => {
    const writes = createWritesInOrder();

    const failing = writes.run("item-1", () =>
      Promise.reject(new Error("offline")),
    );
    const next = writes.run("item-1", async () => "saved");

    await expect(failing).rejects.toThrow("offline");
    await expect(next).resolves.toBe("saved");
  });

  it("doesn't hold one item's write behind another's", async () => {
    const writes = createWritesInOrder();
    const held = deferred();
    void writes.run("item-1", () => held.promise);

    await expect(writes.run("item-2", async () => "other")).resolves.toBe(
      "other",
    );
    held.resolve();
  });
});
