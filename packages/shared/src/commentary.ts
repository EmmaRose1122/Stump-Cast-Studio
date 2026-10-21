import { z } from 'zod';
import type { EngineEvent } from './event';
import type { MatchState } from './match';

export const CommentaryLanguageSchema = z.enum(['hi', 'ur', 'en']);
export type CommentaryLanguage = z.infer<typeof CommentaryLanguageSchema>;

export const CommentaryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoEvents: z.boolean().default(true),
  voice: z.string().default('default'),
  /** Hindi (Devanagari) by default; `ur` is Urdu in Nastaliq script, `en` English. */
  language: CommentaryLanguageSchema.default('hi'),
  /** Use the configured Gemini model for narration, falling back to the local phrasebook. */
  ai: z.boolean().default(true),
  rate: z.number().min(0.5).max(2).default(1.0),
  pitch: z.number().min(0.5).max(2).default(1.0),
  volume: z.number().min(0).max(1).default(1.0),
});
export type CommentaryConfig = z.infer<typeof CommentaryConfigSchema>;

export const CommentaryItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  eventType: z.string().optional(),
  timestamp: z.number(),
  /** So the speaker picks the right voice for the script it is about to read. */
  lang: CommentaryLanguageSchema.optional(),
});
export type CommentaryItem = z.infer<typeof CommentaryItemSchema>;

/**
 * What a commentator actually says. `{b}` batter, `{o}` bowler, `{s}` score, `{n}` a number.
 * Several phrasings per outcome so the same delivery never sounds the same twice.
 */
interface PhraseBook {
  dot: string[];
  one: string[];
  two: string[];
  three: string[];
  four: string[];
  six: string[];
  runs: string[];
  wide: string[];
  wideMany: string[];
  noball: string[];
  wicket: string[];
  fifty: string[];
  hundred: string[];
  overEnd: string[];
  drs: string[];
  inningsEnd: string[];
  newBatter: string[];
  /** Situational tails, appended now and then so a line carries the moment, not just the ball. */
  pressure: string[];
  control: string[];
}

