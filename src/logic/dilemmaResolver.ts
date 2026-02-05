import type {
  DilemmaCard,
  PersonnelCard,
  Card,
  Skill,
  AttributeName,
} from "../types/card";
import type { GrantedSkill } from "../types/gameState";
import { isPersonnel } from "../types/card";
import { shuffle } from "../utils/shuffle";
import { calculateGroupStats } from "./missionChecker";

/**
 * Result of resolving a dilemma
 */
export interface DilemmaResult {
  // Personnel to stop (by uniqueId)
  stoppedPersonnel: string[];
  // Personnel to kill (by uniqueId)
  killedPersonnel: string[];
  // Whether dilemma is overcome
  overcome: boolean;
  // Whether dilemma returns to pile (not overcome)
  returnsToPile: boolean;
  // Message describing what happened
  message: string;
  // Whether player needs to select personnel
  requiresSelection: boolean;
  // Personnel that can be selected (if requiresSelection is true)
  selectablePersonnel: string[];
}

/**
 * Group stats for dilemma resolution (re-exported from missionChecker)
 */
interface GroupStats {
  integrity: number;
  cunning: number;
  strength: number;
  skills: Record<string, number>;
}

/**
 * Get unstopped personnel from a group
 */
function getUnstoppedPersonnel(cards: Card[]): PersonnelCard[] {
  return cards.filter(
    (c): c is PersonnelCard => isPersonnel(c) && c.status === "Unstopped"
  );
}

/**
 * Check if a personnel has a granted skill based on target filter
 */
function hasGrantedSkill(
  personnel: PersonnelCard,
  skill: Skill,
  grantedSkills: GrantedSkill[]
): boolean {
  for (const grant of grantedSkills) {
    if (grant.skill !== skill) continue;

    // Check if target matches this personnel
    const target = grant.target;
    if (target.scope === "present" || target.scope === "allInPlay") {
      // Check species filter
      if (target.species && target.species.length > 0) {
        if (!personnel.species?.some((s) => target.species!.includes(s))) {
          continue;
        }
      }
      // Check affiliation filter
      if (target.affiliations && target.affiliations.length > 0) {
        if (
          !personnel.affiliation?.some((a) => target.affiliations!.includes(a))
        ) {
          continue;
        }
      }
      return true;
    }
  }
  return false;
}

/**
 * Find personnel with any of the given skills (including granted skills)
 */
function findPersonnelWithSkills(
  cards: Card[],
  requiredSkills: Skill[],
  grantedSkills: GrantedSkill[] = []
): PersonnelCard[] {
  const matching: PersonnelCard[] = [];
  const seen = new Set<string>();

  for (const card of cards) {
    if (isPersonnel(card) && card.status === "Unstopped" && card.uniqueId) {
      if (seen.has(card.uniqueId)) continue;

      // Check native skills
      for (const skillGroup of card.skills) {
        for (const skill of skillGroup) {
          if (requiredSkills.includes(skill as Skill)) {
            matching.push(card);
            seen.add(card.uniqueId);
            break;
          }
        }
        if (seen.has(card.uniqueId)) break;
      }

      // Check granted skills if not already matched
      if (!seen.has(card.uniqueId)) {
        for (const skill of requiredSkills) {
          if (hasGrantedSkill(card, skill, grantedSkills)) {
            matching.push(card);
            seen.add(card.uniqueId);
            break;
          }
        }
      }
    }
  }

  return matching;
}

/**
 * Check if a personnel has any of the given skills (including granted skills)
 */
function personnelHasSkill(
  personnel: PersonnelCard,
  skills: Skill[],
  grantedSkills: GrantedSkill[] = []
): boolean {
  // Check native skills
  for (const skillGroup of personnel.skills) {
    for (const skill of skillGroup) {
      if (skills.includes(skill as Skill)) {
        return true;
      }
    }
  }
  // Check granted skills
  for (const skill of skills) {
    if (hasGrantedSkill(personnel, skill, grantedSkills)) {
      return true;
    }
  }
  return false;
}

/**
 * Normalize dilemma skills to a flat array for simple matching
 */
function normalizeDilemmaSkills(dilemma: DilemmaCard): Skill[] {
  if (!dilemma.skills) return [];

  // Check if it's a flat array or nested
  if (Array.isArray(dilemma.skills[0])) {
    // Nested array - flatten
    return (dilemma.skills as Skill[][]).flat();
  }
  // Already flat
  return dilemma.skills as Skill[];
}

