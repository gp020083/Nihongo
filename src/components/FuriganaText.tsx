import React from 'react';
import {
  parseFurigana,
  JlptLevel,
  SpeakerVoiceRole,
  DialogueSpeechTurn,
  getJlptListeningSpeechRate,
  cleanSpokenJapaneseLine,
  parseDialogueIntoSpeakerTurns,
  VoiceEmotionTone,
  VOICE_EMOTION_PRESETS,
  shapeJapaneseProsodyForEmotion,
} from '../utils/srsEngine';

export { VOICE_EMOTION_PRESETS };
export type { VoiceEmotionTone };

interface FuriganaTextProps {
  text: string;
  showFurigana?: boolean;
  className?: string;
}

export const FuriganaText: React.FC<FuriganaTextProps> = ({
  text,
  showFurigana = true,
  className = '',
}) => {
  const segments = parseFurigana(text);

  return (
    <span className={`leading-relaxed ${className}`}>
      {segments.map((seg, index) => {
        if (seg.reading && showFurigana) {
          return (
            <ruby key={index} className="mx-0.5">
              {seg.text}
              <rt>{seg.reading}</rt>
            </ruby>
          );
        }
        return <React.Fragment key={index}>{seg.text}</React.Fragment>;
      })}
    </span>
  );
};

export type GlobalVoiceStyle =
  | 'nhk-anchor'
  | 'nhk-female'
  | 'nhk-male'
  | 'cloud-stream'
  | 'neural-female'
  | 'neural-male'
  | 'anime-vivid'
  | 'system-natural';

export interface GlobalVoiceConfig {
  voiceStyle: GlobalVoiceStyle;
  speedMultiplier: number; // 0.7 - 1.8 (default 1.0 native lossless cadence)
  preferredSystemVoiceName: string;
  emotionTone: VoiceEmotionTone;
}

export const VOICE_STYLE_OPTIONS: Array<{
  id: GlobalVoiceStyle;
  labelZh: string;
  labelJa: string;
  badge: string;
}> = [
  {
    id: 'nhk-anchor',
    labelZh: '📻 NHK 新聞雙主播標準音 (真人男主播 ＋ NHK 女主播雙聲道 · 推薦)',
    labelJa: '📻 NHK男女ペアアナウンサー (男性アナ＋NHK女性アナ標準音)',
    badge: 'NHK 男女雙主播',
  },
  {
    id: 'nhk-female',
    labelZh: '🎙️ 東京標準新聞女主播 (清澈明快東京女聲 · 字正腔圓)',
    labelJa: '🎙️ 東京標準女性アナウンサー (明瞭で聞き取りやすい女性声)',
    badge: '東京標準女聲',
  },
  {
    id: 'nhk-male',
    labelZh: '🎙️ 真人深沉新聞男主播 (低沉磁性真人男聲 · 穩重男中音)',
    labelJa: '🎙️ 本格派男性アナウンサー (落ち着いた深みのある男性低音)',
    badge: '真人深沉男聲',
  },
  {
    id: 'cloud-stream',
    labelZh: '⚡ NHK 廣播直出女聲 (廣播級流暢女主播 · 秒開零卡頓)',
    labelJa: '⚡ NHK放送ストリーム女性音声 (遅延なし・最も滑らか)',
    badge: 'NHK 廣播直出',
  },
  {
    id: 'neural-female',
    labelZh: '🌸 東京溫柔日常女聲 (柔和親切女聲 · 日常生活會話腔)',
    labelJa: '🌸 東京やさしい日常女性音声 (穏やかで自然な会話調)',
    badge: '東京溫柔女聲',
  },
  {
    id: 'neural-male',
    labelZh: '✨ 動漫元氣聲優腔 (抑揚頓挫鮮明聲優音 · 語感強化)',
    labelJa: '✨ アニメ声優風表現ボイス (抑揚がはっきりした元気な声)',
    badge: '動漫元氣聲優',
  },
  {
    id: 'system-natural',
    labelZh: '🔊 本機系統原生語音 (原音 1.0 Pitch 零變調無損直出)',
    labelJa: '🔊 端末システムネイティブ音声 (ピッチ無加工・高速)',
    badge: '本機無損原音',
  },
];

const VOICE_CONFIG_STORAGE_KEY = 'kotonoha_voice_config_v2';

