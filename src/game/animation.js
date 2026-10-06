// The art follows the actual jump, so it never cycles into a landing in midair.
// Sheet order: crouch, push-off, rise, apex, fall, landing.
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function frameBetween(t, first, last) {
  t = clamp01(t);

  const count = last - first + 1;

  return Math.min(
    last,
    first + Math.floor(t * count)
  );
}

// 0-5   : takeoff
// 6-13  : ascending
// 14-17 : apex
// 18-29 : descending / preparing to land
// 30-32 : actual landing impact
export function jumpFrame(
  velocityY,
  sinceLanding,
  phase,
  jumpSpeed = 580
) {
  if (phase === 'ready' || phase === 'loading') {
    return 0;
  }

  /*
   * Only allow the final landing frames after an
   * actual platform collision.
   *
   * This prevents the character from visibly landing
   * while still floating above a platform.
   */
  if (sinceLanding < 0.018) {
    return 30;
  }

  if (sinceLanding < 0.036) {
    return 31;
  }

  if (sinceLanding < 0.055) {
    return 32;
  }

  /*
   * Early launch.
   *
   * The player has just bounced off the platform.
   */
  if (sinceLanding < 0.17) {
    const progress =
      (sinceLanding - 0.055) /
      (0.17 - 0.055);

    return frameBetween(
      progress,
      0,
      5
    );
  }

  /*
   * Ascending.
   */
  const ascentEnd = -jumpSpeed * 0.16;

  if (velocityY < ascentEnd) {
    const progress =
      (velocityY + jumpSpeed) /
      (jumpSpeed + ascentEnd);

    return frameBetween(
      progress,
      6,
      13
    );
  }

  /*
   * Apex.
   */
  const apexEnd = jumpSpeed * 0.16;

  if (velocityY <= apexEnd) {
    const progress =
      (velocityY - ascentEnd) /
      (apexEnd - ascentEnd);

    return frameBetween(
      progress,
      14,
      17
    );
  }

  /*
   * Falling.
   *
   * Do NOT enter frames 30-32 here.
   * Those are reserved for a confirmed landing.
   */
  const expectedLandingSpeed =
    jumpSpeed * 0.72;

  const progress =
    (velocityY - apexEnd) /
    (expectedLandingSpeed - apexEnd);

  return frameBetween(
    progress,
    18,
    29
  );
}
