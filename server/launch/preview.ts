import { requireRule } from "./domain.ts";
export function aiAccessRestricted() {
  return process.env.LAUNCH_OFFICIAL_DOMAIN ? process.env.AI_ACCESS_MODE !== "public" : process.env.VERCEL_ENV === "preview";
}
export function aiAccountAllowed(userId: string | undefined) {
  const ids = process.env.LAUNCH_OFFICIAL_DOMAIN ? process.env.AI_ALLOWED_USER_IDS : process.env.PREVIEW_AI_TEST_USER_IDS;
  return !aiAccessRestricted() || Boolean(userId && (ids || "").split(",").map(id => id.trim()).includes(userId));
}
export function requirePreviewAiAccount(userId: string | undefined) {
  requireRule(aiAccountAllowed(userId), "AI 기능은 현재 출시 준비 중이에요.", 403);
}
