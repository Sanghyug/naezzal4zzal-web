import { createHmac } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { requireRule } from "./domain.ts";

// Input MUST come from auth.getUser(token), never a decoded client JWT/profile.
// Credits remain keyed by Supabase user.id; email is deliberately unused.
export function verifiedIdentity(user: User, secret: string, existingMember = false) {
  const kakao = user.identities?.find((i) => i.provider === "kakao");
  const legacy = existingMember && user.identities?.find((i) => i.provider === "google");
  const identity = kakao || legacy;
  requireRule(identity, "카카오 로그인을 이용해주세요.", 401);
  const subject = identity.identity_data?.sub || identity.id;
  requireRule(subject, "회원 식별자를 확인하지 못했어요.", 401);
  return {
    id: user.id,
    hash: createHmac("sha256", secret)
      .update(identity.provider + ":" + String(subject)).digest("hex"),
    created: Date.parse(user.created_at),
  };
}
