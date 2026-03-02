import { hoverInfo, isActive, isDrawMode, pendingAnnotation, editingAnnotation, isDarkMode, settings } from "../store/signals";
import { hexToRgba } from "../utils/output-generator";
import styles from "../styles/toolbar.module.scss";

/**
 * Overlay renders the hover highlight rectangle when hovering over page elements.
 * It also renders the element identification tooltip near the cursor.
 */
export function Overlay() {
  const active = isActive.value;
  const drawing = isDrawMode.value;
  const pending = pendingAnnotation.value;
  const editing = editingAnnotation.value;
  const hover = hoverInfo.value;
  const dark = isDarkMode.value;
  const color = settings.value.annotationColor;

  // Don't show overlay when not active, in draw mode, or when popup is open
  if (!active || drawing || pending || editing || !hover || !hover.rect) {
    return null;
  }

  const rect = hover.rect;

  return (
    <>
      {/* Hover highlight rectangle */}
      <div
        className={styles.hoverHighlight}
        style={{
          position: "fixed",
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          border: `2px solid ${color}`,
          backgroundColor: hexToRgba(color, 0.08),
          borderRadius: "4px",
          pointerEvents: "none",
          zIndex: 2147483645,
          transition: "all 0.1s ease",
        }}
      />

      {/* Element identification tooltip */}
      <div
        style={{
          position: "fixed",
          left: Math.min(rect.x, window.innerWidth - 260),
          top: Math.max(4, rect.y - 28),
          backgroundColor: dark ? "#1a1a1a" : "#fff",
          color: dark ? "#e5e5e5" : "#333",
          padding: "3px 8px",
          borderRadius: "4px",
          fontSize: "11px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontWeight: 500,
          maxWidth: "250px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          zIndex: 2147483646,
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          border: `1px solid ${dark ? "#333" : "#ddd"}`,
        }}
      >
        {hover.element}
      </div>
    </>
  );
}
