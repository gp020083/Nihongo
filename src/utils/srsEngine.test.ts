import test from 'node:test';
import assert from 'node:assert/strict';
import {
  updateSrsCard,
  parseFurigana,
  evaluateQuizSession,
  getSrsPreviewLabel,
  calculateDailyProgress,
  shouldTriggerGoalCelebration,
  scoreSpeakingPractice,
  searchDictionaryEntries,
  pickListeningWarmupSentence,
  expandFuriganaToKana,
  evaluateSrsCardShadowing,
  splitJapaneseReadingIntoMorae,
  parsePitchDropNumber,
  analyzePitchAccentContour,
  buildMistakeDictationChallenge,
  evaluateMistakeDictationChallenge,
} from './srsEngine';

test('SM-2 SRS scheduling progresses intervals correctly across ratings', () => {
  const now = 1_700_000_000_000;

  // First review: Good -> 1 day
  const step1 = updateSrsCard(undefined, 'n5-v1', 'good', now);
  assert.equal(step1.intervalDays, 1);
  assert.equal(step1.repetitions, 1);
  assert.equal(step1.status, 'learning');

  // Second review: Good -> 3 days
  const step2 = updateSrsCard(step1, 'n5-v1', 'good', now);
  assert.equal(step2.intervalDays, 3);
  assert.equal(step2.repetitions, 2);
  assert.equal(step2.status, 'review');

  // Third review: Easy -> boosts easeFactor and interval
  const step3 = updateSrsCard(step2, 'n5-v1', 'easy', now);
  assert.equal(step3.intervalDays >= 9, true);
  assert.equal(step3.easeFactor > 2.5, true);

  // Lapse: Again -> resets repetitions and sets learning state
  const lapse = updateSrsCard(step3, 'n5-v1', 'again', now);
  assert.equal(lapse.intervalDays, 0);
  assert.equal(lapse.repetitions, 0);
  assert.equal(lapse.status, 'learning');
});

test('parseFurigana splits bracketed ruby readings accurately', () => {
  const segments = parseFurigana('毎日[まいにち]日本語[にほんご]を勉強[べんきょう]します。');
  assert.equal(segments.length, 5);
  assert.deepEqual(segments[0], { text: '毎日', reading: 'まいにち' });
  assert.deepEqual(segments[1], { text: '日本語', reading: 'にほんご' });
  assert.deepEqual(segments[2], { text: 'を' });
  assert.deepEqual(segments[3], { text: '勉強', reading: 'べんきょう' });
  assert.deepEqual(segments[4], { text: 'します。' });
});

test('evaluateQuizSession calculates accuracy, XP, and weak categories', () => {
  const questions = [
    { correctIndex: 1, category: 'vocab' },
    { correctIndex: 0, category: 'grammar' },
    { correctIndex: 2, category: 'grammar' },
    { correctIndex: 3, category: 'reading' },
  ];
  const answers = { 0: 1, 1: 2, 2: 0, 3: 3 }; // 2/4 correct, missed 2 grammar

  const result = evaluateQuizSession(questions, answers, 'N3');
  assert.equal(result.total, 4);
  assert.equal(result.correct, 2);
  assert.equal(result.accuracyPercent, 50);
  assert.equal(result.masteryStatus, 'ELEVATED_REVIEW');
  assert.deepEqual(result.weakCategories, ['grammar']);
});

test('getSrsPreviewLabel returns Cantonese interval labels', () => {
  assert.equal(getSrsPreviewLabel(undefined, 'again'), '10 分鐘後');
  assert.equal(getSrsPreviewLabel(undefined, 'good'), '1 日後');
  assert.equal(getSrsPreviewLabel(undefined, 'easy'), '4 日後');
});

test('calculateDailyProgress computes percentage and circular SVG stroke offset accurately', () => {
  const p1 = calculateDailyProgress(2, 10, 18);
  assert.equal(p1.completedCount, 2);
  assert.equal(p1.targetCount, 10);
  assert.equal(p1.percentage, 20);
  assert.equal(p1.isGoalMet, false);
  assert.equal(p1.strokeDashoffset < p1.circumference, true);

  const pFull = calculateDailyProgress(12, 10, 18);
  assert.equal(pFull.percentage, 100);
  assert.equal(pFull.strokeDashoffset, 0);
  assert.equal(pFull.isGoalMet, true);
});

test('shouldTriggerGoalCelebration triggers only when crossing threshold from unmet to met', () => {
  assert.equal(shouldTriggerGoalCelebration(4, 5, 5, 5), true);
  assert.equal(shouldTriggerGoalCelebration(5, 10, 5, 5), true);
  assert.equal(shouldTriggerGoalCelebration(5, 5, 6, 5), false);
  assert.equal(shouldTriggerGoalCelebration(2, 5, 4, 5), false);
});

test('scoreSpeakingPractice strips furigana brackets and evaluates shadowing accuracy', () => {
  const res = scoreSpeakingPractice(
    '朝[あさ]の空気[くうき]が爽[さわ]やかだ。',
    '朝の空気が爽やかだ'
  );
  assert.equal(res.accuracyPercent, 100);
  assert.equal(res.grade, 'EXCELLENT');
});

test('searchDictionaryEntries matches kanji, reading, romaji, and Chinese meaning', () => {
  const sample = [
    {
      id: '1',
      kanji: '爽やか',
      reading: 'さわやか',
      romaji: 'sawayaka',
      shortMeaningZh: '清爽；爽快；爽朗',
    },
    {
      id: '2',
      kanji: '約束',
      reading: 'やくそく',
      romaji: 'yakusoku',
      shortMeaningZh: '約定；承諾',
    },
  ];
  assert.equal(searchDictionaryEntries(sample, 'sawayaka').length, 1);
  assert.equal(searchDictionaryEntries(sample, '清爽').length, 1);
  assert.equal(searchDictionaryEntries(sample, 'やくそく')[0].kanji, '約束');
});

import {
  getInitialLocalDictionarySeed,
  mergeDictionaryEntries,
} from './localWordDatabase';

test('pickListeningWarmupSentence filters by JLPT level and avoids immediate repeat', () => {
  const pool = [
    {
      id: 'w-n4-1',
      level: 'N4' as const,
      textJp: '電車[でんしゃ]が遅[おく]れています。',
      meaningHk: '電車誤點緊。',
      sourceLabel: 'N4 口說例句',
    },
    {
      id: 'w-n4-2',
      level: 'N4' as const,
      textJp: '会議[かいぎ]に間[ま]に合[あ]います。',
      meaningHk: '趕得切開會。',
      sourceLabel: 'N4 核心詞彙例句',
    },
    {
      id: 'w-n3-1',
      level: 'N3' as const,
      textJp: '朝[あさ]の空気[くうき]が爽[さわ]やかだ。',
      meaningHk: '朝早嘅空氣好清爽。',
      sourceLabel: 'N3 例句',
    },
  ];

  const picked1 = pickListeningWarmupSentence(pool, 'N4', undefined, 0.1);
  assert.equal(picked1?.id, 'w-n4-1');

  // Providing previousId 'w-n4-1' should pick 'w-n4-2'
  const picked2 = pickListeningWarmupSentence(pool, 'N4', 'w-n4-1', 0.1);
  assert.equal(picked2?.id, 'w-n4-2');
});

test('mergeDictionaryEntries deduplicates by kanji::reading and merges cloud/AI entries into local seed', () => {
  const seed = getInitialLocalDictionarySeed();
  assert.equal(seed.length >= 9, true);

  const cloudIncoming = [
    {
      ...seed[0],
      shortMeaningZh: '更新後嘅釋義',
      syncSource: 'cloud-synced' as const,
    },
    {
      ...seed[0],
      id: 'cloud-new-1',
      kanji: '妥協',
      reading: 'だきょう',
      romaji: 'dakyou',
      shortMeaningZh: '妥協；讓步；折衷。',
      syncSource: 'cloud-synced' as const,
    },
  ];

  const merged = mergeDictionaryEntries(seed, cloudIncoming);
  assert.equal(merged.length, seed.length + 1);
  assert.equal(merged.some((e) => e.kanji === '妥協'), true);
});