const HINDI: PhraseBook = {
  dot: [
    'खाली गेंद! {o} ने बिल्कुल ठीक लेंथ डाली।',
    'डॉट! {b} ने भीड़ में खेला, रन नहीं बन पाए।',
    'कोई रन नहीं। {b} को गेंद मोड़ना मुश्किल हो गया।',
    'डॉट गेंद! सुंदर डेलिवरी, {b} बिल्कुल बेबस नज़र आए।',
  ],
  one: [
    'एक रन। {b} ने गैप देखा और तेज़ दौड़े।',
    'एक रन, सिंगल ले लिया — समझदारी भरा फ़ैसला।',
    'एक रन से साझेदारी आगे बढ़ी।',
  ],
  two: ['दो रन! फ़ील्डिंग थोड़ी धीमी पड़ गई।', 'एक-दो लेकर {b} ने स्ट्राइक बदल ली।'],
  three: ['तीन रन! गेंद कोने में गई और {b} ने पूरी दौड़ लगाई।', 'बेहतरीन प्लेसमेंट — तीन रन मिले।'],
  four: [
    'शानदार! चौका! {b} का शॉट सीधे बाउंड्री पार।',
    'अरे वाह! कितनी सुंदर ड्राइव, {b} का चौका।',
    'गैप में से निकली गेंद, और {b} ने चौका जड़ दिया।',
    'सीमा रेखा छू गई — यह {b} का चौका है।',
  ],
  six: [
    'छक्का! {b} ने गेंद सीधे स्टैंड में भेज दी!',
    'यह क्या मारा! {o} की गेंद हवा में, {b} का छक्का!',
    'छक्का! {b} ने मिड-विकेट के ऊपर साफ गेंद भेजी।',
  ],
  runs: ['{n} रन मिलते हैं {b} को।'],
  wide: ['वाइड। {o} की गेंद थोड़ी बाहर रही।', 'वाइड! एक्स्ट्रा रन, बल्लेबाज़ को एक और गेंद मिलेगी।'],
  wideMany: ['वाइड, और {n} एक्स्ट्रा रन — {o} को कीमती गेंद जाई।'],
  noball: [
    'नो बॉल! {o} की लाइन चूक गई।',
    'नो बॉल पर {b} ने बढ़िया दंड दिया!',
    'नो बॉल! फ्री हिट का मौका, {b} ने पूरा फ़ायदा उठाया।',
  ],
  wicket: [
    'और यह विकेट! {b} आउट — {o} की गेंद ने काम कर दिया।',
    'बड़ा पल! {b} का विकेट, {o} ने कमाल की गेंद डाली।',
    'आउट! {b} को {o} ने फंसा दिया।',
  ],
  fifty: [
    'अर्धशतक पूरा! {b} की शांत लेकिन असरदार पारी।',
    'पचास रन! {b} ने रनअप को खूबसूरती से संभाला।',
  ],
  hundred: ['शतकेवीर! {b} की पारी ने मैच का रंग बदल दिया।', 'सौ रन पूरे! स्टेडियम {b} के नाम।'],
  overEnd: ['ओवर {n} पूरा। स्कोर {s}।', 'यह ओवर खत्म — स्कोरबोर्ड पर {s}।'],
  drs: ['रिव्यू लिया गया है! फ़ैसला अब थर्ड अंपायर के पास है।'],
  inningsEnd: ['पारी खत्म! अब अगली टीम मैदान में उतरेगी।'],
  newBatter: ['नए बल्लेबाज़ {b} क्रीज़ पर आए हैं।'],
  pressure: ['अब रन रेट का दबाव बढ़ रहा है।', 'ओवर कम हैं और रन ज़्यादा — दबाव साफ महसूस हो रहा है।'],
  control: ['बैटिंग काबू में है, रन आ रहे हैं।', 'रनरेट ठीक है, दबाव गेंदबाज़ों पर।'],
};

