import { useState, useEffect, useMemo } from "react";
import type { DilemmaCard, MissionType, Card } from "@stccg/shared";
import { CardSlot } from "../GameBoard/CardSlot";
import { useDraggablePanel } from "../../hooks/useDraggablePanel";
import "./DilemmaSelectionModal.css";

interface DilemmaSelectionRequest {
  drawnDilemmas: DilemmaCard[];
  costBudget: number;
  drawCount: number;
  missionName: string;
  missionType: MissionType;
  aiPersonnelCount: number;
  reEncounterDilemmas: DilemmaCard[];
}

interface DilemmaSelectionModalProps {
  request: DilemmaSelectionRequest | null;
  onSubmit: (selectedUniqueIds: string[]) => void;
  onCardClick?: (card: Card) => void;
}

/**
 * Modal for human to select which dilemmas the AI must face
 * during its mission attempt. Per rulebook, the opponent chooses
 * dilemmas and their order.
 */
export function DilemmaSelectionModal({
  request,
  onSubmit,
  onCardClick,
}: DilemmaSelectionModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    position,
    zIndex,
    minimized,
    containerRef,
    handleMouseDown,
    handleTouchStart,
  } = useDraggablePanel({
    isOpen: !!request,
    initialPosition: { x: 50, y: 30 },
  });

  // Reset selection when a new request comes in
  useEffect(() => {
    if (request) {
      setSelectedIds([]);
    }
  }, [request]);

  if (!request) return null;

  const {
    drawnDilemmas,
    costBudget,
    drawCount,
    missionName,
    missionType,
    aiPersonnelCount,
    reEncounterDilemmas = [],
  } = request;

  // Track which IDs are re-encounter dilemmas
  const reEncounterIdSet = useMemo(
    () => new Set(reEncounterDilemmas.map((d) => d.uniqueId)),
    [reEncounterDilemmas]
  );
  const isReEncounter = (uid: string) => reEncounterIdSet.has(uid);

  // Calculate current cost (only pool dilemmas count)
  const currentCost = selectedIds.reduce((sum, uid) => {
    if (isReEncounter(uid)) return sum; // re-encounter dilemmas are free
    const d = drawnDilemmas.find((d) => d.uniqueId === uid);
    return sum + (d?.cost ?? 0);
  }, 0);

  // Count of pool dilemmas selected (re-encounter don't count toward limit)
  const poolSelectedCount = selectedIds.filter(
    (uid) => !isReEncounter(uid)
  ).length;

  // Check if a pool dilemma can be added
  const canAddPoolDilemma = (dilemma: DilemmaCard): boolean => {
    if (selectedIds.includes(dilemma.uniqueId!)) return false;
    if (poolSelectedCount >= drawCount) return false;
    if (currentCost + dilemma.cost > costBudget) return false;
    // No duplicate base IDs
    const baseIds = selectedIds.map(
      (id) =>
        drawnDilemmas.find((d) => d.uniqueId === id)?.id ??
        reEncounterDilemmas.find((d) => d.uniqueId === id)?.id
    );
    if (baseIds.includes(dilemma.id)) return false;
    return true;
  };

  // Check if a re-encounter dilemma can be added (always allowed if not already selected)
  const canAddReEncounter = (dilemma: DilemmaCard): boolean => {
    return !selectedIds.includes(dilemma.uniqueId!);
  };

  const toggleDilemma = (uniqueId: string, isReEnc: boolean) => {
    if (selectedIds.includes(uniqueId)) {
      setSelectedIds((prev) => prev.filter((id) => id !== uniqueId));
    } else {
      const canAdd = isReEnc
        ? canAddReEncounter(
            reEncounterDilemmas.find((d) => d.uniqueId === uniqueId)!
          )
        : canAddPoolDilemma(
            drawnDilemmas.find((d) => d.uniqueId === uniqueId)!
          );
      if (canAdd) {
        setSelectedIds((prev) => [...prev, uniqueId]);
      }
    }
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index >= selectedIds.length - 1) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
      return next;
    });
  };

  // Helper to find a dilemma by uniqueId across both lists
  const findDilemma = (uid: string): DilemmaCard | undefined =>
    drawnDilemmas.find((d) => d.uniqueId === uid) ??
    reEncounterDilemmas.find((d) => d.uniqueId === uid);

  return (
    <div
      ref={containerRef}
      className={`dilemma-select${minimized ? " dilemma-select--minimized" : ""}`}
      style={{
        left: position.x,
        top: position.y,
        zIndex,
        maxHeight: `calc(100vh - ${position.y}px - 20px)`,
      }}
      onMouseDown={(e) => handleMouseDown(e, ".dilemma-select__header")}
      onTouchStart={(e) => handleTouchStart(e, ".dilemma-select__header")}
    >
      <div className="dilemma-select__header">
        <h2 className="dilemma-select__title">Select Dilemmas</h2>
        <div className="dilemma-select__info">
          AI attempting <strong>{missionName}</strong> ({missionType}) with{" "}
          {aiPersonnelCount} personnel
        </div>
      </div>

      {!minimized && (
        <div className="dilemma-select__content">
          {/* Budget tracker */}
          <div className="dilemma-select__budget">
            <span
              className={`dilemma-select__budget-cost${
                currentCost > costBudget
                  ? " dilemma-select__budget-cost--over"
                  : ""
              }`}
            >
              Cost: {currentCost} / {costBudget}
            </span>
            <span className="dilemma-select__budget-max">
              Max {drawCount} dilemma{drawCount !== 1 ? "s" : ""} from pool
            </span>
          </div>

          {/* Re-encounter dilemmas (on mission) */}
          {reEncounterDilemmas.length > 0 && (
            <>
              <div className="dilemma-select__section-label">
                On Mission (free)
              </div>
              <div className="dilemma-select__available">
                {reEncounterDilemmas.map((dilemma) => {
                  const isSelected = selectedIds.includes(dilemma.uniqueId!);
                  const order = isSelected
                    ? selectedIds.indexOf(dilemma.uniqueId!) + 1
                    : null;
                  const canAdd = !isSelected && canAddReEncounter(dilemma);

                  return (
                    <div
                      key={dilemma.uniqueId}
                      className={`dilemma-select__card dilemma-select__card--reencounter${
                        isSelected ? " dilemma-select__card--selected" : ""
                      }`}
                      onClick={() => {
                        if (isSelected || canAdd)
                          toggleDilemma(dilemma.uniqueId!, true);
                      }}
                    >
                      {isSelected && (
                        <div className="dilemma-select__card-order">
                          {order}
                        </div>
                      )}
                      <div onClick={(e) => e.stopPropagation()}>
                        <CardSlot
                          card={dilemma}
                          size="thumb"
                          onClick={() => onCardClick?.(dilemma)}
                        />
                      </div>
                      <div className="dilemma-select__card-info">
                        <div className="dilemma-select__card-name">
                          {dilemma.name}
                          <span className="dilemma-select__card-tag dilemma-select__card-tag--on-mission">
                            On Mission
                          </span>
                        </div>
                        <div className="dilemma-select__card-meta">
                          Free | {dilemma.where}
                        </div>
                        {dilemma.text && (
                          <div className="dilemma-select__card-text">
                            {dilemma.text}
                          </div>
                        )}
                      </div>
                      <button
                        className={`dilemma-select__card-toggle${
                          isSelected
                            ? " dilemma-select__card-toggle--remove"
                            : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelected || canAdd)
                            toggleDilemma(dilemma.uniqueId!, true);
                        }}
                        disabled={!isSelected && !canAdd}
                      >
                        {isSelected ? "Remove" : "Select"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Pool dilemmas */}
          {drawnDilemmas.length > 0 && (
            <>
              {reEncounterDilemmas.length > 0 && (
                <div className="dilemma-select__section-label">From Pool</div>
              )}
              <div className="dilemma-select__available">
                {drawnDilemmas.map((dilemma) => {
                  const isSelected = selectedIds.includes(dilemma.uniqueId!);
                  const order = isSelected
                    ? selectedIds.indexOf(dilemma.uniqueId!) + 1
                    : null;
                  const canAdd = !isSelected && canAddPoolDilemma(dilemma);

                  return (
                    <div
                      key={dilemma.uniqueId}
                      className={`dilemma-select__card${
                        isSelected ? " dilemma-select__card--selected" : ""
                      }${!isSelected && !canAdd ? " dilemma-select__card--disabled" : ""}`}
                      onClick={() => {
                        if (isSelected || canAdd)
                          toggleDilemma(dilemma.uniqueId!, false);
                      }}
                    >
                      {isSelected && (
                        <div className="dilemma-select__card-order">
                          {order}
                        </div>
                      )}
                      <div onClick={(e) => e.stopPropagation()}>
                        <CardSlot
                          card={dilemma}
                          size="thumb"
                          onClick={() => onCardClick?.(dilemma)}
                        />
                      </div>
                      <div className="dilemma-select__card-info">
                        <div className="dilemma-select__card-name">
                          {dilemma.name}
                        </div>
                        <div className="dilemma-select__card-meta">
                          Cost: {dilemma.cost} | {dilemma.where}
                        </div>
                        {dilemma.text && (
                          <div className="dilemma-select__card-text">
                            {dilemma.text}
                          </div>
                        )}
                      </div>
                      <button
                        className={`dilemma-select__card-toggle${
                          isSelected
                            ? " dilemma-select__card-toggle--remove"
                            : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelected || canAdd)
                            toggleDilemma(dilemma.uniqueId!, false);
                        }}
                        disabled={!isSelected && !canAdd}
                      >
                        {isSelected ? "Remove" : "Select"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Selected order */}
          {selectedIds.length > 1 && (
            <div className="dilemma-select__order">
              <h4 className="dilemma-select__order-title">
                Encounter Order (top = faced first)
              </h4>
              <div className="dilemma-select__order-list">
                {selectedIds.map((uid, i) => {
                  const d = findDilemma(uid);
                  const isReEnc = isReEncounter(uid);
                  return (
                    <div key={uid} className="dilemma-select__order-item">
                      <span className="dilemma-select__order-num">
                        {i + 1}.
                      </span>
                      <span className="dilemma-select__order-name">
                        {d?.name}
                        {isReEnc && (
                          <span className="dilemma-select__order-tag">
                            On Mission
                          </span>
                        )}
                      </span>
                      <button
                        className="dilemma-select__order-btn"
                        disabled={i === 0}
                        onClick={() => moveUp(i)}
                        title="Move up"
                      >
                        &#x25B2;
                      </button>
                      <button
                        className="dilemma-select__order-btn"
                        disabled={i === selectedIds.length - 1}
                        onClick={() => moveDown(i)}
                        title="Move down"
                      >
                        &#x25BC;
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="dilemma-select__actions">
            <button
              className={`dilemma-select__submit-btn${
                selectedIds.length === 0
                  ? " dilemma-select__submit-btn--skip"
                  : ""
              }`}
              onClick={() => onSubmit(selectedIds)}
            >
              {selectedIds.length === 0
                ? "Skip (No Dilemmas)"
                : `Send ${selectedIds.length} Dilemma${selectedIds.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
