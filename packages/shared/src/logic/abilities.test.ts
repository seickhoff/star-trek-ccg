import { describe, it, expect } from "vitest";
import {
  matchesTargetFilter,
  getEffectiveStats,
  collectApplicableAbilities,
  getGroupEffectiveStats,
  matchesOwnershipCondition,
  countMatchingCardsForCost,
  getEffectiveDeployCost,
  matchesGrantedSkillTarget,
  getGrantedSkillsForPersonnel,
  getDilemmaGrantedSkills,
} from "./abilities";
import type { PersonnelCard, ShipCard } from "../types";
import type { Ability, CostModifierEffect, TargetFilter } from "../types";
import type { GrantedSkill } from "../types";

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
    expect(applicable[0]!.ability.id).toBe("opposition-drone-strength-boost");
    expect(applicable[0]!.sourceCard).toBe(source);
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

// Acclimation Drone ability for testing cost modifiers
const acclimationDroneAbility: Ability = {
  id: "acclimation-drone-cost-reduction",
  trigger: "whilePlaying",
  target: {
    scope: "self",
  },
  effects: [
    {
      type: "costModifier",
      value: -1,
      perMatchingCard: {
        cardTypes: ["Personnel"],
        ownership: "commandedNotOwned",
      },
    },
  ],
};

describe("matchesOwnershipCondition", () => {
  it("returns true for commanded when card is in play", () => {
    const card = createPersonnel();
    expect(matchesOwnershipCondition(card, "commanded", "player1")).toBe(true);
  });

  it("returns true for owned when ownerId matches player", () => {
    const card = createPersonnel({ ownerId: "player1" });
    expect(matchesOwnershipCondition(card, "owned", "player1")).toBe(true);
  });

  it("returns true for owned when ownerId is undefined (solitaire default)", () => {
    const card = createPersonnel({ ownerId: undefined });
    expect(matchesOwnershipCondition(card, "owned", "player1")).toBe(true);
  });

  it("returns false for owned when ownerId differs", () => {
    const card = createPersonnel({ ownerId: "player2" });
    expect(matchesOwnershipCondition(card, "owned", "player1")).toBe(false);
  });

  it("returns false for commandedNotOwned in solitaire (player owns all)", () => {
    const card = createPersonnel({ ownerId: undefined });
    expect(
      matchesOwnershipCondition(card, "commandedNotOwned", "player1")
    ).toBe(false);
  });

  it("returns true for commandedNotOwned when card is from opponent", () => {
    const card = createPersonnel({ ownerId: "player2" });
    expect(
      matchesOwnershipCondition(card, "commandedNotOwned", "player1")
    ).toBe(true);
  });
});

describe("countMatchingCardsForCost", () => {
  it("returns 1 when no perMatchingCard filter", () => {
    const effect: CostModifierEffect = {
      type: "costModifier",
      value: -2,
    };
    const count = countMatchingCardsForCost([], effect, "player1");
    expect(count).toBe(1);
  });

  it("counts personnel matching commandedNotOwned", () => {
    const opponentCard1 = createPersonnel({
      uniqueId: "opp-1",
      ownerId: "player2",
    });
    const opponentCard2 = createPersonnel({
      uniqueId: "opp-2",
      ownerId: "player2",
    });
    const ownCard = createPersonnel({ uniqueId: "own-1", ownerId: "player1" });

    const effect: CostModifierEffect = {
      type: "costModifier",
      value: -1,
      perMatchingCard: {
        cardTypes: ["Personnel"],
        ownership: "commandedNotOwned",
      },
    };

    const count = countMatchingCardsForCost(
      [opponentCard1, opponentCard2, ownCard],
      effect,
      "player1"
    );
    expect(count).toBe(2); // Only opponent cards count
  });

  it("filters by card type", () => {
    const personnel = createPersonnel({ ownerId: "player2" });
    const ship = createShip({ ownerId: "player2" });

    const effect: CostModifierEffect = {
      type: "costModifier",
      value: -1,
      perMatchingCard: {
        cardTypes: ["Personnel"],
        ownership: "commandedNotOwned",
      },
    };

    const count = countMatchingCardsForCost(
      [personnel, ship],
      effect,
      "player1"
    );
    expect(count).toBe(1); // Only personnel counts
  });

  it("returns 0 when no matching cards in solitaire", () => {
    // In solitaire, all cards are owned by player1
    const card1 = createPersonnel({ ownerId: undefined });
    const card2 = createPersonnel({ ownerId: "player1" });

    const effect: CostModifierEffect = {
      type: "costModifier",
      value: -1,
      perMatchingCard: {
        cardTypes: ["Personnel"],
        ownership: "commandedNotOwned",
      },
    };

    const count = countMatchingCardsForCost([card1, card2], effect, "player1");
    expect(count).toBe(0); // No opponent cards in solitaire
  });
});

