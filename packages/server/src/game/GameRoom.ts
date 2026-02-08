import { WebSocket } from "ws";
import type { GameAction, GameEvent } from "@stccg/shared";
import { GameEngine } from "./GameEngine.js";

/**
 * Player connection info
 */
interface PlayerConnection {
  playerId: string;
  playerName: string;
  ws: WebSocket;
  playerNumber: 1 | 2;
}

/**
 * Manages a single game instance with connected players
 */
export class GameRoom {
  readonly gameId: string;
  private players: Map<string, PlayerConnection> = new Map();
  private engine: GameEngine;
  private lastLogIndex: number = 0;

  constructor(gameId: string) {
    this.gameId = gameId;
    this.engine = new GameEngine();
  }

  /**
   * Add a player to the room
   */
  addPlayer(playerId: string, playerName: string, ws: WebSocket): boolean {
    if (this.players.size >= 2) {
      this.sendToSocket(ws, {
        type: "ERROR",
        timestamp: Date.now(),
        message: "Room is full",
        code: "ROOM_FULL",
      });
      return false;
    }

    const playerNumber = (this.players.size + 1) as 1 | 2;
    this.players.set(playerId, { playerId, playerName, ws, playerNumber });

    console.log(
      `Player ${playerName} (${playerId}) joined room ${this.gameId} as player ${playerNumber}`
    );

    // Send connected event to new player
    this.sendToSocket(ws, {
      type: "CONNECTED",
      timestamp: Date.now(),
      playerId,
      gameId: this.gameId,
    });

    // Notify all players of new player
    this.broadcast({
      type: "PLAYER_JOINED",
      timestamp: Date.now(),
      playerId,
      playerName,
      playerNumber,
    });

    // Send current state to new player
    this.sendToPlayer(playerId, {
      type: "STATE_SYNC",
      timestamp: Date.now(),
      state: this.engine.getSerializableState(),
    });

    return true;
  }

  /**
   * Remove a player from the room
   */
  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      console.log(
        `Player ${player.playerName} (${playerId}) left room ${this.gameId}`
      );

      this.broadcast({
        type: "PLAYER_DISCONNECTED",
        timestamp: Date.now(),
        playerId,
      });
    }
  }

  /**
   * Handle an incoming action from a player
   */
  handleAction(playerId: string, action: GameAction): void {
    const player = this.players.get(playerId);
    if (!player) {
      console.warn(`Action from unknown player: ${playerId}`);
      return;
    }

    console.log(`[${this.gameId}] Player ${playerId} action: ${action.type}`);

    // Execute action on engine
    const result = this.engine.executeAction(action);

    if (result.success) {
      // Get new log entries since last update
      const currentLog = this.engine.getState().actionLog;
      const newLogEntries = currentLog.slice(this.lastLogIndex);
      this.lastLogIndex = currentLog.length;

      // Broadcast state update to all players
      this.broadcast({
        type: "STATE_UPDATE",
        timestamp: Date.now(),
        state: this.engine.getSerializableState(),
        requestId: action.requestId,
        newLogEntries,
      });

      // Check for game over
      const state = this.engine.getState();
      if (state.gameOver) {
        this.broadcast({
          type: "GAME_OVER",
          timestamp: Date.now(),
          victory: state.victory,
          finalScore: state.score,
        });
      }
    } else {
      // Send rejection only to the requesting player
      this.sendToPlayer(playerId, {
        type: "ACTION_REJECTED",
        timestamp: Date.now(),
        requestId: action.requestId,
        reason: result.reason || "Action failed",
      });
    }
  }

  /**
   * Broadcast an event to all connected players
   */
  private broadcast(event: GameEvent): void {
    const message = JSON.stringify(event);
    for (const player of this.players.values()) {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(message);
      }
    }
  }

  /**
   * Send an event to a specific player
   */
  private sendToPlayer(playerId: string, event: GameEvent): void {
    const player = this.players.get(playerId);
    if (player && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(event));
    }
  }

  /**
   * Send an event to a specific socket
   */
  private sendToSocket(ws: WebSocket, event: GameEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  /**
   * Get the number of connected players
   */
  get playerCount(): number {
    return this.players.size;
  }

  /**
   * Check if a player is in this room
   */
  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }
}
