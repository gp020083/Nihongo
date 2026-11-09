import { JlptLevel } from '../utils/srsEngine';

export type UiLang = 'bilingual' | 'zh' | 'ja';

/**
 * Formats Chinese and Japanese text according to the active UI language mode.
 * In 'bilingual' mode (the default), both Chinese and Japanese are displayed side-by-side.
 */
export function formatBilingual(
  zh: string,
  ja: string,
  uiLang: UiLang = 'bilingual',
  separator: string = ' · '
): string {
  if (uiLang === 'zh') return zh;
  if (uiLang === 'ja') return ja;
  if (zh === ja) return zh;
  return `${zh}${separator}${ja}`;
}


export interface ListeningExercise {
  id: string;
  level: JlptLevel;
  category: 'daily' | 'news' | 'anime' | 'business';
  titleZh: string;
  titleJa: string;
  scenarioZh: string;
  scenarioJa: string;
  dialogueLines: Array<{
    speaker: string;
    textJp: string; // with furigana brackets
    textHk: string;
  }>;
  questionJp: string;
  questionHk: string;
  options: string[];
  correctIndex: number;
  explanationZh: string;
  explanationJa: string;
}

export interface SpeakingPrompt {
  id: string;
  level: JlptLevel;
  contextTagZh: string;
  contextTagJa: string;
  situationZh: string;
  situationJa: string;
  targetJp: string; // with furigana brackets
  romaji: string;
  meaningHk: string;
  pitchTipZh: string;
  pitchTipJa: string;
}

export interface CulturalFeedItem {
  id: string;
  level: JlptLevel;
  category: 'news' | 'anime' | 'culture';
  sourceLabel: string;
  titleJp: string;
  titleHk: string;
  contentJp: string; // with furigana brackets
  translationHk: string;
  keyVocab: Array<{
    kanji: string;
    reading: string;
    meaning: string;
  }>;
  grammarPoint: {
    pattern: string;
    explanation: string;
  };
  sourceUrl?: string;
}

export interface DictionaryDetailEntry {
  id: string;
  kanji: string;
  reading: string;
  romaji: string;
  pitchNumber: string; // e.g. '②', '⓪', '①'
  partOfSpeech: string; // e.g. '形動', '名・スル', '五他'
  jlptLevels: string; // e.g. 'N2 · N3 · N4'
  shortMeaningZh: string;
  chineseDef: string;
  japaneseDef: string;
  examples: Array<{
    jp: string; // with furigana brackets
    zh: string;
  }>;
  relatedWords: {
    sameRegister: Array<{ word: string; reading: string }>;
    synonyms: string[];
    topicWords: Array<{ word: string; gloss: string }>;
  };
  jlptStats: {
    frequencyLabelZh: string;
    frequencyLabelJa: string;
    examAppearances: number;
    historicalCount: number;
    correctRatePercent: number;
    yearDistribution: Array<{ year: string; count: number }>;
    samplePastQuestion: {
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    };
  };
}

