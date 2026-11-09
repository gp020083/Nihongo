/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  Flame,
  MessageSquare,
  Languages,
  Headphones,
  Database,
  RefreshCw,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Cloud,
  Moon,
  Sun,
  Info,
  Volume2,
  Gauge,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import {
  JlptLevel,
  SrsCardState,
  SrsRating,
  updateSrsCard,
  upsertSrsCardNote,
  QuizScoreResult,
  calculateDailyProgress,
  shouldTriggerGoalCelebration,
  WarmupSentenceItem,
  pickListeningWarmupSentence,
  calculateDetailedStudyStats,
  MistakeRecord,
  mergeMistakeRecords,
  convertMistakeToTargetedVocabAndSrs,
  getInitialMistakeSeed,
  ALLOWED_OWNER_EMAIL,
  verifyOwnerGoogleAccount,
  getInitialStreakSeed,
  calculateStudyStreakSummary,
  recordDailyStudyCheckIn,
  AntigravitySkillItem,
  DEFAULT_ANTIGRAVITY_SKILLS,
} from './utils/srsEngine';
import {
  VocabItem,
  QuizQuestion,
  VOCAB_DATABASE,
  GRAMMAR_DATABASE,
} from './data/jlptCurriculum';
import {
  UiLang,
  SPEAKING_PROMPTS,
  formatBilingual,
} from './data/listeningAndDictionaryData';
import {
  SyncedDictionaryEntry,
  DriveDatabasePayload,
  loadLocalDictionaryDb,
  saveLocalDictionaryDb,
  mergeDictionaryEntries,
} from './utils/localWordDatabase';
import { StudyStage } from './components/StudyStage';
import { DictionaryView } from './components/DictionaryView';
import { QuizArena } from './components/QuizArena';
import { MaterialStudio } from './components/MaterialStudio';
import { AiSenseiPanel, ChatMessage } from './components/AiSenseiPanel';
import { MethodBlueprint } from './components/MethodBlueprint';
import { GoalConfettiBurst } from './components/GoalConfettiBurst';
import { ListeningWarmupPanel } from './components/ListeningWarmupPanel';
import { DetailedStudyStatsPanel } from './components/DetailedStudyStatsPanel';
import { GoogleDriveDbPanel } from './components/GoogleDriveDbPanel';
import { JlptMockExamCenter } from './components/JlptMockExamCenter';
import {
  speakJapanese,
  VOICE_STYLE_OPTIONS,
  VOICE_EMOTION_PRESETS,
  VoiceEmotionTone,
  GlobalVoiceStyle,
  GlobalVoiceConfig,
  getGlobalVoiceConfig,
  setGlobalVoiceConfig,
  subscribeGlobalVoiceConfig,
} from './components/FuriganaText';
import { OwnerAuthModal, OwnerAuthSession } from './components/OwnerAuthModal';
import { VoiceEmotionAuditionWorkbench } from './components/VoiceEmotionAuditionWorkbench';
import { StudyStreakWidget } from './components/StudyStreakWidget';
import { initAuth } from './utils/googleDriveSync';

