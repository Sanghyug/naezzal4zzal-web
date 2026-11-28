import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PAID_CREDIT_POLICY_VERSION, paidCreditExpiry } from "../src/lib/creditPolicy.ts";
import { initialState, signup, grant, newOrder, beginPayment, paid, balance, reserveJob, settle, beginCancel, cancelled } from "../server/launch/domain.ts";
import { sqliteStore, assertState } from "../server/launch/store.ts";
import { LaunchService } from "../server/launch/service.ts";

const start = Date.parse("2026-11-28T12:00:00+09:00");
function fixture(at = start) {
  const s = initialState();
  Object.assign(s.config, { gifts: false, payments: true, generation: true });
  signup(s, "owner", "identity", at, undefined, at);
  const o = newOrder(s, "owner", "buy", at);
  beginPayment(s, "owner", o.id, "pk", 3900);
  const p = { orderId: o.id, paymentKey: "pk", totalAmount: 3900, currency: "KRW", status: "DONE", approvedAt: new Date(at).toISOString() };
  return { s, o, p };
}

test("paid validity is twelve Korean calendar months, including leap-day and UTC date boundaries", () => {
  for (const [from, to] of [
    ["2026-11-28T12:00:00+09:00", "2027-11-28T12:00:00+09:00"],
    ["2027-03-01T00:30:00+09:00", "2028-03-01T00:30:00+09:00"],
    ["2028-02-29T23:59:59+09:00", "2029-02-28T23:59:59+09:00"],
    ["2028-02-29T00:30:00+09:00", "2029-02-28T00:30:00+09:00"],
  ]) assert.equal(paidCreditExpiry(Date.parse(from)), Date.parse(to));
});

test("new purchases retain provider approval time and deadline across delayed reconciliation and retries", () => {
  const { s, o, p } = fixture();
  assert.equal(o.creditPolicyVersion, PAID_CREDIT_POLICY_VERSION);
  paid(s, o.id, p, start + 30 * 86400000);
  assert.equal(o.paidAt, start);
  assert.equal(o.creditExpiresAt, Date.parse("2027-11-28T12:00:00+09:00"));
  const before = structuredClone(s);
  paid(s, o.id, { ...p, approvedAt: new Date(start + 86400000).toISOString() }, start + 31 * 86400000);
  assert.deepEqual(s, before);
  assert.equal(s.lots["paid:" + o.id].expiresAt, o.creditExpiresAt);
});

test("invalid or missing approval timestamp cannot grant new dated credits", () => {
  for (const value of [undefined, "invalid", "2026-11-28T03:00:00", new Date(start + 3600000).toISOString(), new Date(start - 3600000).toISOString()]) {
    const { s, o, p } = fixture();
    assert.throws(() => paid(s, o.id, { ...p, approvedAt: value }, start), { status: 502 });
    assert.equal(balance(s, "owner", start).total, 0);
    assert.equal(o.creditExpiresAt, undefined);
  }
});

test("legacy purchases, in-flight legacy orders and free grants receive no retroactive expiration", () => {
  const { s, o, p } = fixture();
  delete o.creditPolicyVersion;
  delete p.approvedAt;
  grant(s, "owner", "paid", 10, "older-order", start, "purchase");
  grant(s, "owner", "free", 4, "signup", start, "signup_gift");
  const legacyLots = structuredClone(s.lots);
  paid(s, o.id, p, start + 86400000);
  assert.equal(o.creditExpiresAt, undefined);
  for (const [id, lot] of Object.entries(legacyLots)) assert.deepEqual(s.lots[id], lot);
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(balance(restored, "owner", Date.parse("2040-01-01T00:00:00Z")).available, 24);
  assertState(restored);
});

test("expiry prevents new reservations at the exact deadline without consuming the refund balance", () => {
  const { s, o, p } = fixture();
  paid(s, o.id, p, start);
  const end = o.creditExpiresAt;
  assert.equal(balance(s, "owner", end - 1).available, 10);
  const snapshot = structuredClone(s);
  assert.deepEqual(balance(s, "owner", end), { total: 10, available: 0, reserved: 0, expired: 10, paid: 10 });
  assert.throws(() => reserveJob(s, "owner", "late", "fp", "memory", end), { status: 409 });
  assert.deepEqual(s, snapshot);
  assert.equal(Object.keys(s.jobs).length, 0);
});

