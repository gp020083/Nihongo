import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, X, Sparkles, RotateCcw } from 'lucide-react';
import {
  SrsCardState,
  SrsRating,
  analyzePitchAccentContour,
} from '../utils/srsEngine';
import type { VocabItem } from '../data/jlptCurriculum';
import { UiLang, formatBilingual } from '../data/listeningAndDictionaryData';
import { FuriganaText, speakJapanese } from './FuriganaText';
import { getIntervalPreview } from '../utils/reviewQueue';

export interface ReviewSessionProps {
  uiLang: UiLang;
  queue: VocabItem[];
  srsMap: Record<string, SrsCardState>;
  onRateCard: (itemId: string, rating: SrsRating) => void;
  onExit: () => void;
  onAskSenseiWithContext?: (promptText: string, item?: any) => void;
}

const INK = '#1F2430';
const INDIGO = '#2B4C7E';
const JP_SERIF = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';

const RATING_META: Array<{
  rating: SrsRating;
  key: string;
  zh: string;
  ja: string;
  tone: string;
}> = [
  { rating: 'again', key: '1', zh: '唔記得', ja: 'もう一度', tone: 'text-rose-700 border-rose-200 hover:bg-rose-50' },
  { rating: 'hard', key: '2', zh: '困難', ja: '難しい', tone: 'text-slate-700 border-slate-300 hover:bg-slate-50' },
  { rating: 'good', key: '3', zh: '記得', ja: '正解', tone: 'text-[#2B4C7E] border-[#2B4C7E]/40 hover:bg-[#2B4C7E]/5' },
  { rating: 'easy', key: '4', zh: '輕鬆', ja: '簡単', tone: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
];

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

/** Chinese primary label with a small Japanese secondary in bilingual mode. */
const Label: React.FC<{ zh: string; ja: string; uiLang: UiLang; stacked?: boolean }> = ({
  zh,
  ja,
  uiLang,
  stacked = false,
}) => {
  if (uiLang === 'zh') return <>{zh}</>;
  if (uiLang === 'ja') return <>{ja}</>;
  return (
    <>
      {zh}
      <span
        className={`${stacked ? 'block' : 'ml-1.5'} text-[0.72em] font-normal opacity-60`}
      >
        {ja}
      </span>
    </>
  );
};

const PitchReading: React.FC<{ item: VocabItem; uiLang: UiLang }> = ({ item, uiLang }) => {
  const analysis = useMemo(
    () =>
      analyzePitchAccentContour({
        kanji: item.kanji,
        reading: item.reading,
        pitchAccent: item.pitchAccent,
      }),
    [item.kanji, item.reading, item.pitchAccent]
  );
  const nodes = analysis.moraNodes.filter((n) => !n.isParticle);
  return (
    <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-1">
      <span
        className="inline-flex items-end text-2xl"
        style={{ fontFamily: JP_SERIF, color: INK }}
        aria-label={`${item.reading} ${item.pitchAccent}`}
      >
        {nodes.map((n) => (
          <span
            key={n.index}
            className="px-[1px] pt-1"
            style={{
              borderTop: n.pitch === 'H' ? `2px solid ${INDIGO}` : '2px solid transparent',
              borderRight: n.isAccentNucleus ? `2px solid ${INDIGO}` : undefined,
            }}
          >
            {n.mora}
          </span>
        ))}
      </span>
      <span className="text-xs text-slate-500 pb-1">{item.pitchAccent}</span>
    </div>
  );
};

export const ReviewSession: React.FC<ReviewSessionProps> = ({
  uiLang,
  queue,
  srsMap,
  onRateCard,
  onExit,
  onAskSenseiWithContext,
}) => {
  // Snapshot the queue at session start: rating a card changes srsMap, which would
  // otherwise shrink a parent-computed due list underneath us.
  const [sessionQueue, setSessionQueue] = useState<VocabItem[]>(() => [...queue]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [againCount, setAgainCount] = useState(0);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set());
  const requeuedRef = useRef<Set<string>>(new Set());
  const revealBtnRef = useRef<HTMLButtonElement | null>(null);

  // Allow a queue that arrives late (async load) to replace the snapshot, but only
  // before the learner has started rating.
  const queueKey = queue.map((q) => q.id).join('|');
  useEffect(() => {
    if (reviewedIds.size === 0 && index === 0) {
      setSessionQueue([...queue]);
      setRevealed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey]);

  const total = sessionQueue.length;
  const current: VocabItem | undefined = sessionQueue[index];
  const finished = total > 0 && index >= total;
  const currentState = current ? srsMap[current.id] : undefined;

  const reveal = useCallback(() => setRevealed(true), []);

  const rate = useCallback(
    (rating: SrsRating) => {
      if (!current || !revealed) return;
      onRateCard(current.id, rating);
      setReviewedIds((prev) => {
        const next = new Set(prev);
        next.add(current.id);
        return next;
      });
      if (rating === 'again') {
        setAgainCount((c) => c + 1);
        if (!requeuedRef.current.has(current.id)) {
          requeuedRef.current.add(current.id);
          setSessionQueue((prev) => [...prev, current]);
        }
      }
      setRevealed(false);
      setIndex((i) => i + 1);
      if (typeof document !== 'undefined') {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
    },
    [current, revealed, onRateCard]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (!current || finished) return;
      if (!revealed && (e.key === ' ' || e.code === 'Space' || e.key === 'Enter')) {
        e.preventDefault();
        reveal();
        return;
      }
      if (revealed) {
        const meta = RATING_META.find((m) => m.key === e.key);
        if (meta) {
          e.preventDefault();
          rate(meta.rating);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, finished, revealed, reveal, rate]);

  const progressDone = Math.min(index, total);
  const progressPct = total > 0 ? Math.round((progressDone / total) * 100) : 0;

  const exitButton = (
    <button
      type="button"
      onClick={onExit}
      data-testid="review-exit-btn"
      aria-label={formatBilingual('離開複習', '復習を終了', uiLang)}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 cursor-pointer"
    >
      <X className="w-4 h-4" />
      <span className="hidden sm:inline">{formatBilingual('離開', '終了', uiLang)}</span>
    </button>
  );

  // Empty queue
  if (total === 0) {
    return (
      <div data-testid="review-session" className="w-full max-w-xl mx-auto px-4 py-10">
        <div
          data-testid="review-empty"
          className="rounded-2xl border border-slate-200 bg-[#FBFAF7] p-8 text-center space-y-4"
          style={{ color: INK }}
        >
          <div className="text-4xl" aria-hidden="true">🎉</div>
          <h2 className="text-xl font-bold">
            <Label zh="今日冇到期卡" ja="今日の復習はありません" uiLang={uiLang} stacked />
          </h2>
          <p className="text-sm text-slate-600">
            {formatBilingual('所有到期詞彙已經複習晒，可以學新字或者休息一下。', '期限のカードはすべて完了しました。', uiLang)}
          </p>
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white cursor-pointer"
            style={{ backgroundColor: INDIGO }}
          >
            <Label zh="返回今日" ja="今日へ戻る" uiLang={uiLang} />
          </button>
        </div>
      </div>
    );
  }

  // End-of-session summary
  if (finished || !current) {
    return (
      <div data-testid="review-session" className="w-full max-w-xl mx-auto px-4 py-10">
        <div
          data-testid="review-summary"
          className="rounded-2xl border border-slate-200 bg-[#FBFAF7] p-8 text-center space-y-5"
          style={{ color: INK }}
        >
          <h2 className="text-xl font-bold">
            <Label zh="今次複習完成" ja="復習完了" uiLang={uiLang} stacked />
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-3xl font-bold font-mono-num" data-testid="review-summary-count">
                {reviewedIds.size}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                <Label zh="已複習卡片" ja="復習したカード" uiLang={uiLang} stacked />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-3xl font-bold font-mono-num text-rose-700" data-testid="review-summary-again">
                {againCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                <Label zh="唔記得次數" ja="もう一度" uiLang={uiLang} stacked />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onExit}
            data-testid="review-summary-exit-btn"
            className="w-full inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white cursor-pointer"
            style={{ backgroundColor: INDIGO }}
          >
            <Label zh="返回今日" ja="今日へ戻る" uiLang={uiLang} />
          </button>
        </div>
      </div>
    );
  }

  const frontWord = current.kanji?.trim() ? current.kanji : current.reading;
  const showReadingOnBack = Boolean(current.kanji?.trim()) && current.kanji !== current.reading;

  return (
    <div data-testid="review-session" className="w-full max-w-xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Progress header */}
      <div className="flex items-center gap-3">
        {exitButton}
        <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%`, backgroundColor: INDIGO }}
          />
        </div>
        <span
          data-testid="review-progress"
          className="font-mono-num text-sm text-slate-600 tabular-nums whitespace-nowrap"
        >
          {index + 1} / {total}
        </span>
      </div>

      {/* Card */}
      <div
        className="rounded-2xl border border-slate-200 bg-[#FBFAF7] shadow-sm px-4 sm:px-8 py-8 space-y-6"
        style={{ color: INK }}
      >
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{current.level} · {current.partOfSpeech}</span>
          {currentState && currentState.repetitions > 0 ? (
            <span>{formatBilingual('複習', '復習', uiLang)}</span>
          ) : (
            <span>{formatBilingual('新詞', '新規', uiLang)}</span>
          )}
        </div>

        {/* FRONT */}
        <div className="text-center space-y-4">
          <div
            data-testid="review-front-word"
            className="font-jp font-semibold leading-tight"
            style={{
              fontFamily: JP_SERIF,
              fontSize: 'clamp(36px, 13vw, 56px)',
              overflowWrap: 'anywhere',
            }}
            lang="ja"
          >
            {frontWord}
          </div>
          <button
            type="button"
            onClick={() => speakJapanese(frontWord)}
            data-testid="review-play-audio-btn"
            aria-label={formatBilingual(`播放「${frontWord}」發音`, `「${frontWord}」を再生`, uiLang)}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>

        {!revealed ? (
          <div className="pt-2">
            <button
              ref={revealBtnRef}
              type="button"
              onClick={reveal}
              data-testid="review-reveal-btn"
              className="w-full rounded-xl py-3.5 text-base font-semibold text-white cursor-pointer"
              style={{ backgroundColor: INDIGO }}
            >
              <Label zh="顯示答案" ja="答えを見る" uiLang={uiLang} />
            </button>
            <p className="hidden sm:block text-center text-[11px] text-slate-400 mt-2">
              {formatBilingual('撳 Space / Enter 顯示答案', 'Space / Enter で表示', uiLang)}
            </p>
          </div>
        ) : (
          <div data-testid="review-back" className="space-y-5 border-t border-slate-200 pt-5">
            {showReadingOnBack && <PitchReading item={current} uiLang={uiLang} />}
            {!showReadingOnBack && (
              <div className="text-center text-xs text-slate-500">{current.pitchAccent}</div>
            )}

            <div className="text-center text-xl font-bold">{current.meaning}</div>

            {current.coreImage && (
              <div className="rounded-xl bg-white border border-slate-200 p-4 text-sm leading-relaxed text-slate-700">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">
                  {formatBilingual('核心語感', 'コアイメージ', uiLang)}
                </div>
                {current.coreImage}
              </div>
            )}

            {current.exampleJp && (
              <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-lg" style={{ fontFamily: JP_SERIF }} lang="ja">
                    <FuriganaText text={current.exampleJp} />
                  </div>
                  <button
                    type="button"
                    onClick={() => speakJapanese(current.exampleJp)}
                    aria-label={formatBilingual('朗讀例句', '例文を再生', uiLang)}
                    className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                {current.exampleHk && <div className="text-sm text-slate-600">{current.exampleHk}</div>}
              </div>
            )}

            {onAskSenseiWithContext && (
              <div className="text-center">
                <button
                  type="button"
                  data-testid="review-ask-sensei-btn"
                  onClick={() =>
                    onAskSenseiWithContext(
                      `Sensei，我啱啱複習緊「${current.kanji || current.reading}（${current.reading}）」，意思係「${current.meaning}」。可唔可以用廣東話講下佢嘅核心語感、常見搭配同相近詞分別，再舉兩個生活例句？`,
                      current
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium hover:underline cursor-pointer"
                  style={{ color: INDIGO }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{formatBilingual('問 Sensei', '先生に聞く', uiLang)}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rating bar: sticky at the bottom so it stays reachable on small screens */}
      {revealed && (
        <div
          className="sticky bottom-0 z-10 -mx-3 sm:mx-0 px-3 sm:px-0 py-2 bg-white/85 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none grid grid-cols-4 gap-2"
          role="group"
          aria-label={formatBilingual('評分', '評価', uiLang)}
        >
          {RATING_META.map((m) => (
            <button
              key={m.rating}
              type="button"
              data-testid={`review-rate-${m.rating}`}
              onClick={() => rate(m.rating)}
              className={`flex flex-col items-center justify-center min-h-[64px] rounded-xl border bg-white px-1 py-2 text-sm font-semibold transition-colors cursor-pointer ${m.tone}`}
            >
              <span className="leading-tight text-center">
                <Label zh={m.zh} ja={m.ja} uiLang={uiLang} stacked />
              </span>
              <span className="mt-1 text-[11px] font-normal text-slate-500 font-mono-num whitespace-nowrap">
                {getIntervalPreview(currentState, m.rating, uiLang)}
              </span>
              <span className="hidden sm:block text-[10px] font-normal text-slate-400">{m.key}</span>
            </button>
          ))}
        </div>
      )}

      {revealed && againCount > 0 && (
        <p className="text-center text-[11px] text-slate-400 inline-flex w-full items-center justify-center gap-1">
          <RotateCcw className="w-3 h-3" />
          {formatBilingual('「唔記得」嘅卡會喺今次最後再出一次', '「もう一度」のカードは最後にもう一度出ます', uiLang)}
        </p>
      )}
    </div>
  );
};

export default ReviewSession;
