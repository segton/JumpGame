import { leaderboard, demoLeaderboard } from './api.js';
import { formatCompletedAt } from './leaderboard-time.js';
import './leaderboard-panel.css';

const en = new URLSearchParams(location.search).get('lang') === 'en';
const language = en ? 'en' : 'zh';
document.documentElement.lang = en ? 'en' : 'zh-Hans';
const labels = en ? {
  title:'Leaderboard', live:'LIVE · refreshes every 5 seconds', demo:'SIMULATION · fictional records',
  hint:'A test record is added about every 10 seconds.', refresh:'Refresh now', loading:'Connecting…',
  empty:'No records yet.', error:'Connection interrupted. Retrying automatically…', updated:'Last synced',
  coins:'Coin points', completed:'Completed at', floors:'floors',
} : {
  title:'排行榜', live:'实时榜单 · 每5秒更新', demo:'模拟榜单 · 虚拟纪录',
  hint:'约每10秒加入一条测试纪录。', refresh:'立即刷新', loading:'连接中…',
  empty:'暂无纪录', error:'连接中断，正在自动重试…', updated:'最近同步',
  coins:'金币积分', completed:'完成时间', floors:'层',
};
const panel = document.querySelector('#panel');
panel.innerHTML = `<header><span class="eyebrow">CLOUD ASCENT / TOP 10</span><h1>${labels.title}</h1><p class="live"><i></i>${demoLeaderboard ? labels.demo : labels.live}</p>${demoLeaderboard ? `<p class="hint">${labels.hint}</p>` : ''}</header><p id="status" role="status">${labels.loading}</p><ol id="rankings"></ol><footer><span>MYT · UTC+8</span><button type="button">${labels.refresh}</button></footer>`;
const status = document.querySelector('#status');
const list = document.querySelector('#rankings');
const button = document.querySelector('button');
let pending = false;
let lastRows = '';
async function refresh() {
  if (pending) return;
  pending = true; button.disabled = true;
  try {
    const { entries } = await leaderboard('relaxed');
    const serialized = JSON.stringify(entries);
    if (serialized !== lastRows) {
      const fragment = document.createDocumentFragment();
      for (const row of entries) {
        const li = document.createElement('li');
        // Player-supplied names are always text, never HTML.
        const rank = document.createElement('span'); rank.className='rank'; rank.textContent=String(row.rank).padStart(2,'0');
        const body = document.createElement('div');
        const name = document.createElement('strong'); name.textContent=row.name;
        const floor = document.createElement('p'); floor.textContent=`${row.floor} / ${row.maxFloor} ${labels.floors}`;
        const coins = document.createElement('p'); coins.className='coins'; coins.textContent=`${labels.coins}: ${row.coinPoints.toLocaleString()}`;
        const date = document.createElement('p'); date.className='date';
        const time = document.createElement('time'); time.textContent=formatCompletedAt(row.completedAt,language);
        if(row.completedAt) time.dateTime=row.completedAt;
        date.append(`${labels.completed}: `,time);
        body.append(name,floor,coins,date);li.append(rank,body);fragment.append(li);
      }
      list.replaceChildren(fragment); lastRows=serialized;
    }
    status.textContent = entries.length ? `${labels.updated}: ${new Intl.DateTimeFormat(en?'en-GB':'zh-CN',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date())}` : labels.empty;
    status.className='';
  } catch {
    // Keep the last successful ranking visible while the connection recovers.
    status.textContent=labels.error;status.className='error';
  } finally { pending=false;button.disabled=false; }
}
button.addEventListener('click',refresh);
const refreshVisible = () => { if(!document.hidden) refresh(); };
setInterval(refreshVisible,5000);
document.addEventListener('visibilitychange',refreshVisible);
window.addEventListener('focus',refreshVisible);
refresh();
