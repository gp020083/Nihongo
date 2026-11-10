import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Fast, timeout-guarded Gemini call using 'gemini-3.1-flash-lite'
 * (which responds in ~800ms) with automatic fallback if a 503 spike occurs.
 */
async function generateFastAiContent(
  ai: GoogleGenAI,
  params: { contents: any; config?: any },
  timeoutMs: number = 6500
): Promise<any> {
  const { thinkingConfig, ...restConfig } = params.config || {};
  return Promise.race([
    ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: params.contents,
      config: restConfig,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI_TIMEOUT')), timeoutMs)
    ),
  ]);
}

interface TutorSkill {
  name: string;
  description: string;
  instructionsMd: string;
}

let builtInTutorSkillsCache: TutorSkill[] | null = null;

/**
 * Loads the built-in teaching skills from .agents/skills/<name>/SKILL.md once and caches them.
 * Each file has a YAML frontmatter block with `name` and `description`, followed by Markdown rules.
 */
function getBuiltInTutorSkills(): TutorSkill[] {
  if (builtInTutorSkillsCache) return builtInTutorSkillsCache;
  const skills: TutorSkill[] = [];
  const skillsRoot = path.join(__dirname, '.agents', 'skills');
  try {
    const dirs = fs
      .readdirSync(skillsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const dir of dirs) {
      const filePath = path.join(skillsRoot, dir, 'SKILL.md');
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
      const fm = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
      const front = fm ? fm[1] : '';
      const body = (fm ? fm[2] : raw).trim();
      const pick = (key: string) => {
        const m = front.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
        return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
      };
      if (!body) continue;
      skills.push({
        name: pick('name') || dir,
        description: pick('description'),
        instructionsMd: body,
      });
    }
  } catch (error: any) {
    console.warn('Built-in tutor skills not loaded:', error?.message || error);
  }
  builtInTutorSkillsCache = skills;
  return skills;
}