export const LISTENING_DATABASE: ListeningExercise[] = [
  {
    id: 'lis-n5-1',
    level: 'N5',
    category: 'daily',
    titleZh: '車站月台與便利店買飛詢問',
    titleJa: '駅のホームとコンビニでの会話',
    scenarioZh: '喺東京山手線車站，男學生向站務員確認去澀谷嘅月台號碼同開車時間。',
    scenarioJa: '駅のホームで、男子学生が駅員に渋谷行きのホーム番号と発車時刻を尋ねています。',
    dialogueLines: [
      {
        speaker: '学生',
        textJp: 'すみません、渋谷[しぶや]へ行[い]く電車[でんしゃ]は何番線[なんばんせん]ですか。',
        textHk: '唔該請問一下，去澀谷嘅電車係幾號月台呀？',
      },
      {
        speaker: '駅員',
        textJp: '渋谷[しぶや]行[ゆ]きは3番線[ばんせん]ですよ。あと5分[ふん]ぐらいで来[き]ます。',
        textHk: '去澀谷嘅車喺 3 號月台呀。再過 5 分鐘左右就會到。',
      },
      {
        speaker: '学生',
        textJp: 'ありがとうございます。急[いそ]いで行[い]きます！',
        textHk: '唔該晒你！我即刻趕過去先！',
      },
    ],
    questionJp: '学生はこのあと、何番線のホームへ行きますか？',
    questionHk: '男學生聽完之後會去幾號月台？',
    options: ['3番線', '5番線', '1番線', '2番線'],
    correctIndex: 0,
    explanationZh: '站務員明確講咗「渋谷行きは3番線ですよ（去澀谷喺3號月台）」，「5分」係再過五分鐘開車嘅時間陷阱！',
    explanationJa: '駅員が「渋谷行きは3番線ですよ」と答えています。「5分」は発車までの待ち時間です。',
  },
  {
    id: 'lis-n4-1',
    level: 'N4',
    category: 'daily',
    titleZh: '診所預約改期電話聽解',
    titleJa: 'クリニックの予約変更の電話',
    scenarioZh: '女士打電話去牙科診所，想將原本禮拜三下晝嘅預約改去禮拜五朝早。',
    scenarioJa: '女性が歯科クリニックに電話をして、水曜日の午後の予約を変更しようとしています。',
    dialogueLines: [
      {
        speaker: '受付',
        textJp: 'はい、さくら歯科[しか]でございます。',
        textHk: '你好，呢度係櫻花牙科診所。',
      },
      {
        speaker: '女性',
        textJp: '今週[こんしゅう]の水曜日[すいようび]に予約[よやく]している田中[たなか]ですが、急用[きゅうよう]が入[はい]ってしまいまして、金曜日[きんようび]の午前中[ごぜんちゅう]に変[か]えていただけますか。',
        textHk: '我係預約咗今個禮拜三嘅田中，因為突然有急事，請問可唔可以幫我改去禮拜五朝早呢？',
      },
      {
        speaker: '受付',
        textJp: '金曜日[きんようび]ですね。午前[ごぜん]10時[じ]は埋[う]まっておりますが、11時[じ]なら空[あ]いております。',
        textHk: '禮拜五係嗎。朝早 10 點已經滿咗，不過 11 點就有空位。',
      },
      {
        speaker: '女性',
        textJp: 'では、その時間[じかん]でお願[ねが]いします。',
        textHk: '咁就麻煩晒幫我約嗰個時間啦。',
      },
    ],
    questionJp: '田中さんの新しい予約はいつになりましたか？',
    questionHk: '田中小姐最終改咗去邊個時間睇牙？',
    options: [
      '金曜日の午前11時',
      '金曜日の午前10時',
      '水曜日の午前11時',
      '木曜日の午後2時',
    ],
    correctIndex: 0,
    explanationZh: '接待員表示禮拜五 10 點已滿（埋まっております），但 11 點有空位（空いております），田中答「その時間でお願いします」。',
    explanationJa: '金曜日の10時は埋まっているため、空いている11時に予約を変更しました。',
  },
  {
    id: 'lis-n3-1',
    level: 'N3',
    category: 'anime',
    titleZh: '動畫熱血名場面聽解：學園祭樂團決心',
    titleJa: 'アニメ名場面：文化祭ライブ前の会話',
    scenarioZh: '喺日本青春動畫常見嘅學園祭前夕，主音同結他手喺天台傾緊上台前緊張嘅心情。',
    scenarioJa: '文化祭のステージ直前、ボーカルとギターの部員が屋上で話しています。',
    dialogueLines: [
      {
        speaker: '悠真',
        textJp: '手が震[ふる]えてるよ。やっぱりこれだけ大勢[おおぜい]の観客[かんきゃく]の前[まえ]だと緊張[きんちょう]するな。',
        textHk: '隻手震緊添。果然面對咁多觀眾都係會好緊張呢。',
      },
      {
        speaker: '葵',
        textJp: 'ここまで毎日[まいにち]一緒[いっしょ]に練習[れんしゅう]してきたじゃない。失敗[しっぱい]したっていいから、最後[さいご]まで楽[たの]しもう！',
        textHk: '我哋唔係日日都一齊練到今日咩！就算失手都唔緊要，最緊要享受到最後一刻呀！',
      },
      {
        speaker: '悠真',
        textJp: 'そうだな。後悔[こうかい]しないように、全力[ぜんりょく]をぶつけよう！',
        textHk: '講得啱。為咗唔好留低後悔，我哋傾盡全力衝上去啦！',
      },
    ],
    questionJp: '女の人が一番伝えたいことは何ですか？',
    questionHk: '女角（葵）最想鼓勵對方嘅核心意思係咩？',
    options: [
      '結果や失敗を恐れずに、ステージを精一杯楽しむこと',
      '緊張しているから今日のライブを中止すること',
      'もっと練習してから来年の文化祭に出ること',
      '観客が少ない別の会場に変えること',
    ],
    correctIndex: 0,
    explanationZh: '口語「〜してきたじゃない（唔係一直一齊練過嚟咩！）」加上「失敗したっていいから、最後まで楽しもう（就算失敗都唔緊要，享受到最後啦）」。',
    explanationJa: '「失敗したっていいから、最後まで楽しもう」と励ましている点がポイントです。',
  },
  {
    id: 'lis-n2-1',
    level: 'N2',
    category: 'news',
    titleZh: 'NHK 新聞聽解：インバウンド観光與地方創生',
    titleJa: 'ニュース聴解：訪日客の地方分散と課題',
    scenarioZh: '新聞主播報導訪日外國遊客創下新高，以及日本地方城市如何透過體驗型旅遊吸引遊客。',
    scenarioJa: 'ニュースキャスターが訪日外国人旅行者の増加と地方誘客の取り組みを伝えています。',
    dialogueLines: [
      {
        speaker: 'キャスター',
        textJp: '円安[えんやす]を背景[はいけい]に訪日客[ほうにちきゃく]が急増[きゅうぞう]する中[なか]、都市部[としぶ]への過度[かど]な集中[しゅうちゅう]を解消[かいしょう]するため、地方自治体[ちほうじちたい]では伝統工芸[でんとうこうげい]や農業体験[のうぎょうたいけん]を組[く]み込[こ]んだツアーの造成[ぞうせい]に力[ちから]を入[い]れています。',
        textHk: '喺日圓貶值帶動訪日旅客急增嘅背景下，為咗紓緩大城市過度擠逼嘅情況，各地方政府正大力開發結合傳統工藝與農業體驗嘅深度遊行程。',
      },
    ],
    questionJp: '地方自治体が体験型ツアーに力を入れている主な目的は何ですか？',
    questionHk: '地方政府大力推動體驗型旅遊嘅主要目的係咩？',
    options: [
      '大都市に集中している観光客を地方へ呼び込むため',
      '都市部のホテルの宿泊料金をさらに引き上げるため',
      '外国人旅行者の日本への入国数を制限するため',
      '伝統工芸品の海外への輸出を禁止するため',
    ],
    correctIndex: 0,
    explanationZh: '新聞關鍵句「都市部への過度な集中を解消するため（為咗解決遊客過度集中喺大城市嘅問題）」，從而引導旅客分流去地方城市。',
    explanationJa: '「都市部への過度な集中を解消するため」という目的表現を聞き取ることが重要です。',
  },
  {
    id: 'lis-n1-1',
    level: 'N1',
    category: 'business',
    titleZh: '企業高層會議聽解：AI 導入與組織改革',
    titleJa: '経営会議：生成AI導入に伴う業務プロセスの再構築',
    scenarioZh: '部門主管喺董事會報告引入生成式 AI 後，點樣將人手轉移去高附加價值嘅創意決策工作。',
    scenarioJa: '経営会議で部長が新システム導入後の人材配置について説明しています。',
    dialogueLines: [
      {
        speaker: '部長',
        textJp: '単[たん]なるコスト削減[さくげん]にとどまらず、定型業務[ていけいぎょうむ]を自動化[じどうか]することで捻出[ねんしゅつ]された時間[じかん]を、新規事業[しんきじぎょう]の企画[きかく]や顧客[こきゃく]との対話[たいわ]といった創造的[そうぞうてき]な領域[りょういき]へ振[ふ]り向[む]けることこそが、本改革[ほんかいかく]の要諦[ようてい]であります。',
        textHk: '今次改革嘅真正精髓（要諦），絕唔單止停留喺削減成本，而係將常規工作自動化後騰出嚟嘅時間，重新投放喺新業務企劃同客戶深度溝通呢類具創造力嘅領域之上。',
      },
    ],
    questionJp: '部長が述べる「本改革の要諦（最も重要な点）」とは何ですか？',
    questionHk: '部長強調今次改革最核心嘅關鍵（要諦）係咩？',
    options: [
      '自動化で生まれた時間を創造的な業務や顧客対応に充てること',
      '経費を削減するために新規事業の立ち上げを凍結すること',
      'すべての社員の業務を定型作業のみに統一すること',
      '顧客との直接の対話を減らしてシステム管理に専念すること',
    ],
    correctIndex: 0,
    explanationZh: 'N1 聽解高頻句型「〜にとどまらず、〜ことこそが...の要諦（精髓）であります」：將騰出（捻出）嘅時間轉投去創造性領域。',
    explanationJa: '「単なるAにとどまらず、Bことこそが要諦（かなめ）である」という強調構文が鍵です。',
  },
];

