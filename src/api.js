import { createLeaderboardClient } from './leaderboard-client.js';
// Set this to the separately hosted backend's API root; no database credentials belong in this app.
const client = createLeaderboardClient({ baseUrl: import.meta.env.VITE_LEADERBOARD_API_URL || '/api' });
export const demoLeaderboard = new URLSearchParams(location.search).get('leaderboard')==='demo';
const demoClient=createLeaderboardClient({baseUrl:'/api/demo'});
export const leaderboard=demoLeaderboard?demoClient.leaderboard:client.leaderboard;
// Demo browsing never creates ranked runs or submissions.
export const startSession=demoLeaderboard?async()=>null:client.startSession;
export const finishSession=client.finishSession;
export const submitEntry=client.submitEntry;
