import { videoUsage } from "./costs.ts";
import { createHmac, randomUUID } from "node:crypto";
import { dayKst } from "./domain.ts";
import type { State } from "./domain.ts";
import type { Store } from "./store.ts";
export type MetricEvent = {
    id: string;
    event: string;
    subject: string;
    at: number;
    properties: Record<string, string | number | boolean>;
    sent?: number;
};
export type TelemetryState = {
    events: Record<string, MetricEvent>;
    daily?: Record<string, Record<string, number>>;
    dropped?: number;
};
// No generic properties, URLs, filenames, errors, prompts, cookies or user profiles.
const clientEvents = ["visit", "photo_selected", "photo_extraction", "gif_completed", "invite_shared", "media_shared"];
const values: Record<string, readonly string[]> = { source: ["direct", "search", "kakao", "social", "other", "camera", "upload"], style: ["gif", "memory", "drawing", "video"], outcome: ["success", "failure", "opened", "confirmed"], method: ["native", "kakao", "clipboard", "web", "manual"] };
export function clientMetric(event: unknown, properties: unknown) {
    if (typeof event !== "string" || !clientEvents.includes(event))
        return null;
    const clean: Record<string, string | boolean> = {};
    if (properties && typeof properties === "object" && !Array.isArray(properties)) {
        for (const [k, v] of Object.entries(properties)) {
            if (k === "invited" && typeof v === "boolean")
                clean[k] = v;
            else if (typeof v === "string" && Object.hasOwn(values,k) && values[k].includes(v))
                clean[k] = v;
        }
    }
    return { event, properties: clean };
}
export function recordMetric(s: State, event: string, subject: string, properties: MetricEvent["properties"] = {}, id: string = randomUUID()) {
    const events = (s.telemetry ??= { events: {} }).events;
    if (events[id])
        return;
    // Keep the local journal bounded when no destination is configured; never alter ledger.
    const records = Object.values(events);
    if (records.length >= 5000) {
        const oldest = records[0];
        s.telemetry!.dropped = (s.telemetry!.dropped || 0) + 1;
        delete events[oldest.id];
    }
    events[id] = { id, event, subject, properties, at: Date.now() };
    const daily = (s.telemetry!.daily ??= {});
    const counts = (daily[dayKst(Date.now())] ??= {});
    counts[event] = (counts[event] || 0) + 1;
    for (const key of ["source", "style", "outcome", "method", "purchase"])
        if (properties[key] !== undefined) {
            const dimension = event + ":" + key + ":" + properties[key];
            counts[dimension] = (counts[dimension] || 0) + 1;
        }
}
export function observeChanges(s: State) {
    const entries = s.entries.length, users = new Set(Object.keys(s.users));
    const jobs = new Map(Object.values(s.jobs).map(j => [j.id, j.status]));
    return () => {
        for (const u of Object.values(s.users))
            if (!users.has(u.id))
                recordMetric(s, "signup", u.id, {}, "signup:" + u.id);
        for (const e of s.entries.slice(entries)) {
            const names: Record<string, string> = { signup_gift: "welcome_granted", invite_reward: "invite_reward_granted", generation_use: "credits_consumed", purchase: "payment_completed" };
            const name = names[e.kind];
            if (!name)
                continue;
            const props: MetricEvent["properties"] = { credits: Math.abs(e.amount) };
            if (e.kind === "purchase")
                props.purchase = s.entries.filter(x => x.user === e.user && x.kind === "purchase" && x.at <= e.at).length > 1 ? "repeat" : "first";
            recordMetric(s, name, e.user, props, e.id);
        }
        for (const j of Object.values(s.jobs)) {
            if (jobs.get(j.id) === j.status)
                continue;
            if (j.providerId && !j.providerId.startsWith("mock-")) {
                const usage = videoUsage(j, s);
                const old = s.usage?.[usage.id];
                (s.usage ??= {})[usage.id] = { ...usage, ...(old ? { actualBilledUsd: old.actualBilledUsd, invoiceReference: old.invoiceReference, reconciledAt: old.reconciledAt, reconciliationReason: old.reconciliationReason } : {}) };
            }
            if (!jobs.has(j.id))
                recordMetric(s, "video_started", j.user, { style: j.style }, "start:" + j.id);
            if (["completed", "failed", "review"].includes(j.status))
                recordMetric(s, "video_result", j.user, { style: j.style, outcome: j.status }, j.status + ":" + j.id);
            if (j.status === "completed") {
                const welcome = j.allocations.filter(a => s.lots[a.lot]?.cause.startsWith("signup:"));
                if (welcome.length)
                    recordMetric(s, "welcome_consumed", j.user, { credits: welcome.reduce((n, a) => n + a.count, 0), exhausted: welcome.every(a => s.lots[a.lot].remaining === 0) }, "welcome-use:" + j.id);
            }
        }
    };
}
export function analyticsReady() {
    // Explicit dedicated-project opt-in. Never borrow another app's variables.
    return process.env.POSTHOG_ENABLED === "1" && /^\d+$/.test(process.env.POSTHOG_PROJECT_ID || "") && Boolean(process.env.POSTHOG_4ZZAL_KEY) && process.env.POSTHOG_PROJECT_ID !== "737937";
}
export function capturePayload(events: MetricEvent[], key: string, secret: string) {
    return { api_key: key, batch: events.map(e => ({ uuid: createHmac("sha256", secret).update("event:" + e.id).digest("hex").slice(0, 32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5"), event: "4zzal_" + e.event, timestamp: new Date(e.at).toISOString(), properties: { ...e.properties, distinct_id: createHmac("sha256", secret).update("4zzal:" + e.subject).digest("hex"), app: "4zzal", $process_person_profile: false, $geoip_disable: true, $ip: null } })) };
}
export async function flushMetrics(store: Store, secret: string) {
    if (!analyticsReady() || process.env.VERCEL_ENV !== "production")
        return;
    const batch = await store.tx(s => Object.values(s.telemetry?.events || {}).filter(e => !e.sent).slice(0, 50));
    if (!batch.length)
        return;
    try {
        const response = await fetch("https://us.i.posthog.com/batch/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(capturePayload(batch, process.env.POSTHOG_4ZZAL_KEY!, secret)), signal: AbortSignal.timeout(2000) });
        if (response.ok)
            await store.tx(s => { for (const e of batch)
                if (s.telemetry?.events[e.id])
                    s.telemetry.events[e.id].sent = Date.now(); });
    }
    catch { /* Analytics failures cannot affect authentication or the ledger. */ }
}
