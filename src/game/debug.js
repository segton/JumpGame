import {createChallenge, spawnAhead, STAGES} from './challenge.js';
import {platformX, HEIGHT} from './physics.js';
const shortcuts={Digit7:0,Digit2:100,Digit8:300,Digit4:500,Digit9:700,Digit6:900};
export function debugFloor(event,enabled) {
  if(!enabled || event.repeat || !event.ctrlKey || !event.altKey || !event.shiftKey || event.metaKey) return null;
  return shortcuts[event.code] ?? null;
}
export function createPracticeAt(floor,preset='relaxed',seed=1234) {
  if(!STAGES.some(stage=>stage.floor===floor)) throw new Error('Invalid practice floor');
  const run=createChallenge(preset,seed), index=run.course.findIndex(q=>q.primary && q.index===floor), platform=run.course[index];
  run.floor=floor; run.score=floor*run.rules.floorPoints;
  run.player.x=platformX(platform,0);run.player.y=platform.y-18;
  run.camera=Math.min(0,run.player.y-HEIGHT*.65);
  run.height=Math.max(0,(636-run.player.y)/10);
  run.nextCursor=Math.max(0,index-3);spawnAhead(run);
  run.debug=true;return run;
}
