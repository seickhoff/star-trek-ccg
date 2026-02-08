import { describe, it, expect } from "vitest";
import type {
  DilemmaCard,
  PersonnelCard,
  ShipCard,
  MissionCard,
  GameAction,
} from "@stccg/shared";
import { GameEngine } from "./GameEngine.js";
import { resolveDilemma } from "@stccg/shared";

let reqCounter = 0;
function action<T extends Omit<GameAction, "requestId">>(a: T): GameAction {
  return { ...a, requestId: `test-${++reqCounter}` } as GameAction;
}

// =============================================================================
// TEST HELPERS
// =============================================================================

function mockMission(overrides: Partial<MissionCard> = {}): MissionCard {
  return {
    id: "m-test",
    name: "Test Mission",
    type: "Mission",
    unique: false,
    jpg: "test.jpg",
    missionType: "Planet",
    quadrant: "Alpha",
    range: 0,
    completed: false,
    score: 35,
    affiliation: ["Federation"],
    skills: [["Science", "Medical"]],
    ...overrides,
  };
}

function mockPersonnel(overrides: Partial<PersonnelCard> = {}): PersonnelCard {
  return {
    id: "p-test",
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

function mockShip(overrides: Partial<ShipCard> = {}): ShipCard {
  return {
    id: "s-test",
    uniqueId: `s-${Math.random().toString(36).slice(2, 8)}`,
    name: "Test Ship",
    type: "Ship",
    unique: false,
    jpg: "test.jpg",
    affiliation: ["Federation"],
    deploy: 1,
    staffing: [["Staff"]],
    range: 8,
    rangeRemaining: 8,
    weapons: 6,
    shields: 6,
    ...overrides,
  };
}

function mockDilemma(overrides: Partial<DilemmaCard> = {}): DilemmaCard {
  return {
    id: "d-test",
    uniqueId: `d-${Math.random().toString(36).slice(2, 8)}`,
    name: "Test Dilemma",
    type: "Dilemma",
    unique: false,
    jpg: "test.jpg",
    where: "Dual",
    cost: 1,
    overcome: false,
    faceup: false,
    text: "Test dilemma.",
    lore: "Test lore.",
    rule: {
      type: "chooseToStop",
      skills: ["Leadership"],
      penalty: "randomKill",
    },
    ...overrides,
  };
}

/**
 * Create a GameEngine with controlled state for dilemma encounter testing.
 * Sets up headquarters at index 0 and the test mission at index 1.
 */
function setupEngine(opts: {
  personnel?: PersonnelCard[];
  dilemmas?: DilemmaCard[];
  mission?: Partial<MissionCard>;
  overcomeOnMission?: DilemmaCard[];
}): { engine: GameEngine; missionIndex: number; groupIndex: number } {
  const engine = new GameEngine();
  const state = engine.getState();

  state.missions[0] = {
    mission: mockMission({
      id: "hq",
      name: "HQ",
      missionType: "Headquarters",
      affiliation: [],
      score: undefined,
      skills: undefined,
    }),
    groups: [{ cards: [] }],
    dilemmas: [],
  };
  state.headquartersIndex = 0;

  const personnel = opts.personnel ?? [
    mockPersonnel({ uniqueId: "p1", name: "P1", skills: [["Science"]] }),
    mockPersonnel({ uniqueId: "p2", name: "P2", skills: [["Medical"]] }),
    mockPersonnel({ uniqueId: "p3", name: "P3", skills: [["Leadership"]] }),
  ];

  state.missions[1] = {
    mission: mockMission(opts.mission ?? {}),
    groups: [{ cards: personnel }],
    dilemmas: opts.overcomeOnMission ?? [],
  };

  state.dilemmaPool = opts.dilemmas ?? [];
  state.phase = "ExecuteOrders";

  return { engine, missionIndex: 1, groupIndex: 0 };
}

/**
 * Set up a dilemma encounter directly (deterministic ordering).
 * Bypasses the shuffle in attemptMission so tests control dilemma order.
 * Resolves the first dilemma and stores the result, ready for ADVANCE_DILEMMA.
 */
function setupEncounterDirectly(
  engine: GameEngine,
  missionIndex: number,
  groupIndex: number,
  orderedDilemmas: DilemmaCard[]
): void {
  const state = engine.getState();
  const group = state.missions[missionIndex]!.groups[groupIndex]!;
  const personnelCards = group.cards.filter(
    (c) => c.type === "Personnel"
  ) as PersonnelCard[];

  // Create encounter with exact ordering
  state.dilemmaEncounter = {
    missionIndex,
    groupIndex,
    selectedDilemmas: orderedDilemmas,
    currentDilemmaIndex: 0,
    costBudget: personnelCards.length,
    costSpent: orderedDilemmas[0]!.cost,
    facedDilemmaIds: [orderedDilemmas[0]!.id],
  };

  // Resolve the first dilemma
  const result = resolveDilemma(orderedDilemmas[0]!, personnelCards, []);
  state.dilemmaResult = {
    dilemmaName: orderedDilemmas[0]!.name,
    overcome: result.overcome,
    stoppedPersonnel: result.stoppedPersonnel,
    killedPersonnel: result.killedPersonnel,
    requiresSelection: result.requiresSelection,
    selectablePersonnel: result.requiresSelection
      ? personnelCards.filter((p) =>
          result.selectablePersonnel.includes(p.uniqueId!)
        )
      : undefined,
    selectionPrompt: result.selectionPrompt,
    returnsToPile: result.returnsToPile,
    message: result.message,
    failureReason: result.failureReason,
  };
}

// =============================================================================
// Rule 1: Draw count = personnel count - overcome dilemmas
// =============================================================================

describe("Rule 1: Draw count", () => {
  it("selects dilemmas up to personnel count", () => {
    const dilemmas = [
      mockDilemma({ id: "d1", uniqueId: "d1", cost: 1 }),
      mockDilemma({ id: "d2", uniqueId: "d2", cost: 1 }),
      mockDilemma({ id: "d3", uniqueId: "d3", cost: 1 }),
      mockDilemma({ id: "d4", uniqueId: "d4", cost: 1 }),
      mockDilemma({ id: "d5", uniqueId: "d5", cost: 1 }),
    ];

    // 3 personnel → drawCount = 3
    const { engine, missionIndex, groupIndex } = setupEngine({ dilemmas });
    engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    const encounter = engine.getState().dilemmaEncounter;
    expect(encounter).not.toBeNull();
    expect(encounter!.selectedDilemmas.length).toBeLessThanOrEqual(3);
  });

  it("reduces draw count by overcome dilemmas beneath mission", () => {
    const overcomeDilemma = mockDilemma({
      id: "d-old",
      uniqueId: "d-old",
      overcome: true,
      faceup: true,
    });

    const dilemmas = [
      mockDilemma({ id: "d1", uniqueId: "d1", cost: 1 }),
      mockDilemma({ id: "d2", uniqueId: "d2", cost: 1 }),
      mockDilemma({ id: "d3", uniqueId: "d3", cost: 1 }),
    ];

    // 3 personnel, 1 overcome → drawCount = 2
    const { engine, missionIndex, groupIndex } = setupEngine({
      dilemmas,
      overcomeOnMission: [overcomeDilemma],
    });

    engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    const encounter = engine.getState().dilemmaEncounter;
    expect(encounter).not.toBeNull();
    expect(encounter!.selectedDilemmas.length).toBeLessThanOrEqual(2);
  });

  it("does not reduce draw count for non-overcome dilemmas on mission", () => {
    // Limited Welcome stays on mission with overcome=false
    const placedDilemma = mockDilemma({
      id: "d-placed",
      uniqueId: "d-placed",
      overcome: false,
      faceup: true,
    });

    const dilemmas = [
      mockDilemma({ id: "d1", uniqueId: "d1", cost: 1 }),
      mockDilemma({ id: "d2", uniqueId: "d2", cost: 1 }),
      mockDilemma({ id: "d3", uniqueId: "d3", cost: 1 }),
    ];

    // 3 personnel, 1 non-overcome dilemma → drawCount still 3
    // Plus the placed dilemma is re-encountered (added at no cost) → up to 4 total
    const { engine, missionIndex, groupIndex } = setupEngine({
      dilemmas,
      overcomeOnMission: [placedDilemma],
    });

    engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    const encounter = engine.getState().dilemmaEncounter;
    expect(encounter).not.toBeNull();
    // 3 from pool + 1 re-encountered = up to 4
    expect(encounter!.selectedDilemmas.length).toBeLessThanOrEqual(4);
  });

  it("re-encounters non-overcome dilemmas placed on mission at no cost", () => {
    const placedDilemma = mockDilemma({
      id: "d-placed",
      uniqueId: "d-placed",
      name: "Limited Welcome",
      overcome: false,
      faceup: true,
      cost: 2,
    });

    // Pool has one cheap dilemma
    const dilemmas = [mockDilemma({ id: "d1", uniqueId: "d1", cost: 1 })];

    const { engine, missionIndex, groupIndex } = setupEngine({
      dilemmas,
      overcomeOnMission: [placedDilemma],
    });

    engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    const encounter = engine.getState().dilemmaEncounter;
    expect(encounter).not.toBeNull();

    // The placed dilemma should be re-encountered alongside the pool dilemma
    const ids = encounter!.selectedDilemmas.map((d) => d.uniqueId);
    expect(ids).toContain("d-placed");

    // It should have been removed from the mission's dilemma list
    const mission = engine.getState().missions[missionIndex]!;
    const stillOnMission = mission.dilemmas.find(
      (d) => d.uniqueId === "d-placed"
    );
    expect(stillOnMission).toBeUndefined();
  });

  it("does not re-encounter overcome dilemmas placed on mission", () => {
    const overcomeDilemma = mockDilemma({
      id: "d-overcome",
      uniqueId: "d-overcome",
      overcome: true,
      faceup: true,
    });

    const dilemmas = [mockDilemma({ id: "d1", uniqueId: "d1", cost: 1 })];

    const { engine, missionIndex, groupIndex } = setupEngine({
      dilemmas,
      overcomeOnMission: [overcomeDilemma],
    });

    engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    const encounter = engine.getState().dilemmaEncounter;
    expect(encounter).not.toBeNull();

    // Overcome dilemma should NOT be in the encounter
    const ids = encounter!.selectedDilemmas.map((d) => d.uniqueId);
    expect(ids).not.toContain("d-overcome");
  });
});

// =============================================================================
// Rule 2: Cost budget (total cost ≤ personnel count - overcome)
// =============================================================================

describe("Rule 2: Cost budget", () => {
  it("does not select dilemmas that would exceed cost budget", () => {
    // 3 personnel, budget = 3, two cost-2 dilemmas = 4 > 3
    const dilemmas = [
      mockDilemma({ id: "d1", uniqueId: "d1", cost: 2 }),
      mockDilemma({ id: "d2", uniqueId: "d2", cost: 2 }),
    ];

    const { engine, missionIndex, groupIndex } = setupEngine({ dilemmas });
    engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    const encounter = engine.getState().dilemmaEncounter;
    expect(encounter).not.toBeNull();

    const totalCost = encounter!.selectedDilemmas.reduce(
      (sum, d) => sum + d.cost,
      0
    );
    expect(totalCost).toBeLessThanOrEqual(3);
  });

  it("selects expensive dilemma when budget allows", () => {
    const dilemmas = [mockDilemma({ id: "d1", uniqueId: "d1", cost: 3 })];

    const { engine, missionIndex, groupIndex } = setupEngine({ dilemmas });
    engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    const encounter = engine.getState().dilemmaEncounter;
    expect(encounter).not.toBeNull();
    expect(encounter!.selectedDilemmas.length).toBe(1);
    expect(encounter!.selectedDilemmas[0]!.id).toBe("d1");
  });

  it("skips dilemmas that are too expensive", () => {
    // budget = 3, cost-4 won't fit
    const dilemmas = [
      mockDilemma({ id: "d-expensive", uniqueId: "d-exp", cost: 4 }),
      mockDilemma({ id: "d-cheap", uniqueId: "d-cheap", cost: 1 }),
    ];

    const { engine, missionIndex, groupIndex } = setupEngine({ dilemmas });
    engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    const encounter = engine.getState().dilemmaEncounter;
    expect(encounter).not.toBeNull();

    const ids = encounter!.selectedDilemmas.map((d) => d.id);
    expect(ids).not.toContain("d-expensive");
  });
});

// =============================================================================
// Rule 3: No duplicate dilemmas during encounter
// =============================================================================

describe("Rule 3: No duplicate dilemmas", () => {
  it("auto-overcomes duplicate dilemma during encounter progression", () => {
    // Use deterministic encounter setup to guarantee ordering
    const { engine, missionIndex, groupIndex } = setupEngine({});

    const d1 = mockDilemma({
      id: "same-card",
      uniqueId: "d1",
      cost: 1,
      name: "Dilemma A",
      rule: { type: "crewLimit", keepCount: 99 },
    });
    const d2 = mockDilemma({
      id: "same-card",
      uniqueId: "d2",
      cost: 1,
      name: "Dilemma B",
      rule: { type: "crewLimit", keepCount: 99 },
    });

    // Set up encounter directly with known order
    setupEncounterDirectly(engine, missionIndex, groupIndex, [d1, d2]);

    // Advance past the first dilemma
    engine.executeAction(action({ type: "ADVANCE_DILEMMA" }));

    // Verify the action log mentions duplicate auto-overcome
    const log = engine.getState().actionLog;
    const duplicateLog = log.find((e) => e.message.includes("duplicate"));
    expect(duplicateLog).toBeDefined();

    // The duplicate dilemma should be placed beneath mission as overcome
    const deployment = engine.getState().missions[missionIndex]!;
    const overcomeDilemmas = deployment.dilemmas.filter((d) => d.overcome);
    expect(overcomeDilemmas.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Rule 4: Location filtering
// =============================================================================

describe("Rule 4: Location filtering", () => {
  it("excludes space dilemmas for planet missions", () => {
    const dilemmas = [
      mockDilemma({
        id: "d-space",
        uniqueId: "d-space",
        where: "Space",
        cost: 1,
      }),
      mockDilemma({
        id: "d-planet",
        uniqueId: "d-planet",
        where: "Planet",
        cost: 1,
      }),
      mockDilemma({ id: "d-dual", uniqueId: "d-dual", where: "Dual", cost: 1 }),
    ];

    const { engine, missionIndex, groupIndex } = setupEngine({
      dilemmas,
      mission: { missionType: "Planet" },
    });

    engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    const encounter = engine.getState().dilemmaEncounter;
    expect(encounter).not.toBeNull();

    const selectedLocations = encounter!.selectedDilemmas.map((d) => d.where);
    expect(selectedLocations).not.toContain("Space");
  });

  it("excludes planet dilemmas for space missions", () => {
    const dilemmas = [
      mockDilemma({
        id: "d-space",
        uniqueId: "d-space",
        where: "Space",
        cost: 1,
      }),
      mockDilemma({
        id: "d-planet",
        uniqueId: "d-planet",
        where: "Planet",
        cost: 1,
      }),
      mockDilemma({ id: "d-dual", uniqueId: "d-dual", where: "Dual", cost: 1 }),
    ];

    const { engine, missionIndex, groupIndex } = setupEngine({
      dilemmas,
      mission: { missionType: "Space" },
    });

    engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    const encounter = engine.getState().dilemmaEncounter;
    expect(encounter).not.toBeNull();

    const selectedLocations = encounter!.selectedDilemmas.map((d) => d.where);
    expect(selectedLocations).not.toContain("Planet");
  });

  it("always allows dual dilemmas", () => {
    const dilemmas = [
      mockDilemma({ id: "d-dual", uniqueId: "d-dual", where: "Dual", cost: 1 }),
    ];

    const { engine, missionIndex, groupIndex } = setupEngine({
      dilemmas,
      mission: { missionType: "Planet" },
    });

    engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    const encounter = engine.getState().dilemmaEncounter;
    expect(encounter).not.toBeNull();
    expect(encounter!.selectedDilemmas.length).toBe(1);
    expect(encounter!.selectedDilemmas[0]!.where).toBe("Dual");
  });
});

// =============================================================================
// Rule 5: Unchosen dilemmas stay in pool
// =============================================================================

describe("Rule 5: Unchosen dilemmas stay in pool", () => {
  it("removes selected dilemmas from pool but keeps unchosen", () => {
    const dilemmas = [
      mockDilemma({ id: "d1", uniqueId: "d1", cost: 1 }),
      mockDilemma({ id: "d2", uniqueId: "d2", cost: 1 }),
      mockDilemma({ id: "d3", uniqueId: "d3", cost: 1 }),
    ];

    // Only 1 personnel → at most 1 dilemma selected
    const { engine, missionIndex, groupIndex } = setupEngine({
      dilemmas,
      personnel: [
        mockPersonnel({ uniqueId: "p1", name: "P1", skills: [["Science"]] }),
      ],
    });

    engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    const encounter = engine.getState().dilemmaEncounter;
    const pool = engine.getState().dilemmaPool;

    expect(encounter).not.toBeNull();
    expect(encounter!.selectedDilemmas.length).toBe(1);

    // Selected dilemma should NOT be in the pool
    const selectedId = encounter!.selectedDilemmas[0]!.uniqueId;
    expect(pool.find((d) => d.uniqueId === selectedId)).toBeUndefined();

    // Unchosen dilemmas should still be in the pool
    expect(pool.length).toBe(2);
  });
});

// =============================================================================
// Rule 8: Overcome dilemmas placed beneath mission
// =============================================================================

describe("Rule 8: Overcome dilemmas placed beneath mission", () => {
  it("places non-returnsToPile dilemma on mission after resolution", () => {
    const { engine, missionIndex, groupIndex } = setupEngine({
      personnel: [
        mockPersonnel({ uniqueId: "p1", name: "P1", skills: [["Science"]] }),
      ],
    });

    // crewLimit with keepCount 99 → no one stopped, stays on mission
    const dilemma = mockDilemma({
      id: "d1",
      uniqueId: "d1",
      cost: 1,
      rule: { type: "crewLimit", keepCount: 99 },
    });

    setupEncounterDirectly(engine, missionIndex, groupIndex, [dilemma]);

    engine.executeAction(action({ type: "ADVANCE_DILEMMA" }));

    const deployment = engine.getState().missions[missionIndex]!;
    const placed = deployment.dilemmas.find((d) => d.uniqueId === "d1");
    expect(placed).toBeDefined();
    expect(placed!.faceup).toBe(true);
  });
});

// =============================================================================
// Rule 9: Return-to-pile dilemma NOT placed beneath mission
// =============================================================================

describe("Rule 9: Return-to-pile dilemma not placed on mission", () => {
  it("does not place returnsToPile dilemma beneath mission", () => {
    const { engine, missionIndex, groupIndex } = setupEngine({
      personnel: [
        mockPersonnel({ uniqueId: "p1", name: "P1", skills: [["Science"]] }),
      ],
    });

    // chooseToStop with no matching skills → stopAllReturnToPile
    const dilemma = mockDilemma({
      id: "d-return",
      uniqueId: "d-return",
      cost: 1,
      rule: {
        type: "chooseToStop",
        skills: ["Engineer", "Programming"],
        penalty: "stopAllReturnToPile",
      },
    });

    setupEncounterDirectly(engine, missionIndex, groupIndex, [dilemma]);

    engine.executeAction(action({ type: "ADVANCE_DILEMMA" }));

    const deployment = engine.getState().missions[missionIndex]!;
    const placed = deployment.dilemmas.find((d) => d.uniqueId === "d-return");
    expect(placed).toBeUndefined();
  });

  it("returns returnsToPile dilemma to pool face-up", () => {
    const { engine, missionIndex, groupIndex } = setupEngine({
      personnel: [
        mockPersonnel({ uniqueId: "p1", name: "P1", skills: [["Science"]] }),
      ],
    });

    const dilemma = mockDilemma({
      id: "d-return",
      uniqueId: "d-return",
      cost: 1,
      rule: {
        type: "chooseToStop",
        skills: ["Engineer", "Programming"],
        penalty: "stopAllReturnToPile",
      },
    });

    setupEncounterDirectly(engine, missionIndex, groupIndex, [dilemma]);
    engine.executeAction(action({ type: "ADVANCE_DILEMMA" }));

    const pool = engine.getState().dilemmaPool;
    const returned = pool.find((d) => d.uniqueId === "d-return");
    expect(returned).toBeDefined();
    expect(returned!.faceup).toBe(true);
    expect(returned!.overcome).toBe(false);
  });
});

// =============================================================================
// Rule 6: Face-up reshuffle
// =============================================================================

describe("Rule 6: Face-up reshuffle", () => {
  it("reshuffles when all applicable dilemmas are face-up", () => {
    // All dilemmas face-up — no face-down cards to draw from
    const dilemmas = [
      mockDilemma({ id: "d1", uniqueId: "d1", cost: 1, faceup: true }),
      mockDilemma({ id: "d2", uniqueId: "d2", cost: 1, faceup: true }),
    ];

    const { engine, missionIndex, groupIndex } = setupEngine({
      dilemmas,
      personnel: [
        mockPersonnel({ uniqueId: "p1", name: "P1", skills: [["Science"]] }),
      ],
    });

    engine.executeAction(
      action({ type: "ATTEMPT_MISSION", missionIndex, groupIndex })
    );

    // After reshuffle, remaining cards in pool should all be face-down
    const pool = engine.getState().dilemmaPool;
    for (const d of pool) {
      expect(d.faceup).toBe(false);
    }

    // Verify reshuffle was logged
    const log = engine.getState().actionLog;
    const reshuffleLog = log.find((e) => e.message.includes("reshuffled"));
    expect(reshuffleLog).toBeDefined();
    expect(reshuffleLog!.details).toContain("Face-up");
  });

  it("does not reshuffle when face-down cards are still available", () => {
    // Mix of face-up and face-down — face-down still available
    const dilemmas = [
      mockDilemma({ id: "d1", uniqueId: "d1", cost: 1, faceup: false }),
      mockDilemma({ id: "d2", uniqueId: "d2", cost: 1, faceup: true }),
    ];

    const { engine, missionIndex, groupIndex } = setupEngine({
      dilemmas,
      personnel: [
        mockPersonnel({ uniqueId: "p1", name: "P1", skills: [["Science"]] }),
      ],
    });

    engine.executeAction(
      action({ type: "ATTEMPT_MISSION", missionIndex, groupIndex })
    );

    const log = engine.getState().actionLog;
    const reshuffleLog = log.find((e) => e.message.includes("reshuffled"));
    expect(reshuffleLog).toBeUndefined();
  });

  it("skips face-up cards during selection (only draws face-down)", () => {
    // d1 is face-up (at bottom), d2 is face-down (drawable)
    const dilemmas = [
      mockDilemma({ id: "d1", uniqueId: "d1", cost: 1, faceup: true }),
      mockDilemma({ id: "d2", uniqueId: "d2", cost: 1, faceup: false }),
    ];

    const { engine, missionIndex, groupIndex } = setupEngine({
      dilemmas,
      personnel: [
        mockPersonnel({ uniqueId: "p1", name: "P1", skills: [["Science"]] }),
      ],
    });

    engine.executeAction(
      action({ type: "ATTEMPT_MISSION", missionIndex, groupIndex })
    );

    // d1 (face-up) should still be in the pool, untouched
    const pool = engine.getState().dilemmaPool;
    const d1 = pool.find((d) => d.uniqueId === "d1");
    expect(d1).toBeDefined();
    expect(d1!.faceup).toBe(true);
  });
});

// =============================================================================
// Failure reason in action log
// =============================================================================

describe("Failure reason in action log", () => {
  it("includes needed requirements in dilemma_result details for unlessCheck", () => {
    const { engine, missionIndex, groupIndex } = setupEngine({
      personnel: [
        mockPersonnel({ uniqueId: "p1", name: "P1", skills: [["Science"]] }),
        mockPersonnel({ uniqueId: "p2", name: "P2", skills: [["Medical"]] }),
      ],
    });

    const dilemma = mockDilemma({
      id: "d1",
      uniqueId: "d1",
      cost: 1,
      rule: {
        type: "unlessCheck",
        requirements: [
          { skills: ["Diplomacy", "Medical"] },
          { skills: ["Security", "Security"] },
        ],
        penalty: { type: "randomKill" },
      },
    });

    setupEncounterDirectly(engine, missionIndex, groupIndex, [dilemma]);
    engine.executeAction(action({ type: "ADVANCE_DILEMMA" }));

    const log = engine.getState().actionLog;
    const resultLog = log.find(
      (e) => e.type === "dilemma_result" && e.details?.includes("Needed:")
    );
    expect(resultLog).toBeDefined();
    expect(resultLog!.details).toContain("Diplomacy + Medical");
    expect(resultLog!.details).toContain("2 Security");
  });

  it("includes needed requirements for randomThenCheck", () => {
    const { engine, missionIndex, groupIndex } = setupEngine({
      personnel: [
        mockPersonnel({ uniqueId: "p1", name: "P1", skills: [["Science"]] }),
        mockPersonnel({ uniqueId: "p2", name: "P2", skills: [["Engineer"]] }),
      ],
    });

    const dilemma = mockDilemma({
      id: "d1",
      uniqueId: "d1",
      cost: 1,
      rule: {
        type: "randomThenCheck",
        requirements: [
          { skills: ["Diplomacy", "Medical"] },
          { skills: ["Security", "Security"] },
        ],
      },
    });

    setupEncounterDirectly(engine, missionIndex, groupIndex, [dilemma]);
    engine.executeAction(action({ type: "ADVANCE_DILEMMA" }));

    const log = engine.getState().actionLog;
    const resultLog = log.find(
      (e) => e.type === "dilemma_result" && e.details?.includes("Needed:")
    );
    expect(resultLog).toBeDefined();
  });

  it("does not include failure reason when dilemma is overcome", () => {
    const { engine, missionIndex, groupIndex } = setupEngine({
      personnel: [
        mockPersonnel({
          uniqueId: "p1",
          name: "P1",
          skills: [["Diplomacy"]],
        }),
        mockPersonnel({ uniqueId: "p2", name: "P2", skills: [["Medical"]] }),
      ],
    });

    const dilemma = mockDilemma({
      id: "d1",
      uniqueId: "d1",
      cost: 1,
      rule: {
        type: "unlessCheck",
        requirements: [{ skills: ["Diplomacy", "Medical"] }],
        penalty: { type: "randomKill" },
      },
    });

    setupEncounterDirectly(engine, missionIndex, groupIndex, [dilemma]);
    engine.executeAction(action({ type: "ADVANCE_DILEMMA" }));

    const log = engine.getState().actionLog;
    const resultLog = log.find((e) => e.type === "dilemma_result");
    expect(resultLog).toBeDefined();
    expect(resultLog!.details).not.toContain("Needed:");
  });
});

// =============================================================================
// Rule 10: Stopped personnel removed from further dilemmas
// =============================================================================

describe("Rule 10: Stopped personnel removed from further dilemmas", () => {
  it("stopped personnel do not contribute to subsequent dilemma checks", () => {
    const { engine, missionIndex, groupIndex } = setupEngine({
      personnel: [
        mockPersonnel({
          uniqueId: "p-leader",
          name: "Leader",
          skills: [["Leadership"]],
        }),
        mockPersonnel({
          uniqueId: "p-science",
          name: "Scientist",
          skills: [["Science"]],
        }),
      ],
    });

    // First dilemma: choose Leadership to stop
    // Second dilemma: unless Leadership, stop all and return
    const d1 = mockDilemma({
      id: "d1",
      uniqueId: "d1",
      cost: 1,
      name: "First",
      rule: {
        type: "chooseToStop",
        skills: ["Leadership"],
        penalty: "randomKill",
      },
    });
    const d2 = mockDilemma({
      id: "d2",
      uniqueId: "d2",
      cost: 1,
      name: "Second",
      rule: {
        type: "unlessCheck",
        requirements: [{ skills: ["Leadership"] }],
        penalty: { type: "stopAllReturnToPile" },
      },
    });

    setupEncounterDirectly(engine, missionIndex, groupIndex, [d1, d2]);

    // First dilemma requires selection
    const result1 = engine.getState().dilemmaResult;
    expect(result1!.requiresSelection).toBe(true);

    // Select the leader to be stopped
    engine.executeAction(
      action({
        type: "SELECT_PERSONNEL_FOR_DILEMMA",
        personnelId: "p-leader",
      })
    );

    // Advance past first dilemma → applies stop, resolves second
    engine.executeAction(action({ type: "ADVANCE_DILEMMA" }));

    // Leader should be stopped
    const group = engine.getState().missions[missionIndex]!.groups[0]!;
    const leader = group.cards.find(
      (c) => c.uniqueId === "p-leader"
    ) as PersonnelCard;
    expect(leader.status).toBe("Stopped");

    // Second dilemma resolved: no Leadership left → penalty triggered
    const result2 = engine.getState().dilemmaResult;
    if (result2) {
      // The scientist should be stopped by the penalty
      expect(result2.stoppedPersonnel).toContain("p-science");
    }
  });
});

// =============================================================================
// Rule 11: All stopped → remaining dilemmas auto-overcome
// =============================================================================

describe("Rule 11: All personnel stopped → remaining dilemmas overcome", () => {
  it("places remaining unfaced dilemmas beneath mission as overcome", () => {
    const { engine, missionIndex, groupIndex } = setupEngine({});

    // First dilemma stops all (requires 3x Telepathy, penalty: stopAll)
    const dStopper = mockDilemma({
      id: "d-stopper",
      uniqueId: "d-stopper",
      cost: 1,
      name: "Stopper",
      rule: {
        type: "unlessCheck",
        requirements: [{ skills: ["Telepathy", "Telepathy", "Telepathy"] }],
        penalty: { type: "stopAllReturnToPile" },
      },
    });
    const dRemaining1 = mockDilemma({
      id: "d-r1",
      uniqueId: "d-r1",
      cost: 1,
      name: "Remaining 1",
      rule: { type: "crewLimit", keepCount: 99 },
    });
    const dRemaining2 = mockDilemma({
      id: "d-r2",
      uniqueId: "d-r2",
      cost: 1,
      name: "Remaining 2",
      rule: { type: "crewLimit", keepCount: 99 },
    });

    // Deterministic order: stopper first, then remaining
    setupEncounterDirectly(engine, missionIndex, groupIndex, [
      dStopper,
      dRemaining1,
      dRemaining2,
    ]);

    // Verify the first dilemma was resolved to stop all
    const result = engine.getState().dilemmaResult;
    expect(result!.overcome).toBe(false);
    expect(result!.stoppedPersonnel.length).toBe(3);

    // Advance → applies stop, detects all stopped, calls failMissionAttempt
    engine.executeAction(action({ type: "ADVANCE_DILEMMA" }));

    // All personnel should be stopped
    const group = engine.getState().missions[missionIndex]!.groups[0]!;
    const allStopped = group.cards
      .filter((c) => c.type === "Personnel")
      .every((c) => (c as PersonnelCard).status === "Stopped");
    expect(allStopped).toBe(true);

    // Remaining dilemmas should be placed beneath mission as overcome
    const deployment = engine.getState().missions[missionIndex]!;
    const r1 = deployment.dilemmas.find((d) => d.uniqueId === "d-r1");
    const r2 = deployment.dilemmas.find((d) => d.uniqueId === "d-r2");

    expect(r1).toBeDefined();
    expect(r1!.overcome).toBe(true);
    expect(r1!.faceup).toBe(true);

    expect(r2).toBeDefined();
    expect(r2!.overcome).toBe(true);
    expect(r2!.faceup).toBe(true);

    // Encounter should be cleared
    expect(engine.getState().dilemmaEncounter).toBeNull();
  });

  it("logs auto-overcome for remaining dilemmas", () => {
    const { engine, missionIndex, groupIndex } = setupEngine({
      personnel: [
        mockPersonnel({ uniqueId: "p1", name: "P1" }),
        mockPersonnel({ uniqueId: "p2", name: "P2" }),
      ],
    });

    const dStopper = mockDilemma({
      id: "d-stopper",
      uniqueId: "d-stopper",
      cost: 1,
      name: "Stopper",
      rule: {
        type: "unlessCheck",
        requirements: [{ skills: ["Telepathy", "Telepathy", "Telepathy"] }],
        penalty: { type: "stopAllReturnToPile" },
      },
    });
    const dRemaining = mockDilemma({
      id: "d-r",
      uniqueId: "d-r",
      cost: 1,
      name: "Remaining",
      rule: { type: "crewLimit", keepCount: 99 },
    });

    setupEncounterDirectly(engine, missionIndex, groupIndex, [
      dStopper,
      dRemaining,
    ]);

    engine.executeAction(action({ type: "ADVANCE_DILEMMA" }));

    const log = engine.getState().actionLog;
    const autoOvercomeLog = log.find((e) =>
      e.message.includes("no personnel remaining")
    );
    expect(autoOvercomeLog).toBeDefined();
  });
});

// =============================================================================
// No dilemmas → mission check proceeds directly
// =============================================================================

describe("No dilemmas in pool", () => {
  it("proceeds to mission check when no applicable dilemmas exist", () => {
    const { engine, missionIndex, groupIndex } = setupEngine({
      dilemmas: [],
      personnel: [
        mockPersonnel({ uniqueId: "p1", name: "Sci", skills: [["Science"]] }),
        mockPersonnel({ uniqueId: "p2", name: "Med", skills: [["Medical"]] }),
      ],
      mission: {
        skills: [["Science", "Medical"]],
        score: 35,
      },
    });

    engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    const deployment = engine.getState().missions[missionIndex]!;
    expect(deployment.mission.completed).toBe(true);
    expect(engine.getState().score).toBe(35);
  });
});

// =============================================================================
// Phase validation
// =============================================================================

describe("Phase validation", () => {
  it("rejects mission attempt outside ExecuteOrders phase", () => {
    const { engine, missionIndex, groupIndex } = setupEngine({});
    engine.getState().phase = "PlayAndDraw";

    const result = engine.executeAction(
      action({
        type: "ATTEMPT_MISSION",
        missionIndex,
        groupIndex,
      })
    );

    expect(result.success).toBe(false);
    expect(result.reason).toContain("Execute Orders");
  });
});

// =============================================================================
// New turn resets ship range
// =============================================================================

describe("New turn resets ship range", () => {
  it("resets rangeRemaining to base range on new turn", () => {
    const engine = new GameEngine();
    const state = engine.getState();

    const ship = mockShip({ uniqueId: "ship1", range: 8, rangeRemaining: 2 });

    state.missions[0] = {
      mission: mockMission({
        id: "hq",
        name: "HQ",
        missionType: "Headquarters",
        affiliation: [],
        score: undefined,
        skills: undefined,
      }),
      groups: [{ cards: [ship] }],
      dilemmas: [],
    };
    state.headquartersIndex = 0;

    // Spend all counters so we can advance past PlayAndDraw
    state.counters = 0;
    state.phase = "PlayAndDraw";

    // PlayAndDraw → ExecuteOrders
    engine.executeAction(action({ type: "NEXT_PHASE" }));
    // ExecuteOrders → DiscardExcess
    engine.executeAction(action({ type: "NEXT_PHASE" }));
    // DiscardExcess → newTurn (triggers reset)
    engine.executeAction(action({ type: "NEXT_PHASE" }));

    expect(ship.rangeRemaining).toBe(8);
  });
});
