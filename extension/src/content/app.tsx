import { useEffect, useCallback } from "preact/hooks";
import {
  isActive,
  isFrozen,
  isDrawMode,
  pendingAnnotation,
  editingAnnotation,
  annotations,
  settings,
  isDarkMode,
  hoverInfo,
  showMarkers,
  showSettings,
  settingsPage,
  scrollY,
  toolbarPosition,
  animatedMarkers,
} from "../store/signals";
import { Toolbar } from "../components/toolbar";
import { Overlay } from "../components/overlay";
import { AnnotationPopup } from "../components/annotation-popup";
import { MarkersLayer } from "../components/markers-layer";
import { DrawCanvas } from "../components/draw-canvas";
import { useAnnotations } from "../hooks/use-annotations";
import { useHover } from "../hooks/use-hover";
import { useKeyboard } from "../hooks/use-keyboard";
import { useSync } from "../hooks/use-sync";
import { freeze as freezeAll, unfreeze as unfreezeAll } from "../utils/freeze-animations";
import { identifyElement, getNearbyText, getElementClasses, getDetailedComputedStyles, getForensicComputedStyles, getFullElementPath, getAccessibilityInfo, getNearbyElements } from "../utils/element-identification";
import { deepElementFromPoint, isElementFixed } from "../utils/deep-element";
import type { PendingAnnotation } from "../types";
import styles from "../styles/toolbar.module.scss";

export function App() {
  const { addAnnotation, deleteAnnotation, updateAnnotation, clearAll, copyOutput, sendToWebhook } =
    useAnnotations();

  // Hover tracking
  useHover();

  // MCP server sync (session, SSE, health checks)
  useSync();

  // Toggle freeze
  const toggleFreeze = useCallback(() => {
    if (isFrozen.value) {
      unfreezeAll();
      isFrozen.value = false;
    } else {
      freezeAll();
      isFrozen.value = true;
    }
  }, []);

  // Keyboard shortcuts
  useKeyboard({
    onToggleFreeze: toggleFreeze,
    onCopy: copyOutput,
    onClearAll: clearAll,
    onSend: sendToWebhook,
  });

  // Close settings when toolbar deactivates
  useEffect(() => {
    if (!isActive.value) {
      showSettings.value = false;
      settingsPage.value = "main";
    }
  }, [isActive.value]);

  // Listen for toggle event from extension icon click
  useEffect(() => {
    const handleToggle = () => {
      isActive.value = !isActive.value;
    };
    window.addEventListener("agentation-toggle", handleToggle);
    return () => window.removeEventListener("agentation-toggle", handleToggle);
  }, []);

  // Track scroll
  useEffect(() => {
    const handleScroll = () => {
      scrollY.value = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keep toolbar within viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      const pos = toolbarPosition.value;
      if (!pos) return;
      const clamped = {
        x: Math.max(0, Math.min(window.innerWidth - 48, pos.x)),
        y: Math.max(0, Math.min(window.innerHeight - 48, pos.y)),
      };
      if (clamped.x !== pos.x || clamped.y !== pos.y) {
        toolbarPosition.value = clamped;
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Click handler for creating annotations
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!isActive.value || isDrawMode.value) return;
      if (pendingAnnotation.value || editingAnnotation.value) return;

      // Ignore clicks on our own UI
      const path = e.composedPath();
      if (path.some((el) => el instanceof HTMLElement && el.hasAttribute("data-agentation"))) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const target = deepElementFromPoint(e.clientX, e.clientY);
      if (!target) return;

      const { name, path: elementPath } = identifyElement(target);
      const rect = target.getBoundingClientRect();
      const fixed = isElementFixed(target);
      const detail = settings.value.outputDetail;

      const pending: PendingAnnotation = {
        x: (e.clientX / window.innerWidth) * 100,
        y: fixed ? e.clientY : e.clientY + window.scrollY,
        element: name,
        elementName: name,
        elementPath,
        target,
        boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        isFixed: fixed,
        nearbyText: detail !== "compact" ? getNearbyText(target) : undefined,
        cssClasses: detail === "detailed" || detail === "forensic" ? getElementClasses(target) : undefined,
        nearbyElements: detail === "forensic" ? getNearbyElements(target) : undefined,
        computedStyles: detail === "forensic" ? getForensicComputedStyles(target) : undefined,
        fullPath: detail === "forensic" ? getFullElementPath(target) : undefined,
        accessibility: detail === "forensic" ? getAccessibilityInfo(target) : undefined,
      };

      pendingAnnotation.value = pending;
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  // Cursor style injection into host page
  useEffect(() => {
    const styleId = "agentation-cursor-styles";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

    if (isActive.value && !isDrawMode.value && !pendingAnnotation.value && !editingAnnotation.value) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        *:not([data-agentation]):not([data-agentation] *) {
          cursor: crosshair !important;
        }
      `;
    } else {
      if (styleEl) {
        styleEl.remove();
      }
    }

    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [isActive.value, isDrawMode.value, pendingAnnotation.value, editingAnnotation.value]);

  const pending = pendingAnnotation.value;
  const editing = editingAnnotation.value;
  const dark = isDarkMode.value;
  const s = settings.value;

  return (
    <>
      <Toolbar
        onToggleFreeze={toggleFreeze}
        onCopy={copyOutput}
        onSend={sendToWebhook}
        onClearAll={clearAll}
      />

      <Overlay />

      <DrawCanvas />

      <MarkersLayer
        onDelete={deleteAnnotation}
        onEdit={(ann) => { editingAnnotation.value = ann; }}
      />

      {/* Pending annotation popup */}
      {pending && (
        <AnnotationPopup
          element={pending.element}
          selectedText={pending.selectedText}
          placeholder="What should change?"
          onSubmit={(text) => addAnnotation(pending, text)}
          onCancel={() => { pendingAnnotation.value = null; }}
          accentColor={s.annotationColor}
          lightMode={!dark}
          computedStyles={
            s.outputDetail === "detailed" || s.outputDetail === "forensic"
              ? getDetailedComputedStyles(pending.target)
              : undefined
          }
          style={{
            position: "fixed",
            left: `${Math.min(Math.max(pending.x, 15), 85)}%`,
            top: Math.min(
              pending.isFixed ? pending.y + 20 : pending.y - scrollY.value + 20,
              window.innerHeight - 200,
            ),
            transform: "translateX(-50%)",
            zIndex: 2147483646,
          }}
        />
      )}

      {/* Editing annotation popup */}
      {editing && (
        <AnnotationPopup
          element={editing.element}
          selectedText={editing.selectedText}
          placeholder="Update your feedback..."
          initialValue={editing.comment}
          submitLabel="Save"
          onSubmit={(text) => updateAnnotation(editing.id, text)}
          onCancel={() => { editingAnnotation.value = null; }}
          onDelete={() => { deleteAnnotation(editing.id); editingAnnotation.value = null; }}
          accentColor={s.annotationColor}
          lightMode={!dark}
          style={{
            position: "fixed",
            left: `${Math.min(Math.max(editing.x, 15), 85)}%`,
            top: Math.min(
              editing.isFixed ? editing.y + 20 : editing.y - scrollY.value + 20,
              window.innerHeight - 200,
            ),
            transform: "translateX(-50%)",
            zIndex: 2147483646,
          }}
        />
      )}
    </>
  );
}
