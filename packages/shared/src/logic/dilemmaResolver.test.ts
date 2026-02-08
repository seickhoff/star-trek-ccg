import { describe, it, expect } from "vitest";
import type { DilemmaCard, PersonnelCard, Card } from "../types";
import { resolveDilemma, resolveSelectionStop } from "./dilemmaResolver";

// =============================================================================
// TEST HELPERS
// =============================================================================

function mockPersonnel(overrides: Partial<PersonnelCard> = {}): PersonnelCard {
  return {
    id: "test-p",
    uniqueId: `p-${Math.random().toString(36).slice(2, 8)}`,
    name: "Test Personnel",
    type: "Personnel",
    unique: false,
    jpg: "test.jpg",
    affiliation: ["Federation"],
    deploy: 1,
    species: ["Human"],
    status: "Unstopped",
    other: [],
    skills: [],
    integrity: 5,
    cunning: 5,
    strength: 5,
    ...overrides,
  };
}

function mockDilemma(overrides: Partial<DilemmaCard> = {}): DilemmaCard {
  return {
    id: "test-d",
    uniqueId: "d-1",
    name: "Test Dilemma",
    type: "Dilemma",
    unique: false,
    jpg: "test.jpg",
    where: "Dual",
    cost: 1,
    overcome: false,
    faceup: false,
    text: "Test dilemma text.",
    lore: "Test lore.",
    rule: {
      type: "chooseToStop",
      skills: ["Leadership"],
      penalty: "randomKill",
    },
    ...overrides,
  };
}

// =============================================================================
// chooseToStop
// =============================================================================

