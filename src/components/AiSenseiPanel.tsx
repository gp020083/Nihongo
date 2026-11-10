import React, { useState, useRef } from 'react';
import { Send, Upload, Sparkles, Volume2, FileText, Trash2 } from 'lucide-react';
import { JlptLevel } from '../utils/srsEngine';
import { FuriganaText, speakJapanese } from './FuriganaText';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachmentName?: string;
  timestamp: string;
  /** Legacy field kept so older saved chat history still type-checks. Not displayed. */
  injectedSkills?: string[];
}

export interface AiSenseiPanelProps {
  selectedLevel: JlptLevel;
  messages: ChatMessage[];
  onSendMessage: (
    text: string,
    attachment?: { mimeType: string; data: string; name: string }
  ) => Promise<void>;
  onClearHistory: () => void;
  isSending: boolean;
}

const QUICK_PROMPTS = [
  '點樣分清楚「は」同「が」嘅核心分別？',
  '「〜てある」同「〜ている」喺 N4 考試點分？',
  '日本餐廳同便利店最常用嘅 5 句自然日文係咩？',
  '請出 1 條適合我目前級別嘅日文造句挑戰題考下我！',
];

export const AiSenseiPanel: React.FC<AiSenseiPanelProps> = ({
  selectedLevel,
  messages,
  onSendMessage,
  onClearHistory,
  isSending,
}) => {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<{
    name: string;
    mimeType: string;
    data: string;
  } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setAttachment({
        name: file.name,
        mimeType: file.type || 'image/png',
        data: base64,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !attachment) {
      setValidationError('請先輸入你想問 AI 導師嘅問題，或者附上日文圖片／檔案。');
      return;
    }
    setValidationError(null);
    const messageToSend =
      input.trim() || `請幫我分析呢份上載檔案「${attachment?.name}」入面嘅日文重點同埋出題考我。`;
    const currentAttach = attachment || undefined;
    setInput('');
    setAttachment(null);
    await onSendMessage(messageToSend, currentAttach);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[720px]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/60">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>AI 導師 · AI 先生</span>
            <span aria-hidden="true">·</span>
            <span>目前級別：JLPT {selectedLevel}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">
            發問文法、批改造句、分析圖片或教材
          </h2>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>重設對話</span>
        </button>
      </div>

      {/* Quick Prompt Starter Strip */}
      <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-semibold text-slate-500 shrink-0">常見提問：</span>
        {QUICK_PROMPTS.map((qp, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setValidationError(null);
              onSendMessage(qp);
            }}
            disabled={isSending}
            className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-[#0284C7] hover:text-[#0284C7] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Conversation Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mb-1 px-1">
                <span>{isUser ? '你' : `AI 導師 · ${selectedLevel}`}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{msg.timestamp}</span>
                {!isUser && (
                  <button
                    type="button"
                    onClick={() => speakJapanese(msg.content)}
                    className="inline-flex items-center gap-1 text-[#0284C7] hover:underline ml-1 cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>朗讀日文</span>
                  </button>
                )}
              </div>

              <div
                className={`max-w-3xl rounded-xl p-4 text-sm leading-relaxed space-y-2 ${
                  isUser
                    ? 'bg-[#0284C7] text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-800'
                }`}
              >
                {msg.attachmentName && (
                  <div className="inline-flex items-center gap-1.5 text-xs bg-black/10 px-2.5 py-1 rounded mb-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span>附件：{msg.attachmentName}</span>
                  </div>
                )}

                <div className="whitespace-pre-wrap">
                  <FuriganaText text={msg.content} showFurigana={true} />
                </div>
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-slate-500 p-3 bg-slate-50 rounded-lg border border-slate-200 w-fit">
            <Sparkles className="w-4 h-4 text-[#0284C7]" />
            <span>AI 導師正在整理例句同解說…</span>
          </div>
        )}
      </div>

      {/* Input Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-slate-200 bg-white space-y-2"
      >
        {attachment && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-900">
            <span className="truncate">已附加檔案：{attachment.name}</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="text-red-600 font-medium hover:underline ml-2"
            >
              移除
            </button>
          </div>
        )}

        {validationError && (
          <div className="text-xs text-red-600 font-medium px-1">
            ▲ {validationError}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="上載日文影片、圖片或文件向導師發問"
            title="上載日文影片、圖片或文件"
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,.mp4,.webm,.mov,application/pdf,.txt,.srt"
            onChange={handleAttachFile}
            className="hidden"
          />

          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="輸入你想問嘅日文問題…"
            className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
          />

          <button
            type="submit"
            disabled={isSending}
            className="px-5 py-2.5 bg-[#0284C7] hover:bg-sky-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>發送</span>
          </button>
        </div>
      </form>
    </div>
  );
};
