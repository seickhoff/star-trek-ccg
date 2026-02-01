import type {
  Card,
  DilemmaCard,
  MissionCard,
  PersonnelCard,
  ShipCard,
  Skill,
} from "./card";

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
}

// Player's complete game state
export interface GameState {
  // Deck zones
  deck: Card[]; // Draw pile
  hand: Card[]; // Cards in hand
  discard: Card[]; // Discard pile
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