describe("getEffectiveDeployCost", () => {
  it("returns base cost when no abilities", () => {
    const personnel = createPersonnel({ deploy: 3 });
    const cost = getEffectiveDeployCost(personnel, [], "player1");
    expect(cost).toBe(3);
  });

  it("returns base cost when no whilePlaying abilities", () => {
    const personnel = createPersonnel({
      deploy: 3,
      abilities: [oppositionDroneAbility], // passive, not whilePlaying
    });
    const cost = getEffectiveDeployCost(personnel, [], "player1");
    expect(cost).toBe(3);
  });

  it("reduces cost based on commandedNotOwned personnel", () => {
    const acclimationDrone = createPersonnel({
      uniqueId: "accl-1",
      deploy: 2,
      abilities: [acclimationDroneAbility],
    });

    // Two opponent personnel in play
    const opponentCard1 = createPersonnel({
      uniqueId: "opp-1",
      ownerId: "player2",
    });
    const opponentCard2 = createPersonnel({
      uniqueId: "opp-2",
      ownerId: "player2",
    });

    const cost = getEffectiveDeployCost(
      acclimationDrone,
      [opponentCard1, opponentCard2],
      "player1"
    );
    expect(cost).toBe(0); // 2 - 1 - 1 = 0
  });

  it("cost cannot go below 0", () => {
    const acclimationDrone = createPersonnel({
      uniqueId: "accl-1",
      deploy: 2,
      abilities: [acclimationDroneAbility],
    });

    // Five opponent personnel - would make cost -3, but clamped to 0
    const opponentCards = Array.from({ length: 5 }, (_, i) =>
      createPersonnel({ uniqueId: `opp-${i}`, ownerId: "player2" })
    );

    const cost = getEffectiveDeployCost(
      acclimationDrone,
      opponentCards,
      "player1"
    );
    expect(cost).toBe(0); // Clamped to 0
  });

  it("does not reduce cost in solitaire (no commandedNotOwned cards)", () => {
    const acclimationDrone = createPersonnel({
      uniqueId: "accl-1",
      deploy: 2,
      abilities: [acclimationDroneAbility],
    });

    // All cards owned by player1 (solitaire)
    const ownCards = [
      createPersonnel({ uniqueId: "own-1", ownerId: "player1" }),
      createPersonnel({ uniqueId: "own-2", ownerId: undefined }),
    ];

    const cost = getEffectiveDeployCost(acclimationDrone, ownCards, "player1");
    expect(cost).toBe(2); // No reduction in solitaire
  });

  it("handles ships with cost modifiers", () => {
    const ship = createShip({ deploy: 4 });
    // Ships don't have abilities currently, but should still return base cost
    const cost = getEffectiveDeployCost(ship, [], "player1");
    expect(cost).toBe(4);
  });
});

describe("matchesGrantedSkillTarget", () => {
  it("matches when no filters specified", () => {
    const personnel = createPersonnel();
    const filter: TargetFilter = { scope: "allInPlay" };

    expect(matchesGrantedSkillTarget(personnel, filter)).toBe(true);
  });

  it("matches species filter", () => {
    const borgPersonnel = createPersonnel({ species: ["Borg"] });
    const humanPersonnel = createPersonnel({ species: ["Human"] });
    const filter: TargetFilter = { scope: "allInPlay", species: ["Borg"] };

    expect(matchesGrantedSkillTarget(borgPersonnel, filter)).toBe(true);
    expect(matchesGrantedSkillTarget(humanPersonnel, filter)).toBe(false);
  });

  it("matches affiliation filter", () => {
    const borgPersonnel = createPersonnel({ affiliation: ["Borg"] });
    const fedPersonnel = createPersonnel({ affiliation: ["Federation"] });
    const filter: TargetFilter = { scope: "allInPlay", affiliations: ["Borg"] };

    expect(matchesGrantedSkillTarget(borgPersonnel, filter)).toBe(true);
    expect(matchesGrantedSkillTarget(fedPersonnel, filter)).toBe(false);
  });

  it("matches card type filter", () => {
    const personnel = createPersonnel();
    const filter: TargetFilter = {
      scope: "allInPlay",
      cardTypes: ["Personnel"],
    };

    expect(matchesGrantedSkillTarget(personnel, filter)).toBe(true);
  });

  it("combines multiple filters with AND logic", () => {
    const personnel = createPersonnel({
      species: ["Borg"],
      affiliation: ["Borg"],
    });
    const filter: TargetFilter = {
      scope: "allInPlay",
      species: ["Borg"],
      affiliations: ["Borg"],
    };

    expect(matchesGrantedSkillTarget(personnel, filter)).toBe(true);
  });
});