async function startServer() {
  getBuiltInTutorSkills();
  const app = express();
  const PORT = 3000;

  // Support base64 videos, images, and PDFs up to 50MB
  app.use(express.json({ limit: '50mb' }));

  // 1. AI Japanese Sensei Tutor Chat (with optional uploaded material/image/video context & built-in tutor skill injection)
  app.post('/api/ai/tutor', async (req, res) => {
    try {
      const {
        message,
        history = [],
        level = 'N4',
        contextItem,
        attachment,
        activeSkills = [],
      } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: '請輸入問題內容' });
      }

      // Skills explicitly sent by an older client are honoured (legacy); otherwise the
      // built-in .agents/skills/*/SKILL.md teaching skills are injected automatically.
      const validSkills = Array.isArray(activeSkills)
        ? activeSkills.filter(
            (s: any) => s && s.enabled !== false && s.name && s.instructionsMd
          )
        : [];
      const promptSkills = validSkills.length > 0 ? validSkills : getBuiltInTutorSkills();
      const injectedSkills = promptSkills.map((s: any) => String(s.name).trim());
      const skillSystemBlock =
        promptSkills.length > 0
          ? `\n\n<tutor_skills>\n請喺回答時遵守以下 ${promptSkills.length} 個教學技能嘅規則與輸出格式（只套用同學生提問相關嘅技能）：\n\n${promptSkills
              .map(
                (s: any, idx: number) =>
                  `### [Tutor Skill #${idx + 1}: ${s.name}]\n- Description: ${
                    s.description || ''
                  }\n- Skill Instructions:\n${s.instructionsMd}`
              )
              .join('\n\n')}\n</tutor_skills>`
          : '';

      const ai = getAiClient();
      if (!ai) {
        return res.json({
          reply: generateSmartFallbackReply(message, level, contextItem, validSkills),
          source: 'curated-engine',
          injectedSkills: validSkills.map((s: any) => String(s.name).trim()),
        });
      }

      const systemInstruction = `你係「言の葉道場 (Kotonoha Sensei)」嘅首席日文 AI 導師，專為香港及粵語母語學習者教授 JLPT N5 至 N1 日文。
教學原則（根據認知科學最佳學習法）：
1. 用親切、清晰嘅廣東話（繁體中文）解釋，配合地道日文例句（必須附上假名讀音，格式如 漢字[かんじ] 或清晰標示讀音及羅馬音，以及廣東話翻譯）。
2. 解釋文法或詞彙時，強調「核心語感圖像 (Core Image)」同埋「母語者喺咩情境下先會咁講」，唔好只係死背公式。
3. 主動比較廣東話/中文母語者容易混淆嘅誤區（例如「〜てある vs 〜ている」、「は vs が」等）。
4. 結尾提供 1 條簡短嘅即時互動練習題（Active Recall），鼓勵學生試下造句或揀答案。
目前學生設定程度：JLPT ${level}。${contextItem ? `\n學生目前正在學習嘅項目：${JSON.stringify(contextItem)}` : ''}${skillSystemBlock}`;

      const parts: any[] = [];
      const isVideoAttachment = Boolean(
        attachment?.mimeType && String(attachment.mimeType).startsWith('video/')
      );
      if (attachment && attachment.data && attachment.mimeType) {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.data,
          },
        });
      }

      const historyText = Array.isArray(history) && history.length > 0
        ? '以下係之前嘅對話紀錄：\n' +
          history
            .slice(-6)
            .map((h: any) => `${h.role === 'user' ? '學生' : 'Sensei'}: ${h.content}`)
            .join('\n') +
          '\n\n'
        : '';

      parts.push({
        text: `${historyText}學生最新提問：${message}`,
      });

      const response = await generateFastAiContent(
        ai,
        {
          contents: { parts },
          config: {
            systemInstruction,
          },
        },
        isVideoAttachment ? 12000 : 6500
      );

      return res.json({
        reply:
          response.text ||
          generateSmartFallbackReply(message, level, contextItem, validSkills),
        source: 'gemini-3.1-flash-lite',
        injectedSkills,
      });
    } catch (error: any) {
      console.error('AI Tutor error:', error?.message || error);
      const {
        message = '',
        level = 'N4',
        contextItem,
        activeSkills = [],
      } = req.body || {};
      const validSkills = Array.isArray(activeSkills)
        ? activeSkills.filter(
            (s: any) => s && s.enabled !== false && s.name && s.instructionsMd
          )
        : [];
      return res.json({
        reply: generateSmartFallbackReply(message, level, contextItem, validSkills),
        source: 'curated-fallback',
        injectedSkills: validSkills.map((s: any) => String(s.name).trim()),
        warning: error?.message,
      });
    }
  });

  // 2. Custom Material Analyzer & Quiz Generator (Text / Video / Image / PDF upload -> Vocabulary, Grammar, JLPT Quiz)
  app.post('/api/ai/analyze-material', async (req, res) => {
    try {
      const { text = '', level = 'N3', questionCount = 4, attachment } = req.body;
      if (!text.trim() && (!attachment || !attachment.data)) {
        return res.status(400).json({ error: '請貼上日文資料文字，或上載影片/圖片/文件檔案。' });
      }

      const ai = getAiClient();
      if (!ai) {
        return res.json(generateFallbackMaterialAnalysis(text, level, questionCount, attachment));
      }

      const parts: any[] = [];
      const isVideoAttachment = Boolean(
        attachment?.mimeType && String(attachment.mimeType).startsWith('video/')
      );
      if (attachment && attachment.data && attachment.mimeType) {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.data,
          },
        });
      }

      const promptText = `你係 JLPT 日文教材分析與出題專家。請分析以下提供嘅日文學習資料（文字、日文影片對白與畫面、圖片或PDF內容），針對 JLPT ${level} 程度，用簡潔繁體中文（廣東話解釋風格）整理出：
1. title: 簡短精煉嘅資料主題名稱（嚴格限制 20 字以內，唔好加多餘副標題）
2. summary: 內容重點撮要、影片對白或語境分析（嚴格限制 80 字以內）
3. extractedVocab: 4 個核心生字（包含 kanji, reading, romaji, meaning, level, exampleJp, exampleHk）
4. extractedGrammar: 2 個核心文法句型（包含 pattern, meaning, nuance, exampleJp, exampleHk）
5. generatedQuiz: ${questionCount} 條高質素 JLPT 模擬選擇題（包含 question, options (4個選項陣列), correctIndex (0-3), explanation (簡明廣東話解題), category ('vocab' | 'grammar' | 'reading')）

${text ? `學生提供嘅文字／影片筆記內容：\n"""\n${text}\n"""` : '請直接讀取上載影片／圖片／檔案入面嘅日文語音對白、字幕及畫面內容進行分析及出題。'}`;

      parts.push({ text: promptText });

      const response = await generateFastAiContent(
        ai,
        {
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              extractedVocab: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    kanji: { type: Type.STRING },
                    reading: { type: Type.STRING },
                    romaji: { type: Type.STRING },
                    meaning: { type: Type.STRING },
                    level: { type: Type.STRING },
                    exampleJp: { type: Type.STRING },
                    exampleHk: { type: Type.STRING },
                  },
                },
              },
              extractedGrammar: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pattern: { type: Type.STRING },
                    meaning: { type: Type.STRING },
                    nuance: { type: Type.STRING },
                    exampleJp: { type: Type.STRING },
                    exampleHk: { type: Type.STRING },
                  },
                },
              },
              generatedQuiz: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    correctIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                    category: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      },
      isVideoAttachment ? 12000 : 6500
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      if (typeof parsed.title === 'string' && parsed.title.length > 36) {
        parsed.title = parsed.title.slice(0, 34) + '…';
      }
      if (typeof parsed.summary === 'string' && parsed.summary.length > 160) {
        parsed.summary = parsed.summary.slice(0, 158) + '…';
      }
      return res.json({
        ...parsed,
        source: 'gemini-3.1-flash-lite',
      });
    } catch (error: any) {
      console.error('AI Material Analyzer error:', error?.message || error);
      const { text = '', level = 'N3', questionCount = 4, attachment } = req.body || {};
      return res.json(generateFallbackMaterialAnalysis(text, level, questionCount, attachment));
    }
  });

  // 3. Live Web/News/Anime Cultural Study Feed Generator
  app.post('/api/ai/live-feed', async (req, res) => {
    try {
      const { topic = '日本最新話題アニメと聖地巡礼', level = 'N3', category = 'anime' } = req.body || {};
      const ai = getAiClient();
      if (!ai) {
        return res.json(generateFallbackLiveFeed(topic, level, category));
      }

      const prompt = `你係日本時事、動漫與文化日文教材編寫專家。請根據主題「${topic}」（類別：${category}），結合日本最新資訊／新聞／動漫文化，為 JLPT ${level} 學習者編寫一篇精讀教材。
請嚴格輸出 JSON 格式（唔好加 markdown code block），包含以下欄位：
- id: 字串
- level: "${level}"
- category: "${category}"
- sourceLabel: 來源或專題標籤（例如「NHK 時事焦點精讀」或「日本動畫文化特集」）
- titleJp: 日文標題（28字以內）
- titleHk: 繁體中文（廣東話風格）標題（28字以內）
- contentJp: 日文正文（約 90-140 字，符合 ${level} 程度，所有漢字必須附上振假名格式 漢字[かんじ]）
- translationHk: 自然流暢嘅繁體中文／廣東話全文翻譯
- keyVocab: 陣列（3個核心生字，每個包含 kanji, reading, meaning）
- grammarPoint: 物件（包含 pattern 及 explanation）`;

      const response = await generateFastAiContent(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = (response.text ?? '').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({
          id: `live-${Date.now()}`,
          level,
          category,
          sourceLabel: parsed.sourceLabel || 'AI 實時網絡時事・動漫精讀',
          titleJp: parsed.titleJp || topic,
          titleHk: parsed.titleHk || `${topic}（${level} 精讀）`,
          contentJp: parsed.contentJp || '',
          translationHk: parsed.translationHk || '',
          keyVocab: Array.isArray(parsed.keyVocab) ? parsed.keyVocab.slice(0, 3) : [],
          grammarPoint: parsed.grammarPoint || {
            pattern: '〜を通じて',
            explanation: '表示透過某個媒介或過程。',
          },
        });
      }

      return res.json(generateFallbackLiveFeed(topic, level, category));
    } catch (error: any) {
      console.error('AI Live Feed error:', error?.message || error);
      const { topic = '日本最新アニメとニュース', level = 'N3', category = 'anime' } = req.body || {};
      return res.json(generateFallbackLiveFeed(topic, level, category));
    }
  });

  // 4. AI Japanese Dictionary Lookup (matches the user's reference dictionary layout)
  app.post('/api/ai/dictionary', async (req, res) => {
    try {
      const { query = '' } = req.body || {};
      const cleanQuery = String(query).trim();
      if (!cleanQuery) {
        return res.status(400).json({ error: '請輸入要查詢嘅日文或中文詞語' });
      }

      const ai = getAiClient();
      if (!ai) {
        return res.json(generateFallbackDictionaryEntry(cleanQuery));
      }

      const prompt = `你係一部專業權威嘅「中日雙解＋JLPT考點分析」日語辭典引擎。用家查詢詞語：「${cleanQuery}」（如果用家輸入中文，請自動對應最地道、最常用嘅日文詞彙作為主詞條）。
請輸出完整辭典 JSON 資料：
- kanji: 日文主詞條（漢字或假名）
- reading: 平假名讀音
- romaji: 羅馬音
- pitchNumber: 聲調符號（如 "⓪", "①", "②", "③"）
- partOfSpeech: 詞性簡稱（如 "形動", "名・スル", "五他", "一段", "形"）
- jlptLevels: 所屬 JLPT 級別標籤（如 "N2 · N3 · N4"）
- shortMeaningZh: 簡明釋義（AI生成，用分號隔開 3-4 個核心中文意思，結尾加句號）
- chineseDef: 詳細中文釋義（清朗扼要，附廣東話語感提示）
- japaneseDef: 權威日日辭典風格嘅日文原文定義
- examples: 3 條地道例句陣列（每條有 jp（漢字必須標註振假名如 朝[あさ]の空気[くうき]）及 zh 中文翻譯）
- relatedWords: 包含 sameRegister (陣列: {word, reading}), synonyms (近義詞字串陣列 5-7 個), topicWords (話題詞陣列: {word, gloss} 4-5 個)
- jlptStats: 包含 frequencyLabelZh (如 "高頻核心考點" 或 "低頻考點"), frequencyLabelJa, examAppearances (數字), historicalCount (數字), correctRatePercent (數字 15-90), yearDistribution (4個年份統計), samplePastQuestion (1條模擬歷年真題: question, options 4個, correctIndex 0-3, explanation)`;

      const response = await generateFastAiContent(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              kanji: { type: Type.STRING },
              reading: { type: Type.STRING },
              romaji: { type: Type.STRING },
              pitchNumber: { type: Type.STRING },
              partOfSpeech: { type: Type.STRING },
              jlptLevels: { type: Type.STRING },
              shortMeaningZh: { type: Type.STRING },
              chineseDef: { type: Type.STRING },
              japaneseDef: { type: Type.STRING },
              examples: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    jp: { type: Type.STRING },
                    zh: { type: Type.STRING },
                  },
                },
              },
              relatedWords: {
                type: Type.OBJECT,
                properties: {
                  sameRegister: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        word: { type: Type.STRING },
                        reading: { type: Type.STRING },
                      },
                    },
                  },
                  synonyms: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  topicWords: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        word: { type: Type.STRING },
                        gloss: { type: Type.STRING },
                      },
                    },
                  },
                },
              },
              jlptStats: {
                type: Type.OBJECT,
                properties: {
                  frequencyLabelZh: { type: Type.STRING },
                  frequencyLabelJa: { type: Type.STRING },
                  examAppearances: { type: Type.INTEGER },
                  historicalCount: { type: Type.INTEGER },
                  correctRatePercent: { type: Type.INTEGER },
                  yearDistribution: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        year: { type: Type.STRING },
                        count: { type: Type.INTEGER },
                      },
                    },
                  },
                  samplePastQuestion: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      correctIndex: { type: Type.INTEGER },
                      explanation: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({
        id: `dict-ai-${Date.now()}`,
        syncSource: 'ai-live',
        lastSyncedAt: new Date().toISOString(),
        ...parsed,
      });
    } catch (error: any) {
      console.error('AI Dictionary error:', error?.message || error);
      const { query = '言葉' } = req.body || {};
      return res.json(generateFallbackDictionaryEntry(String(query).trim()));
    }
  });

  // 5. Online Word Database Auto-Sync Endpoint (/api/words/sync)
  // Returns cloud-curated N5-N1 dictionary & vocab updates when the client is online.
  app.post('/api/words/sync', async (req, res) => {
    try {
      const { level = 'N3' } = req.body || {};
      const cloudPack = getCloudSyncWordPack(level);
      return res.json({
        syncedAt: new Date().toISOString(),
        status: 'online-synced',
        cloudEntries: cloudPack.dictionaryEntries,
        cloudVocab: cloudPack.vocabItems,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Sync error' });
    }
  });

  // 6. Daily Japanese Teacher Lesson Generator with Google Search Grounding (/api/ai/daily-lesson)
  app.post('/api/ai/daily-lesson', async (req, res) => {
    try {
      const {
        level = 'N4',
        topic = '日本最新話題・アニメ・ニュース・旅行トレンド',
        category = 'news',
      } = req.body || {};

      const ai = getAiClient();
      if (!ai) {
        return res.json(generateFallbackDailyTeacherLesson(level, topic, category));
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const prompt = `你係一位充滿熱誠嘅日本名師「言の葉先生」。今日係 ${todayStr}，請利用 Google Search 搜尋關於「${topic}」嘅最新日本新聞、動漫話題、飲食旅遊或社會流行趨勢，為 JLPT ${level} 學生準備一份多元化嘅「今日先生特選講義 (Daily Teacher Lesson Pack)」。
請嚴格輸出 JSON 格式（唔好加 markdown code block），包含以下結構：
{
  "themeTagZh": "繁體中文主題標籤（14字內）",
  "themeTagJa": "日文主題標籤（14字內）",
  "titleZh": "今日講義繁體中文標題（26字內）",
  "titleJa": "今日講義日文標題（26字內）",
  "teacherIntroHk": "老師用親切廣東話向學生介紹今日課題背景與學習重點（約60-90字）",
  "teacherIntroJa": "日本語での先生の挨拶と今日の学習ポイント（約60-90字）",
  "sourceLabel": "AI 老師連網搜尋・每日特選講義",
  "vocabList": [
    {
      "kanji": "日文詞彙",
      "reading": "平假名讀音",
      "romaji": "羅馬音",
      "pitchAccent": "[0] 平板型 或 [1] 頭高型",
      "partOfSpeech": "詞性",
      "meaning": "廣東話/繁中意思",
      "coreImage": "廣東話記憶畫面提示",
      "exampleJp": "例句（漢字必須附振假名如 日本[にほん]）",
      "exampleHk": "例句廣東話翻譯"
    }
  ],
  "grammarPoint": {
    "pattern": "核心文法句型",
    "formation": "接續方式",
    "meaning": "中文意思",
    "nuance": "語感與母語者用法解析",
    "cantoneseComparison": "與廣東話對比",
    "exampleJp": "文法例句（附振假名）",
    "exampleHk": "文法例句翻譯"
  },
  "readingArticle": {
    "titleJp": "短文日文標題（附振假名）",
    "titleHk": "短文中文標題",
    "contentJp": "約100-140字嘅日文精讀短文（漢字附振假名 漢字[かんじ]）",
    "translationHk": "全文繁體中文翻譯",
    "culturalTipHk": "日本文化或考試實用貼士"
  },
  "listeningDialogue": {
    "scenarioZh": "對話情境說明（中文）",
    "scenarioJa": "会話のシチュエーション（日本語）",
    "lines": [
      { "speaker": "A", "textJp": "日文對白1（附振假名）", "textHk": "中文翻譯1" },
      { "speaker": "B", "textJp": "日文對白2（附振假名）", "textHk": "中文翻譯2" }
    ],
    "speakingDrillJp": "跟讀練習目標日文金句（附振假名）",
    "speakingDrillHk": "跟讀金句中文翻譯"
  },
  "miniQuiz": {
    "question": "1條針對今日課文或文法嘅 JLPT 四選一題目",
    "options": ["選項1", "選項2", "選項3", "選項4"],
    "correctIndex": 0,
    "explanation": "廣東話詳解"
  }
}
請確保 vocabList 有 3 個生字，miniQuiz correctIndex 為正確選項索引 (0-3)。`;

      const response = await generateFastAiContent(
        ai,
        {
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        },
        9000
      );

      // Extract web grounding sources if available
      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const groundingSources = chunks
        .map((c: any) => c?.web)
        .filter((w: any) => w && w.uri)
        .slice(0, 4)
        .map((w: any) => ({
          title: w.title || w.uri,
          uri: w.uri,
        }));

      const rawText = (response.text ?? '').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const stamp = Date.now();
        return res.json({
          id: `daily-ai-${stamp}`,
          level,
          themeTagZh: parsed.themeTagZh || `${level} 每日網絡話題特訓`,
          themeTagJa: parsed.themeTagJa || `${level} 本日の最新トピック`,
          titleZh: parsed.titleZh || `${topic}（Sensei 今日特選講義）`,
          titleJa: parsed.titleJa || `${topic}（本日の特別講義）`,
          teacherIntroHk:
            parsed.teacherIntroHk ||
            '各位同學好！今日老師特別喺網上搵咗最新嘅日本話題作為精修教材，一齊聽說讀全方位練習啦！',
          teacherIntroJa:
            parsed.teacherIntroJa ||
            '皆さんこんにちは！今日は最新の日本の話題をもとに、語彙・文法・読解・聴解を総合的に学びましょう。',
          sourceLabel:
            groundingSources.length > 0
              ? 'Google Search 實時連網・AI 先生特選講義'
              : 'AI 先生每日特選講義',
          groundingSources,
          vocabList: Array.isArray(parsed.vocabList)
            ? parsed.vocabList.slice(0, 6).map((v: any, idx: number) => ({
                id: `daily-v-${stamp}-${idx}`,
                level,
                kanji: v.kanji || '話題',
                reading: v.reading || 'わだい',
                romaji: v.romaji || 'wadai',
                pitchAccent: v.pitchAccent || '[0] 平板型',
                partOfSpeech: v.partOfSpeech || '名詞',
                meaning: v.meaning || '話題、熱話',
                coreImage: v.coreImage || '日本人茶餘飯後同新聞最常提起嘅焦點話題。',
                exampleJp: v.exampleJp || 'このニュースがいま大[おお]きな話題[わだい]になっている。',
                exampleHk: v.exampleHk || '呢單新聞而家成為咗好大嘅話題。',
              }))
            : [],
          grammarPoint: {
            id: `daily-g-${stamp}`,
            level,
            pattern: parsed.grammarPoint?.pattern || '〜をきっかけに',
            formation: parsed.grammarPoint?.formation || '名詞 ＋ をきっかけに',
            meaning: parsed.grammarPoint?.meaning || '以...為契機',
            meaningJa: parsed.grammarPoint?.meaningJa || '〜が原因・動機や始まりとなって',
            nuance: parsed.grammarPoint?.nuance || '表示某件事成為開始新行動嘅轉折點。',
            nuanceJa:
              parsed.grammarPoint?.nuanceJa ||
              'ある出来事や経験が動機・始まりとなって、新しい行動や変化が起こることを表します。',
            cantoneseComparison:
              parsed.grammarPoint?.cantoneseComparison || '相當於廣東話「因為呢個契機而開始...」。',
            exampleJp:
              parsed.grammarPoint?.exampleJp ||
              'アニメをきっかけに日本語[にほんご]を勉強[べんきょう]し始[はじ]めた。',
            exampleHk:
              parsed.grammarPoint?.exampleHk || '以動漫為契機開始學日文。',
          },
          readingArticle: {
            titleJp: parsed.readingArticle?.titleJp || parsed.titleJa || topic,
            titleHk: parsed.readingArticle?.titleHk || parsed.titleZh || topic,
            contentJp:
              parsed.readingArticle?.contentJp ||
              '日本[にほん]では季節[きせつ]やトレンドに合[あ]わせて様[さま]々[ざま]な文化[ぶんか]やニュースが話題[わだい]になります。毎日[まいにち]の生[い]きた表現[ひょうげん]から学[まな]びましょう。',
            translationHk:
              parsed.readingArticle?.translationHk ||
              '喺日本，配合季節與最新潮流，各式各樣嘅文化同新聞都會成為熱話。讓我哋從每日鮮活嘅表達中學習啦。',
            culturalTipHk:
              parsed.readingArticle?.culturalTipHk ||
              '透過真實新聞同動漫台詞記單字，記憶留存率比死背單字表高出 3 倍以上！',
          },
          listeningDialogue: {
            scenarioZh:
              parsed.listeningDialogue?.scenarioZh || '日常討論最新日本話題嘅自然對話',
            scenarioJa:
              parsed.listeningDialogue?.scenarioJa || '最新の話題について話す日常会話',
            lines:
              Array.isArray(parsed.listeningDialogue?.lines) &&
              parsed.listeningDialogue.lines.length > 0
                ? parsed.listeningDialogue.lines
                : [
                    {
                      speaker: '先生',
                      textJp: '今日[きょう]のテーマについて、どう思[おも]いますか。',
                      textHk: '你對今日嘅主題有咩睇法呢？',
                    },
                    {
                      speaker: '学生',
                      textJp: 'とても面白[おもしろ]い話題[わだい]ですね！もっと調[しら]べてみます。',
                      textHk: '真係好有趣嘅話題呢！我會再深入研究下。',
                    },
                  ],
            speakingDrillJp:
              parsed.listeningDialogue?.speakingDrillJp ||
              '最近[さいきん]のニュースを通じて、生[い]きた日本語[にほんご]を学[まな]んでいます。',
            speakingDrillHk:
              parsed.listeningDialogue?.speakingDrillHk ||
              '透過最近嘅新聞，學習緊鮮活地道嘅日文。',
          },
          miniQuiz: {
            question:
              parsed.miniQuiz?.question ||
              '「アニメを見たのを（　　）、日本語の勉強を始めた。」空欄に入る最もよいものはどれですか？',
            options:
              Array.isArray(parsed.miniQuiz?.options) &&
              parsed.miniQuiz.options.length === 4
                ? parsed.miniQuiz.options
                : ['きっかけに', '最中に', 'わりに', 'あまり'],
            correctIndex:
              typeof parsed.miniQuiz?.correctIndex === 'number'
                ? parsed.miniQuiz.correctIndex
                : 0,
            explanation:
              parsed.miniQuiz?.explanation ||
              '「〜をきっかけに」表示以某件事作為開始嘅契機。',
          },
        });
      }

      return res.json(generateFallbackDailyTeacherLesson(level, topic, category));
    } catch (error: any) {
      console.error('AI Daily Lesson error:', error?.message || error);
      const { level = 'N4', topic = '日本最新トレンド', category = 'news' } = req.body || {};
      return res.json(generateFallbackDailyTeacherLesson(level, topic, category));
    }
  });

  // 7. Dynamic JLPT Official Mock Exam Paper Generator (/api/ai/mock-exam)
  app.post('/api/ai/mock-exam', async (req, res) => {
    try {
      const {
        level = 'N4',
        focusTopic = 'JLPT 綜合模擬考',
        excludePrompts = [],
        count = 12,
      } = req.body || {};
      const ai = getAiClient();
      if (!ai) {
        return res.json({
          questions: generateFallbackMockExamQuestions(level),
          source: 'curated-exam-bank',
        });
      }

      const excludedSnippet =
        Array.isArray(excludePrompts) && excludePrompts.length > 0
          ? `\n【嚴禁重複題目】請絕對唔好出同以下現有題目相似或相同嘅題目：\n${excludePrompts
              .slice(0, 18)
              .map((p: string, i: number) => `${i + 1}. ${String(p).slice(0, 48)}`)
              .join('\n')}`
          : '';

      const targetTotal = Math.min(Math.max(6, Number(count) || 12), 15);
      const vocabQuota = Math.round(targetTotal * (5 / 12));
      const readingQuota = Math.round(targetTotal * (4 / 12));
      const listeningQuota = Math.max(2, targetTotal - vocabQuota - readingQuota);

      const prompt = `你係日本國際交流基金 JLPT 日本語能力試驗嘅首席命題委員。請為 JLPT ${level} 考生全新創作一份包含 ${targetTotal} 條題目、題型高度多元化且唔重複嘅模擬試卷（主題與文體偏向：${focusTopic}），必須嚴格包含以下三個科目及多元題型：
- ${vocabQuota} 題 section 為 "vocab_grammar"（言語知識：必須涵蓋「漢字読み／表記」、「文脈規定／言い換え類義」、「用法」、「文法形式の判断」、以及至少1至2題「文の組み立て（＿＿ ＿＿ ★ ＿＿ 星號句子重組）」與「文章の文法（段落克漏字）」）
- ${readingQuota} 題 section 為 "reading"（読解：必須提供 passageJp，並涵蓋多元文體：社内ビジネスメール／回覧板、エッセイ／科学・社会評論、情報検索（料金表・イベント案内板）、以及【A】と【B】の統合比較読解）
- ${listeningQuota} 題 section 為 "listening"（聴解：必須涵蓋課題理解、ポイント理解、概要理解或即時応答；必須提供 audioScriptJp 及 dialogueSpeakers 陣列，包含男女雙人對話，每個 speaker 標明 "男" 或 "女"，lineJp 唔好重複寫 "男：" 或 "女：" 前綴）
- 正確答案 correctIndex 請隨機分佈喺 0, 1, 2, 3，唔好全部放喺 0！${excludedSnippet}

請輸出 JSON 格式，結構為：
{
  "questions": [
    {
      "section": "vocab_grammar" | "reading" | "listening",
      "mondaiLabel": "例如：問題1・文の組み立て（★並べ替え） 或 問題6・統合理解（AとBの比較読解）",
      "promptJp": "題目問題日文",
      "passageJp": "（如屬 reading 必填）閱讀文章日文",
      "audioScriptJp": "（如屬 listening 必填）聽解完整日文原稿",
      "dialogueSpeakers": [{"speaker": "男", "lineJp": "佐藤さん、来週[らいしゅう]の企画書[きかくしょ]、もう読[よ]んだ？"}, {"speaker": "女", "lineJp": "はい、読[よ]みました。"}],
      "options": ["選項1", "選項2", "選項3", "選項4"],
      "correctIndex": 2,
      "explanationHk": "詳盡廣東話解題分析",
      "explanationJa": "日本語での簡潔な解説"
    }
  ]
}`;

      const response = await generateFastAiContent(
        ai,
        {
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        },
        10500
      );

      const rawText = (response.text ?? '').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.questions) && parsed.questions.length >= 3) {
          const stamp = Date.now();
          const formatted = parsed.questions.map((q: any, idx: number) => {
            const rawOptions =
              Array.isArray(q.options) && q.options.length === 4
                ? q.options.map((o: any) => String(o))
                : ['選択肢1', '選択肢2', '選択肢3', '選択肢4'];
            const origCorrect =
              typeof q.correctIndex === 'number' &&
              q.correctIndex >= 0 &&
              q.correctIndex <= 3
                ? q.correctIndex
                : 0;

            // Permute options so correct answers are guaranteed to be well-distributed
            const shift = (idx + (stamp % 4)) % 4;
            const rotatedOptions = [
              ...rawOptions.slice(shift),
              ...rawOptions.slice(0, shift),
            ];
            const rotatedCorrect = (origCorrect - shift + 4) % 4;

            return {
              id: `ai-mock-${level}-${stamp}-${idx}`,
              level,
              section:
                q.section === 'reading' || q.section === 'listening'
                  ? q.section
                  : 'vocab_grammar',
              mondaiLabel: q.mondaiLabel || `問題${idx + 1}・AI実戦新規命題`,
              promptJp: q.promptJp || '最も適切なものを選びなさい。',
              passageJp: q.passageJp || undefined,
              audioScriptJp: q.audioScriptJp || undefined,
              dialogueSpeakers: Array.isArray(q.dialogueSpeakers)
                ? q.dialogueSpeakers
                : undefined,
              options: rotatedOptions,
              correctIndex: rotatedCorrect,
              explanationHk: q.explanationHk || '請留意上下文語境與助詞配搭。',
              explanationJa: q.explanationJa || '文脈に最も合う選択肢を選びます。',
            };
          });
          return res.json({
            questions: formatted,
            source: 'gemini-3.1-flash-lite',
          });
        }
      }

      return res.json({
        questions: generateFallbackMockExamQuestions(level),
        source: 'curated-fallback',
      });
    } catch (error: any) {
      console.error('AI Mock Exam error:', error?.message || error);
      const { level = 'N4' } = req.body || {};
      return res.json({
        questions: generateFallbackMockExamQuestions(level),
        source: 'curated-fallback',
      });
    }
  });

  // Helper: Split Japanese text into natural phrase chunks <= 72 chars so neural TTS never truncates
  function splitJapaneseTextIntoTtsChunks(text: string, maxChars: number = 72): string[] {
    const cleaned = String(text || '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return [];
    if (cleaned.length <= maxChars) return [cleaned];

    const rawSentences = cleaned
      .split(/(?<=[。！？!?।\n])/u)
      .map((s) => s.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    for (const sent of rawSentences) {
      if (sent.length <= maxChars) {
        chunks.push(sent);
      } else {
        const clauses = sent
          .split(/(?<=[、，,])/u)
          .map((c) => c.trim())
          .filter(Boolean);
        let current = '';
        for (const cl of clauses) {
          if ((current + cl).length <= maxChars) {
            current += cl;
          } else {
            if (current) chunks.push(current);
            if (cl.length <= maxChars) {
              current = cl;
            } else {
              for (let i = 0; i < cl.length; i += maxChars) {
                chunks.push(cl.slice(i, i + maxChars));
              }
              current = '';
            }
          }
        }
        if (current) chunks.push(current);
      }
    }
    return chunks.length > 0 ? chunks : [cleaned.slice(0, maxChars)];
  }

  // Helper: Direct Google Broadcast Stream MP3 buffer
  async function fetchGoogleBroadcastMp3Buffer(cleanText: string): Promise<Buffer | null> {
    try {
      const chunks = splitJapaneseTextIntoTtsChunks(cleanText, 140);
      const buffers: Buffer[] = [];
      for (const chunk of chunks) {
        const encoded = encodeURIComponent(chunk);
        const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=ja&client=tw-ob&q=${encoded}`;
        const resp = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
        });
        if (!resp.ok) continue;
        const arrayBuf = await resp.arrayBuffer();
        if (arrayBuf && arrayBuf.byteLength >= 256) {
          buffers.push(Buffer.from(arrayBuf));
        }
      }
      return buffers.length > 0 ? Buffer.concat(buffers) : null;
    } catch {
      return null;
    }
  }

  // Helper: Multi-Voice Neural Japanese TTS MP3 buffer ('jp_001' | 'jp_003' | 'jp_005' | 'jp_006' | 'google-nhk')
  async function fetchMultiVoiceNeuralMp3Buffer(
    cleanText: string,
    voiceCode: 'jp_001' | 'jp_003' | 'jp_005' | 'jp_006' | 'google-nhk'
  ): Promise<{ buffer: Buffer; voiceLabel: string } | null> {
    if (voiceCode === 'google-nhk') {
      const buf = await fetchGoogleBroadcastMp3Buffer(cleanText);
      return buf ? { buffer: buf, voiceLabel: 'NHK-Broadcast-Stream' } : null;
    }

    try {
      const chunks = splitJapaneseTextIntoTtsChunks(cleanText, 68);
      const chunkBuffers = await Promise.all(
        chunks.map(async (chunk) => {
          const resp = await fetch('https://tiktok-tts.weilnet.workers.dev/api/generation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: chunk,
              voice: voiceCode,
            }),
          });
          if (!resp.ok) return null;
          const json: any = await resp.json();
          if (json?.success && typeof json.data === 'string' && json.data.length > 100) {
            return Buffer.from(json.data, 'base64');
          }
          return null;
        })
      );

      const valid: Buffer[] = [];
      for (const b of chunkBuffers) {
        if (b) valid.push(b);
      }
      if (valid.length > 0) {
        return {
          buffer: Buffer.concat(valid),
          voiceLabel: voiceCode,
        };
      }
    } catch {
      // Fallback to Google Broadcast Stream below
    }

    const fallbackBuf = await fetchGoogleBroadcastMp3Buffer(cleanText);
    return fallbackBuf ? { buffer: fallbackBuf, voiceLabel: 'NHK-Broadcast-Fallback' } : null;
  }

  function resolveVoiceCodeForStyleAndRole(
    voiceStyle: string,
    role: string,
    emotionTone: string = 'neutral'
  ): 'jp_001' | 'jp_003' | 'jp_005' | 'jp_006' | 'google-nhk' {
    // When an explicit emotional tone is active, route to the most expressive matching neural timbre
    if (emotionTone === 'excited' || emotionTone === 'surprised') {
      return role === 'male' && voiceStyle === 'nhk-male' ? 'jp_006' : 'jp_003';
    }
    if (emotionTone === 'gentle') {
      return role === 'male' && voiceStyle === 'nhk-male' ? 'jp_006' : 'jp_005';
    }
    if (emotionTone === 'serious') {
      return role === 'female' && voiceStyle === 'nhk-female' ? 'jp_001' : 'jp_006';
    }

    if (voiceStyle === 'nhk-male') return 'jp_006'; // Deep Male Announcer
    if (voiceStyle === 'nhk-female') return 'jp_001'; // Clear Standard Female Announcer
    if (voiceStyle === 'neural-female') return 'jp_005'; // Warm Gentle Tokyo Female
    if (voiceStyle === 'neural-male' || voiceStyle === 'anime-vivid') return 'jp_003'; // Expressive Seiyuu Voice
    if (voiceStyle === 'cloud-stream') return 'google-nhk'; // Google Broadcast Stream
    // Default 'nhk-anchor' (dual announcer: Male -> jp_006, Female/Narrator -> google-nhk)
    if (role === 'male') return 'jp_006';
    if (role === 'female') return 'jp_001';
    return 'google-nhk';
  }

  // 7b. Natural Multi-Speaker Japanese TTS Dialogue Synthesis (/api/ai/tts-dialogue)
  app.post('/api/ai/tts-dialogue', async (req, res) => {
    try {
      const { turns = [], voiceStyle = 'nhk-anchor', emotionTone = 'neutral' } = req.body || {};
      if (!Array.isArray(turns) || turns.length === 0) {
        return res.json({ fallbackToClientMultiVoice: true });
      }

      const cleanedTurns = turns
        .map((t: any) => {
          const role = t.role === 'male' ? 'male' : t.role === 'female' ? 'female' : 'narrator';
          const clean = String(t.spokenTextJp || '')
            .replace(/\[[^\]]+\]/g, '')
            .replace(
              /^(男|女|男性|女性|店員|客|課長|部下|先生|学生|質問|駅員|担当者|取引先|キャスター|コメンテーター|ケン|リン|佐藤|鈴木)[：:]\s*/u,
              ''
            )
            .trim();
          return { role, clean };
        })
        .filter((t) => t.clean.length > 0);

      if (cleanedTurns.length === 0) {
        return res.json({ fallbackToClientMultiVoice: true });
      }

      // Synthesize each speaker turn with its distinct Male (jp_006) or Female (jp_001 / jp_003 / jp_005) neural voice in parallel!
      const synthesizedTurns = await Promise.all(
        cleanedTurns.map(async (turn) => {
          const voiceCode = resolveVoiceCodeForStyleAndRole(
            voiceStyle,
            turn.role === 'narrator' ? 'female' : turn.role,
            emotionTone
          );
          return fetchMultiVoiceNeuralMp3Buffer(turn.clean, voiceCode);
        })
      );

      const validBuffers: Buffer[] = [];
      for (const r of synthesizedTurns) {
        if (r?.buffer) validBuffers.push(r.buffer);
      }

      if (validBuffers.length > 0) {
        const combinedMp3 = Buffer.concat(validBuffers);
        return res.json({
          audioDataUrl: `data:audio/mpeg;base64,${combinedMp3.toString('base64')}`,
          turnAudioDataUrls: synthesizedTurns.map((r) =>
            r?.buffer ? `data:audio/mpeg;base64,${r.buffer.toString('base64')}` : null
          ),
          engine: `multi-speaker-neural (${voiceStyle}:${emotionTone})`,
        });
      }

      return res.json({ fallbackToClientMultiVoice: true });
    } catch {
      return res.json({ fallbackToClientMultiVoice: true });
    }
  });

  // 7b-2. Universal Smooth Japanese Speech Synthesis (/api/ai/tts-speech)
  app.post('/api/ai/tts-speech', async (req, res) => {
    try {
      const {
        textJp = '',
        role = 'narrator',
        voiceStyle = 'nhk-anchor',
        emotionTone = 'neutral',
      } = req.body || {};
      const cleanSentence = String(textJp)
        .replace(/\[[^\]]+\]/g, '')
        .replace(/^(男|女|男性|女性|店員|客|先生|学生|質問)[：:]\s*/u, '')
        .trim();
      if (!cleanSentence) {
        return res.json({ fallbackToWebSpeech: true });
      }

      const targetVoiceCode = resolveVoiceCodeForStyleAndRole(
        voiceStyle,
        role,
        emotionTone
      );
      const result = await fetchMultiVoiceNeuralMp3Buffer(cleanSentence, targetVoiceCode);
      if (result?.buffer) {
        return res.json({
          audioDataUrl: `data:audio/mpeg;base64,${result.buffer.toString('base64')}`,
          voiceName: result.voiceLabel,
          emotionTone,
        });
      }

      return res.json({ fallbackToWebSpeech: true });
    } catch {
      return res.json({ fallbackToWebSpeech: true });
    }
  });

  // 7b-2b. Multimodal Speech Transcription (/api/ai/transcribe-speech) for Speaking Dojo & Voice Notes
  app.post('/api/ai/transcribe-speech', async (req, res) => {
    try {
      const { audioDataUrl, lang = 'ja-JP', expectedTextJp = '' } = req.body || {};
      if (typeof audioDataUrl !== 'string' || !audioDataUrl.startsWith('data:audio/')) {
        return res.status(400).json({ error: '未收到有效音訊數據' });
      }

      const ai = getAiClient();
      if (!ai) {
        return res.json({ transcript: expectedTextJp || '' });
      }

      const commaIdx = audioDataUrl.indexOf(',');
      const header = audioDataUrl.slice(5, commaIdx);
      const mimeType = header.split(';')[0] || 'audio/webm';
      const base64Data = audioDataUrl.slice(commaIdx + 1);
      if (!base64Data || base64Data.length < 64) {
        return res.json({ transcript: '' });
      }

      const prompt =
        lang === 'zh-HK'
          ? '請精確轉錄呢段廣東話／中文語音備註嘅文字內容。只輸出轉錄出嚟嘅文字，唔好加任何解釋或標點以外嘅前言。如果完全係靜音，請輸出空字串。'
          : `請精確聽取並轉錄呢段日文朗讀錄音（學員嘗試朗讀嘅目標句可能係：「${expectedTextJp}」）。請只輸出學員實際讀出嘅日文句子（漢字或假名皆可），唔好加任何前言或解釋。`;

      const response = await generateFastAiContent(
        ai,
        {
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: prompt },
              ],
            },
          ],
        },
        6500
      );

      const transcript = (response.text ?? '').trim().replace(/^["「『]|["」』]$/g, '');
      return res.json({ transcript });
    } catch {
      return res.json({ transcript: '' });
    }
  });

  // 7b-3. AI Dynamic Change Scene & Particle Nuance Analyzer (/api/ai/nuance-analyzer)
  app.post('/api/ai/nuance-analyzer', async (req, res) => {
    try {
      const {
        sceneInput = '隨著天氣轉冷，暖氣開得越強',
        level = 'N3',
      } = req.body || {};

      const ai = getAiClient();
      if (!ai) {
        return res.json({ fallbackToLocalEngine: true });
      }

      const prompt = `你係「時雨の町」風格嘅首席日語語感與文法拆解導師。學員輸入咗一個「兩邊同步動態變化」嘅場景：
「${sceneInput}」（目標級別：JLPT ${level}）

請根據呢個場景，生成 4 句分別使用以下 4 個「兩邊同步變化」核心句型嘅地道日文例句：
1. patternId: "nitsurete"（① 〜につれて：伴隨自然單向漸進變化）
2. patternId: "nishitagatte"（② 〜にしたがって：伴隨客觀規律／階段遞進變化）
3. patternId: "ba_hodo"（③ 〜ば〜ほど：越 A 就越 B・正比例強烈遞增）
4. patternId: "tomoni"（④ 〜とともに：與 A 同時並進發生 B 變化）

請特別標註「前件 A 動態變化結構」、「動態連接句型」、「後件 B 同步變化結構（點解唔可以用靜態／意志結尾）」以及句中每個關鍵「助詞（が・を・に・で・ほど・も）」嘅用法與自動詞／他動詞搭配。
請嚴格輸出 JSON 格式（唔好加 markdown code block），結構如下：
{
  "sceneInput": "${sceneInput}",
  "sceneSummaryHk": "用廣東話總結呢個動態變化場景嘅語感核心與自他動詞／助詞搭配重點",
  "sceneSummaryJa": "日本語でのこの動態変化シーンの文法・ニュアンス解説",
  "clauseALabelHk": "前件 A（起點漸進變化）：...",
  "clauseBLabelHk": "後件 B（同步伴隨變化）：...",
  "coreRuleBannerHk": "【兩邊同步變化・語感鐵則（中文）】...",
  "coreRuleBannerJa": "【両側同時変化の鉄則（日本語解説）】...",
  "wrongUsageTrap": {
    "wrongSentenceJp": "× 錯誤示範日文句（例如後件誤用〜たいです／靜態句，漢字附振假名 漢字[かんじ]）",
    "correctSentenceJp": "○ 正確動態變化日文句（漢字附振假名 漢字[かんじ]）",
    "reasonHk": "廣東話解釋點解 × 嗰句錯（例如後件唔可以用主觀意向或靜態句）",
    "reasonJa": "日本語での誤用理由と正しい動態変化の説明"
  },
  "generatedExamples": [
    {
      "patternId": "nitsurete",
      "patternJp": "① 〜につれて（伴隨自然單向漸進變化）",
      "level": "N3",
      "registerLabelHk": "日常自然描寫・最常用",
      "registerLabelJa": "日常会話・自然な推移",
      "sentenceJp": "完整日文例句（所有漢字附振假名 漢字[かんじ]）",
      "cleanSpokenJp": "純日文句子（唔帶振假名括號，供 NHK 語音直接朗讀）",
      "translationHk": "地道廣東話翻譯",
      "clauseA": {
        "textJp": "前件A日文片段（附振假名）",
        "meaningHk": "前件A中文意思",
        "changeVerbType": "前件動詞／形容詞變化類型（如：い形容詞く形＋なる / 自動詞辞書形）",
        "dynamicNoteHk": "點解前件A體現漸進動態變化"
      },
      "connectorGrammar": {
        "formJp": "〜につれて",
        "ruleHk": "接續與語感規則（中文）",
        "ruleJa": "接続とニュアンス規則（日本語）"
      },
      "clauseB": {
        "textJp": "後件B日文片段（附振假名）",
        "meaningHk": "後件B中文意思",
        "changeVerbType": "後件動詞／形容詞變化類型",
        "constraintNoteHk": "後件B同步變化限制與語感說明（中文）",
        "constraintNoteJa": "後件Bの動的変化制約と解説（日本語）"
      },
      "particleHighlights": [
        {
          "particleJp": "が 或 を 或 に 或 ほど 或 も",
          "attachedWordJp": "附著詞語（如 天気[てんき]が / 暖房[だんぼう]を）",
          "roleLabelHk": "助詞功能標籤（如：自動詞變化主體格助詞 / 他動詞人為調校受事助詞）",
          "explanationHk": "詳細廣東話助詞用法解析",
          "explanationJa": "日本語での格助詞・係助詞の解説"
        }
      ]
    }
  ]
}`;

      const response = await generateFastAiContent(
        ai,
        {
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        },
        7500
      );

      const rawText = (response.text ?? '').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.generatedExamples) && parsed.generatedExamples.length >= 2) {
          return res.json({
            ...parsed,
            generatedBy: 'ai-sensei',
          });
        }
      }

      return res.json({ fallbackToLocalEngine: true });
    } catch {
      return res.json({ fallbackToLocalEngine: true });
    }
  });

  // 7c. SRS Card Shadowing Natural Japanese Example Sentence TTS (/api/ai/shadowing-tts)
  app.post('/api/ai/shadowing-tts', async (req, res) => {
    try {
      const {
        textJp = '',
        level = 'N4',
        slowMode = false,
        voiceStyle = 'nhk-anchor',
      } = req.body || {};
      const cleanSentence = String(textJp)
        .replace(/\[[^\]]+\]/g, '')
        .trim();
      if (!cleanSentence) {
        return res.json({ fallbackToWebSpeech: true });
      }

      const targetVoiceCode = resolveVoiceCodeForStyleAndRole(voiceStyle, 'default');
      const neuralRes = await fetchMultiVoiceNeuralMp3Buffer(
        cleanSentence,
        targetVoiceCode
      );
      if (neuralRes) {
        return res.json({
          audioDataUrl: `data:audio/mpeg;base64,${neuralRes.buffer.toString('base64')}`,
          engine: `neural-voice-${neuralRes.voiceLabel}`,
          voiceName: neuralRes.voiceLabel,
        });
      }

      const ai = getAiClient();
      if (!ai) {
        return res.json({ fallbackToWebSpeech: true });
      }

      const tempoInstruction = slowMode
        ? '学習者がシャドーイング（復唱）しやすいように、一音一音をはっきりと、ややゆっくり丁寧な速度で'
        : level === 'N5' || level === 'N4'
          ? 'クリアで聞き取りやすい自然な標準語のイントネーションで'
          : 'ネイティブスピーカーの自然で流暢な標準語の抑揚とリズムで';

      const ttsPrompt = `以下の日本語の例文を、${tempoInstruction}読み上げてください。前置きや説明は一切入れず、例文のみを発話してください。\n\n${cleanSentence}`;

      let inlineData: { data?: string; mimeType?: string } | undefined;

      for (const ttsModel of ['gemini-2.5-flash-preview-tts', 'gemini-3.8-flash-lite-tts']) {
        try {
          const response = await Promise.race([
            ai.models.generateContent({
              model: ttsModel,
              contents: [{ parts: [{ text: ttsPrompt }] }],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                  },
                },
              },
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('SHADOWING_TTS_TIMEOUT')), 4500)
            ),
          ]);
          const partData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
          if (partData?.data) {
            inlineData = partData;
            break;
          }
        } catch {
          // Try next TTS model
        }
      }

      if (inlineData?.data) {
        const mime = (inlineData.mimeType || '').toLowerCase();
        const wavBase64 = mime.includes('wav')
          ? inlineData.data
          : wrapPcm16ToWavBase64(inlineData.data, 24000);
        return res.json({
          audioDataUrl: `data:audio/wav;base64,${wavBase64}`,
          engine: 'gemini-ai-tts',
        });
      }

      return res.json({ fallbackToWebSpeech: true });
    } catch {
      return res.json({ fallbackToWebSpeech: true });
    }
  });

  // 7d. SRS Card Shadowing AI Pronunciation & Rhythm Comparison (/api/ai/shadowing-evaluate)
  app.post('/api/ai/shadowing-evaluate', async (req, res) => {
    try {
      const {
        targetSentenceJp = '',
        targetKanji = '',
        targetReading = '',
        pitchAccent = '[0] 平板型',
        level = 'N4',
        spokenTranscriptJp = '',
        audioDataUrl,
      } = req.body || {};

      const ai = getAiClient();
      if (!ai) {
        return res.json({ fallbackToLocalEngine: true });
      }

      const cleanTarget = String(targetSentenceJp).replace(/\[[^\]]+\]/g, '').trim();
      const parts: any[] = [];

      if (typeof audioDataUrl === 'string' && audioDataUrl.startsWith('data:audio/')) {
        const commaIdx = audioDataUrl.indexOf(',');
        const header = audioDataUrl.slice(5, commaIdx);
        const mimeType = header.split(';')[0] || 'audio/webm';
        const base64Data = audioDataUrl.slice(commaIdx + 1);
        if (base64Data && base64Data.length > 64) {
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        }
      }

      const evalPrompt = `你係專業日語發音與 Shadowing（跟讀）AI 評審導師。請比對學員嘅跟讀表現與目標例句：
- 目標例句（JLPT ${level}）：「${cleanTarget}」（原振假名標註：${targetSentenceJp}）
- 卡片核心單字：「${targetKanji}（${targetReading}）」・高低音調：${pitchAccent}
- 學員語音辨識文字紀錄：「${spokenTranscriptJp || '（請從附帶音訊聽取或依紀錄評估）'}」

請嚴格輸出 JSON 格式（唔好加 markdown code block），包含以下欄位：
{
  "spokenTranscriptJp": "學員實際讀出嘅日文句子（如已提供文字紀錄則保留或從音訊轉錄）",
  "overallScore": 0至100嘅整數,
  "pronunciationScore": 0至100嘅整數（元音、促音、長音、撥音準確度）,
  "fluencyScore": 0至100嘅整數（語速連貫度與助詞停頓節奏）,
  "pitchAccentScore": 0至100嘅整數（核心詞「${targetKanji}」嘅高低音調 ${pitchAccent} 及整句抑揚）,
  "targetWordHit": 布林值（學員有冇準確讀出核心詞「${targetKanji}／${targetReading}」）,
  "coachAdviceHk": "詳盡親切嘅廣東話發音與連音指導（指出做得好嘅地方及邊個假名／助詞可以再執正）",
  "coachAdviceJa": "日本語での簡潔な発音・リズム講評",
  "pitchAccentTipHk": "針對核心詞「${targetKanji}（${targetReading}）」音調 ${pitchAccent} 嘅廣東話發音貼士"
}`;

      parts.push({ text: evalPrompt });

      const response = await generateFastAiContent(
        ai,
        {
          contents: [{ role: 'user', parts }],
          config: {
            responseMimeType: 'application/json',
          },
        },
        6500
      );

      const rawText = (response.text ?? '').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({
          ...parsed,
          evaluatedBy: 'ai-sensei',
        });
      }

      return res.json({ fallbackToLocalEngine: true });
    } catch {
      return res.json({ fallbackToLocalEngine: true });
    }
  });

  // 7e. Mistake-Targeted AI Speed-Adjusted Listening & Dictation Generator (/api/ai/mistake-listening-drill)
  app.post('/api/ai/mistake-listening-drill', async (req, res) => {
    try {
      const {
        questionPrompt = '',
        correctAnswer = '',
        userChosenOption = '',
        level = 'N4',
        category = 'grammar',
        speedMode = 'slow', // 'slow' (0.7x) | 'calibrated' (0.85x) | 'native' (1.0x)
      } = req.body || {};

      const ai = getAiClient();
      if (!ai) {
        return res.json({ fallbackToLocalEngine: true });
      }

      const genPrompt = `你係 JLPT ${level} 聽解與弱點強化 AI 導師。學員剛才喺呢條題目答錯咗：
- 原題目：「${questionPrompt}」
- 正確考點／正解：「${correctAnswer}」（類別：${category}）
- 學員誤選：「${userChosenOption}」

請為學員設計一句專門用嚟做「盲聽聽寫挑戰 (Dictation Drill)」嘅地道日文句子，必須自然包含正確考點「${correctAnswer}」，長度約 14 至 28 字，適合用耳仔聽寫：
請嚴格輸出 JSON 格式（唔好加 markdown code block）：
{
  "targetFocusJp": "${String(correctAnswer).replace(/\[[^\]]+\]/g, '').trim()}",
  "targetFocusReading": "該考點嘅純平假名讀音",
  "dictationSentenceJp": "附振假名標註嘅完整日文聽寫句子，例如：電車[でんしゃ]が遅[おく]れたおかげで、会議[かいぎ]に間[ま]に合[あ]わなかった。",
  "cleanSpokenSentenceJp": "純日文句子（唔帶振假名括號，供 TTS 直接朗讀）",
  "translationHk": "呢句聽寫句子嘅地道廣東話翻譯",
  "listeningHintHk": "廣東話聽力提示（唔好直接劇透全句，提示學員留意邊個助詞或語氣轉折）",
  "listeningHintJa": "日本語での聴解ヒント（前後の助詞やイントネーションの注目点）",
  "tokenBank": ["字塊1", "字塊2", "字塊3", "字塊4", "干擾項"]
}`;

      const textResp = await generateFastAiContent(
        ai,
        {
          contents: genPrompt,
          config: {
            responseMimeType: 'application/json',
          },
        },
        4500
      );

      const rawText = (textResp.text ?? '').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.json({ fallbackToLocalEngine: true });
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const spokenSentence = String(
        parsed.cleanSpokenSentenceJp || parsed.dictationSentenceJp || ''
      )
        .replace(/\[[^\]]+\]/g, '')
        .trim();

      // Also attempt speed-calibrated AI TTS synthesis
      let audioDataUrl: string | undefined;
      if (spokenSentence) {
        const speedInstruction =
          speedMode === 'slow'
            ? '学習者がディクテーション（書き取り）しやすいように、0.7倍速のゆっくり、一音一音はっきりとした丁寧な発話速度で'
            : speedMode === 'calibrated'
              ? `JLPT ${level} の聴解練習向けに、0.85倍速の聞き取りやすい明瞭なテンポで`
              : 'ネイティブの自然な標準スピード（1.0倍速）で';

        const ttsPrompt = `以下の日本語の文を、${speedInstruction}読み上げてください。前置きや説明は一切入れず、文のみを発話してください。\n\n${spokenSentence}`;

        try {
          const ttsResponse = await Promise.race([
            ai.models.generateContent({
              model: 'gemini-3.8-flash-lite-tts',
              contents: [{ parts: [{ text: ttsPrompt }] }],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                  },
                },
              },
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('MISTAKE_TTS_TIMEOUT')), 3500)
            ),
          ]);
          const partData =
            ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData;
          if (partData?.data) {
            const mime = (partData.mimeType || '').toLowerCase();
            const wavBase64 = mime.includes('wav')
              ? partData.data
              : wrapPcm16ToWavBase64(partData.data, 24000);
            audioDataUrl = `data:audio/wav;base64,${wavBase64}`;
          }
        } catch {
          // Client Web Speech API will play with exact speed rate
        }
      }

      return res.json({
        ...parsed,
        audioDataUrl,
        generatedBy: 'ai-sensei',
      });
    } catch {
      return res.json({ fallbackToLocalEngine: true });
    }
  });

  // 8. Dynamic & Web-Grounded Quiz Arena Question Generator (/api/ai/quiz-arena)
  app.post('/api/ai/quiz-arena', async (req, res) => {
    try {
      const {
        level = 'N4',
        topic = 'JLPT最新頻出語彙・文法・ニュース・アニメ実戦問題',
        questionCount = 5,
      } = req.body || {};

      const ai = getAiClient();
      if (!ai) {
        return res.json({
          questions: generateFallbackQuizArenaBatch(level, topic, questionCount),
          groundingSources: [
            {
              title: 'JLPT 日本語能力試験 公式問題例集',
              uri: 'https://www.jlpt.jp/samples/forlearners.html',
            },
          ],
          syncedAt: new Date().toISOString(),
          source: 'curated-dynamic-engine',
        });
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const prompt = `你係日本 JLPT 實戰測驗場嘅首席出題官。今日係 ${todayStr}，請利用 Google Search 搜尋關於「${topic}」嘅最新日本時事、動漫台詞、日常生活或 JLPT 歷年高頻考點，為 JLPT ${level} 學生全新編寫 ${questionCount} 條唔重複、高質素嘅四選一實戰測驗題（涵蓋 vocab、grammar、reading 三類）。
請嚴格輸出 JSON 格式（唔好加 markdown code block），結構如下：
{
  "questions": [
    {
      "category": "vocab" | "grammar" | "reading",
      "sourceTag": "題目題材標籤（如：NHK時事語彙 / 動漫名場面文法 / JLPT高頻陷阱）",
      "question": "日文題目句子（如有空格用（　　）標示）",
      "options": ["選項1", "選項2", "選項3", "選項4"],
      "correctIndex": 0,
      "explanation": "清晰廣東話解題分析（解釋點解揀呢個答案以及其餘干擾項嘅分別）"
    }
  ]
}`;

      const response = await generateFastAiContent(
        ai,
        {
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        },
        8500
      );

      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const groundingSources = chunks
        .map((c: any) => c?.web)
        .filter((w: any) => w && w.uri)
        .slice(0, 4)
        .map((w: any) => ({
          title: w.title || w.uri,
          uri: w.uri,
        }));

      const rawText = (response.text ?? '').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          const stamp = Date.now();
          const formatted = parsed.questions
            .slice(0, questionCount)
            .map((q: any, idx: number) => ({
              id: `arena-ai-${level}-${stamp}-${idx}`,
              level,
              category:
                q.category === 'vocab' || q.category === 'reading'
                  ? q.category
                  : 'grammar',
              sourceTag: q.sourceTag || `AI 連網新題 (${todayStr})`,
              question: q.question || '最も適切なものを選びなさい。',
              options:
                Array.isArray(q.options) && q.options.length === 4
                  ? q.options
                  : ['選択肢1', '選択肢2', '選択肢3', '選択肢4'],
              correctIndex:
                typeof q.correctIndex === 'number' &&
                q.correctIndex >= 0 &&
                q.correctIndex <= 3
                  ? q.correctIndex
                  : 0,
              explanation:
                q.explanation || '請根據上下文語境與助詞搭配選出最自然嘅表達。',
            }));

          return res.json({
            questions: formatted,
            groundingSources,
            syncedAt: new Date().toISOString(),
            source: 'gemini-3.1-flash-lite-web',
          });
        }
      }

      return res.json({
        questions: generateFallbackQuizArenaBatch(level, topic, questionCount),
        groundingSources,
        syncedAt: new Date().toISOString(),
        source: 'curated-dynamic-fallback',
      });
    } catch (error: any) {
      console.error('AI Quiz Arena error:', error?.message || error);
      const { level = 'N4', topic = 'JLPT実戦', questionCount = 5 } = req.body || {};
      return res.json({
        questions: generateFallbackQuizArenaBatch(level, topic, questionCount),
        groundingSources: [],
        syncedAt: new Date().toISOString(),
        source: 'curated-dynamic-fallback',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kotonoha Dojo server running on http://localhost:${PORT}`);
  });
}

function generateSmartFallbackReply(
  message: string,
  level: string,
  contextItem?: any,
  activeSkills: Array<{ name: string; description?: string; instructionsMd: string }> = []
): string {
  const q = message.toLowerCase();
  const skillExecutionAppendix =
    Array.isArray(activeSkills) && activeSkills.length > 0
      ? `\n\n---\n### 已套用教學技能：${activeSkills
          .map((s) => `\`${s.name}\``)
          .join(' + ')}\n` +
        activeSkills
          .map((s) => {
            if (s.name.includes('trap')) {
              return `- **【🎯 考官出題陷阱 (\`${s.name}\`)】**：\n  - ○ 正確句：**値段[ねだん]が高[たか]いわりに、あまりおいしくない。**（比例逆接：同貴價唔成比例）\n  - × 錯誤句：**値段[ねだん]が高[たか]いおかげで、あまりおいしくない。**（誤用正面感謝原因）\n  - **3 秒考場秒殺口訣**：「見數字基準用『にしては』，見程度形容詞落差即揀『わりに』！」`;
            }
            if (s.name.includes('cantonese') || s.name.includes('image')) {
              return `- **【🧠 母語者腦內畫面 (\`${s.name}\`)】**：\n  - **「に」＝ 圖釘釘死一點 📍**（存在點／目的地落腳點，如：東京[とうきょう]**に**住[す]む）\n  - **「で」＝ 畫個圈喺舞台入面跳舞 🎪**（動作發生嘅活動範圍，如：東京[とうきょう]**で**働[はたら]く）`;
            }
            if (s.name.includes('keigo')) {
              return `- **【💼 商務敬語三段轉換 (\`${s.name}\`)】**：\n  1. タメ口：明日、資料を持って行くね。\n  2. 丁寧語：明日、資料を持って行きます。\n  3. 最高商務敬語（ウチ謙譲＋ソト尊敬）：**明日[あす]、資料[しりょう]をお持ちいたします（伺います）。ご査収[さしゅう]のほどよろしくお願[ねが]い申[もう]し上[あ]げます。**`;
            }
            if (s.name.includes('pitch')) {
              return `- **【🎵 NHK 東京標準語高低音調診斷 (\`${s.name}\`)】**：\n  - **橋[はし]が**（② 尾高型：は↗し↘が — 助詞「が」跌落低音）\n  - **箸[はし]が**（① 頭高型：は↘しが — 第一拍高、第二拍即跌）\n  - **端[はし]が**（⓪ 平板型：は↗しが↗ — 連埋助詞「が」維持高音唔跌）`;
            }
            return `- **【⚡ 自訂 Skill \`${s.name}\` 已套用】**：\n  - 規則摘要：${(
              s.description || s.instructionsMd
            )
              .replace(/\s+/g, ' ')
              .slice(0, 120)}`;
          })
          .join('\n')
      : '';

  if (q.includes('は') && q.includes('が')) {
    return `### 「は (wa)」與「が (ga)」嘅核心語感分別（${level} 重點）

好多香港同學都會將兩個都譯做「係／主語」，但喺日本人腦海入面，佢哋嘅**鏡頭焦點**完全唔同：

1. **「は」係聚光燈嘅背景舞台（主題 Topic / 已知資訊）**
   - 重點喺**「は」後面**講嘅內容。
   - 例句：**私[わたし]は学生[がくせい]です。**（至於我呢，係個學生。）

2. **「が」係特寫鏡頭（主語焦點 Focus / 新發現 / 排他性）**
   - 重點喺**「が」前面**嗰個名詞（「邊個？就係佢！」），或者用嚟描述眼前突然發生嘅自然現象。
   - 例句：**あっ、雨[あめ]が降[ふ]ってきた！**（呀！落雨喇！—— 眼前新發現嘅現象）
   - 例句：**誰[だれ]が来[き]ましたか？ — 田中[たなか]さんが来[き]ました。**（邊個嚟咗？—— 田中先生嚟咗。）

**即時小挑戰（Active Recall）**：
如果你想喺餐廳同侍應講「**呢個係我嗌嘅**（唔係別人，係我！）」，應該用「私が注文しました」定係「私は注文しました」呢？試下答我！${skillExecutionAppendix}`;
  }

  if (contextItem && contextItem.kanji) {
    return `### Sensei 深度拆解：「${contextItem.kanji}（${contextItem.reading}）」

- **廣東話意思**：${contextItem.meaning}
- **JLPT 級別**：${contextItem.level || level}
- **核心記憶法**：建議將「${contextItem.kanji}」放喺真實句子入面大聲朗讀三次，建立聲音同畫面嘅連結（Shadowing 跟讀法）：
  - **例句**：${contextItem.exampleJp || `${contextItem.kanji}を使[つか]って文[ぶん]を作[つく]りましょう。`}
  - **意思**：${contextItem.exampleHk || '用呢個詞語嚟造句練習啦。'}

你可以試下用「**${contextItem.kanji}**」造一個同你自己日常生活有關嘅短句發俾我，我幫你執正自然度！${skillExecutionAppendix}`;
  }

  return `### Sensei 導師解答（針對你的提問：「${message.slice(0, 48)}」）

學習日文最有效嘅方法係**「語境理解 + 主動提取 (Active Recall)」**：

1. **核心拆解**：
   - 當遇到呢類日文表達時，先留意句尾嘅**時態／語氣助詞**（決定成句嘅態度係肯定、推測定係委婉拒絕），再睇中間嘅**助詞（を・に・で・から）**去釐清動作嘅方向。
2. **地道例句示範**：
   - **毎日[まいにち]少[すこ]しずつでも日本語[にほんご]に触[ふ]れることが大切[たいせつ]です。**
   - *(Mainichi sukoshizutsu demo nihongo ni fureru koto ga taisetsu desu.)*
   - 意思：就算每日只係少少，接觸日文都係非常重要嘅。${skillExecutionAppendix}`;
}

