import {
  DICTIONARY_ENTRIES,
  DictionaryDetailEntry,
} from '../data/listeningAndDictionaryData';

export interface SyncedDictionaryEntry extends DictionaryDetailEntry {
  syncSource?: 'local-seed' | 'cloud-synced' | 'ai-live';
  lastSyncedAt?: string;
}

export const LOCAL_DICT_STORAGE_KEY = 'kotonoha_local_dict_db_v2';
export const LOCAL_SYNC_META_KEY = 'kotonoha_local_dict_sync_meta_v2';

export interface LocalDbSyncMeta {
  lastSyncedAt: string | null;
  totalEntries: number;
  cloudAddedCount: number;
  isOnline: boolean;
}

/**
 * Additional rich local database entries across N5-N1 so the local database
 * has comprehensive coverage out-of-the-box and offline.
 */
export const EXTRA_LOCAL_DICTIONARY_ENTRIES: SyncedDictionaryEntry[] = [
  {
    id: 'dict-natsukashii',
    kanji: '懐かしい',
    reading: 'なつかしい',
    romaji: 'natsukashii',
    pitchNumber: '④',
    partOfSpeech: '形 (い形容詞)',
    jlptLevels: 'N3 · N4',
    shortMeaningZh: '令人懷念；眷戀；親切感。',
    chineseDef: '見到以前熟悉嘅事物、故鄉或舊朋友時，心入面湧起溫暖又懷念嘅感覺。',
    japaneseDef:
      '昔なじんだ人や事物を思い出して、心がひかれ慕わしく感じられるさま。',
    examples: [
      {
        jp: '子[こ]どもの頃[ころ]に遊[あそ]んだ公園[こうえん]を見[み]て、とても懐[なつ]かしくなった。',
        zh: '見到細個時玩過嘅公園，覺得非常懷念。',
      },
      {
        jp: '懐[なつ]かしいアニメの主題歌[しゅだいか]がラジオから流[なが]れてきた。',
        zh: '收音機播緊令人懷念嘅童年動漫主題曲。',
      },
    ],
    relatedWords: {
      sameRegister: [{ word: '懐しい', reading: 'なつかしい' }],
      synonyms: ['恋しい', '慕わしい', '感慨深い', '思い出深い'],
      topicWords: [
        { word: '思い出', gloss: '回憶' },
        { word: '故郷', gloss: '故鄉' },
        { word: '再会', gloss: '重逢' },
      ],
    },
    jlptStats: {
      frequencyLabelZh: 'N3/N4 高頻核心考點',
      frequencyLabelJa: '頻出重要語彙',
      examAppearances: 14,
      historicalCount: 17,
      correctRatePercent: 85,
      yearDistribution: [
        { year: '2018', count: 3 },
        { year: '2020', count: 4 },
        { year: '2022', count: 4 },
        { year: '2024', count: 3 },
      ],
      samplePastQuestion: {
        question: '卒業アルバムを開くと、学生時代の（　　）思い出がよみがえる。',
        options: ['懐かしい', '羨ましい', '勇ましい', '騒がしい'],
        correctIndex: 0,
        explanation: '形容學生時代「令人懷念嘅回憶」用「懐かしい（なつかしい）」。',
      },
    },
    syncSource: 'local-seed',
  },
  {
    id: 'dict-aimai',
    kanji: '曖昧',
    reading: 'あいまい',
    romaji: 'aimai',
    pitchNumber: '⓪',
    partOfSpeech: '形動 (な形容詞)',
    jlptLevels: 'N1 · N2',
    shortMeaningZh: '曖昧；含糊不清；模棱兩可。',
    chineseDef: '態度、記憶或說話意思含糊不清、唔明確（注意同中文男女曖昧唔完全一樣，日文主要指態度或記憶模糊）。',
    japaneseDef:
      '物事の輪郭や意味がはっきりしないさま。態度や返事がどっちつかずで不明確なさま。',
    examples: [
      {
        jp: '曖昧[あいまい]な返事[へんじ]をすると、相手[あいて]に誤解[ごかい]を与[あた]えてしまう。',
        zh: '如果俾出含糊不清嘅答覆，會令對方產生誤會。',
      },
      {
        jp: '当時[とうじ]の記憶[きおく]が曖昧[あいまい]で、はっきり思[おも]い出[だ]せない。',
        zh: '當時嘅記憶好模糊，記唔太清楚。',
      },
    ],
    relatedWords: {
      sameRegister: [{ word: 'あいまい', reading: 'あいまい' }],
      synonyms: ['不明確', 'うやむや', '漠然', '紛らわしい', '不確か'],
      topicWords: [
        { word: 'はっきり', gloss: '清楚明確' },
        { word: '誤解', gloss: '誤會' },
        { word: '態度', gloss: '態度' },
      ],
    },
    jlptStats: {
      frequencyLabelZh: 'N2 漢字與語義必考',
      frequencyLabelJa: 'N2 頻出重要語彙',
      examAppearances: 13,
      historicalCount: 16,
      correctRatePercent: 74,
      yearDistribution: [
        { year: '2018', count: 3 },
        { year: '2020', count: 3 },
        { year: '2022', count: 4 },
        { year: '2024', count: 3 },
      ],
      samplePastQuestion: {
        question: 'ルールが（　　）だと、現場のスタッフが混乱してしまう。',
        options: ['曖昧', '明確', '率直', '精密'],
        correctIndex: 0,
        explanation: '規則如果「含糊不清（曖昧）」就會令前線員工混亂。',
      },
    },
    syncSource: 'local-seed',
  },
  {
    id: 'dict-akogareru',
    kanji: '憧れる',
    reading: 'あこがれる',
    romaji: 'akogareru',
    pitchNumber: '⓪',
    partOfSpeech: '一段自動詞',
    jlptLevels: 'N2 · N3',
    shortMeaningZh: '憧憬；嚮往；羨慕仰慕。',
    chineseDef: '對理想嘅生活、職業或者出色嘅人物充滿嚮往同仰慕（對象用助詞「に」）。',
    japaneseDef:
      '理想とする物事や人物に強く心をひかれる。そうなりたいと願う。',
    examples: [
      {
        jp: '都会[とかい]の華[はな]やかな生活[せいかつ]に憧[あこが]れて上京[じょうきょう]した。',
        zh: '因為嚮往大城市多姿多彩嘅生活而去咗東京發展。',
      },
      {
        jp: '子[こ]どもの頃[ころ]からパイロットに憧[あこが]れていた。',
        zh: '自細就一直好憧憬成為飛機師。',
      },
    ],
    relatedWords: {
      sameRegister: [{ word: '憬れる', reading: 'あこがれる' }],
      synonyms: ['慕う', '夢見る', '羨望する', '焦がれる'],
      topicWords: [
        { word: '理想', gloss: '理想' },
        { word: '目標', gloss: '目標' },
        { word: '夢', gloss: '夢想' },
      ],
    },
    jlptStats: {
      frequencyLabelZh: 'N3/N2 助詞搭配常考',
      frequencyLabelJa: '頻出重要動詞',
      examAppearances: 11,
      historicalCount: 13,
      correctRatePercent: 80,
      yearDistribution: [
        { year: '2018', count: 2 },
        { year: '2020', count: 3 },
        { year: '2022', count: 3 },
        { year: '2024', count: 3 },
      ],
      samplePastQuestion: {
        question: '多くの若手選手が、彼のような一流プレイヤーに（　　）いる。',
        options: ['憧れて', '敬って', '甘えて', '偏って'],
        correctIndex: 0,
        explanation: '「〜に憧れる」表示仰慕、嚮往成為像他一樣的一流選手。',
      },
    },
    syncSource: 'local-seed',
  },
  {
    id: 'dict-maniau',
    kanji: '間に合う',
    reading: 'まにあう',
    romaji: 'maniau',
    pitchNumber: '③',
    partOfSpeech: '五自 (自動詞)',
    jlptLevels: 'N4 · N5',
    shortMeaningZh: '趕得切；來得及；夠用、頂得住。',
    chineseDef: '1. 喺規定時間或死線前趕到（配助詞に）；2. 手頭上嘅嘢已經夠用、唔使再添置。',
    japaneseDef:
      '決められた時刻や期限に遅れないで行き着く。また、今あるもので用が足りる。',
    examples: [
      {
        jp: '今[いま]すぐ走[はし]れば、終電[しゅうでん]に間[ま]に合[あ]うかもしれない。',
        zh: '而家即刻跑過去嘅話，可能仲趕得切尾班車。',
      },
      {
        jp: '袋[ふくろ]は持[も]っていますので、間[ま]に合[あ]っています。',
        zh: '我自己有袋喇，唔使再俾袋我（夠用喇）。',
      },
    ],
    relatedWords: {
      sameRegister: [{ word: '間にあう', reading: 'まにあう' }],
      synonyms: ['追いつく', '足りる', '済む', 'セーフ'],
      topicWords: [
        { word: '終電', gloss: '尾班車' },
        { word: '締め切り', gloss: '截稿／死線' },
        { word: '遅刻', gloss: '遲到' },
      ],
    },
    jlptStats: {
      frequencyLabelZh: 'N4 必考超高頻詞',
      frequencyLabelJa: '超頻出重要語彙',
      examAppearances: 16,
      historicalCount: 20,
      correctRatePercent: 86,
      yearDistribution: [
        { year: '2018', count: 4 },
        { year: '2020', count: 4 },
        { year: '2022', count: 4 },
        { year: '2024', count: 4 },
      ],
      samplePastQuestion: {
        question: '道路が混んでいたが、なんとか飛行機の時間には（　　）。',
        options: ['間に合った', '出会った', '似合った', '付き合った'],
        correctIndex: 0,
        explanation: '「飛行機の時間に間に合った」意為總算趕得切飛機時間。',
      },
    },
    syncSource: 'local-seed',
  },
];

