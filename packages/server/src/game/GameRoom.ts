import { WebSocket } from "ws";
import type { GameAction, GameEvent } from "@stccg/shared";
import { TwoPlayerGame } from "./TwoPlayerGame.js";

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
 * Manages a single game instance with connected players.
 * Now uses TwoPlayerGame for human vs AI gameplay.
 */
export class GameRoom {
  readonly gameId: string;
  private players: Map<string, PlayerConnection> = new Map();
  private game: TwoPlayerGame;
  private aiLogIndex = 0;

  constructor(gameId: string) {
    this.gameId = gameId;
    this.game = new TwoPlayerGame();

    // Wire up state change callback for AI actions
    this.game.onStateChange = (isAIAction: boolean) => {
      this.broadcastTwoPlayerState(isAIAction);
    };

    // Wire up direct event delivery to human player
    this.game.onSendToHuman = (event: GameEvent) => {
      for (const player of this.players.values()) {
        if (player.ws.readyState === WebSocket.OPEN) {
          player.ws.send(JSON.stringify(event));
        }
      }
    };
  }

  /**
   * Add a player to the room
   */
  addPlayer(playerId: string, playerName: string, ws: WebSocket): boolean {
    if (this.players.size >= 1) {
      // Only 1 human player — AI is player 2
      this.sendToSocket(ws, {
        type: "ERROR",
        timestamp: Date.now(),
        message: "Room is full",
        code: "ROOM_FULL",
      });
      return false;
    }

    const playerNumber = 1 as const; // Human is always player 1
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

    // Notify player joined
    this.broadcast({
      type: "PLAYER_JOINED",
      timestamp: Date.now(),
      playerId,
      playerName,
      playerNumber,
    });

    // Also notify that AI player 2 is ready
    this.broadcast({
      type: "PLAYER_JOINED",
      timestamp: Date.now(),
      playerId: "ai-player",
      playerName: "AI Opponent",
      playerNumber: 2,
    });

    // Send initial two-player state
    this.sendTwoPlayerStateSync(playerId);

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

    // Reset log indices on new game setup
    if (action.type === "SETUP_GAME" || action.type === "RESET_GAME") {
      this.aiLogIndex = 0;
    }

    // Human is always player index 0
    const playerIndex = 0 as const;

    // Execute action through TwoPlayerGame
    const result = this.game.handleAction(playerIndex, action);

    if (!result.success) {
      // Send rejection only to the requesting player
      this.sendToPlayer(playerId, {
        type: "ACTION_REJECTED",
        timestamp: Date.now(),
        requestId: action.requestId,
        reason: result.reason || "Action failed",
      });
    }
    // Success state is broadcast via the onStateChange callback
  }

  /**
   * Send full two-player state sync to a player
   */
  private sendTwoPlayerStateSync(playerId: string): void {
    const state = this.game.getStateForPlayer(0);

    this.sendToPlayer(playerId, {
      type: "TWO_PLAYER_STATE_SYNC",
      timestamp: Date.now(),
      state,
    });
  }

  /**
   * Broadcast two-player state update to all connected players
   */
  private broadcastTwoPlayerState(isAIAction: boolean): void {
    // Get state from human's perspective
    const state = this.game.getStateForPlayer(0);

    // Human log entries are already in state.myState.actionLog,
    // so only send AI entries as newLogEntries to avoid duplicates.
    const aiLog = this.game.engines[1].getState().actionLog;
    const aiNewEntries = aiLog.slice(this.aiLogIndex);
    this.aiLogIndex = aiLog.length;

    // Prefix AI entries with [AI] and unique IDs
    const allNewEntries = aiNewEntries.map((e) => ({
      ...e,
      id: `ai-${e.id}`,
      message: `[AI] ${e.message}`,
    }));

    this.broadcast({
      type: "TWO_PLAYER_STATE_UPDATE",
      timestamp: Date.now(),
      state,
      requestId: "",
      newLogEntries: allNewEntries,
      isAIAction,
    });

    // Check for game over
    if (state.winner) {
      this.broadcast({
        type: "GAME_OVER",
        timestamp: Date.now(),
        victory: state.winner === 1,
        finalScore: state.myState.score,
        winner: state.winner,
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
