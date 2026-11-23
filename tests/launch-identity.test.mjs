import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedIdentity } from '../server/launch/identity.ts';
import { initialState, signup, balance } from '../server/launch/domain.ts';
const kakao = { id: 'member-uuid', created_at: '2026-11-24T00:00:00Z', identities: [{ provider: 'kakao', id: 'provider-subject', identity_data: { sub: 'kakao-123' } }] };
test('Kakao member without email retains credits across login and email changes', () => {
  const s = initialState(), at = Date.now();
  const first = verifiedIdentity(kakao, 'test-secret');
  signup(s, first.id, first.hash, first.created, undefined, at);
  const before = structuredClone(s);
  const again = verifiedIdentity({ ...kakao, email: 'changed@example.test' }, 'test-secret');
  assert.deepEqual(first, again);
  signup(s, again.id, again.hash, again.created, undefined, at + 1);
  assert.deepEqual(s, before);
  assert.equal(balance(s, first.id, at).available, 5);
  const sameEmailOther = verifiedIdentity({ ...kakao, id: 'another', email: 'changed@example.test', identities: [{ provider: 'kakao', id: 'other', identity_data: { sub: 'other' } }] }, 'test-secret');
  assert.notEqual(first.hash, sameEmailOther.hash);
});
test('provider identity is required; legacy Google members keep existing identity only', () => {
  assert.throws(() => verifiedIdentity({ ...kakao, identities: [], user_metadata: { provider: 'kakao', sub: 'forged' } }, 's'));
  const google = { ...kakao, identities: [{ provider: 'google', id: 'old', identity_data: { sub: 'old-google' } }] };
  assert.throws(() => verifiedIdentity(google, 's'));
  assert.equal(verifiedIdentity(google, 's', true).id, kakao.id);
});
