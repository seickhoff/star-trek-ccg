import { useEffect, useRef } from "react";
import type { ActionLogEntry, CardRef } from "@stccg/shared";
import { useDraggablePanel } from "../../hooks/useDraggablePanel";
import "./ActionLog.css";

interface ActionLogProps {
  entries: ActionLogEntry[];
  onCardClick?: (cardRef: CardRef) => void;
}

/**
 * Draggable Captain's Log panel
 * Click anywhere to drag; click without drag to minimize
 */
export function ActionLog({ entries, onCardClick }: ActionLogProps) {
  const {
    position,
    zIndex,
    minimized,
    containerRef,
    handleMouseDown,
    handleTouchStart,
  } = useDraggablePanel({ isOpen: true, initialPosition: { x: 20, y: 80 } });

  const logContentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new entries are added (newest first)
  useEffect(() => {
    if (logContentRef.current) {
      logContentRef.current.scrollTop = 0;
    }
  }, [entries.length]);

  // Format timestamp for display
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Get CSS class for log entry type
  const getTypeClass = (type: ActionLogEntry["type"]) => {
    switch (type) {
      case "game_start":
      case "new_turn":
        return "action-log__entry--turn";
      case "phase_change":
        return "action-log__entry--phase";
      case "draw":
      case "deploy":
        return "action-log__entry--card";
      case "move_ship":
      case "beam":
        return "action-log__entry--move";
      case "mission_attempt":
      case "dilemma_draw":
        return "action-log__entry--dilemma";
      case "dilemma_result":
        return "action-log__entry--dilemma-result";
      case "mission_complete":
        return "action-log__entry--success";
      case "mission_fail":
      case "rejected":
        return "action-log__entry--fail";
      case "game_over":
        return "action-log__entry--game-over";
      default:
        return "";
    }
  };

  return (
    <div
      ref={containerRef}
      className={`action-log${minimized ? " action-log--minimized" : ""}`}
      style={{
        left: position.x,
        top: position.y,
        zIndex,
      }}
      onMouseDown={(e) => handleMouseDown(e, ".action-log__header")}
      onTouchStart={(e) => handleTouchStart(e, ".action-log__header")}
    >
      <div className="action-log__header">
        <span className="action-log__title">Captain's Log</span>
      </div>
      {!minimized && (
        <div className="action-log__content" ref={logContentRef}>
          {entries.length === 0 ? (
            <div className="action-log__empty">No actions yet</div>
          ) : (
            [...entries].reverse().map((entry) => {
              const isSingle = entry.cardRefs?.length === 1;
              return (
                <div
                  key={entry.id}
                  className={`action-log__entry ${getTypeClass(entry.type)}${isSingle ? " action-log__entry--has-card" : ""}`}
                >
                  <div className="action-log__text">
                    <span className="action-log__time">
                      {formatTime(entry.timestamp)}
                    </span>
                    <span className="action-log__message">{entry.message}</span>
                    {entry.details && (
                      <span className="action-log__details">
                        {entry.details}
                      </span>
                    )}
                    {!isSingle &&
                      entry.cardRefs &&
                      entry.cardRefs.length > 1 && (
                        <span className="action-log__cards">
                          {entry.cardRefs.map((ref, i) => (
                            <button
                              type="button"
                              key={`${ref.cardId}-${i}`}
                              className="action-log__card-btn"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                onCardClick?.(ref);
                              }}
                              title={ref.name}
                            >
                              <img
                                src={ref.jpg}
                                alt={ref.name}
                                className="action-log__card-icon"
                              />
                            </button>
                          ))}
                        </span>
                      )}
                  </div>
                  {isSingle && (
                    <button
                      type="button"
                      className="action-log__card-btn"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCardClick?.(entry.cardRefs![0]!);
                      }}
                      title={entry.cardRefs![0]!.name}
                    >
                      <img
                        src={entry.cardRefs![0]!.jpg}
                        alt={entry.cardRefs![0]!.name}
                        className="action-log__card-icon"
                      />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
