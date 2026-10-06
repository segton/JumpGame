import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, createRun, nextPlatform, landing } from './physics.js';
test('platforms catch falling feet but permit jumping through from below', () => {
  const platform = { x: 200, y: 300, width: 100 };
  assert.equal(landing({ x: 200, y: 285, vy: 100 }, 280, platform), true);
  assert.equal(landing({ x: 200, y: 285, vy: -100 }, 290, platform), false);
  assert.equal(landing({ x: 300, y: 285, vy: 100 }, 280, platform), false);
  assert.equal(landing({ x: 200, y: 320, vy: 100 }, 310, platform), false);
});
test('every generated adjacent platform is vertically and horizontally reachable', () => {
  let seed = 1234; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (const config of Object.values(PRESETS)) {
    let previous = createRun(config, random).platforms[0];
    for (let i = 1; i < 5000; i++) {
      const next = nextPlatform(previous, i, config, random), gap = previous.y - next.y;
      assert.ok(gap < config.jump ** 2 / (2 * config.gravity));
      const descendingTime = (config.jump + Math.sqrt(config.jump ** 2 - 2 * config.gravity * gap)) / config.gravity;
      assert.ok(Math.abs(next.x - previous.x) < config.speed * descendingTime);
      assert.ok(next.x - next.width / 2 >= 0 && next.x + next.width / 2 <= 480);
      previous = next;
    }
  }
});
