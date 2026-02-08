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
 *
 * Can be a flat modifier or dynamic based on counting cards.
 *
 * Example - Acclimation Drone: "for each personnel you command but do not own, cost -1"
 * {
 *   type: "costModifier",
 *   value: -1,
 *   perMatchingCard: { cardTypes: ["Personnel"], ownership: "commandedNotOwned" }
 * }
 */
export interface CostModifierEffect {
  type: "costModifier";
  value: number; // Modifier value (negative for reduction)
  perMatchingCard?: {
    // If present, value is applied per matching card
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
  excludeAffiliations?: Affiliation[]; // For "non-Borg"
  excludeSpecies?: string[];
}

/**
 * Effect that grants a skill to matching cards
 *
 * The skill to grant can be:
 * - Fixed: specified in the effect definition
 * - Player choice: skill is null, player selects at activation time
 * - From source: skill is null with skillSource filter, player picks from matching personnel's skills
 *
 * Example - Borg Queen: "name a skill. Each of your Borg gains that skill"
 * {
 *   type: "skillGrant",
 *   skill: null  // Player chooses any skill
 * }
 *
 * Example - Information Drone: "Interlink: a skill on your non-Borg personnel present"
 * {
 *   type: "skillGrant",
 *   skill: null,
 *   skillSource: { scope: "present", excludeAffiliations: ["Borg"] }
 * }
 */
export interface SkillGrantEffect {
  type: "skillGrant";
  skill: Skill | null; // null means player chooses at activation
  skillSource?: SkillSourceFilter; // If present, skill must come from matching personnel
}

/**
 * Effect that refreshes the hand by cycling cards through the deck
 *
 * The effect:
 * 1. Counts the number of cards in hand
 * 2. Shuffles those cards
 * 3. Places them on the bottom of the deck
 * 4. Draws an equal number of cards
 *
 * Example - Calibration Drone: "count the number of cards in your hand,
 * shuffle them, place them on the bottom of your deck, and draw an equal number of cards"
 * {
 *   type: "handRefresh"
 * }
 */
export interface HandRefreshEffect {
  type: "handRefresh";
}

/**
 * Effect that beams personnel at this mission aboard a ship at the same mission
 *
 * The player selects which personnel to beam and which ship to beam to.
 * All selected personnel are moved from their current group to the ship's group.
 *
 * Example - Invasive Drone: "place any number of your personnel at this mission
 * aboard a ship at the same mission"
 * {
 *   type: "beamAllToShip"
 * }
 */
export interface BeamAllToShipEffect {
  type: "beamAllToShip";
}

/**
 * Effect that modifies a ship's range
 *
 * Used for abilities that boost ship movement capacity.
 * The target is typically "sourceShip" meaning the ship the personnel is aboard.
 *
 * Example - Transwarp Drone: "make that ship Range +2 until the end of this turn"
 * {
 *   type: "shipRangeModifier",
 *   value: 2,
 *   targetShip: "sourceShip"  // The ship the personnel was aboard when activated
 * }
 */
export interface ShipRangeModifierEffect {
  type: "shipRangeModifier";
  value: number; // Positive for boost, negative for penalty
  targetShip: "sourceShip"; // The ship the source personnel was aboard
}

/**
 * Effect that prevents the current dilemma from being faced and overcomes it
 *
 * Used by interrupts like "Adapt" that allow avoiding a dilemma entirely.
 * The dilemma is overcome without any of its effects being applied.
 *
 * Example - Adapt: "prevent and overcome that dilemma"
 * {
 *   type: "preventAndOvercomeDilemma"
 * }
 */
export interface PreventAndOvercomeDilemmaEffect {
  type: "preventAndOvercomeDilemma";
}

/**
 * Effect that recovers cards from the discard pile to the deck
 *
 * Used by events like "Salvaging the Wreckage" that let you retrieve cards
 * from discard and place them on the bottom of your deck.
 *
 * Example - Salvaging the Wreckage: "Take up to four personnel and ship cards
 * from your discard pile and place them on the bottom of your deck in any order."
 * {
 *   type: "recoverFromDiscard",
 *   maxCount: 4,
 *   cardTypes: ["Personnel", "Ship"],
 *   destination: "deckBottom"
 * }
 */
export interface RecoverFromDiscardEffect {
  type: "recoverFromDiscard";
  maxCount: number; // Maximum number of cards to recover
  cardTypes: CardType[]; // Types of cards that can be recovered
  destination: "deckBottom" | "deckTop" | "hand"; // Where recovered cards go
}

/**
 * Cost to activate an ability
 */
export type AbilityCost =
  | { type: "discardFromDeck"; count: number } // Discard top N cards from deck
  | { type: "discardFromHand"; count: number } // Discard N cards from hand
  | { type: "stopSelf" } // Stop this card
  | { type: "sacrificeSelf" } // Place this card in discard pile
  | { type: "returnToHand" }; // Return this card to owner's hand

/**
 * Condition that must be met for an ability to be usable
 */
export type AbilityCondition =
  | { type: "aboardShip" } // This personnel must be aboard a ship
  | { type: "atPlanet" } // This personnel must be at a planet mission surface
  | { type: "hasPersonnelPresent"; count: number } // Must have N personnel present
  | { type: "borgPersonnelFacing" } // At least one Borg personnel must be facing the dilemma
  | { type: "dilemmaOvercomeAtAnyMission" }; // A copy of the current dilemma must be overcome at some mission

/**
 * Duration for temporary effects
 */
export type EffectDuration =
  | "untilEndOfTurn" // Lasts until end of current turn
  | "untilEndOfMissionAttempt" // Lasts until mission attempt ends
  | "permanent"; // Lasts indefinitely (or until card leaves play)

/**
 * Usage limit for activated abilities
 */
export type UsageLimit =
  | "oncePerTurn" // Can only use once per turn
  | "oncePerGame" // Can only use once per game
  | "unlimited"; // No limit

/**
 * Union type for all ability effects
 * Add new effect types here as they're implemented
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
 *
 * Example - Opposition Drone: "Each of your other Borg present is Strength +1"
 * {
 *   id: "opposition-drone-strength",
 *   trigger: "passive",
 *   target: { scope: "present", species: ["Borg"], excludeSelf: true },
 *   effects: [{ type: "statModifier", stat: "strength", value: 1 }]
 * }
 *
 * Example - Borg Queen, Bringer of Order: "Order - Discard the top card of your deck
 * to name a skill. Each of your Borg gains that skill. This effect lasts until
 * the end of this turn. You may do this only once each turn."
 * {
 *   id: "borg-queen-skill-grant",
 *   trigger: "order",
 *   target: { scope: "allInPlay", species: ["Borg"] },
 *   effects: [{ type: "skillGrant", skill: null }],
 *   cost: { type: "discardFromDeck", count: 1 },
 *   duration: "untilEndOfTurn",
 *   usageLimit: "oncePerTurn"
 * }
 */
export interface Ability {
  id: string;
  trigger: AbilityTrigger;
  target: TargetFilter;
  effects: AbilityEffect[];
  // For activated/order abilities
  cost?: AbilityCost;
  duration?: EffectDuration;
  usageLimit?: UsageLimit;
  // Condition that must be met for the ability to be usable (single condition)
  condition?: AbilityCondition;
  // Multiple conditions that must ALL be met (for complex abilities like interrupts)
  conditions?: AbilityCondition[];
  // For interrupt abilities: when can this interrupt be played?
  interruptTiming?: InterruptTiming;
  // For event abilities: card is removed from game instead of going to discard
  removeFromGame?: boolean;
}
