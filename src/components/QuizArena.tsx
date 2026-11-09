import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Volume2,
  Shuffle,
  Globe,
  RefreshCw,
  ExternalLink,
  Award,
} from 'lucide-react';
import { JlptLevel, evaluateQuizSession, QuizScoreResult, MistakeRecord } from '../utils/srsEngine';
import { QUIZ_BANK, QuizQuestion } from '../data/jlptCurriculum';
import { UiLang, formatBilingual } from '../data/listeningAndDictionaryData';
import {
  ArenaQuizItem,
  EXTENDED_QUIZ_ARENA_BANK,
  GroundingWebSource,
  getDateSeedNumber,
  pickDynamicQuizQuestions,
} from '../data/dailyTeacherLessonsAndMockExamData';
import { speakJapanese } from './FuriganaText';

interface QuizArenaProps {
  selectedLevel: JlptLevel;
  onSelectLevel: (level: JlptLevel) => void;
  customQuestions: QuizQuestion[];
  onCompleteQuiz: (result: QuizScoreResult) => void;
  onRecordMistakes?: (mistakes: MistakeRecord[]) => void;
  onAskSenseiWithContext: (promptText: string, item?: any) => void;
  uiLang?: UiLang;
  onGoToMockExam?: () => void;
}

const ARENA_TOPICS = [
  {
    id: 'arena-comprehensive',
    zh: 'JLPT 綜合高頻實戰題',
    ja: 'JLPT総合頻出問題',
    query: 'JLPT 日本語能力試験 頻出 語彙 文法 読解 実戦問題',
  },
  {
    id: 'arena-news',
    zh: '日本最新時事新聞題',
    ja: '最新ニュース・時事問題',
    query: '日本 最新ニュース 社会 トレンド 語彙 読解問題',
  },
  {
    id: 'arena-anime',
    zh: '人氣動漫名場面語境題',
    ja: '人気アニメ名セリフ文脈問題',
    query: '日本 人気アニメ 名言 日常会話 文法 語彙問題',
  },
  {
    id: 'arena-traps',
    zh: '歷年必考易錯陷阱題',
    ja: '過去問頻出・ひっかけ問題',
    query: 'JLPT 間違いやすい 類義語 助詞 文法 ひっかけ問題',
  },
  {
    id: 'arena-business',
    zh: '日本職場商務與敬語題',
    ja: 'ビジネス日本語・敬語問題',
    query: '日本 ビジネスメール 敬語 クッション言葉 実戦問題',
  },
];

const LOCAL_ARENA_DB_KEY = 'kotonoha_arena_dynamic_questions_v1';
const LOCAL_ARENA_SYNC_DATE_KEY = 'kotonoha_arena_last_sync_date_v1';

