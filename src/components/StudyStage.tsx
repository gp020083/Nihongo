import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  RotateCcw,
  Sparkles,
  BookOpen,
  Compass,
  Eye,
  EyeOff,
  CheckCircle2,
  Headphones,
  Mic,
  Globe,
  Loader2,
  PlusCircle,
  StickyNote,
  Save,
  Trash2,
  Square,
  Activity,
} from 'lucide-react';
import {
  JlptLevel,
  SrsCardState,
  SrsRating,
  getSrsPreviewLabel,
  scoreSpeakingPractice,
  SpeakingEvaluationResult,
  hasSrsCardNote,
  getJlptListeningSpeechRate,
  detectSpeakerVoiceRole,
  evaluateSrsCardShadowing,
  SrsCardShadowingAssessment,
} from '../utils/srsEngine';
import {
  LEVEL_METADATA,
  VOCAB_DATABASE,
  GRAMMAR_DATABASE,
  READING_DATABASE,
  VocabItem,
  GrammarPoint,
  getGrammarNuanceJa,
} from '../data/jlptCurriculum';
import {
  LISTENING_DATABASE,
  SPEAKING_PROMPTS,
  CULTURAL_FEEDS,
  CulturalFeedItem,
  UiLang,
  formatBilingual,
} from '../data/listeningAndDictionaryData';
import {
  EXTRA_VOCAB_POOL,
  EXTRA_GRAMMAR_POOL,
  EXTRA_READING_POOL,
  EXTRA_LISTENING_POOL,
  EXTRA_SPEAKING_POOL,
} from '../data/dailyTeacherLessonsAndMockExamData';
import { DailySenseiLessonBanner } from './DailySenseiLessonBanner';
import {
  FuriganaText,
  speakJapanese,
  speakJapaneseDialogue,
  getGlobalVoiceConfig,
} from './FuriganaText';
import {
  PitchAccentModal,
  PitchVisualizerIconButton,
  PitchTargetWord,
} from './PitchAccentModal';
import { NuanceAnalyzerMode } from './NuanceAnalyzerMode';

interface StudyStageProps {
  selectedLevel: JlptLevel;
  onSelectLevel: (level: JlptLevel) => void;
  srsMap: Record<string, SrsCardState>;
  onRateCard: (itemId: string, rating: SrsRating) => void;
  onSaveCardNote?: (
    itemId: string,
    patch: {
      textNote?: string;
      voiceTranscript?: string;
      voiceAudioDataUrl?: string;
      voiceLang?: 'zh-HK' | 'ja-JP';
    }
  ) => void;
  onAskSenseiWithContext: (promptText: string, item?: any) => void;
  customVocab: VocabItem[];
  onSaveCustomVocab?: (items: VocabItem[]) => void;
  uiLang?: UiLang;
}

type StudySubMode =
  | 'vocab'
  | 'grammar'
  | 'nuance'
  | 'listening'
  | 'speaking'
  | 'reading'
  | 'cultural';

