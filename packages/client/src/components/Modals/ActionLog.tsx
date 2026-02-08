import { useEffect, useRef } from "react";
import type { ActionLogEntry } from "../../types";
import { useDraggablePanel } from "../../hooks/useDraggablePanel";
import "./ActionLog.css";

interface ActionLogProps {
  entries: ActionLogEntry[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Draggable action log panel for troubleshooting
 * Click anywhere (except close button) to drag; click without drag to minimize
 */
export function ActionLog({ entries, isOpen, onClose }: ActionLogProps) {
  const { position, zIndex, minimized, containerRef, handleMouseDown } =
    useDraggablePanel({ isOpen, initialPosition: { x: 20, y: 80 } });

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

  if (!isOpen) return null;

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
    >
      <div className="action-log__header">
        <span className="action-log__title">Action Log</span>
        <button
          className="action-log__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      {!minimized && (
        <div className="action-log__content" ref={logContentRef}>
          {entries.length === 0 ? (
            <div className="action-log__empty">No actions yet</div>
          ) : (
            [...entries].reverse().map((entry) => (
              <div
                key={entry.id}
                className={`action-log__entry ${getTypeClass(entry.type)}`}
              >
                <span className="action-log__time">
                  {formatTime(entry.timestamp)}
                </span>
                <span className="action-log__message">{entry.message}</span>
                {entry.details && (
                  <span className="action-log__details">{entry.details}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