import { calculateDetailedStudyStats } from './srsEngine';

test('calculateDetailedStudyStats computes weekly average minutes, quiz chart bars, and due review counts', () => {
  const now = 1_700_000_000_000;
  const dayMs = 86_400_000;
  const srsMap = {
    'c-1': {
      itemId: 'c-1',
      intervalDays: 1,
      easeFactor: 2.5,
      repetitions: 1,
      nextReviewAt: now + 12 * 3600 * 1000, // within 24h
      status: 'learning' as const,
    },
    'c-2': {
      itemId: 'c-2',
      intervalDays: 2,
      easeFactor: 2.5,
      repetitions: 2,
      nextReviewAt: now + 2 * dayMs, // within 3 days
      status: 'review' as const,
    },
    'c-3': {
      itemId: 'c-3',
      intervalDays: 5,
      easeFactor: 2.6,
      repetitions: 4,
      nextReviewAt: now + 5 * dayMs, // within 7 days
      status: 'mastered' as const,
    },
  };

  const stats = calculateDetailedStudyStats(srsMap, 4, 'N4', now);
  assert.equal(stats.weeklyAverageMinutesPerDay > 0, true);
  assert.equal(stats.dailyStudyMinutes.length, 7);
  assert.equal(stats.totalQuizzesCompleted, 4);
  assert.equal(stats.quizChartBars.length, 5);
  assert.equal(stats.upcomingReviews.dueNowOr24h, 1);
  assert.equal(stats.upcomingReviews.dueWithin3Days, 1);
  assert.equal(stats.upcomingReviews.dueWithin7Days, 1);
  assert.equal(stats.upcomingReviews.totalTracked, 3);
});

import {
  buildPastExamDrillQuestions,
  buildDriveDatabasePayload,
  parseDriveDatabasePayload,
} from './localWordDatabase';
import { formatBilingual } from '../data/listeningAndDictionaryData';

test('buildPastExamDrillQuestions generates 3 bilingual JLPT past exam drill items per word', () => {
  const seed = getInitialLocalDictionarySeed();
  const drills = buildPastExamDrillQuestions(seed[0]);
  assert.equal(drills.length, 3);
  assert.equal(drills[0].options.length >= 4, true);
  assert.equal(Boolean(drills[0].explanationZh && drills[0].explanationJa), true);
  assert.equal(formatBilingual('歷年真題練習', '過去問演習', 'bilingual'), '歷年真題練習 · 過去問演習');
});

test('buildDriveDatabasePayload and parseDriveDatabasePayload serialize and restore Drive DB data accurately', () => {
  const seed = getInitialLocalDictionarySeed();
  const payload = buildDriveDatabasePayload({
    dictionaryEntries: seed.slice(0, 2),
    customVocab: [{ id: 'cv-1', kanji: '桜' }],
    srsMap: { 'n5-v1': { itemId: 'n5-v1', intervalDays: 3 } },
    xp: 450,
    dailyTarget: 15,
    quizzesCompleted: 5,
    exportedAt: '2026-11-08T00:00:00.000Z',
  });
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.dictionaryEntries.length, 2);
  assert.equal(payload.xp, 450);

  const restored = parseDriveDatabasePayload(JSON.parse(JSON.stringify(payload)));
  assert.ok(restored);
  assert.equal(restored.dictionaryEntries.length, 2);
  assert.equal(restored.customVocab.length, 1);
  assert.equal(restored.dailyTarget, 15);
  assert.equal(restored.quizzesCompleted, 5);
});

import {
  getDailyTeacherPack,
  getDateSeedNumber,
  JLPT_MOCK_EXAM_BANK,
  scoreJlptMockExam,
} from '../data/dailyTeacherLessonsAndMockExamData';

test('getDailyTeacherPack returns a rich multi-skill lesson pack for each JLPT level and rotates on offset', () => {
  const seedA = getDateSeedNumber('2026-11-08');
  const packA = getDailyTeacherPack('N4', seedA);
  const packB = getDailyTeacherPack('N4', seedA + 1);
  assert.equal(packA.level, 'N4');
  assert.equal(packA.vocabList.length >= 3, true);
  assert.equal(Boolean(packA.grammarPoint.pattern), true);
  assert.notEqual(packA.id, packB.id);
});

test('scoreJlptMockExam computes 3-section 180-point JLPT score report and enforces section minimums', () => {
  const n4Questions = JLPT_MOCK_EXAM_BANK.filter((q) => q.level === 'N4');
  const allCorrectAnswers: Record<string, number> = {};
  for (const q of n4Questions) {
    allCorrectAnswers[q.id] = q.correctIndex;
  }

  const perfectReport = scoreJlptMockExam(n4Questions, allCorrectAnswers, 'N4');
  assert.equal(perfectReport.totalScaledScore, 180);
  assert.equal(perfectReport.isPassed, true);
  assert.equal(perfectReport.rankGrade, 'S');
  assert.equal(perfectReport.sections.vocab_grammar.scaledScore, 60);
  assert.equal(perfectReport.sections.reading.scaledScore, 60);
  assert.equal(perfectReport.sections.listening.scaledScore, 60);

  // Test failing a single section (e.g. 0 on listening) even if other two sections are 60 + 60 = 120 (>= 90 pass mark)
  const failListeningAnswers: Record<string, number> = { ...allCorrectAnswers };
  for (const q of n4Questions.filter((item) => item.section === 'listening')) {
    failListeningAnswers[q.id] = 3; // wrong option
  }
  const sectionFailReport = scoreJlptMockExam(n4Questions, failListeningAnswers, 'N4');
  assert.equal(sectionFailReport.totalScaledScore, 120);
  assert.equal(sectionFailReport.sections.listening.passedSection, false);
  assert.equal(sectionFailReport.passedAllSections, false);
  assert.equal(sectionFailReport.isPassed, false);
});

import {
  EXTENDED_QUIZ_ARENA_BANK,
  pickDynamicQuizQuestions,
} from '../data/dailyTeacherLessonsAndMockExamData';

test('pickDynamicQuizQuestions rotates QuizArena question batches so questions are never stuck identical', () => {
  const batch1 = pickDynamicQuizQuestions(EXTENDED_QUIZ_ARENA_BANK, 'N4', 0, 5);
  const batch2 = pickDynamicQuizQuestions(EXTENDED_QUIZ_ARENA_BANK, 'N4', 1, 5);
  assert.equal(batch1.length, 5);
  assert.equal(batch2.length, 5);
  assert.notEqual(batch1[0].id, batch2[0].id);
});

import {
  mergeMistakeRecords,
  convertMistakeToTargetedVocabAndSrs,
  analyzeMistakeWeaknessSummary,
  getInitialMistakeSeed,
} from './srsEngine';

test('mergeMistakeRecords, convertMistakeToTargetedVocabAndSrs, and analyzeMistakeWeaknessSummary handle mistake collection and SRS conversion accurately', () => {
  const seed = getInitialMistakeSeed();
  assert.equal(seed.length >= 2, true);

  // Merging a duplicate mistake increments mistakeCount
  const duplicate = {
    ...seed[0],
    mistakeCount: 1,
    timestamp: 1_700_000_999_000,
  };
  const merged = mergeMistakeRecords(seed, [duplicate]);
  assert.equal(merged.length, seed.length);
  const updatedFirst = merged.find((m) => m.questionId === seed[0].questionId);
  assert.ok(updatedFirst);
  assert.equal(updatedFirst.mistakeCount, seed[0].mistakeCount + 1);

  // Converting a mistake into a targeted SRS flashcard produces a high-priority learning card due within 6 hours
  const conversion = convertMistakeToTargetedVocabAndSrs(seed[0], 1_700_000_500_000);
  assert.equal(conversion.vocabItem.level, seed[0].level);
  assert.equal(Boolean(conversion.vocabItem.kanji), true);
  assert.equal(conversion.srsState.status, 'learning');
  assert.equal(conversion.srsState.intervalDays, 1);
  assert.equal(conversion.srsState.nextReviewAt, 1_700_000_500_000 + 6 * 60 * 60 * 1000);

  // Weakness summary calculates category breakdown and topWeakCategory
  const summary = analyzeMistakeWeaknessSummary(merged);
  assert.equal(summary.totalMistakes, merged.length);
  assert.equal(summary.unconvertedCount, merged.length);
  assert.equal(summary.byCategory.length, 4);
  assert.ok(summary.topWeakCategory);
});

