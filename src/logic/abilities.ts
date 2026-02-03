import type { Ability, AbilityEffect, TargetFilter } from "../types/ability";
import type { Card, PersonnelCard } from "../types/card";
import { isPersonnel } from "../types/card";

/**
 * Effective stats after applying all passive ability modifiers
 */
export interface EffectiveStats {
  integrity: number;
  cunning: number;
  strength: number;
}

/**
 * Check if a personnel card matches a target filter
 *
 * @param personnel - The personnel to check
 * @param filter - The target filter from an ability
 * @param sourceCard - The card providing the ability (for excludeSelf check)
 */
export function matchesTargetFilter(
  personnel: PersonnelCard,
  filter: TargetFilter,
  sourceCard: Card
): boolean {
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
 * @returns Array of abilities that apply to the target
 */
export function collectApplicableAbilities(
  targetPersonnel: PersonnelCard,
  presentCards: Card[]
): { ability: Ability; sourceCard: Card }[] {
  const applicable: { ability: Ability; sourceCard: Card }[] = [];

  for (const card of presentCards) {
    // Only personnel can have abilities (for now)
    if (!isPersonnel(card) || !card.abilities) {
      continue;
    }

    for (const ability of card.abilities) {
      // Only process passive abilities here
      if (ability.trigger !== "passive") {
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
 * @returns Effective stats after all modifiers
 */
export function getEffectiveStats(
  personnel: PersonnelCard,
  presentCards: Card[]
): EffectiveStats {
  // Start with base stats
  let stats: EffectiveStats = {
    integrity: personnel.integrity,
    cunning: personnel.cunning,
    strength: personnel.strength,
  };

  // Collect all applicable passive abilities
  const applicable = collectApplicableAbilities(personnel, presentCards);

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
