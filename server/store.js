import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { RULES, RULES_VERSION, replay } from '../src/game/challenge.js';
const digest = value => createHash('sha256').update(value).digest('hex');
export class RequestError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export function validateContact(body) {
  const limits = { name: 40, email: 254, phone: 30, account: 80 }, result = {};
  for (const [key, limit] of Object.entries(limits)) {
    if (typeof body[key] !== 'string') throw new RequestError(`Missing ${key}`);
    result[key] = body[key].trim();
    if (!result[key] || result[key].length > limit || /[\x00-\x1f]/.test(result[key])) throw new RequestError(`Invalid ${key}`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new RequestError('Invalid email');
  if (!/^[+\d() .-]{6,30}$/.test(result.phone)) throw new RequestError('Invalid phone');
  return result;
}
export function createStore({ path = ':memory:', rules = RULES, now = Date.now } = {}) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, seed INTEGER NOT NULL, preset TEXT NOT NULL, created INTEGER NOT NULL, finished TEXT, submitted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY, run_id TEXT NOT NULL UNIQUE REFERENCES runs(id), preset TEXT NOT NULL, name TEXT NOT NULL, account_key TEXT NOT NULL, score INTEGER NOT NULL, floor INTEGER NOT NULL, coins INTEGER NOT NULL, ticks INTEGER NOT NULL, created INTEGER NOT NULL, UNIQUE(preset, account_key));
    CREATE TABLE IF NOT EXISTS contacts (entry_id INTEGER PRIMARY KEY REFERENCES entries(id), email TEXT NOT NULL, phone TEXT NOT NULL, account TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS ranking ON entries(preset,score DESC,ticks ASC,created ASC);`);
  if(!db.prepare('PRAGMA table_info(runs)').all().some(column=>column.name==='challenger_name')) db.exec("ALTER TABLE runs ADD COLUMN challenger_name TEXT NOT NULL DEFAULT ''");
  function top(preset = 'relaxed') {
    return db.prepare('SELECT e.*,r.finished FROM entries e JOIN runs r ON r.id=e.run_id WHERE e.preset=? ORDER BY e.score DESC,e.ticks ASC,e.created ASC,e.id ASC LIMIT 10').all(preset)
      .map((row, index) => { const result=JSON.parse(row.finished || '{}');return ({ coinPoints: result.coinPoints ?? row.coins*rules.coinPoints, maxFloor: result.maxFloor ?? rules.maxFloor, remaining: result.remaining ?? null, completionTime: row.ticks/120, completedAt: result.completedAt ?? null, rank: index + 1, name: row.name, score: row.score, floor: row.floor, coins: row.coins, elapsed: row.ticks / 120, runId: row.run_id });});
  }
  function authorize(id, token) {
    const row = db.prepare('SELECT * FROM runs WHERE id=?').get(id);
    if (!row || typeof token !== 'string' || token.length !== 64 || !timingSafeEqual(Buffer.from(row.token_hash), Buffer.from(digest(token)))) throw new RequestError('Invalid run session', 403);
    if (now() - row.created > 3600_000) throw new RequestError('Run session expired', 410);
    return row;
  }
  function rank(result, preset, accountKey = '') {
    return 1 + Number(db.prepare('SELECT COUNT(*) AS count FROM entries WHERE preset=? AND account_key!=? AND (score>? OR (score=? AND ticks<=?))').get(preset, accountKey, result.score, result.score, result.ticks).count);
  }
  return {
    db, top,
    start(preset = 'relaxed', name = '') {
      if (preset !== 'relaxed') throw new RequestError('Unknown difficulty');
      if(typeof name !== 'string' || name.trim().length>40 || /[\x00-\x1f]/.test(name)) throw new RequestError('Invalid challenger name');
      name=name.trim();
      const id = randomUUID(), token = randomBytes(32).toString('hex'), seed = randomBytes(4).readUInt32LE();
      db.prepare('INSERT INTO runs(id,token_hash,seed,preset,created,challenger_name) VALUES(?,?,?,?,?,?)').run(id, digest(token), seed, preset, now(), name);
      return { id, token, seed, preset, name, rules, version: RULES_VERSION };
    },
    finish(id, token, body) {
      const row = authorize(id, token);
      let result;
      if (row.finished) result = JSON.parse(row.finished);
      else {
        try { result = replay(row.preset, row.seed, body.inputs, body.ticks, rules); } catch (error) { throw new RequestError(error.message); }
        if (!['over', 'complete'].includes(result.phase)) throw new RequestError('Run has not ended');
        const wallSeconds = (now() - row.created) / 1000;
        if (result.elapsed > wallSeconds + 3) throw new RequestError('Replay runs faster than real time');
        if (result.phase === 'complete' && wallSeconds > result.elapsed + Math.max(15, result.elapsed * .05)) throw new RequestError('Challenge exceeded the active timer window');
        result.completedAt=result.phase==='complete'?new Date(now()).toISOString():null;
        db.prepare('UPDATE runs SET finished=? WHERE id=?').run(JSON.stringify(result), id);
      }
      const position = rank(result, row.preset);
      return { result, eligible: result.phase === 'complete' && position <= 10 && !row.submitted, rank: position <= 10 ? position : null, submitted: !!row.submitted };
    },
    submit(id, token, body) {
      const row = authorize(id, token), contact = validateContact(body);
      if (!row.finished || JSON.parse(row.finished).phase !== 'complete') throw new RequestError('Only completed challenges qualify', 403);
      if (row.submitted) throw new RequestError('This run was already submitted', 409);
      const result = JSON.parse(row.finished), key = digest(contact.account.toLowerCase());
      db.exec('BEGIN IMMEDIATE');
      try {
        const old = db.prepare('SELECT * FROM entries WHERE preset=? AND account_key=?').get(row.preset, key);
        if (old && (old.score > result.score || old.score === result.score && old.ticks <= result.ticks)) throw new RequestError('Existing account record is higher', 409);
        if (rank(result, row.preset, key) > 10) throw new RequestError('Score is no longer in the top ten', 409);
        const values = [id, row.preset, contact.name, key, result.score, result.floor, result.coins, result.ticks, now()];
        let entryId;
        if (old) {
          db.prepare('UPDATE entries SET run_id=?,preset=?,name=?,account_key=?,score=?,floor=?,coins=?,ticks=?,created=? WHERE id=?').run(...values, old.id); entryId = old.id;
        } else entryId = db.prepare('INSERT INTO entries(run_id,preset,name,account_key,score,floor,coins,ticks,created) VALUES(?,?,?,?,?,?,?,?,?)').run(...values).lastInsertRowid;
        db.prepare('INSERT INTO contacts(entry_id,email,phone,account) VALUES(?,?,?,?) ON CONFLICT(entry_id) DO UPDATE SET email=excluded.email,phone=excluded.phone,account=excluded.account').run(entryId, contact.email, contact.phone, contact.account);
        db.prepare('UPDATE runs SET submitted=1 WHERE id=?').run(id);
        db.exec('COMMIT');
        return { saved: true, leaderboard: top(row.preset) };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { db.close(); }
  };
}
