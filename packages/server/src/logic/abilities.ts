import type {
  Ability,
  AbilityEffect,
  CostModifierEffect,
  OwnershipCondition,
  TargetFilter,
  Card,
  PersonnelCard,
  ShipCard,
  Skill,
  GrantedSkill,
} from "@stccg/shared";
import { isPersonnel } from "@stccg/shared";

/**
 * Effective stats after applying all passive ability modifiers
 */
export interface EffectiveStats {
  integrity: number;
  cunning: number;
  strength: number;
}

/**
 * Context for ability resolution
 */
export interface AbilityContext {
  /** Whether the personnel is currently facing a dilemma */
  isFacingDilemma?: boolean;
}

/**
 * Check if a personnel card matches a target filter
 *
 * @param personnel - The personnel to check
 * @param filter - The target filter from an ability
 * @param sourceCard - The card providing the ability (for excludeSelf and self scope checks)
 */
export function matchesTargetFilter(
  personnel: PersonnelCard,
  filter: TargetFilter,
  sourceCard: Card
): boolean {
  // Check scope: "self" means only the source card matches
  if (filter.scope === "self" && personnel.uniqueId !== sourceCard.uniqueId) {
    return false;
  }

  // Check excludeSelf
  if (filter.excludeSelf && personnel.uniqueId === sourceCard.uniqueId) {
    return false;
  }

  // Check species filter
  if (filter.species && filter.species.length > 0) {
    const hasMatchingSpecies = filter.species.some((species) =>
      personnel.species.includes(species)
    );
    if (!hasMatchingSpecies) {
      return false;
    }
  }

  // Check affiliation filter
  if (filter.affiliations && filter.affiliations.length > 0) {
    const hasMatchingAffiliation = filter.affiliations.some((affil) =>
      personnel.affiliation.includes(affil)
    );
    if (!hasMatchingAffiliation) {
      return false;
    }
  }

  // Check card type filter (for personnel, this is always "Personnel")
  if (filter.cardTypes && filter.cardTypes.length > 0) {
    if (!filter.cardTypes.includes(personnel.type)) {
      return false;
    }
  }

  return true;
}

/**
 * Apply a single ability effect to stats
 */
function applyEffect(
  stats: EffectiveStats,
  effect: AbilityEffect
): EffectiveStats {
  if (effect.type === "statModifier") {
    const newStats = { ...stats };
    switch (effect.stat) {
      case "strength":
        newStats.strength += effect.value;
        break;
      case "integrity":
        newStats.integrity += effect.value;
        break;
      case "cunning":
        newStats.cunning += effect.value;
        break;
    }
    return newStats;
  }
  // Future effect types would be handled here
  return stats;
}

/**
 * Collect all passive abilities from cards that affect a target personnel
 *
 * @param targetPersonnel - The personnel whose stats we're calculating
 * @param presentCards - All cards "present" with the target (same group)
 * @param context - Optional context for ability resolution (e.g., during dilemma)
 * @returns Array of abilities that apply to the target
 */
export function collectApplicableAbilities(
  targetPersonnel: PersonnelCard,
  presentCards: Card[],
  context: AbilityContext = {}
): { ability: Ability; sourceCard: Card }[] {
  const applicable: { ability: Ability; sourceCard: Card }[] = [];

  for (const card of presentCards) {
    // Only personnel can have abilities (for now)
    if (!isPersonnel(card) || !card.abilities) {
      continue;
    }

    for (const ability of card.abilities) {
      // Process passive abilities always
      // Process whileFacingDilemma abilities only during dilemma resolution
      const isPassive = ability.trigger === "passive";
      const isDilemmaAbility =
        ability.trigger === "whileFacingDilemma" && context.isFacingDilemma;

      if (!isPassive && !isDilemmaAbility) {
        continue;
      }

      // Check if target matches the filter
      if (matchesTargetFilter(targetPersonnel, ability.target, card)) {
        applicable.push({ ability, sourceCard: card });
      }
    }
  }

  return applicable;
}

