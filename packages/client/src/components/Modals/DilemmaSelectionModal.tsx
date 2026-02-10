import { useState, useEffect } from "react";
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

  const { position, zIndex, minimized, containerRef, handleMouseDown } =
    useDraggablePanel({
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
  } = request;

  // Calculate current cost
  const currentCost = selectedIds.reduce((sum, uid) => {
    const d = drawnDilemmas.find((d) => d.uniqueId === uid);
    return sum + (d?.cost ?? 0);
  }, 0);

  // Check if a dilemma can be added
  const canAddDilemma = (dilemma: DilemmaCard): boolean => {
    if (selectedIds.includes(dilemma.uniqueId!)) return false;
    if (selectedIds.length >= drawCount) return false;
    if (currentCost + dilemma.cost > costBudget) return false;
    // No duplicate base IDs
    const baseIds = selectedIds.map(
      (id) => drawnDilemmas.find((d) => d.uniqueId === id)?.id
    );
    if (baseIds.includes(dilemma.id)) return false;
    return true;
  };

  const toggleDilemma = (uniqueId: string) => {
    if (selectedIds.includes(uniqueId)) {
      setSelectedIds((prev) => prev.filter((id) => id !== uniqueId));
    } else {
      const dilemma = drawnDilemmas.find((d) => d.uniqueId === uniqueId);
      if (dilemma && canAddDilemma(dilemma)) {
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
              Max {drawCount} dilemma{drawCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Available dilemmas */}
          <div className="dilemma-select__available">
            {drawnDilemmas.map((dilemma) => {
              const isSelected = selectedIds.includes(dilemma.uniqueId!);
              const order = isSelected
                ? selectedIds.indexOf(dilemma.uniqueId!) + 1
                : null;
              const canAdd = !isSelected && canAddDilemma(dilemma);

              return (
                <div
                  key={dilemma.uniqueId}
                  className={`dilemma-select__card${
                    isSelected ? " dilemma-select__card--selected" : ""
                  }${!isSelected && !canAdd ? " dilemma-select__card--disabled" : ""}`}
                  onClick={() => {
                    if (isSelected || canAdd) toggleDilemma(dilemma.uniqueId!);
                  }}
                >
                  {isSelected && (
                    <div className="dilemma-select__card-order">{order}</div>
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
                      isSelected ? " dilemma-select__card-toggle--remove" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSelected || canAdd)
                        toggleDilemma(dilemma.uniqueId!);
                    }}
                    disabled={!isSelected && !canAdd}
                  >
                    {isSelected ? "Remove" : "Select"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Selected order */}
          {selectedIds.length > 1 && (
            <div className="dilemma-select__order">
              <h4 className="dilemma-select__order-title">
                Encounter Order (top = faced first)
              </h4>
              <div className="dilemma-select__order-list">
                {selectedIds.map((uid, i) => {
                  const d = drawnDilemmas.find((d) => d.uniqueId === uid);
                  return (
                    <div key={uid} className="dilemma-select__order-item">
                      <span className="dilemma-select__order-num">
                        {i + 1}.
                      </span>
                      <span className="dilemma-select__order-name">
                        {d?.name}
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
