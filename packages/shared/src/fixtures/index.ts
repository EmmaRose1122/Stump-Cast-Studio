import { createBall, createMatchState } from '../factories';
import { runRate, type MatchState } from '../match';

const teamRsa = { id: 'team-rsa', name: 'South Africa', short: 'RSA', color: '#007A4D' };
const teamPak = { id: 'team-pak', name: 'Pakistan', short: 'PAK', color: '#115740' };
const teamEng = { id: 'team-eng', name: 'England', short: 'ENG', color: '#1E3A8A' };

const overBalls = (over: number, runs: number[], batterId: string, bowlerId: string) =>
  runs.map((r, i) => createBall({ over, ball: i + 1, runs: r, batterId, bowlerId }));

/** T20, first innings, 11.3 overs bowled, South Africa 98/2. */
const t20Score = { runs: 98, wkts: 2, overs: 11, balls: 3 };
const t20Over = overBalls(11, [1, 4, 0], 'aiden-markram', 'shaheen-afridi');
export const t20MidInnings: MatchState = createMatchState({
  id: 'fx-t20-mid',
  title: 'South Africa vs Pakistan, 2nd T20I',
  format: 'T20',
  status: 'live',
  venue: 'Newlands, Cape Town',
  toss: { winnerTeamId: 'team-rsa', decision: 'bat' },
  teams: [teamRsa, teamPak],
  innings: [
    { number: 1, battingTeamId: 'team-rsa', score: t20Score, declared: false, allOut: false },
  ],
  currentInnings: 1,
  battingTeamId: 'team-rsa',
  score: t20Score,
  batters: [
    {
      playerId: 'aiden-markram',
      name: 'Aiden Markram',
      runs: 41,
      balls: 28,
      fours: 4,
      sixes: 2,
      onStrike: true,
    },
    {
      playerId: 'heinrich-klaasen',
      name: 'Heinrich Klaasen',
      runs: 12,
      balls: 8,
      fours: 1,
      sixes: 1,
      onStrike: false,
    },
  ],
  bowler: {
    playerId: 'shaheen-afridi',
    name: 'Shaheen Afridi',
    overs: 2,
    balls: 3,
    maidens: 0,
    runs: 21,
    wkts: 1,
  },
  lastBalls: t20Over,
  thisOver: t20Over,
  partnership: { runs: 34, balls: 19 },
  crr: runRate(t20Score),
  projected: 166,
  winProb: { teamA: 0.56, teamB: 0.44 },
  updatedAt: '2026-03-14T15:42:10.000Z',
});

const teamAus = { id: 'team-aus', name: 'Australia', short: 'AUS', color: '#00843D' };

/** Test match, day 4 afternoon session, South Africa leading England in the 3rd innings. */
const testScore = { runs: 241, wkts: 6, overs: 74, balls: 5 };
const testOver = overBalls(74, [0, 1, 0, 0, 4, 0], 'aiden-markram', 'jofra-archer');
export const testDay4: MatchState = createMatchState({
  id: 'fx-test-d4',
  title: 'South Africa vs England, 1st Test',
  format: 'TEST',
  status: 'live',
  venue: 'SuperSport Park, Centurion',
  toss: { winnerTeamId: 'team-rsa', decision: 'bat' },
  teams: [teamRsa, teamEng],
  innings: [
    {
      number: 1,
      battingTeamId: 'team-rsa',
      score: { runs: 312, wkts: 10, overs: 102, balls: 4 },
      declared: false,
      allOut: true,
    },
    {
      number: 2,
      battingTeamId: 'team-eng',
      score: { runs: 289, wkts: 10, overs: 96, balls: 2 },
      declared: false,
      allOut: true,
    },
    { number: 3, battingTeamId: 'team-rsa', score: testScore, declared: false, allOut: false },
  ],
  currentInnings: 3,
  battingTeamId: 'team-rsa',
  score: testScore,
  batters: [
    {
      playerId: 'aiden-markram',
      name: 'Aiden Markram',
      runs: 88,
      balls: 142,
      fours: 9,
      sixes: 1,
      onStrike: true,
    },
    {
      playerId: 'temba-bavuma',
      name: 'Temba Bavuma',
      runs: 34,
      balls: 68,
      fours: 3,
      sixes: 0,
      onStrike: false,
    },
  ],
  bowler: {
    playerId: 'jofra-archer',
    name: 'Jofra Archer',
    overs: 18,
    balls: 5,
    maidens: 3,
    runs: 62,
    wkts: 2,
  },
  lastBalls: testOver,
  thisOver: testOver,
  partnership: { runs: 58, balls: 110 },
  crr: runRate(testScore),
  day: 4,
  session: 'afternoon',
  updatedAt: '2026-03-14T15:42:10.000Z',
});

