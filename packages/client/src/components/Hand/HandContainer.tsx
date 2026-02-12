import type { Card, EventCard } from "@stccg/shared";
import { isPersonnel, isShip, isEvent } from "@stccg/shared";
import { HandCard } from "./HandCard";
import "./HandContainer.css";

interface HandContainerProps {
  cards: Card[];
  counters: number;
  phase: string;
  uniquesInPlay: Set<string>;
  isMyTurn: boolean;
  onDeploy?: (card: Card) => void;
  onPlayEvent?: (card: Card) => void;
  onDiscard?: (card: Card) => void;
  onView?: (card: Card) => void;
}

/**
 * Container for the player's hand
 * Shows all cards and allows deployment during PlayAndDraw phase
 */
export function HandContainer({
  cards,
  counters,
  phase,
  uniquesInPlay,
  isMyTurn,
  onDeploy,
  onPlayEvent,
  onDiscard,
  onView,
}: HandContainerProps) {
  const canDeployCard = (card: Card): boolean => {
    // Can only deploy during your own turn
    if (!isMyTurn) return false;

    // Can only deploy during PlayAndDraw
    if (phase !== "PlayAndDraw") return false;

    // Can only deploy personnel and ships
    if (!isPersonnel(card) && !isShip(card)) return false;

    // Check if unique card is already in play
    if (card.unique && uniquesInPlay.has(card.id)) return false;

    // Check cost
    const deployCost = (card as { deploy: number }).deploy;
    return counters >= deployCost;
  };

  const canPlayEvent = (card: Card): boolean => {
    // Can only play during your own turn
    if (!isMyTurn) return false;

    // Can only play during PlayAndDraw
    if (phase !== "PlayAndDraw") return false;

    // Must be an event
    if (!isEvent(card)) return false;

    // Check cost
    const playCost = (card as EventCard).deploy;
    return counters >= playCost;
  };

  const mustDiscard = phase === "DiscardExcess" && cards.length > 7;

  return (
    <div className="hand-container">
      <div className="hand-container__header">
        <span className="hand-container__title">Hand</span>
        <span className="hand-container__count">{cards.length} / 7</span>
      </div>

      <div className="hand-container__cards">
        {cards.length === 0 ? (
          <div className="hand-container__empty">No cards in hand</div>
        ) : (
          cards.map((card) => (
            <HandCard
              key={card.uniqueId}
              card={card}
              canDeploy={canDeployCard(card)}
              canPlay={canPlayEvent(card)}
              mustDiscard={mustDiscard}
              onDeploy={onDeploy}
              onPlayEvent={onPlayEvent}
              onDiscard={onDiscard}
              onView={onView}
            />
          ))
        )}
      </div>
    </div>
  );
}
