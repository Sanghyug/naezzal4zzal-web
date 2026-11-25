type Event = "visit" | "photo_selected" | "photo_extraction" | "gif_completed" | "invite_shared" | "media_shared";
let ready = false;
const pending: {
    event: Event;
    properties: Record<string, string | boolean>;
}[] = [];
function send(event: Event, properties: Record<string, string | boolean>) {
    void fetch((import.meta.env.VITE_API_BASE_URL || "") + "/api/launch", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analytics", event, properties }), keepalive: true }).catch(() => { });
}
export function track(event: Event, properties: Record<string, string | boolean> = {}) {
    if (import.meta.env?.VITE_LAUNCH_ENABLED !== "1")
        return;
    if (event === "visit")
        ready = true;
    if (!ready) {
        if (pending.length < 20)
            pending.push({ event, properties });
        return;
    }
    send(event, properties);
    for (const item of pending.splice(0))
        send(item.event, item.properties);
}
export function acquisitionSource() {
    try {
        const host = new URL(document.referrer).hostname;
        if (/(^|\.)google\.|(^|\.)naver\.|(^|\.)bing\./.test(host))
            return "search";
        if (/kakao/.test(host))
            return "kakao";
        if (/instagram|facebook|twitter|t\.co/.test(host))
            return "social";
        return host === location.hostname ? "direct" : "other";
    }
    catch {
        return /KAKAOTALK/i.test(navigator.userAgent) ? "kakao" : "direct";
    }
}
