// =============================================================================
// Output Generator
// =============================================================================
//
// Generates markdown feedback output at 4 detail levels.
// Extracted from the monolith toolbar component.
//

import type { Annotation } from "../types";

export type OutputDetailLevel = "compact" | "standard" | "detailed" | "forensic";
export type ReactComponentMode = "smart" | "filtered" | "all" | "off";

/**
 * Maps output detail level to React detection mode.
 */
export const OUTPUT_TO_REACT_MODE: Record<OutputDetailLevel, ReactComponentMode> = {
  compact: "off",
  standard: "filtered",
  detailed: "smart",
  forensic: "all",
};

/**
 * Generates structured markdown output from annotations.
 */
export function generateOutput(
  annotations: Annotation[],
  pathname: string,
  detailLevel: OutputDetailLevel = "standard",
): string {
  if (annotations.length === 0) return "";

  const viewport = `${window.innerWidth}\u00d7${window.innerHeight}`;

  let output = `## Page Feedback: ${pathname}\n`;

  if (detailLevel === "forensic") {
    output += `\n**Environment:**\n`;
    output += `- Viewport: ${viewport}\n`;
    output += `- URL: ${window.location.href}\n`;
    output += `- User Agent: ${navigator.userAgent}\n`;
    output += `- Timestamp: ${new Date().toISOString()}\n`;
    output += `- Device Pixel Ratio: ${window.devicePixelRatio}\n`;
    output += `\n---\n`;
  } else if (detailLevel !== "compact") {
    output += `**Viewport:** ${viewport}\n`;
  }
  output += "\n";

  annotations.forEach((a, i) => {
    if (detailLevel === "compact") {
      output += `${i + 1}. **${a.element}**: ${a.comment}`;
      if (a.selectedText) {
        output += ` (re: "${a.selectedText.slice(0, 30)}${a.selectedText.length > 30 ? "..." : ""}")`;
      }
      output += "\n";
    } else if (detailLevel === "forensic") {
      output += `### ${i + 1}. ${a.element}\n`;
      if (a.isMultiSelect && a.fullPath) {
        output += `*Forensic data shown for first element of selection*\n`;
      }
      if (a.fullPath) {
        output += `**Full DOM Path:** ${a.fullPath}\n`;
      }
      if (a.cssClasses) {
        output += `**CSS Classes:** ${a.cssClasses}\n`;
      }
      if (a.boundingBox) {
        output += `**Position:** x:${Math.round(a.boundingBox.x)}, y:${Math.round(a.boundingBox.y)} (${Math.round(a.boundingBox.width)}\u00d7${Math.round(a.boundingBox.height)}px)\n`;
      }
      output += `**Annotation at:** ${a.x.toFixed(1)}% from left, ${Math.round(a.y)}px from top\n`;
      if (a.selectedText) {
        output += `**Selected text:** "${a.selectedText}"\n`;
      }
      if (a.nearbyText && !a.selectedText) {
        output += `**Context:** ${a.nearbyText.slice(0, 100)}\n`;
      }
      if (a.computedStyles) {
        output += `**Computed Styles:** ${a.computedStyles}\n`;
      }
      if (a.accessibility) {
        output += `**Accessibility:** ${a.accessibility}\n`;
      }
      if (a.nearbyElements) {
        output += `**Nearby Elements:** ${a.nearbyElements}\n`;
      }
      if (a.reactComponents) {
        output += `**React:** ${a.reactComponents}\n`;
      }
      output += `**Feedback:** ${a.comment}\n\n`;
    } else {
      // Standard and detailed modes
      output += `### ${i + 1}. ${a.element}\n`;
      output += `**Location:** ${a.elementPath}\n`;

      if (a.reactComponents) {
        output += `**React:** ${a.reactComponents}\n`;
      }

      if (detailLevel === "detailed") {
        if (a.cssClasses) {
          output += `**Classes:** ${a.cssClasses}\n`;
        }
        if (a.boundingBox) {
          output += `**Position:** ${Math.round(a.boundingBox.x)}px, ${Math.round(a.boundingBox.y)}px (${Math.round(a.boundingBox.width)}\u00d7${Math.round(a.boundingBox.height)}px)\n`;
        }
      }

      if (a.selectedText) {
        output += `**Selected text:** "${a.selectedText}"\n`;
      }

      if (detailLevel === "detailed" && a.nearbyText && !a.selectedText) {
        output += `**Context:** ${a.nearbyText.slice(0, 100)}\n`;
      }

      output += `**Feedback:** ${a.comment}\n\n`;
    }
  });

  return output.trim();
}

/**
 * Classifies a freehand stroke gesture by shape.
 */
export function classifyStrokeGesture(
  points: Array<{ x: number; y: number }>,
  fixed: boolean,
): string {
  if (points.length < 2) return "Mark";
  const scrollY = window.scrollY;
  const viewportPoints = fixed
    ? points
    : points.map((p) => ({ x: p.x, y: p.y - scrollY }));

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of viewportPoints) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  const bboxDiag = Math.hypot(bboxW, bboxH);

  const start = viewportPoints[0];
  const end = viewportPoints[viewportPoints.length - 1];
  const startEndDist = Math.hypot(end.x - start.x, end.y - start.y);
  const closedLoop = startEndDist < bboxDiag * 0.35;
  const aspectRatio = bboxW / Math.max(bboxH, 1);

  if (closedLoop && bboxDiag > 20) {
    const edgeThreshold = Math.max(bboxW, bboxH) * 0.15;
    let edgePoints = 0;
    for (const p of viewportPoints) {
      const nearLeft = p.x - minX < edgeThreshold;
      const nearRight = maxX - p.x < edgeThreshold;
      const nearTop = p.y - minY < edgeThreshold;
      const nearBottom = maxY - p.y < edgeThreshold;
      if ((nearLeft || nearRight) && (nearTop || nearBottom)) edgePoints++;
    }
    return edgePoints > viewportPoints.length * 0.15 ? "Box" : "Circle";
  } else if (aspectRatio > 3 && bboxH < 40) {
    return "Underline";
  } else if (startEndDist > bboxDiag * 0.5) {
    return "Arrow";
  }
  return "Drawing";
}

/**
 * Converts hex color to rgba string.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
