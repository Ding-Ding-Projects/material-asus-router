// Draws a QR code (rows of "0" and "1" with a 4-module quiet zone) as an SVG
// built with DOM calls, never markup strings. It is always dark on white, in
// both themes, because scanners need that contrast.
const NS = "http://www.w3.org/2000/svg";

export function drawQr(ctx, qr, description) {
  const zone = qr.quietZone ?? 4;
  const total = qr.size + zone * 2;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${total} ${total}`);
  svg.setAttribute("class", "qr-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", description);
  svg.setAttribute("shape-rendering", "crispEdges");
  const back = document.createElementNS(NS, "rect");
  back.setAttribute("width", String(total));
  back.setAttribute("height", String(total));
  back.setAttribute("fill", "#ffffff");
  svg.append(back);
  const path = document.createElementNS(NS, "path");
  let d = "";
  qr.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      if (row[x] !== "1") {
        x++;
        continue;
      }
      let end = x;
      while (end < row.length && row[end] === "1") end++;
      d += `M${x + zone} ${y + zone}h${end - x}v1h${x - end}z`;
      x = end;
    }
  });
  path.setAttribute("d", d);
  path.setAttribute("fill", "#000000");
  svg.append(path);
  return svg;
}
