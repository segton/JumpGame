import { WIDTH, HEIGHT, PRESETS, nextPlatform, platformX, landing, bounce } from './physics.js';
export const RULES_VERSION = 'cloud-ascent-4';
export const STEP = 1 / 120;
export const RULES = Object.freeze({ maxFloor: 999, startSeconds: 180, timeSeconds: 20, coinPoints: 25, bonusPoints: 100, floorPoints: 10, weaponFloor: 100, coins: 150, points: 60, times: 50, skills: 20 });
export const STAGES = [
  { floor: 0, zh: '山脚客栈', en: 'Mountain inn', sky: 0xc9deed, tint: 0xffffff, tower: 0xffffff, accent: '#d8a64e' },
  { floor: 100, zh: '高山云海', en: 'Sea of clouds', sky: 0xbcdde9, tint: 0xc7eaff, tower: 0xe0ecff, accent: '#8ecbd9' },
  { floor: 300, zh: '云上仙阙', en: 'Floating palace', sky: 0xe7b8d2, tint: 0xffedf5, tower: 0xffdfce, accent: '#eeb8d1' },
  { floor: 500, zh: '月下仙境', en: 'Moonlit realm', sky: 0x28335f, tint: 0x859cce, tower: 0xa5aedc, accent: '#aabce9' },
  { floor: 700, zh: '九霄星河', en: 'Celestial stars', sky: 0x261b53, tint: 0x9e7acb, tower: 0xc395d9, accent: '#cea2ed' },
  { floor: 900, zh: '凌云之巅', en: 'Summit of heaven', sky: 0x253d57, tint: 0xabd9e3, tower: 0xffdb91, accent: '#ffe19b' },
];
export function stageFor(floor) { return STAGES.reduce((result, stage) => floor >= stage.floor ? stage : result, STAGES[0]); }
export function randomSource(seed) { let value = seed >>> 0; return () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296); }
export function rewardSchedule(seed, rules = RULES) {
  const random = randomSource(seed ^ 0x15d42ca3), indices = Array.from({ length: rules.maxFloor }, (_, i) => i + 1);
  for (let i = indices.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [indices[i], indices[j]] = [indices[j], indices[i]]; }
  const schedule = new Map(), quantities = [['coin', rules.coins], ['points', rules.points], ['time', rules.times], ['skill', rules.skills]];
  if (quantities.reduce((sum, [, n]) => sum + n, 0) > rules.maxFloor) throw new Error('Reward counts exceed course length');
  const intro = { coin: 1, time: 3, points: 5, skill: 8 };
  for (const [kind, count] of quantities) if (count && intro[kind] <= rules.maxFloor) schedule.set(intro[kind], kind);
  let cursor = 0;
  for (const [kind, count] of quantities) {
    for (let n = schedule.get(intro[kind]) === kind ? 1 : 0; n < count; n++) {
      while (schedule.has(indices[cursor])) cursor++;
      schedule.set(indices[cursor++], kind);
    }
  }
  return schedule;
}
export function createChallenge(preset = 'relaxed', seed = 1, rules = RULES) {
  const config = PRESETS[preset]; if (!config) throw new Error('Unknown difficulty');
  const random = randomSource(seed), rewards = rewardSchedule(seed, rules);
  const course = [{ id: 'floor-0', index: 0, x: 240, baseX: 240, y: 654, width: 190, primary: true, type: 'normal' }];
  let previous = course[0];
  for (let index = 1; index <= rules.maxFloor; index++) {
    const q = nextPlatform(previous, index, config, random); q.pickup = rewards.get(index) || null;
    if (index === rules.maxFloor) { q.type = 'normal'; q.amplitude = 0; }
    if (index % 6 === 4 && index < rules.maxFloor) {
      const x = Math.max(75, Math.min(WIDTH - 75, WIDTH - q.x));
      course.push({ id: `branch-${index}`, index, x, baseX: x, y: q.y + 45, width: Math.min(62, q.width), type: 'fragile', primary: false, pickup: null });
    }
    course.push(q); previous = q;
  }
  return { rules, preset, seed, config, course, nextCursor: 0, platforms: [], player: { x: 240, y: 636, vy: -config.jump, lean: 0 }, camera: 0, phase: 'playing', ticks: 0, elapsed: 0, remaining: rules.startSeconds, floor: 0, score: 0, coins: 0, pointItems: 0, timeItems: 0, skillItems: 0, bonus: 0, charge: 0, boostActive: false, sinceLanding: .06, lastJumpSpeed: config.jump, weapons: [], nextWeapon: null, hazardRandom: randomSource(seed ^ 0x7fc43510), events: [], pickupFlash: null, reason: null };
}
export function spawnAhead(run) {
  while (run.nextCursor < run.course.length && run.course[run.nextCursor].y > run.camera - 420) run.platforms.push(run.course[run.nextCursor++]);
}
export function collectReward(run, q, previousY) {
  if (!q.pickup || q.collected || q.spent) return false;
  const p = run.player, y = q.y - 38;
  if (Math.abs(p.x - q.x) > 26 || y < Math.min(previousY, p.y) - 40 || y > Math.max(previousY, p.y) + 18) return false;
  q.collected = true; const kind = q.pickup;
  if (kind === 'coin') run.coins++;
  if (kind === 'points') { run.pointItems++; run.bonus += run.rules.bonusPoints; }
  if (kind === 'time') { run.timeItems++; run.remaining += run.rules.timeSeconds; }
  if (kind === 'skill') { run.skillItems++; run.charge = 1; }
  run.pickupFlash = { x: q.x, y, life: .85, kind, amount: kind === 'coin' ? run.rules.coinPoints : kind === 'points' ? run.rules.bonusPoints : kind === 'time' ? run.rules.timeSeconds : 2 };
  run.events.push({ type: 'pickup', x: q.x, y, kind }); return true;
}
// Swept relative-motion collision prevents fast arrows passing through the player.
export function hitWeapon(player, previousY, shot, oldShotY, oldPlayerX = player.x) {
  const x0=shot.x-oldPlayerX, x1=shot.x-player.x;
  const y0=oldShotY-previousY, y1=shot.y-player.y;
  let entry=0, exit=1;
  for(const [a,b,min,max] of [[x0,x1,-16,16],[y0,y1,-45,20]]) {
    const delta=b-a;
    if(Math.abs(delta)<1e-9) { if(a<min || a>max) return false; continue; }
    const t0=(min-a)/delta, t1=(max-a)/delta;
    entry=Math.max(entry,Math.min(t0,t1)); exit=Math.min(exit,Math.max(t0,t1));
  }
  return entry<=exit;
}
export function endRun(run, reason) { run.reason = reason; run.phase = reason === 'complete' ? 'complete' : 'over'; }
export function updateWeapons(run, previousY, previousX = run.player.x) {
  if (run.floor < run.rules.weaponFloor) return;
  if (run.nextWeapon === null) run.nextWeapon = run.elapsed + 4;
  if (run.elapsed >= run.nextWeapon) {
    const rng=run.hazardRandom;
    const x=Math.max(56,Math.min(WIDTH-56,run.player.x+(rng()-.5)*140));
    run.weapons.push({x,y:run.camera-24,warning:.95,speed:320+Math.min(240,run.floor*.24)});
    run.nextWeapon=run.elapsed+Math.max(2.5,7-run.floor/180)+rng()*2;
  }
  for(const shot of run.weapons) {
    if(shot.warning>0) { shot.y=run.camera-24; shot.warning-=STEP; continue; }
    const oldY=shot.y; shot.y+=shot.speed*STEP;
    // Platforms never stop or deflect arrows.
    if(hitWeapon(run.player,previousY,shot,oldY,previousX)) {endRun(run,'weapon');return;}
  }
  run.weapons=run.weapons.filter(s=>s.y<run.camera+HEIGHT+100);
}
export function stepChallenge(run, input = 0) {
  if (run.phase !== 'playing') return;
  run.events = []; run.ticks++; run.elapsed = run.ticks * STEP; run.remaining = Math.max(0, run.remaining - STEP);
  if (run.remaining <= 1e-8) { endRun(run, 'timeout'); return; }
  spawnAhead(run); run.sinceLanding += STEP; if (run.pickupFlash) run.pickupFlash.life -= STEP;
  for (const q of run.platforms) q.x = platformX(q, run.elapsed);
  const p = run.player, previousY = p.y, previousX = p.x, c = run.config, direction = Math.max(-100, Math.min(100, input)) / 100;
  p.x = Math.max(c.edge + 12, Math.min(WIDTH - c.edge - 12, p.x + direction * c.speed * STEP));
  p.lean += (direction - p.lean) * STEP * 12; p.vy += c.gravity * STEP; p.y += p.vy * STEP;
  for (const q of run.platforms) collectReward(run, q, previousY);
  for (const q of run.platforms) {
    if (!landing(p, previousY, q)) continue;
    const boost = run.charge > 0 || q.type === 'fragile';
    bounce(p, q, c, run.charge > 0); if (run.charge) run.charge = 0;
    run.boostActive = boost; run.lastJumpSpeed = Math.abs(p.vy); run.sinceLanding = 0;
    if (q.primary) run.floor = Math.max(run.floor, q.index);
    run.events.push({ type: 'landing', x: q.x, y: q.y, width: q.width, boost, platformType: q.type });
    if (q.primary && q.index === run.rules.maxFloor) endRun(run, 'complete');
    break;
  }
  run.score = run.floor * run.rules.floorPoints + run.coins * run.rules.coinPoints + run.bonus;
  run.height = Math.max(run.height || 0, (636 - p.y) / 10);
  run.camera = Math.min(run.camera, p.y - HEIGHT * .42);
  run.platforms = run.platforms.filter(q => q.y < run.camera + HEIGHT + 100);
  if (run.phase !== 'playing') return;
  updateWeapons(run, previousY, previousX);
  if (p.y - run.camera > HEIGHT + 50) endRun(run, 'fall');
}
export function summary(run) {
  return { phase: run.phase, reason: run.reason, score: run.score, floor: run.floor, maxFloor: run.rules.maxFloor, coinPoints: run.coins*run.rules.coinPoints, completionTime: run.phase === 'complete' ? run.elapsed : null, coins: run.coins, pointItems: run.pointItems, timeItems: run.timeItems, skillItems: run.skillItems, charge: run.charge, boostActive: run.boostActive, height: Math.floor(run.height || 0), elapsed: run.elapsed, remaining: run.remaining, stage: stageFor(run.floor).floor, ticks: run.ticks };
}
export function replay(preset, seed, inputs, ticks, rules = RULES) {
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 240000 || !Array.isArray(inputs) || inputs.length > ticks) throw new Error('Invalid replay length');
  let previous = -1;
  for (const entry of inputs) {
    if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[0]) || entry[0] <= previous || entry[0] >= ticks || !Number.isInteger(entry[1]) || Math.abs(entry[1]) > 100) throw new Error('Invalid replay input');
    previous = entry[0];
  }
  const run = createChallenge(preset, seed, rules); let cursor = 0, input = 0;
  for (let t = 0; t < ticks; t++) {
    if (inputs[cursor]?.[0] === t) input = inputs[cursor++][1];
    stepChallenge(run, input);
    if (run.phase !== 'playing' && t !== ticks - 1) throw new Error('Replay continued after ending');
  }
  return summary(run);
}
