import React from 'react';
import { Flame, Trophy, CheckCircle2, Sparkles } from 'lucide-react';
import { StudyStreakSummary } from '../utils/srsEngine';
import { UiLang, formatBilingual } from '../data/listeningAndDictionaryData';

interface StudyStreakWidgetProps {
  streakSummary: StudyStreakSummary;
  uiLang: UiLang;
  onCheckInToday: () => void;
}

export const StudyStreakWidget: React.FC<StudyStreakWidgetProps> = ({
  streakSummary,
  uiLang,
  onCheckInToday,
}) => {
  return (
    <div
      data-testid="study-streak-widget"
      className="bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-amber-50/80 border border-amber-200/90 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs"
    >
      {/* Left: Flame Icon + Current Consecutive Days + All-Time Best Record */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
              streakSummary.isCheckedInToday
                ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                : 'bg-amber-100 text-amber-700 border-amber-300'
            }`}
          >
            <Flame className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900">
                {formatBilingual('學習連續打卡', '連続学習ストリーク', uiLang)}：
              </span>
              <strong
                data-testid="streak-current-days"
                className="text-sm sm:text-base font-extrabold font-mono-num text-amber-700"
              >
                {streakSummary.currentStreakDays}{' '}
                {formatBilingual('日連續', '日連続', uiLang, '/')}
              </strong>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
              <span
                data-testid="streak-longest-days"
                className="inline-flex items-center gap-1 font-bold text-amber-900 bg-white/90 px-2 py-0.5 rounded border border-amber-200 font-mono-num"
              >
                <Trophy className="w-3 h-3 text-amber-500" />
                <span>
                  {formatBilingual(
                    `最高紀錄 ${streakSummary.longestStreakDays} 日`,
                    `最高記録 ${streakSummary.longestStreakDays} 日`,
                    uiLang
                  )}
                </span>
              </span>

              <span className="text-slate-500 hidden sm:inline">
                {uiLang === 'ja'
                  ? streakSummary.motivationalMessageJa
                  : streakSummary.motivationalMessageHk}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: 7-Day Visual Check-In Strip + Today Check-In Button */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div
          data-testid="streak-7day-strip"
          aria-label="近7日學習打卡紀錄"
          className="flex items-center gap-1 bg-white/90 border border-amber-200/80 rounded-lg px-2 py-1"
        >
          {streakSummary.recentSevenDays.map((day) => (
            <div
              key={day.dateStr}
              data-testid={`streak-day-${day.dateStr}`}
              title={`${day.dateStr} (${day.completed ? '已打卡' : '未打卡'})`}
              className="flex flex-col items-center gap-0.5 px-1"
            >
              <span
                className={`text-[10px] font-bold ${
                  day.isToday ? 'text-amber-800' : 'text-slate-500'
                }`}
              >
                {day.dayLabelHk}
              </span>
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                  day.completed
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : day.isToday
                      ? 'bg-amber-50 text-amber-700 border border-dashed border-amber-400'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {day.completed ? '✓' : '·'}
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          data-testid="streak-checkin-btn"
          onClick={onCheckInToday}
          disabled={streakSummary.isCheckedInToday}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all cursor-pointer shrink-0 ${
            streakSummary.isCheckedInToday
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 cursor-default'
              : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-2xs'
          }`}
        >
          {streakSummary.isCheckedInToday ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {formatBilingual(
                  `今日已打卡 (${streakSummary.currentStreakDays}日)`,
                  `本日達成 (${streakSummary.currentStreakDays}日)`,
                  uiLang
                )}
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {formatBilingual(
                  '🔥 立即今日打卡 (+20 XP)',
                  '🔥 今日の学習を記録 (+20 XP)',
                  uiLang
                )}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