const URDU: PhraseBook = {
  dot: [
    'خالی گیند! {o} نے بالکل درست لینت ڈالی۔',
    'ڈاٹ! {b} کوئی رن نہیں بنا سکے۔',
    'خوبصورت ڈیلیوری، {b} مایوس نظر آئے۔',
    'گیند ٹھیک ہوئی لیکن {b} کے ہاتھ سے چھوٹ گئی۔',
    'کوئی رن نہیں — {o} کا کنٹرول برابر ہے۔',
    'عمدہ کی گیند تھی، اور {b} نے اسے مزاح کا موقع بنا دیا۔',
    '{b} نے گیند کو پیٹ میں روکا، {o} کو کچھ نہیں ملا۔',
  ],
  one: [
    'ایک رن۔ {b} نے جگہ دیکھی اور دوڑ لگا دی۔',
    'سنگل لے لیا — سمجھداری بھرا فیصلہ۔',
    'ایک رن کا اضافہ، ساتھی بھی آگے بڑھ گیا۔',
    '{b} نے سنگل لے کر اسٹرائیک برقرار رکھی۔',
    'نرم گیند، ایک رن — رنز کا اکٹھا ہونا شروع ہو گیا۔',
  ],
  two: [
    'دو رن! فیلڈنگ تھوڑی سست پڑی۔',
    'ایک دو لے کر {b} نے سٹرائیک بدل لی۔',
    'دو رن! گہری فیلڈنگ میں گیند تھوڑی دور گئی۔',
  ],
  three: [
    'تین رن! گیند کونے میں گئی اور {b} نے پوری دوڑ لگائی۔',
    'شاندار پلیسمنٹ — تین رن ملے۔',
    'تین رن! {b} نے ہمت نہیں ہاری، میدان بھر گیا۔',
  ],
  four: [
    'شاباش! چوکا! {b} کا شاٹ براہ راست باؤنڈری پار۔',
    'واہ! کتنی خوبصورت ڈرائیو، {b} کا چوکا۔',
    'سرحدی لکیر چھو لی — یہ {b} کا چوکا ہے۔',
    'گیند کے پیچھے سے نکلی، اور {b} نے چوکا جڑ دیا۔',
    'یہ چوکا ان کا پہلا نام ہے — {b} کی تیاری دیکھیے!',
    'عمدہ ہٹا کر مارا، {o} کے لیے ایک لفظ میں چار رن۔',
  ],
  six: [
    'چھکا! {b} نے گیند سیدھی اسٹینڈ میں بھیج دی!',
    'کیا مارا! {o} کی گیند ہوا میں، {b} کا چھکا!',
    'چھ رن! {b} نے بالکل صاف میڈ وکٹ کے اوپر بھیجا۔',
    'چھ رن! {b} نے گیند ایسے ماری کہ وکٹ کیپ بھی نہیں پہنچ سکی۔',
    'چھ رن — {b} نے گیند ایسی ماری کہ ریڈز کے پیچھے ہی رہ گئی۔',
  ],
  runs: ['{n} رن ملتے ہیں {b} کو۔'],
  wide: [
    'وائڈ۔ {o} کی گیند تھوڑی باہر رہی۔',
    'ایکسٹرا رن، بلے باز کو ایک اور گیند ملے گی۔',
    'وائڈ! {o} کے لیے یہ گیند بے فائدہ رہی۔',
  ],
  wideMany: ['وائڈ، اور {n} ایکسٹرا رن — {o} کو قیمتی گیند گئی۔'],
  noball: [
    'نو بال! {o} کی لائن چوک گئی۔',
    'نو بال پر {b} نے بھرپور سزا دی!',
    'نو بال — {b} کے لیے مفت گیند، اور {o} کے لیے اضافی دباؤ۔',
  ],
  wicket: [
    'اور یہ وکٹ! {b} آؤٹ — {o} کی گیند نے کام کر دیا۔',
    'بڑا لمحہ! {b} کا شکار، {o} نے شاندار گیند ڈالی۔',
    'آؤٹ! {b} کو {o} نے پھنسا لیا۔',
    'یہ بڑی وکٹ ہے! {b} کا کل کا اننگز یہیں ختم ہو گیا۔',
    'گلندی گیند تھی، {b} اس کا شکار ہو گئے — {b} آؤٹ!',
  ],
  fifty: [
    'نصف صدی مکمل! {b} کی پرسکون مگر مؤثر اننگز۔',
    'پچاس رن! {b} نے رن اپ آرامی اور مسلسل بہت اچھا رکھا۔',
    'آدھی سنچری! {b} کی بیٹنگ میں کلاس اور اعتماد دونوں ہیں۔',
  ],
  hundred: [
    'سنچری! {b} کی اننگز نے میچ کا رنگ بدل دیا۔',
    'سو رن! {b} کے لیے یہ اننگز اسٹیڈیم کی زمین کا مال ہے۔',
  ],
  overEnd: [
    'اوور {n} مکمل۔ اسکور {s}۔',
    'یہ اوور ختم — اسکور بورڈ {s}۔',
    'اوور {n} گزر گیا، سکیم {s} پر پہنچ گئی ہے۔',
  ],
  drs: ['ریویو لیا گیا! فیصلہ اب تھرڈ امپائر کے پاس ہے۔'],
  inningsEnd: [
    'اننگز ختم! اب اگلی ٹیم میدان میں آئے گی۔',
    'پہلی اننگز مکمل، اب لے چلنے کا وقت ہے۔',
  ],
  newBatter: [
    'نئے بلے باز {b} میدان میں آ گئے ہیں۔',
    'ایک نئے بلے باز {b} کریز پر، اور نئی اننگز کا آغاز ہو گیا۔',
  ],
  pressure: [
    'اب رن ریٹ کا دباؤ بڑھ رہا ہے۔',
    'اوور کم ہیں اور رن زیادہ — دباؤ واضح محسوس ہو رہا ہے۔',
    'ہر گیند اب قیمتی ہے، {o} پر دباؤ بڑھتا جا رہا ہے۔',
  ],
  control: [
    'بیٹنگ قابو میں ہے، رن آ رہے ہیں۔',
    'رن ریٹ ٹھیک ہے، دباؤ گیندبازوں پر ہے۔',
    '{b} آرام سے کھیل رہے ہیں اور اوور اپنے حساب سے لے رہے ہیں۔',
  ],
};

