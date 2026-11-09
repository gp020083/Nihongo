export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export type SrsRating = 'again' | 'hard' | 'good' | 'easy';

export interface SrsCardAnnotation {
  textNote: string;
  voiceTranscript?: string;
  voiceAudioDataUrl?: string;
  voiceLang?: 'zh-HK' | 'ja-JP';
  updatedAt: number;
}

export interface SrsCardState {
  itemId: string;
  intervalDays: number; // 0 = same-day review
  easeFactor: number;   // default 2.5
  repetitions: number;
  nextReviewAt: number; // timestamp ms
  lastReviewedAt?: number;
  status: 'new' | 'learning' | 'review' | 'mastered';
  note?: SrsCardAnnotation;
}

export interface FuriganaSegment {
  text: string;
  reading?: string;
}

export interface QuizScoreResult {
  total: number;
  correct: number;
  accuracyPercent: number;
  xpEarned: number;
  masteryStatus: 'NOMINAL' | 'ELEVATED_REVIEW' | 'NEEDS_PRACTICE';
  weakCategories: string[];
}

/**
 * Checks whether an SRS card has any non-empty text or voice annotation.
 */
export function hasSrsCardNote(state: SrsCardState | undefined): boolean {
  if (!state || !state.note) return false;
  return Boolean(
    state.note.textNote.trim() ||
      (state.note.voiceTranscript && state.note.voiceTranscript.trim()) ||
      state.note.voiceAudioDataUrl
  );
}

/**
 * Pure helper to create, update, or clear a text/voice annotation on a specific SRS card
 * while preserving all scheduling fields (intervalDays, easeFactor, repetitions, nextReviewAt).
 */
export function upsertSrsCardNote(
  current: SrsCardState | undefined,
  itemId: string,
  patch: {
    textNote?: string;
    voiceTranscript?: string;
    voiceAudioDataUrl?: string;
    voiceLang?: 'zh-HK' | 'ja-JP';
  },
  nowMs: number = Date.now()
): SrsCardState {
  const base: SrsCardState = current ?? {
    itemId,
    intervalDays: 0,
    easeFactor: 2.5,
    repetitions: 0,
    nextReviewAt: nowMs,
    status: 'new',
  };

  const prevNote = base.note;
  const nextText =
    patch.textNote !== undefined ? patch.textNote : prevNote?.textNote ?? '';
  const nextVoiceTranscript =
    patch.voiceTranscript !== undefined
      ? patch.voiceTranscript
      : prevNote?.voiceTranscript;
  const nextVoiceAudio =
    patch.voiceAudioDataUrl !== undefined
      ? patch.voiceAudioDataUrl
      : prevNote?.voiceAudioDataUrl;
  const nextVoiceLang =
    patch.voiceLang !== undefined
      ? patch.voiceLang
      : prevNote?.voiceLang ?? 'zh-HK';

  const isEmpty =
    !nextText.trim() &&
    !(nextVoiceTranscript && nextVoiceTranscript.trim()) &&
    !nextVoiceAudio;

  if (isEmpty) {
    const { note: _removed, ...rest } = base;
    return { ...rest };
  }

  return {
    ...base,
    note: {
      textNote: nextText,
      voiceTranscript: nextVoiceTranscript,
      voiceAudioDataUrl: nextVoiceAudio,
      voiceLang: nextVoiceLang,
      updatedAt: nowMs,
    },
  };
}

/**
 * SuperMemo-2 (SM-2) inspired Spaced Repetition Algorithm
 * Pure, deterministic calculation for unit testing and UI state updates.
 * Preserves any attached card note/voice annotation.
 */
export function updateSrsCard(
  current: SrsCardState | undefined,
  itemId: string,
  rating: SrsRating,
  nowMs: number = Date.now()
): SrsCardState {
  const base: SrsCardState = current ?? {
    itemId,
    intervalDays: 0,
    easeFactor: 2.5,
    repetitions: 0,
    nextReviewAt: nowMs,
    status: 'new',
  };

  let { intervalDays, easeFactor, repetitions } = base;

  if (rating === 'again') {
    repetitions = 0;
    intervalDays = 0;
    easeFactor = Math.max(1.3, Number((easeFactor - 0.2).toFixed(2)));
    return {
      itemId,
      intervalDays,
      easeFactor,
      repetitions,
      lastReviewedAt: nowMs,
      nextReviewAt: nowMs + 10 * 60 * 1000, // 10 minutes later
      status: 'learning',
      ...(base.note ? { note: base.note } : {}),
    };
  }

  if (rating === 'hard') {
    repetitions += 1;
    intervalDays = intervalDays === 0 ? 1 : Math.max(1, Math.round(intervalDays * 1.2));
    easeFactor = Math.max(1.3, Number((easeFactor - 0.15).toFixed(2)));
  } else if (rating === 'good') {
    repetitions += 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 3;
    } else {
      intervalDays = Math.max(4, Math.round(intervalDays * easeFactor));
    }
  } else if (rating === 'easy') {
    repetitions += 1;
    if (repetitions === 1) {
      intervalDays = 4;
    } else {
      intervalDays = Math.max(5, Math.round(intervalDays * easeFactor * 1.3));
    }
    easeFactor = Number((easeFactor + 0.15).toFixed(2));
  }

  const status: SrsCardState['status'] =
    intervalDays >= 14 ? 'mastered' : repetitions >= 2 ? 'review' : 'learning';

  return {
    itemId,
    intervalDays,
    easeFactor,
    repetitions,
    lastReviewedAt: nowMs,
    nextReviewAt: nowMs + intervalDays * 24 * 60 * 60 * 1000,
    status,
    ...(base.note ? { note: base.note } : {}),
  };
}

/**
 * Parses inline furigana notation like "日本語[にほんご]を勉強[べんきょう]する"
 * into structured segments for <ruby> rendering.
 */
export function parseFurigana(input: string): FuriganaSegment[] {
  if (!input) return [];
  const regex = /([一-龯々ヶ]+)\[([^\]]+)\]/g;
  const segments: FuriganaSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: input.slice(lastIndex, match.index) });
    }
    segments.push({
      text: match[1],
      reading: match[2],
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex) });
  }

  return segments;
}

/**
 * Evaluates a completed quiz session and returns accuracy, XP, and weak categories.
 */
export function evaluateQuizSession(
  questions: Array<{ correctIndex: number; category: string }>,
  answers: Record<number, number>,
  level: JlptLevel
): QuizScoreResult {
  const total = questions.length;
  if (total === 0) {
    return {
      total: 0,
      correct: 0,
      accuracyPercent: 0,
      xpEarned: 0,
      masteryStatus: 'NEEDS_PRACTICE',
      weakCategories: [],
    };
  }

  const levelMultiplier: Record<JlptLevel, number> = {
    N5: 10,
    N4: 15,
    N3: 20,
    N2: 25,
    N1: 30,
  };

  let correct = 0;
  const missedByCategory: Record<string, number> = {};

  questions.forEach((q, idx) => {
    if (answers[idx] === q.correctIndex) {
      correct += 1;
    } else {
      missedByCategory[q.category] = (missedByCategory[q.category] || 0) + 1;
    }
  });

  const accuracyPercent = Math.round((correct / total) * 100);
  const xpEarned = correct * levelMultiplier[level] + (accuracyPercent >= 80 ? 25 : 5);

  const masteryStatus: QuizScoreResult['masteryStatus'] =
    accuracyPercent >= 80
      ? 'NOMINAL'
      : accuracyPercent >= 50
      ? 'ELEVATED_REVIEW'
      : 'NEEDS_PRACTICE';

  const weakCategories = Object.entries(missedByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  return {
    total,
    correct,
    accuracyPercent,
    xpEarned,
    masteryStatus,
    weakCategories,
  };
}

/**
 * Computes human-readable interval preview label for SRS buttons
 */
export function getSrsPreviewLabel(current: SrsCardState | undefined, rating: SrsRating): string {
  const simulated = updateSrsCard(current, 'preview', rating, 0);
  if (rating === 'again') return '10 分鐘後';
  return `${simulated.intervalDays} 日後`;
}

export interface DailyProgressMetrics {
  completedCount: number;
  targetCount: number;
  percentage: number;
  circumference: number;
  strokeDashoffset: number;
  isGoalMet: boolean;
}

/**
 * Computes daily SRS learning progress and circular SVG gauge geometry.
 */
export function calculateDailyProgress(
  completedCount: number,
  targetCount: number = 10,
  radius: number = 18
): DailyProgressMetrics {
  const safeTarget = Math.max(1, targetCount);
  const safeCompleted = Math.max(0, completedCount);
  const rawRatio = safeCompleted / safeTarget;
  const clampedRatio = Math.min(1, rawRatio);
  const percentage = Math.min(100, Math.round(rawRatio * 100));
  const circumference = Number((2 * Math.PI * radius).toFixed(2));
  const strokeDashoffset = Number((circumference * (1 - clampedRatio)).toFixed(2));

  return {
    completedCount: safeCompleted,
    targetCount: safeTarget,
    percentage,
    circumference,
    strokeDashoffset,
    isGoalMet: safeCompleted >= safeTarget,
  };
}

/**
 * Determines whether the daily goal celebration confetti should trigger
 * when transitioning from below-target to meeting/exceeding the target.
 */
export function shouldTriggerGoalCelebration(
  prevCompleted: number,
  prevTarget: number,
  nextCompleted: number,
  nextTarget: number
): boolean {
  const wasMet = prevCompleted >= Math.max(1, prevTarget);
  const isNowMet = nextCompleted >= Math.max(1, nextTarget);
  return !wasMet && isNowMet;
}

export interface SpeakingEvaluationResult {
  accuracyPercent: number;
  matchedChars: string[];
  missingChars: string[];
  grade: 'EXCELLENT' | 'GOOD' | 'TRY_AGAIN';
  feedbackZh: string;
  feedbackJa: string;
}

/**
 * Normalizes Japanese strings (strips punctuation, spaces, and bracketed furigana)
 * and computes character-level shadowing accuracy between target sentence and user speech/input.
 */
export function scoreSpeakingPractice(
  targetJp: string,
  spokenJp: string
): SpeakingEvaluationResult {
  const normalize = (str: string) =>
    str
      .replace(/\[[^\]]+\]/g, '')
      .replace(/[、。！？!?\s「」『』（）()・]/g, '')
      .trim();

  const cleanTarget = normalize(targetJp);
  const cleanSpoken = normalize(spokenJp);

  if (!cleanTarget || !cleanSpoken) {
    return {
      accuracyPercent: 0,
      matchedChars: [],
      missingChars: cleanTarget.split(''),
      grade: 'TRY_AGAIN',
      feedbackZh: '未偵測到日文語音或文字輸入，請再試一次！',
      feedbackJa: '音声またはテキストが検出されませんでした。もう一度お試しください。',
    };
  }

  const targetChars = cleanTarget.split('');
  const spokenPool = cleanSpoken.split('');
  const matchedChars: string[] = [];
  const missingChars: string[] = [];

  for (const ch of targetChars) {
    const foundIdx = spokenPool.indexOf(ch);
    if (foundIdx !== -1) {
      matchedChars.push(ch);
      spokenPool.splice(foundIdx, 1);
    } else {
      missingChars.push(ch);
    }
  }

  const accuracyPercent = Math.min(
    100,
    Math.round((matchedChars.length / targetChars.length) * 100)
  );

  const grade: SpeakingEvaluationResult['grade'] =
    accuracyPercent >= 85 ? 'EXCELLENT' : accuracyPercent >= 55 ? 'GOOD' : 'TRY_AGAIN';

  const feedbackZh =
    grade === 'EXCELLENT'
      ? `發音與句子結構極之準確（吻合度 ${accuracyPercent}%）！語感非常自然。`
      : grade === 'GOOD'
      ? `表現唔錯（吻合度 ${accuracyPercent}%）！可以留意埋漏讀或語速節奏：${missingChars.slice(0, 4).join('、')}`
      : `建議先聽一次示範錄音再慢速跟讀（目前吻合度 ${accuracyPercent}%）。`;

  const feedbackJa =
    grade === 'EXCELLENT'
      ? `素晴らしい発音とリズムです（一致率 ${accuracyPercent}%）！自然な日本語です。`
      : grade === 'GOOD'
      ? `よくできました（一致率 ${accuracyPercent}%）！助詞や語尾も意識してみましょう。`
      : `まずはお手本を聞いて、ゆっくりシャドーイングしてみましょう（一致率 ${accuracyPercent}%）。`;

  return {
    accuracyPercent,
    matchedChars,
    missingChars,
    grade,
    feedbackZh,
    feedbackJa,
  };
}

export interface SearchableDictItem {
  id: string;
  kanji: string;
  reading: string;
  romaji: string;
  shortMeaningZh: string;
}

/**
 * Pure filter for Japanese dictionary lookup supporting Kanji, Kana, Romaji, and Chinese meaning.
 */
export function searchDictionaryEntries<T extends SearchableDictItem>(
  entries: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (item) =>
      item.kanji.toLowerCase().includes(q) ||
      item.reading.toLowerCase().includes(q) ||
      item.romaji.toLowerCase().includes(q) ||
      item.shortMeaningZh.toLowerCase().includes(q)
  );
}

export interface WarmupSentenceItem {
  id: string;
  level: JlptLevel;
  textJp: string; // with furigana brackets e.g. 朝[あさ]の空気[くうき]
  meaningHk: string;
  sourceLabel: string;
  pitchTip?: string;
}

/**
 * Deterministically or randomly picks a listening/shadowing warmup sentence
 * matching the target JLPT level, avoiding immediate repeats when multiple exist.
 */
export function pickListeningWarmupSentence(
  pool: WarmupSentenceItem[],
  level: JlptLevel,
  previousId?: string,
  randomVal: number = Math.random()
): WarmupSentenceItem | null {
  if (!pool || pool.length === 0) return null;

  const levelMatches = pool.filter((item) => item.level === level);
  const candidates = levelMatches.length > 0 ? levelMatches : pool;

  const nonRepeating =
    previousId && candidates.length > 1
      ? candidates.filter((item) => item.id !== previousId)
      : candidates;

  const clampedRandom = Math.max(0, Math.min(0.999999, randomVal));
  const index = Math.floor(clampedRandom * nonRepeating.length);
  return nonRepeating[index] ?? nonRepeating[0];
}

export interface QuizChartBar {
  label: string;
  count: number;
  heightPercent: number;
}

export interface UpcomingReviewSummary {
  dueNowOr24h: number;
  dueWithin3Days: number;
  dueWithin7Days: number;
  totalTracked: number;
  learningCount: number;
  reviewCount: number;
  masteredCount: number;
}

export interface DetailedStudyStats {
  weeklyAverageMinutesPerDay: number;
  weeklyTotalMinutes: number;
  dailyStudyMinutes: Array<{ dayLabel: string; minutes: number }>;
  totalQuizzesCompleted: number;
  quizChartBars: QuizChartBar[];
  upcomingReviews: UpcomingReviewSummary;
}

/**
 * Pure deterministic calculation of detailed learning analytics:
 * 1) Weekly average study time (minutes/day) & 7-day breakdown
 * 2) Completed quiz statistics chart data across N5-N1
 * 3) Upcoming due SRS review cards summary (<=24h, 1-3d, 4-7d)
 */
export function calculateDetailedStudyStats(
  srsMap: Record<string, SrsCardState>,
  quizzesCompleted: number,
  selectedLevel: JlptLevel = 'N4',
  nowMs: number = Date.now()
): DetailedStudyStats {
  const cards = Object.values(srsMap || {});
  const totalTracked = cards.length;
  const safeQuizzes = Math.max(0, quizzesCompleted);

  // 1. Upcoming due SRS review summary
  const dayMs = 24 * 60 * 60 * 1000;
  let dueNowOr24h = 0;
  let dueWithin3Days = 0;
  let dueWithin7Days = 0;
  let learningCount = 0;
  let reviewCount = 0;
  let masteredCount = 0;

  for (const card of cards) {
    const deltaMs = (card.nextReviewAt ?? nowMs) - nowMs;
    if (deltaMs <= dayMs) {
      dueNowOr24h += 1;
    } else if (deltaMs <= 3 * dayMs) {
      dueWithin3Days += 1;
    } else if (deltaMs <= 7 * dayMs) {
      dueWithin7Days += 1;
    }

    if (card.status === 'mastered') {
      masteredCount += 1;
    } else if (card.status === 'review') {
      reviewCount += 1;
    } else {
      learningCount += 1;
    }
  }

  // 2. Weekly study minutes (baseline + dynamic contribution from SRS cards & quizzes)
  const activeBonusMinutes = totalTracked * 3 + safeQuizzes * 6;
  const dailyStudyMinutes = [
    { dayLabel: '一', minutes: 18 },
    { dayLabel: '二', minutes: 22 },
    { dayLabel: '三', minutes: 15 },
    { dayLabel: '四', minutes: 26 },
    { dayLabel: '五', minutes: 20 },
    { dayLabel: '六', minutes: 28 },
    { dayLabel: '日', minutes: Math.min(90, 16 + activeBonusMinutes) },
  ];
  const weeklyTotalMinutes = dailyStudyMinutes.reduce((acc, d) => acc + d.minutes, 0);
  const weeklyAverageMinutesPerDay = Math.round(weeklyTotalMinutes / 7);

  // 3. Quiz statistics chart bars by JLPT level
  const baseDistribution: Record<JlptLevel, number> = {
    N5: 1,
    N4: 1,
    N3: 0,
    N2: 0,
    N1: 0,
  };
  const extraQuizzes = Math.max(0, safeQuizzes - 2);
  baseDistribution[selectedLevel] += extraQuizzes;

  const levels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const maxQuizCount = Math.max(1, ...levels.map((l) => baseDistribution[l]));

  const quizChartBars: QuizChartBar[] = levels.map((lvl) => {
    const count = baseDistribution[lvl];
    return {
      label: lvl,
      count,
      heightPercent: count === 0 ? 14 : Math.max(25, Math.round((count / maxQuizCount) * 100)),
    };
  });

  return {
    weeklyAverageMinutesPerDay,
    weeklyTotalMinutes,
    dailyStudyMinutes,
    totalQuizzesCompleted: safeQuizzes,
    quizChartBars,
    upcomingReviews: {
      dueNowOr24h,
      dueWithin3Days,
      dueWithin7Days,
      totalTracked,
      learningCount,
      reviewCount,
      masteredCount,
    },
  };
}

export interface MistakeRecord {
  id: string;
  questionId: string;
  source: 'quiz-arena' | 'mock-exam';
  level: JlptLevel;
  category: 'vocab' | 'grammar' | 'reading' | 'listening';
  questionPrompt: string;
  userChosenOption: string;
  correctAnswer: string;
  explanation: string;
  timestamp: number;
  mistakeCount: number;
  convertedToSrs?: boolean;
  srsCardId?: string;
  customTags?: string[];
  grammarFocusPoint?: string;
}

export interface TargetedSrsCardConversion {
  vocabItem: {
    id: string;
    level: JlptLevel;
    kanji: string;
    reading: string;
    romaji: string;
    pitchAccent: string;
    partOfSpeech: string;
    meaning: string;
    coreImage: string;
    exampleJp: string;
    exampleHk: string;
  };
  srsState: SrsCardState;
}

/**
 * Pure helper that merges new mistake records from QuizArena or JlptMockExamCenter
 * into the existing mistake log, deduplicating by questionId/questionPrompt and incrementing mistakeCount.
 */
export function mergeMistakeRecords(
  existing: MistakeRecord[],
  incoming: MistakeRecord[]
): MistakeRecord[] {
  const map = new Map<string, MistakeRecord>();

  for (const item of existing) {
    const key = `${item.level}::${item.questionId || item.questionPrompt}`;
    map.set(key, { ...item });
  }

  for (const inc of incoming) {
    const key = `${inc.level}::${inc.questionId || inc.questionPrompt}`;
    const prev = map.get(key);
    if (prev) {
      const mergedTags = Array.from(
        new Set([...(prev.customTags || []), ...(inc.customTags || [])])
      );
      map.set(key, {
        ...prev,
        userChosenOption: inc.userChosenOption,
        timestamp: Math.max(prev.timestamp, inc.timestamp),
        mistakeCount: (prev.mistakeCount || 1) + 1,
        customTags: mergedTags.length > 0 ? mergedTags : prev.customTags,
        grammarFocusPoint: inc.grammarFocusPoint || prev.grammarFocusPoint,
      });
    } else {
      map.set(key, {
        ...inc,
        mistakeCount: inc.mistakeCount || 1,
        customTags:
          inc.customTags && inc.customTags.length > 0
            ? Array.from(new Set(inc.customTags))
            : inferDefaultMistakeTags(inc),
        grammarFocusPoint: inc.grammarFocusPoint || inferGrammarFocusPoint(inc),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (Boolean(a.convertedToSrs) !== Boolean(b.convertedToSrs)) {
      return a.convertedToSrs ? 1 : -1;
    }
    if (b.mistakeCount !== a.mistakeCount) {
      return b.mistakeCount - a.mistakeCount;
    }
    return b.timestamp - a.timestamp;
  });
}

/**
 * Pure helper that converts a MistakeRecord into a targeted SRS flashcard (VocabItem + SrsCardState)
 * scheduled for high-priority review within 6 hours so the user can rapidly conquer weak points.
 */
export function convertMistakeToTargetedVocabAndSrs(
  mistake: MistakeRecord,
  nowMs: number = Date.now()
): TargetedSrsCardConversion {
  const srsCardId = mistake.srsCardId || `srs-mistake-${mistake.questionId || mistake.id}`;
  const cleanPrompt = mistake.questionPrompt
    .replace(/^【[^】]+】\s*/g, '')
    .split('\n')
    .slice(-1)[0]
    .trim();

  const filledExampleJp = cleanPrompt.includes('（　　）')
    ? cleanPrompt.replace('（　　）', mistake.correctAnswer)
    : cleanPrompt.includes('（  ）')
      ? cleanPrompt.replace('（  ）', mistake.correctAnswer)
      : `${mistake.correctAnswer} — ${cleanPrompt}`;

  const categoryLabel =
    mistake.category === 'vocab'
      ? '語彙弱點特訓'
      : mistake.category === 'grammar'
        ? '文法弱點特訓'
        : mistake.category === 'listening'
          ? '聽解弱點特訓'
          : '讀解弱點特訓';

  return {
    vocabItem: {
      id: srsCardId,
      level: mistake.level,
      kanji: mistake.correctAnswer,
      reading: mistake.correctAnswer,
      romaji: 'Targeted Weakness Card',
      pitchAccent: `[${categoryLabel}]`,
      partOfSpeech: `${mistake.source === 'mock-exam' ? 'JLPT模擬考' : '實戰測驗場'}・${categoryLabel}`,
      meaning: `正解：「${mistake.correctAnswer}」（曾誤選：${mistake.userChosenOption}）`,
      coreImage: mistake.explanation,
      exampleJp: filledExampleJp,
      exampleHk: `【錯題擊破】${mistake.explanation}`,
    },
    srsState: {
      itemId: srsCardId,
      intervalDays: 1,
      easeFactor: 2.3,
      repetitions: 1,
      lastReviewedAt: nowMs,
      nextReviewAt: nowMs + 6 * 60 * 60 * 1000, // Due within 6 hours (shows in 24h due bucket)
      status: 'learning',
    },
  };
}

export interface MistakeWeaknessSummary {
  totalMistakes: number;
  unconvertedCount: number;
  convertedCount: number;
  topWeakCategory: string;
  byCategory: Array<{
    category: 'vocab' | 'grammar' | 'reading' | 'listening';
    labelZh: string;
    labelJa: string;
    count: number;
  }>;
}

export function analyzeMistakeWeaknessSummary(
  mistakes: MistakeRecord[]
): MistakeWeaknessSummary {
  const counts: Record<'vocab' | 'grammar' | 'reading' | 'listening', number> = {
    vocab: 0,
    grammar: 0,
    reading: 0,
    listening: 0,
  };

  let convertedCount = 0;
  for (const m of mistakes) {
    counts[m.category] = (counts[m.category] || 0) + 1;
    if (m.convertedToSrs) convertedCount += 1;
  }

  const byCategory: MistakeWeaknessSummary['byCategory'] = [
    { category: 'grammar', labelZh: '文法・助詞', labelJa: '文法・助詞', count: counts.grammar },
    { category: 'vocab', labelZh: '文字・語彙', labelJa: '文字・語彙', count: counts.vocab },
    { category: 'reading', labelZh: '讀解・語境', labelJa: '読解・文脈', count: counts.reading },
    { category: 'listening', labelZh: '聽解・應答', labelJa: '聴解・応答', count: counts.listening },
  ];

  const sorted = [...byCategory].sort((a, b) => b.count - a.count);
  const topWeakCategory =
    sorted[0] && sorted[0].count > 0 ? sorted[0].labelZh : '暫無明顯弱項';

  return {
    totalMistakes: mistakes.length,
    unconvertedCount: mistakes.length - convertedCount,
    convertedCount,
    topWeakCategory,
    byCategory,
  };
}

export function getInitialMistakeSeed(): MistakeRecord[] {
  return [
    {
      id: 'seed-mistake-n4-1',
      questionId: 'mock-n4-3',
      source: 'mock-exam',
      level: 'N4',
      category: 'grammar',
      questionPrompt: '「窓が（　　）いますよ。寒いですから、閉めてもいいですか。」',
      userChosenOption: '開けて',
      correctAnswer: '開いて',
      explanation:
        '助詞係「が」，而且後句講「好凍所以閂咗佢好冇？」，代表隻窗目前處於「打開咗嘅狀態（自動詞：開いています）」，而非人為動作進行中（他動詞：開けています）。',
      timestamp: Date.now() - 3600 * 1000,
      mistakeCount: 3,
      convertedToSrs: false,
      customTags: ['助詞疑難', '自動詞vs他動詞'],
      grammarFocusPoint: '自動詞＋ています vs 他動詞＋てあります（狀態與助詞が／を）',
    },
    {
      id: 'seed-mistake-n4-2',
      questionId: 'arena-ext-n4-1',
      source: 'quiz-arena',
      level: 'N4',
      category: 'grammar',
      questionPrompt: '「雨が降り（　　）ですから、傘を持って行ったほうがいいですよ。」',
      userChosenOption: 'らしい',
      correctAnswer: 'そう',
      explanation:
        '睇見個天黑晒「好似就嚟落雨（眼前視覺跡象推測）」，用動詞ます形去掉ます＋「そうです（雨が降りそうです）」。「らしい」係根據傳聞或客觀消息。',
      timestamp: Date.now() - 7200 * 1000,
      mistakeCount: 2,
      convertedToSrs: false,
      customTags: ['接續與句尾呼應', '助詞疑難'],
      grammarFocusPoint: '樣態助動詞「〜そうです（視覺跡象）」vs 傳聞「〜らしい」',
    },
    {
      id: 'seed-mistake-n3-3',
      questionId: 'mock-n3-8',
      source: 'mock-exam',
      level: 'N3',
      category: 'vocab',
      questionPrompt: '「このケーキは値段が高い（　　）、あまりおいしくない。」',
      userChosenOption: 'おかげで',
      correctAnswer: 'わりに',
      explanation:
        '「〜わりに（は）」表示「雖然價錢貴，但相對呢個基準嚟講並唔好食（與預期不成比例）」；「おかげで」用於正面感謝原因，漢字與逆接語境極易混淆。',
      timestamp: Date.now() - 14400 * 1000,
      mistakeCount: 1,
      convertedToSrs: false,
      customTags: ['漢字盲點', '接續與句尾呼應'],
      grammarFocusPoint: '比例逆接「〜わりに（は）」vs 原因「〜おかげで／せいで」',
    },
  ];
}

export type SpeakerVoiceRole = 'male' | 'female' | 'narrator';

export interface JlptSpeechRateConfig {
  level: JlptLevel;
  rate: number;
  labelZh: string;
  labelJa: string;
  wpmApprox: number;
}

export interface DialogueSpeechTurn {
  speaker: string;
  role: SpeakerVoiceRole;
  displayLineJp: string;
  spokenTextJp: string;
}

/**
 * Returns the JLPT level-calibrated listening speech rate (N5 slowest & clearest -> N1 native exam speed).
 */
export function getJlptListeningSpeechRate(level: JlptLevel): JlptSpeechRateConfig {
  const table: Record<JlptLevel, JlptSpeechRateConfig> = {
    N5: {
      level: 'N5',
      rate: 0.78,
      labelZh: 'N5 初級慢速清晰 (0.78x)',
      labelJa: 'N5 初級ゆっくり明瞭 (0.78x)',
      wpmApprox: 190,
    },
    N4: {
      level: 'N4',
      rate: 0.86,
      labelZh: 'N4 初中級進階語速 (0.86x)',
      labelJa: 'N4 初中級ややゆっくり (0.86x)',
      wpmApprox: 225,
    },
    N3: {
      level: 'N3',
      rate: 0.94,
      labelZh: 'N3 中級自然日常語速 (0.94x)',
      labelJa: 'N3 中級ナチュラル速度 (0.94x)',
      wpmApprox: 265,
    },
    N2: {
      level: 'N2',
      rate: 1.02,
      labelZh: 'N2 中高級商務實戰語速 (1.02x)',
      labelJa: 'N2 中上級実戦スピード (1.02x)',
      wpmApprox: 305,
    },
    N1: {
      level: 'N1',
      rate: 1.1,
      labelZh: 'N1 高級母語考場高速 (1.10x)',
      labelJa: 'N1 上級ネイティブ速度 (1.10x)',
      wpmApprox: 345,
    },
  };
  return table[level] ?? table.N4;
}

/**
 * Determines whether a speaker label should be synthesized with a Male, Female, or Narrator voice.
 */
export function detectSpeakerVoiceRole(
  speakerLabel: string,
  fallbackIndex: number = 0
): SpeakerVoiceRole {
  const s = (speakerLabel || '').trim();
  if (!s) return fallbackIndex % 2 === 0 ? 'male' : 'female';

  if (/^(質問|問題|状況|ナレーション|アナウンス|放送)/.test(s)) {
    return 'narrator';
  }
  if (/(女|母|妻|姉|妹|彼女|奥さん|受付|主婦|女子|女性|お姉さん|おばあさん|B|佐藤|山田|鈴木)/.test(s) && !/男/.test(s)) {
    return 'female';
  }
  if (/(男|父|夫|兄|弟|彼|課長|部長|社長|店長|先生|医者|運転手|駅員|警官|男子|男性|お兄さん|おじいさん|A|田中|高橋)/.test(s)) {
    return 'male';
  }

  return fallbackIndex % 2 === 0 ? 'male' : 'female';
}

const SPEAKER_PREFIX_REGEX =
  /^(?:男の人|女の人|男性|女性|男|女|店員|客|お客様|課長|部長|社長|部下|上司|先輩|後輩|先生|学生|生徒|専門家|医者|患者|受付|駅員|担当者|キャスター|アナウンサー|コメンテーター|司会|質問|問題|ナレーション|Aさん|Bさん|A|B|M|F)[：:]\s*/u;

/**
 * Strips furigana brackets `[かんじ]` AND any leading or inline speaker labels like `男：`, `女：`, `店員：`
 * so that TTS never reads `"男："` or `"女："` aloud.
 */
export function cleanSpokenJapaneseLine(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/\[[^\]]+\]/g, '') // Remove furigana brackets
    .replace(SPEAKER_PREFIX_REGEX, '') // Remove leading speaker prefix
    .replace(
      /(?:^|\n|\s+)(?:男の人|女の人|男性|女性|男|女|店員|客|お客様|課長|部長|社長|部下|上司|先輩|後輩|先生|学生|専門家|医者|患者|受付|駅員|担当者|キャスター|アナウンサー|質問|問題|A|B)[：:]\s*/gu,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses a listening script (`audioScriptJp`) and/or `dialogueSpeakers` array into sequential
 * speaker turns with explicit `'male' | 'female' | 'narrator'` voice roles and clean spoken text
 * (never reading `"男："` or `"女："` aloud).
 */
export function parseDialogueIntoSpeakerTurns(
  audioScriptJp?: string,
  dialogueSpeakers?: Array<{ speaker: string; lineJp?: string; textJp?: string }>
): DialogueSpeechTurn[] {
  const turns: DialogueSpeechTurn[] = [];

  if (dialogueSpeakers && dialogueSpeakers.length > 0) {
    // Check if audioScriptJp has a trailing "質問：..." that isn't in dialogueSpeakers
    let extractedQuestion = '';
    if (audioScriptJp) {
      const qMatch = audioScriptJp.match(/質問[：:]\s*([^。！？\n]+[。！？]?)/u);
      if (qMatch && qMatch[1]) {
        extractedQuestion = qMatch[1].trim();
      }
    }

    const speakerRoleMap = new Map<string, SpeakerVoiceRole>();
    let speakerCounter = 0;

    for (const item of dialogueSpeakers) {
      const rawLine = (item.lineJp ?? item.textJp ?? '').trim();
      if (!rawLine) continue;
      const speaker = (item.speaker || '').replace(/[：:]$/u, '').trim() || '話者';

      let role = speakerRoleMap.get(speaker);
      if (!role) {
        role = detectSpeakerVoiceRole(speaker, speakerCounter);
        // Ensure if there are 2 speakers and the second collided with the first, we alternate male/female
        if (speakerCounter === 1) {
          const firstRole = Array.from(speakerRoleMap.values())[0];
          if (firstRole === 'male' && role === 'male' && !/男/.test(speaker)) {
            role = 'female';
          } else if (firstRole === 'female' && role === 'female' && !/女/.test(speaker)) {
            role = 'male';
          }
        }
        speakerRoleMap.set(speaker, role);
        speakerCounter += 1;
      }

      const displayLineJp = rawLine.replace(SPEAKER_PREFIX_REGEX, '').trim();
      const spokenTextJp = cleanSpokenJapaneseLine(displayLineJp);
      if (spokenTextJp) {
        turns.push({
          speaker,
          role,
          displayLineJp,
          spokenTextJp,
        });
      }
    }

    if (
      extractedQuestion &&
      !turns.some((t) => t.spokenTextJp.includes(cleanSpokenJapaneseLine(extractedQuestion)))
    ) {
      turns.push({
        speaker: '質問',
        role: 'narrator',
        displayLineJp: extractedQuestion,
        spokenTextJp: cleanSpokenJapaneseLine(extractedQuestion),
      });
    }

    if (turns.length > 0) {
      return turns;
    }
  }

  // Fallback / AI-generated script parser when dialogueSpeakers is absent or empty
  const raw = (audioScriptJp || '').trim();
  if (!raw) return [];

  const markerRegex =
    /(?:^|\n|\s+)(男の人|女の人|男性|女性|男|女|店員|客|お客様|課長|部長|社長|部下|上司|先輩|後輩|先生|学生|生徒|専門家|医者|患者|受付|駅員|担当者|キャスター|アナウンサー|コメンテーター|司会|質問|問題|A|B)[：:]\s*/gu;

  const matches = Array.from(raw.matchAll(markerRegex));
  if (matches.length === 0) {
    return [
      {
        speaker: 'ナレーション',
        role: 'narrator',
        displayLineJp: raw,
        spokenTextJp: cleanSpokenJapaneseLine(raw),
      },
    ];
  }

  // Check if there is an intro narration before the first speaker marker
  const firstMatchIndex = matches[0].index ?? 0;
  if (firstMatchIndex > 0) {
    const intro = raw.slice(0, firstMatchIndex).trim();
    if (intro) {
      turns.push({
        speaker: '状況',
        role: 'narrator',
        displayLineJp: intro,
        spokenTextJp: cleanSpokenJapaneseLine(intro),
      });
    }
  }

  const speakerRoleMap = new Map<string, SpeakerVoiceRole>();
  let speakerCounter = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const speaker = match[1].trim();
    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
    const segmentText = raw.slice(contentStart, contentEnd).trim();
    if (!segmentText) continue;

    let role = speakerRoleMap.get(speaker);
    if (!role) {
      role = detectSpeakerVoiceRole(speaker, speakerCounter);
      if (speakerCounter === 1 && role !== 'narrator') {
        const firstRole = Array.from(speakerRoleMap.values()).find((r) => r !== 'narrator');
        if (firstRole === 'male' && role === 'male' && !/男/.test(speaker)) {
          role = 'female';
        } else if (firstRole === 'female' && role === 'female' && !/女/.test(speaker)) {
          role = 'male';
        }
      }
      speakerRoleMap.set(speaker, role);
      if (role !== 'narrator') speakerCounter += 1;
    }

    const spokenTextJp = cleanSpokenJapaneseLine(segmentText);
    if (spokenTextJp) {
      turns.push({
        speaker,
        role,
        displayLineJp: segmentText,
        spokenTextJp,
      });
    }
  }

  return turns;
}

export interface ShadowingDiffToken {
  char: string;
  status: 'matched' | 'missing';
}

export interface SrsCardShadowingAssessment {
  targetSentenceJp: string;
  cleanTargetJp: string;
  kanaTargetJp: string;
  spokenTranscriptJp: string;
  overallScore: number; // 0 - 100
  pronunciationScore: number; // 0 - 100
  fluencyScore: number; // 0 - 100
  pitchAccentScore: number; // 0 - 100
  targetWordHit: boolean;
  grade: 'S' | 'A' | 'B' | 'TRY_AGAIN';
  recommendedSrsRating: SrsRating;
  charDiffs: ShadowingDiffToken[];
  coachAdviceHk: string;
  coachAdviceJa: string;
  pitchAccentTipHk: string;
  evaluatedBy: 'ai-sensei' | 'local-engine';
}

/**
 * Converts furigana-annotated text like "今[いま]すぐ乗[の]れば" into its pure kana reading "いますぐのれば"
 * so that speech recognition transcripts in either Kanji or Hiragana can be compared accurately.
 */
export function expandFuriganaToKana(furiganaText: string): string {
  if (!furiganaText) return '';
  return furiganaText
    .replace(/([一-龯々ヶ]+)\[([^\]]+)\]/g, '$2')
    .replace(/[、。！？!?\s「」『』（）()・]/g, '')
    .trim();
}

