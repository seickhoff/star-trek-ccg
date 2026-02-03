import type {
  Card,
  MissionCard,
  PersonnelCard,
  Skill,
  AttributeName,
} from "../types/card";
import { isPersonnel } from "../types/card";
import { getEffectiveStats } from "./abilities";

/**
 * Skill counts for a group of personnel
 */
export interface SkillCounts {
  [skill: string]: number;
}

/**
 * Stats summary for a group of cards
 */
export interface GroupStats {
  unstoppedPersonnel: number;
  integrity: number;
  cunning: number;
  strength: number;
  skills: SkillCounts;
}

/**
 * Calculate combined stats for a group of cards
 * Only counts unstopped personnel
 * Uses effective stats (applying passive ability modifiers)
 */
export function calculateGroupStats(cards: Card[]): GroupStats {
  const stats: GroupStats = {
    unstoppedPersonnel: 0,
    integrity: 0,
    cunning: 0,
    strength: 0,
    skills: {},
  };

  for (const card of cards) {
    if (isPersonnel(card) && card.status === "Unstopped") {
      stats.unstoppedPersonnel++;

      // Use effective stats (with passive ability modifiers applied)
      const effective = getEffectiveStats(card, cards);
      stats.integrity += effective.integrity;
      stats.cunning += effective.cunning;
      stats.strength += effective.strength;

      // Count skills (nested arrays: [[Skill1], [Skill2, Skill3]])
      for (const skillGroup of card.skills) {
        for (const skill of skillGroup) {
          stats.skills[skill] = (stats.skills[skill] || 0) + 1;
        }
      }
    }
  }

  return stats;
}

/**
 * Format group stats for display
 */
export function formatGroupStats(stats: GroupStats, pretty: boolean): string {
  const skillList = Object.entries(stats.skills)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([skill, count]) => `${skill}: ${count}`)
    .join(", ");

  if (pretty) {
    return (
      `Unstopped Personnel: ${stats.unstoppedPersonnel}<br/><br/>` +
      `Integrity: ${stats.integrity}, Cunning: ${stats.cunning}, Strength: ${stats.strength}<br/><br/>` +
      skillList
    );
  }

  return (
    `Unstopped Personnel: ${stats.unstoppedPersonnel}, ` +
    `Integrity: ${stats.integrity}, Cunning: ${stats.cunning}, Strength: ${stats.strength}, ` +
    skillList
  );
}

/**
 * Check if mission requirements can be met by a group of cards
 *
 * Mission requirements are structured as:
 * - skills: Skill[][] - Alternative skill requirements (OR between groups)
 * - attribute: AttributeName - Which attribute must exceed threshold
 * - value: number - The threshold value (must be exceeded, not equal)
 *
 * Returns true if ANY of the skill requirement groups can be satisfied
 */
export function checkMission(cards: Card[], mission: MissionCard): boolean {
  // Missions without requirements (headquarters) can't be "completed"
  if (!mission.skills || mission.skills.length === 0) {
    return false;
  }

  const stats = calculateGroupStats(cards);

  // Add attribute values as pseudo-skills for requirement checking
  const playerStats: SkillCounts = { ...stats.skills };
  playerStats.Strength = stats.strength;
  playerStats.Integrity = stats.integrity;
  playerStats.Cunning = stats.cunning;

  // Check each alternative skill requirement (OR between groups)
  for (const skillRequirement of mission.skills) {
    let fails = 0;

    // Make a copy to track spent skills
    const availableStats = { ...playerStats };

    // Check each required skill in this group
    for (const skill of skillRequirement) {
      const skillCount = availableStats[skill] ?? 0;
      if (skillCount <= 0) {
        fails++;
      } else {
        availableStats[skill] = skillCount - 1;
      }
    }

    // Check attribute threshold requirement
    if (mission.attribute && mission.value !== undefined) {
      const attrValue = availableStats[mission.attribute] ?? 0;
      // Must EXCEED the value, not just equal it (original: <= intMissionValue is a fail)
      if (attrValue <= mission.value) {
        fails++;
      }
    }

    // If no fails, this requirement group is satisfied
    if (fails === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Count unstopped personnel in a group
 */
export function countUnstoppedPersonnel(cards: Card[]): number {
  return cards.filter(
    (card): card is PersonnelCard =>
      isPersonnel(card) && card.status === "Unstopped"
  ).length;
}

/**
 * Get all unstopped personnel from a group
 */
export function getUnstoppedPersonnel(cards: Card[]): PersonnelCard[] {
  return cards.filter(
    (card): card is PersonnelCard =>
      isPersonnel(card) && card.status === "Unstopped"
  );
}

/**
 * Check if all personnel in a group are stopped
 */
export function areAllPersonnelStopped(cards: Card[]): boolean {
  return cards
    .filter(isPersonnel)
    .every((card) => card.status === "Stopped" || card.status === "Killed");
}

/**
 * Find personnel with a specific skill (unstopped only)
 */
export function findPersonnelWithSkill(
  cards: Card[],
  skill: Skill
): PersonnelCard[] {
  return getUnstoppedPersonnel(cards).filter((p) =>
    p.skills.some((group) => group.includes(skill))
  );
}

/**
 * Check if group has at least N of a specific skill (unstopped only)
 */
export function hasSkillCount(
  cards: Card[],
  skill: Skill,
  requiredCount: number
): boolean {
  const stats = calculateGroupStats(cards);
  return (stats.skills[skill] || 0) >= requiredCount;
}

/**
 * Get the total attribute value for a group
 */
export function getAttributeTotal(
  cards: Card[],
  attribute: AttributeName
): number {
  const stats = calculateGroupStats(cards);
  switch (attribute) {
    case "Integrity":
      return stats.integrity;
    case "Cunning":
      return stats.cunning;
    case "Strength":
      return stats.strength;
  }
}