const ENGLISH: PhraseBook = {
  dot: ['No run. {o} bowled a really tight one.', 'Dot ball! {b} could not get it away.'],
  one: ['One run, {b} found the gap and scampered.', 'A single taken, keeping the scoreboard moving.'],
  two: ['Two runs. The fielding was a touch slow.', 'Pushed for a couple, strike rotated.'],
  three: ['Three runs! Placed into the corner, {b} did the extra work.'],
  four: [
    'Racing away for FOUR! {b} found the gap with superb timing.',
    'FOUR! A beautiful drive from {b}, and the fielder has no chance.',
  ],
  six: ['SIX! {b} launches it into the crowd!', 'Maximum! Clean as a whistle from {b} over the ropes.'],
  runs: ['{n} runs for {b}.'],
  wide: ['Wide. {o} drifted down the leg side.', 'Extra run, and another ball for the batter.'],
  wideMany: ['Wide, {n} extras — an expensive delivery for {o}.'],
  noball: ['No ball! {o} overstepped.', 'No ball punished — {b} makes the most of the free hit!'],
  wicket: ['AND THAT IS THE WICKET! {b} falls, and {o} has done it again.', 'Big moment! {b} is out, superbly bowled by {o}.'],
  fifty: ['Fifty up for {b} — a composed, effective innings.'],
  hundred: ['A hundred for {b}! The whole ground comes to its feet.'],
  overEnd: ['End of over {n}. The score reads {s}.'],
  drs: ['Review taken! The decision goes upstairs.'],
  inningsEnd: ['That is the end of the innings. Time for the chase.'],
  newBatter: ['New batter at the crease: {b}.'],
  pressure: ['The required rate is climbing now.', 'Fewer overs, more runs — the pressure is on {o}.'],
  control: ['{b} are in control of this over.', 'Run rate is fine; the pressure is on the bowlers.'],
};

const BOOKS: Record<CommentaryLanguage, PhraseBook> = { hi: HINDI, ur: URDU, en: ENGLISH };

const pick = (lines: string[]): string =>
  lines[Math.floor(Math.random() * lines.length)] ?? lines[0]!;

const say = (
  lang: CommentaryLanguage,
  lines: string[],
  vars: { b?: string; o?: string; s?: string; n?: string | number } = {},
): string =>
  pick(lines)
    .replaceAll('{b}', vars.b ?? '')
    .replaceAll('{o}', vars.o ?? '')
    .replaceAll('{s}', vars.s ?? '')
    .replaceAll('{n}', String(vars.n ?? ''));

const strikerOf = (s: MatchState): string => s.batters.find((b) => b.onStrike)?.name ?? 'Batter';

/** Sometimes true, so a line carries the situation and not only the ball. */
const maybeTail = (lang: CommentaryLanguage, s: MatchState): string => {
  const book = BOOKS[lang];
  const b = strikerOf(s);
  const o = s.bowler?.name ?? 'Bowler';
  const runsNeeded =
    s.runsNeeded ?? (s.target !== undefined ? Math.max(0, s.target - s.score.runs) : undefined);
  const oversDone = s.score.overs + (s.score.balls ?? 0) / 6;
  const totalOvers = s.format === 'ODI' ? 50 : 20;
  const oversLeft = Math.max(0, totalOvers - oversDone);
  const rrr =
    s.rrr ?? (runsNeeded !== undefined && oversLeft > 0 ? runsNeeded / oversLeft : undefined);

  if (runsNeeded !== undefined && rrr !== undefined && rrr > 9 && runsNeeded > 0) {
    return ' ' + say(lang, book.pressure, { b, o });
  }
  if (s.crr > 7 && s.score.wkts <= 3 && Math.random() < 0.3) {
    return ' ' + say(lang, book.control, { b, o });
  }
  return '';
};

