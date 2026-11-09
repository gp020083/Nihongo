import React, { useState, useRef } from 'react';
import {
  Search,
  Volume2,
  Bookmark,
  FileText,
  MessageCircle,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
  Loader2,
  Database,
  RefreshCw,
  Wifi,
  WifiOff,
  Award,
  ArrowRight,
  Cloud,
  Activity,
} from 'lucide-react';
import { UiLang, formatBilingual } from '../data/listeningAndDictionaryData';
import { searchDictionaryEntries } from '../utils/srsEngine';
import {
  SyncedDictionaryEntry,
  mergeDictionaryEntries,
  normalizeDictionaryEntry,
  buildPastExamDrillQuestions,
} from '../utils/localWordDatabase';
import { VocabItem, QuizQuestion } from '../data/jlptCurriculum';
import { FuriganaText, speakJapanese } from './FuriganaText';
import {
  PitchAccentModal,
  PitchVisualizerIconButton,
  PitchTargetWord,
} from './PitchAccentModal';

interface DictionaryViewProps {
  uiLang: UiLang;
  entries: SyncedDictionaryEntry[];
  onUpdateEntries: (nextEntries: SyncedDictionaryEntry[]) => void;
  isOnline: boolean;
  lastSyncedAt: string | null;
  isSyncingCloud: boolean;
  onTriggerCloudSync: () => Promise<void>;
  onSaveWordToSrs: (item: VocabItem) => void;
  onAskSenseiWithContext: (promptText: string, item?: any) => void;
  onStartPastExamQuiz?: (questions: QuizQuestion[]) => void;
  onOpenGoogleDriveSync?: () => void;
}

