import React, { useEffect, useRef } from 'react';
import { Check, LogIn, Moon, RefreshCw, ShieldCheck, Volume2, X } from 'lucide-react';
import { UiLang } from '../data/listeningAndDictionaryData';
import {
  GlobalVoiceConfig,
  GlobalVoiceStyle,
  VOICE_STYLE_OPTIONS,
  setGlobalVoiceConfig,
  speakJapanese,
} from './FuriganaText';
import { primaryText, secondaryText } from './AppNav';

/** Plain voice names (no marketing words); falls back to a cleaned label. */
const PLAIN_VOICE_NAMES: Partial<Record<GlobalVoiceStyle, { zh: string; ja: string }>> = {
  'nhk-anchor': { zh: '新聞男女雙聲', ja: 'ニュース・男女' },
  'nhk-female': { zh: '新聞女聲', ja: 'ニュース・女性' },
  'nhk-male': { zh: '新聞男聲', ja: 'ニュース・男性' },
  'cloud-stream': { zh: '廣播女聲', ja: '放送・女性' },
  'neural-female': { zh: '日常女聲', ja: '日常会話・女性' },
  'neural-male': { zh: '動畫聲優腔', ja: 'アニメ風' },
  'system-natural': { zh: '系統預設語音', ja: '端末の音声' },
};

function voiceName(opt: (typeof VOICE_STYLE_OPTIONS)[number], uiLang: UiLang): string {
  const plain = PLAIN_VOICE_NAMES[opt.id];
  if (plain) return uiLang === 'ja' ? plain.ja : plain.zh;
  const raw = uiLang === 'ja' ? opt.labelJa : opt.labelZh;
  return raw.replace(/^[^\p{L}\p{N}]+/u, '').replace(/\s*[（(].*$/, '').trim();
}

const SPEEDS = [0.8, 0.9, 1.0, 1.1, 1.25];
const DAILY_TARGETS = [5, 10, 15, 20, 30];
const LANGS: { id: UiLang; label: string }[] = [
  { id: 'bilingual', label: '中日雙語' },
  { id: 'zh', label: '中文' },
  { id: 'ja', label: '日本語' },
];

export interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  uiLang: UiLang;
  onChangeUiLang: (lang: UiLang) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  voiceConfig: GlobalVoiceConfig;
  dailyTarget: number;
  onChangeDailyTarget: (target: number) => void;
  dictionaryCount: number;
  isSyncingCloud: boolean;
  isOnline: boolean;
  lastSyncedAt: string | null;
  onSyncWords: () => void;
  isOwnerSignedIn: boolean;
  onOpenOwnerAuth: () => void;
}

const Group: React.FC<{ zh: string; ja: string; uiLang: UiLang; children: React.ReactNode }> = ({
  zh,
  ja,
  uiLang,
  children,
}) => {
  const sub = secondaryText({ zh, ja }, uiLang);
  return (
    <section className="py-5 border-b border-line last:border-b-0">
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-ink">{primaryText({ zh, ja }, uiLang)}</h3>
        {sub && <span className="font-jp text-[11px] text-ink-faint">{sub}</span>}
      </div>
      {children}
    </section>
  );
};

