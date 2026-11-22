import { useRef, useState } from "react";
import type { CellRect, PhotoLayout } from "../lib/photoGeometry.js";
type Props = { sourceUrl: string; sourceSize: { width: number; height: number }; cells: CellRect[]; onChange: (cells: CellRect[]) => void; onLayoutChange: (layout: PhotoLayout) => void };
export default function CropSelector({ sourceUrl, sourceSize, cells, onChange, onLayoutChange }: Props) {
  const [selected, setSelected] = useState(0);
  const drag = useRef<{ index: number; resize: boolean; x: number; y: number; cell: CellRect } | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const colors = ["#e52a65", "#4169dc", "#15804a", "#9a4bc2"];
  const limit = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  return <section style={{ marginBottom: 20 }} aria-label="원본에서 네 컷 테두리 맞추기">
    <h3 style={{ fontSize: 16 }}>1. 원본에서 네 컷을 맞춰주세요</h3>
    <p style={{ fontSize: 13, lineHeight: 1.6 }}>번호가 있는 칸을 끌어 옮기세요. 오른쪽 아래 동그라미로 크기를 바꿀 수 있어요. 종이 여백과 글자는 칸 밖에 두세요.</p>
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <button onClick={() => onLayoutChange("1x4")}>세로 네 컷으로 다시 맞추기</button>
      <button onClick={() => onLayoutChange("2x2")}>2 × 2로 다시 맞추기</button>
    </div>
    <div ref={area} style={{ position: "relative", width: "100%", touchAction: "none", userSelect: "none" }}
      onPointerMove={event => {
        const current = drag.current;
        const rect = area.current?.getBoundingClientRect();
        if (!current || !rect) return;
        const dx = (event.clientX - current.x) * sourceSize.width / rect.width;
        const dy = (event.clientY - current.y) * sourceSize.height / rect.height;
        const c = current.cell;
        const next = current.resize ? {
          ...c, width: limit(c.width + dx, sourceSize.width * .025, sourceSize.width - c.x),
          height: limit(c.height + dy, sourceSize.height * .025, sourceSize.height - c.y),
        } : { ...c, x: limit(c.x + dx, 0, sourceSize.width - c.width), y: limit(c.y + dy, 0, sourceSize.height - c.height) };
        onChange(cells.map((cell, i) => i === current.index ? next : cell));
      }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <img src={sourceUrl} alt="인화지 원본과 선택한 네 컷 영역" draggable={false} style={{ display: "block", width: "100%", borderRadius: 8, pointerEvents: "none" }} />
      {cells.map((cell, index) => <div key={index}
        onPointerDown={event => {
          setSelected(index); event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { index, resize: (event.target as HTMLElement).dataset.resize === "true", x: event.clientX, y: event.clientY, cell: { ...cell } };
        }} style={{ position: "absolute", left: (cell.x/sourceSize.width*100)+"%", top: (cell.y/sourceSize.height*100)+"%", width: (cell.width/sourceSize.width*100)+"%", height: (cell.height/sourceSize.height*100)+"%", border: (selected === index ? 3 : 2)+"px solid "+colors[index], boxSizing: "border-box", background: colors[index]+"16", cursor: "move" }}>
        <span style={{ background: colors[index], color: "white", padding: "1px 7px", fontWeight: 800 }}>{index + 1}</span>
        <span data-resize="true" style={{ position: "absolute", right: -10, bottom: -10, width: 28, height: 28, border: "2px solid white", borderRadius: "50%", background: colors[index], cursor: "nwse-resize" }} />
      </div>)}
    </div>
    <p style={{ fontSize: 13 }}>2. 아래 미리보기에서 확대하거나 기울기를 조절하세요.</p>
  </section>;
}