/** Test match, day 4 evening, South Africa chasing Australia in the 4th innings (StumpCast Studio broadcast). */
const rsaScore = { runs: 52, wkts: 1, overs: 17, balls: 0 };
const rsaOver = [
  createBall({ over: 17, ball: 1, runs: 0, batterId: 'aiden-markram', bowlerId: 'pat-cummins' }),
  createBall({ over: 17, ball: 2, runs: 1, batterId: 'aiden-markram', bowlerId: 'pat-cummins' }),
  createBall({ over: 17, ball: 3, runs: 0, extras: { type: 'noball', runs: 1 }, batterId: 'ryan-rickelton', bowlerId: 'pat-cummins' }),
  createBall({ over: 17, ball: 4, runs: 0, batterId: 'ryan-rickelton', bowlerId: 'pat-cummins' }),
  createBall({ over: 17, ball: 5, runs: 0, batterId: 'ryan-rickelton', bowlerId: 'pat-cummins' }),
  createBall({ over: 17, ball: 6, runs: 0, batterId: 'ryan-rickelton', bowlerId: 'pat-cummins' }),
];
export const testRsaVsAus: MatchState = createMatchState({
  id: 'fx-rsa-aus-d4',
  title: 'Test Match • South Africa vs Australia, 1st Test, Australia tour of South Africa, 2026',
  format: 'TEST',
  status: 'live',
  venue: 'Kingsmead, Durban',
  toss: { winnerTeamId: 'team-aus', decision: 'bat' },
  teams: [teamRsa, teamAus],
  innings: [
    {
      number: 1,
      battingTeamId: 'team-aus',
      score: { runs: 390, wkts: 10, overs: 112, balls: 4 },
      declared: false,
      allOut: true,
    },
    {
      number: 2,
      battingTeamId: 'team-rsa',
      score: { runs: 284, wkts: 10, overs: 88, balls: 2 },
      declared: false,
      allOut: true,
    },
    {
      number: 3,
      battingTeamId: 'team-aus',
      score: { runs: 314, wkts: 6, overs: 82, balls: 0 },
      declared: true,
      allOut: false,
    },
    { number: 4, battingTeamId: 'team-rsa', score: rsaScore, declared: false, allOut: false },
  ],
  currentInnings: 4,
  battingTeamId: 'team-rsa',
  score: rsaScore,
  target: 421,
  lead: -369,
  batters: [
    {
      playerId: 'aiden-markram',
      name: 'Aiden Markram',
      runs: 26,
      balls: 48,
      fours: 3,
      sixes: 0,
      onStrike: true,
    },
    {
      playerId: 'ryan-rickelton',
      name: 'Ryan Rickelton',
      runs: 22,
      balls: 54,
      fours: 2,
      sixes: 0,
      onStrike: false,
    },
  ],
  bowler: {
    playerId: 'pat-cummins',
    name: 'Pat Cummins',
    overs: 6,
    balls: 0,
    maidens: 2,
    runs: 18,
    wkts: 1,
  },
  lastBalls: rsaOver,
  thisOver: rsaOver,
  partnership: { runs: 45, balls: 81 },
  wicketsLeft: 9,
  crr: 3.06,
  rrr: 4.12,
  winProb: { teamA: 0.34, teamB: 0.36 },
  day: 4,
  session: 'evening',
  updatedAt: '2026-03-14T15:42:10.000Z',
});

/** T20 chase completed: Pakistan beat South Africa by 6 wickets. */
const resultScore = { runs: 170, wkts: 4, overs: 18, balls: 2 };
export const t20Result: MatchState = createMatchState({
  id: 'fx-t20-result',
  title: 'South Africa vs Pakistan, 2nd T20I',
  format: 'T20',
  status: 'result',
  venue: 'Newlands, Cape Town',
  toss: { winnerTeamId: 'team-rsa', decision: 'bat' },
  teams: [teamRsa, teamPak],
  innings: [
    {
      number: 1,
      battingTeamId: 'team-rsa',
      score: { runs: 169, wkts: 7, overs: 20, balls: 0 },
      declared: false,
      allOut: false,
    },
    { number: 2, battingTeamId: 'team-pak', score: resultScore, declared: false, allOut: false },
  ],
  currentInnings: 2,
  battingTeamId: 'team-pak',
  score: resultScore,
  target: 170,
  batters: [
    {
      playerId: 'babar-azam',
      name: 'Babar Azam',
      runs: 72,
      balls: 49,
      fours: 7,
      sixes: 2,
      onStrike: true,
    },
    {
      playerId: 'shadab-khan',
      name: 'Shadab Khan',
      runs: 18,
      balls: 9,
      fours: 1,
      sixes: 1,
      onStrike: false,
    },
  ],
  bowler: {
    playerId: 'kagiso-rabada',
    name: 'Kagiso Rabada',
    overs: 4,
    balls: 0,
    maidens: 0,
    runs: 38,
    wkts: 2,
  },
  lastBalls: [],
  thisOver: [],
  partnership: { runs: 29, balls: 14 },
  crr: runRate(resultScore),
  rrr: 0,
  result: 'Pakistan won by 6 wickets',
  updatedAt: '2026-03-14T17:48:00.000Z',
});

export const fixtures = { t20: t20MidInnings, test: testDay4, rsaVsAus: testRsaVsAus, result: t20Result } as const;