function chipClass(active: boolean) {
  return `px-3 py-1.5 rounded-lg text-[13px] border transition-colors cursor-pointer ${
    active
      ? 'bg-ai text-white border-ai'
      : 'bg-surface text-ink-soft border-line hover:border-ink-faint hover:text-ink'
  }`;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  open,
  onClose,
  uiLang,
  onChangeUiLang,
  isDarkMode,
  onToggleDarkMode,
  voiceConfig,
  dailyTarget,
  onChangeDailyTarget,
  dictionaryCount,
  isSyncingCloud,
  isOnline,
  lastSyncedAt,
  onSyncWords,
  isOwnerSignedIn,
  onOpenOwnerAuth,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const t = (zh: string, ja: string) => (uiLang === 'ja' ? ja : zh);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ESC to close, focus trap, body scroll lock, restore focus to opener
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => closeBtnRef.current?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  const voiceRole = voiceConfig.voiceStyle === 'nhk-male' ? 'male' : 'female';

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
      inert={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 motion-safe-transition ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-drawer-title"
        data-testid="settings-drawer"
        className={`absolute right-0 top-0 h-full w-full max-w-[400px] bg-paper text-ink shadow-[-8px_0_32px_rgba(0,0,0,0.12)] flex flex-col transition-transform duration-300 ease-out motion-safe-transition ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between px-5 sm:px-6 h-14 border-b border-line shrink-0">
          <div className="flex items-baseline gap-2">
            <h2 id="settings-drawer-title" className="text-base font-semibold">
              {t('設定', '設定')}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={t('關閉設定', '設定を閉じる')}
            data-testid="settings-close-btn"
            className="w-9 h-9 -mr-2 rounded-lg flex items-center justify-center text-ink-soft hover:text-ink hover:bg-sunken cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <Group zh="介面語言" ja="表示言語" uiLang={uiLang}>
            <div role="radiogroup" aria-label={t('介面語言', '表示言語')} className="flex flex-wrap gap-2">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={uiLang === l.id}
                  data-testid={`lang-btn-${l.id}`}
                  onClick={() => onChangeUiLang(l.id)}
                  className={chipClass(uiLang === l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </Group>

          <Group zh="外觀" ja="外観" uiLang={uiLang}>
            <button
              type="button"
              role="switch"
              aria-checked={isDarkMode}
              data-testid="dark-mode-toggle"
              onClick={onToggleDarkMode}
              className="w-full flex items-center justify-between gap-3 py-1 cursor-pointer"
            >
              <span className="inline-flex items-center gap-2 text-sm text-ink">
                <Moon className="w-4 h-4 text-ink-soft" aria-hidden="true" />
                {t('深色模式', 'ダークモード')}
              </span>
              <span
                aria-hidden="true"
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  isDarkMode ? 'bg-ai' : 'bg-line'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    isDarkMode ? 'translate-x-4' : ''
                  }`}
                />
              </span>
            </button>
          </Group>

          <Group zh="日語聲線" ja="音声" uiLang={uiLang}>
            <div className="flex items-center gap-2">
              <label htmlFor="settings-voice-select" className="sr-only">
                {t('日語聲線', '音声')}
              </label>
              <select
                id="settings-voice-select"
                data-testid="global-voice-style-select"
                value={voiceConfig.voiceStyle}
                onChange={(e) => setGlobalVoiceConfig({ voiceStyle: e.target.value as GlobalVoiceStyle })}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-surface border border-line text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ai/30 cursor-pointer"
              >
                {VOICE_STYLE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {voiceName(opt, uiLang)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-testid="global-voice-test-btn"
                onClick={() =>
                  speakJapanese(
                    'こんにちは。今日も一緒に勉強しましょう。',
                    1.0,
                    voiceRole,
                    voiceConfig.emotionTone
                  )
                }
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-soft hover:text-ink hover:border-ink-faint cursor-pointer"
              >
                <Volume2 className="w-4 h-4" aria-hidden="true" />
                {t('試聽', '試聴')}
              </button>
            </div>
          </Group>

          <Group zh="語速" ja="話す速さ" uiLang={uiLang}>
            <div className="flex flex-wrap gap-2">
              {SPEEDS.map((sp) => {
                const active = Math.abs(voiceConfig.speedMultiplier - sp) < 0.03;
                return (
                  <button
                    key={sp}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setGlobalVoiceConfig({ speedMultiplier: sp })}
                    className={`${chipClass(active)} font-mono-num`}
                  >
                    {sp.toFixed(sp === 1.25 ? 2 : 1)}x
                  </button>
                );
              })}
            </div>
          </Group>

          <Group zh="每日目標" ja="1日の目標" uiLang={uiLang}>
            <div className="flex flex-wrap gap-2">
              {DAILY_TARGETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={dailyTarget === n}
                  data-testid={`daily-target-${n}`}
                  onClick={() => onChangeDailyTarget(n)}
                  className={`${chipClass(dailyTarget === n)} font-mono-num`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-faint">{t('每日複習及新字張數', '1日に復習・学習するカード数')}</p>
          </Group>

          <Group zh="本地字庫" ja="辞書データ" uiLang={uiLang}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-ink-soft leading-relaxed">
                <div>
                  <span className="font-mono-num text-ink">{dictionaryCount}</span> {t('詞', '語')}
                </div>
                <div className="text-ink-faint">
                  {!isOnline
                    ? t('離線中', 'オフライン')
                    : lastSyncedAt
                      ? `${t('上次同步', '前回同期')} ${lastSyncedAt}`
                      : t('未同步', '未同期')}
                </div>
              </div>
              <button
                type="button"
                data-testid="status-bar-db-sync"
                onClick={onSyncWords}
                disabled={isSyncingCloud || !isOnline}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface text-[13px] text-ink-soft hover:text-ink hover:border-ink-faint disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} aria-hidden="true" />
                {isSyncingCloud ? t('同步中', '同期中') : t('同步', '同期')}
              </button>
            </div>
          </Group>

          <Group zh="帳戶" ja="アカウント" uiLang={uiLang}>
            <button
              type="button"
              data-testid="owner-login-trigger-btn"
              onClick={onOpenOwnerAuth}
              className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-line bg-surface text-sm text-ink hover:border-ink-faint cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                {isOwnerSignedIn ? (
                  <ShieldCheck className="w-4 h-4 text-ok" aria-hidden="true" />
                ) : (
                  <LogIn className="w-4 h-4 text-ink-soft" aria-hidden="true" />
                )}
                {isOwnerSignedIn ? t('已登入', 'ログイン済み') : t('登入', 'ログイン')}
              </span>
              {isOwnerSignedIn && <Check className="w-4 h-4 text-ok" aria-hidden="true" />}
            </button>
          </Group>
        </div>
      </div>
    </div>
  );
};
