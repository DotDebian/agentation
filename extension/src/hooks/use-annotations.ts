import { useEffect, useCallback } from "preact/hooks";
import {
  annotations,
  pendingAnnotation,
  editingAnnotation,
  settings,
  isDarkMode,
  toolbarPosition,
  copied,
  sendState,
  drawStrokes,
  isDrawMode,
  showMarkers,
  animatedMarkers,
  exitingMarkers,
} from "../store/signals";
import {
  loadAnnotations,
  saveAnnotations,
  loadSettings,
  saveSettings,
  loadTheme,
  saveTheme,
  loadToolbarPosition,
  saveToolbarPosition,
} from "../utils/storage";
import { generateOutput } from "../utils/output-generator";
import { requestAction, syncAnnotation as syncAnnotationToServer } from "../utils/sync";
import type { Annotation, ToolbarSettings, PendingAnnotation } from "../types";
import { DEFAULT_SETTINGS, syncEndpoint, currentSessionId } from "../store/signals";

/**
 * Core annotation CRUD hook.
 * Handles loading from storage, adding, deleting, updating, clearing, copying.
 */
export function useAnnotations() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";

  // Load annotations, settings, theme, and position from chrome.storage on mount
  useEffect(() => {
    loadAnnotations(pathname).then((stored) => {
      annotations.value = stored;
    });
    loadSettings(DEFAULT_SETTINGS).then((stored) => {
      settings.value = stored;
    });
    loadTheme().then((dark) => {
      isDarkMode.value = dark;
    });
    loadToolbarPosition().then((pos) => {
      if (pos) toolbarPosition.value = pos;
    });
  }, [pathname]);

  // Persist annotations whenever they change
  useEffect(() => {
    const anns = annotations.value;
    if (anns.length > 0 || annotations.peek().length > 0) {
      saveAnnotations(pathname, anns);
    }
  }, [annotations.value, pathname]);

  // Persist settings whenever they change
  useEffect(() => {
    saveSettings(settings.value);
  }, [settings.value]);

  // Persist theme whenever it changes
  useEffect(() => {
    saveTheme(isDarkMode.value);
  }, [isDarkMode.value]);

  // Persist toolbar position whenever it changes
  useEffect(() => {
    const pos = toolbarPosition.value;
    if (pos) {
      saveToolbarPosition(pos);
    }
  }, [toolbarPosition.value]);

  // Update badge count
  useEffect(() => {
    try {
      chrome.runtime.sendMessage({
        type: "UPDATE_BADGE",
        count: annotations.value.length,
        color: settings.value.annotationColor,
      });
    } catch {
      // Extension context might not be available
    }
  }, [annotations.value.length]);

  const addAnnotation = useCallback((pending: PendingAnnotation, comment: string) => {
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      x: pending.x,
      y: pending.y,
      comment,
      element: pending.element,
      elementPath: pending.elementPath,
      timestamp: Date.now(),
      selectedText: pending.selectedText,
      boundingBox: pending.boundingBox,
      nearbyText: pending.nearbyText,
      cssClasses: pending.cssClasses,
      nearbyElements: pending.nearbyElements,
      computedStyles: pending.computedStyles,
      fullPath: pending.fullPath,
      accessibility: pending.accessibility,
      isMultiSelect: pending.isMultiSelect,
      isFixed: pending.isFixed,
      reactComponents: pending.reactComponents || undefined,
      elementBoundingBoxes: pending.elementBoundingBoxes,
      drawingIndex: pending.drawingIndex,
      strokeId: pending.strokeId,
    };
    annotations.value = [...annotations.value, annotation];
    pendingAnnotation.value = null;

    // Also sync to MCP server if connected
    const endpoint = syncEndpoint.value;
    const sessionId = currentSessionId.value;
    if (endpoint && sessionId) {
      syncAnnotationToServer(endpoint, sessionId, annotation).catch(() => {});
    }

    return annotation;
  }, []);

  const deleteAnnotation = useCallback((id: string) => {
    // Add to exiting set for animation
    exitingMarkers.value = new Set([...exitingMarkers.value, id]);
    setTimeout(() => {
      annotations.value = annotations.value.filter((a) => a.id !== id);
      exitingMarkers.value = new Set([...exitingMarkers.value].filter((x) => x !== id));
    }, 200);
  }, []);

  const updateAnnotation = useCallback((id: string, comment: string) => {
    annotations.value = annotations.value.map((a) =>
      a.id === id ? { ...a, comment } : a,
    );
    editingAnnotation.value = null;
  }, []);

  const clearAll = useCallback(() => {
    annotations.value = [];
    drawStrokes.value = [];
    pendingAnnotation.value = null;
    editingAnnotation.value = null;
    isDrawMode.value = false;
    animatedMarkers.value = new Set();
    exitingMarkers.value = new Set();
  }, []);

  const copyOutput = useCallback(async () => {
    const output = generateOutput(
      annotations.value,
      pathname,
      settings.value.outputDetail,
    );
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      copied.value = true;
      setTimeout(() => { copied.value = false; }, 2000);
      if (settings.value.autoClearAfterCopy) {
        clearAll();
      }
    } catch {
      // Clipboard access denied
    }
  }, [pathname, clearAll]);

  const sendToWebhook = useCallback(async () => {
    const output = generateOutput(
      annotations.value,
      pathname,
      settings.value.outputDetail,
    );
    if (!output) return;

    sendState.value = "sending";

    try {
      const endpoint = syncEndpoint.value;
      const sessionId = currentSessionId.value;

      // Prefer MCP server requestAction when a session is active
      if (endpoint && sessionId) {
        const result = await requestAction(endpoint, sessionId, output);
        sendState.value = result.success ? "sent" : "failed";
      } else {
        // Fall back to webhook URL
        const url = settings.value.webhookUrl;
        if (!url) {
          sendState.value = "failed";
          setTimeout(() => { sendState.value = "idle"; }, 2000);
          return;
        }
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            annotations: annotations.value,
            output,
            url: window.location.href,
            timestamp: new Date().toISOString(),
          }),
        });
        sendState.value = res.ok ? "sent" : "failed";
      }
    } catch {
      sendState.value = "failed";
    }
    setTimeout(() => { sendState.value = "idle"; }, 2000);
  }, [pathname]);

  return {
    addAnnotation,
    deleteAnnotation,
    updateAnnotation,
    clearAll,
    copyOutput,
    sendToWebhook,
  };
}