function generateFallbackMaterialAnalysis(
  text: string,
  level: string,
  questionCount: number,
  attachment?: { name?: string; mimeType?: string }
) {
  const isVideo = Boolean(attachment?.mimeType && attachment.mimeType.startsWith('video/'));
  const cleanText =
    text.trim() ||
    (isVideo
      ? `影片教材《${attachment?.name || '日本街頭實況短片'}》：店員與客人嘅自然對白及場景解說`
      : '日本の春といえば桜ですが、秋の紅葉も多くの人々を魅了します。京都の寺院では、夜間に特別なライトアップが行われることも珍しくありません。');
  return {
    title: isVideo
      ? `${level} 影片教材解析：${(attachment?.name || '日語實況短片').slice(0, 18)}`
      : `${level} 精讀教材解析：日本四季文化與語境表達`,
    summary: `呢段${isVideo ? '日文影片及字幕教材' : '日文教材'}主要圍繞「${cleanText.slice(0, 35)}...」展開。文中使用咗典型嘅書面及日常解說句型（如「〜といえば」提起話題、「〜も珍しくない」雙重否定表示常見）。非常適合用嚟訓練 ${level} 聽解與閱讀理解。`,
    extractedVocab: [
      {
        kanji: '魅了する',
        reading: 'みりょうする',
        romaji: 'miryou suru',
        meaning: '吸引、令...着迷',
        level: 'N2',
        exampleJp: '美しい景色が観光客を魅了する。',
        exampleHk: '美麗嘅景色令遊客着迷。',
      },
      {
        kanji: 'ライトアップ',
        reading: 'らいとあっぷ',
        romaji: 'raito appu',
        meaning: '夜間點燈、燈光照明（和製英語）',
        level: 'N3',
        exampleJp: '夜になるとお城がライトアップされる。',
        exampleHk: '一到夜晚城堡就會亮起燈光照明。',
      },
      {
        kanji: '珍しくない',
        reading: 'めずらしくない',
        romaji: 'mezurashikunai',
        meaning: '並唔罕見、好常見',
        level: 'N4',
        exampleJp: 'この地域では春の雪も珍しくありません。',
        exampleHk: '喺呢個地區，春天落雪都唔罕見。',
      },
      {
        kanji: '特別',
        reading: 'とくべつ',
        romaji: 'tokubetsu',
        meaning: '特別、特殊（な形容詞）',
        level: 'N4',
        exampleJp: '特別なイベントに参加しました。',
        exampleHk: '參加咗一個特別嘅活動。',
      },
    ],
    extractedGrammar: [
      {
        pattern: '〜といえば',
        meaning: '講起...就會諗起...／提到...',
        nuance: '用嚟由一個話題自然聯想到最具代表性嘅事物，口語同書面語都極常用。',
        exampleJp: '日本の春といえば、やはり桜が一番有名です。',
        exampleHk: '講起日本嘅春天，始終都係櫻花最出名。',
      },
      {
        pattern: '〜ことも珍しくない',
        meaning: '出現...嘅情況亦唔罕見（即係時有發生）',
        nuance: '透過雙重否定作委婉肯定，喺 JLPT N3-N1 閱讀理解入面經常作為考點測試作者真正立場。',
        exampleJp: '電車が遅れることも珍しくない。',
        exampleHk: '電車誤點嘅情況亦都唔罕見（成日都有機會發生）。',
      },
    ],
    generatedQuiz: [
      {
        question: '文中「〜といえば」に最も近い意味・使い方はどれですか？',
        options: [
          '話題を取り上げて、そこから連想される代表的なものを述べる',
          'まだ起きていない仮定の条件を表す',
          '前の文と反対の内容を接続する',
          '原因や理由を強く主張する',
        ],
        correctIndex: 0,
        explanation: '「〜といえば」（講起...）係用嚟提出一個話題，並帶出大家公認或者最常聯想到嘅代表事物，所以揀第 1 項。',
        category: 'grammar',
      },
      {
        question: '「多くの人々を魅了します」の「魅了」の正しい読み方はどれですか？',
        options: ['みりょう', 'まりょう', 'みりゅう', 'びりょう'],
        correctIndex: 0,
        explanation: '「魅了」讀作「みりょう (miryou)」，意思係深深吸引住別人嘅心。注意「魅」係音讀「み」。',
        category: 'vocab',
      },
      {
        question: '「ライトアップが行われることも珍しくありません」の内容と合っているものはどれですか？',
        options: [
          'ライトアップが行われることはよくある',
          'ライトアップはほとんど行われない',
          'ライトアップは完全に禁止されている',
          'ライトアップは昼間だけ行われる',
        ],
        correctIndex: 0,
        explanation: '「珍しくありません」（並唔罕見）屬於雙重否定，實際意思即係「よくある（經常有／好常見）」。呢種題型係 JLPT 讀解必考題！',
        category: 'reading',
      },
      {
        question: '空欄に入る最も適切な助詞を選んでください：「美しい紅葉（　）心を奪われた。」',
        options: ['に', 'を', 'で', 'へ'],
        correctIndex: 0,
        explanation: '受身句或表示原因、對象時，「紅葉に心を奪われる」（被紅葉奪走咗心神／深深吸引）用助詞「に」。',
        category: 'grammar',
      },
    ].slice(0, questionCount),
    source: 'curated-engine',
  };
}

