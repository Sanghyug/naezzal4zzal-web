import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";
import { sqliteStore } from "../server/launch/store.ts";
import {
  signup,
  grant,
  balance,
  reserveJob,
  settle,
  beginCancel,
  beginPayment,
  newOrder,
  paid,
  cancelled,
  createVisit,
  startRender,
  completeRender,
  monthKst,
  initialState,
  claim,
} from "../server/launch/domain.ts";
import { LaunchService } from "../server/launch/service.ts";
import { mockPayments } from "../server/launch/payments.ts";
import { videoPayload } from "../server/launch/video.ts";
import { removeAudio, validateGif } from "../server/launch/media.ts";

const now = Date.parse("2026-11-23T14:00:00Z");
const user = (s, id = "a", visit) =>
  signup(s, id, "identity-" + id, now, visit, now);
const memoryStorage = () => {
  const data = new Map();
  return {
    data,
    async put(b, k, v) {
      data.set(b + "/" + k, v);
    },
    async get(b, k) {
      if (!data.has(b + "/" + k)) throw Error("missing");
      return data.get(b + "/" + k);
    },
    async remove(b, k) {
      data.delete(b + "/" + k);
    },
  };
};
const fixtureImages = async () => {
  const b = await readFile("artifacts/launch/input.png").catch(async () => {
    await promisify(execFile)(ffmpeg, [
      "-nostdin",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=pink:s=160x120",
      "-frames:v",
      "1",
      "-y",
      "artifacts/launch/input.png",
    ]);
    return readFile("artifacts/launch/input.png");
  });
  return Array(4).fill("data:image/png;base64," + b.toString("base64"));
};

