import { describe, expect, it } from "vitest";

import { normalizeDomain } from "./domain";

describe("normalizeDomain", () => {
  it("normalizes protocol, path, and www", () => {
    expect(normalizeDomain("https://www.Example.com/pricing")).toBe("example.com");
  });

  it("throws for invalid domains", () => {
    expect(() => normalizeDomain("http://localhost:3000")).toThrow();
    expect(() => normalizeDomain("not_a_domain")).toThrow();
  });
});
