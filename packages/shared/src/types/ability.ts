import type { Affiliation, CardType, Skill } from "./card";

/**
 * When an ability is evaluated/triggered
 */
export type AbilityTrigger =
  | "passive" // Always active while card is in play
  | "whilePlaying" // During deployment cost calculation (before card enters play)
  | "whileFacingDilemma" // Only active while this personnel is facing a dilemma
  | "onDeploy" // When this card enters play
  | "onAttempt" // When mission attempt starts
  | "onStop" // When this card is stopped
  | "onKill" // When this card would be killed
  | "activated" // Player chooses to activate
  | "order" // Order action - can only be used during Execute Orders phase
  | "interlink" // Interlink - can only be used during mission attempts when this personnel is attempting
  | "interrupt" // Interrupt - played from hand in response to a game event
  | "event"; // Event - played from hand during PlayAndDraw, effect resolves then card is destroyed/removed

/**
 * Timing windows when an interrupt can be played
 */
export type InterruptTiming = "whenFacingDilemma"; // When personnel are about to face a dilemma

/**
 * Ownership condition for counting cards
 * - "commanded": Cards you have in play (you command them)
 * - "owned": Cards you started the game with (you own them)
 * - "commandedNotOwned": Cards you command but don't own (e.g., taken from opponent)
 */
export type OwnershipCondition = "commanded" | "owned" | "commandedNotOwned";

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
 * Effect that modifies deployment cost
 */
export interface CostModifierEffect {
  type: "costModifier";
  value: number;
  perMatchingCard?: {
    cardTypes?: CardType[];
    ownership: OwnershipCondition;
  };
}

/**
 * Filter for skill sources (personnel whose skills can be copied)
 */
export interface SkillSourceFilter {
  scope: TargetScope;
  affiliations?: Affiliation[];
  species?: string[];
  excludeAffiliations?: Affiliation[];
  excludeSpecies?: string[];
}

/**
 * Effect that grants a skill to matching cards
 */
export interface SkillGrantEffect {
  type: "skillGrant";
  skill: Skill | null;
  skillSource?: SkillSourceFilter;
}

/**
 * Effect that refreshes the hand by cycling cards through the deck
 */
export interface HandRefreshEffect {
  type: "handRefresh";
}

/**
 * Effect that beams personnel at this mission aboard a ship at the same mission
 */
export interface BeamAllToShipEffect {
  type: "beamAllToShip";
}

/**
 * Effect that modifies a ship's range
 */
export interface ShipRangeModifierEffect {
  type: "shipRangeModifier";
  value: number;
  targetShip: "sourceShip";
}

/**
 * Effect that prevents the current dilemma from being faced and overcomes it
 */
export interface PreventAndOvercomeDilemmaEffect {
  type: "preventAndOvercomeDilemma";
}

/**
 * Effect that recovers cards from the discard pile to the deck
 */
export interface RecoverFromDiscardEffect {
  type: "recoverFromDiscard";
  maxCount: number;
  cardTypes: CardType[];
  destination: "deckBottom" | "deckTop" | "hand";
}

/**
 * Cost to activate an ability
 */
export type AbilityCost =
  | { type: "discardFromDeck"; count: number }
  | { type: "discardFromHand"; count: number }
  | { type: "stopSelf" }
  | { type: "sacrificeSelf" }
  | { type: "returnToHand" };

/**
 * Condition that must be met for an ability to be usable
 */
export type AbilityCondition =
  | { type: "aboardShip" }
  | { type: "atPlanet" }
  | { type: "hasPersonnelPresent"; count: number }
  | { type: "borgPersonnelFacing" }
  | { type: "dilemmaOvercomeAtAnyMission" };

/**
 * Duration for temporary effects
 */
export type EffectDuration =
  | "untilEndOfTurn"
  | "untilEndOfMissionAttempt"
  | "permanent";

/**
 * Usage limit for activated abilities
 */
export type UsageLimit = "oncePerTurn" | "oncePerGame" | "unlimited";

/**
 * Union type for all ability effects
 */
export type AbilityEffect =
  | StatModifierEffect
  | CostModifierEffect
  | SkillGrantEffect
  | HandRefreshEffect
  | BeamAllToShipEffect
  | ShipRangeModifierEffect
  | PreventAndOvercomeDilemmaEffect
  | RecoverFromDiscardEffect;

/**
 * Complete ability definition
 */
export interface Ability {
  id: string;
  trigger: AbilityTrigger;
  target: TargetFilter;
  effects: AbilityEffect[];
  cost?: AbilityCost;
  duration?: EffectDuration;
  usageLimit?: UsageLimit;
  condition?: AbilityCondition;
  conditions?: AbilityCondition[];
  interruptTiming?: InterruptTiming;
  removeFromGame?: boolean;
}
