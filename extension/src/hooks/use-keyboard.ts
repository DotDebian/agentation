import { useEffect } from "preact/hooks";
import {
  isActive,
  isFrozen,
  isDrawMode,
  showMarkers,
  hasAnnotations,
  drawStrokes,
  pendingAnnotation,
  editingAnnotation,
  showSettings,
} from "../store/signals";

interface UseKeyboardOptions {
  onToggleFreeze: () => void;
  onCopy: () => void;
  onClearAll: () => void;
  onSend: () => void;
}

/**
 * Registers global keyboard shortcuts.
 */
export function useKeyboard({ onToggleFreeze, onCopy, onClearAll, onSend }: UseKeyboardOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Shift+F: Toggle toolbar
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        isActive.value = !isActive.value;
        return;
      }

      // All other shortcuts require active toolbar
      if (!isActive.value) return;

      // Don't capture when typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable) {
        // Only allow Escape in text fields
        if (e.key === "Escape") {
          if (pendingAnnotation.value) {
            pendingAnnotation.value = null;
          } else if (editingAnnotation.value) {
            editingAnnotation.value = null;
          }
        }
        return;
      }

      // Cmd/Ctrl+Z: Undo last stroke (draw mode only)
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && isDrawMode.value) {
        e.preventDefault();
        if (drawStrokes.value.length > 0) {
          drawStrokes.value = drawStrokes.value.slice(0, -1);
        }
        return;
      }

      switch (e.key) {
        case "Escape":
          if (isDrawMode.value) {
            isDrawMode.value = false;
          } else if (showSettings.value) {
            showSettings.value = false;
          } else if (pendingAnnotation.value) {
            pendingAnnotation.value = null;
          } else if (editingAnnotation.value) {
            editingAnnotation.value = null;
          } else {
            isActive.value = false;
          }
          break;
        case "p":
        case "P":
          onToggleFreeze();
          break;
        case "d":
        case "D":
          isDrawMode.value = !isDrawMode.value;
          break;
        case "h":
        case "H":
          if (hasAnnotations.value) {
            showMarkers.value = !showMarkers.value;
          }
          break;
        case "c":
        case "C":
          if (hasAnnotations.value) {
            onCopy();
          }
          break;
        case "x":
        case "X":
          if (hasAnnotations.value || drawStrokes.value.length > 0) {
            onClearAll();
          }
          break;
        case "s":
        case "S":
          if (hasAnnotations.value) {
            onSend();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onToggleFreeze, onCopy, onClearAll, onSend]);
}
