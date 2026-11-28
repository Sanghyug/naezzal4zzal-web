import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { initialState, signup, newOrder, beginPayment, paid, reconcilePayment, balance, reserveJob, settle } from "../server/launch/domain.ts";
import { LaunchService } from "../server/launch/service.ts";
import { tossPayments } from "../server/launch/payments.ts";
import { paymentWebhook, verifyPaymentWebhook } from "../server/launch/paymentWebhook.ts";
import { paymentTestNamespace } from "../server/launch/paymentEnvironment.ts";

const securityKey = "ab".repeat(32); // Synthetic key; never a provider credential.
function fixture() {
  const s = initialState();
  s.config.gifts = false;
  s.config.payments = true;
  s.config.generation = true;
  signup(s, "owner", "identity-owner", Date.now(), undefined, Date.now());
  const order = newOrder(s, "owner", "request", Date.now());
  beginPayment(s, "owner", order.id, "test-payment", 3900);
  const record = { orderId: order.id, paymentKey: "test-payment", totalAmount: 3900, currency: "KRW", status: "DONE", approvedAt: new Date().toISOString() };
  const store = { async tx(fn) { const copy = structuredClone(s); const out = fn(copy); Object.assign(s, copy); return structuredClone(out); } };
  const pg = { kind: "toss-test", async lookup() { return structuredClone(record); }, async confirm() { return structuredClone(record); }, async cancel() { record.status = "CANCELED"; return structuredClone(record); } };
  return { s, order, record, pg, service: new LaunchService(store, {}, pg, {}) };
}
function signedRequest(body, timestamp = new Date().toISOString()) {
  const signature = createHmac("sha256", Buffer.from(securityKey, "hex")).update(body + ":" + timestamp).digest("base64");
  return new Request("https://example.test/api/payments-webhook", { method: "POST", body,
    headers: { "content-type": "application/json", "tosspayments-webhook-transmission-time": timestamp,
      "tosspayments-webhook-signature": "v1:" + signature } });
}

