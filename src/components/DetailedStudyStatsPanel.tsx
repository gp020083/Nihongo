import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  BarChart3,
  CalendarClock,
  X,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  BookmarkPlus,
  Trash2,
  MessageSquare,
  Volume2,
  Headphones,
  Eye,
  EyeOff,
  Loader2,
  Gauge,
  Tag,
  Plus,
  Search,
  FileBarChart2,
  Award,
  Layers,
} from 'lucide-react';
import {
  DetailedStudyStats,
  MistakeRecord,
  analyzeMistakeWeaknessSummary,
  MistakeDictationChallenge,
  MistakeDictationEvaluation,
  buildMistakeDictationChallenge,
  evaluateMistakeDictationChallenge,
  DEFAULT_MISTAKE_KNOWLEDGE_TAGS,
  inferDefaultMistakeTags,
  inferGrammarFocusPoint,
  toggleMistakeCustomTag,
  addCustomTagToMistake,
  summarizeKnowledgeBaseTags,
  filterMistakesByKnowledgeTag,
  generateWeeklyMistakeReport,
} from '../utils/srsEngine';
import { UiLang, formatBilingual } from '../data/listeningAndDictionaryData';
import { FuriganaText, speakJapanese } from './FuriganaText';

interface DetailedStudyStatsPanelProps {
  stats: DetailedStudyStats;
  uiLang: UiLang;
  mistakes?: MistakeRecord[];
  onConvertMistakeToSrs?: (mistakeId: string) => void;
  onConvertAllMistakesToSrs?: () => void;
  onRemoveMistake?: (mistakeId: string) => void;
  onUpdateMistakeRecord?: (updated: MistakeRecord) => void;
  onAskSenseiAboutMistake?: (mistake: MistakeRecord) => void;
  onClose: () => void;
  onGoToQuiz: () => void;
  onGoToStudy: () => void;
}

const CUSTOM_TAG_POOL_STORAGE_KEY = 'kotonoha_mistake_custom_tags_v1';

