import { z } from 'zod';
import type { MatchState } from './match';
import type { EngineEvent } from './event';

export const CommentatorGenderSchema = z.enum(['male', 'female']);
export type CommentatorGender = z.infer<typeof CommentatorGenderSchema>;

export const CommentatorRoleSchema = z.enum(['play_by_play', 'color', 'duo']);
export type CommentatorRole = z.infer<typeof CommentatorRoleSchema>;

export const CommentatorPersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  gender: CommentatorGenderSchema,
  role: CommentatorRoleSchema,
  /** The Gemini TTS voice name for this persona */
  voiceName: z.string(),
  /** Language/script this persona excels at */
  primaryLanguage: z.enum(['hi', 'ur', 'en']),
  /** Personality traits that affect phrasing */
  style: z.object({
    /** How excited they get on big moments (0-1) */
    excitement: z.number().min(0).max(1),
    /** How much technical detail they add (0-1) */
    technicality: z.number().min(0).max(1),
    /** How conversational/casual they are (0-1) */
    conversational: z.number().min(0).max(1),
    /** Favorite catchphrases they sprinkle in */
    catchphrases: z.array(z.string()),
  }),
  /** Urdu-specific voice settings */
  urduVoice: z.object({
    male: z.string().optional(),
    female: z.string().optional(),
  }).optional(),
});

export type CommentatorPersona = z.infer<typeof CommentatorPersonaSchema>;

export const CommentaryPairSchema = z.object({
  id: z.string(),
  name: z.string(),
  playByPlay: CommentatorPersonaSchema,
  color: CommentatorPersonaSchema,
  /** When this pair comments together */
  chemistry: z.enum(['professional', 'friendly', 'banter']),
});

export type CommentaryPair = z.infer<typeof CommentaryPairSchema>;

export const AdvancedCommentaryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoEvents: z.boolean().default(true),
  continuousMode: z.boolean().default(true),
  language: z.enum(['hi', 'ur', 'en']).default('ur'),
  ai: z.boolean().default(true),
  rate: z.number().min(0.5).max(2).default(1.0),
  pitch: z.number().min(0.5).max(2).default(1.0),
  volume: z.number().min(0).max(1).default(1.0),
  /** Selected commentator pair for duo mode */
  selectedPair: z.string().optional(),
  /** Individual voice overrides for each persona */
  voiceOverrides: z.record(z.string(), z.string()).default({}),
  /** Minimum gap between commentary lines (ms) */
  minGapMs: z.number().min(1000).max(30000).default(8000),
  /** Enable conversational filler between balls */
  fillerLines: z.boolean().default(true),
  /** Enable tactical analysis during quiet periods */
  tacticalAnalysis: z.boolean().default(true),
});

export type AdvancedCommentaryConfig = z.infer<typeof AdvancedCommentaryConfigSchema>;

export const CommentaryContextSchema = z.object({
  matchState: z.any(),
  lastEvent: z.any().nullable(),
  lastBall: z.any().nullable(),
  overProgress: z.number(),
  partnershipRuns: z.number(),
  partnershipBalls: z.number(),
  requiredRunRate: z.number().nullable(),
  currentRunRate: z.number(),
  wicketsInHand: z.number(),
  powerplayActive: z.boolean(),
  deathOversActive: z.boolean(),
  momentum: z.enum(['batting', 'bowling', 'neutral']),
  pressureLevel: z.enum(['low', 'medium', 'high', 'extreme']),
});

export type CommentaryContext = z.infer<typeof CommentaryContextSchema>;

export const GeneratedCommentarySchema = z.object({
  id: z.string(),
  text: z.string(),
  speaker: CommentatorPersonaSchema,
  eventType: z.string().optional(),
  timestamp: z.number(),
  lang: z.enum(['hi', 'ur', 'en']),
  context: CommentaryContextSchema,
});

export type GeneratedCommentary = z.infer<typeof GeneratedCommentarySchema>;

