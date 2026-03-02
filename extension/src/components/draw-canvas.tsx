import { useRef, useEffect, useCallback } from "preact/hooks";
import {
  isActive,
  isDrawMode,
  drawStrokes,
  settings,
  pendingAnnotation,
  editingAnnotation,
  annotations,
  hoveredDrawingIdx,
  showMarkers,
  hoverInfo,
} from "../store/signals";
import { deepElementFromPoint, isElementFixed, findStrokeAtPoint } from "../utils/deep-element";
import { classifyStrokeGesture } from "../utils/output-generator";
import {
  identifyElement,
  getNearbyText,
  getElementClasses,
  getDetailedComputedStyles,
  getForensicComputedStyles,
  getFullElementPath,
  getAccessibilityInfo,
  getNearbyElements,
} from "../utils/element-identification";
import type { PendingAnnotation, DrawStroke } from "../types";
import styles from "../styles/toolbar.module.scss";

/**
 * Full-screen canvas overlay for freehand drawing mode.
 * Handles drawing, stroke hover detection, click-to-annotate on strokes.
 */
export function DrawCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([]);
  const clickStartRef = useRef<{ x: number; y: number; strokeIdx: number | null } | null>(null);

  // Canvas redraw helper
  const redrawCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, strokes: DrawStroke[], hoveredIdx?: number | null) => {
      const scrollY = window.scrollY;
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      for (let si = 0; si < strokes.length; si++) {
        const stroke = strokes[si];
        if (stroke.points.length < 2) continue;
        const offsetY = stroke.fixed ? 0 : scrollY;

        // Dim non-hovered strokes
        const alpha = hoveredIdx != null && si !== hoveredIdx ? 0.3 : 1;
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const p0 = stroke.points[0];
        ctx.moveTo(p0.x, p0.y - offsetY);
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const curr = stroke.points[i];
          const next = stroke.points[i + 1];
          const midX = (curr.x + next.x) / 2;
          const midY = (curr.y + next.y - 2 * offsetY) / 2;
          ctx.quadraticCurveTo(curr.x, curr.y - offsetY, midX, midY);
        }
        const last = stroke.points[stroke.points.length - 1];
        ctx.lineTo(last.x, last.y - offsetY);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    },
    [],
  );

  // Resize canvas to viewport
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) redrawCanvas(ctx, drawStrokes.value, hoveredDrawingIdx.value);
  }, [redrawCanvas]);

  // Drawing logic
  useEffect(() => {
    if (!isDrawMode.value || !isActive.value) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    resizeCanvas();

    const handleMouseDown = (e: MouseEvent) => {
      if (pendingAnnotation.value || editingAnnotation.value) return;

      const strokeIdx = findStrokeAtPoint(e.clientX, e.clientY, drawStrokes.value);
      clickStartRef.current = { x: e.clientX, y: e.clientY, strokeIdx };

      isDrawingRef.current = true;
      currentStrokeRef.current = [{ x: e.clientX, y: e.clientY }];
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.beginPath();
      ctx.strokeStyle = settings.value.annotationColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current) {
        // Hover detection on completed strokes
        const strokeIdx = findStrokeAtPoint(e.clientX, e.clientY, drawStrokes.value);
        hoveredDrawingIdx.value = strokeIdx;
        canvas.style.cursor = strokeIdx !== null ? "pointer" : "crosshair";
        return;
      }
      const point = { x: e.clientX, y: e.clientY };
      const prev = currentStrokeRef.current[currentStrokeRef.current.length - 1];
      if (Math.hypot(point.x - prev.x, point.y - prev.y) < 2) return;
      currentStrokeRef.current.push(point);
      const midX = (prev.x + point.x) / 2;
      const midY = (prev.y + point.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midX, midY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      ctx.restore();
      const pts = currentStrokeRef.current;

      // Click on existing stroke → open annotation popup
      const clickStart = clickStartRef.current;
      if (clickStart && clickStart.strokeIdx !== null && pts.length <= 3) {
        const movedDist = Math.hypot(e.clientX - clickStart.x, e.clientY - clickStart.y);
        if (movedDist < 5) {
          currentStrokeRef.current = [];
          clickStartRef.current = null;
          redrawCanvas(ctx, drawStrokes.value, clickStart.strokeIdx);

          const strokeIdx = clickStart.strokeIdx;
          const existing = annotations.value.find((a) => a.drawingIndex === strokeIdx);
          if (existing) {
            editingAnnotation.value = existing;
            hoveredDrawingIdx.value = null;
            return;
          }

          const stroke = drawStrokes.value[strokeIdx];
          canvas.style.visibility = "hidden";
          const elementUnder = deepElementFromPoint(e.clientX, e.clientY);
          canvas.style.visibility = "";

          const gestureShape = classifyStrokeGesture(stroke.points, stroke.fixed);
          const pending = buildPendingFromStroke(
            elementUnder,
            gestureShape,
            e.clientX,
            e.clientY,
            stroke.fixed,
            strokeIdx,
            stroke.id,
          );
          pendingAnnotation.value = pending;
          hoverInfo.value = null;
          hoveredDrawingIdx.value = null;
          return;
        }
      }
      clickStartRef.current = null;

      if (pts.length > 1) {
        // Determine if stroke targets fixed elements
        canvas.style.visibility = "hidden";
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
          minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        }
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerEl = deepElementFromPoint(centerX, centerY);
        const isFixed = centerEl ? isElementFixed(centerEl) : false;
        canvas.style.visibility = "";

        const finalPoints = isFixed
          ? [...pts]
          : pts.map((p) => ({ x: p.x, y: p.y + window.scrollY }));

        const newStrokeId = crypto.randomUUID();
        const newStrokeIdx = drawStrokes.value.length;
        const newStroke: DrawStroke = {
          id: newStrokeId,
          points: finalPoints,
          color: settings.value.annotationColor,
          fixed: isFixed,
        };

        drawStrokes.value = [...drawStrokes.value, newStroke];

        const gestureShape = classifyStrokeGesture(finalPoints, isFixed);
        const lastPt = finalPoints[finalPoints.length - 1];
        const pending = buildPendingFromStroke(
          centerEl,
          gestureShape,
          lastPt.x,
          isFixed ? lastPt.y : lastPt.y - window.scrollY,
          isFixed,
          newStrokeIdx,
          newStrokeId,
        );
        pendingAnnotation.value = pending;
        hoverInfo.value = null;
      }
      currentStrokeRef.current = [];
    };

    const handleMouseLeave = () => {
      hoveredDrawingIdx.value = null;
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isDrawMode.value, isActive.value, redrawCanvas, resizeCanvas]);

  // Redraw on scroll, resize, or stroke changes
  useEffect(() => {
    if (!isActive.value) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleRedraw = () => {
      const ctx = canvas.getContext("2d");
      if (ctx) redrawCanvas(ctx, drawStrokes.value, hoveredDrawingIdx.value);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("scroll", handleRedraw, { passive: true });
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("scroll", handleRedraw);
    };
  }, [isActive.value, drawStrokes.value, redrawCanvas, resizeCanvas]);

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.drawCanvas} ${isDrawMode.value ? styles.active : ""}`}
      style={{
        opacity: showMarkers.value ? 1 : 0,
        transition: "opacity 0.15s ease",
      }}
      data-agentation
    />
  );
}

// =============================================================================
// Helpers
// =============================================================================

function buildPendingFromStroke(
  element: HTMLElement | null,
  gestureShape: string,
  clientX: number,
  clientY: number,
  isFixed: boolean,
  strokeIdx: number,
  strokeId: string,
): PendingAnnotation {
  let name = `Drawing: ${gestureShape}`;
  let path = "";
  let nearbyText: string | undefined;
  let cssClasses: string | undefined;
  let fullPath: string | undefined;
  let accessibility: string | undefined;
  let computedStyles: string | undefined;
  let nearbyElements: string | undefined;
  let boundingBox: { x: number; y: number; width: number; height: number } | undefined;

  if (element) {
    const info = identifyElement(element);
    name = `Drawing: ${gestureShape} → ${info.name}`;
    path = info.path;
    nearbyText = getNearbyText(element);
    cssClasses = getElementClasses(element);
    fullPath = getFullElementPath(element);
    accessibility = getAccessibilityInfo(element);
    computedStyles = getForensicComputedStyles(element);
    nearbyElements = getNearbyElements(element);
    const rect = element.getBoundingClientRect();
    boundingBox = {
      x: rect.left,
      y: isFixed ? rect.top : rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
  }

  return {
    x: (clientX / window.innerWidth) * 100,
    y: isFixed ? clientY : clientY + window.scrollY,
    element: name,
    elementName: name,
    elementPath: path,
    target: element || document.body,
    boundingBox: boundingBox || { x: 0, y: 0, width: 0, height: 0 },
    isFixed,
    nearbyText,
    cssClasses,
    fullPath,
    accessibility,
    computedStyles,
    nearbyElements,
    drawingIndex: strokeIdx,
    strokeId,
  };
}
