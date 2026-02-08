import { useState, useCallback } from "react";
import { useConnectionStore } from "../store/connectionStore";

interface ConnectionScreenProps {
  onConnect: (gameId: string, playerName: string) => void;
}

export function ConnectionScreen({ onConnect }: ConnectionScreenProps) {
  const [playerName, setPlayerName] = useState("Player 1");
  const [gameId, setGameId] = useState("default");
  const { connecting, error } = useConnectionStore();

  const handleConnect = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (playerName.trim() && gameId.trim()) {
        onConnect(gameId.trim(), playerName.trim());
      }
    },
    [onConnect, playerName, gameId]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#1a1a2e",
        color: "#eee",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: "2rem", color: "#4a9eff" }}>
        Star Trek CCG 2E
      </h1>

      <form
        onSubmit={handleConnect}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "2rem",
          backgroundColor: "#252547",
          borderRadius: "8px",
          minWidth: "300px",
        }}
      >
        <div>
          <label
            htmlFor="playerName"
            style={{ display: "block", marginBottom: "0.5rem" }}
          >
            Player Name
          </label>
          <input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            disabled={connecting}
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #444",
              backgroundColor: "#1a1a2e",
              color: "#eee",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="gameId"
            style={{ display: "block", marginBottom: "0.5rem" }}
          >
            Game ID
          </label>
          <input
            id="gameId"
            type="text"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            disabled={connecting}
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #444",
              backgroundColor: "#1a1a2e",
              color: "#eee",
            }}
          />
        </div>

        {error && (
          <div style={{ color: "#ff6b6b", fontSize: "0.875rem" }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={connecting || !playerName.trim() || !gameId.trim()}
          style={{
            padding: "0.75rem",
            borderRadius: "4px",
            border: "none",
            backgroundColor: connecting ? "#444" : "#4a9eff",
            color: "#fff",
            cursor: connecting ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {connecting ? "Connecting..." : "Join Game"}
        </button>
      </form>
    </div>
  );
}