const COMMENTATOR_PERSONAS: CommentatorPersona[] = [
  // Urdu (ur)
  {
    id: 'raza_male_play',
    name: 'Raza Ahmed',
    gender: 'male',
    role: 'play_by_play',
    voiceName: 'Kore',
    primaryLanguage: 'ur',
    style: {
      excitement: 0.8,
      technicality: 0.6,
      conversational: 0.4,
      catchphrases: ['شاندار!', 'کیا بات ہے!', 'زبردست!', 'ما شاء اللہ!'],
    },
    urduVoice: { male: 'Kore', female: 'Puck' },
  },
  {
    id: 'ali_male_color',
    name: 'Ali Hassan',
    gender: 'male',
    role: 'color',
    voiceName: 'Puck',
    primaryLanguage: 'ur',
    style: {
      excitement: 0.6,
      technicality: 0.9,
      conversational: 0.7,
      catchphrases: ['ذہن میں رکھو', 'تکنیکی طور پر', 'استراتژی یہ ہے', 'میدان کی صورت حال'],
    },
    urduVoice: { male: 'Puck', female: 'Charon' },
  },
  {
    id: 'zara_female_play',
    name: 'Zara Khan',
    gender: 'female',
    role: 'play_by_play',
    voiceName: 'Aoede',
    primaryLanguage: 'ur',
    style: {
      excitement: 0.85,
      technicality: 0.5,
      conversational: 0.6,
      catchphrases: ['کیا شاٹ!', 'بہت خوب!', 'لاجواب!', 'دل باغ باغ ہو گیا!'],
    },
    urduVoice: { male: 'Fenrir', female: 'Aoede' },
  },
  {
    id: 'sana_female_color',
    name: 'Sana Malik',
    gender: 'female',
    role: 'color',
    voiceName: 'Charon',
    primaryLanguage: 'ur',
    style: {
      excitement: 0.5,
      technicality: 0.85,
      conversational: 0.8,
      catchphrases: ['دیکھتے ہیں', 'استراتژی', 'میدان میں تبدیلی', 'بولر کے لیے چیلنج'],
    },
    urduVoice: { male: 'Orus', female: 'Charon' },
  },

  // Hindi (hi)
  {
    id: 'vikram_male_play',
    name: 'Vikram Sharma',
    gender: 'male',
    role: 'play_by_play',
    voiceName: 'Kore',
    primaryLanguage: 'hi',
    style: {
      excitement: 0.85,
      technicality: 0.6,
      conversational: 0.4,
      catchphrases: ['शानदार!', 'क्या बात है!', 'जबरदस्त!', 'बेहतरीन शॉट!'],
    },
    urduVoice: { male: 'Kore', female: 'Puck' },
  },
  {
    id: 'rahul_male_color',
    name: 'Rahul Verma',
    gender: 'male',
    role: 'color',
    voiceName: 'Puck',
    primaryLanguage: 'hi',
    style: {
      excitement: 0.6,
      technicality: 0.9,
      conversational: 0.7,
      catchphrases: ['ध्यान रहे', 'तकनीकी तौर पर', 'रणनीति यह है', 'मैदान की स्थिति'],
    },
    urduVoice: { male: 'Puck', female: 'Charon' },
  },
  {
    id: 'ananya_female_play',
    name: 'Ananya Patel',
    gender: 'female',
    role: 'play_by_play',
    voiceName: 'Aoede',
    primaryLanguage: 'hi',
    style: {
      excitement: 0.85,
      technicality: 0.5,
      conversational: 0.6,
      catchphrases: ['क्या शॉट है!', 'बहुत खूब!', 'लाजवाब!', 'दिल जीत लिया!'],
    },
    urduVoice: { male: 'Fenrir', female: 'Aoede' },
  },
  {
    id: 'priya_female_color',
    name: 'Priya Sharma',
    gender: 'female',
    role: 'color',
    voiceName: 'Charon',
    primaryLanguage: 'hi',
    style: {
      excitement: 0.5,
      technicality: 0.85,
      conversational: 0.8,
      catchphrases: ['देखते हैं', 'रणनीति', 'मैदान में बदलाव', 'बॉलर के लिए चुनौती'],
    },
    urduVoice: { male: 'Orus', female: 'Charon' },
  },

  // English (en)
  {
    id: 'michael_male_play',
    name: 'Michael Vaughan',
    gender: 'male',
    role: 'play_by_play',
    voiceName: 'Kore',
    primaryLanguage: 'en',
    style: {
      excitement: 0.85,
      technicality: 0.6,
      conversational: 0.4,
      catchphrases: ['Magnificent!', 'Shot of the day!', 'Pure class!', 'Unbelievable strike!'],
    },
    urduVoice: { male: 'Kore', female: 'Puck' },
  },
  {
    id: 'david_male_color',
    name: 'David Lloyd',
    gender: 'male',
    role: 'color',
    voiceName: 'Puck',
    primaryLanguage: 'en',
    style: {
      excitement: 0.65,
      technicality: 0.9,
      conversational: 0.7,
      catchphrases: ['Start the car!', 'Tactically speaking', 'Look at that field placement', 'Under pressure here'],
    },
    urduVoice: { male: 'Puck', female: 'Charon' },
  },
  {
    id: 'sarah_female_play',
    name: 'Sarah Taylor',
    gender: 'female',
    role: 'play_by_play',
    voiceName: 'Aoede',
    primaryLanguage: 'en',
    style: {
      excitement: 0.85,
      technicality: 0.5,
      conversational: 0.6,
      catchphrases: ['What a delivery!', 'Brilliant batting!', 'Sensational!', 'Absolute perfection!'],
    },
    urduVoice: { male: 'Fenrir', female: 'Aoede' },
  },
  {
    id: 'charlotte_female_color',
    name: 'Charlotte Edwards',
    gender: 'female',
    role: 'color',
    voiceName: 'Charon',
    primaryLanguage: 'en',
    style: {
      excitement: 0.5,
      technicality: 0.85,
      conversational: 0.8,
      catchphrases: ['Keep an eye on this', 'Smart cricket', 'Field adjustment needed', 'Big over ahead'],
    },
    urduVoice: { male: 'Orus', female: 'Charon' },
  },
];

