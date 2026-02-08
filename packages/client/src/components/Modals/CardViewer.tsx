import { useState, useRef, useEffect } from "react";
import type { Card } from "@stccg/shared";
import { CardSlot } from "../GameBoard/CardSlot";
import { getNextZIndex } from "./DraggablePanel";
import "./CardViewer.css";

interface CardViewerProps {
  card: Card | null;
  onClose: () => void;
}

/**
 * Floating card viewer that can be dragged around
 * Closes when clicked (not dragged)
 * Matches original jQuery UI draggable behavior
 */
export function CardViewer({ card, onClose }: CardViewerProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [zIndex, setZIndex] = useState(getNextZIndex);
  const wasDragged = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection during drag
    setZIndex(getNextZIndex()); // Bring to front

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startPosX = position.x;
    const startPosY = position.y;
    wasDragged.current = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startMouseX;
      const dy = moveEvent.clientY - startMouseY;

      // Mark as dragged if moved more than 5px
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

  const handleClick = () => {
    // Only close if this wasn't a drag
    if (!wasDragged.current) {
      onClose();
    }
  };

  // Bring to front and reset drag state when card changes
  useEffect(() => {
    if (card) {
      setZIndex(getNextZIndex());
    }
    wasDragged.current = false;
  }, [card?.uniqueId]);

  if (!card) return null;

  return (
    <div
      ref={containerRef}
      className="card-viewer"
      style={{
        left: position.x,
        top: position.y,
        zIndex,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <CardSlot card={card} size="full" />
    </div>
  );
}
