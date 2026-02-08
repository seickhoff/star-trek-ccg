import { useState } from "react";
import type { Card } from "@stccg/shared";
import { DraggablePanel } from "./DraggablePanel";
import { CardSlot } from "../GameBoard/CardSlot";
import "./DiscardPicker.css";

interface DiscardPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedCardIds: string[]) => void;
  onCardClick?: (card: Card) => void;
  discardPile: Card[];
  maxSelections: number;
  allowedTypes: string[];
  eventCard: Card | null;
}

/**
 * Modal for selecting cards from the discard pile
 * Used by events like "Salvaging the Wreckage"
 */
export function DiscardPicker({
  isOpen,
  onClose,
  onConfirm,
  onCardClick,
  discardPile,
  maxSelections,
  allowedTypes,
  eventCard,
}: DiscardPickerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter discard pile to only show allowed card types
  const eligibleCards = discardPile.filter((card) =>
    allowedTypes.includes(card.type)
  );

  const toggleCard = (card: Card) => {
    if (!card.uniqueId) return;

    const newSelected = new Set(selectedIds);
    if (newSelected.has(card.uniqueId)) {
      newSelected.delete(card.uniqueId);
    } else if (newSelected.size < maxSelections) {
      newSelected.add(card.uniqueId);
    }
    setSelectedIds(newSelected);
  };

  const handleViewCard = (e: React.MouseEvent, card: Card) => {
    e.stopPropagation(); // Don't toggle selection when viewing
    onCardClick?.(card);
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    onClose();
  };

  return (
    <DraggablePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={`${eventCard?.name ?? "Event"} - Select Cards`}
      width="500px"
    >
      <div className="discard-picker">
        <div className="discard-picker__info">
          Select up to {maxSelections} {allowedTypes.join(" or ")} card
          {maxSelections > 1 ? "s" : ""} from discard pile
        </div>

        <div className="discard-picker__selection-count">
          Selected: {selectedIds.size} / {maxSelections}
        </div>

        {eligibleCards.length === 0 ? (
          <div className="discard-picker__empty">
            No eligible cards in discard pile
          </div>
        ) : (
          <div className="discard-picker__cards">
            {eligibleCards.map((card) => (
              <div
                key={card.uniqueId}
                className={`discard-picker__card ${
                  card.uniqueId && selectedIds.has(card.uniqueId)
                    ? "discard-picker__card--selected"
                    : ""
                }`}
                onClick={() => toggleCard(card)}
              >
                <div className="discard-picker__card-image">
                  <CardSlot card={card} size="thumb" />
                  {onCardClick && (
                    <button
                      className="discard-picker__view-btn"
                      onClick={(e) => handleViewCard(e, card)}
                      title="View card"
                    >
                      👁
                    </button>
                  )}
                </div>
                <div className="discard-picker__card-info">
                  <span className="discard-picker__card-name">{card.name}</span>
                  <span className="discard-picker__card-type">{card.type}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="discard-picker__actions">
          <button
            className="discard-picker__btn discard-picker__btn--cancel"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            className="discard-picker__btn discard-picker__btn--confirm"
            onClick={handleConfirm}
          >
            {selectedIds.size === 0
              ? "Skip (Select None)"
              : "Confirm Selection"}
          </button>
        </div>
      </div>
    </DraggablePanel>
  );
}
