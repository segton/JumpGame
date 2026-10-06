import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, createRun, nextPlatform, platformX, collectPickup, parallaxY } from './physics.js';

test('moving platforms remain inside the screen and reachable at either extreme', () => {
  let seed = 77; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (const config of Object.values(PRESETS)) {
    let previous = createRun(config, random).platforms[0];
    for (let i = 1; i < 1500; i++) {
      const p = nextPlatform(previous, i, config, random);
      const time = (config.jump + Math.sqrt(config.jump ** 2 - 2 * config.gravity * (previous.y - p.y))) / config.gravity;
      const distance = Math.abs(p.baseX - (previous.baseX ?? previous.x)) + p.amplitude + (previous.amplitude || 0);
      assert.ok(distance < config.speed * time);
      for (const t of [0, 1, 4, 19]) assert.ok(platformX(p, t) >= p.width / 2 && platformX(p, t) <= 480 - p.width / 2);
      previous = p;
    }
  }
});
test('pickup moves with its platform, scores once, and does not change motion', () => {
  const r = createRun(PRESETS.relaxed), p = r.platforms[3]; p.x = platformX(p, 2);
  r.player = { x: p.x, y: p.y - 30, vy: -120 };
  assert.equal(collectPickup(r, p, r.player.y), true);
  assert.equal(r.score, 25); assert.equal(r.coins, 1); assert.equal(r.player.vy, -120);
  assert.equal(collectPickup(r, p, r.player.y), false); assert.equal(r.score, 25);
  const fresh = createRun(PRESETS.relaxed); assert.equal(fresh.score, 0); assert.equal(fresh.coins, 0); assert.equal(fresh.platforms[3].collected, false);
});
test('pickup collision rejects misses and accepts crossing between frames', () => {
  const r = createRun(PRESETS.relaxed), p = r.platforms[1];
  r.player.x = p.x + 70; r.player.y = p.y - 40;
  assert.equal(collectPickup(r, p, r.player.y), false);
  r.player.x = p.x; r.player.y = p.y + 20;
  assert.equal(collectPickup(r, p, p.y - 80), true);
});
test('parallax layers move downward on ascent at distinct speeds', () => {
  assert.equal(parallaxY(100, -100, .38, 1400) - parallaxY(100, 0, .38, 1400), 38);
  assert.equal(parallaxY(100, -100, 1.18, 1260) - parallaxY(100, 0, 1.18, 1260), 118);
});
test('higher moving platforms have progressively wider travel', () => {
  const config = PRESETS.relaxed, base = { x: 240, y: 0, index: 0 };
  const early = nextPlatform(base, 3, config, () => .5);
  const middle = nextPlatform(base, 43, config, () => .5);
  const high = nextPlatform(base, 523, config, () => .5);
  assert.ok(early.amplitude < middle.amplitude && middle.amplitude < high.amplitude);
  assert.ok(high.amplitude >= 60 && high.amplitude <= 70);
});
