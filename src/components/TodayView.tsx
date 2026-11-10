import React from 'react';
import { ArrowRight, BookOpen, Check, Flame, Headphones, NotebookPen, PencilLine, Play } from 'lucide-react';
import { JlptLevel, StudyStreakSummary } from '../utils/srsEngine';
import { UiLang } from '../data/listeningAndDictionaryData';
import { GoalConfettiBurst } from './GoalConfettiBurst';

export interface TodayViewProps {
  uiLang: UiLang;
  selectedLevel: JlptLevel;
  dueCount: number;
  newCount: number;
  reviewedTodayCount: number;
  dailyTarget: number;
  streakSummary: StudyStreakSummary;
  xp: number;
  pendingMistakes: number;
  showGoalConfetti: boolean;
  extraNewAvailable: number;
  onStartSession: () => void;
  onStartExtraNew: () => void;
  onCheckInToday: () => void;
  onOpenWarmup: () => void;
  onGoToQuiz: () => void;
  onGoToMistakes: () => void;
  onGoToCourse: () => void;
}

function greeting(hour: number) {
  if (hour < 5) return { zh: '夜深了', ja: 'こんばんは' };
  if (hour < 12) return { zh: '早晨', ja: 'おはようございます' };
  if (hour < 18) return { zh: '午安', ja: 'こんにちは' };
  return { zh: '晚上好', ja: 'こんばんは' };
}

const ProgressRing: React.FC<{ value: number; target: number; label: string }> = ({ value, target, label }) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const met = target > 0 && value >= target;
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90" role="img" aria-label={label}>
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" className="stroke-line" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={`transition-[stroke-dashoffset] duration-500 ${met ? 'stroke-ok' : 'stroke-ai'}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-mono-num text-xl font-semibold text-ink">{value}</span>
        <span className="font-mono-num text-[11px] text-ink-faint mt-1">/ {target}</span>
      </div>
    </div>
  );
};