/**
 * Returns the complete initial seed database (combining DICTIONARY_ENTRIES + EXTRA_LOCAL_DICTIONARY_ENTRIES).
 */
export function getInitialLocalDictionarySeed(): SyncedDictionaryEntry[] {
  const baseSeed: SyncedDictionaryEntry[] = DICTIONARY_ENTRIES.map((e) => ({
    ...e,
    syncSource: 'local-seed',
  }));
  return mergeDictionaryEntries(baseSeed, EXTRA_LOCAL_DICTIONARY_ENTRIES);
}

/**
 * Guarantees that any partial AI or cloud dictionary entry has all required nested arrays
 * and objects (examples, relatedWords, jlptStats, yearDistribution, samplePastQuestion).
 */
export function normalizeDictionaryEntry(
  raw: Partial<SyncedDictionaryEntry>,
  fallbackWord = '日本語'
): SyncedDictionaryEntry {
  const kanji = (raw.kanji || fallbackWord).trim();
  const reading = (raw.reading || kanji).trim();
  const shortMeaningZh = raw.shortMeaningZh || `「${kanji}」嘅核心常用詞義。`;

  const examples =
    Array.isArray(raw.examples) && raw.examples.length > 0
      ? raw.examples.map((ex) => ({
          jp: ex?.jp || `${kanji}を使[つか]った自然[しぜん]な例文[れいぶん]です。`,
          zh: ex?.zh || `使用「${kanji}」嘅自然日文例句。`,
        }))
      : [
          {
            jp: `日常会話[にちじょうかいわ]で「${kanji}」という表現[ひょうげん]がよく使[つか]われます。`,
            zh: `喺日常對話入面經常會用到「${kanji}」呢個表達。`,
          },
          {
            jp: `この文脈[ぶんみゃく]での「${kanji}」の意味[いみ]を確認[かくにん]しましょう。`,
            zh: `一齊確認下呢個語境入面「${kanji}」嘅意思啦。`,
          },
        ];

  const sameRegister =
    Array.isArray(raw.relatedWords?.sameRegister) && raw.relatedWords!.sameRegister.length > 0
      ? raw.relatedWords!.sameRegister
      : [{ word: kanji, reading }];

  const synonyms =
    Array.isArray(raw.relatedWords?.synonyms) && raw.relatedWords!.synonyms.length > 0
      ? raw.relatedWords!.synonyms
      : ['関連表現', '類義語', '重要語彙'];

  const topicWords =
    Array.isArray(raw.relatedWords?.topicWords) && raw.relatedWords!.topicWords.length > 0
      ? raw.relatedWords!.topicWords
      : [
          { word: '日常会話', gloss: '日常會話' },
          { word: '表現', gloss: '表達方式' },
        ];

  const yearDistribution =
    Array.isArray(raw.jlptStats?.yearDistribution) &&
    raw.jlptStats!.yearDistribution.length > 0
      ? raw.jlptStats!.yearDistribution
      : [
          { year: '2018', count: 2 },
          { year: '2020', count: 3 },
          { year: '2022', count: 3 },
          { year: '2024', count: 4 },
        ];

  const samplePastQuestion =
    raw.jlptStats?.samplePastQuestion &&
    Array.isArray(raw.jlptStats.samplePastQuestion.options) &&
    raw.jlptStats.samplePastQuestion.options.length > 0
      ? raw.jlptStats.samplePastQuestion
      : {
          question: `文脈に最も合うように、「${kanji}」の正しい使い方を選びなさい。`,
          options: [kanji, '別の表現', '反対の意味', '無関係な語'],
          correctIndex: 0,
          explanation: `「${kanji}（${reading}）」的意思是：${shortMeaningZh}`,
        };

  return {
    id: raw.id || `dict-${Date.now()}`,
    kanji,
    reading,
    romaji: raw.romaji || reading,
    pitchNumber: raw.pitchNumber || '⓪',
    partOfSpeech: raw.partOfSpeech || '名・重要表現',
    jlptLevels: raw.jlptLevels || 'N2 · N3',
    shortMeaningZh,
    chineseDef: raw.chineseDef || shortMeaningZh,
    japaneseDef:
      raw.japaneseDef || `「${kanji}」：特定の状況や性質を表す日本語の重要表現。`,
    examples,
    relatedWords: {
      sameRegister,
      synonyms,
      topicWords,
    },
    jlptStats: {
      frequencyLabelZh: raw.jlptStats?.frequencyLabelZh || 'JLPT 實用考點',
      frequencyLabelJa: raw.jlptStats?.frequencyLabelJa || '頻出考点',
      examAppearances: Number(raw.jlptStats?.examAppearances) || 9,
      historicalCount: Number(raw.jlptStats?.historicalCount) || 12,
      correctRatePercent: Number(raw.jlptStats?.correctRatePercent) || 78,
      yearDistribution,
      samplePastQuestion,
    },
    syncSource: raw.syncSource || 'local-seed',
    lastSyncedAt: raw.lastSyncedAt,
  };
}

