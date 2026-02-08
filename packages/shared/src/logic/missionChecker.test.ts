import { describe, it, expect } from "vitest";
import {
  calculateGroupStats,
  formatGroupStats,
  checkMission,
  countUnstoppedPersonnel,
  areAllPersonnelStopped,
  findPersonnelWithSkill,
  hasSkillCount,
  getAttributeTotal,
} from "./missionChecker";
import type { PersonnelCard, MissionCard, ShipCard } from "../types";

// Test fixtures
const createPersonnel = (
  overrides: Partial<PersonnelCard> = {}
): PersonnelCard => ({
  id: "EN00001",
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

const createMission = (overrides: Partial<MissionCard> = {}): MissionCard => ({
  id: "EN00002",
  name: "Test Mission",
  type: "Mission",
  unique: false,
  jpg: "/cards/mission.jpg",
  missionType: "Planet",
  quadrant: "Alpha",
  range: 3,
  completed: false,
  score: 35,
  skills: [["Navigation", "Engineer"]],
  attribute: "Cunning",
  value: 30,
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

describe("calculateGroupStats", () => {
  it("returns zero stats for empty array", () => {
    const stats = calculateGroupStats([]);
    expect(stats.unstoppedPersonnel).toBe(0);
    expect(stats.integrity).toBe(0);
    expect(stats.cunning).toBe(0);
    expect(stats.strength).toBe(0);
    expect(Object.keys(stats.skills)).toHaveLength(0);
  });

  it("sums attributes from unstopped personnel", () => {
    const personnel = [
      createPersonnel({ integrity: 5, cunning: 6, strength: 7 }),
      createPersonnel({ integrity: 3, cunning: 4, strength: 5 }),
    ];

    const stats = calculateGroupStats(personnel);
    expect(stats.unstoppedPersonnel).toBe(2);
    expect(stats.integrity).toBe(8);
    expect(stats.cunning).toBe(10);
    expect(stats.strength).toBe(12);
  });

  it("ignores stopped personnel", () => {
    const personnel = [
      createPersonnel({ integrity: 5, cunning: 6, strength: 7 }),
      createPersonnel({
        integrity: 3,
        cunning: 4,
        strength: 5,
        status: "Stopped",
      }),
    ];

    const stats = calculateGroupStats(personnel);
    expect(stats.unstoppedPersonnel).toBe(1);
    expect(stats.integrity).toBe(5);
    expect(stats.cunning).toBe(6);
    expect(stats.strength).toBe(7);
  });

  it("counts skills from nested arrays", () => {
    const personnel = [
      createPersonnel({ skills: [["Navigation"], ["Engineer"]] }),
      createPersonnel({ skills: [["Navigation", "Science"]] }),
    ];

    const stats = calculateGroupStats(personnel);
    expect(stats.skills.Navigation).toBe(2);
    expect(stats.skills.Engineer).toBe(1);
    expect(stats.skills.Science).toBe(1);
  });

  it("ignores non-personnel cards", () => {
    const cards = [createPersonnel(), createShip()];

    const stats = calculateGroupStats(cards);
    expect(stats.unstoppedPersonnel).toBe(1);
  });
});

describe("formatGroupStats", () => {
  it("formats stats for display (pretty)", () => {
    const stats = {
      unstoppedPersonnel: 2,
      integrity: 10,
      cunning: 12,
      strength: 8,
      skills: { Navigation: 2, Engineer: 1 },
    };

    const result = formatGroupStats(stats, true);
    expect(result).toContain("Unstopped Personnel: 2<br/><br/>");
    expect(result).toContain("Integrity: 10");
    expect(result).toContain("Cunning: 12");
    expect(result).toContain("Strength: 8");
    expect(result).toContain("Engineer: 1");
    expect(result).toContain("Navigation: 2");
  });

  it("formats stats for display (compact)", () => {
    const stats = {
      unstoppedPersonnel: 2,
      integrity: 10,
      cunning: 12,
      strength: 8,
      skills: { Navigation: 1 },
    };

    const result = formatGroupStats(stats, false);
    expect(result).not.toContain("<br/>");
    expect(result).toContain("Unstopped Personnel: 2");
  });
});

describe("checkMission", () => {
  it("returns false for mission without requirements", () => {
    const mission = createMission({ skills: [] });
    const personnel = [createPersonnel({ skills: [["Navigation"]] })];

    expect(checkMission(personnel, mission)).toBe(false);
  });

  it("returns true when all skill requirements met", () => {
    const mission = createMission({
      skills: [["Navigation", "Engineer"]],
      attribute: "Cunning",
      value: 10,
    });

    const personnel = [
      createPersonnel({ skills: [["Navigation"]], cunning: 6 }),
      createPersonnel({ skills: [["Engineer"]], cunning: 6 }),
    ];

    expect(checkMission(personnel, mission)).toBe(true);
  });

  it("returns false when skill requirements not met", () => {
    const mission = createMission({
      skills: [["Navigation", "Engineer"]],
      attribute: "Cunning",
      value: 10,
    });

    const personnel = [
      createPersonnel({ skills: [["Navigation"]], cunning: 6 }),
    ];

    expect(checkMission(personnel, mission)).toBe(false);
  });

  it("returns false when attribute threshold not exceeded", () => {
    const mission = createMission({
      skills: [["Navigation"]],
      attribute: "Cunning",
      value: 10,
    });

    const personnel = [
      createPersonnel({ skills: [["Navigation"]], cunning: 10 }),
    ];

    // Must EXCEED the value, not just equal it
    expect(checkMission(personnel, mission)).toBe(false);
  });

  it("returns true when attribute threshold exceeded", () => {
    const mission = createMission({
      skills: [["Navigation"]],
      attribute: "Cunning",
      value: 10,
    });

    const personnel = [
      createPersonnel({ skills: [["Navigation"]], cunning: 11 }),
    ];

    expect(checkMission(personnel, mission)).toBe(true);
  });

  it("handles alternative skill requirements (OR)", () => {
    const mission = createMission({
      skills: [
        ["Navigation", "Navigation", "Engineer"],
        ["Science", "Medical"],
      ],
      attribute: "Cunning",
      value: 5,
    });

    // This personnel can't meet first requirement (needs 2x Navigation)
    // but CAN meet second requirement
    const personnel = [
      createPersonnel({ skills: [["Science"]], cunning: 4 }),
      createPersonnel({ skills: [["Medical"]], cunning: 4 }),
    ];

    expect(checkMission(personnel, mission)).toBe(true);
  });

  it("ignores stopped personnel", () => {
    const mission = createMission({
      skills: [["Navigation", "Engineer"]],
      attribute: "Cunning",
      value: 10,
    });

    const personnel = [
      createPersonnel({ skills: [["Navigation"]], cunning: 6 }),
      createPersonnel({
        skills: [["Engineer"]],
        cunning: 6,
        status: "Stopped",
      }),
    ];

    expect(checkMission(personnel, mission)).toBe(false);
  });
});

describe("countUnstoppedPersonnel", () => {
  it("counts only unstopped personnel", () => {
    const cards = [
      createPersonnel({ status: "Unstopped" }),
      createPersonnel({ status: "Stopped" }),
      createPersonnel({ status: "Unstopped" }),
      createShip(),
    ];

    expect(countUnstoppedPersonnel(cards)).toBe(2);
  });
});

describe("areAllPersonnelStopped", () => {
  it("returns true when all personnel stopped", () => {
    const cards = [
      createPersonnel({ status: "Stopped" }),
      createPersonnel({ status: "Killed" }),
      createShip(),
    ];

    expect(areAllPersonnelStopped(cards)).toBe(true);
  });

  it("returns false when any personnel unstopped", () => {
    const cards = [
      createPersonnel({ status: "Stopped" }),
      createPersonnel({ status: "Unstopped" }),
    ];

    expect(areAllPersonnelStopped(cards)).toBe(false);
  });

  it("returns true for empty array", () => {
    expect(areAllPersonnelStopped([])).toBe(true);
  });
});

describe("findPersonnelWithSkill", () => {
  it("finds personnel with specified skill", () => {
    const nav1 = createPersonnel({ name: "Nav1", skills: [["Navigation"]] });
    const nav2 = createPersonnel({
      name: "Nav2",
      skills: [["Navigation", "Engineer"]],
    });
    const eng = createPersonnel({ name: "Eng", skills: [["Engineer"]] });

    const result = findPersonnelWithSkill([nav1, nav2, eng], "Navigation");
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.name)).toContain("Nav1");
    expect(result.map((p) => p.name)).toContain("Nav2");
  });

  it("ignores stopped personnel", () => {
    const cards = [
      createPersonnel({ skills: [["Navigation"]], status: "Unstopped" }),
      createPersonnel({ skills: [["Navigation"]], status: "Stopped" }),
    ];

    expect(findPersonnelWithSkill(cards, "Navigation")).toHaveLength(1);
  });
});

describe("hasSkillCount", () => {
  it("returns true when skill count met", () => {
    const cards = [
      createPersonnel({ skills: [["Navigation"]] }),
      createPersonnel({ skills: [["Navigation"]] }),
    ];

    expect(hasSkillCount(cards, "Navigation", 2)).toBe(true);
  });

  it("returns false when skill count not met", () => {
    const cards = [createPersonnel({ skills: [["Navigation"]] })];

    expect(hasSkillCount(cards, "Navigation", 2)).toBe(false);
  });
});

describe("getAttributeTotal", () => {
  it("returns correct totals for each attribute", () => {
    const cards = [
      createPersonnel({ integrity: 5, cunning: 6, strength: 7 }),
      createPersonnel({ integrity: 3, cunning: 4, strength: 5 }),
    ];

    expect(getAttributeTotal(cards, "Integrity")).toBe(8);
    expect(getAttributeTotal(cards, "Cunning")).toBe(10);
    expect(getAttributeTotal(cards, "Strength")).toBe(12);
  });
});
