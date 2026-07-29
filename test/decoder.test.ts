import { describe, expect, it } from "vitest";

import {
  SortIdGenerator,
  decode,
  timestamp,
  date,
  workerId,
  sequence,
  isValid,
} from "../src";

describe("Decoder", () => {
  const generator = new SortIdGenerator({
    workerId: 123,
  });

  const id = generator.next();

  it("decodes an id", () => {
    const decoded = decode(id);

    expect(decoded.workerId).toBe(123);
    expect(decoded.sequence).toBe(0);
  });

  it("extracts timestamp", () => {
    expect(timestamp(id)).toBeGreaterThan(0);
  });

  it("extracts date", () => {
    expect(date(id)).toBeInstanceOf(Date);
  });

  it("extracts worker id", () => {
    expect(workerId(id)).toBe(123);
  });

  it("extracts sequence", () => {
    expect(sequence(id)).toBe(0);
  });

  it("validates ids", () => {
    expect(isValid(id)).toBe(true);
  });

  it("rejects invalid ids", () => {
    expect(isValid("abc")).toBe(false);
  });

  it("throws for invalid ids", () => {
    expect(() => decode("abc")).toThrow();
  });

  it("throws for negative ids", () => {
    expect(() => decode("-1")).toThrow();
  });
});