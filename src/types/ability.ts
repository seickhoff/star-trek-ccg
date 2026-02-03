import type { Affiliation, CardType } from "./card";

/**
 * When an ability is evaluated/triggered
 */
export type AbilityTrigger =
  | "passive" // Always active while card is in play
  | "onDeploy" // When this card enters play
  | "onAttempt" // When mission attempt starts
  | "onStop" // When this card is stopped
  | "onKill" // When this card would be killed
  | "activated"; // Player chooses to activate

/**
 * Scope of cards that can be affected by an ability
 *
 * Per rulebook:
 * - "present": Cards in same group (ship crew or planet surface)
 *   - If aboard a ship at a planet, only present with ship crew, NOT planet personnel
 * - "self": Only this card
 * - "mission": All cards at this mission location (all groups)
 * - "allInPlay": All cards currently in play
 */
export type TargetScope = "present" | "self" | "mission" | "allInPlay";

/**
 * Filter to determine which cards are affected by an ability
 */
export interface TargetFilter {
  scope: TargetScope;
  cardTypes?: CardType[];
  affiliations?: Affiliation[];
  species?: string[];
  excludeSelf?: boolean;
}

/**
 * Effect that modifies a stat (Strength, Integrity, Cunning)
 */
export interface StatModifierEffect {
  type: "statModifier";
  stat: "strength" | "integrity" | "cunning";
  value: number;
}

/**
 * Union type for all ability effects
 * Add new effect types here as they're implemented
 */
export type AbilityEffect = StatModifierEffect;

/**
 * Complete ability definition
 *
 * Example - Opposition Drone: "Each of your other Borg present is Strength +1"
 * {
 *   id: "opposition-drone-strength",
 *   trigger: "passive",
 *   target: { scope: "present", species: ["Borg"], excludeSelf: true },
 *   effects: [{ type: "statModifier", stat: "strength", value: 1 }]
 * }
 */
export interface Ability {
  id: string;
  trigger: AbilityTrigger;
  target: TargetFilter;
  effects: AbilityEffect[];
}