const COMMENTARY_PAIRS: CommentaryPair[] = [
  // Urdu Pairs
  {
    id: 'raza_ali',
    name: 'Raza & Ali (Urdu Classic)',
    playByPlay: COMMENTATOR_PERSONAS.find((p) => p.id === 'raza_male_play')!,
    color: COMMENTATOR_PERSONAS.find((p) => p.id === 'ali_male_color')!,
    chemistry: 'professional',
  },
  {
    id: 'zara_sana',
    name: "Zara & Sana (Urdu Ladies' View)",
    playByPlay: COMMENTATOR_PERSONAS.find((p) => p.id === 'zara_female_play')!,
    color: COMMENTATOR_PERSONAS.find((p) => p.id === 'sana_female_color')!,
    chemistry: 'friendly',
  },
  {
    id: 'raza_zara',
    name: 'Raza & Zara (Urdu Mixed)',
    playByPlay: COMMENTATOR_PERSONAS.find((p) => p.id === 'raza_male_play')!,
    color: COMMENTATOR_PERSONAS.find((p) => p.id === 'zara_female_play')!,
    chemistry: 'banter',
  },
  {
    id: 'ali_sana',
    name: 'Ali & Sana (Urdu Tactical)',
    playByPlay: COMMENTATOR_PERSONAS.find((p) => p.id === 'ali_male_color')!,
    color: COMMENTATOR_PERSONAS.find((p) => p.id === 'sana_female_color')!,
    chemistry: 'professional',
  },

  // Hindi Pairs
  {
    id: 'vikram_rahul',
    name: 'Vikram & Rahul (Hindi Classic)',
    playByPlay: COMMENTATOR_PERSONAS.find((p) => p.id === 'vikram_male_play')!,
    color: COMMENTATOR_PERSONAS.find((p) => p.id === 'rahul_male_color')!,
    chemistry: 'professional',
  },
  {
    id: 'ananya_priya',
    name: "Ananya & Priya (Hindi Ladies' View)",
    playByPlay: COMMENTATOR_PERSONAS.find((p) => p.id === 'ananya_female_play')!,
    color: COMMENTATOR_PERSONAS.find((p) => p.id === 'priya_female_color')!,
    chemistry: 'friendly',
  },
  {
    id: 'vikram_ananya',
    name: 'Vikram & Ananya (Hindi Mixed)',
    playByPlay: COMMENTATOR_PERSONAS.find((p) => p.id === 'vikram_male_play')!,
    color: COMMENTATOR_PERSONAS.find((p) => p.id === 'ananya_female_play')!,
    chemistry: 'banter',
  },
  {
    id: 'rahul_priya',
    name: 'Rahul & Priya (Hindi Tactical)',
    playByPlay: COMMENTATOR_PERSONAS.find((p) => p.id === 'rahul_male_color')!,
    color: COMMENTATOR_PERSONAS.find((p) => p.id === 'priya_female_color')!,
    chemistry: 'professional',
  },

  // English Pairs
  {
    id: 'michael_david',
    name: 'Michael & David (English Classic)',
    playByPlay: COMMENTATOR_PERSONAS.find((p) => p.id === 'michael_male_play')!,
    color: COMMENTATOR_PERSONAS.find((p) => p.id === 'david_male_color')!,
    chemistry: 'professional',
  },
  {
    id: 'sarah_charlotte',
    name: "Sarah & Charlotte (English Ladies' View)",
    playByPlay: COMMENTATOR_PERSONAS.find((p) => p.id === 'sarah_female_play')!,
    color: COMMENTATOR_PERSONAS.find((p) => p.id === 'charlotte_female_color')!,
    chemistry: 'friendly',
  },
  {
    id: 'michael_sarah',
    name: 'Michael & Sarah (English Mixed)',
    playByPlay: COMMENTATOR_PERSONAS.find((p) => p.id === 'michael_male_play')!,
    color: COMMENTATOR_PERSONAS.find((p) => p.id === 'sarah_female_play')!,
    chemistry: 'banter',
  },
  {
    id: 'david_charlotte',
    name: 'David & Charlotte (English Tactical)',
    playByPlay: COMMENTATOR_PERSONAS.find((p) => p.id === 'david_male_color')!,
    color: COMMENTATOR_PERSONAS.find((p) => p.id === 'charlotte_female_color')!,
    chemistry: 'professional',
  },
];

function getPersonas(): CommentatorPersona[] {
  return [...COMMENTATOR_PERSONAS];
}

function getPairs(): CommentaryPair[] {
  return [...COMMENTARY_PAIRS];
}

function getPersonaById(id: string): CommentatorPersona | undefined {
  return COMMENTATOR_PERSONAS.find((p) => p.id === id);
}

function getPairById(id: string): CommentaryPair | undefined {
  return COMMENTARY_PAIRS.find((p) => p.id === id);
}

function getUrduVoices(): { male: string[]; female: string[] } {
  const male = new Set<string>();
  const female = new Set<string>();
  for (const p of COMMENTATOR_PERSONAS) {
    if (p.urduVoice?.male) male.add(p.urduVoice.male);
    if (p.urduVoice?.female) female.add(p.urduVoice.female);
    if (p.gender === 'male' && p.voiceName) male.add(p.voiceName);
    if (p.gender === 'female' && p.voiceName) female.add(p.voiceName);
  }
  return { male: [...male], female: [...female] };
}

