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

  // Shared drag logic for both mouse and touch
  const startDrag = useCallback(
    (
      startX: number,
      startY: number,
      target: HTMLElement,
      headerSelector: string
    ) => {
      setZIndex(getNextZIndex());

      // Don't initiate drag from interactive elements
      if (
        target.closest("button") ||
        target.closest(".card-slot") ||
        target.closest("select")
      )
        return null;

      const startPosX = position.x;
      const startPosY = position.y;
      let didDrag = false;
      const DRAG_THRESHOLD = 4;

      // Measure panel so we can clamp the header within the viewport
      const el = containerRef.current;
      const panelWidth = el ? el.offsetWidth : 200;
      const headerHeight = el
        ? ((el.querySelector(headerSelector) as HTMLElement)?.offsetHeight ??
          40)
        : 40;

      const onMove = (clientX: number, clientY: number) => {
        const dx = clientX - startX;
        const dy = clientY - startY;
        if (!didDrag && Math.abs(dx) + Math.abs(dy) >= DRAG_THRESHOLD) {
          didDrag = true;
        }
        if (didDrag) {
          const rawX = startPosX + dx;
          const rawY = startPosY + dy;
          setPosition({
            x: Math.max(
              -panelWidth + 80,
              Math.min(rawX, window.innerWidth - 80)
            ),
            y: Math.max(0, Math.min(rawY, window.innerHeight - headerHeight)),
          });
        }
      };

      const onEnd = () => {
        if (!didDrag) {
          setMinimized((prev) => {
            if (prev) {
              return target.closest(headerSelector) ? false : prev;
            } else {
              return true;
            }
          });
        }
      };

      return { onMove, onEnd, getDidDrag: () => didDrag };
    },
    [position]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, headerSelector: string) => {
      const result = startDrag(
        e.clientX,
        e.clientY,
        e.target as HTMLElement,
        headerSelector
      );
      if (!result) return;

      e.preventDefault();
      const { onMove, onEnd } = result;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        onMove(moveEvent.clientX, moveEvent.clientY);
      };
      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        onEnd();
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [startDrag]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, headerSelector: string) => {
      const touch = e.touches[0];
      if (!touch) return;

      const result = startDrag(
        touch.clientX,
        touch.clientY,
        e.target as HTMLElement,
        headerSelector
      );
      if (!result) return;

      const { onMove, onEnd, getDidDrag } = result;

      const handleTouchMove = (moveEvent: TouchEvent) => {
        const t = moveEvent.touches[0];
        if (!t) return;
        if (getDidDrag()) {
          moveEvent.preventDefault();
        }
        onMove(t.clientX, t.clientY);
      };
      const handleTouchEnd = () => {
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
        onEnd();
      };
      document.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      document.addEventListener("touchend", handleTouchEnd);
    },
    [startDrag]
  );

  return {
    position,
    zIndex,
    minimized,
    setMinimized,
    containerRef,
    handleMouseDown,
    handleTouchStart,
  };
}