type WorkspaceTab = 'study' | 'dictionary' | 'mock-exam' | 'quiz' | 'materials' | 'sensei' | 'method';

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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('study');
  const [selectedLevel, setSelectedLevel] = useState<JlptLevel>('N4');
  const [uiLang, setUiLang] = useState<UiLang>('bilingual');
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
  const [showDetailedStats, setShowDetailedStats] = useState<boolean>(false);
  const [showGoogleDrivePanel, setShowGoogleDrivePanel] = useState<boolean>(false);
  const [showAiQuotaPanel, setShowAiQuotaPanel] = useState<boolean>(false);
  const [showOwnerAuthModal, setShowOwnerAuthModal] = useState<boolean>(false);
  const [showEmotionWorkbench, setShowEmotionWorkbench] = useState<boolean>(true);

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
    () =>
      calculateStudyStreakSummary(
        streakState.activeDates,
        streakState.longestStreakDays
      ),
    [streakState]
  );

  const handleCheckInStreakToday = () => {
    setStreakState((prev) => {
      const prevSummary = calculateStudyStreakSummary(
        prev.activeDates,
        prev.longestStreakDays
      );
      if (!prevSummary.isCheckedInToday) {
        setXp((currXp) => currXp + 20);
      }
      const next = recordDailyStudyCheckIn(
        prev.activeDates,
        prev.longestStreakDays
      );
      return {
        activeDates: next.updatedDates,
        longestStreakDays: next.updatedBestStreak,
      };
    });
  };

  // Owner-Only Google Account Login Session (restricted strictly to bentktk2024@gmail.com)
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

  useEffect(() => {
    const unsubscribe = initAuth((user) => {
      if (user?.email) {
        const check = verifyOwnerGoogleAccount(user.email);
        if (check.allowed) {
          setOwnerSession({
            email: check.normalizedEmail,
            displayName: user.displayName || 'Bentk Owner (Google Account)',
            photoURL: user.photoURL || undefined,
            verifiedAt: new Date().toLocaleString('zh-HK'),
            authMethod: 'google-oauth-popup',
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

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

  // Global Voice Style & Speed Config (controls non-JLPT & JLPT voices across the app)
  const [voiceConfig, setVoiceConfigState] = useState<GlobalVoiceConfig>(() =>
    getGlobalVoiceConfig()
  );

  useEffect(() => {
    return subscribeGlobalVoiceConfig((cfg) => {
      setVoiceConfigState(cfg);
    });
  }, []);

  // Persistent Mistake Analysis Log (Collected from QuizArena & JlptMockExamCenter)
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

  // Local Dictionary & Word Database with Auto-Online Sync
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
    const picked = pickListeningWarmupSentence(
      warmupPool,
      selectedLevel,
      activeWarmup?.id
    );
    if (picked) {
      setActiveWarmup(picked);
      speakJapanese(picked.textJp, 0.95);
    }
  };

  // Persistent SRS Card State Map
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
  const [antigravitySkills, setAntigravitySkills] = useState<AntigravitySkillItem[]>(() => {
    try {
      const saved = localStorage.getItem('kotonoha_antigravity_skills_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_ANTIGRAVITY_SKILLS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        'kotonoha_antigravity_skills_v1',
        JSON.stringify(antigravitySkills)
      );
    } catch {
      // ignore
    }
  }, [antigravitySkills]);

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

    setSrsMap((prev) => {
      const prevCount = Object.keys(prev).length;
      const nextMap = { ...prev, [srsState.itemId]: srsState };
      const nextCount = Object.keys(nextMap).length;
      if (shouldTriggerGoalCelebration(prevCount, dailyTarget, nextCount, dailyTarget)) {
        setShowGoalConfetti(true);
      }
      return nextMap;
    });

    setMistakes((prev) =>
      prev.map((m) =>
        m.id === mistake.id
          ? { ...m, convertedToSrs: true, srsCardId: srsState.itemId }
          : m
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
      const prevCount = Object.keys(prev).length;
      const nextMap = { ...prev };
      for (const c of conversions) {
        nextMap[c.srsState.itemId] = c.srsState;
      }
      const nextCount = Object.keys(nextMap).length;
      if (shouldTriggerGoalCelebration(prevCount, dailyTarget, nextCount, dailyTarget)) {
        setShowGoalConfetti(true);
      }
      return nextMap;
    });

    const convertedIds = new Map(conversions.map((c) => [c.mistakeId, c.srsState.itemId]));
    setMistakes((prev) =>
      prev.map((m) =>
        convertedIds.has(m.id)
          ? { ...m, convertedToSrs: true, srsCardId: convertedIds.get(m.id) }
          : m
      )
    );
    setXp((prev) => prev + conversions.length * 10);
  };

  const handleRemoveMistake = (mistakeId: string) => {
    setMistakes((prev) => prev.filter((m) => m.id !== mistakeId));
  };

  const handleUpdateMistakeRecord = (updated: MistakeRecord) => {
    setMistakes((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m))
    );
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
      // Offline or transient failure: local DB continues working seamlessly
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
      const prevCount = Object.keys(prev).length;
      const updated = updateSrsCard(prev[itemId], itemId, rating);
      const nextMap = { ...prev, [itemId]: updated };
      const nextCount = Object.keys(nextMap).length;
      if (shouldTriggerGoalCelebration(prevCount, dailyTarget, nextCount, dailyTarget)) {
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
    const currentCount = Object.keys(srsMap).length;
    if (shouldTriggerGoalCelebration(currentCount, dailyTarget, currentCount, nextTarget)) {
      setShowGoalConfetti(true);
    }
    setDailyTarget(nextTarget);
  };

  const handleSendToSensei = async (
    text: string,
    attachment?: { mimeType: string; data: string; name: string },
    contextItem?: any,
    overrideSkills?: AntigravitySkillItem[]
  ) => {
    const skillsToInject = (
      overrideSkills || antigravitySkills.filter((s) => s.enabled)
    ).filter((s) => s.enabled);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      attachmentName: attachment?.name,
      timestamp: new Date().toLocaleTimeString('zh-HK', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const updatedHistory = [...senseiMessages, userMsg];
    setSenseiMessages(updatedHistory);
    setIsSendingToSensei(true);

    try {
      const response = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          level: selectedLevel,
          contextItem,
          attachment,
          activeSkills: skillsToInject,
          history: updatedHistory.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await response.json();
      const replyMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Sensei 收到你嘅問題喇！請再試一次。',
        timestamp: new Date().toLocaleTimeString('zh-HK', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        injectedSkills: Array.isArray(data.injectedSkills)
          ? data.injectedSkills
          : skillsToInject.map((s) => s.name),
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
        injectedSkills: skillsToInject.map((s) => s.name),
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
    setActiveTab('sensei');
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
    setActiveTab('quiz');
  };

  const handleRestoreFromDrive = (payload: DriveDatabasePayload) => {
    if (Array.isArray(payload.dictionaryEntries) && payload.dictionaryEntries.length > 0) {
      setDictionaryEntries((prev) => mergeDictionaryEntries(prev, payload.dictionaryEntries));
    }
    if (Array.isArray(payload.customVocab) && payload.customVocab.length > 0) {
      setCustomVocab(payload.customVocab);
    }
    if (payload.srsMap && typeof payload.srsMap === 'object') {
      setSrsMap((prev) => ({ ...prev, ...payload.srsMap }));
    }
    if (typeof payload.xp === 'number') {
      setXp(payload.xp);
    }
    if (typeof payload.dailyTarget === 'number') {
      setDailyTarget(payload.dailyTarget);
    }
    if (typeof payload.quizzesCompleted === 'number') {
      setQuizzesCompleted(payload.quizzesCompleted);
    }
  };

  const totalLearnedCount = Object.keys(srsMap).length;
  const dailyProgress = calculateDailyProgress(totalLearnedCount, dailyTarget, 18);
  const detailedStats = useMemo(
    () => calculateDetailedStudyStats(srsMap, quizzesCompleted, selectedLevel),
    [srsMap, quizzesCompleted, selectedLevel]
  );

  const navItems: { id: WorkspaceTab; zh: string; ja: string }[] = [
    { id: 'study', zh: '分級精修 (聽・說・讀)', ja: 'レベル別精修' },
    { id: 'mock-exam', zh: 'JLPT 能力試模擬考', ja: 'JLPT模擬試験' },
    { id: 'dictionary', zh: '日語辭典', ja: '日本語辞典' },
    { id: 'quiz', zh: '實戰測驗場', ja: '実戦テスト' },
    { id: 'materials', zh: '自訂教材出題', ja: '教材・動画出題' },
    { id: 'sensei', zh: 'AI 專屬導師', ja: 'AI 講師' },
    { id: 'method', zh: '學習法藍圖', ja: '学習メソッド' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] overflow-x-hidden">
      {/* Strict 3-Zone Top Bar Contract (Zero horizontal overflow on 375px mobile & desktop) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('study');
            }}
            className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
          >
            言の葉道場 Kotonoha
          </a>

          {/* Zone 2: Responsive Bilingual Navigation Links */}
          <nav
            aria-label="主導航"
            className="hidden md:flex items-center gap-1 lg:gap-2 text-xs font-medium text-slate-600"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`nav-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex flex-col items-center leading-tight ${
                    isActive
                      ? 'text-[#0284C7] font-bold bg-sky-50/80 border-b-2 border-[#0284C7]'
                      : 'hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {uiLang === 'bilingual' ? (
                    <>
                      <span className="text-xs">{item.zh}</span>
                      <span className="text-[10px] opacity-75 font-normal">{item.ja}</span>
                    </>
                  ) : (
                    <span className="text-xs lg:text-sm">
                      {uiLang === 'ja' ? item.ja : item.zh}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action (Compact on mobile so header never overflows 375px) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('sensei')}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="sm:hidden">
                {uiLang === 'ja' ? 'AI講師に質問' : '即時問 AI 導師'}
              </span>
              <span className="hidden sm:inline">
                {formatBilingual('即時問 AI 導師', 'AI講師に質問', uiLang)}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {/* Top Status Bar: Stacked Full-Width Title + Wrapped Toolbar so Title NEVER Squishes */}
        <section
          aria-label="學習狀態與今日進度欄"
          className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3.5"
        >
          {/* Tier 1: 100% Full-Width Title & Subtitle (immune to button group width) */}
          <div className="w-full space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500">
              <span>
                {formatBilingual(
                  '科學化日語習得系統',
                  '科学的日本語習得システム',
                  uiLang
                )}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {formatBilingual(
                  '聽說讀全方位訓練 × 最新動漫／時事精讀 × AI 日中雙解辭典',
                  '聴解・口説・読解・最新アニメ＆ニュース・AI辞典',
                  uiLang
                )}
              </span>
            </div>
            <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-snug break-words">
              {formatBilingual(
                'N5–N1 聽說讀精修、影片時事教材與 AI 日中雙解辭典',
                'N5基礎からN1読解・聴解・発音・Googleドライブ同期まで徹底サポート',
                uiLang
              )}
            </h1>
          </div>

          {/* Tier 2: Wrapped Controls Toolbar (Language + Dark Mode + AI Quota + Google Drive + Owner Login) */}
          <div className="w-full pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
            {/* Bilingual UI Language Switcher (中日雙語並排 / 中文 / 日本語) */}
            <div
              data-testid="ui-lang-toggle"
              role="group"
              aria-label="切換介面語言"
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200"
            >
              <Languages className="w-3.5 h-3.5 text-slate-500 ml-1" />
              <button
                type="button"
                data-testid="lang-btn-bilingual"
                onClick={() => setUiLang('bilingual')}
                className={`px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  uiLang === 'bilingual'
                    ? 'bg-white text-[#0284C7] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                中日雙語
              </button>
              <button
                type="button"
                data-testid="lang-btn-zh"
                onClick={() => setUiLang('zh')}
                className={`px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  uiLang === 'zh'
                    ? 'bg-white text-[#0284C7] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                中文
              </button>
              <button
                type="button"
                data-testid="lang-btn-ja"
                onClick={() => setUiLang('ja')}
                className={`px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  uiLang === 'ja'
                    ? 'bg-white text-[#0284C7] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                日本語
              </button>
            </div>

            {/* Dark Mode Toggle Button */}
            <button
              type="button"
              data-testid="dark-mode-toggle"
              onClick={() => setIsDarkMode((prev) => !prev)}
              aria-label={isDarkMode ? '切換至淺色模式' : '切換至深色模式'}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
              }`}
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
              <span>{isDarkMode ? '淺色模式' : '深色模式 (Dark)'}</span>
            </button>

            {/* AI Connection & Quota Info Button */}
            <button
              type="button"
              data-testid="ai-quota-info-btn"
              aria-expanded={showAiQuotaPanel}
              onClick={() => setShowAiQuotaPanel((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showAiQuotaPanel
                  ? 'bg-[#0284C7] text-white border-[#0284C7]'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>
                {formatBilingual('AI 連線與配額 (無限使用)', 'AI接続・利用枠', uiLang)}
              </span>
            </button>

            {/* Google Drive Database Sync Toggle Button */}
            <button
              type="button"
              data-testid="google-drive-db-btn"
              aria-expanded={showGoogleDrivePanel}
              onClick={() => setShowGoogleDrivePanel((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showGoogleDrivePanel
                  ? 'bg-[#0284C7] text-white border-[#0284C7]'
                  : 'bg-sky-50 hover:bg-sky-100 text-[#0284C7] border-sky-200'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>
                {formatBilingual('Google Drive 資料庫', 'GoogleドライブDB', uiLang)}
              </span>
            </button>

            {/* Owner-Only Google Account Login Button (restricted to bentktk2024@gmail.com) */}
            <button
              type="button"
              data-testid="owner-login-trigger-btn"
              onClick={() => setShowOwnerAuthModal(true)}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                ownerSession
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
              }`}
            >
              {ownerSession ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span>
                {ownerSession
                  ? `擁有者已登入 (${ownerSession.email})`
                  : `擁有者 Google 登入 (${ALLOWED_OWNER_EMAIL})`}
              </span>
            </button>
          </div>

          {/* Collapsible AI Connection & Quota Explanation Banner */}
          {showAiQuotaPanel && (
            <div
              data-testid="ai-quota-info-panel"
              className="bg-sky-50/90 border border-sky-200 rounded-xl p-4 text-xs text-slate-700 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#0284C7]" />
                  <span>本網頁 AI 引擎連線架構與配額上限說明</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAiQuotaPanel(false)}
                  className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  ✕ 關閉
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                  <div className="font-bold text-[#0284C7]">① 連去邊度？（後端安全代理路由）</div>
                  <p className="leading-relaxed">
                    本系統透過內置伺服器端代理路由（<code className="font-mono-num">/api/ai/*</code>）直接連線至雲端多模態語言引擎、即時網頁搜尋引擎及多聲線神經語音合成（Neural TTS）。金鑰由伺服器端全權託管，<strong>你完全唔需要自己申請或輸入任何 API Key</strong>。
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                  <div className="font-bold text-emerald-700">② 有幾多限額？（雙軌無限額保障）</div>
                  <p className="leading-relaxed">
                    雲端即時生成（上網搵新教材、AI 導師批改、真人雙聲道 TTS）提供免費高速額度；同時本系統採用<strong>「雲端 AI ＋ 本地離線引擎雙軌架構」</strong>——萬一高峰期觸及雲端每分鐘速率上限，系統會<strong>0 秒自動無縫切換</strong>至本地 120+ 題全真題庫、程序化出題引擎與本地高低音語音，<strong>所有功能無限次任用、絕不鎖死！</strong>
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                  <div className="font-bold text-amber-700">③ 語音聲線與速度自由切換</div>
                  <p className="leading-relaxed">
                    無論係 JLPT 模擬試定係平時精修、辭典、跟讀，你都可以喺下方<strong>「全站日語聲線與語速設定列」</strong>任揀 7 款真實獨立聲線（NHK 雙主播、NHK 女主播、真人低沉男主播、廣播直出、東京溫柔女聲、動漫元氣聲優或本機原音）並自由調校語速！
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Global Japanese Voice Timbre & Speed Selector Bar (applies to ALL non-JLPT & JLPT speech) */}
          <div
            data-testid="global-voice-settings-bar"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                <Volume2 className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>
                  {formatBilingual(
                    '全站日語發音聲線選擇（切換即刻生效）：',
                    '全サイト日本語ボイス＆速度設定：',
                    uiLang
                  )}
                </span>
              </span>

              <select
                data-testid="global-voice-style-select"
                aria-label="選擇全站日語發音聲線"
                value={voiceConfig.voiceStyle}
                onChange={(e) => {
                  const nextStyle = e.target.value as GlobalVoiceStyle;
                  setGlobalVoiceConfig({ voiceStyle: nextStyle });
                  const rolePreview =
                    nextStyle === 'nhk-male' ? 'male' : 'female';
                  speakJapanese(
                    'こんにちは！新しい日本語の声をテストしています。',
                    1.0,
                    rolePreview
                  );
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#0284C7] cursor-pointer"
              >
                {VOICE_STYLE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {uiLang === 'ja' ? opt.labelJa : opt.labelZh}（{opt.badge}）
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <Gauge className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>{formatBilingual('全局語速：', '全体速度：', uiLang)}</span>
              </span>
              {[
                { label: '0.9x', speed: 0.9 },
                { label: '1.0x 原生流暢 (無損)', speed: 1.0 },
                { label: '1.1x 自然快', speed: 1.1 },
                { label: '1.25x 爽快', speed: 1.25 },
                { label: '1.45x 高速', speed: 1.45 },
              ].map((sp) => (
                <button
                  key={sp.speed}
                  type="button"
                  onClick={() => setGlobalVoiceConfig({ speedMultiplier: sp.speed })}
                  className={`px-2 py-0.5 rounded font-mono-num text-[11px] font-semibold border cursor-pointer ${
                    Math.abs(voiceConfig.speedMultiplier - sp.speed) < 0.03
                      ? 'bg-[#0284C7] text-white border-[#0284C7]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                  }`}
                >
                  {sp.label}
                </button>
              ))}

              <button
                type="button"
                data-testid="global-voice-test-btn"
                onClick={() =>
                  speakJapanese(
                    'こんにちは！新しい日本語の音声エンジンと再生スピードをテストしています。',
                    1.0,
                    voiceConfig.voiceStyle === 'nhk-male' ? 'male' : 'female',
                    voiceConfig.emotionTone,
                    true
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-50 hover:bg-sky-100 text-[#0284C7] border border-sky-200 font-semibold cursor-pointer"
              >
                <Volume2 className="w-3 h-3" />
                <span>試聽目前聲線與感情</span>
              </button>
            </div>

            {/* Row 2 inside Global Voice Settings: Emotional Tone Selector (AI 感情語氣演繹) */}
            <div
              data-testid="global-voice-emotion-bar"
              className="w-full pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    {formatBilingual(
                      '🎭 AI 語音感情語氣（點擊即刻切換並試聽感情演繹）：',
                      '🎭 AI感情トーン（クリックで感情表現を試聴）：',
                      uiLang
                    )}
                  </span>
                </span>

                {VOICE_EMOTION_PRESETS.map((preset) => {
                  const isActive = voiceConfig.emotionTone === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-testid={`global-voice-emotion-btn-${preset.id}`}
                      onClick={() => {
                        setGlobalVoiceConfig({ emotionTone: preset.id as VoiceEmotionTone });
                        const rolePreview =
                          voiceConfig.voiceStyle === 'nhk-male' ? 'male' : 'female';
                        speakJapanese(
                          preset.sampleSentenceJp,
                          1.0,
                          rolePreview,
                          preset.id as VoiceEmotionTone,
                          true
                        );
                      }}
                      title={preset.descriptionHk}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
                      }`}
                    >
                      <span>{uiLang === 'ja' ? preset.labelJa : preset.labelZh}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  {
                    VOICE_EMOTION_PRESETS.find((p) => p.id === voiceConfig.emotionTone)
                      ?.descriptionHk
                  }
                </span>
                <button
                  type="button"
                  data-testid="toggle-emotion-workbench-btn"
                  onClick={() => setShowEmotionWorkbench((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 cursor-pointer"
                >
                  <span>
                    {showEmotionWorkbench
                      ? '收起「語音感情演繹」試聽室'
                      : '展開「語音感情演繹」實時對比試聽室'}
                  </span>
                </button>
              </div>
            </div>

            {/* Real-Time Emotional TTS Audition & Plain vs Expressive Comparison Workbench */}
            {showEmotionWorkbench && (
              <VoiceEmotionAuditionWorkbench uiLang={uiLang} showFurigana={true} />
            )}
          </div>

          {/* Study Streak Visual Component (學習連續打卡天數與最高紀錄) */}
          <StudyStreakWidget
            streakSummary={streakSummary}
            uiLang={uiLang}
            onCheckInToday={handleCheckInStreakToday}
          />

          {/* Row 2: Progress Meter + Warmup + Detailed Stats Toggle + Level/DB/XP Badges */}
          <div className="pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 sm:gap-4 text-xs text-slate-700">
            {/* Circular Daily Learning Progress Gauge + Listening Warmup + Detailed Stats Toggle */}
            <div
              data-testid="daily-progress-meter"
              className="relative flex flex-wrap items-center gap-2.5 sm:gap-3"
            >
              <GoalConfettiBurst
                active={showGoalConfetti}
                targetCount={dailyProgress.targetCount}
              />

              <div
                data-testid="daily-progress-gauge-circle"
                className={`relative w-12 h-12 flex items-center justify-center shrink-0 ${
                  dailyProgress.percentage === 100 ? 'animate-gauge-goal-pulse' : ''
                }`}
              >
                {dailyProgress.percentage === 100 && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-full border-2 border-emerald-500/60 animate-gauge-goal-halo"
                  />
                )}
                <svg
                  className="w-12 h-12 -rotate-90"
                  viewBox="0 0 44 44"
                  role="img"
                  aria-label={`今日學習進度圓形圖表：已完成 ${dailyProgress.completedCount} 張，目標 ${dailyProgress.targetCount} 張，佔比 ${dailyProgress.percentage}%`}
                >
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="4"
                  />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke={dailyProgress.isGoalMet ? '#059669' : '#0284C7'}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={dailyProgress.circumference}
                    strokeDashoffset={dailyProgress.strokeDashoffset}
                    className="transition-all duration-300"
                  />
                </svg>
                <span
                  className={`absolute text-[11px] font-bold font-mono-num ${
                    dailyProgress.isGoalMet ? 'text-[#059669]' : 'text-[#0284C7]'
                  }`}
                >
                  {dailyProgress.percentage}%
                </span>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900">
                    {formatBilingual('今日學習進度', '今日の学習進捗', uiLang)}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      dailyProgress.isGoalMet ? 'text-[#059669]' : 'text-slate-500'
                    }`}
                  >
                    {dailyProgress.isGoalMet
                      ? '★ 目標達成'
                      : formatBilingual('● 進行中', '学習中', uiLang)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-slate-600">
                  <span>{formatBilingual('已完成 SRS', '完了SRS', uiLang)}：</span>
                  <strong className="font-mono-num text-slate-900">
                    {dailyProgress.completedCount} / {dailyProgress.targetCount}{' '}
                    {formatBilingual('張', '枚', uiLang, '/')}
                  </strong>
                  <label htmlFor="daily-target-select" className="sr-only">
                    設定今日目標張數
                  </label>
                  <select
                    id="daily-target-select"
                    aria-label="設定今日目標張數"
                    value={dailyTarget}
                    onChange={(e) => handleChangeDailyTarget(Number(e.target.value))}
                    className="text-[11px] font-mono-num bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-1.5 py-0.5 border border-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0284C7]"
                  >
                    <option value={5}>目標 5 張/枚</option>
                    <option value={10}>目標 10 張/枚</option>
                    <option value={15}>目標 15 張/枚</option>
                    <option value={20}>目標 20 張/枚</option>
                  </select>
                </div>
              </div>

              {/* Listening Warmup Button right next to Daily Progress Meter */}
              <button
                type="button"
                data-testid="listening-warmup-btn"
                onClick={handleTriggerListeningWarmup}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0284C7] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>{formatBilingual('聽力熱身', '聴力熱身', uiLang, ' / ')}</span>
              </button>

              {/* Detailed Learning Stats Toggle Button next to Daily Progress Meter */}
              <button
                type="button"
                data-testid="detailed-stats-toggle"
                aria-expanded={showDetailedStats}
                aria-controls="detailed-stats-panel-region"
                onClick={() => setShowDetailedStats((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showDetailedStats
                    ? 'bg-[#0284C7] text-white border-[#0284C7]'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{formatBilingual('詳細學習數據', '詳細データ', uiLang)}</span>
                {mistakes.filter((m) => !m.convertedToSrs).length > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono-num font-bold ${
                      showDetailedStats
                        ? 'bg-white text-[#0284C7]'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    錯題 {mistakes.filter((m) => !m.convertedToSrs).length}
                  </span>
                )}
                {showDetailedStats ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Right Status Summary Pills */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <div className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-[#D97706]" />
                <span>{formatBilingual('目前攻讀', '目標', uiLang)}：</span>
                <strong className="font-mono-num text-slate-900">JLPT {selectedLevel}</strong>
              </div>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#0284C7]" />
                <span>{formatBilingual('總記憶庫', '記憶庫', uiLang)}：</span>
                <strong className="font-mono-num text-slate-900">
                  {totalLearnedCount} {formatBilingual('張', '枚', uiLang, '/')}
                </strong>
              </div>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <button
                type="button"
                data-testid="status-bar-db-sync"
                onClick={handleCloudWordSync}
                title="點擊立即同步雲端最新字庫到本地數據庫"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-[#0284C7] border border-slate-200 transition-colors cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>
                  {formatBilingual(
                    `本地字庫 (${dictionaryEntries.length}詞)`,
                    `DB (${dictionaryEntries.length}語)`,
                    uiLang
                  )}
                </span>
                <RefreshCw
                  className={`w-3 h-3 ${
                    isSyncingCloud
                      ? 'animate-spin text-[#0284C7]'
                      : isOnline
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                  }`}
                />
                <span className="text-[11px] text-slate-500">
                  {isSyncingCloud
                    ? '更新中...'
                    : isOnline
                      ? lastSyncedAt
                        ? `已連線更新 (${lastSyncedAt})`
                        : '連線自動更新'
                      : '離線可用'}
                </span>
              </button>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                <span>XP：</span>
                <strong className="font-mono-num text-[#0284C7]">{xp} XP</strong>
              </div>
            </div>
          </div>

          {showGoogleDrivePanel && (
            <GoogleDriveDbPanel
              uiLang={uiLang}
              dictionaryEntries={dictionaryEntries}
              customVocab={customVocab}
              srsMap={srsMap}
              xp={xp}
              dailyTarget={dailyTarget}
              quizzesCompleted={quizzesCompleted}
              onRestoreFromDrive={handleRestoreFromDrive}
              onClose={() => setShowGoogleDrivePanel(false)}
            />
          )}

          {showDetailedStats && (
            <div id="detailed-stats-panel-region">
              <DetailedStudyStatsPanel
                stats={detailedStats}
                uiLang={uiLang}
                onClose={() => setShowDetailedStats(false)}
                onGoToQuiz={() => setActiveTab('quiz')}
                onGoToStudy={() => setActiveTab('study')}
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
            </div>
          )}

          {activeWarmup && (
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
          )}
        </section>

        {/* Mobile / Tablet Navigation Bar: 2-Column Stacked Bilingual Grid on Mobile (Zero Truncation) */}
        <nav
          aria-label="行動版分頁導航"
          data-testid="mobile-nav-grid"
          className="grid grid-cols-2 sm:grid-cols-4 md:hidden gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80"
        >
          {(
            [
              { id: 'study', zh: '聽說讀精修', ja: 'レベル別精修' },
              { id: 'mock-exam', zh: 'JLPT 能力試', ja: 'JLPT模擬試験' },
              { id: 'dictionary', zh: '日語辭典', ja: '日本語辞典' },
              { id: 'quiz', zh: '實戰測驗場', ja: '実戦テスト' },
              { id: 'materials', zh: '自訂教材出題', ja: '教材・動画出題' },
              { id: 'sensei', zh: 'AI 專屬導師', ja: 'AI 講師' },
              { id: 'method', zh: '學習法藍圖', ja: '学習メソッド' },
            ] as const
          ).map((tab, idx) => {
            const isActive = activeTab === tab.id;
            const isLastOddItem = idx === 6;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`mobile-nav-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-2.5 rounded-lg transition-colors flex flex-col items-center justify-center leading-tight cursor-pointer ${
                  isLastOddItem ? 'col-span-2 sm:col-span-2' : ''
                } ${
                  isActive
                    ? 'bg-[#0284C7] text-white shadow-xs font-bold'
                    : 'bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900 font-semibold'
                }`}
              >
                {uiLang === 'bilingual' ? (
                  <>
                    <span className="text-xs font-bold">{tab.zh}</span>
                    <span
                      className={`text-[10px] mt-0.5 ${
                        isActive ? 'text-sky-100 font-medium' : 'text-slate-500 font-normal'
                      }`}
                    >
                      {tab.ja}
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-bold">
                    {uiLang === 'ja' ? tab.ja : tab.zh}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active Workspace Stage */}
        {activeTab === 'study' && (
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
        )}

        {activeTab === 'mock-exam' && (
          <JlptMockExamCenter
            selectedLevel={selectedLevel}
            onSelectLevel={setSelectedLevel}
            uiLang={uiLang}
            onCompleteExam={handleCompleteQuiz}
            onAskSenseiWithContext={handleAskSenseiFromStage}
            onRecordMistakes={handleRecordMistakes}
          />
        )}

        {activeTab === 'dictionary' && (
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
            onOpenGoogleDriveSync={() => setShowGoogleDrivePanel(true)}
          />
        )}

        {activeTab === 'quiz' && (
          <QuizArena
            selectedLevel={selectedLevel}
            onSelectLevel={setSelectedLevel}
            customQuestions={customQuestions}
            onCompleteQuiz={handleCompleteQuiz}
            onAskSenseiWithContext={handleAskSenseiFromStage}
            uiLang={uiLang}
            onGoToMockExam={() => setActiveTab('mock-exam')}
            onRecordMistakes={handleRecordMistakes}
          />
        )}

        {activeTab === 'materials' && (
          <MaterialStudio
            selectedLevel={selectedLevel}
            onSelectLevel={setSelectedLevel}
            onSaveExtractedVocab={handleSaveExtractedVocab}
            onStartGeneratedQuiz={handleStartGeneratedQuiz}
            onAskSenseiWithContext={handleAskSenseiFromStage}
          />
        )}

        {activeTab === 'sensei' && (
          <AiSenseiPanel
            selectedLevel={selectedLevel}
            messages={senseiMessages}
            onSendMessage={(txt, attach, overrideSkills) =>
              handleSendToSensei(txt, attach, undefined, overrideSkills)
            }
            onClearHistory={() => setSenseiMessages(INITIAL_SENSEI_MESSAGES)}
            isSending={isSendingToSensei}
            skills={antigravitySkills}
            onChangeSkills={setAntigravitySkills}
          />
        )}

        {activeTab === 'method' && (
          <MethodBlueprint
            srsMap={srsMap}
            xp={xp}
            quizzesCompleted={quizzesCompleted}
            onSelectLevelAndStudy={(lvl) => {
              setSelectedLevel(lvl);
              setActiveTab('study');
            }}
          />
        )}
      </main>

      {/* Quiet Editorial Footer + Contextual AI Sensei Shortcut */}
      <footer className="border-t border-slate-200 bg-white mt-12 py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            言の葉道場 Kotonoha Dojo · JLPT N5–N1 認知科學日語精熟平台（聽・說・讀・時事動漫精讀・日中雙解辭典）
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('dictionary')}
              className="hover:text-slate-900 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>{uiLang === 'ja' ? 'AI日本語辞典を開く' : '打開日語辭典'}</span>
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('materials')}
              className="hover:text-slate-900 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>{uiLang === 'ja' ? '教材アップロード出題' : '上載日文教材自動出題'}</span>
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('sensei')}
              className="hover:text-slate-900 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>{uiLang === 'ja' ? 'AI Senseiに質問' : '向 AI Sensei 提問'}</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Owner-Only Google Account Login & Gate Lock Modal (bentktk2024@gmail.com) */}
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
