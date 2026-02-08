import type { SerializableGameState, ActionLogEntry } from "../types/gameState";

/**
 * Base interface for all server-to-client events
 */
export interface BaseEvent {
  type: string;
  timestamp: number;
}

// ============================================================================
// Connection events
// ============================================================================

export interface ConnectedEvent extends BaseEvent {
  type: "CONNECTED";
  playerId: string;
  gameId: string;
}

export interface PlayerJoinedEvent extends BaseEvent {
  type: "PLAYER_JOINED";
  playerId: string;
  playerName: string;
  playerNumber: 1 | 2;
}

export interface PlayerDisconnectedEvent extends BaseEvent {
  type: "PLAYER_DISCONNECTED";
  playerId: string;
}

// ============================================================================
// State synchronization events
// ============================================================================

/**
 * Full state sync - sent on initial join or reconnection
 */
export interface StateSyncEvent extends BaseEvent {
  type: "STATE_SYNC";
  state: SerializableGameState;
}

/**
 * Incremental state update - sent after each action
 */
export interface StateUpdateEvent extends BaseEvent {
  type: "STATE_UPDATE";
  state: SerializableGameState;
  requestId: string; // Correlates to the action that caused this update
  newLogEntries: ActionLogEntry[];
}

// ============================================================================
// Action response events
// ============================================================================

/**
 * Action was rejected by the server
 */
export interface ActionRejectedEvent extends BaseEvent {
  type: "ACTION_REJECTED";
  requestId: string;
  reason: string;
}

// ============================================================================
// Game lifecycle events
// ============================================================================

export interface GameStartedEvent extends BaseEvent {
  type: "GAME_STARTED";
  state: SerializableGameState;
}

export interface GameOverEvent extends BaseEvent {
  type: "GAME_OVER";
  victory: boolean;
  finalScore: number;
}

// ============================================================================
// Error events
// ============================================================================

export interface ErrorEvent extends BaseEvent {
  type: "ERROR";
  message: string;
  code?: string;
}

// ============================================================================
// Union type for all game events
// ============================================================================

export type GameEvent =
  | ConnectedEvent
  | PlayerJoinedEvent
  | PlayerDisconnectedEvent
  | StateSyncEvent
  | StateUpdateEvent
  | ActionRejectedEvent
  | GameStartedEvent
  | GameOverEvent
  | ErrorEvent;

/**
 * Extract event type from event object
 */
export type EventType = GameEvent["type"];
