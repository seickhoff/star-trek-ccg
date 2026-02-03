import { describe, it, expect } from "vitest";
import {
  matchesTargetFilter,
  getEffectiveStats,
  collectApplicableAbilities,
  getGroupEffectiveStats,
} from "./abilities";
import type { PersonnelCard, ShipCard } from "../types/card";
import type { Ability, TargetFilter } from "../types/ability";

// Test fixtures
const createPersonnel = (
  overrides: Partial<PersonnelCard> = {}
): PersonnelCard => ({
  id: "EN00001",
  uniqueId: "EN00001-1",
  name: "Test Personnel",
  type: "Personnel",
  unique: false,
  jpg: "/cards/test.jpg",
  affiliation: ["Borg"],
  deploy: 2,
  species: ["Borg"],
  status: "Unstopped",
  other: [],
  skills: [],
  integrity: 5,
  cunning: 5,
  strength: 5,
  ...overrides,
});

const createShip = (overrides: Partial<ShipCard> = {}): ShipCard => ({
  id: "EN00003",
  name: "Test Ship",
  type: "Ship",
  unique: false,
  jpg: "/cards/ship.jpg",
  affiliation: ["Borg"],
  deploy: 3,
  staffing: [["Staff"]],
  range: 8,
  rangeRemaining: 8,
  weapons: 6,
  shields: 6,
  ...overrides,
});

// Opposition Drone ability for testing
const oppositionDroneAbility: Ability = {
  id: "opposition-drone-strength-boost",
  trigger: "passive",
  target: {
    scope: "present",
    species: ["Borg"],
    excludeSelf: true,
  },
  effects: [
    {
      type: "statModifier",
      stat: "strength",
      value: 1,
    },
  ],
};

describe("matchesTargetFilter", () => {
  it("matches when no filters specified", () => {
    const personnel = createPersonnel();
    const source = createPersonnel({ uniqueId: "EN00001-2" });
    const filter: TargetFilter = { scope: "present" };

    expect(matchesTargetFilter(personnel, filter, source)).toBe(true);
  });

  it("excludes self when excludeSelf is true", () => {
    const personnel = createPersonnel({ uniqueId: "EN00001-1" });
    const source = createPersonnel({ uniqueId: "EN00001-1" }); // same uniqueId
    const filter: TargetFilter = { scope: "present", excludeSelf: true };

    expect(matchesTargetFilter(personnel, filter, source)).toBe(false);
  });

  it("matches species filter", () => {
    const borgPersonnel = createPersonnel({ species: ["Borg"] });
    const humanPersonnel = createPersonnel({ species: ["Human"] });
    const source = createPersonnel({ uniqueId: "source" });
    const filter: TargetFilter = { scope: "present", species: ["Borg"] };

    expect(matchesTargetFilter(borgPersonnel, filter, source)).toBe(true);
    expect(matchesTargetFilter(humanPersonnel, filter, source)).toBe(false);
  });

  it("matches any species in filter array", () => {
    const humanPersonnel = createPersonnel({ species: ["Human"] });
    const source = createPersonnel({ uniqueId: "source" });
    const filter: TargetFilter = {
      scope: "present",
      species: ["Borg", "Human"],
    };

    expect(matchesTargetFilter(humanPersonnel, filter, source)).toBe(true);
  });

  it("matches personnel with multiple species", () => {
    const multiSpeciesPersonnel = createPersonnel({
      species: ["Human", "Vulcan"],
    });
    const source = createPersonnel({ uniqueId: "source" });
    const filter: TargetFilter = { scope: "present", species: ["Vulcan"] };

    expect(matchesTargetFilter(multiSpeciesPersonnel, filter, source)).toBe(
      true
    );
  });

  it("matches affiliation filter", () => {
    const borgPersonnel = createPersonnel({ affiliation: ["Borg"] });
    const fedPersonnel = createPersonnel({ affiliation: ["Federation"] });
    const source = createPersonnel({ uniqueId: "source" });
    const filter: TargetFilter = { scope: "present", affiliations: ["Borg"] };

    expect(matchesTargetFilter(borgPersonnel, filter, source)).toBe(true);
    expect(matchesTargetFilter(fedPersonnel, filter, source)).toBe(false);
  });

  it("matches card type filter", () => {
    const personnel = createPersonnel();
    const source = createPersonnel({ uniqueId: "source" });
    const filter: TargetFilter = { scope: "present", cardTypes: ["Personnel"] };

    expect(matchesTargetFilter(personnel, filter, source)).toBe(true);
  });

  it("combines multiple filters with AND logic", () => {
    const personnel = createPersonnel({
      species: ["Borg"],
      affiliation: ["Borg"],
    });
    const source = createPersonnel({ uniqueId: "source" });
    const filter: TargetFilter = {
      scope: "present",
      species: ["Borg"],
      affiliations: ["Borg"],
    };

    expect(matchesTargetFilter(personnel, filter, source)).toBe(true);
  });

  it("fails when any filter condition fails", () => {
    const personnel = createPersonnel({
      species: ["Human"],
      affiliation: ["Borg"],
    });
    const source = createPersonnel({ uniqueId: "source" });
    const filter: TargetFilter = {
      scope: "present",
      species: ["Borg"], // fails - Human not Borg
      affiliations: ["Borg"], // passes
    };

    expect(matchesTargetFilter(personnel, filter, source)).toBe(false);
  });
});