export const SPEAKING_PROMPTS: SpeakingPrompt[] = [
  {
    id: 'spk-n5-1',
    level: 'N5',
    contextTagZh: '日本餐廳點餐',
    contextTagJa: 'レストランでの注文',
    situationZh: '入到日本居酒屋或 Cafe，禮貌咁請店員俾水同埋點一份抹茶蛋糕。',
    situationJa: 'カフェで店員にお水と抹茶ケーキを丁寧に注文しましょう。',
    targetJp: 'すみません、お水[みず]とこの抹茶[まっちゃ]ケーキをください。',
    romaji: 'Sumimasen, omizu to kono maccha keeki wo kudasai.',
    meaningHk: '唔該，請俾杯水同埋呢件抹茶蛋糕我。',
    pitchTipZh: '「すみません」尾音「せん」微微上揚再平收；「ください」重音喺「さ」，語尾柔和。',
    pitchTipJa: '「ください」の語尾を優しく発音すると、とても自然な印象になります。',
  },
  {
    id: 'spk-n4-1',
    level: 'N4',
    contextTagZh: '交通遲到聯絡',
    contextTagJa: '待ち合わせの連絡',
    situationZh: '同日本朋友約咗見面，但因為電車延誤會遲少少，即刻跟讀呢句地道道歉加預計到達時間。',
    situationJa: '電車の遅延で少し遅れることを友達に伝えましょう。',
    targetJp: '電車[でんしゃ]が遅[おく]れていて、あと10分[ぷん]で着[つ]きます。',
    romaji: 'Densha ga okurete ite, ato juppun de tsukimasu.',
    meaningHk: '架電車誤點緊，我再過 10 分鐘就會到。',
    pitchTipZh: '注意「10分」讀作促音「じゅっぷん (juppun)」，「ていて」連讀要順暢。',
    pitchTipJa: '「10分（じゅっぷん）」の促音（っ）のリズムをはっきり発音しましょう。',
  },
  {
    id: 'spk-n3-1',
    level: 'N3',
    contextTagZh: '動漫日常感嘆',
    contextTagJa: '日常・アニメ表現',
    situationZh: '朝早起身打開窗，見到天氣好清爽，忍唔住想出街散步（對應字典重點詞「爽やか」）。',
    situationJa: '朝の爽やかな空気を感じて、散歩に出かけたくなる気持ちを表現しましょう。',
    targetJp: '朝[あさ]の空気[くうき]が爽[さわ]やかで、散歩[さんぽ]に出[で]かけたくなった。',
    romaji: 'Asa no kuuki ga sawayaka de, sanpo ni dekaketaku natta.',
    meaningHk: '朝早嘅空氣好清爽宜人，搞到我都想出門散下步添。',
    pitchTipZh: '「爽やか [2]」重音喺「わ (sa-WA-ya-ka)」，之後立即下降，千祈唔好讀成平板音！',
    pitchTipJa: '「爽やか」は「わ」にアクセント（②型）があります。',
  },
  {
    id: 'spk-n2-1',
    level: 'N2',
    contextTagZh: '日本職場商務會議',
    contextTagJa: 'ビジネス会議・提案',
    situationZh: '喺日本公司開會時，委婉但專業咁提出需要由根本重新檢視目前嘅專案計劃。',
    situationJa: '会議で、現在の計画を見直す必要があることを丁寧に提案しましょう。',
    targetJp: 'この計画[けいかく]は根本[こんぽん]から見直[みなお]す必要[ひつよう]があります。',
    romaji: 'Kono keikaku wa konpon kara minaosu hitsuyou ga arimasu.',
    meaningHk: '呢個計劃有必要由根本重新審視檢討。',
    pitchTipZh: '「根本（こんぽん）」係頭高型 [1]，「こ」字高音後向下落，顯得穩重有說服力。',
    pitchTipJa: '「根本（こんぽん）」の頭高アクセントを意識すると説得力が増します。',
  },
  {
    id: 'spk-n1-1',
    level: 'N1',
    contextTagZh: '高階演講與評論',
    contextTagJa: 'プレゼン・公式スピーチ',
    situationZh: '喺正式場合發表評論，表達對技術革新同未來發展趨勢嘅深刻見解。',
    situationJa: '技術革新の波と企業の適応について格調高く述べましょう。',
    targetJp: '時代[じだい]の変化[へんか]に応[おう]じて、柔軟[じゅうなん]な措置[そち]を講[こう]じるべきだ。',
    romaji: 'Jidai no henka ni oujite, juunan na sochi wo koujiru beki da.',
    meaningHk: '應該順應時代嘅變化，採取靈活嘅應對措施。',
    pitchTipZh: '「措置（そち）[1]」同「講じる（こうじる）[0]」連讀時注意助詞「を」輕讀過渡。',
    pitchTipJa: '「措置（そち）」は頭高①型、「講じる」は平板⓪型で滑らかにつなげます。',
  },
];

