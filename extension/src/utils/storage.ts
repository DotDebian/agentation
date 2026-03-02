// =============================================================================
// Storage Utilities (Chrome Extension)
// =============================================================================
//
// Async adapter using chrome.storage.local instead of localStorage.
// Same API surface as the original, but all functions return Promises.
//

import type { Annotation } from "../types";

const STORAGE_PREFIX = "feedback-annotations-";
const SETTINGS_KEY = "feedback-toolbar-settings";
const THEME_KEY = "feedback-toolbar-theme";
const POSITION_KEY = "feedback-toolbar-position";
const SESSION_PREFIX = "agentation-session-";
const DEFAULT_RETENTION_DAYS = 7;

export function getStorageKey(pathname: string): string {
  return `${STORAGE_PREFIX}${pathname}`;
}

async function getItem(key: string): Promise<string | null> {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? null;
}

async function setItem(key: string, value: string): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

async function removeItem(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}

// =============================================================================
// Annotations
// =============================================================================

export async function loadAnnotations<T = Annotation>(pathname: string): Promise<T[]> {
  try {
    const stored = await getItem(getStorageKey(pathname));
    if (!stored) return [];
    const data = JSON.parse(stored);
    const cutoff = Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return data.filter((a: { timestamp?: number }) => !a.timestamp || a.timestamp > cutoff);
  } catch {
    return [];
  }
}

export async function saveAnnotations<T = Annotation>(pathname: string, annotations: T[]): Promise<void> {
  try {
    await setItem(getStorageKey(pathname), JSON.stringify(annotations));
  } catch {
    // storage might be full
  }
}

export async function clearAnnotations(pathname: string): Promise<void> {
  try {
    await removeItem(getStorageKey(pathname));
  } catch {
    // ignore
  }
}

export async function loadAllAnnotations<T = Annotation>(): Promise<Map<string, T[]>> {
  const result = new Map<string, T[]>();
  try {
    const all = await chrome.storage.local.get(null);
    const cutoff = Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(STORAGE_PREFIX) && typeof value === "string") {
        const pathname = key.slice(STORAGE_PREFIX.length);
        const data = JSON.parse(value);
        const filtered = data.filter(
          (a: { timestamp?: number }) => !a.timestamp || a.timestamp > cutoff,
        );
        if (filtered.length > 0) {
          result.set(pathname, filtered);
        }
      }
    }
  } catch {
    // ignore
  }
  return result;
}

// =============================================================================
// Sync Marker Utilities
// =============================================================================

type AnnotationWithSyncMarker = Annotation & { _syncedTo?: string };

export async function saveAnnotationsWithSyncMarker(
  pathname: string,
  annotations: Annotation[],
  sessionId: string,
): Promise<void> {
  const marked = annotations.map((annotation) => ({
    ...annotation,
    _syncedTo: sessionId,
  }));
  await saveAnnotations(pathname, marked);
}

export async function getUnsyncedAnnotations(
  pathname: string,
  sessionId?: string,
): Promise<Annotation[]> {
  const annotations = await loadAnnotations<AnnotationWithSyncMarker>(pathname);
  return annotations.filter((annotation) => {
    if (!annotation._syncedTo) return true;
    if (sessionId && annotation._syncedTo !== sessionId) return true;
    return false;
  });
}

export async function clearSyncMarkers(pathname: string): Promise<void> {
  const annotations = await loadAnnotations<AnnotationWithSyncMarker>(pathname);
  const cleaned = annotations.map((annotation) => {
    const { _syncedTo, ...rest } = annotation;
    return rest as Annotation;
  });
  await saveAnnotations(pathname, cleaned);
}

// =============================================================================
// Session Storage
// =============================================================================

export function getSessionStorageKey(pathname: string): string {
  return `${SESSION_PREFIX}${pathname}`;
}

export async function loadSessionId(pathname: string): Promise<string | null> {
  try {
    return await getItem(getSessionStorageKey(pathname));
  } catch {
    return null;
  }
}

export async function saveSessionId(pathname: string, sessionId: string): Promise<void> {
  try {
    await setItem(getSessionStorageKey(pathname), sessionId);
  } catch {
    // ignore
  }
}

export async function clearSessionId(pathname: string): Promise<void> {
  try {
    await removeItem(getSessionStorageKey(pathname));
  } catch {
    // ignore
  }
}

// =============================================================================
// Settings Storage
// =============================================================================

export async function loadSettings<T>(defaultValue: T): Promise<T> {
  try {
    const stored = await getItem(SETTINGS_KEY);
    if (!stored) return defaultValue;
    return { ...defaultValue, ...JSON.parse(stored) };
  } catch {
    return defaultValue;
  }
}

export async function saveSettings<T>(settings: T): Promise<void> {
  try {
    await setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export async function loadTheme(): Promise<boolean> {
  try {
    const stored = await getItem(THEME_KEY);
    return stored !== "light"; // default to dark
  } catch {
    return true;
  }
}

export async function saveTheme(isDark: boolean): Promise<void> {
  try {
    await setItem(THEME_KEY, isDark ? "dark" : "light");
  } catch {
    // ignore
  }
}

export async function loadToolbarPosition(): Promise<{ x: number; y: number } | null> {
  try {
    const stored = await getItem(POSITION_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export async function saveToolbarPosition(pos: { x: number; y: number }): Promise<void> {
  try {
    await setItem(POSITION_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}
