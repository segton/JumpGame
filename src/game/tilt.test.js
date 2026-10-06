import test from 'node:test';
import assert from 'node:assert/strict';
import { screenTilt, tiltDirection, TiltController } from './tilt.js';

function environment(api = {}) {
  const listeners = new Map(); let now = 0, timeout;
  return { isSecureContext: true, DeviceOrientationEvent: api, screen: { orientation: { angle: 0 } },
    performance: { now: () => now }, setTimeout: fn => { timeout = fn; return 1; }, clearTimeout: () => {},
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
    reading: (beta, gamma) => listeners.get('deviceorientation')?.({ beta, gamma }),
    advance: value => { now += value; }, timeout: () => timeout?.(), listeners };
}
test('tilt has a calibrated dead zone, bounded speed, and orientation mapping', () => {
  assert.equal(tiltDirection(12, 10), 0); assert.equal(tiltDirection(-20, 0), -1); assert.equal(tiltDirection(90, 0), 1);
  assert.equal(screenTilt(20, 10, 0), 10); assert.ok(Math.abs(screenTilt(20, 10, 90) - 20) < .001);
  assert.ok(Math.abs(screenTilt(20, 10, 270) + 20) < .001); assert.equal(screenTilt(null, null), null);
});
test('valid readings activate tilt, recenter removes drift, stale data falls back', async () => {
  const env = environment(), control = new TiltController(() => {}, env), ready = control.enable();
  env.reading(30, 8); assert.equal(await ready, true); assert.equal(control.direction(), 0);
  env.reading(30, 28); assert.ok(control.direction() > 0); control.recenter(); assert.equal(control.direction(), 0);
  env.advance(2000); assert.equal(control.direction(), 0); assert.equal(control.status, 'unavailable');
  control.destroy(); assert.equal(env.listeners.size, 0);
});
test('missing hardware, null readings and permission denial use buttons', async () => {
  const env = environment(), control = new TiltController(() => {}, env), ready = control.enable();
  env.reading(null, null); env.timeout(); assert.equal(await ready, false); assert.equal(control.status, 'unavailable');
  const denied = new TiltController(() => {}, environment({ requestPermission: async () => 'denied' }));
  assert.equal(await denied.enable(), false); assert.equal(denied.status, 'denied');
  env.isSecureContext = false; assert.equal(await control.enable(), false);
});
test('manual override cancels permission or detection still in progress', async () => {
  let permission; const env = environment({ requestPermission: () => new Promise(resolve => { permission = resolve; }) });
  const control = new TiltController(() => {}, env), pending = control.enable(); control.useButtons(); permission('granted');
  assert.equal(await pending, false); assert.equal(control.status, 'manual'); assert.equal(env.listeners.size, 0);
});
