import { track, acquisitionSource } from "./analytics";
import { useSyncExternalStore } from "react";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kakaoOAuthOptions } from "./kakao";
export const launchEnabled = import.meta.env.VITE_LAUNCH_ENABLED === "1";
const base = import.meta.env.VITE_API_BASE_URL || "";
export type LaunchJob = {
  id: string;
  style: "memory" | "drawing";
  scene?: string;
  status: string;
  cost: number;
  created: number;
  expires?: number;
  error?: string;
  downloadable: boolean;
};
export function isVideoInProgress(job: LaunchJob) {
  return ["reserved", "analyzing", "submitting", "processing", "storing"].includes(job.status);
}
export type LaunchOrder = {
  id: string;
  user: string;
  status: string;
  amount: number;
  credits: number;
  created: number;
};
export type Account = {
  aiAllowed?: boolean;
  user: { id: string };
  balance: { total: number; available: number; reserved: number; paid: number };
  entries: {
    id: string;
    kind: string;
    amount: number;
    at: number;
    note?: string;
  }[];
  orders: LaunchOrder[];
  jobs: LaunchJob[];
  invite: {
    code: string;
    expires: number;
    monthlyUsed: number;
    monthlyLimit: number;
    enabled: boolean;
    waiting: number;
  };
};
export type LaunchConfig = {
  appUrl?: string;
  aiRestricted?: boolean;
  giftAvailable: boolean;
  giftCredits?: number;
  giftLimit?: number;
  invites: boolean;
  inviteMonthly: number;
  retentionDays: number;
  payments: boolean;
  generation: boolean;
  paymentMode: "disabled" | "mock" | "toss-test" | "live";
  videoMode: string;
  demo: boolean;
  auth: { url: string; anon: string };
  contact: string;
  businessReady: boolean;
};
type Snapshot = {
  config: LaunchConfig | null;
  account: Account | null;
  ready: boolean;
  authenticated: boolean;
  error: string;
  invited: boolean;
};
let state: Snapshot = {
  config: null,
  account: null,
  ready: false,
  authenticated: false,
  error: "",
  invited: false,
};
const listeners = new Set<() => void>();
const emit = (next: Partial<Snapshot>) => {
  state = { ...state, ...next };
  listeners.forEach((f) => f());
};
export const useLaunch = () =>
  useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => {
        listeners.delete(f);
      };
    },
    () => state,
  );