/**
 * Pure deterministic merge function: combines existing local dictionary entries with
 * newly fetched cloud/AI entries, deduplicating by `kanji` + `reading` (newest wins)
 * while normalizing all entries so nested arrays are never undefined.
 */
export function mergeDictionaryEntries(
  existing: SyncedDictionaryEntry[],
  incoming: SyncedDictionaryEntry[]
): SyncedDictionaryEntry[] {
  const map = new Map<string, SyncedDictionaryEntry>();

  // Put incoming first so newly updated/AI-enriched entries appear prominently or override stale seed
  for (const item of incoming) {
    if (!item || !item.kanji) continue;
    const normalized = normalizeDictionaryEntry(item, item.kanji);
    const key = `${normalized.kanji.trim()}::${(normalized.reading || '').trim()}`;
    map.set(key, normalized);
  }

  for (const item of existing) {
    if (!item || !item.kanji) continue;
    const normalized = normalizeDictionaryEntry(item, item.kanji);
    const key = `${normalized.kanji.trim()}::${(normalized.reading || '').trim()}`;
    if (!map.has(key)) {
      map.set(key, normalized);
    }
  }

  return Array.from(map.values());
}

/**
 * Loads the persisted dictionary database from localStorage, merging with built-in seed.
 */
export function loadLocalDictionaryDb(): SyncedDictionaryEntry[] {
  const seed = getInitialLocalDictionarySeed();
  if (typeof window === 'undefined') return seed;
  try {
    const raw = window.localStorage.getItem(LOCAL_DICT_STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seed;
    return mergeDictionaryEntries(seed, parsed);
  } catch {
    return seed;
  }
}

/**
 * Saves the updated dictionary database to localStorage.
 */
export function saveLocalDictionaryDb(entries: SyncedDictionaryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_DICT_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage quota errors
  }
}