describe("getEffectiveStats", () => {
  it("returns base stats when no abilities present", () => {
    const personnel = createPersonnel({
      integrity: 5,
      cunning: 6,
      strength: 7,
    });

    const stats = getEffectiveStats(personnel, [personnel]);

    expect(stats.integrity).toBe(5);
    expect(stats.cunning).toBe(6);
    expect(stats.strength).toBe(7);
  });

  it("applies strength modifier from Opposition Drone", () => {
    const oppositionDrone = createPersonnel({
      uniqueId: "drone-1",
      name: "Opposition Drone",
      species: ["Borg"],
      strength: 6,
      abilities: [oppositionDroneAbility],
    });

    const otherBorg = createPersonnel({
      uniqueId: "other-1",
      name: "Other Borg",
      species: ["Borg"],
      strength: 5,
    });

    const presentCards = [oppositionDrone, otherBorg];

    // Other Borg should get +1 strength from Opposition Drone
    const otherStats = getEffectiveStats(otherBorg, presentCards);
    expect(otherStats.strength).toBe(6); // 5 + 1

    // Opposition Drone should NOT get bonus (excludeSelf)
    const droneStats = getEffectiveStats(oppositionDrone, presentCards);
    expect(droneStats.strength).toBe(6); // unchanged
  });

  it("stacks multiple Opposition Drones", () => {
    const drone1 = createPersonnel({
      uniqueId: "drone-1",
      name: "Opposition Drone 1",
      species: ["Borg"],
      strength: 6,
      abilities: [oppositionDroneAbility],
    });

    const drone2 = createPersonnel({
      uniqueId: "drone-2",
      name: "Opposition Drone 2",
      species: ["Borg"],
      strength: 6,
      abilities: [oppositionDroneAbility],
    });

    const otherBorg = createPersonnel({
      uniqueId: "other-1",
      name: "Other Borg",
      species: ["Borg"],
      strength: 5,
    });

    const presentCards = [drone1, drone2, otherBorg];

    // Other Borg gets +1 from each drone
    const otherStats = getEffectiveStats(otherBorg, presentCards);
    expect(otherStats.strength).toBe(7); // 5 + 1 + 1

    // Each drone gets +1 from the other drone
    const drone1Stats = getEffectiveStats(drone1, presentCards);
    expect(drone1Stats.strength).toBe(7); // 6 + 1 (from drone2)

    const drone2Stats = getEffectiveStats(drone2, presentCards);
    expect(drone2Stats.strength).toBe(7); // 6 + 1 (from drone1)
  });

  it("does not affect non-Borg species", () => {
    const oppositionDrone = createPersonnel({
      uniqueId: "drone-1",
      name: "Opposition Drone",
      species: ["Borg"],
      abilities: [oppositionDroneAbility],
    });

    const human = createPersonnel({
      uniqueId: "human-1",
      name: "Human",
      species: ["Human"],
      strength: 5,
    });

    const presentCards = [oppositionDrone, human];

    // Human should NOT get bonus (wrong species)
    const humanStats = getEffectiveStats(human, presentCards);
    expect(humanStats.strength).toBe(5); // unchanged
  });

  it("applies multiple different stat modifiers", () => {
    const buffCard = createPersonnel({
      uniqueId: "buff-1",
      name: "Buffer",
      species: ["Borg"],
      abilities: [
        {
          id: "multi-buff",
          trigger: "passive",
          target: { scope: "present", species: ["Borg"], excludeSelf: true },
          effects: [
            { type: "statModifier", stat: "strength", value: 1 },
            { type: "statModifier", stat: "integrity", value: 2 },
            { type: "statModifier", stat: "cunning", value: 3 },
          ],
        },
      ],
    });

    const target = createPersonnel({
      uniqueId: "target-1",
      species: ["Borg"],
      integrity: 5,
      cunning: 5,
      strength: 5,
    });

    const stats = getEffectiveStats(target, [buffCard, target]);

    expect(stats.strength).toBe(6); // 5 + 1
    expect(stats.integrity).toBe(7); // 5 + 2
    expect(stats.cunning).toBe(8); // 5 + 3
  });

  it("ignores non-passive abilities", () => {
    const cardWithTriggeredAbility = createPersonnel({
      uniqueId: "triggered-1",
      species: ["Borg"],
      abilities: [
        {
          id: "on-deploy-buff",
          trigger: "onDeploy", // not passive
          target: { scope: "present", species: ["Borg"] },
          effects: [{ type: "statModifier", stat: "strength", value: 10 }],
        },
      ],
    });

    const target = createPersonnel({
      uniqueId: "target-1",
      species: ["Borg"],
      strength: 5,
    });

    const stats = getEffectiveStats(target, [cardWithTriggeredAbility, target]);
    expect(stats.strength).toBe(5); // unchanged
  });

  it("ignores non-personnel cards", () => {
    const ship = createShip();
    const personnel = createPersonnel({ strength: 5 });

    const stats = getEffectiveStats(personnel, [ship, personnel]);
    expect(stats.strength).toBe(5); // unchanged
  });
});

