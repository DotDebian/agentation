import { useState, useCallback } from "preact/hooks";
import {
  annotations,
  settings,
  isDarkMode,
  editingAnnotation,
  hoveredMarkerId,
  animatedMarkers,
  exitingMarkers,
  scrollY,
} from "../store/signals";
import { IconXmark, IconEdit } from "./icons";
import type { Annotation } from "../types";
import styles from "../styles/toolbar.module.scss";

interface MarkerProps {
  annotation: Annotation;
  index: number;
  isFixed?: boolean;
  onDelete: (id: string) => void;
  onEdit: (annotation: Annotation) => void;
}

export function Marker({ annotation, index, isFixed, onDelete, onEdit }: MarkerProps) {
  const dark = isDarkMode.value;
  const s = settings.value;
  const isHovered = hoveredMarkerId.value === annotation.id;
  const isExiting = exitingMarkers.value.has(annotation.id);
  const needsEnterAnimation = !animatedMarkers.value.has(annotation.id);
  const editing = editingAnnotation.value;
  const isMulti = annotation.isMultiSelect;
  const markerColor = isMulti ? "#34C759" : s.annotationColor;

  const globalIndex = annotations.value.findIndex((a) => a.id === annotation.id);
  const showDeleteState = isHovered && !editing;
  const showDeleteHover = showDeleteState && s.markerClickBehavior === "delete";

  const animClass = isExiting
    ? styles.exit
    : needsEnterAnimation
      ? styles.enter
      : "";

  const handleMouseEnter = useCallback(() => {
    hoveredMarkerId.value = annotation.id;
  }, [annotation.id]);

  const handleMouseLeave = useCallback(() => {
    hoveredMarkerId.value = null;
  }, []);

  const handleClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    if (s.markerClickBehavior === "delete") {
      onDelete(annotation.id);
    } else {
      onEdit(annotation);
    }
  }, [annotation, s.markerClickBehavior, onDelete, onEdit]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    if (s.markerClickBehavior === "delete") {
      e.preventDefault();
      e.stopPropagation();
      onEdit(annotation);
    }
  }, [annotation, s.markerClickBehavior, onEdit]);

  // Mark as animated after enter
  if (needsEnterAnimation) {
    setTimeout(() => {
      animatedMarkers.value = new Set([...animatedMarkers.value, annotation.id]);
    }, 300);
  }

  return (
    <div
      className={[
        styles.marker,
        isFixed ? styles.fixed : "",
        isMulti ? styles.multiSelect : "",
        animClass,
        showDeleteHover ? styles.hovered : "",
      ].filter(Boolean).join(" ")}
      data-agentation
      style={{
        left: `${annotation.x}%`,
        top: isFixed ? annotation.y : annotation.y - scrollY.value,
        backgroundColor: showDeleteHover ? undefined : markerColor,
        animationDelay: needsEnterAnimation ? `${index * 20}ms` : undefined,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {showDeleteState ? (
        showDeleteHover ? (
          <IconXmark size={isMulti ? 18 : 16} />
        ) : (
          <IconEdit size={16} />
        )
      ) : (
        <span>{globalIndex + 1}</span>
      )}

      {/* Tooltip */}
      {isHovered && !editing && (
        <div
          className={`${styles.markerTooltip} ${!dark ? styles.light : ""} ${styles.enter}`}
          style={{
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <span className={styles.markerQuote}>
            {annotation.element}
            {annotation.selectedText &&
              ` "${annotation.selectedText.slice(0, 30)}${annotation.selectedText.length > 30 ? "..." : ""}"`}
          </span>
          <span className={styles.markerNote}>{annotation.comment}</span>
        </div>
      )}
    </div>
  );
}
