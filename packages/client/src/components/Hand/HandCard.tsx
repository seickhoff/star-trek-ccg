import type { Card, PersonnelCard, ShipCard, EventCard } from "@stccg/shared";
import { isPersonnel, isShip, isEvent } from "@stccg/shared";
import { CardSlot } from "../GameBoard/CardSlot";
import "./HandCard.css";

interface HandCardProps {
  card: Card;
  canDeploy: boolean;
  canPlay: boolean;
  onDeploy?: (card: Card) => void;
  onPlayEvent?: (card: Card) => void;
  onView?: (card: Card) => void;
}

/**
 * Card displayed in the player's hand
 * Shows deploy cost and allows deployment/viewing
 */
export function HandCard({
  card,
  canDeploy,
  canPlay,
  onDeploy,
  onPlayEvent,
  onView,
}: HandCardProps) {
  // Get deploy cost for personnel/ships
  const deployCost: number | null =
    isPersonnel(card) || isShip(card)
      ? (card as PersonnelCard | ShipCard).deploy
      : null;

  // Get play cost for events
  const playCost: number | null = isEvent(card)
    ? (card as EventCard).deploy
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

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canPlay && onPlayEvent) {
      onPlayEvent(card);
    }
  };

  // Show cost badge for deployable cards or playable events
  const costToShow = deployCost ?? playCost;
  const isPlayable = canDeploy || canPlay;

  return (
    <div className={`hand-card ${isPlayable ? "hand-card--deployable" : ""}`}>
      {costToShow !== null && (
        <div className="hand-card__cost">
          <span className="hand-card__cost-value">{costToShow}</span>
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

      {playCost !== null && onPlayEvent && (
        <button
          className={`hand-card__deploy-btn hand-card__play-btn ${!canPlay ? "hand-card__deploy-btn--disabled" : ""}`}
          onClick={handlePlay}
          disabled={!canPlay}
          title={`Play ${card.name}`}
        >
          Play
        </button>
      )}
    </div>
  );
}
