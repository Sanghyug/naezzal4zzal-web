import { refineVerticalCells } from "./refinePhotoCells";
import { rectifyPhotoCells } from "./rectifyPhotoCells";
import { launchAccessToken } from "./launch";
import { loadImage } from "./loadImage";
import { validateCells, type CellRect } from "./photoGeometry.js";

export async function extractCells(image: string, width: number, height: number, signal: AbortSignal): Promise<{ cells: CellRect[]; sourceUrl?: string }> {
  // A square coordinate plane avoids mixed x/y scales on very tall screenshots.
  const source = await loadImage(image);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1000;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("사진 분석 준비를 하지 못했어요.");
  const scale = 1000 / Math.max(width, height);
  const offsetX = (1000 - width * scale) / 2;
  const offsetY = (1000 - height * scale) / 2;
  context.fillStyle = "#e8e8e8";
  context.fillRect(0, 0, 1000, 1000);
  context.drawImage(source, offsetX, offsetY, width * scale, height * scale);
  context.strokeStyle = "rgba(0,0,0,.12)";
  context.lineWidth = 1;
  for (let n = 100; n < 1000; n += 100) {
    context.beginPath(); context.moveTo(n,0); context.lineTo(n,1000); context.moveTo(0,n); context.lineTo(1000,n); context.stroke();
  }
  context.font = "12px sans-serif";
  for (let n = 0; n < 1000; n += 100) {
    context.fillStyle = "white"; context.fillRect(n,0,30,16); context.fillRect(0,n,30,16);
    context.fillStyle = "#222"; context.fillText(String(n),n+2,12); context.fillText(String(n),2,n+12);
  }
  const visionImage = canvas.toDataURL("image/jpeg", .94);
  const base = import.meta.env.VITE_API_BASE_URL || "";
  const token = await launchAccessToken();
  const response = await fetch(`${base}/api/extract-cells`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify({ image: visionImage }), signal,
  });
  if (response.status === 503) throw new Error("AI 연결 설정이 아직 완료되지 않았어요. 아래 칸은 직접 맞추기용 임시 배치입니다.");
  if (!response.ok) throw new Error("AI 서버에 연결하지 못했어요. 아래 칸은 AI 인식 결과가 아닌 임시 배치입니다.");
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("AI 분석 서버가 연결되지 않았어요. 아래 칸은 직접 맞추기용 임시 배치입니다.");
  const result = await response.json();
  const normalized = validateCells(result.cells, 1000, 1000);
  const mapped = validateCells(normalized.map(cell => ({ x: (cell.x - offsetX) / scale, y: (cell.y - offsetY) / scale, width: cell.width / scale, height: cell.height / scale })), width, height);
  if (mapped.length === 4 && (result.layout === "1x4" || result.layout === "2x2")) {
    const corrected = rectifyPhotoCells(source, result.corners, (point) => ({
      x: (point.x - offsetX) / scale, y: (point.y - offsetY) / scale,
    }), result.layout);
    if (corrected) return corrected;
  }
  if (mapped.length !== 4 || result.layout !== "1x4") return { cells: mapped };
  const pixels = document.createElement("canvas"); pixels.width=width; pixels.height=height;
  const pc = pixels.getContext("2d", { willReadFrequently: true });
  if (!pc) return { cells: mapped };
  pc.drawImage(source,0,0,width,height);
  return { cells: refineVerticalCells(pc.getImageData(0,0,width,height).data,width,height,mapped) };
}