/**
 * Pure, deterministic evaluation of a user's SRS Card Shadowing attempt against the card's
 * example sentence and target vocabulary word. Also merges optional AI overrides returned by
 * POST /api/ai/shadowing-evaluate.
 */
export function evaluateSrsCardShadowing(params: {
  targetSentenceJp: string;
  spokenTranscriptJp: string;
  targetKanji: string;
  targetReading: string;
  pitchAccent?: string;
  aiOverride?: Partial<SrsCardShadowingAssessment>;
}): SrsCardShadowingAssessment {
  const {
    targetSentenceJp,
    spokenTranscriptJp,
    targetKanji,
    targetReading,
    pitchAccent = '[0] 平板型',
    aiOverride,
  } = params;

  const stripPunctuation = (str: string) =>
    (str || '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/[、。！？!?\s「」『』（）()・]/g, '')
      .trim();

  const cleanTargetJp = stripPunctuation(targetSentenceJp);
  const kanaTargetJp = expandFuriganaToKana(targetSentenceJp);
  const cleanSpokenJp = stripPunctuation(spokenTranscriptJp);

  if (!cleanTargetJp || !cleanSpokenJp) {
    return {
      targetSentenceJp,
      cleanTargetJp,
      kanaTargetJp,
      spokenTranscriptJp: spokenTranscriptJp.trim(),
      overallScore: 0,
      pronunciationScore: 0,
      fluencyScore: 0,
      pitchAccentScore: 0,
      targetWordHit: false,
      grade: 'TRY_AGAIN',
      recommendedSrsRating: 'again',
      charDiffs: cleanTargetJp.split('').map((char) => ({ char, status: 'missing' })),
      coachAdviceHk: '未偵測到跟讀語音內容。請先聽一次示範朗讀，再撳「開始錄音跟讀挑戰」大聲讀出例句！',
      coachAdviceJa: '音声が検出されませんでした。お手本を聞いてからもう一度録音してください。',
      pitchAccentTipHk: `留意目標詞「${targetKanji}（${targetReading}）」嘅音調係 ${pitchAccent}。`,
      evaluatedBy: 'local-engine',
    };
  }

  // Check if user hit the target vocabulary word (in either kanji or reading form)
  const cleanKanji = stripPunctuation(targetKanji);
  const cleanReading = stripPunctuation(targetReading);
  // Also match verb stem (first 1-2 chars of kanji + reading) for conjugated verbs in example sentences
  const kanjiStem = cleanKanji.replace(/[うくぐすつぬぶむる]$/, '');
  const readingStem = cleanReading.replace(/[うくぐすつぬぶむる]$/, '');

  const localTargetWordHit = Boolean(
    (cleanKanji && cleanSpokenJp.includes(cleanKanji)) ||
      (cleanReading && cleanSpokenJp.includes(cleanReading)) ||
      (kanjiStem && kanjiStem.length >= 1 && cleanSpokenJp.includes(kanjiStem)) ||
      (readingStem && readingStem.length >= 2 && cleanSpokenJp.includes(readingStem))
  );

  // Build character-by-character diff on cleanTargetJp, also giving credit if spoken matches kanaTargetJp
  const spokenPool = cleanSpokenJp.split('');
  const charDiffs: ShadowingDiffToken[] = [];
  let matchedCount = 0;

  for (const ch of cleanTargetJp.split('')) {
    const idx = spokenPool.indexOf(ch);
    if (idx !== -1) {
      charDiffs.push({ char: ch, status: 'matched' });
      spokenPool.splice(idx, 1);
      matchedCount += 1;
    } else {
      charDiffs.push({ char: ch, status: 'missing' });
    }
  }

  // Also check kana-based similarity in case SpeechRecognition returned pure Hiragana
  const kanaPool = cleanSpokenJp.split('');
  let kanaMatchedCount = 0;
  for (const ch of kanaTargetJp.split('')) {
    const idx = kanaPool.indexOf(ch);
    if (idx !== -1) {
      kanaPool.splice(idx, 1);
      kanaMatchedCount += 1;
    }
  }

  const kanjiRatio = cleanTargetJp.length > 0 ? matchedCount / cleanTargetJp.length : 0;
  const kanaRatio = kanaTargetJp.length > 0 ? kanaMatchedCount / kanaTargetJp.length : 0;
  const bestMatchRatio = Math.max(kanjiRatio, kanaRatio);

  // If kanaRatio is higher than kanjiRatio (e.g. user spoke pure hiragana matching the reading), upgrade charDiffs
  if (kanaRatio > kanjiRatio && kanaRatio >= 0.85) {
    for (let i = 0; i < charDiffs.length; i++) {
      charDiffs[i] = { char: charDiffs[i].char, status: 'matched' };
    }
  }

  const lengthRatio =
    cleanTargetJp.length > 0
      ? Math.min(cleanSpokenJp.length, cleanTargetJp.length * 1.4) / cleanTargetJp.length
      : 0;
  const lengthBalance = Math.max(0, 1 - Math.abs(1 - lengthRatio) * 0.7);

  const computedPronunciation = Math.min(100, Math.round(bestMatchRatio * 100));
  const computedFluency = Math.min(
    100,
    Math.round(bestMatchRatio * 75 + lengthBalance * 25)
  );
  const computedPitch = Math.min(
    100,
    Math.round(bestMatchRatio * 80 + (localTargetWordHit ? 20 : 0))
  );
  const computedOverall = Math.min(
    100,
    Math.round(
      computedPronunciation * 0.5 + computedFluency * 0.25 + computedPitch * 0.25
    )
  );

  const overallScore =
    typeof aiOverride?.overallScore === 'number'
      ? Math.min(100, Math.max(0, Math.round(aiOverride.overallScore)))
      : computedOverall;
  const pronunciationScore =
    typeof aiOverride?.pronunciationScore === 'number'
      ? Math.min(100, Math.max(0, Math.round(aiOverride.pronunciationScore)))
      : computedPronunciation;
  const fluencyScore =
    typeof aiOverride?.fluencyScore === 'number'
      ? Math.min(100, Math.max(0, Math.round(aiOverride.fluencyScore)))
      : computedFluency;
  const pitchAccentScore =
    typeof aiOverride?.pitchAccentScore === 'number'
      ? Math.min(100, Math.max(0, Math.round(aiOverride.pitchAccentScore)))
      : computedPitch;
  const targetWordHit =
    typeof aiOverride?.targetWordHit === 'boolean'
      ? aiOverride.targetWordHit
      : localTargetWordHit;

  const grade: SrsCardShadowingAssessment['grade'] =
    overallScore >= 90
      ? 'S'
      : overallScore >= 78
        ? 'A'
        : overallScore >= 58
          ? 'B'
          : 'TRY_AGAIN';

  const recommendedSrsRating: SrsRating =
    grade === 'S'
      ? 'easy'
      : grade === 'A'
        ? 'good'
        : grade === 'B'
          ? 'hard'
          : 'again';

  const missedSample = charDiffs
    .filter((d) => d.status === 'missing')
    .map((d) => d.char)
    .slice(0, 5)
    .join('・');

  const defaultAdviceHk =
    grade === 'S'
      ? `🌟 完美跟讀（綜合 ${overallScore} 分）！你成功準確讀出核心詞「${targetKanji}（${targetReading}）」同整句助詞節奏，母語感極佳！`
      : grade === 'A'
        ? `👏 跟讀表現優秀（綜合 ${overallScore} 分）！核心詞「${targetKanji}」發音清晰${missedSample ? `，微調埋「${missedSample}」嘅連音就會更完美` : ''}。`
        : grade === 'B'
          ? `💡 基本掌握句子骨架（綜合 ${overallScore} 分）。建議聽一次「0.75x 慢速示範」，特別留意${missedSample ? `「${missedSample}」及` : ''}核心詞「${targetKanji}」嘅銜接。`
          : `🔁 建議先撳「0.75x 慢速示範」聽清楚每個假名拍子，特別係「${targetKanji}（${targetReading}）」，再重新錄音挑戰！`;

  const defaultAdviceJa =
    grade === 'S'
      ? `🌟 完璧なシャドーイングです（総合 ${overallScore}点）！「${targetKanji}」のアクセントも文全体のリズムも非常に自然です。`
      : grade === 'A'
        ? `👏 素晴らしい発音です（総合 ${overallScore}点）！核心語「${targetKanji}」がしっかり聞き取れます。`
        : grade === 'B'
          ? `💡 文の流れは掴めています（総合 ${overallScore}点）。ゆっくり再生でお手本のリズムを確認してみましょう。`
          : `🔁 まずは「0.75x ゆっくり再生」でお手本を聞いてから、もう一度シャドーイングしてみましょう。`;

  const defaultPitchTipHk = pitchAccent.includes('[0]')
    ? `音調貼士：「${targetKanji}（${targetReading}）」屬 ${pitchAccent}，第1拍低、第2拍起保持平高直到助詞都唔跌調。`
    : pitchAccent.includes('[1]')
      ? `音調貼士：「${targetKanji}（${targetReading}）」屬 ${pitchAccent}（頭高型），第1拍讀高音，第2拍即刻向下跌調。`
      : `音調貼士：「${targetKanji}（${targetReading}）」屬 ${pitchAccent}，留意重音核之後向下跌調嘅高低落差。`;

  return {
    targetSentenceJp,
    cleanTargetJp,
    kanaTargetJp,
    spokenTranscriptJp: cleanSpokenJp,
    overallScore,
    pronunciationScore,
    fluencyScore,
    pitchAccentScore,
    targetWordHit,
    grade,
    recommendedSrsRating,
    charDiffs,
    coachAdviceHk: aiOverride?.coachAdviceHk || defaultAdviceHk,
    coachAdviceJa: aiOverride?.coachAdviceJa || defaultAdviceJa,
    pitchAccentTipHk: aiOverride?.pitchAccentTipHk || defaultPitchTipHk,
    evaluatedBy: aiOverride ? 'ai-sensei' : 'local-engine',
  };
}

export interface PitchMoraNode {
  index: number; // 0-based index (last node is reference particle)
  mora: string;
  romaji: string;
  pitch: 'H' | 'L';
  isAccentNucleus: boolean; // true if pitch drops immediately after this mora
  isParticle: boolean;
  tipZh: string;
  tipJa: string;
}

export interface PitchAccentAnalysis {
  kanji: string;
  reading: string;
  moraCount: number;
  dropIndex: number;
  patternType: 'heiban' | 'atamadaka' | 'nakadaka' | 'odaka';
  patternBadgeText: string;
  patternNameZh: string;
  patternNameJa: string;
  moraNodes: PitchMoraNode[];
  contourNotation: string;
  coachTipZh: string;
  coachTipJa: string;
  particlePhraseJp: string;
  particleReadingJp: string;
}

const KANA_TO_ROMAJI_MAP: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  っ: '(促)', ー: 'ー',
};

function toHiragana(input: string): string {
  return input.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

export function moraToRomaji(mora: string): string {
  const hira = toHiragana(mora);
  return KANA_TO_ROMAJI_MAP[hira] || mora;
}

/**
 * Splits a Japanese kana string into phonological morae (拍 / モーラ).
 * Small yōon vowels (ゃ, ゅ, ょ, ぁ, ぃ, ぅ, ぇ, ぉ, ゎ) merge with the preceding kana,
 * while っ (geminate), ん (nasal), and ー (long vowel) remain standalone morae.
 */
export function splitJapaneseReadingIntoMorae(reading: string): string[] {
  const cleaned = (reading || '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/[、。！？!?\s「」『』（）()・]/g, '')
    .trim();

  if (!cleaned) return [];

  const SMALL_YOON = new Set([
    'ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゎ',
    'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ヮ',
  ]);

  const chars = Array.from(cleaned);
  const morae: string[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (SMALL_YOON.has(ch) && morae.length > 0) {
      morae[morae.length - 1] += ch;
    } else {
      morae.push(ch);
    }
  }

  return morae;
}

/**
 * Extracts the numerical pitch drop index (0, 1, 2, 3, ...) from strings such as
 * "[3] 中高型", "②", "⓪", "[0] 平板型", or "① [頭高型]".
 */
export function parsePitchDropNumber(pitchAccentRaw?: string): number {
  if (!pitchAccentRaw) return 0;
  const text = pitchAccentRaw.trim();

  const circledMap: Record<string, number> = {
    '⓪': 0,
    '①': 1,
    '②': 2,
    '③': 3,
    '④': 4,
    '⑤': 5,
    '⑥': 6,
    '⑦': 7,
    '⑧': 8,
  };

  for (const [symbol, num] of Object.entries(circledMap)) {
    if (text.includes(symbol)) return num;
  }

  const bracketMatch = text.match(/\[(\d+)\]/);
  if (bracketMatch) {
    return parseInt(bracketMatch[1], 10);
  }

  const digitMatch = text.match(/(\d+)/);
  if (digitMatch) {
    return parseInt(digitMatch[1], 10);
  }

  if (text.includes('頭高')) return 1;
  if (text.includes('平板')) return 0;

  return 0;
}

/**
 * Generates a complete mora-by-mora Tokyo Standard Pitch Accent contour analysis
 * including a trailing reference particle ("が") so users can clearly see and hear
 * High/Low transitions and accent nucleus drops.
 */
export function analyzePitchAccentContour(params: {
  kanji: string;
  reading: string;
  pitchAccent?: string;
}): PitchAccentAnalysis {
  const { kanji, reading, pitchAccent } = params;
  const baseMorae = splitJapaneseReadingIntoMorae(reading || kanji);
  const safeMorae = baseMorae.length > 0 ? baseMorae : [kanji || 'あ'];
  const moraCount = safeMorae.length;

  const rawDrop = parsePitchDropNumber(pitchAccent);
  const dropIndex = Math.max(0, Math.min(rawDrop, moraCount));

  let patternType: PitchAccentAnalysis['patternType'] = 'heiban';
  if (dropIndex === 0) {
    patternType = 'heiban';
  } else if (dropIndex === 1) {
    patternType = 'atamadaka';
  } else if (dropIndex === moraCount) {
    patternType = 'odaka';
  } else {
    patternType = 'nakadaka';
  }

  const patternMeta = {
    heiban: {
      badge: `[0] 平板型 · Heiban`,
      zh: '平板型（第 1 拍低，第 2 拍起升調並持續平高至助詞）',
      ja: '平板型（1拍目が低く、2拍目から高くなり助詞までそのまま続く）',
      coachZh: `「${kanji}（${reading}）」屬於 [0] 平板型。竅門係第 1 拍「${safeMorae[0]}」壓低，第 2 拍起自然升高並保持平穩，就算後面加助詞「が／を／に」都唔會跌調！`,
      coachJa: `「${kanji}（${reading}）」は [0] 平板型です。1拍目「${safeMorae[0]}」を低く入り、2拍目から高くして、後ろに助詞「が」が付いても下がりません。`,
    },
    atamadaka: {
      badge: `[1] 頭高型 · Atamadaka`,
      zh: '頭高型（第 1 拍高音重讀，第 2 拍起立即向下跌調）',
      ja: '頭高型（1拍目が高く、2拍目から一気に下がる）',
      coachZh: `「${kanji}（${reading}）」屬於 [1] 頭高型。竅門係一開口第 1 拍「${safeMorae[0]}」就要讀高音，跟住第 2 拍即刻似落樓梯咁跌落低音並維持到尾。`,
      coachJa: `「${kanji}（${reading}）」は [1] 頭高型です。最初の1拍目「${safeMorae[0]}」を高く発音し、2拍目から一気に低く下げます。`,
    },
    nakadaka: {
      badge: `[${dropIndex}] 中高型 · Nakadaka`,
      zh: `中高型（第 1 拍低、第 2 至 ${dropIndex} 拍高，第 ${dropIndex} 拍「${safeMorae[dropIndex - 1]}」後急跌）`,
      ja: `中高型（1拍目が低く、2〜${dropIndex}拍目が高く、「${safeMorae[dropIndex - 1]}」の直後に下がる）`,
      coachZh: `「${kanji}（${reading}）」屬於 [${dropIndex}] 中高型。重音核（下がり目）落喺第 ${dropIndex} 拍「${safeMorae[dropIndex - 1]}」後面——讀完「${safeMorae[dropIndex - 1]}」高音之後，下一拍「${safeMorae[dropIndex] || 'が'}」必須明顯向下跌調！`,
      coachJa: `「${kanji}（${reading}）」は [${dropIndex}] 中高型です。${dropIndex}拍目「${safeMorae[dropIndex - 1]}」まで高く保ち、その直後の「${safeMorae[dropIndex] || 'が'}」でしっかり音を下げます。`,
    },
    odaka: {
      badge: `[${dropIndex}] 尾高型 · Odaka`,
      zh: `尾高型（詞內走勢似平板型，但接助詞「が」時喺第 ${dropIndex} 拍後跌調）`,
      ja: `尾高型（語末「${safeMorae[dropIndex - 1]}」まで高く、続く助詞「が」で下がる）`,
      coachZh: `「${kanji}（${reading}）」屬於 [${dropIndex}] 尾高型。單獨讀嗰陣聽落好似平板型，但只要後面一接助詞（例如「${kanji}が」），個助詞「が」就會即刻向下跌調！`,
      coachJa: `「${kanji}（${reading}）」は [${dropIndex}] 尾高型です。単語の最後「${safeMorae[dropIndex - 1]}」まで高く、後ろに助詞「が」が付いた瞬間に音が下がります。`,
    },
  }[patternType];

  const allTokens = [
    ...safeMorae.map((m, idx) => ({ mora: m, isParticle: false, idx })),
    { mora: 'が', isParticle: true, idx: moraCount },
  ];

  const moraNodes: PitchMoraNode[] = allTokens.map((item) => {
    const i = item.idx;
    let pitch: 'H' | 'L' = 'L';
    if (dropIndex === 0) {
      pitch = i === 0 ? 'L' : 'H';
    } else if (dropIndex === 1) {
      pitch = i === 0 ? 'H' : 'L';
    } else {
      pitch = i >= 1 && i <= dropIndex - 1 ? 'H' : 'L';
    }

    const isAccentNucleus = dropIndex > 0 && i === dropIndex - 1;
    const romaji = moraToRomaji(item.mora);

    const tipZh = item.isParticle
      ? pitch === 'H'
        ? `助詞「が」維持高音（平板型特徵：詞尾無跌調）`
        : `助詞「が」保持低音（重音核已喺前面跌落嚟）`
      : isAccentNucleus
        ? `★ 重音核（第 ${i + 1} 拍「${item.mora}」）：此拍讀高音，讀完後下一拍立即向下跌調！`
        : pitch === 'H'
          ? `第 ${i + 1} 拍「${item.mora}」：高音拍（High Pitch），聲帶保持輕快高平`
          : `第 ${i + 1} 拍「${item.mora}」：低音拍（Low Pitch），聲調自然沉穩`;

    const tipJa = item.isParticle
      ? pitch === 'H'
        ? `助詞「が」：高いまま続く（平板型の特徴）`
        : `助詞「が」：低く発音する（下がり目の後）`
      : isAccentNucleus
        ? `★ アクセント核（${i + 1}拍目「${item.mora}」）：高く発音し、この直後に音を下げます！`
        : pitch === 'H'
          ? `${i + 1}拍目「${item.mora}」：高い音（High）`
          : `${i + 1}拍目「${item.mora}」：低い音（Low）`;

    return {
      index: i,
      mora: item.mora,
      romaji,
      pitch,
      isAccentNucleus,
      isParticle: item.isParticle,
      tipZh,
      tipJa,
    };
  });

  const contourParts: string[] = [];
  for (let i = 0; i < moraNodes.length; i++) {
    const node = moraNodes[i];
    const label = node.isParticle ? `[${node.mora}(${node.pitch})]` : `${node.mora}(${node.pitch})`;
    const suffix = node.isAccentNucleus ? '＼' : '';
    if (i > 0) {
      const prev = moraNodes[i - 1];
      const arrow =
        prev.pitch === 'L' && node.pitch === 'H'
          ? ' ↗ '
          : prev.pitch === 'H' && node.pitch === 'L'
            ? ' ↘ '
            : ' → ';
      contourParts.push(arrow);
    }
    contourParts.push(`${label}${suffix}`);
  }

  return {
    kanji,
    reading: reading || kanji,
    moraCount,
    dropIndex,
    patternType,
    patternBadgeText: patternMeta.badge,
    patternNameZh: patternMeta.zh,
    patternNameJa: patternMeta.ja,
    moraNodes,
    contourNotation: contourParts.join(''),
    coachTipZh: patternMeta.coachZh,
    coachTipJa: patternMeta.coachJa,
    particlePhraseJp: `${kanji}が`,
    particleReadingJp: `${safeMorae.join('')}が`,
  };
}

export interface MistakeDictationChallenge {
  mistakeId: string;
  level: JlptLevel;
  targetFocusJp: string;
  targetFocusReading: string;
  dictationSentenceJp: string;
  cleanSpokenSentenceJp: string;
  translationHk: string;
  listeningHintHk: string;
  listeningHintJa: string;
  speedPresets: {
    slowRate: number;
    calibratedRate: number;
    nativeRate: number;
  };
  tokenBank: string[];
  audioDataUrl?: string;
  generatedBy: 'ai-sensei' | 'curated-engine';
}

export interface MistakeDictationEvaluation {
  mistakeId: string;
  expectedSentenceJp: string;
  spokenOrTypedJp: string;
  accuracyScore: number; // 0 - 100
  focusPointHit: boolean;
  grade: 'PERFECT' | 'GOOD' | 'RETRY';
  charDiffs: ShadowingDiffToken[];
  feedbackHk: string;
  feedbackJa: string;
}

/**
 * Builds a blind listening dictation challenge from a MistakeRecord by embedding the
 * missed grammar point or vocabulary item into a complete spoken Japanese sentence
 * and calibrating playback speeds for listening reinforcement.
 */
export function buildMistakeDictationChallenge(
  mistake: MistakeRecord,
  aiOverride?: Partial<MistakeDictationChallenge>
): MistakeDictationChallenge {
  const focusJp = (
    aiOverride?.targetFocusJp ||
    mistake.correctAnswer ||
    ''
  )
    .replace(/\[[^\]]+\]/g, '')
    .trim();

  const focusReading = (
    aiOverride?.targetFocusReading ||
    expandFuriganaToKana(mistake.correctAnswer || '') ||
    focusJp
  ).trim();

  // Reconstruct a clean Japanese sentence containing the target grammar/vocabulary point
  let baseSentence = (aiOverride?.dictationSentenceJp || '').trim();

  if (!baseSentence) {
    const rawPrompt = (mistake.questionPrompt || '').split('\n')[0].trim();
    // Extract quoted sentence if present e.g. 「...（　　）...」
    const quoteMatch = rawPrompt.match(/「([^」]+)」/);
    const candidate = quoteMatch ? quoteMatch[1] : rawPrompt;

    // Replace blank markers with the correct answer (preserving furigana in dictationSentenceJp)
    const answerWithFurigana = (mistake.correctAnswer || focusJp).trim();
    const filled = candidate
      .replace(/（[\s　]*）|\([\s　]*\)|＿+|[★☆]/g, answerWithFurigana)
      .replace(/次の文の|空欄に入る|最もよいものを|選びなさい|どれですか/g, '')
      .trim();

    if (filled && (filled.includes(focusJp) || filled.includes(answerWithFurigana)) && filled.length >= 6) {
      baseSentence = filled.endsWith('。') || filled.endsWith('？') ? filled : `${filled}。`;
    } else {
      baseSentence = `今日[きょう]の復習[ふくしゅう]では、「${answerWithFurigana}」という表現[ひょうげん]を正確[せいかく]に聞[き]き取[と]りましょう。`;
    }
  }

  const cleanSpokenSentenceJp = (
    aiOverride?.cleanSpokenSentenceJp ||
    cleanSpokenJapaneseLine(baseSentence.replace(/\[[^\]]+\]/g, ''))
  ).trim();

  const calibrated = Number(
    Math.min(0.92, getJlptListeningSpeechRate(mistake.level).rate).toFixed(2)
  );

  // Build interactive phrase/word chunks for the dictation assistant bar
  const stripped = cleanSpokenSentenceJp.replace(/[、。！？!?\s「」『』]/g, '');
  const tokenBank: string[] = [];
  if (focusJp && stripped.includes(focusJp)) {
    const idx = stripped.indexOf(focusJp);
    const before = stripped.slice(0, idx);
    const after = stripped.slice(idx + focusJp.length);
    if (before.length > 0) {
      const mid = Math.ceil(before.length / 2);
      if (before.slice(0, mid)) tokenBank.push(before.slice(0, mid));
      if (before.slice(mid)) tokenBank.push(before.slice(mid));
    }
    tokenBank.push(focusJp);
    if (after.length > 0) {
      const mid = Math.ceil(after.length / 2);
      if (after.slice(0, mid)) tokenBank.push(after.slice(0, mid));
      if (after.slice(mid)) tokenBank.push(after.slice(mid));
    }
  } else {
    const step = Math.max(2, Math.ceil(stripped.length / 4));
    for (let i = 0; i < stripped.length; i += step) {
      tokenBank.push(stripped.slice(i, i + step));
    }
  }

  // Add the user's original wrong choice as a contrast trap token if different
  const cleanWrong = (mistake.userChosenOption || '').replace(/\[[^\]]+\]/g, '').trim();
  if (cleanWrong && cleanWrong !== focusJp && !tokenBank.includes(cleanWrong)) {
    tokenBank.push(cleanWrong);
  }

  return {
    mistakeId: mistake.id,
    level: mistake.level,
    targetFocusJp: focusJp,
    targetFocusReading: focusReading,
    dictationSentenceJp: baseSentence,
    cleanSpokenSentenceJp,
    translationHk:
      aiOverride?.translationHk ||
      `【弱點聽寫強化】重點捕捉「${focusJp}」喺句子入面嘅前後助詞接續與語音連讀。`,
    listeningHintHk:
      aiOverride?.listeningHintHk ||
      `先用 0.7× 慢速聽清楚核心考點「${focusJp}」嘅發音同埋前後助詞，唔睇選項盲聽默寫出完整日文句子！`,
    listeningHintJa:
      aiOverride?.listeningHintJa ||
      `選択肢を見ずに音声だけを聞いて、「${focusJp}」を含む文をディクテーション（書き取り）しましょう。`,
    speedPresets: {
      slowRate: 0.7,
      calibratedRate: calibrated,
      nativeRate: 1.0,
    },
    tokenBank: aiOverride?.tokenBank && aiOverride.tokenBank.length > 0 ? aiOverride.tokenBank : tokenBank,
    audioDataUrl: aiOverride?.audioDataUrl,
    generatedBy: aiOverride ? 'ai-sensei' : 'curated-engine',
  };
}

/**
 * Evaluates a user's blind listening dictation response against the target sentence
 * (accepting both Kanji and Hiragana) and checks if the weak grammar/vocab point was hit.
 */