/** One short line for a single delivery, so the voice is never silent between the big moments. */
export function buildBallCommentary(s: MatchState, lang: CommentaryLanguage = 'hi'): string | null {
  const last = s.thisOver[s.thisOver.length - 1] ?? s.lastBalls[s.lastBalls.length - 1];
  if (!last) return null;
  const book = BOOKS[lang];
  const b = strikerOf(s);
  const o = s.bowler?.name ?? 'Bowler';
  const tail = maybeTail(lang, s);

  if (last.wicket) return say(lang, book.wicket, { b, o }) + tail;
  if (last.extras?.type === 'wide')
    return say(lang, last.extras.runs > 1 ? book.wideMany : book.wide, { o, n: last.extras.runs });
  if (last.extras?.type === 'noball')
    return say(lang, book.noball, { b, o }) + (last.runs >= 4 ? ' ' + pick(book.six) : '');
  if (last.runs === 0) return say(lang, book.dot, { b, o }) + tail;
  if (last.runs === 1) return say(lang, book.one, { b }) + tail;
  if (last.runs === 2) return say(lang, book.two, { b }) + tail;
  if (last.runs === 3) return say(lang, book.three, { b }) + tail;
  if (last.runs === 4) return say(lang, book.four, { b, o }) + tail;
  if (last.runs === 6) return say(lang, book.six, { b, o }) + tail;
  return say(lang, book.runs, { b, n: last.runs });
}

/** Broadcast commentary for an engine event, in the configured language. */
export function buildEventCommentary(
  event: EngineEvent,
  state?: MatchState,
  lang: CommentaryLanguage = 'hi',
): string {
  const p = event.payload as Record<string, unknown>;
  const book = BOOKS[lang];
  const batter = String(
    p.batter ??
      p.batterName ??
      (Array.isArray(state?.batters) ? state.batters.find((b) => b?.onStrike)?.name : undefined) ??
      (state ? strikerOf(state) : 'Batter'),
  );
  const bowler = String(p.bowler ?? p.bowlerName ?? state?.bowler?.name ?? 'Bowler');
  const score = state ? `${state.score.runs}-${state.score.wkts}` : '';
  const tail = state ? maybeTail(lang, state) : '';

  switch (event.type) {
    case 'FOUR':
      return say(lang, book.four, { b: batter, o: bowler }) + tail;
    case 'SIX':
      return say(lang, book.six, { b: batter, o: bowler }) + tail;
    case 'WICKET':
      return say(lang, book.wicket, { b: String(p.out ?? batter), o: bowler }) + tail;
    case 'FIFTY':
      return say(lang, book.fifty, { b: batter });
    case 'HUNDRED':
      return say(lang, book.hundred, { b: batter });
    case 'OVER_END': {
      const overNum =
        p.over !== undefined ? String(p.over) : state ? String(state.score.overs) : '';
      return say(lang, book.overEnd, { n: overNum, s: score }) + tail;
    }
    case 'NEW_BATTER':
      return say(lang, book.newBatter, { b: String(p.name ?? batter) });
    case 'MILESTONE':
      return p.message ? `${p.message}.` : `${batter} — ahlem mod par pahunche.`;
    case 'DRS':
      return say(lang, book.drs);
    case 'INNINGS_END':
      return say(lang, book.inningsEnd);
    default:
      return p.text ? String(p.text) : `${event.type}`;
  }
}
