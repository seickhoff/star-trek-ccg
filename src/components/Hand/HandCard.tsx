import type { Card, PersonnelCard, ShipCard } from "../../types/card";
import { isPersonnel, isShip } from "../../types/card";
import { CardSlot } from "../GameBoard/CardSlot";
import "./HandCard.css";

interface HandCardProps {
  card: Card;
  canDeploy: boolean;
  onDeploy?: (card: Card) => void;
  onView?: (card: Card) => void;
}

/**
 * Card displayed in the player's hand
 * Shows deploy cost and allows deployment/viewing
 */
export function HandCard({ card, canDeploy, onDeploy, onView }: HandCardProps) {
  // Get deploy cost
  const deployCost: number | null =
    isPersonnel(card) || isShip(card)
      ? (card as PersonnelCard | ShipCard).deploy
      : null;

  const handleClick = () => {
    if (onView) {
      onView(card);
    }
  };

  const handleDeploy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canDeploy && onDeploy) {
      onDeploy(card);
    }
  };

  return (
    <div className={`hand-card ${canDeploy ? "hand-card--deployable" : ""}`}>
      {deployCost !== null && (
        <div className="hand-card__cost">
          <span className="hand-card__cost-value">{deployCost}</span>
        </div>
      )}

      <CardSlot card={card} size="thumb" onClick={handleClick} />

      <div className="hand-card__name" title={card.name}>
        {card.name}
      </div>

      {deployCost !== null && onDeploy && (
        <button
          className={`hand-card__deploy-btn ${!canDeploy ? "hand-card__deploy-btn--disabled" : ""}`}
          onClick={handleDeploy}
          disabled={!canDeploy}
          title={`Deploy ${card.name}`}
        >
          Deploy
        </button>
      )}
    </div>
  );
}
