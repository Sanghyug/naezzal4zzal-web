import { requireRule } from "./domain.ts";
import type { Order, PaymentRecord } from "./domain.ts";
import type { Store } from "./store.ts";
export interface Payments {
  kind: "mock" | "toss-test" | "live";
  lookup(o: Order): Promise<PaymentRecord | null>;
  confirm(o: Order): Promise<PaymentRecord>;
  cancel(o: Order): Promise<PaymentRecord>;
}
export function mockPayments(store: Store): Payments {
  return {
    kind: "mock",
    lookup: (o) => store.tx((s) => s.mockPayments[o.id] || null),
    confirm: (o) =>
      store.tx((s) => {
        const p = s.mockPayments[o.id] || {
          orderId: o.id,
          paymentKey: o.paymentKey!,
          totalAmount: 3900,
          currency: "KRW",
          status: "DONE",
        };
        s.mockPayments[o.id] = p;
        return p;
      }),
    cancel: (o) =>
      store.tx((s) => {
        const p = s.mockPayments[o.id];
        requireRule(p, "모의 결제 기록이 없어요.");
        p.status = "CANCELED";
        return p;
      }),
  };
}
export function tossPayments(
  secret: string,
  mode: "toss-test" | "live",
): Payments {
  requireRule(
    mode === "toss-test"
      ? secret.startsWith("test_")
      : secret.startsWith("live_"),
    "결제 키 환경이 일치하지 않아요.",
    503,
  );
  async function api(path: string, body?: unknown, id?: string) {
    const r = await fetch("https://api.tosspayments.com/v1/payments" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Basic " + Buffer.from(secret + ":").toString("base64"),
        "Content-Type": "application/json",
        ...(id ? { "Idempotency-Key": id } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (r.status === 404) return null;
    requireRule(
      r.ok,
      "결제 상태 확인이 지연되고 있어요. 다시 결제하지 말고 구매 내역에서 확인해주세요.",
      502,
    );
    return (await r.json()) as PaymentRecord;
  }
  return {
    kind: mode,
    lookup: (o) => api("/orders/" + encodeURIComponent(o.id)),
    async confirm(o) {
      const p = await api(
        "/confirm",
        { paymentKey: o.paymentKey, orderId: o.id, amount: o.amount },
        "confirm-" + o.id,
      );
      requireRule(p, "승인 결과를 확인할게요.", 502);
      return p;
    },
    async cancel(o) {
      requireRule(o.paymentKey, "결제 정보가 없어요.");
      const p = await api(
        "/" + encodeURIComponent(o.paymentKey) + "/cancel",
        { cancelReason: o.reason || "고객 미사용 구매 취소" },
        "cancel-" + o.id,
      );
      requireRule(p, "취소 결과를 확인할게요.", 502);
      return p;
    },
  };
}
