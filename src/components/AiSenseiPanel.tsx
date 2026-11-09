import React, { useState, useRef } from 'react';
import {
  Send,
  Upload,
  Sparkles,
  Volume2,
  FileText,
  Trash2,
  Cpu,
  Plus,
  CheckCircle2,
  Play,
  ChevronDown,
  ChevronUp,
  Code2,
  FolderGit2,
  RefreshCw,
} from 'lucide-react';
import {
  JlptLevel,
  AntigravitySkillItem,
  DEFAULT_ANTIGRAVITY_SKILLS,
  parseAntigravitySkillMd,
  normalizeGitHubSkillUrl,
  buildAntigravityRepoBundle,
} from '../utils/srsEngine';
import { FuriganaText, speakJapanese } from './FuriganaText';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachmentName?: string;
  timestamp: string;
  injectedSkills?: string[];
}

interface AiSenseiPanelProps {
  selectedLevel: JlptLevel;
  messages: ChatMessage[];
  onSendMessage: (
    text: string,
    attachment?: { mimeType: string; data: string; name: string },
    overrideSkills?: AntigravitySkillItem[]
  ) => Promise<void>;
  onClearHistory: () => void;
  isSending: boolean;
  skills?: AntigravitySkillItem[];
  onChangeSkills?: (skills: AntigravitySkillItem[]) => void;
}

const QUICK_PROMPTS = [
  '點樣分清楚「は」同「が」嘅核心分別？',
  '「〜てある」同「〜ている」喺 N4 考試點分？',
  '日本餐廳同便利店最常用嘅 5 句自然日文係咩？',
  '請出 1 條適合我目前級別嘅日文造句挑戰題考下我！',
];

const SAMPLE_CUSTOM_SKILL_TEMPLATE = `---
name: anime-slang-decoder
description: 將日本動漫、VTuber 及年輕人常用口語（俗語／省略語）拆解為標準丁寧語與廣東話潮語對照。
---

# Anime & Youth Slang Decoder Skill
1. 先列出句子入面嘅動漫／年輕人俗語或音便（例如：〜っす、〜じゃん、〜ちゃった、ヤバい）。
2. 提供【🔄 標準日語（丁寧語）還原版】同埋【🇭🇰 地道廣東話神翻譯】。
3. 提醒學員喺 JLPT 考試或日本職場入面應唔應該用呢個講法。`;

