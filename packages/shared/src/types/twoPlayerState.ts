import type {
  MissionDeployment,
  GamePhase,
  ActionLogEntry,
} from "./gameState.js";
import type { SerializableGameState } from "./gameState.js";

/**
 * Opponent's state visible to the other player.
 * Hides hand contents, deck order, and dilemma pool details.
 */
export interface OpponentPublicState {
  missions: MissionDeployment[];
  score: number;
  deckCount: number;
  handCount: number;
  discardCount: number;
  dilemmaPoolCount: number;
  turn: number;
  phase: GamePhase;
  completedPlanetMissions: number;
  completedSpaceMissions: number;
  gameOver: boolean;
  victory: boolean;
  headquartersIndex: number;
  actionLog: ActionLogEntry[];
}

/**
 * Combined two-player game state sent to each client.
 * Each player gets their own full state + a limited view of the opponent.
 */
export interface TwoPlayerGameState {
  myState: SerializableGameState;
  opponentState: OpponentPublicState;
  activePlayer: 1 | 2;
  myPlayerNumber: 1 | 2;
  winner: 1 | 2 | null;
  /** Unmasked opponent missions for AI debug view (only populated when AI_DEBUG is enabled) */
  debugOpponentMissions?: MissionDeployment[];
}