describe("chooseToStop", () => {
  it("returns requiresSelection when matching personnel exist", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Leadership"]] }),
      mockPersonnel({ uniqueId: "p2", skills: [["Science"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "chooseToStop",
        skills: ["Leadership", "Officer"],
        penalty: "randomKill",
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.requiresSelection).toBe(true);
    expect(result.selectablePersonnel).toContain("p1");
    expect(result.selectablePersonnel).not.toContain("p2");
  });

  it("randomly kills one when no match and penalty is randomKill", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Science"]] }),
      mockPersonnel({ uniqueId: "p2", skills: [["Medical"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "chooseToStop",
        skills: ["Leadership", "Officer"],
        penalty: "randomKill",
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.requiresSelection).toBe(false);
    expect(result.killedPersonnel).toHaveLength(1);
    expect(["p1", "p2"]).toContain(result.killedPersonnel[0]);
    expect(result.overcome).toBe(true);
  });

  it("stops all and returns when no match and penalty is stopAllReturnToPile", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Science"]] }),
      mockPersonnel({ uniqueId: "p2", skills: [["Medical"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "chooseToStop",
        skills: ["Engineer", "Programming"],
        penalty: "stopAllReturnToPile",
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.requiresSelection).toBe(false);
    expect(result.stoppedPersonnel).toHaveLength(2);
    expect(result.overcome).toBe(false);
    expect(result.returnsToPile).toBe(true);
  });

  it("overcomes when no personnel at all (randomKill)", () => {
    const dilemma = mockDilemma({
      rule: {
        type: "chooseToStop",
        skills: ["Leadership"],
        penalty: "randomKill",
      },
    });

    const result = resolveDilemma(dilemma, []);

    expect(result.overcome).toBe(true);
    expect(result.killedPersonnel).toHaveLength(0);
  });

  it("ignores stopped personnel", () => {
    const cards: Card[] = [
      mockPersonnel({
        uniqueId: "p1",
        skills: [["Leadership"]],
        status: "Stopped",
      }),
      mockPersonnel({ uniqueId: "p2", skills: [["Science"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "chooseToStop",
        skills: ["Leadership"],
        penalty: "randomKill",
      },
    });

    const result = resolveDilemma(dilemma, cards);

    // p1 is stopped so shouldn't be selectable; no match found -> kill random
    expect(result.requiresSelection).toBe(false);
    expect(result.killedPersonnel).toHaveLength(1);
    expect(result.killedPersonnel[0]).toBe("p2");
  });
});

// =============================================================================
// unlessCheck + randomKillWithSkill
// =============================================================================

describe("unlessCheck with randomKillWithSkill penalty", () => {
  it("overcomes when group meets skill requirements", () => {
    const cards: Card[] = [
      mockPersonnel({ skills: [["Biology"]], cunning: 20 }),
      mockPersonnel({ skills: [["Physics"]], cunning: 20 }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          {
            skills: ["Biology", "Physics"],
            attribute: "Cunning",
            attributeThreshold: 32,
          },
          { skills: ["Intelligence", "Medical", "Medical"] },
        ],
        penalty: { type: "randomKillWithSkill", skill: "Leadership" },
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.overcome).toBe(true);
    expect(result.killedPersonnel).toHaveLength(0);
  });

  it("overcomes via second requirement group (no attribute)", () => {
    const cards: Card[] = [
      mockPersonnel({ skills: [["Intelligence"]] }),
      mockPersonnel({ skills: [["Medical", "Medical"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          {
            skills: ["Biology", "Physics"],
            attribute: "Cunning",
            attributeThreshold: 32,
          },
          { skills: ["Intelligence", "Medical", "Medical"] },
        ],
        penalty: { type: "randomKillWithSkill", skill: "Leadership" },
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.overcome).toBe(true);
  });

  it("kills random personnel with target skill when requirements fail", () => {
    const cards: Card[] = [
      mockPersonnel({
        uniqueId: "p1",
        name: "Leader",
        skills: [["Leadership"]],
      }),
      mockPersonnel({ uniqueId: "p2", skills: [["Science"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [{ skills: ["Biology", "Physics"] }],
        penalty: { type: "randomKillWithSkill", skill: "Leadership" },
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.overcome).toBe(true);
    expect(result.killedPersonnel).toEqual(["p1"]);
  });

  it("overcomes when requirements fail but no personnel has target skill", () => {
    const cards: Card[] = [
      mockPersonnel({ skills: [["Science"]] }),
      mockPersonnel({ skills: [["Medical"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [{ skills: ["Biology", "Physics"] }],
        penalty: { type: "randomKillWithSkill", skill: "Leadership" },
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.overcome).toBe(true);
    expect(result.killedPersonnel).toHaveLength(0);
  });

  it("fails group check when attribute threshold not exceeded", () => {
    const cards: Card[] = [
      mockPersonnel({ skills: [["Biology"]], cunning: 15 }),
      mockPersonnel({ skills: [["Physics"]], cunning: 15 }),
      mockPersonnel({ uniqueId: "leader", skills: [["Leadership"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          {
            skills: ["Biology", "Physics"],
            attribute: "Cunning",
            attributeThreshold: 32,
          },
        ],
        penalty: { type: "randomKillWithSkill", skill: "Leadership" },
      },
    });

    // Total cunning = 15 + 15 + 5 = 35. Threshold is 32. 35 > 32, so should pass!
    const result = resolveDilemma(dilemma, cards);
    expect(result.overcome).toBe(true);
    expect(result.killedPersonnel).toHaveLength(0);
  });

  it("fails when attribute is exactly at threshold (must exceed)", () => {
    const cards: Card[] = [
      mockPersonnel({ skills: [["Biology"]], cunning: 16 }),
      mockPersonnel({ skills: [["Physics"]], cunning: 16 }),
      mockPersonnel({
        uniqueId: "leader",
        skills: [["Leadership"]],
        cunning: 0,
      }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          {
            skills: ["Biology", "Physics"],
            attribute: "Cunning",
            attributeThreshold: 32,
          },
        ],
        penalty: { type: "randomKillWithSkill", skill: "Leadership" },
      },
    });

    // Total cunning = 16 + 16 + 0 = 32. Must EXCEED 32. 32 > 32 is false.
    const result = resolveDilemma(dilemma, cards);
    expect(result.overcome).toBe(true); // overcome because kill happens
    expect(result.killedPersonnel).toEqual(["leader"]);
  });
});

// =============================================================================
// unlessCheck + stopAllReturnToPile
// =============================================================================

describe("unlessCheck with stopAllReturnToPile penalty", () => {
  it("overcomes when requirements met by skills", () => {
    const cards: Card[] = [
      mockPersonnel({ skills: [["Diplomacy", "Diplomacy"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          { skills: ["Diplomacy", "Diplomacy"] },
          { attribute: "Cunning", attributeThreshold: 35 },
        ],
        penalty: { type: "stopAllReturnToPile" },
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.overcome).toBe(true);
    expect(result.stoppedPersonnel).toHaveLength(0);
  });

  it("overcomes when requirements met by attribute only", () => {
    const cards: Card[] = [
      mockPersonnel({ cunning: 18 }),
      mockPersonnel({ cunning: 18 }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          { skills: ["Diplomacy", "Diplomacy"] },
          { attribute: "Cunning", attributeThreshold: 35 },
        ],
        penalty: { type: "stopAllReturnToPile" },
      },
    });

    // Total cunning = 36 > 35
    const result = resolveDilemma(dilemma, cards);

    expect(result.overcome).toBe(true);
  });

  it("stops all and returns when requirements not met", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Science"]], cunning: 10 }),
      mockPersonnel({ uniqueId: "p2", skills: [["Medical"]], cunning: 10 }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          { skills: ["Diplomacy", "Diplomacy"] },
          { attribute: "Cunning", attributeThreshold: 35 },
        ],
        penalty: { type: "stopAllReturnToPile" },
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.overcome).toBe(false);
    expect(result.returnsToPile).toBe(true);
    expect(result.stoppedPersonnel).toHaveLength(2);
  });
});

// =============================================================================
// unlessCheck + chooseMatchingToStopElseStopAll (Wavefront pattern)
// =============================================================================

describe("unlessCheck with chooseMatchingToStopElseStopAll penalty", () => {
  it("overcomes when single personnel has double skill", () => {
    const cards: Card[] = [
      mockPersonnel({
        uniqueId: "p1",
        skills: [["Astrometrics", "Astrometrics"]],
      }),
      mockPersonnel({ uniqueId: "p2", skills: [["Science"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          { skills: ["Astrometrics", "Astrometrics"], singlePersonnel: true },
          { skills: ["Navigation", "Navigation"], singlePersonnel: true },
        ],
        penalty: {
          type: "chooseMatchingToStopElseStopAll",
          skills: ["Astrometrics", "Navigation"],
        },
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.overcome).toBe(true);
  });

  it("does NOT overcome when double skill split across two personnel", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Astrometrics"]] }),
      mockPersonnel({ uniqueId: "p2", skills: [["Astrometrics"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          { skills: ["Astrometrics", "Astrometrics"], singlePersonnel: true },
          { skills: ["Navigation", "Navigation"], singlePersonnel: true },
        ],
        penalty: {
          type: "chooseMatchingToStopElseStopAll",
          skills: ["Astrometrics", "Navigation"],
        },
      },
    });

    const result = resolveDilemma(dilemma, cards);

    // Should NOT overcome, but should find matching personnel to choose from
    expect(result.overcome).toBe(false);
    expect(result.requiresSelection).toBe(true);
    expect(result.selectablePersonnel).toHaveLength(2);
  });

  it("returns requiresSelection when matching skill personnel exist", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Astrometrics"]] }),
      mockPersonnel({ uniqueId: "p2", skills: [["Science"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          { skills: ["Astrometrics", "Astrometrics"], singlePersonnel: true },
        ],
        penalty: {
          type: "chooseMatchingToStopElseStopAll",
          skills: ["Astrometrics", "Navigation"],
        },
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.requiresSelection).toBe(true);
    expect(result.selectablePersonnel).toContain("p1");
    expect(result.selectablePersonnel).not.toContain("p2");
  });

  it("stops all and returns when no matching personnel at all", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Science"]] }),
      mockPersonnel({ uniqueId: "p2", skills: [["Medical"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          { skills: ["Astrometrics", "Astrometrics"], singlePersonnel: true },
        ],
        penalty: {
          type: "chooseMatchingToStopElseStopAll",
          skills: ["Astrometrics", "Navigation"],
        },
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.overcome).toBe(false);
    expect(result.returnsToPile).toBe(true);
    expect(result.stoppedPersonnel).toHaveLength(2);
  });
});

// =============================================================================
// randomThenCheck
// =============================================================================

describe("randomThenCheck", () => {
  it("stops random target when requirements met", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Diplomacy"]] }),
      mockPersonnel({ uniqueId: "p2", skills: [["Medical"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "randomThenCheck",
        requirements: [
          { skills: ["Diplomacy", "Medical"] },
          { skills: ["Security", "Security"] },
        ],
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.overcome).toBe(true);
    expect(result.stoppedPersonnel).toHaveLength(1);
    expect(result.killedPersonnel).toHaveLength(0);
  });

  it("kills target and stops all others when requirements not met", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Science"]] }),
      mockPersonnel({ uniqueId: "p2", skills: [["Medical"]] }),
      mockPersonnel({ uniqueId: "p3", skills: [["Engineer"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "randomThenCheck",
        requirements: [
          { skills: ["Diplomacy", "Medical"] },
          { skills: ["Security", "Security"] },
        ],
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.overcome).toBe(false);
    expect(result.returnsToPile).toBe(true);
    expect(result.killedPersonnel).toHaveLength(1);
    // Others should be stopped (total stopped + killed = total personnel)
    expect(result.stoppedPersonnel.length + result.killedPersonnel.length).toBe(
      3
    );
  });

  it("overcomes when no personnel", () => {
    const dilemma = mockDilemma({
      rule: {
        type: "randomThenCheck",
        requirements: [{ skills: ["Diplomacy"] }],
      },
    });

    const result = resolveDilemma(dilemma, []);

    expect(result.overcome).toBe(true);
  });
});

// =============================================================================
// randomStop
// =============================================================================

describe("randomStop", () => {
  it("stops 1 with small crew", () => {
    const cards: Card[] = Array.from({ length: 5 }, (_, i) =>
      mockPersonnel({ uniqueId: `p${i}` })
    );
    const dilemma = mockDilemma({
      rule: {
        type: "randomStop",
        stops: [
          { remainingThreshold: 1 },
          { remainingThreshold: 9 },
          { remainingThreshold: 10 },
        ],
      },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.stoppedPersonnel).toHaveLength(1);
    expect(result.overcome).toBe(true);
  });

  it("stops 2 with 10 crew", () => {
    const cards: Card[] = Array.from({ length: 10 }, (_, i) =>
      mockPersonnel({ uniqueId: `p${i}` })
    );
    const dilemma = mockDilemma({
      rule: {
        type: "randomStop",
        stops: [
          { remainingThreshold: 1 },
          { remainingThreshold: 9 },
          { remainingThreshold: 10 },
        ],
      },
    });

    const result = resolveDilemma(dilemma, cards);

    // 10 crew, first stop -> 9 remaining >= 9 threshold -> second stop -> 8 remaining < 10 -> no third
    expect(result.stoppedPersonnel).toHaveLength(2);
    expect(result.overcome).toBe(true);
  });

  it("stops 3 with 12 crew", () => {
    const cards: Card[] = Array.from({ length: 12 }, (_, i) =>
      mockPersonnel({ uniqueId: `p${i}` })
    );
    const dilemma = mockDilemma({
      rule: {
        type: "randomStop",
        stops: [
          { remainingThreshold: 1 },
          { remainingThreshold: 9 },
          { remainingThreshold: 10 },
        ],
      },
    });

    const result = resolveDilemma(dilemma, cards);

    // 12 crew -> first stop -> 11 remaining >= 9 -> second stop -> 10 remaining >= 10 -> third stop
    expect(result.stoppedPersonnel).toHaveLength(3);
    expect(result.overcome).toBe(true);
  });

  it("all stopped personnel are unique", () => {
    const cards: Card[] = Array.from({ length: 12 }, (_, i) =>
      mockPersonnel({ uniqueId: `p${i}`, name: `Person ${i}` })
    );
    const dilemma = mockDilemma({
      rule: {
        type: "randomStop",
        stops: [
          { remainingThreshold: 1 },
          { remainingThreshold: 9 },
          { remainingThreshold: 10 },
        ],
      },
    });

    const result = resolveDilemma(dilemma, cards);

    const uniqueIds = new Set(result.stoppedPersonnel);
    expect(uniqueIds.size).toBe(result.stoppedPersonnel.length);
  });
});

// =============================================================================
// crewLimit
// =============================================================================

describe("crewLimit", () => {
  it("stops excess personnel when crew exceeds limit", () => {
    const cards: Card[] = Array.from({ length: 12 }, (_, i) =>
      mockPersonnel({ uniqueId: `p${i}` })
    );
    const dilemma = mockDilemma({
      rule: { type: "crewLimit", keepCount: 9 },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.stoppedPersonnel).toHaveLength(3); // 12 - 9 = 3
    expect(result.overcome).toBe(false);
    expect(result.returnsToPile).toBe(false);
  });

  it("stops nobody when crew is at or below limit", () => {
    const cards: Card[] = Array.from({ length: 8 }, (_, i) =>
      mockPersonnel({ uniqueId: `p${i}` })
    );
    const dilemma = mockDilemma({
      rule: { type: "crewLimit", keepCount: 9 },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.stoppedPersonnel).toHaveLength(0);
    expect(result.overcome).toBe(false);
    expect(result.returnsToPile).toBe(false);
  });

  it("stays on mission (not overcome, not returned)", () => {
    const cards: Card[] = Array.from({ length: 5 }, (_, i) =>
      mockPersonnel({ uniqueId: `p${i}` })
    );
    const dilemma = mockDilemma({
      rule: { type: "crewLimit", keepCount: 9 },
    });

    const result = resolveDilemma(dilemma, cards);

    expect(result.overcome).toBe(false);
    expect(result.returnsToPile).toBe(false);
  });
});

// =============================================================================
// resolveSelectionStop
// =============================================================================

describe("resolveSelectionStop", () => {
  it("stops the selected personnel and overcomes", () => {
    const dilemma = mockDilemma();
    const result = resolveSelectionStop(dilemma, "p1");

    expect(result.stoppedPersonnel).toEqual(["p1"]);
    expect(result.killedPersonnel).toHaveLength(0);
    expect(result.overcome).toBe(true);
    expect(result.requiresSelection).toBe(false);
  });
});

// =============================================================================
// failureReason formatting
// =============================================================================

describe("failureReason formatting", () => {
  it("formats simple skill requirements with OR", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Science"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          { skills: ["Diplomacy", "Medical"] },
          { skills: ["Security", "Security"] },
        ],
        penalty: { type: "randomKill" },
      },
    });

    const result = resolveDilemma(dilemma, cards);
    expect(result.failureReason).toBe(
      "Needed: Diplomacy + Medical or 2 Security"
    );
  });

  it("formats skill + attribute requirements", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Science"]], cunning: 5 }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          {
            skills: ["Biology", "Physics"],
            attribute: "Cunning",
            attributeThreshold: 32,
          },
        ],
        penalty: { type: "randomKill" },
      },
    });

    const result = resolveDilemma(dilemma, cards);
    expect(result.failureReason).toBe("Needed: Biology + Physics + Cunning>32");
  });

  it("formats singlePersonnel requirements", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Astrometrics"]] }),
      mockPersonnel({ uniqueId: "p2", skills: [["Astrometrics"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [
          { skills: ["Astrometrics", "Astrometrics"], singlePersonnel: true },
          { skills: ["Navigation", "Navigation"], singlePersonnel: true },
        ],
        penalty: {
          type: "chooseMatchingToStopElseStopAll",
          skills: ["Astrometrics", "Navigation"],
        },
      },
    });

    const result = resolveDilemma(dilemma, cards);
    expect(result.failureReason).toBe(
      "Needed: one personnel with 2 Astrometrics or one personnel with 2 Navigation"
    );
  });

  it("does not set failureReason when requirements pass", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Diplomacy"]] }),
      mockPersonnel({ uniqueId: "p2", skills: [["Medical"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "unlessCheck",
        requirements: [{ skills: ["Diplomacy", "Medical"] }],
        penalty: { type: "randomKill" },
      },
    });

    const result = resolveDilemma(dilemma, cards);
    expect(result.failureReason).toBeUndefined();
  });

  it("sets failureReason for randomThenCheck failures", () => {
    const cards: Card[] = [
      mockPersonnel({ uniqueId: "p1", skills: [["Science"]] }),
      mockPersonnel({ uniqueId: "p2", skills: [["Engineer"]] }),
    ];
    const dilemma = mockDilemma({
      rule: {
        type: "randomThenCheck",
        requirements: [
          { skills: ["Diplomacy", "Medical"] },
          { skills: ["Security", "Security"] },
        ],
      },
    });

    const result = resolveDilemma(dilemma, cards);
    expect(result.failureReason).toBeDefined();
    expect(result.failureReason).toContain("Needed:");
    expect(result.failureReason).toContain("Diplomacy + Medical");
    expect(result.failureReason).toContain("2 Security");
  });
});