test("jobs reserved before expiry can settle once afterward and failures preserve expired refund balances", () => {
  for (const success of [true, false]) {
    const { s, o, p } = fixture(); paid(s, o.id, p, start);
    const end = o.creditExpiresAt;
    const j = reserveJob(s, "owner", "before", "fp", "drawing", end - 1);
    assert.deepEqual(balance(s, "owner", end), { total: 10, available: 0, reserved: 3, expired: 7, paid: 10 });
    assert.equal(reserveJob(s, "owner", "before", "fp", "drawing", end + 1).id, j.id);
    settle(s, j.id, success, end + 1000);
    const snapshot = structuredClone(s);
    settle(s, j.id, success, end + 2000);
    assert.deepEqual(s, snapshot);
    assert.equal(balance(s, "owner", end + 2000).expired, success ? 7 : 10);
    assert.equal(balance(s, "owner", end + 2000).available, 0);
    assertState(s);
  }
});

test("expired credits do not block usable free credits and the earliest paid deadline is spent first", () => {
  const { s, o, p } = fixture(); paid(s, o.id, p, start);
  grant(s, "owner", "paid", 2, "legacy", start - 1000, "purchase");
  grant(s, "owner", "free", 1, "gift", start, "admin_adjustment");
  const before = reserveJob(s, "owner", "first", "fp", "drawing", start);
  assert.deepEqual(before.allocations, [{ lot: "free:gift", count: 1 }, { lot: "paid:" + o.id, count: 2 }]);
  settle(s, before.id, true, start);
  const end = o.creditExpiresAt;
  const after = reserveJob(s, "owner", "after", "fp2", "memory", end);
  assert.deepEqual(after.allocations, [{ lot: "paid:legacy", count: 1 }]);
  assert.equal(balance(s, "owner", end).expired, 8);
});

test("new purchases do not renew earlier purchases and grant ten more credits independently", () => {
  const { s, o, p } = fixture(); paid(s, o.id, p, start);
  const first = structuredClone(s.lots["paid:" + o.id]);
  const later = start + 90 * 86400000;
  const o2 = newOrder(s, "owner", "again", later);
  beginPayment(s, "owner", o2.id, "pk2", 3900);
  paid(s, o2.id, { ...p, orderId: o2.id, paymentKey: "pk2", approvedAt: new Date(later).toISOString() }, later);
  assert.deepEqual(s.lots["paid:" + o.id], first);
  assert.equal(balance(s, "owner", o.creditExpiresAt).available, 10);
  assert.equal(balance(s, "owner", o.creditExpiresAt).expired, 10);
});

test("expiry survives storage restart, blocks account deletion and keeps unused purchase cancellation available", async () => {
  const at = Date.parse("2020-01-01T00:00:00Z");
  const { s, o, p } = fixture(at); paid(s, o.id, p, at);
  const dir = await mkdtemp(path.join(tmpdir(), "4zzal-expiry-"));
  const file = path.join(dir, "state.sqlite");
  const a = await sqliteStore(file);
  await a.tx(state => Object.assign(state, s));
  const b = await sqliteStore(file);
  const service = new LaunchService(b, {}, {}, {});
  const view = await service.account("owner");
  assert.equal(view.balance.available, 0);
  assert.equal(view.balance.expired, 10);
  assert.equal(view.orders[0].expiredCredits, 10);
  assert.equal(view.orders[0].remainingCredits, 10);
  assert.equal(view.orders[0].creditExpiresAt, o.creditExpiresAt);
  assert.equal("paymentKey" in view.orders[0], false);
  await assert.rejects(() => service.closeAccount("owner"), { status: 409 });
  await b.tx(state => beginCancel(state, "owner", o.id, "기간 종료 환불"));
  await b.tx(state => cancelled(state, o.id, Date.now()));
  await b.tx(state => cancelled(state, o.id, Date.now()));
  assert.equal((await service.account("owner")).balance.paid, 0);
  assert.equal((await a.tx(state => state.entries.filter(e => e.kind === "purchase_cancel"))).length, 1);
});

test("concurrent reservations across expiry cannot spend expired or already-reserved credits", async () => {
  const { s, o, p } = fixture(); paid(s, o.id, p, start);
  s.lots["paid:" + o.id].remaining = 1;
  const dir = await mkdtemp(path.join(tmpdir(), "4zzal-expiry-race-"));
  const file = path.join(dir, "state.sqlite");
  const a = await sqliteStore(file), b = await sqliteStore(file);
  await a.tx(state => Object.assign(state, s));
  const results = await Promise.allSettled([
    a.tx(state => reserveJob(state, "owner", "before", "fp", "memory", o.creditExpiresAt - 1)),
    b.tx(state => reserveJob(state, "owner", "after", "fp2", "memory", o.creditExpiresAt)),
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  const state = await b.tx(state => state);
  assert.equal(Object.keys(state.jobs).length, 1);
  assert.equal(state.lots["paid:" + o.id].reserved, 1);
  assert.equal(balance(state, "owner", o.creditExpiresAt).available, 0);
});