let currentVoiceConfig: GlobalVoiceConfig = (() => {
  const fallback: GlobalVoiceConfig = {
    voiceStyle: 'nhk-anchor',
    speedMultiplier: 1.0,
    preferredSystemVoiceName: '',
    emotionTone: 'neutral',
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(VOICE_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          voiceStyle: parsed.voiceStyle || 'nhk-anchor',
          speedMultiplier:
            typeof parsed.speedMultiplier === 'number'
              ? Math.max(0.7, Math.min(1.8, parsed.speedMultiplier))
              : 1.0,
          preferredSystemVoiceName: parsed.preferredSystemVoiceName || '',
          emotionTone: parsed.emotionTone || 'neutral',
        };
      }
    }
  } catch {
    // ignore
  }
  return fallback;
})();

const voiceConfigListeners = new Set<(cfg: GlobalVoiceConfig) => void>();

export function getGlobalVoiceConfig(): GlobalVoiceConfig {
  return currentVoiceConfig;
}

export function setGlobalVoiceConfig(patch: Partial<GlobalVoiceConfig>): GlobalVoiceConfig {
  currentVoiceConfig = {
    ...currentVoiceConfig,
    ...patch,
    speedMultiplier:
      typeof patch.speedMultiplier === 'number'
        ? Number(Math.max(0.7, Math.min(1.8, patch.speedMultiplier)).toFixed(2))
        : currentVoiceConfig.speedMultiplier,
    emotionTone: patch.emotionTone || currentVoiceConfig.emotionTone || 'neutral',
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(VOICE_CONFIG_STORAGE_KEY, JSON.stringify(currentVoiceConfig));
    } catch {
      // ignore
    }
  }
  voiceConfigListeners.forEach((fn) => fn(currentVoiceConfig));
  return currentVoiceConfig;
}

export function subscribeGlobalVoiceConfig(
  listener: (cfg: GlobalVoiceConfig) => void
): () => void {
  voiceConfigListeners.add(listener);
  return () => {
    voiceConfigListeners.delete(listener);
  };
}

/**
 * Returns available Japanese voices from the browser's Web Speech API so the user
 * can also inspect or pick a specific native OS voice (e.g. Google 日本語, Kyoko, Otoya, Microsoft Nanami).
 */
export function getAvailableSystemJapaneseVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  try {
    const voices = window.speechSynthesis.getVoices();
    return voices.filter(
      (v) => v.lang.toLowerCase().includes('ja') || v.lang.toLowerCase().includes('jp')
    );
  } catch {
    return [];
  }
}

let activeAudioElement: HTMLAudioElement | null = null;
let activeDialogueSessionId = 0;
const serverTtsCache = new Map<string, string>();
const singleSpeechTtsCache = new Map<string, string>();

/**
 * Stops any ongoing Japanese speech (both HTMLAudioElement and Web Speech Synthesis).
 */