export const QuizArena: React.FC<QuizArenaProps> = ({
  selectedLevel,
  onSelectLevel,
  customQuestions,
  onCompleteQuiz,
  onRecordMistakes,
  onAskSenseiWithContext,
  uiLang = 'bilingual',
  onGoToMockExam,
}) => {
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const [quizSource, setQuizSource] = useState<'standard' | 'custom' | 'ai-web'>('standard');
  const [batchOffset, setBatchOffset] = useState<number>(() => getDateSeedNumber(todayDateStr));
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submittedResult, setSubmittedResult] = useState<QuizScoreResult | null>(null);

  // Persisted dynamic AI/Web questions so the local question bank keeps growing
  const [syncedWebQuestions, setSyncedWebQuestions] = useState<ArenaQuizItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_ARENA_DB_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Latest active AI-generated batch when user clicks "AI 上網搵題目即時出題"
  const [latestAiBatch, setLatestAiBatch] = useState<ArenaQuizItem[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(ARENA_TOPICS[0].id);
  const [customTopicKeyword, setCustomTopicKeyword] = useState<string>('');
  const [isFetchingWebQuiz, setIsFetchingWebQuiz] = useState<boolean>(false);
  const [lastSyncedLabel, setLastSyncedLabel] = useState<string>(() => {
    try {
      return localStorage.getItem(LOCAL_ARENA_SYNC_DATE_KEY) || todayDateStr;
    } catch {
      return todayDateStr;
    }
  });
  const [groundingSources, setGroundingSources] = useState<GroundingWebSource[]>([]);

  const levels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

  // Save syncedWebQuestions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_ARENA_DB_KEY, JSON.stringify(syncedWebQuestions.slice(0, 80)));
    } catch {
      // ignore
    }
  }, [syncedWebQuestions]);

  // Combined question pool for the selected level
  const combinedPoolForLevel = useMemo<ArenaQuizItem[]>(() => {
    const baseStandard: ArenaQuizItem[] = QUIZ_BANK.filter((q) => q.level === selectedLevel).map(
      (q) => ({
        ...q,
        sourceTag: 'JLPT 核心題庫',
      })
    );
    const extended = EXTENDED_QUIZ_ARENA_BANK.filter((q) => q.level === selectedLevel);
    const synced = syncedWebQuestions.filter((q) => q.level === selectedLevel);
    return [...synced, ...extended, ...baseStandard];
  }, [selectedLevel, syncedWebQuestions]);

  // Active 5-question batch
  const activeQuestions = useMemo<ArenaQuizItem[]>(() => {
    if (quizSource === 'custom' && customQuestions.length > 0) {
      return customQuestions.map((q) => ({
        ...q,
        sourceTag: '自訂教材出題',
      }));
    }
    if (quizSource === 'ai-web' && latestAiBatch.length > 0) {
      return latestAiBatch;
    }
    return pickDynamicQuizQuestions(combinedPoolForLevel, selectedLevel, batchOffset, 5);
  }, [quizSource, customQuestions, latestAiBatch, combinedPoolForLevel, selectedLevel, batchOffset]);

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setSubmittedResult(null);
  };

  // Shuffle to next distinct batch of questions
  const handleShuffleQuestions = () => {
    setQuizSource('standard');
    setBatchOffset((prev) => prev + 1);
    handleResetQuiz();
  };

  // Fetch new web-grounded questions from /api/ai/quiz-arena
  const handleFetchWebQuestions = async (isBackgroundSync: boolean = false) => {
    const topicObj = ARENA_TOPICS.find((t) => t.id === selectedTopicId) || ARENA_TOPICS[0];
    const queryToUse = customTopicKeyword.trim() || topicObj.query;

    setIsFetchingWebQuiz(true);
    try {
      const response = await fetch('/api/ai/quiz-arena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: selectedLevel,
          topic: queryToUse,
          questionCount: 5,
        }),
      });
      const data = await response.json();
      if (data && Array.isArray(data.questions) && data.questions.length > 0) {
        const incoming = data.questions as ArenaQuizItem[];
        setSyncedWebQuestions((prev) => [...incoming, ...prev]);
        setLatestAiBatch(incoming);
        if (Array.isArray(data.groundingSources)) {
          setGroundingSources(data.groundingSources);
        }
        const nowTime = new Date().toLocaleTimeString('zh-HK', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const label = `${todayDateStr} ${nowTime}`;
        setLastSyncedLabel(label);
        try {
          localStorage.setItem(LOCAL_ARENA_SYNC_DATE_KEY, label);
        } catch {
          // ignore
        }
        if (!isBackgroundSync) {
          setQuizSource('ai-web');
          handleResetQuiz();
        }
      }
    } catch {
      if (!isBackgroundSync) {
        handleShuffleQuestions();
      }
    } finally {
      setIsFetchingWebQuiz(false);
    }
  };

  // Periodic daily auto-update: if today's date hasn't synced web questions yet, auto-fetch in background
  useEffect(() => {
    try {
      const lastDate = localStorage.getItem(LOCAL_ARENA_SYNC_DATE_KEY) || '';
      if (!lastDate.startsWith(todayDateStr)) {
        handleFetchWebQuestions(true);
      }
    } catch {
      // ignore
    }
  }, [selectedLevel]);

  const answeredCount = Object.keys(selectedAnswers).length;
  const allAnswered = activeQuestions.length > 0 && answeredCount === activeQuestions.length;

  const handleSelectOption = (qIndex: number, optIndex: number) => {
    if (submittedResult) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
  };

  const handleSubmitQuiz = () => {
    if (!allAnswered) return;
    const res = evaluateQuizSession(activeQuestions, selectedAnswers, selectedLevel);
    setSubmittedResult(res);
    onCompleteQuiz(res);

    if (onRecordMistakes) {
      const now = Date.now();
      const missed: MistakeRecord[] = activeQuestions
        .map((q, idx) => {
          const pickedIdx = selectedAnswers[idx];
          if (pickedIdx === undefined || pickedIdx === q.correctIndex) return null;
          return {
            id: `mistake-arena-${q.id}-${now}`,
            questionId: q.id,
            source: 'quiz-arena' as const,
            level: q.level,
            category: q.category,
            questionPrompt: q.question,
            userChosenOption: q.options[pickedIdx] || '未作答',
            correctAnswer: q.options[q.correctIndex] || '',
            explanation: q.explanation,
            timestamp: now,
            mistakeCount: 1,
            convertedToSrs: false,
          };
        })
        .filter(Boolean) as MistakeRecord[];

      if (missed.length > 0) {
        onRecordMistakes(missed);
      }
    }
  };

  return (
    <div data-testid="quiz-arena-stage" className="space-y-6">
      {/* Top Quiz Control Deck */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>
                {formatBilingual('JLPT 實戰隨堂測驗場', 'JLPT実戦問題演習アリーナ', uiLang)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-[#0284C7] font-semibold">
                {selectedLevel} 累積題庫：{combinedPoolForLevel.length} 題
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 font-medium">
                ● 定期更新已同步 ({lastSyncedLabel})
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {quizSource === 'custom' && customQuestions.length > 0
                ? `自訂教材智能題庫 (${customQuestions.length} 題)`
                : quizSource === 'ai-web'
                  ? `AI 連網最新出題特訓 (${selectedLevel} · ${activeQuestions.length} 題)`
                  : formatBilingual(
                      `JLPT ${selectedLevel} 動態輪換實戰測驗（第 ${(Math.abs(batchOffset) % 9) + 1} 組）`,
                      `JLPT ${selectedLevel} ランダム実戦テスト（セット ${(Math.abs(batchOffset) % 9) + 1}）`,
                      uiLang
                    )}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Shuffle Question Set Button */}
            <button
              type="button"
              data-testid="shuffle-quiz-arena-btn"
              onClick={handleShuffleQuestions}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>{formatBilingual('隨機換一組新題目', '別の問題セットに切替', uiLang)}</span>
            </button>

            {onGoToMockExam && (
              <button
                type="button"
                data-testid="arena-to-mock-exam-btn"
                onClick={onGoToMockExam}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5 text-amber-600" />
                <span>{formatBilingual('進入 180分制全真模擬考', '180点満点・公式模試へ', uiLang)}</span>
              </button>
            )}

            {/* Level Selector */}
            <div
              role="group"
              aria-label="選擇測驗級別"
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              {levels.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    onSelectLevel(lvl);
                    setQuizSource('standard');
                    handleResetQuiz();
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedLevel === lvl && quizSource !== 'custom'
                      ? 'bg-[#0284C7] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI Web Search Question Generator & Periodic Auto-Update Bar */}
        <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[#0284C7]" />
              <span>
                {formatBilingual(
                  'AI 連網實時出題器（自動定期從日本網站／新聞／動漫／歷年考點搵題材出新題）：',
                  'AI Web検索・自動問題ジェネレーター（最新ニュース・アニメ・過去問傾向から出題）：',
                  uiLang
                )}
              </span>
            </div>

            {customQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuizSource(quizSource === 'custom' ? 'standard' : 'custom');
                  handleResetQuiz();
                }}
                className="text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
              >
                {quizSource === 'custom'
                  ? '返回動態題庫'
                  : `切換至我嘅自訂教材出題 (${customQuestions.length}題)`}
              </button>
            )}
          </div>

          {/* Topic Preset Pills */}
          <div className="flex flex-wrap gap-1.5">
            {ARENA_TOPICS.map((t) => {
              const isSelected = selectedTopicId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTopicId(t.id);
                    setCustomTopicKeyword('');
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#0284C7] text-white border-[#0284C7]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                  }`}
                >
                  {formatBilingual(t.zh, t.ja, uiLang)}
                </button>
              );
            })}
          </div>

          {/* Custom Topic Input + AI Web Generate Button */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customTopicKeyword}
              onChange={(e) => setCustomTopicKeyword(e.target.value)}
              placeholder={
                uiLang === 'ja'
                  ? '出題してほしいテーマを入力（例：自動詞と他動詞、京都観光、推し活、ビジネス敬語…）'
                  : '輸入你想考嘅主題或弱項（例如：自動詞與他動詞、授受動詞、動漫台詞、日本旅遊、商務敬語...）'
              }
              className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
            <button
              type="button"
              data-testid="ai-web-quiz-arena-btn"
              disabled={isFetchingWebQuiz}
              onClick={() => handleFetchWebQuestions(false)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0284C7] hover:bg-sky-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isFetchingWebQuiz ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>
                    {formatBilingual('AI 連網搜尋並出題中...', 'Web検索で問題作成中...', uiLang)}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {formatBilingual('AI 上網搵題目即時出新題', 'Web検索で新問題を生成', uiLang)}
                  </span>
                </>
              )}
            </button>
          </div>

          {groundingSources.length > 0 && (
            <div className="pt-2 border-t border-sky-200/60 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-700">題目參考網絡來源：</span>
              {groundingSources.map((src, i) => (
                <a
                  key={i}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-[#0284C7] hover:underline"
                >
                  <span className="truncate max-w-[200px]">{src.title}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Diagnostic Score Banner after Submission */}
      {submittedResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              {submittedResult.masteryStatus === 'NOMINAL' ? (
                <span className="text-[#059669]">● NOMINAL 精熟合格</span>
              ) : (
                <span className="text-[#D97706]">▲ ELEVATED REVIEW 建議重點溫習</span>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-slate-600">
                獲得 +{submittedResult.xpEarned} XP
              </span>
            </div>

            <h3 className="text-2xl font-bold text-slate-900 font-mono-num">
              正確率 {submittedResult.accuracyPercent}%（{submittedResult.correct} /{' '}
              {submittedResult.total} 題正確）
            </h3>

            <p className="text-sm text-slate-600">
              {submittedResult.weakCategories.length === 0
                ? '太勁喇！你已經完全掌握呢一組題目嘅核心詞彙同文法邏輯。可以撳「隨機換一組新題目」或「AI 上網搵題目」繼續挑戰！'
                : `系統診斷建議：你可以針對「${submittedResult.weakCategories.join('、')}」題型向 AI 導師要求更多同類練習。`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleShuffleQuestions}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Shuffle className="w-4 h-4 text-[#0284C7]" />
              <span>換下一組新題目</span>
            </button>
            <button
              type="button"
              onClick={() => handleFetchWebQuestions(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI 連網再出 5 條新題</span>
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {activeQuestions.map((q, qIdx) => {
          const userPick = selectedAnswers[qIdx];
          const isCorrect = userPick === q.correctIndex;

          return (
            <div
              key={q.id}
              data-testid={`arena-question-card-${qIdx + 1}`}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono-num font-bold text-slate-800">
                    問題 {qIdx + 1} / {activeQuestions.length}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                    {q.category === 'vocab'
                      ? '文字・語彙'
                      : q.category === 'grammar'
                        ? '文法・助詞'
                        : '読解・語境'}
                  </span>
                  {q.sourceTag && (
                    <span className="px-2 py-0.5 rounded bg-sky-50 text-[#0284C7] border border-sky-200 font-medium">
                      {q.sourceTag}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => speakJapanese(q.question)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#0284C7] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{formatBilingual('朗讀題目', '問題を読み上げる', uiLang)}</span>
                </button>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed whitespace-pre-line font-jp">
                {q.question}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.options.map((opt, optIdx) => {
                  const selected = userPick === optIdx;
                  const rightAnswer = optIdx === q.correctIndex;

                  let styleClass =
                    'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100';
                  if (!submittedResult && selected) {
                    styleClass =
                      'bg-sky-50 border-2 border-[#0284C7] text-sky-950 font-semibold ring-1 ring-[#0284C7]';
                  } else if (submittedResult) {
                    if (rightAnswer) {
                      styleClass =
                        'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-bold shadow-xs';
                    } else if (selected && !rightAnswer) {
                      styleClass =
                        'bg-rose-50 border-2 border-rose-500 text-rose-900 font-bold shadow-xs';
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(qIdx, optIdx)}
                      className={`p-3.5 rounded-lg border text-left text-sm transition-colors flex items-center justify-between gap-3 cursor-pointer font-jp ${styleClass}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-mono-num font-bold text-xs shrink-0 ${
                            submittedResult
                              ? rightAnswer
                                ? 'bg-emerald-600 text-white'
                                : selected
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              : selected
                                ? 'bg-[#0284C7] text-white'
                                : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {optIdx + 1}
                        </span>
                        <span>{opt}</span>
                      </div>
                      {submittedResult && rightAnswer && (
                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-xs font-bold shrink-0">
                          {selected ? '✓ 答啱' : '✓ 正解'}
                        </span>
                      )}
                      {submittedResult && selected && !rightAnswer && (
                        <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-bold shrink-0">
                          ✗ 你的選擇 (錯)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Detailed Explanation after Submission */}
              {submittedResult && (
                <div
                  className={`p-4 rounded-lg border text-xs sm:text-sm space-y-2 ${
                    isCorrect
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50/70 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold flex items-center gap-1.5">
                      {isCorrect ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                          <span>● 回答正確！解題邏輯：</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-[#D97706]" />
                          <span>
                            ▲ 正確答案係（{q.correctIndex + 1}）{q.options[q.correctIndex]}
                          </span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onAskSenseiWithContext(
                          `Sensei，關於呢條 ${q.level} 題目：「${q.question}」，點解答案係「${q.options[q.correctIndex]}」？其他選項喺咩情況下先至會用？`,
                          q
                        )
                      }
                      className="text-xs font-semibold text-[#0284C7] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      問 AI 導師其他選項用法 →
                    </button>
                  </div>
                  <p className="leading-relaxed">{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Action Bar */}
      {!submittedResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div className="text-xs sm:text-sm text-slate-600 font-mono-num">
            目前進度：已作答 {answeredCount} / {activeQuestions.length} 題
          </div>
          <button
            type="button"
            disabled={!allAnswered}
            onClick={handleSubmitQuiz}
            className={`px-6 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
              allAnswered
                ? 'bg-[#0284C7] text-white hover:bg-sky-700 cursor-pointer'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            }`}
          >
            {allAnswered
              ? '交卷並睇 AI 詳解'
              : `請先完成餘下 ${activeQuestions.length - answeredCount} 題`}
          </button>
        </div>
      )}
    </div>
  );
};