/**
 * Calculate effective stats for a personnel considering all passive abilities
 * from cards that are "present" with them.
 *
 * Per rulebook "PRESENT" definition:
 * - If on a headquarters, present with other personnel/equipment on same HQ
 * - If on a planet, present with other personnel/equipment on same planet
 * - If aboard a ship, present with other personnel/equipment on same ship
 *   (NOT with personnel on the planet if ship is at a planet)
 *
 * @param personnel - The personnel card to calculate stats for
 * @param presentCards - All cards in the same group (representing "present")
 * @param context - Optional context for ability resolution (e.g., during dilemma)
 * @returns Effective stats after all modifiers
 */
export function getEffectiveStats(
  personnel: PersonnelCard,
  presentCards: Card[],
  context: AbilityContext = {}
): EffectiveStats {
  // Start with base stats
  let stats: EffectiveStats = {
    integrity: personnel.integrity,
    cunning: personnel.cunning,
    strength: personnel.strength,
  };

  // Collect all applicable passive abilities (and whileFacingDilemma if in context)
  const applicable = collectApplicableAbilities(
    personnel,
    presentCards,
    context
  );

  // Apply all effects
  for (const { ability } of applicable) {
    for (const effect of ability.effects) {
      stats = applyEffect(stats, effect);
    }
  }

  return stats;
}

/**
 * Calculate effective stats for all personnel in a group
 * Returns a map from uniqueId to effective stats
 */
export function getGroupEffectiveStats(
  cards: Card[]
): Map<string, EffectiveStats> {
  const statsMap = new Map<string, EffectiveStats>();

  for (const card of cards) {
    if (isPersonnel(card) && card.uniqueId) {
      statsMap.set(card.uniqueId, getEffectiveStats(card, cards));
    }
  }

  return statsMap;
}

/**
 * Check if a card matches an ownership condition
 *
 * @param card - The card to check
 * @param condition - The ownership condition to check against
 * @param currentPlayerId - The ID of the player deploying the card
 */
export function matchesOwnershipCondition(
  card: Card,
  condition: OwnershipCondition,
  currentPlayerId: string
): boolean {
  // In current solitaire mode, ownerId is typically undefined or matches currentPlayerId
  const isOwned =
    card.ownerId === undefined || card.ownerId === currentPlayerId;
  const isCommanded = true; // All cards in play are commanded by the player in solitaire

  switch (condition) {
    case "commanded":
      return isCommanded;
    case "owned":
      return isOwned;
    case "commandedNotOwned":
      return isCommanded && !isOwned;
  }
}

/**
 * Count cards in play that match a cost modifier's perMatchingCard filter
 *
 * @param cardsInPlay - All cards currently in play
 * @param effect - The cost modifier effect with perMatchingCard filter
 * @param currentPlayerId - The ID of the player deploying the card
 */
export function countMatchingCardsForCost(
  cardsInPlay: Card[],
  effect: CostModifierEffect,
  currentPlayerId: string
): number {
  if (!effect.perMatchingCard) {
    return 1; // No per-card modifier, just apply value once
  }

  let count = 0;
  for (const card of cardsInPlay) {
    // Check card type filter
    if (effect.perMatchingCard.cardTypes) {
      if (!effect.perMatchingCard.cardTypes.includes(card.type)) {
        continue;
      }
    }

    // Check ownership condition
    if (
      !matchesOwnershipCondition(
        card,
        effect.perMatchingCard.ownership,
        currentPlayerId
      )
    ) {
      continue;
    }

    count++;
  }

  return count;
}

/**
 * Calculate the effective deployment cost of a card considering all cost modifier abilities
 *
 * @param card - The card being deployed (must have a deploy cost)
 * @param cardsInPlay - All cards currently in play (for counting)
 * @param currentPlayerId - The ID of the player deploying the card
 * @returns The effective deployment cost (minimum 0)
 */
