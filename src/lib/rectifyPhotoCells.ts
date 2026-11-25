import type { CellRect } from "./photoGeometry.js";

type Point = { x: number; y: number };

export function rectifyPhotoCells(
  image: HTMLImageElement,
  corners: unknown,
  toSource: (point: Point) => Point,
  layout: "1x4" | "2x2",
): { sourceUrl: string; cells: CellRect[] } | null {
  if (!Array.isArray(corners) || corners.length !== 4) return null;
  const quads = corners.map((points: Point[]) => {
    if (!Array.isArray(points) || points.length !== 4 ||
        points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
    const quad = points.map(toSource);
    if (quad.some((p) => p.x < 0 || p.y < 0 || p.x > image.width || p.y > image.height)) return null;
    const convex = quad.every((p, i) => {
      const q = quad[(i + 1) % 4], r = quad[(i + 2) % 4];
      return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x) > 0;
    });
    if (!convex) return null;
    const [a, b, c, d] = quad;
    const distance = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);
    const w = (distance(a, b) + distance(d, c)) / 2;
    const h = (distance(a, d) + distance(b, c)) / 2;
    if (Math.min(w, h) < 20 || Math.max(w / h, h / w) > 4) return null;
    const scale = Math.min(1, 600 / Math.max(w, h));
    return { quad, width: Math.round(w * scale), height: Math.round(h * scale) };
  });
  if (quads.some((quad) => !quad)) return null;
  const panels = quads.filter((quad) => quad !== null);
  const cols = layout === "1x4" ? 1 : 2;
  const gap = 8;
  const stepX = Math.max(...panels.map((p) => p.width)) + gap;
  const stepY = Math.max(...panels.map((p) => p.height)) + gap;
  const output = document.createElement("canvas");
  output.width = stepX * cols + gap;
  output.height = stepY * (4 / cols) + gap;
  const context = output.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, output.width, output.height);

  const source = document.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  const read = source.getContext("2d", { willReadFrequently: true });
  if (!read) return null;
  read.drawImage(image, 0, 0);
  const pixels = read.getImageData(0, 0, source.width, source.height).data;
  const cells: CellRect[] = [];
  for (const { quad: [a, b, c, d], width, height } of panels) {
    const dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x;
    const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y;
    const determinant = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(determinant) < 1) return null;
    const g = (dx3 * dy2 - dx2 * dy3) / determinant;
    const h = (dx1 * dy3 - dx3 * dy1) / determinant;
    if (Math.min(1 + g, 1 + h, 1 + g + h) <= 0) return null;
    const ax = b.x - a.x + g * b.x, bx = d.x - a.x + h * d.x;
    const ay = b.y - a.y + g * b.y, by = d.y - a.y + h * d.y;
    const panel = context.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const v = (y + 0.5) / height;
      for (let x = 0; x < width; x++) {
        const u = (x + 0.5) / width;
        const divisor = 1 + g * u + h * v;
        const px = Math.min(source.width - 1, Math.max(0, Math.floor((ax * u + bx * v + a.x) / divisor)));
        const py = Math.min(source.height - 1, Math.max(0, Math.floor((ay * u + by * v + a.y) / divisor)));
        const src = (py * source.width + px) * 4;
        const dst = (y * width + x) * 4;
        panel.data[dst] = pixels[src];
        panel.data[dst + 1] = pixels[src + 1];
        panel.data[dst + 2] = pixels[src + 2];
        panel.data[dst + 3] = 255;
      }
    }
    const x = gap + (cells.length % cols) * stepX;
    const y = gap + Math.floor(cells.length / cols) * stepY;
    context.putImageData(panel, x, y);
    const ratios = panels.map(p => p.height / p.width).sort((a,b) => a-b);
    const typical = (ratios[1] + ratios[2]) / 2;
    let trimmedHeight = height;
    if (height / width > typical * 1.08) {
      const expected = Math.round(width * typical);
      const stats = (row: number) => {
        const means = [0,0,0]; let sq = 0, n = 0;
        for (let px = Math.floor(width*.08); px < width*.92; px += 2) {
          const k = (row*width+px)*4;
          const v = (panel.data[k]+panel.data[k+1]+panel.data[k+2])/3;
          sq += v*v; n++;
          for(let c=0;c<3;c++) means[c]+=panel.data[k+c];
        }
        const m=means.map(v=>v/n), avg=m.reduce((a,b)=>a+b,0)/3;
        return {m, sd:Math.sqrt(Math.max(0,sq/n-avg*avg))};
      };
      let best = {row:height, score:0};
      for(let row=Math.max(4,Math.round(expected*.96));row<=Math.min(height-6,Math.round(expected*1.06));row++){
        const before=stats(row-3), after=stats(row+3);
        const diff=before.m.reduce((s,v,i)=>s+Math.abs(v-after.m[i]),0)/3;
        if(after.sd<12 && before.sd>after.sd+8 && diff>15 && diff>best.score) best={row,score:diff};
      }
      if(best.score>0){
        // A blank midpoint can hide photo content farther down or at an edge.
        let paperOnly = true;
        for (let y = best.row + 4; y < height && paperOnly; y++) {
          for (let x = 0; x < width; x++) {
            const k = (y * width + x) * 4;
            const rgb = [panel.data[k], panel.data[k + 1], panel.data[k + 2]];
            if (Math.min(...rgb) < 220 || Math.max(...rgb) - Math.min(...rgb) > 18) {
              paperOnly = false;
              break;
            }
          }
        }
        if (paperOnly) trimmedHeight = Math.min(height, best.row + 4);
      }
    }
    cells.push({ x, y, width, height: trimmedHeight });
  }
  return { sourceUrl: output.toDataURL("image/jpeg", 0.95), cells };
}