export function stopJapaneseSpeech() {
  activeDialogueSessionId += 1;
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudioElement = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

/**
 * Selects the smoothest available Japanese voice for the given speaker role ('male' | 'female' | 'narrator').
 * Avoids extreme pitch distortion (which causes robotic vocoder choppiness in browsers) and keeps
 * pitch within the natural 0.92 - 1.06 acoustic sweet spot.
 */
function selectJapaneseVoiceAndPitch(
  voices: SpeechSynthesisVoice[],
  role: SpeakerVoiceRole,
  voiceStyle: GlobalVoiceStyle = currentVoiceConfig.voiceStyle
): { voice: SpeechSynthesisVoice | null; pitch: number } {
  const jpVoices = voices.filter(
    (v) => v.lang.toLowerCase().includes('ja') || v.lang.toLowerCase().includes('jp')
  );

  const effectiveRole: SpeakerVoiceRole =
    role !== 'narrator'
      ? role
      : voiceStyle === 'nhk-male' || voiceStyle === 'neural-male'
        ? 'male'
        : voiceStyle === 'nhk-female' || voiceStyle === 'neural-female'
          ? 'female'
          : 'narrator';

  // Smooth, non-distorting pitch values so Web Speech never stutters ("卡卡地")
  const smoothMalePitch = 0.92;
  const smoothFemalePitch = 1.05;
  const smoothAnchorPitch = 1.0;

  if (jpVoices.length === 0) {
    const fallbackPitch =
      effectiveRole === 'male'
        ? smoothMalePitch
        : effectiveRole === 'female'
          ? smoothFemalePitch
          : smoothAnchorPitch;
    return { voice: null, pitch: fallbackPitch };
  }

  // If user explicitly picked a preferred system voice
  if (
    currentVoiceConfig.preferredSystemVoiceName &&
    jpVoices.some((v) => v.name === currentVoiceConfig.preferredSystemVoiceName)
  ) {
    const chosen = jpVoices.find((v) => v.name === currentVoiceConfig.preferredSystemVoiceName)!;
    return {
      voice: chosen,
      pitch:
        effectiveRole === 'male'
          ? smoothMalePitch
          : effectiveRole === 'female'
            ? smoothFemalePitch
            : smoothAnchorPitch,
    };
  }

  const scoreVoiceNaturalness = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    let score = 0;
    if (name.includes('natural') || name.includes('neural') || name.includes('online')) score += 45;
    if (name.includes('google') || name.includes('siri') || name.includes('premium')) score += 30;
    if (!v.localService) score += 12;
    return score;
  };

  const ranked = [...jpVoices].sort(
    (a, b) => scoreVoiceNaturalness(b) - scoreVoiceNaturalness(a)
  );

  const maleVoiceRegex = /(otoya|ichiro|keita|hattori|takumi|daichi|naoki|male|男)/i;
  const femaleVoiceRegex = /(kyoko|nanami|haruka|ayumi|o-ren|oren|mayu|shiori|female|女)/i;

  if (effectiveRole === 'male') {
    const explicitMale = ranked.find((v) => maleVoiceRegex.test(v.name));
    if (explicitMale) {
      return { voice: explicitMale, pitch: 0.96 };
    }
    const nonFemale = ranked.find((v) => !femaleVoiceRegex.test(v.name)) || ranked[0];
    return { voice: nonFemale, pitch: smoothMalePitch };
  }

  if (effectiveRole === 'female') {
    const explicitFemale = ranked.find((v) => femaleVoiceRegex.test(v.name));
    if (explicitFemale) {
      return { voice: explicitFemale, pitch: 1.02 };
    }
    const altVoice = ranked.length > 1 ? ranked[ranked.length - 1] : ranked[0];
    return { voice: altVoice, pitch: smoothFemalePitch };
  }

  return { voice: ranked[0], pitch: smoothAnchorPitch };
}

/**
 * Applies smooth playbackRate to an HTMLAudioElement without triggering Chromium's
 * choppy WSOLA 20ms grain time-stretcher when playing near 1.0x.
 */
function applySmoothAudioPlaybackRate(audio: HTMLAudioElement, targetRate: number) {
  const clamped = Math.max(0.68, Math.min(1.75, targetRate));
  // If within 8% of 1.0x, play at native 1.0x lossless rate so WSOLA time-stretching is completely bypassed
  if (Math.abs(clamped - 1.0) <= 0.08) {
    audio.playbackRate = 1.0;
    return;
  }
  // For modest speed adjustments (0.85x - 1.25x), disabling preservesPitch uses clean sample-rate
  // interpolation instead of choppy WSOLA grain slicing!
  if (clamped >= 0.84 && clamped <= 1.26) {
    try {
      (audio as any).preservesPitch = false;
      (audio as any).mozPreservesPitch = false;
      (audio as any).webkitPreservesPitch = false;
    } catch {
      // ignore
    }
  }
  audio.playbackRate = clamped;
}

function speakWithWebSpeechFallback(
  cleanText: string,
  effectiveRate: number,
  effectiveRole: SpeakerVoiceRole
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ja-JP';
    utterance.rate = Math.max(0.7, Math.min(1.65, effectiveRate));

    const voices = window.speechSynthesis.getVoices();
    const { voice, pitch } = selectJapaneseVoiceAndPitch(
      voices,
      effectiveRole,
      currentVoiceConfig.voiceStyle
    );
    if (voice) {
      utterance.voice = voice;
    }
    utterance.pitch = pitch;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis errors on headless browsers without audio devices
  }
}

/**
 * Speaks a single Japanese line or automatically delegates multi-speaker scripts
 * so speaker labels like "男：" and "女：" are NEVER read aloud.
 * Uses smooth NHK / Cloud Stream / Tokyo Neural voices without WSOLA choppiness.
 */
