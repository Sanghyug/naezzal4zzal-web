import { requireRule } from "./domain.ts";

export function requirePreviewAiAccount(userId: string | undefined) {
  if (process.env.VERCEL_ENV !== "preview") return;
  const allowed = (process.env.PREVIEW_AI_TEST_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean);
  requireRule(userId && allowed.includes(userId), "허가된 테스트 계정으로 로그인해주세요.", 403);
}
