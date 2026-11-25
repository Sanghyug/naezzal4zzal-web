import { createHmac, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { serverSupabase } from "./supabase.ts";
import { LaunchService } from "./service.ts";
import { sqliteStore, postgresStore } from "./store.ts";
import { localStorage, supabaseStorage } from "./storage.ts";
import { disabledPayments, mockPayments, tossPayments } from "./payments.ts";
import { mockVideoProvider, heygenProvider } from "./video.ts";
import { requireRule } from "./domain.ts";
import { aiAccountAllowed } from "./preview.ts";
import { verifiedIdentity } from "./identity.ts";
export type Identity = { id: string; hash: string; created: number };
export type Runtime = {
  service: LaunchService;
  demo: boolean;
  previewIntegration: boolean;
  auth: (token: string) => Promise<Identity>;
  cookieSecret: string;
  authConfig: { url: string; anon: string };
  baseUrl: string;
  adminIds: string[];
  deleteIdentity: (id: string) => Promise<void>;
};
let instance: Promise<Runtime> | undefined;
export const runtime = () => (instance ??= createRuntime());
async function createRuntime(): Promise<Runtime> {
  const demo = process.env.LAUNCH_DEMO === "1" && !process.env.VERCEL;
  requireRule(
    demo || process.env.LAUNCH_ENABLED === "1",
    "출시 기능을 준비하고 있어요.",
    503,
  );
  const env = process.env.LAUNCH_ENV || "test";
  requireRule(
    env === "test" || env === "production",
    "환경 이름을 확인해주세요.",
    503,
  );
  requireRule(
    !(process.env.VERCEL_ENV === "preview" && env === "production"),
    "미리보기는 테스트 DB를 사용해야 해요.",
    503,
  );
  const official = process.env.LAUNCH_OFFICIAL_DOMAIN;
  if (official) requireRule(official === "4zzal.com" && env === "test" && process.env.PAYMENT_MODE === "disabled", "공식 검수 설정을 확인해주세요.", 503);
  const baseUrl = (official ? "https://" + official : process.env.APP_BASE_URL) ||
    (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}` : "http://127.0.0.1:5173");
  requireRule(
    demo || new URL(baseUrl).protocol === "https:",
    "HTTPS 서비스 주소가 필요해요.",
    503,
  );
  const previewLive = !official && process.env.VERCEL_ENV === "preview" && (
    process.env.ENABLE_LIVE_EXTRACTION === "1" || process.env.ENABLE_PREVIEW_LIVE_GENERATION === "1"
  );
  const previewIntegration = !official && process.env.VERCEL_ENV === "preview" && Boolean(process.env.PREVIEW_AI_DB_NAMESPACE);
  const namespace = previewLive || previewIntegration ? required("PREVIEW_AI_DB_NAMESPACE") : env;
  if (previewLive || previewIntegration) {
    requireRule(/^test-[a-z0-9-]{3,40}$/.test(namespace) && process.env.PAYMENT_MODE === "disabled",
      "AI 검증에는 분리된 테스트 장부와 결제 비활성 설정이 필요해요.", 503);
  }
  const store = demo
    ? await sqliteStore(resolve("artifacts/launch/demo.sqlite"))
    : await postgresStore(required("LAUNCH_DATABASE_URL"), namespace);
  const storage = demo
    ? localStorage(resolve("artifacts/launch/storage"))
    : supabaseStorage(
        required("SUPABASE_URL"),
        required("SUPABASE_SERVICE_ROLE_KEY"),
      );
  const paymentMode = demo ? "mock" : process.env.PAYMENT_MODE || "disabled";
  requireRule(
    ["disabled", "mock", "toss-test", "live"].includes(paymentMode),
    "결제 환경을 확인해주세요.",
    503,
  );
  requireRule(
    env !== "production" || paymentMode === "live" || paymentMode === "disabled",
    "운영 DB에는 모의·테스트 충전을 연결할 수 없어요.",
    503,
  );
  requireRule(
    paymentMode !== "live" ||
      (env === "production" && process.env.LIVE_COMMERCE_APPROVED === "1"),
    "실결제는 출시 승인 후에만 사용할 수 있어요.",
    503,
  );
  const payments =
    paymentMode === "disabled"
      ? disabledPayments()
      : paymentMode === "mock"
      ? mockPayments(store)
      : tossPayments(
          required("TOSS_SECRET_KEY"),
          paymentMode as "toss-test" | "live",
        );
  const liveVideo =
    !demo &&
    process.env.ENABLE_LIVE_GENERATION === "1" &&
    (Boolean(official) || env === "production" || (previewLive && process.env.ENABLE_PREVIEW_LIVE_GENERATION === "1"));
  const video = liveVideo
    ? heygenProvider(required("OPENAI_API_KEY"), required("HEYGEN_API_KEY"))
    : mockVideoProvider();
  const service = new LaunchService(store, storage, payments, video, demo, aiAccountAllowed);
  if (previewIntegration && liveVideo) {
    await store.tx((s) => {
      s.config.generation = true;
      s.config.dailyJobs = Math.min(s.config.dailyJobs, 2);
      s.config.dailyUsd = Math.min(s.config.dailyUsd, 0.5);
    });
  }
  if (demo)
    await store.tx((s) => {
      if (!s.entries.some((e) => e.kind === "demo_initialized")) {
        s.config.payments = true;
        s.config.generation = true;
        s.entries.push({
          id: "demo_initialized",
          user: "system",
          kind: "demo_initialized",
          amount: 0,
          cause: "demo",
          at: Date.now(),
        });
      }
    });
  const demoSecretPath = resolve("artifacts/launch/demo-cookie-secret");
  if (demo && !existsSync(demoSecretPath))
    writeFileSync(demoSecretPath, randomBytes(32).toString("hex"));
  const cookieSecret = demo
    ? readFileSync(demoSecretPath, "utf8")
    : required("LAUNCH_COOKIE_SECRET");
  const identitySecret = demo
    ? "local-demo-only"
    : required("IDENTITY_HASH_SECRET");
  const url = process.env.SUPABASE_URL || "",
    anon = process.env.SUPABASE_ANON_KEY || "";
  const auth = async (token: string): Promise<Identity> => {
    if (demo) {
      requireRule(
        /^demo-[a-z0-9-]{1,40}$/.test(token),
        "모의 로그인이 필요해요.",
        401,
      );
      return {
        id: token,
        hash: createHmac("sha256", identitySecret).update(token).digest("hex"),
        created: Date.now(),
      };
    }
    requireRule(
      token.length > 20 && token.length < 8000,
      "로그인이 필요해요.",
      401,
    );
    const c = serverSupabase(url, required("SUPABASE_ANON_KEY"));
    const { data, error } = await c.auth.getUser(token);
    requireRule(!error && data.user, "다시 로그인해주세요.", 401);
    const existingMember = await store.tx((s) => Boolean(s.users[data.user!.id]));
    return verifiedIdentity(data.user, identitySecret, existingMember);
  };
  const deleteIdentity = async (id: string) => {
    requireRule(!previewIntegration, "통합 검수 화면에서는 로그인 계정을 삭제할 수 없어요.", 403);
    if (!demo) {
      const c = serverSupabase(url, required("SUPABASE_SERVICE_ROLE_KEY"));
      const { error } = await c.auth.admin.deleteUser(id);
      requireRule(!error, "로그인 계정 삭제를 다시 확인할게요.", 502);
    }
    await store.tx((s) => {
      if (s.users[id]) s.users[id].authDeletionPending = false;
    });
  };
  return {
    service,
    demo,
    previewIntegration,
    auth,
    cookieSecret,
    authConfig: { url, anon },
    baseUrl,
    deleteIdentity,
    adminIds: demo
      ? ["demo-operator"]
      : (process.env.LAUNCH_ADMIN_IDS || "").split(",").filter(Boolean),
  };
}
function required(name: string) {
  const v = process.env[name];
  requireRule(v && v.length > 0, "서버 연결 설정을 준비하고 있어요.", 503);
  return v;
}