const URDU_FILLER_LINES = {
  low: [
    'موسم کھل رہا ہے، میدان میں ہلکی دھوپ ہے۔',
    'فیلڈر اپنی پوزیشن یقینی بنا رہے ہیں۔',
    'بولینگ اینڈ سے ہلکی ہوا چل رہی ہے۔',
    'اسکور بورڈ تازہ ترین انداز دکھا رہا ہے۔',
    'اسٹرائیک پر موجود بلے باز اپنی نگاہیں گندم رکھے ہوئے ہیں۔',
  ],
  medium: [
    'رن ریت ابådھنے کی ضرورت ہے، ہر گیند قیمتی ہے۔',
    'شراک داری کو اب طویل کرنے کا وقت آ گیا ہے۔',
    'فیلڈنگ سائیڈ کپتان مشورہ کر رہے ہیں۔',
    'بولر اپنی لنگتھ ڈھونڈنے کی کوشش میں ہیں۔',
    'اس اوور میں کئی اچھے شاٹس دکھے گئے ہیں۔',
  ],
  high: [
    'دباؤ اب واضح ہے، ہر رن کے لیے جدوجہد ہے۔',
    'مrichterہ رن ریت ۱۰ کے قریب پہنچ رہی ہے۔',
    'بولینگ سائیڈ کو وکٹ کی تڑپ ہے۔',
    'اسٹیڈیم میں خاموشی سی چھا گئی ہے، ہر گیند پر سانس روکی ہوئی ہے۔',
    'کپتان اجیبیک فیلڈ لگا رہے ہیں، وکٹ درکار ہے۔',
  ],
  extreme: [
    'اب آخری لمحے ہیں، ہر گیند فیصلہ کن ہے۔',
    'مैچ کسی بھی جانب جا سکتا ہے، دل دھڑک رہے ہیں۔',
    'اسٹیڈیم کے رونگٹے کھڑے ہو گئے ہیں۔',
    'یہ وہ لمحہ ہے جسے سالوں تک یاد رکھا جائے گا۔',
    'ہاتھ میں ہاتھ دے کر دعائیں کی جا رہی ہیں۔',
  ],
};

const HINDI_FILLER_LINES = {
  low: [
    'मैदान में हल्की धूप है, मौसम खुल रहा है।',
    'फील्डर अपनी पोजीशन पक्की कर रहे हैं।',
    'बॉलिंग एंड से हल्की हवा चल रही है।',
    'स्कोरबोर्ड ताजा आंकड़े दिखा रहा है।',
    'स्ट्राइक पर मौजूद बल्लेबाज अपनी नजरें गड़ाए हुए हैं।',
  ],
  medium: [
    'रन रेट बढ़ाने की जरूरत है, हर गेंद कीमती है।',
    'साझेदारी को अब लंबा करने का वक्त आ गया है।',
    'फील्डिंग साइड कप्तान मशविरा कर रहे हैं।',
    'बॉलर अपनी लेंथ ढूंढने की कोशिश में हैं।',
    'इस ओवर में कई अच्छे शॉट्स देखने को मिले हैं।',
  ],
  high: [
    'दबाव अब साफ है, हर रन के लिए जद्दोजहद है।',
    'मांगलिक रन रेट 10 के करीब पहुंच रही है।',
    'बॉलिंग साइड को विकेट की तड़प है।',
    'स्टेडियम में खामोशी सी छा गई है, हर गेंद पर सांस रुकी हुई है।',
    'कप्तान अजीबोगरीब फील्ड लगा रहे हैं, विकेट दरकार है।',
  ],
  extreme: [
    'अब आखिरी लम्हे हैं, हर गेंद फैसलाकुन है।',
    'मैच किसी भी तरफ जा सकता है, दिल धड़क रहे हैं।',
    'स्टेडियम के रोंगटे खड़े हो गए हैं।',
    'यह वह लम्हा है जिसे सालों तक याद रखा जाएगा।',
    'हाथ में हाथ देकर दुआएं मांगी जा रही हैं।',
  ],
};

const ENGLISH_FILLER_LINES = {
  low: [
    'The sun is coming out, pleasant conditions at the ground.',
    'Fielders are settling into their positions.',
    'A light breeze from the bowling end.',
    'The scoreboard updates with the latest figures.',
    'The striker has his eyes firmly on the ball.',
  ],
  medium: [
    'The run rate needs a push, every run counts now.',
    'Time to build this partnership into a substantial one.',
    'The fielding captain is having a word with his bowlers.',
    'The bowler is searching for his length.',
    'Some lovely strokes in this over so far.',
  ],
  high: [
    'The pressure is palpable, every run is a battle.',
    'The required rate is climbing towards 10 an over.',
    'The bowling side is desperate for a wicket.',
    'A hush has fallen over the stadium, breath held on every ball.',
    'The captain is setting unconventional fields, a breakthrough is needed.',
  ],
  extreme: [
    'These are the defining moments, every ball decides the game.',
    'The match could swing either way, hearts are pounding.',
    'Goosebumps around the stadium.',
    'This is a moment that will be remembered for years.',
    'Hands clasped, prayers whispered across the stands.',
  ],
};

