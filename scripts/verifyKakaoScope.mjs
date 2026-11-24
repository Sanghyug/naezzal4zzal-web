// Live preflight: no account login, secrets, or paid calls. Follows the real
// Supabase Location header, not an assumed/mock provider scope list.
import { createClient } from '@supabase/supabase-js';
import { kakaoOAuthOptions } from '../src/lib/kakao.ts';
import assert from 'node:assert/strict';
const origin = process.argv[2];
if (!origin?.startsWith('https://')) throw Error('Supply the exact HTTPS Preview origin');
const client = createClient('https://cvwikgszywzlvadsvvvq.supabase.co', 'public-preflight-no-secret', {
  auth: { flowType: 'pkce', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const args = kakaoOAuthOptions(origin);
const { data, error } = await client.auth.signInWithOAuth({ ...args, options: { ...args.options, skipBrowserRedirect: true } });
assert.equal(error, null);
const first = await fetch(data.url, { redirect: 'manual' });
assert.equal(first.status, 302);
const final = new URL(first.headers.get('location'));
assert.equal(final.origin, 'https://kauth.kakao.com');
assert.equal(final.pathname, '/oauth/authorize');
assert.equal(final.searchParams.get('redirect_uri'), 'https://cvwikgszywzlvadsvvvq.supabase.co/auth/v1/callback');
assert.equal(final.searchParams.getAll('scope').length, 1);
assert.equal(final.searchParams.get('scope'), '');
assert.ok(final.searchParams.get('state'));
const kakao = await fetch(final);
const html = await kakao.text();
assert.equal(html.includes('KOE205'), false);
console.log(JSON.stringify({ authorizationHost: final.host, scope: final.searchParams.get('scope'), requestedConsentItems: [], supabaseCallback: final.searchParams.get('redirect_uri'), kakaoStatus: kakao.status, responseHost: new URL(kakao.url).host, koe205: false, actualAccountLoginVerified: false }, null, 2));
