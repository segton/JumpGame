import {createChallenge} from '../src/game/challenge.js';
// Timing model, not an autonomous playtest. No credit for skipping floors.
const bands=[300,500,700,850,930,999];
const scenarios={clean:[0,0,0,0,0,0],cautious:[.05,.1,.2,.35,.6,.9],slow:[.1,.2,.4,.65,1,1.5]};
const results=Object.fromEntries(Object.keys(scenarios).map(k=>[k,[]]));
const checkpoints=Object.fromEntries(Object.keys(scenarios).map(k=>[k,bands.map(()=>[])]));
const deficits=Object.fromEntries(Object.keys(scenarios).map(k=>[k,0]));
let baseTotal=0,boostTotal=0;
for(let seed=1;seed<=1000;seed++) {
 const run=createChallenge('relaxed',seed),course=run.course.filter(q=>q.primary),c=run.config;
 let base=0,boost=0;const times=Object.fromEntries(Object.keys(scenarios).map(k=>[k,0]));
 let earned=180;const failed={};
 for(let i=1;i<course.length;i++) {
  const prev=course[i-1],next=course[i],gap=prev.y-next.y;
  const b=prev.type==='fragile'||prev.pickup==='skill';
  const v=c.jump*(b?Math.SQRT2:1);
  const t=(v+Math.sqrt(v*v-2*c.gravity*gap))/c.gravity;
  base+=(c.jump+Math.sqrt(c.jump*c.jump-2*c.gravity*gap))/c.gravity;
  boost+=t;
  const band=bands.findIndex(f=>i<=f);
  for(const [key,delays] of Object.entries(scenarios)) {
   times[key]+=t+delays[band]*(2*c.jump/c.gravity);
   if(times[key]>=earned)failed[key]=true;
   if(bands.includes(i))checkpoints[key][band].push(times[key]);
  }
  if(next.pickup==='time')earned+=20;
 }
 baseTotal+=base;boostTotal+=boost;
 for(const key of Object.keys(scenarios)){results[key].push(times[key]);if(failed[key])deficits[key]++;}
}
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
console.log(JSON.stringify({seeds:1000,normalJumpBaseline:baseTotal/1000,boostedNoSkipBaseline:boostTotal/1000,available:1180,extraBounceSeconds:1.14,scenarios:Object.fromEntries(Object.entries(results).map(([key,a])=>[key,{seconds:mean(a),minimum:Math.min(...a),maximum:Math.max(...a),requiredHourglasses:Math.ceil((mean(a)-180)/20),cumulativeSeconds:checkpoints[key].map(mean),runsExhaustingTimeEvenWithAllRewards:deficits[key]}]))},null,2));
