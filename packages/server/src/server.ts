import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { GameAction } from "@stccg/shared";
import { GameRoom } from "./game/GameRoom.js";

/**
 * Server configuration
 */
interface ServerConfig {
  port: number;
}

/**
 * Client connection info
 */
interface ClientInfo {
  playerId: string | null;
  gameId: string | null;
}

/**
 * Game WebSocket server
 */
export class GameServer {
  private wss: WebSocketServer;
  private rooms: Map<string, GameRoom> = new Map();
  private clientInfo: WeakMap<WebSocket, ClientInfo> = new WeakMap();

  constructor(config: ServerConfig) {
    this.wss = new WebSocketServer({ port: config.port });
    this.setupServer();
  }

  private setupServer(): void {
    console.log(`WebSocket server listening on port ${this.wss.options.port}`);

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.wss.on("error", (error) => {
      console.error("WebSocket server error:", error);
    });
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // Parse game ID from URL query string
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const gameId = url.searchParams.get("gameId") || "default";

    console.log(`New connection for game: ${gameId}`);

    // Initialize client info
    this.clientInfo.set(ws, { playerId: null, gameId: null });

    ws.on("message", (data) => {
      this.handleMessage(ws, data.toString(), gameId);
    });

    ws.on("close", () => {
      this.handleDisconnect(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket client error:", error);
    });
  }

  private handleMessage(
    ws: WebSocket,
    data: string,
    initialGameId: string
  ): void {
    let action: GameAction;

    try {
      action = JSON.parse(data) as GameAction;
    } catch (error) {
      console.error("Failed to parse message:", error);
      ws.send(
        JSON.stringify({
          type: "ERROR",
          timestamp: Date.now(),
          message: "Invalid JSON",
          code: "PARSE_ERROR",
        })
      );
      return;
    }

    // Handle JOIN_GAME action
    if (action.type === "JOIN_GAME") {
      const room = this.getOrCreateRoom(action.gameId || initialGameId);
      const success = room.addPlayer(action.playerId, action.playerName, ws);

      if (success) {
        // Update client info
        this.clientInfo.set(ws, {
          playerId: action.playerId,
          gameId: room.gameId,
        });
      }
      return;
    }

    // For other actions, look up the player's room
    const clientInfo = this.clientInfo.get(ws);
    if (!clientInfo?.playerId || !clientInfo?.gameId) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          timestamp: Date.now(),
          message: "Not joined to a game",
          code: "NOT_JOINED",
        })
      );
      return;
    }

    const room = this.rooms.get(clientInfo.gameId);
    if (!room) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          timestamp: Date.now(),
          message: "Game room not found",
          code: "ROOM_NOT_FOUND",
        })
      );
      return;
    }

    room.handleAction(clientInfo.playerId, action);
  }

  private handleDisconnect(ws: WebSocket): void {
    const clientInfo = this.clientInfo.get(ws);
    if (!clientInfo?.playerId || !clientInfo?.gameId) {
      return;
    }

    const room = this.rooms.get(clientInfo.gameId);
    if (room) {
      room.removePlayer(clientInfo.playerId);

      // Clean up empty rooms
      if (room.playerCount === 0) {
        console.log(`Removing empty room: ${clientInfo.gameId}`);
        this.rooms.delete(clientInfo.gameId);
      }
    }
  }

  private getOrCreateRoom(gameId: string): GameRoom {
    let room = this.rooms.get(gameId);
    if (!room) {
      room = new GameRoom(gameId);
      this.rooms.set(gameId, room);
      console.log(`Created game room: ${gameId}`);
    }
    return room;
  }

  /**
   * Get all active room IDs
   */
  getActiveRooms(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Shut down the server
   */
  close(): void {
    this.wss.close();
  }
}
