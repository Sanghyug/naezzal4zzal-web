import { requireRule } from "./domain.ts";

// A Toss test approval must never add spendable credits to the existing
// official-domain ledger (historically named "test").
export function paymentTestNamespace(env: NodeJS.ProcessEnv): string | undefined {
  if (env.PAYMENT_MODE !== "toss-test") return;
  const namespace = env.PAYMENT_TEST_DB_NAMESPACE || "";
  requireRule(env.LAUNCH_ENV === "test" && env.VERCEL_ENV !== "production" &&
    !env.LAUNCH_OFFICIAL_DOMAIN && !env.PREVIEW_AI_DB_NAMESPACE &&
    env.ENABLE_LIVE_GENERATION !== "1" && env.ENABLE_LIVE_EXTRACTION !== "1" &&
    env.ENABLE_PREVIEW_LIVE_GENERATION !== "1" &&
    /^test-payments-[a-z0-9-]{3,40}$/.test(namespace),
    "테스트 결제에는 분리된 결제 장부와 AI 호출 비활성 설정이 필요해요.", 503);
  return namespace;
}
