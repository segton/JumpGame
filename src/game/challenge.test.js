import test from 'node:test';
import assert from 'node:assert/strict';
import { STEP, createChallenge, rewardSchedule, stepChallenge, collectReward, updateWeapons, stageFor, replay } from './challenge.js';
import { bounce, landing, PRESETS } from './physics.js';
import { finishShort, shortRules } from '../../test/support.js';
test('every seeded course has exactly the fixed reward budget and stops at 999', () => {
  for (let seed=1;seed<30;seed++) {
    const schedule = rewardSchedule(seed), course = createChallenge('relaxed',seed).course;
    for (const [kind,quantity] of [['coin',150],['points',60],['time',50],['skill',20]]) assert.equal([...schedule.values()].filter(v => v===kind).length,quantity);
    assert.equal(course.filter(q => q.primary).length,1000);
    assert.equal(course.at(-1).index,999); assert.ok(course.some(q => !q.primary && q.type==='fragile'));
    assert.ok(!course.some(q => q.type==='spring'));
  }
});
test('one-use clouds bounce normally and cracked platforms double jump height then disappear', () => {
  for(const type of ['cloud','fragile']) {
    const q = {x:240,y:200,width:90,type}, p={x:240,y:201,vy:80};
    bounce(p,q,PRESETS.relaxed,false); assert.equal(q.spent,true);
    assert.ok(Math.abs(p.vy**2/PRESETS.relaxed.jump**2-(type === 'fragile' ? 2 : 1))<1e-8);
    p.vy=80; p.y=201; assert.equal(landing(p,190,q),false);
  }
});
test('reward effects score once, extend countdown and consume a skill on the next landing', () => {
  const run=createChallenge('relaxed',5); run.player={x:240,y:180,vy:100,lean:0};
  for(const kind of ['coin','points','time','skill']) {
    const q={x:240,y:218,pickup:kind}; assert.equal(collectReward(run,q,180),true); assert.equal(collectReward(run,q,180),false);
  }
  assert.equal(run.coins,1);assert.equal(run.bonus,100);assert.equal(run.remaining,200);assert.equal(run.charge,1);
  run.course=[];run.nextCursor=0;run.platforms=[{x:240,baseX:240,y:198.5,width:100,type:'normal',primary:true,index:2}];
  stepChallenge(run,0);assert.equal(run.charge,0);assert.equal(run.boostActive,true);assert.equal(run.score,145);
  assert.ok(Math.abs(run.player.vy + PRESETS.relaxed.jump*Math.SQRT2)<1e-8);
});
test('edges clamp without wrapping, countdown expires and ended runs do not advance', () => {
  const run=createChallenge('relaxed',2);run.player.x=52;stepChallenge(run,-100);assert.equal(run.player.x,52);
  run.remaining=STEP;stepChallenge(run,0);assert.equal(run.reason,'timeout');const ticks=run.ticks;stepChallenge(run,100);assert.equal(run.ticks,ticks);
});
test('stage milestones change at exactly 100/300/500/700/900', () => {
  for(const floor of [100,300,500,700,900]) {assert.equal(stageFor(floor).floor,floor);assert.ok(stageFor(floor-1).floor<floor);}
});
test('weapons start at floor 100, warn before firing, and collisions end the run', () => {
  const run=createChallenge();run.elapsed=20;updateWeapons(run,run.player.y);assert.equal(run.nextWeapon,null);
  run.floor=100;updateWeapons(run,run.player.y);assert.equal(run.nextWeapon,24);
  run.elapsed=24;updateWeapons(run,run.player.y);assert.ok(run.weapons[0].warning>0);
  run.weapons=[{x:run.player.x,y:run.player.y-10,direction:1,warning:0,speed:200}];updateWeapons(run,run.player.y);assert.equal(run.reason,'weapon');
});
test('completion and deterministic replay agree, invalid and extended records are rejected', () => {
  for(let seed=0;seed<12;seed++) {const record=finishShort(seed);assert.deepEqual(replay('relaxed',seed,record.inputs,record.ticks,shortRules),record.result);assert.equal(record.result.floor,1);assert.equal(record.result.reason,'complete');}
  assert.throws(() => replay('relaxed',1,[[0,101]],3),/Invalid/);
  const record=finishShort(1);assert.throws(() => replay('relaxed',1,record.inputs,record.ticks+1,shortRules),/after ending/);
  const full=createChallenge('classic',77);full.course=[];full.platforms=[{id:'last',primary:true,index:999,x:240,baseX:240,y:654.5,width:100,type:'normal'}];full.player.vy=100;
  stepChallenge(full,0);assert.equal(full.phase,'complete');assert.equal(full.floor,999);
});