import {
  upsertSrsCardNote,
  hasSrsCardNote,
} from './srsEngine';

test('upsertSrsCardNote saves text and voice notes on SRS cards and updateSrsCard preserves notes across ratings', () => {
  const now = 1_700_000_000_000;

  // 1. Add text & voice note to an unrated card
  const withNote = upsertSrsCardNote(
    undefined,
    'n4-v1',
    {
      textNote: '【助詞搭配】終電に間に合う（趕得切尾班車）',
      voiceTranscript: '語音記憶備註：間に合う係自動詞，前面用助詞に',
      voiceLang: 'zh-HK',
    },
    now
  );
  assert.equal(hasSrsCardNote(withNote), true);
  assert.equal(withNote.note?.textNote, '【助詞搭配】終電に間に合う（趕得切尾班車）');
  assert.equal(withNote.note?.voiceTranscript, '語音記憶備註：間に合う係自動詞，前面用助詞に');

  // 2. Rating the card (Good / Again) preserves the attached note
  const ratedGood = updateSrsCard(withNote, 'n4-v1', 'good', now + 1000);
  assert.equal(ratedGood.intervalDays, 1);
  assert.equal(hasSrsCardNote(ratedGood), true);
  assert.equal(ratedGood.note?.textNote, withNote.note?.textNote);

  const ratedAgain = updateSrsCard(ratedGood, 'n4-v1', 'again', now + 2000);
  assert.equal(ratedAgain.intervalDays, 0);
  assert.equal(hasSrsCardNote(ratedAgain), true);

  // 3. Clearing both text and voice note removes note property cleanly
  const cleared = upsertSrsCardNote(
    ratedAgain,
    'n4-v1',
    { textNote: '   ', voiceTranscript: '', voiceAudioDataUrl: undefined },
    now + 3000
  );
  assert.equal(hasSrsCardNote(cleared), false);
  assert.equal(cleared.note, undefined);
});

import {
  getJlptListeningSpeechRate,
  cleanSpokenJapaneseLine,
  parseDialogueIntoSpeakerTurns,
} from './srsEngine';

test('getJlptListeningSpeechRate scales listening speech speed progressively from N5 (0.78x) to N1 (1.10x)', () => {
  const n5 = getJlptListeningSpeechRate('N5');
  const n4 = getJlptListeningSpeechRate('N4');
  const n3 = getJlptListeningSpeechRate('N3');
  const n2 = getJlptListeningSpeechRate('N2');
  const n1 = getJlptListeningSpeechRate('N1');

  assert.equal(n5.rate, 0.78);
  assert.equal(n4.rate, 0.86);
  assert.equal(n3.rate, 0.94);
  assert.equal(n2.rate, 1.02);
  assert.equal(n1.rate, 1.1);
  assert.equal(n5.rate < n4.rate && n4.rate < n3.rate && n3.rate < n2.rate && n2.rate < n1.rate, true);
});

test('cleanSpokenJapaneseLine and parseDialogueIntoSpeakerTurns strip speaker labels (男：/女：) and assign distinct male/female roles', () => {
  const rawScript = [
    '男：佐藤さん、来週の企画書、もう読んだ？',
    '女：はい、読みました。でも、データの数字にいくつか間違いがあるみたいですよ。',
    '男：本当？それは大変だ。すぐに修正しないと。',
    '女：あとは、最後のページの図表も少し見にくいかもしれません。',
    '男：わかった。じゃあ、まずデータを直してから、図表も見直すことにするよ。',
  ].join('\n');

  const turns = parseDialogueIntoSpeakerTurns(rawScript);
  assert.equal(turns.length, 5);

  // Check alternating male / female roles
  assert.equal(turns[0].role, 'male');
  assert.equal(turns[1].role, 'female');
  assert.equal(turns[2].role, 'male');
  assert.equal(turns[3].role, 'female');
  assert.equal(turns[4].role, 'male');

  // Verify "男：" and "女：" are NEVER present in spokenTextJp
  for (const turn of turns) {
    assert.equal(turn.spokenTextJp.includes('男：'), false);
    assert.equal(turn.spokenTextJp.includes('女：'), false);
    assert.equal(turn.spokenTextJp.includes('男:'), false);
    assert.equal(turn.spokenTextJp.includes('女:'), false);
  }

  assert.equal(turns[0].spokenTextJp, '佐藤さん、来週の企画書、もう読んだ？');
  assert.equal(
    turns[1].spokenTextJp,
    'はい、読みました。でも、データの数字にいくつか間違いがあるみたいですよ。'
  );

  // Also test cleanSpokenJapaneseLine with furigana and speaker prefixes
  assert.equal(
    cleanSpokenJapaneseLine('女：田中さん、会議[かいぎ]の資料[しりょう]はもうコピーしましたか。'),
    '田中さん、会議の資料はもうコピーしましたか。'
  );
});

import {
  buildRandomizedMockExamPaper,
  shuffleQuestionOptions,
  generateProceduralMockQuestionBatch,
} from '../data/dailyTeacherLessonsAndMockExamData';

test('JLPT_MOCK_EXAM_BANK provides 24 diverse questions per level (120 total) with ★ sentence ordering, AB comparative reading, and multi-speaker listening', () => {
  const levels: Array<'N5' | 'N4' | 'N3' | 'N2' | 'N1'> = ['N5', 'N4', 'N3', 'N2', 'N1'];
  assert.equal(JLPT_MOCK_EXAM_BANK.length, 120);

  for (const lvl of levels) {
    const levelQs = JLPT_MOCK_EXAM_BANK.filter((q) => q.level === lvl);
    assert.equal(levelQs.length, 24, `Expected 24 mock exam questions for ${lvl}`);

    // Verify diverse question types exist for each level
    const hasStarOrdering = levelQs.some(
      (q) => q.mondaiLabel.includes('組み立て') || q.promptJp.includes('★')
    );
    const hasParagraphGrammar = levelQs.some((q) => q.mondaiLabel.includes('文章の文法'));
    const hasComparativeReading = levelQs.some((q) => q.mondaiLabel.includes('統合理解'));
    const hasInfoSearch = levelQs.some((q) => q.mondaiLabel.includes('情報検索'));

    assert.equal(hasStarOrdering, true, `${lvl} should include ★ sentence ordering questions`);
    assert.equal(hasParagraphGrammar, true, `${lvl} should include paragraph grammar questions`);
    assert.equal(hasComparativeReading, true, `${lvl} should include A/B comparative reading`);
    assert.equal(hasInfoSearch, true, `${lvl} should include information search reading`);

    const listeningQs = levelQs.filter((q) => q.section === 'listening');
    assert.equal(listeningQs.length, 7, `Expected 7 listening questions for ${lvl}`);

    for (const lq of listeningQs) {
      const turns = parseDialogueIntoSpeakerTurns(lq.audioScriptJp, lq.dialogueSpeakers);
      assert.equal(turns.length >= 2, true);
      const hasMale = turns.some((t) => t.role === 'male');
      const hasFemale = turns.some((t) => t.role === 'female');
      assert.equal(
        hasMale && hasFemale,
        true,
        `Listening question ${lq.id} should have both male and female voices`
      );
    }
  }
});

