import { JlptLevel, SrsCardState, SrsRating, updateSrsCard } from './srsEngine';
import { VOCAB_DATABASE, VocabItem } from '../data/jlptCurriculum';
import {
  EXTRA_VOCAB_POOL,
  SUPPLEMENTAL_DAILY_VOCAB_BY_LEVEL,
} from '../data/dailyTeacherLessonsAndMockExamData';
import type { UiLang } from '../data/listeningAndDictionaryData';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True when an SRS entry exists but the card has never actually been rated,
 * e.g. an entry created only to hold a card note via upsertSrsCardNote.
 * Such cards are treated as "new" rather than "due".
 */
function isNeverReviewed(state: SrsCardState | undefined): boolean {
  if (!state) return true;
  return !state.lastReviewedAt && state.repetitions === 0 && state.status === 'new';
}

/**
 * Full vocabulary pool: built-in curriculum, daily-teacher extras, supplemental
 * daily vocab and the user's custom vocab, de-duplicated by id with the first
 * occurrence winning so ordering stays stable.
 */
export function getAllVocabPool(customVocab: VocabItem[]): VocabItem[] {
  const supplemental = Object.values(SUPPLEMENTAL_DAILY_VOCAB_BY_LEVEL ?? {}).flat();
  const seen = new Set<string>();
  const pool: VocabItem[] = [];
  for (const item of [
    ...VOCAB_DATABASE,
    ...EXTRA_VOCAB_POOL,
    ...supplemental,
    ...(customVocab ?? []),
  ]) {
    if (!item || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    pool.push(item);
  }
  return pool;
}

/**
 * Cards whose SRS state says they are due now, oldest due first.
 * srsMap ids that are not in the pool, and never-reviewed note-only entries, are ignored.
 */
export function getDueVocab(
  srsMap: Record<string, SrsCardState>,
  pool: VocabItem[],
  nowMs: number = Date.now()
): VocabItem[] {
  const byId = new Map<string, VocabItem>();
  for (const item of pool) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  const due: Array<{ item: VocabItem; at: number }> = [];
  for (const [id, state] of Object.entries(srsMap ?? {})) {
    const item = byId.get(id);
    if (!item || !state || isNeverReviewed(state)) continue;
    if (typeof state.nextReviewAt !== 'number') continue;
    if (state.nextReviewAt <= nowMs) due.push({ item, at: state.nextReviewAt });
  }
  due.sort((a, b) => a.at - b.at);
  return due.map((d) => d.item);
}

/**
 * Unseen cards of a level in stable pool order, up to `limit`.
 * A card counts as new when it has no SRS entry or only a never-reviewed entry.
 */
export function getNewVocabForLevel(
  srsMap: Record<string, SrsCardState>,
  pool: VocabItem[],
  level: JlptLevel,
  limit: number
): VocabItem[] {
  if (limit <= 0) return [];
  const result: VocabItem[] = [];
  for (const item of pool) {
    if (item.level !== level) continue;
    if (!isNeverReviewed(srsMap?.[item.id])) continue;
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

/** Number of SRS entries whose lastReviewedAt falls on today's local calendar date. */
export function countReviewedToday(
  srsMap: Record<string, SrsCardState>,
  nowMs: number = Date.now()
): number {
  const now = new Date(nowMs);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  let count = 0;
  for (const state of Object.values(srsMap ?? {})) {
    const at = state?.lastReviewedAt;
    if (typeof at === 'number' && at >= start && at < end) count += 1;
  }
  return count;
}

/**
 * Short label for the interval a rating would schedule, e.g. "10 分鐘", "1 日", "3 日", "2 個月".
 * Optional uiLang 'ja' returns Japanese units instead.
 */
export function getIntervalPreview(
  current: SrsCardState | undefined,
  rating: SrsRating,
  uiLang: UiLang = 'zh'
): string {
  const ja = uiLang === 'ja';
  if (rating === 'again') return ja ? '10分' : '10 分鐘';
  const simulated = updateSrsCard(current, current?.itemId ?? 'preview', rating, 0);
  const days = Math.max(1, Math.round(simulated.nextReviewAt / DAY_MS));
  if (days < 30) return ja ? `${days}日` : `${days} 日`;
  if (days < 365) {
    const months = Math.round((days / 30) * 10) / 10;
    return ja ? `${months}ヶ月` : `${months} 個月`;
  }
  const years = Math.round((days / 365) * 10) / 10;
  return ja ? `${years}年` : `${years} 年`;
}
