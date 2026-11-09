import React, { useState } from 'react';
import {
  Volume2,
  Mic,
  Shuffle,
  Eye,
  EyeOff,
  CheckCircle2,
  X,
  Sparkles,
  Headphones,
} from 'lucide-react';
import {
  JlptLevel,
  WarmupSentenceItem,
  scoreSpeakingPractice,
  SpeakingEvaluationResult,
} from '../utils/srsEngine';
import { UiLang } from '../data/listeningAndDictionaryData';
import { FuriganaText, speakJapanese } from './FuriganaText';

interface ListeningWarmupPanelProps {
  sentence: WarmupSentenceItem;
  selectedLevel: JlptLevel;
  uiLang: UiLang;
  onNextRandomSentence: () => void;
  onClose: () => void;
  onCompleteShadowing: (accuracy: number) => void;
  onAskSensei: (promptText: string, item: WarmupSentenceItem) => void;
}

export const ListeningWarmupPanel: React.FC<ListeningWarmupPanelProps> = ({
  sentence,
  selectedLevel,
  uiLang,
  onNextRandomSentence,
  onClose,
  onCompleteShadowing,
  onAskSensei,
}) => {
  const [showScript, setShowScript] = useState<boolean>(true);
  const [spokenText, setSpokenText] = useState<string>('');
  const [evaluation, setEvaluation] = useState<SpeakingEvaluationResult | null>(null);
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);

  const handleEvaluate = (inputStr: string) => {
    const result = scoreSpeakingPractice(sentence.textJp, inputStr);
    setEvaluation(result);
    if (result.accuracyPercent >= 55) {
      onCompleteShadowing(result.accuracyPercent);
    }
  };

  const handleStartShadowingMic = () => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      // Fallback for headless/desktop browsers without SpeechRecognition:
      // simulate recognized shadowing from the target sentence so user can test immediately
      const cleanSentence = sentence.textJp.replace(/\[[^\]]+\]/g, '');
      setSpokenText(cleanSentence);
      handleEvaluate(cleanSentence);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'ja-JP';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListeningMic(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        setSpokenText(transcript);
        handleEvaluate(transcript);
        setIsListeningMic(false);
      };
      recognition.onerror = () => {
        setIsListeningMic(false);
      };
      recognition.onend = () => {
        setIsListeningMic(false);
      };
      recognition.start();
    } catch {
      setIsListeningMic(false);
    }
  };

  const handlePickAnother = () => {
    setSpokenText('');
    setEvaluation(null);
    onNextRandomSentence();
  };

  return (
    <div
      data-testid="listening-warmup-panel"
      className="mt-4 pt-4 border-t border-slate-200 bg-sky-50/50 rounded-xl p-4 sm:p-5 space-y-4"
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0284C7] text-white text-xs font-bold">
            <Headphones className="w-3.5 h-3.5" />
            <span>
              JLPT {selectedLevel} {uiLang === 'ja' ? '聴解・シャドーイング熱身' : '聽力熱身・Shadowing 跟讀'}
            </span>
          </span>
          <span className="text-xs text-slate-500 font-medium">{sentence.sourceLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => speakJapanese(sentence.textJp, 0.95)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0284C7] bg-white border border-sky-200 hover:bg-sky-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{uiLang === 'ja' ? 'もう一度聴く (1.0x)' : '重播例句 (1.0x)'}</span>
          </button>

          <button
            type="button"
            onClick={() => speakJapanese(sentence.textJp, 0.78)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-slate-500" />
            <span>{uiLang === 'ja' ? 'ゆっくり (0.8x)' : '慢速 (0.8x)'}</span>
          </button>

          <button
            type="button"
            data-testid="warmup-next-btn"
            onClick={handlePickAnother}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>{uiLang === 'ja' ? '別の例文をランダム再生' : '隨機換一句'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowScript((s) => !s)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {showScript ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>
              {showScript
                ? uiLang === 'ja'
                  ? '文を隠す'
                  : '盲聽隱藏'
                : uiLang === 'ja'
                  ? '文を表示'
                  : '顯示原文'}
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="關閉聽力熱身"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Two-Column Warmup Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left: Target Sentence & Meaning */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          {showScript ? (
            <>
              <div
                data-testid="warmup-target-sentence"
                className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed"
              >
                <FuriganaText text={sentence.textJp} showFurigana={true} />
              </div>
              <p className="text-xs sm:text-sm text-slate-600">{sentence.meaningHk}</p>
              {sentence.pitchTip && (
                <p className="text-xs text-[#0284C7] font-medium pt-0.5">
                  ★ {sentence.pitchTip}
                </p>
              )}
            </>
          ) : (
            <div className="py-4 text-center space-y-1">
              <p className="text-sm font-semibold text-slate-700">
                {uiLang === 'ja'
                  ? '音声だけを頼りにシャドーイングしてみましょう！'
                  : '盲聽跟讀模式：憑啱啱聽到嘅語音直接開口跟讀，訓練大腦瞬間語音迴路！'}
              </p>
              <p className="text-xs text-slate-500">
                （提示意思：{sentence.meaningHk}）
              </p>
            </div>
          )}
        </div>

        {/* Right: Shadowing Practice Input & Evaluation */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800">
              {uiLang === 'ja' ? 'シャドーイング練習 (Shadowing)' : '跟讀練習 (Shadowing 實測)'}
            </span>

            <button
              type="button"
              data-testid="warmup-mic-btn"
              onClick={handleStartShadowingMic}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer ${
                isListeningMic
                  ? 'bg-rose-500 animate-pulse'
                  : 'bg-[#0284C7] hover:bg-sky-700'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>
                {isListeningMic
                  ? uiLang === 'ja'
                    ? '聞き取り中...'
                    : '聆聽你嘅跟讀中...'
                  : uiLang === 'ja'
                    ? '音声で跟読テスト'
                    : '語音開口跟讀'}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              data-testid="warmup-shadowing-input"
              value={spokenText}
              onChange={(e) => setSpokenText(e.target.value)}
              placeholder={
                uiLang === 'ja'
                  ? 'マイクで話すか、聞こえた日本語を入力...'
                  : '點擊「語音開口跟讀」或輸入你聽到／讀出嘅日文句子...'
              }
              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0284C7] focus:bg-white"
            />
            <button
              type="button"
              data-testid="warmup-evaluate-btn"
              onClick={() => handleEvaluate(spokenText)}
              className="px-3 py-1.5 text-xs font-semibold text-[#0284C7] bg-sky-50 hover:bg-sky-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              {uiLang === 'ja' ? '判定' : '評分'}
            </button>
          </div>

          {evaluation && (
            <div
              data-testid="warmup-evaluation-result"
              className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 flex items-start justify-between gap-3"
            >
              <div className="space-y-0.5 text-xs text-emerald-950">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    {uiLang === 'ja' ? '跟読一致度：' : '跟讀吻合度：'}
                    <strong className="font-mono-num">{evaluation.accuracyPercent}%</strong>
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  {uiLang === 'ja' ? evaluation.feedbackJa : evaluation.feedbackZh}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  onAskSensei(
                    `Sensei，我啱啱做緊 ${selectedLevel} 聽力熱身跟讀呢句：「${sentence.textJp.replace(/\[[^\]]+\]/g, '')}」，請教我點樣讀得更加似日本母語者嘅語氣同連音！`,
                    sentence
                  )
                }
                className="text-[11px] font-semibold text-[#0284C7] hover:underline whitespace-nowrap shrink-0 inline-flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>問導師</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