test('buildRandomizedMockExamPaper guarantees non-repeating questions across consecutive draws and permutes option indices', () => {
  // Draw #1: 12 questions for N4 with empty seenIds
  const draw1 = buildRandomizedMockExamPaper({
    pool: JLPT_MOCK_EXAM_BANK,
    level: 'N4',
    seenIds: [],
    targetCount: 12,
    seed: 101,
  });

  assert.equal(draw1.paper.length, 12);
  assert.equal(draw1.unseenCountUsed, 12);
  assert.equal(draw1.totalLevelPoolSize, 24);
  assert.equal(draw1.remainingUnseenCount, 12);
  assert.equal(draw1.cycleReset, false);

  // Draw #2: 12 questions for N4 passing draw1.nextSeenIds -> 0 overlap with Draw #1!
  const draw2 = buildRandomizedMockExamPaper({
    pool: JLPT_MOCK_EXAM_BANK,
    level: 'N4',
    seenIds: draw1.nextSeenIds,
    targetCount: 12,
    seed: 202,
  });

  assert.equal(draw2.paper.length, 12);
  assert.equal(draw2.unseenCountUsed, 12);
  assert.equal(draw2.remainingUnseenCount, 0);
  assert.equal(draw2.cycleReset, false);

  const draw1Ids = new Set(draw1.paper.map((q) => q.id));
  const overlap = draw2.paper.filter((q) => draw1Ids.has(q.id));
  assert.equal(overlap.length, 0, 'Consecutive 12-question draws from 24-question pool must have 0 overlap');

  // Verify correct answer indices are distributed across multiple option positions (not all 0)
  const distinctCorrectIndices = new Set(draw1.paper.map((q) => q.correctIndex));
  assert.equal(distinctCorrectIndices.size >= 2, true);
});

test('shuffleQuestionOptions permutes options deterministically while preserving the exact correct answer string', () => {
  const sampleQuestion = JLPT_MOCK_EXAM_BANK[0];
  const originalCorrectText = sampleQuestion.options[sampleQuestion.correctIndex];

  for (let seed = 1; seed <= 10; seed++) {
    const shuffled = shuffleQuestionOptions(sampleQuestion, seed);
    assert.equal(shuffled.options.length, 4);
    assert.equal(shuffled.options[shuffled.correctIndex], originalCorrectText);
  }
});

test('generateProceduralMockQuestionBatch synthesizes fresh questions and excludes existing prompts', () => {
  const batch = generateProceduralMockQuestionBatch('N3', 'all', 999, []);
  assert.equal(batch.length, 3);

  // Passing the first prompt in existingPrompts filters it out so it is never repeated
  const filteredBatch = generateProceduralMockQuestionBatch('N3', 'all', 999, [
    batch[0].promptJp,
  ]);
  assert.equal(filteredBatch.length, 2);
  assert.equal(
    filteredBatch.some((q) => q.promptJp === batch[0].promptJp),
    false
  );
});

test('expandFuriganaToKana replaces kanji segments with their bracketed readings while preserving okurigana', () => {
  const furigana = '私[わたし]は毎朝[まいあさ]六時[ろくじ]に起[お]きます。';
  assert.equal(expandFuriganaToKana(furigana), 'わたしはまいあさろくじにおきます');
});

test('evaluateSrsCardShadowing evaluates exact kanji, pure hiragana, partial match, and AI overrides accurately', () => {
  const baseInput = {
    targetSentenceJp: '私[わたし]は毎朝[まいあさ]六時[ろくじ]に起[お]きます。',
    targetKanji: '起きる',
    targetReading: 'おきる',
    pitchAccent: '② [お＼きる] (中高型)',
  };

  // 1. Exact kanji transcript -> S grade (100)
  const kanjiEval = evaluateSrsCardShadowing({
    ...baseInput,
    spokenTranscriptJp: '私は毎朝六時に起きます。',
  });
  assert.equal(kanjiEval.grade, 'S');
  assert.equal(kanjiEval.overallScore >= 92, true);
  assert.equal(kanjiEval.targetWordHit, true);
  assert.equal(kanjiEval.charDiffs.every((d) => d.status === 'matched'), true);

  // 2. Pure hiragana transcript from SpeechRecognition -> also S grade
  const kanaEval = evaluateSrsCardShadowing({
    ...baseInput,
    spokenTranscriptJp: 'わたしはまいあさろくじにおきます',
  });
  assert.equal(kanaEval.grade, 'S');
  assert.equal(kanaEval.overallScore >= 92, true);
  assert.equal(kanaEval.targetWordHit, true);
  assert.equal(kanaEval.charDiffs.every((d) => d.status === 'matched'), true);

  // 3. Partial transcript missing characters -> detects missing tokens
  const partialEval = evaluateSrsCardShadowing({
    ...baseInput,
    spokenTranscriptJp: '私は毎朝起きます',
  });
  assert.equal(partialEval.overallScore < 92 && partialEval.overallScore >= 50, true);
  assert.equal(partialEval.charDiffs.some((d) => d.status === 'missing'), true);

  // 4. AI override merges custom scores and coach feedback
  const aiOverrideEval = evaluateSrsCardShadowing({
    ...baseInput,
    spokenTranscriptJp: '私は毎朝六時に起きます。',
    aiOverride: {
      overallScore: 95,
      pronunciationScore: 96,
      fluencyScore: 94,
      pitchAccentScore: 95,
      coachAdviceHk: 'AI 實測：發音與語調極為自然！',
      coachAdviceJa: 'AI判定：発音とイントネーションが非常に自然です！',
      evaluatedBy: 'ai-sensei',
    },
  });
  assert.equal(aiOverrideEval.overallScore, 95);
  assert.equal(aiOverrideEval.evaluatedBy, 'ai-sensei');
  assert.equal(aiOverrideEval.coachAdviceHk, 'AI 實測：發音與語調極為自然！');
});

test('splitJapaneseReadingIntoMorae splits yoon combinations, geminates, and nasal morae accurately', () => {
  assert.deepEqual(splitJapaneseReadingIntoMorae('まにあう'), ['ま', 'に', 'あ', 'う']);
  assert.deepEqual(splitJapaneseReadingIntoMorae('べんきょう'), ['べ', 'ん', 'きょ', 'う']);
  assert.deepEqual(splitJapaneseReadingIntoMorae('きっぷ'), ['き', 'っ', 'ぷ']);
  assert.deepEqual(splitJapaneseReadingIntoMorae('りゅうがく'), ['りゅ', 'う', 'が', 'く']);
});

test('parsePitchDropNumber and analyzePitchAccentContour compute Heiban, Atamadaka, Nakadaka, and Odaka pitch curves accurately', () => {
  assert.equal(parsePitchDropNumber('[0] 平板型'), 0);
  assert.equal(parsePitchDropNumber('②'), 2);
  assert.equal(parsePitchDropNumber('[3] 中高型'), 3);

  // 1. Heiban [0]: 遠慮する (えんりょする) -> L H H H H + particle が(H)
  const heiban = analyzePitchAccentContour({
    kanji: '遠慮する',
    reading: 'えんりょする',
    pitchAccent: '[0] 平板型',
  });
  assert.equal(heiban.patternType, 'heiban');
  assert.equal(heiban.moraCount, 5); // え・ん・りょ・す・る
  assert.deepEqual(
    heiban.moraNodes.map((n) => n.pitch),
    ['L', 'H', 'H', 'H', 'H', 'H']
  );
  assert.equal(heiban.moraNodes.some((n) => n.isAccentNucleus), false);

  // 2. Nakadaka [3]: 間に合う (まにあう) -> L H H(nucleus) L + particle が(L)
  const nakadaka = analyzePitchAccentContour({
    kanji: '間に合う',
    reading: 'まにあう',
    pitchAccent: '[3] 中高型',
  });
  assert.equal(nakadaka.patternType, 'nakadaka');
  assert.equal(nakadaka.dropIndex, 3);
  assert.deepEqual(
    nakadaka.moraNodes.map((n) => n.pitch),
    ['L', 'H', 'H', 'L', 'L']
  );
  assert.equal(nakadaka.moraNodes[2].mora, 'あ');
  assert.equal(nakadaka.moraNodes[2].isAccentNucleus, true);

  // 3. Atamadaka [1]: 契機 (けいき) -> H(nucleus) L L + particle が(L)
  const atamadaka = analyzePitchAccentContour({
    kanji: '契機',
    reading: 'けいき',
    pitchAccent: '①',
  });
  assert.equal(atamadaka.patternType, 'atamadaka');
  assert.deepEqual(
    atamadaka.moraNodes.map((n) => n.pitch),
    ['H', 'L', 'L', 'L']
  );
  assert.equal(atamadaka.moraNodes[0].isAccentNucleus, true);

  // 4. Odaka [2]: 山 (やま) -> L H(nucleus) + particle が(L)
  const odaka = analyzePitchAccentContour({
    kanji: '山',
    reading: 'やま',
    pitchAccent: '②',
  });
  assert.equal(odaka.patternType, 'odaka');
  assert.deepEqual(
    odaka.moraNodes.map((n) => n.pitch),
    ['L', 'H', 'L']
  );
  assert.equal(odaka.moraNodes[1].isAccentNucleus, true);
});