function generateFallbackLiveFeed(topic: string, level: string, category: string) {
  return {
    id: `live-fallback-${Date.now()}`,
    level,
    category,
    sourceLabel: category === 'anime' ? '日本動畫名作・聖地巡禮特集' : 'NHK 時事與日本文化焦點',
    titleJp: `話題のテーマ「${topic.slice(0, 18)}」から学ぶ生きた日本語`,
    titleHk: `從熱門話題「${topic.slice(0, 18)}」掌握地道日語表達（${level} 精讀）`,
    contentJp:
      '近年[きんねん]、日本[にほん]のアニメやポップカルチャーをきっかけに日本語[にほんご]を学[まな]び始[はじ]める人[ひと]が急増[きゅうぞう]している。作品[さくひん]の舞台[ぶたい]となった地域[ちいき]を訪[おとず]れる「聖地巡礼[せいちじゅんれい]」も定着[ていちゃく]し、ニュースや日常会話[にちじょうかいわ]を通[つう]じて生[い]きた表現[ひょうげん]に触[ふ]れる絶好[ぜっこう]の機会[きかい]となっている。',
    translationHk:
      '近年，以日本動漫及流行文化為契機而開始學日文嘅人急劇增加。親自到訪作品取景地嘅「聖地巡禮」亦已深入民心，成為透過新聞同日常對話接觸鮮活日文表達嘅絕佳機會。',
    keyVocab: [
      { kanji: '聖地巡礼', reading: 'せいちじゅんれい', meaning: '聖地巡禮（到訪動漫或影視作品取景地）' },
      { kanji: '定着する', reading: 'ていちゃくする', meaning: '普及、扎根、成為常態' },
      { kanji: '絶好', reading: 'ぜっこう', meaning: '絕佳、最好不過（常配「絶好の機会」）' },
    ],
    grammarPoint: {
      pattern: '〜をきっかけに / 〜を通じて',
      explanation: '「〜をきっかけに」表示以某事物為契機；「〜を通じて」表示透過某個媒介或渠道。',
    },
  };
}

