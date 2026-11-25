import { reconcileUsage, costReport } from "./costs.ts";
import { randomUUID } from "node:crypto";
import type { Store } from "./store.ts";
import type { Storage } from "./storage.ts";
import type { Payments } from "./payments.ts";
import type { VideoProvider } from "./video.ts";
import { ANALYSIS_VERSION, sha, validateImages } from "./video.ts";
import {
  balance,
  beginCancel,
  beginPayment,
  cancelled,
  claim,
  completeRender,
  createVisit,
  defaults,
  jobFor,
  newOrder,
  ownOrder,
  paid,
  requireRule,
  reserveJob,
  settle,
  signup,
  startRender,
  monthKst,
  adminGrant,
  rate,
  entry,
} from "./domain.ts";
import type { Config, Job, Style } from "./domain.ts";
import { limitedDownload, removeAudio, validateGif } from "./media.ts";
export class LaunchService {
  store: Store;
  storage: Storage;
  payments: Payments;
  video: VideoProvider;
  private readonly allowMockVideo: boolean;
  private readonly aiAccountAllowed: (user: string) => boolean;
  constructor(
    store: Store,
    storage: Storage,
    payments: Payments,
    video: VideoProvider,
    allowMockVideo = false,
    aiAccountAllowed: (user: string) => boolean = () => true,
  ) {
    this.store = store;
    this.storage = storage;
    this.payments = payments;
    this.video = video;
    this.allowMockVideo = allowMockVideo;
    this.aiAccountAllowed = aiAccountAllowed;
  }
  async config() {
    return this.store.tx((s) => ({
      giftCredits: 4,
      giftLimit: s.config.giftLimit,
      giftAvailable:
        s.config.gifts &&
        s.entries.filter((e) => e.kind === "signup_gift").length <
          s.config.giftLimit,
      invites: s.config.invites,
      inviteMonthly: s.config.inviteMonthly,
      retentionDays: s.config.retentionDays,
      payments: s.config.payments && this.payments.kind !== "disabled",
      generation: s.config.generation && (this.video.kind === "heygen" || this.allowMockVideo),
      paymentMode: this.payments.kind,
      videoMode: this.video.kind,
    }));
  }
  async login(
    id: string,
    identity: string,
    created: number,
    visit: string | undefined,
  ) {
    return this.store.tx((s) => {
      signup(s, id, identity, created, visit, Date.now());
      return this.accountState(s, id);
    });
  }
  accountState(s: Parameters<Parameters<Store["tx"]>[0]>[0], user: string) {
    const u = s.users[user];
    requireRule(u && !u.deleted, "로그인이 필요해요.", 401);
    const now = Date.now();
    const rewards = s.entries.filter(
      (e) =>
        e.user === user &&
        e.kind === "invite_reward" &&
        monthKst(e.at) === monthKst(now),
    ).length;
    return {
      user: { id: u.id },
      balance: balance(s, user),
      entries: s.entries
        .filter((e) => e.user === user)
        .slice(-100)
        .reverse(),
      orders: Object.values(s.orders)
        .filter((o) => o.user === user)
        .map(({ paymentKey: _, ...o }) => {
          void _;
          return o;
        })
        .reverse(),
      jobs: Object.values(s.jobs)
        .filter((j) => j.user === user)
        .map((j) => this.publicJob(j))
        .reverse(),
      invite: {
        code: u.inviteCode,
        expires: u.inviteExpires,
        monthlyUsed: rewards,
        monthlyLimit: s.config.inviteMonthly,
        enabled:
          s.config.invites &&
          rewards < s.config.inviteMonthly &&
          u.inviteExpires > now,
        waiting: Object.values(s.users).filter(
          (x) => x.inviter === user && !x.rewardPaid,
        ).length,
      },
    };
  }
  async account(user: string) {
    return this.store.tx((s) => this.accountState(s, user));
  }
  publicJob(j: Job) {
    const hiddenMock = !this.allowMockVideo && j.providerId?.startsWith("mock-");
    return {
      id: j.id,
      style: j.style,
      status: hiddenMock && j.status === "completed" ? "unavailable" : j.status,
      cost: j.cost,
      created: j.created,
      expires: j.expires,
      error: j.error,
      downloadable:
        j.status === "completed" &&
        Boolean(j.output) &&
        !hiddenMock &&
        Boolean(j.expires && j.expires > Date.now()),
    };
  }
  async visit(code?: string, existing?: string) {
    return this.store.tx((s) => {
      const prior = existing ? s.visits[existing] : null;
      if (prior && prior.expires > Date.now()) {
        if (code && !prior.inviter && !prior.user) {
          const linked = createVisit(s, code, Date.now());
          prior.inviter = linked.inviter;
          delete s.visits[linked.id];
        }
        return prior;
      }
      return createVisit(s, code, Date.now());
    });
  }
  async renderStart(visit: string) {
    return this.store.tx((s) => startRender(s, visit, Date.now()));
  }
  async renderComplete(
    visit: string,
    id: string,
    bytes: Buffer,
    user?: string,
  ) {
    validateGif(bytes);
    const hash = sha(bytes);
    await this.store.tx((s) =>
      completeRender(s, visit, id, hash, user, Date.now()),
    );
  }
  async order(user: string, key: string) {
    requireRule(this.payments.kind !== "disabled", "크레딧 충전을 준비하고 있어요.", 503);
    return this.store.tx((s) => newOrder(s, user, key, Date.now()));
  }
  async confirm(user: string, id: string, key: string, amount: number) {
    const o = await this.store.tx((s) =>
      beginPayment(s, user, id, key, amount),
    );
    // Lookup first recovers a provider approval whose local commit was lost.
    let p = await this.payments.lookup(o);
    if (!p || ["READY", "IN_PROGRESS"].includes(p.status))
      p = await this.payments.confirm(o);
    await this.store.tx((s) => paid(s, id, p!, Date.now()));
    return this.account(user);
  }
  async recoverOrder(user: string, id: string) {
    const o = await this.store.tx((s) =>
      structuredClone(ownOrder(s, user, id)),
    );
    const p = await this.payments.lookup(o);
    if (p) {
      if (o.status === "cancelling" && p.status === "DONE") {
        const c = await this.payments.cancel(o);
        requireRule(
          c.orderId === o.id &&
            c.paymentKey === o.paymentKey &&
            c.totalAmount === o.amount &&
            c.status === "CANCELED",
          "취소 확인이 필요해요.",
          502,
        );
        await this.store.tx((s) => cancelled(s, id, Date.now()));
      } else await this.store.tx((s) => paid(s, id, p, Date.now()));
    }
    return this.account(user);
  }
  async cancel(user: string, id: string, reason: string) {
    const o = await this.store.tx((s) =>
      structuredClone(beginCancel(s, user, id, reason)),
    );
    if (o.status === "cancelled") return this.account(user);
    const known = await this.payments.lookup(o);
    const p =
      known?.status === "CANCELED" ? known : await this.payments.cancel(o);
    requireRule(
      p.orderId === o.id &&
        p.paymentKey === o.paymentKey &&
        p.totalAmount === o.amount &&
        p.currency === o.currency &&
        p.status === "CANCELED",
      "취소 상태 확인이 필요해요.",
      502,
    );
    await this.store.tx((s) => cancelled(s, id, Date.now()));
    return this.account(user);
  }
  async createJob(
    user: string,
    key: string,
    style: Style,
    images: unknown,
    consent: unknown,
  ) {
    requireRule(this.aiAccountAllowed(user), "AI 기능은 현재 출시 준비 중이에요.", 403);
    requireRule(this.video.kind === "heygen" || this.allowMockVideo, "AI 영상 제작을 준비하고 있어요.", 503);
    requireRule(consent === true, "사진 전송과 영상 제작 안내에 동의해주세요.");
    validateImages(images);
    const fingerprint = sha(ANALYSIS_VERSION + "|" + images.join("|"));
    const job = await this.store.tx((s) =>
      structuredClone(reserveJob(s, user, key, fingerprint, style, Date.now())),
    );
    if (job.status === "reserved")
      await this.storage.put(
        "launch-inputs",
        job.user + "/" + job.id + ".json",
        Buffer.from(JSON.stringify(images)),
        "application/json",
      );
    return this.publicJob(job);
  }
  async jobStatus(user: string, id: string) {
    return this.store.tx((s) => this.publicJob(jobFor(s, user, id)));
  }
  async work(user: string, id: string) {
    await this.store.tx((s) => jobFor(s, user, id));
    await this.runJob(id);
    const j = await this.store.tx((s) => structuredClone(jobFor(s, user, id)));
    return this.publicJob(j);
  }
  async runJob(id: string) {
    const job = await this.store.tx((s) => {
      const pending = s.jobs[id];
      if (pending && !this.aiAccountAllowed(pending.user)) return null;
      return claim(s, id, Date.now());
    });
    if (!job) return;
    const patch = async (data: Partial<Job>) =>
      this.store.tx((s) => {
        const j = s.jobs[id];
        requireRule(j.lease === job.lease, "다른 작업자가 확인 중이에요.", 409);
        Object.assign(j, data);
      });
    const inputKey = job.user + "/" + id + ".json";
    try {
      if (!this.allowMockVideo && (job.providerId?.startsWith("mock-") || (this.video.kind === "mock" && !job.submittedAt))) {
        await this.store.tx((s) => {
          requireRule(s.jobs[id].lease === job.lease, "다른 작업자가 확인 중이에요.", 409);
          settle(s, id, false, Date.now());
        });
        await this.storage.remove("launch-inputs", inputKey).catch(() => {});
        return;
      }
      if (this.video.kind === "mock" && !this.allowMockVideo) return;
      let providerId = job.providerId;
      if (!providerId) {
        // Unknown submissions are retried only under the SAME provider idempotency key,
        // within its documented 24-hour window. Never submit again after that window.
        if (job.submittedAt && Date.now() - job.submittedAt > 23 * 3600000) {
          await patch({
            status: "review",
            error:
              "접수 상태를 운영자가 확인하고 있어요. 다시 제작하지 마세요.",
          });
          return;
        }
        if (job.created < Date.now() - 24 * 3600000) {
          await patch({
            status: "review",
            error: "제작 자료 보관 시간이 지나 운영자 확인이 필요해요.",
          });
          return;
        }
        const images = JSON.parse(
          (await this.storage.get("launch-inputs", inputKey)).toString(),
        ) as string[];
        let motion: string | undefined;
        if (job.style === "memory") {
          const cacheId =
            job.user + ":" + job.fingerprint + ":" + ANALYSIS_VERSION;
          const cache = await this.store.tx((s) => {
            const c = s.cache[cacheId];
            if (c && c.at > Date.now() - 86400000)
              return { ...c, createdNow: false };
            const next = { key: "", at: Date.now(), pending: true, owner: id };
            s.cache[cacheId] = next;
            return { ...next, createdNow: true };
          });
          if (!cache.pending) {
            const a = JSON.parse(
              (await this.storage.get("launch-inputs", cache.key)).toString(),
            );
            motion = a.analysis.motion_prompt_en;
          } else if (!cache.createdNow) {
            const ownerActive = await this.store.tx((s) => {
              const owner = s.jobs[cache.owner || ""];
              return (
                owner &&
                owner.id !== id &&
                Boolean(owner.leaseUntil && owner.leaseUntil > Date.now()) &&
                owner.status === "analyzing"
              );
            });
            await patch(
              ownerActive
                ? {
                    status: "reserved",
                    error: "같은 사진의 동작 분석을 기다리고 있어요.",
                  }
                : {
                    status: "review",
                    error:
                      "동작 분석 응답을 운영자가 확인하고 있어요. 추가 분석은 요청하지 않았어요.",
                  },
            );
            return;
          } else {
            await patch({ status: "analyzing" });
            const analysis = await this.video.analyze(images);
            const analysisKey =
              job.user + "/analysis-" + job.fingerprint + ".json";
            await this.storage.put(
              "launch-inputs",
              analysisKey,
              Buffer.from(JSON.stringify(analysis)),
              "application/json",
            );
            await this.store.tx((s) => {
              s.cache[cacheId] = { key: analysisKey, at: Date.now() };
            });
            motion = analysis.analysis.motion_prompt_en;
          }
        }
        await patch({
          status: "submitting",
          submittedAt: job.submittedAt || Date.now(),
        });
        providerId = await this.video.submit(job, images, motion);
        await patch({ providerId, status: "processing" });
      }
      const result = await this.video.status(providerId);
      if (["failed", "cancelled"].includes(result.status)) {
        await this.store.tx((s) => {
          requireRule(
            s.jobs[id].lease === job.lease,
            "다른 작업자가 확인 중이에요.",
            409,
          );
          settle(s, id, false, Date.now());
        });
        await this.storage.remove("launch-inputs", inputKey).catch(() => {});
        return;
      }
      if (result.status !== "completed") return;
      await patch({ status: "storing" });
      const original =
        this.video.kind === "mock"
          ? await this.video.mockFile!()
          : await limitedDownload(result.url!);
      const silent = await removeAudio(original);
      const output = job.user + "/" + id + ".mp4";
      await this.storage.put("launch-results", output, silent, "video/mp4");
      await this.store.tx((s) => {
        const j = s.jobs[id];
        requireRule(
          j.lease === job.lease,
          "후처리 상태를 다시 확인할게요.",
          409,
        );
        j.output = output;
        j.expires = Date.now() + s.config.retentionDays * 86400000;
        settle(s, id, true, Date.now());
      });
      await this.storage.remove("launch-inputs", inputKey).catch(() => {});
    } catch {
      const failedBeforeSubmission = await this.store.tx((s) => {
        const j = s.jobs[id];
        if (j.lease !== job.lease || ["completed", "failed", "review"].includes(j.status)) return false;
        if (j.status === "analyzing" && !j.submittedAt) {
          const cacheId = j.user + ":" + j.fingerprint + ":" + ANALYSIS_VERSION;
          if (s.cache[cacheId]?.pending && s.cache[cacheId]?.owner === id) delete s.cache[cacheId];
          settle(s, id, false, Date.now());
          j.error = "사진 분석을 완료하지 못했어요.";
          return true;
        }
        // Keep the reservation after an uncertain submission or download failure.
        j.error = "연결 또는 파일 준비가 지연되고 있어요. 새 제작 없이 같은 작업을 확인합니다.";
        return false;
      });
      if (failedBeforeSubmission) await this.storage.remove("launch-inputs", inputKey).catch(() => {});
    } finally {
      await this.store.tx((s) => {
        const j = s.jobs[id];
        if (j.lease === job.lease) {
          delete j.lease;
          delete j.leaseUntil;
        }
      });
    }
  }
  async file(user: string, id: string) {
    const j = await this.store.tx((s) => structuredClone(jobFor(s, user, id)));
    requireRule(
      j.status === "completed" &&
        (this.allowMockVideo || !j.providerId?.startsWith("mock-")) &&
        j.output &&
        j.expires &&
        j.expires > Date.now(),
      "영상 보관 기간이 지났거나 준비 중이에요.",
      410,
    );
    return this.storage.get("launch-results", j.output);
  }
  async deleteResult(user: string, id: string) {
    const j = await this.store.tx((s) => structuredClone(jobFor(s, user, id)));
    requireRule(
      j.status === "completed" || j.status === "failed",
      "진행 중인 제작은 완료 후 삭제할 수 있어요.",
      409,
    );
    if (j.output) await this.storage.remove("launch-results", j.output);
    await this.store.tx((s) => {
      delete s.jobs[id].output;
      s.jobs[id].expires = Date.now();
    });
  }
  async closeAccount(user: string) {
    const pending = await this.store.tx((s) => {
      requireRule(
        balance(s, user).paid === 0,
        "남은 구매 크레딧의 환불을 먼저 확인해주세요.",
        409,
      );
      requireRule(
        !Object.values(s.jobs).some(
          (j) => j.user === user && !["completed", "failed"].includes(j.status),
        ) &&
          !Object.values(s.orders).some(
            (o) =>
              o.user === user &&
              ["confirming", "cancelling"].includes(o.status),
          ),
        "진행 중인 제작·결제 확인 후 탈퇴할 수 있어요.",
        409,
      );
      s.users[user].closing = true;
      return {
        jobs: Object.values(s.jobs).filter((j) => j.user === user),
        cache: Object.entries(s.cache).filter(([k]) =>
          k.startsWith(user + ":"),
        ),
      };
    });
    for (const j of pending.jobs) {
      if (j.output) await this.storage.remove("launch-results", j.output);
      await this.storage
        .remove("launch-inputs", user + "/" + j.id + ".json")
        .catch(() => {});
    }
    for (const [, c] of pending.cache)
      if (c.key) await this.storage.remove("launch-inputs", c.key);
    await this.store.tx((s) => {
      const u = s.users[user];
      u.deleted = true;
      u.closing = false;
      u.authDeletionPending = true;
      u.inviteCode = "";
      u.identityUntil = Date.now() + 90 * 86400000;
      let removed = 0;
      for (const l of Object.values(s.lots))
        if (l.user === user) {
          removed += l.remaining;
          l.remaining = 0;
          l.reserved = 0;
        }
      s.entries.push({
        id: randomUUID(),
        user,
        kind: "account_close",
        amount: -removed,
        cause: "close:" + user,
        at: Date.now(),
      });
      for (const j of Object.values(s.jobs))
        if (j.user === user) {
          delete j.output;
          delete j.providerId;
        }
      for (const [k] of pending.cache) delete s.cache[k];
      for (const [k, v] of Object.entries(s.visits))
        if (v.user === user || v.inviter === user) delete s.visits[k];
    });
  }
  async maintenance() {
    const state = await this.store.tx((s) => structuredClone(s));
    for (const j of Object.values(state.jobs)
      .filter((j) => !["completed", "failed", "review"].includes(j.status))
      .slice(0, 1))
      await this.runJob(j.id);
    for (const o of Object.values(state.orders)
      .filter((o) => ["confirming", "cancelling"].includes(o.status))
      .slice(0, 5))
      await this.recoverOrder(o.user, o.id).catch(() => {});
    for (const j of Object.values(state.jobs)) {
      if (j.output && j.expires && j.expires < Date.now()) {
        await this.storage.remove("launch-results", j.output);
        await this.store.tx((s) => {
          delete s.jobs[j.id].output;
        });
      }
      if (j.created < Date.now() - 86400000)
        await this.storage
          .remove("launch-inputs", j.user + "/" + j.id + ".json")
          .catch(() => {});
    }
    for (const [key, c] of Object.entries(state.cache))
      if (c.at < Date.now() - 86400000) {
        if (c.key) await this.storage.remove("launch-inputs", c.key);
        await this.store.tx((s) => {
          delete s.cache[key];
        });
      }
    await this.store.tx((s) => {
      const now = Date.now();
      for (const [key, v] of Object.entries(s.visits))
        if (v.expires < now) delete s.visits[key];
      for (const [key, v] of Object.entries(s.renders))
        if (v.expires < now) delete s.renders[key];
      for (const u of Object.values(s.users))
        if (u.deleted && u.identityUntil && u.identityUntil < now) {
          u.identity = "";
          delete u.identityUntil;
        }
    });
  }
  async admin(
    user: string,
    body: {
      action: string;
      target?: string;
      amount?: number;
      reason?: string;
      requestKey?: string;
      config?: Partial<Config>;
      jobId?: string;
      outcome?: string;
      usageId?: string;
      actualUsd?: number;
      invoiceReference?: string;
    },
  ) {
    return this.store.tx((s) => {
      if (body.action === "adjust") {
        requireRule(
          body.target && body.requestKey,
          "대상과 요청 정보가 필요해요.",
        );
        adminGrant(
          s,
          body.target,
          Number(body.amount),
          body.reason || "",
          body.requestKey,
          Date.now(),
        );
        entryAudit();
      } else if (body.action === "settings") {
        requireRule(
          body.reason && body.reason.length >= 4,
          "변경 사유가 필요해요.",
        );
        for (const [k, v] of Object.entries(body.config || {})) {
          requireRule(Object.hasOwn(defaults, k), "설정 이름을 확인해주세요.");
          requireRule(
            typeof defaults[k as keyof Config] === typeof v,
            "설정 값을 확인해주세요.",
          );
          if (typeof v === "number") {
            requireRule(
              Number.isFinite(v) &&
                v >= 0 &&
                v <= (k === "giftLimit" ? 1000000 : 1000) &&
                (["dailyUsd","memoryReserveUsd","drawingReserveUsd","extractionReserveUsd"].includes(k) || Number.isSafeInteger(v)),
              "설정 범위를 확인해주세요.",
            );
            if (k === "retentionDays")
              requireRule(v >= 1 && v <= 30, "보관 기간은 1~30일이에요.");
          }
        }
        s.config = { ...s.config, ...body.config };
        entryAudit();
      } else if (body.action === "reconcileUsage") {
        reconcileUsage(s, body.usageId || "", Number(body.actualUsd), body.invoiceReference || "", body.reason || "");
        entryAudit();
      } else if (body.action === "releaseConfirmedFailure") {
        const j = s.jobs[body.jobId || ""];
        requireRule(
          j && j.status === "review" && body.reason && body.reason.length >= 8,
          "공급자에서 기술 실패를 확인한 사유가 필요해요.",
        );
        settle(s, j.id, false, Date.now());
        entryAudit();
      } else if (body.action === "usageExport") return { ...costReport(s), records:Object.values(s.usage || {}) };
      else if (body.action === "inspect")
        return {
          config: s.config,
          costs: costReport(s),
          analytics: { daily:s.telemetry?.daily || {}, droppedFromQueue:s.telemetry?.dropped || 0, pending: Object.values(s.telemetry?.events || {}).filter(e => !e.sent).length, destinationConfigured: Boolean(process.env.POSTHOG_PROJECT_ID && process.env.POSTHOG_4ZZAL_KEY) },
          orders: Object.values(s.orders).map(({ paymentKey: _, ...o }) => {
            void _;
            return o;
          }),
          jobs: Object.values(s.jobs).map((j) => this.publicJob(j)),
          entries: s.entries.slice(-200),
        };
      else requireRule(false, "관리 작업을 확인해주세요.");
      return { ok: true };
      function entryAudit() {
        rate(s, "admin:" + user, 100, 3600000, Date.now());
        entry(
          s,
          user,
          "admin_audit",
          0,
          body.requestKey || randomUUID(),
          Date.now(),
          JSON.stringify({
            action: body.action,
            target: body.target,
            reason: body.reason,
            config: body.config,
          }),
        );
      }
    });
  }
}
