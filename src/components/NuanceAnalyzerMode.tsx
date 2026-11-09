import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Volume2,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Layers,
  MessageSquare,
  RefreshCw,
  Sliders,
  Play,
  Square,
} from 'lucide-react';
import {
  JlptLevel,
  DynamicSceneAnalysisResult,
  DYNAMIC_NUANCE_PRESET_SCENES,
  analyzeDynamicChangeSceneLocal,
  TRANSITIVITY_PAIR_CATALOG,
  KANJI_FALSE_FRIENDS_CATALOG,
  DYNAMIC_CORRELATION_SCENARIOS,
  computeDynamicCorrelationState,
  VOICE_EMOTION_PRESETS,
  VoiceEmotionTone,
} from '../utils/srsEngine';
import { UiLang, formatBilingual } from '../data/listeningAndDictionaryData';
import {
  FuriganaText,
  speakJapanese,
  getGlobalVoiceConfig,
  setGlobalVoiceConfig,
  subscribeGlobalVoiceConfig,
} from './FuriganaText';

interface NuanceAnalyzerModeProps {
  selectedLevel: JlptLevel;
  showFurigana: boolean;
  uiLang: UiLang;
  onAskSenseiWithContext: (promptText: string, item?: any) => void;
}

type SigureSubTab = 'dynamic-change' | 'transitivity-pairs' | 'false-friends';

