/// <reference types="node" />
import { createHmac, timingSafeEqual } from "node:crypto";

type Request = { method?: string; body?: { images?: unknown; requestId?: unknown; accessCode?: unknown; consent?: unknown; variant?: unknown }; headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> };
type Response = { setHeader: (name: string, value: string) => void; status: (code: number) => Response; json: (body: unknown) => unknown; end: (body?: Buffer) => unknown };
const api = "https://api.heygen.com/v3/models/videos";
const memoryPrompt = "Create a SINGLE CONTINUOUS locked-camera five-second photorealistic animation of Picture 1. The people and layout of Picture 1 must stay fixed for the ENTIRE clip. Assign each person a permanent horizontal lane by their left-to-right position in Picture 1; they remain seated in that lane from first frame to last frame. Their exact face, hairstyle, outfit, outfit color and accessories from Picture 1 stay attached to that same person and lane. Picture 2, Picture 3 and Picture 4 are ONLY supplemental identity and expression references. Ignore all different positions, outfits or arrangements in those supplemental photos. Never cut or transition to another reference photograph. No swapping people, crossing, walking, sliding, teleporting, body replacement, face morphing, costume changes, camera movement or scene cuts. Keep the same background, framing, person count, shoulder positions and relative heights as Picture 1 throughout. Motion plan: 0-1 seconds hold the original first-photo pose; 1-3 seconds smile slightly and give one tiny friendly wave in place; 3-5 seconds form a small heart gesture in place. Only hands and facial expression move gently; torsos stay in place. Hands stay near their own torso, no reaching across another person. Original skin and facial detail, no beauty retouching. No captions, lettering, watermark, dialogue or music. Silent.";
const drawingPrompt = "Create a five-second hand-drawn 2D pen-and-ink animated portrait of the SAME HUMAN PEOPLE in the four reference photographs. Translate the visible people into recognizable illustrated human characters: preserve each face shape, eye shape and spacing, hairstyle including bangs, clothing silhouette, original outfit colors as very light watercolor accents, and distinctive expressions. Fine expressive black ink outlines, white paper background, sparse cross-hatching, gentle pale pastel washes, visible hand-drawn line texture. Flat 2D illustration throughout, never photorealistic, never 3D, never an animal, costume, mask or mascot. Picture 1 fixes the person count, left-to-right order, clothing and composition for the entire continuous shot. Pictures 2-4 only guide facial expression and identity details; ignore any changed positions or arrangements in them. Keep each person in a fixed lane with the same face and outfit throughout. Animate with small natural drawn movements: first second original photo pose, next two seconds a gentle hand wave and smile, final two seconds a small heart gesture. Keep the camera fixed, avoid cuts or morphing between photos. Maintain consistent pen drawing style and character proportions on every frame. No added people, extra limbs, text, subtitles, logos, watermarks, dialogue or music. Silent.";
function equal(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function sign(payload: string, key: string) { return createHmac("sha256", key).update(payload).digest("base64url"); }
function tokenFor(videoId: string, key: string, variant: string) {
  const payload = Buffer.from(JSON.stringify({ videoId, variant, exp: Date.now() + 7 * 86400000 })).toString("base64url");
  return payload + "." + sign(payload, key);
}
function readToken(token: string, key: string): { videoId: string; variant: string } | null {
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra || !equal(sign(payload, key), signature)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data.videoId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(data.videoId) && data.exp > Date.now() ? { videoId: data.videoId, variant: ["drawing","animals"].includes(data.variant) ? data.variant : "memory" } : null;
  } catch { return null; }
}
function imageReference(image: unknown) {
  if (typeof image !== "string" || image.length > 950000) return null;
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  const valid = match[1] === "jpeg" ? bytes.subarray(0, 3).equals(Buffer.from([255,216,255])) : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  return valid ? { type: "base64", media_type: "image/" + match[1], data: match[2] } : null;
}
function failure(status: number, code?: string) {
  if (status === 401 || status === 403) return "HeyGen 계정 연결을 확인해야 해요. 관리자에게 알려주세요.";
  if (status === 402 || code === "insufficient_credit") return "HeyGen 제작 잔액이 부족해요. 관리자에게 알려주세요.";
  if (status === 429) return "영상 제작 요청이 많아요. 잠시 후 다시 시도해주세요.";
  if (status === 409) return "앞선 제작 요청을 확인하고 있어요. 같은 요청으로 다시 확인해주세요.";
  return "영상 제작 요청을 확인하지 못했어요. 다시 시도하면 같은 요청을 확인합니다.";
}
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const allowed = (process.env.ALLOWED_ORIGINS || "https://naezzal4zzal-web.vercel.app,capacitor://localhost,https://localhost").split(",").map(v => v.trim());
  if (process.env.VERCEL_URL) allowed.push("https://" + process.env.VERCEL_URL);
  const origin = req.headers.origin;
  if (typeof origin === "string" && !allowed.includes(origin)) return res.status(403).json({ error: "허용되지 않은 앱 주소예요." });
  if (typeof origin === "string") { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.HEYGEN_API_KEY, code = process.env.VIDEO_TEST_CODE;
  if (req.method === "GET" && req.query?.action === "config") return res.status(200).json({ available: Boolean(key && code), duration: 5, resolution: "480p" });
  if (!key || !code) return res.status(503).json({ error: "영상 제작 연결을 준비하고 있어요. GIF는 지금 만들 수 있어요." });
  try {
    if (req.method === "GET") {
      const auth = req.headers.authorization;
      const job = typeof auth === "string" && auth.startsWith("Bearer ") ? readToken(auth.slice(7), key + code) : null;
      if (!job) return res.status(401).json({ error: "이 영상의 확인 기간이 지났어요. 저장한 영상을 확인해주세요." });
      const response = await fetch(api + "/" + encodeURIComponent(job.videoId), { headers: { "x-api-key": key }, signal: AbortSignal.timeout(20000) });
      const body = await response.json();
      if (!response.ok) return res.status(response.status === 404 ? 404 : 502).json({ error: response.status === 404 ? "제작 중인 영상을 찾지 못했어요. 관리자에게 알려주세요." : failure(response.status, body.error?.code) });
      const data = body.data || body;
      if (!["pending","queued","processing","completed","failed","cancelled"].includes(data.status)) return res.status(502).json({ error: "영상 상태를 다시 확인해주세요." });
      const url = typeof data.video_url === "string" && data.video_url.startsWith("https://") ? data.video_url : null;
      if (data.status === "completed" && !url) return res.status(502).json({ error: "완성 영상 주소를 다시 확인해주세요." });
      if (req.query?.action === "file") {
        if (data.status !== "completed" || !url) return res.status(409).json({ error: "영상이 아직 완성되지 않았어요." });
        const file = await fetch(url, { signal: AbortSignal.timeout(25000), redirect: "error" });
        if (!file.ok || !file.headers.get("content-type")?.startsWith("video/")) return res.status(502).json({ error: "영상 파일을 다시 확인해주세요." });
        const maxBytes = 4_000_000;
        if (Number(file.headers.get("content-length")) > maxBytes) { await file.body?.cancel(); return res.status(413).json({ error: "이 영상은 앱 보관함 용량보다 커요. 영상 원본 열기에서 저장해주세요." }); }
        const reader = file.body?.getReader(); if (!reader) return res.status(502).json({ error: "영상 파일을 읽지 못했어요." });
        const chunks: Uint8Array[] = []; let size = 0;
        try { while (true) { const {value,done} = await reader.read(); if (done) break; size += value.length; if (size > maxBytes) return res.status(413).json({ error: "이 영상은 앱 보관함 용량보다 커요. 영상 원본 열기에서 저장해주세요." }); chunks.push(value); } }
        finally { await reader.cancel().catch(() => {}); }
        if (!size) return res.status(502).json({ error: "영상 파일이 비어 있어요." });
        res.setHeader("Content-Type", "video/mp4"); res.setHeader("Content-Disposition", "attachment; filename=naezzal4zzal.mp4");
        return res.status(200).end(Buffer.concat(chunks));
      }
      return res.status(200).json({ status: data.status, variant: job.variant, videoUrl: data.status === "completed" ? url : null, error: ["failed","cancelled"].includes(data.status) ? "영상 제작을 완료하지 못했어요. 새 제작은 별도 요청으로 시작해주세요." : null });
    }
    if (typeof req.body?.accessCode !== "string" || !equal(req.body.accessCode, code)) return res.status(403).json({ error: "사무실 테스트 코드를 확인해주세요." });
    if (req.body.consent !== true) return res.status(400).json({ error: "사진 전송과 영상 제작 안내에 동의해주세요." });
    const variant = req.body.variant === undefined ? "memory" : req.body.variant;
    if (variant !== "memory" && variant !== "drawing") return res.status(400).json({ error: "영상 종류를 다시 선택해주세요." });
    const requestId = req.body.requestId;
    if (typeof requestId !== "string" || !/^[a-f0-9-]{36}$/.test(requestId)) return res.status(400).json({ error: "제작 요청 정보가 올바르지 않아요." });
    if (!Array.isArray(req.body.images) || req.body.images.length !== 4) return res.status(400).json({ error: "네 장의 사진이 필요해요." });
    const images = req.body.images.map(imageReference);
    if (images.some(image => !image)) return res.status(400).json({ error: "사진 파일을 다시 준비해주세요. 네 장 합계 3.8MB 이하로 보내주세요." });
    const response = await fetch(api, {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "Idempotency-Key": "naezzal-" + sign(requestId + ":" + variant, key) },
      signal: AbortSignal.timeout(50000),
      body: JSON.stringify({ model: "heygen-video-1", mode: "reference_to_video", prompt: variant === "drawing" ? drawingPrompt : memoryPrompt, reference_images: images, duration: 5, resolution: "480p", aspect_ratio: "4:3", prompt_enhancement: "disabled" }),
    });
    const body = await response.json();
    if (!response.ok) return res.status(response.status === 409 ? 409 : 502).json({ error: failure(response.status, body.error?.code) });
    const data = body.data || body;
    if (typeof data.video_id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(data.video_id)) return res.status(502).json({ error: "접수 결과를 확인하지 못했어요. 같은 요청으로 다시 확인해주세요." });
    return res.status(202).json({ token: tokenFor(data.video_id, key + code, variant), status: data.status || "pending" });
  } catch { return res.status(504).json({ error: "연결이 지연되고 있어요. 다시 시도하면 새 제작 대신 같은 요청을 확인합니다." }); }
}
