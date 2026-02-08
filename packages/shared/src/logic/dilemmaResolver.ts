import type {
  DilemmaCard,
  DilemmaRequirement,
  PersonnelCard,
  Card,
  Skill,
  GrantedSkill,
} from "../types";
import { isPersonnel } from "../types";
import { shuffle } from "../utils/shuffle";
import { calculateGroupStats } from "./missionChecker";

/**
 * Result of resolving a dilemma
 */
export interface DilemmaResolution {
  stoppedPersonnel: string[];
  killedPersonnel: string[];
  overcome: boolean;
  returnsToPile: boolean;
  message: string;
  requiresSelection: boolean;
  selectablePersonnel: string[];
  selectionPrompt?: string;
  failureReason?: string;
}

/**
 * Group stats for dilemma resolution
 */
interface GroupStats {
  integrity: number;
  cunning: number;
  strength: number;
  skills: Record<string, number>;
}

// =============================================================================
// HELPERS
// =============================================================================

function getUnstoppedPersonnel(cards: Card[]): PersonnelCard[] {
  return cards.filter(
    (c): c is PersonnelCard => isPersonnel(c) && c.status === "Unstopped"
  );
}

function hasGrantedSkill(
  personnel: PersonnelCard,
  skill: Skill,
  grantedSkills: GrantedSkill[]
): boolean {
  for (const grant of grantedSkills) {
    if (grant.skill !== skill) continue;
    const target = grant.target;
    if (target.scope === "present" || target.scope === "allInPlay") {
      if (target.species && target.species.length > 0) {
        if (!personnel.species?.some((s) => target.species!.includes(s))) {
          continue;
        }
      }
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

function personnelHasSkill(
  personnel: PersonnelCard,
  skills: Skill[],
  grantedSkills: GrantedSkill[] = []
): boolean {
  for (const skillGroup of personnel.skills) {
    for (const skill of skillGroup) {
      if (skills.includes(skill as Skill)) {
        return true;
      }
    }
  }
  for (const skill of skills) {
    if (hasGrantedSkill(personnel, skill, grantedSkills)) {
      return true;
    }
  }
  return false;
}

// =============================================================================
// REQUIREMENT CHECKING
// =============================================================================

/**
 * Check if a single personnel meets a requirement (for singlePersonnel checks).
 * Only checks native skills (not granted), matching original Wavefront behavior.
 */
function checkSinglePersonnelRequirement(
  req: DilemmaRequirement,
  cards: Card[]
): boolean {
  const unstopped = getUnstoppedPersonnel(cards);

  for (const personnel of unstopped) {
    const personnelSkills: Record<string, number> = {};
    for (const skillGroup of personnel.skills) {
      for (const skill of skillGroup) {
        personnelSkills[skill] = (personnelSkills[skill] ?? 0) + 1;
      }
    }

    // Check skill counts
    let meets = true;
    if (req.skills) {
      const needed: Record<string, number> = {};
      for (const skill of req.skills) {
        needed[skill] = (needed[skill] ?? 0) + 1;
      }
      for (const [skill, count] of Object.entries(needed)) {
        if ((personnelSkills[skill] ?? 0) < count) {
          meets = false;
          break;
        }
      }
    }

    // Check attribute on this individual personnel
    if (meets && req.attribute && req.attributeThreshold !== undefined) {
      const attrKey = req.attribute.toLowerCase() as keyof PersonnelCard;
      const value = (personnel[attrKey] as number) ?? 0;
      if (value <= req.attributeThreshold) {
        meets = false;
      }
    }

    if (meets) return true;
  }

  return false;
}

/**
 * Check if group stats meet a single requirement.
 */
function checkGroupRequirement(
  req: DilemmaRequirement,
  stats: GroupStats
): boolean {
  // Check skills
  if (req.skills) {
    const available = { ...stats.skills };
    for (const skill of req.skills) {
      const count = available[skill] ?? 0;
      if (count <= 0) return false;
      available[skill] = count - 1;
    }
  }

  // Check attribute (using top-level stats, not skills record)
  if (req.attribute && req.attributeThreshold !== undefined) {
    const attrKey = req.attribute.toLowerCase() as keyof GroupStats;
    const value = (stats[attrKey] as number) ?? 0;
    if (value <= req.attributeThreshold) return false;
  }

  return true;
}

/**
 * Check if any requirement is met (OR logic).
 */
function checkRequirements(
  requirements: DilemmaRequirement[],
  stats: GroupStats,
  cards: Card[]
): boolean {
  if (!requirements || requirements.length === 0) return true;

  for (const req of requirements) {
    if (req.singlePersonnel) {
      if (checkSinglePersonnelRequirement(req, cards)) return true;
    } else {
      if (checkGroupRequirement(req, stats)) return true;
    }
  }
  return false;
}

// =============================================================================
// REQUIREMENT FORMATTING (for failure messages)
// =============================================================================

function formatSingleRequirement(req: DilemmaRequirement): string {
  const parts: string[] = [];

  if (req.skills && req.skills.length > 0) {
    const skillCounts: Record<string, number> = {};
    for (const skill of req.skills) {
      skillCounts[skill] = (skillCounts[skill] ?? 0) + 1;
    }
    for (const [skill, count] of Object.entries(skillCounts)) {
      parts.push(count > 1 ? `${count} ${skill}` : skill);
    }
  }

  if (req.attribute && req.attributeThreshold !== undefined) {
    parts.push(`${req.attribute}>${req.attributeThreshold}`);
  }

  const joined = parts.join(" + ");
  return req.singlePersonnel ? `one personnel with ${joined}` : joined;
}

function formatRequirements(requirements: DilemmaRequirement[]): string {
  return requirements.map(formatSingleRequirement).join(" or ");
}

// =============================================================================
// TEMPLATE RESOLVERS
// =============================================================================

/**
 * "Choose a personnel who has [skills] to be stopped. If you cannot, [penalty]."
 */
function resolveChooseToStop(
  rule: Extract<DilemmaCard["rule"], { type: "chooseToStop" }>,
  cards: Card[],
  grantedSkills: GrantedSkill[]
): DilemmaResolution {
  const matching = findPersonnelWithSkills(cards, rule.skills, grantedSkills);

  if (matching.length > 0) {
    return {
      stoppedPersonnel: [],
      killedPersonnel: [],
      overcome: false,
      returnsToPile: false,
      message: `Choose a personnel with ${rule.skills.join(" or ")} to stop.`,
      requiresSelection: true,
      selectablePersonnel: matching.map((p) => p.uniqueId!),
    };
  }

  // No matching personnel — apply penalty
  if (rule.penalty === "randomKill") {
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
    const killed = shuffle(unstopped)[0]!;
    return {
      stoppedPersonnel: [],
      killedPersonnel: [killed.uniqueId!],
      overcome: true,
      returnsToPile: false,
      message: `No personnel with ${rule.skills.join(" or ")}. ${killed.name} was randomly killed.`,
      requiresSelection: false,
      selectablePersonnel: [],
    };
  }

  // stopAllReturnToPile
  const unstopped = getUnstoppedPersonnel(cards);
  return {
    stoppedPersonnel: unstopped.map((p) => p.uniqueId!),
    killedPersonnel: [],
    overcome: false,
    returnsToPile: true,
    message: `No personnel with ${rule.skills.join(" or ")} found. All personnel stopped.`,
    requiresSelection: false,
    selectablePersonnel: [],
  };
}

/**
 * "Unless you have [requirements], [penalty]."
 */
function resolveUnlessCheck(
  rule: Extract<DilemmaCard["rule"], { type: "unlessCheck" }>,
  cards: Card[],
  grantedSkills: GrantedSkill[]
): DilemmaResolution {
  const stats = calculateGroupStats(cards, grantedSkills, {
    isFacingDilemma: true,
  });

  if (checkRequirements(rule.requirements, stats, cards)) {
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

  // Requirements not met — apply penalty
  const failureReason = `Needed: ${formatRequirements(rule.requirements)}`;
  const penalty = rule.penalty;
  const unstopped = getUnstoppedPersonnel(cards);

  switch (penalty.type) {
    case "randomKill": {
      if (unstopped.length === 0) {
        return {
          stoppedPersonnel: [],
          killedPersonnel: [],
          overcome: true,
          returnsToPile: false,
          message: "No personnel to kill. Dilemma overcome.",
          failureReason,
          requiresSelection: false,
          selectablePersonnel: [],
        };
      }
      const killed = shuffle(unstopped)[0]!;
      return {
        stoppedPersonnel: [],
        killedPersonnel: [killed.uniqueId!],
        overcome: true,
        returnsToPile: false,
        message: `Requirements not met. ${killed.name} was randomly killed.`,
        failureReason,
        requiresSelection: false,
        selectablePersonnel: [],
      };
    }

    case "randomKillWithSkill": {
      const killCandidates = unstopped.filter((p) =>
        personnelHasSkill(p, [penalty.skill], grantedSkills)
      );
      if (killCandidates.length === 0) {
        return {
          stoppedPersonnel: [],
          killedPersonnel: [],
          overcome: true,
          returnsToPile: false,
          message: `No personnel with ${penalty.skill} to kill. Dilemma overcome.`,
          failureReason,
          requiresSelection: false,
          selectablePersonnel: [],
        };
      }
      const killed = shuffle(killCandidates)[0]!;
      return {
        stoppedPersonnel: [],
        killedPersonnel: [killed.uniqueId!],
        overcome: true,
        returnsToPile: false,
        message: `Requirements not met. ${killed.name} with ${penalty.skill} was killed.`,
        failureReason,
        requiresSelection: false,
        selectablePersonnel: [],
      };
    }

    case "stopAllReturnToPile": {
      return {
        stoppedPersonnel: unstopped.map((p) => p.uniqueId!),
        killedPersonnel: [],
        overcome: false,
        returnsToPile: true,
        message: "Requirements not met. All personnel stopped.",
        failureReason,
        requiresSelection: false,
        selectablePersonnel: [],
      };
    }

    case "chooseMatchingToStopElseStopAll": {
      const matching = findPersonnelWithSkills(
        cards,
        penalty.skills,
        grantedSkills
      );
      if (matching.length > 0) {
        return {
          stoppedPersonnel: [],
          killedPersonnel: [],
          overcome: false,
          returnsToPile: false,
          message: "Choose a personnel to stop.",
          failureReason,
          requiresSelection: true,
          selectablePersonnel: matching.map((p) => p.uniqueId!),
        };
      }
      return {
        stoppedPersonnel: unstopped.map((p) => p.uniqueId!),
        killedPersonnel: [],
        overcome: false,
        returnsToPile: true,
        message: "No matching personnel. All stopped and dilemma returns.",
        failureReason,
        requiresSelection: false,
        selectablePersonnel: [],
      };
    }
  }
}

/**
 * "Randomly select a personnel. Unless [requirements], kill + stop all + return."
 */
function resolveRandomThenCheck(
  rule: Extract<DilemmaCard["rule"], { type: "randomThenCheck" }>,
  cards: Card[],
  grantedSkills: GrantedSkill[]
): DilemmaResolution {
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

  const target = shuffle(unstopped)[0]!;

  const stats = calculateGroupStats(cards, grantedSkills, {
    isFacingDilemma: true,
  });

  if (checkRequirements(rule.requirements, stats, cards)) {
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

  const othersToStop = unstopped
    .filter((p) => p.uniqueId !== target.uniqueId)
    .map((p) => p.uniqueId!);

  return {
    stoppedPersonnel: othersToStop,
    killedPersonnel: [target.uniqueId!],
    overcome: false,
    returnsToPile: true,
    message: `Skills not met. ${target.name} killed, all others stopped.`,
    failureReason: `Needed: ${formatRequirements(rule.requirements)}`,
    requiresSelection: false,
    selectablePersonnel: [],
  };
}

/**
 * "Randomly stop personnel based on crew size thresholds."
 */
function resolveRandomStop(
  rule: Extract<DilemmaCard["rule"], { type: "randomStop" }>,
  cards: Card[]
): DilemmaResolution {
  const stoppedIds: string[] = [];
  const stoppedNames: string[] = [];
  let remaining = shuffle([...getUnstoppedPersonnel(cards)]);

  for (const stop of rule.stops) {
    if (remaining.length >= stop.remainingThreshold) {
      remaining = shuffle(remaining);
      const stopped = remaining.shift()!;
      stoppedIds.push(stopped.uniqueId!);
      stoppedNames.push(stopped.name);
    }
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
 * "Keep N random personnel, stop rest. Dilemma stays on mission."
 */
function resolveCrewLimit(
  rule: Extract<DilemmaCard["rule"], { type: "crewLimit" }>,
  cards: Card[]
): DilemmaResolution {
  const unstopped = getUnstoppedPersonnel(cards);

  if (unstopped.length <= rule.keepCount) {
    return {
      stoppedPersonnel: [],
      killedPersonnel: [],
      overcome: false,
      returnsToPile: false,
      message: `${rule.keepCount} or fewer personnel. Dilemma stays on mission.`,
      requiresSelection: false,
      selectablePersonnel: [],
    };
  }

  const toStop = shuffle(unstopped).slice(rule.keepCount);

  return {
    stoppedPersonnel: toStop.map((p) => p.uniqueId!),
    killedPersonnel: [],
    overcome: false,
    returnsToPile: false,
    message: `${toStop.length} personnel stopped. Dilemma stays on mission.`,
    requiresSelection: false,
    selectablePersonnel: [],
  };
}

// =============================================================================
// MAIN RESOLVER
// =============================================================================

export function resolveDilemma(
  dilemma: DilemmaCard,
  cards: Card[],
  grantedSkills: GrantedSkill[] = []
): DilemmaResolution {
  switch (dilemma.rule.type) {
    case "chooseToStop":
      return resolveChooseToStop(dilemma.rule, cards, grantedSkills);
    case "unlessCheck":
      return resolveUnlessCheck(dilemma.rule, cards, grantedSkills);
    case "randomThenCheck":
      return resolveRandomThenCheck(dilemma.rule, cards, grantedSkills);
    case "randomStop":
      return resolveRandomStop(dilemma.rule, cards);
    case "crewLimit":
      return resolveCrewLimit(dilemma.rule, cards);
    default:
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
): DilemmaResolution {
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