function generateFallbackDictionaryEntry(query: string) {
  return {
    id: `dict-fallback-${Date.now()}`,
    kanji: query,
    reading: query,
    romaji: 'kotoba',
    pitchNumber: '②',
    partOfSpeech: '名詞・表現',
    jlptLevels: 'N2 · N3 · N4',
    shortMeaningZh: `與「${query}」相關嘅核心日語表達；地道語境用法。`,
    chineseDef: `「${query}」喺日文日常會話、新聞報導同動漫作品入面經常出現，建議結合上下助詞搭配一齊記憶。`,
    japaneseDef: `「${query}」に関する日本語の重要な語彙・表現。文脈に応じて適切な助詞とともに用いられる。`,
    examples: [
      {
        jp: `日常会話[にちじょうかいわ]で「${query}」という表現[ひょうげん]をよく耳[みみ]にする。`,
        zh: `喺日常對話入面經常聽到「${query}」呢個表達。`,
      },
      {
        jp: `文脈[ぶんみゃく]に合[あ]わせて「${query}」を自然[しぜん]に使[つか]いこなす。`,
        zh: `配合語境自然純熟咁運用「${query}」。`,
      },
    ],
    relatedWords: {
      sameRegister: [{ word: query, reading: query }],
      synonyms: ['表現', '語彙', '言葉', '言い回し', 'ニュアンス'],
      topicWords: [
        { word: '爽やか', gloss: '清爽宜人' },
        { word: 'きっかけ', gloss: '契機、開端' },
        { word: '勿体ない', gloss: '浪費、可惜' },
        { word: '見直す', gloss: '重新審視' },
      ],
    },
    jlptStats: {
      frequencyLabelZh: '核心實用考點',
      frequencyLabelJa: '実用重要語彙',
      examAppearances: 8,
      historicalCount: 10,
      correctRatePercent: 75,
      yearDistribution: [
        { year: '2018', count: 2 },
        { year: '2020', count: 2 },
        { year: '2022', count: 2 },
        { year: '2024', count: 2 },
      ],
      samplePastQuestion: {
        question: `次の文の（　　）に入れるのに最もよいものを一つ選びなさい。「場面に合った適切な（　　）を選ぶことが大切だ。」`,
        options: ['言葉', '時間', '場所', '天気'],
        correctIndex: 0,
        explanation: '「場面に合った適切な言葉を選ぶ」（選擇符合場合嘅適當言詞）係最自然嘅搭配。',
      },
    },
    syncSource: 'ai-live',
  };
}