test("signup gift limit is atomic, repeat login and same provider identity cannot grant again", async () => {
  const dir = await mkdtemp(path.resolve("artifacts/launch/signup-"));
  const a = await sqliteStore(path.join(dir, "db.sqlite")),
    b = await sqliteStore(path.join(dir, "db.sqlite"));
  await a.tx((s) => {
    s.config.giftLimit = 2;
  });
  await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      (i % 2 ? a : b).tx((s) => user(s, "u" + i)),
    ),
  );
  const snapshot = await a.tx((s) => s);
  assert.equal(
    snapshot.entries.filter((e) => e.kind === "signup_gift").length,
    2,
  );
  await a.tx((s) => {
    s.config.giftLimit = 100;
    user(s, "u0");
  });
  await a.tx((s) => signup(s, "another", "identity-u0", now, undefined, now));
  assert.equal(
    (await b.tx((s) => s.entries.filter((e) => e.kind === "signup_gift")))
      .length,
    2,
  );
});
test("one available credit cannot reserve two concurrent jobs; retry never adds reservation", async () => {
  const dir = await mkdtemp(path.resolve("artifacts/launch/spend-")),
    file = path.join(dir, "db.sqlite");
  const a = await sqliteStore(file),
    b = await sqliteStore(file);
  await a.tx((s) => {
    s.config.gifts = false;
    s.config.generation = true;
    user(s);
    grant(s, "a", "free", 1, "only", now, "admin_adjustment");
  });
  const results = await Promise.allSettled([
    a.tx((s) => reserveJob(s, "a", "one", "fp", "memory", now)),
    b.tx((s) => reserveJob(s, "a", "two", "fp2", "memory", now)),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  const j = results.find((x) => x.status === "fulfilled").value;
  await b.tx((s) =>
    reserveJob(s, "a", j.requestKey, j.fingerprint, j.style, now),
  );
  assert.deepEqual(await a.tx((s) => balance(s, "a")), {
    total: 1,
    available: 0,
    reserved: 1,
    paid: 0,
  });
  await a.tx((s) => settle(s, j.id, false, now));
  await b.tx((s) => settle(s, j.id, false, now));
  assert.equal((await a.tx((s) => balance(s, "a"))).available, 1);
  assert.equal(
    (
      await a.tx((s) =>
        s.entries.filter((e) => e.kind === "generation_release"),
      )
    ).length,
    1,
  );
  const reopened = await sqliteStore(file);
  assert.equal((await reopened.tx((s) => balance(s, "a"))).available, 1);
});
test("free-first allocations restore original sources; capture is once and not two charges", () => {
  const s = initialState();
  s.config.gifts = false;
  s.config.generation = true;
  user(s);
  grant(s, "a", "free", 1, "gift", now, "signup_gift");
  grant(s, "a", "paid", 10, "purchase", now, "purchase");
  const j = reserveJob(s, "a", "req", "fp", "drawing", now);
  assert.deepEqual(
    j.allocations.map((x) => x.count),
    [1, 2],
  );
  assert.equal(balance(s, "a").available, 8);
  settle(s, j.id, false, now);
  assert.equal(balance(s, "a").available, 11);
  const next = reserveJob(s, "a", "new", "fp", "drawing", now);
  settle(s, next.id, true, now);
  settle(s, next.id, true, now);
  assert.equal(balance(s, "a").total, 8);
  assert.equal(s.lots["paid:purchase"].remaining, 8);
});
test("payment validates account, amount, order and provider status; duplicates grant exactly ten", () => {
  const s = initialState();
  s.config.gifts = false;
  s.config.payments = true;
  user(s);
  user(s, "b");
  const o = newOrder(s, "a", "key", now);
  assert.equal(o.amount, 3900);
  assert.equal(o.credits, 10);
  assert.equal(newOrder(s, "a", "key", now).id, o.id);
  assert.throws(() => beginPayment(s, "b", o.id, "pk", 3900));
  assert.throws(() => beginPayment(s, "a", o.id, "pk", 1));
  beginPayment(s, "a", o.id, "pk", 3900);
  const p = {
    orderId: o.id,
    paymentKey: "pk",
    totalAmount: 3900,
    currency: "KRW",
    status: "DONE",
  };
  assert.throws(() => paid(s, o.id, { ...p, status: "ABORTED" }, now));
  assert.throws(() => paid(s, o.id, { ...p, totalAmount: 1 }, now));
  paid(s, o.id, p, now);
  paid(s, o.id, p, now);
  assert.equal(balance(s, "a").paid, 10);
  assert.equal(s.entries.filter((e) => e.kind === "purchase").length, 1);
});
test("provider approval survives local commit failure and is recovered without another charge", async () => {
  const dir = await mkdtemp(path.resolve("artifacts/launch/payment-")),
    store = await sqliteStore(path.join(dir, "db.sqlite"));
  await store.tx((s) => {
    s.config.gifts = false;
    s.config.payments = true;
    user(s);
  });
  const pg = mockPayments(store);
  let grants = 0;
  const faulty = {
    async tx(fn) {
      return store.tx((s) => {
        const before = s.entries.filter((e) => e.kind === "purchase").length;
        const out = fn(s);
        if (
          s.entries.filter((e) => e.kind === "purchase").length > before &&
          grants++ === 0
        )
          throw Error("simulated DB commit failure");
        return out;
      });
    },
  };
  const service = new LaunchService(faulty, memoryStorage(), pg, {});
  const o = await service.order("a", "req");
  await assert.rejects(() => service.confirm("a", o.id, "mock-pk", 3900));
  assert.equal((await pg.lookup(o)).status, "DONE");
  assert.equal((await store.tx((s) => balance(s, "a"))).paid, 0);
  await service.recoverOrder("a", o.id);
  await service.recoverOrder("a", o.id);
  assert.equal((await store.tx((s) => balance(s, "a"))).paid, 10);
});
test("refund locks purchase credits; lost cancellation response recovers once; spent lots reject full refund", async () => {
  const dir = await mkdtemp(path.resolve("artifacts/launch/refund-")),
    store = await sqliteStore(path.join(dir, "db.sqlite"));
  await store.tx((s) => {
    s.config.payments = true;
    s.config.gifts = false;
    s.config.generation = true;
    user(s);
  });
  const pg = mockPayments(store),
    service = new LaunchService(store, memoryStorage(), pg, {});
  const o = await service.order("a", "req");
  await service.confirm("a", o.id, "pk", 3900);
  const frozen = await store.tx((s) =>
    structuredClone(beginCancel(s, "a", o.id, "미사용 취소")),
  );
  assert.equal((await store.tx((s) => balance(s, "a"))).available, 0);
  await assert.rejects(() =>
    store.tx((s) => reserveJob(s, "a", "no", "fp", "memory", now)),
  );
  await pg.cancel(frozen);
  await service.recoverOrder("a", o.id);
  await service.recoverOrder("a", o.id);
  assert.equal((await store.tx((s) => balance(s, "a"))).paid, 0);
  const second = await service.order("a", "req2");
  await service.confirm("a", second.id, "pk2", 3900);
  const j = await store.tx((s) =>
    reserveJob(s, "a", "spend", "fp", "memory", now),
  );
  await store.tx((s) => settle(s, j.id, true, now));
  await assert.rejects(() => service.cancel("a", second.id, "취소 요청"));
});
test("GIF before signup and signup before GIF both reward exactly once; self/existing accounts excluded", () => {
  const s = initialState();
  user(s, "owner");
  const code = s.users.owner.inviteCode;
  const v = createVisit(s, code, now),
    r = startRender(s, v.id, now);
  completeRender(s, v.id, r.id, "hash1", undefined, now);
  assert.equal(balance(s, "owner").available, 5);
  user(s, "friend", v.id);
  assert.equal(balance(s, "owner").available, 7);
  user(s, "friend", v.id);
  completeRender(s, v.id, r.id, "hash1", "friend", now);
  assert.equal(balance(s, "owner").available, 7);
  const v2 = createVisit(s, code, now);
  user(s, "friend2", v2.id);
  const r2 = startRender(s, v2.id, now);
  completeRender(s, v2.id, r2.id, "hash2", "friend2", now);
  assert.equal(balance(s, "owner").available, 9);
  assert.throws(() => completeRender(s, v2.id, r.id, "hash1", "friend2", now));
  const self = createVisit(s, code, now);
  user(s, "owner", self.id);
  assert.equal(s.users.owner.inviter, undefined);
  user(s, "existing");
  const old = createVisit(s, code, now);
  user(s, "existing", old.id);
  assert.equal(s.users.existing.inviter, undefined);
  const reused = createVisit(s, code, now),
    rr = startRender(s, reused.id, now);
  assert.throws(() =>
    completeRender(s, reused.id, rr.id, "hash1", undefined, now),
  );
});
test("invite monthly cap uses Korea time, global switches and daily budget cap are enforced", () => {
  const s = initialState();
  s.config.inviteMonthly = 1;
  user(s, "owner");
  const code = s.users.owner.inviteCode,
    v = createVisit(s, code, now);
  user(s, "friend", v.id);
  const r = startRender(s, v.id, now);
  completeRender(s, v.id, r.id, "hash", "friend", now);
  assert.throws(() => createVisit(s, code, now));
  assert.equal(monthKst(Date.parse("2026-11-30T15:00:00Z")), "2026-12");
  s.config.generation = true;
  s.config.dailyUsd = 0.16;
  reserveJob(s, "owner", "one", "fp", "memory", now);
  assert.throws(() => reserveJob(s, "owner", "two", "fp", "memory", now));
  s.config.gifts = false;
  user(s, "no-gift");
  assert.equal(balance(s, "no-gift").total, 0);
});
test("video worker lease prevents duplicate external jobs; uncertain timeout keeps reservation", async () => {
  const dir = await mkdtemp(path.resolve("artifacts/launch/worker-")),
    store = await sqliteStore(path.join(dir, "db.sqlite"));
  await store.tx((s) => {
    user(s);
    s.config.generation = true;
  });
  const storage = memoryStorage();
  let submissions = 0,
    release;
  const provider = {
    kind: "mock",
    async analyze() {
      return { analysis: { motion_prompt_en: "Hold pose" } };
    },
    async submit() {
      submissions++;
      await new Promise((r) => {
        release = r;
      });
      throw Error("uncertain");
    },
    async status() {
      throw Error("not reached");
    },
  };
  const service = new LaunchService(
    store,
    storage,
    mockPayments(store),
    provider,
  );
  const images = await fixtureImages();
  const j = await service.createJob("a", "request123", "drawing", images, true);
  const first = service.runJob(j.id);
  while (!release) await new Promise((r) => setTimeout(r, 5));
  await service.runJob(j.id);
  assert.equal(submissions, 1);
  release();
  await first;
  assert.equal((await store.tx((s) => balance(s, "a"))).reserved, 3);
  assert.equal((await store.tx((s) => s.jobs[j.id])).status, "submitting");
  await assert.rejects(() => service.file("other", j.id));
});
test("B payload has only one first image; A3 preserves the four-reference pen style", () => {
  const images = Array(4).fill("data:image/png;base64,aGVsbG8=");
  const b = videoPayload("memory", images, "Hold the final heart pose.");
  assert.equal(b.mode, "image_to_video");
  assert.ok(b.image);
  assert.equal("reference_images" in b, false);
  assert.equal(b.duration, 5);
  assert.equal(b.resolution, "480p");
  const a = videoPayload("drawing", images);
  assert.equal(a.reference_images.length, 4);
  assert.match(a.prompt, /pen-and-ink/);
  assert.throws(() => videoPayload("memory", images, "Move like Picture 2."));
});
test("confirmed provider failure releases once, a timeout does not; lease expiry never blindly replays stale jobs", () => {
  const s = initialState();
  s.config.generation = true;
  user(s);
  const j = reserveJob(s, "a", "job", "fp", "memory", now);
  assert.ok(claim(s, j.id, now));
  assert.equal(claim(s, j.id, now), null);
  assert.ok(claim(s, j.id, now + 240001));
  assert.equal(balance(s, "a").reserved, 1);
  settle(s, j.id, false, now);
  settle(s, j.id, false, now);
  assert.equal(balance(s, "a").available, 5);
});
test("real MP4 postprocessing removes the audio stream without paid regeneration; GIF rejects forged flags", async () => {
  const dir = await mkdtemp(path.resolve("artifacts/launch/media-")),
    input = path.join(dir, "with-audio.mp4");
  await promisify(execFile)(ffmpeg, [
    "-nostdin",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=pink:s=160x120:r=24",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=32000",
    "-t",
    "1",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    input,
  ]);
  const output = await removeAudio(await readFile(input)),
    silent = path.join(dir, "silent.mp4");
  await writeFile(silent, output);
  let stderr = "";
  try {
    await promisify(execFile)(ffmpeg, ["-i", silent]);
  } catch (e) {
    stderr = e.stderr;
  }
  assert.match(stderr, /Video:/);
  assert.doesNotMatch(stderr, /Audio:/);
  assert.throws(() => validateGif(Buffer.from('{"completed":true}')));
});
test("two same-user same-input jobs coalesce GPT analysis and reuse only that users cache", async () => {
  const dir = await mkdtemp(path.resolve("artifacts/launch/cache-")),
    store = await sqliteStore(path.join(dir, "db.sqlite"));
  await store.tx((s) => {
    user(s);
    s.config.generation = true;
  });
  const storage = memoryStorage();
  let analyses = 0,
    submits = 0,
    release;
  const provider = {
    kind: "mock",
    async analyze() {
      analyses++;
      await new Promise((r) => {
        release = r;
      });
      return {
        analysis: { motion_prompt_en: "Hold a heart." },
        usage: {},
        model: "mock",
      };
    },
    async submit() {
      return "provider-" + ++submits;
    },
    async status() {
      return { status: "processing" };
    },
  };
  const service = new LaunchService(
      store,
      storage,
      mockPayments(store),
      provider,
    ),
    images = await fixtureImages(),
    a = await service.createJob("a", "reqfirst", "memory", images, true),
    b = await service.createJob("a", "reqsecond", "memory", images, true);
  const work = service.runJob(a.id);
  while (!release) await new Promise((r) => setTimeout(r, 5));
  await service.runJob(b.id);
  assert.equal(analyses, 1);
  release();
  await work;
  await service.runJob(b.id);
  assert.equal(analyses, 1);
  assert.equal(submits, 2);
  assert.equal((await store.tx((s) => balance(s, "a"))).reserved, 2);
});
test("provider-confirmed failure releases reservations exactly once and never charges downloads", async () => {
  const dir = await mkdtemp(path.resolve("artifacts/launch/failure-")),
    store = await sqliteStore(path.join(dir, "db.sqlite"));
  await store.tx((s) => {
    user(s);
    s.config.generation = true;
  });
  let submissions = 0;
  const provider = {
    kind: "mock",
    async submit() {
      submissions++;
      return "failed-id";
    },
    async status() {
      return { status: "failed" };
    },
  };
  const service = new LaunchService(
    store,
    memoryStorage(),
    mockPayments(store),
    provider,
  );
  const j = await service.createJob(
    "a",
    "failedreq",
    "drawing",
    await fixtureImages(),
    true,
  );
  await service.runJob(j.id);
  await service.runJob(j.id);
  assert.equal(submissions, 1);
  assert.equal((await service.account("a")).balance.available, 5);
  await assert.rejects(() => service.file("a", j.id));
});
test("account closure freezes new spending during deletion; same provider cannot claim another gift for 90 days", async () => {
  const dir = await mkdtemp(path.resolve("artifacts/launch/close-")),
    store = await sqliteStore(path.join(dir, "db.sqlite"));
  await store.tx((s) => {
    user(s);
    s.config.generation = true;
  });
  const storage = memoryStorage();
  let unblock,
    started = false;
  storage.remove = async () => {
    started = true;
    await new Promise((r) => {
      unblock = r;
    });
  };
  await store.tx((s) => {
    s.cache["a:cache"] = { key: "a/cache.json", at: Date.now() };
  });
  const service = new LaunchService(store, storage, mockPayments(store), {}),
    close = service.closeAccount("a");
  while (!started) await new Promise((r) => setTimeout(r, 5));
  await assert.rejects(() =>
    store.tx((s) => reserveJob(s, "a", "blocked", "fp", "memory", Date.now())),
  );
  unblock();
  await close;
  await store.tx((s) =>
    signup(s, "a-new", "identity-a", Date.now(), undefined, Date.now()),
  );
  assert.equal((await service.account("a-new")).balance.total, 0);
});
test("operator retry is idempotent and changed compensation amount cannot reuse its key", async () => {
  const dir = await mkdtemp(path.resolve("artifacts/launch/admin-")),
    store = await sqliteStore(path.join(dir, "db.sqlite"));
  await store.tx((s) => user(s));
  const service = new LaunchService(
      store,
      memoryStorage(),
      mockPayments(store),
      {},
    ),
    body = {
      action: "adjust",
      target: "a",
      amount: 2,
      reason: "기술 문의 보상",
      requestKey: "unique-request",
    };
  await service.admin("operator", body);
  await service.admin("operator", body);
  assert.equal((await service.account("a")).balance.available, 7);
  await assert.rejects(() => service.admin("operator", { ...body, amount: 3 }));
});