export async function speakJapanese(
  text: string,
  rate: number = 1.0,
  role: SpeakerVoiceRole = 'narrator',
  emotionOverride?: VoiceEmotionTone,
  includeExpressiveCue: boolean = false
): Promise<void> {
  if (typeof window === 'undefined') return;

  const activeEmotion = emotionOverride || currentVoiceConfig.emotionTone || 'neutral';
  const turns = parseDialogueIntoSpeakerTurns(text);
  if (turns.length > 1) {
    await speakJapaneseDialogue({
      audioScriptJp: text,
      rateOverride: Number((rate * currentVoiceConfig.speedMultiplier).toFixed(2)),
      preferNaturalServerTts: currentVoiceConfig.voiceStyle !== 'system-natural',
    });
    return;
  }

  stopJapaneseSpeech();
  const sessionId = activeDialogueSessionId;
  const rawCleanText = cleanSpokenJapaneseLine(text);
  if (!rawCleanText) return;

  const shaped = shapeJapaneseProsodyForEmotion(
    rawCleanText,
    activeEmotion,
    includeExpressiveCue
  );
  const cleanText = shaped.shapedTextJp;

  const effectiveRole: SpeakerVoiceRole = turns.length === 1 ? turns[0].role : role;
  const effectiveRate = Number(
    Math.max(
      0.68,
      Math.min(1.75, rate * currentVoiceConfig.speedMultiplier * shaped.speedFactor)
    ).toFixed(2)
  );

  if (currentVoiceConfig.voiceStyle !== 'system-natural') {
    const cacheKey = `${currentVoiceConfig.voiceStyle}::${activeEmotion}::${effectiveRole}::${cleanText}`;
    let audioDataUrl = singleSpeechTtsCache.get(cacheKey);

    if (!audioDataUrl) {
      try {
        const res = await fetch('/api/ai/tts-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            textJp: cleanText,
            role: effectiveRole,
            voiceStyle: currentVoiceConfig.voiceStyle,
            emotionTone: activeEmotion,
            speedRate: effectiveRate,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.audioDataUrl) {
            audioDataUrl = data.audioDataUrl;
            singleSpeechTtsCache.set(cacheKey, audioDataUrl!);
          }
        }
      } catch {
        // Fallback to Web Speech below
      }
    }

    if (sessionId !== activeDialogueSessionId) return;

    if (audioDataUrl) {
      try {
        const audio = new Audio(audioDataUrl);
        activeAudioElement = audio;
        applySmoothAudioPlaybackRate(audio, effectiveRate);
        audio.onended = () => {
          if (sessionId === activeDialogueSessionId) {
            activeAudioElement = null;
          }
        };
        audio.onerror = () => {
          activeAudioElement = null;
          speakWithWebSpeechFallback(cleanText, effectiveRate, effectiveRole);
        };
        await audio.play();
        return;
      } catch {
        activeAudioElement = null;
      }
    }
  }

  speakWithWebSpeechFallback(cleanText, effectiveRate, effectiveRole);
}

export interface SpeakDialogueOptions {
  audioScriptJp?: string;
  dialogueSpeakers?: Array<{ speaker: string; lineJp?: string; textJp?: string }>;
  level?: JlptLevel;
  rateOverride?: number;
  preferNaturalServerTts?: boolean;
  onStart?: (info: { engineLabel: string; rate: number; turns: DialogueSpeechTurn[] }) => void;
  onTurnChange?: (turnIndex: number, turn: DialogueSpeechTurn) => void;
  onEnd?: () => void;
}

/**
 * Plays a multi-speaker JLPT listening dialogue using smooth NHK / Cloud Neural voices:
 * 1) Never reads speaker labels ("男：", "女：", etc.) aloud
 * 2) Adjusts speech speed cleanly without WSOLA choppiness
 * 3) Synthesizes distinct Male (Charon/Puck) and Female (Kore/Zephyr) broadcast voices
 */
