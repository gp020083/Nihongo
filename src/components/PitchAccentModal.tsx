import React, { useState, useEffect } from 'react';
import {
  Activity,
  Volume2,
  X,
  Sparkles,
  Gauge,
  Info,
} from 'lucide-react';
import {
  analyzePitchAccentContour,
  PitchAccentAnalysis,
} from '../utils/srsEngine';
import { UiLang, formatBilingual } from '../data/listeningAndDictionaryData';
import { speakJapanese } from './FuriganaText';

export interface PitchTargetWord {
  kanji: string;
  reading: string;
  pitchAccent?: string;
  romaji?: string;
  partOfSpeech?: string;
  meaning?: string;
  exampleJp?: string;
  exampleZh?: string;
}

interface PitchAccentModalProps {
  word: PitchTargetWord | null;
  uiLang: UiLang;
  onClose: () => void;
}

export const PitchAccentModal: React.FC<PitchAccentModalProps> = ({
  word,
  uiLang,
  onClose,
}) => {
  const [selectedMoraIdx, setSelectedMoraIdx] = useState<number>(0);
  const [activePlayingMoraIdx, setActivePlayingMoraIdx] = useState<number | null>(null);
  const [activeSpeedLabel, setActiveSpeedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!word) return;
    const analysis = analyzePitchAccentContour({
      kanji: word.kanji,
      reading: word.reading,
      pitchAccent: word.pitchAccent,
    });
    const nucleusIdx = analysis.moraNodes.findIndex((n) => n.isAccentNucleus);
    setSelectedMoraIdx(nucleusIdx >= 0 ? nucleusIdx : 0);
    setActivePlayingMoraIdx(null);
    setActiveSpeedLabel(null);
  }, [word]);

  if (!word) return null;

  const analysis: PitchAccentAnalysis = analyzePitchAccentContour({
    kanji: word.kanji,
    reading: word.reading,
    pitchAccent: word.pitchAccent,
  });

  const activeNode =
    analysis.moraNodes[selectedMoraIdx] || analysis.moraNodes[0];

  const handlePlayContourAudio = (rate: number, includeParticle = false, label = '') => {
    const textToSpeak = includeParticle
      ? analysis.particleReadingJp
      : word.reading || word.kanji;

    setActiveSpeedLabel(label || `${rate}x`);
    speakJapanese(textToSpeak, rate);

    // Animate mora-by-mora highlight synchronized with playback rate
    const nodesToHighlight = includeParticle
      ? analysis.moraNodes
      : analysis.moraNodes.filter((n) => !n.isParticle);

    const stepMs = Math.round(280 / Math.max(0.45, rate));
    nodesToHighlight.forEach((node, idx) => {
      window.setTimeout(() => {
        setActivePlayingMoraIdx(node.index);
        setSelectedMoraIdx(node.index);
      }, idx * stepMs);
    });

    window.setTimeout(() => {
      setActivePlayingMoraIdx(null);
      setActiveSpeedLabel(null);
    }, nodesToHighlight.length * stepMs + 250);
  };

  // SVG Layout Coordinates
  const nodeCount = analysis.moraNodes.length;
  const colWidth = 86;
  const padX = 52;
  const svgWidth = Math.max(420, padX * 2 + (nodeCount - 1) * colWidth);
  const svgHeight = 168;
  const yHigh = 46;
  const yLow = 118;

  const points = analysis.moraNodes.map((node, idx) => ({
    ...node,
    cx: padX + idx * colWidth,
    cy: node.pitch === 'H' ? yHigh : yLow,
  }));

  return (
    <div
      data-testid="pitch-accent-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${word.kanji} 語調視覺化互動圖表`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="pitch-accent-modal"
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden my-auto"
      >
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-300 font-semibold">
              <Activity className="w-4 h-4" />
              <span>
                {formatBilingual(
                  '東京標準語・高低音調視覺化互動圖表 (Pitch Accent Visualizer)',
                  '東京標準語・高低アクセント視覚化チャート',
                  uiLang
                )}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <h3
                data-testid="pitch-modal-headword"
                className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-jp"
              >
                {word.kanji}
              </h3>
              <span className="text-base font-medium text-slate-300 font-jp">
                【{word.reading}】
              </span>
              <span
                data-testid="pitch-modal-pattern-badge"
                className="text-xs font-mono-num font-bold px-2.5 py-0.5 rounded bg-sky-500/20 text-sky-200 border border-sky-400/30"
              >
                {analysis.patternBadgeText}
              </span>
            </div>
            {word.meaning && (
              <p className="text-xs text-slate-300">
                {word.partOfSpeech ? `${word.partOfSpeech} · ` : ''}
                {word.meaning}
              </p>
            )}
          </div>

          <button
            type="button"
            data-testid="pitch-modal-close-btn"
            onClick={onClose}
            aria-label="關閉語調視覺化視窗"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* Slowed-Down Audio Playback Toolbar */}
          <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Gauge className="w-4 h-4 text-[#0284C7]" />
                <span>
                  {formatBilingual(
                    '多段放慢語速朗讀（點擊聆聽高低音調起伏與拍節）：',
                    '段階別スロー再生（高低の起伏と拍のリズムを確認）：',
                    uiLang
                  )}
                </span>
              </div>
              {activeSpeedLabel && (
                <span
                  data-testid="pitch-active-playback-indicator"
                  className="text-[11px] font-bold text-[#0284C7] bg-white px-2 py-0.5 rounded border border-sky-200"
                >
                  🔊 播放中 ({activeSpeedLabel})...
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="pitch-play-slow-05x-btn"
                onClick={() => handlePlayContourAudio(0.5, false, '0.5× 超慢速')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#0284C7] hover:bg-sky-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>
                  {formatBilingual(
                    '0.5× 超慢速逐拍朗讀',
                    '0.5× 超スロー拍節再生',
                    uiLang
                  )}
                </span>
              </button>

              <button
                type="button"
                data-testid="pitch-play-slow-075x-btn"
                onClick={() => handlePlayContourAudio(0.75, false, '0.75× 慢速')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#0284C7] bg-white hover:bg-sky-100 border border-sky-300 rounded-lg transition-colors cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>
                  {formatBilingual(
                    '0.75× 慢速語調朗讀',
                    '0.75× ゆっくり再生',
                    uiLang
                  )}
                </span>
              </button>

              <button
                type="button"
                data-testid="pitch-play-normal-1x-btn"
                onClick={() => handlePlayContourAudio(1.0, false, '1.0× 常速')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {formatBilingual('1.0× 自然常速', '1.0× ナチュラル速度', uiLang)}
                </span>
              </button>

              <button
                type="button"
                data-testid="pitch-play-particle-btn"
                onClick={() =>
                  handlePlayContourAudio(0.75, true, '0.75× 連助詞「が」')
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                <span>
                  {formatBilingual(
                    `連助詞「${analysis.particlePhraseJp}」慢速示範`,
                    `助詞付き「${analysis.particlePhraseJp}」ゆっくり再生`,
                    uiLang
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Interactive SVG Pitch Contour Graph */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-800">
                {uiLang === 'ja' ? analysis.patternNameJa : analysis.patternNameZh}
              </span>
              <span
                data-testid="pitch-contour-notation"
                className="font-mono-num text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200"
              >
                {analysis.contourNotation}
              </span>
            </div>

            <div className="overflow-x-auto pb-1">
              <svg
                data-testid="pitch-accent-svg-graph"
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="mx-auto select-none"
                role="img"
                aria-label={`${word.kanji} 拍節高低音調曲線圖`}
              >
                {/* Horizontal High / Low Reference Tracks */}
                <line
                  x1={20}
                  y1={yHigh}
                  x2={svgWidth - 20}
                  y2={yHigh}
                  stroke="#BAE6FD"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={12}
                  y={yHigh - 10}
                  fontSize="10"
                  fontWeight="700"
                  fill="#0284C7"
                >
                  高 (H)
                </text>

                <line
                  x1={20}
                  y1={yLow}
                  x2={svgWidth - 20}
                  y2={yLow}
                  stroke="#CBD5E1"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={12}
                  y={yLow - 10}
                  fontSize="10"
                  fontWeight="700"
                  fill="#64748B"
                >
                  低 (L)
                </text>

                {/* Connecting Contour Lines Between Morae */}
                {points.map((pt, i) => {
                  if (i === points.length - 1) return null;
                  const next = points[i + 1];
                  const isDropEdge = pt.isAccentNucleus && next.pitch === 'L';
                  return (
                    <g key={`edge-${i}`}>
                      <line
                        x1={pt.cx}
                        y1={pt.cy}
                        x2={next.cx}
                        y2={next.cy}
                        stroke={
                          isDropEdge
                            ? '#E11D48'
                            : next.isParticle
                              ? '#94A3B8'
                              : '#0284C7'
                        }
                        strokeWidth={isDropEdge ? '3.5' : '3'}
                        strokeDasharray={next.isParticle ? '5 4' : undefined}
                      />
                      {isDropEdge && (
                        <text
                          x={(pt.cx + next.cx) / 2 - 6}
                          y={(pt.cy + next.cy) / 2 - 4}
                          fontSize="12"
                          fontWeight="800"
                          fill="#E11D48"
                        >
                          ＼跌調
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Interactive Mora Nodes */}
                {points.map((pt) => {
                  const isSelected = selectedMoraIdx === pt.index;
                  const isPlaying = activePlayingMoraIdx === pt.index;
                  const fillColor = pt.isParticle
                    ? '#F8FAFC'
                    : pt.isAccentNucleus
                      ? '#E11D48'
                      : pt.pitch === 'H'
                        ? '#0284C7'
                        : '#475569';
                  const strokeColor = isPlaying
                    ? '#F59E0B'
                    : isSelected
                      ? '#0F172A'
                      : pt.isParticle
                        ? '#64748B'
                        : '#FFFFFF';

                  return (
                    <g
                      key={`node-${pt.index}`}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedMoraIdx(pt.index);
                        speakJapanese(pt.mora, 0.65);
                      }}
                    >
                      {/* Outer Selection Ring */}
                      {(isSelected || isPlaying) && (
                        <circle
                          cx={pt.cx}
                          cy={pt.cy}
                          r={23}
                          fill="none"
                          stroke={isPlaying ? '#F59E0B' : '#0284C7'}
                          strokeWidth="2"
                          strokeDasharray={isPlaying ? undefined : '3 2'}
                        />
                      )}

                      <circle
                        cx={pt.cx}
                        cy={pt.cy}
                        r={17}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth="2.5"
                      />

                      {/* Pitch Tag inside or above circle */}
                      <text
                        x={pt.cx}
                        y={pt.cy + 5}
                        textAnchor="middle"
                        fontSize="13"
                        fontWeight="700"
                        fill={pt.isParticle ? '#334155' : '#FFFFFF'}
                      >
                        {pt.mora}
                      </text>

                      {/* Accent Nucleus Top Corner Bracket Marker */}
                      {pt.isAccentNucleus && (
                        <path
                          d={`M ${pt.cx - 12} ${pt.cy - 22} L ${pt.cx + 15} ${pt.cy - 22} L ${pt.cx + 15} ${pt.cy - 8}`}
                          fill="none"
                          stroke="#E11D48"
                          strokeWidth="2.5"
                        />
                      )}

                      {/* Bottom Mora Label & Romaji */}
                      <text
                        x={pt.cx}
                        y={svgHeight - 20}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill={pt.isParticle ? '#64748B' : '#0F172A'}
                      >
                        {pt.isParticle ? `+助詞(${pt.mora})` : `${pt.index + 1}拍: ${pt.mora}`}
                      </text>
                      <text
                        x={pt.cx}
                        y={svgHeight - 6}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#64748B"
                      >
                        {pt.romaji} · {pt.pitch === 'H' ? '高' : '低'}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Interactive Mora Buttons Bar for Keyboard/ScreenReader & Quick Click */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-500">
                {formatBilingual(
                  '點擊任一拍節單獨試聽與查看發音要領：',
                  '各拍をクリックして個別発音と解説を確認：',
                  uiLang
                )}
              </span>
              {analysis.moraNodes.map((node) => {
                const isSelected = selectedMoraIdx === node.index;
                return (
                  <button
                    key={node.index}
                    type="button"
                    data-testid={`pitch-mora-node-${node.index}`}
                    onClick={() => {
                      setSelectedMoraIdx(node.index);
                      speakJapanese(node.mora, 0.65);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : node.isAccentNucleus
                          ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                          : node.pitch === 'H'
                            ? 'bg-sky-50 text-[#0284C7] border-sky-200 hover:bg-sky-100'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{node.isParticle ? `+${node.mora}` : node.mora}</span>
                    <span className="text-[10px] opacity-80 font-mono-num">
                      ({node.pitch}
                      {node.isAccentNucleus ? '＼' : ''})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Mora Detail & Sensei Coaching Tip */}
          <div
            data-testid="pitch-selected-mora-detail"
            className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2 text-xs text-slate-800"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-amber-950 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {uiLang === 'ja' ? activeNode.tipJa : activeNode.tipZh}
                </span>
              </div>
              <button
                type="button"
                onClick={() => speakJapanese(activeNode.mora, 0.6)}
                className="text-[11px] font-semibold text-[#0284C7] hover:underline shrink-0 cursor-pointer"
              >
                單拍慢讀「{activeNode.mora}」
              </button>
            </div>
            <p className="text-slate-700 leading-relaxed">
              {uiLang === 'ja' ? analysis.coachTipJa : analysis.coachTipZh}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PitchVisualizerIconButtonProps {
  word: PitchTargetWord;
  uiLang: UiLang;
  onOpen: (word: PitchTargetWord) => void;
  testId?: string;
  compact?: boolean;
}

export const PitchVisualizerIconButton: React.FC<PitchVisualizerIconButtonProps> = ({
  word,
  uiLang,
  onOpen,
  testId,
  compact = false,
}) => {
  return (
    <button
      type="button"
      data-testid={testId || `pitch-visualizer-btn-${word.kanji}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(word);
      }}
      title={formatBilingual(
        `查看「${word.kanji}」高低音調視覺化圖表與慢速朗讀`,
        `「${word.kanji}」のピッチアクセント視覚化＆スロー再生`,
        uiLang
      )}
      aria-label={`語調視覺化 ${word.kanji}`}
      className={
        compact
          ? 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-[#0284C7] bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors shrink-0 cursor-pointer'
          : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0284C7] bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors shrink-0 cursor-pointer'
      }
    >
      <Activity className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>
        {compact
          ? formatBilingual('語調圖', '音調図', uiLang)
          : formatBilingual('語調視覺化', 'アクセント図', uiLang)}
      </span>
    </button>
  );
};
