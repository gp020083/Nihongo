import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllVocabPool,
  getDueVocab,
  getNewVocabForLevel,
  countReviewedToday,
  getIntervalPreview,
} from './reviewQueue';
import { updateSrsCard, SrsCardState } from './srsEngine';
import type { VocabItem } from '../data/jlptCurriculum';

const DAY = 86_400_000;

function mkVocab(id: string, level: VocabItem['level'] = 'N5'): VocabItem {
  return {
    id,
    level,
    kanji: id,
    reading: 'よみ',
    romaji: 'yomi',
    pitchAccent: '[0]',
    partOfSpeech: '名詞',
    meaning: 'm',
    coreImage: 'c',
    exampleJp: 'e',
    exampleHk: 'h',
  };
}

function mkState(id: string, nextReviewAt: number, extra: Partial<SrsCardState> = {}): SrsCardState {
  return {
    itemId: id,
    intervalDays: 1,
    easeFactor: 2.5,
    repetitions: 1,
    nextReviewAt,
    lastReviewedAt: nextReviewAt - DAY,
    status: 'learning',
    ...extra,
  };
}

test('getAllVocabPool merges built-in and custom vocab without duplicate ids', () => {
  const builtIn = getAllVocabPool([]);
  assert.ok(builtIn.length > 0);
  assert.equal(new Set(builtIn.map((v) => v.id)).size, builtIn.length);
  assert.ok(builtIn.some((v) => v.id === 'n5-v1'));
  assert.ok(builtIn.some((v) => v.id.startsWith('dt-sup-')), 'includes supplemental daily vocab');

  const dupCustom = { ...mkVocab('n5-v1'), kanji: 'OVERRIDE' };
  const withCustom = getAllVocabPool([mkVocab('custom-1'), dupCustom]);
  assert.equal(withCustom.length, builtIn.length + 1);
  assert.ok(withCustom.some((v) => v.id === 'custom-1'));
  assert.notEqual(withCustom.find((v) => v.id === 'n5-v1')?.kanji, 'OVERRIDE');
});

test('getDueVocab returns only due cards in the pool, sorted by nextReviewAt', () => {
  const now = 1_700_000_000_000;
  const pool = [mkVocab('a'), mkVocab('b'), mkVocab('c'), mkVocab('d')];
  const srsMap: Record<string, SrsCardState> = {
    a: mkState('a', now - 1000),
    b: mkState('b', now - 5 * DAY),
    c: mkState('c', now + DAY), // not due yet
    d: mkState('d', now), // due exactly now
    ghost: mkState('ghost', now - DAY), // not in pool
  };
  assert.deepEqual(
    getDueVocab(srsMap, pool, now).map((v) => v.id),
    ['b', 'a', 'd']
  );
});

test('getDueVocab ignores never-reviewed note-only entries', () => {
  const now = 1_700_000_000_000;
  const pool = [mkVocab('a')];
  const srsMap: Record<string, SrsCardState> = {
    a: { itemId: 'a', intervalDays: 0, easeFactor: 2.5, repetitions: 0, nextReviewAt: now - DAY, status: 'new' },
  };
  assert.deepEqual(getDueVocab(srsMap, pool, now), []);
  assert.deepEqual(getNewVocabForLevel(srsMap, pool, 'N5', 5).map((v) => v.id), ['a']);
});

test('getNewVocabForLevel returns unseen cards of the level in stable order up to limit', () => {
  const pool = [mkVocab('a'), mkVocab('x', 'N4'), mkVocab('b'), mkVocab('c'), mkVocab('d')];
  const srsMap = { b: mkState('b', 0) };
  assert.deepEqual(getNewVocabForLevel(srsMap, pool, 'N5', 2).map((v) => v.id), ['a', 'c']);
  assert.deepEqual(getNewVocabForLevel(srsMap, pool, 'N5', 10).map((v) => v.id), ['a', 'c', 'd']);
  assert.deepEqual(getNewVocabForLevel(srsMap, pool, 'N4', 10).map((v) => v.id), ['x']);
  assert.deepEqual(getNewVocabForLevel(srsMap, pool, 'N5', 0), []);
});

test('countReviewedToday counts only entries reviewed on the local calendar day', () => {
  const now = new Date(2026, 10, 10, 15, 0, 0).getTime();
  const startOfDay = new Date(2026, 10, 10, 0, 0, 0).getTime();
  const srsMap: Record<string, SrsCardState> = {
    a: mkState('a', now + DAY, { lastReviewedAt: startOfDay }),
    b: mkState('b', now + DAY, { lastReviewedAt: now - 60_000 }),
    c: mkState('c', now + DAY, { lastReviewedAt: startOfDay - 1 }), // yesterday
    d: { itemId: 'd', intervalDays: 0, easeFactor: 2.5, repetitions: 0, nextReviewAt: now, status: 'new' },
  };
  assert.equal(countReviewedToday(srsMap, now), 2);
  assert.equal(countReviewedToday({}, now), 0);
});

test('getIntervalPreview mirrors SM-2 scheduling with short Chinese labels', () => {
  assert.equal(getIntervalPreview(undefined, 'again'), '10 分鐘');
  assert.equal(getIntervalPreview(undefined, 'hard'), '1 日');
  assert.equal(getIntervalPreview(undefined, 'good'), '1 日');
  assert.equal(getIntervalPreview(undefined, 'easy'), '4 日');

  const afterGood = updateSrsCard(undefined, 'x', 'good', 0);
  assert.equal(getIntervalPreview(afterGood, 'good'), '3 日');

  const longCard = mkState('x', 0, { intervalDays: 40, repetitions: 5 });
  assert.match(getIntervalPreview(longCard, 'good'), /個月$/);
  assert.equal(getIntervalPreview(undefined, 'good', 'ja'), '1日');
});