export async function speakJapaneseDialogue(options: SpeakDialogueOptions): Promise<void> {
  if (typeof window === 'undefined') return;

  stopJapaneseSpeech();
  const sessionId = activeDialogueSessionId;

  const levelRateConfig = getJlptListeningSpeechRate(options.level || 'N4');
  const baseRate = Number(
    (levelRateConfig.rate * currentVoiceConfig.speedMultiplier).toFixed(2)
  );
  const effectiveRate =
    typeof options.rateOverride === 'number' ? options.rateOverride : baseRate;

  const turns = parseDialogueIntoSpeakerTurns(
    options.audioScriptJp,
    options.dialogueSpeakers
  );
  if (turns.length === 0) {
    options.onEnd?.();
    return;
  }

  const useServerNeural =
    options.preferNaturalServerTts !== false &&
    currentVoiceConfig.voiceStyle !== 'system-natural';

  if (useServerNeural) {
    const cacheKey = `${options.level || 'N4'}::${currentVoiceConfig.voiceStyle}::${turns
      .map((t) => `${t.role}:${t.spokenTextJp}`)
      .join('|')}`;
    let audioDataUrl = serverTtsCache.get(cacheKey);

    if (!audioDataUrl) {
      try {
        const res = await fetch('/api/ai/tts-dialogue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: options.level || 'N4',
            voiceStyle: currentVoiceConfig.voiceStyle,
            turns: turns.map((t) => ({
              speaker: t.speaker,
              role: t.role,
              spokenTextJp: t.spokenTextJp,
            })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.audioDataUrl) {
            audioDataUrl = data.audioDataUrl;
            serverTtsCache.set(cacheKey, audioDataUrl!);
          }
        }
      } catch {
        // Fallback to multi-voice Web Speech below
      }
    }

    if (sessionId !== activeDialogueSessionId) return;

    if (audioDataUrl) {
      try {
        const audio = new Audio(audioDataUrl);
        activeAudioElement = audio;
        applySmoothAudioPlaybackRate(audio, effectiveRate);
        const styleMeta =
          VOICE_STYLE_OPTIONS.find((o) => o.id === currentVoiceConfig.voiceStyle) ||
          VOICE_STYLE_OPTIONS[0];
        options.onStart?.({
          engineLabel: `NHK・雲端流暢雙聲道 (${styleMeta.badge} · ${effectiveRate}x)`,
          rate: effectiveRate,
          turns,
        });
        if (turns[0]) {
          options.onTurnChange?.(0, turns[0]);
        }
        audio.onended = () => {
          if (sessionId === activeDialogueSessionId) {
            activeAudioElement = null;
            options.onEnd?.();
          }
        };
        audio.onerror = () => {
          activeAudioElement = null;
          runWebSpeechMultiVoiceSequence(sessionId, turns, effectiveRate, options);
        };
        await audio.play();
        return;
      } catch {
        activeAudioElement = null;
      }
    }
  }

  runWebSpeechMultiVoiceSequence(sessionId, turns, effectiveRate, options);
}

function runWebSpeechMultiVoiceSequence(
  sessionId: number,
  turns: DialogueSpeechTurn[],
  effectiveRate: number,
  options: SpeakDialogueOptions
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onEnd?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();

    options.onStart?.({
      engineLabel: `本機無損雙聲道語音 (${effectiveRate}x)`,
      rate: effectiveRate,
      turns,
    });

    let currentIdx = 0;

    const speakNextTurn = () => {
      if (sessionId !== activeDialogueSessionId) return;
      if (currentIdx >= turns.length) {
        options.onEnd?.();
        return;
      }

      const turn = turns[currentIdx];
      options.onTurnChange?.(currentIdx, turn);

      const utterance = new SpeechSynthesisUtterance(turn.spokenTextJp);
      utterance.lang = 'ja-JP';
      utterance.rate = Math.max(0.7, Math.min(1.65, Number(effectiveRate.toFixed(2))));

      const { voice, pitch } = selectJapaneseVoiceAndPitch(
        voices,
        turn.role,
        currentVoiceConfig.voiceStyle
      );
      if (voice) {
        utterance.voice = voice;
      }
      utterance.pitch = pitch;

      utterance.onend = () => {
        if (sessionId !== activeDialogueSessionId) return;
        currentIdx += 1;
        if (currentIdx < turns.length) {
          window.setTimeout(speakNextTurn, 160);
        } else {
          options.onEnd?.();
        }
      };

      utterance.onerror = () => {
        if (sessionId !== activeDialogueSessionId) return;
        currentIdx += 1;
        if (currentIdx < turns.length) {
          window.setTimeout(speakNextTurn, 100);
        } else {
          options.onEnd?.();
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextTurn();
  } catch {
    options.onEnd?.();
  }
}
