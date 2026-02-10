import type { Skill } from "../types/card.js";

/**
 * Base interface for all client-to-server actions
 */
export interface BaseAction {
  type: string;
  requestId: string; // Client-generated UUID for request/response correlation
}

// ============================================================================
// Connection actions
// ============================================================================

export interface JoinGameAction extends BaseAction {
  type: "JOIN_GAME";
  gameId: string;
  playerId: string;
  playerName: string;
}

// ============================================================================
// Game setup actions
// ============================================================================

export interface SetupGameAction extends BaseAction {
  type: "SETUP_GAME";
  deckCardIds: string[];
}

export interface ResetGameAction extends BaseAction {
  type: "RESET_GAME";
}

// ============================================================================
// Play and Draw phase actions
// ============================================================================

export interface DrawAction extends BaseAction {
  type: "DRAW";
  count: number;
}

export interface DeployAction extends BaseAction {
  type: "DEPLOY";
  cardUniqueId: string;
  missionIndex?: number;
}

export interface PlayEventAction extends BaseAction {
  type: "PLAY_EVENT";
  cardUniqueId: string;
  params?: {
    selectedCardIds?: string[];
  };
}

// ============================================================================
// Execute Orders phase actions
// ============================================================================

export interface NextPhaseAction extends BaseAction {
  type: "NEXT_PHASE";
}

export interface MoveShipAction extends BaseAction {
  type: "MOVE_SHIP";
  sourceMission: number;
  groupIndex: number;
  destMission: number;
}

export interface BeamToShipAction extends BaseAction {
  type: "BEAM_TO_SHIP";
  personnelId: string;
  missionIndex: number;
  fromGroup: number;
  toGroup: number;
}

export interface BeamToPlanetAction extends BaseAction {
  type: "BEAM_TO_PLANET";
  personnelId: string;
  missionIndex: number;
  fromGroup: number;
}

export interface BeamAllToShipAction extends BaseAction {
  type: "BEAM_ALL_TO_SHIP";
  missionIndex: number;
  fromGroup: number;
  toGroup: number;
}

export interface BeamAllToPlanetAction extends BaseAction {
  type: "BEAM_ALL_TO_PLANET";
  missionIndex: number;
  fromGroup: number;
}

export interface AttemptMissionAction extends BaseAction {
  type: "ATTEMPT_MISSION";
  missionIndex: number;
  groupIndex: number;
}

export interface ExecuteOrderAbilityAction extends BaseAction {
  type: "EXECUTE_ORDER_ABILITY";
  cardUniqueId: string;
  abilityId: string;
  params?: {
    skill?: Skill;
    personnelIds?: string[];
    targetGroupIndex?: number;
  };
}

// ============================================================================
// Dilemma encounter actions
// ============================================================================

export interface SelectPersonnelForDilemmaAction extends BaseAction {
  type: "SELECT_PERSONNEL_FOR_DILEMMA";
  personnelId: string;
}

export interface AdvanceDilemmaAction extends BaseAction {
  type: "ADVANCE_DILEMMA";
}

export interface ClearDilemmaEncounterAction extends BaseAction {
  type: "CLEAR_DILEMMA_ENCOUNTER";
}

export interface ExecuteInterlinkAbilityAction extends BaseAction {
  type: "EXECUTE_INTERLINK_ABILITY";
  cardUniqueId: string;
  abilityId: string;
  params?: {
    skill?: Skill;
  };
}

export interface PlayInterruptAction extends BaseAction {
  type: "PLAY_INTERRUPT";
  cardUniqueId: string;
  abilityId: string;
}

/**
 * Human selects which dilemmas to use against the AI during its mission attempt.
 * selectedDilemmaUniqueIds is ordered (first = top of stack, faced first).
 */
export interface SelectDilemmasAction extends BaseAction {
  type: "SELECT_DILEMMAS";
  selectedDilemmaUniqueIds: string[];
}

// ============================================================================
// Discard Excess phase actions
// ============================================================================

export interface DiscardCardAction extends BaseAction {
  type: "DISCARD_CARD";
  cardUniqueId: string;
}

// ============================================================================
// Union type for all game actions
// ============================================================================

export type GameAction =
  | JoinGameAction
  | SetupGameAction
  | ResetGameAction
  | DrawAction
  | DeployAction
  | PlayEventAction
  | NextPhaseAction
  | MoveShipAction
  | BeamToShipAction
  | BeamToPlanetAction
  | BeamAllToShipAction
  | BeamAllToPlanetAction
  | AttemptMissionAction
  | ExecuteOrderAbilityAction
  | SelectPersonnelForDilemmaAction
  | AdvanceDilemmaAction
  | ClearDilemmaEncounterAction
  | ExecuteInterlinkAbilityAction
  | PlayInterruptAction
  | DiscardCardAction
  | SelectDilemmasAction;

/**
 * Extract action type from action object
 */
export type ActionType = GameAction["type"];