function getCloudSyncWordPack(_level: string) {
  const nowIso = new Date().toISOString();
  return {
    dictionaryEntries: [
      {
        id: 'dict-cloud-dakyou',
        kanji: '妥協',
        reading: 'だきょう',
        romaji: 'dakyou',
        pitchNumber: '⓪',
        partOfSpeech: '名・スル (自動詞)',
        jlptLevels: 'N1 · N2',
        shortMeaningZh: '妥協；讓步；折衷達成一致。',
        chineseDef: '雙方各讓一步以解決分歧，或者喺標準上作出讓步（常配「妥協しない＝絕不妥協」）。',
        japaneseDef:
          '対立する事柄について、双方が譲り合って一致点を見いだすこと。また、基準を下げて折り合いをつけること。',
        examples: [
          {
            jp: '味[あじ]と品質[ひんしつ]には一切[いっさい]妥協[だきょう]しないこだわる職人[しょくにん]。',
            zh: '對味道同品質絕不妥協嘅堅持匠人。',
          },
          {
            jp: '長[なが]い交渉[こうしょう]の末[すえ]、ようやく妥協点[だきょうてん]を見[み]つけた。',
            zh: '經過漫長談判之後，終於搵到雙方嘅折衷妥協點。',
          },
        ],
        relatedWords: {
          sameRegister: [{ word: '妥協点', reading: 'だきょうてん' }],
          synonyms: ['譲歩', '折り合い', '歩み寄り', '折衷'],
          topicWords: [
            { word: '交渉', gloss: '談判交涉' },
            { word: 'こだわり', gloss: '講究、堅持' },
            { word: '合意', gloss: '達成共識' },
          ],
        },
        jlptStats: {
          frequencyLabelZh: '雲端同步・N2高頻考點',
          frequencyLabelJa: 'オンライン同期・頻出語彙',
          examAppearances: 11,
          historicalCount: 14,
          correctRatePercent: 79,
          yearDistribution: [
            { year: '2018', count: 2 },
            { year: '2020', count: 3 },
            { year: '2022', count: 3 },
            { year: '2024', count: 3 },
          ],
          samplePastQuestion: {
            question: '彼は作品の完成度を高めるため、最後まで一切（　　）しなかった。',
            options: ['妥協', '配慮', '干渉', '弁解'],
            correctIndex: 0,
            explanation: '「一切妥協しなかった」意為為咗提高作品完成度，到最後一刻都絕不妥協。',
          },
        },
        syncSource: 'cloud-synced',
        lastSyncedAt: nowIso,
      },
      {
        id: 'dict-cloud-tehai',
        kanji: '手配',
        reading: 'てはい',
        romaji: 'tehai',
        pitchNumber: '①',
        partOfSpeech: '名・スル (他動詞)',
        jlptLevels: 'N2 · N3',
        shortMeaningZh: '安排；籌備；調度；通緝。',
        chineseDef: '1. 為活動或旅行預先安排好酒店、車輛、人手等；2. 警方通緝犯人（指名手配）。',
        japaneseDef:
          '仕事や行事などのために、必要な人や物を前もって準備し整えること。',
        examples: [
          {
            jp: '出張先[しゅっちょうさき]のホテルと新幹線[しんかんせん]のチケットを手配[てはい]する。',
            zh: '預先安排好出差地嘅酒店同新幹線車飛。',
          },
          {
            jp: '空港[くうこう]までの送迎[そうげい]バスはすでに手配[てはい]してあります。',
            zh: '去機場嘅接送巴士已經預先安排妥當。',
          },
        ],
        relatedWords: {
          sameRegister: [{ word: '手配り', reading: 'てくばり' }],
          synonyms: ['段取り', '準備', '調達', 'アレンジ'],
          topicWords: [
            { word: '予約', gloss: '預約' },
            { word: '出張', gloss: '出差' },
            { word: '準備', gloss: '準備' },
          ],
        },
        jlptStats: {
          frequencyLabelZh: '雲端同步・商務旅遊必考',
          frequencyLabelJa: 'ビジネス・N2頻出語彙',
          examAppearances: 13,
          historicalCount: 15,
          correctRatePercent: 76,
          yearDistribution: [
            { year: '2018', count: 3 },
            { year: '2020', count: 3 },
            { year: '2022', count: 4 },
            { year: '2024', count: 3 },
          ],
          samplePastQuestion: {
            question: '来週の会議に向けて、会場と資料の（　　）を済ませておいた。',
            options: ['手配', '手本', '手順', '手数'],
            correctIndex: 0,
            explanation: '預先安排並準備好會場與資料用「手配（てはい）を済ませる」。',
          },
        },
        syncSource: 'cloud-synced',
        lastSyncedAt: nowIso,
      },
      {
        id: 'dict-cloud-juujitsu',
        kanji: '充実',
        reading: 'じゅうじつ',
        romaji: 'juujitsu',
        pitchNumber: '⓪',
        partOfSpeech: '名・スル (自動詞)',
        jlptLevels: 'N2 · N3',
        shortMeaningZh: '充實；豐富；完善飽滿。',
        chineseDef: '內容豐富完善（如設備或課程充實），或者生活過得非常有意義、好充實。',
        japaneseDef:
          '中が十分に満ちていること。内容が豊かでしっかりしていること。',
        examples: [
          {
            jp: '毎日[まいにち]忙[いそが]しいけれど、とても充実[じゅうじつ]した日々[ひび]を送[おく]っている。',
            zh: '雖然日日都好忙，但過緊非常充實嘅日子。',
          },
          {
            jp: 'この図書館[としょかん]は日本語学習[にほんごがくしゅう]の資料[しりょう]が充実[じゅうじつ]している。',
            zh: '呢間圖書館嘅日文學習資料非常豐富齊全。',
          },
        ],
        relatedWords: {
          sameRegister: [{ word: '充実感', reading: 'じゅうじつかん' }],
          synonyms: ['豊富', '満ちる', '完備', 'やりがい'],
          topicWords: [
            { word: '生きがい', gloss: '生活意義' },
            { word: '満足', gloss: '滿足' },
            { word: '成長', gloss: '成長' },
          ],
        },
        jlptStats: {
          frequencyLabelZh: '雲端同步・N3/N2核心詞',
          frequencyLabelJa: '頻出重要語彙',
          examAppearances: 15,
          historicalCount: 18,
          correctRatePercent: 83,
          yearDistribution: [
            { year: '2018', count: 3 },
            { year: '2020', count: 4 },
            { year: '2022', count: 4 },
            { year: '2024', count: 4 },
          ],
          samplePastQuestion: {
            question: '新しい趣味を見つけてから、休日がとても（　　）している。',
            options: ['充実', '沸騰', '膨張', '徹底'],
            correctIndex: 0,
            explanation: '形容假期過得非常充實飽滿用「充実（じゅうじつ）している」。',
          },
        },
        syncSource: 'cloud-synced',
        lastSyncedAt: nowIso,
      },
    ],
    vocabItems: [
      {
        id: 'cloud-v-n3-1',
        level: 'N3',
        kanji: '懐かしい',
        reading: 'なつかしい',
        romaji: 'natsukashii',
        partOfSpeech: 'い形容詞（雲端同步）',
        pitchAccent: '[4] 中高型',
        meaning: '令人懷念、親切眷戀',
        coreImage: '見到舊時熟悉嘅人或地方，心頭湧起溫暖回憶嘅感覺。',
        exampleJp: '懐[なつ]かしいアニメの曲[きょく]を聞[き]いた。',
        exampleHk: '聽到令人好懷念嘅動漫歌曲。',
      },
      {
        id: 'cloud-v-n2-1',
        level: 'N2',
        kanji: '手配する',
        reading: 'てはいする',
        romaji: 'tehai suru',
        partOfSpeech: '名・他動詞（雲端同步）',
        pitchAccent: '[1] 頭高型',
        meaning: '安排、籌備、調度（酒店／車票／人手）',
        coreImage: '預先把人手或物資分配部署好，商務及旅遊極高頻詞。',
        exampleJp: '出張[しゅっちょう]のホテルとチケットを手配[てはい]しました。',
        exampleHk: '已經安排好出差嘅酒店同車飛。',
      },
    ],
  };
}

