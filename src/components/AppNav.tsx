import React from 'react';
import { BookOpen, Languages, PencilLine, Sunrise, type LucideIcon } from 'lucide-react';
import { UiLang } from '../data/listeningAndDictionaryData';

/* ------------------------------------------------------------------ */
/* Single source of truth for the app's information architecture       */
/* ------------------------------------------------------------------ */

export type MainTab = 'today' | 'course' | 'practice' | 'tools';
export type CourseSub = 'study' | 'overview';
export type PracticeSub = 'quiz' | 'mock-exam' | 'mistakes' | 'materials';
export type ToolsSub = 'dictionary' | 'sensei';

export interface NavLabel<T extends string = string> {
  id: T;
  zh: string;
  ja: string;
}

export interface MainNavItem extends NavLabel<MainTab> {
  icon: LucideIcon;
}

export const MAIN_NAV: MainNavItem[] = [
  { id: 'today', zh: '今日', ja: '今日', icon: Sunrise },
  { id: 'course', zh: '課程', ja: 'コース', icon: BookOpen },
  { id: 'practice', zh: '練習', ja: '練習', icon: PencilLine },
  { id: 'tools', zh: '工具', ja: 'ツール', icon: Languages },
];

export const COURSE_SUBS: NavLabel<CourseSub>[] = [
  { id: 'study', zh: '課程內容', ja: '学習' },
  { id: 'overview', zh: '級別總覽', ja: 'レベル概要' },
];

export const PRACTICE_SUBS: NavLabel<PracticeSub>[] = [
  { id: 'quiz', zh: '快速測驗', ja: 'クイズ' },
  { id: 'mock-exam', zh: 'JLPT 模擬考', ja: '模擬試験' },
  { id: 'mistakes', zh: '錯題本', ja: '間違いノート' },
  { id: 'materials', zh: '自訂教材出題', ja: '教材から出題' },
];

export const TOOLS_SUBS: NavLabel<ToolsSub>[] = [
  { id: 'dictionary', zh: '辭典', ja: '辞書' },
  { id: 'sensei', zh: 'AI 導師', ja: 'AI 先生' },
];

/** Primary text for the current UI language. */
export function primaryText(label: { zh: string; ja: string }, uiLang: UiLang): string {
  return uiLang === 'ja' ? label.ja : label.zh;
}

/** Japanese secondary line, only in bilingual mode and only when it differs. */
export function secondaryText(label: { zh: string; ja: string }, uiLang: UiLang): string | null {
  if (uiLang !== 'bilingual') return null;
  return label.ja && label.ja !== label.zh ? label.ja : null;
}

/* ------------------------------------------------------------------ */
/* Section heading: Chinese primary + small muted Japanese line        */
/* ------------------------------------------------------------------ */

export const SectionHeading: React.FC<{
  zh: string;
  ja: string;
  uiLang: UiLang;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
  id?: string;
}> = ({ zh, ja, uiLang, as = 'h2', className = '', id }) => {
  const Tag = as;
  const sub = secondaryText({ zh, ja }, uiLang);
  return (
    <div className={className}>
      <Tag id={id} className="text-lg sm:text-xl font-semibold tracking-tight text-ink">
        {primaryText({ zh, ja }, uiLang)}
      </Tag>
      {sub && <p className="font-jp text-xs text-ink-faint mt-0.5">{sub}</p>}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Desktop top navigation                                             */
/* ------------------------------------------------------------------ */

export const TopNav: React.FC<{
  active: MainTab;
  uiLang: UiLang;
  onNavigate: (tab: MainTab) => void;
}> = ({ active, uiLang, onNavigate }) => (
  <nav aria-label="主導航" className="hidden md:flex items-center gap-1">
    {MAIN_NAV.map((item) => {
      const isActive = active === item.id;
      const sub = secondaryText(item, uiLang);
      return (
        <button
          key={item.id}
          type="button"
          data-testid={`nav-${item.id}`}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => onNavigate(item.id)}
          className={`relative px-3.5 py-2 rounded-lg text-sm transition-colors cursor-pointer flex items-baseline gap-1.5 ${
            isActive
              ? 'text-ai-ink font-semibold bg-ai-soft'
              : 'text-ink-soft hover:text-ink hover:bg-sunken'
          }`}
        >
          <span>{primaryText(item, uiLang)}</span>
          {sub && (
            <span className={`font-jp text-[11px] ${isActive ? 'text-ai-ink/70' : 'text-ink-faint'}`}>
              {sub}
            </span>
          )}
        </button>
      );
    })}
  </nav>
);

/* ------------------------------------------------------------------ */
/* Mobile bottom tab bar (inspired by AIMRAN ios-tab-bar: active dot)  */
/* ------------------------------------------------------------------ */

export const BottomTabBar: React.FC<{
  active: MainTab;
  uiLang: UiLang;
  onNavigate: (tab: MainTab) => void;
}> = ({ active, uiLang, onNavigate }) => (
  <nav
    aria-label="主導航"
    data-testid="mobile-bottom-nav"
    className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line pb-safe"
  >
    <div className="grid grid-cols-4">
      {MAIN_NAV.map((item) => {
        const isActive = active === item.id;
        const Icon = item.icon;
        const sub = secondaryText(item, uiLang);
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`mobile-nav-${item.id}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
            className={`relative flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 min-h-[56px] cursor-pointer transition-colors ${
              isActive ? 'text-ai-ink' : 'text-ink-faint hover:text-ink-soft'
            }`}
          >
            <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
            <span className={`text-[11px] leading-none ${isActive ? 'font-semibold' : ''}`}>
              {primaryText(item, uiLang)}
            </span>
            {sub && <span className="font-jp text-[9px] leading-none opacity-70">{sub}</span>}
            {isActive && (
              <span aria-hidden="true" className="absolute top-0 h-0.5 w-6 rounded-full bg-ai" />
            )}
          </button>
        );
      })}
    </div>
  </nav>
);

/* ------------------------------------------------------------------ */
/* Sub-segmented control (inspired by AIMRAN ios-segments-premium)     */
/* ------------------------------------------------------------------ */

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  uiLang,
  ariaLabel,
  testIdPrefix,
  badges,
}: {
  items: NavLabel<T>[];
  value: T;
  onChange: (id: T) => void;
  uiLang: UiLang;
  ariaLabel: string;
  testIdPrefix: string;
  badges?: Partial<Record<T, number>>;
}) {
  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1 p-1 rounded-xl bg-sunken"
      >
        {items.map((item) => {
          const isActive = value === item.id;
          const badge = badges?.[item.id];
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`${testIdPrefix}-${item.id}`}
              title={item.ja}
              onClick={() => onChange(item.id)}
              className={`whitespace-nowrap px-3 sm:px-3.5 py-1.5 rounded-lg text-[13px] transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                isActive
                  ? 'bg-surface text-ink font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04)]'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <span>{primaryText(item, uiLang)}</span>
              {typeof badge === 'number' && badge > 0 && (
                <span className="font-mono-num text-[10px] px-1.5 py-px rounded-full bg-ng/10 text-ng">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