export const DictionaryView: React.FC<DictionaryViewProps> = ({
  uiLang,
  entries,
  onUpdateEntries,
  isOnline,
  lastSyncedAt,
  isSyncingCloud,
  onTriggerCloudSync,
  onSaveWordToSrs,
  onAskSenseiWithContext,
  onStartPastExamQuiz,
  onOpenGoogleDriveSync,
}) => {
  const [selectedId, setSelectedId] = useState<string>(entries[0]?.id || 'dict-sawayaka');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'related' | 'jlpt' | 'examples'>('all');
  const [isAiSearching, setIsAiSearching] = useState<boolean>(false);
  const [aiStatusBanner, setAiStatusBanner] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [showNoteEditor, setShowNoteEditor] = useState<boolean>(false);

  // Interactive Past Exam Practice Drawer State
  const [showPastExamDrawer, setShowPastExamDrawer] = useState<boolean>(false);
  const [activeDrillIdx, setActiveDrillIdx] = useState<number>(0);
  const [selectedPastOption, setSelectedPastOption] = useState<Record<string, number>>({});
  const [pitchModalWord, setPitchModalWord] = useState<PitchTargetWord | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const pastExamSectionRef = useRef<HTMLDivElement>(null);

  const filteredEntries = searchDictionaryEntries(entries, searchQuery);
  const rawActiveEntry =
    entries.find((e) => e.id === selectedId) ||
    filteredEntries[0] ||
    entries[0];
  const activeEntry = normalizeDictionaryEntry(rawActiveEntry || {}, '爽やか');

  const drillQuestions = buildPastExamDrillQuestions(activeEntry);
  const safeDrillIdx = activeDrillIdx % drillQuestions.length;
  const activeDrill = drillQuestions[safeDrillIdx];

  const handleOpenPastExamPractice = () => {
    if (activeSubTab !== 'all' && activeSubTab !== 'jlpt') {
      setActiveSubTab('all');
    }
    setShowPastExamDrawer(true);
    setActiveDrillIdx((prev) => (showPastExamDrawer ? (prev + 1) % drillQuestions.length : 0));
    window.setTimeout(() => {
      pastExamSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const handleLaunchFullPastExamQuiz = () => {
    if (!onStartPastExamQuiz) return;
    const quizList: QuizQuestion[] = drillQuestions.map((d, idx) => ({
      id: `past-quiz-${activeEntry.id}-${idx}`,
      level: 'N3',
      category: 'vocab',
      question: `【${d.yearTag}】${d.questionJp}\n（${d.questionZh}）`,
      options: d.options,
      correctIndex: d.correctIndex,
      explanation: `【中】${d.explanationZh} ｜ 【日】${d.explanationJa}`,
    }));
    onStartPastExamQuiz(quizList);
  };

  const handleAiLookup = async (customWord?: string) => {
    const rawTarget = (customWord ?? searchQuery).trim();
    const fallbackPool = ['木漏れ日', '推し活', '臨機応変', '試行錯誤', '恩恵'];
    const targetWord =
      rawTarget ||
      fallbackPool.find((w) => !entries.some((e) => e.kanji === w)) ||
      activeEntry.kanji;

    setIsAiSearching(true);
    setAiStatusBanner(null);

    try {
      const response = await fetch('/api/ai/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: targetWord, uiLang: 'bilingual' }),
      });
      const data: Partial<SyncedDictionaryEntry> = await response.json();
      if (data && (data.kanji || targetWord)) {
        const enriched = normalizeDictionaryEntry(
          {
            ...data,
            id: data.id || `dict-ai-${Date.now()}`,
            syncSource: 'ai-live',
            lastSyncedAt: new Date().toLocaleTimeString('zh-HK', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
          targetWord
        );
        const merged = mergeDictionaryEntries(entries, [enriched]);
        onUpdateEntries(merged);
        setSelectedId(enriched.id);
        setActiveDrillIdx(0);
        setAiStatusBanner(
          formatBilingual(
            `✓ AI 已完成「${enriched.kanji}（${enriched.reading}）」深度雙解與考點分析，並已自動存入本地詞庫！`,
            `AIが「${enriched.kanji}」の双解・JLPT考点データを生成し、ローカルDBに保存しました！`,
            uiLang,
            ' / '
          )
        );
      }
    } catch {
      setAiStatusBanner(
        formatBilingual(
          '目前處於離線狀態，已為你從本地詞庫 (Local Database) 載入詞條。',
          'オフラインのため、ローカル辞書データベースから表示しています。',
          uiLang,
          ' / '
        )
      );
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleToggleCollect = (entry: SyncedDictionaryEntry) => {
    const nextState = !savedIds[entry.id];
    setSavedIds((prev) => ({ ...prev, [entry.id]: nextState }));
    if (nextState) {
      const firstEx = entry.examples[0] || {
        jp: `${entry.kanji}を使[つか]って文[ぶん]を作[つく]る。`,
        zh: `用「${entry.kanji}」造句。`,
      };
      onSaveWordToSrs({
        id: `dict-srs-${entry.id}`,
        level: 'N3',
        kanji: entry.kanji,
        reading: entry.reading,
        romaji: entry.romaji,
        partOfSpeech: entry.partOfSpeech,
        pitchAccent: entry.pitchNumber,
        meaning: entry.shortMeaningZh,
        coreImage: entry.chineseDef,
        exampleJp: firstEx.jp,
        exampleHk: firstEx.zh,
      });
    }
  };

  const maxYearCount = Math.max(
    ...(activeEntry?.jlptStats?.yearDistribution?.map((d) => d.count) || [4]),
    4
  );

  const chosenOption = selectedPastOption[activeDrill.id];
  const isQuestionAnswered = chosenOption !== undefined;
  const completedDrillCount = drillQuestions.filter(
    (q) => selectedPastOption[q.id] !== undefined
  ).length;

  return (
    <div data-testid="dictionary-view" className="space-y-6 pb-20">
      {/* Top Search, Local DB Status & Online Auto-Sync Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                {formatBilingual(
                  'AI 日中雙解・JLPT 考點分析辭典',
                  'AI 日中双解・JLPT考点辞典',
                  uiLang
                )}
              </h2>

              {/* Local Database + Online Auto-Sync Indicator Badge */}
              <span
                data-testid="local-db-sync-badge"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                <Database className="w-3 h-3" />
                <span>
                  {formatBilingual(
                    `本地詞庫 (${entries.length} 詞)`,
                    `ローカルDB (${entries.length}語)`,
                    uiLang
                  )}
                </span>
                <span aria-hidden="true">·</span>
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <Wifi className="w-3 h-3" />
                    <span>
                      {formatBilingual('連線自動更新中', '自動同期ON', uiLang)}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <WifiOff className="w-3 h-3" />
                    <span>{formatBilingual('離線模式可用', 'オフライン可', uiLang)}</span>
                  </span>
                )}
              </span>

              {lastSyncedAt && (
                <span className="text-[11px] text-slate-400 font-mono-num">
                  ({formatBilingual('最近同步', '最終同期', uiLang)}: {lastSyncedAt})
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500">
              {formatBilingual(
                '中日雙語並排顯示・內置離線本地詞庫，一經連線即自動從雲端及 AI 擴充最新詞條與歷年真題',
                '中日バイリンガル表示・ローカルDB搭載でオフライン検索＆オンライン自動更新対応',
                uiLang,
                ' ｜ '
              )}
            </p>
          </div>

          {/* Search Input + AI Lookup Button + Cloud Sync Button */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAiLookup();
            }}
            className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto"
          >
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                data-testid="dictionary-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  const matches = searchDictionaryEntries(entries, val);
                  if (matches.length > 0) {
                    setSelectedId(matches[0].id);
                  }
                }}
                placeholder="輸入日文或中文查詞 / 単語検索（例：爽やか / 懐かしい / 契機）..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white"
              />
            </div>

            <button
              type="button"
              data-testid="dict-ai-lookup-btn"
              onClick={() => handleAiLookup()}
              disabled={isAiSearching}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isAiSearching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>
                {isAiSearching
                  ? 'AI 查詞生成中...'
                  : searchQuery.trim()
                    ? formatBilingual('AI 智能查詞', 'AI辞書生成', uiLang)
                    : formatBilingual('AI 智能查詞 / 擴充', 'AI新語生成', uiLang)}
              </span>
            </button>

            <button
              type="button"
              data-testid="dict-sync-btn"
              onClick={() => onTriggerCloudSync()}
              disabled={isSyncingCloud}
              title="從雲端同步最新 JLPT 核心詞條到本地資料庫"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#0284C7] ${isSyncingCloud ? 'animate-spin' : ''}`}
              />
              <span>{formatBilingual('同步詞庫', 'DB同期', uiLang)}</span>
            </button>

            {onOpenGoogleDriveSync && (
              <button
                type="button"
                data-testid="dict-google-drive-btn"
                onClick={onOpenGoogleDriveSync}
                title="將字庫及學習數據儲存至你嘅 Google Drive"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0284C7] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{formatBilingual('Google Drive 雲端儲存', 'Googleドライブ保存', uiLang)}</span>
              </button>
            )}
          </form>
        </div>

        {/* AI Lookup / Sync Confirmation Banner */}
        {aiStatusBanner && (
          <div
            data-testid="dict-ai-status-banner"
            className="px-3.5 py-2 rounded-xl bg-sky-50 border border-sky-200 text-xs font-medium text-sky-900 flex items-center justify-between gap-2"
          >
            <span>{aiStatusBanner}</span>
            <button
              type="button"
              onClick={() => setAiStatusBanner(null)}
              className="text-sky-600 hover:underline text-[11px] shrink-0 cursor-pointer"
            >
              關閉 · 閉じる
            </button>
          </div>
        )}

        {/* Local Database Word Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-medium text-slate-400 whitespace-nowrap shrink-0">
            {formatBilingual('本地詞庫詞條', '収録語一覧', uiLang)}：
          </span>
          {(searchQuery.trim() ? filteredEntries : entries).map((item) => {
            const active = item.id === activeEntry.id;
            return (
              <div
                key={item.id}
                className={`inline-flex items-center rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setActiveDrillIdx(0);
                  }}
                  className="pl-3 pr-2 py-1.5 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{item.kanji}</span>
                  <span className={active ? 'text-rose-100' : 'text-slate-400'}>
                    {item.pitchNumber}
                  </span>
                  {item.syncSource === 'ai-live' && (
                    <span
                      className={`text-[10px] px-1 rounded ${
                        active ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-600'
                      }`}
                    >
                      AI
                    </span>
                  )}
                  {item.syncSource === 'cloud-synced' && (
                    <span
                      className={`text-[10px] px-1 rounded ${
                        active ? 'bg-rose-600 text-white' : 'bg-sky-100 text-[#0284C7]'
                      }`}
                    >
                      雲端
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  data-testid={`dict-strip-pitch-btn-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPitchModalWord({
                      kanji: item.kanji,
                      reading: item.reading,
                      pitchAccent: item.pitchNumber,
                      romaji: item.romaji,
                      partOfSpeech: item.partOfSpeech,
                      meaning: item.shortMeaningZh,
                    });
                  }}
                  title={`查看「${item.kanji}」語調視覺化圖表`}
                  aria-label={`語調視覺化 ${item.kanji}`}
                  className={`pr-2.5 pl-1 py-1.5 border-l transition-colors cursor-pointer flex items-center ${
                    active
                      ? 'border-rose-400 text-white hover:text-sky-100'
                      : 'border-slate-200 text-[#0284C7] hover:text-sky-700'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Dictionary Card Layout (Modeled directly on User's 2 Reference Screenshots with Bilingual Chinese + Japanese UI) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Headword, POS, 簡明釋義 AI生成, 釋義 [中]/[日], 教學例句 */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-7 shadow-xs">
          {/* Top Sub-Tab Navigation (Bilingual Chinese + Japanese) */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-5 text-sm font-medium">
              {(
                [
                  { id: 'all', zh: '完整詞條', ja: 'すべて表示' },
                  { id: 'related', zh: '關聯詞', ja: '関連語' },
                  { id: 'jlpt', zh: 'JLPT考點分析', ja: 'JLPT考点分析' },
                  { id: 'examples', zh: '教學例句', ja: '教学例文' },
                ] as const
              ).map((tab) => {
                const isCurrent = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSubTab(tab.id)}
                    className={`relative pb-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isCurrent
                        ? 'text-slate-900 font-bold'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <span>{formatBilingual(tab.zh, tab.ja, uiLang)}</span>
                    {isCurrent && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-rose-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-slate-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
          </div>

          {/* Headword Block: 爽やか ② / さわやか / sawayaka / 形動 / N2 · N3 · N4 > */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  data-testid="dictionary-headword"
                  className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900"
                >
                  {activeEntry.kanji}
                </h1>
                <button
                  type="button"
                  data-testid="dict-headword-pitch-number-btn"
                  onClick={() =>
                    setPitchModalWord({
                      kanji: activeEntry.kanji,
                      reading: activeEntry.reading,
                      pitchAccent: activeEntry.pitchNumber,
                      romaji: activeEntry.romaji,
                      partOfSpeech: activeEntry.partOfSpeech,
                      meaning: activeEntry.shortMeaningZh,
                    })
                  }
                  title="點擊展開高低音調視覺化互動圖表"
                  className="text-lg font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                >
                  {activeEntry.pitchNumber}
                </button>
                <PitchVisualizerIconButton
                  testId="dict-pitch-visualizer-btn"
                  word={{
                    kanji: activeEntry.kanji,
                    reading: activeEntry.reading,
                    pitchAccent: activeEntry.pitchNumber,
                    romaji: activeEntry.romaji,
                    partOfSpeech: activeEntry.partOfSpeech,
                    meaning: activeEntry.shortMeaningZh,
                  }}
                  uiLang={uiLang}
                  onOpen={setPitchModalWord}
                />
              </div>

              <div className="space-y-0.5 text-base text-slate-700">
                <div className="font-medium tracking-wide">{activeEntry.reading}</div>
                <div className="font-mono-num text-slate-600">{activeEntry.romaji}</div>
              </div>

              {/* POS tag with coral bottom highlight + Interactive Gray JLPT pill */}
              <div className="flex items-center gap-4 pt-1">
                <span className="inline-block text-sm font-semibold text-slate-800 border-b-4 border-rose-300 pb-0.5">
                  {activeEntry.partOfSpeech}
                </span>

                <button
                  type="button"
                  onClick={handleOpenPastExamPractice}
                  title="點擊查看此等級歷年真題考點分析"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-[#EEEEF0] hover:bg-rose-50 hover:text-rose-600 text-xs font-semibold text-slate-700 font-mono-num transition-colors cursor-pointer"
                >
                  <span>{activeEntry.jlptLevels}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Right Native Pronunciation Pill & Speaker Icon */}
            <div className="flex items-center gap-2 pt-2">
              <div className="flex -space-x-2">
                <span className="w-8 h-8 rounded-full bg-rose-100 border-2 border-white flex items-center justify-center text-[11px] font-bold text-rose-700">
                  東京
                </span>
                <span className="w-8 h-8 rounded-full bg-sky-100 border-2 border-white flex items-center justify-center text-[11px] font-bold text-sky-700">
                  標準
                </span>
              </div>
              <button
                type="button"
                onClick={() => speakJapanese(activeEntry.kanji)}
                aria-label={`播放 ${activeEntry.kanji} 發音`}
                className="w-10 h-10 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Section 1: 簡明釋義 · 簡明釈義 [AI生成] */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {formatBilingual('簡明釋義', '簡明釈義', uiLang)}
              </h3>
              <span className="px-1.5 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200 rounded">
                AI生成
              </span>
            </div>

            <div className="bg-[#F2F3F5] rounded-xl px-4 py-3.5 text-base font-medium text-slate-800">
              {activeEntry.shortMeaningZh}
            </div>
          </div>

          {/* Section 2: 釋義 · 詳細釈義 [中] / [日] */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {formatBilingual('釋義', '詳細釈義', uiLang)}
              </h3>
              <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-md bg-[#EEEEF0] text-xs font-medium text-slate-600">
                <span>{formatBilingual('日中雙解並排', '日中双解', uiLang)}</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>

            <div className="bg-[#F2F3F5] rounded-xl p-4 sm:p-5 space-y-4">
              {/* [中] Row */}
              <div className="flex items-start gap-2.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-500 text-white text-xs font-bold shrink-0 mt-0.5">
                  中
                </span>
                <p className="text-base text-slate-800 leading-relaxed">
                  {activeEntry.chineseDef}
                </p>
              </div>

              {/* [日] Row with Speaker */}
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => speakJapanese(activeEntry.japaneseDef, 0.95)}
                  title="朗讀日文定義"
                  className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded bg-slate-500 hover:bg-slate-600 text-white text-xs font-bold shrink-0 mt-0.5 cursor-pointer"
                >
                  <span>日</span>
                  <Volume2 className="w-3 h-3" />
                </button>
                <p className="text-base text-slate-800 leading-relaxed">
                  {activeEntry.japaneseDef}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Furigana Example Sentences (教學例句 · 教学例文) */}
          {(activeSubTab === 'all' || activeSubTab === 'examples') && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  {formatBilingual('教學例句（中日對照＋語音）', '教学例文（中日対訳・音声付）', uiLang)}
                </h3>
                <span className="text-xs text-slate-400 font-mono-num">
                  1/{activeEntry.examples.length}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {activeEntry.examples.map((ex, idx) => (
                  <div
                    key={idx}
                    className="py-4 first:pt-1 last:pb-1 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="text-lg font-medium text-slate-900 leading-loose">
                        <FuriganaText text={ex.jp} showFurigana={true} />
                      </div>
                      <p className="text-sm text-slate-600">{ex.zh}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => speakJapanese(ex.jp)}
                      aria-label={`播放例句 ${idx + 1}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-rose-500 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span className="text-xs font-medium hidden sm:inline">
                        {formatBilingual('播放例句', '例文再生', uiLang)}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optional Personal Note Drawer */}
          {showNoteEditor && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-amber-900">
                {formatBilingual(
                  `「${activeEntry.kanji}」專屬學習筆記`,
                  `「${activeEntry.kanji}」の学習ノート`,
                  uiLang
                )}
              </div>
              <textarea
                rows={2}
                value={userNotes[activeEntry.id] || ''}
                onChange={(e) =>
                  setUserNotes((prev) => ({ ...prev, [activeEntry.id]: e.target.value }))
                }
                placeholder="記低你自己嘅造句、助詞搭配或者記憶口訣 / 自分の例文やメモを記録..."
                className="w-full p-2.5 text-xs bg-white border border-amber-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
          )}
        </div>

        {/* Right Column (5 cols): 關聯詞 (同詞位/近義詞/話題詞) + JLPT考點分析 (考了多少次？ + 歷年真題練習專區) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: 關聯詞 · 関連語 */}
          {(activeSubTab === 'all' || activeSubTab === 'related') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-xs">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900">
                  {formatBilingual('關聯詞', '関連語', uiLang)}
                </h3>
              </div>

              {/* 同詞位 · 同表記 */}
              <div className="grid grid-cols-12 gap-3 items-baseline border-b border-dotted border-slate-200 pb-4">
                <div className="col-span-4 text-xs sm:text-sm font-medium text-slate-500">
                  {formatBilingual('同詞位', '同表記', uiLang)}
                </div>
                <div className="col-span-8 flex flex-wrap gap-3">
                  {activeEntry.relatedWords.sameRegister.map((item, i) => (
                    <span key={i} className="text-base text-slate-900">
                      {item.word}{' '}
                      <span className="text-slate-500 text-sm">{item.reading}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* 近義詞 · 類義語 */}
              <div className="grid grid-cols-12 gap-3 items-baseline border-b border-dotted border-slate-200 pb-4">
                <div className="col-span-4 text-xs sm:text-sm font-medium text-slate-500">
                  {formatBilingual('近義詞', '類義語', uiLang)}
                </div>
                <div className="col-span-8 flex flex-wrap gap-x-4 gap-y-2">
                  {activeEntry.relatedWords.synonyms.map((syn, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setSearchQuery(syn);
                        handleAiLookup(syn);
                      }}
                      className="text-base text-slate-800 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      {syn}
                    </button>
                  ))}
                </div>
              </div>

              {/* 話題詞 · 関連話題語 [AI生成] */}
              <div className="grid grid-cols-12 gap-3 items-baseline">
                <div className="col-span-4 space-y-1">
                  <div className="text-xs sm:text-sm font-medium text-slate-500">
                    {formatBilingual('話題詞', '話題語', uiLang)}
                  </div>
                  <span className="inline-block px-1.5 py-0.5 text-[10px] text-slate-500 border border-slate-200 rounded">
                    AI生成
                  </span>
                </div>
                <div className="col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeEntry.relatedWords.topicWords.map((tw, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setSearchQuery(tw.word);
                        handleAiLookup(tw.word);
                      }}
                      className="text-left text-base text-slate-900 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <span>{tw.word}</span>{' '}
                      <span className="text-sm text-slate-500">{tw.gloss}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Card 2: JLPT考點分析 · JLPT考点分析 */}
          {(activeSubTab === 'all' || activeSubTab === 'jlpt') && (
            <div
              ref={pastExamSectionRef}
              className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-slate-900">
                  {formatBilingual('JLPT考點分析', 'JLPT考点分析', uiLang)}
                </h3>
                <button
                  type="button"
                  onClick={handleOpenPastExamPractice}
                  className="text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  {formatBilingual('目標等級', '目標レベル', uiLang)}：
                  <strong className="text-rose-500 font-mono-num">{activeEntry.jlptLevels}</strong>
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl p-5 space-y-5">
                {/* Coral Frequency Tag (Bilingual Chinese + Japanese) */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-500 text-xs font-semibold">
                    <span>✎</span>
                    <span>
                      {formatBilingual(
                        activeEntry.jlptStats.frequencyLabelZh,
                        activeEntry.jlptStats.frequencyLabelJa,
                        uiLang
                      )}
                    </span>
                  </span>

                  <span className="text-[11px] font-mono-num text-slate-400">
                    {formatBilingual(
                      `已完成真題 ${completedDrillCount}/${drillQuestions.length}`,
                      `過去問演習 ${completedDrillCount}/${drillQuestions.length}`,
                      uiLang
                    )}
                  </span>
                </div>

                {/* [1] 考了多少次？ + Interactive 歷年真題練習 > Button */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-slate-600 text-white text-xs font-bold flex items-center justify-center font-mono-num">
                      1
                    </span>
                    <span className="text-base font-bold text-slate-900">
                      {formatBilingual('考了多少次？', '出題回数は？', uiLang)}
                    </span>
                  </div>

                  <button
                    type="button"
                    data-testid="past-exam-practice-btn"
                    onClick={handleOpenPastExamPractice}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-600 inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  >
                    <span>
                      {formatBilingual('歷年真題練習', '過去問演習', uiLang)} (
                      {drillQuestions.length}題)
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 3-Column Numeric Stat Row (Bilingual Labels) */}
                <div className="grid grid-cols-3 divide-x divide-slate-200 text-center py-2">
                  <div className="px-2">
                    <div className="text-2xl font-bold text-slate-900 font-mono-num">
                      {activeEntry.jlptStats.examAppearances}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {formatBilingual('考試出現次數', '試験出現回数', uiLang)}
                    </div>
                  </div>
                  <div className="px-2">
                    <div className="text-2xl font-bold text-slate-900 font-mono-num">
                      {activeEntry.jlptStats.historicalCount}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {formatBilingual('歷年真題數', '過去問題数', uiLang)}
                    </div>
                  </div>
                  <div className="px-2">
                    <div className="text-2xl font-bold text-slate-900 font-mono-num">
                      {activeEntry.jlptStats.correctRatePercent}%
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {formatBilingual('答對率', '正答率', uiLang)}
                    </div>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="pt-2">
                  <div className="h-24 flex items-end justify-around gap-4 px-6 border-b border-slate-200 pb-2">
                    {activeEntry.jlptStats.yearDistribution.map((bar) => {
                      const heightPct = Math.max(
                        25,
                        Math.round((bar.count / maxYearCount) * 100)
                      );
                      return (
                        <div
                          key={bar.year}
                          className="flex flex-col items-center gap-1.5 flex-1"
                        >
                          <span className="text-[10px] font-mono-num text-slate-500">
                            {bar.count}次
                          </span>
                          <div
                            className="w-5 bg-slate-500 rounded-t transition-all duration-300"
                            style={{ height: `${heightPct}px` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-around px-6 pt-1.5 text-[11px] font-mono-num text-slate-400">
                    {activeEntry.jlptStats.yearDistribution.map((bar) => (
                      <span key={bar.year}>{bar.year}</span>
                    ))}
                  </div>
                </div>

                {/* Interactive Multi-Question Past Exam Practice Studio (歷年真題練習專區) */}
                <div
                  data-testid="past-exam-practice-drawer"
                  className={`rounded-xl p-4 space-y-3.5 border transition-colors ${
                    showPastExamDrawer
                      ? 'bg-rose-50/50 border-rose-300 ring-2 ring-rose-100'
                      : 'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  {/* Top Bar: Question Switcher Pills (真題 1 / 真題 2 / 真題 3) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-rose-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-800">
                        {formatBilingual('歷年真題實戰演練', '過去問ミニテスト演習', uiLang)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {drillQuestions.map((q, qIdx) => {
                        const isCurr = qIdx === safeDrillIdx;
                        const isDone = selectedPastOption[q.id] !== undefined;
                        return (
                          <button
                            key={q.id}
                            type="button"
                            data-testid={`past-exam-tab-${qIdx + 1}`}
                            onClick={() => {
                              setShowPastExamDrawer(true);
                              setActiveDrillIdx(qIdx);
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold font-mono-num transition-colors cursor-pointer ${
                              isCurr
                                ? 'bg-rose-500 text-white'
                                : isDone
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-white text-slate-600 border border-slate-200 hover:border-rose-300'
                            }`}
                          >
                            真題 {qIdx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Question Type & Audio Header */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-rose-600">
                      {activeDrill.yearTag} ·{' '}
                      {formatBilingual(
                        activeDrill.questionTypeZh,
                        activeDrill.questionTypeJa,
                        uiLang
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => speakJapanese(activeDrill.questionJp, 0.95)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500 hover:underline shrink-0 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{formatBilingual('朗讀題目', '問題読上', uiLang)}</span>
                    </button>
                  </div>

                  {/* Bilingual Question Prompt (Japanese Exam Prompt + Chinese Guide) */}
                  <div className="space-y-1">
                    <p
                      data-testid="past-exam-question-jp"
                      className="text-sm font-bold text-slate-900 whitespace-pre-line leading-relaxed"
                    >
                      {activeDrill.questionJp}
                    </p>
                    <p className="text-xs text-slate-500">{activeDrill.questionZh}</p>
                  </div>

                  {/* 4 Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeDrill.options.map((opt, idx) => {
                      const isRight = idx === activeDrill.correctIndex;
                      const isSelected = chosenOption === idx;
                      let cls =
                        'bg-white border-slate-200 text-slate-700 hover:border-rose-300';
                      if (isQuestionAnswered) {
                        if (isRight) {
                          cls =
                            'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold';
                        } else if (isSelected) {
                          cls = 'bg-red-50 border-red-300 text-red-800';
                        }
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          data-testid={`past-exam-option-${idx}`}
                          onClick={() =>
                            setSelectedPastOption((prev) => ({
                              ...prev,
                              [activeDrill.id]: idx,
                            }))
                          }
                          className={`py-2 px-3 rounded-lg border text-xs text-left transition-colors cursor-pointer ${cls}`}
                        >
                          <span className="font-mono-num font-bold mr-1">{idx + 1}.</span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Bilingual Explanation ([中] + [日]) when answered */}
                  {isQuestionAnswered && (
                    <div
                      data-testid="past-exam-bilingual-explanation"
                      className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 space-y-1.5"
                    >
                      <div className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p>
                            <strong className="text-slate-900">【中】解析：</strong>
                            {activeDrill.explanationZh}
                          </p>
                          <p className="text-slate-600">
                            <strong className="text-slate-900">【日】解説：</strong>
                            {activeDrill.explanationJa}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer Actions inside Past Exam Drawer: Next Drill Question + Send to Full Quiz Arena */}
                  <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      data-testid="next-past-exam-question-btn"
                      onClick={() => setActiveDrillIdx((prev) => (prev + 1) % drillQuestions.length)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-rose-300 text-xs font-semibold text-slate-700 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      {formatBilingual(
                        `切換下一題真題 (${safeDrillIdx + 1}/${drillQuestions.length})`,
                        `次の過去問へ (${safeDrillIdx + 1}/${drillQuestions.length})`,
                        uiLang
                      )}
                    </button>

                    {onStartPastExamQuiz && (
                      <button
                        type="button"
                        data-testid="launch-past-exam-quiz-btn"
                        onClick={handleLaunchFullPastExamQuiz}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <span>
                          {formatBilingual(
                            '進入實戰測驗場全真演練',
                            '実戦テストモードで挑戦',
                            uiLang
                          )}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Action Dock (筆記 · ノート | 問導師 · AI質問 | 收藏 · 単語帳 + Search Q) */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        <div className="bg-white/95 backdrop-blur border border-slate-200/90 shadow-lg rounded-full px-7 py-2.5 flex items-center gap-8">
          <button
            type="button"
            onClick={() => setShowNoteEditor((v) => !v)}
            className="flex flex-col items-center gap-0.5 text-slate-700 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span className="text-[11px] font-medium">
              {formatBilingual('筆記', 'ノート', uiLang)}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              onAskSenseiWithContext(
                `Sensei，我喺辭典睇緊「${activeEntry.kanji}（${activeEntry.reading}）」，請幫我比較佢同近義詞（${activeEntry.relatedWords.synonyms.slice(0, 3).join('、')}）嘅語感分別！`,
                activeEntry
              )
            }
            className="flex flex-col items-center gap-0.5 text-slate-700 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-[11px] font-medium font-mono-num">
              {formatBilingual('問導師', 'AI質問', uiLang)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleCollect(activeEntry)}
            className={`flex flex-col items-center gap-0.5 transition-colors cursor-pointer ${
              savedIds[activeEntry.id]
                ? 'text-amber-500 font-semibold'
                : 'text-slate-700 hover:text-rose-500'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span className="text-[11px] font-medium">
              {savedIds[activeEntry.id]
                ? formatBilingual('已收藏', '保存済', uiLang)
                : formatBilingual('收藏', '単語帳', uiLang)}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            searchInputRef.current?.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          aria-label="快速搜尋詞語"
          className="w-12 h-12 rounded-full bg-white border border-slate-200 shadow-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <Search className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Interactive Pitch Accent Visualization Modal */}
      <PitchAccentModal
        word={pitchModalWord}
        uiLang={uiLang}
        onClose={() => setPitchModalWord(null)}
      />
    </div>
  );
};
