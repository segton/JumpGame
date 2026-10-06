export function screenTilt(beta, gamma, angle = 0) {
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  const radians = angle * Math.PI / 180;
  return gamma * Math.cos(radians) + beta * Math.sin(radians);
}

export function tiltDirection(angle, center) {
  const delta = angle - center,
        magnitude = Math.abs(delta);

  return magnitude <= 2
    ? 0
    : Math.sign(delta) * Math.min(1, (magnitude - 2) / 10);
}

// Sensor availability means receiving finite readings, not merely finding the API.
export class TiltController {
  constructor(onChange, env = window) {
    this.env = env; this.onChange = onChange; this.status = 'idle'; this.value = 0;
    this.center = null; this.lastAngle = null; this.lastReading = 0; this.generation = 0;
    this.handle = event => {
      const screenAngle = this.env.screen?.orientation?.angle ?? this.env.orientation ?? 0;
      const angle = screenTilt(event.beta, event.gamma, screenAngle);
      if (angle === null) return;
      if (screenAngle !== this.screenAngle) { this.screenAngle = screenAngle; this.center = null; }
      this.lastAngle = angle; this.lastReading = this.env.performance.now();
      if (this.center === null) this.center = angle;
      const target = tiltDirection(angle, this.center);
      this.value += (target - this.value) * .35;
      this.setStatus('active'); this.resolveProbe?.(true);
    };
  }
  setStatus(status) { if (this.status !== status) { this.status = status; this.onChange(status); } }
async enable() {
  this.stop();

  const generation = this.generation;
  const api = this.env.DeviceOrientationEvent;

  console.log('[tilt] secure context:', this.env.isSecureContext);
  console.log('[tilt] DeviceOrientationEvent:', !!api);
  console.log(
    '[tilt] requestPermission:',
    typeof api?.requestPermission
  );

  if (!this.env.isSecureContext || !api) {
    console.warn('[tilt] API unavailable');
    this.setStatus('unavailable');
    return false;
  }

  this.setStatus('checking');

  try {
    if (typeof api.requestPermission === 'function') {
      console.log('[tilt] requesting permission');

      const permission = await api.requestPermission();

      console.log('[tilt] permission result:', permission);

      if (permission !== 'granted') {
        if (generation === this.generation) {
          this.setStatus('denied');
        }

        return false;
      }
    }
  } catch (error) {
    console.error(
      '[tilt] permission error:',
      error?.name,
      error?.message
    );

    if (generation === this.generation) {
      this.setStatus('denied');
    }

    return false;
  }

  if (generation !== this.generation) {
    return false;
  }

  return new Promise(resolve => {
    this.resolveProbe = value => {
      this.env.clearTimeout(this.timer);
      this.resolveProbe = null;
      resolve(value);
    };

    console.log('[tilt] listening for deviceorientation');

    this.env.addEventListener(
      'deviceorientation',
      this.handle
    );

    this.timer = this.env.setTimeout(() => {
      console.warn(
        '[tilt] no deviceorientation event after 5 seconds'
      );

      this.env.removeEventListener(
        'deviceorientation',
        this.handle
      );

      this.setStatus('unavailable');
      this.resolveProbe?.(false);
    }, 5000);
  });
}
  direction() {
    if (this.status !== 'active') return 0;
    if (this.env.performance.now() - this.lastReading > 1800) { this.value = 0; this.setStatus('unavailable'); return 0; }
    return this.value;
  }
  recenter() { this.center = this.lastAngle; this.value = 0; }
  stop() {
    this.generation++; this.env.removeEventListener('deviceorientation', this.handle);
    this.env.clearTimeout(this.timer); this.resolveProbe?.(false);
    this.center = null; this.lastAngle = null; this.value = 0;
  }
  useButtons() { this.stop(); this.setStatus('manual'); }
  destroy() { this.stop(); }
}
