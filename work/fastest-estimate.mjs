import {createChallenge} from '../src/game/challenge.js';
// Optimistic vertical-only route. Ignores steering, arrow lanes and pickup access.
// Gives every launch a free double jump in the bound, then only fragile/skill
// departures in the second model. Neither is a verified playable input replay.
const times={freeBoost:[],placedBoost:[]};let heightSum=0;
for(let seed=1;seed<=1000;seed++) {
 const r=createChallenge('relaxed',seed),c=r.config;
 const nodes=[...r.course].sort((a,b)=>b.y-a.y),finish=nodes.findIndex(q=>q.primary&&q.index===999);
 heightSum+=nodes[0].y-nodes[finish].y;
 for(const mode of Object.keys(times)) {
  const best=new Float64Array(nodes.length).fill(Infinity);best[0]=0;
  for(let i=0;i<finish;i++) {
   if(!Number.isFinite(best[i]))continue;
   const boosted=mode==='freeBoost'||nodes[i].type==='fragile'||nodes[i].pickup==='skill';
   // Even with boost available, consider ordinary jumps for this optimistic bound.
   for(const v of boosted?[c.jump,c.jump*Math.SQRT2]:[c.jump]) {
    const peak=v*v/(2*c.gravity);
    for(let j=i+1;j<=finish;j++) {
     const gap=nodes[i].y-nodes[j].y;if(gap>peak)break;
     const t=(v+Math.sqrt(v*v-2*c.gravity*gap))/c.gravity;
     best[j]=Math.min(best[j],best[i]+t);
    }
   }
  }
  times[mode].push(best[finish]);
 }
}
console.log(JSON.stringify({heightMean:heightSum/1000,...Object.fromEntries(Object.entries(times).map(([k,a])=>[k,{min:Math.min(...a),mean:a.reduce((s,x)=>s+x,0)/a.length,max:Math.max(...a)}]))},null,2));