export const AiSenseiPanel: React.FC<AiSenseiPanelProps> = ({
  selectedLevel,
  messages,
  onSendMessage,
  onClearHistory,
  isSending,
  skills: externalSkills,
  onChangeSkills,
}) => {
  const [localSkills, setLocalSkills] = useState<AntigravitySkillItem[]>(
    DEFAULT_ANTIGRAVITY_SKILLS
  );
  const skills = externalSkills || localSkills;
  const updateSkills = (next: AntigravitySkillItem[]) => {
    if (onChangeSkills) {
      onChangeSkills(next);
    } else {
      setLocalSkills(next);
    }
  };

  const [showSkillInjector, setShowSkillInjector] = useState<boolean>(true);
  const [showCustomComposer, setShowCustomComposer] = useState<boolean>(false);
  const [rawSkillMdInput, setRawSkillMdInput] = useState<string>('');
  const [githubSkillUrlInput, setGithubSkillUrlInput] = useState<string>('');
  const [isSyncingGitHubSkill, setIsSyncingGitHubSkill] = useState<boolean>(false);
  const [skillImportFeedback, setSkillImportFeedback] = useState<string | null>(null);
  const [previewSkillId, setPreviewSkillId] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<{
    name: string;
    mimeType: string;
    data: string;
  } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const skillFileRef = useRef<HTMLInputElement | null>(null);

  const activeSkills = skills.filter((s) => s.enabled);

  const syncRepoWorkspaceFiles = async (targetSkills: AntigravitySkillItem[]) => {
    try {
      const bundle = buildAntigravityRepoBundle(targetSkills);
      const resp = await fetch('/api/ai/github-skill-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'write-workspace',
          files: bundle,
        }),
      });
      const data = await resp.json();
      return Array.isArray(data.writtenPaths) ? data.writtenPaths : [];
    } catch {
      return [];
    }
  };

  const handleSyncAllSkillsToRepo = async () => {
    setIsSyncingGitHubSkill(true);
    try {
      const written = await syncRepoWorkspaceFiles(skills);
      setSkillImportFeedback(
        `🐙 已將 ${written.length || skills.length + 1} 個檔案（.agents/AGENTS.md 及 .agents/skills/*/SKILL.md）寫入專案目錄！你而家同步去 GitHub 後，喺 Antigravity IDE / Agent 打開就會自動載入晒所有 Skill！`
      );
    } finally {
      setIsSyncingGitHubSkill(false);
    }
  };

  const handlePullSkillFromGitHubUrl = async () => {
    const normalized = normalizeGitHubSkillUrl(githubSkillUrlInput);
    if (!normalized.valid) {
      setSkillImportFeedback(`⚠️ ${normalized.errorHk}`);
      return;
    }
    setIsSyncingGitHubSkill(true);
    try {
      const resp = await fetch('/api/ai/github-skill-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'pull',
          rawUrl: normalized.rawUrl,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.rawSkillMd) {
        setSkillImportFeedback(`⚠️ ${data.error || '無法從 GitHub 讀取 SKILL.md'}`);
        return;
      }
      const parsed = parseAntigravitySkillMd(data.rawSkillMd, normalized.repoSlug);
      const next = [parsed, ...skills.filter((s) => s.name !== parsed.name)];
      updateSkills(next);
      await syncRepoWorkspaceFiles(next);
      setGithubSkillUrlInput('');
      setSkillImportFeedback(
        `✅ 已從 GitHub (${normalized.repoSlug}) 同步「${parsed.name}」並寫入 .agents/skills/${parsed.name}/SKILL.md！`
      );
    } catch {
      setSkillImportFeedback('⚠️ 連接 GitHub 讀取 SKILL.md 時發生錯誤，請檢查網址。');
    } finally {
      setIsSyncingGitHubSkill(false);
    }
  };

  const handleToggleSkill = (id: string) => {
    const next = skills.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    updateSkills(next);
  };

  const handleDeleteCustomSkill = (id: string) => {
    updateSkills(skills.filter((s) => s.id !== id));
  };

  const handleFireSkillTest = async (skill: AntigravitySkillItem) => {
    const nextSkills = skills.map((s) =>
      s.id === skill.id ? { ...s, enabled: true } : s
    );
    updateSkills(nextSkills);
    setValidationError(null);
    await onSendMessage(
      skill.sampleTestPromptHk,
      undefined,
      nextSkills.filter((s) => s.enabled)
    );
  };

  const handleUploadSkillMdFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      setRawSkillMdInput(content);
      setShowCustomComposer(true);
      const parsed = parseAntigravitySkillMd(
        content,
        file.name.replace(/\.md$/i, '') || 'uploaded-skill'
      );
      const next = [parsed, ...skills.filter((s) => s.name !== parsed.name)];
      updateSkills(next);
      syncRepoWorkspaceFiles(next);
      setSkillImportFeedback(
        `✅ 已成功讀取並寫入 .agents/skills/${parsed.name}/SKILL.md (${file.name})！`
      );
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleInjectCustomSkillMd = async (fireImmediately: boolean) => {
    if (!rawSkillMdInput.trim()) {
      setSkillImportFeedback('⚠️ 請先貼上 Antigravity SKILL.md 內容（或點擊「填入 SKILL.md 範本」）。');
      return;
    }
    const parsed = parseAntigravitySkillMd(rawSkillMdInput);
    const next = [parsed, ...skills.filter((s) => s.name !== parsed.name)];
    updateSkills(next);
    await syncRepoWorkspaceFiles(next);
    setRawSkillMdInput('');
    setSkillImportFeedback(
      `⚡ 已將「${parsed.name}」射入 AI Agent 並同步寫入專案 .agents/skills/${parsed.name}/SKILL.md！`
    );

    if (fireImmediately) {
      await onSendMessage(
        parsed.sampleTestPromptHk,
        undefined,
        next.filter((s) => s.enabled)
      );
    }
  };

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !attachment) {
      setValidationError('請先輸入你想問 AI 導師嘅問題，或者附上日文圖片／檔案。');
      return;
    }
    setValidationError(null);
    const messageToSend =
      input.trim() || `請幫我分析呢份上載檔案（${attachment?.name}）入面嘅日文重點同埋出題考我。`;
    const currentAttach = attachment || undefined;
    setInput('');
    setAttachment(null);
    await onSendMessage(messageToSend, currentAttach, activeSkills);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[720px]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/60">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>言の葉 AI 專屬導師 (Kotonoha Sensei Agent)</span>
            <span aria-hidden="true">·</span>
            <span>目前教學設定：JLPT {selectedLevel}</span>
            <span aria-hidden="true">·</span>
            <span
              data-testid="active-skills-count-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold"
            >
              <Cpu className="w-3 h-3" />
              <span>已射入 {activeSkills.length} 個 Antigravity Skill</span>
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">
            隨時隨地發問文法、造句批改、或將 Antigravity SKILL.md 射入 AI Agent 執行
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="toggle-skill-injector-btn"
            onClick={() => setShowSkillInjector((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>⚡ Antigravity Skill 射入器 ({activeSkills.length})</span>
            {showSkillInjector ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>重設對話</span>
          </button>
        </div>
      </div>

      {/* Antigravity SKILL.md Injector Workbench */}
      {showSkillInjector && (
        <section
          aria-label="Antigravity SKILL.md 射入 AI Agent 掛載台"
          data-testid="antigravity-skill-injector-panel"
          className="px-6 py-4 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-sky-50/70 border-b border-indigo-100 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded">
                  Antigravity SKILL.md Bridge
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  ⚡ 將你喺 Antigravity 設定嘅 Skill 射入 AI Agent（支援 YAML Frontmatter + Markdown 規則）
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                勾選下方技能包，或直接上載／貼上你電腦 <code className="px-1 py-0.5 bg-white rounded border border-slate-200 text-[11px]">~/.gemini/antigravity/skills/&lt;skill&gt;/SKILL.md</code> 檔案，每次發問都會自動射入 AI Agent 嘅 System Instruction！
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={skillFileRef}
                type="file"
                accept=".md,.txt,.yaml,.yml"
                onChange={handleUploadSkillMdFile}
                className="hidden"
              />
              <button
                type="button"
                data-testid="upload-skill-md-btn"
                onClick={() => skillFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>上載 SKILL.md 檔案</span>
              </button>

              <button
                type="button"
                data-testid="sync-skills-to-repo-btn"
                disabled={isSyncingGitHubSkill}
                onClick={handleSyncAllSkillsToRepo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>寫入 .agents/skills/ (GitHub 同步至 Antigravity)</span>
              </button>

              <button
                type="button"
                data-testid="open-custom-skill-composer-btn"
                onClick={() => {
                  setShowCustomComposer((v) => !v);
                  setSkillImportFeedback(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showCustomComposer ? '收起貼上面板' : '貼上 / GitHub 同步 SKILL.md'}</span>
              </button>
            </div>
          </div>

          {/* GitHub Repository Bi-directional Sync Bar */}
          <div className="p-2.5 bg-white/90 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <FolderGit2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong>GitHub ➔ Antigravity 工作流：</strong>專案已內置 <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px]">.agents/AGENTS.md</code> 及 <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px]">.agents/skills/*/SKILL.md</code>，Push 去 GitHub 後喺 Antigravity 打開即自動生效！
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="text"
                data-testid="github-skill-url-input"
                value={githubSkillUrlInput}
                onChange={(e) => setGithubSkillUrlInput(e.target.value)}
                placeholder="貼上 GitHub SKILL.md 網址拉取技能..."
                className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 w-56 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                data-testid="pull-github-skill-btn"
                disabled={isSyncingGitHubSkill}
                onClick={handlePullSkillFromGitHubUrl}
                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingGitHubSkill ? 'animate-spin' : ''}`} />
                <span>從 GitHub 拉取</span>
              </button>
            </div>
          </div>

          {skillImportFeedback && (
            <div
              data-testid="skill-import-feedback"
              className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 flex items-center justify-between"
            >
              <span>{skillImportFeedback}</span>
              <button
                type="button"
                onClick={() => setSkillImportFeedback(null)}
                className="text-emerald-700 hover:underline ml-2 text-[11px]"
              >
                關閉
              </button>
            </div>
          )}

          {/* Custom SKILL.md Paste & Inject Composer */}
          {showCustomComposer && (
            <div
              data-testid="custom-skill-composer"
              className="p-3.5 bg-white border border-indigo-200 rounded-xl space-y-2.5 shadow-2xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  📋 貼上 Antigravity <code className="text-indigo-700">SKILL.md</code> 內容（自動解析 <code className="text-indigo-700">name</code>、<code className="text-indigo-700">description</code> 同 Markdown 指令）
                </span>
                <button
                  type="button"
                  data-testid="fill-sample-skill-template-btn"
                  onClick={() => setRawSkillMdInput(SAMPLE_CUSTOM_SKILL_TEMPLATE)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  ✨ 填入 Antigravity SKILL.md 範例（動漫俗語解碼 Skill）
                </button>
              </div>

              <textarea
                rows={5}
                data-testid="custom-skill-md-input"
                value={rawSkillMdInput}
                onChange={(e) => setRawSkillMdInput(e.target.value)}
                placeholder={`---\nname: my-antigravity-skill\ndescription: 你喺 Antigravity 設定嘅 Skill 描述\n---\n\n# 規則指令\n1. 每次回答必須...`}
                className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  data-testid="inject-custom-skill-btn"
                  onClick={() => handleInjectCustomSkillMd(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                >
                  ⚡ 射入並掛載到 AI Agent
                </button>
                <button
                  type="button"
                  data-testid="inject-and-fire-skill-btn"
                  disabled={isSending}
                  onClick={() => handleInjectCustomSkillMd(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>🚀 射入 AI Agent 並即刻實測執行</span>
                </button>
              </div>
            </div>
          )}

          {/* Mounted Skills Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {skills.map((skill) => {
              const isPreviewOpen = previewSkillId === skill.id;
              return (
                <div
                  key={skill.id}
                  data-testid={`skill-card-${skill.name}`}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                    skill.enabled
                      ? 'bg-white border-indigo-300 shadow-2xs'
                      : 'bg-white/60 border-slate-200 opacity-80'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          data-testid={`skill-toggle-${skill.name}`}
                          checked={skill.enabled}
                          onChange={() => handleToggleSkill(skill.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {skill.name}
                        </span>
                        {skill.isCustom && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                            自訂 SKILL.md
                          </span>
                        )}
                      </label>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewSkillId(isPreviewOpen ? null : skill.id)
                          }
                          title="檢視 SKILL.md 原始規則"
                          className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Code2 className="w-3 h-3" />
                          <span>SKILL.md</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`skill-fire-test-${skill.name}`}
                          disabled={isSending}
                          onClick={() => handleFireSkillTest(skill)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>射去 AI Agent 實測</span>
                        </button>

                        {skill.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomSkill(skill.id)}
                            aria-label={`移除自訂技能 ${skill.name}`}
                            className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-snug pl-6">
                      {skill.description}
                    </p>

                    {isPreviewOpen && (
                      <pre className="mt-2 p-2.5 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono whitespace-pre-wrap overflow-x-auto">
                        {skill.rawSkillMd}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick Prompt Starter Strip */}
      <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-semibold text-slate-500 shrink-0">熱門提問：</span>
        {QUICK_PROMPTS.map((qp, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setValidationError(null);
              onSendMessage(qp, undefined, activeSkills);
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
                <span>{isUser ? '你 (學習者)' : `Kotonoha Sensei (${selectedLevel} AI Agent)`}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{msg.timestamp}</span>
                {!isUser && msg.injectedSkills && msg.injectedSkills.length > 0 && (
                  <span
                    data-testid="message-injected-skills-badge"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold"
                  >
                    <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                    <span>已執行 Antigravity Skills: {msg.injectedSkills.join(', ')}</span>
                  </span>
                )}
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
            <span>
              Sensei AI Agent 正在結合 {activeSkills.length} 個 Antigravity Skill 整理日文例句與廣東話詳解...
            </span>
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
            <span className="truncate">已準備上載影片／圖片／教材：{attachment.name}</span>
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
            placeholder="隨時問我任何日文問題（已掛載嘅 Antigravity Skills 會自動射去 AI Agent 生效）..."
            className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
          />

          <button
            type="submit"
            disabled={isSending}
            className="px-5 py-2.5 bg-[#0284C7] hover:bg-sky-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>發送提問</span>
          </button>
        </div>
      </form>
    </div>
  );
};

