import { useState, useRef, useEffect } from "react";
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
 */
export function DraggablePanel({
  isOpen,
  onClose,
  title,
  children,
  width = "400px",
}: DraggablePanelProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [zIndex, setZIndex] = useState(1000);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Bring to front on any click
    setZIndex(getNextZIndex());

    // Only drag from header
    if (!(e.target as HTMLElement).closest(".draggable-panel__header")) return;

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
      className="draggable-panel"
      style={{
        left: position.x,
        top: position.y,
        width,
        zIndex,
      }}
      onMouseDown={handleMouseDown}
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
      <div className="draggable-panel__content">{children}</div>
    </div>
  );
}