test("payment tests require an isolated namespace and cannot use production or paid AI", () => {
  const env = { PAYMENT_MODE: "toss-test", LAUNCH_ENV: "test", VERCEL_ENV: "preview", PAYMENT_TEST_DB_NAMESPACE: "test-payments-launch" };
  assert.equal(paymentTestNamespace(env), "test-payments-launch");
  assert.equal(paymentTestNamespace({ PAYMENT_MODE: "disabled" }), undefined);
  for (const patch of [{ PAYMENT_TEST_DB_NAMESPACE: "test" }, { PAYMENT_TEST_DB_NAMESPACE: "" },
    { VERCEL_ENV: "production" }, { LAUNCH_ENV: "production" }, { LAUNCH_OFFICIAL_DOMAIN: "4zzal.com" },
    { PREVIEW_AI_DB_NAMESPACE: "test-ai" }, { ENABLE_LIVE_GENERATION: "1" },
    { ENABLE_LIVE_EXTRACTION: "1" }, { ENABLE_PREVIEW_LIVE_GENERATION: "1" }])
    assert.throws(() => paymentTestNamespace({ ...env, ...patch }), { status: 503 });
});
test("an account unable to create AI videos cannot buy live credits", async () => {
  const f = fixture(); f.pg.kind = "live";
  const service = new LaunchService(f.service.store, {}, f.pg, {}, false, () => false);
  await assert.rejects(() => service.order("owner", "new"), { status: 403 });
  assert.equal(Object.keys(f.s.orders).length, 1);
});
test("pending and expired provider states reconcile without credit or endless confirming", async () => {
  for (const status of ["READY", "IN_PROGRESS", "WAITING_FOR_DEPOSIT", "ABORTED", "EXPIRED"]) {
    const f = fixture(); f.record.status = status;
    await f.service.recoverOrder("owner", f.order.id);
    assert.equal(balance(f.s, "owner").paid, 0);
    assert.equal(f.s.orders[f.order.id].status, ["ABORTED", "EXPIRED"].includes(status) ? "failed" : "confirming");
  }
});
test("reconciliation validates amount, currency, order and key even for expired payments", () => {
  const f = fixture();
  for (const patch of [{ totalAmount: 1 }, { currency: "USD" }, { orderId: "other" }, { paymentKey: "other" }])
    assert.throws(() => reconcilePayment(f.s, f.order.id, { ...f.record, status: "EXPIRED", ...patch }, Date.now()));
  assert.equal(f.s.orders[f.order.id].status, "confirming");
});
test("stale pending or failure notifications never undo a paid purchase", () => {
  const f = fixture(); paid(f.s, f.order.id, f.record, Date.now());
  for (const status of ["READY", "EXPIRED", "ABORTED"])
    reconcilePayment(f.s, f.order.id, { ...f.record, status }, Date.now());
  assert.equal(f.s.orders[f.order.id].status, "paid");
  assert.equal(balance(f.s, "owner").paid, 10);
});
test("provider-side partial cancellation freezes remaining credits for review exactly once", () => {
  const f = fixture(); paid(f.s, f.order.id, f.record, Date.now());
  for (let i = 0; i < 2; i++) reconcilePayment(f.s, f.order.id, { ...f.record, status: "PARTIAL_CANCELED" }, Date.now());
  assert.equal(balance(f.s, "owner").available, 0);
  assert.equal(f.s.lots["paid:" + f.order.id].remaining, 10);
  assert.equal(f.s.orders[f.order.id].status, "review");
  assert.equal(f.s.entries.filter(e => e.kind === "payment_review").length, 1);
  assert.throws(() => beginPayment(f.s, "owner", f.order.id, f.record.paymentKey, 3900));
});
test("repeated cancellation recovery remains cancelled with one debit and no review freeze", async () => {
  const f = fixture(); paid(f.s, f.order.id, f.record, Date.now());
  f.record.status = "CANCELED";
  await f.service.recoverOrder("owner", f.order.id);
  await f.service.recoverOrder("owner", f.order.id);
  reconcilePayment(f.s, f.order.id, { ...f.record, status: "PARTIAL_CANCELED" }, Date.now());
  assert.equal(f.s.orders[f.order.id].status, "cancelled");
  assert.equal(f.s.lots["paid:" + f.order.id].frozen, false);
  assert.equal(f.s.entries.filter(e => e.kind === "purchase_cancel").length, 1);
  assert.equal(f.s.entries.filter(e => e.kind === "payment_review").length, 0);
});
test("provider-side full cancellation after usage preserves history and freezes the remainder", () => {
  const f = fixture(); paid(f.s, f.order.id, f.record, Date.now());
  const job = reserveJob(f.s, "owner", "video", "fingerprint", "memory", Date.now());
  settle(f.s, job.id, true, Date.now());
  reconcilePayment(f.s, f.order.id, { ...f.record, status: "CANCELED" }, Date.now());
  assert.equal(f.s.lots["paid:" + f.order.id].remaining, 9);
  assert.equal(balance(f.s, "owner").available, 0);
  assert.equal(f.s.orders[f.order.id].status, "review");
});
test("cancellation recovery rejects a different currency before another cancel call", async () => {
  const f = fixture(); paid(f.s, f.order.id, f.record, Date.now());
  f.s.orders[f.order.id].status = "cancelling"; f.record.currency = "USD";
  let cancels = 0; f.pg.cancel = async () => { cancels++; return f.record; };
  await assert.rejects(() => f.service.recoverOrder("owner", f.order.id));
  assert.equal(cancels, 0);
});
test("webhook verifies exact raw bytes, rotated signatures and freshness", async () => {
  const raw = '{ "eventType": "PAYMENT_STATUS_CHANGED", "data": {"orderId": "one"} }';
  const req = signedRequest(raw);
  req.headers.set("tosspayments-webhook-signature", "v2:future,v1:" + Buffer.alloc(32).toString("base64") + ", " + req.headers.get("tosspayments-webhook-signature"));
  assert.doesNotThrow(() => verifyPaymentWebhook(Buffer.from(raw), req.headers, securityKey));
  assert.throws(() => verifyPaymentWebhook(Buffer.from(JSON.stringify(JSON.parse(raw))), req.headers, securityKey), { status: 401 });
  for (const delta of [-301000, 301000]) {
    const stale = signedRequest(raw, new Date(Date.now() + delta).toISOString());
    assert.throws(() => verifyPaymentWebhook(Buffer.from(raw), stale.headers, securityKey), { status: 401 });
  }
});
test("invalid signatures never initialize the database or call the provider", async () => {
  let calls = 0;
  const req = signedRequest('{}'); req.headers.delete("tosspayments-webhook-signature");
  const response = await paymentWebhook(req, async () => { calls++; }, securityKey, "toss-test");
  assert.equal(response.status, 401); assert.equal(calls, 0);
  assert.equal((await paymentWebhook(signedRequest('{}'), async () => { calls++; }, "", "toss-test")).status, 503);
  assert.equal(calls, 0);
});
test("signed duplicate webhooks re-query PG and grant only once, ignoring event amount and status", async () => {
  const f = fixture();
  const raw = JSON.stringify({ eventType: "PAYMENT_STATUS_CHANGED", data: { orderId: f.order.id, paymentKey: "fake", totalAmount: 1, status: "CANCELED" } });
  for (let i = 0; i < 3; i++) assert.equal((await paymentWebhook(signedRequest(raw), async () => f.service, securityKey, "toss-test")).status, 200);
  assert.equal(balance(f.s, "owner").paid, 10);
  assert.equal(f.s.entries.filter(e => e.kind === "purchase").length, 1);
});
test("webhooks without stored checkout keys never bind or credit an order", async () => {
  const f = fixture(); delete f.s.orders[f.order.id].paymentKey;
  f.pg.lookup = async () => { throw Error("must not call provider"); };
  const raw = JSON.stringify({ eventType: "PAYMENT_STATUS_CHANGED", data: { orderId: f.order.id, paymentKey: "new-key" } });
  assert.equal((await paymentWebhook(signedRequest(raw), async () => f.service, securityKey, "toss-test")).status, 200);
  assert.equal(f.s.orders[f.order.id].paymentKey, undefined);
  assert.equal(balance(f.s, "owner").paid, 0);
});
test("provider outage returns a retryable webhook failure", async () => {
  const f = fixture(); f.pg.lookup = async () => { throw Error("timeout"); };
  const raw = JSON.stringify({ eventType: "PAYMENT_STATUS_CHANGED", data: { orderId: f.order.id } });
  assert.equal((await paymentWebhook(signedRequest(raw), async () => f.service, securityKey, "toss-test")).status, 503);
  assert.equal(balance(f.s, "owner").paid, 0);
});
test("webhook rejects large bodies and signed malformed JSON, and is disabled without payment mode", async () => {
  const loader = async () => { throw Error("must not initialize"); };
  assert.equal((await paymentWebhook(signedRequest(" ".repeat(65537)), loader, securityKey, "toss-test")).status, 413);
  assert.equal((await paymentWebhook(signedRequest("not-json"), loader, securityKey, "toss-test")).status, 400);
  assert.equal((await paymentWebhook(signedRequest("{}"), loader, securityKey, "disabled")).status, 503);
});
test("Toss confirmation and cancellation retries use stable keys and server-owned amounts", async () => {
  const oldFetch = globalThis.fetch, calls = [];
  const f = fixture();
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return Response.json(f.record); };
  try {
    const pg = tossPayments("test_synthetic_secret", "toss-test");
    await pg.confirm(f.order); await pg.confirm(f.order);
    await pg.cancel(f.order); await pg.cancel(f.order);
    assert.equal(calls[0].headers["Idempotency-Key"], calls[1].headers["Idempotency-Key"]);
    assert.equal(calls[2].headers["Idempotency-Key"], calls[3].headers["Idempotency-Key"]);
    assert.notEqual(calls[0].headers["Idempotency-Key"], calls[2].headers["Idempotency-Key"]);
    assert.equal(JSON.parse(calls[0].body).amount, 3900);
  } finally { globalThis.fetch = oldFetch; }
});
