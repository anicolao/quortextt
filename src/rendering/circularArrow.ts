// Shared circular arrow drawing utility

const BUTTON_ICON = "#ffffff"; // White

/**
 * Draws a circular arrow with an arrowhead
 * @param ctx - Canvas rendering context
 * @param centerX - X coordinate of the center (relative to current transform)
 * @param centerY - Y coordinate of the center (relative to current transform)
 * @param radius - Radius of the circular arc
 * @param startAngle - Starting angle in radians
 * @param endAngle - Ending angle in radians
 * @param clockwise - Direction of the arrow (true = clockwise, false = counter-clockwise)
 * @param size - Overall size of the button for scaling arrow components
 */
export function drawCircularArrow(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  clockwise: boolean,
  size: number
): void {
  // Draw circular arrow icon
  ctx.strokeStyle = BUTTON_ICON;
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Draw arc
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, endAngle, !clockwise);
  ctx.stroke();

  // Draw arrowhead at the START of the arc as a stroked triangle
  const arrowLength = size * 0.15;
  const arrowWidth = size * 0.08;
  const arrowAngle = startAngle;
  const arrowX = centerX + radius * Math.cos(arrowAngle);
  const arrowY = centerY + radius * Math.sin(arrowAngle);

  // Calculate tangent direction at the start of the arc
  // For a circle, the tangent is perpendicular to the radius
  // Tangent points in direction of rotation: -90° for clockwise, +90° for counter-clockwise
  const tangentAngle = arrowAngle + (clockwise ? -Math.PI / 2 : Math.PI / 2);

  // Draw arrowhead as a stroked and filled triangle for better visibility
  ctx.beginPath();

  // Tip of the arrow
  ctx.moveTo(
    arrowX + arrowLength * Math.cos(tangentAngle),
    arrowY + arrowLength * Math.sin(tangentAngle),
  );

  // Left side of the arrow base (perpendicular to tangent)
  const baseAngle1 = tangentAngle + Math.PI * 0.5;
  ctx.lineTo(
    arrowX + arrowWidth * Math.cos(baseAngle1),
    arrowY + arrowWidth * Math.sin(baseAngle1),
  );

  // Right side of the arrow base (perpendicular to tangent)
  const baseAngle2 = tangentAngle - Math.PI * 0.5;
  ctx.lineTo(
    arrowX + arrowWidth * Math.cos(baseAngle2),
    arrowY + arrowWidth * Math.sin(baseAngle2),
  );

  ctx.closePath();

  // Fill the arrowhead
  ctx.fillStyle = BUTTON_ICON;
  ctx.fill();

  // Stroke the arrowhead for better visibility
  ctx.strokeStyle = BUTTON_ICON;
  ctx.lineWidth = size * 0.08;
  ctx.stroke();
}
