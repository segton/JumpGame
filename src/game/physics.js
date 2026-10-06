export const WIDTH = 480, HEIGHT = 760;
// Route sampling and spacing follow Capple Hop, with solid screen edges.
export const PRESETS = {
  relaxed: { gravity: 1000, jump: 570, speed: 300, gap: 118, width: 96, edge: 40 },
  classic: { gravity: 1100, jump: 590, speed: 315, gap: 133, width: 84, edge: 40 },
};
export function landing(player, previousY, platform) {
  return !platform.spent && player.vy > 0 && previousY + 18 <= platform.y && player.y + 18 >= platform.y && Math.abs(player.x - platform.x) < platform.width / 2 + 11;
}
const smooth = (floor, start, end) => { const t = Math.max(0, Math.min(1, (floor-start)/(end-start))); return t*t*(3-2*t); };
export function difficultyAt(floor) {
  const first=smooth(floor,440,620), second=smooth(floor,640,820), summit=smooth(floor,850,930);
  // Keep the softer mid-game, then restore the original summit settings by floor 930.
  return { gap: 5*first+7*second+9*summit, shrink: 10*first+10*second+16*summit, travel: 10*first+15*second+20*summit, frequency: 1.15+.3*first+.4*second+.75*summit, spread: 120+10*first+12*second+18*summit };
}
export function nextPlatform(previous, index, config, random = Math.random) {
  const difficulty = difficultyAt(index);
  const gap = Math.min(config.jump ** 2 / (2*config.gravity)-5, config.gap + random() * 12 + Math.min(6, index * .12) + difficulty.gap);
  const width = Math.max(30, config.width - Math.min(22, index * .35) - difficulty.shrink);
  let amplitude = index >= 3 && index % 4 === 3 ? (Math.min(60, 18 + index * .1) + difficulty.travel) : 0;
  const from = previous.baseX ?? previous.x;
  const flight = (config.jump + Math.sqrt(config.jump ** 2 - 2 * config.gravity * gap)) / config.gravity;
  const budget=config.speed*flight*.90-(previous.amplitude || 0), edge=width/2+(config.edge ?? 18);
  // At the screen edges, trim travel only enough to keep the far endpoint reachable.
  amplitude=Math.max(0,Math.min(amplitude,(budget+from-edge)/2,(budget+WIDTH-edge-from)/2));
  const margin=edge+amplitude;
  const reach = config.speed * flight * .90 - amplitude - (previous.amplitude || 0);
  const candidates = [];
  for (let x = margin; x <= WIDTH - margin; x += 4) {
    if (Math.abs(x - from) >= Math.min(difficulty.spread, reach * .7) && Math.abs(x - from) <= reach) candidates.push(x);
  }
  const baseX = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))] ?? Math.max(margin, Math.min(WIDTH - margin, from));
  const type = amplitude ? 'moving' : index % 9 === 5 ? 'cloud' : index % 11 === 8 ? 'fragile' : 'normal';
  return { id: `floor-${index}`, x: baseX, baseX, amplitude, frequency: difficulty.frequency, phase: index * 1.7, y: previous.y - gap, width, index, type, primary: true, pickup: index === 1 || index % 3 === 0, collected: false };
}
export function platformX(platform, elapsed) {
  return (platform.baseX ?? platform.x) + (platform.amplitude || 0) * Math.sin(elapsed * (platform.frequency ?? 1.15) + (platform.phase || 0));
}
export function bounce(player, platform, config, charged = false) {
  if (platform.spent) return false;
  player.y = platform.y - 18;
  player.vy = -config.jump * (platform.type === 'fragile' || charged ? Math.SQRT2 : 1);
  if (platform.type === 'cloud' || platform.type === 'fragile') platform.spent = true;
  return true;
}
export function collectPickup(run, platform, previousY) {
  if (!platform.pickup || platform.collected) return false;
  const coinY = platform.y - 38, player = run.player;
  const top = Math.min(previousY, player.y) - 40, bottom = Math.max(previousY, player.y) + 18;
  if (Math.abs(player.x - platform.x) > 26 || coinY < top || coinY > bottom) return false;
  platform.collected = true; run.coins++; run.score = run.floor * 10 + run.coins * 25;
  run.pickupFlash = { x: platform.x, y: coinY, life: .85 };
  return true;
}
export function parallaxY(worldY, camera, speed, cycle) {
  return ((worldY - camera * speed + 300) % cycle + cycle) % cycle - 300;
}
export function createRun(config, random = Math.random) {
  const platforms = [{ id: 'floor-0', x: 240, baseX: 240, y: 654, width: 190, index: 0, type: 'normal', primary: true }];
  for (let i = 1; i < 14; i++) platforms.push(nextPlatform(platforms.at(-1), i, config, random));
  return { player: { x: 240, y: 636, vy: -config.jump }, platforms, camera: 0, floor: 0, coins: 0, score: 0, elapsed: 0 };
}

