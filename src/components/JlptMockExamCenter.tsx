import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Award,
  Volume2,
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  Flag,
  FileCheck2,
  MessageSquare,
  RotateCcw,
  Eye,
  EyeOff,
  Square,
  Gauge,
  Shuffle,
  Layers,
} from 'lucide-react';
import {
  JlptLevel,
  QuizScoreResult,
  MistakeRecord,
  getJlptListeningSpeechRate,
  parseDialogueIntoSpeakerTurns,
  DialogueSpeechTurn,
} from '../utils/srsEngine';
import { UiLang, formatBilingual } from '../data/listeningAndDictionaryData';
import {
  JlptExamSectionId,
  JlptMockExamQuestion,
  JLPT_MOCK_EXAM_BANK,
  JLPT_PASS_THRESHOLDS,
  scoreJlptMockExam,
  buildRandomizedMockExamPaper,
  generateProceduralMockQuestionBatch,
  MOCK_EXAM_THEME_OPTIONS,
  MockExamThemeId,
} from '../data/dailyTeacherLessonsAndMockExamData';
import {
  FuriganaText,
  speakJapanese,
  speakJapaneseDialogue,
  stopJapaneseSpeech,
} from './FuriganaText';

interface JlptMockExamCenterProps {
  selectedLevel: JlptLevel;
  onSelectLevel: (level: JlptLevel) => void;
  uiLang: UiLang;
  onCompleteExam: (result: QuizScoreResult) => void;
  onAskSenseiWithContext: (promptText: string, item?: any) => void;
  onRecordMistakes?: (mistakes: MistakeRecord[]) => void;
}

const SEEN_IDS_STORAGE_KEY = 'kotonoha_mock_seen_ids_v1';
const CUSTOM_POOL_STORAGE_KEY = 'kotonoha_mock_custom_pool_v1';