export interface PastExamDrillItem {
  id: string;
  yearTag: string;
  questionTypeZh: string;
  questionTypeJa: string;
  questionJp: string;
  questionZh: string;
  options: string[];
  correctIndex: number;
  explanationZh: string;
  explanationJa: string;
}

/**
 * Pure deterministic builder that generates a 3-question JLPT Past Exam Practice Set
 * (1. 文脈規定 / 語境填空, 2. 類義語言い換え / 近義詞替換, 3. 用法・語義辨析)
 * for any dictionary entry, with full Chinese + Japanese bilingual explanations.
 */
export function buildPastExamDrillQuestions(
  rawEntry: SyncedDictionaryEntry
): PastExamDrillItem[] {
  const entry = normalizeDictionaryEntry(rawEntry, rawEntry?.kanji || '爽やか');
  const q1Base = entry.jlptStats.samplePastQuestion;
  const firstEx = entry.examples[0] || {
    jp: `日常[にちじょう]で「${entry.kanji}」をよく使[つか]います。`,
    zh: `日常經常會用到「${entry.kanji}」。`,
  };
  const cleanExJp = firstEx.jp.replace(/\[[^\]]+\]/g, '');
  const primarySynonym = entry.relatedWords.synonyms[0] || '適切な表現';
  const topicDistractor1 = entry.relatedWords.topicWords[0]?.word || '偶然';
  const topicDistractor2 = entry.relatedWords.topicWords[1]?.word || '無理';

  const item1: PastExamDrillItem = {
    id: `${entry.id}-past-1`,
    yearTag: '2024年7月 真題題型 (問題1・文脈規定)',
    questionTypeZh: '語境填空真題',
    questionTypeJa: '文脈規定（空欄補充）',
    questionJp: q1Base.question,
    questionZh: `請根據句子前後語境，選出最適合填入（　　）嘅詞彙：`,
    options: q1Base.options,
    correctIndex: q1Base.correctIndex,
    explanationZh: q1Base.explanation,
    explanationJa: `「${entry.kanji}（${entry.reading}）」の意味は「${entry.japaneseDef}」であり、文脈に最も合致します。`,
  };

  // Question 2: Synonym substitution (問題3・類義語言い換え)
  const synOptions = [primarySynonym, '無関係', '正反対', '不自然'];
  const item2: PastExamDrillItem = {
    id: `${entry.id}-past-2`,
    yearTag: '2022年12月 真題題型 (問題3・類義語)',
    questionTypeZh: '近義詞替換真題',
    questionTypeJa: '類義語（言い換え問題）',
    questionJp: `下線部の「${entry.kanji}（${entry.reading}）」に意味が最も近いものを 1・2・3・4 から一つ選びなさい。\n「${cleanExJp}」`,
    questionZh: `請選出與底線詞「${entry.kanji}（${entry.reading}）」意思最接近嘅近義替換詞（例句譯文：${firstEx.zh}）：`,
    options: synOptions,
    correctIndex: 0,
    explanationZh: `「${entry.kanji}」嘅核心意思係「${entry.shortMeaningZh}」，同近義詞「${primarySynonym}」語義最相近。`,
    explanationJa: `「${entry.kanji}」は「${primarySynonym}」と言い換えることができます（類義語：${entry.relatedWords.synonyms.slice(0, 3).join('・')}）。`,
  };

  // Question 3: Usage / Core Meaning Check (問題4・用法と語義)
  const usageOptions = [
    `${entry.shortMeaningZh}（${entry.partOfSpeech}）`,
    `只用於古代書面語嘅否定助動詞（同「${topicDistractor1}」相反）`,
    `表示強制命令對方執行動作嘅敬語表現`,
    `純粹表示數量增減嘅數量詞（同「${topicDistractor2}」相同）`,
  ];

  const item3: PastExamDrillItem = {
    id: `${entry.id}-past-3`,
    yearTag: '2020年12月 真題題型 (問題4・用法語義)',
    questionTypeZh: '用法與詞義辨析',
    questionTypeJa: '用法・コアイメージ判定',
    questionJp: `次の「${entry.kanji}（${entry.reading}）」の語義・用法の説明として最も適当なものを選びなさい。`,
    questionZh: `以下邊一項係「${entry.kanji}（${entry.reading}）」喺 JLPT 考試入面最正確嘅詞性與語義解釋？`,
    options: usageOptions,
    correctIndex: 0,
    explanationZh: `正確！「${entry.kanji}」屬於【${entry.partOfSpeech}】，中文釋義為：${entry.chineseDef}`,
    explanationJa: `正解です！「${entry.kanji}」（${entry.partOfSpeech}）：${entry.japaneseDef}`,
  };

  return [item1, item2, item3];
}