export function getEffectiveDeployCost(
  card: PersonnelCard | ShipCard,
  cardsInPlay: Card[],
  currentPlayerId: string
): number {
  let cost = card.deploy;

  // Check for cost modifier abilities on the card being deployed
  if (isPersonnel(card) && card.abilities) {
    for (const ability of card.abilities) {
      // Only process whilePlaying abilities for cost modification
      if (ability.trigger !== "whilePlaying") {
        continue;
      }

      for (const effect of ability.effects) {
        if (effect.type === "costModifier") {
          const multiplier = countMatchingCardsForCost(
            cardsInPlay,
            effect,
            currentPlayerId
          );
          cost += effect.value * multiplier;
        }
      }
    }
  }

  // Cost cannot go below 0
  return Math.max(0, cost);
}

/**
 * Check if a personnel matches a target filter for granted skills
 * (Simplified version without sourceCard check since granted skills
 * track their source separately)
 *
 * @param personnel - The personnel to check
 * @param filter - The target filter from the granted skill
 */
export function matchesGrantedSkillTarget(
  personnel: PersonnelCard,
  filter: TargetFilter
): boolean {
  // Check species filter
  if (filter.species && filter.species.length > 0) {
    const hasMatchingSpecies = filter.species.some((species) =>
      personnel.species.includes(species)
    );
    if (!hasMatchingSpecies) {
      return false;
    }
  }

  // Check affiliation filter
  if (filter.affiliations && filter.affiliations.length > 0) {
    const hasMatchingAffiliation = filter.affiliations.some((affil) =>
      personnel.affiliation.includes(affil)
    );
    if (!hasMatchingAffiliation) {
      return false;
    }
  }

  // Check card type filter
  if (filter.cardTypes && filter.cardTypes.length > 0) {
    if (!filter.cardTypes.includes(personnel.type)) {
      return false;
    }
  }

  return true;
}

/**
 * Get all skills granted to a personnel from active granted skills
 *
 * @param personnel - The personnel to get granted skills for
 * @param grantedSkills - All currently active granted skills
 * @returns Array of skills granted to this personnel
 */
export function getGrantedSkillsForPersonnel(
  personnel: PersonnelCard,
  grantedSkills: GrantedSkill[]
): Skill[] {
  const skills: Skill[] = [];

  for (const grant of grantedSkills) {
    // Check if this personnel matches the grant's target filter
    // For "allInPlay" scope, check if the personnel matches the filter
    if (
      grant.target.scope === "allInPlay" &&
      matchesGrantedSkillTarget(personnel, grant.target)
    ) {
      skills.push(grant.skill);
    }
    // Add other scope types as needed
  }

  return skills;
}

/**
 * Get skills granted to a personnel by whileFacingDilemma abilities
 *
 * This checks abilities on all present cards that grant skills when facing a dilemma.
 *
 * @param personnel - The personnel to get skills for
 * @param presentCards - All cards present with the personnel
 * @returns Array of skills granted during dilemma resolution
 */
export function getDilemmaGrantedSkills(
  personnel: PersonnelCard,
  presentCards: Card[]
): Skill[] {
  const skills: Skill[] = [];

  for (const card of presentCards) {
    if (!isPersonnel(card) || !card.abilities) {
      continue;
    }

    for (const ability of card.abilities) {
      // Only process whileFacingDilemma abilities
      if (ability.trigger !== "whileFacingDilemma") {
        continue;
      }

      // Check if target matches the personnel
      if (!matchesTargetFilter(personnel, ability.target, card)) {
        continue;
      }

      // Extract skill grants from effects
      for (const effect of ability.effects) {
        if (effect.type === "skillGrant" && effect.skill) {
          skills.push(effect.skill);
        }
      }
    }
  }

  return skills;
}
