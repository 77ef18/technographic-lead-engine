import { describe, expect, it } from "vitest";

import { applyDependencyRules, calculateConfidenceBands, type DetectionCandidate } from "./fingerprint";

function candidate(overrides: Partial<DetectionCandidate>): DetectionCandidate {
  return {
    technologyId: overrides.technologyId ?? "tech-1",
    slug: overrides.slug ?? "tech-1",
    technologyName: overrides.technologyName ?? "Tech 1",
    category: overrides.category ?? "analytics",
    score: overrides.score ?? 50,
    evidence: overrides.evidence ?? ["script:example"],
    signalTypes: overrides.signalTypes ?? new Set(["script"]),
    implies: overrides.implies ?? [],
    requires: overrides.requires ?? [],
    excludes: overrides.excludes ?? [],
    version: overrides.version ?? null,
    inferred: overrides.inferred ?? false,
  };
}

describe("fingerprint dependency logic", () => {
  it("drops detections when requires are not present", () => {
    const input = [
      candidate({ slug: "analytics-a", requires: ["tag-manager"] }),
      candidate({ slug: "tag-manager", score: 20 }),
    ];
    const output = applyDependencyRules(input);
    expect(output.some((item) => item.slug === "analytics-a")).toBe(false);
  });

  it("penalizes mutually exclusive detections", () => {
    const input = [
      candidate({ slug: "shopify", score: 80, excludes: ["woocommerce"] }),
      candidate({ slug: "woocommerce", score: 85 }),
    ];
    const output = applyDependencyRules(input);
    const shopify = output.find((item) => item.slug === "shopify");
    expect(shopify?.score).toBeLessThan(80);
  });

  it("creates implied detections with reduced confidence", () => {
    const input = [
      candidate({ slug: "hubspot", score: 90, implies: ["hubspot-forms"] }),
      candidate({ slug: "hubspot-forms", score: 20 }),
    ];
    const output = applyDependencyRules(input);
    const implied = output.find((item) => item.slug === "hubspot-forms" && item.inferred);
    expect(implied?.score).toBe(54);
  });
});

describe("confidence band logic", () => {
  it("boosts confidence with independent signal types", () => {
    const output = calculateConfidenceBands([
      candidate({
        score: 70,
        signalTypes: new Set(["script", "meta", "header"]),
      }),
    ]);
    expect(output[0]?.score).toBe(85);
    expect(output[0]?.band).toBe("high");
  });
});
