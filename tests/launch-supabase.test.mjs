import test from 'node:test';
import assert from 'node:assert/strict';
import { serverSupabase } from '../server/launch/supabase.ts';
import { supabaseStorage } from '../server/launch/storage.ts';

test('modern server secret uses apikey only for Storage and Auth admin; user JWT stays intact', async () => {
  const key = 'sb_secret_fake_transport_test_only', calls = [];
  const transport = async (input, init) => {
    const path = new URL(String(input)).pathname, headers = new Headers(init.headers);
    assert.equal(headers.get('apikey'), key);
    assert.notEqual(headers.get('authorization'), 'Bearer ' + key);
    calls.push(path);
    if (path.endsWith('/auth/v1/user')) {
      assert.equal(headers.get('authorization'), 'Bearer verified-user-jwt');
      return Response.json({ id: 'member', identities: [], created_at: new Date().toISOString() });
    }
    if (init.method === 'GET' && path.includes('/storage/')) return new Response('private-file');
    return Response.json({ id: 'member', Key: 'file', data: [] });
  };
  const storage = supabaseStorage('https://example.supabase.co', key, transport);
  await storage.put('launch-inputs', 'member/test.json', Buffer.from('{}'), 'application/json');
  assert.equal((await storage.get('launch-inputs', 'member/test.json')).toString(), 'private-file');
  await storage.remove('launch-inputs', 'member/test.json');
  const admin = serverSupabase('https://example.supabase.co', key, transport);
  assert.equal((await admin.auth.admin.deleteUser('00000000-0000-4000-8000-000000000001')).error, null);
  assert.equal((await admin.auth.getUser('verified-user-jwt')).data.user.id, 'member');
  assert.ok(calls.some((p) => p.includes('/auth/v1/admin/users/')));
  assert.ok(calls.includes('/auth/v1/user'));
  assert.ok(calls.filter((p) => p.includes('/storage/')).length >= 3);
});
