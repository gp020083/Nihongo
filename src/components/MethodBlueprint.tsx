import React from 'react';
import { JlptLevel, SrsCardState } from '../utils/srsEngine';
import { LEVEL_METADATA, VOCAB_DATABASE } from '../data/jlptCurriculum';

interface MethodBlueprintProps {
  srsMap: Record<string, SrsCardState>;
  xp: number;
  quizzesCompleted: number;
  onSelectLevelAndStudy: (level: JlptLevel) => void;
}

export const MethodBlueprint: React.FC<MethodBlueprintProps> = ({
  srsMap,
  xp,
  quizzesCompleted,
  onSelectLevelAndStudy,
}) => {
  const levels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const reviewedCount = Object.keys(srsMap).length;

  return (
    <div className="space-y-8">
      {/* Cognitive Science Forgetting Curve & SRS Visualizer */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-4">
          <div className="text-xs text-slate-500">
            <span>最佳日語習得方法論 (Optimal Acquisition Architecture)</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>Ebbinghaus 記憶曲線 × Krashen i+1 輸入</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
            點解死背單字表學唔識日文？「四維閉環學習法」幫你真正內化 N5 至 N1
          </h2>

          <p className="text-sm text-slate-600 leading-relaxed">
            根據認知心理學與第二語言習得研究，最高效嘅日文學習唔係機械式抄寫，而係喺「差啲唔記得嗰一刻」進行<strong>主動提取 (Active Recall)</strong>，再配合母語真實句子同 AI 導師即時糾錯：
          </p>

          <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-sm font-bold text-slate-900">
                01. 間隔重複記憶 (SM-2 Spaced Repetition)
              </div>
              <p className="text-xs text-slate-600 mt-1">
                系統根據你每次撳「唔記得 / 有啲kick / 記得清楚 / 秒答精熟」，動態調整 1 日、3 日、7 日至 21 日後重現，用最少時間鎖入長期記憶。
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-sm font-bold text-slate-900">
                02. 語境沉浸與可理解輸入 (Comprehensible Input i+1)
              </div>
              <p className="text-xs text-slate-600 mt-1">
                所有單字同文法都附帶日本生活／商務真實句子、振假名開關與真人語速發音，建立「聲音 → 畫面」直接反射。
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-sm font-bold text-slate-900">
                03. 自訂興趣教材轉化 + AI Sensei 即時反饋
              </div>
              <p className="text-xs text-slate-600 mt-1">
                將你鍾意睇嘅日文歌詞、新聞或課本直接上載，由 AI 自動抽出生字並轉化為專屬 JLPT 題目，保持 100% 學習動機。
              </p>
            </div>
          </div>
        </div>

        {/* Right: Ebbinghaus Retention Curve SVG Diagram */}
        <div className="lg:col-span-6 bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">
              艾賓浩斯遺忘曲線 vs SM-2 間隔複習記憶保持率
            </span>
            <span className="font-mono-num text-[#059669] font-semibold">
              ● 長期記憶鎖定率 &gt; 92%
            </span>
          </div>

          <svg
            viewBox="0 0 520 240"
            className="w-full h-auto overflow-visible"
            role="img"
            aria-label="SM-2 間隔重複記憶曲線圖"
          >
            {/* Grid Lines */}
            <line x1="45" y1="20" x2="500" y2="20" stroke="#E2E8F0" strokeDasharray="4 4" />
            <line x1="45" y1="80" x2="500" y2="80" stroke="#E2E8F0" strokeDasharray="4 4" />
            <line x1="45" y1="140" x2="500" y2="140" stroke="#E2E8F0" strokeDasharray="4 4" />
            <line x1="45" y1="200" x2="500" y2="200" stroke="#CBD5E1" strokeWidth="1.5" />
            <line x1="45" y1="20" x2="45" y2="200" stroke="#CBD5E1" strokeWidth="1.5" />

            {/* Y-axis labels */}
            <text x="10" y="24" fontSize="10" fill="#64748B">100%</text>
            <text x="14" y="84" fontSize="10" fill="#64748B">75%</text>
            <text x="14" y="144" fontSize="10" fill="#64748B">50%</text>
            <text x="14" y="204" fontSize="10" fill="#64748B">20%</text>

            {/* X-axis labels */}
            <text x="45" y="222" fontSize="10" fill="#475569">初次學習</text>
            <text x="145" y="222" fontSize="10" fill="#475569">第 1 日複習</text>
            <text x="260" y="222" fontSize="10" fill="#475569">第 3 日複習</text>
            <text x="395" y="222" fontSize="10" fill="#475569">第 7-14 日精熟</text>

            {/* Unreviewed Rapid Forgetting Curve (Red Dashed) */}
            <path
              d="M 45 20 Q 110 155, 490 192"
              fill="none"
              stroke="#DC2626"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            <text x="275" y="158" fontSize="11" fill="#DC2626" fontWeight="600">
              ▲ 無複習：24小時內遺忘 70%
            </text>

            {/* SM-2 Spaced Repetition Retention Curve (Azure / Emerald Solid) */}
            <path
              d="M 45 20 Q 95 95, 155 110 L 155 20 Q 215 65, 275 75 L 275 20 Q 355 42, 420 48 L 420 20 Q 465 28, 500 32"
              fill="none"
              stroke="#0284C7"
              strokeWidth="3"
            />
            <circle cx="45" cy="20" r="4.5" fill="#0284C7" />
            <circle cx="155" cy="20" r="4.5" fill="#0284C7" />
            <circle cx="275" cy="20" r="4.5" fill="#0284C7" />
            <circle cx="420" cy="20" r="4.5" fill="#059669" />

            <text x="195" y="14" fontSize="11" fill="#0284C7" fontWeight="700">
              ● SM-2 最佳提取點（系統自動排程複習）
            </text>
          </svg>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200 text-center">
            <div>
              <div className="text-xs text-slate-500">已建立記憶卡</div>
              <div className="text-lg font-bold text-slate-900 font-mono-num">
                {reviewedCount} 張
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">完成模擬測驗</div>
              <div className="text-lg font-bold text-slate-900 font-mono-num">
                {quizzesCompleted} 次
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">累積經驗值</div>
              <div className="text-lg font-bold text-[#0284C7] font-mono-num">
                {xp} XP
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Complete N5 - N1 Roadmap Matrix */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">
            JLPT N5 至 N1 全階梯能力指標與進度一覽
          </h3>
          <span className="text-xs text-slate-500">點擊任何級別即可進入該級別專屬道場</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {levels.map((lvl) => {
            const meta = LEVEL_METADATA[lvl];
            const levelVocab = VOCAB_DATABASE.filter((v) => v.level === lvl);
            const learnedInLevel = levelVocab.filter((v) => srsMap[v.id]).length;

            return (
              <div
                key={lvl}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono-num">
                    <span className="font-bold text-[#0284C7] text-sm">{lvl}</span>
                    <span>{meta.cefr}</span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900">{meta.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{meta.subtitle}</p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-500 space-y-1 font-mono-num">
                    <div>要求詞彙：{meta.targetVocabCount} 語</div>
                    <div>要求漢字：{meta.targetKanjiCount} 字</div>
                    <div className="text-[#059669] font-semibold">
                      已練習：{learnedInLevel} / {levelVocab.length} 核心單元
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectLevelAndStudy(lvl)}
                    className="w-full py-2 px-3 text-xs font-semibold text-[#0284C7] bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
                  >
                    進入 {lvl} 學習區 →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
