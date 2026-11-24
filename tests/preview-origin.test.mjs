import test from 'node:test';
import assert from 'node:assert/strict';
import { previewEntryRedirect } from '../src/lib/previewOrigin.ts';
const fixed = 'https://naezzal4zzal-test.vercel.app';
test('fresh Preview entries normalize before editing and preserve invite parameters', () => {
  assert.equal(previewEntryRedirect('https://new-preview.vercel.app/?ref=abc#help', fixed, true), fixed + '/?ref=abc#help');
  assert.equal(previewEntryRedirect(fixed + '/?ref=abc', fixed, true), null);
  assert.equal(previewEntryRedirect('http://127.0.0.1:5173/', fixed, true), null);
  assert.equal(previewEntryRedirect('https://new-preview.vercel.app/', fixed, false), null);
});
test('OAuth callbacks never transfer their code or PKCE context to another origin', () => {
  for (const suffix of ['/?code=private-code', '/?auth=return', '/#error=access_denied'])
    assert.equal(previewEntryRedirect('https://new-preview.vercel.app' + suffix, fixed, true), null);
  assert.equal(previewEntryRedirect('https://new-preview.vercel.app/', 'http://localhost:3000', true), null);
});
