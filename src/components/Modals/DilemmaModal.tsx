import type { PersonnelCard } from "../../types/card";
import type { DilemmaEncounter } from "../../types/gameState";
import type { DilemmaResult } from "../../logic/dilemmaResolver";
import { Modal } from "./Modal";
import { CardSlot } from "../GameBoard/CardSlot";
import "./DilemmaModal.css";

interface DilemmaModalProps {
  encounter: DilemmaEncounter | null;
  personnel: PersonnelCard[];
  dilemmaResult?: DilemmaResult | null;
  onClose: () => void;
  onSelectPersonnel?: (personnelId: string) => void;
  onContinue?: () => void;
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
}: DilemmaModalProps) {
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
    <Modal
      isOpen={!!encounter}
      onClose={onClose}
      title="Dilemma Encounter"
      variant="dilemma"
    >
      <div className="dilemma-modal">
        {/* Progress indicator */}
        <div className="dilemma-modal__progress">
          Dilemma {encounter.currentDilemmaIndex + 1} of{" "}
          {encounter.selectedDilemmas.length}
        </div>

        {/* Current dilemma card */}
        <div className="dilemma-modal__card">
          <CardSlot card={currentDilemma} size="medium" />

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
                  <button
                    key={person.uniqueId}
                    className="dilemma-modal__person-btn"
                    onClick={() => onSelectPersonnel(person.uniqueId!)}
                  >
                    <CardSlot card={person} size="thumb" />
                    <span className="dilemma-modal__person-name">
                      {person.name}
                    </span>
                  </button>
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
                  <CardSlot card={person} size="thumb" dimmed />
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
    </Modal>
  );
}
