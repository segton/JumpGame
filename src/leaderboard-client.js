import { RULES_VERSION } from './game/challenge.js';
export const API_SCHEMA_VERSION = 1;
export const GAME_ID = 'cloud-ascent';
const envelope = () => ({ schemaVersion: API_SCHEMA_VERSION, gameId: GAME_ID, rulesVersion: RULES_VERSION });
export function uploadResult(result) {
  return {
    score: result.score, floor: result.floor, maxFloor: result.maxFloor ?? 999, coinPoints: result.coinPoints ?? result.coins*25, completionTime: result.phase === 'complete' ? result.elapsed : null, coins: result.coins,
    pointItems: result.pointItems, timeItems: result.timeItems, skillItems: result.skillItems,
    elapsed: result.elapsed, remaining: result.remaining,
    completed: result.phase === 'complete', reason: result.reason,
  };
}
function readEntries(data, key = 'entries') {
  if (!Array.isArray(data?.[key]) || data[key].some(row => typeof row.name !== 'string' || !Number.isFinite(row.score) || !Number.isFinite(row.elapsed) || !Number.isInteger(row.rank) || typeof row.runId !== 'string' || !Number.isInteger(row.floor))) throw new Error('Invalid leaderboard response');
  // Whitelist public fields; backend contact columns never become UI state.
  return data[key].map(({rank,name,score,floor,coins,elapsed,runId,coinPoints=coins*25,maxFloor=999,remaining=null,completionTime=elapsed,completedAt=null}) => ({rank,name,score,floor,coins,elapsed,runId,coinPoints,maxFloor,remaining,completionTime,completedAt}));
}
export function createLeaderboardClient({ baseUrl = '/api', fetchImpl = globalThis.fetch } = {}) {
  const base = baseUrl.trim().replace(/\/+$/, '');
  async function request(path, options = {}) {
    const response = await fetchImpl(`${base}${path}`, {
      signal: AbortSignal.timeout(15000), cache: 'no-store', credentials: 'omit', ...options,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
    });
    let data; try { data = await response.json(); } catch { throw new Error('Backend did not return JSON'); }
    if (!response.ok) throw new Error(data.error?.message || data.error || `Backend error ${response.status}`);
    return data;
  }
  const authenticated = (session, payload) => ({ method: 'POST', headers: { Authorization: `Bearer ${session.token}` }, body: JSON.stringify(payload) });
  return {
    async leaderboard(preset) { const data = await request(`/leaderboard?preset=${encodeURIComponent(preset)}&limit=10&gameId=${GAME_ID}`); return {entries:readEntries(data)}; },
    async startSession(preset, name = '') {
      const data = await request('/runs', { method:'POST', body:JSON.stringify({...envelope(),preset,name:name.trim()}) });
      if (typeof data.id !== 'string' || typeof data.token !== 'string' || !Number.isInteger(data.seed) || data.preset !== preset || data.version !== RULES_VERSION) throw new Error('Incompatible run session');
      return data;
    },
    async finishSession(session, record, result) {
      const data = await request(`/runs/${encodeURIComponent(session.id)}/finish`, authenticated(session,{...envelope(),...record,result:uploadResult(result)}));
      if (typeof data.eligible !== 'boolean' || !data.result || !Number.isFinite(data.result.score)) throw new Error('Invalid verification response');
      return data;
    },
    async submitEntry(session, contact) {
      const data = await request(`/runs/${encodeURIComponent(session.id)}/entry`, authenticated(session,{
        ...envelope(),runId:session.id,name:contact.name.trim(),email:contact.email.trim(),phone:contact.phone.trim(),account:contact.account.trim(),
      }));
      if (data.saved !== true) throw new Error('Backend did not confirm the saved record');
      return {saved:true,leaderboard:readEntries(data,'leaderboard')};
    },
  };
}
