import { create } from "zustand";

/**
 * Connection state for WebSocket
 */
interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  playerId: string | null;
  playerName: string | null;
  gameId: string | null;
  error: string | null;
}

/**
 * Connection actions
 */
interface ConnectionActions {
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setPlayer: (playerId: string, playerName: string) => void;
  setGameId: (gameId: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

type ConnectionStore = ConnectionState & ConnectionActions;

const initialState: ConnectionState = {
  connected: false,
  connecting: false,
  playerId: null,
  playerName: null,
  gameId: null,
  error: null,
};

export const useConnectionStore = create<ConnectionStore>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected, connecting: false }),
  setConnecting: (connecting) => set({ connecting }),
  setPlayer: (playerId, playerName) => set({ playerId, playerName }),
  setGameId: (gameId) => set({ gameId }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
