import { useEffect, useRef, useCallback, useState } from "react";
import type {
  GameAction,
  GameEvent,
  SerializableGameState,
  TwoPlayerGameState,
} from "@stccg/shared";
import { useConnectionStore } from "../store/connectionStore";
import { useClientGameStore } from "../store/clientGameStore";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";

/**
 * Generate a simple UUID for request IDs
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * WebSocket hook for game communication
 */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const [gameState, setGameState] = useState<SerializableGameState | null>(
    null
  );
  const [twoPlayerState, setTwoPlayerState] =
    useState<TwoPlayerGameState | null>(null);
  const syncTwoPlayerState = useClientGameStore((s) => s.syncTwoPlayerState);
  const addAILogEntry = useClientGameStore((s) => s.addAILogEntry);
  const setDilemmaSelectionRequest = useClientGameStore(
    (s) => s.setDilemmaSelectionRequest
  );

  const {
    setConnected,
    setConnecting,
    setPlayer,
    setGameId,
    setError,
    reset,
    playerId,
    playerName,
    gameId,
  } = useConnectionStore();

  /**
   * Handle incoming events from server
   */
  const handleEvent = useCallback(
    (event: GameEvent) => {
      switch (event.type) {
        case "CONNECTED":
          console.log("Connected to server:", event);
          setConnected(true);
          break;

        case "PLAYER_JOINED":
          console.log("Player joined:", event);
          break;

        case "STATE_SYNC":
          console.log("State sync received");
          setGameState(event.state);
          break;

        case "STATE_UPDATE":
          console.log("State update received");
          setGameState(event.state);
          break;

        case "TWO_PLAYER_STATE_SYNC":
          console.log("Two-player state sync received");
          setTwoPlayerState(event.state);
          setGameState(event.state.myState);
          syncTwoPlayerState(event.state);
          break;

        case "TWO_PLAYER_STATE_UPDATE":
          console.log(
            "Two-player state update received",
            event.isAIAction ? "(AI)" : ""
          );
          setTwoPlayerState(event.state);
          setGameState(event.state.myState);
          syncTwoPlayerState(event.state);
          // Add AI log entries (human entries are in myState.actionLog)
          if (event.newLogEntries) {
            for (const entry of event.newLogEntries) {
              addAILogEntry(entry);
            }
          }
          break;

        case "DILEMMA_SELECTION_REQUEST":
          console.log("Dilemma selection request received");
          setDilemmaSelectionRequest({
            drawnDilemmas: event.drawnDilemmas,
            costBudget: event.costBudget,
            drawCount: event.drawCount,
            missionName: event.missionName,
            missionType: event.missionType,
            aiPersonnelCount: event.aiPersonnelCount,
          });
          break;

        case "TURN_CHANGE":
          console.log("Turn changed to player", event.activePlayer);
          break;

        case "ACTION_REJECTED":
          console.warn("Action rejected:", event.reason);
          setError(event.reason);
          break;

        case "GAME_OVER":
          console.log(
            event.victory ? "Victory!" : "Defeat",
            "Score:",
            event.finalScore
          );
          break;

        case "ERROR":
          console.error("Server error:", event.message);
          setError(event.message);
          break;

        case "PLAYER_DISCONNECTED":
          console.log("Player disconnected:", event.playerId);
          break;

        default:
          console.log("Unknown event:", event);
      }
    },
    [
      setConnected,
      setError,
      syncTwoPlayerState,
      addAILogEntry,
      setDilemmaSelectionRequest,
    ]
  );

  /**
   * Connect to the WebSocket server
   */
  const connect = useCallback(
    (newGameId: string, newPlayerName: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log("Already connected");
        return;
      }

      setConnecting(true);
      setError(null);

      const newPlayerId = generateId();
      setPlayer(newPlayerId, newPlayerName);
      setGameId(newGameId);

      const wsUrl = `${WS_URL}?gameId=${encodeURIComponent(newGameId)}`;
      console.log("Connecting to:", wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        reconnectAttempts.current = 0;

        // Send join action
        const joinAction: GameAction = {
          type: "JOIN_GAME",
          requestId: generateId(),
          gameId: newGameId,
          playerId: newPlayerId,
          playerName: newPlayerName,
        };
        ws.send(JSON.stringify(joinAction));
      };

      ws.onmessage = (event) => {
        try {
          const gameEvent: GameEvent = JSON.parse(event.data);
          handleEvent(gameEvent);
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setConnected(false);
        wsRef.current = null;

        // Attempt reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            10000
          );
          console.log(`Reconnecting in ${delay}ms...`);
          setTimeout(() => {
            if (playerId && playerName && gameId) {
              connect(gameId, playerName);
            }
          }, delay);
        } else {
          setError("Connection lost. Please refresh the page.");
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("Connection error");
      };
    },
    [
      setConnecting,
      setError,
      setPlayer,
      setGameId,
      setConnected,
      handleEvent,
      playerId,
      playerName,
      gameId,
    ]
  );

  /**
   * Send an action to the server
   */
  const sendAction = useCallback(
    <T extends Omit<GameAction, "requestId">>(action: T): string => {
      const requestId = generateId();
      const fullAction = { ...action, requestId } as GameAction;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(fullAction));
        console.log("Sent action:", action.type);
      } else {
        console.error("WebSocket not connected");
        setError("Not connected to server");
      }

      return requestId;
    },
    [setError]
  );

  /**
   * Disconnect from the server
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    reset();
    setGameState(null);
  }, [reset]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    connect,
    disconnect,
    sendAction,
    gameState,
    twoPlayerState,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
