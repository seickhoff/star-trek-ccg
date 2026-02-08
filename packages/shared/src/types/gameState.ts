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
  groups: CardGroup[];
  dilemmas: DilemmaCard[];
}

// Current dilemma encounter state
export interface DilemmaEncounter {
  missionIndex: number;
  groupIndex: number;
  selectedDilemmas: DilemmaCard[];
  currentDilemmaIndex: number;
  costBudget: number;
  costSpent: number;
  facedDilemmaIds: string[];
}

/**
 * Tracks a granted skill from an order ability
 */
export interface GrantedSkill {
  skill: Skill;
  target: TargetFilter;
  duration: EffectDuration;
  sourceCardId: string;
  sourceAbilityId: string;
}

/**
 * Tracks a temporary range boost on a ship
 */
export interface RangeBoost {
  shipUniqueId: string;
  value: number;
  duration: EffectDuration;
  sourceCardId: string;
  sourceAbilityId: string;
}

// Group statistics for mission attempts
export interface GroupStats {
  integrity: number;
  cunning: number;
  strength: number;
  skills: Map<Skill, number>;
  personnel: PersonnelCard[];
  ships: ShipCard[];
}

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
  | "game_over"
  | "rejected";

// Action log entry for tracking game events
export interface ActionLogEntry {
  id: string;
  timestamp: number;
  type: ActionLogType;
  message: string;
  details?: string;
}

// Result of resolving a dilemma (for UI display)
export interface DilemmaResult {
  dilemmaName?: string;
  overcome: boolean;
  stoppedPersonnel: string[];
  killedPersonnel: string[];
  requiresSelection?: boolean;
  selectablePersonnel?: PersonnelCard[];
  selectionPrompt?: string;
  returnsToPile?: boolean;
  message?: string;
}

// ============================================================================
// Serializable versions for WebSocket transmission
// (Convert Set<string> to string[])
// ============================================================================

/**
 * Serializable game state sent over WebSocket
 * All Set<T> converted to T[] for JSON serialization
 */
export interface SerializableGameState {
  // Deck zones
  deck: Card[];
  hand: Card[];
  discard: Card[];
  removedFromGame: Card[];
  dilemmaPool: DilemmaCard[];

  // Board state
  missions: MissionDeployment[];

  // Tracking - converted from Set<string> to string[]
  uniquesInPlay: string[];

  // Turn state
  turn: number;
  phase: GamePhase;
  counters: number;

  // Score tracking
  score: number;
  completedPlanetMissions: number;
  completedSpaceMissions: number;

  // Active dilemma encounter
  dilemmaEncounter: DilemmaEncounter | null;
  dilemmaResult: DilemmaResult | null;

  // Order ability tracking - converted from Set<string> to string[]
  usedOrderAbilities: string[];
  grantedSkills: GrantedSkill[];
  rangeBoosts: RangeBoost[];

  // Game result
  gameOver: boolean;
  victory: boolean;

  // UI helpers
  headquartersIndex: number;

  // Action log
  actionLog: ActionLogEntry[];
}

// ============================================================================
// Game constants
// ============================================================================

export const GAME_CONSTANTS = {
  STARTING_COUNTERS: 7,
  MAX_HAND_SIZE: 7,
  WIN_SCORE: 100,
  MISSION_COUNT: 5,
} as const;