export const CULTURAL_FEEDS: CulturalFeedItem[] = [
  {
    id: 'feed-anime-1',
    level: 'N3',
    category: 'anime',
    sourceLabel: '日本動畫名台詞・聖地巡禮專題',
    titleJp: 'アニメ『君の名は。』と新海誠作品に学ぶ「運命と時間」の日本語表現',
    titleHk: '從《你的名字。》與新海誠動畫學懂「命運與羈絆」嘅日文地道語感',
    contentJp:
      '朝[あさ]、目[め]が覚[さ]めると、なぜか泣[な]いている。そういうことが時々[ときどき]ある。見[み]ていたはずの夢[ゆめ]は、いつも思[おも]い出[だ]せない。ただ、何かが消[き]えてしまったという感覚[かんかく]だけが、目覚[めざ]めてからも長[なが]く残[のこ]る。大切[たいせつ]な人[ひと]を忘[わす]れたくないという気持[きも]ちが、言葉[ことば]を超[こ]えて心[こころ]を揺[ゆ]さぶる。',
    translationHk:
      '朝早醒來嗰陣，唔知點解流緊眼淚。有時總係會發生咁嘅事。明明應該發過嘅夢，總係諗唔返起。唯獨係「有啲好重要嘅嘢消失咗」呢種感覺，喺醒咗之後依然留存好耐。嗰種「唔想忘記重要嘅人」嘅心情，超越言語深深震撼人心。',
    keyVocab: [
      { kanji: '目が覚める', reading: 'めがさめる', meaning: '醒來、睡醒（自動詞片語）' },
      { kanji: '感覚', reading: 'かんかく', meaning: '感覺、直覺感受' },
      { kanji: '揺さぶる', reading: 'ゆさぶる', meaning: '動搖、深深震撼（人心）' },
    ],
    grammarPoint: {
      pattern: '〜ていたはずの＋名詞',
      explanation: '「はず（按道理應該...）」修飾名詞，表達「明明應該發過嘅夢，但偏偏記唔起」嘅遺憾語感。',
    },
  },
  {
    id: 'feed-news-1',
    level: 'N2',
    category: 'news',
    sourceLabel: '日本文化與科技時事熱話',
    titleJp: '日本のコンビニ進化論：AI無人レジと外国人スタッフ活躍の舞台裏',
    titleHk: '日本便利店進化論：AI 自助收銀與多語種服務背後嘅社會趨勢',
    contentJp:
      '日本[にほん]のコンビニエンスストアは、単[たん]なる小売店[こうりてん]の枠[わく]を超[こ]え、社会[しゃかい]のインフラとして機能[きのう]している。近年[きんねん]は深刻[しんこく]な人手不足[ひとでぶそく]を背景[はいけい]に、AIカメラを活用[かつよう]したセルフレジの導入[どうにゅう]が進[すす]む一方[いっぽう]で、温[あたた]かみのある接客[せっきゃく]を求める声[こえ]も根強[ねづよ]い。',
    translationHk:
      '日本嘅便利店已經超越咗單純零售店嘅框架，作為社會基礎設施運作緊。近年喺人手嚴重不足嘅背景下，雖然善用 AI 鏡頭嘅自助收銀機不斷普及，但另一方面，渴望保留有人情味待客服務嘅聲音依然根深蒂固。',
    keyVocab: [
      { kanji: '枠を超える', reading: 'わくをこえる', meaning: '超越框架、突破界限' },
      { kanji: '人手不足', reading: 'ひとでぶそく', meaning: '人手不足、勞動力短缺' },
      { kanji: '根強い', reading: 'ねづよい', meaning: '根深蒂固、依然強勁' },
    ],
    grammarPoint: {
      pattern: '〜一方で（〜いっぽうで）',
      explanation: '表示同一事物嘅兩個面向對比：一方面科技自動化不斷推進，另一方面傳統人情味需求依然強勁。',
    },
  },
  {
    id: 'feed-culture-1',
    level: 'N4',
    category: 'culture',
    sourceLabel: '京都四季與日本生活美學',
    titleJp: '夏の風物詩：京都の川床（かわどこ）で味わう「涼」の文化',
    titleHk: '日本夏日風物詩：喺京都鴨川「納涼床」品味清爽消暑文化',
    contentJp:
      '京都[きょうと]の夏[なつ]はとても暑[あつ]いことで知[し]られています。しかし、川[かわ]の上[うえ]に作[つく]られた座敷[ざしき]で食事[しょくじ]をすると、爽[さわ]やかな川風[かわかぜ]が吹[ふ]いてきて、暑[あつ]さを忘[わす]れることができます。水[みず]の音[おと]を聞[き]きながら過[す]ごす時間[じかん]は特別[とくべつ]です。',
    translationHk:
      '京都嘅夏天向來以非常炎熱聞名。不過，如果喺搭建於河面之上嘅座席（川床）食飯，清爽嘅河風吹過嚟，就能夠令人忘記炎熱。一邊聽住流水聲一邊度過嘅時光真係非常特別。',
    keyVocab: [
      { kanji: '風物詩', reading: 'ふうぶつし', meaning: '代表該季節特色嘅事物／風物詩' },
      { kanji: '爽やか', reading: 'さわやか', meaning: '清爽、爽朗、宜人' },
      { kanji: '川風', reading: 'かわかぜ', meaning: '河上吹來嘅涼風' },
    ],
    grammarPoint: {
      pattern: '動詞ます形（去ます）＋ながら',
      explanation: '表示一邊做副動作（聽住水聲），一邊進行主動作（度過特別時光）。',
    },
  },
  {
    id: 'feed-anime-n5',
    level: 'N5',
    category: 'anime',
    sourceLabel: '吉卜力動畫日常對話精選',
    titleJp: 'ジブリ映画の温かい食卓：「いただきます」と「ごちそうさま」の心',
    titleHk: '吉卜力動畫嘅溫暖餐桌：從「開動喇」學懂日本飲食感謝文化',
    contentJp:
      '朝[あさ]ごはんの時間[じかん]です。テーブルの上[うえ]には温[あたた]かいご飯[はん]と味噌汁[みそしる]があります。みんなで手[て]を合[あ]わせて、「いただきます」と言[い]ってから食[た]べます。とても美味[おい]しいです。',
    translationHk:
      '食早餐嘅時間到喇。餐枱上面有暖笠笠嘅白飯同埋麵豉湯。大家雙手合十講句「いただきます（我開動喇／領受食材嘅生命）」之後先開始食。真係好好味。',
    keyVocab: [
      { kanji: '食卓', reading: 'しょくたく', meaning: '餐桌、飯枱' },
      { kanji: '味噌汁', reading: 'みそしる', meaning: '麵豉湯、味噌湯' },
      { kanji: '手を合わせる', reading: 'てをあわせる', meaning: '雙手合十' },
    ],
    grammarPoint: {
      pattern: '動詞て形＋から',
      explanation: '表示先後順序：「講咗『いただきます』之後，先開始食飯」。',
    },
  },
  {
    id: 'feed-news-n1',
    level: 'N1',
    category: 'news',
    sourceLabel: '日本經濟與動畫產業白皮書',
    titleJp: '世界に広がる日本アニメ産業：クールジャパン戦略と制作現場の課題',
    titleHk: '席捲全球嘅日本動畫產業：海外串流熱潮與製作現場待遇改革',
    contentJp:
      '動画配信[どうがはいしん]プラットフォームの普及[ふきゅう]に伴[ともな]い、日本[にほん]のアニメ作品[さくひん]は未曽有[みぞう]の海外市場拡大[かいがいしじょうかくだい]を遂[と]げている。しかしその華々[はなばな]しい躍進[やくしん]の裏[うら]では、アニメーターの処遇改善[しょぐうかいぜん]や人材育成[じんざいいくせい]といった構造的[こうぞうてき]な課題[かだい]が浮[う]き彫[ぼ]りになっており、業界全体[ぎょうかいぜんたい]での抜本的[ばっぽんてき]な見直[みなお]しが急務[きゅうむ]とされている。',
    translationHk:
      '隨住串流影片平台普及，日本動畫作品喺海外市場迎嚟前所未有（未曽有）嘅擴張。然而喺呢份耀眼躍進嘅背後，原畫師待遇改善同人才培訓等結構性問題亦隨之浮現，整個業界進行根本性嘅改革檢討已成為燃眉之急。',
    keyVocab: [
      { kanji: '未曽有', reading: 'みぞう', meaning: '前所未有、史無前例（N1必考讀音）' },
      { kanji: '浮き彫りになる', reading: 'うきぼりになる', meaning: '（問題或特點）突顯出嚟、浮現' },
      { kanji: '抜本的', reading: 'ばっぽんてき', meaning: '根本性、徹底嘅（常配「抜本的な見直し」）' },
    ],
    grammarPoint: {
      pattern: '〜に伴い（〜にともない）',
      explanation: '書面語「隨住...嘅變化，另一件事亦相應發生」，常用於新聞報導與 N1 評論文章。',
    },
  },
];