describe("getGrantedSkillsForPersonnel", () => {
  it("returns empty array when no granted skills", () => {
    const personnel = createPersonnel({ species: ["Borg"] });
    const skills = getGrantedSkillsForPersonnel(personnel, []);
    expect(skills).toEqual([]);
  });

  it("returns granted skill when personnel matches target", () => {
    const personnel = createPersonnel({ species: ["Borg"] });
    const grantedSkill: GrantedSkill = {
      skill: "Navigation",
      target: { scope: "allInPlay", species: ["Borg"] },
      duration: "untilEndOfTurn",
      sourceCardId: "source-1",
      sourceAbilityId: "ability-1",
    };

    const skills = getGrantedSkillsForPersonnel(personnel, [grantedSkill]);
    expect(skills).toEqual(["Navigation"]);
  });

  it("does not return granted skill when personnel does not match target", () => {
    const humanPersonnel = createPersonnel({ species: ["Human"] });
    const grantedSkill: GrantedSkill = {
      skill: "Navigation",
      target: { scope: "allInPlay", species: ["Borg"] },
      duration: "untilEndOfTurn",
      sourceCardId: "source-1",
      sourceAbilityId: "ability-1",
    };

    const skills = getGrantedSkillsForPersonnel(humanPersonnel, [grantedSkill]);
    expect(skills).toEqual([]);
  });

  it("returns multiple granted skills from different sources", () => {
    const personnel = createPersonnel({ species: ["Borg"] });
    const grant1: GrantedSkill = {
      skill: "Navigation",
      target: { scope: "allInPlay", species: ["Borg"] },
      duration: "untilEndOfTurn",
      sourceCardId: "source-1",
      sourceAbilityId: "ability-1",
    };
    const grant2: GrantedSkill = {
      skill: "Engineer",
      target: { scope: "allInPlay", species: ["Borg"] },
      duration: "untilEndOfTurn",
      sourceCardId: "source-2",
      sourceAbilityId: "ability-2",
    };

    const skills = getGrantedSkillsForPersonnel(personnel, [grant1, grant2]);
    expect(skills).toContain("Navigation");
    expect(skills).toContain("Engineer");
    expect(skills).toHaveLength(2);
  });

  it("ignores grants with non-allInPlay scope", () => {
    const personnel = createPersonnel({ species: ["Borg"] });
    const grantedSkill: GrantedSkill = {
      skill: "Navigation",
      target: { scope: "present", species: ["Borg"] }, // Not allInPlay
      duration: "untilEndOfTurn",
      sourceCardId: "source-1",
      sourceAbilityId: "ability-1",
    };

    // Currently, only allInPlay scope is supported for granted skills
    const skills = getGrantedSkillsForPersonnel(personnel, [grantedSkill]);
    expect(skills).toEqual([]);
  });
});

describe("calculateGroupStats with granted skills", () => {
  it("includes granted skills in skill counts", async () => {
    const { calculateGroupStats } = await import("./missionChecker");

    const borg1 = createPersonnel({
      uniqueId: "borg-1",
      species: ["Borg"],
      skills: [["Engineer"]],
    });

    const borg2 = createPersonnel({
      uniqueId: "borg-2",
      species: ["Borg"],
      skills: [["Science"]],
    });

    const grantedSkill: GrantedSkill = {
      skill: "Navigation",
      target: { scope: "allInPlay", species: ["Borg"] },
      duration: "untilEndOfTurn",
      sourceCardId: "queen-1",
      sourceAbilityId: "borg-queen-skill-grant",
    };

    const stats = calculateGroupStats([borg1, borg2], [grantedSkill]);

    // Each Borg should have their base skill + Navigation
    expect(stats.skills["Engineer"]).toBe(1);
    expect(stats.skills["Science"]).toBe(1);
    expect(stats.skills["Navigation"]).toBe(2); // Both Borg get Navigation
  });

  it("does not grant skills to non-matching personnel", async () => {
    const { calculateGroupStats } = await import("./missionChecker");

    const borg = createPersonnel({
      uniqueId: "borg-1",
      species: ["Borg"],
      skills: [],
    });

    const human = createPersonnel({
      uniqueId: "human-1",
      species: ["Human"],
      skills: [],
    });

    const grantedSkill: GrantedSkill = {
      skill: "Navigation",
      target: { scope: "allInPlay", species: ["Borg"] },
      duration: "untilEndOfTurn",
      sourceCardId: "queen-1",
      sourceAbilityId: "borg-queen-skill-grant",
    };

    const stats = calculateGroupStats([borg, human], [grantedSkill]);

    // Only Borg gets Navigation
    expect(stats.skills["Navigation"]).toBe(1);
  });

  it("stacks granted skill with base skill", async () => {
    const { calculateGroupStats } = await import("./missionChecker");

    const borg = createPersonnel({
      uniqueId: "borg-1",
      species: ["Borg"],
      skills: [["Navigation"]], // Already has Navigation
    });

    const grantedSkill: GrantedSkill = {
      skill: "Navigation",
      target: { scope: "allInPlay", species: ["Borg"] },
      duration: "untilEndOfTurn",
      sourceCardId: "queen-1",
      sourceAbilityId: "borg-queen-skill-grant",
    };

    const stats = calculateGroupStats([borg], [grantedSkill]);

    // Borg has Navigation from base + Navigation from grant = 2
    expect(stats.skills["Navigation"]).toBe(2);
  });
});

