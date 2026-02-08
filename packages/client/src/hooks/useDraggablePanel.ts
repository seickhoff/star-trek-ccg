import { useState, useEffect, useRef, useCallback } from "react";
import { getNextZIndex } from "../components/Modals/DraggablePanel";

interface UseDraggablePanelOptions {
  isOpen: boolean;
  initialPosition?: { x: number; y: number };
}

/**
 * Shared hook for draggable + minimizable panels.
 * - Drag from anywhere except buttons / .card-slot elements
 * - Click (without dragging) on empty area toggles minimize
 * - Click header when minimized expands
 */
export function useDraggablePanel({
  isOpen,
  initialPosition = { x: 100, y: 100 },
}: UseDraggablePanelOptions) {
  const [position, setPosition] = useState(initialPosition);
  const [zIndex, setZIndex] = useState(getNextZIndex);
  const [minimized, setMinimized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Bring to front when opened
  useEffect(() => {
    if (isOpen) {
      setZIndex(getNextZIndex());
    }
  }, [isOpen]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, headerSelector: string) => {
      setZIndex(getNextZIndex());

      const target = e.target as HTMLElement;

      // Don't initiate drag from interactive elements
      if (target.closest("button") || target.closest(".card-slot")) return;

      e.preventDefault();
      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const startPosX = position.x;
      const startPosY = position.y;
      let didDrag = false;
      const DRAG_THRESHOLD = 4;

      // Measure panel so we can clamp the header within the viewport
      const el = containerRef.current;
      const panelWidth = el ? el.offsetWidth : 200;
      const headerHeight = el
        ? (el.querySelector(headerSelector) as HTMLElement)?.offsetHeight ?? 40
        : 40;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startMouseX;
        const dy = moveEvent.clientY - startMouseY;
        if (!didDrag && Math.abs(dx) + Math.abs(dy) >= DRAG_THRESHOLD) {
          didDrag = true;
        }
        if (didDrag) {
          // Clamp so header stays in viewport
          const rawX = startPosX + dx;
          const rawY = startPosY + dy;
          setPosition({
            x: Math.max(-panelWidth + 80, Math.min(rawX, window.innerWidth - 80)),
            y: Math.max(0, Math.min(rawY, window.innerHeight - headerHeight)),
          });
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        if (!didDrag) {
          setMinimized((prev) => {
            if (prev) {
              // When minimized, only expand if clicking header
              return target.closest(headerSelector) ? false : prev;
            } else {
              // When expanded, minimize on click in empty area
              return true;
            }
          });
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [position]
  );

  return { position, zIndex, minimized, setMinimized, containerRef, handleMouseDown };
}
