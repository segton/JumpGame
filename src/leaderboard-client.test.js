import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeaderboardClient } from './leaderboard-client.js';
import { RULES_VERSION } from './game/challenge.js';
const session={id:'run-1',token:'secret-run-token',seed:17,preset:'relaxed',version:RULES_VERSION};
const row={rank:1,name:'Other player',score:15465,floor:999,coins:115,elapsed:950,runId:'other-run',coinPoints:2875,maxFloor:999,remaining:70,completionTime:950,completedAt:'2026-10-02T03:00:00Z'};
const result={score:15465,floor:999,coins:115,pointItems:26,timeItems:42,skillItems:13,elapsed:950,remaining:70,phase:'complete',reason:'complete'};
test('external backend receives versioned JSON uploads and public records can be read', async () => {
  const calls=[],responses=[session,{result,eligible:true,rank:2,submitted:false},{saved:true,leaderboard:[row]},{entries:[{...row,email:'private@example.com',phone:'private',account:'private'}]}];
  const client=createLeaderboardClient({baseUrl:'https://backend.example/api/',fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>responses.shift()};}});
  assert.deepEqual(await client.startSession('relaxed','  Test challenger  '),session);
  await client.finishSession(session,{ticks:114000,inputs:[[0,0],[10,100]]},result);
  await client.submitEntry(session,{name:'  New player ',email:'test@example.com',phone:'+6000000000',account:'test-user'});
  assert.deepEqual(await client.leaderboard('relaxed'),{entries:[row]});
  assert.equal(calls[0].url,'https://backend.example/api/runs');
  assert.equal(JSON.parse(calls[0].options.body).schemaVersion,1);assert.equal(JSON.parse(calls[0].options.body).name,'Test challenger');
  const finish=JSON.parse(calls[1].options.body);assert.equal(finish.result.completed,true);assert.equal(finish.result.elapsed,950);assert.equal(finish.ticks,114000);assert.equal(finish.result.coinPoints,2875);assert.equal(finish.result.maxFloor,999);assert.equal(finish.result.completionTime,950);
  const entry=JSON.parse(calls[2].options.body);assert.equal(entry.runId,'run-1');assert.equal(entry.name,'New player');assert.equal(entry.email,'test@example.com');assert.equal(entry.score,undefined);
  assert.equal(calls[2].options.headers.Authorization,'Bearer secret-run-token');
  assert.equal(calls[3].options.headers.Authorization,undefined);assert.equal(calls[3].options.cache,'no-store');
});
test('failed saves and incompatible responses are never reported as success', async () => {
  const client=createLeaderboardClient({fetchImpl:async()=>({ok:false,status:409,json:async()=>({error:'Score is no longer in the top ten'})})});
  await assert.rejects(()=>client.submitEntry(session,{name:'Test',email:'test@example.com',phone:'1234567',account:'test'}),/no longer/);
  const incompatible=createLeaderboardClient({fetchImpl:async()=>({ok:true,json:async()=>({...session,version:'future-version'})})});
  await assert.rejects(()=>incompatible.startSession('relaxed'),/Incompatible/);
  const malformed=createLeaderboardClient({fetchImpl:async()=>({ok:true,json:async()=>({entries:[{name:'Missing score'}]})})});
  await assert.rejects(()=>malformed.leaderboard('relaxed'),/Invalid leaderboard/);
});
