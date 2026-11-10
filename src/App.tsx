/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, Settings } from 'lucide-react';
import {
  JlptLevel,
  SrsCardState,
  SrsRating,
  updateSrsCard,
  upsertSrsCardNote,
  QuizScoreResult,
  shouldTriggerGoalCelebration,
  WarmupSentenceItem,
  pickListeningWarmupSentence,
  calculateDetailedStudyStats,
  MistakeRecord,
  mergeMistakeRecords,
  convertMistakeToTargetedVocabAndSrs,
  getInitialMistakeSeed,
  verifyOwnerGoogleAccount,
  getInitialStreakSeed,
  calculateStudyStreakSummary,
  recordDailyStudyCheckIn,
} from './utils/srsEngine';
import {
  VocabItem,
  QuizQuestion,
  VOCAB_DATABASE,
  GRAMMAR_DATABASE,
} from './data/jlptCurriculum';
import { UiLang, SPEAKING_PROMPTS } from './data/listeningAndDictionaryData';
import {
  SyncedDictionaryEntry,
  loadLocalDictionaryDb,
  saveLocalDictionaryDb,
  mergeDictionaryEntries,
} from './utils/localWordDatabase';
import {
  getAllVocabPool,
  getDueVocab,
  getNewVocabForLevel,
  countReviewedToday,
} from './utils/reviewQueue';
import { StudyStage } from './components/StudyStage';
import { ReviewSession } from './components/ReviewSession';
import { DictionaryView } from './components/DictionaryView';
import { QuizArena } from './components/QuizArena';
import { MaterialStudio } from './components/MaterialStudio';
import { AiSenseiPanel, ChatMessage } from './components/AiSenseiPanel';
import { MethodBlueprint } from './components/MethodBlueprint';
import { ListeningWarmupPanel } from './components/ListeningWarmupPanel';
import { DetailedStudyStatsPanel } from './components/DetailedStudyStatsPanel';
import { JlptMockExamCenter } from './components/JlptMockExamCenter';
import {
  speakJapanese,
  GlobalVoiceConfig,
  getGlobalVoiceConfig,
  subscribeGlobalVoiceConfig,
} from './components/FuriganaText';
import { OwnerAuthModal, OwnerAuthSession } from './components/OwnerAuthModal';
import { TodayView } from './components/TodayView';
import { SettingsDrawer } from './components/SettingsDrawer';
import {
  MainTab,
  CourseSub,
  PracticeSub,
  ToolsSub,
  COURSE_SUBS,
  PRACTICE_SUBS,
  TOOLS_SUBS,
  TopNav,
  BottomTabBar,
  SegmentedControl,
  SectionHeading,
} from './components/AppNav';

const JLPT_LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const EXTRA_NEW_BATCH = 5;

const INITIAL_SENSEI_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome-1',
    role: 'assistant',
    content:
      'こんにちは！我係你嘅專屬 AI 日文導師「言の葉先生 (Kotonoha Sensei)」。\n\n無論你係由零開始學 N5 助詞，定係衝刺緊 N1 商務同文學讀解，我都會用最貼地嘅廣東話同你拆解每個文法背後嘅「母語者腦內畫面」。\n\n你可以隨時：\n1. 直接打字問我任何日文問題（例如：「點解呢句用『に』唔用『で』？」）\n2. 喺「自訂教材出題」貼上你睇緊嘅日文文章、歌詞或者上載教科書相片，我會即刻幫你拆解生字並出 JLPT 模擬題考你！',
    timestamp: '剛剛',
  },
];

