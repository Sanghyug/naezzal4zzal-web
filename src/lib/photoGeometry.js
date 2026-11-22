
export function validateCells(value, width, height) {
  if (!Array.isArray(value) || value.length !== 4) return [];
  const cells = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return [];
    const { x, y, width: w, height: h } = item;
    if (![x, y, w, h].every(v => typeof v === "number" && Number.isFinite(v))) return [];
    if (x < 0 || y < 0 || w < width * .025 || h < height * .025 || x + w > width + .01 || y + h > height + .01) return [];
    cells.push({ x, y, width: w, height: h });
  }
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i], b = cells[j];
      const overlap = Math.max(0, Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)) * Math.max(0, Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
      if (overlap > Math.min(a.width*a.height,b.width*b.height) * .25) return [];
    }
  }
  return cells;
}

export function createLayoutCells(layout, width, height) {
  const columns = layout === "2x2" ? 2 : 1;
  const rows = 4 / columns;
  return Array.from({length: 4}, (_, i) => ({
    x: (i % columns) * width / columns,
    y: Math.floor(i / columns) * height / rows,
    width: width / columns,
    height: height / rows,
  }));
}
