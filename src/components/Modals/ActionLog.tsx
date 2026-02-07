import { useState, useRef, useEffect } from "react";
import type { ActionLogEntry } from "../../types";
import { getNextZIndex } from "./DraggablePanel";
import "./ActionLog.css";

interface ActionLogProps {
  entries: ActionLogEntry[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Draggable action log panel for troubleshooting
 * Click anywhere within the panel (except close button) to drag
 */
export function ActionLog({ entries, isOpen, onClose }: ActionLogProps) {
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [zIndex, setZIndex] = useState(getNextZIndex);
  const wasDragged = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const logContentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (logContentRef.current) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
    }
  }, [entries.length]);

  // Bring to front when opened
  useEffect(() => {
    if (isOpen) {
      setZIndex(getNextZIndex());
    }
  }, [isOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't drag if clicking close button
    if ((e.target as HTMLElement).closest(".action-log__close")) return;

    e.preventDefault();
    setZIndex(getNextZIndex());

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startPosX = position.x;
    const startPosY = position.y;
    wasDragged.current = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startMouseX;
      const dy = moveEvent.clientY - startMouseY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        wasDragged.current = true;
      }

      setPosition({
        x: startPosX + dx,
        y: startPosY + dy,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

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
      className="action-log"
      style={{
        left: position.x,
        top: position.y,
        zIndex,
      }}
      onMouseDown={handleMouseDown}
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
      <div className="action-log__content" ref={logContentRef}>
        {entries.length === 0 ? (
          <div className="action-log__empty">No actions yet</div>
        ) : (
          entries.map((entry) => (
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
    </div>
  );
}
