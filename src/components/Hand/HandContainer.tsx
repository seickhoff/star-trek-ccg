import type { Card } from "../../types/card";
import { isPersonnel, isShip } from "../../types/card";
import { HandCard } from "./HandCard";
import "./HandContainer.css";

interface HandContainerProps {
  cards: Card[];
  counters: number;
  phase: string;
  uniquesInPlay: Set<string>;
  onDeploy?: (card: Card) => void;
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
  onDeploy,
  onView,
}: HandContainerProps) {
  const canDeployCard = (card: Card): boolean => {
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
              onDeploy={onDeploy}
              onView={onView}
            />
          ))
        )}
      </div>
    </div>
  );
}