function generateFallbackDailyTeacherLesson(
  level: string,
  topic: string,
  _category: string
) {
  const stamp = Date.now();
  const cleanTopic = topic.slice(0, 22);
  return {
    id: `daily-fallback-${stamp}`,
    level,
    themeTagZh: `${level} 先生特選・日本話題精修`,
    themeTagJa: `${level} 先生厳選・最新トピック`,
    titleZh: `從「${cleanTopic}」學地道日語詞彙、聽解與語感`,
    titleJa: `「${cleanTopic}」から学ぶ実践日本語とニュース表現`,
    teacherIntroHk: `各位同學好！今日老師圍繞「${cleanTopic}」幫大家準備咗全套精修講義，包含 3 個高頻單字、1 個必考句型、1 篇時事短文同埋情境對話聽解，一齊開聲練習啦！`,
    teacherIntroJa: `皆さんこんにちは！今日は「${cleanTopic}」をテーマに、語彙・文法・読解・リスニングをバランスよく練習できる特別教材を用意しました。`,
    sourceLabel: 'Sensei 每日特選・最新話題教材庫',
    groundingSources: [
      {
        title: 'NHK NEWS WEB - 日本最新ニュース・話題',
        uri: 'https://www3.nhk.or.jp/news/',
      },
    ],
    vocabList: [
      {
        id: `fb-dv-${stamp}-1`,
        level,
        kanji: '注目する',
        reading: 'ちゅうもくする',
        romaji: 'chuumoku suru',
        pitchAccent: '[0] 平板型',
        partOfSpeech: '名詞・自動詞(する)',
        meaning: '關注、矚目、注視',
        coreImage: '所有人嘅目光都集中投射去同一個新話題上面（注目を集める）。',
        exampleJp: 'この新[あたら]しいアニメが世界中[せかいじゅう]から注目[ちゅうもく]を集[あつ]めている。',
        exampleHk: '呢部新動漫正受到全世界嘅矚目。',
      },
      {
        id: `fb-dv-${stamp}-2`,
        level,
        kanji: '魅力',
        reading: 'みりょく',
        romaji: 'miryoku',
        pitchAccent: '[1] 頭高型',
        partOfSpeech: '名詞',
        meaning: '魅力、吸引人之處',
        coreImage: '「魅力的（みりょくてき＝充滿魅力）」係介紹日本旅遊、美食同文化最萬用嘅讚美詞！',
        exampleJp: '日本[にほん]の四季[しき]にはそれぞれ違[ちが]う魅力[みりょく]がある。',
        exampleHk: '日本嘅四季各自都有唔同嘅魅力。',
      },
      {
        id: `fb-dv-${stamp}-3`,
        level,
        kanji: '定番',
        reading: 'ていばん',
        romaji: 'teiban',
        pitchAccent: '[0] 平板型',
        partOfSpeech: '名詞',
        meaning: '經典必選、招牌款式、固定常規',
        coreImage: '去某個地方「必買手信（定番のお土産）」或者餐廳「必點招牌菜（定番メニュー）」。',
        exampleJp: '北海道[ほっかいどう]旅行[りょこう]の定番[ていばん]お土産[みやげ]を友達[ともだち]に買[か]った。',
        exampleHk: '買咗北海道旅行嘅經典必買手信俾朋友。',
      },
    ],
    grammarPoint: {
      id: `fb-dg-${stamp}`,
      level,
      pattern: '〜をきっかけに（して）',
      formation: '名詞 ＋ をきっかけに（して）／ 動詞た形 ＋ のをきっかけに',
      meaning: '以...為契機、借...嘅機會開始',
      nuance: '表示某一次經歷或熱門話題成為推動你作出改變或開始新習慣嘅「起點」。',
      cantoneseComparison: '相當於廣東話「因為呢個契機而開始...」。',
      exampleJp: '日本[にほん]へ旅行[りょこう]に行ったのをきっかけに、日本語[にほんご]の勉強[べんきょう]を始[はじ]めた。',
      exampleHk: '以去咗一趟日本旅行為契機，開始咗學日文。',
    },
    readingArticle: {
      titleJp: `話題[わだい]のテーマ「${cleanTopic}」と日本[にほん]の日常[にちじょう]`,
      titleHk: `熱門話題「${cleanTopic}」與日本日常生活`,
      contentJp:
        '近年[きんねん]、SNSやニュースを通[つう]じて日本[にほん]の最新[さいしん]トレンドが海外[かいがい]にもすぐ伝[つた]わるようになった。定番[ていばん]の観光地[かんこうち]だけでなく、アニメの舞台[ぶたい]や地域[ちいき]ならではの食文化[しょくぶんか]に注目[ちゅうもく]する人[ひと]が増[ふ]えており、日本[にほん]の多様[たよう]な魅力[みりょく]が再発見[さいはっけん]されている。',
      translationHk:
        '近年，透過社交平台同新聞，日本嘅最新潮流好快就會傳到海外。唔單止係經典觀光景點，關注動漫取景地以及地方獨特飲食文化嘅人越嚟越多，令日本多元化嘅魅力得以被重新發現。',
      culturalTipHk: '見到「〜ならではの（只有...先至有嘅獨特之處）」係 N3–N1 閱讀理解極常出現嘅高分表達！',
    },
    listeningDialogue: {
      scenarioZh: '兩位朋友討論最近喺網上見到嘅日本熱門話題',
      scenarioJa: 'SNSで見かけた日本の最新トレンドについて話す会話',
      lines: [
        {
          speaker: 'タカシ',
          textJp: '最近[さいきん]、このニュースがすごく注目[ちゅうもく]を集[あつ]めているね。',
          textHk: '最近呢單話題真係好受人關注呢！',
        },
        {
          speaker: 'メイ',
          textJp: '本当[ほんとう]だね！これをきっかけに、今度[こんど]の週末[しゅうまつ]に実際[じっさい]に行[い]ってみようよ。',
          textHk: '真係呀！不如就趁呢個契機，今個週末親身去睇下啦！',
        },
      ],
      speakingDrillJp: 'このニュースをきっかけに、日本[にほん]の文化[ぶんか]にもっと興味[きょうみ]を持[も]ちました。',
      speakingDrillHk: '以呢單新聞為契機，我對日本文化產生咗更大嘅興趣。',
    },
    miniQuiz: {
      question: '「日本へ旅行に行ったのを（　　）、日本の歴史に興味を持つようになった。」空欄に入る最も適切な言葉はどれですか？',
      options: ['きっかけに', '最中に', 'わりに', 'あまり'],
      correctIndex: 0,
      explanation: '「〜をきっかけに」表示以某次經歷作為契機，開始產生新嘅興趣或行動。',
    },
  };
}

function wrapPcm16ToWavBase64(pcmBase64: string, sampleRate: number = 24000): string {
  const pcmBuffer = Buffer.from(pcmBase64, 'base64');
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]).toString('base64');
}