let client: SupabaseClient | undefined;
let initPromise: Promise<void> | undefined;
export async function launchAccessToken() {
  if (state.config?.demo) return sessionStorage.getItem("nz-demo-token") || "";
  return (await client?.auth.getSession())?.data.session?.access_token || "";
}
export async function launchApi<T = unknown>(
  action: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const t = await launchAccessToken();
  const r = await fetch(base + "/api/launch", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: "Bearer " + t } : {}),
    },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "연결을 다시 확인해주세요.");
  return data as T;
}
export async function refreshConfig() {
  const r = await fetch(base + "/api/launch?action=config", {
    credentials: "include",
  });
  if (r.ok) emit({ config: await r.json() });
}
export async function refreshAccount() {
  if (!(await launchAccessToken())) {
    emit({ account: null, authenticated: false });
    return;
  }
  emit({ authenticated: true });
  const a = await launchApi<Account>(state.account ? "account" : "login");
  emit({ account: a });
}
export function initializeLaunch() {
  return (initPromise ??= initialize());
}
async function initialize() {
  if (!launchEnabled) return;
  try {
    const r = await fetch(base + "/api/launch?action=config", {
        credentials: "include",
      }),
      config = await r.json();
    if (!r.ok) throw new Error(config.error);
    emit({ config });
    if (!config.demo && config.auth.url && config.auth.anon) {
      client = createClient(config.auth.url, config.auth.anon, {
        auth: { flowType: "pkce", detectSessionInUrl: false },
      });
      const callback = new URL(location.href);
      const callbackParams = new URLSearchParams(location.hash.slice(1));
      const authError = callback.searchParams.get("error") || callbackParams.get("error");
      const code = callback.searchParams.get("code");
      if (authError || code || callback.searchParams.has("auth")) {
        for (const k of ["code", "auth", "error", "error_code", "error_description"])
          callback.searchParams.delete(k);
        callback.hash = "";
        history.replaceState(null, "", callback.pathname + callback.search);
      }
      if (authError) emit({ error: "카카오 로그인이 취소되었거나 완료되지 않았어요. 사진과 편집 내용은 그대로예요." });
      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error)
          emit({ error: "로그인을 확인하지 못했어요. 사진과 편집 내용은 보관했으니 다시 시도해주세요." });
      }
    }
    const params = new URLSearchParams(location.search),
      ref = params.get("ref");
    emit({ authenticated: Boolean(await launchAccessToken()) });
    try {
      const visit = await launchApi<{ invited: boolean }>("visit", ref ? { code: ref } : {});
      emit({ invited: visit.invited });
      track("visit",{source:acquisitionSource(),invited:visit.invited});
    } catch { /* Account recovery does not depend on referral tracking. */ }
    if (state.authenticated) await refreshAccount();
    const payment = params.get("payment");
    if (payment === "success" && params.get("paymentKey") && state.account) {
      const a = await launchApi<Account>("confirm", {
        orderId: params.get("orderId"),
        paymentKey: params.get("paymentKey"),
        amount: Number(params.get("amount")),
      });
      emit({ account: a });
      const u = new URL(location.href);
      for (const k of ["payment", "paymentKey", "orderId", "amount"])
        u.searchParams.delete(k);
      history.replaceState(null, "", u.pathname + u.search);
    }
    if (payment === "fail") {
      if (state.account)
        sessionStorage.removeItem(
          "nz-purchase-request:" + state.account.user.id,
        );
      emit({
        error: "결제가 취소되었거나 완료되지 않았어요. 편집 내용은 그대로예요.",
      });
    }
    emit({ ready: true });
    setInterval(() => void refreshConfig().catch(() => {}), 30000);
    window.addEventListener(
      "focus",
      () => void refreshConfig().catch(() => {}),
    );
  } catch (e) {
    emit({
      ready: true,
      error: e instanceof Error ? e.message : "출시 연결을 준비하고 있어요.",
    });
  }
}
export async function demoLogin(alias: string) {
  if (!state.config?.demo)
    throw new Error("모의 로그인만 지원하는 화면이에요.");
  const clean = alias
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
  if (!clean) throw new Error("영문 또는 숫자로 체험 계정 이름을 적어주세요.");
  sessionStorage.setItem("nz-demo-token", "demo-" + clean);
  const account = await launchApi<Account>("login");
  emit({ account, authenticated: true, error: "" });
  await refreshConfig();
}
export async function kakaoLogin() {
  await flushDraft();
  await refreshConfig();
  if (!client) throw new Error("카카오 로그인 연결을 준비하고 있어요.");
  const { error } = await client.auth.signInWithOAuth(kakaoOAuthOptions(location.origin));
  if (error) throw new Error("카카오 로그인을 시작하지 못했어요. 편집 내용은 보관했어요.");
}
export async function logout() {
  sessionStorage.removeItem("nz-credit-job");
  sessionStorage.removeItem("nz-credit-request");
  sessionStorage.removeItem("nz-demo-token");
  await client?.auth.signOut();
  emit({ account: null, authenticated: false });
}
export async function videoFile(id: string) {
  const t = await launchAccessToken();
  const r = await fetch(
    base + "/api/launch?action=file&jobId=" + encodeURIComponent(id),
    { credentials: "include", headers: { Authorization: "Bearer " + t } },
  );
  if (!r.ok) {
    const data = await r.json();
    throw new Error(data.error);
  }
  return r.blob();
}
export async function beginInviteRender() {
  if (!state.invited) return "";
  try {
    return (await launchApi<{ id: string }>("renderStart")).id;
  } catch {
    return "";
  }
}
export async function verifyInviteGif(gif: string, renderId: string) {
  if (!state.invited) return;
  await launchApi("renderComplete", { renderId, gif });
  if (state.account) await refreshAccount();
}
// OAuth returns to a new page: persist the original Blob and all editor settings
// in IndexedDB, never localStorage URLs which expire across navigation.
export type EditorDraft = {
  personCount?: number;
  workId?: string;
  original: Blob;
  sourceUrl: string | null;
  rectified?: boolean;
  sourceSize: { width: number; height: number };
  cells: { x: number; y: number; width: number; height: number }[];
  adjusts: { x: number; y: number; scale: number; rotate: number }[];
  memo: string;
  selectedFrame: "basic" | "spring" | "autumn" | "film";
  gif?: string | null;
  styleName?: string;
  extractStatus?: "loading" | "success" | "fallback" | "error";
  inviteRender?: string;
  at: number;
};
let draftWrite = Promise.resolve();
let draftOriginal: { url: string; blob: Promise<Blob> } | undefined;
function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("naezzal-launch-draft", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("drafts");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error("편집 내용을 보관하지 못했어요."));
  });
}
export function saveDraft(
  originalUrl: string,
  data: Omit<EditorDraft, "original" | "at">,
) {
  if (draftOriginal?.url !== originalUrl) {
    const blob = fetch(originalUrl).then((response) => response.blob());
    void blob.catch(() => { if (draftOriginal?.blob === blob) draftOriginal = undefined; });
    draftOriginal = { url: originalUrl, blob };
  }
  const originalBlob = draftOriginal.blob;
  draftWrite = draftWrite
    .catch(() => {})
    .then(async () => {
      const original = await originalBlob;
      const d = await db();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = d.transaction("drafts", "readwrite");
          tx.objectStore("drafts").put(
            { ...data, original, at: Date.now() },
            "current",
          );
          tx.oncomplete = () => resolve();
          tx.onerror = tx.onabort = () => reject(new Error("편집 보관 실패"));
        });
      } finally {
        d.close();
      }
    });
  return draftWrite;
}
export const flushDraft = () => draftWrite;
export async function getDraft(): Promise<EditorDraft | null> {
  const d = await db();
  try {
    return await new Promise((resolve, reject) => {
      const tx = d.transaction("drafts", "readwrite");
      const store = tx.objectStore("drafts");
      const r = store.get("current");
      let draft: EditorDraft | null = null;
      r.onsuccess = () => {
        if (r.result && r.result.at > Date.now() - 86400000) draft = r.result;
        else if (r.result) store.delete("current");
      };
      tx.oncomplete = () => resolve(draft);
      tx.onerror = tx.onabort = () => reject(new Error("편집 복원 실패"));
    });
  } finally {
    d.close();
  }
}
export function clearDraft() {
  draftOriginal = undefined;
  draftWrite = draftWrite.catch(() => {}).then(deleteDraft);
  return draftWrite;
}
async function deleteDraft() {
  const d = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction("drafts", "readwrite");
      tx.objectStore("drafts").delete("current");
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error("편집 삭제 실패"));
    });
  } finally {
    d.close();
  }
}
