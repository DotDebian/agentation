import { useCallback, useRef } from "preact/hooks";
import {
  isActive,
  isDarkMode,
  isFrozen,
  isDrawMode,
  showMarkers,
  showSettings,
  settings,
  annotations,
  drawStrokes,
  copied,
  sendState,
  toolbarPosition,
  connectionStatus,
  hasAnnotations,
} from "../store/signals";
import {
  IconListSparkle,
  IconPausePlayAnimated,
  IconPencil,
  IconEyeAnimated,
  IconCopyAnimated,
  IconSendArrow,
  IconTrashAlt,
  IconGear,
  IconXmarkLarge,
} from "./icons";
import { SettingsPanel } from "./settings-panel";
import { hexToRgba } from "../utils/output-generator";
import styles from "../styles/toolbar.module.scss";

function isValidUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

interface ToolbarProps {
  onToggleFreeze: () => void;
  onCopy: () => void;
  onSend: () => void;
  onClearAll: () => void;
}

export function Toolbar({ onToggleFreeze, onCopy, onSend, onClearAll }: ToolbarProps) {
  const tooltipsHiddenRef = useRef(false);
  const justFinishedDragRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);

  const hideTooltips = useCallback(() => {
    tooltipsHiddenRef.current = true;
  }, []);

  const showTooltips = useCallback(() => {
    tooltipsHiddenRef.current = false;
  }, []);

  const handleToolbarMouseDown = useCallback((e: MouseEvent) => {
    if (!isActive.value) return;
    const pos = toolbarPosition.value || {
      x: window.innerWidth - 60,
      y: window.innerHeight - 60,
    };
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };

    const handleMouseMove = (me: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = me.clientX - dragStartRef.current.x;
      const dy = me.clientY - dragStartRef.current.y;
      if (!isDraggingRef.current && Math.hypot(dx, dy) > 4) {
        isDraggingRef.current = true;
      }
      if (isDraggingRef.current) {
        toolbarPosition.value = {
          x: Math.max(0, Math.min(window.innerWidth - 48, dragStartRef.current.posX + dx)),
          y: Math.max(0, Math.min(window.innerHeight - 48, dragStartRef.current.posY + dy)),
        };
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (isDraggingRef.current) {
        justFinishedDragRef.current = true;
        isDraggingRef.current = false;
        setTimeout(() => { justFinishedDragRef.current = false; }, 100);
      }
      dragStartRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const dark = isDarkMode.value;
  const active = isActive.value;
  const hasAnns = hasAnnotations.value;
  const s = settings.value;
  const pos = toolbarPosition.value;
  const connStatus = connectionStatus.value;

  const containerClasses = [
    styles.toolbarContainer,
    !dark ? styles.light : "",
    active ? styles.expanded : styles.collapsed,
  ].filter(Boolean).join(" ");

  const controlsClasses = [
    styles.controlsContent,
    active ? styles.visible : styles.hidden,
    pos && pos.y < 100 ? styles.tooltipBelow : "",
    tooltipsHiddenRef.current || showSettings.value ? styles.tooltipsHidden : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={styles.toolbar}
      data-agentation
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
    >
      <div
        className={containerClasses}
        onClick={!active ? (e: MouseEvent) => {
          if (justFinishedDragRef.current) {
            justFinishedDragRef.current = false;
            e.preventDefault();
            return;
          }
          isActive.value = true;
        } : undefined}
        onMouseDown={handleToolbarMouseDown}
        role={!active ? "button" : undefined}
        tabIndex={!active ? 0 : -1}
        title={!active ? "Start feedback mode" : undefined}
      >
        {/* Collapsed badge */}
        <div className={`${styles.toggleContent} ${!active ? styles.visible : styles.hidden}`}>
          <IconListSparkle size={24} />
          {hasAnns && (
            <span
              className={styles.badge}
              style={{ backgroundColor: s.annotationColor }}
            >
              {annotations.value.length}
            </span>
          )}
        </div>

        {/* Expanded controls */}
        <div className={controlsClasses} onMouseLeave={showTooltips}>
          <div className={`${styles.buttonWrapper} ${pos && pos.x < 120 ? styles.buttonWrapperAlignLeft : ""}`}>
            <button
              className={`${styles.controlButton} ${!dark ? styles.light : ""}`}
              onClick={(e: MouseEvent) => { e.stopPropagation(); hideTooltips(); onToggleFreeze(); }}
              data-active={isFrozen.value}
            >
              <IconPausePlayAnimated size={24} isPaused={isFrozen.value} />
            </button>
            <span className={styles.buttonTooltip}>
              {isFrozen.value ? "Resume animations" : "Pause animations"}
              <span className={styles.shortcut}>P</span>
            </span>
          </div>

          <div className={styles.buttonWrapper}>
            <button
              className={`${styles.controlButton} ${!dark ? styles.light : ""}`}
              onClick={(e: MouseEvent) => { e.stopPropagation(); hideTooltips(); isDrawMode.value = !isDrawMode.value; }}
              data-active={isDrawMode.value}
            >
              <IconPencil size={24} />
            </button>
            <span className={styles.buttonTooltip}>
              {isDrawMode.value ? "Exit draw mode" : "Draw mode"}
              <span className={styles.shortcut}>D</span>
            </span>
          </div>

          <div className={styles.buttonWrapper}>
            <button
              className={`${styles.controlButton} ${!dark ? styles.light : ""}`}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                hideTooltips();
                showMarkers.value = !showMarkers.value;
                if (isDrawMode.value) isDrawMode.value = false;
              }}
              disabled={!hasAnns}
            >
              <IconEyeAnimated size={24} isOpen={showMarkers.value} />
            </button>
            <span className={styles.buttonTooltip}>
              {showMarkers.value ? "Hide markers" : "Show markers"}
              <span className={styles.shortcut}>H</span>
            </span>
          </div>

          <div className={styles.buttonWrapper}>
            <button
              className={`${styles.controlButton} ${!dark ? styles.light : ""} ${copied.value ? styles.statusShowing : ""}`}
              onClick={(e: MouseEvent) => { e.stopPropagation(); hideTooltips(); onCopy(); }}
              disabled={!hasAnns && drawStrokes.value.length === 0}
              data-active={copied.value}
            >
              <IconCopyAnimated size={24} copied={copied.value} />
            </button>
            <span className={styles.buttonTooltip}>
              Copy feedback
              <span className={styles.shortcut}>C</span>
            </span>
          </div>

          <div className={`${styles.buttonWrapper} ${styles.sendButtonWrapper} ${
            !s.webhooksEnabled && (isValidUrl(s.webhookUrl)) ? styles.sendButtonVisible : ""
          }`}>
            <button
              className={`${styles.controlButton} ${!dark ? styles.light : ""} ${
                sendState.value === "sent" || sendState.value === "failed" ? styles.statusShowing : ""
              }`}
              onClick={(e: MouseEvent) => { e.stopPropagation(); hideTooltips(); onSend(); }}
              disabled={!hasAnns || !isValidUrl(s.webhookUrl) || sendState.value === "sending"}
            >
              <IconSendArrow size={24} state={sendState.value} />
              {hasAnns && sendState.value === "idle" && (
                <span
                  className={`${styles.buttonBadge} ${!dark ? styles.light : ""}`}
                  style={{ backgroundColor: s.annotationColor }}
                >
                  {annotations.value.length}
                </span>
              )}
            </button>
            <span className={styles.buttonTooltip}>
              Send Annotations
              <span className={styles.shortcut}>S</span>
            </span>
          </div>

          <div className={styles.buttonWrapper}>
            <button
              className={`${styles.controlButton} ${!dark ? styles.light : ""}`}
              onClick={(e: MouseEvent) => { e.stopPropagation(); hideTooltips(); onClearAll(); }}
              disabled={!hasAnns && drawStrokes.value.length === 0}
              data-danger
            >
              <IconTrashAlt size={24} />
            </button>
            <span className={styles.buttonTooltip}>
              Clear all
              <span className={styles.shortcut}>X</span>
            </span>
          </div>

          <div className={styles.buttonWrapper}>
            <button
              className={`${styles.controlButton} ${!dark ? styles.light : ""}`}
              onClick={(e: MouseEvent) => { e.stopPropagation(); hideTooltips(); showSettings.value = !showSettings.value; }}
            >
              <IconGear size={24} />
            </button>
            {connStatus !== "disconnected" && (
              <span
                className={`${styles.mcpIndicator} ${!dark ? styles.light : ""} ${styles[connStatus]} ${showSettings.value ? styles.hidden : ""}`}
                title={connStatus === "connected" ? "MCP Connected" : "MCP Connecting..."}
              />
            )}
            <span className={styles.buttonTooltip}>Settings</span>
          </div>

          <div className={`${styles.divider} ${!dark ? styles.light : ""}`} />

          <div className={`${styles.buttonWrapper} ${
            pos && pos.x > window.innerWidth - 120 ? styles.buttonWrapperAlignRight : ""
          }`}>
            <button
              className={`${styles.controlButton} ${!dark ? styles.light : ""}`}
              onClick={(e: MouseEvent) => { e.stopPropagation(); hideTooltips(); isActive.value = false; }}
            >
              <IconXmarkLarge size={24} />
            </button>
            <span className={styles.buttonTooltip}>
              Exit
              <span className={styles.shortcut}>Esc</span>
            </span>
          </div>
        </div>

        {/* Settings panel (slides out from toolbar) */}
        <SettingsPanel />
      </div>
    </div>
  );
}