// Seven of Nine ability for testing whileFacingDilemma
const sevenOfNineAbility: Ability = {
  id: "seven-of-nine-dilemma-boost",
  trigger: "whileFacingDilemma",
  target: { scope: "self" },
  effects: [
    {
      type: "statModifier",
      stat: "strength",
      value: 2,
    },
    {
      type: "skillGrant",
      skill: "Security",
    },
  ],
};

describe("whileFacingDilemma abilities", () => {
  it("does not apply strength bonus outside dilemma context", () => {
    const sevenOfNine = createPersonnel({
      uniqueId: "seven-1",
      name: "Seven of Nine",
      species: ["Borg"],
      strength: 6,
      abilities: [sevenOfNineAbility],
    });

    // Without dilemma context
    const stats = getEffectiveStats(sevenOfNine, [sevenOfNine]);
    expect(stats.strength).toBe(6); // unchanged
  });

  it("applies strength bonus during dilemma context", () => {
    const sevenOfNine = createPersonnel({
      uniqueId: "seven-1",
      name: "Seven of Nine",
      species: ["Borg"],
      strength: 6,
      abilities: [sevenOfNineAbility],
    });

    // With dilemma context
    const stats = getEffectiveStats(sevenOfNine, [sevenOfNine], {
      isFacingDilemma: true,
    });
    expect(stats.strength).toBe(8); // 6 + 2
  });

  it("does not apply to other personnel (scope: self)", () => {
    const sevenOfNine = createPersonnel({
      uniqueId: "seven-1",
      name: "Seven of Nine",
      species: ["Borg"],
      strength: 6,
      abilities: [sevenOfNineAbility],
    });

    const otherBorg = createPersonnel({
      uniqueId: "other-1",
      name: "Other Borg",
      species: ["Borg"],
      strength: 5,
    });

    // Other personnel should NOT get the bonus
    const otherStats = getEffectiveStats(otherBorg, [sevenOfNine, otherBorg], {
      isFacingDilemma: true,
    });
    expect(otherStats.strength).toBe(5); // unchanged
  });

  it("collectApplicableAbilities includes whileFacingDilemma abilities in dilemma context", () => {
    const sevenOfNine = createPersonnel({
      uniqueId: "seven-1",
      name: "Seven of Nine",
      species: ["Borg"],
      abilities: [sevenOfNineAbility],
    });

    // Without context
    const abilitiesNoContext = collectApplicableAbilities(sevenOfNine, [
      sevenOfNine,
    ]);
    expect(abilitiesNoContext).toHaveLength(0);

    // With dilemma context
    const abilitiesWithContext = collectApplicableAbilities(
      sevenOfNine,
      [sevenOfNine],
      { isFacingDilemma: true }
    );
    expect(abilitiesWithContext).toHaveLength(1);
    expect(abilitiesWithContext[0]!.ability.id).toBe(
      "seven-of-nine-dilemma-boost"
    );
  });
});