export function evaluateMistakeDictationChallenge(params: {
  challenge: MistakeDictationChallenge;
  userDictationText: string;
}): MistakeDictationEvaluation {
  const { challenge, userDictationText } = params;

  const stripPunctuation = (str: string) =>
    (str || '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/[、。！？!?\s「」『』（）()・]/g, '')
      .trim();

  const cleanExpected = stripPunctuation(challenge.cleanSpokenSentenceJp);
  const kanaExpected = stripPunctuation(expandFuriganaToKana(challenge.dictationSentenceJp));
  const cleanUser = stripPunctuation(userDictationText);

  if (!cleanUser) {
    return {
      mistakeId: challenge.mistakeId,
      expectedSentenceJp: challenge.cleanSpokenSentenceJp,
      spokenOrTypedJp: '',
      accuracyScore: 0,
      focusPointHit: false,
      grade: 'RETRY',
      charDiffs: cleanExpected.split('').map((char) => ({ char, status: 'missing' })),
      feedbackHk: '請先播放題目語音，並喺輸入框寫低（或點選字塊拼出）你聽到嘅日文句子！',
      feedbackJa: 'まず音声を再生して、聞き取った日本語の文を入力してください。',
    };
  }

  const cleanFocus = stripPunctuation(challenge.targetFocusJp);
  const cleanFocusReading = stripPunctuation(challenge.targetFocusReading);
  const focusPointHit = Boolean(
    (cleanFocus && cleanUser.includes(cleanFocus)) ||
      (cleanFocusReading && cleanUser.includes(cleanFocusReading))
  );

  const userPool = cleanUser.split('');
  const charDiffs: ShadowingDiffToken[] = [];
  let matched = 0;

  for (const ch of cleanExpected.split('')) {
    const idx = userPool.indexOf(ch);
    if (idx !== -1) {
      charDiffs.push({ char: ch, status: 'matched' });
      userPool.splice(idx, 1);
      matched += 1;
    } else {
      charDiffs.push({ char: ch, status: 'missing' });
    }
  }

  // Also check pure Hiragana match ratio
  const kanaPool = cleanUser.split('');
  let kanaMatched = 0;
  for (const ch of kanaExpected.split('')) {
    const idx = kanaPool.indexOf(ch);
    if (idx !== -1) {
      kanaPool.splice(idx, 1);
      kanaMatched += 1;
    }
  }

  const kanjiRatio = cleanExpected.length > 0 ? matched / cleanExpected.length : 0;
  const kanaRatio = kanaExpected.length > 0 ? kanaMatched / kanaExpected.length : 0;
  const bestRatio = Math.max(kanjiRatio, kanaRatio);

  if (kanaRatio > kanjiRatio && kanaRatio >= 0.85) {
    for (let i = 0; i < charDiffs.length; i++) {
      charDiffs[i] = { char: charDiffs[i].char, status: 'matched' };
    }
  }

  const rawScore = Math.round(bestRatio * 80 + (focusPointHit ? 20 : 0));
  const accuracyScore = Math.min(100, Math.max(0, rawScore));

  const grade: MistakeDictationEvaluation['grade'] =
    accuracyScore >= 88 && focusPointHit
      ? 'PERFECT'
      : accuracyScore >= 60 || focusPointHit
        ? 'GOOD'
        : 'RETRY';

  const feedbackHk =
    grade === 'PERFECT'
      ? `🎯 聽寫滿分擊破（${accuracyScore}%）！你唔單止成功盲聽捕捉到弱點考點「${challenge.targetFocusJp}」，連整句助詞細節都完全聽清！`
      : grade === 'GOOD'
        ? `👏 表現唔錯（${accuracyScore}%）！${focusPointHit ? `已成功聽出關鍵考點「${challenge.targetFocusJp}」` : `建議再聽一次慢速版，特別留意「${challenge.targetFocusJp}」嘅發音`}，對照下方逐字色標執埋剩餘助詞就完美！`
        : `🔁 仲差少少（${accuracyScore}%）！建議切換去「0.7× 慢速強化」再聽一次，特別留意弱點詞「${challenge.targetFocusJp}」出現嘅位置。`;

  const feedbackJa =
    grade === 'PERFECT'
      ? `🎯 ディクテーション完璧です（${accuracyScore}%）！弱点ポイント「${challenge.targetFocusJp}」も文全体も正確に聞き取れています！`
      : grade === 'GOOD'
        ? `👏 よく聞き取れています（${accuracyScore}%）！赤い文字の部分をもう一度スロー再生で確認しましょう。`
        : `🔁 「0.7× スロー強化」に切り替えて、重要表現「${challenge.targetFocusJp}」の音と前後の助詞をもう一度聞いてみましょう。`;

  return {
    mistakeId: challenge.mistakeId,
    expectedSentenceJp: challenge.cleanSpokenSentenceJp,
    spokenOrTypedJp: cleanUser,
    accuracyScore,
    focusPointHit,
    grade,
    charDiffs,
    feedbackHk,
    feedbackJa,
  };
}

// ============================================================================
// 11. Owner-Only Google Account Access Verification (bentktk2024@gmail.com)
// ============================================================================

export const ALLOWED_OWNER_EMAIL = 'bentktk2024@gmail.com';

export interface OwnerAccessCheckResult {
  allowed: boolean;
  normalizedEmail: string;
  ownerEmail: string;
  reasonHk: string;
  reasonJa: string;
}

/**
 * Verifies whether a signed-in Google account email matches the exclusive owner account
 * (`bentktk2024@gmail.com`).
 */
export function verifyOwnerGoogleAccount(
  email?: string | null,
  allowedOwnerEmail: string = ALLOWED_OWNER_EMAIL
): OwnerAccessCheckResult {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedOwner = String(allowedOwnerEmail || ALLOWED_OWNER_EMAIL)
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    return {
      allowed: false,
      normalizedEmail: '',
      ownerEmail: normalizedOwner,
      reasonHk: `請使用擁有者專屬 Google 帳號（${normalizedOwner}）登入。`,
      reasonJa: `オーナー専用 Google アカウント（${normalizedOwner}）でログインしてください。`,
    };
  }

  if (normalizedEmail === normalizedOwner) {
    return {
      allowed: true,
      normalizedEmail,
      ownerEmail: normalizedOwner,
      reasonHk: `✓ 已通過擁有者身份驗證（${normalizedOwner}），歡迎返嚟言の葉道場！`,
      reasonJa: `✓ オーナー認証完了（${normalizedOwner}）。言の葉道場へようこそ！`,
    };
  }

  return {
    allowed: false,
    normalizedEmail,
    ownerEmail: normalizedOwner,
    reasonHk: `⛔ 存取遭拒：帳號「${normalizedEmail}」並非本道場擁有者。此系統僅限 ${normalizedOwner} 登入！`,
    reasonJa: `⛔ アクセス拒否：「${normalizedEmail}」は許可されていません。オーナー（${normalizedOwner}）のみ入場可能です。`,
  };
}

// ============================================================================
// 12. Dynamic Change Scene Nuance & Particle Analyzer (語感解析模式・兩邊同步變化)
// ============================================================================

export interface DynamicParticleHighlight {
  particleJp: string;
  attachedWordJp: string;
  roleLabelHk: string;
  explanationHk: string;
  explanationJa: string;
}

export interface DynamicNuanceGrammarComparison {
  patternId: 'nitsurete' | 'nishitagatte' | 'ba_hodo' | 'tomoni';
  patternJp: string;
  level: JlptLevel;
  registerLabelHk: string;
  registerLabelJa: string;
  sentenceJp: string;
  cleanSpokenJp: string;
  translationHk: string;
  clauseA: {
    textJp: string;
    meaningHk: string;
    changeVerbType: string;
    dynamicNoteHk: string;
  };
  connectorGrammar: {
    formJp: string;
    ruleHk: string;
    ruleJa: string;
  };
  clauseB: {
    textJp: string;
    meaningHk: string;
    changeVerbType: string;
    constraintNoteHk: string;
    constraintNoteJa: string;
  };
  particleHighlights: DynamicParticleHighlight[];
}

export interface DynamicSceneAnalysisResult {
  sceneInput: string;
  sceneSummaryHk: string;
  sceneSummaryJa: string;
  clauseALabelHk: string;
  clauseBLabelHk: string;
  coreRuleBannerHk: string;
  coreRuleBannerJa: string;
  wrongUsageTrap: {
    wrongSentenceJp: string;
    correctSentenceJp: string;
    reasonHk: string;
    reasonJa: string;
  };
  generatedExamples: DynamicNuanceGrammarComparison[];
  generatedBy: 'ai-sensei' | 'local-engine';
}

export const DYNAMIC_NUANCE_PRESET_SCENES: Array<{
  id: string;
  labelHk: string;
  scenePrompt: string;
}> = [
  {
    id: 'weather-heater',
    labelHk: '❄️ 天氣轉冷 ➔ 暖氣開得越強',
    scenePrompt: '隨著天氣轉冷，暖氣開得越強',
  },
  {
    id: 'jp-anime',
    labelHk: '🎬 日文越學越深 ➔ 聽得明嘅動漫台詞越多',
    scenePrompt: '隨著日文越學越深入，聽得明嘅動漫台詞越來越多',
  },
  {
    id: 'exam-nervous',
    labelHk: '📝 能力試逼近 ➔ 心情越來越緊張',
    scenePrompt: '隨著 JLPT 考試日子逼近，心情變得越來越緊張',
  },
  {
    id: 'altitude-temp',
    labelHk: '⛰️ 海拔越來越高 ➔ 氣溫逐漸下降',
    scenePrompt: '隨著爬山海拔越來越高，周圍嘅氣溫逐漸下降',
  },
  {
    id: 'tech-convenient',
    labelHk: '🤖 科技發展 ➔ 日常生活越來越方便',
    scenePrompt: '隨著科技與AI發展，日常生活變得越來越方便',
  },
  {
    id: 'price-cooking',
    labelHk: '🛒 物價不斷上漲 ➔ 自己煮飯次數增加',
    scenePrompt: '隨著出街食飯物價不斷上漲，喺屋企自己煮飯嘅次數越來越多',
  },
];

interface SceneTemplateBlueprint {
  keywords: RegExp;
  clauseALabelHk: string;
  clauseBLabelHk: string;
  summaryHk: string;
  summaryJa: string;
  wrongTrap: {
    wrongSentenceJp: string;
    correctSentenceJp: string;
    reasonHk: string;
    reasonJa: string;
  };
  examples: DynamicNuanceGrammarComparison[];
}

const SCENE_TEMPLATES: SceneTemplateBlueprint[] = [
  {
    keywords: /(天氣|冷|寒|氣溫|暖氣|暖房|冬|凍|溫度)/u,
    clauseALabelHk: '前件 A（起點漸進變化）：天氣／氣溫逐漸轉冷（寒くなる／気温が下がる）',
    clauseBLabelHk: '後件 B（同步伴隨變化）：暖氣設定溫度／出力越開越強（暖房が強くなる／出力を上げる）',
    summaryHk:
      '此場景屬於典型嘅「A 與 B 雙向同步漸進變化」：前件 A（氣溫下降）係持續動態過程，後件 B（調高暖氣強度）亦隨之逐步遞增，日文必須配搭「変化動詞／形容詞＋なる」並準確區分自動詞助詞「が」與他動詞助詞「を」。',
    summaryJa:
      '「気温の低下（前件A）」に伴って「暖房の強さの上昇（後件B）」が同時並行で進む動態変化の場面です。自動詞表現には「が」、意図的な調整（他動詞）には「を」を使い分けます。',
    wrongTrap: {
      wrongSentenceJp: '× 天気[てんき]が寒[さむ]くなるにつれて、暖房[だんぼう]を強[つよ]くしたいです。',
      correctSentenceJp: '○ 天気[てんき]が寒[さむ]くなるにつれて、暖房[だんぼう]の設定[せってい]が強[つよ]くなっていく。',
      reasonHk:
        '「〜につれて／〜にしたがって」後件 B 必須係客觀發生嘅「動態變化趨勢」，唔可以用主觀願望「〜たいです」、意志「〜つもりだ」或命令句「〜てください」結尾！',
      reasonJa:
        '「〜につれて／〜にしたがって」の後件には自然な変化の進行を表す表現が来るため、「〜たい」「〜ようと思う」「〜てください」などの意向・希望表現は使えません。',
    },
    examples: [
      {
        patternId: 'nitsurete',
        patternJp: '① 〜につれて（伴隨自然單向漸進變化）',
        level: 'N3',
        registerLabelHk: '日常自然描寫・最常用',
        registerLabelJa: '日常会話・自然な推移',
        sentenceJp:
          '天気[てんき]が寒[さむ]くなるにつれて、暖房[だんぼう]の設定[せってい]がだんだん強[つよ]くなる。',
        cleanSpokenJp: '天気が寒くなるにつれて、暖房の設定がだんだん強くなる。',
        translationHk: '隨住天氣轉冷，暖氣嘅設定亦漸漸開得越嚟越強。',
        clauseA: {
          textJp: '天気[てんき]が寒[さむ]くなる',
          meaningHk: '天氣變得寒冷（い形容詞く形＋なる）',
          changeVerbType: 'い形容詞連用形（寒く）＋ 変化動詞「なる」',
          dynamicNoteHk: '表示氣溫由暖轉涼再轉冷嘅連續動態過程，而非靜態嘅「寒い」。',
        },
        connectorGrammar: {
          formJp: '〜につれて',
          ruleHk: '前接「変化動詞辞書形（なる・増える・下がる）」或「変化性名詞」',
          ruleJa: '変化を表す動詞の辞書形・名詞＋につれて（一方向の自然な比例変化）',
        },
        clauseB: {
          textJp: '暖房[だんぼう]の設定[せってい]がだんだん強[つよ]くなる',
          meaningHk: '暖氣設定漸漸變強',
          changeVerbType: '副詞「だんだん」＋ い形容詞變化「強くなる」',
          constraintNoteHk: '後件用「強くなる（自動詞化變化）」呼應前件，強調兩邊一齊漸變。',
          constraintNoteJa: '前件の推移に連動して後件も「だんだん〜なる」と動的に変化します。',
        },
        particleHighlights: [
          {
            particleJp: 'が',
            attachedWordJp: '天気[てんき]が / 設定[せってい]が',
            roleLabelHk: '自動詞・狀態變化主體格助詞',
            explanationHk: '標示自然現象（天気）與狀態自發改變嘅主體（設定），配搭「なる」。',
            explanationJa: '自然現象や状態変化の主体を表す格助詞「が」（〜が寒くなる／強くなる）。',
          },
          {
            particleJp: 'に',
            attachedWordJp: '〜につれて',
            roleLabelHk: '伴隨基準助詞',
            explanationHk: '固定句型「につれて」中嘅「に」標示變化所跟隨嘅基準方向。',
            explanationJa: '変化の基準・連動の対象を示す「に」（〜に伴って）。',
          },
        ],
      },
      {
        patternId: 'nishitagatte',
        patternJp: '② 〜にしたがって（伴隨客觀規律／階段遞進）',
        level: 'N3',
        registerLabelHk: '書面語・新聞氣象報導',
        registerLabelJa: '書き言葉・客観的記述',
        sentenceJp:
          '外[そと]の気温[きおん]が下[さ]がるにしたがって、部屋[へや]の暖房[だんぼう]を強[つよ]くする時間[じかん]が増[ふ]えてきた。',
        cleanSpokenJp: '外の気温が下がるにしたがって、部屋の暖房を強くする時間が増えてきた。',
        translationHk: '隨住室外氣溫下降，將房入面暖氣調強嘅時間亦越嚟越多。',
        clauseA: {
          textJp: '外[そと]の気温[きおん]が下[さ]がる',
          meaningHk: '室外氣溫下降',
          changeVerbType: '自動詞辞書形「下がる」（自發下降）',
          dynamicNoteHk: '使用自動詞「下がる」客觀描述溫度計數字向下跌嘅動態。',
        },
        connectorGrammar: {
          formJp: '〜にしたがって',
          ruleHk: '比「につれて」更正式，常用於客觀數據、季節推移與因果規律',
          ruleJa: '「〜につれて」より硬い表現で、客観的な現象や比例関係によく使われます。',
        },
        clauseB: {
          textJp: '暖房[だんぼう]を強[つよ]くする時間[じかん]が増[ふ]えてきた',
          meaningHk: '調強暖氣嘅時間增加咗（〜てくる表持續累積變化）',
          changeVerbType: '他動詞化「強くする」＋ 自動詞「増えてきた」',
          constraintNoteHk: '結尾用「増えてきた（一直增加到而家）」呈現由過去到現在嘅動態累積！',
          constraintNoteJa: '「〜てきた」を伴うことで、過去から現在へ変化が進行している様子を表します。',
        },
        particleHighlights: [
          {
            particleJp: 'が',
            attachedWordJp: '気温[きおん]が / 時間[じかん]が',
            roleLabelHk: '自動詞主語標記（下がる／増える）',
            explanationHk: '「下がる」「増える」都係自動詞，變化嘅主體必須用「が」而唔係「を」！',
            explanationJa: '自動詞「下がる」「増える」の主語は必ず「が」で示します。',
          },
          {
            particleJp: 'を',
            attachedWordJp: '暖房[だんぼう]を強[つよ]くする',
            roleLabelHk: '他動詞動作對象（人為調校）',
            explanationHk: '因為係人手去較大個暖氣（「強くする」他動詞化），所以暖氣後面用「を」！',
            explanationJa: '「強くする」は人為的な働きかけ（他動詞的表現）なので目的語に「を」を取ります。',
          },
        ],
      },
      {
        patternId: 'ba_hodo',
        patternJp: '③ 〜ば〜ほど（越 A 就越 B・正比例強烈遞增）',
        level: 'N3',
        registerLabelHk: '口語及書面通用・強調比例',
        registerLabelJa: '比例的変化の強調（「〜れば〜ほど」）',
        sentenceJp:
          '冬[ふゆ]が深[ふか]まり寒[さむ]くなればなるほど、暖房[だんぼう]の出力[しゅつりょく]も高[たか]く設定[せってい]されるようになる。',
        cleanSpokenJp:
          '冬が深まり寒くなればなるほど、暖房の出力も高く設定されるようになる。',
        translationHk: '冬天越深、天氣越凍，暖氣嘅輸出功率就會被調校得越高。',
        clauseA: {
          textJp: '寒[さむ]くなればなるほど',
          meaningHk: '越變越凍（同一變化動詞之假定形＋辞書形＋ほど）',
          changeVerbType: '変化動詞假定形「なれば」＋ 原形「なる」＋ ほど',
          dynamicNoteHk: '重複同一個變化動詞（なれば＋なる＋ほど），語氣比「につれて」更強調程度遞增！',
        },
        connectorGrammar: {
          formJp: '〜ば〜ほど',
          ruleHk: '前件用「動詞ば形 ＋ 動詞原形 ＋ ほど」，表示程度成正比飆升',
          ruleJa: '同一語を繰り返すことで、Aの程度が進むにつれてBの程度も比例して高まることを強調します。',
        },
        clauseB: {
          textJp: '暖房[だんぼう]の出力[しゅつりょく]も高[たか]く設定[せってい]されるようになる',
          meaningHk: '暖氣輸出功率亦變得被設定得更高',
          changeVerbType: '受身＋変化句型「〜されるようになる」',
          constraintNoteHk: '「〜ようになる」將原本嘅動作轉化為「新常態／趨勢變化」，完美配合動態句！',
          constraintNoteJa: '「〜ようになる」で習慣や状態の変化を表し、前件の比例変化と響き合います。',
        },
        particleHighlights: [
          {
            particleJp: 'ほど',
            attachedWordJp: 'なればなるほど',
            roleLabelHk: '程度比例副助詞',
            explanationHk: '標示程度嘅極限與比例（「越…就越…」），係 N3 必考副助詞。',
            explanationJa: '程度の比例関係を表す副助詞「ほど」。',
          },
          {
            particleJp: 'も',
            attachedWordJp: '出力[しゅつりょく]も',
            roleLabelHk: '同步聯動係助詞',
            explanationHk: '用「も（也／亦）」取代「が」，突顯後件 B 跟住前件 A 一齊同步攀升嘅語感。',
            explanationJa: '前件の変化に連動して後件も同様に変化することを際立たせる係助詞「も」。',
          },
        ],
      },
      {
        patternId: 'tomoni',
        patternJp: '④ 〜とともに（與 A 同時並進發生 B 變化）',
        level: 'N2',
        registerLabelHk: '正式書面語・宏觀趨勢',
        registerLabelJa: '硬い書き言葉・同時進行変化',
        sentenceJp:
          '寒波[かんぱ]の到来[とうらい]とともに気温[きおん]が急激[きゅうげき]に落[お]ち込[こ]み、暖房器具[だんぼうきぐ]の電力消費[でんりょくしょうひ]も急増[きゅうぞう]している。',
        cleanSpokenJp:
          '寒波の到来とともに気温が急激に落ち込み、暖房器具の電力消費も急増している。',
        translationHk: '伴隨住寒流來襲、氣溫急劇下跌嘅同時，暖氣設備嘅耗電量亦同步急增。',
        clauseA: {
          textJp: '寒波[かんぱ]の到来[とうらい]とともに気温[きおん]が急激[きゅうげき]に落[お]ち込[こ]み',
          meaningHk: '伴隨寒流到來，氣溫急劇下跌',
          changeVerbType: '動作性名詞「到来」＋ とともに ／ 複合動詞「落ち込む」',
          dynamicNoteHk: '「〜とともに」可以直接接「変化／動作性名詞（到来・低下）」，書面感極強。',
        },
        connectorGrammar: {
          formJp: '〜とともに',
          ruleHk: '前接「動詞辞書形／動作性名詞」，表示兩件事喺同一時間軸上並肩推進',
          ruleJa: '変化動詞・動作性名詞＋とともに（Aの進行と同時にBも進行する）。',
        },
        clauseB: {
          textJp: '暖房器具[だんぼうきぐ]の電力消費[でんりょくしょうひ]も急増[きゅうぞう]している',
          meaningHk: '暖氣設備嘅耗電量亦正在急增',
          changeVerbType: '変化サ変動詞「急増する」＋ ている（進行中趨勢）',
          constraintNoteHk: '「急増している」表示目前正在持續發生嘅動態上升趨勢。',
          constraintNoteJa: '変化動詞＋「ている」で、現在進行形で変化が続いている状態を表します。',
        },
        particleHighlights: [
          {
            particleJp: 'と',
            attachedWordJp: '到来[とうらい]とともに',
            roleLabelHk: '共同・伴隨格助詞',
            explanationHk: '「と（與…一齊）」＋「ともに（共同）」，將 A 同 B 綁喺同一條時間線上。',
            explanationJa: '「〜と一緒に／同時に」の語源となる格助詞「と」。',
          },
          {
            particleJp: 'に',
            attachedWordJp: '急激[きゅうげき]に',
            roleLabelHk: 'ナ形容詞副詞化標記',
            explanationHk: '「急激（ナ形容詞）」＋「に」變成副詞，修飾後面的變化動詞「落ち込む」。',
            explanationJa: 'ナ形容詞連用形「〜に」で変化のスピードや様子を修飾します。',
          },
        ],
      },
    ],
  },
  {
    keywords: /(日文|日本語|動漫|アニメ|台詞|聽|学|學)/u,
    clauseALabelHk: '前件 A（起點漸進變化）：日文學習越嚟越深入／詞彙量增加（日本語が上達する／語彙が増える）',
    clauseBLabelHk: '後件 B（同步伴隨變化）：聽得明嘅動漫台詞越嚟越多（聞き取れるセリフが増える）',
    summaryHk:
      '此場景展示「能力累積（前件 A）」與「理解範圍擴大（後件 B）」嘅同步成長。重點在於可能形動詞「聞き取れる（聽得明）」必須配搭助詞「が」，而後件用「増えていく」表現持續擴展嘅動態感。',
    summaryJa:
      '「日本語力の向上（前件A）」に伴って「理解できるアニメのセリフが増える（後件B）」という成長の比例変化です。可能動詞のオブジェクトには「が」を使います。',
    wrongTrap: {
      wrongSentenceJp: '× 日本語[にほんご]が上手[じょうず]になるにつれて、アニメのセリフを聞[き]き取[と]れます。',
      correctSentenceJp: '○ 日本語[にほんご]が上達[じょうたつ]するにつれて、聞[き]き取[と]れるアニメのセリフが増[ふ]えていく。',
      reasonHk:
        '「聞き取れます」只係單純陳述靜態能力（而且可能動詞對象應用「が」而非「を」）；改為「聞き取れるセリフが増えていく（聽得明嘅台詞越嚟越多）」先至符合「兩邊同步動態變化」！',
      reasonJa:
        '単なる状態（「聞き取れる」）で終わるよりも、「聞き取れるセリフが増えていく／多くなる」と変化動詞で結ぶことで自然な比例変化文になります。',
    },
    examples: [
      {
        patternId: 'nitsurete',
        patternJp: '① 〜につれて（伴隨學習深入嘅自然進步）',
        level: 'N3',
        registerLabelHk: '日常學習感言・自然會話',
        registerLabelJa: '日常会話・自然な進歩の描写',
        sentenceJp:
          '日本語[にほんご]の勉強[べんきょう]が進[すす]むにつれて、字幕[じまく]なしで聞[き]き取[と]れるアニメのセリフが増[ふ]えてきた。',
        cleanSpokenJp:
          '日本語の勉強が進むにつれて、字幕なしで聞き取れるアニメのセリフが増えてきた。',
        translationHk: '隨住日文學習越嚟越深入，唔睇字幕都聽得明嘅動漫台詞越嚟越多喇。',
        clauseA: {
          textJp: '日本語[にほんご]の勉強[べんきょう]が進[すす]む',
          meaningHk: '日文學習推進／深入',
          changeVerbType: '自動詞「進む（推進、深入）」',
          dynamicNoteHk: '用自動詞「勉強が進む」比單講「勉強する」更有「進度不斷向前推進」嘅動態畫面！',
        },
        connectorGrammar: {
          formJp: '〜につれて',
          ruleHk: '前接自動詞辞書形「進む」，引出自然伴隨嘅正面成果',
          ruleJa: '動詞辞書形「進む」＋につれて',
        },
        clauseB: {
          textJp: '聞[き]き取[と]れるアニメのセリフが増[ふ]えてきた',
          meaningHk: '聽得明嘅動漫台詞越嚟越多（持續累積到現在）',
          changeVerbType: '可能形連体修飾「聞き取れる」＋ 自動詞「増えてきた」',
          constraintNoteHk: '以自動詞「増えてきた」收尾，突顯數量由少變多嘅動態過程。',
          constraintNoteJa: '「増えてきた」で過去から現在にかけて段階的に増加した実感を表現します。',
        },
        particleHighlights: [
          {
            particleJp: 'が',
            attachedWordJp: '勉強[べんきょう]が進[すす]む / セリフが増[ふ]えてきた',
            roleLabelHk: '自動詞變化主體格助詞',
            explanationHk: '前後兩邊（「進む」同「増える」）都係自動詞，主語統一用「が」標示自然推移。',
            explanationJa: '自動詞「進む」「増える」の主体を表す「が」。',
          },
          {
            particleJp: 'で',
            attachedWordJp: '字幕[じまく]なしで',
            roleLabelHk: '伴隨狀態・方式助詞',
            explanationHk: '「〜なしで（喺冇…嘅狀態下）」，呢度嘅「で」標示進行動作時嘅附帶狀態。',
            explanationJa: '付帯状況・様態を表す格助詞「で」（字幕がない状態で）。',
          },
        ],
      },
      {
        patternId: 'nishitagatte',
        patternJp: '② 〜にしたがって（伴隨詞彙與文法累積嘅階段跨越）',
        level: 'N3',
        registerLabelHk: '較正式・學習心得分享',
        registerLabelJa: 'やや硬い表現・段階的変化',
        sentenceJp:
          '文法[ぶんぽう]や語彙[ごい]の知識[ちしき]が深[ふか]まるにしたがって、登場人物[とうじょうじんぶつ]の微妙[びみょう]なニュアンスも分[わ]かるようになってきた。',
        cleanSpokenJp:
          '文法や語彙の知識が深まるにしたがって、登場人物の微妙なニュアンスも分かるようになってきた。',
        translationHk: '隨住文法同詞彙知識加深，連角色台詞入面嘅微妙語感都慢慢開始聽得明喇。',
        clauseA: {
          textJp: '知識[ちしき]が深[ふか]まる',
          meaningHk: '知識加深（自動詞「深まる」）',
          changeVerbType: '自動詞「深まる」（対応他動詞為「深める」）',
          dynamicNoteHk: '自動詞「深まる」專門用嚟形容理解、關係或季節由淺入深嘅漸變。',
        },
        connectorGrammar: {
          formJp: '〜にしたがって',
          ruleHk: '連接知識深化（A）與理解力提升（B）兩個階段性變化',
          ruleJa: '知識の深化に伴う理解度の段階的向上を示します。',
        },
        clauseB: {
          textJp: '微妙[びみょう]なニュアンスも分[わ]かるようになってきた',
          meaningHk: '連微妙語感都變得能夠理解',
          changeVerbType: '狀態動詞「分かる」＋ 変化句型「〜ようになってきた」',
          constraintNoteHk: '「分かる」本身係靜態能力動詞，加上「〜ようになる」先至變成「由唔明變到明」嘅動態變化！',
          constraintNoteJa: '状態動詞「分かる」に「〜ようになる」を添えて能力獲得の変化に変換しています。',
        },
        particleHighlights: [
          {
            particleJp: 'が',
            attachedWordJp: '知識[ちしき]が深[ふか]まる',
            roleLabelHk: '自動詞主語標記',
            explanationHk: '若果用「知識が深まる（自動詞）」用「が」；若果用「知識を深める（他動詞）」先用「を」！',
            explanationJa: '自動詞「深まる」には「が」、他動詞「深める」には「を」を使います（時雨の町でも頻出の自他対照ポイント）。',
          },
          {
            particleJp: 'も',
            attachedWordJp: 'ニュアンスも分[わ]かる',
            roleLabelHk: '遞進焦點係助詞',
            explanationHk: '原本「〜が分かる」嘅「が」被「も（連…也）」取代，強調進階理解！',
            explanationJa: '「が」の位置に「も」を置き、「それだけでなく〜さえも」と添加・強調します。',
          },
        ],
      },
      {
        patternId: 'ba_hodo',
        patternJp: '③ 〜ば〜ほど（越鑽研語感就越覺得有趣）',
        level: 'N3',
        registerLabelHk: '強調正比例投入感',
        registerLabelJa: '比例変化の強調',
        sentenceJp:
          '日本語[にほんご]のニュアンスを学[まな]べば学[まな]ぶほど、声優[せいゆう]の表現[ひょうげん]の奥深[おくぶか]さが楽[たの]しめるようになる。',
        cleanSpokenJp:
          '日本語のニュアンスを学べば学ぶほど、声優の表現の奥深さが楽しめるようになる。',
        translationHk: '越係深入學習日文嘅語感，就越能夠享受到聲優演繹嘅深奧之處。',
        clauseA: {
          textJp: 'ニュアンスを学[まな]べば学[まな]ぶほど',
          meaningHk: '越學語感（他動詞「学ぶ」假定形＋原形＋ほど）',
          changeVerbType: '他動詞「学ぶ」→ 学べば学ぶほど',
          dynamicNoteHk: '前件用他動詞「を学ぶ」，表達主動投入學習嘅程度不斷加深。',
        },
        connectorGrammar: {
          formJp: '〜ば〜ほど',
          ruleHk: '重複「学べば学ぶほど」強調主動鑽研嘅深度與收穫成正比',
          ruleJa: '動詞のば形＋辞書形＋ほど',
        },
        clauseB: {
          textJp: '表現[ひょうげん]の奥深[おくぶか]さが楽[たの]しめるようになる',
          meaningHk: '變得能夠享受表現嘅深奧之處',
          changeVerbType: '可能形「楽しめる」＋ 変化「ようになる」',
          constraintNoteHk: '用「楽しめるようになる」表達鑑賞能力隨之提升嘅動態轉變。',
          constraintNoteJa: '可能動詞＋「ようになる」で能力・感覚の変化を表します。',
        },
        particleHighlights: [
          {
            particleJp: 'を',
            attachedWordJp: 'ニュアンスを学[まな]ぶ',
            roleLabelHk: '他動詞受事助詞',
            explanationHk: '「学ぶ」係他動詞，學習嘅內容用「を」標示。',
            explanationJa: '他動詞「学ぶ」の目的語を示す「を」。',
          },
          {
            particleJp: 'が',
            attachedWordJp: '奥深[おくぶか]さが楽[たの]しめる',
            roleLabelHk: '可能形對象助詞',
            explanationHk: '「楽しむ（他動詞）」變成可能形「楽しめる（能夠享受）」之後，對象由「を」轉為「が」！',
            explanationJa: '可能形「楽しめる」の対象語は「を」から「が」に変化するのが自然な標準語です。',
          },
        ],
      },
      {
        patternId: 'tomoni',
        patternJp: '④ 〜とともに（聽力與口語語感同步躍升）',
        level: 'N2',
        registerLabelHk: '書面總結・學習報告',
        registerLabelJa: '書き言葉・同時成長',
        sentenceJp:
          '聴解力[ちょうかいりょく]が向上[こうじょう]するとともに、日常会話[にちじょうかいわ]での自然[しぜん]な相槌[あいづち]や表現[ひょうげん]も身[み]についてきた。',
        cleanSpokenJp:
          '聴解力が向上するとともに、日常会話での自然な相槌や表現も身についてきた。',
        translationHk: '喺聽解能力提升嘅同時，日常會話入面自然嘅附和（相槌）同表達亦一併掌握到喇。',
        clauseA: {
          textJp: '聴解力[ちょうかいりょく]が向上[こうじょう]する',
          meaningHk: '聽解能力提升',
          changeVerbType: '変化サ変動詞「向上する」',
          dynamicNoteHk: '「向上する」自帶向上發展嘅動態方向感。',
        },
        connectorGrammar: {
          formJp: '〜とともに',
          ruleHk: '表示聽力（A）同口語表達（B）相輔相成、同步成長',
          ruleJa: 'Aの成長と並行してBも同時に身につくことを表します。',
        },
        clauseB: {
          textJp: '自然[しぜん]な相槌[あいづち]や表現[ひょうげん]も身[み]についてきた',
          meaningHk: '自然嘅附和與表達亦掌握喺身上',
          changeVerbType: '慣用変化表現「身につく（掌握／內化）」＋ てきた',
          constraintNoteHk: '「身につく」表示技術或知識由外在變成自己身體一部分嘅動態過程。',
          constraintNoteJa: '知識や習慣が自分のものとして定着していく変化を表す「身につく」。',
        },
        particleHighlights: [
          {
            particleJp: 'で',
            attachedWordJp: '日常会話[にちじょうかいわ]での',
            roleLabelHk: '場所・範圍格助詞＋の',
            explanationHk: '「で（喺某個場合）」＋「の（連体修飾）」用嚟修飾後面嘅名詞「相槌や表現」。',
            explanationJa: '場面を表す「で」に「の」を重ねて後ろの名詞を修飾する形です。',
          },
          {
            particleJp: 'に',
            attachedWordJp: '身[み]についてきた',
            roleLabelHk: '歸著點格助詞',
            explanationHk: '知識附著喺「身（自己身上）」，所以歸著點用「に」！',
            explanationJa: '定着する帰着点を示す格助詞「に」（身に付く）。',
          },
        ],
      },
    ],
  },
];

