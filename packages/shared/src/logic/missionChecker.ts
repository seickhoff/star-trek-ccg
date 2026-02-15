import type {
  Card,
  MissionCard,
  PersonnelCard,
  Skill,
  AttributeName,
  GrantedSkill,
} from "../types/index.js";
import { isPersonnel } from "../types/index.js";
import {
  getEffectiveStats,
  getGrantedSkillsForPersonnel,
  getDilemmaGrantedSkills,
  type AbilityContext,
} from "./abilities.js";

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
 *
 * @param cards - The cards in the group
 * @param grantedSkills - Optional array of currently active granted skills
 * @param context - Optional context for ability resolution (e.g., during dilemma)
 */
export function calculateGroupStats(
  cards: Card[],
  grantedSkills: GrantedSkill[] = [],
  context: AbilityContext = {}
): GroupStats {
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
      // Pass context to include whileFacingDilemma abilities when appropriate
      const effective = getEffectiveStats(card, cards, context);
      stats.integrity += effective.integrity;
      stats.cunning += effective.cunning;
      stats.strength += effective.strength;

      // Count base skills (nested arrays: [[Skill1], [Skill2, Skill3]])
      for (const skillGroup of card.skills) {
        for (const skill of skillGroup) {
          stats.skills[skill] = (stats.skills[skill] || 0) + 1;
        }
      }

      // Count granted skills from order abilities
      const granted = getGrantedSkillsForPersonnel(card, grantedSkills);
      for (const skill of granted) {
        stats.skills[skill] = (stats.skills[skill] || 0) + 1;
      }

      // Count skills granted by whileFacingDilemma abilities when in dilemma context
      if (context.isFacingDilemma) {
        const dilemmaSkills = getDilemmaGrantedSkills(card, cards);
        for (const skill of dilemmaSkills) {
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
 *
 * @param cards - The cards attempting the mission
 * @param mission - The mission being attempted
 * @param grantedSkills - Optional array of currently active granted skills
 */
export function checkMission(
  cards: Card[],
  mission: MissionCard,
  grantedSkills: GrantedSkill[] = []
): boolean {
  // Missions without requirements (headquarters) can't be "completed"
  if (!mission.skills || mission.skills.length === 0) {
    return false;
  }

  const stats = calculateGroupStats(cards, grantedSkills);

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
 * Determine what's missing for a mission attempt (closest requirement group).
 * Returns null if the mission has no requirements (HQ) or is already completed.
 */
export interface MissionGap {
  missingSkills: Skill[];
  attributeGap?: { attribute: AttributeName; need: number; have: number };
  missingAffiliation: boolean;
}

export function getMissionGap(
  cards: Card[],
  mission: MissionCard,
  grantedSkills: GrantedSkill[] = [],
  unstoppedPersonnel?: PersonnelCard[]
): MissionGap | null {
  if (!mission.skills || mission.skills.length === 0) return null;
  if (mission.completed) return null;

  const stats = calculateGroupStats(cards, grantedSkills);
  const playerStats: SkillCounts = { ...stats.skills };
  playerStats.Strength = stats.strength;
  playerStats.Integrity = stats.integrity;
  playerStats.Cunning = stats.cunning;

  // Check affiliation
  let missingAffiliation = false;
  if (
    mission.affiliation &&
    mission.affiliation.length > 0 &&
    unstoppedPersonnel
  ) {
    missingAffiliation = !unstoppedPersonnel.some((p) =>
      p.affiliation.some((a) => mission.affiliation!.includes(a))
    );
  }

  // Find the closest requirement group (fewest missing items)
  let bestGap: MissionGap | null = null;
  let bestMissingCount = Infinity;

  for (const skillRequirement of mission.skills) {
    const missing: Skill[] = [];
    const availableStats = { ...playerStats };

    for (const skill of skillRequirement) {
      const count = availableStats[skill] ?? 0;
      if (count <= 0) {
        missing.push(skill);
      } else {
        availableStats[skill] = count - 1;
      }
    }

    let attributeGap: MissionGap["attributeGap"];
    if (mission.attribute && mission.value !== undefined) {
      const have = availableStats[mission.attribute] ?? 0;
      if (have <= mission.value) {
        attributeGap = {
          attribute: mission.attribute,
          need: mission.value + 1,
          have,
        };
      }
    }

    const totalMissing = missing.length + (attributeGap ? 1 : 0);
    if (totalMissing < bestMissingCount) {
      bestMissingCount = totalMissing;
      bestGap = { missingSkills: missing, attributeGap, missingAffiliation };
    }
  }

  return bestGap;
}

/**
 * Format a MissionGap into a short human-readable hint string.
 */
export function formatMissionGap(gap: MissionGap): string {
  const parts: string[] = [];

  if (gap.missingAffiliation) {
    parts.push("Wrong affiliation");
  }

  if (gap.missingSkills.length > 0) {
    const skillCounts: Record<string, number> = {};
    for (const s of gap.missingSkills) {
      skillCounts[s] = (skillCounts[s] || 0) + 1;
    }
    for (const [skill, count] of Object.entries(skillCounts)) {
      parts.push(count > 1 ? `${skill} x${count}` : skill);
    }
  }

  if (gap.attributeGap) {
    parts.push(
      `${gap.attributeGap.attribute} ${gap.attributeGap.have}/${gap.attributeGap.need}`
    );
  }

  return parts.length > 0 ? `Need: ${parts.join(", ")}` : "";
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
 *
 * @param cards - The cards to search
 * @param skill - The skill to find
 * @param grantedSkills - Optional array of currently active granted skills
 */
export function findPersonnelWithSkill(
  cards: Card[],
  skill: Skill,
  grantedSkills: GrantedSkill[] = []
): PersonnelCard[] {
  return getUnstoppedPersonnel(cards).filter((p) => {
    // Check base skills
    if (p.skills.some((group) => group.includes(skill))) {
      return true;
    }
    // Check granted skills
    const granted = getGrantedSkillsForPersonnel(p, grantedSkills);
    return granted.includes(skill);
  });
}

/**
 * Check if group has at least N of a specific skill (unstopped only)
 *
 * @param cards - The cards to check
 * @param skill - The skill to count
 * @param requiredCount - The minimum required count
 * @param grantedSkills - Optional array of currently active granted skills
 */
export function hasSkillCount(
  cards: Card[],
  skill: Skill,
  requiredCount: number,
  grantedSkills: GrantedSkill[] = []
): boolean {
  const stats = calculateGroupStats(cards, grantedSkills);
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