describe("collectApplicableAbilities", () => {
  it("collects abilities that affect target", () => {
    const source = createPersonnel({
      uniqueId: "source-1",
      species: ["Borg"],
      abilities: [oppositionDroneAbility],
    });

    const target = createPersonnel({
      uniqueId: "target-1",
      species: ["Borg"],
    });

    const applicable = collectApplicableAbilities(target, [source, target]);

    expect(applicable).toHaveLength(1);
    expect(applicable[0].ability.id).toBe("opposition-drone-strength-boost");
    expect(applicable[0].sourceCard).toBe(source);
  });

  it("excludes abilities that don't match target", () => {
    const source = createPersonnel({
      uniqueId: "source-1",
      species: ["Borg"],
      abilities: [oppositionDroneAbility],
    });

    const target = createPersonnel({
      uniqueId: "target-1",
      species: ["Human"], // Not Borg
    });

    const applicable = collectApplicableAbilities(target, [source, target]);
    expect(applicable).toHaveLength(0);
  });

  it("collects multiple abilities from multiple sources", () => {
    const source1 = createPersonnel({
      uniqueId: "source-1",
      species: ["Borg"],
      abilities: [oppositionDroneAbility],
    });

    const source2 = createPersonnel({
      uniqueId: "source-2",
      species: ["Borg"],
      abilities: [oppositionDroneAbility],
    });

    const target = createPersonnel({
      uniqueId: "target-1",
      species: ["Borg"],
    });

    const applicable = collectApplicableAbilities(target, [
      source1,
      source2,
      target,
    ]);
    expect(applicable).toHaveLength(2);
  });
});

describe("getGroupEffectiveStats", () => {
  it("returns stats for all personnel in group", () => {
    const drone = createPersonnel({
      uniqueId: "drone-1",
      species: ["Borg"],
      strength: 6,
      abilities: [oppositionDroneAbility],
    });

    const borg = createPersonnel({
      uniqueId: "borg-1",
      species: ["Borg"],
      strength: 5,
    });

    const statsMap = getGroupEffectiveStats([drone, borg]);

    expect(statsMap.get("drone-1")?.strength).toBe(6); // no self-buff
    expect(statsMap.get("borg-1")?.strength).toBe(6); // +1 from drone
  });

  it("excludes cards without uniqueId", () => {
    const personnel = createPersonnel({ uniqueId: undefined, strength: 5 });

    const statsMap = getGroupEffectiveStats([personnel]);
    expect(statsMap.size).toBe(0);
  });
});

describe("integration with calculateGroupStats", () => {
  // Import the function to test integration
  it("calculateGroupStats uses effective stats", async () => {
    const { calculateGroupStats } = await import("./missionChecker");

    const drone = createPersonnel({
      uniqueId: "drone-1",
      name: "Opposition Drone",
      species: ["Borg"],
      strength: 6,
      abilities: [oppositionDroneAbility],
    });

    const borg1 = createPersonnel({
      uniqueId: "borg-1",
      name: "Borg 1",
      species: ["Borg"],
      strength: 5,
    });

    const borg2 = createPersonnel({
      uniqueId: "borg-2",
      name: "Borg 2",
      species: ["Borg"],
      strength: 5,
    });

    // Without Opposition Drone: 6 + 5 + 5 = 16
    // With Opposition Drone: 6 + (5+1) + (5+1) = 18
    const stats = calculateGroupStats([drone, borg1, borg2]);
    expect(stats.strength).toBe(18);
  });
});
