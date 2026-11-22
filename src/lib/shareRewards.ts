import { useSyncExternalStore } from "react";
const key = "naezzal4zzal-share-count";
const event = "naezzal4zzal-share-reward";
export function getShareCount(): number {
  try { const count = Number(localStorage.getItem(key)); return Number.isSafeInteger(count) && count > 0 ? count : 0; }
  catch { return 0; }
}
export function recordCompletedShare(): number {
  const count = getShareCount() + 1;
  localStorage.setItem(key, String(count));
  window.dispatchEvent(new Event(event));
  return count;
}
function subscribe(callback: () => void) {
  window.addEventListener(event, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(event, callback); window.removeEventListener("storage", callback); };
}
export function useShareCount() { return useSyncExternalStore(subscribe, getShareCount, () => 0); }
export const rewardNames = ["흔들흔들 GIF", "샤방샤방 GIF", "아련아련 GIF", "봄날 프레임", "가을 프레임", "필름 프레임"];
