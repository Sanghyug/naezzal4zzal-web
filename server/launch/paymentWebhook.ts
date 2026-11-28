import { createHmac, timingSafeEqual } from "node:crypto";
import { requireRule, RuleError } from "./domain.ts";
import type { LaunchService } from "./service.ts";

const MAX_BODY = 64 * 1024;

export function verifyPaymentWebhook(raw: Buffer, headers: Headers, securityKey: string, now = Date.now()) {
  requireRule(/^[a-fA-F0-9]{64}$/.test(securityKey), "결제 알림 인증 설정이 필요해요.", 503);
  const timestamp = headers.get("tosspayments-webhook-transmission-time") || "";
  const time = Date.parse(timestamp);
  requireRule(Number.isFinite(time) && Math.abs(now - time) <= 5 * 60000,
    "결제 알림 시각을 확인해주세요.", 401);
  const expected = createHmac("sha256", Buffer.from(securityKey, "hex"))
    .update(raw).update(":" + timestamp).digest();
  const signatures = (headers.get("tosspayments-webhook-signature") || "").split(",");
  const valid = signatures.some((part) => {
    const match = /^v1:([A-Za-z0-9+/]{43}=)$/.exec(part.trim());
    if (!match) return false;
    const actual = Buffer.from(match[1], "base64");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
  requireRule(valid, "결제 알림 인증에 실패했어요.", 401);
}

// A Web Request preserves the exact bytes used for Toss's signature. Parsing
// and re-serializing JSON before verifying would reject legitimate webhooks.
export async function paymentWebhook(
  request: Request,
  service: () => Promise<LaunchService>,
  securityKey = process.env.TOSS_WEBHOOK_SECURITY_KEY || "",
  mode = process.env.PAYMENT_MODE || "disabled",
) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  try {
    requireRule(request.method === "POST", "POST 요청이 필요해요.", 405);
    requireRule(mode === "toss-test" || mode === "live", "결제 알림이 비활성화되어 있어요.", 503);
    requireRule((request.headers.get("content-type") || "").split(";")[0].trim() === "application/json",
      "JSON 결제 알림이 필요해요.", 415);
    requireRule(Number(request.headers.get("content-length") || 0) <= MAX_BODY, "결제 알림이 너무 커요.", 413);
    const parts: Buffer[] = [];
    let size = 0;
    const reader = request.body?.getReader();
    if (reader) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_BODY) {
            await reader.cancel();
            requireRule(false, "결제 알림이 너무 커요.", 413);
          }
          parts.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
    }
    const raw = Buffer.concat(parts);
    verifyPaymentWebhook(raw, request.headers, securityKey);
    let event: { eventType?: string; data?: { orderId?: string } };
    try { event = JSON.parse(raw.toString("utf8")); }
    catch { throw new RuleError("결제 알림 형식을 확인해주세요.", 400); }
    requireRule(event && typeof event === "object", "결제 알림 형식을 확인해주세요.");
    // This integration registers only PAYMENT_STATUS_CHANGED. Other products'
    // events are acknowledged without querying or changing the credit ledger.
    if (event.eventType !== "PAYMENT_STATUS_CHANGED")
      return Response.json({ received: true }, { headers });
    const id = event.data?.orderId;
    requireRule(typeof id === "string" && id.length > 0 && id.length <= 64,
      "주문번호를 확인해주세요.");
    const app = await service();
    requireRule(app.payments.kind === mode, "결제 환경이 일치하지 않아요.", 503);
    const order = await app.store.tx((s) => s.orders[id] ? structuredClone(s.orders[id]) : null);
    // A webhook must never bind a payment key supplied by its sender. Only an
    // authenticated checkout confirmation can attach the stored key.
    if (order?.paymentKey) await app.recoverOrder(order.user, order.id);
    return Response.json({ received: true }, { headers });
  } catch (e) {
    const known = e instanceof RuleError;
    return Response.json({ error: known ? e.message : "결제 알림을 다시 확인할게요." },
      { status: known ? e.status : 503, headers });
  }
}