function getFillerLines(lang: 'hi' | 'ur' | 'en', pressure: 'low' | 'medium' | 'high' | 'extreme'): string[] {
  switch (lang) {
    case 'ur':
      return URDU_FILLER_LINES[pressure];
    case 'hi':
      return HINDI_FILLER_LINES[pressure];
    default:
      return ENGLISH_FILLER_LINES[pressure];
  }
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function buildContext(state: MatchState): CommentaryContext {
  const striker = state.batters.find((b) => b.onStrike);
  const nonStriker = state.batters.find((b) => !b.onStrike);
  const oversDone = state.score.overs + (state.score.balls ?? 0) / 6;
  const totalOvers = state.oversLimit ?? (state.format === 'ODI' ? 50 : 20);
  const oversLeft = Math.max(0, totalOvers - oversDone);
  const runsNeeded = state.runsNeeded ?? (state.target !== undefined ? Math.max(0, state.target - state.score.runs) : undefined);
  const rrr = state.rrr ?? (runsNeeded !== undefined && oversLeft > 0 ? runsNeeded / oversLeft : undefined);
  const wicketsInHand = 10 - state.score.wkts;

  let pressureLevel: 'low' | 'medium' | 'high' | 'extreme' = 'low';
  if (rrr !== undefined && runsNeeded !== undefined && runsNeeded > 0) {
    if (rrr > 12) pressureLevel = 'extreme';
    else if (rrr > 9) pressureLevel = 'high';
    else if (rrr > 7) pressureLevel = 'medium';
  } else if (state.crr < 5 && oversDone > 5) {
    pressureLevel = 'medium';
  }

  let momentum: 'batting' | 'bowling' | 'neutral' = 'neutral';
  if (state.crr > 8 && state.score.wkts <= 3) momentum = 'batting';
  else if (state.crr < 5 && state.score.wkts >= 5) momentum = 'bowling';

  const powerplayActive = state.powerplay ? !state.powerplay.complete : oversDone < 6;
  const deathOversActive = oversLeft <= 5 && oversLeft > 0;

  return {
    matchState: state,
    lastEvent: null,
    lastBall: null,
    overProgress: (state.score.balls ?? 0) / 6,
    partnershipRuns: state.partnership?.runs ?? 0,
    partnershipBalls: state.partnership?.balls ?? 0,
    requiredRunRate: rrr ?? null,
    currentRunRate: state.crr,
    wicketsInHand,
    powerplayActive,
    deathOversActive,
    momentum,
    pressureLevel,
  };
}

function generateFillerCommentary(
  persona: CommentatorPersona,
  context: CommentaryContext,
  lang: 'hi' | 'ur' | 'en'
): string | null {
  if (Math.random() > 0.3) return null;
  const lines = getFillerLines(lang, context.pressureLevel);
  if (!lines.length) return null;
  let line = pickRandom(lines);
  // STRICT GUARANTEE: Only append catchphrase if persona's primary language matches the target language!
  if (persona.primaryLanguage === lang && persona.style.catchphrases.length && Math.random() < 0.2) {
    line += ' ' + pickRandom(persona.style.catchphrases);
  }
  return line;
}

function generateTacticalCommentary(
  persona: CommentatorPersona,
  context: CommentaryContext,
  lang: 'hi' | 'ur' | 'en'
): string | null {
  if (persona.role !== 'color') return null;
  if (Math.random() > 0.25) return null;
  if (context.partnershipBalls < 12) return null;

  const templates: Record<'hi' | 'ur' | 'en', string[]> = {
    ur: [
      '{b} اور {n} اچھی طرح سیٹ ہو چکے ہیں، اب بڑے شاٹس کا انتظار ہے۔',
      'کپتان {o} کو اپنی لنگتھ میں تبدیلی لانی چاہیے۔',
      'فیلڈنگ میں تبدیلی کا وقت آ گیا ہے، {b} کو روکنے کے لیے۔',
      'اس شراکت داری کی بنیاد مضبوط ہے، {r} رن {balls} گیندوں پر۔',
    ],
    hi: [
      '{b} और {n} अच्छी तरह सेट हो चुके हैं, अब बड़े शॉट्स का इंतजार है।',
      'कप्तान {o} को अपनी लेंथ में बदलाव लाना चाहिए।',
      'फील्डिंग में बदलाव का वक्त आ गया है, {b} को रोकने के लिए।',
      'इस साझेदारी की बुनियाद मजबूत है, {r} रन {balls} गेंदों पर।',
    ],
    en: [
      '{b} and {n} are well set now, waiting for the big shots.',
      'Captain should ask {o} to change his length.',
      'Time for a field change to contain {b}.',
      'This partnership has a solid foundation, {r} runs off {balls} balls.',
    ],
  };

  const striker = context.matchState.batters.find((b: { onStrike: boolean; name: string }) => b.onStrike);
  const nonStriker = context.matchState.batters.find((b: { onStrike: boolean; name: string }) => !b.onStrike);
  const bowler = context.matchState.bowler;

  if (!striker || !bowler) return null;

  const template = pickRandom(templates[lang]);
  const fallbackNonStriker = lang === 'ur' ? 'دوسرے بلے باز' : lang === 'hi' ? 'दूसरे बल्लेबाज' : 'the non-striker';
  return template
    .replace('{b}', striker.name)
    .replace('{n}', nonStriker?.name ?? fallbackNonStriker)
    .replace('{o}', bowler.name)
    .replace('{r}', String(context.partnershipRuns))
    .replace('{balls}', String(context.partnershipBalls));
}

function generateAnalysisSeed(state: MatchState, lang: 'hi' | 'ur' | 'en'): string {
  const batting = state.teams.find((team) => team.id === state.battingTeamId)?.name ?? state.teams[0].name;
  const score = `${state.score.runs}-${state.score.wkts} (${state.score.overs}.${state.score.balls})`;
  const chase = state.runsNeeded !== undefined && state.ballsLeft !== undefined;
  if (lang === 'ur') {
    return chase
      ? `${batting} کو ${state.ballsLeft} گیندوں میں ${state.runsNeeded} رن درکار ہیں، مطلوبہ ریٹ ${state.rrr?.toFixed(2) ?? '—'} ہے۔`
      : `${batting} ${score} پر ہیں، موجودہ رن ریٹ ${state.crr.toFixed(2)} ہے اور اگلے اوورز میں شراکت داری کو آگے بڑھانا ہوگا۔`;
  }
  if (lang === 'hi') {
    return chase
      ? `${batting} को ${state.ballsLeft} गेंदों में ${state.runsNeeded} रन चाहिए, जरूरी रन रेट ${state.rrr?.toFixed(2) ?? '—'} है।`
      : `${batting} ${score} पर हैं, मौजूदा रन रेट ${state.crr.toFixed(2)} है और आगे साझेदारी बढ़ानी होगी।`;
  }
  return chase
    ? `${batting} need ${state.runsNeeded} from ${state.ballsLeft} balls at ${state.rrr?.toFixed(2) ?? '—'} an over.`
    : `${batting} are ${score}, scoring at ${state.crr.toFixed(2)}; the next phase is about building this partnership.`;
}

function generateEventCommentary(
  persona: CommentatorPersona,
  event: EngineEvent,
  state: MatchState,
  lang: 'hi' | 'ur' | 'en'
): string {
  const p = event.payload as Record<string, unknown>;
  const fallbackStriker = lang === 'ur' ? 'بلے باز' : lang === 'hi' ? 'बल्लेबाज' : 'the batter';
  const fallbackBowler = lang === 'ur' ? 'بولر' : lang === 'hi' ? 'गेंदबाज' : 'the bowler';
  const striker = state.batters.find((b) => b.onStrike)?.name ?? fallbackStriker;
  const bowler = state.bowler?.name ?? fallbackBowler;
  const batter = String(p.batter ?? p.batterName ?? striker);
  const out = String(p.out ?? striker);

  // STRICT GUARANTEE: Never leak catchphrases from another language into the selected language!
  const catchphrase =
    persona.primaryLanguage === lang && persona.style.catchphrases.length
      ? ' ' + pickRandom(persona.style.catchphrases)
      : '';

  const templates: Record<'hi' | 'ur' | 'en', Record<string, string[]>> = {
    ur: {
      FOUR: [
        `شاندار! ${batter} کا چوکا، گینڈ براہ راست باؤنڈری پار۔${catchphrase}`,
        `کیا شاٹ! ${bowler} کی گیند پر ${batter} نے چوکا جڑ دیا۔${catchphrase}`,
        `${batter} نے خالی جگہ ڈھونڈ کر ${bowler} کو چوکا مار دیا۔${catchphrase}`,
      ],
      SIX: [
        `چھکا! ${batter} نے گیند اسٹینڈز میں بھیج دی! ${catchphrase}`,
        `کیا مارا! ${bowler} کی گیند ہوا میں، ${batter} کا ماہیے پیمانہ چھکا! ${catchphrase}`,
        `لا جواب چھکا! ${batter} نے میڈ وکٹ کے اوپر سے صاف نکال دیا۔${catchphrase}`,
      ],
      WICKET: [
        `اور یہ وکٹ! ${out} آؤٹ — ${bowler} نے کام کر دکھایا۔${catchphrase}`,
        `بڑا لمحہ! ${out} کا شکار، ${bowler} نے شاندار گیند ڈالی۔${catchphrase}`,
        `آؤٹ! ${out} کو ${bowler} نے پھنسا لیا۔${catchphrase}`,
      ],
      FIFTY: [
        `نصف صدی مکمل! ${batter} کی پرسکون مگر مؤثر اننگز۔${catchphrase}`,
        `پچاس رن! ${batter} نے اچھا کھیل دکھایا۔${catchphrase}`,
      ],
      HUNDRED: [
        `سنچری! ${batter} کی اننگز نے میچ کا رنگ بدل دیا۔${catchphrase}`,
        `سو رن! ${batter} کے لیے یادگار اننگز۔${catchphrase}`,
      ],
      OVER_END: [
        `اوور ${p.over ?? state.score.overs} مکمل۔ اسکور ${state.score.runs}-${state.score.wkts}۔`,
        `یہ اوور ختم — اسکور بورڈ پر ${state.score.runs}-${state.score.wkts}۔`,
      ],
    },
    hi: {
      FOUR: [
        `शानदार! ${batter} का चौका, गेंद सीधे बाउंड्री पार।${catchphrase}`,
        `क्या शॉट! ${bowler} की गेंद पर ${batter} ने चौका जड़ दिया।${catchphrase}`,
        `${batter} ने खाली जगह ढूंढ कर ${bowler} को चौका मार दिया।${catchphrase}`,
      ],
      SIX: [
        `छक्का! ${batter} ने गेंद स्टैंड्स में भेज दी! ${catchphrase}`,
        `क्या मारा! ${bowler} की गेंद हवा में, ${batter} का शानदार छक्का! ${catchphrase}`,
        `लाजवाब छक्का! ${batter} ने मिड विकेट के ऊपर से साफ निकाल दिया।${catchphrase}`,
      ],
      WICKET: [
        `और यह विकेट! ${out} आउट — ${bowler} ने कमाल कर दिखाया।${catchphrase}`,
        `बड़ा पल! ${out} का शिकार, ${bowler} ने शानदार गेंद डाली।${catchphrase}`,
        `आउट! ${out} को ${bowler} ने फंसा लिया।${catchphrase}`,
      ],
      FIFTY: [
        `अर्धशतक पूरा! ${batter} की शांत मगर असरदार पारी।${catchphrase}`,
        `पचास रन! ${batter} ने अच्छा खेल दिखाया।${catchphrase}`,
      ],
      HUNDRED: [
        `शतक! ${batter} की पारी ने मैच का रंग बदल दिया।${catchphrase}`,
        `सौ रन! ${batter} के लिए यादगार पारी।${catchphrase}`,
      ],
      OVER_END: [
        `ओवर ${p.over ?? state.score.overs} पूरा। स्कोर ${state.score.runs}-${state.score.wkts}।`,
        `यह ओवर खत्म — स्कोरबोर्ड पर ${state.score.runs}-${state.score.wkts}।`,
      ],
    },
    en: {
      FOUR: [
        `Excellent! ${batter} finds the boundary for FOUR!${catchphrase}`,
        `What a shot! ${batter} drives ${bowler} for four!${catchphrase}`,
        `${batter} picks the gap perfectly, four runs!${catchphrase}`,
      ],
      SIX: [
        `SIX! ${batter} launches it into the stands!${catchphrase}`,
        `Massive hit! ${batter} clears the rope with ease!${catchphrase}`,
        `What a strike! ${batter} sends it sailing over mid-wicket!${catchphrase}`,
      ],
      WICKET: [
        `WICKET! ${out} falls, ${bowler} strikes!${catchphrase}`,
        `Big moment! ${out} is out, beautifully bowled by ${bowler}!${catchphrase}`,
        `OUT! ${bowler} gets the breakthrough!${catchphrase}`,
      ],
      FIFTY: [
        `Fifty for ${batter}! A composed innings.${catchphrase}`,
        `Half-century up for ${batter}, well played!${catchphrase}`,
      ],
      HUNDRED: [
        `CENTURY for ${batter}! A magnificent innings!${catchphrase}`,
        `What a hundred from ${batter}, take a bow!${catchphrase}`,
      ],
      OVER_END: [
        `End of over ${p.over ?? state.score.overs}. Score: ${state.score.runs}-${state.score.wkts}.`,
        `Over completed. The score reads ${state.score.runs}-${state.score.wkts}.`,
      ],
    },
  };

  const eventTemplates = templates[lang]?.[event.type];
  if (eventTemplates && eventTemplates.length) {
    return pickRandom(eventTemplates);
  }

  return lang === 'ur'
    ? `${event.type} ہوا — ${batter}، ${bowler}۔`
    : lang === 'hi'
    ? `${event.type} हुआ — ${batter}، ${bowler}।`
    : `${event.type} — ${batter}, ${bowler}.`;
}

export class AdvancedCommentaryEngine {
  private config: AdvancedCommentaryConfig;
  private history: GeneratedCommentary[] = [];
  private lastCommentaryAt = 0;
  private lastBallKey = '';
  private lastSpeakerId: string | null = null;
  private readonly now: () => number;
  private generator: ((req: { state: unknown; moment: string; lang: 'hi' | 'ur' | 'en' }) => Promise<string | null>) | null = null;
  private generatorReady: () => boolean = () => true;

  constructor(
    initialConfig?: Partial<AdvancedCommentaryConfig>,
    private readonly getMatchState: () => unknown = () => null,
    now: () => number = Date.now
  ) {
    this.config = AdvancedCommentaryConfigSchema.parse(initialConfig ?? {});
    this.now = now;
  }

  setGenerator(
    gen: (req: { state: unknown; moment: string; lang: 'hi' | 'ur' | 'en' }) => Promise<string | null>,
    ready: () => boolean = () => true
  ): void {
    this.generator = gen;
    this.generatorReady = ready;
  }

  getConfig(): AdvancedCommentaryConfig {
    return { ...this.config };
  }

  updateConfig(patch: Partial<AdvancedCommentaryConfig>): AdvancedCommentaryConfig {
    this.config = AdvancedCommentaryConfigSchema.parse({ ...this.config, ...patch });
    return this.getConfig();
  }

  getHistory(): GeneratedCommentary[] {
    return [...this.history];
  }

  getPersonas(): CommentatorPersona[] {
    return getPersonas();
  }

  getPairs(): CommentaryPair[] {
    return getPairs();
  }

  getUrduVoices(): { male: string[]; female: string[] } {
    return getUrduVoices();
  }

  getPersonaById(id: string): CommentatorPersona | undefined {
    return getPersonaById(id);
  }

  getPairById(id: string): CommentaryPair | undefined {
    return getPairById(id);
  }

  private selectAnalysisSpeaker(): CommentatorPersona {
    const lang = this.config.language;
    const pair = this.config.selectedPair ? getPairById(this.config.selectedPair) : null;
    if (pair?.color.primaryLanguage === lang) return pair.color;
    return (
      getPersonas().find((p) => p.primaryLanguage === lang && p.role === 'color') ??
      this.selectSpeaker()
    );
  }

  private selectSpeaker(eventType?: string): CommentatorPersona {
    const lang = this.config.language;
    const pairId = this.config.selectedPair;
    const pair = pairId ? getPairById(pairId) : null;

    // Use selected pair only if its commentators match the configured language!
    if (pair && pair.playByPlay.primaryLanguage === lang) {
      if (eventType === 'WICKET' || eventType === 'SIX' || eventType === 'FOUR') {
        return Math.random() < 0.5 ? pair.playByPlay : pair.color;
      }
      return pair.playByPlay;
    }

    // Filter personas strictly matching the target language
    const personas = getPersonas().filter((p) => p.primaryLanguage === lang);
    const pool = personas.length ? personas : getPersonas().filter((p) => p.primaryLanguage === 'ur');

    const available = pool.filter((p) => p.id !== this.lastSpeakerId);
    const speaker = pickRandom(available.length ? available : pool);
    this.lastSpeakerId = speaker.id;
    return speaker;
  }

  private async generateWithAI(
    speaker: CommentatorPersona,
    text: string,
    context: CommentaryContext,
    eventType?: string
  ): Promise<string | null> {
    if (!this.generator || !this.config.ai || !this.generatorReady()) return null;

    const moment = eventType
      ? `Event: ${eventType}. ${text}`
      : `Ball-by-ball: ${text}. Context: ${context.partnershipRuns} run partnership, RRR ${context.requiredRunRate?.toFixed(2) ?? 'N/A'}`;

    try {
      const result = await this.generator({
        state: context.matchState,
        moment,
        lang: this.config.language,
      });
      return result;
    } catch {
      return null;
    }
  }

  onEvent(event: EngineEvent, state?: unknown): GeneratedCommentary | null {
    if (!this.config.enabled || !this.config.autoEvents) return null;
    if (!state) state = this.getMatchState();
    if (!state) return null;

    const context = buildContext(state as MatchState);
    const speaker = this.selectSpeaker(event.type);
    const baseText = generateEventCommentary(speaker, event, state as MatchState, this.config.language);

    const item: GeneratedCommentary = {
      id: `comm-${this.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: baseText,
      speaker,
      eventType: event.type,
      timestamp: this.now(),
      lang: this.config.language,
      context,
    };

    this.addToHistory(item);
    return item;
  }

  async onEventAsync(event: EngineEvent, state?: unknown): Promise<GeneratedCommentary | null> {
    const local = this.onEvent(event, state);
    if (!local || !state) return local;

    const context = buildContext(state as MatchState);
    const aiText = await this.generateWithAI(local.speaker, local.text, context, event.type);
    if (aiText) local.text = aiText;

    return local;
  }

  onBall(state?: unknown): GeneratedCommentary | null {
    if (!this.config.enabled || !this.config.autoEvents) return null;
    if (!state) state = this.getMatchState();
    if (!state) return null;

    const s = state as MatchState;
    const key = `${s.id}:${s.currentInnings}:${s.score.overs}.${s.score.balls}:${s.score.runs}:${s.score.wkts}`;
    if (key === this.lastBallKey) return null;
    const at = this.now();
    if (at - this.lastCommentaryAt < this.config.minGapMs) return null;

    const context = buildContext(s);
    const speaker = this.selectSpeaker();

    let text = generateFillerCommentary(speaker, context, this.config.language);
    if (!text && this.config.tacticalAnalysis) {
      text = generateTacticalCommentary(speaker, context, this.config.language);
    }
    if (!text) return null;

    this.lastBallKey = key;
    this.lastCommentaryAt = at;

    const item: GeneratedCommentary = {
      id: `comm-${at}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      speaker,
      eventType: 'BALL',
      timestamp: at,
      lang: this.config.language,
      context,
    };

    this.addToHistory(item);
    return item;
  }

  async onBallAsync(state?: unknown): Promise<GeneratedCommentary | null> {
    const local = this.onBall(state);
    if (!local || !state) return local;

    const context = buildContext(state as MatchState);
    const aiText = await this.generateWithAI(local.speaker, local.text, context, 'BALL');
    if (aiText) local.text = aiText;

    return local;
  }

  /** A tactical line for the gaps between deliveries, events and a stalled score feed. */
  onAnalysis(state?: unknown): GeneratedCommentary | null {
    if (!this.config.enabled || !this.config.continuousMode || !this.config.tacticalAnalysis) {
      return null;
    }
    if (!state) state = this.getMatchState();
    if (!state) return null;

    const s = state as MatchState;
    const at = this.now();
    const context = buildContext(s);
    const speaker = this.selectAnalysisSpeaker();
    const text =
      generateTacticalCommentary(speaker, context, this.config.language) ??
      generateAnalysisSeed(s, this.config.language);

    const item: GeneratedCommentary = {
      id: `comm-${at}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      speaker,
      eventType: 'ANALYSIS',
      timestamp: at,
      lang: this.config.language,
      context,
    };
    this.lastCommentaryAt = at;
    this.addToHistory(item);
    return item;
  }

  speak(text: string, eventType = 'CUSTOM', speakerId?: string): GeneratedCommentary {
    const speaker = speakerId ? getPersonaById(speakerId) : this.selectSpeaker();
    const state = this.getMatchState();
    const context = state ? buildContext(state as MatchState) : ({} as CommentaryContext);

    const item: GeneratedCommentary = {
      id: `comm-${this.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: text.trim(),
      speaker: speaker!,
      eventType,
      timestamp: this.now(),
      lang: this.config.language,
      context,
    };

    this.addToHistory(item);
    return item;
  }

  private addToHistory(item: GeneratedCommentary): void {
    this.history.unshift(item);
    if (this.history.length > 50) this.history.pop();
  }
}

export { COMMENTATOR_PERSONAS, COMMENTARY_PAIRS, getUrduVoices };