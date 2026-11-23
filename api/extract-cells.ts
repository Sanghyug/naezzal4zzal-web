/// <reference types="node" />
import { validateCells } from "../src/lib/photoGeometry.js";
import { runtime } from "../server/launch/runtime.ts";
import { dayKst, rate, requireRule } from "../server/launch/domain.ts";
import { createHmac } from "node:crypto";
import { imageSize } from "../server/launch/dimensions.ts";
type Request = { method?: string; body?: { image?: unknown }; headers: Record<string, string | string[] | undefined> };
type Response = { setHeader: (key: string, value: string) => void; status: (code: number) => Response; json: (body: unknown) => unknown; end: () => unknown };
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || "https://naezzal4zzal-web.vercel.app,capacitor://localhost,https://localhost").split(",").map(v => v.trim());
  if (process.env.VERCEL_URL) allowed.push("https://" + process.env.VERCEL_URL);
  if (typeof origin === "string" && !allowed.includes(origin)) return res.status(403).json({ error: "Origin not allowed" });
  if (typeof origin === "string") { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const image = req.body?.image;
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) return res.status(400).json({ error: "A base64 image is required" });
  if (image.length > 4_000_000) return res.status(413).json({ error: "Image too large" });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "AI is not configured" });
  if (process.env.LAUNCH_ENABLED === "1") {
    try {
      const r = await runtime();
      if (r.demo || r.service.video.kind === "mock") return res.status(503).json({error:"테스트 환경에서는 실제 AI 분석을 호출하지 않아요."});
      const size = imageSize(Buffer.from(image.split(",")[1],"base64"));
      requireRule(size.width <= 1000 && size.height <= 1000,"분석 사진 크기를 확인해주세요.");
      await r.service.store.tx(s => {
        requireRule(s.config.generation,"AI 분석을 잠시 쉬고 있어요.",503);
        const now = Date.now(), day = dayKst(now), ip = String(req.headers["x-vercel-forwarded-for"] || req.headers["x-real-ip"] || "unknown");
        rate(s,"extract-rate:"+createHmac("sha256",r.cookieSecret).update(ip).digest("hex"),10,60000,now);
        const used = Object.values(s.jobs).filter(j=>j.day===day).reduce((n,j)=>n+j.reserveUsd,0)+(s.rates["extract-cost:"+day]?.count||0)*.05;
        requireRule(used+.05<=s.config.dailyUsd,"오늘 AI 분석 한도에 도달했어요.",429);
        rate(s,"extract-cost:"+day,500,2*86400000,now);
      });
    } catch { return res.status(503).json({error:"AI 분석 한도 또는 연결을 확인해주세요. 직접 맞추기는 계속 사용할 수 있어요."}); }
  }
  const rect = { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" } }, required: ["x", "y", "width", "height"], additionalProperties: false };
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", signal: AbortSignal.timeout(22000),
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: process.env.LAUNCH_ENABLED === "1" ? "gpt-5.4" : process.env.OPENAI_VISION_MODEL || "gpt-5.4", store: false, max_output_tokens: 2200,
        input: [{ role: "user", content: [
          { type: "input_text", text: "The input is an EXACTLY SQUARE image with a 0 to 1000 coordinate scale on BOTH axes. A faint numbered grid is a coordinate guide, not part of the photo. The original image may be a phone screenshot: ignore phone status bars, buttons, table and other surroundings. Locate the FOUR actual photo panels INSIDE the photographed Korean/Japanese photo-booth paper. Return a tight bounding rectangle around EACH photo, excluding paper margins, decorative frames, captions, logos, QR codes and gaps. Do not identify people or infer personal attributes. Coordinates use a 1000 by 1000 grid relative to the ENTIRE input image: x,y is top left; width,height are sizes. Support one vertical column of four or a two-by-two grid. Order top-to-bottom for a column and row-major for a grid. Do NOT divide the paper into equal quarters: inspect each panel's visible edges independently. If four panels cannot be found reliably, return layout unknown and cells []. Return axis-aligned rectangles. Carefully read the grid at the left, right, top and bottom edges of each actual panel. Include the entire photographic background above the heads; exclude the printed logo above panel 1. Never include part of the next photo panel in a rectangle. Check that the four rectangles have similar widths and reasonable similar heights. Do not invent coordinates from an example." },
          { type: "input_image", image_url: image, detail: "high" },
        ] }],
        text: { format: { type: "json_schema", name: "photo_panels", strict: true, schema: {
          type: "object", properties: { layout: { type: "string", enum: ["1x4", "2x2", "unknown"] }, cells: { type: "array", items: rect } }, required: ["layout", "cells"], additionalProperties: false,
        } } },
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      console.warn("vision_api_failure", JSON.stringify({status: response.status, code: failure?.error?.code, type: failure?.error?.type}));
      return res.status(502).json({ error: "AI analysis unavailable", code: failure?.error?.code || "upstream_error" });
    }
    const data = await response.json();
    if (data.status && data.status !== "completed") return res.status(502).json({ error: "AI analysis incomplete" });
    const output = data.output_text || data.output?.flatMap((item: { content?: Array<{ type: string; text?: string }> }) => item.content || []).find((item: { type: string }) => item.type === "output_text")?.text;
    if (typeof output !== "string") return res.status(502).json({ error: "AI result unavailable" });
    const parsed = JSON.parse(output);
    const cells = validateCells(parsed.cells, 1000, 1000);
    if (process.env.VISION_DIAGNOSTICS === "1") console.info("vision_geometry", JSON.stringify({model: data.model, layout: parsed.layout, cells: parsed.cells}));
    const valid = cells.length === 4 && ["1x4", "2x2"].includes(parsed.layout);
    return res.status(200).json({ layout: valid ? parsed.layout : "unknown", cells: valid ? cells : [], model: data.model, reason: valid ? "detected" : parsed.layout === "unknown" ? "not_found" : "invalid_geometry" });
  } catch { return res.status(502).json({ error: "AI analysis failed; manual editing is available" }); }
}
