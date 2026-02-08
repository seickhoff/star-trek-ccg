import type { Card, MissionCard, PersonnelCard, ShipCard } from "@stccg/shared";
import { isPersonnel, isShip } from "@stccg/shared";

/**
 * Staffing requirement counts
 */
interface StaffingCounts {
  staff: number;
  command: number;
}

/**
 * Calculate staffing requirements from a ship's staffing icons
 */
function getStaffingRequirements(ship: ShipCard): StaffingCounts {
  const requirements: StaffingCounts = { staff: 0, command: 0 };

  const staffingIcons = ship.staffing?.[0];
  if (staffingIcons) {
    for (const icon of staffingIcons) {
      if (icon === "Staff") {
        requirements.staff++;
      } else if (icon === "Command") {
        requirements.command++;
      }
    }
  }

  return requirements;
}

/**
 * Count staffing icons provided by personnel
 */
function getPersonnelStaffing(personnel: PersonnelCard[]): StaffingCounts {
  const provided: StaffingCounts = { staff: 0, command: 0 };

  for (const p of personnel) {
    if (p.status === "Unstopped" && p.other) {
      for (const icon of p.other) {
        if (icon === "Staff") {
          provided.staff++;
        } else if (icon === "Command") {
          provided.command++;
        }
      }
    }
  }

  return provided;
}

/**
 * Check if a ship is properly staffed for movement
 *
 * Per rulebook (p.10), a ship is staffed when BOTH conditions are met:
 * 1. All the icons in the ship's staffing requirements can be found among
 *    your unstopped personnel aboard that ship.
 * 2. You have your unstopped personnel of the ship's affiliation aboard that ship.
 *
 * Additionally, Command icons can substitute for Staff icons.
 *
 * @param cards - Array of cards on the ship (first should be the ship, rest personnel)
 * @returns true if the ship is properly staffed
 */
export function checkStaffed(cards: Card[]): boolean {
  // First card should be the ship
  const ship = cards[0];
  if (!ship || !isShip(ship)) return false;

  // Get unstopped personnel
  const personnel = cards
    .slice(1)
    .filter(
      (c): c is PersonnelCard => isPersonnel(c) && c.status === "Unstopped"
    );

  // Rule requirement 2: At least one unstopped personnel must match ship's affiliation
  const hasMatchingAffiliation = personnel.some((p) =>
    p.affiliation.some((a) => ship.affiliation.includes(a))
  );
  if (!hasMatchingAffiliation) return false;

  // Rule requirement 1: Check staffing icon requirements
  const requirements = getStaffingRequirements(ship);

  // Get staffing provided by personnel
  const provided = getPersonnelStaffing(personnel);

  // Check Command requirements first
  const commandDeficit = requirements.command - provided.command;
  if (commandDeficit > 0) {
    // Not enough Command personnel
    return false;
  }

  // Excess Command personnel can serve as Staff
  const excessCommand = Math.abs(commandDeficit);
  const effectiveStaff = provided.staff + excessCommand;

  // Check Staff requirements
  return effectiveStaff >= requirements.staff;
}

/**
 * Calculate the range cost to move between two missions
 *
 * Cost = source mission range + destination mission range
 * If crossing quadrants, add +2
 *
 * @param sourceMission - Mission ship is currently at
 * @param destinationMission - Mission ship wants to move to
 * @returns Range cost for the movement
 */
export function calculateRangeCost(
  sourceMission: MissionCard,
  destinationMission: MissionCard
): number {
  let cost = sourceMission.range + destinationMission.range;

  // Add quadrant crossing penalty
  if (sourceMission.quadrant !== destinationMission.quadrant) {
    cost += 2;
  }

  return cost;
}

/**
 * Check if a ship has enough remaining range to move between missions
 *
 * @param ship - The ship card to check
 * @param sourceMission - Mission ship is currently at
 * @param destinationMission - Mission ship wants to move to
 * @returns true if the ship has enough range
 */
export function checkRange(
  ship: ShipCard,
  sourceMission: MissionCard,
  destinationMission: MissionCard
): boolean {
  const cost = calculateRangeCost(sourceMission, destinationMission);
  return ship.rangeRemaining >= cost;
}

/**
 * Get all possible destinations a ship can move to
 *
 * @param shipCards - Cards on the ship (first is ship, rest personnel)
 * @param currentMission - Current mission location
 * @param allMissions - All missions on the board
 * @returns Array of missions the ship can legally move to
 */
export function getValidDestinations(
  shipCards: Card[],
  currentMission: MissionCard,
  allMissions: MissionCard[]
): MissionCard[] {
  // Must be staffed to move
  if (!checkStaffed(shipCards)) {
    return [];
  }

  const ship = shipCards[0];
  if (!ship || !isShip(ship)) return [];

  return allMissions.filter((mission) => {
    // Can't move to current location
    if (mission.id === currentMission.id) return false;

    // Must have enough range
    return checkRange(ship, currentMission, mission);
  });
}

/**
 * Execute a ship movement (returns new ship with updated rangeRemaining)
 *
 * @param ship - Ship to move
 * @param sourceMission - Current mission
 * @param destinationMission - Target mission
 * @returns Updated ship with reduced range, or null if movement not possible
 */
export function moveShip(
  ship: ShipCard,
  sourceMission: MissionCard,
  destinationMission: MissionCard
): ShipCard | null {
  const cost = calculateRangeCost(sourceMission, destinationMission);

  if (ship.rangeRemaining < cost) {
    return null;
  }

  return {
    ...ship,
    rangeRemaining: ship.rangeRemaining - cost,
  };
}

/**
 * Reset a ship's range to its base value (for new turn)
 */
export function resetShipRange(ship: ShipCard): ShipCard {
  return {
    ...ship,
    rangeRemaining: ship.range,
  };
}