/**
 * Check skill requirements (OR groups) - returns true if ANY group is satisfied
 */
function checkSkillRequirements(
  stats: GroupStats,
  skillGroups: Skill[][],
  abilityname?: AttributeName[][],
  abilityvalue?: number[][]
): boolean {
  if (!skillGroups || skillGroups.length === 0) return true;

  // Each skill group is an OR - if ANY group passes, requirements are met
  for (let groupIdx = 0; groupIdx < skillGroups.length; groupIdx++) {
    const group = skillGroups[groupIdx];
    if (!group) continue;

    // Copy stats to track spending
    const availableStats = { ...stats.skills };
    let fails = 0;

    // Check each skill in this group
    for (const skill of group) {
      const count = availableStats[skill] ?? 0;
      if (count <= 0) {
        fails++;
      } else {
        availableStats[skill] = count - 1;
      }
    }

    // Check attribute requirement for this group
    if (abilityname && abilityvalue) {
      const attrNames = abilityname[groupIdx];
      const attrValues = abilityvalue[groupIdx];

      if (attrNames && attrValues) {
        for (let i = 0; i < attrNames.length; i++) {
          const attrName = attrNames[i];
          const attrValue = attrValues[i];
          if (attrName && attrValue !== undefined) {
            const playerValue = availableStats[attrName] ?? 0;
            // Must EXCEED the value (> not >=)
            if (playerValue <= attrValue) {
              fails++;
            }
          }
        }
      }
    }

    // If this group has no fails, requirements are met
    if (fails === 0) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// DILEMMA RESOLVERS
// =============================================================================

/**
 * System Diagnostics - EN01052
 * Choose personnel with Engineer or Programming to stop.
 * If cannot, all personnel stopped and dilemma returns to pile.
 */
export function resolveSystemDiagnostics(
  dilemma: DilemmaCard,
  cards: Card[],
  grantedSkills: GrantedSkill[] = []
): DilemmaResult {
  const requiredSkills = normalizeDilemmaSkills(dilemma);
  const matching = findPersonnelWithSkills(
    cards,
    requiredSkills,
    grantedSkills
  );

  if (matching.length === 0) {
    // No matching personnel - stop all and return dilemma
    const unstopped = getUnstoppedPersonnel(cards);
    return {
      stoppedPersonnel: unstopped.map((p) => p.uniqueId!),
      killedPersonnel: [],
      overcome: false,
      returnsToPile: true,
      message: `No personnel with ${requiredSkills.join(" or ")} found. All personnel stopped.`,
      requiresSelection: false,
      selectablePersonnel: [],
    };
  }

  // Player must choose one to stop
  return {
    stoppedPersonnel: [],
    killedPersonnel: [],
    overcome: false, // Will be set when selection made
    returnsToPile: false,
    message: `Choose a personnel with ${requiredSkills.join(" or ")} to stop.`,
    requiresSelection: true,
    selectablePersonnel: matching.map((p) => p.uniqueId!),
  };
}

/**
 * Wavefront - EN01060
 * Unless you have a personnel with 2x required skill, opponent chooses personnel to stop.
 * If no matching personnel, all stopped and dilemma returns.
 */
export function resolveWavefront(
  dilemma: DilemmaCard,
  cards: Card[],
  grantedSkills: GrantedSkill[] = []
): DilemmaResult {
  const skillGroups = dilemma.skills as Skill[][];
  if (!skillGroups || skillGroups.length === 0) {
    return {
      stoppedPersonnel: [],
      killedPersonnel: [],
      overcome: true,
      returnsToPile: false,
      message: "Dilemma overcome (no requirements).",
      requiresSelection: false,
      selectablePersonnel: [],
    };
  }

  // Check if any personnel has 2x any required skill
  const unstopped = getUnstoppedPersonnel(cards);
  let hasDoubleSkill = false;

  // Build skill requirement map (skill -> required count)
  const requiredCounts: Record<string, number> = {};
  for (const group of skillGroups) {
    for (const skill of group) {
      requiredCounts[skill] = (requiredCounts[skill] ?? 0) + 1;
    }
  }

  // Check if any single personnel meets any group's 2x requirement
  for (const personnel of unstopped) {
    const personnelSkills: Record<string, number> = {};
    for (const skillGroup of personnel.skills) {
      for (const skill of skillGroup) {
        personnelSkills[skill] = (personnelSkills[skill] ?? 0) + 1;
      }
    }

    for (const group of skillGroups) {
      // Count skills needed for this group
      const groupSkillCounts: Record<string, number> = {};
      for (const skill of group) {
        groupSkillCounts[skill] = (groupSkillCounts[skill] ?? 0) + 1;
      }

      // Check if personnel has all skills at required counts
      let meetsGroup = true;
      for (const [skill, count] of Object.entries(groupSkillCounts)) {
        if ((personnelSkills[skill] ?? 0) < count) {
          meetsGroup = false;
          break;
        }
      }

      if (meetsGroup) {
        hasDoubleSkill = true;
        break;
      }
    }
    if (hasDoubleSkill) break;
  }

  if (hasDoubleSkill) {
    // Dilemma overcome automatically
    return {
      stoppedPersonnel: [],
      killedPersonnel: [],
      overcome: true,
      returnsToPile: false,
      message: "Personnel with required skills found. Dilemma overcome.",
      requiresSelection: false,
      selectablePersonnel: [],
    };
  }

  // Find personnel with any matching skill
  const allSkills = skillGroups.flat();
  const matching = findPersonnelWithSkills(cards, allSkills, grantedSkills);

  if (matching.length === 0) {
    // No matching personnel - stop all
    return {
      stoppedPersonnel: unstopped.map((p) => p.uniqueId!),
      killedPersonnel: [],
      overcome: false,
      returnsToPile: true,
      message: "No matching personnel. All stopped and dilemma returns.",
      requiresSelection: false,
      selectablePersonnel: [],
    };
  }

  // Opponent (in solitaire, player) chooses one to stop
  return {
    stoppedPersonnel: [],
    killedPersonnel: [],
    overcome: false,
    returnsToPile: false,
    message: "Choose a personnel to stop.",
    requiresSelection: true,
    selectablePersonnel: matching.map((p) => p.uniqueId!),
  };
}

/**
 * Command Decisions - EN01017
 * Choose personnel with Leadership or Officer to stop.
 * If cannot, randomly kill one.
 */
export function resolveCommandDecisions(
  dilemma: DilemmaCard,
  cards: Card[],
  grantedSkills: GrantedSkill[] = []
): DilemmaResult {
  const requiredSkills = normalizeDilemmaSkills(dilemma);
  const matching = findPersonnelWithSkills(
    cards,
    requiredSkills,
    grantedSkills
  );

  if (matching.length === 0) {
    // No matching personnel - randomly kill one
    const unstopped = getUnstoppedPersonnel(cards);
    if (unstopped.length === 0) {
      return {
        stoppedPersonnel: [],
        killedPersonnel: [],
        overcome: true,
        returnsToPile: false,
        message: "No personnel to kill. Dilemma overcome.",
        requiresSelection: false,
        selectablePersonnel: [],
      };
    }

    const shuffled = shuffle(unstopped);
    const killed = shuffled[0]!;

    return {
      stoppedPersonnel: [],
      killedPersonnel: [killed.uniqueId!],
      overcome: true,
      returnsToPile: false,
      message: `No personnel with ${requiredSkills.join(" or ")}. ${killed.name} was randomly killed.`,
      requiresSelection: false,
      selectablePersonnel: [],
    };
  }

  // Player must choose one to stop
  return {
    stoppedPersonnel: [],
    killedPersonnel: [],
    overcome: false,
    returnsToPile: false,
    message: `Choose a personnel with ${requiredSkills.join(" or ")} to stop.`,
    requiresSelection: true,
    selectablePersonnel: matching.map((p) => p.uniqueId!),
  };
}

/**
 * An Old Debt - EN03002
 * Unless skills + attribute check, randomly kill personnel with specific skill.
 */
export function resolveAnOldDebt(
  dilemma: DilemmaCard,
  cards: Card[],
  grantedSkills: GrantedSkill[] = []
): DilemmaResult {
  const stats = calculateGroupStats(cards, grantedSkills, {
    isFacingDilemma: true,
  });
  const skillGroups = dilemma.skills as Skill[][];

  const meetsRequirements = checkSkillRequirements(
    stats,
    skillGroups,
    dilemma.abilityname,
    dilemma.abilityvalue
  );

  if (meetsRequirements) {
    return {
      stoppedPersonnel: [],
      killedPersonnel: [],
      overcome: true,
      returnsToPile: false,
      message: "Requirements met. Dilemma overcome.",
      requiresSelection: false,
      selectablePersonnel: [],
    };
  }

  // Failed - kill random personnel with skillkill
  const unstopped = getUnstoppedPersonnel(cards);
  const killCandidates = dilemma.skillkill
    ? unstopped.filter((p) =>
        personnelHasSkill(p, [dilemma.skillkill!], grantedSkills)
      )
    : [];

  if (killCandidates.length === 0) {
    return {
      stoppedPersonnel: [],
      killedPersonnel: [],
      overcome: true,
      returnsToPile: false,
      message: `No personnel with ${dilemma.skillkill} to kill. Dilemma overcome.`,
      requiresSelection: false,
      selectablePersonnel: [],
    };
  }

  const shuffled = shuffle(killCandidates);
  const killed = shuffled[0]!;

  return {
    stoppedPersonnel: [],
    killedPersonnel: [killed.uniqueId!],
    overcome: true,
    returnsToPile: false,
    message: `Requirements not met. ${killed.name} with ${dilemma.skillkill} was killed.`,
    requiresSelection: false,
    selectablePersonnel: [],
  };
}

/**
 * Pinned Down - EN01043
 * Randomly stop 1-3 personnel based on crew size.
 */
export function resolvePinnedDown(
  _dilemma: DilemmaCard,
  cards: Card[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _grantedSkills: GrantedSkill[] = []
): DilemmaResult {
  const unstopped = getUnstoppedPersonnel(cards);
  const stoppedIds: string[] = [];
  const stoppedNames: string[] = [];

  let remaining = shuffle([...unstopped]);

  // Stop first personnel
  if (remaining.length >= 1) {
    const stopped = remaining.shift()!;
    stoppedIds.push(stopped.uniqueId!);
    stoppedNames.push(stopped.name);
  }

  // If 9+ remaining, stop second
  if (remaining.length >= 9) {
    remaining = shuffle(remaining);
    const stopped = remaining.shift()!;
    stoppedIds.push(stopped.uniqueId!);
    stoppedNames.push(stopped.name);
  }

  // If still 10+ remaining, stop third
  if (remaining.length >= 10) {
    remaining = shuffle(remaining);
    const stopped = remaining.shift()!;
    stoppedIds.push(stopped.uniqueId!);
    stoppedNames.push(stopped.name);
  }

  return {
    stoppedPersonnel: stoppedIds,
    killedPersonnel: [],
    overcome: true,
    returnsToPile: false,
    message: `${stoppedNames.join(", ")} randomly stopped.`,
    requiresSelection: false,
    selectablePersonnel: [],
  };
}

/**
 * Limited Welcome - EN01034
 * Keep 9 random personnel, stop rest. Dilemma stays on mission.
 */
export function resolveLimitedWelcome(
  _dilemma: DilemmaCard,
  cards: Card[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _grantedSkills: GrantedSkill[] = []
): DilemmaResult {
  const unstopped = getUnstoppedPersonnel(cards);

  if (unstopped.length <= 9) {
    return {
      stoppedPersonnel: [],
      killedPersonnel: [],
      overcome: false, // Stays on mission
      returnsToPile: false,
      message: "Less than 9 personnel. Dilemma stays on mission.",
      requiresSelection: false,
      selectablePersonnel: [],
    };
  }

  const shuffled = shuffle(unstopped);
  const toStop = shuffled.slice(9);

  return {
    stoppedPersonnel: toStop.map((p) => p.uniqueId!),
    killedPersonnel: [],
    overcome: false, // Stays on mission
    returnsToPile: false,
    message: `${toStop.length} personnel stopped. Dilemma stays on mission.`,
    requiresSelection: false,
    selectablePersonnel: [],
  };
}

/**
 * Ornaran Threat - EN01041
 * Randomly select personnel. Unless skill check, kill them and stop all others.
 */
export function resolveOrnaranThreat(
  dilemma: DilemmaCard,
  cards: Card[],
  grantedSkills: GrantedSkill[] = []
): DilemmaResult {
  const unstopped = getUnstoppedPersonnel(cards);

  if (unstopped.length === 0) {
    return {
      stoppedPersonnel: [],
      killedPersonnel: [],
      overcome: true,
      returnsToPile: false,
      message: "No personnel. Dilemma overcome.",
      requiresSelection: false,
      selectablePersonnel: [],
    };
  }

  const shuffled = shuffle(unstopped);
  const target = shuffled[0]!;

  // Check skill requirements
  const stats = calculateGroupStats(cards, grantedSkills, {
    isFacingDilemma: true,
  });
  const skillGroups = dilemma.skills as Skill[][];
  const meetsRequirements = checkSkillRequirements(stats, skillGroups);

  if (meetsRequirements) {
    // Stop the target
    return {
      stoppedPersonnel: [target.uniqueId!],
      killedPersonnel: [],
      overcome: true,
      returnsToPile: false,
      message: `Skills met. ${target.name} stopped. Dilemma overcome.`,
      requiresSelection: false,
      selectablePersonnel: [],
    };
  }

  // Kill target and stop all others
  const othersToStop = unstopped
    .filter((p) => p.uniqueId !== target.uniqueId)
    .map((p) => p.uniqueId!);

  return {
    stoppedPersonnel: othersToStop,
    killedPersonnel: [target.uniqueId!],
    overcome: false,
    returnsToPile: true,
    message: `Skills not met. ${target.name} killed, all others stopped.`,
    requiresSelection: false,
    selectablePersonnel: [],
  };
}

/**
 * Sokath - EN03030
 * Unless skill + attribute check, all stopped and dilemma returns.
 */
export function resolveSokath(
  dilemma: DilemmaCard,
  cards: Card[],
  grantedSkills: GrantedSkill[] = []
): DilemmaResult {
  const stats = calculateGroupStats(cards, grantedSkills, {
    isFacingDilemma: true,
  });
  const skillGroups = dilemma.skills as Skill[][];

  const meetsRequirements = checkSkillRequirements(
    stats,
    skillGroups,
    dilemma.abilityname,
    dilemma.abilityvalue
  );

  if (meetsRequirements) {
    return {
      stoppedPersonnel: [],
      killedPersonnel: [],
      overcome: true,
      returnsToPile: false,
      message: "Requirements met. Dilemma overcome.",
      requiresSelection: false,
      selectablePersonnel: [],
    };
  }

  // Stop all and return dilemma
  const unstopped = getUnstoppedPersonnel(cards);
  return {
    stoppedPersonnel: unstopped.map((p) => p.uniqueId!),
    killedPersonnel: [],
    overcome: false,
    returnsToPile: true,
    message: "Requirements not met. All personnel stopped.",
    requiresSelection: false,
    selectablePersonnel: [],
  };
}

// =============================================================================
// MAIN RESOLVER
// =============================================================================

/**
 * Resolve a dilemma based on its rule type
 */
export function resolveDilemma(
  dilemma: DilemmaCard,
  cards: Card[],
  grantedSkills: GrantedSkill[] = []
): DilemmaResult {
  switch (dilemma.rule) {
    case "SystemDiagnostics":
      return resolveSystemDiagnostics(dilemma, cards, grantedSkills);
    case "Wavefront":
      return resolveWavefront(dilemma, cards, grantedSkills);
    case "CommandDecisions":
      return resolveCommandDecisions(dilemma, cards, grantedSkills);
    case "AnOldDebt":
      return resolveAnOldDebt(dilemma, cards, grantedSkills);
    case "PinnedDown":
      return resolvePinnedDown(dilemma, cards, grantedSkills);
    case "LimitedWelcome":
      return resolveLimitedWelcome(dilemma, cards, grantedSkills);
    case "OrnaranThreat":
      return resolveOrnaranThreat(dilemma, cards, grantedSkills);
    case "Sokath":
      return resolveSokath(dilemma, cards, grantedSkills);
    default:
      // Unknown rule - auto-overcome
      return {
        stoppedPersonnel: [],
        killedPersonnel: [],
        overcome: true,
        returnsToPile: false,
        message: "Unknown dilemma type. Overcome by default.",
        requiresSelection: false,
        selectablePersonnel: [],
      };
  }
}

/**
 * After player selects personnel to stop
 */
export function resolveSelectionStop(
  _dilemma: DilemmaCard,
  selectedPersonnelId: string
): DilemmaResult {
  return {
    stoppedPersonnel: [selectedPersonnelId],
    killedPersonnel: [],
    overcome: true,
    returnsToPile: false,
    message: "Personnel stopped. Dilemma overcome.",
    requiresSelection: false,
    selectablePersonnel: [],
  };
}