test('buildMistakeDictationChallenge and evaluateMistakeDictationChallenge generate and score mistake listening drills', () => {
  const challenge = buildMistakeDictationChallenge({
    id: 'mistake-test-1',
    questionId: 'q-test-1',
    source: 'quiz-arena',
    level: 'N4',
    category: 'grammar',
    questionPrompt: '「来週[らいしゅう]の火曜日[かようび]までに、この書類[しょるい]を（　　）ください。」',
    userChosenOption: '提出[ていしゅつ]した',
    correctAnswer: '提出[ていしゅつ]して',
    explanation: '「〜てください」表示請求對方做某事，接在動詞て形後面。',
    timestamp: 1_700_000_000_000,
    mistakeCount: 2,
    convertedToSrs: false,
  });

  assert.equal(
    challenge.cleanSpokenSentenceJp,
    '来週の火曜日までに、この書類を提出してください。'
  );
  assert.equal(challenge.targetFocusJp, '提出して');
  assert.equal(challenge.targetFocusReading, 'ていしゅつして');
  assert.equal(challenge.speedPresets.slowRate, 0.7);
  assert.equal(challenge.speedPresets.calibratedRate, 0.86);
  assert.equal(challenge.speedPresets.nativeRate, 1.0);
  assert.ok(challenge.tokenBank.length >= 2);
  assert.ok(challenge.tokenBank.includes('提出して'));

  // 1. Exact Kanji transcript match -> 100% and focusPointHit = true
  const exactEval = evaluateMistakeDictationChallenge({
    challenge,
    userDictationText: '来週の火曜日までに、この書類を提出してください。',
  });
  assert.equal(exactEval.accuracyScore, 100);
  assert.equal(exactEval.grade, 'PERFECT');
  assert.equal(exactEval.focusPointHit, true);

  // 2. Pure Hiragana transcript match -> 100% and focusPointHit = true
  const kanaEval = evaluateMistakeDictationChallenge({
    challenge,
    userDictationText: 'らいしゅうのかようびまでに、このしょるいをていしゅつしてください。',
  });
  assert.equal(kanaEval.accuracyScore, 100);
  assert.equal(kanaEval.grade, 'PERFECT');
  assert.equal(kanaEval.focusPointHit, true);

  // 3. Partial transcript missing the focus grammar point -> focusPointHit = false
  const partialEval = evaluateMistakeDictationChallenge({
    challenge,
    userDictationText: '来週の火曜日までに、この書類を提出したください。',
  });
  assert.equal(partialEval.focusPointHit, false);
  assert.ok(partialEval.accuracyScore < 100 && partialEval.accuracyScore >= 60);
  assert.ok(partialEval.charDiffs.some((d) => d.status === 'missing'));
});

import { GRAMMAR_DATABASE, getGrammarNuanceJa } from '../data/jlptCurriculum';

test('getDailyTeacherPack and getGrammarNuanceJa provide 6 vocab words, 2 grammar points with Japanese nuanceJa explanations, 4 dialogue lines, and 3 quizzes', () => {
  const levels: Array<'N5' | 'N4' | 'N3' | 'N2' | 'N1'> = ['N5', 'N4', 'N3', 'N2', 'N1'];

  for (const lvl of levels) {
    const pack = getDailyTeacherPack(lvl, 0);
    assert.equal(pack.vocabList.length, 6, `Expected 6 vocab items in daily pack for ${lvl}`);
    assert.ok(pack.secondaryGrammarPoint, `Expected secondaryGrammarPoint in daily pack for ${lvl}`);
    assert.ok(
      pack.grammarPoint.nuanceJa && pack.grammarPoint.nuanceJa.length > 10,
      `Expected Japanese nuance explanation (nuanceJa) on primary grammar point for ${lvl}`
    );
    assert.ok(
      pack.secondaryGrammarPoint?.nuanceJa && pack.secondaryGrammarPoint.nuanceJa.length > 10,
      `Expected Japanese nuance explanation (nuanceJa) on secondary grammar point for ${lvl}`
    );
    assert.equal(
      pack.listeningDialogue.lines.length,
      4,
      `Expected 4 dialogue lines in daily pack for ${lvl}`
    );
    assert.ok(
      pack.listeningDialogue.secondSpeakingDrillJp,
      `Expected secondSpeakingDrillJp in daily pack for ${lvl}`
    );
    assert.equal(
      1 + (pack.extraQuizzes?.length || 0),
      3,
      `Expected 3 total mini-quizzes in daily pack for ${lvl}`
    );
  }

  // Specifically verify N3 〜につれて / 〜にしたがって has explicit Japanese explanation for progressive change
  const n3Pack = getDailyTeacherPack('N3', 0);
  assert.ok(n3Pack.grammarPoint.pattern.includes('につれて'));
  assert.ok(
    getGrammarNuanceJa(n3Pack.grammarPoint).includes('変化'),
    'Expected N3 〜につれて nuanceJa to explain progressive change in Japanese'
  );

  // Verify all GRAMMAR_DATABASE items have non-empty Japanese explanations
  for (const g of GRAMMAR_DATABASE) {
    const ja = getGrammarNuanceJa(g);
    assert.ok(ja.length > 15, `Expected non-empty nuanceJa for ${g.id}`);
  }
});

import {
  ALLOWED_OWNER_EMAIL,
  verifyOwnerGoogleAccount,
  analyzeDynamicChangeSceneLocal,
  TRANSITIVITY_PAIR_CATALOG,
  KANJI_FALSE_FRIENDS_CATALOG,
} from './srsEngine';

test('verifyOwnerGoogleAccount strictly allows only bentktk2024@gmail.com and rejects all other accounts', () => {
  assert.equal(ALLOWED_OWNER_EMAIL, 'bentktk2024@gmail.com');

  // 1. Exact owner email -> allowed
  const okExact = verifyOwnerGoogleAccount('bentktk2024@gmail.com');
  assert.equal(okExact.allowed, true);
  assert.equal(okExact.normalizedEmail, 'bentktk2024@gmail.com');

  // 2. Case-insensitive and whitespace-trimmed owner email -> allowed
  const okUpper = verifyOwnerGoogleAccount('  BENTKTK2024@GMAIL.COM  ');
  assert.equal(okUpper.allowed, true);
  assert.equal(okUpper.normalizedEmail, 'bentktk2024@gmail.com');

  // 3. Any other Google account -> rejected
  const deniedOther = verifyOwnerGoogleAccount('other.user@gmail.com');
  assert.equal(deniedOther.allowed, false);
  assert.ok(deniedOther.reasonHk.includes('bentktk2024@gmail.com'));

  // 4. Empty or null email -> rejected
  assert.equal(verifyOwnerGoogleAccount('').allowed, false);
  assert.equal(verifyOwnerGoogleAccount(null).allowed, false);
});

