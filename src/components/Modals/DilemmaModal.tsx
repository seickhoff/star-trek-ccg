import { useState, useEffect } from "react";
import type { PersonnelCard, Card } from "../../types/card";
import type { DilemmaEncounter } from "../../types/gameState";
import type { DilemmaResult } from "../../logic/dilemmaResolver";
import { CardSlot } from "../GameBoard/CardSlot";
import { getNextZIndex } from "./DraggablePanel";
import "./DilemmaModal.css";

interface DilemmaModalProps {
  encounter: DilemmaEncounter | null;
  personnel: PersonnelCard[];
  dilemmaResult?: DilemmaResult | null;
  onClose: () => void;
  onSelectPersonnel?: (personnelId: string) => void;
  onContinue?: () => void;
  onCardClick?: (card: Card) => void;
}

/**
 * Modal for dilemma encounter resolution
 * Shows current dilemma and allows player response
 */
export function DilemmaModal({
  encounter,
  personnel,
  dilemmaResult,
  onClose,
  onSelectPersonnel,
  onContinue,
  onCardClick,
}: DilemmaModalProps) {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [zIndex, setZIndex] = useState(1000);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Bring to front on any click
    setZIndex(getNextZIndex());

    // Only drag from header
    if (!(e.target as HTMLElement).closest(".dilemma-modal__header")) return;

    e.preventDefault();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startPosX = position.x;
    const startPosY = position.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setPosition({
        x: startPosX + (moveEvent.clientX - startMouseX),
        y: startPosY + (moveEvent.clientY - startMouseY),
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && encounter) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [encounter, onClose]);

  if (!encounter) return null;

  const currentDilemma =
    encounter.selectedDilemmas[encounter.currentDilemmaIndex];
  if (!currentDilemma) return null;

  const unstoppedPersonnel = personnel.filter((p) => p.status === "Unstopped");
  const stoppedPersonnel = personnel.filter((p) => p.status === "Stopped");

  // Determine if we need selection
  const needsSelection = dilemmaResult?.requiresSelection ?? false;
  const selectableIds = dilemmaResult?.selectablePersonnel ?? [];

  // Filter to only selectable personnel
  const selectablePersonnel = needsSelection
    ? unstoppedPersonnel.filter(
        (p) => p.uniqueId && selectableIds.includes(p.uniqueId)
      )
    : [];

  return (
    <div
      className="dilemma-modal"
      style={{ left: position.x, top: position.y, zIndex }}
      onMouseDown={handleMouseDown}
    >
      <div className="dilemma-modal__header">
        <h2 className="dilemma-modal__title">Dilemma Encounter</h2>
        <button className="dilemma-modal__close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="dilemma-modal__content">
        {/* Progress indicator */}
        <div className="dilemma-modal__progress">
          Dilemma {encounter.currentDilemmaIndex + 1} of{" "}
          {encounter.selectedDilemmas.length}
        </div>

        {/* Current dilemma card */}
        <div className="dilemma-modal__card">
          <CardSlot
            card={currentDilemma}
            size="medium"
            onClick={() => onCardClick?.(currentDilemma)}
          />

          <div className="dilemma-modal__card-info">
            <h3 className="dilemma-modal__card-name">{currentDilemma.name}</h3>
            <div className="dilemma-modal__card-type">
              {currentDilemma.where} Dilemma
            </div>

            {currentDilemma.skills && (
              <div className="dilemma-modal__requirements">
                <span className="dilemma-modal__req-label">Requires:</span>
                <span className="dilemma-modal__req-skills">
                  {Array.isArray(currentDilemma.skills[0])
                    ? (currentDilemma.skills as string[][])
                        .map((group) => group.join(" + "))
                        .join(" OR ")
                    : (currentDilemma.skills as string[]).join(" + ")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Result message */}
        {dilemmaResult?.message && (
          <div className="dilemma-modal__message">{dilemmaResult.message}</div>
        )}

        {/* Personnel selection - only when required */}
        {needsSelection &&
          onSelectPersonnel &&
          selectablePersonnel.length > 0 && (
            <div className="dilemma-modal__section">
              <h4 className="dilemma-modal__section-title">
                Select personnel to stop:
              </h4>
              <div className="dilemma-modal__personnel">
                {selectablePersonnel.map((person) => (
                  <div key={person.uniqueId} className="dilemma-modal__person">
                    <CardSlot
                      card={person}
                      size="thumb"
                      onClick={() => onCardClick?.(person)}
                    />
                    <span className="dilemma-modal__person-name">
                      {person.name}
                    </span>
                    <button
                      className="dilemma-modal__select-btn"
                      onClick={() => onSelectPersonnel(person.uniqueId!)}
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Stopped personnel display */}
        {stoppedPersonnel.length > 0 && (
          <div className="dilemma-modal__section">
            <h4 className="dilemma-modal__section-title dilemma-modal__section-title--stopped">
              Stopped:
            </h4>
            <div className="dilemma-modal__personnel dilemma-modal__personnel--stopped">
              {stoppedPersonnel.map((person) => (
                <div
                  key={person.uniqueId}
                  className="dilemma-modal__stopped-person"
                >
                  <CardSlot
                    card={person}
                    size="thumb"
                    dimmed
                    onClick={() => onCardClick?.(person)}
                  />
                  <span className="dilemma-modal__person-name">
                    {person.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Continue button - only when selection is NOT required */}
        {!needsSelection && onContinue && (
          <div className="dilemma-modal__actions">
            <button
              className="dilemma-modal__continue-btn"
              onClick={onContinue}
            >
              {encounter.currentDilemmaIndex <
              encounter.selectedDilemmas.length - 1
                ? "Next Dilemma"
                : unstoppedPersonnel.length > 0
                  ? "Complete Mission"
                  : "Mission Failed"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
