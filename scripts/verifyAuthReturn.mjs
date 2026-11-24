// Probe the real Auth callback via a cancelled, account-free OAuth attempt.
// No member, credits, passwords, access tokens, or management keys are involved.
import { createClient } from '@supabase/supabase-js';
import { kakaoOAuthOptions } from '../src/lib/kakao.ts';
import assert from 'node:assert/strict';
const origin = process.argv[2];
assert.ok(origin?.startsWith('https://'));
const base = 'https://cvwikgszywzlvadsvvvq.supabase.co';
const c = createClient(base, 'public-preflight-no-secret', { auth: { flowType: 'pkce', persistSession: false, autoRefreshToken: false } });
const args = kakaoOAuthOptions(origin);
const { data, error } = await c.auth.signInWithOAuth({ ...args, options: { ...args.options, skipBrowserRedirect: true } });
assert.equal(error, null);
const authorize = new URL(data.url);
assert.equal(authorize.searchParams.get('redirect_to'), origin + '/?auth=return');
assert.ok(authorize.searchParams.get('code_challenge'));
const first = await fetch(authorize, { redirect: 'manual' });
assert.equal(first.status, 302);
const kakao = new URL(first.headers.get('location'));
assert.equal(kakao.host, 'kauth.kakao.com');
assert.equal(kakao.searchParams.get('scope'), '');
const callback = new URL(base + '/auth/v1/callback');
callback.searchParams.set('state', kakao.searchParams.get('state'));
callback.searchParams.set('error', 'access_denied');
callback.searchParams.set('error_description', 'Cancelled redirect preflight');
const cookie = first.headers.getSetCookie().map(s => s.split(';')[0]).join('; ');
const result = await fetch(callback, { redirect: 'manual', headers: { Cookie: cookie } });
const returned = new URL(result.headers.get('location'));
console.log(JSON.stringify({ requestedOrigin: origin, requestedReturn: authorize.searchParams.get('redirect_to'), scope: '', callbackStatus: result.status, returnedOrigin: returned.origin, sameOrigin: returned.origin === origin, actualAccountLoginVerified: false }, null, 2));
assert.equal(returned.origin, origin, 'Supabase rejected this return URL; check Redirect URLs and Site URL fallback.');