test('analyzeDynamicChangeSceneLocal generates 4 comparative dynamic grammar structures and particle breakdowns for weather/heating and custom scenes', () => {
  // 1. Preset weather/heating scene ("隨著天氣轉冷，暖氣開得越強")
  const weatherResult = analyzeDynamicChangeSceneLocal('隨著天氣轉冷，暖氣開得越強', 'N3');
  assert.equal(weatherResult.generatedExamples.length, 4);
  assert.deepEqual(
    weatherResult.generatedExamples.map((e) => e.patternId),
    ['nitsurete', 'nishitagatte', 'ba_hodo', 'tomoni']
  );
  assert.ok(weatherResult.wrongUsageTrap.wrongSentenceJp.startsWith('×'));
  assert.ok(weatherResult.wrongUsageTrap.correctSentenceJp.startsWith('○'));

  for (const ex of weatherResult.generatedExamples) {
    assert.ok(ex.clauseA.textJp.length > 3, `Expected Clause A on ${ex.patternId}`);
    assert.ok(ex.connectorGrammar.formJp.length > 1, `Expected Connector on ${ex.patternId}`);
    assert.ok(ex.clauseB.textJp.length > 3, `Expected Clause B on ${ex.patternId}`);
    assert.ok(ex.clauseB.constraintNoteJa.length > 5, `Expected Japanese constraint note on ${ex.patternId}`);
    assert.ok(ex.particleHighlights.length >= 1, `Expected particle highlights on ${ex.patternId}`);
  }

  // Verify transitivity contrast between 自動詞 (が) and 他動詞 (を) in weather examples
  const allParticles = weatherResult.generatedExamples.flatMap((e) =>
    e.particleHighlights.map((p) => p.particleJp)
  );
  assert.ok(allParticles.includes('が'), 'Expected 自動詞 particle が highlight');
  assert.ok(allParticles.includes('を'), 'Expected 他動詞 particle を highlight');

  // 2. Arbitrary custom scene ("隨著練習次數增加，發音變得越自然")
  const customResult = analyzeDynamicChangeSceneLocal('隨著練習次數增加，發音變得越自然', 'N3');
  assert.equal(customResult.generatedExamples.length, 4);
  assert.ok(customResult.clauseALabelHk.includes('練習次數增加'));
  assert.ok(customResult.clauseBLabelHk.includes('發音變得越自然'));
});

test('TRANSITIVITY_PAIR_CATALOG and KANJI_FALSE_FRIENDS_CATALOG provide Sigure-style pedagogical pairs and false-friend warnings', () => {
  assert.equal(TRANSITIVITY_PAIR_CATALOG.length, 5);
  for (const pair of TRANSITIVITY_PAIR_CATALOG) {
    assert.ok(pair.intransitiveJp.length > 0);
    assert.ok(pair.transitiveJp.length > 0);
    assert.ok(pair.intransitiveExampleJp.includes('が'));
    assert.ok(pair.transitiveExampleJp.includes('を'));
  }

  assert.equal(KANJI_FALSE_FRIENDS_CATALOG.length, 6);
  assert.ok(KANJI_FALSE_FRIENDS_CATALOG.some((k) => k.kanji === '手紙'));
  assert.ok(KANJI_FALSE_FRIENDS_CATALOG.some((k) => k.kanji === '勉強'));
});

import {
  DEFAULT_MISTAKE_KNOWLEDGE_TAGS,
  inferDefaultMistakeTags,
  toggleMistakeCustomTag,
  addCustomTagToMistake,
  summarizeKnowledgeBaseTags,
  filterMistakesByKnowledgeTag,
  generateWeeklyMistakeReport,
} from './srsEngine';

test('Mistake Knowledge Base helpers infer, toggle, add, summarize, and filter custom mistake tags accurately', () => {
  const seed = getInitialMistakeSeed();
  assert.equal(seed.length, 3);
  assert.equal(DEFAULT_MISTAKE_KNOWLEDGE_TAGS.length >= 6, true);

  // 1. Default tags on seed records include 助詞疑難 and 漢字盲點
  const firstTags = inferDefaultMistakeTags(seed[0]);
  assert.ok(firstTags.includes('助詞疑難'));
  assert.ok(firstTags.includes('自動詞vs他動詞'));

  // 2. Toggle removes an existing tag and re-adds it when toggled again
  const removed = toggleMistakeCustomTag(seed[0], '助詞疑難');
  assert.equal(removed.customTags?.includes('助詞疑難'), false);
  const reAdded = toggleMistakeCustomTag(removed, '助詞疑難');
  assert.equal(reAdded.customTags?.includes('助詞疑難'), true);

  // 3. Adding a custom user tag (e.g. "副詞呼應盲點") appends without duplicates
  const withCustom = addCustomTagToMistake(seed[0], '#副詞呼應盲點');
  assert.equal(withCustom.customTags?.includes('副詞呼應盲點'), true);
  const duplicateAdd = addCustomTagToMistake(withCustom, '副詞呼應盲點');
  assert.equal(
    duplicateAdd.customTags?.filter((t) => t === '副詞呼應盲點').length,
    1
  );

  // 4. Filtering by tag and search query
  const updatedList = [withCustom, seed[1], seed[2]];
  const particleFiltered = filterMistakesByKnowledgeTag(updatedList, '助詞疑難');
  assert.equal(particleFiltered.length, 2);

  const kanjiFiltered = filterMistakesByKnowledgeTag(updatedList, '漢字盲點');
  assert.equal(kanjiFiltered.length, 1);
  assert.equal(kanjiFiltered[0].id, 'seed-mistake-n3-3');

  const customTagFiltered = filterMistakesByKnowledgeTag(updatedList, '副詞呼應盲點');
  assert.equal(customTagFiltered.length, 1);
  assert.equal(customTagFiltered[0].id, 'seed-mistake-n4-1');

  // 5. Tag summary includes both preset tags and extra user-created tags
  const tagSummary = summarizeKnowledgeBaseTags(updatedList, ['自訂N2條件句']);
  assert.ok(tagSummary.some((t) => t.tag === '助詞疑難' && t.count === 2));
  assert.ok(tagSummary.some((t) => t.tag === '漢字盲點' && t.count === 1));
  assert.ok(tagSummary.some((t) => t.tag === '自訂N2條件句' && t.count === 0));
});

test('generateWeeklyMistakeReport summarizes the past 7 days and ranks the Top 3 most frequently mistaken grammar points', () => {
  const seed = getInitialMistakeSeed();
  const now = Date.now();
  const report = generateWeeklyMistakeReport(seed, now, ['助詞疑難', '漢字盲點']);

  assert.ok(report.weekRangeLabel.includes('～'));
  assert.equal(report.totalWeeklyMistakeCards, 3);
  assert.equal(report.totalWeeklyErrorHits, 6); // 3 + 2 + 1
  assert.equal(report.topThreeGrammarPoints.length, 3);

  // Ranked #1 -> #2 -> #3 by mistakeCount descending
  assert.equal(report.topThreeGrammarPoints[0].rank, 1);
  assert.equal(report.topThreeGrammarPoints[1].rank, 2);
  assert.equal(report.topThreeGrammarPoints[2].rank, 3);
  assert.ok(
    report.topThreeGrammarPoints[0].mistakeCount >=
      report.topThreeGrammarPoints[1].mistakeCount
  );
  assert.ok(
    report.topThreeGrammarPoints[1].mistakeCount >=
      report.topThreeGrammarPoints[2].mistakeCount
  );
  assert.ok(report.topThreeGrammarPoints[0].grammarPointTitle.includes('自動詞'));
  assert.ok(report.topThreeGrammarPoints[1].grammarPointTitle.includes('そうです'));
  assert.ok(report.topThreeGrammarPoints[2].grammarPointTitle.includes('わりに'));
});

import {
  VOICE_EMOTION_PRESETS,
  shapeJapaneseProsodyForEmotion,
  DYNAMIC_CORRELATION_SCENARIOS,
  computeDynamicCorrelationState,
} from './srsEngine';

