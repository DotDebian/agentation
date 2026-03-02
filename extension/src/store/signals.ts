// =============================================================================
// Preact Signals Store
// =============================================================================
//
// Central state management using @preact/signals.
// Module-level signals — importable from any component or hook.
//

import { signal, computed } from "@preact/signals";
import type {
  Annotation,
  ToolbarSettings,
  HoverInfo,
  PendingAnnotation,
  DrawStroke,
  OutputDetailLevel,
  ReactComponentMode,
} from "../types";
import { OUTPUT_TO_REACT_MODE } from "../utils/output-generator";

// =============================================================================
// Default Settings
// =============================================================================

export const DEFAULT_SETTINGS: ToolbarSettings = {
  outputDetail: "standard",
  autoClearAfterCopy: false,
  annotationColor: "#3c82f7",
  blockInteractions: true,
  reactEnabled: true,
  markerClickBehavior: "edit",
  webhookUrl: "",
  webhooksEnabled: true,
};

// =============================================================================
// Core State
// =============================================================================

/** Whether the toolbar is active (expanded) */
export const isActive = signal(false);

/** All annotations for the current page */
export const annotations = signal<Annotation[]>([]);

/** Current settings */
export const settings = signal<ToolbarSettings>(DEFAULT_SETTINGS);

/** Dark mode (true) or light mode (false) */
export const isDarkMode = signal(true);

// =============================================================================
// UI State
// =============================================================================

/** Whether annotation markers are visible */
export const showMarkers = signal(true);

/** Whether the settings panel is open */
export const showSettings = signal(false);

/** Settings panel sub-page */
export const settingsPage = signal<"main" | "automations">("main");

/** Annotation being created (click/draw) */
export const pendingAnnotation = signal<PendingAnnotation | null>(null);

/** Annotation being edited */
export const editingAnnotation = signal<Annotation | null>(null);

/** Element hover information */
export const hoverInfo = signal<HoverInfo | null>(null);

/** Currently hovered marker ID */
export const hoveredMarkerId = signal<string | null>(null);

/** Whether page animations are frozen */
export const isFrozen = signal(false);

/** Whether drawing mode is active */
export const isDrawMode = signal(false);

/** All drawing strokes */
export const drawStrokes = signal<DrawStroke[]>([]);

/** Index of currently hovered drawing stroke */
export const hoveredDrawingIdx = signal<number | null>(null);

/** Current page scroll Y position */
export const scrollY = signal(0);

/** Toolbar position (for drag) */
export const toolbarPosition = signal<{ x: number; y: number } | null>(null);

/** Copy button state */
export const copied = signal(false);

/** Send to agent button state */
export const sendState = signal<"idle" | "sending" | "sent" | "failed">("idle");

// =============================================================================
// Sync State
// =============================================================================

/** MCP server endpoint URL */
export const syncEndpoint = signal<string>("http://localhost:4747");

/** Current session ID (if synced to server) */
export const currentSessionId = signal<string | null>(null);

/** Connection status to MCP server */
export const connectionStatus = signal<"disconnected" | "connecting" | "connected">("disconnected");

// =============================================================================
// Animation State (markers enter/exit)
// =============================================================================

/** Markers that have finished their enter animation */
export const animatedMarkers = signal<Set<string>>(new Set());

/** Markers currently in their exit animation */
export const exitingMarkers = signal<Set<string>>(new Set());

// =============================================================================
// Computed Values
// =============================================================================

/** Whether we're on localhost (enables React detection) */
export const isLocalhost = signal(
  typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"),
);

/** Effective React detection mode based on settings and context */
export const effectiveReactMode = computed((): ReactComponentMode => {
  if (!isLocalhost.value || !settings.value.reactEnabled) return "off";
  return OUTPUT_TO_REACT_MODE[settings.value.outputDetail];
});

/** Whether there are any annotations */
export const hasAnnotations = computed(() => annotations.value.length > 0);

/** Whether markers should be displayed */
export const shouldShowMarkers = computed(() => showMarkers.value && hasAnnotations.value);

/** Annotations count */
export const annotationCount = computed(() => annotations.value.length);