export default function App() {
  // ---- Navigation: 4 destinations + sub-tabs ----
  const [activeTab, setActiveTab] = useState<MainTab>('today');
  const [courseSub, setCourseSub] = useState<CourseSub>('study');
  const [practiceSub, setPracticeSub] = useState<PracticeSub>('quiz');
  const [toolsSub, setToolsSub] = useState<ToolsSub>('dictionary');
  const [sessionQueue, setSessionQueue] = useState<VocabItem[] | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [selectedLevel, setSelectedLevel] = useState<JlptLevel>('N4');
  const [uiLang, setUiLang] = useState<UiLang>(() => {
    try {
      const saved = localStorage.getItem('kotonoha_ui_lang_v1');
      if (saved === 'zh' || saved === 'ja' || saved === 'bilingual') return saved;
    } catch {
      // ignore
    }
    return 'bilingual';
  });
  useEffect(() => {
    try {
      localStorage.setItem('kotonoha_ui_lang_v1', uiLang);
    } catch {
      // ignore
    }
  }, [uiLang]);

  const [dailyTarget, setDailyTarget] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('kotonoha_daily_target_v1');
      return saved ? Number(saved) : 10;
    } catch {
      return 10;
    }
  });
  const [showGoalConfetti, setShowGoalConfetti] = useState(false);
  const [activeWarmup, setActiveWarmup] = useState<WarmupSentenceItem | null>(null);
  const [showOwnerAuthModal, setShowOwnerAuthModal] = useState<boolean>(false);
  // Re-evaluate "due now" when the tab regains focus
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const refresh = () => setNowTick(Date.now());
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, []);

  const navigate = useCallback(
    (tab: MainTab, sub?: CourseSub | PracticeSub | ToolsSub) => {
      setSessionQueue(null);
      setActiveTab(tab);
      if (sub) {
        if (tab === 'course') setCourseSub(sub as CourseSub);
        if (tab === 'practice') setPracticeSub(sub as PracticeSub);
        if (tab === 'tools') setToolsSub(sub as ToolsSub);
      }
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    },
    []
  );

  // Study Streak State (連續學習打卡天數與最高紀錄)
  const [streakState, setStreakState] = useState<{
    activeDates: string[];
    longestStreakDays: number;
  }>(() => {
    try {
      const saved = localStorage.getItem('kotonoha_study_streak_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.activeDates)) {
          return {
            activeDates: parsed.activeDates,
            longestStreakDays: Number(parsed.longestStreakDays) || 12,
          };
        }
      }
    } catch {
      // ignore
    }
    return getInitialStreakSeed();
  });

  useEffect(() => {
    try {
      localStorage.setItem('kotonoha_study_streak_v1', JSON.stringify(streakState));
    } catch {
      // ignore
    }
  }, [streakState]);

  const streakSummary = useMemo(
    () => calculateStudyStreakSummary(streakState.activeDates, streakState.longestStreakDays),
    [streakState]
  );

  const handleCheckInStreakToday = () => {
    setStreakState((prev) => {
      const prevSummary = calculateStudyStreakSummary(prev.activeDates, prev.longestStreakDays);
      if (!prevSummary.isCheckedInToday) {
        setXp((currXp) => currXp + 20);
      }
      const next = recordDailyStudyCheckIn(prev.activeDates, prev.longestStreakDays);
      return {
        activeDates: next.updatedDates,
        longestStreakDays: next.updatedBestStreak,
      };
    });
  };

  // Owner-only Google account session (restricted to the owner's account)
  const [ownerSession, setOwnerSession] = useState<OwnerAuthSession | null>(() => {
    try {
      const saved = localStorage.getItem('kotonoha_owner_session_v1');
      if (saved) {
        const parsed = JSON.parse(saved) as OwnerAuthSession;
        if (verifyOwnerGoogleAccount(parsed?.email).allowed) {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  const [isGateLocked, setIsGateLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kotonoha_owner_gate_lock_v1') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (ownerSession) {
        localStorage.setItem('kotonoha_owner_session_v1', JSON.stringify(ownerSession));
      } else {
        localStorage.removeItem('kotonoha_owner_session_v1');
      }
    } catch {
      // ignore
    }
  }, [ownerSession]);

  useEffect(() => {
    try {
      localStorage.setItem('kotonoha_owner_gate_lock_v1', String(isGateLocked));
    } catch {
      // ignore
    }
  }, [isGateLocked]);

  // Dark Mode state persisted in localStorage and synced to <html class="dark">
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kotonoha_dark_mode_v1') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDarkMode);
    }
    try {
      localStorage.setItem('kotonoha_dark_mode_v1', String(isDarkMode));
    } catch {
      // ignore
    }
  }, [isDarkMode]);

  // Global voice style & speed config (shared by every speech call in the app)
  const [voiceConfig, setVoiceConfigState] = useState<GlobalVoiceConfig>(() => getGlobalVoiceConfig());

  useEffect(() => {
    return subscribeGlobalVoiceConfig((cfg) => {
      setVoiceConfigState(cfg);
    });
  }, []);

  // Persistent mistake log (collected from QuizArena & JlptMockExamCenter)
  const [mistakes, setMistakes] = useState<MistakeRecord[]>(() => {
    try {
      const saved = localStorage.getItem('kotonoha_mistakes_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return getInitialMistakeSeed();
  });

  // Local dictionary & word database with online sync
  const [dictionaryEntries, setDictionaryEntries] = useState<SyncedDictionaryEntry[]>(() =>
    loadLocalDictionaryDb()
  );
  const [customVocab, setCustomVocab] = useState<VocabItem[]>(() => {
    try {
      const raw = localStorage.getItem('kotonoha_custom_vocab_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem('kotonoha_dict_last_sync_v1');
    } catch {
      return null;
    }
  });

  const warmupPool = useMemo<WarmupSentenceItem[]>(() => {
    const fromSpeaking: WarmupSentenceItem[] = SPEAKING_PROMPTS.map((s) => ({
      id: `warmup-s-${s.id}`,
      level: s.level,
      textJp: s.targetJp,
      meaningHk: s.meaningHk,
      sourceLabel: `${s.level} 情境口說・${s.contextTagZh}`,
      pitchTip: s.pitchTipZh,
    }));
    const fromVocab: WarmupSentenceItem[] = [...customVocab, ...VOCAB_DATABASE].map((v) => ({
      id: `warmup-v-${v.id}`,
      level: v.level,
      textJp: v.exampleJp,
      meaningHk: v.exampleHk,
      sourceLabel: `${v.level} 核心詞彙「${v.kanji}」例句`,
      pitchTip: `重點詞「${v.kanji}（${v.reading}）」音調：${v.pitchAccent}`,
    }));
    const fromGrammar: WarmupSentenceItem[] = GRAMMAR_DATABASE.map((g) => ({
      id: `warmup-g-${g.id}`,
      level: g.level,
      textJp: g.exampleJp,
      meaningHk: g.exampleHk,
      sourceLabel: `${g.level} 核心文法「${g.pattern}」例句`,
    }));
    return [...fromSpeaking, ...fromVocab, ...fromGrammar];
  }, [customVocab]);

  const handleTriggerListeningWarmup = () => {
    const picked = pickListeningWarmupSentence(warmupPool, selectedLevel, activeWarmup?.id);
    if (picked) {
      setActiveWarmup(picked);
      speakJapanese(picked.textJp, 0.95);
    }
  };

  // Persistent SRS card state map
  const [srsMap, setSrsMap] = useState<Record<string, SrsCardState>>(() => {
    try {
      const saved = localStorage.getItem('kotonoha_srs_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore storage errors
    }
    return {
      'n5-v1': {
        itemId: 'n5-v1',
        intervalDays: 3,
        easeFactor: 2.5,
        repetitions: 2,
        nextReviewAt: Date.now() + 3 * 86400000,
        status: 'review',
      },
      'n4-v1': {
        itemId: 'n4-v1',
        intervalDays: 1,
        easeFactor: 2.5,
        repetitions: 1,
        nextReviewAt: Date.now() + 86400000,
        status: 'learning',
      },
    };
  });

  const [xp, setXp] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('kotonoha_xp_v1');
      return saved ? Number(saved) : 340;
    } catch {
      return 340;
    }
  });

  const [quizzesCompleted, setQuizzesCompleted] = useState<number>(2);
  const [customQuestions, setCustomQuestions] = useState<QuizQuestion[]>([]);
  const [senseiMessages, setSenseiMessages] = useState<ChatMessage[]>(INITIAL_SENSEI_MESSAGES);
  const [isSendingToSensei, setIsSendingToSensei] = useState(false);

  // Save dictionaryEntries to local database
  useEffect(() => {
    saveLocalDictionaryDb(dictionaryEntries);
  }, [dictionaryEntries]);

  // Save customVocab to local database
  useEffect(() => {
    try {
      localStorage.setItem('kotonoha_custom_vocab_v1', JSON.stringify(customVocab));
    } catch {
      // ignore
    }
  }, [customVocab]);

  // Save mistakes to local database
  useEffect(() => {
    try {
      localStorage.setItem('kotonoha_mistakes_v1', JSON.stringify(mistakes));
    } catch {
      // ignore
    }
  }, [mistakes]);

  const handleRecordMistakes = (incoming: MistakeRecord[]) => {
    if (!incoming || incoming.length === 0) return;
    setMistakes((prev) => mergeMistakeRecords(prev, incoming));
  };

  const handleConvertMistakeToSrs = (mistakeIdOrRecord: string | MistakeRecord) => {
    const mistake =
      typeof mistakeIdOrRecord === 'string'
        ? mistakes.find((m) => m.id === mistakeIdOrRecord)
        : mistakeIdOrRecord;
    if (!mistake) return;

    const { vocabItem, srsState } = convertMistakeToTargetedVocabAndSrs(mistake);

    setCustomVocab((prev) => {
      const filtered = prev.filter((item) => item.id !== vocabItem.id);
      return [vocabItem, ...filtered];
    });
    setSrsMap((prev) => ({ ...prev, [srsState.itemId]: srsState }));
    setMistakes((prev) =>
      prev.map((m) =>
        m.id === mistake.id ? { ...m, convertedToSrs: true, srsCardId: srsState.itemId } : m
      )
    );
    setXp((prev) => prev + 12);
  };

  const handleConvertAllMistakesToSrs = () => {
    const unconverted = mistakes.filter((m) => !m.convertedToSrs);
    if (unconverted.length === 0) return;

    const conversions = unconverted.map((m) => ({
      mistakeId: m.id,
      ...convertMistakeToTargetedVocabAndSrs(m),
    }));

    setCustomVocab((prev) => {
      const newIds = new Set(conversions.map((c) => c.vocabItem.id));
      const filtered = prev.filter((item) => !newIds.has(item.id));
      return [...conversions.map((c) => c.vocabItem), ...filtered];
    });
    setSrsMap((prev) => {
      const nextMap = { ...prev };
      for (const c of conversions) {
        nextMap[c.srsState.itemId] = c.srsState;
      }
      return nextMap;
    });

    const convertedIds = new Map(conversions.map((c) => [c.mistakeId, c.srsState.itemId]));
    setMistakes((prev) =>
      prev.map((m) =>
        convertedIds.has(m.id) ? { ...m, convertedToSrs: true, srsCardId: convertedIds.get(m.id) } : m
      )
    );
    setXp((prev) => prev + conversions.length * 10);
  };

  const handleRemoveMistake = (mistakeId: string) => {
    setMistakes((prev) => prev.filter((m) => m.id !== mistakeId));
  };

  const handleUpdateMistakeRecord = (updated: MistakeRecord) => {
    setMistakes((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const handleCloudWordSync = async () => {
    setIsSyncingCloud(true);
    try {
      const response = await fetch('/api/words/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knownIds: dictionaryEntries.map((e) => e.id),
          level: selectedLevel,
        }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.cloudEntries) && data.cloudEntries.length > 0) {
        setDictionaryEntries((prev) => {
          const merged = mergeDictionaryEntries(prev, data.cloudEntries);
          saveLocalDictionaryDb(merged);
          return merged;
        });
      }
      if (Array.isArray(data.cloudVocab) && data.cloudVocab.length > 0) {
        setCustomVocab((prev) => {
          const existingKeys = new Set(
            [...prev, ...VOCAB_DATABASE].map((v) => `${v.kanji}::${v.reading}`)
          );
          const fresh = (data.cloudVocab as VocabItem[]).filter(
            (v) => !existingKeys.has(`${v.kanji}::${v.reading}`)
          );
          return fresh.length > 0 ? [...fresh, ...prev] : prev;
        });
      }
      const timeStr = new Date().toLocaleTimeString('zh-HK', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setLastSyncedAt(timeStr);
      try {
        localStorage.setItem('kotonoha_dict_last_sync_v1', timeStr);
      } catch {
        // ignore
      }
    } catch {
      // Offline or transient failure: the local DB keeps working
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Auto-sync with server when app loads online and whenever browser comes back online
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      handleCloudWordSync();
    };
    const onOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if (typeof navigator === 'undefined' || navigator.onLine) {
      handleCloudWordSync();
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('kotonoha_srs_v1', JSON.stringify(srsMap));
    } catch {
      // ignore
    }
  }, [srsMap]);

  useEffect(() => {
    try {
      localStorage.setItem('kotonoha_xp_v1', String(xp));
    } catch {
      // ignore
    }
  }, [xp]);

  useEffect(() => {
    try {
      localStorage.setItem('kotonoha_daily_target_v1', String(dailyTarget));
    } catch {
      // ignore
    }
  }, [dailyTarget]);

  useEffect(() => {
    if (!showGoalConfetti) return;
    const timer = window.setTimeout(() => {
      setShowGoalConfetti(false);
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [showGoalConfetti]);

  const handleRateSrsCard = (itemId: string, rating: SrsRating) => {
    setSrsMap((prev) => {
      const now = Date.now();
      const updated = updateSrsCard(prev[itemId], itemId, rating, now);
      const nextMap = { ...prev, [itemId]: updated };
      // Daily goal = cards reviewed today, not total cards ever learned
      if (
        shouldTriggerGoalCelebration(
          countReviewedToday(prev, now),
          dailyTarget,
          countReviewedToday(nextMap, now),
          dailyTarget
        )
      ) {
        setShowGoalConfetti(true);
      }
      return nextMap;
    });
    setXp((prev) => prev + (rating === 'easy' ? 15 : rating === 'good' ? 10 : 5));
    handleCheckInStreakToday();
  };

  const handleSaveCardNote = (
    itemId: string,
    patch: {
      textNote?: string;
      voiceTranscript?: string;
      voiceAudioDataUrl?: string;
      voiceLang?: 'zh-HK' | 'ja-JP';
    }
  ) => {
    setSrsMap((prev) => {
      const updated = upsertSrsCardNote(prev[itemId], itemId, patch);
      return { ...prev, [itemId]: updated };
    });
  };

  const handleChangeDailyTarget = (nextTarget: number) => {
    const reviewed = countReviewedToday(srsMap);
    if (shouldTriggerGoalCelebration(reviewed, dailyTarget, reviewed, nextTarget)) {
      setShowGoalConfetti(true);
    }
    setDailyTarget(nextTarget);
  };

  const handleSendToSensei = async (
    text: string,
    attachment?: { mimeType: string; data: string; name: string },
    contextItem?: any
  ) => {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      attachmentName: attachment?.name,
      timestamp: new Date().toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...senseiMessages, userMsg];
    setSenseiMessages(updatedHistory);
    setIsSendingToSensei(true);

    try {
      // Teaching skills are applied server-side by /api/ai/tutor
      const response = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          level: selectedLevel,
          contextItem,
          attachment,
          history: updatedHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const replyMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Sensei 收到你嘅問題喇！請再試一次。',
        timestamp: new Date().toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' }),
        ...(Array.isArray(data.injectedSkills) ? { injectedSkills: data.injectedSkills } : {}),
      };
      setSenseiMessages((prev) => [...prev, replyMsg]);
      setXp((prev) => prev + 10);
    } catch {
      const fallbackMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content:
          'Sensei 提提你：學習日文句子時，先抓緊句尾謂語同時態，再睇助詞（は・が・を・に・で）標示嘅角色，就會一清二楚！',
        timestamp: '剛剛',
      };
      setSenseiMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsSendingToSensei(false);
    }
  };

  const handleAskSenseiFromStage = (
    promptText: string,
    item?: any,
    attachment?: { mimeType: string; data: string; name: string }
  ) => {
    navigate('tools', 'sensei');
    handleSendToSensei(promptText, attachment, item);
  };

  const handleCompleteQuiz = (result: QuizScoreResult) => {
    setXp((prev) => prev + result.xpEarned);
    setQuizzesCompleted((prev) => prev + 1);
  };

  const handleSaveExtractedVocab = (items: VocabItem[]) => {
    setCustomVocab((prev) => [...items, ...prev]);
    setXp((prev) => prev + items.length * 10);
  };

  const handleSaveWordFromDictionary = (item: VocabItem) => {
    setCustomVocab((prev) => [item, ...prev]);
    handleRateSrsCard(item.id, 'good');
  };

  const handleStartGeneratedQuiz = (questions: QuizQuestion[]) => {
    setCustomQuestions(questions);
    navigate('practice', 'quiz');
  };

  // ---- Derived learning state for Today ----
  const detailedStats = useMemo(
    () => calculateDetailedStudyStats(srsMap, quizzesCompleted, selectedLevel),
    [srsMap, quizzesCompleted, selectedLevel]
  );
  const vocabPool = useMemo(() => getAllVocabPool(customVocab), [customVocab]);
  const dueVocab = useMemo(
    () => getDueVocab(srsMap, vocabPool, nowTick),
    [srsMap, vocabPool, nowTick]
  );
  const reviewedTodayCount = useMemo(() => countReviewedToday(srsMap, nowTick), [srsMap, nowTick]);
  const newLimit = Math.max(0, dailyTarget - reviewedTodayCount - dueVocab.length);
  const plannedNewVocab = useMemo(
    () => (newLimit > 0 ? getNewVocabForLevel(srsMap, vocabPool, selectedLevel, newLimit) : []),
    [srsMap, vocabPool, selectedLevel, newLimit]
  );
  const extraNewVocab = useMemo(
    () => getNewVocabForLevel(srsMap, vocabPool, selectedLevel, EXTRA_NEW_BATCH),
    [srsMap, vocabPool, selectedLevel]
  );
  const pendingMistakes = useMemo(() => mistakes.filter((m) => !m.convertedToSrs).length, [mistakes]);

  const startSession = (queue: VocabItem[]) => {
    if (queue.length === 0) return;
    setActiveTab('today');
    setSessionQueue(queue);
    window.scrollTo({ top: 0 });
  };

  const handleOpenWarmup = () => {
    handleTriggerListeningWarmup();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const t = (zh: string, ja: string) => (uiLang === 'ja' ? ja : zh);

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink overflow-x-hidden">
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              navigate('today');
            }}
            className="shrink-0 flex items-baseline gap-2 whitespace-nowrap"
          >
            <span className="font-jp text-lg font-semibold tracking-wide text-ink">言の葉道場</span>
            <span className="hidden sm:inline text-xs text-ink-faint tracking-wide">Kotonoha</span>
          </a>

          <TopNav active={activeTab} uiLang={uiLang} onNavigate={(tab) => navigate(tab)} />

          <div className="flex items-center gap-1.5 shrink-0">
            <label className="relative inline-flex items-center">
              <span className="sr-only">{t('目標級別', '目標レベル')}</span>
              <select
                data-testid="header-level-select"
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value as JlptLevel)}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-full bg-ai-soft text-ai-ink text-xs font-semibold font-mono-num cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ai/40"
              >
                {JLPT_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    JLPT {lvl}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2 w-3.5 h-3.5 text-ai-ink"
                aria-hidden="true"
              />
            </label>
            <button
              type="button"
              data-testid="settings-open-btn"
              onClick={() => setShowSettings(true)}
              aria-label={t('設定', '設定')}
              aria-haspopup="dialog"
              aria-expanded={showSettings}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-soft hover:text-ink hover:bg-sunken transition-colors cursor-pointer"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12">
        {activeWarmup && (
          <div className="mb-5 sm:mb-6">
            <ListeningWarmupPanel
              key={activeWarmup.id}
              sentence={activeWarmup}
              selectedLevel={selectedLevel}
              uiLang={uiLang}
              onNextRandomSentence={handleTriggerListeningWarmup}
              onClose={() => setActiveWarmup(null)}
              onCompleteShadowing={() => setXp((prev) => prev + 5)}
              onAskSensei={(promptText, item) => handleAskSenseiFromStage(promptText, item)}
            />
          </div>
        )}

        {/* ---- 今日 ---- */}
        {activeTab === 'today' &&
          (sessionQueue ? (
            <ReviewSession
              uiLang={uiLang}
              queue={sessionQueue}
              srsMap={srsMap}
              onRateCard={handleRateSrsCard}
              onExit={() => {
                setSessionQueue(null);
                setNowTick(Date.now());
                window.scrollTo({ top: 0 });
              }}
              onAskSenseiWithContext={handleAskSenseiFromStage}
            />
          ) : (
            <TodayView
              uiLang={uiLang}
              selectedLevel={selectedLevel}
              dueCount={dueVocab.length}
              newCount={plannedNewVocab.length}
              reviewedTodayCount={reviewedTodayCount}
              dailyTarget={dailyTarget}
              streakSummary={streakSummary}
              xp={xp}
              pendingMistakes={pendingMistakes}
              showGoalConfetti={showGoalConfetti}
              extraNewAvailable={extraNewVocab.length}
              onStartSession={() => startSession([...dueVocab, ...plannedNewVocab])}
              onStartExtraNew={() => startSession(extraNewVocab)}
              onCheckInToday={handleCheckInStreakToday}
              onOpenWarmup={handleOpenWarmup}
              onGoToQuiz={() => navigate('practice', 'quiz')}
              onGoToMistakes={() => navigate('practice', 'mistakes')}
              onGoToCourse={() => navigate('course', 'study')}
            />
          ))}

        {/* ---- 課程 ---- */}
        {activeTab === 'course' && (
          <div className="space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <SectionHeading zh="課程" ja="コース" uiLang={uiLang} as="h1" />
              <SegmentedControl
                items={COURSE_SUBS}
                value={courseSub}
                onChange={setCourseSub}
                uiLang={uiLang}
                ariaLabel={t('課程分頁', 'コースのタブ')}
                testIdPrefix="course-sub"
              />
            </div>
            {courseSub === 'study' ? (
              <StudyStage
                selectedLevel={selectedLevel}
                onSelectLevel={setSelectedLevel}
                srsMap={srsMap}
                onRateCard={handleRateSrsCard}
                onSaveCardNote={handleSaveCardNote}
                onAskSenseiWithContext={handleAskSenseiFromStage}
                customVocab={customVocab}
                onSaveCustomVocab={handleSaveExtractedVocab}
                uiLang={uiLang}
              />
            ) : (
              <MethodBlueprint
                srsMap={srsMap}
                xp={xp}
                quizzesCompleted={quizzesCompleted}
                onSelectLevelAndStudy={(lvl) => {
                  setSelectedLevel(lvl);
                  navigate('course', 'study');
                }}
              />
            )}
          </div>
        )}

        {/* ---- 練習 ---- */}
        {activeTab === 'practice' && (
          <div className="space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <SectionHeading zh="練習" ja="練習" uiLang={uiLang} as="h1" />
              <SegmentedControl
                items={PRACTICE_SUBS}
                value={practiceSub}
                onChange={setPracticeSub}
                uiLang={uiLang}
                ariaLabel={t('練習分頁', '練習のタブ')}
                testIdPrefix="practice-sub"
                badges={{ mistakes: pendingMistakes }}
              />
            </div>
            {practiceSub === 'quiz' && (
              <QuizArena
                selectedLevel={selectedLevel}
                onSelectLevel={setSelectedLevel}
                customQuestions={customQuestions}
                onCompleteQuiz={handleCompleteQuiz}
                onAskSenseiWithContext={handleAskSenseiFromStage}
                uiLang={uiLang}
                onGoToMockExam={() => navigate('practice', 'mock-exam')}
                onRecordMistakes={handleRecordMistakes}
              />
            )}
            {practiceSub === 'mock-exam' && (
              <JlptMockExamCenter
                selectedLevel={selectedLevel}
                onSelectLevel={setSelectedLevel}
                uiLang={uiLang}
                onCompleteExam={handleCompleteQuiz}
                onAskSenseiWithContext={handleAskSenseiFromStage}
                onRecordMistakes={handleRecordMistakes}
              />
            )}
            {practiceSub === 'mistakes' && (
              <DetailedStudyStatsPanel
                stats={detailedStats}
                uiLang={uiLang}
                onClose={() => navigate('today')}
                onGoToQuiz={() => navigate('practice', 'quiz')}
                onGoToStudy={() => navigate('course', 'study')}
                mistakes={mistakes}
                onConvertMistakeToSrs={handleConvertMistakeToSrs}
                onConvertAllMistakesToSrs={handleConvertAllMistakesToSrs}
                onRemoveMistake={handleRemoveMistake}
                onUpdateMistakeRecord={handleUpdateMistakeRecord}
                onAskSenseiAboutMistake={(m) =>
                  handleAskSenseiFromStage(
                    `Sensei，我喺「${m.questionPrompt}」呢題答錯咗（我揀咗「${m.userChosenOption}」，正確答案係「${m.correctAnswer}」）。請幫我深入分析點解會錯，同埋點樣記住呢個考點！`,
                    m
                  )
                }
              />
            )}
            {practiceSub === 'materials' && (
              <MaterialStudio
                selectedLevel={selectedLevel}
                onSelectLevel={setSelectedLevel}
                onSaveExtractedVocab={handleSaveExtractedVocab}
                onStartGeneratedQuiz={handleStartGeneratedQuiz}
                onAskSenseiWithContext={handleAskSenseiFromStage}
              />
            )}
          </div>
        )}

        {/* ---- 工具 ---- */}
        {activeTab === 'tools' && (
          <div className="space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <SectionHeading zh="工具" ja="ツール" uiLang={uiLang} as="h1" />
              <SegmentedControl
                items={TOOLS_SUBS}
                value={toolsSub}
                onChange={setToolsSub}
                uiLang={uiLang}
                ariaLabel={t('工具分頁', 'ツールのタブ')}
                testIdPrefix="tools-sub"
              />
            </div>
            {toolsSub === 'dictionary' && (
              <DictionaryView
                uiLang={uiLang}
                entries={dictionaryEntries}
                onUpdateEntries={setDictionaryEntries}
                isOnline={isOnline}
                lastSyncedAt={lastSyncedAt}
                isSyncingCloud={isSyncingCloud}
                onTriggerCloudSync={handleCloudWordSync}
                onSaveWordToSrs={handleSaveWordFromDictionary}
                onAskSenseiWithContext={handleAskSenseiFromStage}
                onStartPastExamQuiz={handleStartGeneratedQuiz}
              />
            )}
            {toolsSub === 'sensei' && (
              <AiSenseiPanel
                selectedLevel={selectedLevel}
                messages={senseiMessages}
                onSendMessage={(txt, attach) => handleSendToSensei(txt, attach)}
                onClearHistory={() => setSenseiMessages(INITIAL_SENSEI_MESSAGES)}
                isSending={isSendingToSensei}
              />
            )}
          </div>
        )}
      </main>

      <footer className="hidden md:block border-t border-line py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 text-xs text-ink-faint">
          <span className="font-jp">言の葉道場 Kotonoha</span>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => navigate('tools', 'dictionary')} className="hover:text-ink cursor-pointer">
              {t('辭典', '辞書')}
            </button>
            <button type="button" onClick={() => navigate('practice', 'materials')} className="hover:text-ink cursor-pointer">
              {t('自訂教材出題', '教材から出題')}
            </button>
            <button type="button" onClick={() => navigate('tools', 'sensei')} className="hover:text-ink cursor-pointer">
              {t('AI 導師', 'AI 先生')}
            </button>
          </div>
        </div>
      </footer>

      <BottomTabBar active={activeTab} uiLang={uiLang} onNavigate={(tab) => navigate(tab)} />

      <SettingsDrawer
        open={showSettings}
        onClose={() => setShowSettings(false)}
        uiLang={uiLang}
        onChangeUiLang={setUiLang}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
        voiceConfig={voiceConfig}
        dailyTarget={dailyTarget}
        onChangeDailyTarget={handleChangeDailyTarget}
        dictionaryCount={dictionaryEntries.length}
        isSyncingCloud={isSyncingCloud}
        isOnline={isOnline}
        lastSyncedAt={lastSyncedAt}
        onSyncWords={handleCloudWordSync}
        isOwnerSignedIn={!!ownerSession}
        onOpenOwnerAuth={() => {
          setShowSettings(false);
          setShowOwnerAuthModal(true);
        }}
      />

      <OwnerAuthModal
        uiLang={uiLang}
        showModal={showOwnerAuthModal}
        isGateLocked={isGateLocked}
        ownerSession={ownerSession}
        onUpdateSession={(newSession) => setOwnerSession(newSession)}
        onToggleGateLock={(locked) => setIsGateLocked(locked)}
        onCloseModal={() => setShowOwnerAuthModal(false)}
      />
    </div>
  );
}
