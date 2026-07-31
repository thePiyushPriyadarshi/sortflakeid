import { describe, expect, it } from "vitest";

import { SortFlakeId, decode } from "../src";

describe("SortFlakeId", () => {
  it("generates unique ids", () => {
    const generator = new SortFlakeId({
      workerId: 1,
    });

    const ids = new Set<string>();

    for (let i = 0; i < 10000; i++) {
      ids.add(generator.next());
    }

    expect(ids.size).toBe(10000);

    generator.destroy();
  });

  it("generates increasing ids", () => {
    const generator = new SortFlakeId({
      workerId: 1,
    });

    const first = BigInt(generator.next());
    const second = BigInt(generator.next());

    expect(second).toBeGreaterThan(first);

    generator.destroy();
  });

  it("encodes worker id correctly", () => {
    const generator = new SortFlakeId({
      workerId: 55,
    });

    const id = generator.next();

    expect(decode(id).workerId).toBe(55);

    generator.destroy();
  });

  it("supports nextBigInt()", () => {
    const generator = new SortFlakeId({
      workerId: 1,
    });

    const id = generator.nextBigInt();

    expect(typeof id).toBe("bigint");

    generator.destroy();
  });

  it("throws for duplicate worker ids", () => {
    const first = new SortFlakeId({
      workerId: 1,
    });

    expect(() => {
      new SortFlakeId({
        workerId: 1,
      });
    }).toThrow();

    first.destroy();
  });

  it("throws after destroy()", () => {
    const generator = new SortFlakeId({
      workerId: 2,
    });

    generator.destroy();

    expect(() => generator.next()).toThrow();
  });

  it("supports custom epoch", () => {
    const epoch = Date.UTC(2020, 0, 1);

    const generator = new SortFlakeId({
      workerId: 1,
      epoch,
    });

    const decoded = decode(generator.next(), epoch);

    expect(decoded.timestamp).toBeGreaterThan(epoch);

    generator.destroy();
  });
});