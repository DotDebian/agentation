import { useEffect } from "preact/hooks";
import { hoverInfo, isActive, isDrawMode, pendingAnnotation, editingAnnotation, settings } from "../store/signals";
import { identifyElement, getNearbyText, getElementClasses } from "../utils/element-identification";
import { deepElementFromPoint } from "../utils/deep-element";

/**
 * Tracks mouse movement and identifies the element under the cursor.
 * Updates hoverInfo signal for the overlay to render.
 */
export function useHover() {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isActive.value || isDrawMode.value || pendingAnnotation.value || editingAnnotation.value) {
        if (hoverInfo.value) hoverInfo.value = null;
        return;
      }

      const target = deepElementFromPoint(e.clientX, e.clientY);
      if (!target || target.closest("[data-agentation]")) {
        hoverInfo.value = null;
        return;
      }

      const { name, path } = identifyElement(target);

      hoverInfo.value = {
        element: name,
        elementName: name,
        elementPath: path,
        rect: target.getBoundingClientRect(),
        reactComponents: null,
      };
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);
}
