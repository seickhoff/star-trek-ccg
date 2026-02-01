import { describe, it, expect } from "vitest";
import {
  checkStaffed,
  calculateRangeCost,
  checkRange,
  getValidDestinations,
  moveShip,
  resetShipRange,
} from "./shipMovement";
import type { PersonnelCard, MissionCard, ShipCard } from "../types/card";

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
  missionType: "Space",
  quadrant: "Alpha",
  range: 3,
  completed: false,
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

describe("checkStaffed", () => {
  it("returns false for empty array", () => {
    expect(checkStaffed([])).toBe(false);
  });

  it("returns false if first card is not a ship", () => {
    const personnel = createPersonnel();
    expect(checkStaffed([personnel])).toBe(false);
  });

  it("returns true for ship with no staffing requirements", () => {
    const ship = createShip({ staffing: [[]] });
    expect(checkStaffed([ship])).toBe(true);
  });

  it("returns false when Staff requirements not met", () => {
    const ship = createShip({ staffing: [["Staff"]] });
    // No crew
    expect(checkStaffed([ship])).toBe(false);
  });

  it("returns true when Staff requirements met", () => {
    const ship = createShip({ staffing: [["Staff"]] });
    const staff = createPersonnel({ other: ["Staff"] });
    expect(checkStaffed([ship, staff])).toBe(true);
  });

  it("returns false when Command requirements not met", () => {
    const ship = createShip({ staffing: [["Command"]] });
    const staff = createPersonnel({ other: ["Staff"] });
    expect(checkStaffed([ship, staff])).toBe(false);
  });

  it("returns true when Command requirements met", () => {
    const ship = createShip({ staffing: [["Command"]] });
    const command = createPersonnel({ other: ["Command"] });
    expect(checkStaffed([ship, command])).toBe(true);
  });

  it("allows Command to count as Staff", () => {
    const ship = createShip({ staffing: [["Staff", "Staff"]] });
    const command = createPersonnel({ other: ["Command"] });
    const staff = createPersonnel({ other: ["Staff"] });
    expect(checkStaffed([ship, command, staff])).toBe(true);
  });

  it("requires all Command slots filled before overflow to Staff", () => {
    const ship = createShip({ staffing: [["Command", "Staff"]] });
    const command = createPersonnel({ other: ["Command"] });
    const staff = createPersonnel({ other: ["Staff"] });
    expect(checkStaffed([ship, command, staff])).toBe(true);
  });

  it("fails when Command not met even if Staff is met", () => {
    const ship = createShip({ staffing: [["Command", "Staff"]] });
    const staff1 = createPersonnel({ other: ["Staff"] });
    const staff2 = createPersonnel({ other: ["Staff"] });
    expect(checkStaffed([ship, staff1, staff2])).toBe(false);
  });

  it("ignores stopped personnel", () => {
    const ship = createShip({ staffing: [["Staff"]] });
    const stoppedStaff = createPersonnel({
      other: ["Staff"],
      status: "Stopped",
    });
    expect(checkStaffed([ship, stoppedStaff])).toBe(false);
  });

  it("handles multiple staffing requirements", () => {
    const ship = createShip({ staffing: [["Command", "Command", "Staff"]] });
    const cmd1 = createPersonnel({ other: ["Command"] });
    const cmd2 = createPersonnel({ other: ["Command"] });
    const staff = createPersonnel({ other: ["Staff"] });
    expect(checkStaffed([ship, cmd1, cmd2, staff])).toBe(true);
  });
});

describe("calculateRangeCost", () => {
  it("sums range of both missions", () => {
    const source = createMission({ range: 3 });
    const dest = createMission({ range: 4 });
    expect(calculateRangeCost(source, dest)).toBe(7);
  });

  it("adds 2 for crossing quadrants", () => {
    const source = createMission({ range: 3, quadrant: "Alpha" });
    const dest = createMission({ range: 4, quadrant: "Delta" });
    expect(calculateRangeCost(source, dest)).toBe(9);
  });

  it("no penalty for same quadrant", () => {
    const source = createMission({ range: 3, quadrant: "Alpha" });
    const dest = createMission({ range: 4, quadrant: "Alpha" });
    expect(calculateRangeCost(source, dest)).toBe(7);
  });
});

describe("checkRange", () => {
  it("returns true when ship has enough range", () => {
    const ship = createShip({ rangeRemaining: 10 });
    const source = createMission({ range: 3 });
    const dest = createMission({ range: 4 });
    expect(checkRange(ship, source, dest)).toBe(true);
  });

  it("returns false when ship lacks range", () => {
    const ship = createShip({ rangeRemaining: 5 });
    const source = createMission({ range: 3 });
    const dest = createMission({ range: 4 });
    expect(checkRange(ship, source, dest)).toBe(false);
  });

  it("returns true when range exactly equals cost", () => {
    const ship = createShip({ rangeRemaining: 7 });
    const source = createMission({ range: 3 });
    const dest = createMission({ range: 4 });
    expect(checkRange(ship, source, dest)).toBe(true);
  });
});

describe("getValidDestinations", () => {
  it("returns empty for unstaffed ship", () => {
    const ship = createShip({ staffing: [["Staff"]] });
    const current = createMission({ id: "M1" });
    const missions = [current, createMission({ id: "M2", range: 2 })];

    expect(getValidDestinations([ship], current, missions)).toEqual([]);
  });

  it("excludes current mission", () => {
    const ship = createShip({ staffing: [[]], rangeRemaining: 100 });
    const current = createMission({ id: "M1" });
    const missions = [current, createMission({ id: "M2", range: 2 })];

    const result = getValidDestinations([ship], current, missions);
    expect(result.map((m) => m.id)).not.toContain("M1");
    expect(result.map((m) => m.id)).toContain("M2");
  });

  it("excludes missions out of range", () => {
    const ship = createShip({ staffing: [[]], rangeRemaining: 5 });
    const current = createMission({ id: "M1", range: 2 });
    const nearMission = createMission({ id: "M2", range: 2 });
    const farMission = createMission({ id: "M3", range: 10 });

    const result = getValidDestinations([ship], current, [
      current,
      nearMission,
      farMission,
    ]);

    expect(result.map((m) => m.id)).toContain("M2");
    expect(result.map((m) => m.id)).not.toContain("M3");
  });
});

describe("moveShip", () => {
  it("returns ship with reduced range on success", () => {
    const ship = createShip({ rangeRemaining: 10 });
    const source = createMission({ range: 3 });
    const dest = createMission({ range: 4 });

    const result = moveShip(ship, source, dest);
    expect(result).not.toBeNull();
    expect(result!.rangeRemaining).toBe(3);
  });

  it("returns null when insufficient range", () => {
    const ship = createShip({ rangeRemaining: 5 });
    const source = createMission({ range: 3 });
    const dest = createMission({ range: 4 });

    expect(moveShip(ship, source, dest)).toBeNull();
  });

  it("does not mutate original ship", () => {
    const ship = createShip({ rangeRemaining: 10 });
    const source = createMission({ range: 3 });
    const dest = createMission({ range: 4 });

    moveShip(ship, source, dest);
    expect(ship.rangeRemaining).toBe(10);
  });
});

describe("resetShipRange", () => {
  it("resets rangeRemaining to base range", () => {
    const ship = createShip({ range: 8, rangeRemaining: 2 });
    const result = resetShipRange(ship);
    expect(result.rangeRemaining).toBe(8);
  });

  it("does not mutate original ship", () => {
    const ship = createShip({ range: 8, rangeRemaining: 2 });
    resetShipRange(ship);
    expect(ship.rangeRemaining).toBe(2);
  });
});
