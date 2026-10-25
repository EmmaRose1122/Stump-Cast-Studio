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
    'ڈاٹ بال! {o} نے بہترین لائن اور لینتھ پر گیند رکھی۔',
    'کوئی رن نہیں بن سکا، {b} گیند کو سمجھ نہ پائے۔',
    'شاندار گیند! {o} کا پورا کنٹرول، بلے باز بے بس۔',
    'سیدھی فیلڈر کے ہاتھوں میں، کوئی رن نہیں ملے گا۔',
    'خوبصورت ڈیلیوری، بلے باز دفاعی انداز اپنانے پر مجبور۔',
  ],
  one: [
    'ایک رن! {b} نے گیپ میں کھیل کر سنگل مکمل کیا۔',
    'آسانی کے ساتھ سنگل، اور اسٹرائیک روٹیٹ ہو گئی۔',
    'نرم ہاتھوں سے پش کیا، ایک قیمتی رن کا اضافہ۔',
    'ایک رن کے ساتھ شراکت داری آگے بڑھتی ہوئی۔',
  ],
  two: [
    'گیپ میں کھیلا، دو رنز کی کال اور آسانی سے دو مکمل!',
    'تیز رننگ بٹوین دی وکٹس! دو رنز حاصل کر لیے۔',
    'عمدہ پلیسمنٹ، فیلڈر گیند تک پہنچے تب تک دو رنز بن گئے۔',
  ],
  three: [
    'گیند ڈیپ میں گئی، زبردست رننگ اور تین رنز مکمل!',
    'بہترین پلیسمنٹ! بلے بازوں نے دوڑ کر تین رنز بنائے!',
  ],
  four: [
    'شاندار چوکا! {b} کا دلکش شاٹ اور گیند باؤنڈری لائن پار کر گئی!',
    'خوبصورت ٹائمنگ! {b} کے بلے سے نکلی گیند چار رنز کے لیے باہر!',
    'پرفیکٹ شاٹ! فیلڈر بے بس، {b} کے کھاتے میں ایک اور چوکا!',
    'کراؤڈ جھوم اٹھا! {b} کی شاندار کور ڈرائیو اور چار رنز!',
  ],
  six: [
    'اور یہ شاندار چھکا! {b} نے گیند کو کراؤڈ میں پہنچا دیا!',
    'بلند و بالا چھکا! {b} کے بلے سے نکلی گیند سیدھی باؤنڈری کے پار، زبردست ہٹ!',
    'آؤٹ آف دی پارک! کیا زبردست ٹائمنگ ہے {b} کی، مڈ وکٹ کے اوپر سے چھ رنز!',
    'کمال کا شاٹ! {b} کا فلک آف دی رسٹس اور چھ رنز ملیں گے!',
  ],
  runs: ['{n} رنز ملیں گے {b} کو۔'],
  wide: [
    'وائڈ بال! {o} کی گیند آف اسٹمپ سے کافی باہر۔',
    'امپائر کا اشارہ وائڈ بال، ایکسٹرا رن کا اضافہ۔',
  ],
  wideMany: ['وائڈ گیند، اور ساتھ میں {n} اضافی رنز، مہنگی ڈلیوری {o} کے لیے۔'],
  noball: [
    'نو بال! بولر نے کریز اوور اسٹیپ کی، اب فری ہٹ کا موقع!',
    'نو بال کا اشارہ! {b} کو ملے گی فری ہٹ!',
  ],
  wicket: [
    'اور یہ آؤٹ! بڑی وکٹ گر گئی، {b} پویلین واپس!',
    'کلین بولڈ! {o} کی جادوئی گیند، وکٹیں بکھر گئیں!',
    'کیچ آؤٹ! گیند سیدھی فیلڈر کے ہاتھوں میں، {o} کو مل گئی اہم کامیابی!',
    'بہت بڑا بریک تھرو! {b} کی اننگز کا خاتمہ!',
  ],
  fifty: [
    'شاندار نصف سنچری مکمل! {b} نے کمال کی بیٹنگ کرتے ہوئے پچاس رنز بنا لیے!',
    'ففٹی مکمل! بلے باز نے اپنا بلا فضا میں بلند کیا، کراؤڈ داد دے رہا ہے!',
  ],
  hundred: [
    'اور یہ شاندار سنچری! {b} کی تاریخی اور لاجواب بیٹنگ، سو رنز مکمل!',
    'سنچری! اسٹیڈیم میں کھڑے ہو کر شائقین {b} کو داد دے رہے ہیں!',
  ],
  overEnd: [
    'اوور {n} مکمل ہوا، اسکور بورڈ پر مجموعی اسکور ہے {s}۔',
    'اوور ختم، اس وقت ٹیم کا مجموعی اسکور {s} ہے۔',
  ],
  drs: ['ریویو لیا گیا ہے! فیصلہ اب تھرڈ امپائر کے پاس جا رہا ہے۔'],
  inningsEnd: [
    'اننگز کا اختتام! اب دوسری ٹیم ہدف کا تعاقب کرنے میدان میں آئے گی۔',
  ],
  newBatter: [
    'نئے بلے باز {b} کریز پر پہنچ رہے ہیں۔',
  ],
  pressure: [
    'رن ریٹ کا دباؤ اب بڑھ رہا ہے، ہر گیند فیصلہ کن بن چکی ہے۔',
    'اوورز کم ہیں اور رنز زیادہ، بیٹنگ سائیڈ پر دباؤ واضح ہے۔',
  ],
  control: [
    'بلے باز پورے کنٹرول میں نظر آ رہے ہیں، اسکورنگ ریٹ بہت شاندار ہے۔',
    'بیٹنگ سائیڈ میچ پر مکمل گرفت مضبوط کر چکی ہے۔',
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

/** Phonetic normalizer: turns English cricket abbreviations into spoken phonetic Urdu/Hindi so TTS engines speak naturally without stuttering. */
export const normalizeCommentaryForSpeech = (text: string, lang: CommentaryLanguage = 'ur'): string => {
  if (lang === 'ur') {
    return text
      .replace(/\bvs\b/gi, 'بمقابلہ')
      .replace(/\bPAK\b/gi, 'پاکستان')
      .replace(/\bENG\b/gi, 'انگلینڈ')
      .replace(/\bIND\b/gi, 'انڈیا')
      .replace(/\bAUS\b/gi, 'آسٹریلیا')
      .replace(/\bNZ\b/gi, 'نیوزی لینڈ')
      .replace(/\bSA\b/gi, 'جنوبی افریقہ')
      .replace(/\bWI\b/gi, 'ویسٹ انڈیز')
      .replace(/\bSL\b/gi, 'سری لنکا')
      .replace(/\bBAN\b/gi, 'بنگلہ دیش')
      .replace(/\bAFG\b/gi, 'افغانستان')
      .replace(/\bLBW\b/gi, 'ایل بی ڈبلیو')
      .replace(/\bDRS\b/gi, 'ڈی آر ایس')
      .replace(/\bCRR\b/gi, 'کرنٹ رن ریٹ')
      .replace(/\bRRR\b/gi, 'مطلوبہ رن ریٹ')
      .replace(/\bODI\b/gi, 'او ڈی آئی')
      .replace(/\bT20\b/gi, 'ٹی ٹوئنٹی')
      .replace(/\bov(?:ers?)?\b/gi, 'اوورز')
      .replace(/\bwkts?\b/gi, 'وکٹیں')
      .replace(/\brun(?:s)?\b/gi, 'رنز');
  }
  if (lang === 'hi') {
    return text
      .replace(/\bvs\b/gi, 'बनाम')
      .replace(/\bPAK\b/gi, 'पाकिस्तान')
      .replace(/\bENG\b/gi, 'इंग्लैंड')
      .replace(/\bIND\b/gi, 'भारत')
      .replace(/\bAUS\b/gi, 'ऑस्ट्रेलिया')
      .replace(/\bNZ\b/gi, 'न्यूजीलैंड')
      .replace(/\bSA\b/gi, 'दक्षिण अफ्रीका')
      .replace(/\bWI\b/gi, 'वेस्टइंडीज')
      .replace(/\bSL\b/gi, 'श्रीलंका')
      .replace(/\bBAN\b/gi, 'बांग्लादेश')
      .replace(/\bAFG\b/gi, 'अफगानिस्तान')
      .replace(/\bLBW\b/gi, 'एल बी डब्ल्यू')
      .replace(/\bDRS\b/gi, 'डी आर एस')
      .replace(/\bCRR\b/gi, 'करंट रन रेट')
      .replace(/\bRRR\b/gi, 'जरूरी रन रेट')
      .replace(/\bODI\b/gi, 'वनडे')
      .replace(/\bT20\b/gi, 'टी-20');
  }
  return text;
};

/** One short line for a single delivery, so the voice is never silent between the big moments. */
export function buildBallCommentary(s: MatchState, lang: CommentaryLanguage = 'hi'): string | null {
  const last = s.thisOver[s.thisOver.length - 1] ?? s.lastBalls[s.lastBalls.length - 1];
  if (!last) return null;
  const book = BOOKS[lang];
  const b = strikerOf(s);
  const o = s.bowler?.name ?? 'Bowler';
  const tail = maybeTail(lang, s);

  let out: string;
  if (last.wicket) out = say(lang, book.wicket, { b, o }) + tail;
  else if (last.extras?.type === 'wide')
    out = say(lang, last.extras.runs > 1 ? book.wideMany : book.wide, { o, n: last.extras.runs });
  else if (last.extras?.type === 'noball')
    out = say(lang, book.noball, { b, o }) + (last.runs >= 4 ? ' ' + pick(book.six) : '');
  else if (last.runs === 0) out = say(lang, book.dot, { b, o }) + tail;
  else if (last.runs === 1) out = say(lang, book.one, { b }) + tail;
  else if (last.runs === 2) out = say(lang, book.two, { b }) + tail;
  else if (last.runs === 3) out = say(lang, book.three, { b }) + tail;
  else if (last.runs === 4) out = say(lang, book.four, { b, o }) + tail;
  else if (last.runs === 6) out = say(lang, book.six, { b, o }) + tail;
  else out = say(lang, book.runs, { b, n: last.runs });

  return normalizeCommentaryForSpeech(out, lang);
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

  let out: string;
  switch (event.type) {
    case 'FOUR':
      out = say(lang, book.four, { b: batter, o: bowler }) + tail;
      break;
    case 'SIX':
      out = say(lang, book.six, { b: batter, o: bowler }) + tail;
      break;
    case 'WICKET':
      out = say(lang, book.wicket, { b: String(p.out ?? batter), o: bowler }) + tail;
      break;
    case 'FIFTY':
      out = say(lang, book.fifty, { b: batter });
      break;
    case 'HUNDRED':
      out = say(lang, book.hundred, { b: batter });
      break;
    case 'OVER_END': {
      const overNum =
        p.over !== undefined ? String(p.over) : state ? String(state.score.overs) : '';
      out = say(lang, book.overEnd, { n: overNum, s: score }) + tail;
      break;
    }
    case 'NEW_BATTER':
      out = say(lang, book.newBatter, { b: String(p.name ?? batter) });
      break;
    case 'MILESTONE':
      out = p.message ? `${p.message}.` : `${batter} — milestone reached.`;
      break;
    case 'DRS':
      out = say(lang, book.drs);
      break;
    case 'INNINGS_END':
      out = say(lang, book.inningsEnd);
      break;
    default:
      out = p.text ? String(p.text) : `${event.type}`;
  }
  return normalizeCommentaryForSpeech(out, lang);
}
