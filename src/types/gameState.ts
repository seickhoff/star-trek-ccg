import type {
  Card,
  DilemmaCard,
  MissionCard,
  PersonnelCard,
  ShipCard,
  Skill,
} from "./card";
import type { EffectDuration, TargetFilter } from "./ability";

// Game phase enum
export type GamePhase = "PlayAndDraw" | "ExecuteOrders" | "DiscardExcess";

// Phase index mapping (for compatibility with original code)
export const PHASE_INDEX: Record<GamePhase, number> = {
  PlayAndDraw: 0,
  ExecuteOrders: 1,
  DiscardExcess: 2,
};

export const PHASE_FROM_INDEX: Record<number, GamePhase> = {
  0: "PlayAndDraw",
  1: "ExecuteOrders",
  2: "DiscardExcess",
};

// A group of cards at a mission (e.g., personnel on planet, personnel on ship)
export interface CardGroup {
  cards: Card[];
}

// Cards deployed at a single mission location
export interface MissionDeployment {
  mission: MissionCard;
  // Group 0 is planet personnel (if planet) or personnel without ship (if space)
  // Groups 1+ are ships with their crews
  groups: CardGroup[];
  dilemmas: DilemmaCard[];
}

// Current dilemma encounter state
export interface DilemmaEncounter {
  missionIndex: number;
  groupIndex: number;
  selectedDilemmas: DilemmaCard[];
  currentDilemmaIndex: number;
  // Rule 6.2: Dilemma cost budget
  // "That number is also the total cost in dilemmas your opponent can spend on dilemmas."
  costBudget: number; // Total cost available (personnel count - overcome dilemmas)
  costSpent: number; // Cost spent so far on faced dilemmas
  // Rule 6.5: Duplicate dilemma detection
  // "If your opponent reveals more than one copy of the same dilemma in a mission attempt,
  // your personnel do not face that dilemma and it is overcome."
  facedDilemmaIds: string[]; // Track base IDs (not uniqueIds) of faced dilemmas
}

/**
 * Tracks a granted skill from an order ability
 *
 * Example: Borg Queen grants "Navigation" to all Borg until end of turn
 */
export interface GrantedSkill {
  skill: Skill;
  target: TargetFilter; // Which cards gain this skill
  duration: EffectDuration;
  sourceCardId: string; // The card that granted the skill (uniqueId)
  sourceAbilityId: string; // The ability that granted it
}

/**
 * Tracks a temporary range boost on a ship
 *
 * Example: Transwarp Drone grants Range +2 to a ship until end of turn
 */
export interface RangeBoost {
  shipUniqueId: string; // The ship that gains the range boost
  value: number; // Amount to add to range
  duration: EffectDuration;
  sourceCardId: string; // The card that granted the boost (uniqueId)
  sourceAbilityId: string; // The ability that granted it
}

/**
 * Tracks usage of order abilities (for "once per turn" limits)
 * Key format: `${cardUniqueId}:${abilityId}`
 */
export type UsedOrderAbilities = Set<string>;

// Player's complete game state
export interface GameState {
  // Deck zones
  deck: Card[]; // Draw pile
  hand: Card[]; // Cards in hand
  discard: Card[]; // Discard pile
  removedFromGame: Card[]; // Cards removed from the game (cannot be recovered)
  dilemmaPool: DilemmaCard[]; // Available dilemmas to draw

  // Board state - 5 missions with deployments
  missions: MissionDeployment[];

  // Tracking unique cards (by name) that are in play
  uniquesInPlay: Set<string>;

  // Turn state
  turn: number;
  phase: GamePhase;
  counters: number; // Counters remaining this turn (start with 7)

  // Score tracking
  score: number;
  completedPlanetMissions: number;
  completedSpaceMissions: number;

  // Active dilemma encounter (null if not in encounter)
  dilemmaEncounter: DilemmaEncounter | null;

  // Order ability tracking
  usedOrderAbilities: UsedOrderAbilities; // Abilities used this turn
  grantedSkills: GrantedSkill[]; // Active skill grants
  rangeBoosts: RangeBoost[]; // Active range boosts on ships

  // Game result
  gameOver: boolean;
  victory: boolean;
}

// Group statistics for mission attempts
export interface GroupStats {
  integrity: number;
  cunning: number;
  strength: number;
  skills: Map<Skill, number>; // Skill -> count
  personnel: PersonnelCard[];
  ships: ShipCard[];
}

// Initial game state factory
export function createInitialGameState(): GameState {
  return {
    deck: [],
    hand: [],
    discard: [],
    removedFromGame: [],
    dilemmaPool: [],
    missions: [],
    uniquesInPlay: new Set(),
    turn: 1,
    phase: "PlayAndDraw",
    counters: 7,
    score: 0,
    completedPlanetMissions: 0,
    completedSpaceMissions: 0,
    dilemmaEncounter: null,
    usedOrderAbilities: new Set(),
    grantedSkills: [],
    rangeBoosts: [],
    gameOver: false,
    victory: false,
  };
}

// Game constants
export const GAME_CONSTANTS = {
  STARTING_COUNTERS: 7,
  MAX_HAND_SIZE: 7,
  WIN_SCORE: 100,
  MISSION_COUNT: 5,
} as const;

// Action log entry types
export type ActionLogType =
  | "game_start"
  | "new_turn"
  | "phase_change"
  | "draw"
  | "deploy"
  | "discard"
  | "move_ship"
  | "beam"
  | "mission_attempt"
  | "dilemma_draw"
  | "dilemma_result"
  | "mission_complete"
  | "mission_fail"
  | "order_ability"
  | "interlink"
  | "interrupt"
  | "event"
  | "game_over";

// Action log entry for tracking game events
export interface ActionLogEntry {
  id: string; // Unique ID for React key
  timestamp: number;
  type: ActionLogType;
  message: string;
  details?: string; // Optional secondary details
}
