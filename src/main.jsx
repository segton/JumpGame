import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createGame } from './game/Game.js';
import { TiltController } from './game/tilt.js';
import { debugFloor } from './game/debug.js';
import { STAGES } from './game/challenge.js';
import { copy } from './i18n.js';
import { challengeCopy } from './challenge-copy.js';
import { leaderboard, startSession, finishSession, submitEntry } from './api.js';
import { formatCompletedAt } from './leaderboard-time.js';
import { demoLeaderboard } from './api.js';
import './style.css';
import './theme.css';
import './challenge.css';
const formatTime = n => `${Math.floor(Math.max(0,n || 0)/60)}:${String(Math.floor(Math.max(0,n || 0)%60)).padStart(2,'0')}`;
function App() {
  const host = useRef(null), game = useRef(null), tilt = useRef(null), starting = useRef(false), presetRef = useRef('relaxed'), endedRef = useRef(null);
  const [state,setState] = useState({phase:'loading',score:0,floor:0,remaining:180,coins:0,stage:0});
  const [language,setLanguage] = useState(() => localStorage.getItem('skybound-language') === 'en' ? 'en' : 'zh');
  const preset='relaxed';
  const nameRef=useRef(''),runNameRef=useRef(''),nameInput=useRef(null);
  const [challengerName,setChallengerName]=useState('');
  const [sensor,setSensor] = useState('idle'), [busy,setBusy] = useState(false);
  const [rows,setRows] = useState([]), [boardError,setBoardError] = useState(false), [boardOpen,setBoardOpen] = useState(false);
  const [notice,setNotice] = useState(''), [verification,setVerification] = useState(''), [entryOpen,setEntryOpen] = useState(false), [saveBusy,setSaveBusy] = useState(false), [saveError,setSaveError] = useState('');
  const [sceneryPreview,setSceneryPreview] = useState(false);
  const t = {...copy[language],...challengeCopy[language],rewardPoints:challengeCopy[language].points,points:copy[language].points,verified:language === 'zh' ? '本局纪录已核验' : 'Run verified'}, debug = new URLSearchParams(location.search).get('debug') === '1';
  const command = (name,value) => game.current?.events.emit('command',name,value);
  const refresh = async () => { const mode = presetRef.current; try { const response = await leaderboard(mode); if (presetRef.current !== mode) return; setRows(response.entries); setBoardError(false); } catch { if (presetRef.current === mode) setBoardError(true); } };
  async function verify(event = endedRef.current) {
    if (!event?.session) return;
    setVerification('verifying');
    try { const response = await finishSession(event.session,event.record,event.result); if (endedRef.current !== event) return; setVerification(response.eligible ? 'top' : event.result.phase === 'complete' ? 'notTop' : 'verified'); setEntryOpen(response.eligible); await refresh(); }
    catch { if (endedRef.current === event) setVerification('verifyError'); }
  }
  async function enableTilt() { if (!tilt.current) return; const enabled = await tilt.current.enable(); if (enabled) tilt.current.recenter(); }
  async function begin() {
    if (starting.current || !game.current) return;
    const name=nameRef.current.trim();
    if(!name){setNotice('nameRequired');nameInput.current?.focus();return;}
    runNameRef.current=name;
    starting.current = true; setBusy(true); setNotice(''); setEntryOpen(false); setVerification(''); setSceneryPreview(false); endedRef.current = null;
    try {
      // Motion permission must be requested directly in this button gesture on iOS.
      const motion = tilt.current?.status === 'idle' ? enableTilt() : Promise.resolve();
      let session = null; try { session = await startSession(presetRef.current,name); } catch { setNotice('offline'); }
      await motion; if (tilt.current?.status === 'active') tilt.current.recenter();
      command('start',session);
    } finally { starting.current = false; setBusy(false); }
  }
  useEffect(() => {
    tilt.current = new TiltController(setSensor); game.current = createGame(host.current,setState,tilt.current);
    game.current.events.on('request-start',begin);
    game.current.events.on('run-ended',event => { endedRef.current = event; verify(event); });
    const jumpToFloor = event => {
      const floor=debugFloor(event,new URLSearchParams(location.search).get('debug')==='1');
      if(floor===null || starting.current || event.target?.closest?.('input,textarea,select,[contenteditable=true]')) return;
      event.preventDefault();endedRef.current=null;setVerification('');setEntryOpen(false);setBoardOpen(false);setNotice('');setSceneryPreview(false);
      command('debug-floor',floor);
    };
    window.addEventListener('keydown',jumpToFloor);
    refresh(); return () => { window.removeEventListener('keydown',jumpToFloor); tilt.current.destroy(); game.current.destroy(true); game.current = null; };
  },[]);
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-Hans' : 'en'; document.title = t.title; localStorage.setItem('skybound-language',language); },[language]);
  useEffect(() => {
    const refreshVisible = () => { if (!document.hidden) refresh(); };
    const timer = setInterval(refreshVisible,5000);
    window.addEventListener('focus',refreshVisible);document.addEventListener('visibilitychange',refreshVisible);
    return () => { clearInterval(timer); window.removeEventListener('focus',refreshVisible);document.removeEventListener('visibilitychange',refreshVisible); };
  },[]);
  async function submit(event) {
    event.preventDefault(); setSaveBusy(true); setSaveError('');
    try { const contact = Object.fromEntries(new FormData(event.currentTarget)); const result = await submitEntry(endedRef.current.session,contact); setRows(result.leaderboard); setVerification('saved'); setEntryOpen(false); }
    catch(error) { setSaveError(`${t.error} (${error.message})`); } finally { setSaveBusy(false); }
  }
  const sensorText = sensor === 'active' ? t.active : sensor === 'checking' ? t.sensorChecking : sensor === 'idle' ? t.idle : sensor === 'denied' ? t.denied : t.manual;
  const motionControls = <div className="motion-controls"><span role="status">{sensorText}</span><div>{sensor === 'active' ? <><button onClick={() => tilt.current.recenter()}>{t.center}</button><button onClick={() => tilt.current.useButtons()}>{t.arrows}</button></> : sensor !== 'checking' && <button onClick={enableTilt}>{t.tryTilt}</button>}</div></div>;
  const stageIndex = Math.max(0,STAGES.findIndex(s => s.floor === state.stage)), stage = STAGES[stageIndex];
  const board = <><div className="panel-kicker">TOP 10</div><h2>{t.board}</h2><p className="board-status" role="status">{demoLeaderboard ? t.demoBoard : t.liveBoard}</p>{boardError ? <p role="status">{t.boardError}</p> : !rows.length ? <p className="empty-board">{t.empty}</p> : <ol className="rank-list">{rows.map(row => <li key={row.runId}><span>{row.rank}</span><div><b>{row.name}</b><small>{row.floor}/{row.maxFloor ?? 999} {t.floorUnit}</small><small>{t.coinPoints}: {row.coinPoints.toLocaleString()}</small><small>{t.completedAt}: <time dateTime={row.completedAt || undefined}>{formatCompletedAt(row.completedAt,language)}</time> (MYT)</small></div></li>)}</ol>}<p className="ranking-note">{t.coinPoints}: 25 / {language === 'zh' ? '金币' : 'coin'}</p></>;
  return <main className="shell" lang={language === 'zh' ? 'zh-Hans' : 'en'} style={{'--stage-accent':stage.accent}}>
    <header><a className="brand" href="."><span className="brand-mark">雲</span>{t.title}<span className="studio"> / {t.edition}</span></a><div className="header-tools"><button className="board-toggle" onClick={() => { refresh(); setBoardOpen(true); }}>{t.board}</button><div className="language-switch" aria-label="Language / 语言"><button aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>中文</button><button aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button></div></div></header>
    <div className="layout">
      <aside className="leaderboard-panel"><iframe className="leaderboard-embed" title={t.board} src={`./leaderboard.html?lang=${language}${demoLeaderboard ? '&leaderboard=demo' : ''}`}/><a className="standalone-board-link" href={`./leaderboard.html?lang=${language}${demoLeaderboard ? '&leaderboard=demo' : ''}`} target="_blank" rel="noopener noreferrer">{language==='zh'?'独立打开排行榜 ↗':'Open separate leaderboard ↗'}</a></aside>
      <section className={`game-frame ${state.phase==='ready'?'is-ready':''} ${debug && sceneryPreview ? 'art-preview' : ''}`} aria-label={t.title}>
        <div className="canvas-host" ref={host}/>
        <div className="hud"><div><span>{t.floor}</span><strong>{state.floor}<small>/999</small></strong></div><div className={state.remaining < 15 ? 'timer urgent' : 'timer'}><span>{t.timer}</span><strong>{formatTime(state.remaining)}</strong></div><div><span>{t.score}</span><strong>{state.score.toLocaleString()}</strong></div></div>
        <div className="stage-chip">{t.stages[stageIndex]} <span>· {state.stage}+</span></div>
        {state.phase === 'playing' && <div className="inventory">◈ {state.coins} / 150 {state.charge > 0 && <span>↑ ×2 · {t.charged}</span>}{state.practice && <small>{t.practice}</small>}</div>}
        {state.phase === 'loading' && <div className="welcome" role="status"><h2>{t.title}</h2><p>{t.loading}</p></div>}
        {state.phase === 'ready' && <div className="welcome"><span className="eyebrow">180″ / 999</span><h2>{t.title}</h2><p>{t.intro}</p><label className="challenger-name">{t.name}<input ref={nameInput} name="challengerName" value={challengerName} maxLength={40} autoComplete="nickname" placeholder={t.namePlaceholder} onFocus={()=>command('typing',true)} onBlur={()=>command('typing',false)} onChange={event=>{nameRef.current=event.target.value;setChallengerName(event.target.value);setNotice(value=>value==='nameRequired'?'':value);}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();begin();}}}/><small>{t.nameHint}</small></label><button className="primary" onClick={begin} disabled={busy || sensor === 'checking'}>{busy ? t.opening : t.start}<span>↑</span></button>{motionControls}<div className="micro">{t.singleModeHint}</div></div>}
        {['over','complete'].includes(state.phase) && <div className="veil"><div className="card"><span className="eyebrow">{state.phase === 'complete' ? '999 / 999' : `${state.floor} / 999`}</span><h2>{state.phase === 'complete' ? t.complete : t[state.reason] || t.over}</h2><dl className="result-breakdown"><div><dt>{t.floorsReached}</dt><dd>{state.floor}<small>/{state.maxFloor ?? 999}</small></dd></div><div><dt>{t.coinPoints}</dt><dd>{(state.coinPoints ?? state.coins*25).toLocaleString()}<small>{state.coins} × 25</small></dd></div><div className="result-timing"><dt>{t.timing}</dt><dd><span>{t.remaining}<b>{formatTime(state.remaining)}</b></span><span>{state.phase === 'complete' ? t.completionTime : t.elapsedTime}<b>{formatTime(state.elapsed)}</b></span>{state.phase !== 'complete' && <small>{t.notCompleted}</small>}</dd></div></dl>{verification && <p role="status">{t[verification]}</p>}{verification === 'verifyError' && <button className="secondary" onClick={() => verify()}>{t.verifyRetry}</button>}{verification === 'top' && <button className="secondary" onClick={() => setEntryOpen(true)}>{t.enter}</button>}<button className="primary" disabled={busy || verification === 'verifying'} onClick={begin}>{busy ? t.opening : t.restart}<span>↗</span></button><button className="secondary" onClick={() => { command('home'); setVerification(''); setNotice(''); }}>{t.backToStart}</button></div></div>}
        {notice && <div className="run-notice" role="status">{t[notice]}</div>}
        <div className="bottom-hint">{state.phase === 'playing' ? sensor === 'active' ? t.tiltHint : t.keysHint : t.bottom}</div>
      </section>
      <aside className="rules-panel"><div className="panel-kicker">{language === 'zh' ? '限时挑战' : 'TIME ATTACK'} / 999</div><h2>{t.rules}</h2><p>{t.intro}</p><h3>{t.rewards}</h3><ul className="reward-legend">{['coin','time','points','skill'].map((kind,index) => <li key={kind}><span className={`reward-icon reward-${index}`}/><span>{t[kind === 'points' ? 'rewardPoints' : kind]}</span></li>)}</ul><p>{t.temporary}</p><p>{t.weapons}</p><small>{t.fixed}</small></aside>
    </div>
    {debug && <section className="scene-debug" aria-label={t.debug}><span>{t.debug} / {t.stage}</span><div><button onClick={()=>{setSceneryPreview(true);command('debug-poof','cloud');}}>{language==='zh'?'云台消散特效':'Cloud poof'}</button><button onClick={()=>{setSceneryPreview(true);command('debug-poof','fragile');}}>{language==='zh'?'跳台消散特效':'Boost poof'}</button>{state.phase==='playing' && state.debugPractice && <><button onClick={()=>command('debug-qi')}>{language==='zh'?'测试轻功':'Test qigong'}</button><button onClick={()=>command('debug-end')}>{language==='zh'?'结束练习':'End practice'}</button></>}{STAGES.map((stage,i) => <button key={stage.floor} aria-pressed={state.stage===stage.floor} disabled={state.phase === 'playing'} onClick={() => {command('preview-stage',stage.floor);setSceneryPreview(true);}}>{stage.floor} · {t.stages[i]}</button>)}<button disabled={state.phase === 'playing'} onClick={() => setSceneryPreview(value => !value)}>{sceneryPreview ? (language === 'zh' ? '显示菜单' : 'Show menu') : (language === 'zh' ? '预览场景' : 'View scenery')}</button></div></section>}
    <footer><span>{t.title} / {t.prototype}</span><span>{t.controls}</span></footer>
    {boardOpen && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label={t.board}>{board}<button className="secondary" onClick={() => setBoardOpen(false)}>{t.close}</button></section></div>}
    {entryOpen && <div className="modal-backdrop"><section className="modal entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-heading"><div className="panel-kicker">TOP 10</div><h2 id="entry-heading">{t.top}</h2><p>{t.privacy}</p><form onSubmit={submit}>{['name','email','phone','account'].map(key => <label key={key}>{t[key]}<input autoFocus={key === 'name'} name={key} defaultValue={key === 'name' ? runNameRef.current : undefined} required maxLength={{name:40,email:254,phone:30,account:80}[key]} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} autoComplete={{name:'name',email:'email',phone:'tel',account:'username'}[key]}/></label>)}{saveError && <p role="alert">{saveError}</p>}<button className="primary" disabled={saveBusy}>{saveBusy ? t.saving : t.submit}</button></form><button className="secondary" disabled={saveBusy} onClick={() => setEntryOpen(false)}>{t.skip}</button></section></div>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);

