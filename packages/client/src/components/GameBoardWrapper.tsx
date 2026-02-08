import { useEffect } from "react";
import type { SerializableGameState, GameAction } from "@stccg/shared";
import { GameBoard } from "./GameBoard";
import { useClientGameStore } from "../store/clientGameStore";

interface GameBoardWrapperProps {
  serverState: SerializableGameState;
  sendAction: <T extends Omit<GameAction, "requestId">>(action: T) => string;
}

/**
 * Wrapper that syncs server state to client store and provides action dispatch
 */
export function GameBoardWrapper({
  serverState,
  sendAction,
}: GameBoardWrapperProps) {
  const syncState = useClientGameStore((s) => s.syncState);

  // Sync server state to client store whenever it changes
  useEffect(() => {
    syncState(serverState);
  }, [serverState, syncState]);

  return <GameBoard sendAction={sendAction} />;
}
