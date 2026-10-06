# 凌云一跃 / Skybound

Phaser + Vite + React wuxia time-attack prototype. The route sampling, spacing, moving decks and optional side routes follow the supplied Capple Hop game, using this project's wuxia assets and animation.

## Run

Requires Node.js 24 (SQLite is built into Node). With dependencies installed:

```sh
npm run dev
```

This starts both Vite and the leaderboard API on port 3001. Open the Vite URL. To choose a frontend port: `npm run dev -- --port 5182`. `npm test` runs gameplay, animation, sensor, translation and SQLite checks.

For a built app with the API on the same origin:

```sh
npm run build
npm start
```

Open `http://localhost:3001`. `npm run preview` alone previews graphics but does not start the API; offline runs are explicitly practice runs. API_PORT, API_HOST and DB_PATH can configure the server. Remote hosting has not been deployed.

## Challenge rules

- Start with 180 seconds. Finish by landing on floor 999. Time expiry, falling or a weapon hit ends the round.
- Each seeded course contains exactly 150 coins (+25 points), 60 gold gourds (+100 points), 50 hourglasses (+20 seconds), and 20 Lightfoot rewards (next landing launches a jump with twice the normal height). These are spawned totals; missed items are not automatically awarded.
- Every floor adds 10 points. Boosts can skip floors; floor score tracks the highest primary floor landed on.
- Some platforms move left/right with increasing travel at higher floors. Clouds bounce once and disappear. Cracked temporary platforms launch a double-height jump and break immediately. There are no separate springs and no wrapping across screen edges.
- Random hidden weapons start after floor 100 with a red lane warning before firing. Arrows fall vertically from the top, pass through every platform, and collide only with the player. Lanes are locked during the warning; frequency/speed increase as you climb.
- Six separate painted backgrounds transition at floors 100/300/500/700/900: inn valley, high mountain cloud sea, floating palace, moonlit heaven, celestial star sea, and heaven's summit. The side architecture changes from wooden inns to ivory/jade celestial towers. Sky rows are crossfaded into periodic textures; scenery uses distinct parallax speeds. Cloud, cracked, bronze and celestial platforms use a dedicated painted atlas.
- The supplied 33-frame swordsman animation follows actual launch/apex/descent/landing. Wind rings trail the feet during ascent, with cyan trails during boosted jumps.
- A/D, arrow keys, or holding either half of the canvas steer the character. Tilt activates only with valid sensor readings; unavailable/denied/stale readings fall back to left/right controls. Phones generally need HTTPS. Physical device motion still needs a phone playtest.
- The time attack continues when the browser loses focus or is hidden. There is no pause or rest overlay.
- Chinese is the default. The 中文 / EN switch persists locally. `?debug=1` reveals scene preview buttons below the game on desktop and mobile, including a menu visibility toggle. Previews are disabled while playing and do not alter ranked gameplay.

## Leaderboard

The production leaderboard backend is implemented separately. The frontend sends JSON and reads other players' records through a configurable HTTP API. The bundled SQLite service is an optional local reference for testing.

Copy `.env.example` to `.env.local`, set `VITE_LEADERBOARD_API_URL` to the backend API root (for example `https://your-backend.example.com/api`), and restart Vite or rebuild. Use `npm run dev:client` to run only the frontend against that backend. Never put database credentials or a server API secret in this frontend variable.

The complete request/response schemas are in `backend/leaderboard.openapi.json`; hand that file to the backend developer. `backend/upload-example.json` shows the JSON format without real player data. The four calls are: POST `/runs` for an authoritative seed/session, POST `/runs/{id}/finish` to upload score summary and replay, POST `/runs/{id}/entry` to register a qualifying player's contact details, and GET `/leaderboard` to read the current top ten. The frontend refreshes public records every 30 seconds while visible, on window focus and when opening the leaderboard. Errors do not masquerade as successful saves.

Every upload includes `schemaVersion`, `gameId` and `rulesVersion`. All time values are in seconds. Registration references the already verified score using `runId`. The external backend must provide CORS for the frontend origin when hosted on another domain, and must calculate/validate scores before ranking. The API contract documents required headers and fields.

SQLite persists at `data/leaderboard.sqlite` (gitignored). Back up the database and its WAL files together or use a SQLite backup while the service is stopped. There are separate top-ten lists per difficulty, sorted by score descending, then elapsed time ascending. Only completed 999-floor challenges qualify for registration.

The server issues the seed and session token, replays quantized steering inputs against the shared fixed-step simulation, and calculates score itself. It validates run duration, input bounds, ended state, session ownership and top-ten qualification. Qualification is rechecked transactionally on submission. This catches arbitrary score changes; it is basic prototype integrity checking, not competition-grade bot prevention or authenticated account verification.

