import { createClient } from "@supabase/supabase-js";

// Modern API keys are opaque credentials, not session JWTs. Some SDK service
// clients still copy the API key into Authorization; keep it only in apikey.
// Explicit user access-token Authorization headers remain untouched.
export function serverSupabase(url: string, key: string, transport: typeof fetch = fetch) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if ((key.startsWith("sb_secret_") || key.startsWith("sb_publishable_")) &&
            headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        return transport(input, { ...init, headers });
      },
    },
  });
}
