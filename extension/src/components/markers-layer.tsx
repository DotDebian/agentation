import {
  annotations,
  showMarkers,
  isActive,
  editingAnnotation,
  exitingMarkers,
} from "../store/signals";
import { Marker } from "./marker";
import type { Annotation } from "../types";
import styles from "../styles/toolbar.module.scss";

interface MarkersLayerProps {
  onDelete: (id: string) => void;
  onEdit: (annotation: Annotation) => void;
}

/**
 * Renders annotation markers in two layers:
 * - Normal markers: positioned absolutely relative to page scroll
 * - Fixed markers: positioned fixed relative to viewport
 */
export function MarkersLayer({ onDelete, onEdit }: MarkersLayerProps) {
  if (!isActive.value || !showMarkers.value) return null;

  const allAnnotations = annotations.value;
  const normalAnnotations = allAnnotations.filter((a) => !a.isFixed);
  const fixedAnnotations = allAnnotations.filter((a) => a.isFixed);

  return (
    <>
      {/* Normal (scrolling) markers layer */}
      <div className={styles.markersLayer} data-agentation>
        {normalAnnotations.map((annotation, index) => (
          <Marker
            key={annotation.id}
            annotation={annotation}
            index={index}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </div>

      {/* Fixed markers layer */}
      <div className={styles.fixedMarkersLayer} data-agentation>
        {fixedAnnotations.map((annotation, index) => (
          <Marker
            key={annotation.id}
            annotation={annotation}
            index={index}
            isFixed
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </div>
    </>
  );
}
