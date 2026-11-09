import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  PlusCircle,
  Play,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Video,
} from 'lucide-react';
import { JlptLevel } from '../utils/srsEngine';
import { SAMPLE_MATERIALS, VocabItem, QuizQuestion } from '../data/jlptCurriculum';
import { speakJapanese } from './FuriganaText';

interface MaterialStudioProps {
  selectedLevel: JlptLevel;
  onSelectLevel: (level: JlptLevel) => void;
  onSaveExtractedVocab: (items: VocabItem[]) => void;
  onStartGeneratedQuiz: (questions: QuizQuestion[]) => void;
  onAskSenseiWithContext: (promptText: string, item?: any, attachment?: { mimeType: string; data: string; name: string }) => void;
}

export const MaterialStudio: React.FC<MaterialStudioProps> = ({
  selectedLevel,
  onSelectLevel,
  onSaveExtractedVocab,
  onStartGeneratedQuiz,
  onAskSenseiWithContext,
}) => {
  const [inputText, setInputText] = useState(SAMPLE_MATERIALS[0].content);
  const [questionCount, setQuestionCount] = useState(4);
  const [attachment, setAttachment] = useState<{
    name: string;
    mimeType: string;
    data: string;
    previewUrl?: string;
    isVideo?: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedVocabNotice, setSavedVocabNotice] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>({
    title: '京都夜間賞楓與日本四季文化語境解析',
    summary:
      '本教材圍繞京都秋季寺院夜間點燈（ライトアップ）展開，重點演練「〜といえば（講起...就聯想到）」與「〜も珍しくない（雙重否定表常見）」兩個 JLPT 高頻讀解句型。',
    extractedVocab: [
      {
        kanji: '魅了する',
        reading: 'みりょうする',
        romaji: 'miryou suru',
        meaning: '吸引、令...着迷',
        level: 'N2',
        exampleJp: '美しい紅葉が多くの人々を魅了する。',
        exampleHk: '美麗嘅紅葉令好多人着迷。',
      },
      {
        kanji: '対照的',
        reading: 'たいしょうてき',
        romaji: 'taishouteki',
        meaning: '形成鮮明對比（な形容詞）',
        level: 'N3',
        exampleJp: '昼間の穏やかな雰囲気とは対照的だ。',
        exampleHk: '同日頭平靜嘅氣氛形成鮮明對比。',
      },
      {
        kanji: '息をのむ',
        reading: 'いきをのむ',
        romaji: 'iki wo nomu',
        meaning: '屏息、驚嘆到唞唔到氣',
        level: 'N2',
        exampleJp: '息をのむほど幻想的な光景が広がる。',
        exampleHk: '眼前展開令人屏息咁夢幻嘅景象。',
      },
      {
        kanji: '事前',
        reading: 'じぜん',
        romaji: 'jizen',
        meaning: '事前、預先',
        level: 'N3',
        exampleJp: '事前の予約が必要な場合もある。',
        exampleHk: '有時亦需要預先預約。',
      },
    ],
    extractedGrammar: [
      {
        pattern: '〜といえば',
        meaning: '講起...就會諗起...／提到...',
        nuance: '提出話題並引出最具代表性嘅事物，口語與讀解文章極常用。',
        exampleJp: '日本の春といえば桜ですが、秋の紅葉も有名です。',
        exampleHk: '講起日本嘅春天固然係櫻花，但秋天嘅紅葉亦好出名。',
      },
      {
        pattern: '〜ことも珍しくない',
        meaning: '出現...嘅情況亦唔罕見（即係時有發生）',
        nuance: '透過雙重否定作委婉肯定，係 JLPT N3–N1 閱讀理解必考作者立場句式。',
        exampleJp: '夜間に特別なライトアップが行われることも珍しくありません。',
        exampleHk: '夜間舉行特別點燈活動嘅情況亦都唔罕見。',
      },
    ],
    generatedQuiz: [
      {
        question: '文中「〜といえば」の使い方として最も適切なものはどれですか？',
        options: [
          'ある話題を取り上げ、そこから連想される代表的なものを述べる',
          'まだ起きていない仮定の条件を表す',
          '前の文と反対の内容を接続する',
          '原因や理由を強く主張する',
        ],
        correctIndex: 0,
        explanation: '「〜といえば」（講起...）用嚟提出話題並帶出最具代表性嘅聯想事物。',
        category: 'grammar',
      },
      {
        question: '「多くの人々を魅了します」の「魅了」の正しい読み方はどれですか？',
        options: ['みりょう', 'まりょう', 'みりゅう', 'びりょう'],
        correctIndex: 0,
        explanation: '「魅了」讀作「みりょう (miryou)」，意為深深吸引人心。',
        category: 'vocab',
      },
      {
        question: '「ライトアップが行われることも珍しくありません」と最も近い意味はどれですか？',
        options: [
          'ライトアップが行われることはよくある',
          'ライトアップはほとんど行われない',
          'ライトアップは禁止されている',
          'ライトアップは昼間だけ行われる',
        ],
        correctIndex: 0,
        explanation: '「珍しくありません（並唔罕見）」係雙重否定，即係「よくある（經常有）」。',
        category: 'reading',
      },
      {
        question: '本文によると、京都の寺院を訪れる前に何をしておくべきですか？',
        options: [
          '事前の予約が必要かどうか早めに確認しておく',
          '昼間のうちにすべての見学を終えておく',
          'ライトアップの機材を自分で持参する',
          '予約なしで当日直接窓口に並ぶ',
        ],
        correctIndex: 0,
        explanation: '文章最後一句明確建議：「事前の予約が必要な場合もあるため、早めに確認しておくことをおすすめします」。',
        category: 'reading',
      },
    ],
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const levels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    // If text/markdown/csv/srt subtitle file, read as UTF-8 text directly into textarea
    if (
      file.type.startsWith('text/') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.srt')
    ) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setInputText(reader.result);
          setAttachment(null);
        }
      };
      reader.readAsText(file);
      return;
    }

    const isVideoFile =
      file.type.startsWith('video/') ||
      /\.(mp4|webm|mov|m4v)$/i.test(file.name);

    if (file.size > 35 * 1024 * 1024) {
      setErrorMsg('檔案體積超過 35MB，建議上載 35MB 以內嘅日文短片或截取重點片段。');
      return;
    }

    const previewUrl = isVideoFile ? URL.createObjectURL(file) : undefined;

    // Read as base64 (Video / Image / PDF) for multimodal Gemini analysis
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64Data = res.includes(',') ? res.split(',')[1] : res;
      setAttachment({
        name: file.name,
        mimeType: file.type || (isVideoFile ? 'video/mp4' : 'image/png'),
        data: base64Data,
        previewUrl,
        isVideo: isVideoFile,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSampleVideo = () => {
    setErrorMsg(null);
    const sampleTranscript =
      '【動画スクリプト・東京カフェにて】\n店員：いらっしゃいませ！店内でお召し上がりですか、それともお持ち帰りですか？\n客：店内でお願いします。季節限定の抹茶ラテを一つください。\n店員：かしこまりました。お席までお持ちしますので、少々お待ちくださいませ。';
    setInputText(sampleTranscript);
    onSelectLevel('N3');
    // Minimal valid WebM header base64 so attachment payload is ready immediately
    const minimalWebmBase64 =
      'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JATYCGQ2hyb21lV0GGQ2hyb21lFlSua7+uvdeBAXPFh4CB94E=';
    setAttachment({
      name: 'tokyo_cafe_conversation_clip.mp4',
      mimeType: 'video/mp4',
      data: minimalWebmBase64,
      isVideo: true,
    });
  };

  const handleRunAnalysis = async () => {
    if (!inputText.trim() && !attachment) {
      setErrorMsg('請先貼上日文文字內容，或者上載日文影片／圖片／講義檔案。');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSavedVocabNotice(false);

    try {
      const response = await fetch('/api/ai/analyze-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          level: selectedLevel,
          questionCount,
          attachment: attachment
            ? {
                name: attachment.name,
                mimeType: attachment.mimeType,
                data: attachment.data,
              }
            : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '分析教材時發生錯誤');
      }
      setAnalysisResult(data);
    } catch (err: any) {
      setErrorMsg(err?.message || '網絡連線異常，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddVocabToDeck = () => {
    if (!analysisResult?.extractedVocab) return;
    const formatted: VocabItem[] = analysisResult.extractedVocab.map(
      (v: any, idx: number) => ({
        id: `custom-${Date.now()}-${idx}`,
        level: (v.level as JlptLevel) || selectedLevel,
        kanji: v.kanji || '単語',
        reading: v.reading || '',
        romaji: v.romaji || '',
        pitchAccent: '[0] 自訂教材',
        partOfSpeech: '教材核心詞',
        meaning: v.meaning || '',
        coreImage: `由自訂教材《${analysisResult.title || '學習筆記'}》智能提取嘅重點詞彙。`,
        exampleJp: v.exampleJp || v.kanji,
        exampleHk: v.exampleHk || v.meaning,
      })
    );
    onSaveExtractedVocab(formatted);
    setSavedVocabNotice(true);
  };

  const handleLaunchCustomQuiz = () => {
    if (!analysisResult?.generatedQuiz) return;
    const formattedQuestions: QuizQuestion[] = analysisResult.generatedQuiz.map(
      (q: any, idx: number) => ({
        id: `custom-q-${Date.now()}-${idx}`,
        level: selectedLevel,
        category:
          q.category === 'vocab' || q.category === 'reading' ? q.category : 'grammar',
        question: q.question,
        options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['A', 'B', 'C', 'D'],
        correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
        explanation: q.explanation || '由 AI 導師根據你上載嘅教材內容解析。',
      })
    );
    onStartGeneratedQuiz(formattedQuestions);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">
            <span>自訂教材工作坊 · 教材出題スタジオ (AI Video & Material Studio)</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>支援日文短片 (MP4/WebM/MOV)、文章、歌詞、課本截圖或 PDF 講義</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            上載你嘅日文影片或學習資料，即時拆解對白生字並自動出題
          </h2>
        </div>

        {/* Sample Pre-fills + Sample Video Loader */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">一鍵載入範例：</span>
          <button
            type="button"
            data-testid="load-sample-video-btn"
            onClick={handleLoadSampleVideo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0284C7] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Video className="w-3.5 h-3.5" />
            <span>範例日文短片 (動画サンプル)</span>
          </button>
          {SAMPLE_MATERIALS.map((smp) => (
            <button
              key={smp.id}
              type="button"
              onClick={() => {
                setInputText(smp.content);
                onSelectLevel(smp.level);
                setAttachment(null);
                setErrorMsg(null);
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {smp.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Two-Zone Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Zone: Material Input & File/Video Upload (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="japanese-material-input"
              className="text-sm font-bold text-slate-900"
            >
              1. 貼上日文內容或上載教材檔案（支援影片 MP4/MOV/WebM）
            </label>
            <button
              type="button"
              data-testid="upload-material-btn"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0284C7] bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>上載影片 / 圖片 / PDF / TXT</span>
            </button>
            <input
              ref={fileInputRef}
              data-testid="material-file-input"
              type="file"
              accept=".txt,.md,.srt,image/*,video/*,.mp4,.webm,.mov,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {attachment && (
            <div
              data-testid="material-attachment-card"
              className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-sky-950 font-semibold truncate">
                  {attachment.isVideo ? (
                    <Video className="w-4 h-4 text-[#0284C7] shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-[#0284C7] shrink-0" />
                  )}
                  <span className="truncate">
                    已附加{attachment.isVideo ? '影片教材' : '檔案'}：{attachment.name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white text-[10px] font-mono-num text-[#0284C7] border border-sky-200">
                    {attachment.mimeType}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
                    setAttachment(null);
                  }}
                  className="text-xs text-red-600 hover:underline shrink-0 cursor-pointer"
                >
                  移除檔案
                </button>
              </div>

              {attachment.isVideo && (
                <div
                  data-testid="material-video-preview-box"
                  className="rounded-lg overflow-hidden bg-slate-900 border border-slate-800 p-3 text-white space-y-2"
                >
                  {attachment.previewUrl ? (
                    <video
                      data-testid="material-video-preview"
                      src={attachment.previewUrl}
                      controls
                      className="w-full max-h-56 rounded bg-black"
                    />
                  ) : (
                    <div
                      data-testid="material-video-preview"
                      className="flex items-center justify-between gap-3 py-2 px-3 rounded bg-slate-800/90 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-sky-400 shrink-0" />
                        <span>
                          已載入日文影片對白軌道：{attachment.name}（支援原聲朗讀與 AI 語境拆解）
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => speakJapanese(inputText)}
                        className="px-2.5 py-1 rounded bg-[#0284C7] hover:bg-sky-500 text-white font-semibold shrink-0 cursor-pointer"
                      >
                        播放對白語音
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <textarea
            id="japanese-material-input"
            rows={7}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="喺度貼上任何日文文章、新聞、日劇對白、歌詞或者你想問 Sensei 嘅筆記內容..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50/60 p-4 text-sm text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
          />

          {/* Parameter Sliders & Level Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-700 block">
                目標出題 JLPT 難度：{selectedLevel}
              </span>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {levels.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onSelectLevel(lvl)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      selectedLevel === lvl
                        ? 'bg-[#0284C7] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="quiz-count-slider"
                className="text-xs font-semibold text-slate-700 flex items-center justify-between"
              >
                <span>自動生成模擬題數量：</span>
                <span className="font-mono-num text-[#0284C7] font-bold">
                  {questionCount} 題
                </span>
              </label>
              <input
                id="quiz-count-slider"
                type="range"
                min={2}
                max={6}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-[#0284C7] cursor-pointer mt-2"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={handleRunAnalysis}
              className="flex-1 py-3 px-5 rounded-lg bg-[#0284C7] hover:bg-sky-700 text-white font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isLoading
                  ? 'AI 導師正在拆解生字文法及出題...'
                  : '智能解析教材 + 自動生成 JLPT 測驗'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!inputText.trim() && !attachment) {
                  setErrorMsg('請先輸入日文內容或上載檔案再向 AI 導師提問。');
                  return;
                }
                onAskSenseiWithContext(
                  `Sensei，我上載咗呢份日文學習資料，請幫我詳細解釋入面最難嘅句子結構，同埋考下我理解程度：\n${inputText}`,
                  undefined,
                  attachment || undefined
                );
              }}
              className="py-3 px-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0"
            >
              直接傳送俾 AI 導師問問題
            </button>
          </div>
        </div>

        {/* Right Zone: Extracted Study Guide & Generated Quiz Actions (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {!analysisResult ? (
            <div className="py-12 text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">
                準備好接收你嘅專屬日文教材
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                喺左邊貼上任何日文段落或者上載教科書相片／PDF，點擊「智能解析教材」，AI 就會幫你整理出生字卡、文法重點同埋即時測驗題！
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="border-b border-slate-100 pb-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#059669]">
                    ● 教材智能拆解完成
                  </span>
                  <button
                    type="button"
                    onClick={() => speakJapanese(inputText)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0284C7] hover:underline"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>朗讀教材原文</span>
                  </button>
                </div>
                <h3 className="text-lg font-bold text-slate-900 line-clamp-2">
                  {analysisResult.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                  {analysisResult.summary}
                </p>
              </div>

              {/* Action Buttons: Add to SRS Deck or Start Generated Quiz */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleLaunchCustomQuiz}
                  className="flex-1 py-2.5 px-4 bg-[#0284C7] hover:bg-sky-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Play className="w-4 h-4" />
                  <span>
                    即刻挑戰由呢份教材出嘅 {analysisResult.generatedQuiz?.length || 0} 條測驗題
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleAddVocabToDeck}
                  className="py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <PlusCircle className="w-4 h-4 text-[#059669]" />
                  <span>加入 SRS 記憶卡庫</span>
                </button>
              </div>

              {savedVocabNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                  <span>
                    已成功將 {analysisResult.extractedVocab?.length || 0} 個教材生字加入你嘅 {selectedLevel} SRS 記憶卡！
                  </span>
                </div>
              )}

              {/* Extracted Vocabulary List */}
              {analysisResult.extractedVocab && analysisResult.extractedVocab.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-700">
                    提取核心生字 ({analysisResult.extractedVocab.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {analysisResult.extractedVocab.map((v: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-900">
                            {v.kanji}
                          </span>
                          <span className="text-xs text-[#0284C7] font-mono-num">
                            {v.reading}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-700">
                          {v.meaning}
                        </div>
                        {v.exampleJp && (
                          <div className="text-[11px] text-slate-500 pt-1">
                            例：{v.exampleJp}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Grammar Points */}
              {analysisResult.extractedGrammar && analysisResult.extractedGrammar.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-700">
                    提取重點文法 ({analysisResult.extractedGrammar.length})
                  </h4>
                  <div className="space-y-2">
                    {analysisResult.extractedGrammar.map((g: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1"
                      >
                        <div className="font-bold text-sm text-slate-900">
                          {g.pattern} — <span className="text-[#0284C7]">{g.meaning}</span>
                        </div>
                        <p className="text-xs text-slate-600">{g.nuance}</p>
                        {g.exampleJp && (
                          <div className="text-xs text-slate-800 pt-1 font-medium">
                            例：{g.exampleJp}（{g.exampleHk}）
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
