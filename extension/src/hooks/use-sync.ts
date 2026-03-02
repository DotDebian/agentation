// =============================================================================
// MCP Server Sync Hook
// =============================================================================
//
// Manages the connection to an MCP server:
// - Session creation and resumption
// - SSE event stream for real-time annotation updates
// - Health check polling for connection status
// - Automatic re-sync on reconnection
// - Graceful degradation when server is unavailable
//

import { useEffect, useRef } from "preact/hooks";
import {
  annotations,
  syncEndpoint,
  currentSessionId,
  connectionStatus,
  exitingMarkers,
} from "../store/signals";
import {
  loadSessionId,
  saveSessionId,
  clearSessionId,
  saveAnnotationsWithSyncMarker,
  getUnsyncedAnnotations,
  loadAllAnnotations,
} from "../utils/storage";
import {
  createSession,
  getSession,
  syncAnnotation,
} from "../utils/sync";
import type { Annotation } from "../types";

const HEALTH_CHECK_INTERVAL = 10_000; // 10 seconds

/**
 * Hook that manages MCP server session lifecycle, SSE event streaming,
 * and health check polling.
 */
export function useSync() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const sessionInitializedRef = useRef(false);
  const prevConnectionStatusRef = useRef<string>("disconnected");

  // ─── Session Initialization ───────────────────────────────────────────────
  useEffect(() => {
    const endpoint = syncEndpoint.value;
    if (!endpoint) return;
    if (sessionInitializedRef.current) return;

    sessionInitializedRef.current = true;
    connectionStatus.value = "connecting";

    const currentUrl = window.location.href;

    (async () => {
      try {
        // Try to resume existing session
        const storedSessionId = await loadSessionId(pathname);

        if (storedSessionId) {
          try {
            const session = await getSession(endpoint, storedSessionId);
            currentSessionId.value = session.id;
            connectionStatus.value = "connected";

            // Sync any unsynced local annotations
            const unsynced = await getUnsyncedAnnotations(pathname, session.id);
            for (const ann of unsynced) {
              try {
                await syncAnnotation(endpoint, session.id, ann);
              } catch {
                // Individual sync failure is ok
              }
            }

            // Mark all as synced
            if (annotations.value.length > 0) {
              await saveAnnotationsWithSyncMarker(pathname, annotations.value, session.id);
            }

            return;
          } catch {
            // Session not found / expired — clear and create new
            await clearSessionId(pathname);
          }
        }

        // Create a new session
        const session = await createSession(endpoint, currentUrl);
        currentSessionId.value = session.id;
        connectionStatus.value = "connected";
        await saveSessionId(pathname, session.id);

        // Sync all unsynced annotations (from all pages)
        const allAnnotations = await loadAllAnnotations<Annotation>();
        for (const [pagePath, pageAnnotations] of allAnnotations) {
          const unsynced = pageAnnotations.filter(
            (a: Annotation & { _syncedTo?: string }) => !a._syncedTo,
          );
          for (const ann of unsynced) {
            try {
              await syncAnnotation(endpoint, session.id, ann);
            } catch {
              // Individual sync failure is ok
            }
          }
          if (pageAnnotations.length > 0) {
            await saveAnnotationsWithSyncMarker(pagePath, pageAnnotations, session.id);
          }
        }
      } catch {
        // Server unreachable — stay in local-only mode
        connectionStatus.value = "disconnected";
        sessionInitializedRef.current = false; // Allow retry on reconnection
      }
    })();
  }, [syncEndpoint.value, pathname]);

  // ─── Health Check Polling ─────────────────────────────────────────────────
  useEffect(() => {
    const endpoint = syncEndpoint.value;
    if (!endpoint) return;

    const checkHealth = async () => {
      try {
        const res = await fetch(`${endpoint}/health`);
        if (res.ok) {
          connectionStatus.value = "connected";
        } else {
          connectionStatus.value = "disconnected";
        }
      } catch {
        connectionStatus.value = "disconnected";
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, HEALTH_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [syncEndpoint.value]);

  // ─── SSE Event Stream ─────────────────────────────────────────────────────
  useEffect(() => {
    const endpoint = syncEndpoint.value;
    const sessionId = currentSessionId.value;
    if (!endpoint || !sessionId) return;
    if (connectionStatus.value !== "connected") return;

    const eventSource = new EventSource(
      `${endpoint}/sessions/${sessionId}/events`,
    );

    const removedStatuses = ["resolved", "dismissed"];

    const handleAnnotationUpdated = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const payload = data.payload;
        if (!payload) return;

        // If annotation was resolved/dismissed by agent, remove it with animation
        if (removedStatuses.includes(payload.status)) {
          const id = payload.id;
          if (!id) return;

          // Trigger exit animation
          exitingMarkers.value = new Set([...exitingMarkers.value, id]);

          // Remove after animation
          setTimeout(() => {
            annotations.value = annotations.value.filter((a) => a.id !== id);
            exitingMarkers.value = new Set(
              [...exitingMarkers.value].filter((x) => x !== id),
            );
          }, 150);
        }
      } catch {
        // Ignore malformed events
      }
    };

    eventSource.addEventListener("annotation.updated", handleAnnotationUpdated);

    return () => {
      eventSource.removeEventListener("annotation.updated", handleAnnotationUpdated);
      eventSource.close();
    };
  }, [syncEndpoint.value, currentSessionId.value, connectionStatus.value]);

  // ─── Reconnection Sync ────────────────────────────────────────────────────
  useEffect(() => {
    const current = connectionStatus.value;
    const prev = prevConnectionStatusRef.current;
    prevConnectionStatusRef.current = current;

    const wasDisconnected = prev === "disconnected";
    const isNowConnected = current === "connected";

    if (!wasDisconnected || !isNowConnected) return;

    const endpoint = syncEndpoint.value;
    const sessionId = currentSessionId.value;
    if (!endpoint || !sessionId) return;

    // Re-sync unsynced annotations on reconnection
    (async () => {
      try {
        // Get server state
        const serverSession = await getSession(endpoint, sessionId);

        // Get local unsynced
        const unsynced = await getUnsyncedAnnotations(pathname, sessionId);

        // Upload unsynced
        const synced: Annotation[] = [];
        for (const ann of unsynced) {
          try {
            const serverAnn = await syncAnnotation(endpoint, sessionId, ann);
            synced.push(serverAnn);
          } catch {
            synced.push(ann);
          }
        }

        // Merge: server annotations + newly synced local ones
        const serverIds = new Set(serverSession.annotations.map((a) => a.id));
        const merged = [
          ...serverSession.annotations,
          ...synced.filter((a) => !serverIds.has(a.id)),
        ];

        annotations.value = merged;
        await saveAnnotationsWithSyncMarker(pathname, merged, sessionId);
      } catch {
        // If session was deleted, reset and allow re-initialization
        currentSessionId.value = null;
        sessionInitializedRef.current = false;
        await clearSessionId(pathname);
      }
    })();
  }, [connectionStatus.value, pathname]);
}
