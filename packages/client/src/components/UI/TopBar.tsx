import type { GamePhase } from "@stccg/shared";
import "./TopBar.css";

interface TopBarProps {
  turn: number;
  phase: GamePhase;
  counters: number;
  score: number;
  deckCount: number;
  canDraw: boolean;
  canAdvancePhase: boolean;
  gameOver: boolean;
  victory: boolean;
  onDraw: () => void;
  onAdvancePhase: () => void;
  onNewGame: () => void;
}

const PHASE_LABELS: Record<GamePhase, string> = {
  PlayAndDraw: "Play & Draw",
  ExecuteOrders: "Execute Orders",
  DiscardExcess: "Discard Excess",
};

const PHASE_DESCRIPTIONS: Record<GamePhase, string> = {
  PlayAndDraw: "Spend counters to deploy cards or draw",
  ExecuteOrders: "Move ships, beam personnel, attempt missions",
  DiscardExcess: "Discard down to 7 cards",
};

/**
 * Top bar with turn info and action buttons
 */
export function TopBar({
  turn,
  phase,
  counters,
  score,
  deckCount,
  canDraw,
  canAdvancePhase,
  gameOver,
  victory,
  onDraw,
  onAdvancePhase,
  onNewGame,
}: TopBarProps) {
  return (
    <div className="top-bar">
      {/* Game info section */}
      <div className="top-bar__info">
        <div className="top-bar__turn">
          <span className="top-bar__label">Turn</span>
          <span className="top-bar__value">{turn}</span>
        </div>

        <div className="top-bar__phase">
          <span className="top-bar__phase-name">{PHASE_LABELS[phase]}</span>
          <span className="top-bar__phase-desc">
            {PHASE_DESCRIPTIONS[phase]}
          </span>
        </div>
      </div>

      {/* Counters and stats */}
      <div className="top-bar__stats">
        <div className="top-bar__stat">
          <span className="top-bar__stat-label">Counters</span>
          <span className="top-bar__stat-value top-bar__stat-value--counters">
            {counters}
          </span>
        </div>

        <div className="top-bar__stat">
          <span className="top-bar__stat-label">Score</span>
          <span className="top-bar__stat-value top-bar__stat-value--score">
            {score}
          </span>
        </div>

        <div className="top-bar__stat">
          <span className="top-bar__stat-label">Deck</span>
          <span className="top-bar__stat-value">{deckCount}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="top-bar__actions">
        {gameOver ? (
          <>
            <div
              className={`top-bar__game-over ${victory ? "top-bar__game-over--victory" : "top-bar__game-over--defeat"}`}
            >
              {victory ? "VICTORY!" : "DEFEAT"}
            </div>
            <button
              className="top-bar__btn top-bar__btn--new"
              onClick={onNewGame}
            >
              New Game
            </button>
          </>
        ) : (
          <>
            {phase === "PlayAndDraw" && (
              <button
                className="top-bar__btn top-bar__btn--draw"
                onClick={onDraw}
                disabled={!canDraw}
                title={
                  canDraw
                    ? "Draw a card (costs 1 counter)"
                    : "Cannot draw - need counters and cards in deck"
                }
              >
                Draw Card
              </button>
            )}

            <button
              className="top-bar__btn top-bar__btn--advance"
              onClick={onAdvancePhase}
              disabled={!canAdvancePhase}
              title={
                canAdvancePhase
                  ? `Advance to ${phase === "PlayAndDraw" ? "Execute Orders" : phase === "ExecuteOrders" ? "Discard Excess" : "Next Turn"}`
                  : phase === "DiscardExcess"
                    ? "Must discard down to 7 cards first"
                    : "Cannot advance phase yet"
              }
            >
              {phase === "DiscardExcess" ? "End Turn" : "Next Phase"}
            </button>

            <button
              className="top-bar__btn top-bar__btn--new"
              onClick={onNewGame}
            >
              New Game
            </button>
          </>
        )}
      </div>
    </div>
  );
}