export const JlptMockExamCenter: React.FC<JlptMockExamCenterProps> = ({
  selectedLevel,
  onSelectLevel,
  uiLang,
  onCompleteExam,
  onAskSenseiWithContext,
  onRecordMistakes,
}) => {
  const [activeSectionFilter, setActiveSectionFilter] = useState<'all' | JlptExamSectionId>('all');
  const [selectedTheme, setSelectedTheme] = useState<MockExamThemeId>('all');
  const [targetPaperSize, setTargetPaperSize] = useState<number>(12);
  const [paperSeed, setPaperSeed] = useState<number>(1);
  const [paperEditionByLevel, setPaperEditionByLevel] = useState<Record<JlptLevel, number>>({
    N5: 1,
    N4: 1,
    N3: 1,
    N2: 1,
    N1: 1,
  });

  // Persistent custom-generated questions added by AI or procedural generator
  const [customGeneratedPool, setCustomGeneratedPool] = useState<JlptMockExamQuestion[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem(CUSTOM_POOL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage error
    }
    return [];
  });

  // Persistent seen question IDs per level to prevent repetition across mock exams
  const [seenIdsByLevel, setSeenIdsByLevel] = useState<Record<JlptLevel, string[]>>(() => {
    const empty: Record<JlptLevel, string[]> = { N5: [], N4: [], N3: [], N2: [], N1: [] };
    if (typeof window === 'undefined') return empty;
    try {
      const saved = window.localStorage.getItem(SEEN_IDS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...empty, ...parsed };
        }
      }
    } catch {
      // Ignore storage error
    }
    return empty;
  });

  // Active explicit paper override when user clicks AI generate or random draw
  const [activePaperOverride, setActivePaperOverride] = useState<JlptMockExamQuestion[] | null>(
    null
  );
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const [isGeneratingPaper, setIsGeneratingPaper] = useState<boolean>(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [showListeningTranscript, setShowListeningTranscript] = useState<Record<string, boolean>>({});

  // Save custom pool and seen IDs to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CUSTOM_POOL_STORAGE_KEY, JSON.stringify(customGeneratedPool));
    } catch {
      // Ignore quota error
    }
  }, [customGeneratedPool]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SEEN_IDS_STORAGE_KEY, JSON.stringify(seenIdsByLevel));
    } catch {
      // Ignore quota error
    }
  }, [seenIdsByLevel]);

  // Combined question bank (120 curated + any dynamically generated questions)
  const combinedQuestionPool = useMemo<JlptMockExamQuestion[]>(() => {
    return [...JLPT_MOCK_EXAM_BANK, ...customGeneratedPool];
  }, [customGeneratedPool]);

  // JLPT Level-Adaptive Speech Speed & Multi-Speaker Voice State
  const levelSpeechConfig = useMemo(
    () => getJlptListeningSpeechRate(selectedLevel),
    [selectedLevel]
  );
  const [customRateOverride, setCustomRateOverride] = useState<number | null>(null);
  const [useNaturalServerTts, setUseNaturalServerTts] = useState<boolean>(true);
  const [playingQuestionId, setPlayingQuestionId] = useState<string | null>(null);
  const [activeTurnState, setActiveTurnState] = useState<{
    questionId: string;
    turnIndex: number;
    turn: DialogueSpeechTurn;
    engineLabel: string;
  } | null>(null);

  const effectiveSpeechRate = customRateOverride ?? levelSpeechConfig.rate;

  // Countdown Timer (25 minutes = 1500 seconds default for 12-question full mock set)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1500);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);

  const levels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

  // Sample non-repeating paper for selectedLevel
  const sampledPaperResult = useMemo(() => {
    return buildRandomizedMockExamPaper({
      pool: combinedQuestionPool,
      level: selectedLevel,
      seenIds: seenIdsByLevel[selectedLevel] || [],
      targetCount: targetPaperSize,
      seed: paperSeed,
      theme: selectedTheme,
    });
  }, [combinedQuestionPool, selectedLevel, seenIdsByLevel, targetPaperSize, paperSeed, selectedTheme]);

  // Current exam paper questions for selectedLevel
  const examQuestions = useMemo<JlptMockExamQuestion[]>(() => {
    if (
      activePaperOverride &&
      activePaperOverride.length > 0 &&
      activePaperOverride[0].level === selectedLevel
    ) {
      return activePaperOverride;
    }
    return sampledPaperResult.paper;
  }, [selectedLevel, activePaperOverride, sampledPaperResult]);

  const visibleQuestions = useMemo<JlptMockExamQuestion[]>(() => {
    if (activeSectionFilter === 'all') return examQuestions;
    return examQuestions.filter((q) => q.section === activeSectionFilter);
  }, [examQuestions, activeSectionFilter]);

  // Reset exam state & calibrate listening speech speed when level changes
  useEffect(() => {
    stopJapaneseSpeech();
    setPlayingQuestionId(null);
    setActiveTurnState(null);
    setCustomRateOverride(null);
    setActivePaperOverride(null);
    setGenerationNotice(null);
    setUserAnswers({});
    setFlaggedIds({});
    setIsSubmitted(false);
    setRemainingSeconds(targetPaperSize * 125);
    setActiveSectionFilter('all');
  }, [selectedLevel, targetPaperSize]);

  // Countdown tick
  useEffect(() => {
    if (isSubmitted || isTimerPaused) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSubmitted, isTimerPaused]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }));
  };

  const handleToggleFlag = (questionId: string) => {
    setFlaggedIds((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handleSubmitExam = () => {
    // CRITICAL: Lock the current paper questions into activePaperOverride BEFORE updating seenIdsByLevel
    // so that grading the exam NEVER causes examQuestions to resample to a new paper!
    const lockedPaper = [...examQuestions];
    setActivePaperOverride(lockedPaper);
    setIsSubmitted(true);
    const report = scoreJlptMockExam(lockedPaper, userAnswers, selectedLevel);

    // Record current paper IDs as seen so subsequent papers never repeat them
    setSeenIdsByLevel((prev) => {
      const existing = prev[selectedLevel] || [];
      const merged = Array.from(new Set([...existing, ...lockedPaper.map((q) => q.id)]));
      return {
        ...prev,
        [selectedLevel]: merged,
      };
    });

    if (onRecordMistakes) {
      const now = Date.now();
      const missed: MistakeRecord[] = examQuestions
        .filter((q) => userAnswers[q.id] !== q.correctIndex)
        .map((q) => {
          const pickedIdx = userAnswers[q.id];
          const categoryMap =
            q.section === 'vocab_grammar'
              ? 'grammar'
              : q.section === 'reading'
                ? 'reading'
                : 'listening';
          return {
            id: `mistake-mock-${q.id}`,
            questionId: q.id,
            level: q.level,
            source: 'mock-exam',
            category: categoryMap,
            questionPrompt: q.promptJp,
            userChosenOption:
              pickedIdx !== undefined && q.options[pickedIdx]
                ? q.options[pickedIdx]
                : '（未作答 / 未選択）',
            correctAnswer: q.options[q.correctIndex] || '',
            explanation: q.explanationHk || q.explanationJa,
            timestamp: now,
            mistakeCount: 1,
            convertedToSrs: false,
          };
        });
      if (missed.length > 0) {
        onRecordMistakes(missed);
      }
    }

    onCompleteExam({
      total: report.totalQuestions,
      correct: report.totalCorrect,
      accuracyPercent:
        report.totalQuestions > 0
          ? Math.round((report.totalCorrect / report.totalQuestions) * 100)
          : 0,
      xpEarned: report.isPassed ? 60 : 30,
      masteryStatus: report.isPassed ? 'NOMINAL' : 'NEEDS_PRACTICE',
      weakCategories: [],
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 160, behavior: 'smooth' });
    }
  };

  const handleResetExam = () => {
    setUserAnswers({});
    setFlaggedIds({});
    setIsSubmitted(false);
    setRemainingSeconds(examQuestions.length * 125);
  };

  /**
   * Instant Non-Repeating Random Paper Draw from the 120+ Question Pool:
   * Marks current paper questions as seen, advances the seed, and draws a 100% unseen batch.
   */
  const handleDrawNonRepeatingPaper = () => {
    stopJapaneseSpeech();
    setPlayingQuestionId(null);
    setActiveTurnState(null);

    const currentSeen = seenIdsByLevel[selectedLevel] || [];
    const currentPaperIds = examQuestions.map((q) => q.id);
    const updatedSeenBeforeDraw = Array.from(new Set([...currentSeen, ...currentPaperIds]));
    const nextSeed = paperSeed + 1;

    const nextDraw = buildRandomizedMockExamPaper({
      pool: combinedQuestionPool,
      level: selectedLevel,
      seenIds: updatedSeenBeforeDraw,
      targetCount: targetPaperSize,
      seed: nextSeed,
      theme: selectedTheme,
    });

    setSeenIdsByLevel((prev) => ({
      ...prev,
      [selectedLevel]: nextDraw.cycleReset
        ? nextDraw.paper.map((q) => q.id)
        : updatedSeenBeforeDraw,
    }));
    setPaperSeed(nextSeed);
    setPaperEditionByLevel((prev) => ({
      ...prev,
      [selectedLevel]: (prev[selectedLevel] || 1) + 1,
    }));
    setActivePaperOverride(nextDraw.paper);
    setGenerationNotice(
      nextDraw.cycleReset
        ? `🔄 已完成本級全部題庫一輪！系統已重置不重複紀錄並重新洗牌組出第 #${(paperEditionByLevel[selectedLevel] || 1) + 1} 回新卷（${nextDraw.paper.length}題）。`
        : `🎲 已從題庫抽取 ${nextDraw.unseenCountUsed} 題未做過嘅全新題目組出第 #${(paperEditionByLevel[selectedLevel] || 1) + 1} 回試卷（保證不重複）！`
    );
    setUserAnswers({});
    setFlaggedIds({});
    setIsSubmitted(false);
    setRemainingSeconds(nextDraw.paper.length * 125);
  };

  /**
   * Hybrid AI + Procedural New Question Generation Mechanism:
   * Generates brand-new questions tailored to the selected theme, deduplicates against existing prompts,
   * appends them permanently into `customGeneratedPool`, and presents a fresh non-repeating paper.
   */
  const handleGenerateAiMockPaper = async () => {
    stopJapaneseSpeech();
    setPlayingQuestionId(null);
    setActiveTurnState(null);
    setIsGeneratingPaper(true);

    const currentLevelPool = combinedQuestionPool.filter((q) => q.level === selectedLevel);
    const existingPrompts = currentLevelPool.map((q) => q.promptJp.trim());
    const themeObj =
      MOCK_EXAM_THEME_OPTIONS.find((t) => t.id === selectedTheme) || MOCK_EXAM_THEME_OPTIONS[0];
    const nextSeed = Date.now();

    // Synthesize instant procedural fresh questions so even offline / fast mode adds brand-new items
    const proceduralFresh = generateProceduralMockQuestionBatch(
      selectedLevel,
      selectedTheme,
      nextSeed,
      existingPrompts
    );

    try {
      const response = await fetch('/api/ai/mock-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: selectedLevel,
          focusTopic: `JLPT ${selectedLevel} ${themeObj.promptHint}`,
          excludePrompts: existingPrompts.slice(-24),
          count: targetPaperSize,
        }),
      });
      const data = await response.json();
      const aiQuestions: JlptMockExamQuestion[] =
        data && Array.isArray(data.questions) ? data.questions : [];

      // Filter out any question whose promptJp already exists in combinedQuestionPool
      const existingPromptSet = new Set(existingPrompts);
      const uniqueNewQuestions: JlptMockExamQuestion[] = [];

      for (const q of [...aiQuestions, ...proceduralFresh]) {
        const key = (q.promptJp || '').trim();
        if (key && !existingPromptSet.has(key)) {
          existingPromptSet.add(key);
          uniqueNewQuestions.push({
            ...q,
            level: selectedLevel,
          });
        }
      }

      const mergedPool = [...combinedQuestionPool, ...uniqueNewQuestions];
      if (uniqueNewQuestions.length > 0) {
        setCustomGeneratedPool((prev) => [...prev, ...uniqueNewQuestions]);
      }

      const currentSeen = Array.from(
        new Set([...(seenIdsByLevel[selectedLevel] || []), ...examQuestions.map((q) => q.id)])
      );
      const nextDraw = buildRandomizedMockExamPaper({
        pool: mergedPool,
        level: selectedLevel,
        seenIds: currentSeen,
        targetCount: targetPaperSize,
        seed: nextSeed,
        theme: selectedTheme,
      });

      setSeenIdsByLevel((prev) => ({
        ...prev,
        [selectedLevel]: currentSeen,
      }));
      setPaperSeed((s) => s + 1);
      setPaperEditionByLevel((prev) => ({
        ...prev,
        [selectedLevel]: (prev[selectedLevel] || 1) + 1,
      }));
      setActivePaperOverride(nextDraw.paper);
      setGenerationNotice(
        `✨ 已隨機生成 ${uniqueNewQuestions.length} 題全新題目加入 ${selectedLevel} 題庫（現有 ${mergedPool.filter((q) => q.level === selectedLevel).length} 題），並組出第 #${(paperEditionByLevel[selectedLevel] || 1) + 1} 回不重複新試卷！`
      );
      setUserAnswers({});
      setFlaggedIds({});
      setIsSubmitted(false);
      setRemainingSeconds(nextDraw.paper.length * 125);
    } catch {
      // Fallback: use procedural fresh questions + non-repeating sampler
      const mergedPool = [...combinedQuestionPool, ...proceduralFresh];
      if (proceduralFresh.length > 0) {
        setCustomGeneratedPool((prev) => [...prev, ...proceduralFresh]);
      }
      const currentSeen = Array.from(
        new Set([...(seenIdsByLevel[selectedLevel] || []), ...examQuestions.map((q) => q.id)])
      );
      const nextDraw = buildRandomizedMockExamPaper({
        pool: mergedPool,
        level: selectedLevel,
        seenIds: currentSeen,
        targetCount: targetPaperSize,
        seed: nextSeed,
        theme: selectedTheme,
      });
      setSeenIdsByLevel((prev) => ({
        ...prev,
        [selectedLevel]: currentSeen,
      }));
      setPaperEditionByLevel((prev) => ({
        ...prev,
        [selectedLevel]: (prev[selectedLevel] || 1) + 1,
      }));
      setActivePaperOverride(nextDraw.paper);
      setGenerationNotice(
        `✨ 已隨機生成全新題目並組出第 #${(paperEditionByLevel[selectedLevel] || 1) + 1} 回不重複模擬卷！`
      );
      setUserAnswers({});
      setFlaggedIds({});
      setIsSubmitted(false);
      setRemainingSeconds(nextDraw.paper.length * 125);
    } finally {
      setIsGeneratingPaper(false);
    }
  };

  const scoreReport = useMemo(
    () => (isSubmitted ? scoreJlptMockExam(examQuestions, userAnswers, selectedLevel) : null),
    [isSubmitted, examQuestions, userAnswers, selectedLevel]
  );

  const answeredCount = examQuestions.filter((q) => userAnswers[q.id] !== undefined).length;
  const passThreshold = JLPT_PASS_THRESHOLDS[selectedLevel];
  const currentEditionNum = paperEditionByLevel[selectedLevel] || 1;
  const currentLevelSeenSet = new Set([
    ...(seenIdsByLevel[selectedLevel] || []),
    ...examQuestions.map((q) => q.id),
  ]);
  const levelTotalBankCount = sampledPaperResult.totalLevelPoolSize;
  const remainingUnseenInBank = Math.max(
    0,
    levelTotalBankCount - currentLevelSeenSet.size
  );

  return (
    <div data-testid="jlpt-mock-exam-center" className="space-y-6">
      {/* Top Official Exam Hall Header */}
      <div className="bg-white border-2 border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-3.5 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white text-xs font-bold tracking-wider">
                JLPT 日本語能力試験・全真模擬考場
              </span>
              <span className="px-2.5 py-0.5 rounded bg-sky-50 text-[#0284C7] border border-sky-200 text-xs font-semibold font-mono-num">
                180点満点（言語知識 60 · 読解 60 · 聴解 60）
              </span>
              <span className="text-xs text-slate-600 font-mono-num">
                {selectedLevel} 合格基準：{passThreshold}/180点（各科目基準点 19/60点）
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              {formatBilingual(
                `JLPT ${selectedLevel} 日本語能力試 全真模擬測驗（第 #${currentEditionNum} 回試卷）`,
                `JLPT ${selectedLevel} 日本語能力試験 実戦模擬テスト（第 #${currentEditionNum} 回）`,
                uiLang
              )}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              {formatBilingual(
                '涵蓋「★星號句子重組」、「段落文法」、「AB比較讀解」、「情報檢索」及「男女雙聲道聽解」，自動追蹤已做題目確保每次抽卷絕不重複。',
                '「★文の組み立て」「文章の文法」「A/B比較読解」「情報検索」「男女別ボイス聴解」を網羅。出題履歴を管理し重複しない模擬試験を構成します。',
                uiLang
              )}
            </p>
          </div>

          {/* Controls Toolbar: Level Selector + Timer + Non-Repeating Shuffle + AI New Exam Paper */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* N5-N1 Selector */}
            <div
              role="group"
              aria-label="選擇模擬考 JLPT 級別"
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200"
            >
              {levels.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  data-testid={`mock-exam-level-${lvl}`}
                  onClick={() => onSelectLevel(lvl)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                    selectedLevel === lvl
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Countdown Timer Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300">
              <Clock
                className={`w-4 h-4 ${
                  remainingSeconds < 180 ? 'text-rose-600 animate-pulse' : 'text-slate-700'
                }`}
              />
              <span className="text-xs text-slate-500">
                {formatBilingual('剩餘時間', '残り時間', uiLang)}
              </span>
              <strong
                data-testid="mock-exam-timer"
                className="font-mono-num text-sm font-bold text-slate-900"
              >
                {formatTimer(remainingSeconds)}
              </strong>
              <button
                type="button"
                onClick={() => setIsTimerPaused((p) => !p)}
                className="text-[11px] font-semibold text-[#0284C7] hover:underline ml-1 cursor-pointer"
              >
                {isTimerPaused ? '繼續' : '暫停'}
              </button>
            </div>

            {/* Instant Non-Repeating Random Paper Draw Button */}
            <button
              type="button"
              data-testid="shuffle-random-mock-paper-btn"
              onClick={handleDrawNonRepeatingPaper}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5 text-amber-800" />
              <span>
                {formatBilingual('隨機抽題組新卷 (不重複)', '未出題から新テスト作成', uiLang)}
              </span>
            </button>

            {/* AI Generate New Mock Exam Paper Button */}
            <button
              type="button"
              data-testid="generate-ai-mock-exam-btn"
              disabled={isGeneratingPaper}
              onClick={handleGenerateAiMockPaper}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              {isGeneratingPaper ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{formatBilingual('AI 命題委員出新題中...', 'AIが新規問題を作成中...', uiLang)}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{formatBilingual('隨機生成新題入庫', 'AIで新規問題を生成・追加', uiLang)}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Question Bank Scale, Non-Repetition Tracker & Theme/Paper Size Controls Bar */}
        <div
          data-testid="mock-bank-status-bar"
          className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3"
        >
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 text-white font-bold font-mono-num">
                <Layers className="w-3.5 h-3.5 text-sky-300" />
                <span>
                  {selectedLevel} 題庫規模：{levelTotalBankCount} 題（全館 {combinedQuestionPool.length} 題）
                </span>
              </span>
              <span
                data-testid="mock-unseen-remaining-badge"
                className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold font-mono-num"
              >
                未曝光新題：{remainingUnseenInBank} 題 · 已排除重複：{currentLevelSeenSet.size} 題
              </span>
              {seenIdsByLevel[selectedLevel]?.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSeenIdsByLevel((prev) => ({ ...prev, [selectedLevel]: [] }));
                    setGenerationNotice(`已重置 ${selectedLevel} 已做題目紀錄，全庫 ${levelTotalBankCount} 題可重新隨機抽取。`);
                  }}
                  className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                >
                  重置已做紀錄
                </button>
              )}
            </div>

            {/* Theme Selector & Paper Size Selector */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span>{formatBilingual('出題題材與題型：', '出題テーマ：', uiLang)}</span>
                <select
                  data-testid="mock-theme-select"
                  value={selectedTheme}
                  onChange={(e) => {
                    setSelectedTheme(e.target.value as MockExamThemeId);
                    setActivePaperOverride(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-medium focus:outline-none focus:border-[#0284C7]"
                >
                  {MOCK_EXAM_THEME_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {uiLang === 'ja' ? opt.labelJa : opt.labelZh}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span>{formatBilingual('試卷題數：', '問題数：', uiLang)}</span>
                <select
                  data-testid="mock-paper-size-select"
                  value={targetPaperSize}
                  onChange={(e) => {
                    setTargetPaperSize(Number(e.target.value));
                    setActivePaperOverride(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono-num font-bold focus:outline-none focus:border-[#0284C7]"
                >
                  <option value={12}>12題 標準模擬卷 (25分鐘)</option>
                  <option value={18}>18題 加長實戰卷 (38分鐘)</option>
                  <option value={24}>24題 全庫特訓卷 (50分鐘)</option>
                </select>
              </label>
            </div>
          </div>

          {/* Question-Type Diversity Tags on Current Paper */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500">
              {formatBilingual('本卷涵蓋多元題型：', '本試験の出題形式：', uiLang)}
            </span>
            {sampledPaperResult.questionTypeTags.slice(0, 8).map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-medium text-slate-700"
              >
                {tag}
              </span>
            ))}
          </div>

          {generationNotice && (
            <div
              data-testid="mock-generation-notice"
              className="text-xs font-semibold text-[#0284C7] bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
            >
              <span>{generationNotice}</span>
              <button
                type="button"
                onClick={() => setGenerationNotice(null)}
                className="text-slate-500 hover:text-slate-800 text-[11px] cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Global JLPT Listening Voice & Speed Calibration Bar */}
          <div
            data-testid="jlpt-listening-voice-calibration-bar"
            className="pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                <Gauge className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>
                  {formatBilingual(
                    '聴解男女雙聲道與語速自由微調：',
                    '聴解男女別ボイス＆再生速度調整：',
                    uiLang
                  )}
                </span>
              </span>
              {[
                { label: `預設 ${selectedLevel} (${levelSpeechConfig.rate.toFixed(2)}x)`, rate: null },
                { label: '0.85x 慢速', rate: 0.85 },
                { label: '1.00x 標準', rate: 1.0 },
                { label: '1.15x 實戰快', rate: 1.15 },
                { label: '1.30x 高速', rate: 1.3 },
                { label: '1.50x 倍速特訓', rate: 1.5 },
              ].map((preset) => (
                <button
                  key={String(preset.rate)}
                  type="button"
                  onClick={() => setCustomRateOverride(preset.rate)}
                  className={`px-2 py-1 rounded-md font-mono-num text-[11px] font-semibold border cursor-pointer ${
                    customRateOverride === preset.rate
                      ? 'bg-[#0284C7] text-white border-[#0284C7]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}

              <label className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 py-1 text-[11px] font-mono-num">
                <span className="text-slate-600">滑桿微調:</span>
                <input
                  type="range"
                  data-testid="jlpt-speed-slider"
                  min={0.75}
                  max={1.6}
                  step={0.05}
                  value={effectiveSpeechRate}
                  onChange={(e) => setCustomRateOverride(Number(e.target.value))}
                  className="w-24 accent-[#0284C7] cursor-pointer"
                />
                <strong className="text-[#0284C7]">{effectiveSpeechRate.toFixed(2)}x</strong>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="preview-jlpt-male-female-btn"
                onClick={() =>
                  speakJapaneseDialogue({
                    dialogueSpeakers: [
                      {
                        speaker: '男',
                        lineJp: '佐藤さん、来週の企画書、もう読んだ？',
                      },
                      {
                        speaker: '女',
                        lineJp: 'はい、読みました。データの数字を確認しましょう。',
                      },
                    ],
                    level: selectedLevel,
                    rateOverride: effectiveSpeechRate,
                    preferNaturalServerTts: useNaturalServerTts,
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
              >
                <Volume2 className="w-3 h-3" />
                <span>試聽「男低音 Orus ＋ 女清亮音 Aoede」({effectiveSpeechRate.toFixed(2)}x)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Official JLPT Exam Section Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                {
                  id: 'all',
                  zh: `全卷總覽 (${examQuestions.length}題)`,
                  ja: `全科目表示 (${examQuestions.length}問)`,
                },
                {
                  id: 'vocab_grammar',
                  zh: '第1科目：言語知識（文字・語彙・文法・★重組）',
                  ja: '第1科目：言語知識（文字・語彙・文法・★）',
                },
                {
                  id: 'reading',
                  zh: '第2科目：讀解（短文・AB比較・情報檢索）',
                  ja: '第2科目：読解（短文・AB比較・情報検索）',
                },
                {
                  id: 'listening',
                  zh: '第3科目：聽解（男女雙聲道語音）',
                  ja: '第3科目：聴解（男女別ボイス付）',
                },
              ] as const
            ).map((sec) => (
              <button
                key={sec.id}
                type="button"
                data-testid={`mock-section-tab-${sec.id}`}
                onClick={() => setActiveSectionFilter(sec.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                  activeSectionFilter === sec.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {formatBilingual(sec.zh, sec.ja, uiLang)}
              </button>
            ))}
          </div>

          <div className="text-xs font-semibold text-slate-600 font-mono-num">
            已作答：{answeredCount} / {examQuestions.length} 題
          </div>
        </div>
      </div>

      {/* Official JLPT Score Report Certificate (shown when submitted) */}
      {isSubmitted && scoreReport && (
        <section
          data-testid="jlpt-score-report"
          aria-label="JLPT 合否結果通知書"
          className="bg-white border-2 border-slate-900 rounded-2xl p-6 shadow-sm space-y-5"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-slate-200">
            <div className="space-y-1">
              <div className="text-xs font-bold tracking-widest text-slate-500 uppercase">
                日本語能力試験 合否結果通知書 · OFFICIAL SCORE REPORT SIMULATION
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-3">
                <span>認定レベル：JLPT {scoreReport.level}</span>
                <span
                  data-testid="jlpt-pass-fail-badge"
                  className={`px-3.5 py-1 rounded-lg text-sm font-bold border-2 ${
                    scoreReport.isPassed
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-600'
                      : 'bg-rose-50 text-rose-800 border-rose-600'
                  }`}
                >
                  {scoreReport.isPassed ? '★ 合格 PASSED' : '● 不合格 NOT PASSED'}
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-800 font-mono-num">
                  判定ランク：{scoreReport.rankGrade}
                </span>
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleResetExam}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{formatBilingual('重考本卷', 'もう一度受ける', uiLang)}</span>
              </button>
              <button
                type="button"
                onClick={handleDrawNonRepeatingPaper}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5 text-amber-800" />
                <span>{formatBilingual('抽下一份不重複新卷', '未出題の新しい模試へ', uiLang)}</span>
              </button>
              <button
                type="button"
                onClick={handleGenerateAiMockPaper}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{formatBilingual('AI 生成新題再考', 'AI新規模試に挑戦', uiLang)}</span>
              </button>
            </div>
          </div>

          {/* 3-Section Scaled Score Breakdown Table (60 + 60 + 60 = 180) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(
              ['vocab_grammar', 'reading', 'listening'] as JlptExamSectionId[]
            ).map((secId) => {
              const sec = scoreReport.sections[secId];
              return (
                <div
                  key={secId}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2"
                >
                  <div className="text-xs font-bold text-slate-700">
                    {formatBilingual(sec.titleZh, sec.titleJa, uiLang)}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-mono-num text-slate-900">
                      {sec.scaledScore}{' '}
                      <span className="text-xs font-normal text-slate-500">/ 60点</span>
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        sec.passedSection ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {sec.passedSection ? '✓ 達基準点 (≥19)' : '✗ 未達基準点 (<19)'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        sec.passedSection ? 'bg-[#0284C7]' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.round((sec.scaledScore / 60) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono-num">
                    答啱題數：{sec.correctCount} / {sec.totalQuestions} 題
                  </div>
                </div>
              );
            })}

            {/* Total Score Card (/180) */}
            <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col justify-between space-y-2">
              <div className="text-xs font-bold text-sky-300">
                {formatBilingual('総合得点 (總分)', '総合得点 (Total)', uiLang)}
              </div>
              <div className="text-3xl font-bold font-mono-num">
                {scoreReport.totalScaledScore}{' '}
                <span className="text-sm font-normal text-slate-300">/ 180点</span>
              </div>
              <div className="text-xs text-slate-300 font-mono-num">
                {scoreReport.level} 合格ライン：{scoreReport.overallPassThreshold} / 180点
              </div>
            </div>
          </div>

          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs sm:text-sm text-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <strong className="text-[#0284C7]">考官總評：</strong>
              {uiLang === 'ja' ? scoreReport.feedbackJa : scoreReport.feedbackHk}
            </div>
            <button
              type="button"
              onClick={() =>
                onAskSenseiWithContext(
                  `Sensei，我啱啱完成咗 JLPT ${selectedLevel} 全真模擬試，總分攞到 ${scoreReport.totalScaledScore}/180 分（言語知識 ${scoreReport.sections.vocab_grammar.scaledScore}/60、讀解 ${scoreReport.sections.reading.scaledScore}/60、聽解 ${scoreReport.sections.listening.scaledScore}/60）。請幫我制定針對性嘅衝刺溫習策略！`
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{formatBilingual('請 AI 導師分析成績表', 'AI講師に成績分析を依頼', uiLang)}</span>
            </button>
          </div>
        </section>
      )}

      {/* Main 12-Col Exam Layout: Left 8 Cols Question Booklet + Right 4 Cols OMR Answer Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Official Question Paper Booklet (問題用紙) */}
        <div className="lg:col-span-8 space-y-5">
          {visibleQuestions.map((q) => {
            const globalNumber = examQuestions.findIndex((item) => item.id === q.id) + 1;
            const pickedIdx = userAnswers[q.id];
            const isFlagged = Boolean(flaggedIds[q.id]);
            const showScript = Boolean(showListeningTranscript[q.id]) || isSubmitted;

            return (
              <article
                key={q.id}
                id={`exam-q-${q.id}`}
                data-testid={`mock-exam-question-${globalNumber}`}
                className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs"
              >
                {/* Question Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-xs font-bold font-mono-num">
                      問 {globalNumber}
                    </span>
                    <span className="text-xs font-bold text-[#0284C7] bg-sky-50 px-2.5 py-1 rounded-md border border-sky-200">
                      {q.mondaiLabel}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleFlag(q.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                      isFlagged
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{formatBilingual('標記複查', '見直し', uiLang)}</span>
                  </button>
                </div>

                {/* Listening Audio Player Box (if section === 'listening') */}
                {q.section === 'listening' && (q.audioScriptJp || q.dialogueSpeakers) && (
                  <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-slate-900 flex flex-wrap items-center gap-2">
                          <Volume2 className="w-4 h-4 text-[#0284C7]" />
                          <span>
                            {formatBilingual(
                              '聴解問題音声（雙聲道男女分軌・不讀「男：/女：」前綴）',
                              '聴解問題音声（男女別ボイス・話者ラベル読み上げなし）',
                              uiLang
                            )}
                          </span>
                          <span
                            data-testid={`mock-exam-speech-rate-badge-${globalNumber}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-[#0284C7] border border-sky-200 text-[11px] font-mono-num font-bold"
                          >
                            <Gauge className="w-3 h-3" />
                            <span>
                              {customRateOverride === null
                                ? formatBilingual(
                                    levelSpeechConfig.labelZh,
                                    levelSpeechConfig.labelJa,
                                    uiLang
                                  )
                                : `自訂語速 (${effectiveSpeechRate.toFixed(2)}x)`}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {playingQuestionId === q.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              stopJapaneseSpeech();
                              setPlayingQuestionId(null);
                              setActiveTurnState(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
                          >
                            <Square className="w-3.5 h-3.5" />
                            <span>{formatBilingual('停止播放', '停止', uiLang)}</span>
                          </button>
                        ) : null}

                        <button
                          type="button"
                          data-testid={`play-listening-audio-${globalNumber}`}
                          onClick={() => {
                            setPlayingQuestionId(q.id);
                            speakJapaneseDialogue({
                              audioScriptJp: q.audioScriptJp,
                              dialogueSpeakers: q.dialogueSpeakers,
                              level: selectedLevel,
                              rateOverride: effectiveSpeechRate,
                              preferNaturalServerTts: useNaturalServerTts,
                              onStart: (info) => {
                                if (info.turns[0]) {
                                  setActiveTurnState({
                                    questionId: q.id,
                                    turnIndex: 0,
                                    turn: info.turns[0],
                                    engineLabel: info.engineLabel,
                                  });
                                }
                              },
                              onTurnChange: (turnIdx, turn) => {
                                setActiveTurnState((prev) => ({
                                  questionId: q.id,
                                  turnIndex: turnIdx,
                                  turn,
                                  engineLabel:
                                    prev?.engineLabel ||
                                    '雙聲道男女分軌語音 (男低音 · 女清亮音)',
                                }));
                              },
                              onEnd: () => {
                                setPlayingQuestionId((curr) => (curr === q.id ? null : curr));
                                setActiveTurnState((curr) =>
                                  curr?.questionId === q.id ? null : curr
                                );
                              },
                            });
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#0284C7] hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>
                            {formatBilingual(
                              `播放考場錄音 (${effectiveSpeechRate.toFixed(2)}x)`,
                              `音声を再生 (${effectiveSpeechRate.toFixed(2)}x)`,
                              uiLang
                            )}
                          </span>
                        </button>

                        <button
                          type="button"
                          data-testid={`toggle-listening-script-${globalNumber}`}
                          onClick={() =>
                            setShowListeningTranscript((prev) => ({
                              ...prev,
                              [q.id]: !prev[q.id],
                            }))
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          {showScript ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                          <span>{showScript ? '隱藏錄音原稿' : '查看錄音原稿'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Speed Calibration & Natural Voice Controls Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sky-200/70 text-[11px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-slate-600">
                          {formatBilingual('考場語速調節：', '再生速度：', uiLang)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCustomRateOverride(null)}
                          className={`px-2 py-0.5 rounded font-mono-num font-semibold border cursor-pointer ${
                            customRateOverride === null
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          預設 {selectedLevel} ({levelSpeechConfig.rate.toFixed(2)}x)
                        </button>
                        {[
                          { label: '0.85x 慢', rate: 0.85 },
                          { label: '1.00x 標準', rate: 1.0 },
                          { label: '1.15x 實戰快', rate: 1.15 },
                          { label: '1.30x 高速', rate: 1.3 },
                          { label: '1.50x 特快', rate: 1.5 },
                        ].map((preset) => (
                          <button
                            key={preset.rate}
                            type="button"
                            onClick={() => setCustomRateOverride(preset.rate)}
                            className={`px-2 py-0.5 rounded font-mono-num font-semibold border cursor-pointer ${
                              customRateOverride === preset.rate
                                ? 'bg-[#0284C7] text-white border-[#0284C7]'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <label className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-0.5 font-mono-num">
                          <span>微調</span>
                          <input
                            type="range"
                            min={0.75}
                            max={1.6}
                            step={0.05}
                            value={effectiveSpeechRate}
                            onChange={(e) => setCustomRateOverride(Number(e.target.value))}
                            className="w-16 accent-[#0284C7] cursor-pointer"
                          />
                          <strong className="text-[#0284C7]">{effectiveSpeechRate.toFixed(2)}x</strong>
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => setUseNaturalServerTts((v) => !v)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-semibold border cursor-pointer ${
                          useNaturalServerTts
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        <span>
                          {useNaturalServerTts
                            ? '🎙️ 真人雙聲道 (男低音 Orus + 女清亮 Aoede) 已啟用'
                            : '🔊 瀏覽器高低音男女分軌 (Pitch 0.64 vs 1.28)'}
                        </span>
                      </button>
                    </div>

                    {/* Active Speaker Status Banner during playback */}
                    {activeTurnState && activeTurnState.questionId === q.id && (
                      <div
                        data-testid={`active-speaker-banner-${globalNumber}`}
                        className="bg-white border border-sky-300 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-white ${
                              activeTurnState.turn.role === 'male'
                                ? 'bg-indigo-600'
                                : activeTurnState.turn.role === 'female'
                                  ? 'bg-rose-600'
                                  : 'bg-slate-700'
                            }`}
                          >
                            {activeTurnState.turn.role === 'male'
                              ? `👨 男聲（${activeTurnState.turn.speaker}）發話中`
                              : activeTurnState.turn.role === 'female'
                                ? `👩 女聲（${activeTurnState.turn.speaker}）發話中`
                                : `📢 旁白（${activeTurnState.turn.speaker}）`}
                          </span>
                          <span className="font-jp text-slate-800 font-medium">
                            {activeTurnState.turn.spokenTextJp}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono-num">
                          {activeTurnState.engineLabel} · {effectiveSpeechRate.toFixed(2)}x
                        </span>
                      </div>
                    )}

                    {/* Parsed Multi-Speaker Transcript (works for both dialogueSpeakers and raw audioScriptJp) */}
                    {showScript && (
                      <div
                        data-testid={`listening-transcript-box-${globalNumber}`}
                        className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs"
                      >
                        {parseDialogueIntoSpeakerTurns(
                          q.audioScriptJp,
                          q.dialogueSpeakers
                        ).map((turn, lIdx) => {
                          const isCurrentTurn =
                            activeTurnState?.questionId === q.id &&
                            activeTurnState?.turnIndex === lIdx;
                          return (
                            <div
                              key={lIdx}
                              className={`flex items-start justify-between gap-2 p-2 rounded-lg border transition-colors ${
                                isCurrentTurn
                                  ? 'bg-sky-50 border-sky-300'
                                  : 'bg-slate-50/60 border-slate-100'
                              }`}
                            >
                              <div className="leading-relaxed space-x-1.5">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    turn.role === 'male'
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : turn.role === 'female'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {turn.role === 'male'
                                    ? `👨 男聲・${turn.speaker}`
                                    : turn.role === 'female'
                                      ? `👩 女聲・${turn.speaker}`
                                      : `📢 ${turn.speaker}`}
                                </span>
                                <FuriganaText
                                  text={turn.displayLineJp}
                                  className="font-jp text-slate-800"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  speakJapanese(
                                    turn.spokenTextJp,
                                    effectiveSpeechRate,
                                    turn.role
                                  )
                                }
                                title="單句重聽（不讀男/女標籤）"
                                className="p-1.5 rounded-md text-[#0284C7] hover:bg-sky-100 shrink-0 cursor-pointer"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Reading Passage Box (if passageJp is provided) */}
                {q.passageJp && (
                  <div className="bg-slate-50 border-l-4 border-slate-800 rounded-r-xl p-4 font-jp text-sm sm:text-base text-slate-900 leading-loose whitespace-pre-line">
                    {q.passageJp}
                  </div>
                )}

                {/* Question Prompt */}
                <div className="text-sm sm:text-base font-bold text-slate-900 font-jp whitespace-pre-line leading-relaxed">
                  {q.promptJp}
                </div>

                {/* 4 Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = pickedIdx === optIdx;
                    const isCorrect = optIdx === q.correctIndex;
                    let optionStyle =
                      'bg-white text-slate-800 border-slate-200 hover:border-sky-400';

                    if (isSubmitted) {
                      if (isCorrect) {
                        optionStyle =
                          'bg-emerald-50 text-emerald-950 border-2 border-emerald-500 font-bold shadow-xs';
                      } else if (isSelected) {
                        optionStyle =
                          'bg-rose-50 text-rose-900 border-2 border-rose-500 font-bold shadow-xs';
                      }
                    } else if (isSelected) {
                      optionStyle =
                        'bg-sky-50 text-[#0284C7] border-2 border-[#0284C7] font-bold ring-1 ring-[#0284C7]';
                    }

                    let badgeCircleStyle = 'bg-slate-100 text-slate-700 border-slate-300';
                    if (isSubmitted) {
                      if (isCorrect) {
                        badgeCircleStyle = 'bg-emerald-600 text-white border-emerald-600';
                      } else if (isSelected) {
                        badgeCircleStyle = 'bg-rose-600 text-white border-rose-600';
                      }
                    } else if (isSelected) {
                      badgeCircleStyle = 'bg-[#0284C7] text-white border-[#0284C7]';
                    }

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        data-testid={`mock-q-${globalNumber}-opt-${optIdx}`}
                        onClick={() => handleSelectOption(q.id, optIdx)}
                        className={`flex items-center justify-between gap-2 text-left px-3.5 py-3 rounded-xl border text-xs sm:text-sm font-jp transition-all cursor-pointer ${optionStyle}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono-num font-bold border shrink-0 ${badgeCircleStyle}`}
                          >
                            {optIdx + 1}
                          </span>
                          <span>{opt}</span>
                        </div>
                        {isSubmitted && isCorrect && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-bold shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isSelected ? '✓ 答啱' : '✓ 正解'}</span>
                          </span>
                        )}
                        {isSubmitted && isSelected && !isCorrect && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold shrink-0">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>✗ 你的選擇 (錯)</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Detailed Post-Submission Explanation */}
                {isSubmitted && (
                  <div className="pt-3 border-t border-slate-100 bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {pickedIdx !== undefined ? (
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              pickedIdx === q.correctIndex
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-400'
                                : 'bg-rose-100 text-rose-900 border border-rose-400'
                            }`}
                          >
                            你的選擇：選択肢 {pickedIdx + 1}（{q.options[pickedIdx]}）
                            {pickedIdx === q.correctIndex ? ' ✓ 正確' : ' ✗ 錯誤'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-900 border border-rose-400">
                            你的選擇：未作答 ✗
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-900 border border-emerald-400">
                          正確答案：選択肢 {q.correctIndex + 1}（{q.options[q.correctIndex]}）
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onAskSenseiWithContext(
                            `Sensei，請問喺 JLPT ${selectedLevel} 模擬試呢題：「${q.promptJp}」，點解正確答案係「${q.options[q.correctIndex]}」而唔係其他選項？`,
                            q
                          )
                        }
                        className="inline-flex items-center gap-1 text-[#0284C7] font-semibold hover:underline cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>問 AI 考官詳細拆解</span>
                      </button>
                    </div>
                    <p className="text-slate-700 leading-relaxed">
                      {uiLang === 'ja' ? q.explanationJa : q.explanationHk}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* Right 4 Cols: Sticky JLPT OMR Answer Sheet (マークシート解答用紙) */}
        <aside className="lg:col-span-4 lg:sticky lg:top-20 bg-white border-2 border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="border-b border-slate-200 pb-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-[#0284C7]" />
                <span>
                  {formatBilingual('JLPT 解答用紙 (答案卡)', 'マークシート解答用紙', uiLang)}
                </span>
              </span>
              <span className="text-xs font-mono-num font-bold text-[#0284C7]">
                {answeredCount}/{examQuestions.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {formatBilingual(
                '可隨時直接喺答案卡塗黑選項或點擊題號跳轉。完成後點擊下方「交卷並批改合否判定」。',
                '番号をクリックして移動、または直接マークできます。',
                uiLang
              )}
            </p>
          </div>

          {/* OMR Rows */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {examQuestions.map((q, idx) => {
              const qNum = idx + 1;
              const picked = userAnswers[q.id];
              const flagged = Boolean(flaggedIds[q.id]);
              return (
                <div
                  key={q.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-num font-bold text-slate-900 w-7">
                      問{qNum}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                      {q.section === 'vocab_grammar'
                        ? '言語'
                        : q.section === 'reading'
                          ? '読解'
                          : '聴解'}
                    </span>
                    {flagged && <Flag className="w-3 h-3 text-amber-600" />}
                  </div>

                  {/* 4 OMR Bubbles */}
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2, 3].map((optIdx) => {
                      const isFilled = picked === optIdx;
                      const isRightOpt = optIdx === q.correctIndex;
                      let bubbleClass =
                        'bg-white text-slate-600 border-slate-300 hover:border-slate-500';
                      if (isSubmitted) {
                        if (isRightOpt) {
                          bubbleClass = 'bg-emerald-600 text-white border-emerald-600';
                        } else if (isFilled) {
                          bubbleClass = 'bg-rose-600 text-white border-rose-600';
                        }
                      } else if (isFilled) {
                        bubbleClass = 'bg-slate-900 text-white border-slate-900';
                      }
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          className={`w-6 h-6 rounded-full text-[11px] font-mono-num font-bold border transition-colors cursor-pointer ${bubbleClass}`}
                        >
                          {optIdx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit / Grade Button */}
          <div className="pt-2 border-t border-slate-200 space-y-2">
            <button
              type="button"
              data-testid="submit-jlpt-mock-exam-btn"
              onClick={handleSubmitExam}
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>
                {formatBilingual(
                  '交卷並批改 JLPT 合否判定 (180点満点)',
                  '採点して合否判定結果を見る',
                  uiLang
                )}
              </span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
