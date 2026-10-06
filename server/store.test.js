import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore, validateContact } from './store.js';
import { finishShort, shortRules } from '../test/support.js';
const contact={name:'Test challenger',email:'test@example.com',phone:'+60123456789',account:'test-account'};
test('database verifies completion, persists ranking and never returns private contacts', () => {
  const directory=mkdtempSync(join(tmpdir(),'skybound-test-')),path=join(directory,'test.sqlite');let now=100000;
  const store=createStore({path,rules:shortRules,now:()=>now});
  try {
    const session=store.start('relaxed'),record=finishShort(session.seed);now+=record.ticks/120*1000;
    assert.throws(() => store.finish(session.id,'bad',record),/Invalid run/);
    const result=store.finish(session.id,session.token,{...record,score:999999});assert.equal(result.result.score,10);assert.equal(result.eligible,true);
    assert.deepEqual(store.finish(session.id,session.token,record),result);
    const saved=store.submit(session.id,session.token,contact);assert.equal(saved.saved,true);assert.equal(saved.leaderboard[0].coinPoints,0);assert.equal(saved.leaderboard[0].remaining,result.result.remaining);assert.equal(saved.leaderboard[0].completionTime,result.result.elapsed);assert.equal(saved.leaderboard[0].completedAt,new Date(now).toISOString());assert.equal(saved.leaderboard[0].name,contact.name);
    const publicText=JSON.stringify(saved);for(const value of [contact.email,contact.phone,contact.account])assert.ok(!publicText.includes(value));
    assert.throws(() => store.submit(session.id,session.token,contact),/already submitted/);
    store.close();const reopened=createStore({path,rules:shortRules,now:()=>now});assert.equal(reopened.top()[0].score,10);reopened.close();
  } finally { try{store.close();}catch{}rmSync(directory,{recursive:true,force:true}); }
});
test('unfinished runs, early replay and invalid contact data cannot register', () => {
  const store=createStore({rules:shortRules,now:()=>100000});
  try { const s=store.start('relaxed');assert.throws(() => store.submit(s.id,s.token,contact),/completed/);
    assert.throws(() => store.finish(s.id,s.token,{inputs:[],ticks:1}),/not ended/);
    assert.throws(() => validateContact({...contact,email:'bad'}),/email/);
    assert.throws(() => validateContact({...contact,name:' '}),/name/);
    assert.throws(() => validateContact({...contact,phone:'words'}),/phone/);
  } finally {store.close();}
});
test('top-ten eligibility is checked again during submission', () => {
  let now=100000;const store=createStore({rules:shortRules,now:()=>now});
  try {const s=store.start('relaxed'),record=finishShort(s.seed);now+=record.ticks/120*1000;store.finish(s.id,s.token,record);
    for(let i=0;i<10;i++) {const other=store.start('relaxed');store.db.prepare('INSERT INTO entries(run_id,preset,name,account_key,score,floor,coins,ticks,created) VALUES(?,?,?,?,?,?,?,?,?)').run(other.id,'relaxed','test',String(i),100,1,0,1,now);}
    assert.throws(() => store.submit(s.id,s.token,contact),/no longer/);assert.equal(store.top().length,10);
  } finally {store.close();}
});

test('single-mode sessions persist the pre-run name and reject invalid names',()=>{const store=createStore();try{const session=store.start('relaxed','  Moon Walker  ');assert.equal(session.name,'Moon Walker');assert.equal(store.db.prepare('SELECT challenger_name FROM runs WHERE id=?').get(session.id).challenger_name,'Moon Walker');assert.throws(()=>store.start('classic','Test'),/difficulty/);assert.throws(()=>store.start('relaxed','x'.repeat(41)),/name/);}finally{store.close();}});