export const NuanceAnalyzerMode: React.FC<NuanceAnalyzerModeProps> = ({
  selectedLevel,
  showFurigana,
  uiLang,
  onAskSenseiWithContext,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SigureSubTab>('dynamic-change');
  const [sceneInput, setSceneInput] = useState<string>('隨著天氣轉冷，暖氣開得越強');
  const [analysisResult, setAnalysisResult] = useState<DynamicSceneAnalysisResult>(() =>
    analyzeDynamicChangeSceneLocal('隨著天氣轉冷，暖氣開得越強', selectedLevel)
  );
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [selectedPairDrillAnswer, setSelectedPairDrillAnswer] = useState<number | null>(null);

  // Interactive Dynamic Correlation (動態同步演練) state
  const [corrScenarioId, setCorrScenarioId] = useState<string>('temp-heating');
  const [corrSliderPercent, setCorrSliderPercent] = useState<number>(75);
  const [corrTransitivityMode, setCorrTransitivityMode] = useState<'transitive' | 'intransitive'>(
    'transitive'
  );
  const [isAutoSweeping, setIsAutoSweeping] = useState<boolean>(false);
  const [playingExampleId, setPlayingExampleId] = useState<string | null>(null);
  const [activeEmotionTone, setActiveEmotionTone] = useState<VoiceEmotionTone>(
    () => getGlobalVoiceConfig().emotionTone
  );

  useEffect(() => {
    return subscribeGlobalVoiceConfig((cfg) => {
      setActiveEmotionTone(cfg.emotionTone);
    });
  }, []);

  const corrState = computeDynamicCorrelationState(
    corrScenarioId,
    corrSliderPercent,
    corrTransitivityMode
  );

  useEffect(() => {
    if (!isAutoSweeping) return;
    const stages = [0, 25, 50, 75, 100];
    let stepIdx = 0;
    setCorrSliderPercent(stages[0]);
    const timer = window.setInterval(() => {
      stepIdx += 1;
      if (stepIdx >= stages.length) {
        setIsAutoSweeping(false);
        const finalState = computeDynamicCorrelationState(
          corrScenarioId,
          100,
          corrTransitivityMode
        );
        speakJapanese(
          finalState.activeBaHodoSentenceJp,
          1.0,
          'female',
          finalState.stage.emotionTone,
          true
        );
        return;
      }
      setCorrSliderPercent(stages[stepIdx]);
    }, 950);
    return () => window.clearInterval(timer);
  }, [isAutoSweeping, corrScenarioId, corrTransitivityMode]);

  const handleAnalyzeScene = async (targetScene?: string) => {
    const finalScene = (targetScene ?? sceneInput).trim() || '隨著天氣轉冷，暖氣開得越強';
    if (targetScene) {
      setSceneInput(targetScene);
    }

    // Immediately show deterministic local analysis so UI is zero-latency, then enrich with AI if available
    const localImmediate = analyzeDynamicChangeSceneLocal(finalScene, selectedLevel);
    setAnalysisResult(localImmediate);
    setIsAnalyzing(true);

    try {
      const res = await fetch('/api/ai/nuance-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneInput: finalScene,
          level: selectedLevel,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (
          data &&
          !data.fallbackToLocalEngine &&
          Array.isArray(data.generatedExamples) &&
          data.generatedExamples.length >= 2
        ) {
          setAnalysisResult(data as DynamicSceneAnalysisResult);
        }
      }
    } catch {
      // Keep localImmediate
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div data-testid="nuance-analyzer-mode" className="space-y-6">
      {/* Top Sigure.tw-Inspired Mode Switcher Header */}
      <div className="bg-white border-2 border-sky-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#0284C7] text-white">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {formatBilingual(
                    '語感解析模式 × 時雨の町風・母語盲點對照圖鑑',
                    'ニュアンス解析＆自他動詞・助詞対照アトラス',
                    uiLang
                  )}
                </span>
              </span>
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                支援「動態同步演練」視覺化滑桿 · 助詞標註 · AI 感情語音演繹
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              {formatBilingual(
                '動態變化場景 AI 拆解（〜につれて・〜にしたがって・〜ば〜ほど・〜とともに）與自他動詞助詞圖表',
                '動態変化シーンAI解析（両側同時変化の文法・助詞）＆自他動詞・同形異義語整理',
                uiLang
              )}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              參考「時雨の町」最受華語學習者推崇嘅「語感圖解＋自他動詞配對＋助詞微差」教學法：你可以直接拉動下方「動態同步演練滑桿」體驗 A 與 B 變數同步變化時「〜ば〜ほど」與「〜につれて」嘅句式變體，或輸入任何生活場景交由 AI 拆解！
            </p>
          </div>

          {/* 3 Sub-Tabs inside Nuance Analyzer Mode */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              data-testid="nuance-subtab-dynamic"
              onClick={() => setActiveSubTab('dynamic-change')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeSubTab === 'dynamic-change'
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              ① 兩邊同步變化・動態同步演練 & AI 解析
            </button>
            <button
              type="button"
              data-testid="nuance-subtab-transitivity"
              onClick={() => setActiveSubTab('transitivity-pairs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeSubTab === 'transitivity-pairs'
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              ② 時雨風・自他動詞配對總表 (が vs を)
            </button>
            <button
              type="button"
              data-testid="nuance-subtab-false-friends"
              onClick={() => setActiveSubTab('false-friends')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeSubTab === 'false-friends'
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              ③ 中日同形異義「地雷漢字」避坑
            </button>
          </div>
        </div>

        {/* SUB-TAB 1: Dynamic Change Scene Nuance & Particle Analyzer */}
        {activeSubTab === 'dynamic-change' && (
          <div className="space-y-6">
            {/* NEW: Interactive Dynamic Correlation Visual Simulator (動態同步演練視覺化工具) */}
            <div
              data-testid="dynamic-correlation-simulator"
              className="bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/60 border-2 border-sky-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs"
            >
              {/* Header + Scenario Selector + Auto-Play Button */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-sky-200/80 pb-3.5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#0284C7] text-white">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>🎛️ 動態同步演練 (Dynamic Correlation Visual Simulator)</span>
                    </span>
                    <span
                      data-testid="dynamic-correlation-emotion-badge"
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300"
                    >
                      <span>當前情境 AI 語音感情：{corrState.stage.emotionBadgeHk}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    拉動下方滑桿改變 <strong>【A 變數（起點條件）】</strong>，即時觀察{' '}
                    <strong>【B 變數（伴隨結果）】</strong> 嘅同步變化幅度，並直觀比較{' '}
                    <span className="font-jp font-bold text-[#0284C7]">「〜ば〜ほど」</span> 與{' '}
                    <span className="font-jp font-bold text-indigo-700">「〜につれて」</span>{' '}
                    嘅句式變體與自他動詞差異！
                  </p>
                </div>

                {/* Scenario Switcher Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {DYNAMIC_CORRELATION_SCENARIOS.map((sc) => {
                    const active = sc.id === corrScenarioId;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        data-testid={`dynamic-scenario-btn-${sc.id}`}
                        onClick={() => {
                          setIsAutoSweeping(false);
                          setCorrScenarioId(sc.id);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#0284C7] text-white border-[#0284C7] shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                        }`}
                      >
                        {uiLang === 'ja' ? sc.titleJa : sc.titleHk}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Slider Control Bar + 5 Stage Quick Buttons + Auto-Sweep */}
              <div className="bg-white border border-sky-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="dynamic-correlation-range-input"
                    className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2"
                  >
                    <span>
                      👉 拖動滑桿改變 A 變數（{corrState.scenario.variableA.nameHk}）：
                    </span>
                    <span
                      data-testid="dynamic-slider-percent-badge"
                      className="px-2 py-0.5 rounded bg-sky-100 text-[#0284C7] font-mono-num text-xs font-extrabold"
                    >
                      變化推進度 {corrState.clampedPercent}%（階段 {corrState.stageIndex + 1}/5）
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="dynamic-correlation-autoplay-btn"
                      onClick={() => setIsAutoSweeping((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        isAutoSweeping
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      {isAutoSweeping ? (
                        <>
                          <Square className="w-3.5 h-3.5" />
                          <span>停止自動演練</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>▶️ 自動演練 A➔B 全程變化並帶感情朗讀</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <input
                  id="dynamic-correlation-range-input"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  aria-label="拉動滑桿改變 A 變數觀察 B 變數與日文文法同步變化"
                  data-testid="dynamic-correlation-slider"
                  value={corrSliderPercent}
                  onChange={(e) => {
                    setIsAutoSweeping(false);
                    setCorrSliderPercent(Number(e.target.value));
                  }}
                  className="w-full h-2.5 bg-sky-100 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                />

                {/* 5 Stage Quick Jump Pills */}
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {corrState.scenario.stages.map((st, idx) => {
                    const isCurrentStage = idx === corrState.stageIndex;
                    const stagePercent = idx * 25;
                    const stepState = computeDynamicCorrelationState(
                      corrScenarioId,
                      stagePercent,
                      corrTransitivityMode
                    );
                    return (
                      <button
                        key={st.stageIndex}
                        type="button"
                        data-testid={`dynamic-stage-btn-${idx}`}
                        onClick={() => {
                          setIsAutoSweeping(false);
                          setCorrSliderPercent(stagePercent);
                        }}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          isCurrentStage
                            ? 'bg-sky-50 border-[#0284C7] ring-1 ring-[#0284C7]'
                            : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                          <span className="truncate">{st.stageLabelHk}</span>
                          <span className="font-mono-num text-[10px] text-[#0284C7] shrink-0">
                            {stepState.formattedValueA}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          ➔ B: {stepState.formattedValueB}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* NEW: Dynamic Correlation Example Sentence Bank Panel (滑桿下方「範例句庫面板」：動態篩選最相關 3 句真實日語例句 + 一鍵點擊發音) */}
              <div
                data-testid="dynamic-correlation-example-bank-panel"
                className="bg-white border-2 border-amber-300/90 rounded-xl p-4 space-y-3 shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-100 pb-2.5">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-amber-500 text-white">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>
                          {formatBilingual(
                            '📚 範例句庫面板（隨滑桿數值動態篩選 Top 3 真實日語例句）',
                            '📚 実例コーパスパネル（スライダー数値連動・関連度Top 3例文）',
                            uiLang
                          )}
                        </span>
                      </span>
                      <span
                        data-testid="dynamic-example-bank-live-vars-badge"
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-[#0284C7] border border-sky-200 font-mono-num"
                      >
                        當前鎖定：A = {corrState.formattedValueA} ➔ B = {corrState.formattedValueB}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600">
                      系統已根據你目前拉動嘅滑桿數值（{corrState.clampedPercent}%），從句庫中即時匹配最貼切嘅{' '}
                      <strong>3 個真實日語例句</strong>；直接點擊例句卡片或發音掣即可<strong>一鍵朗讀</strong>！
                    </p>
                  </div>

                  <button
                    type="button"
                    data-testid="dynamic-example-bank-play-all-btn"
                    onClick={() => {
                      const topFirst = corrState.relevantExamples[0];
                      if (!topFirst) return;
                      setPlayingExampleId(topFirst.id);
                      setGlobalVoiceConfig({ emotionTone: topFirst.emotionTone });
                      speakJapanese(
                        topFirst.sentenceJp,
                        1.0,
                        'female',
                        topFirst.emotionTone,
                        true
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors cursor-pointer shrink-0"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>🔊 一鍵朗讀最高關聯例句 (#1)</span>
                  </button>
                </div>

                {/* Top 3 Dynamically Filtered Examples Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {corrState.relevantExamples.map((ex, idx) => {
                    const isTop1 = idx === 0;
                    const isPlayingThis = playingExampleId === ex.id;
                    return (
                      <div
                        key={ex.id}
                        data-testid={`dynamic-example-bank-item-${idx}`}
                        onClick={() => {
                          setPlayingExampleId(ex.id);
                          setGlobalVoiceConfig({ emotionTone: ex.emotionTone });
                          speakJapanese(ex.sentenceJp, 1.0, 'female', ex.emotionTone, true);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setPlayingExampleId(ex.id);
                            setGlobalVoiceConfig({ emotionTone: ex.emotionTone });
                            speakJapanese(ex.sentenceJp, 1.0, 'female', ex.emotionTone, true);
                          }
                        }}
                        aria-label={`點擊發音第 ${idx + 1} 句相關例句：${ex.cleanSpokenJp}`}
                        className={`rounded-xl p-3.5 border transition-all flex flex-col justify-between space-y-2.5 cursor-pointer text-left ${
                          isPlayingThis
                            ? 'bg-amber-50/90 border-2 border-amber-500 ring-2 ring-amber-200'
                            : isTop1
                              ? 'bg-sky-50/60 border-2 border-[#0284C7] hover:bg-sky-50'
                              : 'bg-slate-50/80 border border-slate-200 hover:border-sky-300 hover:bg-white'
                        }`}
                      >
                        <div className="space-y-2">
                          {/* Top Badges: Rank + Relevance % + Grammar Pattern + Matched Variable Values */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                data-testid={`dynamic-example-relevance-${idx}`}
                                className={`px-2 py-0.5 rounded text-[11px] font-extrabold font-mono-num ${
                                  isTop1
                                    ? 'bg-[#0284C7] text-white'
                                    : 'bg-slate-200 text-slate-800'
                                }`}
                              >
                                TOP {ex.rank} · 關聯度 {ex.relevanceScorePercent}%
                              </span>
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold font-jp bg-indigo-50 text-indigo-800 border border-indigo-200">
                                {ex.grammarPatternBadgeJp}
                              </span>
                            </div>

                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono-num bg-white border border-slate-200 text-slate-700">
                              {ex.matchedValueABadge} ➔ {ex.matchedValueBBadge}
                            </span>
                          </div>

                          {/* Context Tag & Emotion Badge */}
                          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                            <span className="font-bold text-slate-700">
                              📍 {uiLang === 'ja' ? ex.contextTagJa : ex.contextTagHk}
                            </span>
                            <span className="text-amber-800 font-semibold">
                              {ex.emotionBadgeHk}
                            </span>
                          </div>

                          {/* Japanese Sentence with Furigana */}
                          <div
                            data-testid={`dynamic-example-jp-${idx}`}
                            className="bg-white border border-slate-200/90 rounded-lg p-2.5 space-y-1"
                          >
                            <FuriganaText
                              text={ex.sentenceJp}
                              showFurigana={showFurigana}
                              className="text-sm sm:text-base font-extrabold font-jp text-slate-900 block leading-relaxed"
                            />
                            <div className="text-xs text-slate-600 font-medium">
                              {ex.translationHk}
                            </div>
                          </div>

                          {/* Particle & Nuance Micro-Note */}
                          <div className="text-[11px] text-slate-600 bg-white/80 border border-slate-200/70 rounded-md px-2.5 py-1.5 leading-snug">
                            <strong className="text-[#0284C7]">語感要點：</strong>
                            {ex.particleFocusTipHk}
                          </div>
                        </div>

                        {/* One-Click Pronunciation Action Bar */}
                        <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            data-testid={`dynamic-example-speak-btn-${idx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlayingExampleId(ex.id);
                              setGlobalVoiceConfig({ emotionTone: ex.emotionTone });
                              speakJapanese(ex.sentenceJp, 1.0, 'female', ex.emotionTone, true);
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              isTop1
                                ? 'bg-[#0284C7] hover:bg-sky-700 text-white shadow-2xs'
                                : 'bg-white hover:bg-sky-50 text-[#0284C7] border border-sky-300'
                            }`}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>🔊 一鍵發音 ({ex.emotionBadgeHk})</span>
                          </button>

                          <button
                            type="button"
                            data-testid={`dynamic-example-slow-btn-${idx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlayingExampleId(ex.id);
                              speakJapanese(ex.sentenceJp, 0.85, 'female', 'neutral', false);
                            }}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer shrink-0"
                          >
                            0.85x 慢速
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dual Live Variable Gauges (Variable A -> Variable B + 5-Stage Synchronous Curve) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
                {/* Variable A Gauge Card */}
                <div
                  data-testid="dynamic-var-a-card"
                  className="lg:col-span-5 bg-white border-2 border-sky-300 rounded-xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-[#0284C7] uppercase tracking-wider">
                        【A 變數・起點條件変化】
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {formatBilingual(
                          corrState.scenario.variableA.nameHk,
                          corrState.scenario.variableA.nameJa,
                          uiLang
                        )}
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[11px] font-bold text-[#0284C7]">
                      {corrState.scenario.variableA.directionLabelHk}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-3 bg-sky-50/70 border border-sky-200 rounded-xl px-3.5 py-2.5">
                    <div>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        目前 A 變數即時數值：
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5">
                        {corrState.stage.stageLabelHk}（{corrState.stage.stageLabelJa}）
                      </div>
                    </div>
                    <div
                      data-testid="dynamic-var-a-value"
                      className="text-2xl sm:text-3xl font-extrabold font-mono-num text-[#0284C7]"
                    >
                      {corrState.formattedValueA}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                      <span>
                        起點：{corrState.scenario.variableA.startValue}
                        {corrState.scenario.variableA.unit}
                      </span>
                      <span>
                        極限：{corrState.scenario.variableA.endValue}
                        {corrState.scenario.variableA.unit}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className="h-full bg-gradient-to-r from-sky-400 to-[#0284C7] transition-all duration-200"
                        style={{ width: `${Math.max(8, corrState.clampedPercent)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Center Correlation Connector */}
                <div className="lg:col-span-2 flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-3 text-center space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-700">正比／伴隨連動</div>
                  <div className="w-9 h-9 rounded-full bg-[#0284C7] text-white flex items-center justify-center shadow-2xs">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                  <div className="text-[11px] font-jp font-bold text-[#0284C7]">
                    A ば A ほど B
                  </div>
                  <div className="text-[11px] font-jp font-bold text-indigo-700">
                    A につれて B
                  </div>
                </div>

                {/* Variable B Gauge Card + 5-Point Correlation Bar Chart */}
                <div
                  data-testid="dynamic-var-b-card"
                  className="lg:col-span-5 bg-white border-2 border-emerald-300 rounded-xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                        【B 變數・同步伴隨結果】
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {formatBilingual(
                          corrState.scenario.variableB.nameHk,
                          corrState.scenario.variableB.nameJa,
                          uiLang
                        )}
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
                      {corrState.scenario.variableB.directionLabelHk}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-3 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                    <div>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        對應 B 變數即時強度：
                      </div>
                      <div className="text-xs font-bold text-emerald-950 mt-0.5">
                        {corrState.stage.liveStatusHk}
                      </div>
                    </div>
                    <div
                      data-testid="dynamic-var-b-value"
                      className="text-2xl sm:text-3xl font-extrabold font-mono-num text-emerald-700 shrink-0"
                    >
                      {corrState.formattedValueB}
                    </div>
                  </div>

                  {/* Mini 5-Stage Synchronous Correlation Bar Curve */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                      <span>A➔B 同步變化曲線：</span>
                      <span className="font-mono-num text-emerald-700 font-bold">
                        當前階段 #{corrState.stageIndex + 1}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 items-end h-10 pt-1 px-2 bg-slate-50 rounded-lg border border-slate-200">
                      {corrState.correlationCurvePoints.map((pt) => {
                        const active = pt.stageIdx <= corrState.stageIndex;
                        return (
                          <div
                            key={pt.stageIdx}
                            className="flex flex-col items-center justify-end h-full"
                          >
                            <div
                              className={`w-full rounded-t transition-all duration-200 ${
                                pt.isCurrent
                                  ? 'bg-emerald-600 ring-2 ring-emerald-300'
                                  : active
                                    ? 'bg-emerald-400'
                                    : 'bg-slate-200'
                              }`}
                              style={{ height: `${pt.bPercent}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-Time Side-by-Side Grammar Variant Cards: 「〜ば〜ほど」 vs 「〜につれて」 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* CARD 1: 「〜ば〜ほど」 Dynamic Variant Card */}
                <div
                  data-testid="dynamic-bahodo-card"
                  className="bg-white border-2 border-sky-300 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-3.5 shadow-2xs"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-[#0284C7]">
                          句式變體 ①：正比強調（越 A 就越 B）
                        </span>
                        <h4 className="text-base font-extrabold font-jp text-slate-900 mt-1">
                          「〜ば〜ほど」（假定形＋原形＋ほど）
                        </h4>
                      </div>

                      {/* Transitive (を) vs Intransitive (が) Switcher for Clause B */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          data-testid="dynamic-bahodo-mode-transitive"
                          onClick={() => setCorrTransitivityMode('transitive')}
                          className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                            corrTransitivityMode === 'transitive'
                              ? 'bg-[#0284C7] text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          他動詞 (を) 人為調高
                        </button>
                        <button
                          type="button"
                          data-testid="dynamic-bahodo-mode-intransitive"
                          onClick={() => setCorrTransitivityMode('intransitive')}
                          className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                            corrTransitivityMode === 'intransitive'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          自動詞 (が) 自然變化
                        </button>
                      </div>
                    </div>

                    {/* Morphological Formula Breakdown Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 font-jp font-bold text-[#0284C7]">
                        <span>① 假定形：</span>
                        <FuriganaText
                          text={corrState.stage.baHodoConditionJp}
                          showFurigana={showFurigana}
                        />
                      </span>
                      <span className="text-slate-400 font-bold">+</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 font-jp font-bold text-[#0284C7]">
                        <span>② 原形＋ほど：</span>
                        <FuriganaText
                          text={corrState.stage.baHodoRepeatJp}
                          showFurigana={showFurigana}
                        />
                      </span>
                      <span className="text-slate-400 font-bold">+</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 font-jp font-bold text-amber-900">
                        <span>③ 程度副詞：</span>
                        <FuriganaText
                          text={corrState.stage.baHodoAdverbJp}
                          showFurigana={showFurigana}
                        />
                      </span>
                      <span className="text-slate-400 font-bold">+</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 font-jp font-bold text-emerald-900">
                        <span>④ 後件 B：</span>
                        <FuriganaText
                          text={corrState.activeBaHodoResultJp}
                          showFurigana={showFurigana}
                        />
                      </span>
                    </div>

                    {/* Live Generated Sentence Box */}
                    <div
                      data-testid="dynamic-bahodo-sentence"
                      className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-1.5"
                    >
                      <FuriganaText
                        text={corrState.activeBaHodoSentenceJp}
                        showFurigana={showFurigana}
                        className="text-base sm:text-lg font-extrabold font-jp text-slate-900 block leading-loose"
                      />
                      <div className="text-xs sm:text-sm text-slate-700 font-medium">
                        {corrState.stage.baHodoTranslationHk}
                      </div>
                    </div>
                  </div>

                  {/* Emotional AI Speech Controls for 〜ば〜ほど */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="dynamic-bahodo-emotion-speak-btn"
                        onClick={() => {
                          setGlobalVoiceConfig({ emotionTone: corrState.stage.emotionTone });
                          speakJapanese(
                            corrState.activeBaHodoSentenceJp,
                            1.0,
                            'female',
                            corrState.stage.emotionTone,
                            true
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>🎭 帶感情朗讀（{corrState.stage.emotionBadgeHk}）</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          speakJapanese(
                            corrState.activeBaHodoSentenceJp,
                            0.85,
                            'female',
                            'neutral',
                            false
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        0.85x 慢速標準讀
                      </button>
                    </div>

                    <span className="text-[11px] font-semibold text-slate-500">
                      點擊可聽 AI 聲優感情起伏演繹
                    </span>
                  </div>
                </div>

                {/* CARD 2: 「〜につれて」 Dynamic Variant Card */}
                <div
                  data-testid="dynamic-nitsurete-card"
                  className="bg-white border-2 border-indigo-300 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-3.5 shadow-2xs"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800">
                          句式變體 ②：單向漸進推移（隨住 A 變化，B 自然變化）
                        </span>
                        <h4 className="text-base font-extrabold font-jp text-slate-900 mt-1">
                          「〜につれて」（変化動詞辞書形＋につれて）
                        </h4>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-900">
                        後件必用自然漸變（〜ていく／〜ようになる）
                      </span>
                    </div>

                    {/* Morphological Formula Breakdown Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 font-jp font-bold text-indigo-800">
                        <span>① 變化動詞：</span>
                        <FuriganaText
                          text={corrState.stage.nitsureteClauseAJp}
                          showFurigana={showFurigana}
                        />
                      </span>
                      <span className="text-slate-400 font-bold">+</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 border border-indigo-300 font-jp font-bold text-indigo-950">
                        <span>② 連接：{corrState.stage.nitsureteConnectorJp}</span>
                      </span>
                      <span className="text-slate-400 font-bold">+</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 font-jp font-bold text-emerald-900">
                        <span>③ 自然推移結果：</span>
                        <FuriganaText
                          text={corrState.stage.nitsureteClauseBJp}
                          showFurigana={showFurigana}
                        />
                      </span>
                    </div>

                    {/* Live Generated Sentence Box */}
                    <div
                      data-testid="dynamic-nitsurete-sentence"
                      className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3.5 space-y-1.5"
                    >
                      <FuriganaText
                        text={corrState.stage.nitsureteFullJp}
                        showFurigana={showFurigana}
                        className="text-base sm:text-lg font-extrabold font-jp text-slate-900 block leading-loose"
                      />
                      <div className="text-xs sm:text-sm text-slate-700 font-medium">
                        {corrState.stage.nitsureteTranslationHk}
                      </div>
                    </div>

                    {/* Key Grammatical Contrast Note between ば〜ほど and につれて */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs leading-relaxed">
                      <div className="text-slate-800">
                        <strong className="text-indigo-800">💡 句式變體語感對照：</strong>
                        {corrState.scenario.grammarComparisonNoteHk}
                      </div>
                      <div className="font-jp text-slate-600 pt-1 border-t border-slate-200/80">
                        {corrState.scenario.grammarComparisonNoteJa}
                      </div>
                    </div>
                  </div>

                  {/* Emotional AI Speech Controls for 〜につれて */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="dynamic-nitsurete-emotion-speak-btn"
                        onClick={() => {
                          setGlobalVoiceConfig({ emotionTone: corrState.stage.emotionTone });
                          speakJapanese(
                            corrState.stage.nitsureteFullJp,
                            1.0,
                            'female',
                            corrState.stage.emotionTone,
                            true
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>🎭 帶感情朗讀「〜につれて」（{corrState.stage.emotionBadgeHk}）</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          speakJapanese(
                            corrState.stage.nitsureteFullJp,
                            0.85,
                            'female',
                            'neutral',
                            false
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        0.85x 慢速標準讀
                      </button>
                    </div>

                    {/* Quick 5-Emotion Audition Bar */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] text-slate-500 mr-0.5">切換語氣試聽：</span>
                      {VOICE_EMOTION_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          data-testid={`dynamic-emotion-try-${preset.id}`}
                          onClick={() => {
                            setGlobalVoiceConfig({ emotionTone: preset.id });
                            speakJapanese(
                              corrState.activeBaHodoSentenceJp,
                              1.0,
                              'female',
                              preset.id,
                              true
                            );
                          }}
                          title={`用「${preset.badgeHk}」語氣朗讀當前句子`}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                            activeEmotionTone === preset.id
                              ? 'bg-amber-500 text-white border-amber-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
                          }`}
                        >
                          {preset.badgeHk}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scene Input Box + Preset Chips */}
            <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-slate-800">
                輸入你想拆解嘅「動態變化場景」（例如：隨著天氣轉冷，暖氣開得越強）：
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  data-testid="nuance-scene-input"
                  value={sceneInput}
                  onChange={(e) => setSceneInput(e.target.value)}
                  placeholder="例如：隨著天氣轉冷，暖氣開得越強 / 隨著日文越學越深入，聽得明嘅動漫台詞越多..."
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                />
                <button
                  type="button"
                  data-testid="nuance-analyze-submit-btn"
                  disabled={isAnalyzing}
                  onClick={() => handleAnalyzeScene()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-sky-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer shrink-0"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>AI 正在拆解動態文法與助詞...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>AI 生成動態變化例句與助詞拆解</span>
                    </>
                  )}
                </button>
              </div>

              {/* Preset Dynamic Scene Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-500">一鍵切換常見動態場景：</span>
                {DYNAMIC_NUANCE_PRESET_SCENES.map((preset, idx) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`nuance-preset-btn-${idx}`}
                    onClick={() => handleAnalyzeScene(preset.scenePrompt)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      sceneInput === preset.scenePrompt
                        ? 'bg-[#0284C7] text-white border-[#0284C7]'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                    }`}
                  >
                    {preset.labelHk}
                  </button>
                ))}
              </div>
            </div>

            {/* Core Dynamic Rule Banner + Clause A -> Clause B Flow + Wrong Usage Trap */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left 7 Cols: Clause A -> Clause B Dynamic Blueprint & Bilingual Core Rules */}
              <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#0284C7]">
                    📐 兩邊同步變化（A ➔ B）動態文法結構總覽
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-semibold text-slate-600">
                    當前場景：{analysisResult.sceneInput}
                  </span>
                </div>

                {/* Visual Clause A -> Clause B Boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-11 gap-2 items-center">
                  <div className="sm:col-span-5 bg-white border-2 border-sky-300 rounded-xl p-3 space-y-1">
                    <div className="text-[11px] font-bold text-[#0284C7]">
                      【變化前件 A】起點漸進變化
                    </div>
                    <div className="text-xs font-semibold text-slate-900">
                      {analysisResult.clauseALabelHk}
                    </div>
                  </div>
                  <div className="sm:col-span-1 flex justify-center">
                    <ArrowRight className="w-5 h-5 text-[#0284C7]" />
                  </div>
                  <div className="sm:col-span-5 bg-white border-2 border-emerald-300 rounded-xl p-3 space-y-1">
                    <div className="text-[11px] font-bold text-emerald-700">
                      【變化後件 B】伴隨同步變化
                    </div>
                    <div className="text-xs font-semibold text-slate-900">
                      {analysisResult.clauseBLabelHk}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs leading-relaxed">
                  <div>
                    <strong className="text-slate-900">語感核心總結（中文）：</strong>
                    <span className="text-slate-700">{analysisResult.sceneSummaryHk}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 font-jp text-slate-800">
                    <strong className="text-[#0284C7]">日本語解説（ニュアンス・構造）：</strong>
                    <span>{analysisResult.sceneSummaryJa}</span>
                  </div>
                </div>

                <div className="bg-sky-50/80 border border-sky-200 rounded-lg p-3 space-y-1.5 text-xs leading-relaxed">
                  <div className="text-slate-800 font-medium">{analysisResult.coreRuleBannerHk}</div>
                  <div className="font-jp text-slate-700 pt-1 border-t border-sky-200/70">
                    {analysisResult.coreRuleBannerJa}
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: JLPT Classic Wrong Usage Trap (Static / Volitional Ending Prohibition) */}
              <div
                data-testid="nuance-wrong-trap-box"
                className="lg:col-span-5 bg-amber-50/70 border border-amber-300 rounded-xl p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>⚠️ JLPT 必考陷阱：點解後件唔可以用靜態句或「〜たい」？</span>
                  </div>

                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-1">
                    <div className="text-[11px] font-bold text-rose-700">
                      × 常見中式日文誤區（後件誤用主觀願望／靜態結尾）：
                    </div>
                    <FuriganaText
                      text={analysisResult.wrongUsageTrap.wrongSentenceJp}
                      showFurigana={showFurigana}
                      className="text-xs sm:text-sm font-jp font-bold text-rose-900 block"
                    />
                  </div>

                  <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-800">
                        ○ 正確母語者動態變化句（前後均為漸進變化）：
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          speakJapanese(analysisResult.wrongUsageTrap.correctSentenceJp)
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>NHK 朗讀</span>
                      </button>
                    </div>
                    <FuriganaText
                      text={analysisResult.wrongUsageTrap.correctSentenceJp}
                      showFurigana={showFurigana}
                      className="text-xs sm:text-sm font-jp font-bold text-emerald-950 block"
                    />
                  </div>

                  <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-1.5 text-xs leading-relaxed">
                    <div className="text-slate-800">
                      <strong>中文拆解：</strong>
                      {analysisResult.wrongUsageTrap.reasonHk}
                    </div>
                    <div className="font-jp text-slate-700 pt-1 border-t border-slate-100">
                      <strong className="text-[#0284C7]">日本語解説：</strong>
                      {analysisResult.wrongUsageTrap.reasonJa}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Generated Dynamic Change Example Sentences with Clause A/B & Particle Highlights */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#0284C7]" />
                  <span>
                    針對「{analysisResult.sceneInput}」生成嘅 {analysisResult.generatedExamples.length} 大動態變化例句與助詞標註
                  </span>
                </h4>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {analysisResult.generatedExamples.map((ex, idx) => (
                  <div
                    key={`${ex.patternId}-${idx}`}
                    data-testid={`nuance-example-card-${idx}`}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-2xs"
                  >
                    <div className="space-y-3">
                      {/* Card Header: Pattern Name + Register Badge + Smooth NHK Audio Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div>
                          <div className="text-sm sm:text-base font-bold text-[#0284C7] font-jp">
                            {ex.patternJp}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatBilingual(ex.registerLabelHk, ex.registerLabelJa, uiLang)} · JLPT{' '}
                            {ex.level}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => speakJapanese(ex.cleanSpokenJp || ex.sentenceJp, 0.85)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                            title="慢速清晰朗讀"
                          >
                            0.85x 慢讀
                          </button>
                          <button
                            type="button"
                            data-testid={`nuance-play-sentence-${idx}`}
                            onClick={() => speakJapanese(ex.cleanSpokenJp || ex.sentenceJp, 1.0)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-[#0284C7] hover:bg-sky-700 text-white cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>NHK 朗讀</span>
                          </button>
                        </div>
                      </div>

                      {/* Full Japanese Sentence with Furigana + Cantonese Translation */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                        <FuriganaText
                          text={ex.sentenceJp}
                          showFurigana={showFurigana}
                          className="text-base sm:text-lg font-bold font-jp text-slate-900 block leading-loose"
                        />
                        <div className="text-xs sm:text-sm text-slate-600 font-medium">
                          {ex.translationHk}
                        </div>
                      </div>

                      {/* 3-Part Dynamic Grammar Structure Breakdown (Clause A + Connector + Clause B) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="bg-sky-50/70 border border-sky-200 rounded-lg p-2.5 space-y-1">
                          <div className="font-bold text-[#0284C7] text-[11px]">
                            【前件 A：起點變化】
                          </div>
                          <FuriganaText
                            text={ex.clauseA.textJp}
                            showFurigana={showFurigana}
                            className="font-jp font-bold text-slate-900 block"
                          />
                          <div className="text-[11px] font-semibold text-slate-700">
                            {ex.clauseA.changeVerbType}
                          </div>
                          <div className="text-[11px] text-slate-600 leading-snug">
                            {ex.clauseA.dynamicNoteHk}
                          </div>
                        </div>

                        <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-2.5 space-y-1">
                          <div className="font-bold text-indigo-800 text-[11px]">
                            【同步連接結構】
                          </div>
                          <div className="font-jp font-bold text-indigo-900">
                            {ex.connectorGrammar.formJp}
                          </div>
                          <div className="text-[11px] text-slate-700 leading-snug">
                            {ex.connectorGrammar.ruleHk}
                          </div>
                          <div className="text-[11px] font-jp text-slate-600 leading-snug">
                            {ex.connectorGrammar.ruleJa}
                          </div>
                        </div>

                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 space-y-1">
                          <div className="font-bold text-emerald-800 text-[11px]">
                            【後件 B：同步變化】
                          </div>
                          <FuriganaText
                            text={ex.clauseB.textJp}
                            showFurigana={showFurigana}
                            className="font-jp font-bold text-slate-900 block"
                          />
                          <div className="text-[11px] font-semibold text-slate-700">
                            {ex.clauseB.changeVerbType}
                          </div>
                          <div className="text-[11px] text-slate-600 leading-snug">
                            {ex.clauseB.constraintNoteHk}
                          </div>
                        </div>
                      </div>

                      {/* Particle Highlights Section */}
                      <div
                        data-testid={`nuance-particles-box-${idx}`}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2"
                      >
                        <div className="text-[11px] font-bold text-slate-700">
                          🔍 句中關鍵助詞與自他動詞搭配標註：
                        </div>
                        <div className="space-y-2">
                          {ex.particleHighlights.map((pt, pIdx) => (
                            <div
                              key={pIdx}
                              className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs space-y-1"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-[#0284C7] text-white font-bold font-jp">
                                  助詞「{pt.particleJp}」
                                </span>
                                <FuriganaText
                                  text={pt.attachedWordJp}
                                  showFurigana={showFurigana}
                                  className="font-jp font-bold text-slate-900"
                                />
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                                  {pt.roleLabelHk}
                                </span>
                              </div>
                              <div className="text-slate-700 leading-relaxed">
                                {pt.explanationHk}
                              </div>
                              <div className="font-jp text-slate-500 text-[11px]">
                                日本語解説：{pt.explanationJa}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          onAskSenseiWithContext(
                            `Sensei，我喺語感解析模式學習緊場景「${analysisResult.sceneInput}」嘅動態句型「${ex.patternJp}」同埋例句「${ex.cleanSpokenJp}」，請教我點樣用呢個句型再造 2 個生活例句！`,
                            ex
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0284C7] bg-sky-50 hover:bg-sky-100 border border-sky-200 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>搵 AI 導師深入練習此句型</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 2: Sigure.tw Style Intransitive vs Transitive Verb Pairs (自動詞 が vs 他動詞 を) */}
        {activeSubTab === 'transitivity-pairs' && (
          <div data-testid="sigure-transitivity-table" className="space-y-4">
            <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4 space-y-1.5">
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                📘 時雨の町風・日文「自動詞（〜が） vs 他動詞（〜を）」4 大語尾配對黃金法則
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                點解有時用「気温が下がる（氣溫下降）」、有時用「温度を下げる（調低溫度）」？關鍵在於：
                <strong>自動詞聚焦「事物自己發生狀態變化（用助詞 が）」</strong>；
                <strong>他動詞聚焦「有人出手施加外力去改變事物（用助詞 を）」</strong>！
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {TRANSITIVITY_PAIR_CATALOG.map((pair) => (
                <div
                  key={pair.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-[#0284C7] text-white text-xs font-bold">
                      {formatBilingual(pair.ruleGroupTitleHk, pair.ruleGroupTitleJa, uiLang)}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      核心字義：{pair.meaningHk}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Intransitive Box */}
                    <div className="bg-white border-2 border-sky-200 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="px-2 py-0.5 rounded bg-sky-100 text-[#0284C7] text-[11px] font-bold mr-2">
                            自動詞（主語 ＋ が）
                          </span>
                          <strong className="text-base font-bold font-jp text-slate-900">
                            {pair.intransitiveJp}（{pair.intransitiveReading}）
                          </strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => speakJapanese(pair.intransitiveExampleJp)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-sky-50 text-[#0284C7] cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <FuriganaText
                        text={pair.intransitiveExampleJp}
                        showFurigana={showFurigana}
                        className="text-sm font-jp font-semibold text-slate-900 block"
                      />
                      <div className="text-xs text-slate-600">{pair.intransitiveExampleHk}</div>
                    </div>

                    {/* Transitive Box */}
                    <div className="bg-white border-2 border-amber-200 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px] font-bold mr-2">
                            他動詞（受事 ＋ を）
                          </span>
                          <strong className="text-base font-bold font-jp text-slate-900">
                            {pair.transitiveJp}（{pair.transitiveReading}）
                          </strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => speakJapanese(pair.transitiveExampleJp)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 text-amber-800 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <FuriganaText
                        text={pair.transitiveExampleJp}
                        showFurigana={showFurigana}
                        className="text-sm font-jp font-semibold text-slate-900 block"
                      />
                      <div className="text-xs text-slate-600">{pair.transitiveExampleHk}</div>
                    </div>
                  </div>

                  <div className="text-xs bg-amber-50/80 border border-amber-200 rounded-lg px-3 py-2 text-amber-900">
                    💡 <strong>秒記口訣：</strong>
                    {pair.sigureTipHk}
                  </div>
                </div>
              ))}
            </div>

            {/* Instant Self-Check Quiz on Transitivity + Dynamic Change */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 space-y-2.5">
              <div className="text-xs font-bold text-[#0284C7]">
                🎯 即學即測（自他動詞 × 兩邊同步變化助詞挑戰）：
              </div>
              <p className="text-xs sm:text-sm font-bold font-jp text-slate-900">
                「外[そと]の気温[きおん]（ ① ）下[さ]がるにつれて、母[はは]は暖房[だんぼう]の温度[おんど]（ ② ）上[あ]げた。」
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: '1. ① が ／ ② を（正解：前自動詞・後他動詞）', correct: true },
                  { label: '2. ① を ／ ② が', correct: false },
                  { label: '3. ① を ／ ② を', correct: false },
                  { label: '4. ① に ／ ② で', correct: false },
                ].map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPairDrillAnswer(idx)}
                    className={`text-left px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                      selectedPairDrillAnswer === null
                        ? 'bg-slate-50 text-slate-800 border-slate-200 hover:border-sky-300'
                        : opt.correct
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-400 font-bold'
                          : selectedPairDrillAnswer === idx
                            ? 'bg-rose-50 text-rose-900 border-rose-300'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {selectedPairDrillAnswer !== null && (
                <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    解析：「下がる」係自動詞（氣溫自然下降），主語用「が」；「上げる」係他動詞（阿媽動手調高溫度），受事對象用「を」！
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUB-TAB 3: Sigure.tw Style Chinese-Japanese Kanji False Friends (同形異義地雷漢字) */}
        {activeSubTab === 'false-friends' && (
          <div data-testid="sigure-false-friends-grid" className="space-y-4">
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 space-y-1">
              <div className="text-xs sm:text-sm font-bold text-amber-900 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-amber-700" />
                <span>時雨の町風・華語母語者最易中伏嘅「中日同形異義地雷漢字」</span>
              </div>
              <p className="text-xs text-slate-700">
                好多日文漢字望落同廣東話／中文一模一樣，但意思完全唔同！切忌直接用中文意思代入。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {KANJI_FALSE_FRIENDS_CATALOG.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xl font-bold font-jp text-slate-900">
                          {item.kanji}
                        </div>
                        <div className="text-xs font-semibold text-[#0284C7] font-jp">
                          {item.reading} · {item.pitchAccent}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => speakJapanese(item.exampleJp)}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-[#0284C7] hover:bg-sky-50 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs space-y-1">
                      <div className="font-bold text-emerald-900">
                        ○ 日文真正意思：{item.actualMeaningHk}
                      </div>
                      <div className="font-jp text-[11px] text-emerald-800">
                        日本語：{item.actualMeaningJa}
                      </div>
                    </div>

                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs space-y-1">
                      <div className="font-bold text-rose-800">{item.chineseTrapMeaningHk}</div>
                      <div className="text-[11px] text-rose-700">{item.howToSayTrapInJp}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 text-xs space-y-0.5">
                    <FuriganaText
                      text={item.exampleJp}
                      showFurigana={showFurigana}
                      className="font-jp font-semibold text-slate-900 block"
                    />
                    <div className="text-slate-600">{item.exampleHk}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