export const DICTIONARY_ENTRIES: DictionaryDetailEntry[] = [
  {
    id: 'dict-sawayaka',
    kanji: '爽やか',
    reading: 'さわやか',
    romaji: 'sawayaka',
    pitchNumber: '②',
    partOfSpeech: '形動 (な形容詞)',
    jlptLevels: 'N2 · N3 · N4',
    shortMeaningZh: '清爽；爽快；爽朗；鮮明。',
    chineseDef: '清朗，舒暢，利落，嘹亮（形容秋高氣爽嘅空氣、笑容開朗、或者說話清晰唔拖泥帶水）',
    japaneseDef:
      '天気がさっぱりとして心地よい。気分がすがすがしい。また、口のきき方や声がはっきりしているさま。',
    examples: [
      {
        jp: '朝[あさ]の空気[くうき]が爽[さわ]やかで、散歩[さんぽ]に出[で]かけたくなった。',
        zh: '早晨的空氣清爽宜人，讓人想出門散步。',
      },
      {
        jp: '爽[さわ]やかな朝風[あさかぜ]が窓[まど]から入[はい]ってくる。',
        zh: '清爽嘅晨風由窗邊吹入嚟。',
      },
      {
        jp: '彼[かれ]はいつも爽[さわ]やかな笑顔[えがお]で挨拶[あいさつ]してくれる。',
        zh: '佢總係帶住陽光爽朗嘅笑容同大家打招呼。',
      },
    ],
    relatedWords: {
      sameRegister: [{ word: '爽か', reading: 'さやか' }],
      synonyms: ['能弁', '流暢', '爽か', '流ちょう', '口賢い', '雄弁', '堪能'],
      topicWords: [
        { word: '清々しい', gloss: '清爽、神清氣爽' },
        { word: '快適', gloss: '舒適' },
        { word: '心地よい', gloss: '舒暢怡人' },
        { word: '爽快', gloss: '爽快、痛快' },
        { word: '清潔', gloss: '清潔乾淨' },
      ],
    },
    jlptStats: {
      frequencyLabelZh: '高頻核心考點',
      frequencyLabelJa: '頻出重要語彙',
      examAppearances: 12,
      historicalCount: 15,
      correctRatePercent: 78,
      yearDistribution: [
        { year: '2018', count: 2 },
        { year: '2020', count: 3 },
        { year: '2022', count: 4 },
        { year: '2024', count: 3 },
      ],
      samplePastQuestion: {
        question: '高原の朝は空気が（　　）で、とても気持ちがいい。',
        options: ['爽やか', '穏やか', '賑やか', '細やか'],
        correctIndex: 0,
        explanation: '形容早晨高原空氣清新涼快、令人心曠神怡，固定配搭「空気が爽やか（さわやか）」。',
      },
    },
  },
  {
    id: 'dict-kikkake',
    kanji: 'きっかけ',
    reading: 'きっかけ',
    romaji: 'kikkake',
    pitchNumber: '⓪',
    partOfSpeech: '名詞',
    jlptLevels: 'N2 · N3',
    shortMeaningZh: '契機；開端；導火線；藉口。',
    chineseDef: '促使某件事開始嘅契機、機緣、起因（常配「〜をきっかけに」或「〜がきっかけで」）',
    japaneseDef: '物事を始める手がかり。動機。また、はずみ。いとぐち。',
    examples: [
      {
        jp: '日本[にほん]のアニメを見[み]たことがきっかけで、日本語[にほんご]を勉強[べんきょう]し始[はじ]めた。',
        zh: '以睇咗日本動漫為契機，開始學日文。',
      },
      {
        jp: 'ちょっとした誤解[ごかい]がきっかけで、二人[ふたり]は喧嘩[けんか]になった。',
        zh: '因為小小誤會做導火線，兩個人嗌起交上嚟。',
      },
      {
        jp: '話[はな]しかけるきっかけがつかめない。',
        zh: '搵唔到上前搭訕開口嘅契機。',
      },
    ],
    relatedWords: {
      sameRegister: [{ word: '切っ掛け', reading: 'きっかけ' }],
      synonyms: ['契機', '動機', '発端', '糸口', '手掛かり', '機縁'],
      topicWords: [
        { word: '転機', gloss: '轉捩點' },
        { word: '始まり', gloss: '開端' },
        { word: 'チャンス', gloss: '機會' },
        { word: '原因', gloss: '原因' },
      ],
    },
    jlptStats: {
      frequencyLabelZh: 'N3/N2 必考高頻詞',
      frequencyLabelJa: '超頻出重要語彙',
      examAppearances: 18,
      historicalCount: 22,
      correctRatePercent: 84,
      yearDistribution: [
        { year: '2018', count: 4 },
        { year: '2020', count: 5 },
        { year: '2022', count: 5 },
        { year: '2024', count: 4 },
      ],
      samplePastQuestion: {
        question: '入院したことを（　　）に、タバコをやめることにした。',
        options: ['きっかけ', 'おかげ', 'ついで', 'かわり'],
        correctIndex: 0,
        explanation: '「〜をきっかけに」表示以某件事（入院）作為轉捩點或契機，決定戒煙。',
      },
    },
  },
  {
    id: 'dict-mottainai',
    kanji: '勿体ない',
    reading: 'もったいない',
    romaji: 'mottainai',
    pitchNumber: '⑤',
    partOfSpeech: '形 (い形容詞)',
    jlptLevels: 'N2 · N3 · N4',
    shortMeaningZh: '浪費；可惜；暴殄天物；受寵若驚。',
    chineseDef: '1. 事物仲有價值卻白白浪費掉而感到可惜（嘥晒）；2. 過於珍貴而覺得自己消受唔起（受寵若驚）。',
    japaneseDef:
      '物の価値を十分に生かしきれておらず惜しい。無駄にするのが惜しい。また、身に過ぎて恐れ多い。',
    examples: [
      {
        jp: 'まだ食[た]べられるのに捨[す]ててしまうのはもったいない。',
        zh: '明明仲食得但係掉咗佢，真係太浪費（太嘥）喇。',
      },
      {
        jp: 'そんなお褒[ほ]めの言葉[ことば]、私[わたし]にはもったいないです。',
        zh: '你咁樣讚賞我，我真係受寵若驚（消受唔起）。',
      },
    ],
    relatedWords: {
      sameRegister: [{ word: '勿体無い', reading: 'もったいない' }],
      synonyms: ['惜しい', '無駄', '不経済', '恐れ多い', '過分'],
      topicWords: [
        { word: '節約', gloss: '節約慳錢' },
        { word: 'エコ', gloss: '環保' },
        { word: '感謝', gloss: '感恩珍惜' },
      ],
    },
    jlptStats: {
      frequencyLabelZh: '高頻核心考點',
      frequencyLabelJa: '頻出重要語彙',
      examAppearances: 14,
      historicalCount: 16,
      correctRatePercent: 81,
      yearDistribution: [
        { year: '2018', count: 3 },
        { year: '2020', count: 4 },
        { year: '2022', count: 3 },
        { year: '2024', count: 4 },
      ],
      samplePastQuestion: {
        question: 'せっかくの休日を一日中寝て過ごすなんて（　　）よ。',
        options: ['もったいない', 'だらしがない', 'しかたがない', 'たまらない'],
        correctIndex: 0,
        explanation: '難得放假成日淨係瞓覺白白浪費咗，用「もったいない（好可惜／好嘥）」。',
      },
    },
  },
  {
    id: 'dict-minaosu',
    kanji: '見直す',
    reading: 'みなおす',
    romaji: 'minaosu',
    pitchNumber: '⓪/③',
    partOfSpeech: '五他 (他動詞)',
    jlptLevels: 'N2 · N3',
    shortMeaningZh: '重新審視；檢討；刮目相看；好轉。',
    chineseDef: '1. 再睇一次、重新檢討修改；2. 發現對方嘅優點而改變睇法（刮目相看）。',
    japaneseDef:
      'もう一度見る。再検討する。また、今まで気づかなかった良さを見出して評価を改める。',
    examples: [
      {
        jp: '生活習慣[せいかつしゅうかん]を根本[こんぽん]から見直[みなお]す必要[ひつよう]がある。',
        zh: '有必要由根本重新檢視生活習慣。',
      },
      {
        jp: '危機[きき]に冷静[れいせい]に対処[たいしょ]する彼[かれ]の姿[すがた]を見[み]て、彼[かれ]を見直[みなお]した。',
        zh: '見到佢冷靜應對危機嘅表現，令我對佢刮目相看。',
      },
    ],
    relatedWords: {
      sameRegister: [{ word: '見直す', reading: 'みなおす' }],
      synonyms: ['再検討する', '改める', '再評価する', '点検する'],
      topicWords: [
        { word: '改善', gloss: '改善' },
        { word: '見落とす', gloss: '看漏、忽略' },
        { word: '見極める', gloss: '看清本質' },
      ],
    },
    jlptStats: {
      frequencyLabelZh: '一詞多義必考點',
      frequencyLabelJa: '多義語頻出考點',
      examAppearances: 11,
      historicalCount: 14,
      correctRatePercent: 69,
      yearDistribution: [
        { year: '2018', count: 2 },
        { year: '2020', count: 3 },
        { year: '2022', count: 3 },
        { year: '2024', count: 3 },
      ],
      samplePastQuestion: {
        question: 'テストの答案を提出する前に、もう一度（　　）なさい。',
        options: ['見直し', '見落とし', '見送り', '見渡し'],
        correctIndex: 0,
        explanation: '交卷前「再檢查一次」用「見直す（みなおす）」。',
      },
    },
  },
  {
    id: 'dict-sochi',
    kanji: '措置',
    reading: 'そち',
    romaji: 'sochi',
    pitchNumber: '①',
    partOfSpeech: '名・スル',
    jlptLevels: 'N1 · N2',
    shortMeaningZh: '措施；處置；應對辦法。',
    chineseDef: '針對問題或緊急狀況，政府或機構採取嘅具體處理措施（常配「措置を講じる」「措置をとる」）。',
    japaneseDef: '物事を取り計らって始末をつけること。必要な手続きや対策をとること。',
    examples: [
      {
        jp: '政府[せいふ]は緊急[きんきゅう]の経済対策[けいざいたいさく]として特別[とくべつ]な措置[そち]を講[こう]じた。',
        zh: '政府採取咗特別措施作為緊急經濟對策。',
      },
      {
        jp: '安全確保[あんぜんかくほ]のため、適切[てきせつ]な措置[そち]をとるよう求[もと]めた。',
        zh: '為確保安全，要求採取適當嘅應對措施。',
      },
    ],
    relatedWords: {
      sameRegister: [{ word: '処置', reading: 'しょち' }],
      synonyms: ['対策', '処置', '対応策', '手段', '手立て'],
      topicWords: [
        { word: '講じる', gloss: '採取（措施）' },
        { word: '政策', gloss: '政策' },
        { word: '応急処置', gloss: '急救處理' },
      ],
    },
    jlptStats: {
      frequencyLabelZh: 'N1 新聞商務必考',
      frequencyLabelJa: 'N1 頻出重要語彙',
      examAppearances: 9,
      historicalCount: 11,
      correctRatePercent: 72,
      yearDistribution: [
        { year: '2018', count: 2 },
        { year: '2020', count: 2 },
        { year: '2022', count: 3 },
        { year: '2024', count: 2 },
      ],
      samplePastQuestion: {
        question: '再発防止に向けて、早急に具体的な（　　）を講じる必要がある。',
        options: ['措置', '懸念', '妥協', '淘汰'],
        correctIndex: 0,
        explanation: '「措置を講じる」為 N1 固定搭配，意為「採取具體措施」。',
      },
    },
  },
];
