// =============================================================================
// Shared Types
// =============================================================================

export type Annotation = {
  id: string;
  x: number; // % of viewport width
  y: number; // px from top of document (absolute) OR viewport (if isFixed)
  comment: string;
  element: string;
  elementPath: string;
  timestamp: number;
  selectedText?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  nearbyText?: string;
  cssClasses?: string;
  nearbyElements?: string;
  computedStyles?: string;
  fullPath?: string;
  accessibility?: string;
  isMultiSelect?: boolean; // true if created via drag selection
  isFixed?: boolean; // true if element has fixed/sticky positioning (marker stays fixed)
  reactComponents?: string; // React component hierarchy (e.g. "<App> <Dashboard> <Button>")
  elementBoundingBoxes?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>; // Individual bounding boxes for multi-select hover highlighting
  drawingIndex?: number; // Index of linked drawing stroke (click-to-annotate)
  strokeId?: string; // Unique ID of linked drawing stroke

  // Protocol fields (added when syncing to server)
  sessionId?: string;
  url?: string;
  intent?: AnnotationIntent;
  severity?: AnnotationSeverity;
  status?: AnnotationStatus;
  thread?: ThreadMessage[];
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
  resolvedBy?: "human" | "agent";
  authorId?: string;

  // Local-only sync tracking (not sent to server)
  _syncedTo?: string; // Session ID this annotation was synced to
};

// -----------------------------------------------------------------------------
// Annotation Enums
// -----------------------------------------------------------------------------

export type AnnotationIntent = "fix" | "change" | "question" | "approve";
export type AnnotationSeverity = "blocking" | "important" | "suggestion";
export type AnnotationStatus = "pending" | "acknowledged" | "resolved" | "dismissed";

// -----------------------------------------------------------------------------
// Session
// -----------------------------------------------------------------------------

export type Session = {
  id: string;
  url: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
};

export type SessionStatus = "active" | "approved" | "closed";

export type SessionWithAnnotations = Session & {
  annotations: Annotation[];
};

// -----------------------------------------------------------------------------
// Thread Messages
// -----------------------------------------------------------------------------

export type ThreadMessage = {
  id: string;
  role: "human" | "agent";
  content: string;
  timestamp: number;
};

// -----------------------------------------------------------------------------
// Extension-specific Types
// -----------------------------------------------------------------------------

export type OutputDetailLevel = "compact" | "standard" | "detailed" | "forensic";
export type ReactComponentMode = "smart" | "filtered" | "all" | "off";
export type MarkerClickBehavior = "edit" | "delete";

export type ToolbarSettings = {
  outputDetail: OutputDetailLevel;
  autoClearAfterCopy: boolean;
  annotationColor: string;
  blockInteractions: boolean;
  reactEnabled: boolean;
  markerClickBehavior: MarkerClickBehavior;
  webhookUrl: string;
  webhooksEnabled: boolean;
};

export type HoverInfo = {
  element: string;
  elementName: string;
  elementPath: string;
  rect: DOMRect | null;
  reactComponents?: string | null;
};

export type DrawStroke = {
  id: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  fixed: boolean;
};

export type PendingAnnotation = {
  x: number;
  y: number;
  element: string;
  elementName: string;
  elementPath: string;
  target: HTMLElement;
  boundingBox: { x: number; y: number; width: number; height: number };
  isFixed: boolean;
  nearbyText?: string;
  cssClasses?: string;
  nearbyElements?: string;
  computedStyles?: string;
  fullPath?: string;
  accessibility?: string;
  reactComponents?: string | null;
  selectedText?: string;
  isMultiSelect?: boolean;
  elementBoundingBoxes?: Array<{ x: number; y: number; width: number; height: number }>;
  drawingIndex?: number;
  strokeId?: string;
};

// Chrome extension message types
export type ExtensionMessage =
  | { type: "TOGGLE_TOOLBAR" }
  | { type: "UPDATE_BADGE"; count: number; color?: string };

