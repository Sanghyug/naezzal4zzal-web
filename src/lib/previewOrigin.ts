// Normalize newly opened test deployments before editing/OAuth starts. A callback
// stays on its original origin so its PKCE verifier is never moved or exposed.
export function previewEntryRedirect(href: string, canonicalOrigin: string | undefined, enabled: boolean) {
  if (!enabled || !canonicalOrigin) return null;
  const current = new URL(href), target = new URL(canonicalOrigin);
  if (target.protocol !== "https:" || current.protocol !== "https:" ||
      !current.hostname.endsWith(".vercel.app") || current.origin === target.origin) return null;
  if (current.searchParams.has("code") || current.searchParams.get("auth") === "return" ||
      new URLSearchParams(current.hash.slice(1)).has("error")) return null;
  return target.origin + current.pathname + current.search + current.hash;
}
