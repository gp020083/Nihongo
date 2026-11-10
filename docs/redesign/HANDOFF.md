# Handoff：由舊對話接手 Kotonoha 重新設計

> 新對話開始時請先讀呢個檔，再讀 [PRODUCT_REVIEW.md](./PRODUCT_REVIEW.md)。

## 來源
- 舊對話 ID：`bbca4ffc-8430-4bbc-9a79-5c0f657c8c39`，日期 2026-11-10
- 對話紀錄：`C:\Users\bensh\.gemini\antigravity\brain\bbca4ffc-8430-4bbc-9a79-5c0f657c8c39\.system_generated\logs\transcript.jsonl`

## 已完成
1. 由 GitHub `https://github.com/gp020083/Nihongo` clone 到 `C:\Users\bensh\.gemini\antigravity\scratch\Nihongo`；呢個 repo 係用 Google AI Studio Build 整嘅。
2. `npm install --legacy-peer-deps`：一定要加呢個參數，因為 `esbuild@^0.25` 同 Vite 8 版本衝突。
3. `npm run dev` 會行 `tsx server.ts`，開喺 `http://localhost:3000`。
4. 冇 `.env`，所以冇 `GEMINI_API_KEY`；AI 功能會用 server.ts 入面嘅離線 fallback。
5. 做咗完整產品檢討，結果喺 `PRODUCT_REVIEW.md`；改版前截圖喺 `screenshots-before/`，截圖腳本係 `screenshots-before/shots.mjs`，用 `playwright-core` 加系統 Chrome。

## 用家要求
> 「我覺得依家我個日文自學平台太多資訊太亂，你幫我重新 design 過，所有嘢都 review 一下，除咗外觀都睇埋內容。你當自己係日文學習者，而呢個平台係一個產品，諗下有咩問題、點改善、點優化。」

## 主要發現
- 每個分頁頂部有約 2,100 至 2,500px 嘅設定區；手機首頁約 13,000px 長；第一個畫面冇任何學習內容。
- 7 個分頁，其中 4 個都係做題。
- 核心教材每級得 4 個生字、2 個文法；全 app 約 110 個詞。
- 字卡唔遮答案；有 `nextReviewAt` 但冇「今日到期」畫面。
- 「NHK 真人主播」聲線其實係非官方 TikTok TTS 同 Google Translate 接口。
- `/api/ai/*` 冇驗證；擁有者門禁只喺前端 localStorage。

## 等緊用家決定
1. 自己用定公開？
2. 預設中文介面？
3. 感情試聽室、Antigravity 技能同步、Google Drive：刪、收入實驗室，定保留？
4. 由第 1 階段「減法同導航」開始？
5. 改完推 GitHub 同 AI Studio，定部署 Vercel？

## 注意
- 未 commit 任何嘢；`docs/redesign/` 係新加嘅檔案。
- 用家規則：文件少用括號；完成嘅 `.html/.pdf/.xlsx` 要用 `Start-Process` 喺外部軟件打開。
