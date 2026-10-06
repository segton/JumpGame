# Leaderboard: game uploads and independent display

Run `npm run dev -- --port 5181` from the project directory. This starts Vite and the local reference Node/SQLite API.

## Try the separate panel

- Game with embedded simulated panel: http://localhost:5181/?debug=1&leaderboard=demo
- Standalone English panel: http://localhost:5181/leaderboard.html?leaderboard=demo&lang=en
- Standalone Chinese panel: http://localhost:5181/leaderboard.html?leaderboard=demo&lang=zh

Keep both pages visible to watch the same records update. Each panel fetches every five seconds, without reloading the HTML. The development API adds a fictional result on a read when at least ten seconds have elapsed. Records are shared in server memory across viewers, reset when the server restarts, and never enter the real database. Demo games do not upload ranked runs. No real personal information is needed.

Remove `leaderboard=demo` for real records. The simulator is disabled in production. The actual reference database is `data/leaderboard.sqlite`.

## Embed on another page

```html
<iframe
  title="Leaderboard"
  src="http://localhost:5181/leaderboard.html?leaderboard=demo&lang=en"
  style="width:360px;height:720px;border:0"
></iframe>
```

Replace localhost with the deployed game origin for deployment, and remove the demo parameter. The iframe handles its own API reads; it needs no access to game state and receives no run tokens or contact information from its parent. Configure the deployed site's framing policy to allow the intended parent website.

## Upload a real run

The game already uses these functions from `src/leaderboard-client.js`:

```js
const client = createLeaderboardClient({ baseUrl: '/api' });
const session = await client.startSession('relaxed', challengerName);
// Play with the server-provided seed. The game records inputs as replay.
const verification = await client.finishSession(session, replay, result);
if (verification.eligible) {
  // Present the existing entry form; use details supplied by the player.
  await client.submitEntry(session, { name, email, phone, account });
}
```

This is lifecycle pseudocode: `replay` and `result` come from the game's `run-ended` event, not invented client values. See `verify()` and `submit()` in `src/main.jsx` for the actual integration. The start response provides a run ID, seed, rules version, and bearer token. Finish and entry requests attach that token. The backend verifies the replay, stores the verified result, and assigns `completedAt` at finish processing, not when the later contact form is submitted. Repeated requests for the same run must not create duplicate leaderboard entries.

All verified runs are stored, but only eligible completed runs submitted through the entry form appear in the public ranking. The existing ranking uses score descending, then elapsed time ascending, then earliest record. Changing the displayed fields does not change that ranking rule.

## Read and update

```js
const { entries } = await client.leaderboard('relaxed');
// Equivalent read: GET /api/leaderboard?preset=relaxed&limit=10&gameId=cloud-ascent
```

The standalone implementation is `src/leaderboard-panel.js`. It reads on load, every five seconds while visible, on focus/return, and when Refresh is clicked. Requests cannot overlap. Failed reads retain the previous successful rows and show a retry notice. New results from a separate game appear on the next successful poll; no cross-window messaging is needed. `completedAt` is stored as UTC ISO 8601 and displayed in Malaysia time. Player names are rendered as text, never HTML.

## Connect the separately implemented backend

Implement `backend/leaderboard.openapi.json`. Set `VITE_LEADERBOARD_API_URL=https://your-api.example/api` before building both HTML pages, or proxy the API under the game's own `/api` path. The separate backend must configure CORS for the game/panel origin and GET, POST, OPTIONS, Content-Type, Authorization if using different origins; the reference server intentionally expects same-origin requests. No database credentials belong in Vite variables or either HTML page.

Public responses return only public ranking fields. Keep email, phone, account and run tokens private. The backend owns validation, ranking, timestamps, and duplicate prevention. This project supplies a local reference implementation; deployment and the separately hosted service still need to be configured.