export const TodayView: React.FC<TodayViewProps> = ({
  uiLang,
  selectedLevel,
  dueCount,
  newCount,
  reviewedTodayCount,
  dailyTarget,
  streakSummary,
  xp,
  pendingMistakes,
  showGoalConfetti,
  extraNewAvailable,
  onStartSession,
  onStartExtraNew,
  onCheckInToday,
  onOpenWarmup,
  onGoToQuiz,
  onGoToMistakes,
  onGoToCourse,
}) => {
  const ja = uiLang === 'ja';
  const bi = uiLang === 'bilingual';
  const t = (zh: string, jaText: string) => (ja ? jaText : zh);

  const now = new Date();
  const g = greeting(now.getHours());
  const dateStr = now.toLocaleDateString(ja ? 'ja-JP' : 'zh-HK', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const sessionSize = dueCount + newCount;
  const minutes = Math.max(1, Math.ceil(sessionSize * 0.4));
  const goalMet = reviewedTodayCount >= dailyTarget;
  const allDone = sessionSize === 0;

  let headline: string;
  let subline: string;
  if (dueCount > 0) {
    headline = t(`今日有 ${dueCount} 張卡到期`, `今日の復習は ${dueCount} 枚`);
    subline =
      newCount > 0
        ? t(`另加 ${newCount} 個 ${selectedLevel} 新字，約 ${minutes} 分鐘`, `${selectedLevel} の新しい単語 ${newCount} 語・約 ${minutes} 分`)
        : t(`約 ${minutes} 分鐘`, `約 ${minutes} 分`);
  } else if (newCount > 0) {
    headline = t('今日冇到期嘅卡', '今日の復習はありません');
    subline = t(`學 ${newCount} 個 ${selectedLevel} 新字，約 ${minutes} 分鐘`, `${selectedLevel} の新しい単語 ${newCount} 語・約 ${minutes} 分`);
  } else {
    headline = goalMet ? t('今日目標已完成', '今日の目標を達成') : t('暫時冇卡要溫', '今は復習するカードがありません');
    subline = t('可以做個小測，或者再學幾個新字。', 'クイズに挑戦するか、新しい単語をもう少し。');
  }

  const steps = [
    {
      key: 'due',
      n: '1',
      zh: '到期複習',
      jaLabel: '復習',
      value: t(`${dueCount} 張`, `${dueCount} 枚`),
      icon: Play,
      done: dueCount === 0 && reviewedTodayCount > 0,
      onClick: onStartSession,
      disabled: allDone,
    },
    {
      key: 'new',
      n: '2',
      zh: '新字',
      jaLabel: '新しい単語',
      value: t(`${newCount} 個`, `${newCount} 語`),
      icon: BookOpen,
      done: newCount === 0 && goalMet,
      onClick: onStartSession,
      disabled: allDone,
    },
    {
      key: 'warmup',
      n: '3',
      zh: '聽力熱身',
      jaLabel: '聴解ウォームアップ',
      value: t('跟讀一句', '一文シャドーイング'),
      icon: Headphones,
      done: false,
      onClick: onOpenWarmup,
      disabled: false,
    },
    {
      key: 'quiz',
      n: '4',
      zh: '小測',
      jaLabel: 'ミニテスト',
      value: t('約 5 分鐘', '約 5 分'),
      icon: PencilLine,
      done: false,
      onClick: onGoToQuiz,
      disabled: false,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6" data-testid="today-view">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Hero */}
        <section
          aria-labelledby="today-greeting"
          className="lg:col-span-2 bg-surface rounded-2xl p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]"
        >
          <p className="text-xs text-ink-faint">{dateStr}</p>
          <div className="mt-3">
            <h1 id="today-greeting" className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
              {ja ? g.ja : g.zh}
            </h1>
            {bi && <p className="font-jp text-sm text-ink-faint mt-1">{g.ja}</p>}
          </div>

          <div className="mt-6 sm:mt-8">
            <p className="text-lg sm:text-xl text-ink" data-testid="today-headline">
              {headline}
            </p>
            <p className="text-sm text-ink-soft mt-1">{subline}</p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
            {!allDone ? (
              <button
                type="button"
                data-testid="start-today-session-btn"
                onClick={onStartSession}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-ai hover:bg-ai-hover text-white text-base font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-ai/30"
              >
                <Play className="w-4 h-4" fill="currentColor" aria-hidden="true" />
                {t('開始今日學習', '今日の学習を始める')}
                <span className="font-mono-num text-sm font-normal text-white/70 ml-1">{sessionSize}</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="start-today-session-btn"
                onClick={onStartExtraNew}
                disabled={extraNewAvailable === 0}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-ai hover:bg-ai-hover text-white text-base font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                {t(`再學 ${extraNewAvailable} 個新字`, `新しい単語をあと ${extraNewAvailable} 語`)}
              </button>
            )}
            <button
              type="button"
              onClick={onGoToCourse}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm text-ink-soft hover:text-ink hover:bg-sunken transition-colors cursor-pointer"
            >
              {t(`繼續課程 · JLPT ${selectedLevel}`, `コースを続ける・JLPT ${selectedLevel}`)}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* Progress, streak, XP */}
        <aside className="bg-surface rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] flex flex-col gap-5">
          <div className="relative flex items-center gap-4" data-testid="daily-progress-meter">
            <GoalConfettiBurst active={showGoalConfetti} targetCount={dailyTarget} />
            <ProgressRing
              value={reviewedTodayCount}
              target={dailyTarget}
              label={t(
                `今日已複習 ${reviewedTodayCount} 張，目標 ${dailyTarget} 張`,
                `今日 ${reviewedTodayCount} 枚復習・目標 ${dailyTarget} 枚`
              )}
            />
            <div>
              <div className="text-sm font-semibold text-ink">{t('今日進度', '今日の進み具合')}</div>
              {bi && <div className="font-jp text-[11px] text-ink-faint">今日の進み具合</div>}
              <div className={`text-xs mt-1.5 ${goalMet ? 'text-ok' : 'text-ink-soft'}`}>
                {goalMet ? t('已達成目標', '目標達成') : t(`尚欠 ${dailyTarget - reviewedTodayCount} 張`, `あと ${dailyTarget - reviewedTodayCount} 枚`)}
              </div>
            </div>
          </div>

          <div className="h-px bg-line" />

          <div className="flex items-center justify-between gap-3" data-testid="study-streak-widget">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  streakSummary.isCheckedInToday ? 'bg-ai text-white' : 'bg-sunken text-ink-faint'
                }`}
              >
                <Flame className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm text-ink">
                  {t('連續', '連続')}{' '}
                  <span className="font-mono-num font-semibold">{streakSummary.currentStreakDays}</span>{' '}
                  {t('日', '日')}
                </div>
                <div className="text-[11px] text-ink-faint">
                  {t('最長', '最長')} <span className="font-mono-num">{streakSummary.longestStreakDays}</span> {t('日', '日')}
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span className="font-mono-num">{xp}</span> XP
                </div>
              </div>
            </div>
            {!streakSummary.isCheckedInToday && (
              <button
                type="button"
                data-testid="streak-checkin-btn"
                onClick={onCheckInToday}
                className="text-xs px-3 py-1.5 rounded-lg border border-line text-ink-soft hover:text-ink hover:border-ink-faint cursor-pointer"
              >
                {t('打卡', 'チェックイン')}
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Today's plan */}
      <section aria-labelledby="today-plan-heading">
        <div className="flex items-baseline gap-2 mb-3">
          <h2 id="today-plan-heading" className="text-base font-semibold text-ink">
            {t('今日計劃', '今日のプラン')}
          </h2>
          {bi && <span className="font-jp text-[11px] text-ink-faint">今日のプラン</span>}
        </div>
        <ol className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  data-testid={`today-step-${s.key}`}
                  onClick={s.onClick}
                  disabled={s.disabled}
                  className="w-full h-full text-left bg-surface rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-shadow cursor-pointer disabled:cursor-default disabled:hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono-num ${
                        s.done ? 'bg-ok text-white' : 'bg-ai-soft text-ai-ink'
                      }`}
                    >
                      {s.done ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : s.n}
                    </span>
                    <Icon className="w-4 h-4 text-ink-faint" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-sm font-medium text-ink">{ja ? s.jaLabel : s.zh}</div>
                  <div className="text-xs text-ink-soft mt-0.5">{s.value}</div>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Shortcuts */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          data-testid="today-shortcut-course"
          onClick={onGoToCourse}
          className="flex items-center justify-between gap-3 bg-surface rounded-xl px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-shadow cursor-pointer"
        >
          <span className="inline-flex items-center gap-2.5 text-sm text-ink">
            <BookOpen className="w-4 h-4 text-ai-ink" aria-hidden="true" />
            {t('繼續課程', 'コースを続ける')}
            <span className="font-mono-num text-xs text-ink-faint">JLPT {selectedLevel}</span>
          </span>
          <ArrowRight className="w-4 h-4 text-ink-faint" aria-hidden="true" />
        </button>
        <button
          type="button"
          data-testid="today-shortcut-mistakes"
          onClick={onGoToMistakes}
          className="flex items-center justify-between gap-3 bg-surface rounded-xl px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-shadow cursor-pointer"
        >
          <span className="inline-flex items-center gap-2.5 text-sm text-ink">
            <NotebookPen className="w-4 h-4 text-ai-ink" aria-hidden="true" />
            {t('錯題待溫', '復習待ちの間違い')}
            <span className={`font-mono-num text-xs ${pendingMistakes > 0 ? 'text-ng' : 'text-ink-faint'}`}>
              {pendingMistakes} {t('條', '問')}
            </span>
          </span>
          <ArrowRight className="w-4 h-4 text-ink-faint" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
};
