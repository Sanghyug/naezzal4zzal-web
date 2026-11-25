import { randomUUID } from "node:crypto";
import { dayKst, requireRule } from "./domain.ts";
import type { State, Job } from "./domain.ts";
import type { Store } from "./store.ts";
export type UsageRecord = {
    id: string;
    provider: "openai" | "heygen";
    purpose: "extraction" | "motion" | "video";
    at: number;
    model: string;
    status: string;
    inputTokens?: number;
    cachedTokens?: number;
    outputTokens?: number;
    estimatedUsd: number | null;
    budgetReservedUsd?: number;
    actualBilledUsd: number | null;
    rateSource: string;
    providerId?: string;
    jobId?: string;
    method?: string;
    resolution?: string;
    seconds?: number;
    funding?: Record<string, number>;
    invoiceReference?: string;
    reconciledAt?: number;
    reconciliationReason?: string;
};
export type Meter = (record: UsageRecord) => Promise<void>;
const count = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : undefined;
export function openaiUsage(purpose: "extraction" | "motion", data: {
    id?: string;
    model?: string;
    status?: string;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
        input_tokens_details?: {
            cached_tokens?: number;
        };
    };
}, id = randomUUID()): UsageRecord {
    const u = data.usage, input = count(u?.input_tokens), output = count(u?.output_tokens), cached = Math.min(count(u?.input_tokens_details?.cached_tokens) || 0, input || 0);
    const known = /^gpt-5\.4(?:-\d{4}-\d{2}-\d{2})?$/.test(data.model || "");
    const long = (input || 0) > 272000;
    const estimated = known && input !== undefined && output !== undefined ? ((input - cached) * 2.5 * (long ? 2 : 1) + cached * .25 * (long ? 2 : 1) + output * 15 * (long ? 1.5 : 1)) / 1000000 : null;
    return { id, provider: "openai", purpose, at: Date.now(), model: known ? data.model! : "unknown", status: data.status === "completed" ? "completed" : "failed", inputTokens: input, cachedTokens: cached, outputTokens: output, estimatedUsd: estimated, actualBilledUsd: null, rateSource: "openai-gpt-5.4-standard-2026-11-26", providerId: typeof data.id === "string" && /^[a-zA-Z0-9_-]{1,180}$/.test(data.id) ? data.id : undefined };
}
export function meter(store: Store): Meter { return async (record) => { await store.tx(s => { (s.usage ??= {})[record.id] = record; }); }; }
export function videoUsage(job: Job, s: State): UsageRecord {
    const funding: Record<string, number> = {};
    for (const a of job.allocations) {
        const l = s.lots[a.lot];
        const source = l?.cause.startsWith("signup:") ? "welcome" : l?.cause.startsWith("invite:") ? "referral" : l?.kind === "paid" ? "paid" : "other_free";
        funding[source] = (funding[source] || 0) + a.count;
    }
    const standard = (job.submittedAt || job.created) >= Date.UTC(2026, 11, 1);
    const perSecond = job.style === "memory" ? (standard ? .02 : .01) : (standard ? .04 : .035);
    return { id: "heygen:" + job.id, provider: "heygen", purpose: "video", at: job.submittedAt || job.created, model: "heygen-video-1", status: job.status, estimatedUsd: 5 * perSecond, budgetReservedUsd: job.reserveUsd, actualBilledUsd: null, rateSource: standard ? "heygen-official-480p-2026-12-01" : "heygen-official-480p-promo-2026-11-30", providerId: job.providerId, jobId: job.id, method: job.style === "memory" ? "image_to_video" : "reference_to_video", resolution: "480p", seconds: 5, funding };
}
export function reconcileUsage(s: State, id: string, usd: number, reference: string, reason: string) {
    const r = Object.hasOwn(s.usage || {}, id) ? s.usage![id] : undefined;
    requireRule(r && Number.isFinite(usd) && usd >= 0 && usd <= 10000 && /^[A-Za-z0-9._/-]{3,120}$/.test(reference) && reason.trim().length >= 4, "원가 기록·청구액·청구서 참조·변경 사유를 확인해주세요.");
    r.actualBilledUsd = usd;
    r.invoiceReference = reference;
    r.reconciledAt = Date.now();
    r.reconciliationReason = reason.slice(0, 300);
}
export function costReport(s: State) {
    const rows = Object.values(s.usage || {});
    const daily: Record<string, {
        estimatedUsd: number;
        actualBilledUsd: number;
        unreconciled: number;
        unknownEstimate: number;
    }> = {};
    for (const r of rows) {
        const d = daily[dayKst(r.at)] ??= { estimatedUsd: 0, actualBilledUsd: 0, unreconciled: 0, unknownEstimate: 0 };
        d.estimatedUsd += r.estimatedUsd || 0;
        d.actualBilledUsd += r.actualBilledUsd || 0;
        if (r.actualBilledUsd === null)
            d.unreconciled++;
        if (r.estimatedUsd === null)
            d.unknownEstimate++;
    }
    const funding: Record<string, {
        credits: number;
        estimatedUsd: number;
        actualBilledUsd: number;
    }> = {};
    for (const r of rows) {
        const total = Object.values(r.funding || {}).reduce((n, v) => n + v, 0);
        for (const [key, credits] of Object.entries(r.funding || {})) {
            const g = funding[key] ??= { credits: 0, estimatedUsd: 0, actualBilledUsd: 0 };
            g.credits += credits;
            g.estimatedUsd += (r.estimatedUsd || 0) * credits / total;
            g.actualBilledUsd += (r.actualBilledUsd || 0) * credits / total;
        }
    }
    return { funding, daily, records: rows.slice(-200), recordCount: rows.length, historicalUsageUnavailable: true, heygenDecemberRate: "공식 12월 1일 표준 요율: 5초 480p 실사 USD 0.10 / 애니메이션 USD 0.20. 실제 청구서는 별도 대조", freeCredits: { welcome: s.entries.filter(e => e.kind === "signup_gift").reduce((n, e) => n + e.amount, 0), referral: s.entries.filter(e => e.kind === "invite_reward").reduce((n, e) => n + e.amount, 0) } };
}
export async function fetchOpenAI(record: Meter | undefined, purpose: "extraction" | "motion", url: string, options: RequestInit) {
    let result: Response;
    try {
        result = await fetch(url, options);
    }
    catch (error) {
        if (record)
            await record(openaiUsage(purpose, { status: "failed" }));
        throw error;
    }
    if (record) {
        const data = await result.clone().json().catch(() => ({ status: "failed" }));
        await record(openaiUsage(purpose, data && typeof data === "object" ? data as Parameters<typeof openaiUsage>[1] : {status:"failed"}));
    }
    return result;
}