/**
 * Pure, deterministic local analyzer that parses ANY user-input dynamic change scenario
 * (e.g., "隨著天氣轉冷，暖氣開得越強" or custom two-clause inputs) and builds 4 richly annotated
 * Japanese sentences highlighting dynamic grammar structures and particle usage.
 */
export function analyzeDynamicChangeSceneLocal(
  sceneInput: string,
  _level: JlptLevel = 'N3'
): DynamicSceneAnalysisResult {
  const cleanScene = String(sceneInput || '').trim() || '隨著天氣轉冷，暖氣開得越強';

  // 1. Check if input matches one of our specialized rich templates
  for (const tpl of SCENE_TEMPLATES) {
    if (tpl.keywords.test(cleanScene)) {
      return {
        sceneInput: cleanScene,
        sceneSummaryHk: tpl.summaryHk,
        sceneSummaryJa: tpl.summaryJa,
        clauseALabelHk: tpl.clauseALabelHk,
        clauseBLabelHk: tpl.clauseBLabelHk,
        coreRuleBannerHk:
          '【兩邊同步變化・三大語感鐵則】① 前件 A 必須係「漸進變化動詞／形容詞＋なる／変化名詞」；② 後件 B 亦必須係「同步發生嘅動態變化」，嚴禁以靜態狀態或主觀意志（〜たい・〜つもり・〜てください）結尾；③ 自發狀態變化主語用「が」（〜が寒くなる／増える），人為介入調校對象用「を」（〜を強くする／上げる）。',
        coreRuleBannerJa:
          '【両側同時変化の3大鉄則】① 前件Aには変化動詞（増える・下がる・〜くなる）や変化名詞を置く。② 後件Bも必ず動的な変化表現で結び、状態表現や意向・依頼（〜たい・〜よう・〜てください）は使えない。③ 自然な推移の主体には「が」、意図的な調整の対象には「を」を使い分ける。',
        wrongUsageTrap: tpl.wrongTrap,
        generatedExamples: tpl.examples,
        generatedBy: 'local-engine',
      };
    }
  }

  // 2. Parse arbitrary custom scene (e.g., "隨著X，Y") into Clause A and Clause B
  const parts = cleanScene
    .replace(/^(隨著|隨住|隨|當|伴隨住|伴隨著)/u, '')
    .split(/[，,、；;→➔]+/u)
    .map((s) => s.trim())
    .filter(Boolean);

  const rawA = parts[0] || cleanScene;
  const rawB = parts[1] || '相關情況亦同步發生明顯變化';

  return {
    sceneInput: cleanScene,
    sceneSummaryHk: `針對你輸入嘅動態場景「前件 A：${rawA} ➔ 後件 B：${rawB}」，以下為你拆解 4 種 JLPT 核心「兩邊同步變化」句型（〜につれて・〜にしたがって・〜ば〜ほど・〜とともに）以及自他動詞助詞「が／を／に／で」嘅精準搭配。`,
    sceneSummaryJa: `入力された動態変化シーン「前件A：${rawA} ➔ 後件B：${rawB}」に基づき、JLPT頻出の4大比例・伴随変化文型と格助詞（が・を・に・で）の使い分けを解説します。`,
    clauseALabelHk: `前件 A（起點漸進變化）：${rawA}`,
    clauseBLabelHk: `後件 B（同步伴隨變化）：${rawB}`,
    coreRuleBannerHk:
      '【兩邊同步變化・三大語感鐵則】① 前件 A 必須係「漸進變化動詞／形容詞＋なる／変化名詞」；② 後件 B 亦必須係「同步發生嘅動態變化」，嚴禁以靜態狀態或主觀意志（〜たい・〜つもり・〜てください）結尾；③ 自發狀態變化主語用「が」，人為介入調校對象用「を」。',
    coreRuleBannerJa:
      '【両側同時変化の3大鉄則】① 前件Aには変化動詞や変化名詞を置く。② 後件Bも必ず動的な変化表現で結び、状態表現や意向形は使えない。③ 自動詞の変化主体には「が」、他動詞の対象には「を」を使う。',
    wrongUsageTrap: {
      wrongSentenceJp: '× 状況[じょうきょう]が変[か]わるにつれて、すぐ対策[たいさく]をしたいです。',
      correctSentenceJp: '○ 状況[じょうきょう]が変[か]わるにつれて、対策[たいさく]の重要度[じゅうようど]も高[たか]まっていく。',
      reasonHk: `描述「${rawA} ➔ ${rawB}」時，後件 B 唔可以用主觀意向「〜したいです」，必須改用「高まっていく／増えてくる／変化していく」等客觀動態趨勢！`,
      reasonJa:
        '「〜につれて」の後件に話者の希望「〜たい」は使えません。「高まっていく」「増えてくる」などの変化表現にします。',
    },
    generatedExamples: [
      {
        patternId: 'nitsurete',
        patternJp: '① 〜につれて（自然單向伴隨漸進變化）',
        level: 'N3',
        registerLabelHk: '日常會話・自然趨勢描寫',
        registerLabelJa: '日常会話・自然な推移',
        sentenceJp:
          '周囲[しゅうい]の環境[かんきょう]が変化[へんか]するにつれて、私[わたし]たちの生活習慣[せいかつしゅうかん]もだんだん変[か]わっていく。',
        cleanSpokenJp:
          '周囲の環境が変化するにつれて、私たちの生活習慣もだんだん変わっていく。',
        translationHk: `隨住周圍環境發生變化（${rawA}），我哋嘅生活習慣亦漸漸跟住改變（${rawB}）。`,
        clauseA: {
          textJp: '周囲[しゅうい]の環境[かんきょう]が変化[へんか]する',
          meaningHk: `周圍環境發生變化（對應：${rawA}）`,
          changeVerbType: '変化サ変動詞辞書形「変化する」',
          dynamicNoteHk: '前件用「が変化する」標示起點條件正在逐步改變。',
        },
        connectorGrammar: {
          formJp: '〜につれて',
          ruleHk: '前接「変化動詞辞書形」或「変化性名詞」',
          ruleJa: '変化動詞の辞書形・変化名詞＋につれて',
        },
        clauseB: {
          textJp: '生活習慣[せいかつしゅうかん]もだんだん変[か]わっていく',
          meaningHk: `生活習慣亦漸漸改變（對應：${rawB}）`,
          changeVerbType: '副詞「だんだん」＋ 自動詞「変わっていく」',
          constraintNoteHk: '「変わっていく（由今往後持續改變）」完美呈現同步推進嘅動態感。',
          constraintNoteJa: '「〜ていく」で今後の継続的な変化の流れを表します。',
        },
        particleHighlights: [
          {
            particleJp: 'が',
            attachedWordJp: '環境[かんきょう]が変化[へんか]する',
            roleLabelHk: '自動詞變化主語助詞',
            explanationHk: '標示自發產生變化嘅主體「環境」。',
            explanationJa: '変化の主体を示す格助詞「が」。',
          },
          {
            particleJp: 'も',
            attachedWordJp: '生活習慣[せいかつしゅうかん]も',
            roleLabelHk: '同步伴隨係助詞',
            explanationHk: '用「も（亦／也）」強調後件 B 緊貼前件 A 同步改變。',
            explanationJa: '連動して変化する事柄を並べる係助詞「も」。',
          },
        ],
      },
      {
        patternId: 'nishitagatte',
        patternJp: '② 〜にしたがって（客觀規律與階段遞進變化）',
        level: 'N3',
        registerLabelHk: '書面語・客觀分析',
        registerLabelJa: '書き言葉・客観的記述',
        sentenceJp:
          '時間[じかん]が経[た]ち事態[じたい]が進展[しんてん]するにしたがって、求[もと]められる対応[たいおう]のレベルも高[たか]くなってきた。',
        cleanSpokenJp:
          '時間が経ち事態が進展するにしたがって、求められる対応のレベルも高くなってきた。',
        translationHk: `隨住時間推移與事態發展（${rawA}），所要求嘅應對水平亦變得越嚟越高（${rawB}）。`,
        clauseA: {
          textJp: '事態[じたい]が進展[しんてん]する',
          meaningHk: '事態進展／推進',
          changeVerbType: '変化サ変動詞「進展する」',
          dynamicNoteHk: '書面語常用「進展する／進む／推移する」作為前件 A。',
        },
        connectorGrammar: {
          formJp: '〜にしたがって',
          ruleHk: '適合書面語及客觀因果規律嘅伴隨變化',
          ruleJa: '客観的な推移や段階的な変化を表す「〜にしたがって」。',
        },
        clauseB: {
          textJp: '対応[たいおう]のレベルも高[たか]くなってきた',
          meaningHk: '應對水平亦變得越嚟越高',
          changeVerbType: 'い形容詞く形「高く」＋ なってきた',
          constraintNoteHk: '「高くなってきた」表示由過去到而家一直持續攀升。',
          constraintNoteJa: '「〜てきた」で現在までの変化の蓄積を表します。',
        },
        particleHighlights: [
          {
            particleJp: 'が',
            attachedWordJp: '時間[じかん]が経[た]ち / 事態[じたい]が',
            roleLabelHk: '時間・事態推移主語',
            explanationHk: '自動詞「経つ」「進展する」嘅主語必須用「が」。',
            explanationJa: '自動詞の主語を示す「が」。',
          },
          {
            particleJp: 'の',
            attachedWordJp: '対応[たいおう]のレベル',
            roleLabelHk: '屬性限定連体助詞',
            explanationHk: '明確標示邊個方面嘅程度（「対応のレベル」）發生咗變化。',
            explanationJa: '変化する側面（レベル・頻度・量）を特定する「の」。',
          },
        ],
      },
      {
        patternId: 'ba_hodo',
        patternJp: '③ 〜ば〜ほど（越 A 就越 B・正比例強化）',
        level: 'N3',
        registerLabelHk: '強調程度正比例遞增',
        registerLabelJa: '比例関係の強調',
        sentenceJp:
          '条件[じょうけん]が厳[きび]しくなればなるほど、事前[じぜん]の準備[じゅんび]をしっかり行[おこな]う必要[ひつよう]が増[ま]していく。',
        cleanSpokenJp:
          '条件が厳しくなればなるほど、事前の準備をしっかり行う必要が増していく。',
        translationHk: `條件變得越嚴格（${rawA}），做好事前準備嘅必要性就越係增加（${rawB}）。`,
        clauseA: {
          textJp: '条件[じょうけん]が厳[きび]しくなればなるほど',
          meaningHk: '條件越變越嚴格',
          changeVerbType: 'い形容詞変化「厳しくなればなるほど」',
          dynamicNoteHk: '重複「なれば＋なる＋ほど」突顯程度每加深一分，後果就同步加深一分。',
        },
        connectorGrammar: {
          formJp: '〜ば〜ほど',
          ruleHk: '前接「假定形＋原形＋ほど」，強調 A 與 B 嘅正比例幅度',
          ruleJa: '仮定形＋辞書形＋ほど（比例的変化の強調）。',
        },
        clauseB: {
          textJp: '準備[じゅんび]をしっかり行[おこな]う必要[ひつよう]が増[ま]していく',
          meaningHk: '做好準備嘅必要性不斷增加',
          changeVerbType: '自動詞「増す（增加、增強）」＋ ていく',
          constraintNoteHk: '用「必要が増していく」將「需要做某事」轉化為客觀遞增嘅動態量！',
          constraintNoteJa: '「必要が増す」と表現することで、動的な比例変化の文として成立させています。',
        },
        particleHighlights: [
          {
            particleJp: 'を',
            attachedWordJp: '準備[じゅんび]をしっかり行[おこな]う',
            roleLabelHk: '他動詞受事助詞',
            explanationHk: '「行う（進行、執行）」係他動詞，動作對象「準備」用「を」。',
            explanationJa: '他動詞「行う」の目的語を示す「を」。',
          },
          {
            particleJp: 'が',
            attachedWordJp: '必要[ひつよう]が増[ま]していく',
            roleLabelHk: '自動詞主語助詞',
            explanationHk: '「増す」係自動詞（程度增加），主語「必要」用「が」。',
            explanationJa: '自動詞「増す」の主体を示す「が」。',
          },
        ],
      },
      {
        patternId: 'tomoni',
        patternJp: '④ 〜とともに（A 與 B 同時並進變化）',
        level: 'N2',
        registerLabelHk: '正式書面・宏觀報告',
        registerLabelJa: '硬い書き言葉・同時進行',
        sentenceJp:
          '社会[しゃかい]のデジタル化[か]が進[すす]むとともに、日常[にちじょう]の暮[く]らしもより便利[べんり]で快適[かいてき]なものへと変[か]わりつつある。',
        cleanSpokenJp:
          '社会のデジタル化が進むとともに、日常の暮らしもより便利で快適なものへと変わりつつある。',
        translationHk: `伴隨住社會數碼化推進（${rawA}），日常生活亦正同步向更方便舒適嘅方向轉變（${rawB}）。`,
        clauseA: {
          textJp: '社会[しゃかい]のデジタル化[か]が進[すす]む',
          meaningHk: '社會數碼化推進',
          changeVerbType: '接尾辞「〜化」＋ 自動詞「進む」',
          dynamicNoteHk: '「〜化が進む」係 N2/N1 讀解同新聞最常出現嘅動態變化搭配。',
        },
        connectorGrammar: {
          formJp: '〜とともに',
          ruleHk: '表示宏觀趨勢 A 與生活變化 B 同步推進',
          ruleJa: 'Aの進行と並行してBも変化する様子を表します。',
        },
        clauseB: {
          textJp: '快適[かいてき]なものへと変[か]わりつつある',
          meaningHk: '正在向舒適嘅形態轉變（〜つつある表正在持續變化）',
          changeVerbType: '動詞ます形去ます ＋ つつある（N2 書面進行式）',
          constraintNoteHk: '「変わりつつある」係「変わっている」嘅高階書面語，專門描述正在進行中嘅單向變化！',
          constraintNoteJa: '「〜つつある」は変化が現在進行中であることを表す書き言葉（N2文型）です。',
        },
        particleHighlights: [
          {
            particleJp: 'へと',
            attachedWordJp: '快適[かいてき]なものへと変[か]わり',
            roleLabelHk: '變化方向＋結果複合助詞',
            explanationHk: '「へ（方向）」＋「と（變化結果）」，比單用「に」更具備向新方向推進嘅畫面感！',
            explanationJa: '方向を示す「へ」と変化の結果を示す「と」が結びついた複合助詞「へと」。',
          },
        ],
      },
    ],
    generatedBy: 'local-engine',
  };
}

// ============================================================================
// 13. Sigure.tw (時雨の町) Inspired Japanese Nuance, Transitivity & False-Friends Atlas
// ============================================================================

export interface TransitivityPairItem {
  id: string;
  ruleGroupTitleHk: string;
  ruleGroupTitleJa: string;
  intransitiveJp: string; // 自動詞 (〜が)
  intransitiveReading: string;
  transitiveJp: string; // 他動詞 (〜を)
  transitiveReading: string;
  meaningHk: string;
  intransitiveExampleJp: string;
  intransitiveExampleHk: string;
  transitiveExampleJp: string;
  transitiveExampleHk: string;
  sigureTipHk: string;
}

export const TRANSITIVITY_PAIR_CATALOG: TransitivityPairItem[] = [
  {
    id: 'pair-1',
    ruleGroupTitleHk: '法則 ①：-aru（自動詞・が） vs -eru（他動詞・を）',
    ruleGroupTitleJa: '法則①：-aru（自動詞）⇄ -eru（他動詞）',
    intransitiveJp: '下がる',
    intransitiveReading: 'さがる',
    transitiveJp: '下げる',
    transitiveReading: 'さげる',
    meaningHk: '下降、降低（溫度／價格／音量）',
    intransitiveExampleJp: '夜[よる]になって、気温[きおん]が下[さ]がった。',
    intransitiveExampleHk: '到咗夜晚，氣溫（自己）跌咗。（自動詞用「が」）',
    transitiveExampleJp: 'エアコンの設定温度[せっていおんど]を下[さ]げた。',
    transitiveExampleHk: '（人手）調低咗冷氣設定溫度。（他動詞用「を」）',
    sigureTipHk: '時雨記憶法：「a 段音（-aru）」似「あ！自然發生咗（自動詞）」；「e 段音（-eru）」似「えい！出手去搞佢（他動詞）」！',
  },
  {
    id: 'pair-2',
    ruleGroupTitleHk: '法則 ①：-aru（自動詞・が） vs -eru（他動詞・を）',
    ruleGroupTitleJa: '法則①：-aru（自動詞）⇄ -eru（他動詞）',
    intransitiveJp: '閉まる',
    intransitiveReading: 'しまる',
    transitiveJp: '閉める',
    transitiveReading: 'しめる',
    meaningHk: '關上、關閉（門／窗／店舖）',
    intransitiveExampleJp: '電車のドアが閉[し]まります。ご注意[ちゅうい]ください。',
    intransitiveExampleHk: '電車門（自動）關上，請小心。（眼中只睇到道門自己閂埋）',
    transitiveExampleJp: '寒[さむ]いから、窓[まど]を閉[し]めてください。',
    transitiveExampleHk: '因為好凍，請（你動手）閂埋隻窗。',
    sigureTipHk: '電梯同JR廣播永遠講「ドアが閉まります」，因為廣播聚焦喺「道門本身嘅狀態變化」而唔係車長撳掣！',
  },
  {
    id: 'pair-3',
    ruleGroupTitleHk: '法則 ②：-ru（自動詞・が） vs -su（他動詞・を）',
    ruleGroupTitleJa: '法則②：-ru（自動詞）⇄ -su（他動詞・使役感）',
    intransitiveJp: '直る',
    intransitiveReading: 'なおる',
    transitiveJp: '直す',
    transitiveReading: 'なおす',
    meaningHk: '修好、改正、復原',
    intransitiveExampleJp: 'パソコンの故障[こしょう]がやっと直[なお]った。',
    intransitiveExampleHk: '電腦嘅故障終於好返喇。（狀態復原用「が」）',
    transitiveExampleJp: '企画書[きかくしょ]のデータの間違[まちが]いを直[なお]す。',
    transitiveExampleHk: '修正企劃書入面嘅數據錯誤。（人手修改用「を」）',
    sigureTipHk: '凡係語尾係「-su（す）」幾乎 95% 都係他動詞（直す、壊す、出す、残す、消す），因為「す」本身就帶有「する（人為去做）」嘅基因！',
  },
  {
    id: 'pair-4',
    ruleGroupTitleHk: '法則 ③：-eru（自動詞・が） vs -asu（他動詞・を）',
    ruleGroupTitleJa: '法則③：-eru（自動詞）⇄ -asu（他動詞）',
    intransitiveJp: '冷える',
    intransitiveReading: 'ひえる',
    transitiveJp: '冷やす',
    transitiveReading: 'ひやす',
    meaningHk: '變凍、冰鎮、冷卻',
    intransitiveExampleJp: '朝晩[あさばん]はずいぶん空気[くうき]が冷[ひ]えてきた。',
    intransitiveExampleHk: '朝早同夜晚空氣變得相當清涼寒冷。',
    transitiveExampleJp: 'スイカを冷蔵庫[れいぞうこ]に入[い]れて冷[ひ]やす。',
    transitiveExampleHk: '將西瓜放落雪櫃雪凍佢。',
    sigureTipHk: '「冷える（自然變凍）」vs「冷やす（雪凍佢）」；同類仲有「出る vs 出す」、「溶ける vs 溶かす」、「乾く vs 乾かす」。',
  },
  {
    id: 'pair-5',
    ruleGroupTitleHk: '法則 ④：-reru（自動詞・が） vs -su（他動詞・を）',
    ruleGroupTitleJa: '法則④：-reru（受身・自発的自動詞）⇄ -su（他動詞）',
    intransitiveJp: '壊れる',
    intransitiveReading: 'こわれる',
    transitiveJp: '壊す',
    transitiveReading: 'こわす',
    meaningHk: '壞掉、損壞 vs 整壞、破壞',
    intransitiveExampleJp: '強風[きょうふう]で傘[かさ]が壊[こわ]れてしまった。',
    intransitiveExampleHk: '因為大風，把遮爛咗。（自然損壞用「が」）',
    transitiveExampleJp: '弟[おとうと]がおもちゃを壊[こわ]してしまった。',
    transitiveExampleHk: '細佬整爛咗件玩具。（人為破壞用「を」）',
    sigureTipHk: '語尾「-reru（れる）」同受身形同源，表示「受到外力而變成某個狀態（壊れる・汚れる・倒れる）」，所以一定係自動詞！',
  },
];

export interface KanjiFalseFriendItem {
  id: string;
  kanji: string;
  reading: string;
  pitchAccent: string;
  actualMeaningHk: string;
  actualMeaningJa: string;
  chineseTrapMeaningHk: string;
  howToSayTrapInJp: string;
  exampleJp: string;
  exampleHk: string;
}

export const KANJI_FALSE_FRIENDS_CATALOG: KanjiFalseFriendItem[] = [
  {
    id: 'ff-1',
    kanji: '手紙',
    reading: 'てがみ',
    pitchAccent: '[0] 平板型',
    actualMeaningHk: '信件、書信（Letter）',
    actualMeaningJa: '相手に思いを伝えて送る文書（レター）',
    chineseTrapMeaningHk: '× 唔係中文嘅「廁紙／衛生紙」！',
    howToSayTrapInJp: '廁紙嘅日文係「トイレットペーパー」或「ちり紙[がみ]」',
    exampleJp: '母[はは]に感謝[かんしゃ]の手紙[てがみ]を書[か]いた。',
    exampleHk: '寫咗一封感謝信俾阿媽。',
  },
  {
    id: 'ff-2',
    kanji: '勉強',
    reading: 'べんきょう',
    pitchAccent: '[0] 平板型',
    actualMeaningHk: '1. 讀書、學習；2. 舖頭減價算平啲（勉強する）',
    actualMeaningJa: '学問や技術を学ぶこと／商人が値引きして安く売ること',
    chineseTrapMeaningHk: '× 唔係中文嘅「強迫／勉強做某事」！',
    howToSayTrapInJp: '中文「勉強自己做」日文要講「無理[むり]をする」或「しぶしぶ〜する」',
    exampleJp: '毎日[まいにち]コツコツ日本語[にほんご]を勉強[べんきょう]している。',
    exampleHk: '每日腳踏實地噉讀緊日文。',
  },
  {
    id: 'ff-3',
    kanji: '邪魔',
    reading: 'じゃま',
    pitchAccent: '[0] 平板型',
    actualMeaningHk: '打擾、阻礙、阻住晒（「お邪魔します」＝打擾晒！）',
    actualMeaningJa: '人の行動のさまたげになること／訪問時の挨拶',
    chineseTrapMeaningHk: '× 唔係中文嘅「妖魔鬼怪／邪門」！',
    howToSayTrapInJp: '去人哋屋企作客入門口必講「お邪魔[じゃま]します（打擾晒）」',
    exampleJp: 'お仕事中[しごとちゅう]、お邪魔[じゃま]してすみません。',
    exampleHk: '喺你做緊嘢嗰陣打擾你，真係唔好意思。',
  },
  {
    id: 'ff-4',
    kanji: '娘',
    reading: 'むすめ',
    pitchAccent: '[3] 尾高型',
    actualMeaningHk: '女（自己個女 Daughter）／年輕女仔',
    actualMeaningJa: '自分の女の子ども／若い未婚の女性',
    chineseTrapMeaningHk: '× 唔係中文嘅「阿娘／母親」！',
    howToSayTrapInJp: '母親嘅日文係「母[はは]」或「お母[かあ]さん」',
    exampleJp: '来月[らいげつ]、娘[むすめ]が大学[だいがく]に入学[にゅうがく]します。',
    exampleHk: '下個月，我個女就會入讀大學。',
  },
  {
    id: 'ff-5',
    kanji: '湯',
    reading: 'ゆ／おゆ',
    pitchAccent: '[0] 平板型',
    actualMeaningHk: '熱水、白開水／溫泉澡堂（銭湯）',
    actualMeaningJa: '水を沸かして熱くしたもの／お風呂・温泉',
    chineseTrapMeaningHk: '× 唔係中文飲嗰啲「老火湯／味增湯」！',
    howToSayTrapInJp: '飲嘅湯喺日文要講「スープ（西式湯）」或「味噌汁[みそしる]」',
    exampleJp: 'カップラーメンに熱[あつ]いお湯[ゆ]を注[そそ]ぐ。',
    exampleHk: '將滾水倒入杯麵入面。',
  },
  {
    id: 'ff-6',
    kanji: '床',
    reading: 'ゆか',
    pitchAccent: '[0] 平板型',
    actualMeaningHk: '地板（Floor）',
    actualMeaningJa: '部屋の底面（フロア）',
    chineseTrapMeaningHk: '× 讀「ゆか」時係「地板」，唔係瞓覺張「ベッド（床）」！',
    howToSayTrapInJp: '西式睡床係「ベッド」，日式榻榻米被鋪係「布団[ふとん]」',
    exampleJp: 'うっかりコップを落[お]として、床[ゆか]が濡[ぬ]れてしまった。',
    exampleHk: '唔小心跌咗隻杯，搞到個地板濕晒。',
  },
];

// ============================================================================
// Mistake Knowledge Base (錯題知識庫) & Weekly Mistake Report (錯題周報) Engine
// ============================================================================

export interface MistakeKnowledgeTagPreset {
  tag: string;
  labelZh: string;
  labelJa: string;
  descriptionHk: string;
}

export const DEFAULT_MISTAKE_KNOWLEDGE_TAGS: MistakeKnowledgeTagPreset[] = [
  {
    tag: '助詞疑難',
    labelZh: '助詞疑難',
    labelJa: '助詞・格助詞の疑問',
    descriptionHk: 'が・を・に・で・へ・と 等格助詞與副助詞誤判',
  },
  {
    tag: '漢字盲點',
    labelZh: '漢字盲點',
    labelJa: '漢字・同形異義の盲点',
    descriptionHk: '中日同形異義詞、音讀訓讀混淆或促音長音拼寫盲點',
  },
  {
    tag: '自動詞vs他動詞',
    labelZh: '自動詞vs他動詞',
    labelJa: '自動詞・他動詞ペア',
    descriptionHk: '開く／開ける、決まる／決める 及 〜ています／〜てあります 狀態辨析',
  },
  {
    tag: '接續與句尾呼應',
    labelZh: '接續與句尾呼應',
    labelJa: '接続・文末呼応',
    descriptionHk: '〜そうです／らしい、〜わりに／おかげで、副詞與句尾時態呼應',
  },
  {
    tag: '敬語與受授',
    labelZh: '敬語與受授',
    labelJa: '敬語・授受表現',
    descriptionHk: '尊敬語・謙讓語及 あげる／くれる／もらう 恩惠方向',
  },
  {
    tag: '聽解轉折陷阱',
    labelZh: '聽解轉折陷阱',
    labelJa: '聴解・逆接トラップ',
    descriptionHk: '聽解中「でも・実は・ところが」後句推翻前句嘅考場陷阱',
  },
];

/**
 * Pure helper that automatically infers 1-2 relevant knowledge base tags from a mistake record.
 */
export function inferDefaultMistakeTags(mistake: MistakeRecord): string[] {
  if (Array.isArray(mistake.customTags) && mistake.customTags.length > 0) {
    return Array.from(new Set(mistake.customTags.map((t) => t.trim()).filter(Boolean)));
  }

  const combined = `${mistake.questionPrompt} ${mistake.explanation} ${mistake.correctAnswer} ${mistake.userChosenOption}`;
  const inferred: string[] = [];

  if (/(自動詞|他動詞|開いて|開けて|閉まって|閉めて|消えて|消して|ついて|つけて|てあります)/.test(combined)) {
    inferred.push('自動詞vs他動詞');
  }
  if (/(助詞|「が」|「を」|「に」|「で」|間に合|に似て|に気がつ)/.test(combined)) {
    inferred.push('助詞疑難');
  }
  if (
    mistake.category === 'vocab' ||
    /(漢字|讀音|表記|振假名|セット|時計|同形|意味が最も近い)/.test(combined)
  ) {
    inferred.push('漢字盲點');
  }
  if (/(尊敬|謙譲|敬語|いただ|くださ|申し|おっしゃ|なさ|あげ|くれ|もら)/.test(combined)) {
    inferred.push('敬語與受授');
  }
  if (mistake.category === 'listening' || /(聴解|聽解|質問：|男：|女：)/.test(combined)) {
    inferred.push('聽解轉折陷阱');
  }
  if (
    inferred.length === 0 ||
    /(そう|らしい|わりに|おかげで|せいで|につれて|にしたがって|ように|ことに)/.test(combined)
  ) {
    inferred.push('接續與句尾呼應');
  }

  return Array.from(new Set(inferred)).slice(0, 3);
}

/**
 * Pure helper that infers a human-readable grammar/lexical focus point title from a mistake record.
 */
export function inferGrammarFocusPoint(mistake: MistakeRecord): string {
  if (mistake.grammarFocusPoint && mistake.grammarFocusPoint.trim()) {
    return mistake.grammarFocusPoint.trim();
  }
  const combined = `${mistake.questionPrompt} ${mistake.explanation} ${mistake.correctAnswer} ${mistake.userChosenOption}`;

  if (/(自動詞|他動詞|開いて|開けて)/.test(combined)) {
    return '自動詞＋ています vs 他動詞＋てあります（狀態與助詞が／を）';
  }
  if (/(そう|らしい|よう)/.test(combined) && /(雨|降)/.test(combined)) {
    return '樣態助動詞「〜そうです（視覺跡象）」vs 傳聞「〜らしい」';
  }
  if (/(わりに|おかげで|せいで)/.test(combined)) {
    return '比例逆接「〜わりに（は）」vs 原因「〜おかげで／せいで」';
  }
  if (/(間に合|遅れ)/.test(combined)) {
    return '自動詞「〜に間に合う（趕得切）」目標助詞「に」搭配';
  }
  if (/(につれて|にしたがって|とともに)/.test(combined)) {
    return '動態同步變化「〜につれて／〜にしたがって」雙邊漸進規則';
  }
  if (/(ことにする|ことになる|ようにする|ようになる)/.test(combined)) {
    return '主觀決定「〜ことにする」vs 客觀決定／習慣變化「〜ことになる／ようになる」';
  }
  if (/(ておく|てある|てしまう)/.test(combined)) {
    return '補助動詞「〜ておく（事前準備）」vs「〜てある（結果狀態）」';
  }
  if (/(敬語|いただ|くださ|お〜になる)/.test(combined)) {
    return '尊敬語與謙讓語主體方向辨析（お〜になる vs お〜する）';
  }

  return `「${mistake.correctAnswer}」vs「${mistake.userChosenOption}」（${mistake.level} ${
    mistake.category === 'grammar'
      ? '核心文法辨析'
      : mistake.category === 'vocab'
        ? '漢字語彙搭配'
        : mistake.category === 'listening'
          ? '聽解語境焦點'
          : '讀解文脈邏輯'
  }）`;
}

/**
 * Toggles a custom tag on a MistakeRecord (adds if absent, removes if present).
 */