export const DetailedStudyStatsPanel: React.FC<DetailedStudyStatsPanelProps> = ({
  stats,
  uiLang,
  mistakes = [],
  onConvertMistakeToSrs,
  onConvertAllMistakesToSrs,
  onRemoveMistake,
  onUpdateMistakeRecord,
  onAskSenseiAboutMistake,
  onClose,
  onGoToQuiz,
  onGoToStudy,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'mistakes' | 'weekly-report'>(
    'overview'
  );
  const maxDailyMin = Math.max(30, ...stats.dailyStudyMinutes.map((d) => d.minutes));

  // Local overrides map in case parent does not pass onUpdateMistakeRecord
  const [localMistakeOverrides, setLocalMistakeOverrides] = useState<
    Record<string, MistakeRecord>
  >({});

  const effectiveMistakes = useMemo(
    () => mistakes.map((m) => localMistakeOverrides[m.id] || m),
    [mistakes, localMistakeOverrides]
  );

  // User-created custom tags pool persisted in localStorage
  const [extraCustomTags, setExtraCustomTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_TAG_POOL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return ['助詞疑難', '漢字盲點'];
  });

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_TAG_POOL_STORAGE_KEY, JSON.stringify(extraCustomTags));
    } catch {
      // ignore
    }
  }, [extraCustomTags]);

  // Knowledge Base Filter & Custom Tag Input State
  const [selectedKbTag, setSelectedKbTag] = useState<string>('ALL');
  const [kbSearchQuery, setKbSearchQuery] = useState<string>('');
  const [newGlobalTagInput, setNewGlobalTagInput] = useState<string>('');
  const [cardTagInputMap, setCardTagInputMap] = useState<Record<string, string>>({});
  const [openTagPickerCardId, setOpenTagPickerCardId] = useState<string | null>(null);

  const weaknessSummary = useMemo(
    () => analyzeMistakeWeaknessSummary(effectiveMistakes),
    [effectiveMistakes]
  );

  const tagSummaryList = useMemo(
    () => summarizeKnowledgeBaseTags(effectiveMistakes, extraCustomTags),
    [effectiveMistakes, extraCustomTags]
  );

  const filteredMistakes = useMemo(
    () => filterMistakesByKnowledgeTag(effectiveMistakes, selectedKbTag, kbSearchQuery),
    [effectiveMistakes, selectedKbTag, kbSearchQuery]
  );

  const weeklyReport = useMemo(
    () => generateWeeklyMistakeReport(effectiveMistakes, Date.now(), extraCustomTags),
    [effectiveMistakes, extraCustomTags]
  );

  const applyMistakeUpdate = (updated: MistakeRecord) => {
    setLocalMistakeOverrides((prev) => ({ ...prev, [updated.id]: updated }));
    if (onUpdateMistakeRecord) {
      onUpdateMistakeRecord(updated);
    }
  };

  const handleToggleTagOnMistake = (item: MistakeRecord, tag: string) => {
    const updated = toggleMistakeCustomTag(item, tag);
    applyMistakeUpdate(updated);
  };

  const handleAddCustomTagToCard = (item: MistakeRecord, rawTagText?: string) => {
    const raw = (rawTagText ?? cardTagInputMap[item.id] ?? '').trim().replace(/^#/, '');
    if (!raw) return;
    if (!extraCustomTags.includes(raw)) {
      setExtraCustomTags((prev) => Array.from(new Set([...prev, raw])));
    }
    const updated = addCustomTagToMistake(item, raw);
    applyMistakeUpdate(updated);
    setCardTagInputMap((prev) => ({ ...prev, [item.id]: '' }));
  };

  const handleCreateGlobalCustomTag = () => {
    const clean = newGlobalTagInput.trim().replace(/^#/, '');
    if (!clean) return;
    if (!extraCustomTags.includes(clean)) {
      setExtraCustomTags((prev) => Array.from(new Set([...prev, clean])));
    }
    // Also attach to the first mistake if none has it yet so the user immediately sees it in action
    if (effectiveMistakes.length > 0) {
      const target = effectiveMistakes[0];
      const updated = addCustomTagToMistake(target, clean);
      applyMistakeUpdate(updated);
    }
    setSelectedKbTag(clean);
    setNewGlobalTagInput('');
  };

  // Mistake Audio Listening & Blind Dictation Drill State
  const [activeAudioDrillId, setActiveAudioDrillId] = useState<string | null>(null);
  const [hideAnswerProcessMap, setHideAnswerProcessMap] = useState<Record<string, boolean>>({});
  const [dictationChallengeMap, setDictationChallengeMap] = useState<
    Record<string, MistakeDictationChallenge>
  >({});
  const [dictationSpeedModeMap, setDictationSpeedModeMap] = useState<
    Record<string, 'slow' | 'calibrated' | 'native'>
  >({});
  const [dictationInputMap, setDictationInputMap] = useState<Record<string, string>>({});
  const [dictationEvalMap, setDictationEvalMap] = useState<
    Record<string, MistakeDictationEvaluation>
  >({});
  const [loadingAudioDrillId, setLoadingAudioDrillId] = useState<string | null>(null);

  const playDictationSentence = (
    challenge: MistakeDictationChallenge,
    speedMode: 'slow' | 'calibrated' | 'native',
    customAudioUrl?: string
  ) => {
    const rate =
      speedMode === 'slow'
        ? challenge.speedPresets.slowRate
        : speedMode === 'calibrated'
          ? challenge.speedPresets.calibratedRate
          : challenge.speedPresets.nativeRate;

    const audioUrl = customAudioUrl || challenge.audioDataUrl;
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.playbackRate =
        speedMode === 'slow' ? 0.85 : speedMode === 'native' ? 1.05 : 0.95;
      audio
        .play()
        .catch(() => speakJapanese(challenge.cleanSpokenSentenceJp, rate));
      return;
    }
    speakJapanese(challenge.cleanSpokenSentenceJp, rate);
  };

  const handleStartMistakeAudioDrill = async (
    item: MistakeRecord,
    requestedSpeedMode?: 'slow' | 'calibrated' | 'native'
  ) => {
    const speedMode = requestedSpeedMode || dictationSpeedModeMap[item.id] || 'slow';
    setDictationSpeedModeMap((prev) => ({ ...prev, [item.id]: speedMode }));
    setActiveAudioDrillId(item.id);
    // Automatically hide the original question options, wrong/correct answer, and explanation!
    setHideAnswerProcessMap((prev) => ({ ...prev, [item.id]: true }));

    // Immediately prepare deterministic fallback challenge so UI + audio respond with zero delay
    const initialChallenge =
      dictationChallengeMap[item.id] || buildMistakeDictationChallenge(item);
    setDictationChallengeMap((prev) => ({ ...prev, [item.id]: initialChallenge }));
    playDictationSentence(initialChallenge, speedMode);

    // Fetch AI-generated speed-adjusted listening sentence & audio from backend
    setLoadingAudioDrillId(item.id);
    try {
      const response = await fetch('/api/ai/mistake-listening-drill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionPrompt: item.questionPrompt,
          correctAnswer: item.correctAnswer,
          userChosenOption: item.userChosenOption,
          level: item.level,
          category: item.category,
          speedMode,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data && !data.fallbackToLocalEngine && data.dictationSentenceJp) {
          const enriched = buildMistakeDictationChallenge(item, {
            targetFocusJp: data.targetFocusJp,
            targetFocusReading: data.targetFocusReading,
            dictationSentenceJp: data.dictationSentenceJp,
            cleanSpokenSentenceJp: data.cleanSpokenSentenceJp,
            translationHk: data.translationHk,
            listeningHintHk: data.listeningHintHk,
            listeningHintJa: data.listeningHintJa,
            tokenBank: Array.isArray(data.tokenBank) ? data.tokenBank : undefined,
            audioDataUrl: data.audioDataUrl,
          });
          setDictationChallengeMap((prev) => ({ ...prev, [item.id]: enriched }));
          playDictationSentence(enriched, speedMode, data.audioDataUrl);
        }
      }
    } catch {
      // Initial local challenge is already active and playing
    } finally {
      setLoadingAudioDrillId(null);
    }
  };

  const handleSubmitDictation = (item: MistakeRecord) => {
    const challenge =
      dictationChallengeMap[item.id] || buildMistakeDictationChallenge(item);
    const userText = dictationInputMap[item.id] || '';
    const evaluation = evaluateMistakeDictationChallenge({
      challenge,
      userDictationText: userText,
    });
    setDictationEvalMap((prev) => ({ ...prev, [item.id]: evaluation }));
    // Reveal the answer process once the user completes the dictation check
    if (userText.trim()) {
      setHideAnswerProcessMap((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const allSelectableTags = useMemo(() => {
    const presetNames = DEFAULT_MISTAKE_KNOWLEDGE_TAGS.map((p) => p.tag);
    return Array.from(new Set([...presetNames, ...extraCustomTags]));
  }, [extraCustomTags]);

  return (
    <div
      data-testid="detailed-stats-panel"
      role="region"
      aria-label={formatBilingual('詳細學習數據面板', '詳細学習データパネル', uiLang)}
      className="mt-4 pt-4 border-t border-slate-200 bg-slate-50/90 rounded-xl p-3.5 sm:p-5 space-y-4"
    >
      {/* Header Bar + 3-Way Tab Switcher (Overview / Mistake Knowledge Base / Weekly Report) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="學習數據、錯題知識庫與錯題周報切換"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/80 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              data-testid="stats-tab-overview"
              onClick={() => setActiveTab('overview')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-white text-[#0284C7] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>
                {formatBilingual('學習數據總覽', '学習データ概要', uiLang)}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'mistakes'}
              data-testid="stats-tab-mistakes"
              onClick={() => setActiveTab('mistakes')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'mistakes'
                  ? 'bg-white text-rose-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>
                {formatBilingual('錯題知識庫・分析', '誤答知識庫・弱点分析', uiLang)}
              </span>
              <span
                data-testid="mistake-tab-count-badge"
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono-num ${
                  weaknessSummary.unconvertedCount > 0
                    ? 'bg-rose-100 text-rose-700 font-bold'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {effectiveMistakes.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'weekly-report'}
              data-testid="stats-tab-weekly-report"
              onClick={() => setActiveTab('weekly-report')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'weekly-report'
                  ? 'bg-white text-[#0284C7] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileBarChart2 className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>
                {formatBilingual('錯題周報 (Top 3 語法總結)', '誤答週報 (Top 3 文法)', uiLang)}
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono-num bg-sky-100 text-[#0284C7] font-bold">
                Top 3
              </span>
            </button>
          </div>
        </div>

        <button
          type="button"
          data-testid="close-detailed-stats-btn"
          onClick={onClose}
          aria-label="收起詳細學習數據面板"
          className="self-end sm:self-auto inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          <span>{formatBilingual('收起', '閉じる', uiLang)}</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: Overview Analytics Grid                                        */}
      {/* ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Weekly Average Study Time (本週平均學習時間) */}
          <div
            data-testid="weekly-study-time-card"
            className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>{formatBilingual('本週平均學習時間', '今週の平均学習時間', uiLang)}</span>
                </span>
                <span className="font-mono-num text-[11px] text-slate-400">
                  {formatBilingual(
                    `本週累計 ${stats.weeklyTotalMinutes} 分鐘`,
                    `計 ${stats.weeklyTotalMinutes} 分`,
                    uiLang
                  )}
                </span>
              </div>

              <div className="flex items-baseline gap-1.5 pt-1">
                <span
                  data-testid="weekly-avg-minutes-value"
                  className="text-2xl font-bold font-mono-num text-slate-900"
                >
                  {stats.weeklyAverageMinutesPerDay}
                </span>
                <span className="text-xs font-semibold text-[#0284C7]">
                  {formatBilingual('分鐘 / 日', '分 / 日', uiLang)}
                </span>
              </div>
            </div>

            {/* 7-Day Mini Bar Chart */}
            <div className="space-y-1.5 pt-1">
              <div className="h-16 flex items-end justify-between gap-1.5 px-1 border-b border-slate-100 pb-1.5">
                {stats.dailyStudyMinutes.map((item, idx) => {
                  const heightPx = Math.max(10, Math.round((item.minutes / maxDailyMin) * 44));
                  const isToday = idx === stats.dailyStudyMinutes.length - 1;
                  return (
                    <div
                      key={item.dayLabel}
                      className="flex flex-col items-center gap-1 flex-1"
                    >
                      <span className="text-[10px] font-mono-num text-slate-500">
                        {item.minutes}m
                      </span>
                      <div
                        className={`w-full max-w-[18px] rounded-t transition-all ${
                          isToday ? 'bg-[#0284C7]' : 'bg-sky-200'
                        }`}
                        style={{ height: `${heightPx}px` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between px-1 text-[10px] font-medium text-slate-400">
                {stats.dailyStudyMinutes.map((item) => (
                  <span key={item.dayLabel} className="flex-1 text-center">
                    週{item.dayLabel}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Completed Quizzes Statistics Chart (完成過的測驗數量統計圖表) */}
          <div
            data-testid="quiz-stats-chart"
            className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                  <BarChart3 className="w-3.5 h-3.5 text-[#059669]" />
                  <span>
                    {formatBilingual('完成過的測驗數量統計圖表', '完了テスト数統計チャート', uiLang)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={onGoToQuiz}
                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#0284C7] hover:underline cursor-pointer"
                >
                  <span>{formatBilingual('去測驗', 'テストへ', uiLang)}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-baseline gap-1.5 pt-1">
                <span
                  data-testid="completed-quizzes-count"
                  className="text-2xl font-bold font-mono-num text-slate-900"
                >
                  {stats.totalQuizzesCompleted}
                </span>
                <span className="text-xs font-semibold text-[#059669]">
                  {formatBilingual('份已完成測驗（按級別統計）', '回完了（N5–N1別）', uiLang)}
                </span>
              </div>
            </div>

            {/* N5-N1 Quiz Count Bar Chart */}
            <div className="space-y-1.5 pt-1">
              <div
                role="img"
                aria-label={`已完成測驗統計圖表，共完成 ${stats.totalQuizzesCompleted} 份測驗`}
                className="h-16 flex items-end justify-around gap-2 px-2 border-b border-slate-100 pb-1.5"
              >
                {stats.quizChartBars.map((bar) => {
                  const heightPx = Math.max(8, Math.round((bar.heightPercent / 100) * 42));
                  return (
                    <div
                      key={bar.label}
                      className="flex flex-col items-center gap-1 flex-1"
                    >
                      <span className="text-[10px] font-mono-num font-semibold text-slate-600">
                        {bar.count}
                      </span>
                      <div
                        className={`w-full max-w-[22px] rounded-t transition-all ${
                          bar.count > 0 ? 'bg-[#059669]' : 'bg-slate-200'
                        }`}
                        style={{ height: `${heightPx}px` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-around px-2 text-[10px] font-mono-num font-semibold text-slate-500">
                {stats.quizChartBars.map((bar) => (
                  <span key={bar.label} className="flex-1 text-center">
                    {bar.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card 3: Upcoming Due SRS Review Cards Summary (即將到期的複習卡片數量摘要) */}
          <div
            data-testid="upcoming-reviews-summary"
            className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                  <CalendarClock className="w-3.5 h-3.5 text-[#D97706]" />
                  <span>
                    {formatBilingual('即將到期的複習卡片數量摘要', '期限が近いSRS復習カード', uiLang)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={onGoToStudy}
                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#0284C7] hover:underline cursor-pointer"
                >
                  <span>{formatBilingual('立即複習', '復習する', uiLang)}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg p-2">
                  <div
                    data-testid="due-24h-count"
                    className="text-lg font-bold font-mono-num text-amber-800"
                  >
                    {stats.upcomingReviews.dueNowOr24h}
                  </div>
                  <div className="text-[11px] text-amber-700 font-medium">
                    {formatBilingual('24小時內到期', '24時間以内', uiLang)}
                  </div>
                </div>

                <div className="bg-sky-50/80 border border-sky-200/80 rounded-lg p-2">
                  <div
                    data-testid="due-3d-count"
                    className="text-lg font-bold font-mono-num text-sky-900"
                  >
                    {stats.upcomingReviews.dueWithin3Days}
                  </div>
                  <div className="text-[11px] text-sky-700 font-medium">
                    {formatBilingual('1–3日內到期', '3日以内', uiLang)}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                  <div
                    data-testid="due-7d-count"
                    className="text-lg font-bold font-mono-num text-slate-800"
                  >
                    {stats.upcomingReviews.dueWithin7Days}
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium">
                    {formatBilingual('4–7日內到期', '7日以内', uiLang)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
              <span>
                {formatBilingual('學習中', '学習中', uiLang)}：
                <strong className="font-mono-num text-slate-800">
                  {stats.upcomingReviews.learningCount}
                </strong>
              </span>
              <span>·</span>
              <span>
                {formatBilingual('複習期', '復習期', uiLang)}：
                <strong className="font-mono-num text-slate-800">
                  {stats.upcomingReviews.reviewCount}
                </strong>
              </span>
              <span>·</span>
              <span>
                {formatBilingual('已精熟', '定着済', uiLang)}：
                <strong className="font-mono-num text-[#059669]">
                  {stats.upcomingReviews.masteredCount}
                </strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: Mistake Knowledge Base (錯題知識庫・自訂標籤歸類與聽寫強化)       */}
      {/* ===================================================================== */}
      {activeTab === 'mistakes' && (
        <div
          data-testid="mistake-analysis-tab-panel"
          className="space-y-4"
        >
          {/* Top Weakness Summary & Batch SRS Conversion + Weekly Report Shortcut */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                  {formatBilingual('錯題知識庫 (Knowledge Base)', '誤答ナレッジベース', uiLang)}
                </span>
                <span className="text-slate-600">
                  {formatBilingual(
                    `支援自訂標籤歸類（如「助詞疑難」、「漢字盲點」） · 主要弱項：${weaknessSummary.topWeakCategory}`,
                    `カスタムタグ分類対応（「助詞疑難」「漢字盲點」など） · 最優先弱点：${weaknessSummary.topWeakCategory}`,
                    uiLang
                  )}
                </span>
              </div>

              {/* Category distribution pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {weaknessSummary.byCategory.map((cat) => (
                  <span
                    key={cat.category}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono-num border ${
                      cat.count > 0
                        ? 'bg-amber-50/80 text-amber-900 border-amber-200 font-semibold'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {formatBilingual(cat.labelZh, cat.labelJa, uiLang)}: {cat.count}
                  </span>
                ))}
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono-num bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                  {formatBilingual('已轉化 SRS 卡', 'SRS変換済', uiLang)}:{' '}
                  {weaknessSummary.convertedCount} / {weaknessSummary.totalMistakes}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="open-weekly-report-btn"
                onClick={() => setActiveTab('weekly-report')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#0284C7] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors cursor-pointer"
              >
                <FileBarChart2 className="w-3.5 h-3.5" />
                <span>
                  {formatBilingual(
                    '查看錯題周報 (本週 Top 3 語法點)',
                    '誤答週報を見る (今週のTop 3文法)',
                    uiLang
                  )}
                </span>
              </button>

              {weaknessSummary.unconvertedCount > 0 ? (
                <button
                  type="button"
                  data-testid="convert-all-mistakes-srs-btn"
                  onClick={onConvertAllMistakesToSrs}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#0284C7] hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {formatBilingual(
                      `一鍵將 ${weaknessSummary.unconvertedCount} 題錯題轉為 SRS 複習卡`,
                      `${weaknessSummary.unconvertedCount}件の誤答をすべてSRS復習カード化`,
                      uiLang
                    )}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onGoToStudy}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {formatBilingual(
                      '全部錯題已加入 SRS！前往精修複習',
                      'すべてSRS追加済！復習へ進む',
                      uiLang
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Mistake Knowledge Base Tag Filter & Custom Tag Creator Bar */}
          <div
            data-testid="mistake-knowledge-base-toolbar"
            className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Tag className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>
                  {formatBilingual(
                    '錯題知識庫標籤篩選（點擊標籤歸類檢視，或新增自訂標籤）：',
                    '誤答知識庫タグフィルター（タグ別表示・新規カスタムタグ作成）：',
                    uiLang
                  )}
                </span>
              </div>

              {/* Search + New Custom Tag Creator */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    data-testid="mistake-kb-search-input"
                    value={kbSearchQuery}
                    onChange={(e) => setKbSearchQuery(e.target.value)}
                    placeholder="搜尋錯題關鍵字／語法／標籤..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#0284C7]"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    data-testid="new-custom-tag-input"
                    value={newGlobalTagInput}
                    onChange={(e) => setNewGlobalTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateGlobalCustomTag();
                      }
                    }}
                    placeholder="新增自訂標籤（如：副詞呼應）"
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#0284C7]"
                  />
                  <button
                    type="button"
                    data-testid="add-custom-tag-btn"
                    onClick={handleCreateGlobalCustomTag}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{formatBilingual('新增標籤', 'タグ追加', uiLang)}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Tag Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                data-testid="kb-tag-filter-ALL"
                onClick={() => setSelectedKbTag('ALL')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  selectedKbTag === 'ALL'
                    ? 'bg-[#0284C7] text-white border-[#0284C7]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>{formatBilingual('全部錯題', 'すべて', uiLang)}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono-num ${
                    selectedKbTag === 'ALL'
                      ? 'bg-sky-800 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {effectiveMistakes.length}
                </span>
              </button>

              {tagSummaryList.map((tItem) => {
                const isSelected = selectedKbTag === tItem.tag;
                return (
                  <button
                    key={tItem.tag}
                    type="button"
                    data-testid={`kb-tag-filter-${tItem.tag}`}
                    onClick={() =>
                      setSelectedKbTag((prev) => (prev === tItem.tag ? 'ALL' : tItem.tag))
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#0284C7] text-white border-[#0284C7]'
                        : tItem.count > 0
                          ? 'bg-sky-50/70 text-slate-800 border-sky-200 hover:bg-sky-100'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>#{tItem.tag}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono-num ${
                        isSelected
                          ? 'bg-sky-800 text-white'
                          : tItem.count > 0
                            ? 'bg-sky-100 text-[#0284C7]'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {tItem.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mistake Items List */}
          {filteredMistakes.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="text-sm font-bold text-slate-900">
                {selectedKbTag !== 'ALL' || kbSearchQuery.trim()
                  ? formatBilingual(
                      `「#${selectedKbTag}」分類下暫無符合條件嘅錯題`,
                      `「#${selectedKbTag}」に一致する誤答はありません`,
                      uiLang
                    )
                  : formatBilingual(
                      '目前暫無錯題紀錄！',
                      '現在、誤答記録はありません！',
                      uiLang
                    )}
              </div>
              {selectedKbTag !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedKbTag('ALL');
                    setKbSearchQuery('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#0284C7] bg-sky-50 border border-sky-200 cursor-pointer"
                >
                  {formatBilingual('返回顯示全部錯題', 'すべての誤答を表示', uiLang)}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredMistakes.map((item) => {
                const isAudioDrillOpen = activeAudioDrillId === item.id;
                const isAnswerProcessHidden = Boolean(
                  isAudioDrillOpen && hideAnswerProcessMap[item.id]
                );
                const challenge =
                  dictationChallengeMap[item.id] || buildMistakeDictationChallenge(item);
                const currentSpeedMode = dictationSpeedModeMap[item.id] || 'slow';
                const currentDictationText = dictationInputMap[item.id] || '';
                const dictationEval = dictationEvalMap[item.id];
                const isGeneratingAiAudio = loadingAudioDrillId === item.id;
                const assignedTags = inferDefaultMistakeTags(item);
                const grammarFocusTitle = inferGrammarFocusPoint(item);
                const isTagPickerOpen = openTagPickerCardId === item.id;

                return (
                  <article
                    key={item.id}
                    data-testid="mistake-item-card"
                    className={`bg-white border rounded-xl p-4 flex flex-col justify-between space-y-3 transition-colors ${
                      isAudioDrillOpen
                        ? 'border-[#0284C7] ring-1 ring-sky-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Top Meta Badges + 語音聽力強化 Button */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-bold font-mono-num">
                            {item.level}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                            {item.source === 'mock-exam' ? 'JLPT 模擬考' : '實戰測驗場'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-mono-num font-semibold">
                            錯 {item.mistakeCount} 次
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            data-testid="mistake-audio-drill-btn"
                            onClick={() => {
                              if (isAudioDrillOpen) {
                                setActiveAudioDrillId(null);
                                setHideAnswerProcessMap((prev) => ({
                                  ...prev,
                                  [item.id]: false,
                                }));
                              } else {
                                handleStartMistakeAudioDrill(item, 'slow');
                              }
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                              isAudioDrillOpen
                                ? 'bg-[#0284C7] text-white border-[#0284C7]'
                                : 'bg-sky-50 text-[#0284C7] border-sky-200 hover:bg-sky-100'
                            }`}
                          >
                            <Headphones className="w-3.5 h-3.5" />
                            <span>
                              {formatBilingual(
                                isAudioDrillOpen ? '收起聽力強化' : '語音聽力強化',
                                isAudioDrillOpen ? '聴解強化を閉じる' : '音声聴解強化',
                                uiLang
                              )}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => speakJapanese(item.questionPrompt, 0.92)}
                            title="朗讀題目"
                            className="p-1 text-slate-500 hover:text-[#0284C7] cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          {onRemoveMistake && (
                            <button
                              type="button"
                              onClick={() => onRemoveMistake(item.id)}
                              title="移除此錯題紀錄"
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Grammar Focus Point Subtitle + Custom Knowledge Base Tags Row */}
                      <div
                        data-testid="mistake-card-tags-row"
                        className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="text-[11px] font-bold text-[#0284C7]">
                            考點歸納：{grammarFocusTitle}
                          </span>
                          <button
                            type="button"
                            data-testid={`toggle-card-tag-editor-${item.id}`}
                            onClick={() =>
                              setOpenTagPickerCardId((prev) =>
                                prev === item.id ? null : item.id
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-slate-700 bg-white hover:bg-sky-50 border border-slate-200 cursor-pointer"
                          >
                            <Tag className="w-3 h-3 text-[#0284C7]" />
                            <span>
                              {formatBilingual(
                                isTagPickerOpen ? '完成標籤歸類' : '+ 歸類標籤',
                                isTagPickerOpen ? '完了' : '+ タグ分類',
                                uiLang
                              )}
                            </span>
                          </button>
                        </div>

                        {/* Currently Assigned Tags on this Card */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {assignedTags.map((t) => (
                            <span
                              key={t}
                              data-testid="mistake-assigned-tag-chip"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-100/90 text-[#0284C7] border border-sky-200"
                            >
                              <span>#{t}</span>
                              <button
                                type="button"
                                title={`移除標籤 ${t}`}
                                onClick={() => handleToggleTagOnMistake(item, t)}
                                className="hover:text-rose-600 cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>

                        {/* Expandable Quick Tag Toggle & Custom Tag Input for this Card */}
                        {isTagPickerOpen && (
                          <div
                            data-testid="mistake-card-tag-picker"
                            className="pt-2 border-t border-slate-200 space-y-2"
                          >
                            <div className="text-[11px] text-slate-500 font-medium">
                              點選快速歸類標籤（如「助詞疑難」、「漢字盲點」）：
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {allSelectableTags.map((tagOpt) => {
                                const active = assignedTags.includes(tagOpt);
                                return (
                                  <button
                                    key={tagOpt}
                                    type="button"
                                    onClick={() => handleToggleTagOnMistake(item, tagOpt)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                                      active
                                        ? 'bg-[#0284C7] text-white border-[#0284C7]'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50'
                                    }`}
                                  >
                                    {active ? `✓ #${tagOpt}` : `+ #${tagOpt}`}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                data-testid="card-add-tag-input"
                                value={cardTagInputMap[item.id] || ''}
                                onChange={(e) =>
                                  setCardTagInputMap((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCustomTagToCard(item);
                                  }
                                }}
                                placeholder="輸入此題專屬自訂標籤..."
                                className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#0284C7]"
                              />
                              <button
                                type="button"
                                data-testid="card-add-tag-submit-btn"
                                onClick={() => handleAddCustomTagToCard(item)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer"
                              >
                                加入
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Blind Listening Dictation Mode Shield (Automatically hides question text & answer process!) */}
                      {isAnswerProcessHidden ? (
                        <div
                          data-testid="mistake-answer-hidden-banner"
                          className="bg-slate-900 text-white rounded-xl p-3.5 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>
                                {formatBilingual(
                                  '盲聽聽寫模式：已自動隱藏原題目與答題過程，只播放語音！',
                                  'ブラインド聴解モード：問題文と解答過程を自動非表示中（音声のみ再生）',
                                  uiLang
                                )}
                              </span>
                            </span>
                            <button
                              type="button"
                              data-testid="mistake-reveal-answer-process-btn"
                              onClick={() =>
                                setHideAnswerProcessMap((prev) => ({
                                  ...prev,
                                  [item.id]: false,
                                }))
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-sky-300 shrink-0 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{formatBilingual('顯示答題過程', '解答を表示', uiLang)}</span>
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-300">
                            {uiLang === 'ja'
                              ? challenge.listeningHintJa
                              : challenge.listeningHintHk}
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Question Prompt */}
                          <p
                            data-testid="mistake-question-prompt"
                            className="text-xs sm:text-sm font-bold text-slate-900 font-jp leading-relaxed"
                          >
                            {item.questionPrompt}
                          </p>

                          {/* Wrong Choice vs Correct Answer Comparison */}
                          <div
                            data-testid="mistake-answer-comparison"
                            className="grid grid-cols-2 gap-2 text-xs"
                          >
                            <div className="bg-rose-50/80 border border-rose-200 rounded-lg px-2.5 py-1.5 text-rose-900">
                              <span className="font-bold">✗ 誤選：</span>
                              <span className="font-jp">{item.userChosenOption}</span>
                            </div>
                            <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-emerald-950">
                              <span className="font-bold">✓ 正解：</span>
                              <span className="font-jp font-bold">{item.correctAnswer}</span>
                            </div>
                          </div>

                          {/* Explanation */}
                          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            {item.explanation}
                          </p>
                        </>
                      )}

                      {/* Interactive AI Speed-Adjusted Audio Listening & Dictation Challenge Box */}
                      {isAudioDrillOpen && (
                        <div
                          data-testid="mistake-audio-dictation-panel"
                          className="bg-sky-50/80 border border-sky-200 rounded-xl p-3.5 space-y-3"
                        >
                          {/* Top Row: Speed Presets + Play Button */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                              <Gauge className="w-3.5 h-3.5 text-[#0284C7]" />
                              <span>
                                {formatBilingual(
                                  'AI 語速調整版・弱點聽力聽寫挑戰',
                                  'AI 速度調整版・弱点ディクテーション挑戦',
                                  uiLang
                                )}
                              </span>
                              {isGeneratingAiAudio && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-normal text-[#0284C7]">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>AI 生成語音中...</span>
                                </span>
                              )}
                            </div>

                            {!isAnswerProcessHidden && (
                              <button
                                type="button"
                                onClick={() =>
                                  setHideAnswerProcessMap((prev) => ({
                                    ...prev,
                                    [item.id]: true,
                                  }))
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                <EyeOff className="w-3 h-3" />
                                <span>{formatBilingual('隱藏答題過程', '解答を隠す', uiLang)}</span>
                              </button>
                            )}
                          </div>

                          {/* Speed Switcher + Replay Audio */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(
                              [
                                {
                                  id: 'slow',
                                  testId: 'dictation-speed-slow-btn',
                                  zh: `0.7× 慢速強化`,
                                  ja: `0.7× スロー強化`,
                                },
                                {
                                  id: 'calibrated',
                                  testId: 'dictation-speed-calibrated-btn',
                                  zh: `${challenge.speedPresets.calibratedRate}× ${item.level} 適中語速`,
                                  ja: `${challenge.speedPresets.calibratedRate}× ${item.level} 標準`,
                                },
                                {
                                  id: 'native',
                                  testId: 'dictation-speed-native-btn',
                                  zh: `1.0× 考場原速`,
                                  ja: `1.0× ナチュラル速度`,
                                },
                              ] as const
                            ).map((sp) => {
                              const active = currentSpeedMode === sp.id;
                              return (
                                <button
                                  key={sp.id}
                                  type="button"
                                  data-testid={sp.testId}
                                  onClick={() => {
                                    setDictationSpeedModeMap((prev) => ({
                                      ...prev,
                                      [item.id]: sp.id,
                                    }));
                                    playDictationSentence(challenge, sp.id);
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                                    active
                                      ? 'bg-[#0284C7] text-white border-[#0284C7]'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {formatBilingual(sp.zh, sp.ja, uiLang)}
                                </button>
                              );
                            })}

                            <button
                              type="button"
                              data-testid="dictation-play-audio-btn"
                              onClick={() => playDictationSentence(challenge, currentSpeedMode)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-colors cursor-pointer"
                            >
                              <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
                              <span>
                                {formatBilingual('重播題目語音', '音声を再再生', uiLang)}
                              </span>
                            </button>
                          </div>

                          {/* Token Bank Quick-Compose Helper */}
                          <div className="space-y-1">
                            <div className="text-[11px] text-slate-600 font-medium">
                              {formatBilingual(
                                '點選聽出嘅日文字塊（或直接喺下方輸入完整聽寫句子）：',
                                '聞き取った語句ブロックをタップ（または下に直接入力）：',
                                uiLang
                              )}
                            </div>
                            <div
                              data-testid="dictation-token-bank"
                              className="flex flex-wrap items-center gap-1.5"
                            >
                              {challenge.tokenBank.map((tok, tIdx) => (
                                <button
                                  key={tIdx}
                                  type="button"
                                  onClick={() =>
                                    setDictationInputMap((prev) => ({
                                      ...prev,
                                      [item.id]: `${prev[item.id] || ''}${tok}`,
                                    }))
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-sky-100 border border-sky-200 text-xs font-jp font-semibold text-slate-800 transition-colors cursor-pointer"
                                >
                                  + {tok}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Dictation Input + Fill Sample + Submit Button */}
                          <div className="space-y-2">
                            <input
                              type="text"
                              data-testid="dictation-input"
                              value={currentDictationText}
                              onChange={(e) =>
                                setDictationInputMap((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              placeholder="聽完語音後，喺呢度默寫你聽到嘅日文句子（漢字或平假名皆可）..."
                              className="w-full px-3 py-2 text-xs bg-white border border-sky-200 rounded-lg font-jp text-slate-900 focus:outline-none focus:border-[#0284C7]"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <button
                                type="button"
                                data-testid="dictation-fill-sample-btn"
                                onClick={() => {
                                  setDictationInputMap((prev) => ({
                                    ...prev,
                                    [item.id]: challenge.cleanSpokenSentenceJp,
                                  }));
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 cursor-pointer"
                              >
                                {formatBilingual('填入聽寫示範', 'お手本入力', uiLang)}
                              </button>
                              <button
                                type="button"
                                data-testid="dictation-submit-btn"
                                onClick={() => handleSubmitDictation(item)}
                                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                              >
                                {formatBilingual('核對聽寫答案', 'ディクテーション採点', uiLang)}
                              </button>
                            </div>
                          </div>

                          {/* Dictation Evaluation Result */}
                          {dictationEval && (
                            <div
                              data-testid="dictation-evaluation-report"
                              className="bg-white border border-sky-200 rounded-xl p-3 space-y-2 text-xs"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span
                                  data-testid="dictation-score-badge"
                                  className={`px-2 py-0.5 rounded font-bold ${
                                    dictationEval.grade === 'PERFECT'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                      : dictationEval.grade === 'GOOD'
                                        ? 'bg-sky-50 text-[#0284C7] border border-sky-200'
                                        : 'bg-rose-50 text-rose-800 border border-rose-300'
                                  }`}
                                >
                                  聽寫準確度：{dictationEval.accuracyScore}%（
                                  {dictationEval.focusPointHit
                                    ? `✓ 成功聽出弱點「${challenge.targetFocusJp}」`
                                    : `△ 留意弱點「${challenge.targetFocusJp}」`}
                                  ）
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {challenge.generatedBy === 'ai-sensei'
                                    ? 'AI 生成題目'
                                    : '內置弱點聽寫'}
                                </span>
                              </div>

                              {/* Character-by-character diff */}
                              <div
                                data-testid="dictation-char-diffs"
                                className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 rounded-lg border border-slate-200 font-jp text-xs"
                              >
                                {dictationEval.charDiffs.map((tok, idx) => (
                                  <span
                                    key={idx}
                                    className={`px-1.5 py-0.5 rounded font-bold ${
                                      tok.status === 'matched'
                                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                                    }`}
                                  >
                                    {tok.char}
                                  </span>
                                ))}
                              </div>

                              <div className="space-y-1 pt-1 border-t border-slate-100">
                                <div className="font-jp font-bold text-slate-900">
                                  原句：
                                  <FuriganaText
                                    text={challenge.dictationSentenceJp}
                                    showFurigana={true}
                                  />
                                </div>
                                <div className="text-slate-600">{challenge.translationHk}</div>
                                <div className="text-[#0284C7] font-semibold">
                                  {uiLang === 'ja'
                                    ? dictationEval.feedbackJa
                                    : dictationEval.feedbackHk}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Footer: Convert to Targeted SRS Card + Ask Sensei */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      {item.convertedToSrs ? (
                        <button
                          type="button"
                          onClick={onGoToStudy}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {formatBilingual(
                              '已轉為 SRS 複習卡 (點此複習)',
                              'SRSカード変換済 (復習へ)',
                              uiLang
                            )}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid="convert-mistake-srs-btn"
                          onClick={() =>
                            onConvertMistakeToSrs && onConvertMistakeToSrs(item.id)
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0284C7] hover:bg-sky-700 transition-colors cursor-pointer"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          <span>
                            {formatBilingual(
                              '轉化為針對性 SRS 複習卡',
                              'SRS復習カードに変換',
                              uiLang
                            )}
                          </span>
                        </button>
                      )}

                      {onAskSenseiAboutMistake && (
                        <button
                          type="button"
                          onClick={() => onAskSenseiAboutMistake(item)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{formatBilingual('問 AI 導師', 'AI講師に質問', uiLang)}</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: Weekly Mistake Report (錯題周報：自動總結本週最常犯錯的三個語法點) */}
      {/* ===================================================================== */}
      {activeTab === 'weekly-report' && (
        <div
          data-testid="mistake-weekly-report-view"
          className="space-y-4"
        >
          {/* Weekly Report Executive Summary Banner */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-sky-100 text-[#0284C7] text-xs font-bold">
                    {formatBilingual('錯題周報摘要視圖', '週間誤答レポート要約', uiLang)}
                  </span>
                  <span className="text-xs font-mono-num text-slate-500">
                    統計週期：{weeklyReport.weekRangeLabel}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {formatBilingual(
                    '本週最常犯錯的三個語法點・深度診斷與擊破方案',
                    '今週最も間違えた3大文法ポイント・弱点診断レポート',
                    uiLang
                  )}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('mistakes')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors self-start lg:self-auto cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>
                  {formatBilingual('返回錯題知識庫管理標籤', '誤答知識庫へ戻る', uiLang)}
                </span>
              </button>
            </div>

            {/* 4 Key Weekly KPI Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[11px] text-slate-500 font-medium">
                  {formatBilingual('本週累計錯題題數', '今週の誤答問題数', uiLang)}
                </div>
                <div
                  data-testid="weekly-report-card-count"
                  className="text-xl font-bold font-mono-num text-slate-900 mt-0.5"
                >
                  {weeklyReport.totalWeeklyMistakeCards} 題
                </div>
              </div>

              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3">
                <div className="text-[11px] text-rose-700 font-medium">
                  {formatBilingual('本週總犯錯次數', '今週の総誤答回数', uiLang)}
                </div>
                <div
                  data-testid="weekly-report-error-hits"
                  className="text-xl font-bold font-mono-num text-rose-900 mt-0.5"
                >
                  {weeklyReport.totalWeeklyErrorHits} 次
                </div>
              </div>

              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3">
                <div className="text-[11px] text-amber-800 font-medium">
                  {formatBilingual('本週頭號高危標籤', '今週の最多弱点タグ', uiLang)}
                </div>
                <div
                  data-testid="weekly-report-top-tag"
                  className="text-base font-bold text-amber-900 mt-1"
                >
                  #{weeklyReport.mostFrequentTag}
                </div>
              </div>

              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
                <div className="text-[11px] text-emerald-800 font-medium">
                  {formatBilingual('SRS 弱點卡轉化率', 'SRSカード変換率', uiLang)}
                </div>
                <div
                  data-testid="weekly-report-srs-rate"
                  className="text-xl font-bold font-mono-num text-emerald-900 mt-0.5"
                >
                  {weeklyReport.srsConversionRatePercent}%
                </div>
              </div>
            </div>
          </div>

          {/* Top 3 Most Frequently Mistaken Grammar Points Grid */}
          <div
            data-testid="weekly-top3-grammar-grid"
            className="grid grid-cols-1 lg:grid-cols-3 gap-4"
          >
            {weeklyReport.topThreeGrammarPoints.map((gItem) => {
              const rankBadgeStyle =
                gItem.rank === 1
                  ? 'bg-rose-600 text-white'
                  : gItem.rank === 2
                    ? 'bg-amber-600 text-white'
                    : 'bg-[#0284C7] text-white';

              return (
                <article
                  key={gItem.rank}
                  data-testid={`weekly-top-grammar-card-${gItem.rank}`}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-3">
                    {/* Top Rank + Level + Error Frequency */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold font-mono-num ${rankBadgeStyle}`}
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>TOP {gItem.rank} 語法盲點</span>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] font-bold font-mono-num">
                          {gItem.level}
                        </span>
                      </div>

                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold font-mono-num">
                        本週錯 {gItem.mistakeCount} 次
                      </span>
                    </div>

                    {/* Grammar Point Title & Core Pattern */}
                    <div className="space-y-1">
                      <h4
                        data-testid={`weekly-top-grammar-title-${gItem.rank}`}
                        className="text-sm font-bold text-slate-900 leading-snug"
                      >
                        {gItem.grammarPointTitle}
                      </h4>
                      <div className="text-xs font-jp font-semibold text-[#0284C7] bg-sky-50/80 border border-sky-200 rounded-lg px-2.5 py-1.5">
                        {gItem.corePatternJp}
                      </div>
                    </div>

                    {/* Related Knowledge Base Tags */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {gItem.relatedTags.map((tg) => (
                        <button
                          key={tg}
                          type="button"
                          onClick={() => {
                            setSelectedKbTag(tg);
                            setActiveTab('mistakes');
                          }}
                          className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-[#0284C7] border border-slate-200 transition-colors cursor-pointer"
                        >
                          #{tg}
                        </button>
                      ))}
                    </div>

                    {/* Wrong vs Right Comparison & Spoken Example */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-rose-700 font-jp">
                          {gItem.wrongComparisonJp}
                        </span>
                        <button
                          type="button"
                          onClick={() => speakJapanese(gItem.correctExampleJp, 0.9)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-semibold text-[#0284C7] hover:bg-sky-50 cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>聽正解例句</span>
                        </button>
                      </div>
                      <div className="font-jp font-bold text-slate-900 leading-relaxed">
                        <FuriganaText text={gItem.correctExampleJp} showFurigana={true} />
                      </div>
                    </div>

                    {/* Why Mistaken Diagnosis */}
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-slate-800">
                        {formatBilingual('犯錯原因剖析：', '誤答の原因分析：', uiLang)}
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        {uiLang === 'ja' ? gItem.whyMistakenJa : gItem.whyMistakenHk}
                      </p>
                    </div>

                    {/* Actionable Tip */}
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-950 leading-relaxed">
                      <strong className="text-emerald-800">改善要點：</strong>
                      {gItem.actionableTipHk}
                    </div>
                  </div>

                  {/* Card Footer Action */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (gItem.relatedTags[0]) {
                          setSelectedKbTag(gItem.relatedTags[0]);
                        }
                        setActiveTab('mistakes');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#0284C7] hover:underline cursor-pointer"
                    >
                      <span>查看此語法錯題詳情</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {onAskSenseiAboutMistake && effectiveMistakes[0] && (
                      <button
                        type="button"
                        onClick={() =>
                          onAskSenseiAboutMistake({
                            ...effectiveMistakes[0],
                            questionPrompt: gItem.correctExampleJp,
                            correctAnswer: gItem.grammarPointTitle,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>請 AI 導師出特訓題</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Weekly Knowledge Base Tag Breakdown Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>
                  {formatBilingual(
                    '本週錯題知識庫標籤佔比（點擊標籤即可跳轉過濾）：',
                    '今週の誤答知識庫タグ割合（タップしてフィルタ表示）：',
                    uiLang
                  )}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {weeklyReport.tagBreakdown.slice(0, 6).map((tb) => (
                <button
                  key={tb.tag}
                  type="button"
                  onClick={() => {
                    setSelectedKbTag(tb.tag);
                    setActiveTab('mistakes');
                  }}
                  className="bg-slate-50 hover:bg-sky-50/70 border border-slate-200 rounded-lg p-2.5 text-left space-y-1.5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">#{tb.tag}</span>
                    <span className="font-mono-num text-[11px] text-slate-600">
                      {tb.count} 題 · 累計錯 {tb.totalMistakeHits} 次 ({tb.sharePercent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0284C7] rounded-full"
                      style={{ width: `${Math.max(6, tb.sharePercent)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
