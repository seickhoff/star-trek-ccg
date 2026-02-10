import { useEffect } from "react";
import { useDraggablePanel } from "../../hooks/useDraggablePanel";
import "./DraggablePanel.css";

// Shared z-index counter for all draggable panels
let globalZIndex = 1000;
export function getNextZIndex() {
  return ++globalZIndex;
}

interface DraggablePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

/**
 * Draggable panel component (no backdrop, can be moved around)
 * Drag from anywhere except interactive elements.
 * Click empty area to minimize; click header to expand.
 */
export function DraggablePanel({
  isOpen,
  onClose,
  title,
  children,
  width = "400px",
}: DraggablePanelProps) {
  const {
    position,
    zIndex,
    minimized,
    containerRef,
    handleMouseDown,
    handleTouchStart,
  } = useDraggablePanel({ isOpen, initialPosition: { x: 100, y: 100 } });

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className={`draggable-panel${minimized ? " draggable-panel--minimized" : ""}`}
      style={{
        left: position.x,
        top: position.y,
        width,
        zIndex,
      }}
      onMouseDown={(e) => handleMouseDown(e, ".draggable-panel__header")}
      onTouchStart={(e) => handleTouchStart(e, ".draggable-panel__header")}
    >
      <div className="draggable-panel__header">
        {title && <span className="draggable-panel__title">{title}</span>}
        <button
          className="draggable-panel__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      {!minimized && <div className="draggable-panel__content">{children}</div>}
    </div>
  );
}