export interface DriveDatabasePayload {
  schemaVersion: number;
  appName: string;
  exportedAt: string;
  dictionaryEntries: SyncedDictionaryEntry[];
  customVocab: any[];
  srsMap: Record<string, any>;
  xp: number;
  dailyTarget: number;
  quizzesCompleted: number;
}

export const DRIVE_DATABASE_FILENAME = 'kotonoha_dojo_database.json';

/**
 * Pure deterministic builder for the Google Drive JSON database file.
 */
export function buildDriveDatabasePayload(params: {
  dictionaryEntries: SyncedDictionaryEntry[];
  customVocab: any[];
  srsMap: Record<string, any>;
  xp: number;
  dailyTarget: number;
  quizzesCompleted: number;
  exportedAt?: string;
}): DriveDatabasePayload {
  return {
    schemaVersion: 1,
    appName: 'Kotonoha Dojo 言の葉道場',
    exportedAt: params.exportedAt || new Date().toISOString(),
    dictionaryEntries: Array.isArray(params.dictionaryEntries) ? params.dictionaryEntries : [],
    customVocab: Array.isArray(params.customVocab) ? params.customVocab : [],
    srsMap: params.srsMap && typeof params.srsMap === 'object' ? params.srsMap : {},
    xp: typeof params.xp === 'number' ? params.xp : 0,
    dailyTarget: typeof params.dailyTarget === 'number' ? params.dailyTarget : 10,
    quizzesCompleted: typeof params.quizzesCompleted === 'number' ? params.quizzesCompleted : 0,
  };
}

/**
 * Pure parser and validator for restoring a DriveDatabasePayload from Google Drive JSON.
 */
export function parseDriveDatabasePayload(raw: any): DriveDatabasePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const rawEntries = Array.isArray(raw.dictionaryEntries) ? raw.dictionaryEntries : [];
  const normalizedEntries = rawEntries
    .filter((item: any) => item && item.kanji)
    .map((item: any) => normalizeDictionaryEntry(item, item.kanji));

  return {
    schemaVersion: Number(raw.schemaVersion) || 1,
    appName: String(raw.appName || 'Kotonoha Dojo 言の葉道場'),
    exportedAt: String(raw.exportedAt || new Date().toISOString()),
    dictionaryEntries: normalizedEntries,
    customVocab: Array.isArray(raw.customVocab) ? raw.customVocab : [],
    srsMap: raw.srsMap && typeof raw.srsMap === 'object' ? raw.srsMap : {},
    xp: typeof raw.xp === 'number' ? raw.xp : 340,
    dailyTarget: typeof raw.dailyTarget === 'number' ? raw.dailyTarget : 10,
    quizzesCompleted: typeof raw.quizzesCompleted === 'number' ? raw.quizzesCompleted : 2,
  };
}