function rotateArray<T>(items: T[], offset: number): T[] {
  if (items.length <= 1 || offset === 0) return items;
  const shift = Math.abs(offset) % items.length;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

export const StudyStage: React.FC<StudyStageProps> = ({
  selectedLevel,
  onSelectLevel,
  srsMap,
  onRateCard,
  onSaveCardNote,
  onAskSenseiWithContext,
  customVocab,
  onSaveCustomVocab,
  uiLang = 'bilingual',
}) => {
  const [subMode, setSubMode] = useState<StudySubMode>('vocab');
  const [showFurigana, setShowFurigana] = useState(true);
  const [showMeaning, setShowMeaning] = useState(true);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [stageShuffleOffset, setStageShuffleOffset] = useState(0);
  const [readingAnswerMap, setReadingAnswerMap] = useState<Record<string, number>>({});

  // SRS Card Note & Voice Annotation state
  const [showNotePanel, setShowNotePanel] = useState<boolean>(true);
  const [draftNoteText, setDraftNoteText] = useState<string>('');
  const [draftVoiceTranscript, setDraftVoiceTranscript] = useState<string>('');
  const [draftVoiceAudioUrl, setDraftVoiceAudioUrl] = useState<string | undefined>(undefined);
  const [voiceNoteLang, setVoiceNoteLang] = useState<'zh-HK' | 'ja-JP'>('zh-HK');
  const [isRecordingCardNote, setIsRecordingCardNote] = useState<boolean>(false);
  const [noteSavedToast, setNoteSavedToast] = useState<boolean>(false);
  const [pitchVisualizerWord, setPitchVisualizerWord] = useState<PitchTargetWord | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecRef = useRef<any>(null);

  // SRS Card Shadowing (跟讀) Challenge state
  const [showShadowingPanel, setShowShadowingPanel] = useState<boolean>(false);
  const [shadowingVoiceEngine, setShadowingVoiceEngine] = useState<'ai-tts' | 'web-speech'>('ai-tts');
  const [isPlayingShadowingModel, setIsPlayingShadowingModel] = useState<boolean>(false);
  const [isRecordingShadowing, setIsRecordingShadowing] = useState<boolean>(false);
  const [isEvaluatingShadowing, setIsEvaluatingShadowing] = useState<boolean>(false);
  const [shadowingTranscriptMap, setShadowingTranscriptMap] = useState<Record<string, string>>({});
  const [shadowingAudioUrlMap, setShadowingAudioUrlMap] = useState<Record<string, string>>({});
  const [shadowingAssessmentMap, setShadowingAssessmentMap] = useState<
    Record<string, SrsCardShadowingAssessment>
  >({});
  const shadowingRecorderRef = useRef<MediaRecorder | null>(null);
  const shadowingSpeechRecRef = useRef<any>(null);
  const shadowingModelAudioRef = useRef<HTMLAudioElement | null>(null);

  // Listening state
  const [listeningAnswerMap, setListeningAnswerMap] = useState<Record<string, number>>({});
  const [showListeningScript, setShowListeningScript] = useState<Record<string, boolean>>({});
  const [audioSpeed, setAudioSpeed] = useState<number>(
    () => getJlptListeningSpeechRate(selectedLevel).rate
  );

  useEffect(() => {
    setAudioSpeed(getJlptListeningSpeechRate(selectedLevel).rate);
  }, [selectedLevel]);

  // Speaking state
  const [speakingInputMap, setSpeakingInputMap] = useState<Record<string, string>>({});
  const [speakingResultMap, setSpeakingResultMap] = useState<
    Record<string, SpeakingEvaluationResult>
  >({});
  const [isRecordingId, setIsRecordingId] = useState<string | null>(null);

  // Cultural / Web / News / Anime feed state
  const [feeds, setFeeds] = useState<CulturalFeedItem[]>(CULTURAL_FEEDS);
  const [feedFilterCategory, setFeedFilterCategory] = useState<'all' | 'anime' | 'news' | 'culture'>('all');
  const [liveTopicInput, setLiveTopicInput] = useState<string>('');
  const [liveCategory, setLiveCategory] = useState<'anime' | 'news' | 'culture'>('anime');
  const [isGeneratingFeed, setIsGeneratingFeed] = useState<boolean>(false);
  const [feedStatusNotice, setFeedStatusNotice] = useState<string | null>(null);
  const [savedFeedWordIds, setSavedFeedWordIds] = useState<Record<string, boolean>>({});

  const levelMeta = LEVEL_METADATA[selectedLevel];
  const rawVocabForLevel = [
    ...customVocab.filter((v) => v.level === selectedLevel),
    ...VOCAB_DATABASE.filter((v) => v.level === selectedLevel),
    ...EXTRA_VOCAB_POOL.filter((v) => v.level === selectedLevel),
  ];
  const allVocabForLevel = rotateArray(rawVocabForLevel, stageShuffleOffset);

  const grammarForLevel = rotateArray(
    [
      ...GRAMMAR_DATABASE.filter((g) => g.level === selectedLevel),
      ...EXTRA_GRAMMAR_POOL.filter((g) => g.level === selectedLevel),
    ],
    stageShuffleOffset
  );

  const readingForLevel = rotateArray(
    [
      ...READING_DATABASE.filter((r) => r.level === selectedLevel),
      ...EXTRA_READING_POOL.filter((r) => r.level === selectedLevel),
    ],
    stageShuffleOffset
  );

  const listeningForLevel = rotateArray(
    [
      ...LISTENING_DATABASE.filter((l) => l.level === selectedLevel),
      ...EXTRA_LISTENING_POOL.filter((l) => l.level === selectedLevel),
    ],
    stageShuffleOffset
  );

  const speakingForLevel = rotateArray(
    [
      ...SPEAKING_PROMPTS.filter((s) => s.level === selectedLevel),
      ...EXTRA_SPEAKING_POOL.filter((s) => s.level === selectedLevel),
    ],
    stageShuffleOffset
  );

  const filteredFeeds = feeds.filter(
    (f) => feedFilterCategory === 'all' || f.category === feedFilterCategory
  );

  const safeCardIndex = allVocabForLevel.length > 0 ? activeCardIndex % allVocabForLevel.length : 0;
  const activeVocab: VocabItem | undefined = allVocabForLevel[safeCardIndex];
  const activeSrsState = activeVocab ? srsMap[activeVocab.id] : undefined;

  // Sync draft note state whenever active card or its saved SRS note changes
  useEffect(() => {
    const savedNote = activeSrsState?.note;
    setDraftNoteText(savedNote?.textNote ?? '');
    setDraftVoiceTranscript(savedNote?.voiceTranscript ?? '');
    setDraftVoiceAudioUrl(savedNote?.voiceAudioDataUrl);
    setVoiceNoteLang(savedNote?.voiceLang ?? 'zh-HK');
    setNoteSavedToast(false);
    setIsRecordingCardNote(false);
    setIsRecordingShadowing(false);
    setIsPlayingShadowingModel(false);
  }, [activeVocab?.id, activeSrsState?.note?.updatedAt]);

  /**
   * Plays the SRS Card's target example sentence using either AI-generated natural voice
   * (/api/ai/shadowing-tts) or Web Speech API at calibrated or 0.75x slow shadowing speed.
   */
  const handlePlayShadowingModelAudio = async (slowMode: boolean = false) => {
    if (!activeVocab) return;
    const rateToUse = slowMode
      ? 0.75
      : getJlptListeningSpeechRate(selectedLevel).rate;

    if (shadowingModelAudioRef.current) {
      try {
        shadowingModelAudioRef.current.pause();
      } catch {
        // ignore
      }
      shadowingModelAudioRef.current = null;
    }

    setIsPlayingShadowingModel(true);

    if (shadowingVoiceEngine === 'ai-tts') {
      try {
        const currentVoiceStyle = getGlobalVoiceConfig().voiceStyle;
        const res = await fetch('/api/ai/shadowing-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            textJp: activeVocab.exampleJp,
            level: selectedLevel,
            slowMode,
            voiceStyle: currentVoiceStyle,
          }),
        });
        const data = await res.json();
        if (data && typeof data.audioDataUrl === 'string') {
          const audio = new Audio(data.audioDataUrl);
          const globalMult = getGlobalVoiceConfig().speedMultiplier || 1.0;
          audio.playbackRate = Math.max(
            0.65,
            Math.min(1.6, (slowMode ? 0.82 : 1.0) * globalMult)
          );
          shadowingModelAudioRef.current = audio;
          audio.onended = () => setIsPlayingShadowingModel(false);
          audio.onerror = () => {
            speakJapanese(activeVocab.exampleJp, rateToUse);
            setIsPlayingShadowingModel(false);
          };
          await audio.play();
          return;
        }
      } catch {
        // Fall through to speakJapanese
      }
    }

    speakJapanese(activeVocab.exampleJp, rateToUse);
    window.setTimeout(() => {
      setIsPlayingShadowingModel(false);
    }, 1800);
  };

  /**
   * Evaluates the user's SRS Card Shadowing attempt via /api/ai/shadowing-evaluate
   * combined with deterministic character & pitch-accent analysis from evaluateSrsCardShadowing.
   */
  const handleEvaluateCardShadowing = async (
    card: VocabItem,
    spokenText: string,
    recordedAudioDataUrl?: string
  ) => {
    const cleanText = spokenText.trim();
    // Immediate local baseline evaluation so UI responds instantaneously
    const baseline = evaluateSrsCardShadowing({
      targetSentenceJp: card.exampleJp,
      spokenTranscriptJp: cleanText,
      targetKanji: card.kanji,
      targetReading: card.reading,
      pitchAccent: card.pitchAccent,
    });
    setShadowingAssessmentMap((prev) => ({
      ...prev,
      [card.id]: baseline,
    }));

    if (!cleanText && !recordedAudioDataUrl) return;

    setIsEvaluatingShadowing(true);
    try {
      const response = await fetch('/api/ai/shadowing-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetSentenceJp: card.exampleJp,
          targetKanji: card.kanji,
          targetReading: card.reading,
          pitchAccent: card.pitchAccent,
          level: card.level,
          spokenTranscriptJp: cleanText,
          audioDataUrl: recordedAudioDataUrl,
        }),
      });
      const aiData = await response.json();
      if (aiData && !aiData.fallbackToLocalEngine) {
        const finalTranscript =
          typeof aiData.spokenTranscriptJp === 'string' && aiData.spokenTranscriptJp.trim()
            ? aiData.spokenTranscriptJp.trim()
            : cleanText;
        if (finalTranscript) {
          setShadowingTranscriptMap((prev) => ({ ...prev, [card.id]: finalTranscript }));
        }
        const enriched = evaluateSrsCardShadowing({
          targetSentenceJp: card.exampleJp,
          spokenTranscriptJp: finalTranscript || cleanText,
          targetKanji: card.kanji,
          targetReading: card.reading,
          pitchAccent: card.pitchAccent,
          aiOverride: {
            overallScore: aiData.overallScore,
            pronunciationScore: aiData.pronunciationScore,
            fluencyScore: aiData.fluencyScore,
            pitchAccentScore: aiData.pitchAccentScore,
            targetWordHit: aiData.targetWordHit,
            coachAdviceHk: aiData.coachAdviceHk,
            coachAdviceJa: aiData.coachAdviceJa,
            pitchAccentTipHk: aiData.pitchAccentTipHk,
          },
        });
        setShadowingAssessmentMap((prev) => ({
          ...prev,
          [card.id]: enriched,
        }));
      }
    } catch {
      // Keep local deterministic assessment on network error
    } finally {
      setIsEvaluatingShadowing(false);
    }
  };

  /**
   * Starts or stops user voice recording for the SRS Card Shadowing Challenge
   * using Web Speech API (ja-JP) + MediaRecorder, then runs AI comparison scoring.
   */
  const handleToggleShadowingRecording = async () => {
    if (!activeVocab) return;
    const card = activeVocab;
    const cleanTargetSample = card.exampleJp.replace(/\[[^\]]+\]/g, '');

    if (isRecordingShadowing) {
      setIsRecordingShadowing(false);
      if (shadowingSpeechRecRef.current) {
        try {
          shadowingSpeechRecRef.current.stop();
        } catch {
          // ignore
        }
        shadowingSpeechRecRef.current = null;
      }
      if (
        shadowingRecorderRef.current &&
        shadowingRecorderRef.current.state !== 'inactive'
      ) {
        try {
          shadowingRecorderRef.current.stop();
          return; // recorder.onstop will trigger evaluation with recorded audioDataUrl
        } catch {
          // ignore
        }
      }
      const currentTranscript =
        (shadowingTranscriptMap[card.id] || '').trim() || cleanTargetSample;
      setShadowingTranscriptMap((prev) => ({ ...prev, [card.id]: currentTranscript }));
      handleEvaluateCardShadowing(
        card,
        currentTranscript,
        shadowingAudioUrlMap[card.id]
      );
      return;
    }

    setIsRecordingShadowing(true);
    let capturedTranscript = '';
    let capturedAudioDataUrl: string | undefined;
    let mediaRecorderStarted = false;

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    // 1. Start MediaRecorder on microphone stream so we capture real audio even if SpeechRecognition fails
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const recorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        mediaRecorderStarted = true;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          setIsRecordingShadowing(false);
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = async () => {
              const dataUrl =
                typeof reader.result === 'string' ? reader.result : undefined;
              if (dataUrl) {
                capturedAudioDataUrl = dataUrl;
                setShadowingAudioUrlMap((prev) => ({
                  ...prev,
                  [card.id]: dataUrl,
                }));

                let textToEval =
                  capturedTranscript.trim() ||
                  (shadowingTranscriptMap[card.id] || '').trim();

                // If browser SpeechRecognition didn't capture text, use server AI audio transcription
                if (!textToEval) {
                  try {
                    const transRes = await fetch('/api/ai/transcribe-speech', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        audioDataUrl: dataUrl,
                        targetHintJp: cleanTargetSample,
                      }),
                    });
                    const transData = await transRes.json();
                    if (
                      transData &&
                      typeof transData.transcriptJp === 'string' &&
                      transData.transcriptJp.trim()
                    ) {
                      textToEval = transData.transcriptJp.trim();
                      setShadowingTranscriptMap((prev) => ({
                        ...prev,
                        [card.id]: textToEval,
                      }));
                    }
                  } catch {
                    // Continue to handleEvaluateCardShadowing which also accepts audioDataUrl directly
                  }
                }

                handleEvaluateCardShadowing(
                  card,
                  textToEval || cleanTargetSample,
                  dataUrl
                );
              }
            };
            reader.readAsDataURL(blob);
          } else {
            const fallbackText =
              capturedTranscript.trim() ||
              (shadowingTranscriptMap[card.id] || '').trim() ||
              cleanTargetSample;
            setShadowingTranscriptMap((prev) => ({ ...prev, [card.id]: fallbackText }));
            handleEvaluateCardShadowing(card, fallbackText);
          }
        };

        shadowingRecorderRef.current = recorder;
        recorder.start();
      } catch {
        mediaRecorderStarted = false;
      }
    }

    // 2. Also start browser SpeechRecognition for live interim streaming transcript
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.lang = 'ja-JP';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        shadowingSpeechRecRef.current = recognition;

        recognition.onresult = (event: any) => {
          let combined = '';
          for (let i = 0; i < event.results.length; i++) {
            combined += event.results[i]?.[0]?.transcript || '';
          }
          if (combined.trim()) {
            capturedTranscript = combined.trim();
            setShadowingTranscriptMap((prev) => ({
              ...prev,
              [card.id]: capturedTranscript,
            }));
          }
        };

        recognition.onerror = () => {
          // If MediaRecorder is running, keep recording audio and don't abort!
          if (!mediaRecorderStarted) {
            const fallbackText =
              (shadowingTranscriptMap[card.id] || '').trim() || cleanTargetSample;
            setShadowingTranscriptMap((prev) => ({ ...prev, [card.id]: fallbackText }));
            handleEvaluateCardShadowing(card, fallbackText, capturedAudioDataUrl);
            setIsRecordingShadowing(false);
          }
        };

        recognition.onend = () => {
          if (!mediaRecorderStarted) {
            const finalText =
              capturedTranscript.trim() ||
              (shadowingTranscriptMap[card.id] || '').trim() ||
              cleanTargetSample;
            setShadowingTranscriptMap((prev) => ({ ...prev, [card.id]: finalText }));
            handleEvaluateCardShadowing(card, finalText, capturedAudioDataUrl);
            setIsRecordingShadowing(false);
          }
        };

        recognition.start();
        return;
      } catch {
        if (mediaRecorderStarted) return;
      }
    }

    if (!mediaRecorderStarted) {
      // Neither mic stream nor SpeechRecognition available: populate target sentence and run AI evaluation
      setShadowingTranscriptMap((prev) => ({ ...prev, [card.id]: cleanTargetSample }));
      handleEvaluateCardShadowing(card, cleanTargetSample);
      setIsRecordingShadowing(false);
    }
  };

  const levels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

  const handleSaveActiveCardNote = (overridePatch?: {
    textNote?: string;
    voiceTranscript?: string;
    voiceAudioDataUrl?: string;
    voiceLang?: 'zh-HK' | 'ja-JP';
  }) => {
    if (!activeVocab || !onSaveCardNote) return;
    onSaveCardNote(activeVocab.id, {
      textNote:
        overridePatch?.textNote !== undefined ? overridePatch.textNote : draftNoteText,
      voiceTranscript:
        overridePatch?.voiceTranscript !== undefined
          ? overridePatch.voiceTranscript
          : draftVoiceTranscript,
      voiceAudioDataUrl:
        overridePatch?.voiceAudioDataUrl !== undefined
          ? overridePatch.voiceAudioDataUrl
          : draftVoiceAudioUrl,
      voiceLang: overridePatch?.voiceLang ?? voiceNoteLang,
    });
    setNoteSavedToast(true);
  };

  const handleClearActiveCardNote = () => {
    if (!activeVocab || !onSaveCardNote) return;
    setDraftNoteText('');
    setDraftVoiceTranscript('');
    setDraftVoiceAudioUrl(undefined);
    onSaveCardNote(activeVocab.id, {
      textNote: '',
      voiceTranscript: '',
      voiceAudioDataUrl: undefined,
    });
    setNoteSavedToast(false);
  };

  const handleAppendQuickNoteTag = (tagLabel: string) => {
    if (!activeVocab) return;
    const prefix = draftNoteText.trim() ? `${draftNoteText.trim()}\n` : '';
    const nextText = `${prefix}【${tagLabel}】`;
    setDraftNoteText(nextText);
    setNoteSavedToast(false);
  };

  const handleToggleCardVoiceNote = async () => {
    if (!activeVocab) return;

    const buildFallbackVoiceMemo = () =>
      voiceNoteLang === 'ja-JP'
        ? `${activeVocab.kanji}（${activeVocab.reading}）：${activeVocab.exampleJp.replace(/\[[^\]]+\]/g, '')}`
        : `語音記憶備註：「${activeVocab.kanji}（${activeVocab.reading}）」意思係「${activeVocab.meaning}」，重點搭配：${activeVocab.exampleJp.replace(/\[[^\]]+\]/g, '')}`;

    if (isRecordingCardNote) {
      // Stop ongoing recording and save voice memo
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      const memoToSave = draftVoiceTranscript.trim() || buildFallbackVoiceMemo();
      const noteToSave = draftNoteText.trim()
        ? draftNoteText
        : `重點筆記：${activeVocab.kanji}（${activeVocab.reading}）＝ ${activeVocab.meaning}`;
      setDraftVoiceTranscript(memoToSave);
      setDraftNoteText(noteToSave);
      handleSaveActiveCardNote({
        textNote: noteToSave,
        voiceTranscript: memoToSave,
        voiceLang: voiceNoteLang,
      });
      setIsRecordingCardNote(false);
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      const generatedMemo = buildFallbackVoiceMemo();
      const combinedNote = draftNoteText.trim()
        ? draftNoteText
        : `重點筆記：${activeVocab.kanji}（${activeVocab.reading}）＝ ${activeVocab.meaning}`;
      setDraftVoiceTranscript(generatedMemo);
      setDraftNoteText(combinedNote);
      handleSaveActiveCardNote({
        textNote: combinedNote,
        voiceTranscript: generatedMemo,
        voiceLang: voiceNoteLang,
      });
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = voiceNoteLang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      speechRecRef.current = recognition;
      setIsRecordingCardNote(true);

      let capturedTranscript = '';

      // Also attempt MediaRecorder audio capture if supported
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            const recorder = new MediaRecorder(stream);
            const chunks: BlobPart[] = [];
            recorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunks.push(e.data);
            };
            recorder.onstop = () => {
              stream.getTracks().forEach((t) => t.stop());
              if (chunks.length > 0) {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                  const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
                  if (dataUrl) {
                    setDraftVoiceAudioUrl(dataUrl);
                    handleSaveActiveCardNote({
                      voiceAudioDataUrl: dataUrl,
                      voiceTranscript: capturedTranscript || draftVoiceTranscript || buildFallbackVoiceMemo(),
                    });
                  }
                };
                reader.readAsDataURL(blob);
              }
            };
            mediaRecorderRef.current = recorder;
            recorder.start();
          })
          .catch(() => {
            // Microphone permission not granted; SpeechRecognition or fallback will handle
          });
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        capturedTranscript = transcript;
        if (transcript) {
          const nextNote = draftNoteText.trim()
            ? `${draftNoteText.trim()}\n${transcript}`
            : transcript;
          setDraftVoiceTranscript(transcript);
          setDraftNoteText(nextNote);
          handleSaveActiveCardNote({
            textNote: nextNote,
            voiceTranscript: transcript,
            voiceLang: voiceNoteLang,
          });
        }
        setIsRecordingCardNote(false);
      };

      recognition.onerror = () => {
        const fallbackMemo = buildFallbackVoiceMemo();
        const nextNote = draftNoteText.trim()
          ? draftNoteText
          : `重點筆記：${activeVocab.kanji}（${activeVocab.reading}）＝ ${activeVocab.meaning}`;
        setDraftVoiceTranscript(fallbackMemo);
        setDraftNoteText(nextNote);
        handleSaveActiveCardNote({
          textNote: nextNote,
          voiceTranscript: fallbackMemo,
          voiceLang: voiceNoteLang,
        });
        setIsRecordingCardNote(false);
      };

      recognition.onend = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try {
            mediaRecorderRef.current.stop();
          } catch {
            // ignore
          }
        }
        if (!capturedTranscript) {
          const fallbackMemo = buildFallbackVoiceMemo();
          const nextNote = draftNoteText.trim()
            ? draftNoteText
            : `重點筆記：${activeVocab.kanji}（${activeVocab.reading}）＝ ${activeVocab.meaning}`;
          setDraftVoiceTranscript(fallbackMemo);
          setDraftNoteText(nextNote);
          handleSaveActiveCardNote({
            textNote: nextNote,
            voiceTranscript: fallbackMemo,
            voiceLang: voiceNoteLang,
          });
        }
        setIsRecordingCardNote(false);
      };

      recognition.start();
    } catch {
      const fallbackMemo = buildFallbackVoiceMemo();
      const nextNote = draftNoteText.trim()
        ? draftNoteText
        : `重點筆記：${activeVocab.kanji}（${activeVocab.reading}）＝ ${activeVocab.meaning}`;
      setDraftVoiceTranscript(fallbackMemo);
      setDraftNoteText(nextNote);
      handleSaveActiveCardNote({
        textNote: nextNote,
        voiceTranscript: fallbackMemo,
        voiceLang: voiceNoteLang,
      });
      setIsRecordingCardNote(false);
    }
  };

  const handlePlayCardVoiceNote = () => {
    if (draftVoiceAudioUrl) {
      try {
        const audio = new Audio(draftVoiceAudioUrl);
        audio.play().catch(() => {
          speakJapanese(draftVoiceTranscript || draftNoteText || activeVocab?.kanji || '');
        });
        return;
      } catch {
        // Fallback to speechSynthesis below
      }
    }
    const textToSpeak = draftVoiceTranscript || draftNoteText || activeVocab?.kanji || '';
    if (!textToSpeak) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(textToSpeak);
        utter.lang = voiceNoteLang;
        utter.rate = 0.95;
        window.speechSynthesis.speak(utter);
        return;
      } catch {
        // ignore
      }
    }
    speakJapanese(textToSpeak);
  };

  const handleSrsAction = (rating: SrsRating) => {
    if (!activeVocab) return;
    onRateCard(activeVocab.id, rating);
    setActiveCardIndex((prev) => (prev + 1) % allVocabForLevel.length);
  };

  const handlePlayFullDialogue = (
    lines: Array<{ speaker: string; textJp: string }>
  ) => {
    speakJapaneseDialogue({
      dialogueSpeakers: lines,
      level: selectedLevel,
      rateOverride: audioSpeed,
      preferNaturalServerTts: true,
    });
  };

  const handleStartVoiceRecognition = async (promptId: string, targetJp: string) => {
    const cleanSample = targetJp.replace(/\[[^\]]+\]/g, '');

    // Toggle off if already recording this promptId
    if (isRecordingId === promptId) {
      setIsRecordingId(null);
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {
          // ignore
        }
        speechRecRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
          return;
        } catch {
          // ignore
        }
      }
      const existing = (speakingInputMap[promptId] || '').trim() || cleanSample;
      setSpeakingInputMap((prev) => ({ ...prev, [promptId]: existing }));
      setSpeakingResultMap((prev) => ({
        ...prev,
        [promptId]: scoreSpeakingPractice(targetJp, existing),
      }));
      return;
    }

    setIsRecordingId(promptId);
    let capturedTranscript = '';
    let mediaRecorderStarted = false;

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const recorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        mediaRecorderStarted = true;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          setIsRecordingId(null);
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = async () => {
              const dataUrl =
                typeof reader.result === 'string' ? reader.result : undefined;
              let finalSpoken =
                capturedTranscript.trim() ||
                (speakingInputMap[promptId] || '').trim();

              if (!finalSpoken && dataUrl) {
                try {
                  const res = await fetch('/api/ai/transcribe-speech', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      audioDataUrl: dataUrl,
                      targetHintJp: cleanSample,
                    }),
                  });
                  const data = await res.json();
                  if (
                    data &&
                    typeof data.transcriptJp === 'string' &&
                    data.transcriptJp.trim()
                  ) {
                    finalSpoken = data.transcriptJp.trim();
                  }
                } catch {
                  // Ignore network error
                }
              }

              const textToScore = finalSpoken || cleanSample;
              setSpeakingInputMap((prev) => ({ ...prev, [promptId]: textToScore }));
              setSpeakingResultMap((prev) => ({
                ...prev,
                [promptId]: scoreSpeakingPractice(targetJp, textToScore),
              }));
            };
            reader.readAsDataURL(blob);
          } else {
            const textToScore =
              capturedTranscript.trim() ||
              (speakingInputMap[promptId] || '').trim() ||
              cleanSample;
            setSpeakingInputMap((prev) => ({ ...prev, [promptId]: textToScore }));
            setSpeakingResultMap((prev) => ({
              ...prev,
              [promptId]: scoreSpeakingPractice(targetJp, textToScore),
            }));
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
      } catch {
        mediaRecorderStarted = false;
      }
    }

    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.lang = 'ja-JP';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        speechRecRef.current = recognition;

        recognition.onresult = (event: any) => {
          let combined = '';
          for (let i = 0; i < event.results.length; i++) {
            combined += event.results[i]?.[0]?.transcript || '';
          }
          if (combined.trim()) {
            capturedTranscript = combined.trim();
            setSpeakingInputMap((prev) => ({
              ...prev,
              [promptId]: capturedTranscript,
            }));
            setSpeakingResultMap((prev) => ({
              ...prev,
              [promptId]: scoreSpeakingPractice(targetJp, capturedTranscript),
            }));
          }
        };

        recognition.onerror = () => {
          if (!mediaRecorderStarted) {
            setIsRecordingId(null);
          }
        };

        recognition.onend = () => {
          if (!mediaRecorderStarted) {
            setIsRecordingId(null);
          }
        };

        recognition.start();
        return;
      } catch {
        if (mediaRecorderStarted) return;
      }
    }

    if (!mediaRecorderStarted) {
      setSpeakingInputMap((prev) => ({ ...prev, [promptId]: cleanSample }));
      setSpeakingResultMap((prev) => ({
        ...prev,
        [promptId]: scoreSpeakingPractice(targetJp, cleanSample),
      }));
      setIsRecordingId(null);
    }
  };

  const handleGenerateLiveFeed = async (presetTopic?: string) => {
    const topicToUse =
      (presetTopic ?? liveTopicInput).trim() ||
      (liveCategory === 'anime'
        ? '日本最新人気アニメの名セリフと聖地巡礼'
        : liveCategory === 'news'
          ? '日本の最新テクノロジーと社会ニュース'
          : '京都と東京の四季イベント・食文化');

    setIsGeneratingFeed(true);
    setFeedStatusNotice(null);
    try {
      const response = await fetch('/api/ai/live-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicToUse,
          level: selectedLevel,
          category: liveCategory,
        }),
      });
      const data: Partial<CulturalFeedItem> = await response.json();
      if (data && (data.titleJp || data.contentJp)) {
        const normalizedFeed: CulturalFeedItem = {
          id: data.id || `feed-ai-${Date.now()}`,
          category: data.category || liveCategory,
          level: data.level || selectedLevel,
          sourceLabel: data.sourceLabel || 'AI 實時話題精讀',
          titleJp: data.titleJp || `話題精読：${topicToUse}`,
          titleHk: data.titleHk || `日本熱門話題精讀：${topicToUse}`,
          contentJp:
            data.contentJp ||
            `日本[にほん]で今[いま]注目[ちゅうもく]を集[あつ]めている「${topicToUse}」について、多[おお]くの人[ひと]が関心[かんしん]を持[も]っています。`,
          translationHk:
            data.translationHk ||
            `關於日本最近備受矚目嘅「${topicToUse}」，唔少人都非常關心。`,
          keyVocab:
            Array.isArray(data.keyVocab) && data.keyVocab.length > 0
              ? data.keyVocab
              : [
                  { kanji: '注目', reading: 'ちゅうもく', meaning: '矚目、關注' },
                  { kanji: '話題', reading: 'わだい', meaning: '話題、熱話' },
                ],
          grammarPoint:
            data.grammarPoint && data.grammarPoint.pattern
              ? data.grammarPoint
              : {
                  pattern: '〜について / 〜きっかけに',
                  explanation: '表示「關於某個主題」或「以某件事為契機」。',
                },
        };
        setFeeds((prev) => [normalizedFeed, ...prev]);
        setFeedFilterCategory('all');
        setLiveTopicInput('');
        setFeedStatusNotice(`★ AI 已為你生成最新精讀教材：《${normalizedFeed.titleJp}》`);
      }
    } catch {
      setFeedStatusNotice('▲ 生成題材時網路繁忙，已顯示精選教材。');
    } finally {
      setIsGeneratingFeed(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Level & Mode Selector Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{uiLang === 'ja' ? 'JLPT 習熟度ステージ' : 'JLPT 能力階梯'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">{levelMeta.cefr}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">
              {uiLang === 'ja'
                ? `目標語彙 ${levelMeta.targetVocabCount} 語`
                : `目標詞彙 ${levelMeta.targetVocabCount} 語`}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {selectedLevel} {levelMeta.title}
          </h2>
          <p className="text-sm text-slate-600">{levelMeta.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* N5-N1 Level Segmented Control */}
          <div
            role="group"
            aria-label="選擇 JLPT 級別"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {levels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  onSelectLevel(lvl);
                  setActiveCardIndex(0);
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedLevel === lvl
                    ? 'bg-[#0284C7] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Furigana Toggle */}
          <button
            type="button"
            onClick={() => setShowFurigana((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {showFurigana ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>
              {showFurigana
                ? uiLang === 'ja'
                  ? 'ふりがな表示中'
                  : '顯示振假名'
                : uiLang === 'ja'
                  ? 'ふりがな非表示'
                  : '隱藏振假名 (漢字挑戰)'}
            </span>
          </button>
        </div>
      </div>

      {/* Daily Sensei Curated & Web-Grounded Multi-Skill Lesson Studio */}
      <DailySenseiLessonBanner
        selectedLevel={selectedLevel}
        uiLang={uiLang}
        onSaveVocabItems={(items) => {
          if (onSaveCustomVocab) {
            onSaveCustomVocab(items);
          }
        }}
        onAskSenseiWithContext={onAskSenseiWithContext}
        onShuffleStagePool={() => {
          setStageShuffleOffset((prev) => prev + 1);
          setActiveCardIndex(0);
        }}
      />

      {/* Sub-mode Switcher (Covers 詞彙 / 文法 / 聽解 / 口說 / 讀解 / 時事・動漫精讀 in Bilingual Chinese + Japanese) */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div
          data-testid="study-submode-tabs"
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl self-start"
        >
          <button
            type="button"
            onClick={() => setSubMode('vocab')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subMode === 'vocab'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {formatBilingual(
              `詞彙記憶卡 (${allVocabForLevel.length})`,
              `単語カード (${allVocabForLevel.length})`,
              uiLang
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubMode('grammar')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subMode === 'grammar'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {formatBilingual(
              `核心文法圖解 (${grammarForLevel.length})`,
              `核心文法 (${grammarForLevel.length})`,
              uiLang
            )}
          </button>

          <button
            type="button"
            data-testid="submode-nuance-analyzer-btn"
            onClick={() => setSubMode('nuance')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subMode === 'nuance'
                ? 'bg-white text-[#0284C7] shadow-xs ring-1 ring-sky-200'
                : 'text-slate-700 hover:text-slate-900 bg-sky-50/70'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>
              {formatBilingual(
                '語感解析模式 (動態變化・時雨風圖鑑)',
                '語感解析モード (動態変化・時雨図鑑)',
                uiLang
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubMode('listening')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subMode === 'listening'
                ? 'bg-white text-[#0284C7] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>
              {formatBilingual(
                `聽解實戰 (${listeningForLevel.length})`,
                `聴解道場 (${listeningForLevel.length})`,
                uiLang
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubMode('speaking')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subMode === 'speaking'
                ? 'bg-white text-[#0284C7] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>
              {formatBilingual(
                `口說跟讀 (${speakingForLevel.length})`,
                `口説・発音 (${speakingForLevel.length})`,
                uiLang
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubMode('reading')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subMode === 'reading'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {formatBilingual(
              `短文讀解 (${readingForLevel.length})`,
              `短文読解 (${readingForLevel.length})`,
              uiLang
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubMode('cultural')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subMode === 'cultural'
                ? 'bg-white text-[#0284C7] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>
              {formatBilingual(
                `時事・動漫精讀 (${feeds.length})`,
                `ニュース・アニメ (${feeds.length})`,
                uiLang
              )}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-600 flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#0284C7] shrink-0" />
          <span>{levelMeta.studyStrategy}</span>
        </div>
      </div>

      {/* MODE 1: Interactive SRS Vocabulary Stage */}
      {subMode === 'vocab' && activeVocab && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Interactive Flashcard Stage (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono-num">
                  {uiLang === 'ja' ? 'カード' : '卡片'} {safeCardIndex + 1} / {allVocabForLevel.length}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeVocab.partOfSpeech}</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  data-testid="srs-pitch-badge-btn"
                  onClick={() =>
                    setPitchVisualizerWord({
                      kanji: activeVocab.kanji,
                      reading: activeVocab.reading,
                      pitchAccent: activeVocab.pitchAccent,
                      romaji: activeVocab.romaji,
                      partOfSpeech: activeVocab.partOfSpeech,
                      meaning: activeVocab.meaning,
                    })
                  }
                  title="點擊展開高低音調視覺化互動圖表"
                  className="inline-flex items-center gap-1 font-mono-num text-[#0284C7] hover:underline font-semibold cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>
                    {uiLang === 'ja' ? 'アクセント' : '音調'} {activeVocab.pitchAccent}
                  </span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {hasSrsCardNote(activeSrsState) && (
                  <span
                    data-testid="active-card-has-note-badge"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                  >
                    <StickyNote className="w-3 h-3 text-amber-600" />
                    <span>{formatBilingual('已附筆記', 'メモあり', uiLang)}</span>
                  </span>
                )}
                {activeSrsState && activeSrsState.repetitions > 0 ? (
                  <span className="text-xs font-medium text-[#059669]">
                    ● {uiLang === 'ja' ? `復習 ${activeSrsState.repetitions} 回` : `已複習 ${activeSrsState.repetitions} 次（間隔 ${activeSrsState.intervalDays} 日）`}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-[#0284C7]">
                    ● {uiLang === 'ja' ? '新規単語' : '新學習詞彙'}
                  </span>
                )}
              </div>
            </div>

            {/* Primary Kanji & Reading Anchor */}
            <div className="py-4 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  {showFurigana && (
                    <div className="text-sm font-medium text-[#0284C7] mb-1">
                      {activeVocab.reading} ·{' '}
                      <span className="font-mono-num text-slate-500">{activeVocab.romaji}</span>
                    </div>
                  )}
                  <h3 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
                    {activeVocab.kanji}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => speakJapanese(activeVocab.kanji)}
                    aria-label={`朗讀單字 ${activeVocab.kanji}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0284C7] bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>{uiLang === 'ja' ? '発音' : '單字發音'}</span>
                  </button>
                  <PitchVisualizerIconButton
                    testId="srs-pitch-visualizer-btn"
                    word={{
                      kanji: activeVocab.kanji,
                      reading: activeVocab.reading,
                      pitchAccent: activeVocab.pitchAccent,
                      romaji: activeVocab.romaji,
                      partOfSpeech: activeVocab.partOfSpeech,
                      meaning: activeVocab.meaning,
                    }}
                    uiLang={uiLang}
                    onOpen={setPitchVisualizerWord}
                  />
                  <button
                    type="button"
                    data-testid="srs-card-shadowing-toggle-btn"
                    onClick={() => {
                      setShowMeaning(true);
                      setShowShadowingPanel((prev) => !prev);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      showShadowingPanel
                        ? 'bg-[#0284C7] text-white border-[#0284C7] shadow-xs'
                        : 'bg-sky-50 text-[#0284C7] border-sky-200 hover:bg-sky-100'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>
                      {formatBilingual(
                        'Shadowing (跟讀) 挑戰',
                        'シャドーイング挑戦',
                        uiLang
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="card-note-toggle-btn"
                    onClick={() => setShowNotePanel((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      showNotePanel
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <StickyNote className="w-3.5 h-3.5 text-amber-600" />
                    <span>{formatBilingual('筆記註解', 'メモ・音声', uiLang)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMeaning((m) => !m)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {showMeaning
                        ? uiLang === 'ja'
                          ? '意味を隠す'
                          : '遮蓋釋義自測'
                        : uiLang === 'ja'
                          ? '意味を表示'
                          : '顯示釋義'}
                    </span>
                  </button>
                </div>
              </div>

              {showMeaning ? (
                <div className="pt-3 space-y-4">
                  <div className="text-2xl font-bold text-slate-900">{activeVocab.meaning}</div>

                  {/* Cognitive Core Image Callout */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5">
                    <div className="text-xs font-semibold text-slate-700">
                      {uiLang === 'ja'
                        ? 'コアイメージと記憶のコツ (Cognitive Hook)'
                        : '核心語感與記憶法 (Cognitive Hook)'}
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {activeVocab.coreImage}
                    </p>
                  </div>

                  {/* Contextual Example Sentence + Shadowing Challenge Trigger */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-500">
                        {uiLang === 'ja'
                          ? 'ネイティブ実用例文 (i+1 インプット)'
                          : '母語者真實語境例句 (i+1 句子輸入)'}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => speakJapanese(activeVocab.exampleJp)}
                          aria-label="朗讀例句"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#0284C7] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{uiLang === 'ja' ? '全文再生' : '朗讀全句'}</span>
                        </button>
                        <button
                          type="button"
                          data-testid="example-shadowing-challenge-btn"
                          onClick={() => setShowShadowingPanel((prev) => !prev)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                            showShadowingPanel
                              ? 'bg-[#0284C7] text-white border-[#0284C7]'
                              : 'bg-white text-[#0284C7] border-sky-300 hover:bg-sky-50'
                          }`}
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>
                            {formatBilingual(
                              showShadowingPanel
                                ? '收起 Shadowing 跟讀挑戰'
                                : '🎙️ Shadowing (跟讀) 挑戰',
                              showShadowingPanel
                                ? 'シャドーイングを閉じる'
                                : '🎙️ シャドーイング挑戦',
                              uiLang
                            )}
                          </span>
                        </button>
                      </div>
                    </div>
                    <div className="text-lg font-medium text-slate-900">
                      <FuriganaText text={activeVocab.exampleJp} showFurigana={showFurigana} />
                    </div>
                    <div className="text-sm text-slate-600">{activeVocab.exampleHk}</div>

                    {/* Interactive SRS Card Shadowing (跟讀) Challenge Studio */}
                    {showShadowingPanel && (
                      <section
                        data-testid="srs-card-shadowing-panel"
                        aria-label="SRS 卡片目標例句 Shadowing 跟讀挑戰"
                        className="mt-3 pt-3 border-t border-sky-200 bg-sky-50/70 rounded-xl p-4 space-y-4"
                      >
                        {/* Top Bar: Title + AI TTS / Web Speech Engine Switcher */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                              <Mic className="w-4 h-4 text-[#0284C7]" />
                              <span>
                                {formatBilingual(
                                  `目標例句 Shadowing (跟讀) 挑戰・核心詞「${activeVocab.kanji}（${activeVocab.pitchAccent}）」`,
                                  `例文シャドーイング挑戦・重要語「${activeVocab.kanji}（${activeVocab.pitchAccent}）」`,
                                  uiLang
                                )}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              {formatBilingual(
                                '① 先聽 AI 真人語音或 Web Speech 示範朗讀 ➔ ② 錄製你嘅跟讀語音 ➔ ③ AI 即時比對發音、流暢度與高低音調並給出評分。',
                                '① お手本音声を再生 ➔ ② シャドーイングを録音 ➔ ③ AIが発音・リズム・アクセントを採点します。',
                                uiLang
                              )}
                            </p>
                          </div>

                          {/* Voice Engine Selector */}
                          <div
                            role="group"
                            aria-label="選擇示範朗讀語音引擎"
                            className="inline-flex items-center bg-white border border-sky-200 rounded-lg p-0.5 text-[11px]"
                          >
                            <button
                              type="button"
                              onClick={() => setShadowingVoiceEngine('ai-tts')}
                              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                                shadowingVoiceEngine === 'ai-tts'
                                  ? 'bg-[#0284C7] text-white'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              🤖 AI 真人語音示範
                            </button>
                            <button
                              type="button"
                              onClick={() => setShadowingVoiceEngine('web-speech')}
                              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                                shadowingVoiceEngine === 'web-speech'
                                  ? 'bg-[#0284C7] text-white'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              🔊 Web Speech 語音
                            </button>
                          </div>
                        </div>

                        {/* Step 1 & Step 2 Action Buttons Row */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Play Normal Speed Model Audio */}
                          <button
                            type="button"
                            data-testid="shadowing-play-model-btn"
                            disabled={isPlayingShadowingModel}
                            onClick={() => handlePlayShadowingModelAudio(false)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#0284C7] bg-white hover:bg-sky-100/70 border border-sky-300 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>
                              {formatBilingual(
                                isPlayingShadowingModel
                                  ? '示範朗讀播放中...'
                                  : '① 聽標準語速示範',
                                isPlayingShadowingModel
                                  ? 'お手本再生中...'
                                  : '① 標準速度でお手本',
                                uiLang
                              )}
                            </span>
                          </button>

                          {/* Play 0.75x Slow Speed Model Audio */}
                          <button
                            type="button"
                            data-testid="shadowing-play-slow-btn"
                            disabled={isPlayingShadowingModel}
                            onClick={() => handlePlayShadowingModelAudio(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                          >
                            <Volume2 className="w-3.5 h-3.5 text-slate-600" />
                            <span>
                              {formatBilingual('0.75x 慢速分解示範', '0.75x ゆっくりお手本', uiLang)}
                            </span>
                          </button>

                          {/* Record User Shadowing Voice Button */}
                          <button
                            type="button"
                            data-testid="shadowing-record-btn"
                            onClick={handleToggleShadowingRecording}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                              isRecordingShadowing
                                ? 'bg-rose-600 text-white animate-pulse'
                                : 'bg-[#0284C7] text-white hover:bg-sky-700'
                            }`}
                          >
                            {isRecordingShadowing ? (
                              <>
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>
                                  {formatBilingual(
                                    '停止錄音並交由 AI 比對評分',
                                    '録音停止・AI採点へ',
                                    uiLang
                                  )}
                                </span>
                              </>
                            ) : (
                              <>
                                <Mic className="w-3.5 h-3.5" />
                                <span>
                                  {formatBilingual(
                                    '② 開始錄音跟讀挑戰',
                                    '② シャドーイング録音開始',
                                    uiLang
                                  )}
                                </span>
                              </>
                            )}
                          </button>

                          {/* Replay User's Recorded Audio (if available) */}
                          {(shadowingAudioUrlMap[activeVocab.id] ||
                            shadowingTranscriptMap[activeVocab.id]) && (
                            <button
                              type="button"
                              data-testid="shadowing-play-user-audio-btn"
                              onClick={() => {
                                const userAudio = shadowingAudioUrlMap[activeVocab.id];
                                if (userAudio) {
                                  const a = new Audio(userAudio);
                                  a.play().catch(() =>
                                    speakJapanese(
                                      shadowingTranscriptMap[activeVocab.id] ||
                                        activeVocab.exampleJp
                                    )
                                  );
                                } else {
                                  speakJapanese(
                                    shadowingTranscriptMap[activeVocab.id] ||
                                      activeVocab.exampleJp
                                  );
                                }
                              }}
                              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>{formatBilingual('重播我嘅跟讀', '自分の音声を再生', uiLang)}</span>
                            </button>
                          )}
                        </div>

                        {/* Captured Speech Transcript Input & Manual AI Compare Trigger */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            data-testid="shadowing-transcript-input"
                            value={shadowingTranscriptMap[activeVocab.id] || ''}
                            onChange={(e) =>
                              setShadowingTranscriptMap((prev) => ({
                                ...prev,
                                [activeVocab.id]: e.target.value,
                              }))
                            }
                            placeholder="錄音辨識結果會顯示喺呢度（亦可直接輸入或微調你讀出嘅日文句子進行 AI 比對）..."
                            className="flex-1 px-3 py-2 text-xs sm:text-sm font-jp bg-white border border-sky-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#0284C7]"
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              data-testid="shadowing-fill-sample-btn"
                              onClick={() => {
                                const cleanSample = activeVocab.exampleJp.replace(
                                  /\[[^\]]+\]/g,
                                  ''
                                );
                                setShadowingTranscriptMap((prev) => ({
                                  ...prev,
                                  [activeVocab.id]: cleanSample,
                                }));
                                handleEvaluateCardShadowing(activeVocab, cleanSample);
                              }}
                              className="px-2.5 py-2 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
                            >
                              {formatBilingual('載入範例自測', 'お手本で試す', uiLang)}
                            </button>
                            <button
                              type="button"
                              data-testid="shadowing-evaluate-btn"
                              disabled={isEvaluatingShadowing}
                              onClick={() =>
                                handleEvaluateCardShadowing(
                                  activeVocab,
                                  shadowingTranscriptMap[activeVocab.id] || '',
                                  shadowingAudioUrlMap[activeVocab.id]
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                            >
                              {isEvaluatingShadowing ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>AI 評分中...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                  <span>{formatBilingual('AI 比對評分', 'AI発音採点', uiLang)}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Step 3: AI Shadowing Assessment Report */}
                        {shadowingAssessmentMap[activeVocab.id] && (() => {
                          const report = shadowingAssessmentMap[activeVocab.id];
                          return (
                            <div
                              data-testid="shadowing-score-report"
                              className="bg-white border border-sky-200 rounded-xl p-4 space-y-3 shadow-2xs"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    data-testid="shadowing-grade-badge"
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                      report.grade === 'S' || report.grade === 'A'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                        : report.grade === 'B'
                                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                                          : 'bg-rose-50 text-rose-800 border-rose-300'
                                    }`}
                                  >
                                    判定ランク：{report.grade}（綜合 {report.overallScore} / 100 分）
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                      report.targetWordHit
                                        ? 'bg-sky-50 text-[#0284C7] border border-sky-200'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}
                                  >
                                    {report.targetWordHit
                                      ? `✓ 核心詞「${activeVocab.kanji}」發音命中`
                                      : `△ 留意核心詞「${activeVocab.kanji}（${activeVocab.reading}）」`}
                                  </span>
                                </div>

                                <span className="text-[11px] font-mono-num text-slate-500">
                                  {report.evaluatedBy === 'ai-sensei'
                                    ? '🤖 Gemini AI 發音導師評鑑'
                                    : '⚡ 即時音節與重音比對引擎'}
                                </span>
                              </div>

                              {/* 3 Sub-Scores: Pronunciation, Fluency, Pitch Accent */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                                {[
                                  {
                                    labelZh: '發音準確度',
                                    labelJa: '発音精度',
                                    score: report.pronunciationScore,
                                  },
                                  {
                                    labelZh: '流暢度與節奏',
                                    labelJa: '流暢さ・リズム',
                                    score: report.fluencyScore,
                                  },
                                  {
                                    labelZh: `音調重音 (${activeVocab.pitchAccent})`,
                                    labelJa: `アクセント (${activeVocab.pitchAccent})`,
                                    score: report.pitchAccentScore,
                                  },
                                ].map((metric, mIdx) => (
                                  <div
                                    key={mIdx}
                                    className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between font-semibold text-slate-700">
                                      <span>
                                        {formatBilingual(
                                          metric.labelZh,
                                          metric.labelJa,
                                          uiLang
                                        )}
                                      </span>
                                      <span className="font-mono-num font-bold text-slate-900">
                                        {metric.score}%
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          metric.score >= 80
                                            ? 'bg-emerald-500'
                                            : metric.score >= 60
                                              ? 'bg-[#0284C7]'
                                              : 'bg-amber-500'
                                        }`}
                                        style={{ width: `${metric.score}%` }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Character-by-Character Pronunciation Diff */}
                              <div className="space-y-1">
                                <div className="text-[11px] font-semibold text-slate-500">
                                  {formatBilingual(
                                    '逐字跟讀吻合度色標（綠＝準確讀出 · 紅＝漏讀或偏差）：',
                                    '文字別マッチング（緑＝一致・赤＝要確認）：',
                                    uiLang
                                  )}
                                </div>
                                <div
                                  data-testid="shadowing-char-diffs"
                                  className="flex flex-wrap items-center gap-1 p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-jp text-sm"
                                >
                                  {report.charDiffs.map((token, tIdx) => (
                                    <span
                                      key={tIdx}
                                      className={`px-1.5 py-0.5 rounded font-bold ${
                                        token.status === 'matched'
                                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                          : 'bg-rose-100 text-rose-900 border border-rose-300 line-through'
                                      }`}
                                    >
                                      {token.char}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* AI Coach Feedback & Pitch Accent Tip */}
                              <div className="text-xs space-y-1.5 bg-sky-50/80 border border-sky-200 rounded-lg p-3 text-slate-800">
                                <div>
                                  <strong className="text-[#0284C7]">AI 導師講評：</strong>
                                  {uiLang === 'ja'
                                    ? report.coachAdviceJa
                                    : report.coachAdviceHk}
                                </div>
                                <div className="text-[11px] text-slate-600">
                                  🎵 {report.pitchAccentTipHk}
                                </div>
                              </div>

                              {/* One-Click Apply Recommended SRS Rating */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <span className="text-[11px] text-slate-500">
                                  AI 建議此卡 SRS 評級：
                                  <strong className="text-slate-800 ml-1 uppercase">
                                    {report.recommendedSrsRating}（
                                    {getSrsPreviewLabel(
                                      activeSrsState,
                                      report.recommendedSrsRating
                                    )}
                                    ）
                                  </strong>
                                </span>
                                <button
                                  type="button"
                                  data-testid="shadowing-apply-srs-btn"
                                  onClick={() => handleSrsAction(report.recommendedSrsRating)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#059669] hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>
                                    {formatBilingual(
                                      `依跟讀表現完成此卡 (${report.recommendedSrsRating.toUpperCase()}) 並進入下一張`,
                                      `採点結果でSRS記録 (${report.recommendedSrsRating.toUpperCase()}) して次へ`,
                                      uiLang
                                    )}
                                  </span>
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </section>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center bg-slate-50 border border-dashed border-slate-300 rounded-lg space-y-3">
                  <p className="text-sm text-slate-600">
                    請先喺腦海回想「{activeVocab.kanji}」嘅讀音、意思同埋點樣造句（主動提取 Active Recall）
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowMeaning(true)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 rounded-lg transition-colors"
                  >
                    揭曉答案並評分
                  </button>
                </div>
              )}

              {/* SRS Card Note & Voice Annotation Panel (文字及語音備註，與卡片數據同步儲存) */}
              {showNotePanel && (
                <section
                  data-testid="srs-card-note-section"
                  aria-label="SRS 卡片個人筆記與語音備註"
                  className="mt-4 bg-amber-50/60 border border-amber-200/90 rounded-xl p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <StickyNote className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        {formatBilingual(
                          `卡片專屬筆記註解（${activeVocab.kanji}）`,
                          `カード個人メモ＆音声ノート（${activeVocab.kanji}）`,
                          uiLang
                        )}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Voice Recognition Language Selector (廣東話 / 日本語) */}
                      <div
                        role="group"
                        aria-label="選擇語音備註語言"
                        className="inline-flex items-center bg-white border border-amber-200 rounded-lg p-0.5 text-[11px]"
                      >
                        <button
                          type="button"
                          onClick={() => setVoiceNoteLang('zh-HK')}
                          className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer ${
                            voiceNoteLang === 'zh-HK'
                              ? 'bg-amber-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          廣東話語音
                        </button>
                        <button
                          type="button"
                          onClick={() => setVoiceNoteLang('ja-JP')}
                          className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer ${
                            voiceNoteLang === 'ja-JP'
                              ? 'bg-amber-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          日本語音声
                        </button>
                      </div>

                      {/* Voice Note / Dictation Button */}
                      <button
                        type="button"
                        data-testid="srs-card-voice-note-btn"
                        onClick={handleToggleCardVoiceNote}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                          isRecordingCardNote
                            ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                            : 'bg-white text-slate-800 border-amber-300 hover:bg-amber-100/60'
                        }`}
                      >
                        {isRecordingCardNote ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span>
                              {formatBilingual('停止錄音並儲存', '録音停止', uiLang)}
                            </span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5 text-rose-600" />
                            <span>
                              {formatBilingual('語音備註錄入', '音声メモ録音', uiLang)}
                            </span>
                          </>
                        )}
                      </button>

                      {/* Play Voice Note Button (shown when voice transcript or note exists) */}
                      {(draftVoiceTranscript || draftVoiceAudioUrl || draftNoteText.trim()) && (
                        <button
                          type="button"
                          data-testid="play-card-voice-note-btn"
                          onClick={handlePlayCardVoiceNote}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#0284C7] bg-white border border-sky-200 rounded-lg hover:bg-sky-50 transition-colors cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{formatBilingual('朗讀備註', 'メモ再生', uiLang)}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Annotation Tag Chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">
                      {formatBilingual('快速標籤：', 'クイックタグ：', uiLang)}
                    </span>
                    {['助詞搭配', '易混淆詞', '廣東話諧音口訣', 'JLPT常考陷阱', '自造例句'].map(
                      (tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleAppendQuickNoteTag(tag)}
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white hover:bg-amber-100/70 text-slate-700 border border-amber-200/80 transition-colors cursor-pointer"
                        >
                          + {tag}
                        </button>
                      )
                    )}
                  </div>

                  {/* Text Note Input Area */}
                  <textarea
                    data-testid="srs-card-note-textarea"
                    rows={3}
                    value={draftNoteText}
                    onChange={(e) => {
                      setDraftNoteText(e.target.value);
                      setNoteSavedToast(false);
                    }}
                    placeholder={
                      uiLang === 'ja'
                        ? `「${activeVocab.kanji}」の覚え方、類義語との違い、自分だけの例文などをメモ（カードデータと一緒に自動保存されます）...`
                        : `喺呢度寫低「${activeVocab.kanji}」嘅個人記憶口訣、助詞搭配、易混淆詞或者點擊右上角「語音備註錄入」直接講嘢筆記（會與此 SRS 卡片數據一併儲存）...`
                    }
                    className="w-full rounded-lg bg-white border border-amber-200 px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />

                  {/* Voice Transcript Preview Box (if recorded via voice note) */}
                  {draftVoiceTranscript && (
                    <div
                      data-testid="srs-card-voice-transcript-box"
                      className="flex items-center justify-between gap-2 bg-white/90 border border-amber-200 rounded-lg px-3 py-2 text-xs text-slate-700"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Mic className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="truncate">
                          <strong className="text-slate-900">語音備註紀錄：</strong>
                          {draftVoiceTranscript}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handlePlayCardVoiceNote}
                        className="text-[#0284C7] font-semibold hover:underline shrink-0 cursor-pointer"
                      >
                        重播語音
                      </button>
                    </div>
                  )}

                  {/* Bottom Action Row: Save Status + Save Button + Clear Button */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                      {noteSavedToast || hasSrsCardNote(activeSrsState) ? (
                        <span
                          data-testid="srs-card-note-saved-status"
                          className="inline-flex items-center gap-1 text-emerald-700 font-semibold"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {formatBilingual(
                              '已與此 SRS 卡片數據一同儲存（支援本地與雲端同步）',
                              'このSRSカードデータと一緒に保存済み',
                              uiLang
                            )}
                          </span>
                        </span>
                      ) : (
                        <span>
                          {formatBilingual(
                            '輸入文字或錄製語音後點擊「儲存卡片筆記」，即會綁定此卡片。',
                            'テキストまたは音声メモを入力して保存してください。',
                            uiLang
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {(draftNoteText.trim() ||
                        draftVoiceTranscript.trim() ||
                        hasSrsCardNote(activeSrsState)) && (
                        <button
                          type="button"
                          data-testid="clear-card-note-btn"
                          onClick={handleClearActiveCardNote}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{formatBilingual('清除備註', 'クリア', uiLang)}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid="save-card-note-btn"
                        onClick={() => handleSaveActiveCardNote()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>
                          {formatBilingual('儲存卡片筆記', 'メモを保存', uiLang)}
                        </span>
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* SM-2 Spaced Repetition Rating Bar */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {uiLang === 'ja'
                    ? '記憶の定着度を選択してください（SM-2 アルゴリズムが次回復習日を計算します）：'
                    : '根據你啱啱回想嘅熟練度揀選，系統會自動計算下次最佳複習時間 (SM-2 SRS)：'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onAskSenseiWithContext(
                      `Sensei，請問「${activeVocab.kanji}（${activeVocab.reading}）」仲有咩常見搭配或者相近詞分別？可以用廣東話再舉兩個生活例子嗎？`,
                      activeVocab
                    )
                  }
                  className="inline-flex items-center gap-1 font-semibold text-[#0284C7] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{uiLang === 'ja' ? 'AI講師に詳しく聞く' : '問 AI 導師深入用法'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSrsAction('again')}
                  className="flex flex-col items-center justify-center py-2.5 px-3 rounded-lg border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-800 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-bold">▲ 唔記得 (Again)</span>
                  <span className="text-[11px] font-mono-num text-red-600 mt-0.5">
                    {getSrsPreviewLabel(activeSrsState, 'again')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSrsAction('hard')}
                  className="flex flex-col items-center justify-center py-2.5 px-3 rounded-lg border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-bold">◆ 有啲kick (Hard)</span>
                  <span className="text-[11px] font-mono-num text-amber-700 mt-0.5">
                    {getSrsPreviewLabel(activeSrsState, 'hard')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSrsAction('good')}
                  className="flex flex-col items-center justify-center py-2.5 px-3 rounded-lg border border-sky-200 bg-sky-50/70 hover:bg-sky-100 text-sky-900 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-bold">● 記得清楚 (Good)</span>
                  <span className="text-[11px] font-mono-num text-sky-700 mt-0.5">
                    {getSrsPreviewLabel(activeSrsState, 'good')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSrsAction('easy')}
                  className="flex flex-col items-center justify-center py-2.5 px-3 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-bold">★ 秒答精熟 (Easy)</span>
                  <span className="text-[11px] font-mono-num text-emerald-700 mt-0.5">
                    {getSrsPreviewLabel(activeSrsState, 'easy')}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Deck: Level Vocabulary Index & Quick Jump (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {selectedLevel} {uiLang === 'ja' ? '必須単語リスト' : '精選詞彙列表'}
              </h3>
              <span className="text-xs text-slate-500 font-mono-num">
                {uiLang === 'ja' ? `全 ${allVocabForLevel.length} 語` : `共 ${allVocabForLevel.length} 個核心詞`}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {allVocabForLevel.map((item, idx) => {
                const st = srsMap[item.id];
                const isSelected = idx === safeCardIndex;
                const cardHasNote = hasSrsCardNote(st);
                return (
                  <div
                    key={item.id}
                    className={`w-full py-2.5 px-3 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                      isSelected ? 'bg-sky-50/90 text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCardIndex(idx);
                        setShowMeaning(true);
                      }}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-slate-900 truncate">
                          {item.kanji}
                        </span>
                        <span className="text-xs text-slate-500 truncate">{item.reading}</span>
                        {cardHasNote && (
                          <span
                            data-testid={`deck-note-badge-${item.id}`}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0"
                          >
                            <StickyNote className="w-2.5 h-2.5 text-amber-600" />
                            <span>筆記</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 truncate mt-0.5">{item.meaning}</div>
                      {cardHasNote && st?.note?.textNote && (
                        <div className="text-[11px] text-amber-800 truncate mt-0.5">
                          📝 {st.note.textNote}
                        </div>
                      )}
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <PitchVisualizerIconButton
                        testId={`srs-deck-pitch-btn-${item.id}`}
                        compact={true}
                        word={{
                          kanji: item.kanji,
                          reading: item.reading,
                          pitchAccent: item.pitchAccent,
                          romaji: item.romaji,
                          partOfSpeech: item.partOfSpeech,
                          meaning: item.meaning,
                        }}
                        uiLang={uiLang}
                        onOpen={setPitchVisualizerWord}
                      />

                      <div className="text-right min-w-[36px]">
                        {st && st.repetitions > 0 ? (
                          <span className="text-xs font-mono-num text-[#059669] font-medium">
                            ● {st.intervalDays}d
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {uiLang === 'ja' ? '未学習' : '未學'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: Grammar Deep Dive */}
      {subMode === 'grammar' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {grammarForLevel.map((g: GrammarPoint) => (
            <div
              key={g.id}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    {g.level} 核心句型 · 接續：{g.formation}
                  </span>
                  <button
                    type="button"
                    onClick={() => speakJapanese(g.exampleJp)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0284C7] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{uiLang === 'ja' ? '例文再生' : '朗讀例句'}</span>
                  </button>
                </div>

                <h3 className="text-2xl font-bold text-slate-900">{g.pattern}</h3>
                <div className="space-y-0.5">
                  <div className="text-base font-semibold text-[#0284C7]">{g.meaning}</div>
                  {g.meaningJa && (
                    <div className="text-xs font-medium text-slate-600 font-jp">
                      意味（日本語）：{g.meaningJa}
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm text-slate-600 pt-1">
                  <p>
                    <strong className="text-slate-800">語感拆解（中文）：</strong>
                    {g.nuance}
                  </p>
                  <p
                    data-testid="stage-grammar-nuance-ja"
                    className="bg-sky-50/70 border border-sky-200/80 rounded-lg p-2.5 text-xs sm:text-sm font-jp text-slate-800 leading-relaxed"
                  >
                    <strong className="text-[#0284C7]">日本語解説（ニュアンス・用法）：</strong>
                    {getGrammarNuanceJa(g)}
                  </p>
                  <p>
                    <strong className="text-slate-800">廣東話母語對比：</strong>
                    {g.cantoneseComparison}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5 mt-3">
                  <div className="text-base font-medium text-slate-900">
                    <FuriganaText text={g.exampleJp} showFurigana={showFurigana} />
                  </div>
                  <div className="text-xs text-slate-600">{g.exampleHk}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">試下用呢個句型造句俾 Sensei 批改</span>
                <button
                  type="button"
                  onClick={() =>
                    onAskSenseiWithContext(
                      `Sensei，我想練習 ${g.level} 文法「${g.pattern}（${g.meaning}）」。請出 1 條情境翻譯題俾我試下造句，並幫我批改！`,
                      g
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>搵 AI 導師對練此文法</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODE 3: Listening Comprehension Dojo (聽解實戰) */}
      {subMode === 'listening' && (
        <div data-testid="listening-section" className="space-y-6">
          {listeningForLevel.map((item) => {
            const selectedAns = listeningAnswerMap[item.id];
            const isAnswered = selectedAns !== undefined;
            const isCorrect = selectedAns === item.correctIndex;
            const scriptVisible = showListeningScript[item.id] ?? true;

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8"
              >
                {/* Left: Audio Controller & Dialogue Transcript */}
                <div className="lg:col-span-7 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-xs font-semibold text-[#0284C7] uppercase tracking-wider">
                        {item.level} {formatBilingual('情境聽解實戰', '聴解トレーニング', uiLang)}
                      </span>
                      <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                        {formatBilingual(item.titleZh, item.titleJa, uiLang, ' ／ ')}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Speed Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          const defaultRate = getJlptListeningSpeechRate(selectedLevel).rate;
                          setAudioSpeed((s) =>
                            Math.abs(s - defaultRate) < 0.02 ? 0.78 : defaultRate
                          );
                        }}
                        className="px-2.5 py-1.5 text-xs font-mono-num font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {audioSpeed.toFixed(2)}x ({selectedLevel}語速)
                      </button>

                      {/* Play Entire Dialogue */}
                      <button
                        type="button"
                        onClick={() => handlePlayFullDialogue(item.dialogueLines)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>
                          {formatBilingual(
                            '播放雙聲道男女對話錄音',
                            '男女別ボイスで会話を再生',
                            uiLang
                          )}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Scenario Setup (Shows both Chinese and Japanese together) */}
                  <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
                    <p>
                      <strong>【中】情境背景：</strong>
                      {item.scenarioZh}
                    </p>
                    <p className="text-xs text-slate-500">
                      <strong>【日】場面設定：</strong>
                      {item.scenarioJa}
                    </p>
                  </div>

                  {/* Script Visibility Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      {formatBilingual(
                        '對話原文與廣東話對照（男女聲分軌・不讀話者標籤）',
                        '会話スクリプト（男女別音声・1文ずつ再生可能）',
                        uiLang
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setShowListeningScript((prev) => ({
                          ...prev,
                          [item.id]: !scriptVisible,
                        }))
                      }
                      className="text-xs font-medium text-[#0284C7] hover:underline cursor-pointer"
                    >
                      {scriptVisible
                        ? formatBilingual('隱藏原文（盲聽挑戰）', 'スクリプトを隠す', uiLang)
                        : formatBilingual('顯示聽解原文', 'スクリプトを表示', uiLang)}
                    </button>
                  </div>

                  {scriptVisible ? (
                    <div className="space-y-3">
                      {item.dialogueLines.map((line, lIdx) => {
                        const voiceRole = detectSpeakerVoiceRole(line.speaker, lIdx);
                        return (
                          <div
                            key={lIdx}
                            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                  voiceRole === 'male'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {voiceRole === 'male' ? '👨 男聲' : '👩 女聲'} · {line.speaker}
                              </span>
                              <div className="text-base font-medium text-slate-900 leading-relaxed">
                                <FuriganaText text={line.textJp} showFurigana={showFurigana} />
                              </div>
                              <div className="text-xs text-slate-500">{line.textHk}</div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                speakJapanese(line.textJp, audioSpeed, voiceRole)
                              }
                              aria-label={`播放 ${line.speaker} 台詞`}
                              className="p-2 rounded-lg text-[#0284C7] hover:bg-sky-100 transition-colors shrink-0 cursor-pointer"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 px-4 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
                      <Headphones className="w-7 h-7 text-[#0284C7] mx-auto" />
                      <p className="text-sm font-medium text-slate-700">
                        盲聽挑戰模式：請先點擊右上角「播放完整聽解錄音」，再回答右方問題！
                      </p>
                    </div>
                  )}
                </div>

                {/* Right: JLPT Listening Comprehension Question */}
                <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Headphones className="w-4 h-4 text-[#0284C7]" />
                        <span>{formatBilingual('JLPT 聽解即時測驗', '聴解チェック問題', uiLang)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => speakJapanese(item.questionJp, audioSpeed)}
                        className="text-xs font-medium text-[#0284C7] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>聽問題 · 問題再生</span>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-900">{item.questionJp}</p>
                      <p className="text-xs text-slate-500">{item.questionHk}</p>
                    </div>

                    <div className="space-y-2">
                      {item.options.map((opt, idx) => {
                        const chosen = selectedAns === idx;
                        const rightOpt = idx === item.correctIndex;
                        let btnStyle =
                          'bg-white border-slate-200 text-slate-800 hover:border-slate-300';
                        if (isAnswered) {
                          if (rightOpt) {
                            btnStyle =
                              'bg-emerald-50 border-emerald-400 text-emerald-950 font-semibold';
                          } else if (chosen) {
                            btnStyle = 'bg-red-50 border-red-300 text-red-900';
                          }
                        }
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              setListeningAnswerMap((prev) => ({ ...prev, [item.id]: idx }))
                            }
                            className={`w-full text-left p-3 rounded-lg border text-xs sm:text-sm transition-colors flex items-start gap-2.5 cursor-pointer ${btnStyle}`}
                          >
                            <span className="font-mono-num font-bold shrink-0">{idx + 1}.</span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {isAnswered && (
                      <div
                        className={`p-3.5 rounded-lg border text-xs leading-relaxed space-y-1 ${
                          isCorrect
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                            : 'bg-amber-50/80 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="font-bold mb-1 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>
                            {isCorrect ? '● 聽解準確！成功捕捉關鍵資訊' : '▲ 注意聽解入面嘅時間與條件轉折'}
                          </span>
                        </div>
                        <p><strong>【中】</strong>{item.explanationZh}</p>
                        <p><strong>【日】</strong>{item.explanationJa}</p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onAskSenseiWithContext(
                        `Sensei，請幫我分析呢段 ${item.level} 聽解對話入面嘅口語縮略或者敬語重點：\n${item.dialogueLines.map((l) => l.textJp).join('\n')}`,
                        item
                      )
                    }
                    className="w-full py-2.5 px-4 text-xs font-semibold text-[#0284C7] bg-white border border-sky-200 hover:bg-sky-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>請 AI 導師拆解聽解口語重點</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODE 4: Speaking & Shadowing Practice (口說跟讀與發音評測) */}
      {subMode === 'speaking' && (
        <div data-testid="speaking-section" className="space-y-6">
          {speakingForLevel.map((prompt) => {
            const userSpoken = speakingInputMap[prompt.id] || '';
            const evalResult = speakingResultMap[prompt.id];
            const isRec = isRecordingId === prompt.id;

            return (
              <div
                key={prompt.id}
                className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8"
              >
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#0284C7]">
                      {prompt.level} · {formatBilingual(prompt.contextTagZh, prompt.contextTagJa, uiLang)}
                    </span>
                    <button
                      type="button"
                      onClick={() => speakJapanese(prompt.targetJp, 0.95)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#0284C7] bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>{formatBilingual('播放示範發音', 'お手本を聴く', uiLang)}</span>
                    </button>
                  </div>

                  <div className="text-sm text-slate-600 space-y-0.5">
                    <p><strong>【中】</strong>{prompt.situationZh}</p>
                    <p className="text-xs text-slate-500"><strong>【日】</strong>{prompt.situationJa}</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2">
                    <div className="text-2xl font-bold text-slate-900 leading-relaxed">
                      <FuriganaText text={prompt.targetJp} showFurigana={showFurigana} />
                    </div>
                    <div className="text-xs font-mono-num text-slate-500">{prompt.romaji}</div>
                    <div className="text-sm text-slate-700 pt-1">{prompt.meaningHk}</div>
                  </div>

                  <div className="bg-sky-50/70 border border-sky-200 rounded-lg p-3.5 text-xs text-sky-950 space-y-1">
                    <div className="font-bold">
                      ★ {formatBilingual('東京標準音調指導 (Pitch Accent)', 'ピッチアクセント指導', uiLang)}：
                    </div>
                    <p><strong>【中】</strong>{prompt.pitchTipZh}</p>
                    <p><strong>【日】</strong>{prompt.pitchTipJa}</p>
                  </div>
                </div>

                {/* Right: Voice Recording / Shadowing Evaluator */}
                <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Mic className="w-4 h-4 text-[#0284C7]" />
                        <span>
                          {uiLang === 'ja' ? 'シャドーイング発音判定' : 'Shadowing 跟讀與口說評分'}
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleStartVoiceRecognition(prompt.id, prompt.targetJp)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer ${
                          isRec ? 'bg-rose-500 animate-pulse' : 'bg-[#0284C7] hover:bg-sky-700'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>
                          {isRec
                            ? uiLang === 'ja'
                              ? '聞き取り中...'
                              : '聆聽中...'
                            : uiLang === 'ja'
                              ? 'マイクで発音テスト'
                              : '語音跟讀測試'}
                        </span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-500">
                      {uiLang === 'ja'
                        ? 'マイクで発音するか、下に日本語を入力して精度を判定できます：'
                        : '可點擊上方「語音跟讀測試」開口朗讀，或喺下方輸入／微調你讀出嘅日文句子即時評分：'}
                    </p>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={userSpoken}
                        onChange={(e) =>
                          setSpeakingInputMap((prev) => ({
                            ...prev,
                            [prompt.id]: e.target.value,
                          }))
                        }
                        placeholder="輸入或語音辨識你嘅日文跟讀內容..."
                        className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0284C7]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSpeakingResultMap((prev) => ({
                            ...prev,
                            [prompt.id]: scoreSpeakingPractice(prompt.targetJp, userSpoken),
                          }))
                        }
                        className="px-3 py-2 text-xs font-semibold text-[#0284C7] bg-white border border-sky-200 hover:bg-sky-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        評分
                      </button>
                    </div>

                    {evalResult && (
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">
                            {uiLang === 'ja' ? '発音一致度スコア' : '口說準確度評分'}
                          </span>
                          <span className="text-lg font-bold font-mono-num text-[#059669]">
                            {evalResult.accuracyPercent}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {uiLang === 'ja' ? evalResult.feedbackJa : evalResult.feedbackZh}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onAskSenseiWithContext(
                        `Sensei，我想喺「${prompt.contextTagZh}」情境下練習口說。除咗「${prompt.targetJp.replace(/\[[^\]]+\]/g, '')}」之外，仲有邊啲更地道嘅講法？`,
                        prompt
                      )
                    }
                    className="w-full py-2.5 px-4 text-xs font-semibold text-[#0284C7] bg-white border border-sky-200 hover:bg-sky-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>同 AI 導師進行情境口說延伸對練</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODE 5: Immersive Reading Comprehension */}
      {subMode === 'reading' && (
        <div className="space-y-6">
          {readingForLevel.map((passage) => {
            const selectedAns = readingAnswerMap[passage.id];
            const isAnswered = selectedAns !== undefined;
            const isCorrect = selectedAns === passage.comprehensionQuestion.correctIndex;

            return (
              <div
                key={passage.id}
                className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8"
              >
                {/* Left: Japanese Article with Furigana & Audio */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-xs text-slate-500">
                      <span>{passage.level} 讀解實戰</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{passage.contextType}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => speakJapanese(passage.contentJp, 0.9)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0284C7] bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>真人語速朗讀全文</span>
                    </button>
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900">{passage.title}</h3>

                  <div className="text-lg leading-loose text-slate-900 bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <FuriganaText text={passage.contentJp} showFurigana={showFurigana} />
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-semibold text-slate-500">
                      廣東話精準對照翻譯與解構
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {passage.translationHk}
                    </p>
                    <p className="text-xs text-[#0284C7] font-medium pt-1">
                      ★ 破題關鍵：{passage.keyTakeaway}
                    </p>
                  </div>
                </div>

                {/* Right: Interactive Comprehension Question */}
                <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <BookOpen className="w-4 h-4 text-[#0284C7]" />
                      <span>JLPT 讀解即時檢測</span>
                    </div>

                    <p className="text-sm font-bold text-slate-900 leading-relaxed">
                      {passage.comprehensionQuestion.question}
                    </p>

                    <div className="space-y-2">
                      {passage.comprehensionQuestion.options.map((opt, idx) => {
                        const chosen = selectedAns === idx;
                        const rightOpt = idx === passage.comprehensionQuestion.correctIndex;

                        let btnStyle = 'bg-white border-slate-200 text-slate-800 hover:border-slate-300';
                        if (isAnswered) {
                          if (rightOpt) {
                            btnStyle = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-semibold';
                          } else if (chosen) {
                            btnStyle = 'bg-red-50 border-red-300 text-red-900';
                          }
                        }

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              setReadingAnswerMap((prev) => ({ ...prev, [passage.id]: idx }))
                            }
                            className={`w-full text-left p-3 rounded-lg border text-xs sm:text-sm transition-colors flex items-start gap-2.5 cursor-pointer ${btnStyle}`}
                          >
                            <span className="font-mono-num font-bold shrink-0">
                              {idx + 1}.
                            </span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {isAnswered && (
                      <div
                        className={`p-3.5 rounded-lg border text-xs leading-relaxed ${
                          isCorrect
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                            : 'bg-amber-50/80 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="font-bold mb-1 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>
                            {isCorrect ? '● 答啱喇！完全掌握文章邏輯' : '▲ 再睇真啲作者個轉折位'}
                          </span>
                        </div>
                        <p>{passage.comprehensionQuestion.explanation}</p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onAskSenseiWithContext(
                        `Sensei，請幫我逐句詳細拆解呢篇 ${passage.level} 文章《${passage.title}》入面嘅助詞同埋長句結構：\n${passage.contentJp}`,
                        passage
                      )
                    }
                    className="w-full py-2.5 px-4 text-xs font-semibold text-[#0284C7] bg-white border border-sky-200 hover:bg-sky-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>請 AI 導師逐句拆解呢篇文章</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODE 6: Web / News / Anime Cultural Study Feeds (時事・動漫精讀 + AI 實時上網搜尋教材) */}
      {subMode === 'cultural' && (
        <div data-testid="cultural-feeds-section" className="space-y-6">
          {/* Live Web / News / Anime Topic Generator Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0284C7]">
                  <Globe className="w-4 h-4" />
                  <span>
                    {uiLang === 'ja'
                      ? 'Google検索連動・最新ニュース＆アニメ教材生成'
                      : 'AI 實時上網搜尋日本新聞・動漫・文化題材'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {uiLang === 'ja'
                    ? '興味のあるアニメや日本の最新ニュースから、あなた専用の精読教材を作成'
                    : '覺得教科書太悶？直接用最新日本新聞、熱播動漫同流行文化做你嘅專屬精讀教材'}
                </h3>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                {(
                  [
                    { id: 'all', zh: '全部題材', ja: 'すべて' },
                    { id: 'anime', zh: '日本動漫', ja: 'アニメ' },
                    { id: 'news', zh: '時事新聞', ja: 'ニュース' },
                    { id: 'culture', zh: '生活文化', ja: '文化・旅行' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFeedFilterCategory(cat.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      feedFilterCategory === cat.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {uiLang === 'ja' ? cat.ja : cat.zh}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Topic Search / Instant Topic Chips */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <select
                value={liveCategory}
                onChange={(e) => setLiveCategory(e.target.value as any)}
                aria-label="選擇教材類別"
                className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="anime">動漫名作・台詞</option>
                <option value="news">日本時事・科技新聞</option>
                <option value="culture">日本旅遊・四季文化</option>
              </select>

              <input
                type="text"
                value={liveTopicInput}
                onChange={(e) => setLiveTopicInput(e.target.value)}
                placeholder={
                  uiLang === 'ja'
                    ? 'テーマを入力（例：呪術廻戦、日本の円安と観光、京都の抹茶文化）...'
                    : '輸入任何你想學嘅動漫或新聞主題（例：葬送的芙莉蓮、日本旅遊退稅新制、東京拉麵文化）...'
                }
                className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
              />

              <button
                type="button"
                onClick={() => handleGenerateLiveFeed()}
                disabled={isGeneratingFeed}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isGeneratingFeed ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>
                  {isGeneratingFeed
                    ? '正從網上整理教材...'
                    : uiLang === 'ja'
                      ? '最新教材をAI生成'
                      : '上網擷取最新題材'}
                </span>
              </button>
            </div>

            {/* One-Click Trending Topics */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">一鍵熱門題材：</span>
              {[
                'アニメ『葬送のフリーレン』の旅と時間表現',
                '日本のインバウンド観光とオーバーツーリズム対策',
                'スタジオジブリ作品の自然描写と日本語',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleGenerateLiveFeed(preset)}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-sky-50 hover:text-[#0284C7] text-slate-600 transition-colors cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>

            {feedStatusNotice && (
              <div
                data-testid="live-feed-status-banner"
                className="px-3.5 py-2 rounded-lg bg-sky-50 border border-sky-200 text-xs font-medium text-sky-900 flex items-center justify-between"
              >
                <span>{feedStatusNotice}</span>
                <button
                  type="button"
                  onClick={() => setFeedStatusNotice(null)}
                  className="text-sky-700 hover:underline ml-3 cursor-pointer"
                >
                  關閉
                </button>
              </div>
            )}
          </div>

          {/* Cultural / News / Anime Feed Cards */}
          <div className="space-y-6">
            {filteredFeeds.map((feed) => (
              <div
                key={feed.id}
                className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8"
              >
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-0.5 rounded-md bg-sky-50 text-[#0284C7] font-bold">
                        {feed.level}
                      </span>
                      <span className="font-semibold text-slate-500">{feed.sourceLabel}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => speakJapanese(feed.contentJp, 0.95)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0284C7] bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{uiLang === 'ja' ? '記事を朗読' : '朗讀文章'}</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {feed.titleJp}
                    </h3>
                    <p className="text-sm font-medium text-slate-500">{feed.titleHk}</p>
                  </div>

                  <div className="text-lg leading-loose text-slate-900 bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <FuriganaText text={feed.contentJp} showFurigana={showFurigana} />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-slate-500">
                      {uiLang === 'ja' ? '中国語（広東語）対訳' : '廣東話／繁體中文精準對譯'}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {feed.translationHk}
                    </p>
                  </div>
                </div>

                {/* Right: Extracted Key Vocab + Grammar Breakdown */}
                <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-slate-800">
                      {uiLang === 'ja'
                        ? '記事内の重要単語（ワンクリックでSRS追加）'
                        : '題材核心詞彙拆解（可一鍵加入 SRS 記憶庫）'}
                    </div>

                    <div className="space-y-2.5">
                      {feed.keyVocab.map((kv, idx) => {
                        const keyId = `${feed.id}-v-${idx}`;
                        const isSaved = savedFeedWordIds[keyId];
                        return (
                          <div
                            key={keyId}
                            className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">
                                  {kv.kanji}
                                </span>
                                <span className="text-xs text-[#0284C7]">{kv.reading}</span>
                              </div>
                              <div className="text-xs text-slate-600 mt-0.5">{kv.meaning}</div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => speakJapanese(kv.kanji)}
                                className="p-1.5 text-slate-500 hover:text-[#0284C7] cursor-pointer"
                                title="發音"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                              {onSaveCustomVocab && (
                                <button
                                  type="button"
                                  disabled={isSaved}
                                  onClick={() => {
                                    setSavedFeedWordIds((prev) => ({ ...prev, [keyId]: true }));
                                    onSaveCustomVocab([
                                      {
                                        id: `feed-srs-${Date.now()}-${idx}`,
                                        level: feed.level,
                                        kanji: kv.kanji,
                                        reading: kv.reading,
                                        romaji: kv.reading,
                                        partOfSpeech: '時事・動漫詞彙',
                                        pitchAccent: '⓪',
                                        meaning: kv.meaning,
                                        coreImage: `出自《${feed.titleHk}》`,
                                        exampleJp: feed.contentJp,
                                        exampleHk: feed.translationHk,
                                      },
                                    ]);
                                  }}
                                  className={`px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                                    isSaved
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-sky-50 text-[#0284C7] hover:bg-sky-100'
                                  }`}
                                >
                                  <PlusCircle className="w-3 h-3" />
                                  <span>{isSaved ? '已加卡' : '加記憶卡'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Grammar Point Box */}
                    <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-1">
                      <div className="text-xs font-bold text-[#0284C7]">
                        ★ 核心句型：{feed.grammarPoint.pattern}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {feed.grammarPoint.explanation}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onAskSenseiWithContext(
                        `Sensei，我睇緊呢篇動漫／時事教材《${feed.titleJp}》，請幫我深入講解入面嘅文化背景同埋出 1 條閱讀理解題考下我！\n${feed.contentJp}`,
                        feed
                      )
                    }
                    className="w-full py-2.5 px-4 text-xs font-semibold text-[#0284C7] bg-white border border-sky-200 hover:bg-sky-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>請 AI 導師根據此題材出題與對談</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODE 7: Dynamic Nuance Scene Analyzer & Sigure-style Reference Atlas */}
      {subMode === 'nuance' && (
        <NuanceAnalyzerMode
          selectedLevel={selectedLevel}
          showFurigana={showFurigana}
          uiLang={uiLang}
          onAskSenseiWithContext={onAskSenseiWithContext}
        />
      )}

      {/* Interactive Pitch Accent Visualization Modal */}
      <PitchAccentModal
        word={pitchVisualizerWord}
        uiLang={uiLang}
        onClose={() => setPitchVisualizerWord(null)}
      />
    </div>
  );
};