test('shapeJapaneseProsodyForEmotion shapes Japanese sentences with emotional interjections, pitch, and cadence factors', () => {
  assert.equal(VOICE_EMOTION_PRESETS.length, 5);

  const baseSentence = '外が寒ければ寒いほど、暖房を強くします。';
  const neutral = shapeJapaneseProsodyForEmotion(baseSentence, 'neutral', false);
  assert.equal(neutral.shapedTextJp, baseSentence);
  assert.equal(neutral.speedFactor, 1.0);

  const excitedWithCue = shapeJapaneseProsodyForEmotion(baseSentence, 'excited', true);
  assert.ok(excitedWithCue.shapedTextJp.startsWith('わぁ、すごい！'));
  assert.ok(excitedWithCue.shapedTextJp.endsWith('！'));
  assert.ok(excitedWithCue.speedFactor > 1.0);
  assert.ok(excitedWithCue.pitchFactor > 1.0);
  assert.equal(excitedWithCue.preferredNeuralVoiceCode, 'jp_003');

  const gentleWithCue = shapeJapaneseProsodyForEmotion(baseSentence, 'gentle', true);
  assert.ok(gentleWithCue.shapedTextJp.startsWith('あのね、'));
  assert.ok(gentleWithCue.speedFactor < 1.0);
  assert.equal(gentleWithCue.preferredNeuralVoiceCode, 'jp_005');

  const surprisedWithCue = shapeJapaneseProsodyForEmotion(baseSentence, 'surprised', true);
  assert.ok(surprisedWithCue.shapedTextJp.startsWith('えっ、ほんとうに！？'));

  const seriousWithCue = shapeJapaneseProsodyForEmotion(baseSentence, 'serious', true);
  assert.ok(seriousWithCue.shapedTextJp.startsWith('いいですか、'));
  assert.ok(seriousWithCue.pitchFactor < 1.0);
  assert.equal(seriousWithCue.preferredNeuralVoiceCode, 'jp_006');
});

test('computeDynamicCorrelationState interpolates Variable A and Variable B across slider 0%-100% and switches transitive/intransitive 〜ば〜ほど and 〜につれて variants', () => {
  assert.equal(DYNAMIC_CORRELATION_SCENARIOS.length, 3);

  // Stage 0 (0%): Warm 25°C -> Heating 15%
  const stage0 = computeDynamicCorrelationState('temp-heating', 0, 'transitive');
  assert.equal(stage0.stageIndex, 0);
  assert.equal(stage0.formattedValueA, '25°C');
  assert.equal(stage0.formattedValueB, '15%');
  assert.ok(stage0.activeBaHodoSentenceJp.includes('涼'));
  assert.ok(stage0.stage.nitsureteFullJp.includes('につれて'));

  // Stage 2 (50%): Chilly 10°C -> Heating 58%
  const stage2 = computeDynamicCorrelationState('temp-heating', 50, 'transitive');
  assert.equal(stage2.stageIndex, 2);
  assert.equal(stage2.formattedValueA, '10°C');
  assert.equal(stage2.formattedValueB, '58%');
  assert.ok(stage2.activeBaHodoSentenceJp.includes('寒'));
  assert.ok(stage2.activeBaHodoSentenceJp.includes('を')); // transitive uses を

  // Switch to intransitive mode (自動詞 が) at 100% (-5°C -> Heating 100%)
  const stage4Intransitive = computeDynamicCorrelationState('temp-heating', 100, 'intransitive');
  assert.equal(stage4Intransitive.stageIndex, 4);
  assert.equal(stage4Intransitive.formattedValueA, '-5°C');
  assert.equal(stage4Intransitive.formattedValueB, '100%');
  assert.ok(stage4Intransitive.activeBaHodoSentenceJp.includes('が'));
  assert.equal(stage4Intransitive.stage.emotionTone, 'serious');
});

import {
  EMOTIONAL_SITUATION_TAGS,
  transformSentenceForEmotionalSituation,
  getInitialStreakSeed,
  calculateStudyStreakSummary,
  recordDailyStudyCheckIn,
} from './srsEngine';

test('transformSentenceForEmotionalSituation transcreates sentences for angry-scolding, gentle-advice, and pro-broadcast and compares plain vs emotional pronunciation', () => {
  assert.equal(EMOTIONAL_SITUATION_TAGS.length >= 5, true);

  const sample = '約束[やくそく]の時間[じかん]に遅[おく]れないでください。';

  // 1. Angry Scolding (憤怒的責備)
  const angry = transformSentenceForEmotionalSituation(sample, 'angry-scolding');
  assert.equal(angry.plainVersion.speedRate, 1.0);
  assert.ok(angry.emotionalVersion.speedRate > 1.0);
  assert.ok(angry.emotionalVersion.textJp.includes('いい加減'));
  assert.ok(angry.emotionalVersion.textJp.includes('だろう！？'));
  assert.equal(angry.emotionalVersion.emotionTone, 'serious');
  assert.ok(angry.comparisonDiff.addedExpressionsJp.length >= 2);

  // 2. Gentle Advice (溫柔的勸告)
  const gentle = transformSentenceForEmotionalSituation(sample, 'gentle-advice');
  assert.ok(gentle.emotionalVersion.speedRate < 1.0);
  assert.ok(gentle.emotionalVersion.textJp.includes('あのね'));
  assert.ok(gentle.emotionalVersion.textJp.includes('ね。'));
  assert.equal(gentle.emotionalVersion.emotionTone, 'gentle');

  // 3. Professional Broadcast (專業的播報)
  const broadcast = transformSentenceForEmotionalSituation(sample, 'pro-broadcast');
  assert.equal(broadcast.emotionalVersion.speedRate, 1.0);
  assert.ok(broadcast.emotionalVersion.textJp.includes('皆様'));
  assert.ok(broadcast.emotionalVersion.textJp.includes('お願い申'));
  assert.equal(broadcast.emotionalVersion.emotionTone, 'neutral');
});

test('calculateStudyStreakSummary and recordDailyStudyCheckIn compute consecutive study days, 7-day strip, and highest record accurately', () => {
  const fixedNow = new Date('2026-11-09T12:00:00Z').getTime();
  const seed = getInitialStreakSeed(fixedNow);
  assert.equal(seed.activeDates.length, 5);
  assert.equal(seed.longestStreakDays, 12);

  // Before checking in today: 5 consecutive days ending yesterday
  const beforeCheckIn = calculateStudyStreakSummary(
    seed.activeDates,
    seed.longestStreakDays,
    fixedNow
  );
  assert.equal(beforeCheckIn.currentStreakDays, 5);
  assert.equal(beforeCheckIn.longestStreakDays, 12);
  assert.equal(beforeCheckIn.isCheckedInToday, false);
  assert.equal(beforeCheckIn.recentSevenDays.length, 7);
  assert.equal(beforeCheckIn.recentSevenDays[6].isToday, true);
  assert.equal(beforeCheckIn.recentSevenDays[6].completed, false);

  // After checking in today: advances to 6 consecutive days and marks today completed
  const afterCheckIn = recordDailyStudyCheckIn(
    seed.activeDates,
    seed.longestStreakDays,
    fixedNow
  );
  assert.equal(afterCheckIn.summary.currentStreakDays, 6);
  assert.equal(afterCheckIn.summary.longestStreakDays, 12);
  assert.equal(afterCheckIn.summary.isCheckedInToday, true);
  assert.equal(afterCheckIn.summary.recentSevenDays[6].completed, true);

  // When currentStreakDays exceeds previous longestStreakDays, longestStreakDays updates automatically
  const beatingRecord = recordDailyStudyCheckIn(seed.activeDates, 5, fixedNow);
  assert.equal(beatingRecord.summary.currentStreakDays, 6);
  assert.equal(beatingRecord.summary.longestStreakDays, 6);
  assert.equal(beatingRecord.updatedBestStreak, 6);
});

import {
  getTopRelevantCorrelationExamples,
  DYNAMIC_CORRELATION_EXAMPLE_BANK,
} from './srsEngine';

