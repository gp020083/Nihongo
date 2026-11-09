import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Volume2,
  RefreshCw,
  ArrowLeftRight,
  Wand2,
  Play,
  Square,
} from 'lucide-react';
import {
  EmotionalSituationTagId,
  EMOTIONAL_SITUATION_TAGS,
  EMOTIONAL_AUDITION_PRESET_SENTENCES,
  EmotionalAuditionComparisonResult,
  transformSentenceForEmotionalSituation,
} from '../utils/srsEngine';
import { UiLang, formatBilingual } from '../data/listeningAndDictionaryData';
import {
  FuriganaText,
  speakJapanese,
  setGlobalVoiceConfig,
} from './FuriganaText';

interface VoiceEmotionAuditionWorkbenchProps {
  uiLang: UiLang;
  showFurigana: boolean;
}

export const VoiceEmotionAuditionWorkbench: React.FC<
  VoiceEmotionAuditionWorkbenchProps
> = ({ uiLang, showFurigana }) => {
  const [selectedSituationId, setSelectedSituationId] =
    useState<EmotionalSituationTagId>('angry-scolding');
  const [inputSentenceJp, setInputSentenceJp] = useState<string>(
    EMOTIONAL_AUDITION_PRESET_SENTENCES[0].sentenceJp
  );
  const [comparison, setComparison] = useState<EmotionalAuditionComparisonResult>(
    () =>
      transformSentenceForEmotionalSituation(
        EMOTIONAL_AUDITION_PRESET_SENTENCES[0].sentenceJp,
        'angry-scolding'
      )
  );
  const [isTransformingAi, setIsTransformingAi] = useState<boolean>(false);
  const [activePlayingSide, setActivePlayingSide] = useState<
    'none' | 'plain' | 'emotional' | 'ab-compare'
  >('none');

  const compareTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (compareTimerRef.current) {
        window.clearTimeout(compareTimerRef.current);
      }
    };
  }, []);

  const handleSelectSituation = (
    nextSituationId: EmotionalSituationTagId,
    customSentence?: string
  ) => {
    const targetSentence = (customSentence ?? inputSentenceJp).trim() ||
      EMOTIONAL_AUDITION_PRESET_SENTENCES[0].sentenceJp;
    setSelectedSituationId(nextSituationId);
    const localResult = transformSentenceForEmotionalSituation(
      targetSentence,
      nextSituationId
    );
    setComparison(localResult);
    setGlobalVoiceConfig({ emotionTone: localResult.emotionalVersion.emotionTone });
  };

  const handleRunAiTransform = async (
    overrideSituationId?: EmotionalSituationTagId,
    overrideSentence?: string
  ) => {
    const targetSituation = overrideSituationId ?? selectedSituationId;
    const targetSentence =
      (overrideSentence ?? inputSentenceJp).trim() ||
      EMOTIONAL_AUDITION_PRESET_SENTENCES[0].sentenceJp;

    const baseLocal = transformSentenceForEmotionalSituation(
      targetSentence,
      targetSituation
    );
    setComparison(baseLocal);
    setIsTransformingAi(true);

    try {
      const res = await fetch('/api/ai/emotion-tts-transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentenceJp: targetSentence,
          situationId: targetSituation,
          situationLabelHk: baseLocal.situationMeta.labelHk,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.fallbackToLocalEngine && data.emotionalTextJp) {
          setComparison({
            ...baseLocal,
            plainVersion: {
              ...baseLocal.plainVersion,
              translationHk:
                data.plainTranslationHk || baseLocal.plainVersion.translationHk,
            },
            emotionalVersion: {
              ...baseLocal.emotionalVersion,
              textJp: data.emotionalTextJp,
              cleanSpokenJp:
                data.emotionalCleanSpokenJp ||
                String(data.emotionalTextJp).replace(/\[[^\]]+\]/g, ''),
              translationHk:
                data.emotionalTranslationHk ||
                baseLocal.emotionalVersion.translationHk,
            },
            comparisonDiff: {
              pitchDeltaBadge:
                data.pitchDeltaBadge || baseLocal.comparisonDiff.pitchDeltaBadge,
              speedDeltaBadge:
                data.speedDeltaBadge || baseLocal.comparisonDiff.speedDeltaBadge,
              addedExpressionsJp:
                Array.isArray(data.addedExpressionsJp) &&
                data.addedExpressionsJp.length > 0
                  ? data.addedExpressionsJp
                  : baseLocal.comparisonDiff.addedExpressionsJp,
              pronunciationDiffHk:
                data.pronunciationDiffHk ||
                baseLocal.comparisonDiff.pronunciationDiffHk,
              pronunciationDiffJa:
                data.pronunciationDiffJa ||
                baseLocal.comparisonDiff.pronunciationDiffJa,
            },
            generatedBy: 'ai-sensei',
          });
        }
      }
    } catch {
      // Keep baseLocal deterministic result
    } finally {
      setIsTransformingAi(false);
    }
  };

  const handlePlayPlainVersion = () => {
    if (compareTimerRef.current) {
      window.clearTimeout(compareTimerRef.current);
      compareTimerRef.current = null;
    }
    setActivePlayingSide('plain');
    speakJapanese(
      comparison.plainVersion.cleanSpokenJp,
      1.0,
      'narrator',
      'neutral',
      false
    );
    compareTimerRef.current = window.setTimeout(() => {
      setActivePlayingSide('none');
    }, 3200);
  };

  const handlePlayEmotionalVersion = () => {
    if (compareTimerRef.current) {
      window.clearTimeout(compareTimerRef.current);
      compareTimerRef.current = null;
    }
    setActivePlayingSide('emotional');
    setGlobalVoiceConfig({ emotionTone: comparison.emotionalVersion.emotionTone });
    speakJapanese(
      comparison.emotionalVersion.cleanSpokenJp,
      comparison.emotionalVersion.speedRate,
      comparison.emotionalVersion.preferredRole,
      comparison.emotionalVersion.emotionTone,
      true
    );
    compareTimerRef.current = window.setTimeout(() => {
      setActivePlayingSide('none');
    }, 3800);
  };

  const handleCompareAbSequential = () => {
    if (compareTimerRef.current) {
      window.clearTimeout(compareTimerRef.current);
      compareTimerRef.current = null;
    }
    if (activePlayingSide === 'ab-compare') {
      setActivePlayingSide('none');
      return;
    }

    setActivePlayingSide('ab-compare');
    // Step 1: Play Plain Neutral Version
    speakJapanese(
      comparison.plainVersion.cleanSpokenJp,
      1.0,
      'narrator',
      'neutral',
      false
    );

    // Step 2: Automatically play Emotional Situation Version right after
    compareTimerRef.current = window.setTimeout(() => {
      setGlobalVoiceConfig({
        emotionTone: comparison.emotionalVersion.emotionTone,
      });
      speakJapanese(
        comparison.emotionalVersion.cleanSpokenJp,
        comparison.emotionalVersion.speedRate,
        comparison.emotionalVersion.preferredRole,
        comparison.emotionalVersion.emotionTone,
        true
      );
      compareTimerRef.current = window.setTimeout(() => {
        setActivePlayingSide('none');
      }, 3800);
    }, 3100);
  };

  return (
    <div
      data-testid="voice-emotion-audition-workbench"
      className="w-full mt-2 bg-white border-2 border-amber-300/90 rounded-xl p-3.5 sm:p-4 space-y-3.5 shadow-2xs"
    >
      {/* Top Header + Situation Tag Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-amber-500 text-white">
              <Wand2 className="w-3.5 h-3.5" />
              <span>
                {formatBilingual(
                  '🎭 語音感情演繹・實時對比試聽室',
                  '🎭 AI音声感情演技・リアルタイム比較スタジオ',
                  uiLang
                )}
              </span>
            </span>
            <span className="text-[11px] font-semibold text-slate-600">
              揀選情境標籤（如「憤怒的責備」、「溫柔的勸告」、「專業的播報」），AI 即時將語句進行情感化 TTS 轉譯並對比發音差異！
            </span>
          </div>
        </div>

        {/* One-Click A/B Sequential Comparison Button */}
        <button
          type="button"
          data-testid="compare-ab-tts-btn"
          onClick={handleCompareAbSequential}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all cursor-pointer shrink-0 ${
            activePlayingSide === 'ab-compare'
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-gradient-to-r from-[#0284C7] to-amber-500 hover:opacity-95 text-white border-transparent shadow-2xs'
          }`}
        >
          {activePlayingSide === 'ab-compare' ? (
            <>
              <Square className="w-3.5 h-3.5" />
              <span>停止連續對比試聽</span>
            </>
          ) : (
            <>
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>🔄 一鍵連續對比試聽（先播普通版 ➔ 再播情感演繹版）</span>
            </>
          )}
        </button>
      </div>

      {/* Row 1: Situation Tag Selector Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold text-slate-800 mr-1">
          ① 選擇情境標籤：
        </span>
        {EMOTIONAL_SITUATION_TAGS.map((tag) => {
          const isSelected = tag.id === selectedSituationId;
          return (
            <button
              key={tag.id}
              type="button"
              data-testid={`emotion-situation-tag-${tag.id}`}
              onClick={() => handleSelectSituation(tag.id)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-500 text-white border-amber-600 shadow-2xs ring-2 ring-amber-200'
                  : 'bg-slate-50 hover:bg-amber-50/70 text-slate-800 border-slate-200 hover:border-amber-300'
              }`}
            >
              <span>{uiLang === 'ja' ? tag.labelJa : tag.labelHk}</span>
            </button>
          );
        })}
      </div>

      {/* Row 2: Sentence Input + Preset Quick Sentences + AI Transcreate Button */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            aria-label="輸入要進行感情演繹轉譯的日文句子"
            data-testid="emotion-audition-input"
            value={inputSentenceJp}
            onChange={(e) => setInputSentenceJp(e.target.value)}
            placeholder="輸入任何日文句子（例如：約束の時間に遅れないでください。）..."
            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-jp text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="button"
            data-testid="emotion-audition-transform-btn"
            disabled={isTransformingAi}
            onClick={() => handleRunAiTransform()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-extrabold transition-colors cursor-pointer shrink-0"
          >
            {isTransformingAi ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>AI 正在轉譯情境語氣...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>✨ AI 情感化 TTS 轉譯與發音對比</span>
              </>
            )}
          </button>
        </div>

        {/* Preset Sentences */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500">
            常用測試語句：
          </span>
          {EMOTIONAL_AUDITION_PRESET_SENTENCES.map((preset) => (
            <button
              key={preset.id}
              type="button"
              data-testid={`emotion-preset-sentence-${preset.id}`}
              onClick={() => {
                setInputSentenceJp(preset.sentenceJp);
                handleSelectSituation(selectedSituationId, preset.sentenceJp);
              }}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer ${
                inputSentenceJp === preset.sentenceJp
                  ? 'bg-[#0284C7] text-white border-[#0284C7]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
              }`}
            >
              {preset.labelHk}
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: Side-by-Side Plain vs Emotional Version Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Card A: Plain Standard Version */}
        <div
          data-testid="emotion-plain-card"
          className={`rounded-xl border-2 p-3.5 flex flex-col justify-between space-y-2.5 transition-all ${
            activePlayingSide === 'plain' || activePlayingSide === 'ab-compare'
              ? 'bg-sky-50/70 border-[#0284C7]'
              : 'bg-slate-50/70 border-slate-200'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-800">
                😐 普通平敘版 (Plain Standard TTS)
              </span>
              <span className="text-[11px] font-mono-num font-semibold text-slate-500">
                {comparison.plainVersion.voiceStyleLabelHk}
              </span>
            </div>

            <div
              data-testid="emotion-plain-sentence-text"
              className="bg-white border border-slate-200 rounded-lg p-3 space-y-1"
            >
              <FuriganaText
                text={comparison.plainVersion.textJp}
                showFurigana={showFurigana}
                className="text-sm sm:text-base font-bold font-jp text-slate-900 block leading-relaxed"
              />
              <div className="text-xs text-slate-600">
                {comparison.plainVersion.translationHk}
              </div>
            </div>

            <div className="text-[11px] text-slate-600 leading-relaxed">
              <strong>發音特徵：</strong>
              {comparison.plainVersion.intonationNoteHk}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
            <button
              type="button"
              data-testid="play-plain-tts-btn"
              onClick={handlePlayPlainVersion}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>🔊 試聽普通平敘版 (1.0x)</span>
            </button>
            <span className="text-[11px] text-slate-500">零情緒修飾基準音</span>
          </div>
        </div>

        {/* Card B: Emotional Situation Transcreated Version */}
        <div
          data-testid="emotion-expressive-card"
          className={`rounded-xl border-2 p-3.5 flex flex-col justify-between space-y-2.5 transition-all ${
            activePlayingSide === 'emotional'
              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200'
              : 'bg-amber-50/40 border-amber-300'
          }`}
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                data-testid="emotion-expressive-badge"
                className="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-amber-500 text-white"
              >
                🎭 情感演繹版：{comparison.situationMeta.labelHk}
              </span>
              <span className="text-[11px] font-mono-num font-bold text-amber-900">
                {comparison.situationMeta.prosodyBadgeHk}
              </span>
            </div>

            <div
              data-testid="emotion-expressive-sentence-text"
              className="bg-white border border-amber-300 rounded-lg p-3 space-y-1"
            >
              <FuriganaText
                text={comparison.emotionalVersion.textJp}
                showFurigana={showFurigana}
                className="text-sm sm:text-base font-extrabold font-jp text-slate-900 block leading-relaxed"
              />
              <div className="text-xs font-semibold text-amber-950">
                {comparison.emotionalVersion.translationHk}
              </div>
            </div>

            {/* Added Emotional Prosody & Grammar Markers */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] font-bold text-amber-900">
                情感轉譯標記：
              </span>
              {comparison.comparisonDiff.addedExpressionsJp.map((expr, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-white border border-amber-200 text-[11px] font-jp font-bold text-amber-900"
                >
                  {expr}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              data-testid="play-emotional-tts-btn"
              onClick={handlePlayEmotionalVersion}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                🎭 試聽「{comparison.situationMeta.labelHk}」演繹版 (
                {comparison.emotionalVersion.speedRate}x)
              </span>
            </button>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
              <span>{comparison.comparisonDiff.pitchDeltaBadge}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Emotional Spectrum & Voice Feature Distribution Chart (情緒分佈圖・情緒光譜與聲線特徵值視覺化) */}
      {(() => {
        const spec = comparison.emotionSpectrum;
        const radarCenter = 115;
        const maxRadius = 76;
        const angles = [-90, -30, 30, 90, 150, 210]; // 6 hexagonal radar axes in degrees

        const toRadarPoint = (angleDeg: number, score0to100: number, radiusScale = maxRadius) => {
          const rad = (angleDeg * Math.PI) / 180;
          const r = (Math.max(0, Math.min(100, score0to100)) / 100) * radiusScale;
          return {
            x: Number((radarCenter + r * Math.cos(rad)).toFixed(1)),
            y: Number((radarCenter + r * Math.sin(rad)).toFixed(1)),
          };
        };

        const plainPolygonPoints = spec.dimensions
          .map((d, i) => {
            const pt = toRadarPoint(angles[i], d.plainScore);
            return `${pt.x},${pt.y}`;
          })
          .join(' ');

        const emotionalPolygonPoints = spec.dimensions
          .map((d, i) => {
            const pt = toRadarPoint(angles[i], d.emotionalScore);
            return `${pt.x},${pt.y}`;
          })
          .join(' ');

        // 8-point Pitch Contour SVG coordinates (width 320, height 84)
        const waveWidth = 320;
        const waveHeight = 76;
        const plainWavePoints = spec.spectrumWavePoints
          .map((pt, idx) => {
            const x = 22 + idx * ((waveWidth - 44) / 7);
            const y = waveHeight - 14 - (pt.plainPitch / 100) * (waveHeight - 28);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ');

        const emotionalWavePoints = spec.spectrumWavePoints
          .map((pt, idx) => {
            const x = 22 + idx * ((waveWidth - 44) / 7);
            const y = waveHeight - 14 - (pt.emotionalPitch / 100) * (waveHeight - 28);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ');

        return (
          <div
            data-testid="emotion-spectrum-chart-panel"
            className="bg-gradient-to-br from-slate-50 via-white to-amber-50/40 border-2 border-amber-200 rounded-xl p-3.5 sm:p-4 space-y-3.5"
          >
            {/* Spectrum Header + Dominant Voice Signature Badge + 5 Acoustic Parameter Chips */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 border-b border-slate-200/80 pb-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-[#0284C7] text-white">
                    <span>🌈 語音情感演繹・情緒分佈圖（情緒光譜 ＆ 聲線特徵值）</span>
                  </span>
                  <span
                    data-testid="emotion-spectrum-dominant-badge"
                    className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-amber-100 text-amber-950 border border-amber-300"
                  >
                    {spec.dominantSpectrumBadgeHk}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
                  {uiLang === 'ja'
                    ? spec.acousticSignatureSummaryJa
                    : spec.acousticSignatureSummaryHk}
                </p>
              </div>

              {/* 5 Key Acoustic Feature Pills */}
              <div
                data-testid="emotion-spectrum-metrics-strip"
                className="flex flex-wrap items-center gap-1.5 shrink-0"
              >
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 font-mono-num">
                  語速：<strong className="text-[#0284C7]">{spec.voiceMetrics.speedRate.toFixed(2)}x</strong>
                </span>
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 font-mono-num">
                  音高：<strong className="text-amber-700">{spec.voiceMetrics.pitchFactor.toFixed(2)}x</strong>
                </span>
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 font-mono-num">
                  抑揚幅：<strong className="text-indigo-700">{spec.voiceMetrics.pitchRangePercent}%</strong>
                </span>
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 font-mono-num">
                  換氣停頓：<strong className="text-emerald-700">{spec.voiceMetrics.pauseDurationMs}ms</strong>
                </span>
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 font-mono-num">
                  聲壓：<strong className="text-rose-700">{spec.voiceMetrics.energyDbDelta}</strong>
                </span>
              </div>
            </div>

            {/* Interactive 5-Preset Emotional Spectrum Wavelength Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-slate-700">
                  🎚️ 全域情緒光譜定位（點擊光譜節點可即時切換 Preset 並刷新聲線特徵值）：
                </span>
                <span className="font-mono-num font-semibold text-slate-500">
                  情緒效價 Valence: {spec.valenceX > 0 ? `+${spec.valenceX}` : spec.valenceX} · 激昂度 Arousal: {spec.arousalY > 0 ? `+${spec.arousalY}` : spec.arousalY}
                </span>
              </div>

              <div className="relative pt-1 pb-0.5">
                <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-rose-500 via-sky-500 to-amber-400 opacity-85" />
                <div className="grid grid-cols-5 gap-1.5 mt-2">
                  {EMOTIONAL_SITUATION_TAGS.map((tag) => {
                    const active = tag.id === selectedSituationId;
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        data-testid={`emotion-spectrum-node-${tag.id}`}
                        onClick={() => handleSelectSituation(tag.id)}
                        className={`px-2 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-400 shadow-2xs'
                            : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-amber-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-slate-900">
                          <span className="truncate">{tag.labelHk}</span>
                          <span className="font-mono-num text-[10px] text-amber-800 shrink-0">
                            {tag.speedRate.toFixed(2)}x
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono-num truncate">
                          Pitch {tag.pitchFactor.toFixed(2)}x
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Main 2-Column Visual Chart: 6-Axis SVG Radar Chart (Left) + 6 Feature Spectrum Bars & Pitch Wave (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
              {/* Left 5 Cols: 6-Axis Hexagonal Radar Spectrum SVG */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between items-center">
                <div className="w-full flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>🕸️ 六維聲線特徵雷達圖</span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 inline-block border border-slate-400" />
                      普通基準
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-800">
                      <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                      當前情感
                    </span>
                  </div>
                </div>

                <svg
                  data-testid="emotion-spectrum-radar-svg"
                  viewBox="0 0 230 230"
                  className="w-full max-w-[235px] h-auto my-1 select-none"
                  role="img"
                  aria-label={`語音情感六維特徵雷達圖：${spec.situationLabelHk}`}
                >
                  {/* Concentric Hexagon Rings (25%, 50%, 75%, 100%) */}
                  {[25, 50, 75, 100].map((ringPct) => {
                    const ringPts = angles
                      .map((ang) => {
                        const pt = toRadarPoint(ang, ringPct);
                        return `${pt.x},${pt.y}`;
                      })
                      .join(' ');
                    return (
                      <polygon
                        key={ringPct}
                        points={ringPts}
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth={ringPct === 100 ? 1.5 : 1}
                        strokeDasharray={ringPct === 50 ? '3 2' : undefined}
                      />
                    );
                  })}

                  {/* 6 Axis Spokes */}
                  {angles.map((ang, idx) => {
                    const outer = toRadarPoint(ang, 100);
                    return (
                      <line
                        key={idx}
                        x1={radarCenter}
                        y1={radarCenter}
                        x2={outer.x}
                        y2={outer.y}
                        stroke="#cbd5e1"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {/* Plain Standard Baseline Polygon (Dashed Slate) */}
                  <polygon
                    points={plainPolygonPoints}
                    fill="rgba(148, 163, 184, 0.18)"
                    stroke="#64748b"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />

                  {/* Current Emotional Preset Polygon (Highlighted Amber/Sky) */}
                  <polygon
                    data-testid="emotion-spectrum-radar-polygon"
                    points={emotionalPolygonPoints}
                    fill="rgba(245, 158, 11, 0.28)"
                    stroke="#d97706"
                    strokeWidth="2.2"
                  />

                  {/* Vertex Dots & Axis Labels */}
                  {spec.dimensions.map((dim, idx) => {
                    const dotPt = toRadarPoint(angles[idx], dim.emotionalScore);
                    const labelPt = toRadarPoint(angles[idx], 122);
                    const shortLabel = dim.labelHk.split(' ')[0];
                    return (
                      <g key={dim.axisId}>
                        <circle
                          cx={dotPt.x}
                          cy={dotPt.y}
                          r="3.8"
                          fill="#d97706"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        <text
                          x={labelPt.x}
                          y={labelPt.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="text-[8.5px] font-bold fill-slate-700"
                        >
                          {shortLabel}({dim.emotionalScore})
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <div className="w-full text-[11px] text-center text-slate-500 bg-slate-50 rounded-lg py-1 px-2 border border-slate-200/70">
                  外圈代表特徵強度 100%，虛線為平敘基準音
                </div>
              </div>

              {/* Right 7 Cols: 6 Voice Feature Spectrum Bars + 8-Point Pitch Contour Wave */}
              <div
                data-testid="emotion-spectrum-bars-list"
                className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>📊 當前情感 Preset 六大聲線特徵值分佈 (0–100%)</span>
                    <span className="text-[11px] font-mono-num text-amber-800">
                      對比基準：普通平敘版 (1.0x)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {spec.dimensions.map((dim) => {
                      const isPositiveDelta = dim.delta >= 0;
                      return (
                        <div
                          key={dim.axisId}
                          data-testid={`emotion-spectrum-axis-${dim.axisId}`}
                          className="bg-slate-50/80 border border-slate-200/90 rounded-lg p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <span className="font-bold text-slate-800 truncate">
                              {uiLang === 'ja' ? dim.labelJa : dim.labelHk}
                            </span>
                            <span
                              data-testid={`emotion-spectrum-score-${dim.axisId}`}
                              className="font-mono-num font-extrabold text-xs text-amber-900 shrink-0"
                            >
                              {dim.emotionalScore}%{' '}
                              <span
                                className={`text-[10px] px-1 py-0.2 rounded ${
                                  isPositiveDelta
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-sky-100 text-sky-900'
                                }`}
                              >
                                {dim.delta > 0 ? `+${dim.delta}` : dim.delta}%
                              </span>
                            </span>
                          </div>

                          {/* Spectrum Bar with Plain Baseline Marker */}
                          <div className="relative h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#0284C7] via-amber-500 to-rose-500 transition-all duration-300"
                              style={{ width: `${dim.emotionalScore}%` }}
                            />
                            {/* Vertical marker indicating Plain Standard baseline */}
                            <div
                              title={`普通平敘基準：${dim.plainScore}%`}
                              className="absolute top-0 bottom-0 w-0.5 bg-slate-900/75"
                              style={{ left: `${dim.plainScore}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>平敘基準: {dim.plainScore}%</span>
                            <span className="font-semibold text-slate-700 truncate">
                              {dim.formattedValueLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 8-Point Pitch & Energy Contour Wave Comparison */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                    <span className="font-bold text-slate-800">
                      〰️ 句調音高光譜曲線 (Pitch & Energy Contour：普通平敘 vs {spec.situationLabelHk})
                    </span>
                    <span className="text-[10px] font-semibold text-amber-800">
                      實線＝情感演繹音高軌跡 · 虛線＝平敘原音
                    </span>
                  </div>

                  <svg
                    data-testid="emotion-pitch-contour-svg"
                    viewBox={`0 0 ${waveWidth} ${waveHeight}`}
                    className="w-full h-16 bg-white rounded border border-slate-200/80"
                    role="img"
                    aria-label="句調音高光譜曲線對比圖"
                  >
                    {/* Horizontal Reference Grid Lines */}
                    <line x1="16" y1="20" x2={waveWidth - 16} y2="20" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="16" y1="40" x2={waveWidth - 16} y2="40" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 2" />
                    <line x1="16" y1="60" x2={waveWidth - 16} y2="60" stroke="#f1f5f9" strokeWidth="1" />

                    {/* Plain Pitch Polyline */}
                    <polyline
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1.8"
                      strokeDasharray="3 3"
                      points={plainWavePoints}
                    />

                    {/* Emotional Pitch Polyline */}
                    <polyline
                      fill="none"
                      stroke="#d97706"
                      strokeWidth="2.5"
                      points={emotionalWavePoints}
                    />

                    {/* Mora Nodes & Labels */}
                    {spec.spectrumWavePoints.map((pt, idx) => {
                      const x = 22 + idx * ((waveWidth - 44) / 7);
                      const y = waveHeight - 14 - (pt.emotionalPitch / 100) * (waveHeight - 28);
                      return (
                        <g key={pt.moraIndex}>
                          <circle
                            cx={x}
                            cy={y}
                            r="3"
                            fill="#d97706"
                            stroke="#ffffff"
                            strokeWidth="1"
                          />
                          <text
                            x={x}
                            y={waveHeight - 3}
                            textAnchor="middle"
                            className="text-[7.5px] font-jp font-bold fill-slate-600"
                          >
                            {pt.labelJp}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Row 5: Acoustic & Prosodic Difference Summary Bar */}
      <div
        data-testid="emotion-pronunciation-diff-box"
        className="bg-sky-50/70 border border-sky-200 rounded-xl p-3 space-y-1 text-xs leading-relaxed"
      >
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#0284C7]">
          <span>📊 普通版 vs 情感演繹版・發音與語感差異分析</span>
          <span className="px-2 py-0.5 rounded bg-white border border-sky-200 text-slate-700 font-mono-num">
            {comparison.comparisonDiff.speedDeltaBadge}
          </span>
          <span className="px-2 py-0.5 rounded bg-white border border-sky-200 text-slate-700">
            {comparison.comparisonDiff.pitchDeltaBadge}
          </span>
        </div>
        <div className="text-slate-800">
          {comparison.comparisonDiff.pronunciationDiffHk}
        </div>
        <div className="font-jp text-slate-600 pt-1 border-t border-sky-200/60">
          {comparison.comparisonDiff.pronunciationDiffJa}
        </div>
      </div>
    </div>
  );
};

