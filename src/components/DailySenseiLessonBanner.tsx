import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Shuffle,
  Globe,
  Volume2,
  BookmarkPlus,
  CheckCircle2,
  BookOpen,
  Headphones,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Gauge,
} from 'lucide-react';
import { JlptLevel } from '../utils/srsEngine';
import { VocabItem, GrammarPoint, getGrammarNuanceJa } from '../data/jlptCurriculum';
import { UiLang, formatBilingual } from '../data/listeningAndDictionaryData';
import {
  DailyTeacherLessonPack,
  DAILY_TEACHER_TOPICS,
  getDailyTeacherPack,
  getDateSeedNumber,
  enrichDailyLessonPack,
} from '../data/dailyTeacherLessonsAndMockExamData';
import { FuriganaText, speakJapanese, speakJapaneseDialogue } from './FuriganaText';

interface DailySenseiLessonBannerProps {
  selectedLevel: JlptLevel;
  uiLang: UiLang;
  onSaveVocabItems: (items: VocabItem[]) => void;
  onAskSenseiWithContext: (promptText: string, item?: any) => void;
  onShuffleStagePool?: () => void;
}

export const DailySenseiLessonBanner: React.FC<DailySenseiLessonBannerProps> = ({
  selectedLevel,
  uiLang,
  onSaveVocabItems,
  onAskSenseiWithContext,
  onShuffleStagePool,
}) => {
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const [packOffset, setPackOffset] = useState<number>(() => getDateSeedNumber(todayDateStr));
  const [activePack, setActivePack] = useState<DailyTeacherLessonPack>(() =>
    getDailyTeacherPack(selectedLevel, getDateSeedNumber(todayDateStr))
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string>(DAILY_TEACHER_TOPICS[0].id);
  const [customTopicInput, setCustomTopicInput] = useState<string>('');
  const [isGeneratingWebLesson, setIsGeneratingWebLesson] = useState<boolean>(false);
  const [savedVocabToast, setSavedVocabToast] = useState<boolean>(false);
  const [quizAnswersMap, setQuizAnswersMap] = useState<Record<number, number>>({});
  const [dialogueRateOverride, setDialogueRateOverride] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Sync pack when level changes
  useEffect(() => {
    setActivePack(getDailyTeacherPack(selectedLevel, packOffset));
    setQuizAnswersMap({});
    setSavedVocabToast(false);
  }, [selectedLevel]);

  const handleRandomShuffleLesson = () => {
    const nextOffset = packOffset + 1;
    setPackOffset(nextOffset);
    setActivePack(getDailyTeacherPack(selectedLevel, nextOffset));
    setQuizAnswersMap({});
    setSavedVocabToast(false);
    if (onShuffleStagePool) {
      onShuffleStagePool();
    }
  };

  const handleGenerateWebGroundedLesson = async () => {
    const chosenTopicObj =
      DAILY_TEACHER_TOPICS.find((t) => t.id === selectedTopicId) || DAILY_TEACHER_TOPICS[0];
    const finalTopic = customTopicInput.trim() || chosenTopicObj.queryPrompt;

    setIsGeneratingWebLesson(true);
    setQuizAnswersMap({});
    setSavedVocabToast(false);

    try {
      const response = await fetch('/api/ai/daily-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: selectedLevel,
          topic: finalTopic,
          category: chosenTopicObj.category,
        }),
      });
      const data = await response.json();
      if (data && data.titleZh && Array.isArray(data.vocabList)) {
        setActivePack(enrichDailyLessonPack(data as DailyTeacherLessonPack));
        setIsExpanded(true);
      }
    } catch {
      handleRandomShuffleLesson();
    } finally {
      setIsGeneratingWebLesson(false);
    }
  };

  const handleSaveAllVocab = () => {
    if (activePack.vocabList.length > 0) {
      onSaveVocabItems(activePack.vocabList);
      setSavedVocabToast(true);
    }
  };

  const grammarPointsList: GrammarPoint[] = [
    activePack.grammarPoint,
    ...(activePack.secondaryGrammarPoint ? [activePack.secondaryGrammarPoint] : []),
  ];

  const allQuizzes = [
    activePack.miniQuiz,
    ...(activePack.extraQuizzes || []),
  ];

  return (
    <section
      data-testid="daily-sensei-lesson-studio"
      aria-label="今日先生特選多元化每日教材"
      className="bg-white border-2 border-sky-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5"
    >
      {/* Top Bar: Teacher Badge + Date + Shuffle / Web Search Grounding Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold bg-[#0284C7] text-white leading-snug">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>
                {formatBilingual(
                  `言の葉先生・每日特選綜合講義 (${todayDateStr})`,
                  `本日の先生厳選カリキュラム (${todayDateStr})`,
                  uiLang
                )}
              </span>
            </span>
            <span className="px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 leading-snug">
              JLPT {selectedLevel} · {formatBilingual(activePack.themeTagZh, activePack.themeTagJa, uiLang)}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
              擴充版：{activePack.vocabList.length} 詞彙 · {grammarPointsList.length} 文法 · {activePack.listeningDialogue.lines.length} 句對話 · {allQuizzes.length} 題隨堂測驗
            </span>
            <span className="text-[11px] sm:text-xs text-slate-500">
              {activePack.sourceLabel}
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            {formatBilingual(activePack.titleZh, activePack.titleJa, uiLang)}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {uiLang === 'ja' ? activePack.teacherIntroJa : activePack.teacherIntroHk}
          </p>
        </div>

        {/* Action Buttons: Random Shuffle + Expand/Collapse */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="shuffle-daily-lesson-btn"
            onClick={handleRandomShuffleLesson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>
              {formatBilingual('隨機換一批新教材', 'ランダム教材切替', uiLang)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <span>{isExpanded ? '收起講義' : '展開講義'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Topic Selector & Live Web Search Grounding Generator Bar */}
      <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-[#0284C7]" />
            <span>
              {formatBilingual(
                '想學邊方面嘅日本最新題材？揀個主題或自訂關鍵字，等老師上網搵資料即時出教材：',
                '学びたい最新テーマを選択（AI先生がWeb検索して生きた教材を作成します）：',
                uiLang
              )}
            </span>
          </div>
        </div>

        {/* Topic Quick Pills */}
        <div className="flex flex-wrap gap-1.5">
          {DAILY_TEACHER_TOPICS.map((topic) => {
            const isSelected = selectedTopicId === topic.id;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => {
                  setSelectedTopicId(topic.id);
                  setCustomTopicInput('');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                  isSelected
                    ? 'bg-[#0284C7] text-white border-[#0284C7]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                }`}
              >
                {formatBilingual(topic.labelZh, topic.labelJa, uiLang)}
              </button>
            );
          })}
        </div>

        {/* Custom Topic Input + AI Web Search Generate Button */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={customTopicInput}
            onChange={(e) => setCustomTopicInput(e.target.value)}
            placeholder={
              uiLang === 'ja'
                ? 'または自由に入力（例：呪術廻戦、京都の抹茶カフェ、日本のIT転職…）'
                : '或者輸入你想學嘅特定題材（例如：吉伊卡哇 Chiikawa、日本新幹線、東京拉麵、IT職場敬語...）'
            }
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
          />
          <button
            type="button"
            data-testid="ai-web-daily-lesson-btn"
            disabled={isGeneratingWebLesson}
            onClick={handleGenerateWebGroundedLesson}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0284C7] hover:bg-sky-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isGeneratingWebLesson ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>
                  {formatBilingual('老師上網搜尋並編寫講義中...', 'Web検索で教材作成中...', uiLang)}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {formatBilingual(
                    'AI 上網搜尋最新題材生成教材',
                    'Web検索で最新教材を生成',
                    uiLang
                  )}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Web Grounding Sources if returned by Live Web Search Grounding */}
        {activePack.groundingSources && activePack.groundingSources.length > 0 && (
          <div className="pt-2 border-t border-sky-200/60 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-700">
              {formatBilingual('參考網絡資訊來源：', '参照Webソース：', uiLang)}
            </span>
            {activePack.groundingSources.map((src, i) => (
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

      {isExpanded && (
        <div className="space-y-5">
          {/* Section ①: Today's 6 Curated Vocabulary Words */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#0284C7]" />
                <span data-testid="daily-vocab-count-heading">
                  {formatBilingual(
                    `① 今日必學重點生字（共 ${activePack.vocabList.length} 個高頻詞彙）`,
                    `① 本日の重要語彙（全 ${activePack.vocabList.length} 語）`,
                    uiLang
                  )}
                </span>
              </div>
              <button
                type="button"
                data-testid="save-daily-pack-vocab-btn"
                onClick={handleSaveAllVocab}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#0284C7] bg-white hover:bg-sky-50 border border-sky-200 rounded-lg transition-colors cursor-pointer"
              >
                {savedVocabToast ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">已加入自訂字庫！</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>
                      {formatBilingual('全部加入記憶庫', 'すべて単語帳へ追加', uiLang)}
                    </span>
                  </>
                )}
              </button>
            </div>

            <div
              data-testid="daily-vocab-grid"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              {activePack.vocabList.map((v, vIdx) => (
                <div
                  key={`${v.id}-${vIdx}`}
                  data-testid={`daily-vocab-card-${vIdx}`}
                  className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-bold text-slate-900 font-jp">
                            {v.kanji}
                          </span>
                          <span className="text-[10px] font-mono-num px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {v.pitchAccent}
                          </span>
                        </div>
                        <div className="text-xs text-[#0284C7] font-semibold font-jp">
                          {v.reading}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => speakJapanese(v.kanji)}
                        aria-label={`朗讀 ${v.kanji}`}
                        className="p-1.5 rounded-md bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-[#0284C7] transition-colors cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-xs font-semibold text-slate-800">{v.meaning}</div>
                    <p className="text-[11px] text-slate-500 leading-snug">{v.coreImage}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-[11px] space-y-0.5">
                    <div className="flex items-start justify-between gap-1">
                      <FuriganaText
                        text={v.exampleJp}
                        className="font-jp text-slate-800 block leading-relaxed flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => speakJapanese(v.exampleJp)}
                        aria-label={`朗讀例句 ${v.kanji}`}
                        className="text-slate-400 hover:text-[#0284C7] p-0.5 shrink-0 cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-slate-500">{v.exampleHk}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section ②: Today's 2 Core Grammar Patterns with BOTH Chinese 語感核心 AND Japanese 日本語解説 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">
                {formatBilingual(
                  `② 今日核心文法雙重點拆解（附中日雙語「語感核心・日本語解説」）`,
                  `② 本日の重要文法ポイント（${grammarPointsList.length}項目・日本語ニュアンス解説付き）`,
                  uiLang
                )}
              </span>
              <span className="px-2 py-0.5 rounded bg-sky-100 text-[#0284C7] text-xs font-mono-num font-bold">
                JLPT {selectedLevel} 文法精修
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {grammarPointsList.map((g, gIdx) => {
                const nuanceJaText = getGrammarNuanceJa(g);
                return (
                  <div
                    key={`${g.id}-${gIdx}`}
                    data-testid={`daily-grammar-card-${gIdx}`}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-500">
                          重點文法 #{gIdx + 1} · 接續：{g.formation}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-sky-50 text-[#0284C7] border border-sky-200 text-[11px] font-mono-num font-bold">
                          {g.level}
                        </span>
                      </div>

                      <div className="text-base sm:text-lg font-bold text-[#0284C7] font-jp">
                        {g.pattern}
                      </div>

                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-slate-900">
                          意思：{g.meaning}
                        </div>
                        {g.meaningJa && (
                          <div className="text-xs font-medium text-slate-700 font-jp">
                            意味（日本語）：{g.meaningJa}
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 leading-relaxed">
                        <div>
                          <strong className="text-slate-900">語感核心（中文）：</strong>
                          <span>{g.nuance}</span>
                        </div>
                        <div
                          data-testid={gIdx === 0 ? 'daily-grammar-nuance-ja' : `daily-grammar-nuance-ja-${gIdx}`}
                          className="pt-2 border-t border-slate-200/80 font-jp text-slate-800"
                        >
                          <strong className="text-[#0284C7]">日本語解説（ニュアンス・用法）：</strong>
                          <span>{nuanceJaText}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-sky-50/50 border border-sky-200/80 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600">地道例句・例文</span>
                        <button
                          type="button"
                          onClick={() => speakJapanese(g.exampleJp)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0284C7] hover:underline cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>朗讀例句</span>
                        </button>
                      </div>
                      <FuriganaText
                        text={g.exampleJp}
                        className="text-xs sm:text-sm font-jp font-semibold text-slate-900 block leading-relaxed"
                      />
                      <div className="text-xs text-slate-600">{g.exampleHk}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grid Row 2: Reading Passage + 4-Line Listening/Speaking Dialogue + 3 Instant Mini Quizzes */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Reading Mini Article (4 cols) */}
            <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    {formatBilingual('③ 今日主題精讀短文', '③ 本日のテーマ読解', uiLang)}
                  </span>
                  <button
                    type="button"
                    onClick={() => speakJapanese(activePack.readingArticle.contentJp)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#0284C7] bg-white border border-sky-200 rounded-md hover:bg-sky-50 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>全文朗讀</span>
                  </button>
                </div>
                <FuriganaText
                  text={activePack.readingArticle.contentJp}
                  className="text-sm font-jp text-slate-900 leading-loose block bg-white p-3 rounded-lg border border-slate-200"
                />
                <p className="text-xs text-slate-600 leading-relaxed">
                  {activePack.readingArticle.translationHk}
                </p>
              </div>

              <div className="text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
                <div>★ 老師文化與語感貼士：{activePack.readingArticle.culturalTipHk}</div>
                {activePack.readingArticle.culturalTipJa && (
                  <div className="font-jp text-amber-900 pt-1 border-t border-amber-200/70">
                    ★ 日本語コラム：{activePack.readingArticle.culturalTipJa}
                  </div>
                )}
              </div>
            </div>

            {/* Listening & Speaking 4-Line Dialogue + 2 Shadowing Drills (4 cols) */}
            <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Headphones className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>
                      {formatBilingual(
                        `④ 聽解與口說跟讀 (${activePack.listeningDialogue.lines.length} 句男女對談)`,
                        `④ 聴解＆シャドーイング (${activePack.listeningDialogue.lines.length}行対話)`,
                        uiLang
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    data-testid="daily-play-dialogue-btn"
                    onClick={() =>
                      speakJapaneseDialogue({
                        dialogueSpeakers: activePack.listeningDialogue.lines,
                        level: selectedLevel,
                        rateOverride: dialogueRateOverride ?? undefined,
                        preferNaturalServerTts: true,
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 rounded-md cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>
                      播放男女雙聲對話 ({dialogueRateOverride ? `${dialogueRateOverride}x` : `${selectedLevel}語速`})
                    </span>
                  </button>
                </div>

                {/* Quick Speed Selector inside Daily Listening */}
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  <Gauge className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-500 font-semibold">對話語速：</span>
                  {[
                    { label: '預設', rate: null },
                    { label: '0.9x', rate: 0.9 },
                    { label: '1.1x', rate: 1.1 },
                    { label: '1.25x 快', rate: 1.25 },
                    { label: '1.45x 特快', rate: 1.45 },
                  ].map((item) => (
                    <button
                      key={String(item.rate)}
                      type="button"
                      onClick={() => setDialogueRateOverride(item.rate)}
                      className={`px-1.5 py-0.5 rounded border font-mono-num cursor-pointer ${
                        dialogueRateOverride === item.rate
                          ? 'bg-[#0284C7] text-white border-[#0284C7] font-bold'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="text-[11px] text-slate-500">
                  情境：{uiLang === 'ja' ? activePack.listeningDialogue.scenarioJa : activePack.listeningDialogue.scenarioZh}
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {activePack.listeningDialogue.lines.map((line, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0284C7]">{line.speaker}：</span>
                        <button
                          type="button"
                          onClick={() =>
                            speakJapaneseDialogue({
                              dialogueSpeakers: [line],
                              level: selectedLevel,
                              rateOverride: dialogueRateOverride ?? undefined,
                              preferNaturalServerTts: true,
                            })
                          }
                          className="text-[11px] text-slate-400 hover:text-[#0284C7] cursor-pointer"
                          title="單句朗讀"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      </div>
                      <FuriganaText
                        text={line.textJp}
                        className="font-jp text-slate-900 block leading-relaxed"
                      />
                      <div className="text-slate-500 text-[11px]">{line.textHk}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#0284C7]">
                    <span>口說跟讀金句 ① (Shadowing)</span>
                    <button
                      type="button"
                      onClick={() => speakJapanese(activePack.listeningDialogue.speakingDrillJp)}
                      className="underline cursor-pointer"
                    >
                      聽示範
                    </button>
                  </div>
                  <FuriganaText
                    text={activePack.listeningDialogue.speakingDrillJp}
                    className="text-xs font-jp font-semibold text-slate-900 block"
                  />
                  <div className="text-[11px] text-slate-600">
                    {activePack.listeningDialogue.speakingDrillHk}
                  </div>
                </div>

                {activePack.listeningDialogue.secondSpeakingDrillJp && (
                  <div className="bg-sky-50/70 border border-sky-200 rounded-lg p-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#0284C7]">
                      <span>進階口說跟讀金句 ②</span>
                      <button
                        type="button"
                        onClick={() =>
                          speakJapanese(activePack.listeningDialogue.secondSpeakingDrillJp!)
                        }
                        className="underline cursor-pointer"
                      >
                        聽示範
                      </button>
                    </div>
                    <FuriganaText
                      text={activePack.listeningDialogue.secondSpeakingDrillJp}
                      className="text-xs font-jp font-semibold text-slate-900 block"
                    />
                    <div className="text-[11px] text-slate-600">
                      {activePack.listeningDialogue.secondSpeakingDrillHk}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Instant Check Mini Quizzes (4 cols - 3 Questions) */}
            <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    {formatBilingual(
                      `⑤ 今日隨堂小測驗（共 ${allQuizzes.length} 題實戰檢測）`,
                      `⑤ 理解度チェック（全 ${allQuizzes.length} 問）`,
                      uiLang
                    )}
                  </span>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {allQuizzes.map((quizItem, qNum) => {
                    const pickedIdx = quizAnswersMap[qNum] ?? null;
                    return (
                      <div
                        key={qNum}
                        data-testid={`daily-mini-quiz-${qNum}`}
                        className="bg-white border border-slate-200 rounded-lg p-3 space-y-2"
                      >
                        <p className="text-xs font-semibold text-slate-900 font-jp leading-relaxed">
                          <span className="text-[#0284C7] font-bold mr-1">Q{qNum + 1}.</span>
                          {quizItem.question}
                        </p>
                        <div className="space-y-1">
                          {quizItem.options.map((opt, idx) => {
                            const isPicked = pickedIdx === idx;
                            const isCorrect = idx === quizItem.correctIndex;
                            let btnClass =
                              'bg-slate-50 text-slate-800 border-slate-200 hover:border-sky-300';
                            if (pickedIdx !== null) {
                              if (isCorrect) {
                                btnClass =
                                  'bg-emerald-50 text-emerald-900 border-emerald-400 font-bold';
                              } else if (isPicked) {
                                btnClass = 'bg-rose-50 text-rose-900 border-rose-300';
                              }
                            }
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() =>
                                  setQuizAnswersMap((prev) => ({ ...prev, [qNum]: idx }))
                                }
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${btnClass}`}
                              >
                                {idx + 1}. {opt}
                              </button>
                            );
                          })}
                        </div>
                        {pickedIdx !== null && (
                          <div className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 leading-relaxed space-y-1">
                            <div>
                              <strong
                                className={
                                  pickedIdx === quizItem.correctIndex
                                    ? 'text-emerald-700'
                                    : 'text-rose-700'
                                }
                              >
                                {pickedIdx === quizItem.correctIndex
                                  ? '✓ 答啱喇！'
                                  : '✗ 再睇真啲：'}
                              </strong>{' '}
                              {quizItem.explanation}
                            </div>
                            {quizItem.explanationJa && (
                              <div className="font-jp text-slate-600 pt-1 border-t border-slate-200">
                                <strong className="text-[#0284C7]">日本語解説：</strong>
                                {quizItem.explanationJa}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onAskSenseiWithContext(
                    `Sensei，我想深入請教今日特選講義「${activePack.titleZh}」入面嘅文法「${activePack.grammarPoint.pattern}」同埋相關造句練習！`,
                    activePack
                  )
                }
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0284C7] bg-white hover:bg-sky-50 border border-sky-200 rounded-lg transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>
                  {formatBilingual('向 AI 老師追問今日講義', 'AI先生に講義を質問', uiLang)}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