describe("getDilemmaGrantedSkills", () => {
  it("returns empty array when no whileFacingDilemma abilities", () => {
    const personnel = createPersonnel({ species: ["Borg"] });
    const skills = getDilemmaGrantedSkills(personnel, [personnel]);
    expect(skills).toEqual([]);
  });

  it("returns granted skill from whileFacingDilemma ability targeting self", () => {
    const sevenOfNine = createPersonnel({
      uniqueId: "seven-1",
      name: "Seven of Nine",
      species: ["Borg"],
      abilities: [sevenOfNineAbility],
    });

    const skills = getDilemmaGrantedSkills(sevenOfNine, [sevenOfNine]);
    expect(skills).toContain("Security");
  });

  it("does not grant skill to non-self targets for self-scoped ability", () => {
    const sevenOfNine = createPersonnel({
      uniqueId: "seven-1",
      name: "Seven of Nine",
      species: ["Borg"],
      abilities: [sevenOfNineAbility],
    });

    const otherBorg = createPersonnel({
      uniqueId: "other-1",
      name: "Other Borg",
      species: ["Borg"],
    });

    // Other Borg should NOT get Security from Seven's ability
    const skills = getDilemmaGrantedSkills(otherBorg, [sevenOfNine, otherBorg]);
    expect(skills).not.toContain("Security");
  });

  it("returns skills from present-scoped whileFacingDilemma abilities", () => {
    const groupAbility: Ability = {
      id: "group-dilemma-skill",
      trigger: "whileFacingDilemma",
      target: { scope: "present", species: ["Borg"] },
      effects: [{ type: "skillGrant", skill: "Diplomacy" }],
    };

    const source = createPersonnel({
      uniqueId: "source-1",
      species: ["Borg"],
      abilities: [groupAbility],
    });

    const target = createPersonnel({
      uniqueId: "target-1",
      species: ["Borg"],
    });

    const skills = getDilemmaGrantedSkills(target, [source, target]);
    expect(skills).toContain("Diplomacy");
  });
});

describe("calculateGroupStats with dilemma context", () => {
  it("includes whileFacingDilemma stat bonuses in dilemma context", async () => {
    const { calculateGroupStats } = await import("./missionChecker");

    const sevenOfNine = createPersonnel({
      uniqueId: "seven-1",
      name: "Seven of Nine",
      species: ["Borg"],
      strength: 6,
      skills: [["Engineer"]],
      abilities: [sevenOfNineAbility],
    });

    const otherBorg = createPersonnel({
      uniqueId: "other-1",
      species: ["Borg"],
      strength: 5,
      skills: [["Science"]],
    });

    // Without dilemma context: 6 + 5 = 11
    const statsNoContext = calculateGroupStats([sevenOfNine, otherBorg]);
    expect(statsNoContext.strength).toBe(11);

    // With dilemma context: (6 + 2) + 5 = 13
    const statsWithContext = calculateGroupStats([sevenOfNine, otherBorg], [], {
      isFacingDilemma: true,
    });
    expect(statsWithContext.strength).toBe(13);
  });

  it("includes whileFacingDilemma skill grants in dilemma context", async () => {
    const { calculateGroupStats } = await import("./missionChecker");

    const sevenOfNine = createPersonnel({
      uniqueId: "seven-1",
      name: "Seven of Nine",
      species: ["Borg"],
      skills: [["Engineer"]],
      abilities: [sevenOfNineAbility],
    });

    // Without dilemma context: Engineer only
    const statsNoContext = calculateGroupStats([sevenOfNine]);
    expect(statsNoContext.skills["Engineer"]).toBe(1);
    expect(statsNoContext.skills["Security"]).toBeUndefined();

    // With dilemma context: Engineer + Security
    const statsWithContext = calculateGroupStats([sevenOfNine], [], {
      isFacingDilemma: true,
    });
    expect(statsWithContext.skills["Engineer"]).toBe(1);
    expect(statsWithContext.skills["Security"]).toBe(1);
  });

  it("combines passive and whileFacingDilemma abilities in dilemma context", async () => {
    const { calculateGroupStats } = await import("./missionChecker");

    const sevenOfNine = createPersonnel({
      uniqueId: "seven-1",
      name: "Seven of Nine",
      species: ["Borg"],
      strength: 6,
      abilities: [sevenOfNineAbility],
    });

    const oppositionDrone = createPersonnel({
      uniqueId: "opp-1",
      name: "Opposition Drone",
      species: ["Borg"],
      strength: 6,
      abilities: [oppositionDroneAbility],
    });

    // In dilemma context:
    // Seven: 6 base + 2 (dilemma) + 1 (Opposition Drone passive) = 9
    // Opposition Drone: 6 base (no bonus, self excluded)
    // Total: 9 + 6 = 15
    const stats = calculateGroupStats([sevenOfNine, oppositionDrone], [], {
      isFacingDilemma: true,
    });
    expect(stats.strength).toBe(15);
  });
});
