import test from 'node:test';
import assert from 'node:assert/strict';
import { jumpFrame } from './animation.js';

test(
  'jump animation follows launch, apex, fall and actual landing',
  () => {
    const jump = 570;

    // Ready
    assert.equal(
      jumpFrame(-570, 1, 'ready', jump),
      0
    );

    // Landing occurs only immediately after collision
    assert.equal(
      jumpFrame(-570, 0, 'playing', jump),
      30
    );

    assert.equal(
      jumpFrame(-570, 0.025, 'playing', jump),
      31
    );

    assert.equal(
      jumpFrame(-570, 0.045, 'playing', jump),
      32
    );

    // New takeoff
    assert.equal(
      jumpFrame(-570, 0.07, 'playing', jump),
      0
    );

    // Ascending
    const rising =
      jumpFrame(-400, 0.25, 'playing', jump);

    assert.ok(
      rising >= 6 && rising <= 13
    );

    // Apex
    const apex =
      jumpFrame(0, 0.55, 'playing', jump);

    assert.ok(
      apex >= 14 && apex <= 17
    );

    // Falling
    const falling =
      jumpFrame(320, 0.8, 'playing', jump);

    assert.ok(
      falling >= 18 && falling <= 29
    );

    // Even a very fast fall must not show landing
    // until collision actually occurs.
    assert.equal(
      jumpFrame(1000, 5, 'playing', jump),
      29
    );
  }
);