test('getTopRelevantCorrelationExamples dynamically filters the 3 most relevant Japanese examples for the current slider value and scenario', () => {
  assert.ok(DYNAMIC_CORRELATION_EXAMPLE_BANK.length >= 21);

  // 1. At slider 0% in temp-heating (25°C, 15% heating), top #1 should be th-01 (targetPercent: 0, relevance: 100%)
  const atZero = getTopRelevantCorrelationExamples('temp-heating', 0, 3);
  assert.equal(atZero.length, 3);
  assert.equal(atZero[0].id, 'th-01');
  assert.equal(atZero[0].rank, 1);
  assert.equal(atZero[0].relevanceScorePercent, 100);
  assert.equal(atZero[0].matchedValueABadge, '25°C');
  assert.equal(atZero[0].matchedValueBBadge, '15%');
  assert.ok(atZero[0].relevanceScorePercent >= atZero[1].relevanceScorePercent);
  assert.ok(atZero[1].relevanceScorePercent >= atZero[2].relevanceScorePercent);

  // 2. At slider 50% in temp-heating (10°C, 58% heating), top #1 should be th-05 (targetPercent: 50, relevance: 100%)
  const atMid = getTopRelevantCorrelationExamples('temp-heating', 50, 3);
  assert.equal(atMid.length, 3);
  assert.equal(atMid[0].id, 'th-05');
  assert.equal(atMid[0].relevanceScorePercent, 100);
  assert.equal(atMid[0].matchedValueABadge, '10°C');

  // 3. At slider 100% in temp-heating (-5°C, 100% heating), top #1 should be th-09 (targetPercent: 100, relevance: 100%)
  const atMax = getTopRelevantCorrelationExamples('temp-heating', 100, 3);
  assert.equal(atMax.length, 3);
  assert.equal(atMax[0].id, 'th-09');
  assert.equal(atMax[0].relevanceScorePercent, 100);
  assert.equal(atMax[0].matchedValueABadge, '-5°C');
  assert.equal(atMax[0].matchedValueBBadge, '100%');

  // 4. Scenario switch: practice-fluency at 100% returns pf-07 as #1
  const fluencyMax = computeDynamicCorrelationState('practice-fluency', 100, 'transitive');
  assert.equal(fluencyMax.relevantExamples.length, 3);
  assert.equal(fluencyMax.relevantExamples[0].id, 'pf-07');
  assert.equal(fluencyMax.relevantExamples[0].matchedValueABadge, '100回');
});

import { computeEmotionSpectrumProfile } from './srsEngine';

test('computeEmotionSpectrumProfile computes 6-axis voice feature scores, 2D valence/arousal coordinates, and 8-point pitch contours for emotional presets', () => {
  const angrySpec = computeEmotionSpectrumProfile('angry-scolding');
  assert.equal(angrySpec.dimensions.length, 6);
  assert.equal(angrySpec.spectrumWavePoints.length, 8);
  const angryArousal = angrySpec.dimensions.find((d) => d.axisId === 'arousal')!;
  const angryWarmth = angrySpec.dimensions.find((d) => d.axisId === 'warmth')!;
  assert.ok(angryArousal.emotionalScore >= 90);
  assert.ok(angryWarmth.emotionalScore <= 25);
  assert.ok(angrySpec.valenceX < 0);
  assert.ok(angrySpec.arousalY > 0);

  const gentleSpec = computeEmotionSpectrumProfile('gentle-advice');
  const gentleWarmth = gentleSpec.dimensions.find((d) => d.axisId === 'warmth')!;
  const gentlePace = gentleSpec.dimensions.find((d) => d.axisId === 'speedPace')!;
  assert.ok(gentleWarmth.emotionalScore >= 90);
  assert.ok(gentlePace.emotionalScore < gentlePace.plainScore);
  assert.ok(gentleSpec.valenceX > 0);
  assert.ok(gentleSpec.arousalY < 0);

  const broadcastSpec = computeEmotionSpectrumProfile('pro-broadcast');
  const broadcastFormality = broadcastSpec.dimensions.find((d) => d.axisId === 'formality')!;
  assert.ok(broadcastFormality.emotionalScore >= 95);
  assert.equal(broadcastSpec.voiceMetrics.speedRate, 1.0);
});

import {
  parseAntigravitySkillMd,
  compileActiveSkillsSystemPrompt,
  DEFAULT_ANTIGRAVITY_SKILLS,
} from './srsEngine';

test('parseAntigravitySkillMd parses single-line and multiline YAML frontmatter and compileActiveSkillsSystemPrompt builds AI Agent system block', () => {
  assert.equal(DEFAULT_ANTIGRAVITY_SKILLS.length, 4);

  const rawMultilineSkill = `---
name: anime-slang-decoder
description: >
  將日本動漫、VTuber 及年輕人常用口語拆解為
  標準丁寧語與廣東話潮語對照。
---

# Anime & Youth Slang Decoder
1. 先列出句子入面嘅動漫俗語。
2. 提供標準日語還原版。`;

  const parsed = parseAntigravitySkillMd(rawMultilineSkill);
  assert.equal(parsed.name, 'anime-slang-decoder');
  assert.equal(
    parsed.description,
    '將日本動漫、VTuber 及年輕人常用口語拆解為 標準丁寧語與廣東話潮語對照。'
  );
  assert.ok(parsed.instructionsMd.includes('# Anime & Youth Slang Decoder'));
  assert.equal(parsed.enabled, true);
  assert.equal(parsed.isCustom, true);

  // Also test plain markdown without YAML frontmatter
  const plainMd = `# Kansai Dialect Translator\n將標準東京語轉換為地道大阪關西腔（〜やで、〜やん）。`;
  const parsedPlain = parseAntigravitySkillMd(plainMd);
  assert.equal(parsedPlain.name, 'kansai-dialect-translator');
  assert.ok(parsedPlain.rawSkillMd.startsWith('---'));

  // Compile active skills into AI Agent system prompt block
  const compiled = compileActiveSkillsSystemPrompt([
    ...DEFAULT_ANTIGRAVITY_SKILLS,
    parsed,
  ]);
  assert.deepEqual(compiled.activeSkillNames, [
    'jlpt-trap-detector',
    'cantonese-core-image-sensei',
    'anime-slang-decoder',
  ]);
  assert.ok(compiled.compiledSystemBlock.includes('<antigravity_mounted_skills>'));
  assert.ok(compiled.compiledSystemBlock.includes('anime-slang-decoder'));
});

import {
  normalizeGitHubSkillUrl,
  buildAntigravityRepoBundle,
} from './srsEngine';

test('normalizeGitHubSkillUrl converts GitHub blob, tree, and root repo URLs and buildAntigravityRepoBundle creates .agents/ manifest', () => {
  const blobRes = normalizeGitHubSkillUrl(
    'https://github.com/bentk/antigravity-skills/blob/main/skills/jlpt/SKILL.md'
  );
  assert.equal(blobRes.valid, true);
  assert.equal(
    blobRes.rawUrl,
    'https://raw.githubusercontent.com/bentk/antigravity-skills/main/skills/jlpt/SKILL.md'
  );
  assert.equal(blobRes.repoSlug, 'bentk/antigravity-skills');

  const treeRes = normalizeGitHubSkillUrl(
    'https://github.com/bentk/antigravity-skills/tree/main/.agents/skills/keigo'
  );
  assert.equal(treeRes.valid, true);
  assert.equal(
    treeRes.rawUrl,
    'https://raw.githubusercontent.com/bentk/antigravity-skills/main/.agents/skills/keigo/SKILL.md'
  );

  const bundle = buildAntigravityRepoBundle(DEFAULT_ANTIGRAVITY_SKILLS);
  assert.equal(bundle.length, 5); // .agents/AGENTS.md + 4 SKILL.md files
  assert.equal(bundle[0].path, '.agents/AGENTS.md');
  assert.ok(
    bundle.some((f) => f.path === '.agents/skills/jlpt-trap-detector/SKILL.md')
  );
});



