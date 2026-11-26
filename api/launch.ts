import { clientMetric, recordMetric, flushMetrics } from "../server/launch/telemetry.ts";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { aiAccountAllowed, aiAccessRestricted, requirePreviewAiAccount } from "../server/launch/preview.ts";
import { runtime } from "../server/launch/runtime.ts";
import { BUSINESS } from "../src/lib/business.ts";
import {
  requireRule,
  RuleError,
  rate,
  PRODUCT,
} from "../server/launch/domain.ts";
import type { Style, Config } from "../server/launch/domain.ts";
import { mediaSmoke } from "../server/launch/media.ts";
type Request = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
};
type Response = {
  setHeader: (k: string, v: string | string[]) => void;
  status: (code: number) => Response;
  json: (v: unknown) => unknown;
  end: (v?: Buffer) => unknown;
};
function equal(a: string, b: string) {
  return (
    Buffer.byteLength(a) === Buffer.byteLength(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const requestedAction = String(
      req.query?.action || req.body?.action || "config",
    );
    if (["previewMediaCheck", "previewIntegrationCheck"].includes(requestedAction)) {
      const expected = process.env.LAUNCH_PREVIEW_CHECK,
        auth = req.headers.authorization;
      requireRule(
        process.env.VERCEL_ENV === "preview" &&
          expected &&
          typeof auth === "string" &&
          equal(auth, "Bearer " + expected),
        "미리보기 검사 권한이 필요해요.",
        403,
      );
      if (requestedAction === "previewMediaCheck")
        return res.status(200).json(await mediaSmoke());
      requireRule(process.env.LAUNCH_ENV === "test" && process.env.PAYMENT_MODE === "mock" &&
        process.env.ENABLE_LIVE_GENERATION === "0", "테스트 설정을 확인해주세요.", 403);
      const check = await runtime();
      const config = await check.service.config();
      requireRule(config.paymentMode === "mock" && config.videoMode === "mock", "모의 모드가 필요해요.", 403);
      const results: Record<string, boolean> = {};
      for (const [bucket, ext, type] of [["launch-inputs", "json", "application/json"], ["launch-results", "mp4", "video/mp4"]]) {
        const key = `preview-check/${randomUUID()}.${ext}`;
        const bytes = Buffer.from('Synthetic private-storage transport check; no personal files.');
        try {
          await check.service.storage.put(bucket, key, bytes, type);
          results[bucket + "Read"] = (await check.service.storage.get(bucket, key)).equals(bytes);
          const publicRead = await fetch(`${check.authConfig.url}/storage/v1/object/public/${bucket}/${key}`);
          results[bucket + "Private"] = !publicRead.ok;
        } finally {
          await check.service.storage.remove(bucket, key);
        }
        try { await check.service.storage.get(bucket, key); results[bucket + "Deleted"] = false; }
        catch { results[bucket + "Deleted"] = true; }
      }
      return res.status(200).json({ database: true, paymentMode: config.paymentMode, videoMode: config.videoMode, checks: results });
    }
    if (
      requestedAction === "config" &&
      process.env.LAUNCH_ENABLED !== "1" &&
      process.env.LAUNCH_DEMO !== "1"
    )
      return res
        .status(200)
        .json({
          giftAvailable: false,
          invites: false,
          inviteMonthly: 5,
          retentionDays: 7,
          payments: false,
          generation: false,
          paymentMode: "mock",
          videoMode: "mock",
          demo: false,
          auth: { url: "", anon: "" },
          contact: BUSINESS.supportEmail,
          businessReady: false,
          configured: false,
          product: PRODUCT,
        });
    const r = await runtime(),
      body = req.body || {},
      action = String(req.query?.action || body.action || "config");
    const origin = req.headers.origin;
    const allowed = [
      new URL(r.baseUrl).origin,
      ...(process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean),
    ];
    if (r.demo) allowed.push("http://localhost:5173", "http://127.0.0.1:5173");
    if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL)
      allowed.push("https://" + process.env.VERCEL_URL);
    requireRule(
      !origin || (typeof origin === "string" && allowed.includes(origin)),
      "허용되지 않은 앱 주소예요.",
      403,
    );
    if (typeof origin === "string") {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.status(204).end();
    requireRule(
      ["GET", "POST"].includes(req.method || ""),
      "지원하지 않는 요청이에요.",
      405,
    );
    requireRule(
      req.method === "POST" ||
        ["config", "account", "file", "maintenance"].includes(action),
      "POST 요청이 필요해요.",
      405,
    );
    if (action === "config")
      return res
        .status(200)
        .json({
          ...(await r.service.config()),
          auth: r.authConfig,
          appUrl: r.baseUrl,
          aiRestricted: aiAccessRestricted(),
          demo: r.demo,
          product: PRODUCT,
          contact: BUSINESS.supportEmail,
          businessReady: process.env.BUSINESS_DETAILS_VERIFIED === "1",
        });
    const cookies =
      typeof req.headers.cookie === "string" ? req.headers.cookie : "";
    const signed =
      cookies
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("nz_visit="))
        ?.slice(9) || "";
    const [visitId, signature] = signed.split(".");
    const validVisit =
      visitId &&
      signature &&
      equal(
        createHmac("sha256", r.cookieSecret)
          .update(visitId)
          .digest("base64url"),
        signature,
      )
        ? visitId
        : undefined;
    const authHeader = req.headers.authorization;
    const token =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : "";
    if (action === "analytics") {
      requireRule(JSON.stringify(body).length<=1000,"분석 자료 크기를 확인해주세요.",413);
      requireRule(validVisit, "방문 확인이 필요해요.",401);
      const metric=clientMetric(body.event,body.properties);
      requireRule(metric,"분석 항목을 확인해주세요.");
      await r.service.store.tx(s=>{rate(s,"analytics:"+validVisit,60,60000,Date.now());recordMetric(s,metric.event,validVisit,metric.properties);});
      await flushMetrics(r.service.store,r.cookieSecret);
      return res.status(200).json({ok:true});
    }
    if (action === "maintenance") {
      const key = process.env.CRON_SECRET;
      requireRule(key && equal(token, key), "관리자 확인이 필요해요.", 401);
      await r.service.maintenance();
      await flushMetrics(r.service.store,r.cookieSecret);
      const pending = await r.service.store.tx((s) =>
        Object.values(s.users)
          .filter((u) => u.deleted && u.authDeletionPending)
          .map((u) => u.id),
      );
      for (const id of pending) await r.deleteIdentity(id).catch(() => {});
      return res.status(200).json({ ok: true });
    }
    if (action === "webhook") {
      // Never trust webhook paymentKey, amount or status. Query stored order against PG.
      const data = body.data as { orderId?: string } | undefined;
      const id = String(data?.orderId || "");
      const o = await r.service.store.tx((s) => {
        rate(s, "webhook", 60, 60000, Date.now());
        return s.orders[id] ? structuredClone(s.orders[id]) : null;
      });
      if (o?.paymentKey) await r.service.recoverOrder(o.user, o.id);
      return res.status(200).json({ received: true });
    }
    if (action === "visit") {
      await r.service.store.tx((s) => {
        rate(s, "visits-global", 1000, 3600000, Date.now());
        const ip = String(
          req.headers["x-vercel-forwarded-for"] ||
            req.headers["x-real-ip"] ||
            "local",
        );
        const hash = createHmac("sha256", r.cookieSecret)
          .update(ip)
          .digest("hex");
        rate(s, "visit-rate:" + hash, 30, 60000, Date.now());
      });
      const v = await r.service.visit(
        typeof body.code === "string" ? body.code : undefined,
        validVisit,
      );
      const sig = createHmac("sha256", r.cookieSecret)
        .update(v.id)
        .digest("base64url");
      res.setHeader(
        "Set-Cookie",
        "nz_visit=" +
          v.id +
          "." +
          sig +
          "; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000" +
          (r.demo ? "" : "; Secure"),
      );
      return res
        .status(200)
        .json({ invited: Boolean(v.inviter), expires: v.expires });
    }
    if (action === "renderStart") {
      requireRule(validVisit, "초대 방문을 다시 확인해주세요.", 401);
      return res.status(200).json(await r.service.renderStart(validVisit));
    }
    const identity = token ? await r.auth(token) : null;
    if (action === "renderComplete") {
      requireRule(
        validVisit &&
          typeof body.renderId === "string" &&
          typeof body.gif === "string" &&
          body.gif.length <= 2000000 &&
          /^data:image\/gif;base64,[A-Za-z0-9+/]+=*$/.test(body.gif),
        "GIF 완료 자료를 확인해주세요.",
      );
      await r.service.renderComplete(
        validVisit,
        body.renderId,
        Buffer.from(body.gif.split(",")[1], "base64"),
        identity?.id,
      );
      return res.status(200).json({ verified: true });
    }
    requireRule(identity, "로그인 후 이용해주세요.", 401);
    if (action === "login")
      return res
        .status(200)
        .json(
          { ...(await r.service.login(
            identity.id,
            identity.hash,
            identity.created,
            validVisit,
          )), aiAllowed: aiAccountAllowed(identity.id) },
        );
    if (action === "closeAccount") {
      requireRule(!r.previewIntegration, "통합 검수 화면에서는 로그인 계정을 삭제할 수 없어요.", 403);
      requireRule(body.confirm === "탈퇴", "탈퇴를 확인해주세요.");
      const closed = await r.service.store.tx(
        (s) => s.users[identity.id]?.deleted,
      );
      if (!closed) await r.service.closeAccount(identity.id);
      await r.deleteIdentity(identity.id);
      return res.status(200).json({ ok: true });
    }
    await r.service.store.tx((s) =>
      requireRule(
        s.users[identity.id] &&
          !s.users[identity.id].deleted &&
          !s.users[identity.id].closing,
        "계정 연결을 다시 확인해주세요.",
        401,
      ),
    );
    const user = identity.id;
    if (action === "checkoutConfig") {
      const clientKey = process.env.TOSS_CLIENT_KEY || "";
      requireRule(
        r.service.payments.kind === "toss-test"
          ? clientKey.startsWith("test_")
          : r.service.payments.kind === "live" && clientKey.startsWith("live_"),
        "테스트 결제 키를 연결해주세요.",
        503,
      );
      return res.status(200).json({ clientKey });
    }
    const requestKey = String(body.requestKey || "");
    if (["order", "generate"].includes(action))
      requireRule(
        /^[a-zA-Z0-9_-]{8,80}$/.test(requestKey),
        "요청 번호를 확인해주세요.",
      );
    if (action === "account")
      return res.status(200).json({ ...(await r.service.account(user)), aiAllowed: aiAccountAllowed(user) });
    if (action === "order") {
      requireRule(
        (body.amount === undefined || body.amount === 3900) &&
          (body.productId === undefined || body.productId === "credits10"),
        "결제 상품 또는 금액이 달라요.",
      );
      return res.status(201).json(await r.service.order(user, requestKey));
    }
    if (action === "confirm") {
      requireRule(
        typeof body.paymentKey === "string" &&
          body.paymentKey.length > 0 &&
          body.paymentKey.length <= 200 &&
          Number(body.amount) === 3900,
        "결제 금액을 확인해주세요.",
      );
      return res
        .status(200)
        .json(
          await r.service.confirm(
            user,
            String(body.orderId),
            body.paymentKey,
            Number(body.amount),
          ),
        );
    }
    if (action === "recoverOrder")
      return res
        .status(200)
        .json(await r.service.recoverOrder(user, String(body.orderId)));
    if (action === "cancel")
      return res
        .status(200)
        .json(
          await r.service.cancel(
            user,
            String(body.orderId),
            String(body.reason || ""),
          ),
        );
    if (action === "generate") {
      requirePreviewAiAccount(user);
      return res
        .status(202)
        .json(
          await r.service.createJob(
            user,
            requestKey,
            body.style as Style,
            body.images,
            body.consent,
            body.scene,
            body.personCount,
          ),
        );
    }
    if (action === "jobStatus")
      return res.status(200).json(await r.service.jobStatus(user, String(body.jobId)));
    if (action === "work")
      return res
        .status(200)
        .json(await r.service.work(user, String(body.jobId)));
    if (action === "file") {
      const id = String(req.query?.jobId || body.jobId || "");
      const file = await r.service.file(user, id);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="naezzal4zzal.mp4"',
      );
      return res.status(200).end(file);
    }
    if (action === "deleteResult") {
      await r.service.deleteResult(user, String(body.jobId));
      return res.status(200).json({ ok: true });
    }
    if (action === "admin") {
      requireRule(r.adminIds.includes(user), "운영자 권한이 필요해요.", 403);
      return res
        .status(200)
        .json(
          await r.service.admin(user, {
            action: String(body.operation),
            target: typeof body.target === "string" ? body.target : undefined,
            amount: Number(body.amount),
            reason: String(body.reason || ""),
            requestKey: String(body.requestKey || randomUUID()),
            config: body.config as Partial<Config> | undefined,
            jobId: String(body.jobId || ""),
            usageId: String(body.usageId || ""),
            actualUsd: Number(body.actualUsd),
            invoiceReference: String(body.invoiceReference || ""),
          }),
        );
    }
    throw new RuleError("요청을 확인해주세요.");
  } catch (e) {
    const known = e instanceof RuleError;
    return res
      .status(known ? e.status : 503)
      .json({
        error: known
          ? e.message
          : "연결을 확인하고 있어요. 구매·제작 내역에서 같은 요청을 다시 확인해주세요.",
      });
  }
}
