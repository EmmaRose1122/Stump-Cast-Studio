import type { CommentaryLanguage, MatchState } from '@stumpcast/shared';

export interface CommentaryRequest {
  state: MatchState;
  /** What just happened, in plain terms: the delivery, or the event that fired. */
  moment: string;
  lang: CommentaryLanguage;
  /** `analysis` permits a measured forecast; the facts supplied are still the only source. */
  mode?: 'live' | 'analysis';
}

const LANGUAGE_NAME: Record<CommentaryLanguage, string> = {
  hi: 'Hindi, written in Devanagari script',
  ur: 'Urdu, written in Nastaliq/Arabic script',
  en: 'English',
};

/** Cricket terms the commentator actually uses, in the target script. */
const SCRIPT_NOTE: Record<CommentaryLanguage, string> = {
  hi: 'चौका, छक्का, वाइड, नो बॉल, डॉट, साझेदारी, रन रेट जैसे शब्द इस्तेमाल करें।',
  ur: 'چوکا، چھکا، وائڈ، نو بال، ڈاٹ، شراکدار، رن ریٹ جیسے الفاظ استعمال کریں۔',
  en: 'Use normal broadcast cricket vocabulary.',
};

/** The same verified-facts brief is used by every text model; only the transport differs. */
export const buildCommentaryPrompt = (req: CommentaryRequest): string => {
  const { state: s } = req;
  const striker = s.batters.find((b) => b.onStrike);
  const nonStriker = s.batters.find((b) => !b.onStrike);
  const teamName = (id: string | undefined) =>
    s.teams.find((team) => team.id === id)?.name;
  const battingTeam = teamName(s.battingTeamId);
  const facts = [
    `${s.teams.map((team) => team.name).join(' vs ')} ${s.format} match`,
    battingTeam ? `${battingTeam} batting` : '',
    `Score ${s.score.runs}-${s.score.wkts} after ${s.score.overs}.${s.score.balls} overs`,
    s.innings.length > 1
      ? `Innings: ${s.innings
          .map((innings) => {
            const name = teamName(innings.battingTeamId) ?? 'team';
            return `${name} ${innings.score.runs}/${innings.score.wkts} in ${innings.score.overs}.${innings.score.balls}`;
          })
          .join('; ')}`
      : '',
    striker ? `${striker.name} on strike ${striker.runs}(${striker.balls}), ${striker.fours} fours and ${striker.sixes} sixes` : '',
    nonStriker ? `${nonStriker.name} ${nonStriker.runs}(${nonStriker.balls}), ${nonStriker.fours} fours and ${nonStriker.sixes} sixes` : '',
    s.bowler?.name ? `bowler ${s.bowler.name} ${s.bowler.wkts}-${s.bowler.runs} in ${s.bowler.overs}.${s.bowler.balls}` : '',
    s.target !== undefined ? `target ${s.target}` : '',
    s.runsNeeded !== undefined ? `${s.runsNeeded} runs needed` : '',
    s.ballsLeft !== undefined ? `${s.ballsLeft} balls left` : '',
    s.rrr !== undefined ? `required rate ${s.rrr.toFixed(2)}` : '',
    s.crr !== undefined ? `current rate ${s.crr.toFixed(2)}` : '',
    s.projected !== undefined ? `projected total ${s.projected}` : '',
    s.winProb
      ? `estimated win probability ${s.teams[0]?.name ?? 'team A'} ${Math.round(s.winProb.teamA * 100)} percent, ${s.teams[1]?.name ?? 'team B'} ${Math.round(s.winProb.teamB * 100)} percent`
      : '',
    s.lead !== undefined ? `${s.lead >= 0 ? 'lead' : 'trail by'} ${Math.abs(s.lead)} runs` : '',
    s.partnership ? `partnership ${s.partnership.runs} from ${s.partnership.balls} balls` : '',
    s.day !== undefined ? `day ${s.day}` : '',
    s.session ? `session ${s.session}` : '',
    s.venue ? `venue ${s.venue}` : '',
    s.toss
      ? `toss ${teamName(s.toss.winnerTeamId) ?? 'winner'} chose to ${s.toss.decision}`
      : '',
    s.lastBalls.length > 0
      ? `recent balls: ${s.lastBalls
          .slice(-6)
          .map((ball) =>
            ball.wicket
              ? 'W'
              : ball.extras?.type === 'wide'
                ? 'wd'
                : ball.extras?.type === 'noball'
                  ? 'nb'
                  : String(ball.runs),
          )
          .join(' ')}`
      : '',
  ].filter(Boolean);

  const commentatorRole =
    req.lang === 'ur'
      ? 'You are an Urdu cricket radio commentator on a live broadcast.'
      : req.lang === 'hi'
      ? 'You are a Hindi cricket radio commentator on a live broadcast.'
      : 'You are an English cricket radio commentator on a live broadcast.';
  const analysis = req.mode === 'analysis';

  return [
    analysis
      ? `${commentatorRole} You are now the expert analyst in the box, reading the match alongside the lead commentator.`
      : commentatorRole + ` on this ${s.format} match.`,
    `Reply strictly in ${LANGUAGE_NAME[req.lang]} only. Do not mix any words or script from other languages. ${SCRIPT_NOTE[req.lang]}`,
    `Current situation: ${req.moment}.`,
    `Verified facts: ${facts.join('; ')}.`,
    analysis
      ? 'Write one or two sentences of live tactical analysis, 16 to 42 words. Explain what the fielding side should try, what the batting side needs, or how the current partnership and run rate shape the next few overs. You may give a cautious forecast, but say it as an estimate based only on these facts. Never invent head-to-head records, career statistics, player history, pitch reports, weather, injuries or quotes. If a record or statistic is not explicitly in the verified facts, do not mention it.'
      : 'Write ONE sentence of natural spoken commentary, 6 to 18 words, that a real commentator would say in this exact moment. Vary your opening every time. No player statistics that are not in the verified facts above.',
    'No quotes, no emoji, no markdown, no prefix, no explanation.',
  ].join(' ');
};

/** Keep one live line, or up to two analysis sentences; both must stay speakable. */
export const cleanCommentary = (raw: string | undefined | null, maxSentences = 1): string | null => {
  if (!raw) return null;
  const one = raw
    .replace(/["'“”‘’`]+/g, '')
    .replace(/[*_#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // `!` and `?` stay inside the sentence: a commentary line legitimately starts "छक्का! ...".
  const sentences = one
    .split(/(?<=[۔।.])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const kept = sentences.length > 0 ? sentences.slice(0, maxSentences).join(' ') : one;
  const line = (kept.length >= 8 ? kept : one).trim();
  const limit = maxSentences > 1 ? 260 : 180;
  // A token-capped model answer can stop mid-word. Never put a half sentence on air.
  if (line.length < 8 || line.length > limit || !/[۔।.!?]$/.test(line)) return null;
  return line;
};
