import test from 'node:test';
import assert from 'node:assert/strict';
import {difficultyAt,nextPlatform,PRESETS} from './physics.js';
import {createChallenge,updateWeapons,hitWeapon,STEP,STAGES,stepChallenge,replay} from './challenge.js';
import {debugFloor,createPracticeAt} from './debug.js';
test('500 and 700 ramps stay gradual with room to correct landings',()=>{
  for(const c of Object.values(PRESETS)) {
    const q=f=>nextPlatform({x:240,baseX:240,y:0},f,c,()=>.5);
    const low=q(399),mid=q(599),high=q(799);
    assert.ok(mid.width<low.width && high.width<mid.width);
    assert.ok(low.width-mid.width<=10 && mid.width-high.width<=11);
    assert.ok(high.width>=42);
    assert.ok(-mid.y>-low.y && -high.y>=-mid.y);
    assert.ok(mid.amplitude>low.amplitude && high.amplitude>mid.amplitude);
    assert.ok(high.frequency*high.amplitude>low.frequency*low.amplitude);
    assert.ok(high.frequency*high.amplitude<2.4*low.frequency*low.amplitude);
  }
  for(let f=440;f<850;f++) assert.ok(Math.abs(difficultyAt(f+1).shrink-difficultyAt(f).shrink)<.09);
  const mid=nextPlatform({x:240,y:0},500,PRESETS.relaxed,()=>.5);
  const late=nextPlatform({x:240,y:0},700,PRESETS.relaxed,()=>.5);
  assert.ok(mid.width>=70 && late.width>=60);
  assert.ok(-late.y<140);
});
test('summit ramps from 850 to the original maximum at 930 and then plateaus',()=>{
  const start=difficultyAt(850),end=difficultyAt(930);
  assert.deepEqual(start,difficultyAt(820));
  const original={gap:21,shrink:36,travel:45,frequency:2.6,spread:160};
  for(const key of Object.keys(original)) {
    assert.ok(Math.abs(end[key]-original[key])<1e-10);
    assert.ok(Math.abs(difficultyAt(890)[key]-(start[key]+end[key])/2)<1e-10);
    for(let floor=850;floor<930;floor++) {
      const delta=difficultyAt(floor+1)[key]-difficultyAt(floor)[key];
      assert.ok(delta>=0 && delta<(end[key]-start[key])*.02);
    }
  }
  assert.deepEqual(end,difficultyAt(999));
  assert.equal(nextPlatform({x:240,y:0},930,PRESETS.relaxed,()=>.5).width,38);
});
test('top arrows keep their lane, pierce platforms and can be dodged',()=>{
  const r=createChallenge();r.floor=500;r.elapsed=10;r.nextWeapon=10;
  updateWeapons(r,r.player.y);const shot=r.weapons[0];assert.equal(shot.y,r.camera-24);assert.ok(shot.warning>0);
  const x=shot.x;shot.warning=0;shot.y=100;r.player.x=x+60;r.platforms=[{x,y:102,width:150}];
  for(let i=0;i<40;i++) updateWeapons(r,r.player.y);
  assert.equal(shot.x,x);assert.ok(shot.y>102);assert.equal(r.phase,'playing');
  r.player.x=x;r.player.y=shot.y+10;updateWeapons(r,r.player.y);assert.equal(r.reason,'weapon');
  assert.equal(hitWeapon({x:100,y:150},150,{x:100,y:300},0),true);
  assert.equal(hitWeapon({x:150,y:150},150,{x:100,y:300},0),false);
});
test('hidden chords require debug mode and all modifiers; practice starts at every threshold',()=>{
  const e={code:'Digit9',ctrlKey:true,altKey:true,shiftKey:true};
  assert.equal(debugFloor(e,true),700);assert.equal(debugFloor(e,false),null);assert.equal(debugFloor({...e,altKey:false},true),null);
  assert.equal(debugFloor({...e,repeat:true},true),null);
  for(const stage of STAGES) {
    const r=createPracticeAt(stage.floor);assert.equal(r.floor,stage.floor);assert.equal(r.debug,true);assert.equal(r.remaining,180);
    assert.ok(r.platforms.some(q=>q.primary && q.index===stage.floor));assert.ok(r.player.y-r.camera>0 && r.player.y-r.camera<760);
    stepChallenge(r,0);assert.equal(r.phase,'playing');
  }
  assert.throws(()=>createPracticeAt(501));
  const r=createPracticeAt(700);let ticks=0;while(r.phase==='playing' && ticks<1000){stepChallenge(r,100);ticks++;}
  const verified=replay('relaxed',1234,[[0,100]],166);assert.ok(verified.floor<100); // Replay cannot reproduce a floor skip.
});
