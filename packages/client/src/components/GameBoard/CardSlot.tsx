import type { Card, PersonnelCard, ShipCard } from "@stccg/shared";
import { isPersonnel, isShip, isMission, isDilemma } from "@stccg/shared";
import "./CardSlot.css";

interface CardSlotProps {
  card: Card;
  size?: "thumb" | "small" | "medium" | "full";
  orientation?: "portrait" | "landscape";
  onClick?: (card: Card) => void;
  showStatus?: boolean;
  selected?: boolean;
  dimmed?: boolean;
}

/**
 * Base component for displaying a card image
 * Handles different card types, sizes, and states
 */
export function CardSlot({
  card,
  size = "thumb",
  orientation = "portrait",
  onClick,
  showStatus = true,
  selected = false,
  dimmed = false,
}: CardSlotProps) {
  // Determine status styling for personnel
  const isStopped =
    isPersonnel(card) && (card as PersonnelCard).status === "Stopped";
  const isKilled =
    isPersonnel(card) && (card as PersonnelCard).status === "Killed";

  // Build class names
  const classNames = [
    "card-slot",
    `card-slot--${size}`,
    `card-slot--${orientation}`,
    onClick ? "card-slot--clickable" : "",
    showStatus && isStopped ? "card-slot--stopped" : "",
    showStatus && isKilled ? "card-slot--killed" : "",
    selected ? "card-slot--selected" : "",
    dimmed ? "card-slot--dimmed" : "",
    isMission(card) ? "card-slot--mission" : "",
    isDilemma(card) ? "card-slot--dilemma" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Get card image path
  const imagePath = card.jpg;

  // Get alt text
  const altText = `${card.name} (${card.type})`;

  // Get status indicator
  const statusIndicator = showStatus && isPersonnel(card) && (
    <span
      className={`card-slot__status card-slot__status--${(card as PersonnelCard).status.toLowerCase()}`}
    />
  );

  // Get ship range indicator
  const rangeIndicator = showStatus &&
    isShip(card) &&
    (card as ShipCard).rangeRemaining < (card as ShipCard).range && (
      <span className="card-slot__range">
        {(card as ShipCard).rangeRemaining}/{(card as ShipCard).range}
      </span>
    );

  return (
    <div
      className={classNames}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick(card);
        }
      }}
      title={altText}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          e.stopPropagation();
          onClick(card);
        }
      }}
    >
      <img src={imagePath} alt={altText} className="card-slot__image" />
      {statusIndicator}
      {rangeIndicator}
      {selected && <span className="card-slot__selected-indicator" />}
    </div>
  );
}
