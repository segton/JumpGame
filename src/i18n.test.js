import test from 'node:test';
import assert from 'node:assert/strict';
import { copy } from './i18n.js';
import { challengeCopy } from './challenge-copy.js';
test('Chinese and English provide matching UI strings', () => {
  assert.deepEqual(Object.keys(copy.zh).sort(), Object.keys(copy.en).sort());
  for (const value of Object.values(copy.zh)) assert.ok(value.length > 0);
  assert.equal(copy.zh.tips.length, copy.en.tips.length);
  assert.deepEqual(Object.keys(challengeCopy.zh).sort(), Object.keys(challengeCopy.en).sort());
  assert.equal(challengeCopy.zh.stages.length,6);
});
