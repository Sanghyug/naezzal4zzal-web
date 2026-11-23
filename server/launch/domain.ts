import { randomBytes, randomUUID } from "node:crypto";
export const PRODUCT = {
  id: "credits10",
  credits: 10,
  amount: 3900,
  currency: "KRW",
} as const;
export const STYLES = {
  memory: { credits: 1, reserveUsd: 0.16 },
  drawing: { credits: 3, reserveUsd: 0.22 },
} as const;
export type Style = keyof typeof STYLES;
export type Config = {
  gifts: boolean;
  invites: boolean;
  payments: boolean;
  generation: boolean;
  giftLimit: number;
  inviteMonthly: number;
  dailyJobs: number;
  dailyUsd: number;
  retentionDays: number;
};
export const defaults: Config = {
  gifts: true,
  invites: true,
  payments: false,
  generation: false,
  giftLimit: 100,
  inviteMonthly: 5,
  dailyJobs: 100,
  dailyUsd: 15,
  retentionDays: 7,
};
export type User = {
  id: string;
  identity: string;
  created: number;
  inviteCode: string;
  inviteExpires: number;
  inviter?: string;
  rewardPaid?: boolean;
  hasGif?: boolean;
  deleted?: boolean;
  closing?: boolean;
  authDeletionPending?: boolean;
  identityUntil?: number;
};
export type Lot = {
  id: string;
  user: string;
  kind: "free" | "paid";
  cause: string;
  remaining: number;
  reserved: number;
  frozen: boolean;
  created: number;
};
export type Entry = {
  id: string;
  user: string;
  kind: string;
  amount: number;
  cause: string;
  at: number;
  note?: string;
};
export type Order = {
  id: string;
  user: string;
  requestKey: string;
  amount: number;
  credits: number;
  currency: string;
  status:
    | "pending"
    | "confirming"
    | "paid"
    | "cancelling"
    | "cancelled"
    | "failed";
  paymentKey?: string;
  created: number;
  reason?: string;
};
export type Job = {
  id: string;
  user: string;
  requestKey: string;
  fingerprint: string;
  style: Style;
  cost: number;
  allocations: { lot: string; count: number }[];
  status:
    | "reserved"
    | "analyzing"
    | "submitting"
    | "processing"
    | "storing"
    | "completed"
    | "failed"
    | "review";
  created: number;
  day: string;
  reserveUsd: number;
  lease?: string;
  leaseUntil?: number;
  submittedAt?: number;
  providerId?: string;
  output?: string;
  expires?: number;
  error?: string;
  analysisKey?: string;
  billingSettled?: boolean;
};
export type Visit = {
  id: string;
  inviter?: string;
  user?: string;
  expires: number;
  gif?: string;
  render?: string;
};
export type Render = {
  id: string;
  visit: string;
  expires: number;
  used: boolean;
  hash?: string;
};
export type PaymentRecord = {
  orderId: string;
  paymentKey: string;
  totalAmount: number;
  currency: string;
  status: string;
};
export type State = {
  config: Config;
  users: Record<string, User>;
  lots: Record<string, Lot>;
  entries: Entry[];
  orders: Record<string, Order>;
  jobs: Record<string, Job>;
  visits: Record<string, Visit>;
  renders: Record<string, Render>;
  rewarded: Record<string, string>;
  rates: Record<string, { count: number; until: number }>;
  cache: Record<
    string,
    { key: string; at: number; pending?: boolean; owner?: string }
  >;
  deletedIdentities: string[];
  mockPayments: Record<string, PaymentRecord>;
  version: number;
};
export const initialState = (): State => ({
  config: { ...defaults },
  users: {},
  lots: {},
  entries: [],
  orders: {},
  jobs: {},
  visits: {},
  renders: {},
  rewarded: {},
  rates: {},
  cache: {},
  deletedIdentities: [],
  mockPayments: {},
  version: 1,
});
export class RuleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function requireRule(
  ok: unknown,
  message: string,
  status = 400,
): asserts ok {
  if (!ok) throw new RuleError(message, status);
}
export function monthKst(at: number) {
  return new Date(at + 9 * 3600000).toISOString().slice(0, 7);
}
export function dayKst(at: number) {
  return new Date(at + 9 * 3600000).toISOString().slice(0, 10);
}
export function entry(
  s: State,
  user: string,
  kind: string,
  amount: number,
  cause: string,
  at: number,
  note?: string,
) {
  if (
    s.entries.some(
      (e) => e.user === user && e.kind === kind && e.cause === cause,
    )
  )
    return;
  s.entries.push({
    id: randomUUID(),
    user,
    kind,
    amount,
    cause,
    at,
    ...(note ? { note } : {}),
  });
}
export function grant(
  s: State,
  user: string,
  kind: "free" | "paid",
  amount: number,
  cause: string,
  at: number,
  type: string,
) {
  requireRule(
    Number.isSafeInteger(amount) && amount > 0,
    "크레딧 수량을 확인해주세요.",
  );
  const id = kind + ":" + cause;
  if (s.lots[id]) {
    requireRule(
      s.lots[id].user === user &&
        s.entries.some(
          (e) =>
            e.user === user &&
            e.cause === cause &&
            e.kind === type &&
            e.amount === amount,
        ),
      "같은 지급 요청의 내용이 달라요.",
      409,
    );
    return;
  }
  s.lots[id] = {
    id,
    user,
    kind,
    cause,
    remaining: amount,
    reserved: 0,
    frozen: false,
    created: at,
  };
  entry(s, user, type, amount, cause, at);
}
export function balance(s: State, user: string) {
  const lots = Object.values(s.lots).filter((l) => l.user === user);
  return {
    total: lots.reduce((n, l) => n + l.remaining, 0),
    available: lots.reduce(
      (n, l) => n + (l.frozen ? 0 : l.remaining - l.reserved),
      0,
    ),
    reserved: lots.reduce((n, l) => n + l.reserved, 0),
    paid: lots
      .filter((l) => l.kind === "paid")
      .reduce((n, l) => n + l.remaining, 0),
  };
}
export function rate(
  s: State,
  key: string,
  max: number,
  window: number,
  at: number,
) {
  const r = s.rates[key];
  if (!r || r.until <= at) s.rates[key] = { count: 1, until: at + window };
  else {
    requireRule(
      r.count < max,
      "요청이 많아요. 잠시 후 다시 시도해주세요.",
      429,
    );
    r.count++;
  }
  // Bound expired anonymous rate records without logging IPs or photos.
  if (Object.keys(s.rates).length > 1000)
    for (const [k, v] of Object.entries(s.rates))
      if (v.until < at) delete s.rates[k];
}
export function signup(
  s: State,
  id: string,
  identity: string,
  providerCreated: number,
  visitId: string | undefined,
  at: number,
) {
  let u = s.users[id];
  if (u) {
    requireRule(
      !u.deleted && !u.closing,
      "탈퇴 처리 중이거나 탈퇴한 계정이에요.",
      403,
    );
    reward(s, id, at);
    return u;
  }
  const prior = Object.values(s.users).some(
    (x) =>
      x.identity === identity &&
      (!x.deleted || Boolean(x.identityUntil && x.identityUntil > at)),
  );
  u = {
    id,
    identity,
    created: at,
    inviteCode: randomBytes(24).toString("base64url"),
    inviteExpires: at + 30 * 86400000,
  };
  s.users[id] = u;
  // Existing provider accounts cannot turn into a new invitee by opening a link later.
  const v = visitId ? s.visits[visitId] : undefined;
  if (
    v &&
    v.expires > at &&
    !v.user &&
    v.inviter !== id &&
    !prior &&
    providerCreated >= at - 24 * 3600000
  ) {
    u.inviter = v.inviter;
    v.user = id;
    if (v.gif) u.hasGif = true;
  }
  const gifts = s.entries.filter((e) => e.kind === "signup_gift").length;
  if (!prior && s.config.gifts && gifts < s.config.giftLimit)
    grant(s, id, "free", 5, "signup:" + id, at, "signup_gift");
  reward(s, id, at);
  return u;
}
export function reward(s: State, user: string, at: number) {
  const u = s.users[user];
  if (
    !u ||
    u.rewardPaid ||
    !u.hasGif ||
    !u.inviter ||
    u.inviter === user ||
    !s.config.invites
  )
    return;
  const inviter = s.users[u.inviter];
  if (!inviter || inviter.deleted) return;
  const count = s.entries.filter(
    (e) =>
      e.user === u.inviter &&
      e.kind === "invite_reward" &&
      monthKst(e.at) === monthKst(at),
  ).length;
  if (count >= s.config.inviteMonthly) return;
  grant(s, u.inviter, "free", 2, "invite:" + user, at, "invite_reward");
  u.rewardPaid = true;
  s.rewarded[user] = u.inviter;
}
export function createVisit(s: State, code: string | undefined, at: number) {
  const inviter = code
    ? Object.values(s.users).find(
        (u) => u.inviteCode === code && u.inviteExpires > at && !u.deleted,
      )
    : undefined;
  if (inviter) {
    const count = s.entries.filter(
      (e) =>
        e.user === inviter.id &&
        e.kind === "invite_reward" &&
        monthKst(e.at) === monthKst(at),
    ).length;
    requireRule(
      s.config.invites && count < s.config.inviteMonthly,
      "이 초대는 현재 보상 한도에 도달했어요. GIF는 자유롭게 만들 수 있어요.",
    );
  }
  const v: Visit = {
    id: randomBytes(32).toString("base64url"),
    expires: at + 30 * 86400000,
    ...(inviter ? { inviter: inviter.id } : {}),
  };
  s.visits[v.id] = v;
  return v;
}
export function startRender(s: State, visitId: string, at: number) {
  const v = s.visits[visitId];
  requireRule(v && v.expires > at, "초대 방문 정보를 다시 확인해주세요.");
  rate(s, "render:" + visitId, 10, 3600000, at);
  const r: Render = {
    id: randomBytes(24).toString("base64url"),
    visit: visitId,
    expires: at + 30 * 60000,
    used: false,
  };
  s.renders[r.id] = r;
  v.render = r.id;
  return r;
}
export function completeRender(
  s: State,
  visitId: string,
  renderId: string,
  hash: string,
  user: string | undefined,
  at: number,
) {
  const v = s.visits[visitId],
    r = s.renders[renderId];
  requireRule(
    v && v.expires > at && r && r.visit === visitId && r.expires > at,
    "GIF 완료 확인 시간이 지났어요.",
  );
  requireRule(
    !user || !v.user || v.user === user,
    "다른 계정에 연결된 GIF 완료 확인이에요.",
    403,
  );
  if (user && !v.user) v.user = user;
  if (r.used) {
    requireRule(r.hash === hash, "이미 사용한 완료 확인이에요.");
    return;
  }
  // A byte-identical uploaded GIF cannot reward several accounts.
  requireRule(
    !Object.values(s.renders).some(
      (x) => x.used && x.hash === hash && x.visit !== visitId,
    ),
    "이미 확인한 GIF예요. 새 GIF를 만들어주세요.",
  );
  r.used = true;
  r.hash = hash;
  v.gif = hash;
  const account = user || v.user;
  if (account) {
    const u = s.users[account];
    if (u) {
      u.hasGif = true;
      reward(s, account, at);
    }
  }
}
export function newOrder(s: State, user: string, key: string, at: number) {
  requireRule(
    s.users[user] && !s.users[user].deleted && !s.users[user].closing,
    "계정을 확인해주세요.",
    403,
  );
  requireRule(s.config.payments, "충전을 잠시 준비하고 있어요.", 503);
  const existing = Object.values(s.orders).find(
    (o) => o.user === user && o.requestKey === key,
  );
  if (existing) return existing;
  rate(s, "orders:" + user, 10, 3600000, at);
  const o: Order = {
    id: "nz_" + randomUUID(),
    user,
    requestKey: key,
    amount: PRODUCT.amount,
    credits: PRODUCT.credits,
    currency: PRODUCT.currency,
    status: "pending",
    created: at,
  };
  s.orders[o.id] = o;
  return o;
}
export function ownOrder(s: State, user: string, id: string) {
  const o = s.orders[id];
  requireRule(o && o.user === user, "구매 내역을 찾지 못했어요.", 404);
  return o;
}
export function beginPayment(
  s: State,
  user: string,
  id: string,
  paymentKey: string,
  amount: number,
) {
  const o = ownOrder(s, user, id);
  requireRule(
    amount === o.amount &&
      o.amount === 3900 &&
      o.credits === 10 &&
      o.currency === "KRW",
    "결제 상품 또는 금액이 달라요.",
  );
  requireRule(
    !o.paymentKey || o.paymentKey === paymentKey,
    "다른 결제 정보예요.",
  );
  requireRule(
    !Object.values(s.orders).some(
      (x) => x.id !== id && x.paymentKey === paymentKey,
    ),
    "이미 연결된 결제예요.",
  );
  requireRule(
    !["cancelled", "cancelling", "failed"].includes(o.status),
    "진행할 수 없는 결제예요.",
  );
  o.paymentKey = paymentKey;
  if (o.status !== "paid") o.status = "confirming";
  return o;
}
export function paid(
  s: State,
  id: string,
  payment: {
    orderId: string;
    paymentKey: string;
    totalAmount: number;
    currency: string;
    status: string;
  },
  at: number,
) {
  const o = s.orders[id];
  requireRule(
    o &&
      payment.orderId === o.id &&
      payment.paymentKey === o.paymentKey &&
      payment.totalAmount === o.amount &&
      payment.currency === o.currency,
    "결제 검증에 실패했어요.",
  );
  if (payment.status === "CANCELED") {
    cancelled(s, id, at);
    return;
  }
  requireRule(payment.status === "DONE", "승인된 결제가 아니에요.");
  if (o.status === "cancelling" || o.status === "cancelled") return;
  grant(s, o.user, "paid", 10, o.id, at, "purchase");
  o.status = "paid";
}
export function beginCancel(
  s: State,
  user: string,
  id: string,
  reason: string,
) {
  const o = ownOrder(s, user, id);
  requireRule(reason.trim().length >= 2, "취소 사유를 적어주세요.");
  if (o.status === "cancelled" || o.status === "cancelling") return o;
  requireRule(o.status === "paid", "승인 완료된 구매만 취소할 수 있어요.");
  const l = s.lots["paid:" + id];
  requireRule(
    l && l.remaining === o.credits && l.reserved === 0,
    "사용 또는 예약된 구매예요. 문의로 부분 환불을 요청해주세요.",
    409,
  );
  l.frozen = true;
  o.status = "cancelling";
  o.reason = reason.slice(0, 300);
  return o;
}
export function cancelled(s: State, id: string, at: number) {
  const o = s.orders[id];
  requireRule(o, "구매가 없어요.");
  if (o.status === "cancelled") return;
  const l = s.lots["paid:" + id];
  if (l) {
    requireRule(
      l.reserved === 0 && l.remaining === 10,
      "사용된 구매의 취소 확인이 필요해요.",
      409,
    );
    l.remaining = 0;
    l.frozen = false;
    entry(s, o.user, "purchase_cancel", -10, id, at);
  }
  o.status = "cancelled";
}
export function reserveJob(
  s: State,
  user: string,
  key: string,
  fingerprint: string,
  style: Style,
  at: number,
) {
  requireRule(
    s.users[user] && !s.users[user].deleted && !s.users[user].closing,
    "계정을 확인해주세요.",
    403,
  );
  const prev = Object.values(s.jobs).find(
    (j) => j.user === user && j.requestKey === key,
  );
  if (prev) {
    requireRule(
      prev.fingerprint === fingerprint && prev.style === style,
      "같은 요청의 사진이나 스타일이 달라요.",
      409,
    );
    return prev;
  }
  requireRule(s.config.generation, "영상 제작을 잠시 쉬고 있어요.", 503);
  requireRule(Object.hasOwn(STYLES, style), "영상 종류를 확인해주세요.");
  const rule = STYLES[style],
    day = dayKst(at),
    today = Object.values(s.jobs).filter((j) => j.day === day),
    extractCost = (s.rates["extract-cost:" + day]?.count || 0) * 0.05;
  requireRule(
    today.length < s.config.dailyJobs &&
      today.reduce((n, j) => n + j.reserveUsd, 0) +
        extractCost +
        rule.reserveUsd <=
        s.config.dailyUsd,
    "오늘 제작 한도에 도달했어요. 내일 다시 찾아주세요.",
    429,
  );
  requireRule(
    balance(s, user).available >= rule.credits,
    "크레딧이 부족해요. 충전 후 다시 만들어주세요.",
    409,
  );
  rate(s, "jobs:" + user, 10, 3600000, at);
  let left: number = rule.credits;
  const allocations: Job["allocations"] = [];
  const lots = Object.values(s.lots)
    .filter((l) => l.user === user && !l.frozen)
    .sort(
      (a, b) =>
        Number(a.kind === "paid") - Number(b.kind === "paid") ||
        a.created - b.created,
    );
  for (const l of lots) {
    const n = Math.min(left, l.remaining - l.reserved);
    if (n > 0) {
      l.reserved += n;
      allocations.push({ lot: l.id, count: n });
      left -= n;
    }
    if (!left) break;
  }
  requireRule(left === 0, "잔액을 다시 확인해주세요.", 409);
  const j: Job = {
    id: randomUUID(),
    user,
    requestKey: key,
    fingerprint,
    style,
    cost: rule.credits,
    allocations,
    status: "reserved",
    created: at,
    day,
    reserveUsd: rule.reserveUsd,
  };
  s.jobs[j.id] = j;
  entry(s, user, "generation_reserve", -j.cost, j.id, at);
  return j;
}
export function settle(s: State, id: string, success: boolean, at: number) {
  const j = s.jobs[id];
  requireRule(j, "작업을 찾지 못했어요.", 404);
  if (j.billingSettled) return;
  for (const a of j.allocations) {
    const lot = s.lots[a.lot];
    requireRule(lot && lot.reserved >= a.count, "장부 확인이 필요해요.", 500);
    lot.reserved -= a.count;
    if (success) lot.remaining -= a.count;
  }
  j.billingSettled = true;
  j.status = success ? "completed" : "failed";
  entry(
    s,
    j.user,
    success ? "generation_use" : "generation_release",
    success ? -j.cost : j.cost,
    id,
    at,
  );
}
export function claim(s: State, id: string, at: number) {
  const j = s.jobs[id];
  requireRule(j, "작업이 없어요.", 404);
  if (
    ["completed", "failed", "review"].includes(j.status) ||
    (j.leaseUntil && j.leaseUntil > at)
  )
    return null;
  j.lease = randomUUID();
  j.leaseUntil = at + 240000;
  return structuredClone(j);
}
export function jobFor(s: State, user: string, id: string) {
  const j = s.jobs[id];
  requireRule(j && j.user === user, "영상을 찾지 못했어요.", 404);
  return j;
}
export function adminGrant(
  s: State,
  user: string,
  amount: number,
  reason: string,
  key: string,
  at: number,
) {
  const existing = s.entries.find(
    (e) => e.kind === "admin_adjustment" && e.cause === "admin:" + key,
  );
  requireRule(
    !existing || existing.note === reason,
    "같은 보상 요청의 사유가 달라요.",
    409,
  );
  requireRule(s.users[user] && !s.users[user].deleted, "계정이 없어요.");
  requireRule(
    reason.trim().length >= 4 && reason.length <= 300,
    "보상 사유를 구체적으로 적어주세요.",
  );
  requireRule(
    Number.isSafeInteger(amount) && amount > 0 && amount <= 30,
    "보상은 1~30크레딧으로 입력해주세요.",
  );
  grant(s, user, "free", amount, "admin:" + key, at, "admin_adjustment");
  const e = s.entries.find(
    (x) => x.kind === "admin_adjustment" && x.cause === "admin:" + key,
  );
  if (e) e.note = reason;
}