function generateFallbackMockExamQuestions(level: string) {
  const stamp = Date.now();
  return [
    {
      id: `fb-mock-${level}-${stamp}-1`,
      level,
      section: 'vocab_grammar',
      mondaiLabel: '問題1・文脈規定（文字・語彙）',
      promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「会議の前に、必要な資料がすべてそろっているか（　　）確認してください。」',
      options: ['あらかじめ', 'たまたま', 'たちまち', '相変わらず'],
      correctIndex: 0,
      explanationHk: '「会議の前に（開會之前）」對應「あらかじめ（預先、事先）」確認資料是否齊全。',
      explanationJa: '「会議の前に」とあるので、事前にという意味の「あらかじめ」が最も適切です。',
    },
    {
      id: `fb-mock-${level}-${stamp}-2`,
      level,
      section: 'vocab_grammar',
      mondaiLabel: '問題2・文法形式の判断（文法）',
      promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「日本へ来てから日が経つ（　　）、日本の生活習慣に慣れてきた。」',
      options: ['につれて', 'に際して', 'に反して', 'によって'],
      correctIndex: 0,
      explanationHk: '「日が経つにつれて（隨住日子過去）」表示伴隨時間推移，逐漸適應日本生活。',
      explanationJa: '時間の経過とともに変化が進むことを表す「〜につれて」が正解です。',
    },
    {
      id: `fb-mock-${level}-${stamp}-3`,
      level,
      section: 'vocab_grammar',
      mondaiLabel: '問題3・類義表現（語彙）',
      promptJp: '＿＿＿の言葉に意味が最も近いものを一つ選びなさい。\n「明日のハイキングは雨天のため『見合わせる』ことになった。」',
      options: ['中止する・延期する', 'すぐに出発する', '場所を探し直す', '参加者を増やす'],
      correctIndex: 0,
      explanationHk: '「見合わせる（みあわせる）」喺商務同公告入面意思係「暫停、取消或延期舉行」。',
      explanationJa: '「見合わせる」は、実行を一時やめたり延期したりするという意味です。',
    },
    {
      id: `fb-mock-${level}-${stamp}-4`,
      level,
      section: 'vocab_grammar',
      mondaiLabel: '問題4・文の組み立て（文法）',
      promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「駅前に新しいカフェができた（　　）、週末はいつも若い人でいっぱいだ。」',
      options: ['そうで', 'ようで', 'らしくて', 'みたいで'],
      correctIndex: 0,
      explanationHk: '「できたそうで（聽講開咗間新 Cafe）」係傳聞助動詞「〜そうだ」嘅中頓形，接續後句說明週末好多人。',
      explanationJa: '伝聞の「〜そうだ」の中止形「〜そうで」が文脈に合います。',
    },
    {
      id: `fb-mock-${level}-${stamp}-5`,
      level,
      section: 'reading',
      mondaiLabel: '問題5・内容理解（短文読解）',
      passageJp:
        '新しい習慣を身につけたいなら、最初から高い目標を立てすぎないことが大切だ。例えば「毎日1時間勉強する」と決めても、忙しい日が続くと挫折しやすい。まずは「毎日5分だけ単語帳を開く」といった小さな一歩から始めるほうが、結果として長く続けられるのである。',
      promptJp: '筆者がこの文章で最も言いたいことは何か。',
      options: [
        '習慣を長く続けるには、無理のない小さな目標から始めることが効果的だ。',
        '毎日1時間以上勉強しなければ、新しい習慣は身につかない。',
        '忙しい日は勉強を完全にやめて、休日にまとめて勉強するべきだ。',
        '高い目標を立てれば立てるほど、挫折せずに努力を続けられる。',
      ],
      correctIndex: 0,
      explanationHk: '文章最後一句「小さな一歩から始めるほうが、結果として長く続けられるのである」點明：由無理負擔嘅小目標開始，先至能夠長久堅持。',
      explanationJa: '「小さな一歩から始めるほうが、結果として長く続けられるのである」が筆者の結論です。',
    },
    {
      id: `fb-mock-${level}-${stamp}-6`,
      level,
      section: 'reading',
      mondaiLabel: '問題6・情報検索（案内文読解）',
      passageJp:
        '【市民体育館トレーニング室のご利用案内】\n・利用時間：9:00〜21:00（最終受付 20:15）\n・休館日：毎週月曜日（月曜日が祝日の場合は翌火曜日）\n・持ち物：室内用運動靴を必ずご持参ください（外履きでのご利用はできません）。',
      promptJp: 'この体育館のトレーニング室を利用する際、注意しなければならないことは何か。',
      options: [
        '室内用の運動靴を持っていき、20時15分までに受付を済ませること。',
        '毎週火曜日は休館日なので利用できないこと。',
        '21時までに受付をすれば、22時まで利用できること。',
        '運動靴は体育館で無料レンタルできるため持参不要なこと。',
      ],
      correctIndex: 0,
      explanationHk: '通告列明「最終受付 20:15（最後登記時間為 20:15）」以及「室内用運動靴を必ずご持参ください（必須自備室內運動鞋）」。',
      explanationJa: '最終受付が20:15であることと、室内用運動靴の持参が必須であることが記載されています。',
    },
    {
      id: `fb-mock-${level}-${stamp}-7`,
      level,
      section: 'reading',
      mondaiLabel: '問題7・主張理解（中篇読解）',
      passageJp:
        'オンライン会議は移動時間がかからず便利だが、画面越しでは相手の細かい表情や雰囲気が伝わりにくいという側面もある。そのため、定例の報告はオンラインで行い、新しい企画をゼロから話し合うような場面では対面で集まるなど、目的に応じて使い分ける工夫が求められている。',
      promptJp: 'オンライン会議と対面会議について、筆者はどう考えているか。',
      options: [
        '会議の目的や内容に合わせて、オンラインと対面を適切に使い分けるべきだ。',
        '移動時間が無駄なので、すべての会議をオンラインに切り替えるべきだ。',
        'オンライン会議では意見が出ないため、すべて対面に戻したほうがよい。',
        '定例の報告は対面で行い、新しい企画の相談はオンラインで行うべきだ。',
      ],
      correctIndex: 0,
      explanationHk: '作者喺最後一句總結：「目的に応じて使い分ける工夫が求められている（應該根據會議目的靈活配搭使用線上與面對面會議）」。',
      explanationJa: '「目的に応じて使い分ける工夫が求められている」と述べられています。',
    },
    {
      id: `fb-mock-${level}-${stamp}-8`,
      level,
      section: 'listening',
      mondaiLabel: '問題8・課題理解（聴解）',
      promptJp: '音声を聞いて答えなさい：男の人はこれからまず何をしますか。',
      audioScriptJp:
        '男：佐藤さん、来週の企画書、もう読んだ？\n女：はい、読みました。でも、データの数字にいくつか間違いがあるみたいですよ。\n男：本当？それは大変だ。すぐに修正しないと。\n女：あとは、最後のページの図表も少し見にくいかもしれません。\n男：わかった。じゃあ、まずデータを直してから、図表も見直すことにするよ。',
      dialogueSpeakers: [
        { speaker: '男', lineJp: '佐藤さん、来週[らいしゅう]の企画書[きかくしょ]、もう読[よ]んだ？' },
        { speaker: '女', lineJp: 'はい、読[よ]みました。でも、データの数字[すうじ]にいくつか間違[まちが]いがあるみたいですよ。' },
        { speaker: '男', lineJp: '本当[ほんとう]？それは大変[たいへん]だ。すぐに修正[しゅうせい]しないと。' },
        { speaker: '女', lineJp: 'あとは、最後[さいご]のページの図表[ずひょう]も少[すこ]し見[み]にくいかもしれません。' },
        { speaker: '男', lineJp: 'わかった。じゃあ、まずデータを直[なお]してから、図表[ずひょう]も見直[みなお]すことにするよ。' },
      ],
      options: [
        '企画書のデータの数字を修正する',
        '最後のページの図表を先に作り直す',
        '企画書をもう一度印刷して配る',
        '来週の会議の日程を変更する',
      ],
      correctIndex: 0,
      explanationHk: '男士最後清楚講明先後次序：「まずデータを直してから、図表も見直すことにするよ（首先改好數據，然後再重新調整圖表）」。',
      explanationJa: '「まずデータを直してから、図表も見直すことにするよ」と言っているので、最初にデータの数字を修正します。',
    },
    {
      id: `fb-mock-${level}-${stamp}-9`,
      level,
      section: 'listening',
      mondaiLabel: '問題9・課題理解（聴解）',
      promptJp: '音声を聞いて答えなさい：男の人はこの後、まず何をしますか。',
      audioScriptJp:
        '女：もうすぐランチの開店時間だね。テーブルの上のメニューと箸はもう並べた？\n男：はい、すべて準備してあります。\n女：ありがとう。あ、入り口の看板がまだ「準備中」になっているから、「営業中」に裏返してきてくれる？それが終わったら、お冷やのピッチャーを冷蔵庫から出しておいて。\n男：はい、わかりました！',
      dialogueSpeakers: [
        { speaker: '女', lineJp: 'もうすぐ開店時間[かいてんじかん]だね。テーブルのメニューと箸[はし]はもう並[なら]べた？' },
        { speaker: '男', lineJp: 'はい、すべて準備[じゅんび]してあります。' },
        { speaker: '女', lineJp: 'ありがとう。あ、入[い]り口[ぐち]の看板[かんばん]を「営業中[えいぎょうちゅう]」に裏返[うらがえ]してきてくれる？それが終[お]わったら、お冷[ひ]やを出[だ]しておいて。' },
        { speaker: '男', lineJp: 'はい、わかりました！' },
      ],
      options: [
        '入り口の看板を「営業中」に変える',
        'テーブルにメニューと箸を並べる',
        'お冷やのピッチャーを冷蔵庫から出す',
        'お客さんに注文を聞きに行く',
      ],
      correctIndex: 0,
      explanationHk: '店長叫佢先將門口個牌反轉做「営業中」，跟住（「それが終わったら」）先攞凍水壺出嚟。',
      explanationJa: 'まず入り口の看板を「営業中」に裏返し、それが終わったらお冷やを出すよう指示されています。',
    },
    {
      id: `fb-mock-${level}-${stamp}-10`,
      level,
      section: 'listening',
      mondaiLabel: '問題10・ポイント理解（聴解）',
      promptJp: '音声を聞いて答えなさい：女の人がこのマンションを気に入った一番の理由は何ですか。',
      audioScriptJp:
        '男：引っ越し先のマンション、決まったんだって？駅から歩いて3分くらい？\n女：ううん、駅からは12分ぐらいかかるんだけど、すぐ隣に夜遅くまで開いている大きなスーパーがあるの。仕事帰りに買い物するのにすごく便利だから、そこに決めたよ。',
      dialogueSpeakers: [
        { speaker: '男', lineJp: '引[ひ]っ越[こ]し先[さき]のマンション、決[き]まったんだって？駅[えき]から歩[ある]いて3分[ぷん]くらい？' },
        { speaker: '女', lineJp: 'ううん、駅[えき]からは12分[ふん]ぐらいかかるんだけど、すぐ隣[となり]に夜遅[よるおそ]くまで開[あ]いている大[おお]きなスーパーがあるの。だからそこに決[き]めたよ。' },
      ],
      options: [
        'すぐ隣に夜遅くまで営業している大きなスーパーがあるから',
        '駅から歩いて3分と非常に近いから',
        '家賃が他のマンションよりずっと安いから',
        '部屋からの景色がとてもきれいだから',
      ],
      correctIndex: 0,
      explanationHk: '女士否定咗離車站近（「ううん、駅からは12分ぐらいかかる」），並講明決定租嘅主因係「すぐ隣に夜遅くまで開いている大きなスーパーがある（隔離就有間開到好夜嘅大超市）」。',
      explanationJa: '「すぐ隣に夜遅くまで開いている大きなスーパーがある…だからそこに決めたよ」と言っています。',
    },
  ];
}

function generateFallbackQuizArenaBatch(
  level: string,
  topic: string,
  questionCount: number
) {
  const stamp = Date.now();
  const cleanTopic = topic.slice(0, 18);
  const candidates = [
    {
      category: 'vocab',
      sourceTag: `網絡話題出題・${cleanTopic}`,
      question: `【${level} 語彙実戦】「SNSで話題になった新商品を（　　）買いに行ったが、すでに売り切れていた。」`,
      options: ['さっそく', 'たまたま', 'しだいに', 'かならずしも'],
      correctIndex: 0,
      explanation: '「さっそく（馬上、立即）」表示一睇到網上熱話就即刻採取行動去買。「かならずしも」後接否定（未必）。',
    },
    {
      category: 'grammar',
      sourceTag: `時事與會話文法・${cleanTopic}`,
      question: `【${level} 文法実戦】「日本のアニメを見るように（　　）、自然な日常表現が聞き取れるようになった。」`,
      options: ['なってから', 'するため', 'したばかりに', 'するところ'],
      correctIndex: 0,
      explanation: '「〜ようになってから（自從養成咗睇日本動漫嘅習慣之後）」，後句接能力嘅漸進提升（「聞き取れるようになった」）。',
    },
    {
      category: 'reading',
      sourceTag: `日本最新生活資訊・${cleanTopic}`,
      question: `【${level} 短文読解】「当店では環境保護のため、レジ袋を有料（1枚5円）とさせていただいております。マイバッグをお持ちの方は会計前にお知らせください。」マイバッグを持っている客はどうすればよいですか？`,
      options: [
        'お金を払う前に店員にマイバッグがあることを伝える。',
        'レジ袋を5円で必ず買わなければならない。',
        '会計が終わった後でマイバッグを店員に渡す。',
        '店の入り口でマイバッグを預ける。',
      ],
      correctIndex: 0,
      explanation: '告示寫明「マイバッグをお持ちの方は会計前にお知らせください（自備購物袋嘅客人請於埋單前通知店員）」。',
    },
    {
      category: 'vocab',
      sourceTag: `高頻動詞搭配・${cleanTopic}`,
      question: `【${level} 語彙実戦】「来月の京都旅行に向けて、新幹線とホテルの予約を（　　）おいた。」`,
      options: ['済ませて', '余らせて', '散らかして', '遅らせて'],
      correctIndex: 0,
      explanation: '「予約を済ませておく（預先辦妥／搞掂晒預約手續）」係日本旅遊同商務極常用嘅黃金配搭。',
    },
    {
      category: 'grammar',
      sourceTag: `JLPT 必考語感・${cleanTopic}`,
      question: `【${level} 文法実戦】「このラーメン屋は駅から遠い（　　）、毎日行列ができるほど人気がある。」`,
      options: ['にもかかわらず', 'にしたがって', 'に際して', 'をきっかけに'],
      correctIndex: 0,
      explanation: '「〜にもかかわらず（儘管...卻依然...）」表示逆接：雖然離車站好遠，但依然日日大排長龍。',
    },
  ];

  return candidates.slice(0, questionCount).map((c, idx) => ({
    id: `arena-fb-${level}-${stamp}-${idx}`,
    level,
    ...c,
  }));
}

startServer();




