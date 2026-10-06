import assert from 'node:assert/strict';
import { RULES, createChallenge, stepChallenge, summary } from '../src/game/challenge.js';
export const shortRules = {...RULES,maxFloor:1,coins:0,points:0,times:0,skills:0,weaponFloor:100};
export function finishShort(seed, rules = shortRules) {
  const run = createChallenge('relaxed',seed,rules), inputs = []; let last;
  for (let t=0;t<1000 && run.phase === 'playing';t++) {
    const target = run.course.find(q => q.index === 1), difference = target.x-run.player.x;
    const input = Math.abs(difference)<2 ? 0 : Math.sign(difference)*100;
    if (input !== last) {inputs.push([run.ticks,input]);last=input;} stepChallenge(run,input);
  }
  assert.equal(run.phase,'complete'); return {inputs,ticks:run.ticks,result:summary(run)};
}
