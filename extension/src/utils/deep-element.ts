// =============================================================================
// Deep Element Utilities
// =============================================================================
//
// Extracted from the monolith toolbar component.
// Pure DOM utilities for finding elements at points, checking fixed positioning,
// and detecting stroke hits.
//

/**
 * Recursively pierces shadow DOMs to find the deepest element at a point.
 * document.elementFromPoint() stops at shadow hosts, so we need to
 * recursively check inside open shadow roots to find the actual target.
 */
export function deepElementFromPoint(x: number, y: number): HTMLElement | null {
  let element = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!element) return null;

  while (element?.shadowRoot) {
    const deeper = element.shadowRoot.elementFromPoint(x, y) as HTMLElement | null;
    if (!deeper || deeper === element) break;
    element = deeper;
  }

  return element;
}

/**
 * Checks if an element or any ancestor has fixed or sticky positioning.
 */
export function isElementFixed(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const position = style.position;
    if (position === "fixed" || position === "sticky") {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/**
 * Find which stroke (if any) is within `threshold` pixels of (x, y).
 * Returns the stroke index or null.
 */
export function findStrokeAtPoint(
  x: number,
  y: number,
  strokes: Array<{ points: Array<{ x: number; y: number }>; fixed: boolean }>,
  threshold = 12,
): number | null {
  const scrollY = window.scrollY;
  // Reverse order — last drawn is on top
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    if (stroke.points.length < 2) continue;
    for (let j = 0; j < stroke.points.length - 1; j++) {
      const a = stroke.points[j];
      const b = stroke.points[j + 1];
      const ay = stroke.fixed ? a.y : a.y - scrollY;
      const by = stroke.fixed ? b.y : b.y - scrollY;
      const ax = a.x;
      const bx = b.x;
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = ax + t * dx;
      const projY = ay + t * dy;
      const dist = Math.hypot(x - projX, y - projY);
      if (dist < threshold) return i;
    }
  }
  return null;
}
