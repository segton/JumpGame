import test from 'node:test';import assert from 'node:assert/strict';import {formatCompletedAt} from './leaderboard-time.js';
test('completion timestamps show Malaysia calendar date and wall clock time',()=>{assert.match(formatCompletedAt('2026-10-05T17:02:03Z'),/06\/10\/2026.*01:02:03/);assert.equal(formatCompletedAt(null),'—');assert.equal(formatCompletedAt('invalid'),'—');});