A qualifying completed run opens the name/email/contact/game-account form. Only name, score, floor, coins and elapsed time are exposed by the leaderboard API. Contact details are kept in a separate database table. One best record per game account and difficulty is retained. No admin export or contact retrieval endpoint is exposed. Sessions last one hour; an unsubmitted session is held only in browser memory.

## Main files

- `src/game/challenge.js`: timer, reward budget, course, weapons, stages, completion and replay; shared by client and server.
- `src/game/physics.js`: reachable route sampling, moving platforms, collision and bounce.
- `src/game/Game.js`: Phaser visuals, camera, particles, real-time input recording.
- `src/main.jsx`, `src/challenge-copy.js`, `src/challenge.css`: bilingual UI, leaderboard and qualification form.
- `server/store.js`, `server/index.js`: SQLite persistence and HTTP API.
- `public/assets/` and `ASSETS.md`: bundled artwork and provenance.

Tune `RULES` and `PRESETS` for the next playtest; restart both services after server rule changes. Shared rule changes require client and server to be updated together.

## Temporary threshold shortcuts
Open `http://localhost:5181/?debug=1`. Hold **Ctrl + Alt + Shift** and press a top-row number (not numpad): **7 → 0**, **2 → 100**, **8 → 300**, **4 → 500**, **9 → 700**, **6 → 900**. Each starts a fresh 180-second unranked practice run at that floor, with the real generated layout and hazards. Works from the menu or during a run; ignores text fields and repeated keys. Remove `?debug=1` to disable shortcuts. These are convenience shortcuts, not a security boundary; server replay remains authoritative.

Difficulty ramps smoothly across floors 440–560 and 640–760. Relaxed platform widths progress 74 → 55 → 38 pixels; classic 62 → 43 → 30. Gaps increase up to normal-jump apex minus 5 pixels. Moving decks increase from up to 60 to 105 pixels of travel and from 1.15 to 2.6 radians/sec, with travel trimmed near boundaries to preserve reachability at either endpoint.

Gameplay rules version is now `cloud-ascent-2`; backend implementations must use this physics version. Side artwork uses a repeating single-storey module from `public/assets/tower-modules-v3.png`, maintaining the same angled projection and narrow 48-pixel display width.

Results now show three groups: floors/maxFloor, coinPoints (coins × 25 only), and timing (remaining seconds plus completionTime seconds; incomplete runs show elapsed and no completion). Public leaderboard reads expose these fields and a server-recorded completedAt UTC timestamp. Existing total score stays internal for the current ranking order; no ranking formula was changed. Legacy records without remaining/completedAt return null. The handoff JSON and OpenAPI describe these additive fields.
Scenery v4 uses six opaque periodic side textures behind gameplay, one per threshold, and a brighter 4px Gaussian-blurred background. Qigong adds an expanded cyan aura, rings, upward streaks and a ×2 marker.

During a threshold practice run, debug controls include Test qigong (charge the next jump) and End practice (show the final breakdown). Both are restricted to practice runs created by the debug shortcuts.

Visual revision v5: removed background brightness/saturation adjustments and white wash; reduced Gaussian blur from 4px to 1px. Side architecture now uses dimensional tiled-roof silhouettes inspired by the PPTX, with six threshold variants behind gameplay.

Single-mode/name revision: the public game offers one progressively harder challenge using the existing relaxed physics preset internally. New classic sessions are rejected. Enter a 1–40 character challenger name before starting; it is included in POST /runs, persisted privately with the run session, and prefilled into the qualifying leaderboard entry form. Contact collection and top-ten eligibility remain at completion. The local SQLite migration adds challenger_name without removing existing runs. Qigong uses subtle foot-level ripples and sparks, with no floating ×2 label or rigid side streaks. From floor 900, platforms use darker blue-grey shading and a silhouette shadow for bright-sky contrast. The existing character frames still follow actual jump velocity; a separate qigong sheet is recommended for a distinct pose cycle.

## Live leaderboard playtest
Run `npm run dev -- --port 5181`, then open `http://localhost:5181/?debug=1&leaderboard=demo`. This uses a separate in-memory SQLite store and the HTTP demo read endpoint. It begins with five fictional records and adds one when polled after each 10-second interval. All tabs share this server-side demo state; the client polls every 5 seconds while visible. The SIMULATION banner identifies test data. Game runs in this view are unranked. Close/restart the dev server to reset the demo. It never writes the real leaderboard database. The endpoint is disabled unless ENABLE_LEADERBOARD_DEMO=1 and NODE_ENV is not production; the dev launcher enables it. Remove leaderboard=demo to return to real records.
Leaderboard rows display completedAt (ISO UTC from the backend) as a date and time in Asia/Kuala_Lumpur / MYT; unknown legacy timestamps show a dash. remaining and elapsed remain in the API and result screen but are not used as the leaderboard completion date.
900+ deck shading is now rendered into runtime textures so it works with Canvas fallback as well as WebGL.
