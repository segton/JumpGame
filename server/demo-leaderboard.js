import {createStore} from './store.js';
export function createDemoLeaderboard({now=Date.now}={}) {
  const store=createStore(),epoch=now();let sequence=0;
  function insert(at){sequence++;const id='demo-'+sequence,coins=60+sequence%90,elapsed=500+sequence%180,score=9990+coins*25;
    const result={phase:'complete',floor:999,maxFloor:999,coins,coinPoints:coins*25,score,elapsed,remaining:45,completedAt:new Date(at).toISOString()};
    store.db.prepare('INSERT INTO runs(id,token_hash,seed,preset,created,finished,submitted,challenger_name) VALUES(?,?,?,?,?,?,?,?)').run(id,'demo-no-valid-token',1,'relaxed',at-elapsed*1000,JSON.stringify(result),1,'Demo Challenger '+sequence);
    store.db.prepare('INSERT INTO entries(run_id,preset,name,account_key,score,floor,coins,ticks,created) VALUES(?,?,?,?,?,?,?,?,?)').run(id,'relaxed','Demo Challenger '+sequence,id,score,999,coins,elapsed*120,at);
  }
  for(let i=5;i>0;i--)insert(epoch-i*10000);
  let last=epoch;
  return {top(){const current=now();if(current-last>=10000){insert(current);last=current;}
    const rows=store.top();
    // Bound memory during long playtests; only the latest 30 simulated submissions are retained.
    if(sequence>30){const old='demo-'+(sequence-30);store.db.prepare('DELETE FROM entries WHERE run_id=?').run(old);store.db.prepare('DELETE FROM runs WHERE id=?').run(old);}
    return rows;},close(){store.close();}};
}