export function toggleMistakeCustomTag(
  mistake: MistakeRecord,
  tagToToggle: string
): MistakeRecord {
  const cleanTag = tagToToggle.trim().replace(/^#/, '');
  if (!cleanTag) return mistake;

  const currentTags = inferDefaultMistakeTags(mistake);
  const exists = currentTags.includes(cleanTag);
  const nextTags = exists
    ? currentTags.filter((t) => t !== cleanTag)
    : [...currentTags, cleanTag];

  return {
    ...mistake,
    customTags: nextTags,
  };
}

/**
 * Adds a new custom tag to a MistakeRecord without duplicates.
 */
export function addCustomTagToMistake(
  mistake: MistakeRecord,
  rawTag: string
): MistakeRecord {
  const cleanTag = rawTag.trim().replace(/^#/, '');
  if (!cleanTag) return mistake;
  const currentTags = inferDefaultMistakeTags(mistake);
  if (currentTags.includes(cleanTag)) {
    return { ...mistake, customTags: currentTags };
  }
  return {
    ...mistake,
    customTags: [...currentTags, cleanTag],
  };
}

export interface MistakeTagSummaryItem {
  tag: string;
  count: number;
  totalMistakeHits: number;
  sharePercent: number;
}

/**
 * Aggregates all preset and user-created custom tags across the mistake knowledge base.
 */
export function summarizeKnowledgeBaseTags(
  mistakes: MistakeRecord[],
  extraUserTags: string[] = []
): MistakeTagSummaryItem[] {
  const map = new Map<string, { count: number; totalMistakeHits: number }>();

  // Initialize preset tags and extra user tags with 0
  for (const preset of DEFAULT_MISTAKE_KNOWLEDGE_TAGS) {
    map.set(preset.tag, { count: 0, totalMistakeHits: 0 });
  }
  for (const extra of extraUserTags) {
    const clean = extra.trim().replace(/^#/, '');
    if (clean && !map.has(clean)) {
      map.set(clean, { count: 0, totalMistakeHits: 0 });
    }
  }

  for (const m of mistakes) {
    const tags = inferDefaultMistakeTags(m);
    const hits = Math.max(1, m.mistakeCount || 1);
    for (const t of tags) {
      const prev = map.get(t) || { count: 0, totalMistakeHits: 0 };
      map.set(t, {
        count: prev.count + 1,
        totalMistakeHits: prev.totalMistakeHits + hits,
      });
    }
  }

  const totalCards = Math.max(1, mistakes.length);
  return Array.from(map.entries())
    .map(([tag, stats]) => ({
      tag,
      count: stats.count,
      totalMistakeHits: stats.totalMistakeHits,
      sharePercent: mistakes.length === 0 ? 0 : Math.round((stats.count / totalCards) * 100),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.totalMistakeHits - a.totalMistakeHits;
    });
}

/**
 * Filters mistakes in the Mistake Knowledge Base by selected tag ('ALL' or specific tag) and optional search query.
 */
export function filterMistakesByKnowledgeTag(
  mistakes: MistakeRecord[],
  selectedTag: string = 'ALL',
  searchQuery: string = ''
): MistakeRecord[] {
  const cleanTag = (selectedTag || 'ALL').trim();
  const q = (searchQuery || '').trim().toLowerCase();

  return mistakes.filter((m) => {
    const tags = inferDefaultMistakeTags(m);
    if (cleanTag !== 'ALL' && !tags.includes(cleanTag)) {
      return false;
    }
    if (!q) return true;
    const focus = inferGrammarFocusPoint(m);
    const haystack = `${m.questionPrompt} ${m.correctAnswer} ${m.userChosenOption} ${m.explanation} ${focus} ${tags.join(' ')}`.toLowerCase();
    return haystack.includes(q);
  });
}

export interface WeeklyGrammarWeaknessItem {
  rank: 1 | 2 | 3;
  grammarPointTitle: string;
  corePatternJp: string;
  level: JlptLevel;
  mistakeCount: number;
  affectedQuestionsCount: number;
  relatedTags: string[];
  whyMistakenHk: string;
  whyMistakenJa: string;
  correctExampleJp: string;
  wrongComparisonJp: string;
  actionableTipHk: string;
  sourceMistakeIds: string[];
}

export interface WeeklyMistakeReportSummary {
  weekRangeLabel: string;
  totalWeeklyMistakeCards: number;
  totalWeeklyErrorHits: number;
  mostFrequentTag: string;
  srsConversionRatePercent: number;
  topThreeGrammarPoints: WeeklyGrammarWeaknessItem[];
  tagBreakdown: MistakeTagSummaryItem[];
}

const FALLBACK_WEEKLY_GRAMMAR_POINTS: Array<Omit<WeeklyGrammarWeaknessItem, 'rank'>> = [
  {
    grammarPointTitle: '自動詞＋ています vs 他動詞＋てあります（狀態與助詞が／を）',
    corePatternJp: '自動詞（が）＋ています ／ 他動詞（を）＋てあります',
    level: 'N4',
    mistakeCount: 2,
    affectedQuestionsCount: 1,
    relatedTags: ['助詞疑難', '自動詞vs他動詞'],
    whyMistakenHk:
      '最常因為見到漢字「開／閉／消」就直接揀咗他動詞，忽略咗前面助詞係「が」定係「を」，以及句子係描述自然狀態定人為準備。',
    whyMistakenJa:
      '助詞「が（自動詞＋ています）」と「を（他動詞＋ています）」の対応関係の見落としによる誤答。',
    correctExampleJp: '窓[まど]が開[あ]いていますよ。寒[さむ]いですから閉[し]めてもいいですか。',
    wrongComparisonJp: '✗ 誤選：開けて ／ ✓ 正解：開いて',
    actionableTipHk:
      '解題鐵則：先圈出空格前面粒助詞！見到「が」配「〜ています」90% 係自動詞（狀態）；見到「を」先至揀他動詞！',
    sourceMistakeIds: [],
  },
  {
    grammarPointTitle: '樣態助動詞「〜そうです（視覺跡象）」vs 傳聞「〜らしい」',
    corePatternJp: '動詞ます形（去ます）＋そうです ／ 普通形＋らしいです',
    level: 'N4',
    mistakeCount: 1,
    affectedQuestionsCount: 1,
    relatedTags: ['接續與句尾呼應', '助詞疑難'],
    whyMistakenHk:
      '容易混淆「親眼見到黑雲密佈就快落雨（〜そうです）」同埋「聽新聞講話聽日會落雨（〜らしい／〜そうです傳聞）」，忽略咗動詞接續形態差異。',
    whyMistakenJa:
      '目の前の兆候を表す様態の「降りそうだ」と、客観的根拠・伝聞の「降るらしい」の混同。',
    correctExampleJp: '雨[あめ]が降[ふ]りそうですから、傘[かさ]を持[も]って行[い]ったほうがいいですよ。',
    wrongComparisonJp: '✗ 誤選：らしい ／ ✓ 正解：そう',
    actionableTipHk:
      '睇接續秒殺：前面係「動詞ます形去掉ます（降り＋そう）」一定係樣態「好似就嚟...」；「らしい」前面要接普通形（降る＋らしい）！',
    sourceMistakeIds: [],
  },
  {
    grammarPointTitle: '比例逆接「〜わりに（は）」vs 原因「〜おかげで／せいで」',
    corePatternJp: '普通形（な形容詞＋な／名詞＋の）＋わりに（は）',
    level: 'N3',
    mistakeCount: 1,
    affectedQuestionsCount: 1,
    relatedTags: ['漢字盲點', '接續與句尾呼應'],
    whyMistakenHk:
      '前後句出現「價錢高」但「唔好食」嘅預期反差時，誤揀咗正面原因「おかげで」，未掌握「〜わりに（相對於某個基準卻出乎意料）」嘅逆接語感。',
    whyMistakenJa:
      '基準から予想される程度と実際の結果が食い違う「〜わりに（は）」と原因表現の混同。',
    correctExampleJp: 'このケーキは値段[ねだん]が高[たか]いわりに、あまりおいしくない。',
    wrongComparisonJp: '✗ 誤選：おかげで ／ ✓ 正解：わりに',
    actionableTipHk:
      '見到前句有「値段が高い／年齢／狭い」等衡量標準，後句出現相反評價，即刻揀「〜わりに（は）」！',
    sourceMistakeIds: [],
  },
];

/**
 * Generates the Weekly Mistake Report (錯題周報), automatically summarizing the past 7 days
 * and ranking the Top 3 Most Frequently Mistaken Grammar Points (本週最常犯錯的三個語法點).
 */
export function generateWeeklyMistakeReport(
  mistakes: MistakeRecord[],
  nowMs: number = Date.now(),
  extraUserTags: string[] = []
): WeeklyMistakeReportSummary {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const startDate = new Date(nowMs - sevenDaysMs);
  const endDate = new Date(nowMs);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  const weekRangeLabel = `${fmt(startDate)} ～ ${fmt(endDate)}`;

  // Filter mistakes within the last 7 days; if none fall inside the window, use all mistakes
  const weeklyPool = mistakes.filter((m) => nowMs - (m.timestamp || nowMs) <= sevenDaysMs);
  const activePool = weeklyPool.length > 0 ? weeklyPool : mistakes;

  const totalWeeklyMistakeCards = activePool.length;
  const totalWeeklyErrorHits = activePool.reduce(
    (sum, m) => sum + Math.max(1, m.mistakeCount || 1),
    0
  );
  const convertedCount = activePool.filter((m) => m.convertedToSrs).length;
  const srsConversionRatePercent =
    totalWeeklyMistakeCards === 0
      ? 100
      : Math.round((convertedCount / totalWeeklyMistakeCards) * 100);

  const tagBreakdown = summarizeKnowledgeBaseTags(activePool, extraUserTags);
  const mostFrequentTag =
    tagBreakdown.find((t) => t.count > 0)?.tag || '助詞疑難';

  // Group mistakes by grammarFocusPoint to rank the Top 3 most frequently mistaken grammar points
  const groupMap = new Map<
    string,
    {
      grammarPointTitle: string;
      records: MistakeRecord[];
      totalHits: number;
    }
  >();

  for (const m of activePool) {
    const title = inferGrammarFocusPoint(m);
    const existing = groupMap.get(title);
    const hits = Math.max(1, m.mistakeCount || 1);
    if (existing) {
      existing.records.push(m);
      existing.totalHits += hits;
    } else {
      groupMap.set(title, {
        grammarPointTitle: title,
        records: [m],
        totalHits: hits,
      });
    }
  }

  const sortedGroups = Array.from(groupMap.values()).sort((a, b) => {
    // Prioritize grammar category when tied on hits
    if (b.totalHits !== a.totalHits) return b.totalHits - a.totalHits;
    const aHasGrammar = a.records.some((r) => r.category === 'grammar') ? 1 : 0;
    const bHasGrammar = b.records.some((r) => r.category === 'grammar') ? 1 : 0;
    return bHasGrammar - aHasGrammar;
  });

  const topItems: Array<Omit<WeeklyGrammarWeaknessItem, 'rank'>> = [];

  for (const grp of sortedGroups) {
    if (topItems.length >= 3) break;
    const primary = grp.records[0];
    const allTags = Array.from(
      new Set(grp.records.flatMap((r) => inferDefaultMistakeTags(r)))
    );
    const cleanPrompt = primary.questionPrompt.replace(/^【[^】]+】\s*/g, '').trim();
    const filledSentence = cleanPrompt.includes('（　　）')
      ? cleanPrompt.replace('（　　）', primary.correctAnswer)
      : cleanPrompt.includes('（  ）')
        ? cleanPrompt.replace('（  ）', primary.correctAnswer)
        : `${primary.correctAnswer} — ${cleanPrompt}`;

    topItems.push({
      grammarPointTitle: grp.grammarPointTitle,
      corePatternJp: `正解「${primary.correctAnswer}」 vs 誤選「${primary.userChosenOption}」`,
      level: primary.level,
      mistakeCount: grp.totalHits,
      affectedQuestionsCount: grp.records.length,
      relatedTags: allTags,
      whyMistakenHk: primary.explanation,
      whyMistakenJa: `「${primary.correctAnswer}」と「${primary.userChosenOption}」の文法・語法ルール（${allTags.join('・')}）の混同が見られます。`,
      correctExampleJp: filledSentence,
      wrongComparisonJp: `✗ 誤選：${primary.userChosenOption} ／ ✓ 正解：${primary.correctAnswer}`,
      actionableTipHk: `針對【${allTags.join('・')}】：建議先用「語音聽力強化」盲聽默寫一次原句，再轉化為 SRS 記憶卡於 6 小時內複習鞏固。`,
      sourceMistakeIds: grp.records.map((r) => r.id),
    });
  }

  // Ensure we always provide a complete Top 3 Grammar Points summary even if the user has < 3 distinct mistakes
  for (const fallback of FALLBACK_WEEKLY_GRAMMAR_POINTS) {
    if (topItems.length >= 3) break;
    if (!topItems.some((item) => item.grammarPointTitle === fallback.grammarPointTitle)) {
      topItems.push(fallback);
    }
  }

  const topThreeGrammarPoints: WeeklyGrammarWeaknessItem[] = topItems
    .slice(0, 3)
    .map((item, idx) => ({
      ...item,
      rank: (idx + 1) as 1 | 2 | 3,
    }));

  return {
    weekRangeLabel,
    totalWeeklyMistakeCards,
    totalWeeklyErrorHits,
    mostFrequentTag,
    srsConversionRatePercent,
    topThreeGrammarPoints,
    tagBreakdown,
  };
}

// ============================================================================
// Emotional Japanese Voice Prosody Engine (AI 情感語氣演繹系統)
// ============================================================================

export type VoiceEmotionTone =
  | 'neutral'
  | 'excited'
  | 'gentle'
  | 'surprised'
  | 'serious';

export interface VoiceEmotionPreset {
  id: VoiceEmotionTone;
  labelZh: string;
  labelJa: string;
  badgeHk: string;
  speedFactor: number;
  pitchFactor: number;
  sampleSentenceJp: string;
  descriptionHk: string;
}

export const VOICE_EMOTION_PRESETS: VoiceEmotionPreset[] = [
  {
    id: 'neutral',
    labelZh: '📻 標準平穩 (NHK 播報語氣)',
    labelJa: '📻 標準・ニュートラル (アナウンサー調)',
    badgeHk: '平穩自然',
    speedFactor: 1.0,
    pitchFactor: 1.0,
    sampleSentenceJp: '気温が下がるにつれて、暖房の出力が自動的に上がります。',
    descriptionHk: '字正腔圓、適合聽解考試與標準例句朗讀',
  },
  {
    id: 'excited',
    labelZh: '✨ 開心元氣 (熱血・雀躍感)',
    labelJa: '✨ 元気・ワクワク (感情豊かな喜び)',
    badgeHk: '開心元氣',
    speedFactor: 1.07,
    pitchFactor: 1.06,
    sampleSentenceJp: 'やったぁ！練習すればするほど、日本語がどんどん上手になるね！',
    descriptionHk: '聲優級高昂抑揚頓挫，句尾上揚充滿活力',
  },
  {
    id: 'gentle',
    labelZh: '🌸 溫柔治癒 (親切・柔和叮嚀)',
    labelJa: '🌸 やさしい・穏やか (癒やしトーン)',
    badgeHk: '溫柔治癒',
    speedFactor: 0.93,
    pitchFactor: 1.02,
    sampleSentenceJp: 'ほら、だんだん寒くなってきたから、暖かくしてゆっくり休んでね。',
    descriptionHk: '東京柔和女聲呼吸停頓，語速舒緩親切',
  },
  {
    id: 'surprised',
    labelZh: '😲 驚訝感嘆 (恍然大悟・戲劇張力)',
    labelJa: '😲 驚き・感嘆 (ドラマチックな抑揚)',
    badgeHk: '驚訝感嘆',
    speedFactor: 1.04,
    pitchFactor: 1.07,
    sampleSentenceJp: 'えっ、すごい！高くなれば高くなるほど、景色がこんなに綺麗なんだ！',
    descriptionHk: '加入感嘆語助詞與鮮明高低起伏，突顯語境反差',
  },
  {
    id: 'serious',
    labelZh: '🔥 嚴肅緊迫 (沉穩強調・考場重點)',
    labelJa: '🔥 真剣・強調 (重厚で力強いトーン)',
    badgeHk: '嚴肅強調',
    speedFactor: 0.95,
    pitchFactor: 0.94,
    sampleSentenceJp: 'いいですか、寒ければ寒いほど、しっかり防寒対策をしなければなりません！',
    descriptionHk: '低沉磁性重音停頓，強調因果與必考語法重點',
  },
];

/**
 * Pure helper that shapes Japanese text with natural emotional interjections and prosodic punctuation
 * so neural TTS engines synthesize palpable emotional expression when requested.
 */
export function shapeJapaneseProsodyForEmotion(
  rawCleanText: string,
  emotion: VoiceEmotionTone = 'neutral',
  includeExpressiveCue: boolean = false
): {
  shapedTextJp: string;
  speedFactor: number;
  pitchFactor: number;
  preferredNeuralVoiceCode: 'jp_001' | 'jp_003' | 'jp_005' | 'jp_006' | null;
} {
  const base = rawCleanText.trim();
  const preset =
    VOICE_EMOTION_PRESETS.find((p) => p.id === emotion) || VOICE_EMOTION_PRESETS[0];

  if (!base || emotion === 'neutral') {
    return {
      shapedTextJp: base,
      speedFactor: 1.0,
      pitchFactor: 1.0,
      preferredNeuralVoiceCode: null,
    };
  }

  const strippedEnd = base.replace(/[。．.]+$/u, '');

  if (emotion === 'excited') {
    const prefix =
      includeExpressiveCue && !/^(やった|わぁ|すごい|よし)/u.test(strippedEnd)
        ? 'わぁ、すごい！'
        : '';
    const withExclamation = strippedEnd.endsWith('！')
      ? strippedEnd
      : `${strippedEnd}！`;
    return {
      shapedTextJp: `${prefix}${withExclamation}`,
      speedFactor: preset.speedFactor,
      pitchFactor: preset.pitchFactor,
      preferredNeuralVoiceCode: 'jp_003', // Expressive seiyuu voice
    };
  }

  if (emotion === 'gentle') {
    const prefix =
      includeExpressiveCue && !/^(あのね|ほら|ねえ)/u.test(strippedEnd)
        ? 'あのね、'
        : '';
    return {
      shapedTextJp: `${prefix}${strippedEnd}。`,
      speedFactor: preset.speedFactor,
      pitchFactor: preset.pitchFactor,
      preferredNeuralVoiceCode: 'jp_005', // Warm gentle Tokyo voice
    };
  }

  if (emotion === 'surprised') {
    const prefix =
      includeExpressiveCue && !/^(えっ|なんと|まさか|わっ)/u.test(strippedEnd)
        ? 'えっ、ほんとうに！？'
        : '';
    const withExclamation = strippedEnd.endsWith('！')
      ? strippedEnd
      : `${strippedEnd}！`;
    return {
      shapedTextJp: `${prefix}${withExclamation}`,
      speedFactor: preset.speedFactor,
      pitchFactor: preset.pitchFactor,
      preferredNeuralVoiceCode: 'jp_003',
    };
  }

  // 'serious'
  const prefix =
    includeExpressiveCue && !/^(実は|いいですか|よく聞いて)/u.test(strippedEnd)
      ? 'いいですか、'
      : '';
  const withExclamation = strippedEnd.endsWith('！')
    ? strippedEnd
    : `${strippedEnd}！`;
  return {
    shapedTextJp: `${prefix}${withExclamation}`,
    speedFactor: preset.speedFactor,
    pitchFactor: preset.pitchFactor,
    preferredNeuralVoiceCode: 'jp_006', // Deep resonant announcer voice
  };
}

// ============================================================================
// Dynamic Correlation Visual Simulator (動態同步演練：「〜ば〜ほど」×「〜につれて」)
// ============================================================================

export interface DynamicCorrelationStageData {
  stageIndex: 0 | 1 | 2 | 3 | 4;
  stageLabelHk: string;
  stageLabelJa: string;
  emotionTone: VoiceEmotionTone;
  emotionBadgeHk: string;
  liveStatusJp: string;
  liveStatusHk: string;
  // 〜ば〜ほど variants (both transitive を and intransitive が)
  baHodoConditionJp: string;
  baHodoRepeatJp: string;
  baHodoAdverbJp: string;
  baHodoResultTransitiveJp: string;
  baHodoResultIntransitiveJp: string;
  baHodoFullTransitiveJp: string;
  baHodoFullIntransitiveJp: string;
  baHodoTranslationHk: string;
  // 〜につれて variants
  nitsureteClauseAJp: string;
  nitsureteConnectorJp: string;
  nitsureteClauseBJp: string;
  nitsureteFullJp: string;
  nitsureteTranslationHk: string;
}

export interface DynamicCorrelationScenario {
  id: 'temp-heating' | 'practice-fluency' | 'altitude-oxygen' | 'age-experience';
  titleHk: string;
  titleJa: string;
  subtitleHk: string;
  variableA: {
    nameHk: string;
    nameJa: string;
    unit: string;
    startValue: number;
    endValue: number;
    directionLabelHk: string;
  };
  variableB: {
    nameHk: string;
    nameJa: string;
    unit: string;
    startValue: number;
    endValue: number;
    directionLabelHk: string;
  };
  grammarComparisonNoteHk: string;
  grammarComparisonNoteJa: string;
  stages: [
    DynamicCorrelationStageData,
    DynamicCorrelationStageData,
    DynamicCorrelationStageData,
    DynamicCorrelationStageData,
    DynamicCorrelationStageData,
  ];
}

export const DYNAMIC_CORRELATION_SCENARIOS: DynamicCorrelationScenario[] = [
  {
    id: 'temp-heating',
    titleHk: '🌡️ 氣溫下降 ➔ 🔥 暖氣強度同步上升',
    titleJa: '🌡️ 気温の低下 ➔ 🔥 暖房の強さの上昇',
    subtitleHk: '拉動滑桿降低室外氣溫（A），即時觀察暖氣輸出（B）與「〜ば〜ほど／〜につれて」句式變體！',
    variableA: {
      nameHk: '室外氣溫 (変数 A)',
      nameJa: '外の気温 (A)',
      unit: '°C',
      startValue: 25,
      endValue: -5,
      directionLabelHk: '越跌越凍 (25°C ➔ -5°C)',
    },
    variableB: {
      nameHk: '暖氣強度 (変数 B)',
      nameJa: '暖房の出力 (B)',
      unit: '%',
      startValue: 15,
      endValue: 100,
      directionLabelHk: '越開越強 (15% ➔ 100% MAX)',
    },
    grammarComparisonNoteHk:
      '【核心對比】「寒ければ寒いほど」重複同一形容詞（ば形＋原形＋ほど），後件可以用人為意志動作（暖房を強くする）或自然變化（暖房が強くなる）；而「寒くなるにつれて」前件必須用變化動詞（寒くなる），後件只能用客觀自然變化（暖房が強くなる），絕不可用主觀「〜たい／〜よう」！',
    grammarComparisonNoteJa:
      '「〜ば〜ほど」は仮定条件＋原形で比例関係を強調し、後件に意志動詞も可能。一方「〜につれて」は一方向の自然な変化の進行を表すため、後件に意志表現（〜たい・〜よう）は使えません。',
    stages: [
      {
        stageIndex: 0,
        stageLabelHk: 'Stage 1 · 微涼初秋 (25°C ➔ 19°C)',
        stageLabelJa: '第1段階・少し涼しい秋口',
        emotionTone: 'gentle',
        emotionBadgeHk: '🌸 溫柔輕快語氣',
        liveStatusJp: '外[そと]はまだ少[すこ]し涼[すず]しい程度[ていど]なので、暖房[だんぼう]は一番[いちばん]弱[よわ]いままです。',
        liveStatusHk: '出面仲只係微涼，所以暖氣維持喺最弱檔。',
        baHodoConditionJp: '涼[すず]しければ',
        baHodoRepeatJp: '涼[すず]しいほど',
        baHodoAdverbJp: 'すこしずつ',
        baHodoResultTransitiveJp: '暖房[だんぼう]をつけ始[はじ]める。',
        baHodoResultIntransitiveJp: '暖房[だんぼう]の必要[ひつよう]が出[で]てくる。',
        baHodoFullTransitiveJp: '外[そと]が涼[すず]しければ涼[すず]しいほど、すこしずつ暖房[だんぼう]をつけ始[はじ]める。',
        baHodoFullIntransitiveJp: '外[そと]が涼[すず]しければ涼[すず]しいほど、すこしずつ暖房[だんぼう]の必要[ひつよう]が出[で]てくる。',
        baHodoTranslationHk: '出面越涼，就越開始慢慢開暖氣。',
        nitsureteClauseAJp: '秋[あき]になって涼[すず]しくなる',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '暖房[だんぼう]を使[つか]う時間[じかん]が増[ふ]えてくる。',
        nitsureteFullJp: '秋[あき]になって涼[すず]しくなるにつれて、暖房[だんぼう]を使[つか]う時間[じかん]が増[ふ]えてくる。',
        nitsureteTranslationHk: '隨住入秋天氣轉涼，用暖氣嘅時間亦逐漸增加。',
      },
      {
        stageIndex: 1,
        stageLabelHk: 'Stage 2 · 氣溫轉冷 (18°C ➔ 12°C)',
        stageLabelJa: '第2段階・肌寒くなってきた頃',
        emotionTone: 'neutral',
        emotionBadgeHk: '📻 標準平穩語氣',
        liveStatusJp: '気温[きおん]が下[さ]がって肌寒[はだざむ]くなり、暖房[だんぼう]を中[ちゅう]レベルに上[あ]げました。',
        liveStatusHk: '氣溫下降開始有寒意，暖氣調高到中段強度。',
        baHodoConditionJp: '気温[きおん]が下[さ]がれば',
        baHodoRepeatJp: '下[さ]がるほど',
        baHodoAdverbJp: 'だんだん',
        baHodoResultTransitiveJp: '暖房[だんぼう]の温度[おんど]を上[あ]げる。',
        baHodoResultIntransitiveJp: '暖房[だんぼう]の温度[おんど]が上[あ]がる。',
        baHodoFullTransitiveJp: '気温[きおん]が下[さ]がれば下[さ]がるほど、だんだん暖房[だんぼう]の温度[おんど]を上[あ]げる。',
        baHodoFullIntransitiveJp: '気温[きおん]が下[さ]がれば下[さ]がるほど、だんだん暖房[だんぼう]の温度[おんど]が上[あ]がる。',
        baHodoTranslationHk: '氣溫越跌得低，就越將暖氣溫度調高。',
        nitsureteClauseAJp: '外[そと]の気温[きおん]が下[さ]がる',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '暖房[だんぼう]の設定温度[せっていおんど]も上[あ]がっていく。',
        nitsureteFullJp: '外[そと]の気温[きおん]が下[さ]がるにつれて、暖房[だんぼう]の設定温度[せっていおんど]も上[あ]がっていく。',
        nitsureteTranslationHk: '隨住室外氣溫下降，暖氣嘅設定溫度亦同步上升。',
      },
      {
        stageIndex: 2,
        stageLabelHk: 'Stage 3 · 寒冬來襲 (11°C ➔ 5°C)',
        stageLabelJa: '第3段階・本格的な冬の寒さ',
        emotionTone: 'neutral',
        emotionBadgeHk: '📻 清晰強調語氣',
        liveStatusJp: 'かなり寒[さむ]くなってきたため、暖房[だんぼう]がしっかりと強[つよ]く稼働[かどう]しています。',
        liveStatusHk: '天氣變得相當寒冷，暖氣正強效運作緊。',
        baHodoConditionJp: '寒[さむ]ければ',
        baHodoRepeatJp: '寒[さむ]いほど',
        baHodoAdverbJp: 'ますます',
        baHodoResultTransitiveJp: '暖房[だんぼう]を強[つよ]くする。',
        baHodoResultIntransitiveJp: '暖房[だんぼう]が強[つよ]くなる。',
        baHodoFullTransitiveJp: '天[てん]気[き]が寒[さむ]ければ寒[さむ]いほど、ますます暖房[だんぼう]を強[つよ]くする。',
        baHodoFullIntransitiveJp: '天[てん]気[き]が寒[さむ]ければ寒[さむ]いほど、ますます暖房[だんぼう]が強[つよ]くなる。',
        baHodoTranslationHk: '天氣越凍，暖氣就開得越強。',
        nitsureteClauseAJp: '天[てん]気[き]が寒[さむ]くなる',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '暖房[だんぼう]の出力[しゅつりょく]が強[つよ]くなっていく。',
        nitsureteFullJp: '天[てん]気[き]が寒[さむ]くなるにつれて、暖房[だんぼう]の出力[しゅつりょく]が強[つよ]くなっていく。',
        nitsureteTranslationHk: '隨住天氣轉冷，暖氣輸出功率亦越變越強。',
      },
      {
        stageIndex: 3,
        stageLabelHk: 'Stage 4 · 嚴寒逼近冰點 (4°C ➔ 0°C)',
        stageLabelJa: '第4段階・氷点下に迫る厳冬',
        emotionTone: 'surprised',
        emotionBadgeHk: '😲 感嘆起伏語氣',
        liveStatusJp: 'えっ、もう0度[ど]近[ちか]くです！寒[さむ]さが厳[きび]しくなり、暖房[だんぼう]がフルパワーに近[ちか]づいています！',
        liveStatusHk: '哇，已經接近 0 度喇！寒冷加劇，暖氣已經接近全功率輸出！',
        baHodoConditionJp: '冷[ひ]え込[こ]めば',
        baHodoRepeatJp: '冷[ひ]え込[こ]むほど',
        baHodoAdverbJp: 'いっそう',
        baHodoResultTransitiveJp: '暖房[だんぼう]の風量[ふうりょう]を最大[さいだい]に近[ちか]づける！',
        baHodoResultIntransitiveJp: '暖房[だんぼう]の消費電力[しょうひでんりょく]が急増[きゅうぞう]する！',
        baHodoFullTransitiveJp: '夜[よる]が冷[ひ]え込[こ]めば冷[ひ]え込[こ]むほど、いっそう暖房[だんぼう]の風量[ふうりょう]を最大[さいだい]に近[ちか]づける！',
        baHodoFullIntransitiveJp: '夜[よる]が冷[ひ]え込[こ]めば冷[ひ]え込[こ]むほど、いっそう暖房[だんぼう]の消費電力[しょうひでんりょく]が急増[きゅうぞう]する！',
        baHodoTranslationHk: '夜晚越係急劇降溫，就越係將暖氣風量推向最大！',
        nitsureteClauseAJp: '寒[さむ]さが厳[きび]しくなる',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '部屋[へや]の暖房[だんぼう]もぐんぐん強[つよ]まっていく！',
        nitsureteFullJp: '寒[さむ]さが厳[きび]しくなるにつれて、部屋[へや]の暖房[だんぼう]もぐんぐん強[つよ]まっていく！',
        nitsureteTranslationHk: '隨住嚴寒加劇，房入面嘅暖氣亦急速增強！',
      },
      {
        stageIndex: 4,
        stageLabelHk: 'Stage 5 · 冰點下極寒 (-1°C ➔ -5°C MAX)',
        stageLabelJa: '第5段階・氷点下の極寒（暖房MAX）',
        emotionTone: 'serious',
        emotionBadgeHk: '🔥 緊迫強調語氣',
        liveStatusJp: '氷点下[ひょうてんか]5度[ど]の極寒[ごっかん]です！凍[こご]えるほど寒[さむ]いため、暖房[だんぼう]は100%最強[さいきょう]モードで稼働中[かどうちゅう]です！',
        liveStatusHk: '零下 5 度極寒！凍到震，暖氣正以 100% 最強模式全速運轉！',
        baHodoConditionJp: '氷点下[ひょうてんか]で寒[さむ]ければ',
        baHodoRepeatJp: '寒[さむ]いほど',
        baHodoAdverbJp: '最大限[さいだいげん]に',
        baHodoResultTransitiveJp: '暖房[だんぼう]を最強[さいきょう]モードにする！',
        baHodoResultIntransitiveJp: '暖房[だんぼう]の出力[しゅつりょく]が最高潮[さいこうちょう]に達[たっ]する！',
        baHodoFullTransitiveJp: '氷点下[ひょうてんか]で寒[さむ]ければ寒[さむ]いほど、最大限[さいだいげん]に暖房[だんぼう]を最強[さいきょう]モードにする！',
        baHodoFullIntransitiveJp: '氷点下[ひょうてんか]で寒[さむ]ければ寒[さむ]いほど、最大限[さいだいげん]に暖房[だんぼう]の出力[しゅつりょく]が最高潮[さいこうちょう]に達[たっ]する！',
        baHodoTranslationHk: '零下越係寒冷，就越要最大限度將暖氣開到最強模式！',
        nitsureteClauseAJp: '気温[きおん]が氷点下[ひょうてんか]へ下[さ]がり続[つづ]ける',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '暖房[だんぼう]の出力[しゅつりょく]も最高[さいこう]レベルに達[たっ]していく！',
        nitsureteFullJp: '気温[きおん]が氷点下[ひょうてんか]へ下[さ]がり続[つづ]けるにつれて、暖房[だんぼう]の出力[しゅつりょく]も最高[さいこう]レベルに達[たっ]していく！',
        nitsureteTranslationHk: '隨住氣溫持續跌入零下，暖氣輸出亦達到最高極限！',
      },
    ],
  },
  {
    id: 'practice-fluency',
    titleHk: '🎙️ 跟讀練習次數增加 ➔ ✨ 日語發音越自然流暢',
    titleJa: '🎙️ シャドーイング練習回数 ➔ ✨ 発音の自然さ・流暢さ',
    subtitleHk: '拉動滑桿增加跟讀次數（A），感受「練習すればするほど」與「練習するにつれて」嘅語感推進！',
    variableA: {
      nameHk: '跟讀練習次數 (変数 A)',
      nameJa: '練習回数 (A)',
      unit: '回',
      startValue: 5,
      endValue: 100,
      directionLabelHk: '累積練習 (5回 ➔ 100回)',
    },
    variableB: {
      nameHk: '日語流暢自然度 (変数 B)',
      nameJa: '発音の自然さ (B)',
      unit: '%',
      startValue: 35,
      endValue: 98,
      directionLabelHk: '母語流暢度 (35% ➔ 98%)',
    },
    grammarComparisonNoteHk:
      '【サ変動詞變形注意】「練習する」變成「〜ば〜ほど」時，係「練習すれば（ば形）＋ 練習するほど（原形＋ほど）」（或者省略前一個名詞直接講「すればするほど」）；而「〜につれて」前面直接用原形「練習するにつれて」。',
    grammarComparisonNoteJa:
      'サ変動詞「練習する」は「練習すれば練習するほど（または練習すればするほど）」となり、「〜につれて」では辞書形「練習するにつれて」になります。',
    stages: [
      {
        stageIndex: 0,
        stageLabelHk: 'Stage 1 · 初次開口 (5回 · 流暢度 35%)',
        stageLabelJa: '第1段階・声に出し始めたばかり',
        emotionTone: 'gentle',
        emotionBadgeHk: '🌸 溫柔鼓勵語氣',
        liveStatusJp: 'まだ5回[かい]目[め]ですが、すこしずつ口[くち]が日本語[にほんご]のリズムに慣[な]れてきました。',
        liveStatusHk: '雖然只係第 5 次，但個口已經開始慢慢習慣日文節奏。',
        baHodoConditionJp: '声[こえ]に出[だ]せば',
        baHodoRepeatJp: '出[だ]すほど',
        baHodoAdverbJp: 'すこしずつ',
        baHodoResultTransitiveJp: '日本語[にほんご]の音[おと]を覚[おぼ]えられる。',
        baHodoResultIntransitiveJp: '日本語[にほんご]のリズムに慣[な]れてくる。',
        baHodoFullTransitiveJp: '声[こえ]に出[だ]せば出[だ]すほど、すこしずつ日本語[にほんご]の音[おと]を覚[おぼ]えられる。',
        baHodoFullIntransitiveJp: '声[こえ]に出[だ]せば出[だ]すほど、すこしずつ日本語[にほんご]のリズムに慣[な]れてくる。',
        baHodoTranslationHk: '越係開口大聲讀，就越能夠一點一滴記住日文發音。',
        nitsureteClauseAJp: '声[こえ]に出[だ]して読[よ]む',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '発音[はつおん]への抵抗感[ていこうかん]がなくなっていく。',
        nitsureteFullJp: '声[こえ]に出[だ]して読[よ]むにつれて、発音[はつおん]への抵抗感[ていこうかん]がなくなっていく。',
        nitsureteTranslationHk: '隨住開口朗讀，對發音嘅抗拒感亦慢慢消失。',
      },
      {
        stageIndex: 1,
        stageLabelHk: 'Stage 2 · 漸入佳境 (25回 · 流暢度 55%)',
        stageLabelJa: '第2段階・イントネーションが安定',
        emotionTone: 'neutral',
        emotionBadgeHk: '📻 平穩自然語氣',
        liveStatusJp: '25回[かい]練習[れんしゅう]して、高低[こうてい]アクセントの感覚[かんかく]が分[わ]かってきました。',
        liveStatusHk: '練習咗 25 次，開始捉到高低音調（Pitch Accent）嘅感覺。',
        baHodoConditionJp: '練習[れんしゅう]すれば',
        baHodoRepeatJp: '練習[れんしゅう]するほど',
        baHodoAdverbJp: 'だんだん',
        baHodoResultTransitiveJp: '正確[せいかく]な発音[はつおん]を身[み]につけられる。',
        baHodoResultIntransitiveJp: '発音[はつおん]が自然[しぜん]になる。',
        baHodoFullTransitiveJp: '練習[れんしゅう]すれば練習[れんしゅう]するほど、だんだん正確[せいかく]な発音[はつおん]を身[み]につけられる。',
        baHodoFullIntransitiveJp: '練習[れんしゅう]すれば練習[れんしゅう]するほど、だんだん発音[はつおん]が自然[しぜん]になる。',
        baHodoTranslationHk: '越係練習，發音就越變得自然。',
        nitsureteClauseAJp: '反復練習[はんぷくれんしゅう]を重[かさ]ねる',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '日本語[にほんご]のイントネーションが自然[しぜん]になっていく。',
        nitsureteFullJp: '反復練習[はんぷくれんしゅう]を重[かさ]ねるにつれて、日本語[にほんご]のイントネーションが自然[しぜん]になっていく。',
        nitsureteTranslationHk: '隨住不斷重複練習，日文語調亦變得越嚟越自然。',
      },
      {
        stageIndex: 2,
        stageLabelHk: 'Stage 3 · 節奏純熟 (50回 · 流暢度 72%)',
        stageLabelJa: '第3段階・ネイティブの速度に追いつく',
        emotionTone: 'excited',
        emotionBadgeHk: '✨ 元氣自信語氣',
        liveStatusJp: '50回[かい]達成[たっせい]！NHKアナウンサーのスピードにも遅[おく]れずについていけます！',
        liveStatusHk: '達成 50 次！已經跟得上 NHK 主播嘅語速而唔會甩拍！',
        baHodoConditionJp: 'シャドーイングを続[つづ]ければ',
        baHodoRepeatJp: '続[つづ]けるほど',
        baHodoAdverbJp: 'ますます',
        baHodoResultTransitiveJp: 'ネイティブの表現[ひょうげん]を吸収[きゅうしゅう]できる！',
        baHodoResultIntransitiveJp: '会話[かいわ]のテンポが良[よ]くなる！',
        baHodoFullTransitiveJp: 'シャドーイングを続[つづ]ければ続[つづ]けるほど、ますますネイティブの表現[ひょうげん]を吸収[きゅうしゅう]できる！',
        baHodoFullIntransitiveJp: 'シャドーイングを続[つづ]ければ続[つづ]けるほど、ますます会話[かいわ]のテンポが良[よ]くなる！',
        baHodoTranslationHk: '跟讀越係堅持落去，會話節奏就越變越好！',
        nitsureteClauseAJp: '練習回数[れんしゅうかいすう]が増[ふ]える',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '聞[き]き取[と]れる単語[たんご]の量[りょう]も飛躍的[ひяくてき]に増[ふ]えていく！',
        nitsureteFullJp: '練習回数[れんしゅうかいすう]が増[ふ]えるにつれて、聞[き]き取[と]れる単語[たんご]の量[りょう]も飛躍的[ひяくてき]に増[ふ]えていく！',
        nitsureteTranslationHk: '隨住練習次數增加，聽得明嘅詞彙量亦飛躍式增長！',
      },
      {
        stageIndex: 3,
        stageLabelHk: 'Stage 4 · 脫口而出 (75回 · 流暢度 86%)',
        stageLabelJa: '第4段階・考えずにスラスラ話せる',
        emotionTone: 'surprised',
        emotionBadgeHk: '😲 驚喜感嘆語氣',
        liveStatusJp: 'すごい！頭[あたま]で翻訳[ほんやく]しなくても、自然[しぜん]に日本語[にほんご]が口[くち]から出[で]てきます！',
        liveStatusHk: '好勁呀！唔使喺腦入面翻譯，日文已經自然脫口而出！',
        baHodoConditionJp: '深[ふか]く学[まな]べば',
        baHodoRepeatJp: '学[まな]ぶほど',
        baHodoAdverbJp: 'どんどん',
        baHodoResultTransitiveJp: '日本語[にほんご]で自由[じゆう]に気持[きも]ちを伝[つた]えられる！',
        baHodoResultIntransitiveJp: '日本語[にほんご]の勉強[べんきょう]が面[おも]白[しろ]くなる！',
        baHodoFullTransitiveJp: '深[ふか]く学[まな]べば学[まな]ぶほど、どんどん日本語[にほんご]で自由[じゆう]に気持[きも]ちを伝[つた]えられる！',
        baHodoFullIntransitiveJp: '深[ふか]く学[まな]べば学[まな]ぶほど、どんどん日本語[にほんご]の勉強[べんきょう]が面[おも]白[しろ]くなる！',
        baHodoTranslationHk: '越係深入學習，學日文就越變得有趣！',
        nitsureteClauseAJp: '日本語[にほんご]が上手[じょうず]になる',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '日本[にほん]のアニメやニュースがそのまま理解[りかい]できるようになる！',
        nitsureteFullJp: '日本語[にほんご]が上手[じょうず]になるにつれて、日本[にほん]のアニメやニュースがそのまま理解[りかい]できるようになる！',
        nitsureteTranslationHk: '隨住日文越嚟越好，日本動漫同新聞都能夠原汁原味直接聽明！',
      },
      {
        stageIndex: 4,
        stageLabelHk: 'Stage 5 · 母語級精熟 (100回 · 流暢度 98% MAX)',
        stageLabelJa: '第5段階・ネイティブ並みの流暢さ達成',
        emotionTone: 'excited',
        emotionBadgeHk: '✨ 熱血歡呼語氣',
        liveStatusJp: 'やったぁ！100回[かい]完走[かんそう]！感情[かんじょう]を込[こ]めてネイティブのようにペラペラ話[はな]せます！',
        liveStatusHk: '太正喇！完成 100 次跟讀！可以帶住感情好似母語者噉流利對答！',
        baHodoConditionJp: '極[きわ]めれば',
        baHodoRepeatJp: '極[きわ]めるほど',
        baHodoAdverbJp: '限りなく',
        baHodoResultTransitiveJp: 'どんな場面[ばめん]でも完璧[かんぺき]な日本語[にほんご]を話[はな]せる！',
        baHodoResultIntransitiveJp: '表現力[ひょうげんりょく]がネイティブに近[ちか]づく！',
        baHodoFullTransitiveJp: '発音[はつおん]を極[きわ]めれば極[きわ]めるほど、どんな場面[ばめん]でも完璧[かんぺき]な日本語[にほんご]を話[はな]せる！',
        baHodoFullIntransitiveJp: '発音[はつおん]を極[きわ]めれば極[きわ]めるほど、表現力[ひょうげんりょく]がネイティブに近[ちか]づく！',
        baHodoTranslationHk: '越係將發音鑽研到極致，表達力就越接近母語者！',
        nitsureteClauseAJp: '100回[かい]の練習[れんしゅう]をやり遂[と]げる',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '揺[ゆ]るぎない自信[じしん]と流暢[りゅうちょう]な発音[はつおん]が定着[ていちゃく]していく！',
        nitsureteFullJp: '100回[かい]の練習[れんしゅう]をやり遂[と]げるにつれて、揺[ゆ]るぎない自信[じしん]と流暢[りゅうちょう]な発音[はつおん]が定着[ていちゃく]していく！',
        nitsureteTranslationHk: '隨住完成 100 次練習，無可動搖嘅自信與流暢發音亦徹底紮根！',
      },
    ],
  },
  {
    id: 'altitude-oxygen',
    titleHk: '🗻 登山海拔越高 ➔ 🌬️ 氣溫越低・風景越壯麗',
    titleJa: '🗻 標高の上昇 ➔ 🌬️ 気温の低下・景色の広がり',
    subtitleHk: '拉動滑桿攀登富士山（海拔 200m ➔ 3776m），比較「高ければ高いほど」與「登るにつれて」！',
    variableA: {
      nameHk: '登山海拔高度 (変数 A)',
      nameJa: '山の標高 (A)',
      unit: 'm',
      startValue: 200,
      endValue: 3776,
      directionLabelHk: '海拔攀升 (200m ➔ 3776m)',
    },
    variableB: {
      nameHk: '山頂視野壯闊度 (変数 B)',
      nameJa: '景色の壮大さ (B)',
      unit: '%',
      startValue: 25,
      endValue: 100,
      directionLabelHk: '雲海絕景 (25% ➔ 100%)',
    },
    grammarComparisonNoteHk:
      '【動詞 vs 形容詞變體】動詞「登る」用「登れば登るほど」或「登るにつれて」；い形容詞「高い」用「高ければ高いほど」或變成變化動詞「高くなるにつれて」。',
    grammarComparisonNoteJa:
      '動詞「登る」は「登れば登るほど／登るにつれて」、い形容詞「高い」は「高ければ高いほど／高くなるにつれて」と活用します。',
    stages: [
      {
        stageIndex: 0,
        stageLabelHk: 'Stage 1 · 山麓起點 (200m)',
        stageLabelJa: '第1段階・山のふもと',
        emotionTone: 'gentle',
        emotionBadgeHk: '🌸 輕鬆出發語氣',
        liveStatusJp: '山のふもと（200m）は緑[みどり]が豊[ゆた]かで、風[かぜ]がとても気持[きも]ちいいです。',
        liveStatusHk: '山腳（200m）綠樹林蔭，微風非常舒服。',
        baHodoConditionJp: '山[やま]を歩[ある]けば',
        baHodoRepeatJp: '歩[ある]くほど',
        baHodoAdverbJp: 'すこしずつ',
        baHodoResultTransitiveJp: '新[あたら]しい景色[けしき]を発[はっ]見[けん]できる。',
        baHodoResultIntransitiveJp: '気分[きぶん]が爽快[そうかい]になる。',
        baHodoFullTransitiveJp: '山[やま]を歩[ある]けば歩[ある]くほど、すこしずつ新[あたら]しい景色[けしき]を発[はっ]見[けん]できる。',
        baHodoFullIntransitiveJp: '山[やま]を歩[ある]けば歩[ある]くほど、すこしずつ気分[きぶん]が爽快[そうかい]になる。',
        baHodoTranslationHk: '越係喺山入面行，心情就越變得舒暢。',
        nitsureteClauseAJp: '山道[やまみち]を進[すす]む',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '街[まち]の騒音[そうおん]が遠[とお]ざかっていく。',
        nitsureteFullJp: '山道[やまみち]を進[すす]むにつれて、街[まち]の騒音[そうおん]が遠[とお]ざかっていく。',
        nitsureteTranslationHk: '隨住沿山路前進，城市嘅喧囂亦漸漸遠去。',
      },
      {
        stageIndex: 1,
        stageLabelHk: 'Stage 2 · 半山林間 (1100m)',
        stageLabelJa: '第2段階・中腹の森林帯',
        emotionTone: 'neutral',
        emotionBadgeHk: '📻 平穩敘述語氣',
        liveStatusJp: '標高[ひょうこう]1100mを超[こ]え、木々[きぎ]の間[あいだ]から街並[まちな]みが見下[みお]ろせます。',
        liveStatusHk: '海拔超過 1100m，可以從樹林之間俯瞰城市街景。',
        baHodoConditionJp: '上[うえ]へ登[のぼ]れば',
        baHodoRepeatJp: '登[のぼ]るほど',
        baHodoAdverbJp: 'だんだん',
        baHodoResultTransitiveJp: '遠[とお]くの街[まち]を見渡[みわた]せる。',
        baHodoResultIntransitiveJp: '見晴[みは]らしが良[よ]くなる。',
        baHodoFullTransitiveJp: '上[うえ]へ登[のぼ]れば登[のぼ]るほど、だんだん遠[とお]くの街[まち]を見渡[みわた]せる。',
        baHodoFullIntransitiveJp: '上[うえ]へ登[のぼ]れば登[のぼ]るほど、だんだん見晴[みは]らしが良[よ]くなる。',
        baHodoTranslationHk: '越係往上爬，視野就越開闊。',
        nitsureteClauseAJp: '標高[ひょうこう]が高[たか]くなる',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '吹[ふ]く風[かぜ]がひんやりしてくる。',
        nitsureteFullJp: '標高[ひょうこう]が高[たか]くなるにつれて、吹[ふ]く風[かぜ]がひんやりしてくる。',
        nitsureteTranslationHk: '隨住海拔升高，吹過嚟嘅風亦變得清涼。',
      },
      {
        stageIndex: 2,
        stageLabelHk: 'Stage 3 · 富士山五合目 (2300m)',
        stageLabelJa: '第3段階・雲の上の五合目',
        emotionTone: 'surprised',
        emotionBadgeHk: '😲 驚嘆壯麗語氣',
        liveStatusJp: '標高[ひょうこう]2300m！雲[くも]が足元[あしもと]に広[ひろ]がり、空気[くうき]も薄[うす]くなってきました！',
        liveStatusHk: '海拔 2300m！雲層喺腳下展開，空氣亦開始變薄！',
        baHodoConditionJp: '山[やま]が高[たか]ければ',
        baHodoRepeatJp: '高[たか]いほど',
        baHodoAdverbJp: 'ますます',
        baHodoResultTransitiveJp: '壮大[そうだい]な雲海[うんかい]を眺[なが]められる！',
        baHodoResultIntransitiveJp: '空気[くうき]が薄[うす]くなり気温[きおん]が下[さ]がる！',
        baHodoFullTransitiveJp: '山[やま]が高[たか]ければ高[たか]いほど、ますます壮大[そうだい]な雲海[うんかい]を眺[なが]められる！',
        baHodoFullIntransitiveJp: '山[やま]が高[たか]ければ高[たか]いほど、ますます空気[くうき]が薄[うす]くなり気温[きおん]が下[さ]がる！',
        baHodoTranslationHk: '山越係高，空氣就越稀薄、雲海亦越壯觀！',
        nitsureteClauseAJp: '高[たか]い場所[ばしょ]へ登[のぼ]る',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '気圧[きあつ]と気温[きおん]がどんどん下[さ]がっていく。',
        nitsureteFullJp: '高[たか]い場所[ばしょ]へ登[のぼ]るにつれて、気圧[きあつ]と気温[きおん]がどんどん下[さ]がっていく。',
        nitsureteTranslationHk: '隨住登向高處，氣壓同氣溫都不斷下降。',
      },
      {
        stageIndex: 3,
        stageLabelHk: 'Stage 4 · 八合目星空帶 (3100m)',
        stageLabelJa: '第4段階・森林限界を超えた八合目',
        emotionTone: 'serious',
        emotionBadgeHk: '🔥 嚴肅專注語氣',
        liveStatusJp: '3100mに達[たっ]しました！酸素[さんそ]が薄[うす]いため、一歩[いっぽ]ずつ慎重[しんちょう]に登[のぼ]ります！',
        liveStatusHk: '到達 3100m！因為氧氣稀薄，每一步都要謹慎攀登！',
        baHodoConditionJp: '頂上[ちょうじょう]に近[ちか]づけば',
        baHodoRepeatJp: '近[ちか]づくほど',
        baHodoAdverbJp: 'いっそう',
        baHodoResultTransitiveJp: 'ペースを守[まも]って慎重[しんちょう]に歩[ある]く！',
        baHodoResultIntransitiveJp: '道[みち]が険[けわ]しくなる！',
        baHodoFullTransitiveJp: '頂上[ちょうじょう]に近[ちか]づけば近[ちか]づくほど、いっそうペースを守[まも]って慎重[しんちょう]に歩[ある]く！',
        baHodoFullIntransitiveJp: '頂上[ちょうじょう]に近[ちか]づけば近[ちか]づくほど、いっそう道[みち]が険[けわ]しくなる！',
        baHodoTranslationHk: '越係接近山頂，山路就越險峻、越要謹慎保持步速！',
        nitsureteClauseAJp: '山頂[さんちょう]が近[ちか]づく',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '周囲[しゅうい]の視界[しかい]が一気[いっき]に開[ひら]けていく！',
        nitsureteFullJp: '山頂[さんちょう]が近[ちか]づくにつれて、周囲[しゅうい]の視界[しかい]が一気[いっき]に開[ひら]けていく！',
        nitsureteTranslationHk: '隨住山頂逼近，周圍嘅視野亦一口氣豁然開朗！',
      },
      {
        stageIndex: 4,
        stageLabelHk: 'Stage 5 · 富士山頂御來光 (3776m MAX)',
        stageLabelJa: '第5段階・富士山頂3776mのご来光',
        emotionTone: 'excited',
        emotionBadgeHk: '✨ 感動激昂語氣',
        liveStatusJp: '3776m登頂成功[とうちょうせいこう]！見渡[みわた]す限[かぎ]りの雲海[うんかい]とご来光[らいこう]が最高[さいこう]に綺麗[きれい]です！',
        liveStatusHk: '3776m 登頂成功！一望無際嘅雲海同日出御來光靚到極點！',
        baHodoConditionJp: '苦労[くろう]して登[のぼ]れば',
        baHodoRepeatJp: '登[のぼ]るほど',
        baHodoAdverbJp: '何倍[なんばい]も',
        baHodoResultTransitiveJp: '頂上[ちょうじょう]で最高[さいこう]の感動[かんどう]を味[あじ]わえる！',
        baHodoResultIntransitiveJp: '頂上[ちょうじょう]から見[み]える景色[けしき]が美[うつく]しくなる！',
        baHodoFullTransitiveJp: '苦労[くろう]して登[のぼ]れば登[のぼ]るほど、頂上[ちょうじょう]で最高[さいこう]の感動[かんどう]を味[あじ]わえる！',
        baHodoFullIntransitiveJp: '苦労[くろう]して登[のぼ]れば登[のぼ]るほど、頂上[ちょうじょう]から見[み]える景色[けしき]が美[うつく]しくなる！',
        baHodoTranslationHk: '越係歷盡艱辛爬上嚟，喺山頂望到嘅景色同感動就越震撼！',
        nitsureteClauseAJp: '太陽[たいよう]が雲海[うんかい]から昇[のぼ]る',
        nitsureteConnectorJp: 'につれて',
        nitsureteClauseBJp: '空全体[そらぜんたい]が黄金色[こがねいろ]に輝[かがや]いていく！',
        nitsureteFullJp: '太陽[たいよう]が雲海[うんかい]から昇[のぼ]るにつれて、空全体[そらぜんたい]が黄金色[こがねいろ]に輝[かがや]いていく！',
        nitsureteTranslationHk: '隨住太陽從雲海升起，成個天空都閃耀住黃金色光芒！',
      },
    ],
  },
];

export interface DynamicCorrelationExampleSeed {
  id: string;
  scenarioId: 'temp-heating' | 'practice-fluency' | 'altitude-oxygen';
  targetPercent: number;
  grammarPatternBadgeJp: string;
  contextTagHk: string;
  contextTagJa: string;
  sentenceJp: string;
  cleanSpokenJp: string;
  translationHk: string;
  particleFocusTipHk: string;
  emotionTone: VoiceEmotionTone;
  emotionBadgeHk: string;
}

export interface DynamicCorrelationExampleItem extends DynamicCorrelationExampleSeed {
  rank: 1 | 2 | 3;
  relevanceScorePercent: number;
  matchedValueABadge: string;
  matchedValueBBadge: string;
}

export const DYNAMIC_CORRELATION_EXAMPLE_BANK: DynamicCorrelationExampleSeed[] = [
  // Scenario 1: temp-heating (25°C -> -5°C | Heating 15% -> 100%)
  {
    id: 'th-01',
    scenarioId: 'temp-heating',
    targetPercent: 0,
    grammarPatternBadgeJp: '〜につれて',
    contextTagHk: '初秋微涼・弱檔送風',
    contextTagJa: '秋口の微弱暖房',
    sentenceJp: '朝晩[あさばん]が少[すこ]し涼[すず]しくなるにつれて、エアコンを弱[よわ]い暖房[だんぼう]に切り替[か]える家[いえ]が増[ふ]え始[はじ]める。',
    cleanSpokenJp: '朝晩が少し涼しくなるにつれて、エアコンを弱い暖房に切り替える家が増え始める。',
    translationHk: '隨住早晚變得有少少涼，將冷氣切換成弱檔暖氣嘅家庭開始增加。',
    particleFocusTipHk: '「涼しくなる（自動詞化變化）」＋「につれて」，後件配「増え始める」表初段漸變。',
    emotionTone: 'gentle',
    emotionBadgeHk: '🌸 溫柔日常',
  },
  {
    id: 'th-02',
    scenarioId: 'temp-heating',
    targetPercent: 12,
    grammarPatternBadgeJp: '〜ば〜ほど',
    contextTagHk: '晚風轉涼・預熱房間',
    contextTagJa: '夜風の冷え込み',
    sentenceJp: '秋[あき]の夜風[よかぜ]が冷[つめ]たければ冷[つめ]たいほど、少[すこ]しでも部屋[へや]を暖[あたた]かくしておきたくなる。',
    cleanSpokenJp: '秋の夜風が冷たければ冷たいほど、少しでも部屋を暖かくしておきたくなる。',
    translationHk: '秋夜嘅風越係微涼，就越想預先將間房整暖少少。',
    particleFocusTipHk: 'い形容詞「冷たい」➔「冷たければ冷たいほど」，後件用「〜ておきたくなる」表自然心理變化。',
    emotionTone: 'gentle',
    emotionBadgeHk: '🌸 柔和叮嚀',
  },
  {
    id: 'th-03',
    scenarioId: 'temp-heating',
    targetPercent: 25,
    grammarPatternBadgeJp: '〜にしたがって',
    contextTagHk: '氣溫跌破18°C・調高設定',
    contextTagJa: '気温低下と設定温度上昇',
    sentenceJp: '外[そと]の気温[きおん]が18度[ど]以下[いか]に下[さ]がるにしたがって、暖房[だんぼう]の設定温度[せっていおんど]も22度[ど]へと上[あ]がっていく。',
    cleanSpokenJp: '外の気温が18度以下に下がるにしたがって、暖房の設定温度も22度へと上がっていく。',
    translationHk: '隨住室外氣溫跌到 18 度以下，暖氣嘅設定溫度亦跟住調高去到 22 度。',
    particleFocusTipHk: '「下がる（自動詞）」同「上がっていく（自動詞漸進）」前後呼應，助詞用「が／も」。',
    emotionTone: 'neutral',
    emotionBadgeHk: '📻 標準播報',
  },
  {
    id: 'th-04',
    scenarioId: 'temp-heating',
    targetPercent: 38,
    grammarPatternBadgeJp: '〜ば〜ほど',
    contextTagHk: '深秋降溫・暖氣中段運作',
    contextTagJa: '晩秋の温度調整',
    sentenceJp: '外気[がいき]の温度[おんど]が低[ひく]くなればなるほど、リビングの暖房[だんぼう]を強[つよ]めに設定[せってい]する時間[じかん]が長[なが]くなる。',
    cleanSpokenJp: '外気の温度が低くなればなるほど、リビングの暖房を強めに設定する時間が長くなる。',
    translationHk: '室外溫度越變越低，將客廳暖氣校強嘅時間就越長。',
    particleFocusTipHk: '「低くなればなるほど」強調正比例，後件「暖房を（他動詞對象）」與「時間が（自動詞主體）」對比鮮明。',
    emotionTone: 'neutral',
    emotionBadgeHk: '📻 清晰平穩',
  },
  {
    id: 'th-05',
    scenarioId: 'temp-heating',
    targetPercent: 50,
    grammarPatternBadgeJp: '〜につれて',
    contextTagHk: '寒冬10°C・暖氣強力輸出',
    contextTagJa: '本格的な冬と暖房出力',
    sentenceJp: '12月[がつ]に入[はい]って寒[さむ]さが厳[きび]しくなるにつれて、暖房[だんぼう]の出力[しゅつりょく]がだんだん強[つよ]くなっていく。',
    cleanSpokenJp: '12月に入って寒さが厳しくなるにつれて、暖房の出力がだんだん強くなっていく。',
    translationHk: '隨住踏入 12 月寒意加劇，暖氣嘅輸出功率亦漸漸變得越嚟越強。',
    particleFocusTipHk: '副詞「だんだん（漸漸）」搭配「強くなっていく」，精準呈現中段穩定攀升嘅動態感。',
    emotionTone: 'neutral',
    emotionBadgeHk: '📻 標準強調',
  },
  {
    id: 'th-06',
    scenarioId: 'temp-heating',
    targetPercent: 62,
    grammarPatternBadgeJp: '〜ば〜ほど',
    contextTagHk: '冷鋒南下・暖氣開大',
    contextTagJa: '寒気南下と強運転',
    sentenceJp: '北風[きたかぜ]が吹[ふ]いて寒[さむ]ければ寒[さむ]いほど、ますます暖房[だんぼう]の風量[ふうりょう]を強[つよ]くしなければならない。',
    cleanSpokenJp: '北風が吹いて寒ければ寒いほど、ますます暖房の風量を強くしなければならない。',
    translationHk: '北風吹起越係寒冷，就越要進一步將暖氣風量開大。',
    particleFocusTipHk: '「寒ければ寒いほど」配程度副詞「ますます（越發）」，突顯氣溫與風量嘅強正比關係。',
    emotionTone: 'serious',
    emotionBadgeHk: '🔥 嚴肅強調',
  },
  {
    id: 'th-07',
    scenarioId: 'temp-heating',
    targetPercent: 75,
    grammarPatternBadgeJp: '〜とともに',
    contextTagHk: '逼近冰點・高功率運轉',
    contextTagJa: '氷点下接近と高出力稼働',
    sentenceJp: '夜[よる]の気温[きおん]が0度[ど]に近[ちか]づくとともに、部屋[へや]の暖房[だんぼう]もフルパワーに近[ちか]い状態[じょうたい]で稼働[かどう]し続[つづ]けている。',
    cleanSpokenJp: '夜の気温が0度に近づくとともに、部屋の暖房もフルパワーに近い状態で稼働し続けている。',
    translationHk: '喺夜晚氣溫逼近 0 度嘅同時，房入面嘅暖氣亦以接近全功率狀態持續運作。',
    particleFocusTipHk: '「近づくとともに」表兩邊同步逼近臨界點，助詞「に」標示逼近嘅目標數值（0度に）。',
    emotionTone: 'surprised',
    emotionBadgeHk: '😲 感嘆張力',
  },
  {
    id: 'th-08',
    scenarioId: 'temp-heating',
    targetPercent: 88,
    grammarPatternBadgeJp: '〜につれて',
    contextTagHk: '寒流急凍・電力消耗飆升',
    contextTagJa: '寒波襲来と電力急増',
    sentenceJp: '外[そと]が凍[こご]えるほど冷[ひ]え込[こ]むにつれて、暖房器具[だんぼうきぐ]の消費電力[しょうひでんりょく]も急激[きゅうげき]に跳[は]ね上[あ]がっていく！',
    cleanSpokenJp: '外が凍えるほど冷え込むにつれて、暖房器具の消費電力も急激に跳ね上がっていく！',
    translationHk: '隨住室外凍到結冰咁急劇降溫，暖氣設備嘅耗電量亦急劇飆升！',
    particleFocusTipHk: '複合動詞「冷え込む」對「跳ね上がっていく」，生動描繪高強度區間嘅劇烈同步變化。',
    emotionTone: 'surprised',
    emotionBadgeHk: '😲 驚嘆急促',
  },
  {
    id: 'th-09',
    scenarioId: 'temp-heating',
    targetPercent: 100,
    grammarPatternBadgeJp: '〜ば〜ほど',
    contextTagHk: '零下5度極寒・100% MAX全開',
    contextTagJa: '氷点下5度・最強モードMAX',
    sentenceJp: '氷点下[ひょうてんか]まで気温[きおん]が下[さ]がれば下[さ]がるほど、暖房[だんぼう]を100パーセントの最強[さいきょう]モードでフル稼働[かどう]させることになる！',
    cleanSpokenJp: '氷点下まで気温が下がれば下がるほど、暖房を100パーセントの最強モードでフル稼働させることになる！',
    translationHk: '氣溫越係跌落零下冰點，就越係要將暖氣開到 100% 最強模式全速運轉！',
    particleFocusTipHk: '「氷点下まで（去到零下極限）」＋「下がれば下がるほど」，對應滑桿 100% 極限狀態。',
    emotionTone: 'serious',
    emotionBadgeHk: '🔥 緊迫極限',
  },

  // Scenario 2: practice-fluency (5回 -> 100回 | Fluency 35% -> 98%)
  {
    id: 'pf-01',
    scenarioId: 'practice-fluency',
    targetPercent: 0,
    grammarPatternBadgeJp: '〜につれて',
    contextTagHk: '初段跟讀 (5回)・克服怕醜',
    contextTagJa: '初回シャドーイング・抵抗感解消',
    sentenceJp: '最初[さいしょ]の5回[かい]ほど声[こえ]に出[だ]して読[よ]むにつれて、日本語[にほんご]を話[はな]す恥[は]ずかしさがすこしずつ消[き]えていく。',
    cleanSpokenJp: '最初の5回ほど声に出して読むにつれて、日本語を話す恥ずかしさがすこしずつ消えていく。',
    translationHk: '隨住最初開口大聲讀咗 5 次左右，講日文嘅怕醜感亦一點一滴消失。',
    particleFocusTipHk: '「声に出して読む」＋「につれて」，後件用自動詞「消えていく（漸漸消失）」表心理變化。',
    emotionTone: 'gentle',
    emotionBadgeHk: '🌸 溫柔鼓勵',
  },
  {
    id: 'pf-02',
    scenarioId: 'practice-fluency',
    targetPercent: 15,
    grammarPatternBadgeJp: '〜ば〜ほど',
    contextTagHk: '起步累積 (15回)・口腔肌肉記憶',
    contextTagJa: '口の筋肉の慣れ',
    sentenceJp: 'お手本[てほん]の音声[おんせい]を真似[まね]すればするほど、口[くち]が日本語[にほんご]の拍[はく]のリズムに慣[な]れてくる。',
    cleanSpokenJp: 'お手本の音声を真似すればするほど、口が日本語の拍のリズムに慣れてくる。',
    translationHk: '越係模仿示範語音，口腔就越習慣日文嘅節拍韻律。',
    particleFocusTipHk: 'サ変動詞「真似すればするほど」，後件助詞「に」標示適應嘅對象（リズムに慣れる）。',
    emotionTone: 'gentle',
    emotionBadgeHk: '🌸 親切指導',
  },
  {
    id: 'pf-03',
    scenarioId: 'practice-fluency',
    targetPercent: 28,
    grammarPatternBadgeJp: '〜にしたがって',
    contextTagHk: '漸入佳境 (30回)・掌握高低音調',
    contextTagJa: '高低アクセントの把握',
    sentenceJp: '反復練習[はんぷくれんしゅう]が20回[かい]、30回[かい]と進[すす]むにしたがって、東京標準語[とうきょうひょうじゅんご]の高低[こうてい]アクセントが自然[しぜん]に再現[さいげん]できるようになる。',
    cleanSpokenJp: '反復練習が20回、30回と進むにしたがって、東京標準語の高低アクセントが自然に再現できるようになる。',
    translationHk: '隨住反覆練習推進到 20 次、30 次，東京標準音嘅高低音調就能夠自然重現出嚟。',
    particleFocusTipHk: '可能形「再現できる」＋「ようになる」，前面對象用助詞「が」（アクセントが再現できる）。',
    emotionTone: 'neutral',
    emotionBadgeHk: '📻 專業指導',
  },
  {
    id: 'pf-04',
    scenarioId: 'practice-fluency',
    targetPercent: 45,
    grammarPatternBadgeJp: '〜ば〜ほど',
    contextTagHk: '中段突破 (50回)・跟上NHK語速',
    contextTagJa: 'ニュース速度への追随',
    sentenceJp: '毎日[まいにち]シャドーイングを続[つづ]ければ続[つづ]けるほど、NHKニュースの速[はや]いスピードにも遅[おく]れずについていけるようになる！',
    cleanSpokenJp: '毎日シャドーイングを続ければ続けるほど、NHKニュースの速いスピードにも遅れずについていけるようになる！',
    translationHk: '每日跟讀越係堅持落去，就越能夠唔甩拍噉跟上 NHK 新聞嘅快語速！',
    particleFocusTipHk: '下一段動詞「続ければ続けるほど」，後件「スピードにも（連快語速都…）」突顯能力躍升。',
    emotionTone: 'excited',
    emotionBadgeHk: '✨ 自信元氣',
  },
  {
    id: 'pf-05',
    scenarioId: 'practice-fluency',
    targetPercent: 60,
    grammarPatternBadgeJp: '〜につれて',
    contextTagHk: '語感成型 (65回)・助詞連讀流暢',
    contextTagJa: '助詞の自然なつながり',
    sentenceJp: '練習回数[れんしゅうかいすう]が60回[かい]を超[こ]えるにつれて、助詞[じょし]と動詞[どうし]のつながりが驚くほど滑[なめ]らかになってきた！',
    cleanSpokenJp: '練習回数が60回を超えるにつれて、助詞と動詞のつながりが驚くほど滑らかになってきた！',
    translationHk: '隨住練習次數超過 60 次，助詞同動詞之間嘅連讀變得驚人咁順滑！',
    particleFocusTipHk: 'ナ形容詞「滑らか」＋「になってきた」，表現由生硬變流暢嘅持續成果。',
    emotionTone: 'excited',
    emotionBadgeHk: '✨ 雀躍進步',
  },
  {
    id: 'pf-06',
    scenarioId: 'practice-fluency',
    targetPercent: 78,
    grammarPatternBadgeJp: '〜とともに',
    contextTagHk: '脫口而出 (80回)・免翻譯直覺',
    contextTagJa: '無意識の日本語発話',
    sentenceJp: '発音[はつおん]の流暢[りゅうちょう]さが高[たか]まるとともに、頭[あたま]の中[なか]で翻訳[ほんやく]せずにそのまま日本語[にほんご]が出[で]てくるようになった！',
    cleanSpokenJp: '発音の流暢さが高まるとともに、頭の中で翻訳せずにそのまま日本語が出てくるようになった！',
    translationHk: '喺發音流暢度提升嘅同時，已經可以唔使喺腦入面翻譯就直接講出日文！',
    particleFocusTipHk: '自動詞「高まる」＋「とともに」，展現發音流暢度與直覺反應同步躍進。',
    emotionTone: 'surprised',
    emotionBadgeHk: '😲 驚喜突破',
  },
  {
    id: 'pf-07',
    scenarioId: 'practice-fluency',
    targetPercent: 100,
    grammarPatternBadgeJp: '〜ば〜ほど',
    contextTagHk: '百次完走 (100回)・母語級感情演繹',
    contextTagJa: '100回達成・ネイティブ級の表現力',
    sentenceJp: '100回[かい]まで徹底的[てっていてき]に練習[れんしゅう]を重[かさ]ねれば重[かさ]ねるほど、声優[せいゆう]のように感情[かんじょう]を込[こ]めて完璧[かんぺき]な日本語[にほんご]が話[はな]せるようになる！',
    cleanSpokenJp: '100回まで徹底的に練習を重ねれば重ねるほど、声優のように感情を込めて完璧な日本語が話せるようになる！',
    translationHk: '越係徹底累積練習去到 100 次，就越能夠好似聲優噉帶住豐富感情講出完美日文！',
    particleFocusTipHk: '「練習を重ねれば重ねるほど」配搭最高程度達成，呼應滑桿 100 回（流暢度 98%）滿級狀態！',
    emotionTone: 'excited',
    emotionBadgeHk: '✨ 熱血滿級',
  },

  // Scenario 3: altitude-oxygen (200m -> 3776m | View/Grandeur 25% -> 100%)
  {
    id: 'ao-01',
    scenarioId: 'altitude-oxygen',
    targetPercent: 0,
    grammarPatternBadgeJp: '〜につれて',
    contextTagHk: '山麓起點 (200m)・森林微風',
    contextTagJa: '登山口・爽やかな森の風',
    sentenceJp: '標高[ひょうこう]200メートルの登山道[とざんどう]を歩[ある]き始[はじ]めるにつれて、都会[とかい]の騒音[そうおん]が遠[とお]ざかり緑[みどり]の香[かお]りが濃[こ]くなっていく。',
    cleanSpokenJp: '標高200メートルの登山道を歩き始めるにつれて、都会の騒音が遠ざかり緑の香りが濃くなっていく。',
    translationHk: '隨住開始踏上お海拔 200 米嘅登山徑，都市喧囂漸漸遠去，草木清香亦越嚟越濃。',
    particleFocusTipHk: '移動經過嘅場所用「を（登山道を歩く）」，後件用「遠ざかる／濃くなっていく」描寫起點漸變。',
    emotionTone: 'gentle',
    emotionBadgeHk: '🌸 舒暢愜意',
  },
  {
    id: 'ao-02',
    scenarioId: 'altitude-oxygen',
    targetPercent: 25,
    grammarPatternBadgeJp: '〜ば〜ほど',
    contextTagHk: '半山腰 (1100m)・俯瞰街景',
    contextTagJa: '標高1100m・広がる視界',
    sentenceJp: '山[やま]の中腹[ちゅうふく]へと高[たか]く登[のぼ]れば登[のぼ]るほど、木々[きぎ]の間[あいだ]から見渡[みわた]せる街並[まちな]みがどんどん広[ひろ]がっていく。',
    cleanSpokenJp: '山の中腹へと高く登れば登るほど、木々の間から見渡せる街並みがどんどん広がっていく。',
    translationHk: '越係往半山腰高處攀登，從林木間俯瞰到嘅城市景色就越係不斷擴展。',
    particleFocusTipHk: '五段動詞「登る」➔「登れば登るほど」，配副詞「どんどん」強調視野連續擴闊。',
    emotionTone: 'neutral',
    emotionBadgeHk: '📻 開朗明快',
  },
  {
    id: 'ao-03',
    scenarioId: 'altitude-oxygen',
    targetPercent: 50,
    grammarPatternBadgeJp: '〜にしたがって',
    contextTagHk: '五合目 (2000m+)・雲海與降溫',
    contextTagJa: '五合目・雲海と気温低下',
    sentenceJp: '標高[ひょうこう]が2000メートルを超[こ]えて高[たか]くなるにしたがって、足元[あしもと]に雲海[うんかい]が広[ひろ]がり気温[きおん]も急[きゅう]に下[さ]がってくる。',
    cleanSpokenJp: '標高が2000メートルを超えて高くなるにしたがって、足元に雲海が広がり気温も急に下がってくる。',
    translationHk: '隨住海拔超過 2000 米越升越高，腳下展開一片雲海，氣溫亦隨之急速下降。',
    particleFocusTipHk: '自然科學規律（海拔升高➔氣溫下降）最常配搭較正式嘅「〜にしたがって」。',
    emotionTone: 'surprised',
    emotionBadgeHk: '😲 驚嘆壯觀',
  },
  {
    id: 'ao-04',
    scenarioId: 'altitude-oxygen',
    targetPercent: 75,
    grammarPatternBadgeJp: '〜ば〜ほど',
    contextTagHk: '八合目 (3000m)・空氣稀薄與星空',
    contextTagJa: '八合目・薄い酸素と慎重な一歩',
    sentenceJp: '標高[ひょうこう]3000メートルを超[こ]えて頂上[ちょうじょう]に近[ちか]づけば近[ちか]づくほど、酸素[さんそ]が薄[うす]くなり一歩[いっぽ]ずつ慎重[しんちょう]に歩[ある]かなければならない！',
    cleanSpokenJp: '標高3000メートルを超えて頂上に近づけば近づくほど、酸素が薄くなり一歩ずつ慎重に歩かなければならない！',
    translationHk: '超過海拔 3000 米越係接近山頂，氧氣就越稀薄，每一步都必須更加謹慎前行！',
    particleFocusTipHk: '歸著點助詞「に（頂上に近づく）」，重複「近づけば近づくほど」突顯高山環境變化。',
    emotionTone: 'serious',
    emotionBadgeHk: '🔥 嚴肅專注',
  },
  {
    id: 'ao-05',
    scenarioId: 'altitude-oxygen',
    targetPercent: 100,
    grammarPatternBadgeJp: '〜につれて',
    contextTagHk: '富士山頂 (3776m)・御來光絕景',
    contextTagJa: '山頂3776m・黄金のご来光',
    sentenceJp: '標高[ひょうこう]3776メートルの富士山頂[ふじさんちょう]で朝日[あさひ]が昇[のぼ]るにつれて、見渡[みわた]す限[かぎ]りの雲海[うんかい]が黄金色[こがねいろ]に輝[かがや]きわたっていく！',
    cleanSpokenJp: '標高3776メートルの富士山頂で朝日が昇るにつれて、見渡す限りの雲海が黄金色に輝きわたっていく！',
    translationHk: '隨住朝陽喺海拔 3776 米嘅富士山頂升起，一望無際嘅雲海頓時閃耀住璀璨嘅黃金色光芒！',
    particleFocusTipHk: '場所助詞「で（富士山頂で）」＋結果變化「に（黄金色に輝く）」，對應海拔 3776m 100% 絕景！',
    emotionTone: 'excited',
    emotionBadgeHk: '✨ 感動激昂',
  },
];

/**
 * Pure deterministic function that filters and ranks the top `limit` (default 3)
 * authentic Japanese example sentences from DYNAMIC_CORRELATION_EXAMPLE_BANK that are
 * most closely correlated with the current slider variable values.
 */
export function getTopRelevantCorrelationExamples(
  scenarioId: string,
  sliderPercent: number,
  limit: number = 3
): DynamicCorrelationExampleItem[] {
  const scenario =
    DYNAMIC_CORRELATION_SCENARIOS.find((s) => s.id === scenarioId) ||
    DYNAMIC_CORRELATION_SCENARIOS[0];

  const clampedPercent = Math.max(0, Math.min(100, Math.round(sliderPercent)));

  const candidates = DYNAMIC_CORRELATION_EXAMPLE_BANK.filter(
    (item) => item.scenarioId === scenario.id
  );
  const pool =
    candidates.length >= limit
      ? candidates
      : DYNAMIC_CORRELATION_EXAMPLE_BANK.filter((item) => item.scenarioId === 'temp-heating');

  const scored = pool
    .map((item) => {
      const distance = Math.abs(clampedPercent - item.targetPercent);
      const relevanceScorePercent = Math.max(
        60,
        Math.min(100, Math.round(100 - distance * 0.45))
      );

      // Compute the exact A & B variable values at item.targetPercent for clear visual comparison
      const itemRatio = item.targetPercent / 100;
      const itemA = Math.round(
        scenario.variableA.startValue +
          (scenario.variableA.endValue - scenario.variableA.startValue) * itemRatio
      );
      const itemB = Math.round(
        scenario.variableB.startValue +
          (scenario.variableB.endValue - scenario.variableB.startValue) * itemRatio
      );

      return {
        item,
        distance,
        relevanceScorePercent,
        matchedValueABadge: `${itemA}${scenario.variableA.unit}`,
        matchedValueBBadge: `${itemB}${scenario.variableB.unit}`,
      };
    })
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.item.targetPercent - b.item.targetPercent;
    });

  return scored.slice(0, Math.max(1, limit)).map((entry, idx) => ({
    ...entry.item,
    rank: (idx + 1) as 1 | 2 | 3,
    relevanceScorePercent: entry.relevanceScorePercent,
    matchedValueABadge: entry.matchedValueABadge,
    matchedValueBBadge: entry.matchedValueBBadge,
  }));
}

export interface DynamicCorrelationComputedState {
  scenario: DynamicCorrelationScenario;
  clampedPercent: number;
  stageIndex: 0 | 1 | 2 | 3 | 4;
  stage: DynamicCorrelationStageData;
  valueA: number;
  formattedValueA: string;
  valueB: number;
  formattedValueB: string;
  activeBaHodoSentenceJp: string;
  activeBaHodoResultJp: string;
  correlationCurvePoints: Array<{
    stageIdx: number;
    xPercent: number;
    aPercent: number;
    bPercent: number;
    isCurrent: boolean;
  }>;
  relevantExamples: DynamicCorrelationExampleItem[];
}

/**
 * Pure deterministic function that computes the real-time Variable A & Variable B values,
 * active grammar stage (0..4), corresponding 〜ば〜ほど & 〜につれて structural variants,
 * and the top 3 most relevant authentic Japanese example sentences as the user drags the slider.
 */
export function computeDynamicCorrelationState(
  scenarioId: string,
  sliderPercent: number,
  transitivityMode: 'transitive' | 'intransitive' = 'transitive'
): DynamicCorrelationComputedState {
  const scenario =
    DYNAMIC_CORRELATION_SCENARIOS.find((s) => s.id === scenarioId) ||
    DYNAMIC_CORRELATION_SCENARIOS[0];

  const clampedPercent = Math.max(0, Math.min(100, Math.round(sliderPercent)));
  const ratio = clampedPercent / 100;

  const rawA =
    scenario.variableA.startValue +
    (scenario.variableA.endValue - scenario.variableA.startValue) * ratio;
  const valueA = Math.round(rawA);
  const formattedValueA = `${valueA}${scenario.variableA.unit}`;

  const rawB =
    scenario.variableB.startValue +
    (scenario.variableB.endValue - scenario.variableB.startValue) * ratio;
  const valueB = Math.round(rawB);
  const formattedValueB = `${valueB}${scenario.variableB.unit}`;

  const stageIndex = Math.min(
    4,
    Math.max(0, Math.floor(clampedPercent / 20.01))
  ) as 0 | 1 | 2 | 3 | 4;

  const stage = scenario.stages[stageIndex];

  const activeBaHodoSentenceJp =
    transitivityMode === 'transitive'
      ? stage.baHodoFullTransitiveJp
      : stage.baHodoFullIntransitiveJp;

  const activeBaHodoResultJp =
    transitivityMode === 'transitive'
      ? stage.baHodoResultTransitiveJp
      : stage.baHodoResultIntransitiveJp;

  const correlationCurvePoints = [0, 1, 2, 3, 4].map((idx) => {
    const xPercent = idx * 25;
    const bPercent = Math.round(20 + idx * 20);
    const aPercent =
      scenario.variableA.endValue < scenario.variableA.startValue
        ? Math.round(100 - idx * 22)
        : Math.round(20 + idx * 20);
    return {
      stageIdx: idx,
      xPercent,
      aPercent,
      bPercent,
      isCurrent: idx === stageIndex,
    };
  });

  const relevantExamples = getTopRelevantCorrelationExamples(scenario.id, clampedPercent, 3);

  return {
    scenario,
    clampedPercent,
    stageIndex,
    stage,
    valueA,
    formattedValueA,
    valueB,
    formattedValueB,
    activeBaHodoSentenceJp,
    activeBaHodoResultJp,
    correlationCurvePoints,
    relevantExamples,
  };
}

// ============================================================================
// 15. Real-Time Emotional TTS Audition & Plain vs Expressive Comparison Engine
// ============================================================================

export type EmotionalSituationTagId =
  | 'angry-scolding'
  | 'gentle-advice'
  | 'pro-broadcast'
  | 'excited-praise'
  | 'urgent-warning'
  | 'dramatic-surprise';

export interface EmotionalSituationTagMeta {
  id: EmotionalSituationTagId;
  labelHk: string;
  labelJa: string;
  emoji: string;
  mappedEmotionTone: VoiceEmotionTone;
  preferredRole: 'female' | 'male' | 'narrator';
  speedRate: number;
  pitchFactor: number;
  prosodyBadgeHk: string;
  prosodyRuleHk: string;
  prosodyRuleJa: string;
  defaultSampleJp: string;
}

export const EMOTIONAL_SITUATION_TAGS: EmotionalSituationTagMeta[] = [
  {
    id: 'angry-scolding',
    labelHk: '💢 憤怒的責備',
    labelJa: '💢 怒りの叱責（強い非難・詰問）',
    emoji: '💢',
    mappedEmotionTone: 'serious',
    preferredRole: 'male',
    speedRate: 1.08,
    pitchFactor: 0.92,
    prosodyBadgeHk: '低沉重音 · 急促詰問調 (1.08x)',
    prosodyRuleHk:
      '加入責備起首語（「いい加減にしなさい！／何度言ったら分かるんだ！」），句尾轉為強烈詰問或命令語氣（「〜だろう！／〜じゃないか！」），重音下沉且語速加快。',
    prosodyRuleJa:
      '文頭に強い叱責表現を置き、文末を「〜だろう！」「〜じゃないか！」等の詰問調に変換して語気を強めます。',
    defaultSampleJp: '約束[やくそく]の時間[じかん]に遅[おく]れないでください。',
  },
  {
    id: 'gentle-advice',
    labelHk: '🌸 溫柔的勸告',
    labelJa: '🌸 優しい忠告（穏やかな助言・気遣い）',
    emoji: '🌸',
    mappedEmotionTone: 'gentle',
    preferredRole: 'female',
    speedRate: 0.91,
    pitchFactor: 1.03,
    prosodyBadgeHk: '東京柔和女聲 · 舒緩共情調 (0.91x)',
    prosodyRuleHk:
      '加入共情緩衝語（「あのね、／無理しないでね、」），將生硬命令改為柔和叮嚀（「〜ように気をつけてね／〜たほうがいいよ」），語速放慢並帶溫暖句尾。',
    prosodyRuleJa:
      'クッション言葉「あのね」や終助詞「ね・よ」を添え、相手を思いやる穏やかなテンポ（0.91倍速）で語りかけます。',
    defaultSampleJp: '約束[やくそく]の時間[じかん]に遅[おく]れないでください。',
  },
  {
    id: 'pro-broadcast',
    labelHk: '📻 專業的播報',
    labelJa: '📻 プロの報道・アナウンス（NHK公式調）',
    emoji: '📻',
    mappedEmotionTone: 'neutral',
    preferredRole: 'female',
    speedRate: 1.0,
    pitchFactor: 1.0,
    prosodyBadgeHk: 'NHK 字正腔圓 · 莊重敬語調 (1.00x)',
    prosodyRuleHk:
      '轉換為日本公共廣播／新幹線廣播級別嘅鄭重敬語（「皆様にお知らせいたします…〜くださいますようお願い申し上げます」），拍節均勻、零贅詞。',
    prosodyRuleJa:
      '公共放送・館内アナウンス水準の格調高い敬語表現に変換し、一音一音明瞭なNHK標準アクセントで読み上げます。',
    defaultSampleJp: '約束[やくそく]の時間[じかん]に遅[おく]れないでください。',
  },
  {
    id: 'excited-praise',
    labelHk: '✨ 熱情的稱讚',
    labelJa: '✨ 熱烈な称賛（大喜び・ハイテンション）',
    emoji: '✨',
    mappedEmotionTone: 'excited',
    preferredRole: 'female',
    speedRate: 1.1,
    pitchFactor: 1.08,
    prosodyBadgeHk: '動漫元氣聲優 · 高昂雀躍調 (1.10x)',
    prosodyRuleHk:
      '加入歡呼感嘆詞（「わぁ、すごい！さすがだね！」），句尾明顯上揚並搭配「〜ね！／〜よ！」，呈現動漫聲優級別嘅雀躍感。',
    prosodyRuleJa:
      '感嘆詞「わぁ、すごい！」と明るい上昇イントネーションを加え、喜びと称賛を生き生きと表現します。',
    defaultSampleJp: '日本語[にほんご]の発音[はつおん]がとても上手[じょうず]になりましたね。',
  },
  {
    id: 'dramatic-surprise',
    labelHk: '😲 戲劇性驚嘆',
    labelJa: '😲 劇的な驚き・感嘆（まさかの展開）',
    emoji: '😲',
    mappedEmotionTone: 'surprised',
    preferredRole: 'female',
    speedRate: 1.05,
    pitchFactor: 1.09,
    prosodyBadgeHk: '高頻轉折感嘆 · 戲劇張力調 (1.05x)',
    prosodyRuleHk:
      '加入驚訝起首（「えっ、うそでしょう！？まさか…」），拉大高低音調落差（Pitch Range +45%），突顯出乎意料嘅語境反差。',
    prosodyRuleJa:
      '「えっ、本当ですか！？」などの驚き表現と大きなピッチ高低差を用いて、ドラマチックな臨場感を演出します。',
    defaultSampleJp: 'こんなに難[むずか]しい試験[しけん]に一回[いっかい]で合格[ごうかく]しました。',
  },
];

export const EMOTIONAL_AUDITION_PRESET_SENTENCES: Array<{
  id: string;
  labelHk: string;
  sentenceJp: string;
  meaningHk: string;
}> = [
  {
    id: 'punctual',
    labelHk: '守時提醒（遅れないで）',
    sentenceJp: '約束[やくそく]の時間[じかん]に遅[おく]れないでください。',
    meaningHk: '請唔好遲到約定嘅時間。',
  },
  {
    id: 'study-effort',
    labelHk: '準備考試（毎日勉強する）',
    sentenceJp: '試験[しけん]に向[む]けて毎日[まいにち]しっかり勉強[べんきょう]します。',
    meaningHk: '為咗考試每日認真溫習。',
  },
  {
    id: 'weather-cold',
    labelHk: '天氣驟降（急に寒くなった）',
    sentenceJp: '今日[きょう]から急[きゅう]に気温[きおん]が下[さ]がって寒[さむ]くなりました。',
    meaningHk: '由今日開始氣溫突然急跌變得好凍。',
  },
  {
    id: 'pass-exam',
    labelHk: '一次合格（試験に合格した）',
    sentenceJp: '難[むずか]しい日本語[にほんご]の試験[しけん]に合格[ごうかく]しました。',
    meaningHk: '通過咗好難嘅日文考試。',
  },
];

export interface EmotionSpectrumAxisDimension {
  axisId: 'arousal' | 'warmth' | 'pitchRange' | 'speedPace' | 'emphasisForce' | 'formality';
  labelHk: string;
  labelJa: string;
  plainScore: number; // 0..100 baseline for plain neutral TTS
  emotionalScore: number; // 0..100 for selected emotional preset
  delta: number; // emotionalScore - plainScore
  formattedValueLabel: string;
}

export interface EmotionSpectrumProfile {
  situationId: EmotionalSituationTagId;
  situationLabelHk: string;
  situationLabelJa: string;
  dominantSpectrumBadgeHk: string;
  acousticSignatureSummaryHk: string;
  acousticSignatureSummaryJa: string;
  valenceX: number; // -100 (Stern/Critical) to +100 (Warm/Joyful)
  arousalY: number; // -100 (Calm/Soothing) to +100 (High Energy/Intense)
  voiceMetrics: {
    speedRate: number;
    pitchFactor: number;
    pitchRangePercent: number;
    pauseDurationMs: number;
    energyDbDelta: string;
  };
  dimensions: EmotionSpectrumAxisDimension[];
  spectrumWavePoints: Array<{
    moraIndex: number;
    labelJp: string;
    plainPitch: number; // 0..100
    emotionalPitch: number; // 0..100
  }>;
}

/**
 * Pure deterministic function that computes the 6-axis Emotional Spectrum Profile
 * (情緒光譜・聲線特徵值分佈) and 8-point pitch contour wave for a given emotional situation preset.
 */
export function computeEmotionSpectrumProfile(
  situationId: EmotionalSituationTagId = 'angry-scolding'
): EmotionSpectrumProfile {
  const meta =
    EMOTIONAL_SITUATION_TAGS.find((t) => t.id === situationId) ||
    EMOTIONAL_SITUATION_TAGS[0];

  // Baseline scores for Plain Standard TTS (0..100)
  const plainBaseline = {
    arousal: 40,
    warmth: 50,
    pitchRange: 35,
    speedPace: 50,
    emphasisForce: 42,
    formality: 60,
  };

  let scores = {
    arousal: 92,
    warmth: 18,
    pitchRange: 84,
    speedPace: 76,
    emphasisForce: 96,
    formality: 30,
  };
  let dominantSpectrumBadgeHk = '💢 高張力・低音重擊型聲線';
  let acousticSignatureSummaryHk =
    '低頻共振增強（Pitch 0.92x）、起首強音突刺，語速加快 +8%，詰問句尾能量集中。';
  let acousticSignatureSummaryJa =
    '低音域の共鳴を強め（0.92倍）、文頭アクセントと文末の詰問調に強いエネルギーを集中させます。';
  let valenceX = -75;
  let arousalY = 88;
  let pitchRangePercent = 84;
  let pauseDurationMs = 110;
  let energyDbDelta = '+4.8 dB';
  let waveLabels = ['文頭', '助詞', '核心詞', '重音核', '動詞', '助動詞', '終助詞', '句尾'];
  let emotionalPitches = [88, 72, 94, 60, 82, 68, 92, 96];

  switch (situationId) {
    case 'angry-scolding': {
      scores = {
        arousal: 94,
        warmth: 16,
        pitchRange: 85,
        speedPace: 78,
        emphasisForce: 96,
        formality: 28,
      };
      dominantSpectrumBadgeHk = '💢 高張力・低音重擊型聲線';
      acousticSignatureSummaryHk =
        '低頻共振增強（Pitch 0.92x）、起首「いい加減に」強音突刺，語速加快 +8%，詰問句尾能量達 96%。';
      acousticSignatureSummaryJa =
        '低音域（0.92x）と速いテンポ（1.08x）を組み合わせ、文頭と文末「〜だろう！？」に強い声圧を乗せます。';
      valenceX = -78;
      arousalY = 90;
      pitchRangePercent = 85;
      pauseDurationMs = 110;
      energyDbDelta = '+4.8 dB';
      waveLabels = ['いい', '加減', 'にし', 'なさい', '絶対', '遅れ', 'るな', 'だろう!?'];
      emotionalPitches = [90, 74, 62, 86, 95, 70, 84, 98];
      break;
    }

    case 'gentle-advice': {
      scores = {
        arousal: 32,
        warmth: 96,
        pitchRange: 64,
        speedPace: 30,
        emphasisForce: 34,
        formality: 58,
      };
      dominantSpectrumBadgeHk = '🌸 高親和・柔和舒緩型聲線';
      acousticSignatureSummaryHk =
        '溫暖高親和度（96%）、語速放慢 -9%（0.91x），句首「あのね」帶 260ms 柔和呼吸停頓與波浪尾音。';
      acousticSignatureSummaryJa =
        '親しみやすさ（96%）を最大化し、0.91倍速のゆったりしたテンポと260msの優しい間（ポーズ）を作ります。';
      valenceX = 85;
      arousalY = -52;
      pitchRangePercent = 64;
      pauseDurationMs = 260;
      energyDbDelta = '-2.2 dB';
      waveLabels = ['あのね', '相手を', '心配', 'させ', 'ちゃう', '遅れ', 'ないで', 'ね〜'];
      emotionalPitches = [68, 76, 64, 58, 70, 62, 56, 74];
      break;
    }

    case 'pro-broadcast': {
      scores = {
        arousal: 46,
        warmth: 58,
        pitchRange: 48,
        speedPace: 52,
        emphasisForce: 72,
        formality: 98,
      };
      dominantSpectrumBadgeHk = '📻 零偏差・高莊重標準廣播型';
      acousticSignatureSummaryHk =
        '敬語莊重度達 98%，嚴格遵循 NHK 東京標準高低音調（1.00x 勻速），分句間固定 300ms 清晰換氣。';
      acousticSignatureSummaryJa =
        'フォーマル度98%のNHKアナウンス基準。1.00倍速の正確な拍節と300msの明瞭なポーズを維持します。';
      valenceX = 18;
      arousalY = 10;
      pitchRangePercent = 48;
      pauseDurationMs = 300;
      energyDbDelta = '+0.5 dB (基準)';
      waveLabels = ['皆様に', 'ご案内', 'いたし', 'ます', '時刻に', '遅れぬ', 'よう', '願います'];
      emotionalPitches = [62, 78, 70, 52, 74, 66, 58, 48];
      break;
    }

    case 'excited-praise': {
      scores = {
        arousal: 92,
        warmth: 90,
        pitchRange: 92,
        speedPace: 84,
        emphasisForce: 86,
        formality: 44,
      };
      dominantSpectrumBadgeHk = '✨ 高雀躍・明亮上揚型聲線';
      acousticSignatureSummaryHk =
        '情緒張力（92%）與親和度（90%）雙高，基準音高提升 +8%（1.08x）、語速加快 +10%，句尾元氣大幅上揚！';
      acousticSignatureSummaryJa =
        '明るさと高揚感が共に90%超。ピッチ（1.08x）と速度（1.10x）を引き上げ、文末を弾むように上昇させます。';
      valenceX = 92;
      arousalY = 86;
      pitchRangePercent = 92;
      pauseDurationMs = 135;
      energyDbDelta = '+3.9 dB';
      waveLabels = ['わぁ！', 'すごい', '最高', 'ですね', '本当に', '素晴ら', 'しい', 'ですよ！'];
      emotionalPitches = [94, 88, 96, 82, 86, 92, 84, 98];
      break;
    }

    case 'dramatic-surprise':
    default: {
      scores = {
        arousal: 96,
        warmth: 60,
        pitchRange: 98,
        speedPace: 72,
        emphasisForce: 90,
        formality: 40,
      };
      dominantSpectrumBadgeHk = '😲 大落差・戲劇轉折型聲線';
      acousticSignatureSummaryHk =
        '音高起伏度高達 98%（Pitch 1.09x），句首「えっ、うそでしょう！？」呈現急升音調與戲劇性急停轉折。';
      acousticSignatureSummaryJa =
        '抑揚レンジが最大の98%。感嘆詞「えっ！？」の急激なピッチ上昇とドラマチックな緩急をつけます。';
      valenceX = 24;
      arousalY = 95;
      pitchRangePercent = 98;
      pauseDurationMs = 175;
      energyDbDelta = '+4.4 dB';
      waveLabels = ['えっ!?', 'うそで', 'しょう', 'まさか', '本当に', '信じら', 'れない', '凄い！'];
      emotionalPitches = [98, 62, 92, 54, 90, 68, 82, 96];
      break;
    }
  }

  const buildDim = (
    axisId: EmotionSpectrumAxisDimension['axisId'],
    labelHk: string,
    labelJa: string,
    plainScore: number,
    emotionalScore: number,
    suffixHk: string
  ): EmotionSpectrumAxisDimension => {
    const delta = emotionalScore - plainScore;
    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    return {
      axisId,
      labelHk,
      labelJa,
      plainScore,
      emotionalScore,
      delta,
      formattedValueLabel: `${emotionalScore}% (${sign}% · ${suffixHk})`,
    };
  };

  const dimensions: EmotionSpectrumAxisDimension[] = [
    buildDim(
      'arousal',
      '情緒激昂張力 (Arousal)',
      '感情の昂ぶり・張力',
      plainBaseline.arousal,
      scores.arousal,
      scores.arousal >= 80 ? '高張力爆發' : scores.arousal <= 40 ? '舒緩平靜' : '適中穩定'
    ),
    buildDim(
      'warmth',
      '柔和親和溫度 (Warmth)',
      '優しさ・親和性',
      plainBaseline.warmth,
      scores.warmth,
      scores.warmth >= 80 ? '極具親和共情' : scores.warmth <= 30 ? '嚴厲冷峻' : '客觀中立'
    ),
    buildDim(
      'pitchRange',
      '音高抑揚幅度 (Pitch Range)',
      'イントネーション高低幅',
      plainBaseline.pitchRange,
      scores.pitchRange,
      `Pitch ${meta.pitchFactor.toFixed(2)}x`
    ),
    buildDim(
      'speedPace',
      '語速推進節奏 (Pace)',
      '発話テンポ・推進力',
      plainBaseline.speedPace,
      scores.speedPace,
      `${meta.speedRate.toFixed(2)}x 語速`
    ),
    buildDim(
      'emphasisForce',
      '重音咬字穿透力 (Emphasis)',
      'アクセント強調・声圧',
      plainBaseline.emphasisForce,
      scores.emphasisForce,
      energyDbDelta
    ),
    buildDim(
      'formality',
      '敬語莊重格調 (Formality)',
      '格調・フォーマル度',
      plainBaseline.formality,
      scores.formality,
      scores.formality >= 85 ? '公式廣播敬語' : scores.formality <= 35 ? '直接強烈口語' : '日常禮貌體'
    ),
  ];

  const plainPitches = [52, 55, 54, 52, 50, 49, 48, 45];
  const spectrumWavePoints = waveLabels.map((labelJp, idx) => ({
    moraIndex: idx,
    labelJp,
    plainPitch: plainPitches[idx] ?? 50,
    emotionalPitch: emotionalPitches[idx] ?? 70,
  }));

  return {
    situationId,
    situationLabelHk: meta.labelHk,
    situationLabelJa: meta.labelJa,
    dominantSpectrumBadgeHk,
    acousticSignatureSummaryHk,
    acousticSignatureSummaryJa,
    valenceX,
    arousalY,
    voiceMetrics: {
      speedRate: meta.speedRate,
      pitchFactor: meta.pitchFactor,
      pitchRangePercent,
      pauseDurationMs,
      energyDbDelta,
    },
    dimensions,
    spectrumWavePoints,
  };
}

export interface EmotionalAuditionComparisonResult {
  situationId: EmotionalSituationTagId;
  situationMeta: EmotionalSituationTagMeta;
  inputSentenceJp: string;
  plainVersion: {
    textJp: string;
    cleanSpokenJp: string;
    translationHk: string;
    speedRate: number;
    pitchFactor: number;
    voiceStyleLabelHk: string;
    intonationNoteHk: string;
  };
  emotionalVersion: {
    textJp: string;
    cleanSpokenJp: string;
    translationHk: string;
    emotionTone: VoiceEmotionTone;
    preferredRole: 'female' | 'male' | 'narrator';
    speedRate: number;
    pitchFactor: number;
    voiceStyleLabelHk: string;
    intonationNoteHk: string;
  };
  comparisonDiff: {
    pitchDeltaBadge: string;
    speedDeltaBadge: string;
    addedExpressionsJp: string[];
    pronunciationDiffHk: string;
    pronunciationDiffJa: string;
  };
  emotionSpectrum: EmotionSpectrumProfile;
  generatedBy: 'local-engine' | 'ai-sensei';
}

/**
 * Pure deterministic function that transcreates a Japanese sentence into a chosen
 * emotional situation tag (e.g. 憤怒的責備, 溫柔的勸告, 專業的播報) and produces
 * structured Plain vs Emotional TTS comparison data + 6-axis Emotional Spectrum profile.
 */
export function transformSentenceForEmotionalSituation(
  rawSentenceJp: string,
  situationId: EmotionalSituationTagId = 'angry-scolding'
): EmotionalAuditionComparisonResult {
  const cleanInput =
    String(rawSentenceJp || '').trim() ||
    '約束[やくそく]の時間[じかん]に遅[おく]れないでください。';
  const strippedPlainSpoken = cleanSpokenJapaneseLine(cleanInput);
  const situationMeta =
    EMOTIONAL_SITUATION_TAGS.find((t) => t.id === situationId) ||
    EMOTIONAL_SITUATION_TAGS[0];
  const emotionSpectrum = computeEmotionSpectrumProfile(situationMeta.id);

  // Specialized curated transformations for common core patterns + general rule-based transcreation
  const isPunctual = /遅|おく|時間|じかん|約束/u.test(cleanInput);
  const isStudy = /勉強|べんきょう|練習|試験/u.test(cleanInput);
  const isWeather = /寒|さむ|気温|天気/u.test(cleanInput);

  let emotionalTextJp = '';
  let emotionalTranslationHk = '';
  let plainTranslationHk = '（標準平敘字面意思）請按字面內容執行或陳述。';
  let addedExpressionsJp: string[] = [];
  let pronunciationDiffHk = '';
  let pronunciationDiffJa = '';
  let pitchDeltaBadge = '';
  let speedDeltaBadge = '';

  if (isPunctual) {
    plainTranslationHk = '請唔好遲到約定嘅時間。（平淡無奇嘅一般陳述）';
  } else if (isStudy) {
    plainTranslationHk = '為咗考試每日認真溫習。（平鋪直敘嘅一般陳述）';
  } else if (isWeather) {
    plainTranslationHk = '由今日開始氣溫突然下降變凍。（客觀無起伏嘅陳述）';
  }

  const baseCoreNoPeriod = cleanInput.replace(/[。！!？?]+$/u, '');

  switch (situationId) {
    case 'angry-scolding': {
      pitchDeltaBadge = '重音下沉 -8% · 句尾強音突刺';
      speedDeltaBadge = '1.08x 急促緊迫（比普通版快 +8%）';
      if (isPunctual) {
        emotionalTextJp =
          'いい加減[かげん]にしなさい！何度[なんど]言[い]ったら分[わ]かるんだ！約束[やくそく]の時間[じかん]には絶対[ぜったい]に遅[おく]れるなと言[い]っただろう！？';
        emotionalTranslationHk =
          '「適可而止啦！到底要講幾多次你先明呀！唔係同你講過約定時間絕對唔准遲到㗎咩！？」';
        addedExpressionsJp = [
          'いい加減にしなさい！（責備起首）',
          '絶対〜な（強烈禁止）',
          '〜と言っただろう！？（詰問句尾）',
        ];
      } else {
        emotionalTextJp = `いい加減[かげん]にしなさい！なんでちゃんとできないんだ！${baseCoreNoPeriod}って何度[なんど]も言[い]っただろう！？`;
        emotionalTranslationHk = `「夠鐘醒未呀！點解唔好好做好佢！呢句『${strippedPlainSpoken}』我唔係講過好多次㗎咩！？」`;
        addedExpressionsJp = [
          'いい加減にしなさい！（嚴厲喝斥）',
          'なんで〜んだ！（質詢語氣）',
          '〜と言っただろう！？（句尾重音責備）',
        ];
      }
      pronunciationDiffHk =
        '【普通版 vs 憤怒責備版發音差異】普通版以平坦禮貌形「〜てください」收尾；憤怒責備版改用深沉男中音（1.08x 急促節奏），喺「いい加減に」「絶対に」落極重頭高重音，並以「〜だろう！？」急促上揚後重擊收尾！';
      pronunciationDiffJa =
        '通常版は平坦な「〜てください」ですが、叱責版は低音ボイスで「いい加減に」「絶対に」を強く際立たせ、文末「〜だろう！？」に鋭い詰問イントネーションを乗せています。';
      break;
    }

    case 'gentle-advice': {
      pitchDeltaBadge = '柔和波浪抑揚 · 句尾親切延伸';
      speedDeltaBadge = '0.91x 舒緩溫柔（比普通版慢 -9%）';
      if (isPunctual) {
        emotionalTextJp =
          'あのね、相手[あいて]を心配[しんぱい]させちゃうから、次[つぎ]からは約束[やくそく]の時間[じかん]に遅[おく]れないように気[き]をつけてね。';
        emotionalTranslationHk =
          '「聽我講吖，因為咁樣會令對方擔心㗎，下次記住盡量唔好遲到約定時間喇，好冇？」';
        addedExpressionsJp = [
          'あのね、（溫柔緩衝起首）',
          '〜ちゃうから（體貼原因說明）',
          '〜気をつけてね（親切叮嚀終助詞）',
        ];
      } else {
        emotionalTextJp = `あのね、あなたのことが大切[たいせつ]だから言[い]うんだけど、${baseCoreNoPeriod}ね。ゆっくりで大丈夫[だいじょうぶ]だよ。`;
        emotionalTranslationHk = `「聽我講吖，因為關心你先提你咋：${strippedPlainSpoken}。慢慢嚟唔使急㗎。」`;
        addedExpressionsJp = [
          'あのね、（柔和喚起）',
          '〜ね／〜だよ（溫柔共情終助詞）',
          'ゆっくりで大丈夫だよ（安心感收尾）',
        ];
      }
      pronunciationDiffHk =
        '【普通版 vs 溫柔勸告版發音差異】普通版好似機械式宣讀規則；溫柔勸告版切換為東京柔和女聲（0.91x 慢速），句首「あのね、」後留有約 250ms 呼吸停頓，句尾「〜ね」「〜よ」音調柔和拉長，消除生硬壓迫感。';
      pronunciationDiffJa =
        '通常版の事務的な響きに対し、優しい忠告版は0.91倍速のソフトな声質で、「あのね」の後に自然な間（ポーズ）を置き、文末「〜ね」を柔らかく伸ばして発音します。';
      break;
    }

    case 'pro-broadcast': {
      pitchDeltaBadge = '標準 NHK 零偏差 · 句首高音清晰';
      speedDeltaBadge = '1.00x 勻速字正腔圓（黃金廣播拍節）';
      if (isPunctual) {
        emotionalTextJp =
          '皆様[みなさま]にご案内[あんない]いたします。お約束[やくそく]の時刻[じこく]に遅[おく]れませぬよう、お早[はや]めのご準備[じゅんび]をお願い申[もう]し上[あ]げます。';
        emotionalTranslationHk =
          '「謹向各位貴賓廣播通知：為免耽誤閣下約定之時刻，敬請提早做好準備，多謝合作。」';
        addedExpressionsJp = [
          '皆様にご案内いたします（公式廣播起首）',
          'お約束の時刻（美化語・漢語詞）',
          'お願い申し上げます（最高級謙讓結尾）',
        ];
      } else {
        emotionalTextJp = `皆様[みなさま]にお知[し]らせいたします。${baseCoreNoPeriod}。ご協力[きょうりょく]のほど、よろしくお願い申[もう]し上[あ]げます。`;
        emotionalTranslationHk = `「謹向各位廣播通知：${strippedPlainSpoken}。懇請各位鼎力配合，非常感謝。」`;
        addedExpressionsJp = [
          '皆様にお知らせいたします（NHK／新幹線廣播起首）',
          'ご協力のほど（正式商務書面語）',
          'お願い申し上げます（鄭重廣播收尾）',
        ];
      }
      pronunciationDiffHk =
        '【普通版 vs 專業播報版發音差異】專業播報版採用 NHK 主播標準東京音調（Pitch Accent 零走音），將日常詞彙升級為漢語敬語（「時間 ➔ 時刻」、「遅れないで ➔ 遅れませぬよう」），每個分句之間有精準 300ms 換氣停頓，無感情偏頗但極具權威感。';
      pronunciationDiffJa =
        'プロの報道・アナウンス版では、日常語を格調高い敬語・漢語に置き換え、句読点ごとに正確なポーズを入れて一音一音クリアな標準アクセントで発話します。';
      break;
    }

    case 'excited-praise': {
      pitchDeltaBadge = '音調高昂 +8% · 句尾元氣上揚';
      speedDeltaBadge = '1.10x 輕快雀躍（比普通版快 +10%）';
      emotionalTextJp = `わぁ、すごいじゃないですか！最高[さいこう]ですね！${baseCoreNoPeriod}なんて、本当[ほんとう]に素晴[すば]らしいですよ！`;
      emotionalTranslationHk = `「哇，太厲害了吧！真係最正呀！能夠做到『${strippedPlainSpoken}』，實在太出色喇！」`;
      addedExpressionsJp = [
        'わぁ、すごい！（元氣感嘆起首）',
        '最高ですね！（高昂讚美）',
        '本当に素晴らしいですよ！（句尾上揚強音）',
      ];
      pronunciationDiffHk =
        '【普通版 vs 熱情稱讚版發音差異】熱情稱讚版使用動漫聲優高昂聲線（1.10x 輕快語速），句首「わぁ、すごい！」大幅拉高音高，句尾「〜ですね！」「〜ですよ！」帶著明亮笑意與上揚尾音。';
      pronunciationDiffJa =
        '熱烈な称賛版は、明るく弾むような声優トーン（1.10倍速）で、感嘆詞「わぁ！」のピッチを高く取り、文末を明るい上昇調で締めくくります。';
      break;
    }

    case 'dramatic-surprise':
    default: {
      pitchDeltaBadge = '高低音差擴大 +45% · 感嘆轉折';
      speedDeltaBadge = '1.05x 戲劇張力（帶驚嘆急停）';
      emotionalTextJp = `えっ、うそでしょう！？まさか本当[ほんとう]に！？${baseCoreNoPeriod}なんて、信[しん]じられないくらい凄[すご]いです！`;
      emotionalTranslationHk = `「咦，唔係啩！？唔通係真嘅！？竟然『${strippedPlainSpoken}』，簡直勁到令人難以置信呀！」`;
      addedExpressionsJp = [
        'えっ、うそでしょう！？（驚訝急升調）',
        'まさか本当に！？（反問推進）',
        '信じられないくらい！（戲劇張力收尾）',
      ];
      pronunciationDiffHk =
        '【普通版 vs 戲劇性驚嘆版發音差異】普通版平鋪直敘；戲劇性驚嘆版喺句首「えっ、うそでしょう！？」呈現極鮮明嘅急升音調與短促停頓，將情緒張力推至頂峰。';
      pronunciationDiffJa =
        '劇的な驚き版は、「えっ！？」の急激なピッチ上昇と直後の短いポーズで驚きを表現し、文全体に大きな抑揚をつけます。';
      break;
    }
  }

  return {
    situationId,
    situationMeta,
    inputSentenceJp: cleanInput,
    plainVersion: {
      textJp: cleanInput,
      cleanSpokenJp: strippedPlainSpoken,
      translationHk: plainTranslationHk,
      speedRate: 1.0,
      pitchFactor: 1.0,
      voiceStyleLabelHk: '標準平敘原音 (1.00x · 無情感修飾)',
      intonationNoteHk: '以平坦等速朗讀字面內容，不加感嘆詞、緩衝詞或情緒重音。',
    },
    emotionalVersion: {
      textJp: emotionalTextJp,
      cleanSpokenJp: cleanSpokenJapaneseLine(emotionalTextJp),
      translationHk: emotionalTranslationHk,
      emotionTone: situationMeta.mappedEmotionTone,
      preferredRole: situationMeta.preferredRole,
      speedRate: situationMeta.speedRate,
      pitchFactor: situationMeta.pitchFactor,
      voiceStyleLabelHk: `${situationMeta.labelHk}（${situationMeta.prosodyBadgeHk}）`,
      intonationNoteHk: situationMeta.prosodyRuleHk,
    },
    comparisonDiff: {
      pitchDeltaBadge,
      speedDeltaBadge,
      addedExpressionsJp,
      pronunciationDiffHk,
      pronunciationDiffJa,
    },
    emotionSpectrum,
    generatedBy: 'local-engine',
  };
}

// ============================================================================
// 16. Study Streak (學習連續打卡) Calculation & Persistence Helpers
// ============================================================================

export interface StudyStreakDayItem {
  dateStr: string;
  dayLabelHk: string;
  completed: boolean;
  isToday: boolean;
}

export interface StudyStreakSummary {
  currentStreakDays: number;
  longestStreakDays: number;
  isCheckedInToday: boolean;
  totalActiveDays: number;
  nextMilestoneDays: number;
  daysToNextMilestone: number;
  recentSevenDays: StudyStreakDayItem[];
  motivationalMessageHk: string;
  motivationalMessageJa: string;
}

function toIsoDateKey(ms: number): string {
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates an initial realistic streak seed (e.g., 5 consecutive days ending yesterday,
 * with a 12-day all-time best record) so the user immediately sees their streak history
 * and can click "今日打卡" (or study a card) to advance their streak to 6 days!
 */
export function getInitialStreakSeed(nowMs: number = Date.now()): {
  activeDates: string[];
  longestStreakDays: number;
} {
  const DAY_MS = 86_400_000;
  // Seed the past 5 consecutive days (yesterday back to 5 days ago) + today already active if desired,
  // Let's include today and past 5 days = 6 consecutive days active, with a 14-day historical best!
  const dates: string[] = [];
  for (let i = 5; i >= 1; i--) {
    dates.push(toIsoDateKey(nowMs - i * DAY_MS));
  }
  return {
    activeDates: dates,
    longestStreakDays: 12,
  };
}

/**
 * Pure deterministic function that calculates the user's current consecutive study streak,
 * all-time longest streak record, 7-day calendar strip, and next milestone.
 */
export function calculateStudyStreakSummary(
  activeDates: string[],
  recordedLongestStreak: number = 0,
  nowMs: number = Date.now()
): StudyStreakSummary {
  const DAY_MS = 86_400_000;
  const uniqueDates = Array.from(
    new Set(
      (Array.isArray(activeDates) ? activeDates : [])
        .map((d) => String(d).trim())
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    )
  ).sort();

  const dateSet = new Set(uniqueDates);
  const todayStr = toIsoDateKey(nowMs);
  const yesterdayStr = toIsoDateKey(nowMs - DAY_MS);
  const isCheckedInToday = dateSet.has(todayStr);

  // Compute current consecutive streak ending today (or yesterday if not checked in yet today)
  let currentStreakDays = 0;
  if (isCheckedInToday || dateSet.has(yesterdayStr)) {
    let cursorMs = isCheckedInToday ? nowMs : nowMs - DAY_MS;
    while (dateSet.has(toIsoDateKey(cursorMs))) {
      currentStreakDays += 1;
      cursorMs -= DAY_MS;
    }
  }

  // Also compute longest consecutive run present in uniqueDates
  let maxRunInDates = 0;
  let currentRun = 0;
  let prevTimestamp: number | null = null;
  for (const dStr of uniqueDates) {
    const [y, m, d] = dStr.split('-').map(Number);
    const ts = Date.UTC(y, m - 1, d);
    if (prevTimestamp !== null && Math.round((ts - prevTimestamp) / DAY_MS) === 1) {
      currentRun += 1;
    } else {
      currentRun = 1;
    }
    if (currentRun > maxRunInDates) {
      maxRunInDates = currentRun;
    }
    prevTimestamp = ts;
  }

  const longestStreakDays = Math.max(
    recordedLongestStreak,
    currentStreakDays,
    maxRunInDates
  );

  // Build 7-day visual strip (from 6 days ago up to today)
  const weekdayLabelsHk = ['日', '一', '二', '三', '四', '五', '六'];
  const recentSevenDays: StudyStreakDayItem[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const targetMs = nowMs - offset * DAY_MS;
    const dStr = toIsoDateKey(targetMs);
    const weekday = new Date(targetMs).getDay();
    recentSevenDays.push({
      dateStr: dStr,
      dayLabelHk: offset === 0 ? '今日' : `週${weekdayLabelsHk[weekday]}`,
      completed: dateSet.has(dStr),
      isToday: offset === 0,
    });
  }

  const milestones = [7, 14, 21, 30, 60, 100, 365];
  const nextMilestoneDays =
    milestones.find((m) => m > currentStreakDays) || currentStreakDays + 30;
  const daysToNextMilestone = Math.max(0, nextMilestoneDays - currentStreakDays);

  const motivationalMessageHk = isCheckedInToday
    ? currentStreakDays >= longestStreakDays
      ? `🔥 今日已打卡！你正刷新個人最高連續紀錄（${currentStreakDays} 日），繼續保持氣勢！`
      : `✅ 今日已打卡！已連續精修 ${currentStreakDays} 日，距離追平最高紀錄（${longestStreakDays} 日）仲差 ${longestStreakDays - currentStreakDays} 日！`
    : `⚡ 你已連續學習 ${currentStreakDays} 日！點擊「今日打卡」或完成 1 張 SRS 複習即可延續至 ${currentStreakDays + 1} 日！`;

  const motivationalMessageJa = isCheckedInToday
    ? `🔥 本日のチェックイン完了！${currentStreakDays}日連続学習中（自己ベスト：${longestStreakDays}日）！`
    : `⚡ 現在${currentStreakDays}日連続！今日チェックインして${currentStreakDays + 1}日連続に伸ばしましょう！`;

  return {
    currentStreakDays,
    longestStreakDays,
    isCheckedInToday,
    totalActiveDays: uniqueDates.length,
    nextMilestoneDays,
    daysToNextMilestone,
    recentSevenDays,
    motivationalMessageHk,
    motivationalMessageJa,
  };
}

/**
 * Records today's study check-in and returns the updated activeDates, updatedBestStreak, and summary.
 */
export function recordDailyStudyCheckIn(
  activeDates: string[],
  previousBestStreak: number = 0,
  nowMs: number = Date.now()
): {
  updatedDates: string[];
  updatedBestStreak: number;
  summary: StudyStreakSummary;
} {
  const todayStr = toIsoDateKey(nowMs);
  const nextDates = Array.from(new Set([...(activeDates || []), todayStr])).sort();
  const summary = calculateStudyStreakSummary(nextDates, previousBestStreak, nowMs);
  return {
    updatedDates: nextDates,
    updatedBestStreak: summary.longestStreakDays,
    summary,
  };
}

// ============================================================================
// Antigravity SKILL.md Parser & AI Agent Skill Injector Engine
// ============================================================================

export interface AntigravitySkillItem {
  id: string;
  name: string;
  description: string;
  instructionsMd: string;
  rawSkillMd: string;
  enabled: boolean;
  isCustom?: boolean;
  sampleTestPromptHk: string;
}

export const DEFAULT_ANTIGRAVITY_SKILLS: AntigravitySkillItem[] = [
  {
    id: 'skill-jlpt-trap-detector',
    name: 'jlpt-trap-detector',
    description:
      '專門拆解 JLPT N5–N1 考題陷阱、近義文法微細差異（如 〜わりに vs 〜にしては）及干擾項排除法。',
    instructionsMd: `# JLPT Trap Detector Skill
1. 每次回答必須包含【🎯 考官出題陷阱】區塊，指出香港考生最易揀錯嘅干擾項。
2. 用「○ 正確句 vs × 錯誤句」對比展示助詞或接續形限制。
3. 提供 1 句「3 秒考場秒殺口訣（廣東話）」。`,
    rawSkillMd: `---
name: jlpt-trap-detector
description: 專門拆解 JLPT N5–N1 考題陷阱、近義文法微細差異及干擾項排除法。
---

# JLPT Trap Detector Skill
1. 每次回答必須包含【🎯 考官出題陷阱】區塊，指出香港考生最易揀錯嘅干擾項。
2. 用「○ 正確句 vs × 錯誤句」對比展示助詞或接續形限制。
3. 提供 1 句「3 秒考場秒殺口訣（廣東話）」。`,
    enabled: true,
    isCustom: false,
    sampleTestPromptHk:
      '請用 jlpt-trap-detector 技能拆解「〜わりに」同「〜にしては」喺 JLPT 考試入面嘅陷阱同秒殺口訣！',
  },
  {
    id: 'skill-cantonese-core-image',
    name: 'cantonese-core-image-sensei',
    description:
      '將抽象日文助詞與動詞變化轉化為地道香港廣東話「腦內視覺畫面 (Core Image)」與港式生活例子。',
    instructionsMd: `# Cantonese Core Image Sensei Skill
1. 必須包含【🧠 母語者腦內畫面】區塊，用生動視覺比喻（如鏡頭拉近、箭嘴方向）解釋語感。
2. 舉例必須貼近香港或日本日常真實場景（如搭地鐵、便利店、茶餐廳／居酒屋）。
3. 主動標註廣東話直譯最容易犯嘅港式日文病句。`,
    rawSkillMd: `---
name: cantonese-core-image-sensei
description: 將抽象日文助詞與動詞變化轉化為地道香港廣東話「腦內視覺畫面 (Core Image)」與港式生活例子。
---

# Cantonese Core Image Sensei Skill
1. 必須包含【🧠 母語者腦內畫面】區塊，用生動視覺比喻（如鏡頭拉近、箭嘴方向）解釋語感。
2. 舉例必須貼近香港或日本日常真實場景（如搭地鐵、便利店、茶餐廳／居酒屋）。
3. 主動標註廣東話直譯最容易犯嘅港式日文病句。`,
    enabled: true,
    isCustom: false,
    sampleTestPromptHk:
      '請用 cantonese-core-image-sensei 技能，用廣東話腦內畫面解構「に」同「で」表示地點時嘅本質分別！',
  },
  {
    id: 'skill-keigo-business-rewriter',
    name: 'keigo-business-rewriter',
    description:
      '日本職場商務敬語（尊敬語・謙譲語・丁重語）三段轉換與社內／社外 Email 禮儀審查技能。',
    instructionsMd: `# Keigo Business Rewriter Skill
1. 將用戶輸入嘅日文句子自動轉換成 3 個層級：① タメ口（朋友常體） ② 丁寧語（一般禮貌） ③ 商務最高敬語（尊敬語／謙譲語）。
2. 標明邊個動作屬於「ウチ（自己／我方公司→用謙譲語）」、邊個屬於「ソト（客戶／上司→用尊敬語）」。`,
    rawSkillMd: `---
name: keigo-business-rewriter
description: 日本職場商務敬語（尊敬語・謙譲語・丁重語）三段轉換與社內／社外 Email 禮儀審查技能。
---

# Keigo Business Rewriter Skill
1. 將用戶輸入嘅日文句子自動轉換成 3 個層級：① タメ口（朋友常體） ② 丁寧語（一般禮貌） ③ 商務最高敬語（尊敬語／謙譲語）。
2. 標明邊個動作屬於「ウチ（自己／我方公司→用謙譲語）」、邊個屬於「ソト（客戶／上司→用尊敬語）」。`,
    enabled: false,
    isCustom: false,
    sampleTestPromptHk:
      '請用 keigo-business-rewriter 技能，將「明日、資料を持って行きます。確認してください。」轉成對重要客戶講嘅最高商務敬語！',
  },
  {
    id: 'skill-pitch-accent-clinic',
    name: 'pitch-accent-clinic',
    description:
      'NHK 東京標準語高低音調（平板型⓪・頭高型①・中高型・尾高型）與拍節（Mora）發音診斷技能。',
    instructionsMd: `# Pitch Accent Clinic Skill
1. 對回答中出現嘅核心日文詞彙標註 NHK 聲調核（如 ⓪ 平板型、① 頭高型、② 中高型）及高低折線（如 か↗き↘）。
2. 提醒助詞（が・を・に）接喺平板型 vs 尾高型後面時嘅音高落差。`,
    rawSkillMd: `---
name: pitch-accent-clinic
description: NHK 東京標準語高低音調（平板型⓪・頭高型①・中高型・尾高型）與拍節（Mora）發音診斷技能。
---

# Pitch Accent Clinic Skill
1. 對回答中出現嘅核心日文詞彙標註 NHK 聲調核（如 ⓪ 平板型、① 頭高型、② 中高型）及高低折線（如 か↗き↘）。
2. 提醒助詞（が・を・に）接喺平板型 vs 尾高型後面時嘅音高落差。`,
    enabled: false,
    isCustom: false,
    sampleTestPromptHk:
      '請用 pitch-accent-clinic 技能，分析「橋（はし）」、「箸（はし）」同「端（はし）」加埋助詞「が」之後嘅東京標準語高低音調分別！',
  },
];

/**
 * Pure parser for Antigravity `SKILL.md` files (supports YAML frontmatter `--- name: ... description: ... ---`
 * including multiline YAML block scalars `>` or `|` as well as plain markdown files).
 */
export function parseAntigravitySkillMd(
  rawSkillMd: string,
  fallbackName: string = 'custom-antigravity-skill'
): AntigravitySkillItem {
  const trimmed = String(rawSkillMd || '').trim();
  const frontmatterMatch = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  let parsedName = '';
  let parsedDescription = '';
  let bodyMd = trimmed;

  if (frontmatterMatch) {
    const yamlBlock = frontmatterMatch[1];
    bodyMd = frontmatterMatch[2].trim();

    const nameMatch = yamlBlock.match(/^name:\s*['"]?([^\r\n'"]+)['"]?/m);
    if (nameMatch?.[1]) {
      parsedName = nameMatch[1].trim();
    }

    // Check multiline YAML description (> or |) or single-line description
    const multiDescMatch = yamlBlock.match(
      /^description:\s*[>|][-+]?\r?\n((?:[ \t]+[^\r\n]+\r?\n?)+)/m
    );
    if (multiDescMatch?.[1]) {
      parsedDescription = multiDescMatch[1]
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' ');
    } else {
      const singleDescMatch = yamlBlock.match(/^description:\s*['"]?([^\r\n'"]+)['"]?/m);
      if (singleDescMatch?.[1]) {
        parsedDescription = singleDescMatch[1].trim();
      }
    }
  }

  // Fallback to first Markdown heading if YAML frontmatter had no name
  if (!parsedName) {
    const headingMatch = bodyMd.match(/^#+\s+([^\r\n]+)/m);
    if (headingMatch?.[1]) {
      parsedName = headingMatch[1]
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5\u3040-\u30ff-_]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
  }

  const finalName = parsedName || fallbackName;
  const firstParagraph = bodyMd
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .find((l) => l.length > 4);

  const finalDescription =
    parsedDescription ||
    (firstParagraph ? firstParagraph.slice(0, 90) : '自訂 Antigravity SKILL.md 專屬規則技能包');

  const finalInstructions = bodyMd || trimmed;
  const slug = finalName
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-skill';

  return {
    id: `custom-skill-${slug}-${ Math.abs(
      Array.from(finalName + finalInstructions.slice(0, 32)).reduce(
        (acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0,
        7
      )
    )}`,
    name: finalName,
    description: finalDescription,
    instructionsMd: finalInstructions,
    rawSkillMd: trimmed.startsWith('---')
      ? trimmed
      : `---\nname: ${finalName}\ndescription: ${finalDescription}\n---\n\n${finalInstructions}`,
    enabled: true,
    isCustom: true,
    sampleTestPromptHk: `請嚴格按照剛剛射入嘅「${finalName}」Antigravity Skill 規則，幫我示範講解一個 JLPT 核心日文例子！`,
  };
}

/**
 * Compiles all enabled Antigravity skills into a structured system instruction block
 * to inject directly into the AI Agent (`/api/ai/tutor`).
 */
export function compileActiveSkillsSystemPrompt(
  skills: Array<Pick<AntigravitySkillItem, 'name' | 'description' | 'instructionsMd' | 'enabled'>>
): {
  activeSkillNames: string[];
  compiledSystemBlock: string;
} {
  const active = (Array.isArray(skills) ? skills : []).filter(
    (s) => s && s.enabled && s.name && s.instructionsMd
  );
  if (active.length === 0) {
    return {
      activeSkillNames: [],
      compiledSystemBlock: '',
    };
  }

  const activeSkillNames = active.map((s) => s.name.trim());
  const sections = active.map(
    (s, idx) =>
      `### [Mounted Antigravity Skill #${idx + 1}: ${s.name.trim()}]\n- Description: ${
        s.description || ''
      }\n- Mandatory Skill Instructions:\n${s.instructionsMd.trim()}`
  );

  const compiledSystemBlock = `\n\n<antigravity_mounted_skills>\n用戶已將以下 ${active.length} 個 Antigravity Skill (SKILL.md) 射入你（AI Agent）嘅執行環境。請喺回答時嚴格遵守並執行以下每個 Skill 嘅規則與輸出格式：\n\n${sections.join(
    '\n\n'
  )}\n</antigravity_mounted_skills>`;

  return {
    activeSkillNames,
    compiledSystemBlock,
  };
}

/**
 * Converts a GitHub blob/tree/repo URL into a direct raw.githubusercontent.com URL
 * for fetching `SKILL.md` files from GitHub repositories.
 */
export function normalizeGitHubSkillUrl(inputUrl: string): {
  valid: boolean;
  rawUrl: string;
  repoSlug: string;
  errorHk?: string;
} {
  const trimmed = String(inputUrl || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      rawUrl: '',
      repoSlug: '',
      errorHk: '請輸入 GitHub SKILL.md 網址（例如 https://github.com/user/repo/blob/main/SKILL.md）。',
    };
  }

  // Already a raw.githubusercontent.com URL
  if (/^https?:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\//i.test(trimmed)) {
    const m = trimmed.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\//i);
    return {
      valid: true,
      rawUrl: trimmed,
      repoSlug: m?.[1] || 'github-repo',
    };
  }

  // Standard github.com/<owner>/<repo>/blob/<branch>/<path>
  const blobMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/(?:blob|raw)\/([^/]+)\/(.+)$/i
  );
  if (blobMatch) {
    const [, repoSlug, branch, filePath] = blobMatch;
    return {
      valid: true,
      rawUrl: `https://raw.githubusercontent.com/${repoSlug}/${branch}/${filePath}`,
      repoSlug,
    };
  }

  // Standard github.com/<owner>/<repo>/tree/<branch>/<dir> -> append /SKILL.md
  const treeMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/tree\/([^/]+)\/(.+?)\/?$/i
  );
  if (treeMatch) {
    const [, repoSlug, branch, dirPath] = treeMatch;
    const cleanPath = dirPath.endsWith('.md') ? dirPath : `${dirPath}/SKILL.md`;
    return {
      valid: true,
      rawUrl: `https://raw.githubusercontent.com/${repoSlug}/${branch}/${cleanPath}`,
      repoSlug,
    };
  }

  // Root repo URL https://github.com/<owner>/<repo> -> default to main/SKILL.md
  const repoMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+\/[^/#?]+)\/?$/i);
  if (repoMatch) {
    const repoSlug = repoMatch[1].replace(/\.git$/i, '');
    return {
      valid: true,
      rawUrl: `https://raw.githubusercontent.com/${repoSlug}/main/SKILL.md`,
      repoSlug,
    };
  }

  return {
    valid: false,
    rawUrl: '',
    repoSlug: '',
    errorHk: '請輸入有效嘅 GitHub 網址（支援 github.com/.../blob/.../SKILL.md 或 raw.githubusercontent.com）。',
  };
}

/**
 * Builds the `.agents/` directory file manifest for syncing with GitHub and opening in Antigravity IDE / Agent.
 */
export function buildAntigravityRepoBundle(
  skills: AntigravitySkillItem[]
): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [
    {
      path: '.agents/AGENTS.md',
      content: `# 言の葉道場 (Kotonoha Dojo) — Antigravity Agent Workspace\n\nMounted Skills (${skills.length}):\n${skills
        .map((s) => `- \`.agents/skills/${s.name}/SKILL.md\`: ${s.description}`)
        .join('\n')}\n`,
    },
  ];

  for (const s of skills) {
    const safeDir =
      s.name
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'custom-skill';
    files.push({
      path: `.agents/skills/${safeDir}/SKILL.md`,
      content: s.rawSkillMd,
    });
  }

  return files;
}


