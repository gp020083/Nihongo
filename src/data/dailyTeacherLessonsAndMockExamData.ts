import { JlptLevel } from '../utils/srsEngine';
import { VocabItem, GrammarPoint, ReadingPassage } from './jlptCurriculum';
import { ListeningExercise, SpeakingPrompt } from './listeningAndDictionaryData';
import {
  EXTENDED_JLPT_MOCK_EXAM_QUESTIONS,
  buildRandomizedMockExamPaper,
  shuffleQuestionOptions,
  generateProceduralMockQuestionBatch,
  MOCK_EXAM_THEME_OPTIONS,
  matchesMockExamTheme,
} from './expandedMockExamPool';
export type { MockExamThemeId, MockExamThemeOption, RandomizedMockPaperResult } from './expandedMockExamPool';
export {
  buildRandomizedMockExamPaper,
  shuffleQuestionOptions,
  generateProceduralMockQuestionBatch,
  MOCK_EXAM_THEME_OPTIONS,
  matchesMockExamTheme,
};

export interface GroundingWebSource {
  title: string;
  uri: string;
}

export interface DailyTeacherMiniQuizItem {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  explanationJa?: string;
}

export interface DailyTeacherLessonPack {
  id: string;
  level: JlptLevel;
  themeTagZh: string;
  themeTagJa: string;
  titleZh: string;
  titleJa: string;
  teacherIntroHk: string;
  teacherIntroJa: string;
  sourceLabel: string;
  groundingSources?: GroundingWebSource[];
  vocabList: VocabItem[];
  grammarPoint: GrammarPoint;
  secondaryGrammarPoint?: GrammarPoint;
  readingArticle: {
    titleJp: string;
    titleHk: string;
    contentJp: string; // with furigana brackets
    translationHk: string;
    culturalTipHk: string;
    culturalTipJa?: string;
  };
  listeningDialogue: {
    scenarioZh: string;
    scenarioJa: string;
    lines: Array<{
      speaker: string;
      textJp: string;
      textHk: string;
    }>;
    speakingDrillJp: string;
    speakingDrillHk: string;
    secondSpeakingDrillJp?: string;
    secondSpeakingDrillHk?: string;
  };
  miniQuiz: DailyTeacherMiniQuizItem;
  extraQuizzes?: DailyTeacherMiniQuizItem[];
}

export type JlptExamSectionId = 'vocab_grammar' | 'reading' | 'listening';

export interface JlptMockExamQuestion {
  id: string;
  level: JlptLevel;
  section: JlptExamSectionId;
  mondaiLabel: string; // e.g. '問題1 漢字読み', '問題4 文法形式', '問題7 短文読解', '問題9 課題理解（聴解）'
  promptJp: string; // supports Kanji[furigana]
  passageJp?: string; // optional reading passage or context box
  audioScriptJp?: string; // for listening section TTS playback
  dialogueSpeakers?: Array<{ speaker: string; lineJp: string }>;
  options: string[];
  correctIndex: number;
  explanationHk: string;
  explanationJa: string;
}

export interface JlptSectionScore {
  section: JlptExamSectionId;
  titleZh: string;
  titleJa: string;
  correctCount: number;
  totalQuestions: number;
  scaledScore: number; // 0 - 60
  minPassingScore: number; // 19
  passedSection: boolean;
}

export interface JlptMockExamScoreReport {
  level: JlptLevel;
  totalScaledScore: number; // 0 - 180
  overallPassThreshold: number; // N5:80, N4:90, N3:95, N2:90, N1:100
  passedAllSections: boolean;
  isPassed: boolean;
  rankGrade: 'S' | 'A' | 'B' | 'C';
  sections: Record<JlptExamSectionId, JlptSectionScore>;
  totalCorrect: number;
  totalQuestions: number;
  feedbackHk: string;
  feedbackJa: string;
}

export const JLPT_PASS_THRESHOLDS: Record<JlptLevel, number> = {
  N5: 80,
  N4: 90,
  N3: 95,
  N2: 90,
  N1: 100,
};

export const DAILY_TEACHER_TOPICS: Array<{
  id: string;
  category: 'news' | 'anime' | 'travel' | 'business' | 'slang' | 'culture';
  labelZh: string;
  labelJa: string;
  queryPrompt: string;
}> = [
  {
    id: 'topic-news',
    category: 'news',
    labelZh: '日本最新社會時事與生活新聞',
    labelJa: '日本の最新ニュース・社会話題',
    queryPrompt: '日本最新ニュース 話題 トレンド 社会 生活',
  },
  {
    id: 'topic-anime',
    category: 'anime',
    labelZh: '今季人氣日本動畫與名場面台詞',
    labelJa: '最新話題のアニメ・名セリフ表現',
    queryPrompt: '日本 最新人気アニメ 話題 名言 聖地巡礼',
  },
  {
    id: 'topic-travel',
    category: 'travel',
    labelZh: '東京・京都深度旅遊與鐵道秘境',
    labelJa: '東京・京都のディープな旅と鉄道',
    queryPrompt: '日本旅行 京都 東京 最新スポット グルメ 観光',
  },
  {
    id: 'topic-business',
    category: 'business',
    labelZh: '日本職場商務敬語與IT新趨勢',
    labelJa: '日本のビジネス敬語・最新ITトレンド',
    queryPrompt: '日本 ビジネス 働き方 最新トレンド 敬語',
  },
  {
    id: 'topic-slang',
    category: 'slang',
    labelZh: '日本年輕人 SNS 流行語與地道口語',
    labelJa: 'SNS流行語・若者言葉・リアルな口語',
    queryPrompt: '日本 SNS 流行語大賞 若者言葉 最新トレンド',
  },
  {
    id: 'topic-culture',
    category: 'culture',
    labelZh: '日本四季祭典、飲食文化與居酒屋禮儀',
    labelJa: '四季の祭り・和食文化・居酒屋マナー',
    queryPrompt: '日本 四季 伝統行事 食文化 居酒屋 マナー',
  },
];

export const DAILY_TEACHER_LESSON_PACKS: DailyTeacherLessonPack[] = [
  // N5 Pack 1
  {
    id: 'pack-n5-1',
    level: 'N5',
    themeTagZh: '日本便利店與街頭實戰',
    themeTagJa: 'コンビニ＆街角サバイバル',
    titleZh: '日本便利店（コンビニ）隱藏服務與熱食點餐全攻略',
    titleJa: '日本のコンビニ活用術・レジでの自然な会話',
    teacherIntroHk:
      '各位同學好！今日老師同大家行入日本「三大便利店（7-11、Lawson、FamilyMart）」。好多人去到收銀台聽到店員連珠炮發問問題就會慌，今日我哋一次過攻克便利店必備單字、助詞搭配同埋跟讀對白！',
    teacherIntroJa:
      '皆さんこんにちは！今日は日本のコンビニで絶対によく聞くレジ表現と、ホットスナックの注文方法を一緒にマスターしましょう。',
    sourceLabel: 'Sensei 每日特選・生活實況篇',
    vocabList: [
      {
        id: 'dt-n5-v1',
        level: 'N5',
        kanji: '温める',
        reading: 'あたためる',
        romaji: 'atatameru',
        pitchAccent: '[4] 中高型',
        partOfSpeech: '一段他動詞',
        meaning: '叮熱、加熱（便當／飯糰）',
        coreImage: '店員拎住你盒便當問「温めますか？」（要唔要叮熱？）係日本每日必聽第一句！',
        exampleJp: 'お弁[べん]当[とう]を温[あたた]めますか。',
        exampleHk: '請問盒便當要唔要叮熱呀？',
      },
      {
        id: 'dt-n5-v2',
        level: 'N5',
        kanji: '袋',
        reading: 'ふくろ',
        romaji: 'fukuro',
        pitchAccent: '[3] 尾高型',
        partOfSpeech: '名詞',
        meaning: '膠袋、購物袋（レジ袋）',
        coreImage: '日本買膠袋要收費（3〜5円），店員一定會問「袋はお付けしますか？」',
        exampleJp: '袋[ふくろ]はいりません。そのままでもらいます。',
        exampleHk: '唔使膠袋喇，就咁拎得㗎喇。',
      },
      {
        id: 'dt-n5-v3',
        level: 'N5',
        kanji: '別々',
        reading: 'べつべつ',
        romaji: 'betsubetsu',
        pitchAccent: '[0] 平板型',
        partOfSpeech: '副詞・な形容詞',
        meaning: '分開（埋單／包裝）',
        coreImage: '同朋友去食飯或者買嘢想「分開計」時最實用嘅救命詞！',
        exampleJp: 'お会計[かいけい]は別々[べつべつ]でお願[ねが]いします。',
        exampleHk: '唔該我想分開埋單。',
      },
    ],
    grammarPoint: {
      id: 'dt-n5-g1',
      level: 'N5',
      pattern: '名詞 ＋ にします（決定選擇）',
      formation: '名詞 ＋ にします / にする',
      meaning: '我決定要...（點餐／購物決定時用）',
      nuance: '喺多個選擇入面「拍板決定」揀某一樣嘢，比單純講「〜をください」更有地道日文感。',
      cantoneseComparison: '似廣東話喺茶餐廳睇完餐牌講：「我決定要凍檸茶（アイスティーにします）！」',
      exampleJp: '今日[きょう]の昼[ひる]ご飯[はん]はこの鮭[さけ]おにぎりにします。',
      exampleHk: '今日晏晝飯我就決定揀呢個三文魚飯糰。',
    },
    readingArticle: {
      titleJp: '日本[にほん]のコンビニは24時間[じかん]いつでも便利[べんり]',
      titleHk: '日本便利店 24 小時都咁方便嘅秘密',
      contentJp:
        '日本[にほん]のコンビニでは、おにぎりやお弁[べん]当[とう]だけでなく、温[あたた]かいコーヒーや唐揚[からあ]げも買[か]うことができます。さらに、コンサートチケットの発券[はっけん]や荷物[にもつ]の発送[はっそう]もできるので、毎日[まいにち]たくさんの人[ひと]が利用[りよう]しています。',
      translationHk:
        '喺日本嘅便利店，唔單止可以買到飯糰同便當，仲可以買到熱辣辣嘅咖啡同炸雞。而且仲可以印演唱會飛同寄包裹，所以每日都有好多人使用。',
      culturalTipHk: '日本便利店收銀機旁邊通常有炸雞（からあげクン、ファミチキ），直接同店員講「これを一つください」就買到！',
    },
    listeningDialogue: {
      scenarioZh: '晚上喺東京便利店買便當同炸雞時與店員嘅對話',
      scenarioJa: '夜のコンビニでお弁当とホットスナックを買う場面',
      lines: [
        {
          speaker: '店員',
          textJp: 'いらっしゃいませ。こちらのお弁[べん]当[とう]は温[あたた]めますか。',
          textHk: '歡迎光臨。請問呢盒便當要唔要叮熱？',
        },
        {
          speaker: 'あなた',
          textJp: 'はい、お願[ねが]いします。あと、お箸[はし]も一[ひと]つください。',
          textHk: '好呀，唔該晒。另外請俾一對筷子我。',
        },
      ],
      speakingDrillJp: 'お弁[べん]当[とう]を温[あたた]めてください。袋[ふくろ]はいりません。',
      speakingDrillHk: '請幫我叮熱盒便當，唔使要膠袋喇。',
    },
    miniQuiz: {
      question: 'コンビニのレジで店員に「お弁当は温めますか」と聞かれました。温めてほしい時、どう答えますか？',
      options: [
        'はい、お願いします。',
        'はい、袋に入れます。',
        'いいえ、別々にします。',
        'はい、ごちそうさまでした。',
      ],
      correctIndex: 0,
      explanation: '當店員問「温めますか（要唔要叮熱？）」時，想叮熱就自然回答「はい、お願いします（好呀，唔該晒）」。',
    },
  },

  // N5 Pack 2
  {
    id: 'pack-n5-2',
    level: 'N5',
    themeTagZh: '日本鐵道與山手線乘車',
    themeTagJa: '日本の電車・山手線での移動',
    titleZh: '東京電車轉乘、IC卡增值與月台廣播聽解特訓',
    titleJa: '東京の電車乗り換え＆駅アナウンス徹底攻略',
    teacherIntroHk:
      '去日本自由行一定會搭電車！今日老師準備咗車站最常出現嘅「乗り換え（轉車）」、「各駅停車（每站停）」同埋問路句型，等大家聽月台廣播唔再一頭霧水！',
    teacherIntroJa:
      '日本の鉄道はとても正確ですが、最初は乗り換えが難しく感じることもあります。必須の駅ボキャブラリーを身につけましょう！',
    sourceLabel: 'Sensei 每日特選・鐵道出行篇',
    vocabList: [
      {
        id: 'dt-n5-v4',
        level: 'N5',
        kanji: '乗り換え',
        reading: 'のりかえ',
        romaji: 'norikae',
        pitchAccent: '[0] 平板型',
        partOfSpeech: '名詞・他動詞',
        meaning: '轉車、換乘',
        coreImage: '由一條電車線行去另一個月台換另一條線，車廂廣播每一站都會提！',
        exampleJp: '新宿[しんじゅく]駅[えき]で山手線[やまのてせん]に乗[の]り換[か]えます。',
        exampleHk: '喺新宿站轉乘山手線。',
      },
      {
        id: 'dt-n5-v5',
        level: 'N5',
        kanji: '改札口',
        reading: 'かいさつぐち',
        romaji: 'kaisatsuguchi',
        pitchAccent: '[4] 中高型',
        partOfSpeech: '名詞',
        meaning: '入閘口、檢票口',
        coreImage: '拍 Suica / ICOCA 卡出入車站嗰個閘機位置，約人見面最常講「北改札口で会いましょう」。',
        exampleJp: '駅[えき]の南[みなみ]改札口[かいさつぐち]で待[ま]っています。',
        exampleHk: '我喺車站南面入閘口等你。',
      },
      {
        id: 'dt-n5-v6',
        level: 'N5',
        kanji: '終電',
        reading: 'しゅうでん',
        romaji: 'shuuden',
        pitchAccent: '[0] 平板型',
        partOfSpeech: '名詞',
        meaning: '尾班車（最終電車）',
        coreImage: '日本電車夜晚12點左右就冇尾班車，錯過咗就要搭好貴嘅的士或者住網吧！',
        exampleJp: 'そろそろ終電[しゅうでん]の時間[じかん]だから、帰[かえ]りましょう。',
        exampleHk: '差唔多到尾班車時間喇，我哋返歸啦。',
      },
    ],
    grammarPoint: {
      id: 'dt-n5-g2',
      level: 'N5',
      pattern: '動詞て形 ＋ から（先後順序）',
      formation: '動詞て形 ＋ から、〜',
      meaning: '做完 A 之後，再做 B',
      nuance: '強調動作嘅先後次序（A 必須發生先，跟住先到 B）。',
      cantoneseComparison: '即係廣東話「先至...」：「入咗錢（チャージしてから）先至入閘」。',
      exampleJp: '切符[きっぷ]を買[か]ってから、改札[かいさつ]に入[はい]ります。',
      exampleHk: '買咗車飛之後，先至入閘。',
    },
    readingArticle: {
      titleJp: '便利[べんり]な交通[こうつう]系[けい]ICカード「Suica」',
      titleHk: '超方便嘅日本交通 IC 卡「Suica」',
      contentJp:
        '日本[にほん]で電車[でんしゃ]やバスに乗[の]る時[とき]は、SuicaやICOCAなどのICカードがとても便利[べんり]です。スマートフォンに入[い]れておけば、切符[きっぷ]を買[か]わなくても改札口[かいさつぐち]にタッチするだけで通[とお]ることができます。',
      translationHk:
        '喺日本搭電車或者巴士嗰陣，Suica 同 ICOCA 等交通 IC 卡非常方便。只要加落智能電話入面，就算唔買車飛，喺入閘機輕輕一嘟就可以通過。',
      culturalTipHk: '而家可以直接喺手機 Wallet 加入 Suica / PASMO，仲可以用外國信用卡即時增值（チャージ）！',
    },
    listeningDialogue: {
      scenarioZh: '喺東京站月台向站務員詢問去淺草點樣轉車',
      scenarioJa: '東京駅のホームで駅員さんに浅草への行き方を聞く場面',
      lines: [
        {
          speaker: 'あなた',
          textJp: 'すみません、この電車[でんしゃ]は浅草[あさくさ]へ行[い]きますか。',
          textHk: '唔好意思，請問呢班電車去唔去淺草呀？',
        },
        {
          speaker: '駅員',
          textJp: 'いいえ、神田[かんだ]駅[えき]で銀座線[ぎんざせん]に乗[の]り換[か]えてください。',
          textHk: '唔去㗎，請喺神田站轉乘銀座線啦。',
        },
      ],
      speakingDrillJp: 'すみません、渋谷[しぶや]へ行[い]くにはどこで乗[の]り換[か]えますか。',
      speakingDrillHk: '唔好意思，請問去澀谷要喺邊度轉車呀？',
    },
    miniQuiz: {
      question: '「神田駅で銀座線に（　　）ください。」空欄に入る正しい言葉はどれですか？',
      options: ['乗り換えて', '温めて', '出かけて', '開けて'],
      correctIndex: 0,
      explanation: '表示「轉乘銀座線」用「銀座線に乗り換えてください」。',
    },
  },

  // N4 Pack 1
  {
    id: 'pack-n4-1',
    level: 'N4',
    themeTagZh: '動漫名場面・青春熱血語感',
    themeTagJa: 'アニメ名シーン・青春の表現',
    titleZh: '從人氣動漫《葬送的芙莉蓮》與青春動畫學「約定與回憶」句型',
    titleJa: '話題のアニメから学ぶ「約束・思い出・変化」の文法',
    teacherIntroHk:
      '今日老師揀咗近年最受歡迎嘅日本動漫主題！喺動畫入面，角色經常講「不知不覺間已經...（いつの間にか）」、「決定咗要...（〜ことにする）」，識得呢啲句型，你睇生肉動漫時就會好有共鳴！',
    teacherIntroJa:
      'アニメの名セリフには、感情や時間の流れを表すN4重要文法がたくさん詰まっています。声に出して練習しましょう！',
    sourceLabel: 'Sensei 每日特選・動漫文化篇',
    vocabList: [
      {
        id: 'dt-n4-v1',
        level: 'N4',
        kanji: '冒険',
        reading: 'ぼうけん',
        romaji: 'bouken',
        pitchAccent: '[0] 平板型',
        partOfSpeech: '名詞・自動詞(する)',
        meaning: '冒險、探險',
        coreImage: '奇幻動漫同 RPG 遊戲最核心詞彙，「冒険に出る（踏上冒險之旅）」。',
        exampleJp: '仲間[なかま]と一緒[いっしょ]に新[あたら]しい冒険[ぼうけん]に出[で]かけよう。',
        exampleHk: '同夥伴一齊踏上全新嘅冒險旅程啦！',
      },
      {
        id: 'dt-n4-v2',
        level: 'N4',
        kanji: '約束',
        reading: 'やくそく',
        romaji: 'yakusoku',
        pitchAccent: '[0] 平板型',
        partOfSpeech: '名詞・他動詞(する)',
        meaning: '約定、承諾、約會',
        coreImage: '「約束を守る（遵守約定）」、「約束を破る（打破約定）」，日常同動漫都極高頻！',
        exampleJp: 'また必[かなら]ず会[あ]うと約束[やくそく]しました。',
        exampleHk: '約定咗一定會再見面。',
      },
      {
        id: 'dt-n4-v3',
        level: 'N4',
        kanji: '気がつく',
        reading: 'きがつく',
        romaji: 'ki ga tsuku',
        pitchAccent: '[3] 中高型',
        partOfSpeech: '五段自動詞片語',
        meaning: '察覺到、意識到、回過神來',
        coreImage: '注意力突然落喺某件事上面（「呀！原來已經...」）。',
        exampleJp: '気[き]がつくと、外[そと]はもう暗[くら]くなっていました。',
        exampleHk: '回過神來嗰陣，出面已經天黑咗。',
      },
    ],
    grammarPoint: {
      id: 'dt-n4-g1',
      level: 'N4',
      pattern: '〜ことにする vs 〜ことになる',
      formation: '動詞辞書形／ない形 ＋ ことにする（主觀決定）／ ことになる（客觀決定）',
      meaning: '我自己決定做... vs 事情被決定／結果變成要...',
      nuance: '「する」係自己主動拍板；「なる」係團體規定、公司安排或者自然促成嘅結果。',
      cantoneseComparison: '「我決定每日跑三公里（ことにした）」vs「公司決定派我去東京出差（ことになった）」。',
      exampleJp: '健康[けんこう]のために、毎朝[まいあさ]走[はし]ることにしました。',
      exampleHk: '為咗健康着想，我決定咗每日朝早跑步。',
    },
    readingArticle: {
      titleJp: 'アニメの「聖地巡礼[せいちじゅんれい]」が世界中[せかいじゅう]で人気[にんき]',
      titleHk: '動漫「聖地巡禮」熱潮席捲全球',
      contentJp:
        '最近[さいきん]、好[す]きなアニメの舞台[ぶたい]になった町[まち]を訪[おとず]れる「聖地巡礼[せいちじゅんれい]」がとても人気[にんき]を集[あつ]めています。アニメで見た景色[けしき]を自分[じぶん]の目[め]で見[み]たり、地元[じもと]の人[ひと]と交流[こうりゅう]したりすることで、作品[さくひん]がもっと好きになるそうです。',
      translationHk:
        '最近，親自探訪喜愛動漫取景城鎮嘅「聖地巡禮」非常受歡迎。聽講透過親眼見證動畫入面嘅風景、同當地居民交流，會令人更加鍾意部作品。',
      culturalTipHk: '進行聖地巡禮時記得遵守當地禮儀（マナーを守る），唔好進入私人住宅或阻礙交通！',
    },
    listeningDialogue: {
      scenarioZh: '兩位朋友討論暑假去日本進行動漫聖地巡禮嘅計劃',
      scenarioJa: '夏休みにアニメの聖地巡礼に行く計画を話す友達同士',
      lines: [
        {
          speaker: 'ケン',
          textJp: '今度[こんど]の夏休[なつやす]み、鎌倉[かまくら]へ聖地巡礼[せいちじゅんれい]に行[い]くことにしたよ。',
          textHk: '今個暑假，我決定咗去鎌倉做動漫聖地巡禮呀！',
        },
        {
          speaker: 'リン',
          textJp: 'いいなあ！あの有名[ゆうめい]な踏切[ふみきり]の写真[しゃしん]、ぜひ撮[と]ってきてね。',
          textHk: '正呀！嗰個出名嘅平交道相，記得一定要影返嚟呀！',
        },
      ],
      speakingDrillJp: '来年[らいねん]の春[はる]、日本[にほん]へ留学[りゅうがく]することになりました。',
      speakingDrillHk: '出年春天，已經落實咗會去日本留學。',
    },
    miniQuiz: {
      question: '「会社の命令で、来月から大阪へ転勤する（　　）。」空欄に入る最も自然な表現はどれですか？',
      options: ['ことになりました', 'ことにしました', 'ようにしました', 'ところでした'],
      correctIndex: 0,
      explanation: '因為係「会社の命令（公司命令）」屬於客觀安排而非個人主觀決定，所以必須用「ことになりました」。',
    },
  },

  // N4 Pack 2
  {
    id: 'pack-n4-2',
    level: 'N4',
    themeTagZh: '日本居酒屋與飲食文化',
    themeTagJa: '日本の居酒屋＆グルメ文化',
    titleZh: '日本居酒屋（居酒屋）點餐行話：「とりあえず生！」與「お通し」文化',
    titleJa: '居酒屋で困らない！「お通し・食べ放題・割り勘」表現',
    teacherIntroHk:
      '去日本居酒屋食宵夜，點解一坐低未嗌嘢食，店員就會擺一碟小菜（お通し）並收費？今日老師同你拆解日本飲食文化必備詞彙同受授動詞！',
    teacherIntroJa:
      '日本の居酒屋には独特のルールや言葉があります。「お通し」や「とりあえず」の使い方を楽しく学びましょう！',
    sourceLabel: 'Sensei 每日特選・飲食文化篇',
    vocabList: [
      {
        id: 'dt-n4-v4',
        level: 'N4',
        kanji: 'お通し',
        reading: 'おとおし',
        romaji: 'otooshi',
        pitchAccent: '[0] 平板型',
        partOfSpeech: '名詞',
        meaning: '居酒屋開位前菜（相當於座位費）',
        coreImage: '一入座店員自動奉上嘅小鉢料理（約300〜500円），代表「你嘅落單已經傳通去廚房」兼作座位費。',
        exampleJp: '日本[にほん]の居酒屋[いざかや]では、最初[さいしょ]に「お通[とお]し」が出[で]ることが多[おお]いです。',
        exampleHk: '喺日本居酒屋，一開始通常都會送上一碟「お通し（開位前菜）」。',
      },
      {
        id: 'dt-n4-v5',
        level: 'N4',
        kanji: 'とりあえず',
        reading: 'とりあえず',
        romaji: 'toriaezu',
        pitchAccent: '[3] 中高型',
        partOfSpeech: '副詞',
        meaning: '總之先...、姑且先...',
        coreImage: '未諗好食咩唔緊要，「とりあえず生ビール！（總之先嚟杯生啤！）」係日本人放工第一句口頭禪。',
        exampleJp: 'メニューはまだ決[き]まっていないので、とりあえず乾杯[かんぱい]しましょう。',
        exampleHk: '餐牌仲未揀好，總之我哋先乾杯啦！',
      },
      {
        id: 'dt-n4-v6',
        level: 'N4',
        kanji: '割り勘',
        reading: 'わりかん',
        romaji: 'warikan',
        pitchAccent: '[0] 平板型',
        partOfSpeech: '名詞',
        meaning: 'AA制、平均攤分賬單',
        coreImage: '朋友聚餐埋單時「今日は割り勘にしよう（今日AA制夾錢啦）」。',
        exampleJp: '今日[きょう]の飲[の]み会[かい]は一人[ひとり]三千円[さんぜんえん]の割[わ]り勘[かん]にしよう。',
        exampleHk: '今日嘅聚餐我哋每人三千日圓 AA 制夾錢啦。',
      },
    ],
    grammarPoint: {
      id: 'dt-n4-g2',
      level: 'N4',
      pattern: '動詞て形 ＋ みる（嘗試做某事）',
      formation: '動詞て形 ＋ みる / みます',
      meaning: '試下做...睇下點',
      nuance: '抱住輕鬆嘗試嘅心態親身體驗一下（「試下食、試下飲、試下問」）。',
      cantoneseComparison: '廣東話「食下睇下」、「飲下試下」。',
      exampleJp: 'せっかく日本[にほん]に来[き]たのだから、地元[じもと]の日本酒[にほんしゅ]を飲[の]んでみたいです。',
      exampleHk: '難得嚟到日本，好想試下飲當地嘅日本清酒。',
    },
    readingArticle: {
      titleJp: '居酒屋[いざかや]の「お通[とお]し」ってどういう意味[いみ]？',
      titleHk: '日本居酒屋嘅「お通し」到底係咩意思？',
      contentJp:
        '外国人[がいこくじん]旅行者[りょこうしゃ]が日本[にほん]の居酒屋[いざかや]へ行[い]くと、注文[ちゅうもん]していない小[ちい]さな料理[りょうり]が出[で]てきて驚[おどろ]くことがあります。これは「お通[とお]し」と呼[よ]ばれ、席料[せきりょう]の代[か]わりとして提供[ていきょう]される日本独自[にほんどくじ]の文化[ぶんか]です。',
      translationHk:
        '外國遊客去日本居酒屋嗰陣，有時見到自己明明冇叫卻端上嚟嘅小菜會覺得好驚訝。呢樣嘢叫做「お通し」，係作為座位費代替品而提供嘅日本獨特文化。',
      culturalTipHk: '關西地區有時會將「お通し」叫做「突き出し（つきだし）」！',
    },
    listeningDialogue: {
      scenarioZh: '喺大阪居酒屋一坐低，店員過來幫大家落飲品單',
      scenarioJa: '居酒屋で席に着いて最初のドリンクを注文する場面',
      lines: [
        {
          speaker: '店員',
          textJp: 'いらっしゃいませ！まずお飲[の]み物[もの]はいかがなさいますか。',
          textHk: '歡迎光臨！請問首先飲品想飲啲咩呢？',
        },
        {
          speaker: 'あなた',
          textJp: 'とりあえず生[なま]ビールを二[ふた]つと、枝豆[えだまめ]を一[ひと]つお願[ねが]いします。',
          textHk: '總之先嚟兩杯生啤，同埋一碟枝豆唔該！',
        },
      ],
      speakingDrillJp: 'すみません、おすすめの料理[りょうり]を教[おし]えてもらえませんか。',
      speakingDrillHk: '唔好意思，可唔可以介紹下你哋有咩招牌推薦菜式呀？',
    },
    miniQuiz: {
      question: '日本の居酒屋で、注文した料理が決まる前に「まず最初に」という意味でよく使われる副詞はどれですか？',
      options: ['とりあえず', 'わざわざ', 'たまたま', '相変わらず'],
      correctIndex: 0,
      explanation: '「とりあえず（總之先...）」係日本居酒屋落第一輪飲品時最地道嘅高頻副詞。',
    },
  },

  // N3 Pack 1
  {
    id: 'pack-n3-1',
    level: 'N3',
    themeTagZh: '日本最新社會趨勢・無現金與數碼生活',
    themeTagJa: '最新トレンド・キャッシュレス社会',
    titleZh: '日本「キャッシュレス（無現金支付）」普及新聞與 N3 因果轉折精讀',
    titleJa: '日本のキャッシュレス化ニュースとN3新聞頻出表現',
    teacherIntroHk:
      '以前去日本旅行一定要唱定大疊福澤諭吉（一萬円紙幣），但近年日本「キャッシュレス決済（無現金支付）」急速普及！今日老師帶大家讀一篇 NHK 風格時事新聞，掌握 N3 必考嘅「〜につれて」同埋高頻動詞！',
    teacherIntroJa:
      '近年の日本ではQRコード決済やタッチ決済が急速に広がっています。ニュース記事を通してN3の重要文法を学びましょう。',
    sourceLabel: 'Sensei 每日特選・NHK時事精讀',
    vocabList: [
      {
        id: 'dt-n3-v1',
        level: 'N3',
        kanji: '普及する',
        reading: 'ふきゅうする',
        romaji: 'fukyuu suru',
        pitchAccent: '[0] 平板型',
        partOfSpeech: '名詞・自他動詞(する)',
        meaning: '普及、廣泛流傳',
        coreImage: '新科技或新習慣由少數人擴散到全國人都用，新聞報導必出詞。',
        exampleJp: 'スマートフォン決済[けっさい]が全国[ぜんこく]に急速[きゅうそく]に普及[ふきゅう]している。',
        exampleHk: '智能手機支付正喺全國急速普及。',
      },
      {
        id: 'dt-n3-v2',
        level: 'N3',
        kanji: '手間',
        reading: 'てま',
        romaji: 'tema',
        pitchAccent: '[2] 尾高型',
        partOfSpeech: '名詞',
        meaning: '工夫、麻煩、耗費嘅時間精力',
        coreImage: '「手間がかかる（好花工夫／好麻煩）」、「手間が省ける（省卻麻煩）」係 N3 黃金慣用搭配！',
        exampleJp: '電子[でんし]マネーを使[つか]えば、小銭[こぜに]を出[だ]す手間[てま]が省[はぶ]ける。',
        exampleHk: '用電子貨幣嘅話，就可以省卻攞散紙出嚟嘅麻煩。',
      },
      {
        id: 'dt-n3-v3',
        level: 'N3',
        kanji: '一方で',
        reading: 'いっぽうで',
        romaji: 'ippou de',
        pitchAccent: '[3] 中高型',
        partOfSpeech: '接續詞',
        meaning: '另一方面...（對比正反兩面）',
        coreImage: '新聞同評論文章分析一件事嘅「好處」之後，轉去講「隱憂或另一面」時必用。',
        exampleJp: '便利[べんり]になる一方[いっぽう]で、使いすぎに注意[ちゅうい]が必要[ひつよう]だ。',
        exampleHk: '喺變得方便嘅同時，另一方面亦要注意唔好洗大咗。',
      },
    ],
    grammarPoint: {
      id: 'dt-n3-g1',
      level: 'N3',
      pattern: '〜につれて / 〜にしたがって（伴隨變化）',
      formation: '動詞辞書形 / 名詞（變化性） ＋ につれて',
      meaning: '隨住...，亦都跟住...',
      meaningJa: '一方の変化に伴って、もう一方も同時に同じ方向へ変化する',
      nuance: '表示 A 發生漸進變化時，B 亦同步向某個方向變化（兩邊都係動態變化，唔可以用靜態句結尾）。',
      nuanceJa: '一方（A）が徐々に変化するのに伴って、もう一方（B）も一緒に同じ方向へ変化することを表します（前件・後件ともに変化を表す動詞・形容詞を用い、状態表現や意向形は使えません）。',
      cantoneseComparison: '廣東話「隨住時間過去，日文越講越順」。',
      exampleJp: 'キャッシュレスが普及[ふきゅう]するにつれて、現金[げんきん]を持[も]たない人[ひと]が増[ふ]えている。',
      exampleHk: '隨住無現金支付普及，唔帶現金出街嘅人越嚟越多。',
    },
    readingArticle: {
      titleJp: '日本[にほん]で進[すす]むキャッシュレス決済[けっさい]と変化[へんか]する日常[にちじょう]',
      titleHk: '日本持續推進嘅無現金支付與日常變化',
      contentJp:
        'かつて「現金主義[げんきんしゅぎ]」と言[い]われていた日本[にほん]でも、ここ数年[すうねん]でクレジットカードやQRコードによる決済[けっさい]が普及[ふきゅう]した。レジでお釣[つ]りをやり取[と]りする手間[てま]が省[はぶ]ける一方[いっぽう]で、災害時[さいがいじ]の停電[ていでん]に備[そな]えて少[すこ]しは現金[げんきん]を持[も]っておくべきだという声[こえ]もある。',
      translationHk:
        '就算係以前被稱為「現金主義」嘅日本，呢幾年信用卡同 QR Code 支付亦已經相當普及。雖然省卻咗喺收銀處找續散紙嘅麻煩，但另一方面，亦有意見認為應該隨身帶備少少現金，以防災害停電時不時之需。',
      culturalTipHk: '去日本神社參拜投香油錢（お賽銭）或者鄉郊老店，仍然建議準備少量 100 円同 1000 円現金！',
    },
    listeningDialogue: {
      scenarioZh: '喺東京咖啡店買嘢飲時，留意到店舖轉為只收無現金支付',
      scenarioJa: 'カフェのレジで完全キャッシュレス化について話す場面',
      lines: [
        {
          speaker: '店員',
          textJp: '当店[とうてん]は今月[こんげつ]から完全[かんぜん]キャッシュレスとなっておりまして、現金[げんきん]はご利用[りよう]いただけません。',
          textHk: '本店由今個月起改為全無現金支付，恕不接受現金。',
        },
        {
          speaker: '客',
          textJp: 'そうなんですね。じゃあ、交通[こうつう]系[けい]ICカードで払[はら]います。',
          textHk: '原來係咁。咁我用交通 IC 卡畀錢啦。',
        },
      ],
      speakingDrillJp: '小銭[こぜに]を探[さが]す手間[てま]が省[はぶ]けて、とても便利[べんり]になりました。',
      speakingDrillHk: '省卻咗摷散紙嘅麻煩，變得非常方便。',
    },
    miniQuiz: {
      question: '「小銭を出す（　　）が省ける。」空欄に入る最も適切な言葉はどれですか？',
      options: ['手間', '手配', '手本', '手紙'],
      correctIndex: 0,
      explanation: '「手間が省ける（てまがはぶける）」係固定高頻慣用句，意思係「省卻麻煩／工夫」。',
    },
  },

  // N3 Pack 2
  {
    id: 'pack-n3-2',
    level: 'N3',
    themeTagZh: '日本年輕人 SNS 流行語與口語縮約',
    themeTagJa: 'SNSトレンド＆日常の縮約表現',
    titleZh: '聽懂日本人真實語速：「〜ちゃう／〜とく」口語縮約與 SNS 話題詞「推し活」',
    titleJa: 'ネイティブの日常会話「〜ちゃう・〜とく」と話題の「推し活」',
    teacherIntroHk:
      '點解學完教科書去到日本，總係覺得日本人講嘢好似吞晒啲音？因為日本人喺日常會話會將「〜てしまう」縮成「〜ちゃう」，將「〜ておく」縮成「〜とく」！今日老師帶你徹底打通耳仔！',
    teacherIntroJa:
      'ドラマやアニメ、友達同士の会話では教科書の形そのままではなく「縮約形」がよく使われます。今日で完璧に聞き取れるようになりましょう！',
    sourceLabel: 'Sensei 每日特選・地道口語與流行文化篇',
    vocabList: [
      {
        id: 'dt-n3-v4',
        level: 'N3',
        kanji: '推し活',
        reading: 'おしかつ',
        romaji: 'oshikatsu',
        pitchAccent: '[0] 平板型',
        partOfSpeech: '名詞',
        meaning: '應援活動、追星／支持喜愛角色嘅活動',
        coreImage: '「推す（推薦、支持）」衍生出嚟嘅國民級流行語，無論追動漫角色、偶像定鐵道都叫「推し活」！',
        exampleJp: '週末[しゅうまつ]は友達[ともだち]とライブに行[い]って「推[お]し活[かつ]」を楽[たの]しんでいる。',
        exampleHk: '週末同朋友去睇演唱會，盡情享受「應援追星活動（推し活）」。',
      },
      {
        id: 'dt-n3-v5',
        level: 'N3',
        kanji: 'つい',
        reading: 'つい',
        romaji: 'tsui',
        pitchAccent: '[1] 頭高型',
        partOfSpeech: '副詞',
        meaning: '不知不覺、忍唔住（無意中做咗）',
        coreImage: '同「〜てしまう／〜ちゃう」係天生一對！形容明知唔應該但忍唔住手買咗／食咗。',
        exampleJp: '限定[げんてい]グッズを見[み]ると、つい買[か]いすぎてしまう。',
        exampleHk: '一見到期間限定周邊商品，就會忍唔住買多咗。',
      },
      {
        id: 'dt-n3-v6',
        level: 'N3',
        kanji: 'あらかじめ',
        reading: 'あらかじめ',
        romaji: 'arakajime',
        pitchAccent: '[0] 平板型',
        partOfSpeech: '副詞',
        meaning: '預先、事先',
        coreImage: '同「〜ておく（預先做好準備）」經常一齊出現，N3 聽解與讀解極常考！',
        exampleJp: '混雑[こんざつ]を避[さ]けるため、あらかじめ予約[よやく]しておいたほうがいい。',
        exampleHk: '為咗避開人潮，最好預先訂好位。',
      },
    ],
    grammarPoint: {
      id: 'dt-n3-g2',
      level: 'N3',
      pattern: '口語縮約形：〜ちゃう（てしまう）／ 〜とく（ておく）',
      formation: 'てしまう → ちゃう（でしまう → じゃう）｜ ておく → とく（でおく → どく）',
      meaning: '不小心做咗／徹底做完（ちゃう）｜ 預先做好準備（とく）',
      nuance: 'JLPT 聽解測驗入面，男女朋友或同事對話 80% 都會用呢個縮約音，聽唔出就會揀錯答案！',
      cantoneseComparison: '「買っておく → 買っとく（買定先）」、「食べてしまった → 食べちゃった（食鬼咗）」。',
      exampleJp: 'チケットが売[う]り切[き]れちゃう前[まえ]に、今[いま]すぐ予約[よやく]しとくね！',
      exampleHk: '喺啲飛賣晒之前，我而家即刻預訂定先啦！',
    },
    readingArticle: {
      titleJp: '日本[にほん]の経済[けいざい]を動[うご]かす「推[お]し活[かつ]」ブーム',
      titleHk: '帶動日本經濟嘅「推し活（應援文化）」熱潮',
      contentJp:
        '「推[お]し」とは、自分[じぶん]が一番[いちばん]応援[おうえん]しているアイドルやアニメのキャラクターのことだ。近年[きんねん]では、推しのイメージカラーに合[あ]わせた服[ふく]を着[き]たり、カフェでお祝[いわ]いしたりする「推し活」が広[ひろ]がり、旅行[りょこう]やグッズなど大[おお]きな経済効果[けいざいこうか]を生[う]んでいる。',
      translationHk:
        '所謂「推し（推）」，係指自己最支持嘅偶像或者動漫角色。近年，着上配合偶像應援色嘅衫、或者喺 Cafe 慶祝生日嘅「推し活」廣泛流行，喺旅遊同周邊商品方面創造出龐大嘅經濟效益。',
      culturalTipHk: '喺日本行街見到「推し色（應援色）」專櫃，由電話殼、絲帶到蛋糕都可以自訂顏色！',
    },
    listeningDialogue: {
      scenarioZh: '兩位同事傾緊週末去睇人氣動畫劇場版電影嘅安排',
      scenarioJa: '週末にアニメ映画を見に行く相談をする同僚の会話',
      lines: [
        {
          speaker: '佐藤',
          textJp: '週末[しゅうまつ]の映画[えいが]、席[せき]が埋[う]まっちゃうかもしれないから、先[さき]に予約[よやく]しとこうか？',
          textHk: '週末場戲，啲位可能會爆晒，不如我預先訂定飛先好冇？',
        },
        {
          speaker: '鈴木',
          textJp: 'ありがとう！じゃあ私[わたし]はポップコーンの引換券[ひきかえけん]を買[か]っとくね。',
          textHk: '唔該晒你！咁我預先買定爆谷換領券先啦。',
        },
      ],
      speakingDrillJp: 'うっかり忘[わす]れちゃうといけないから、今[いま]のうちにメモしとくね。',
      speakingDrillHk: '費事唔小心唔記得咗，我趁而家寫低記住先。',
    },
    miniQuiz: {
      question: '会話の「先に予約しとこうか」は、元の正しい文法の形に直すとどれになりますか？',
      options: [
        '先に予約しておこうか',
        '先に予約してしまおうか',
        '先に予約してみようか',
        '先に予約してあるか',
      ],
      correctIndex: 0,
      explanation: '「予約しとこう」係「予約しておこう（ておく嘅意志形＝預先做好準備）」嘅口語縮約形。',
    },
  },

  // N2 Pack 1
  {
    id: 'pack-n2-1',
    level: 'N2',
    themeTagZh: '日本商務職場與遠距工作實戰',
    themeTagJa: 'ビジネス実戦＆リモートワーク',
    titleZh: '日企商務電郵與會議必備：「〜に際して・〜を踏まえて」與得體回絕技巧',
    titleJa: 'ビジネスメール・会議で信頼されるN2表現とクッション言葉',
    teacherIntroHk:
      '準備考 N2 或者想去日資公司做嘢嘅同學留意喇！日本人喺職場極度重視「クッション言葉（緩衝語）」同嚴謹嘅書面句型。今日老師同你拆解商務書信最高頻嘅三個詞同句型！',
    teacherIntroJa:
      'N2レベルでは、単なる日常会話だけでなく、ビジネスシーンで相手に失礼なく的確に意図を伝える表現が求められます。',
    sourceLabel: 'Sensei 每日特選・日本職場商務篇',
    vocabList: [
      {
        id: 'dt-n2-v1',
        level: 'N2',
        kanji: '踏まえる',
        reading: 'ふまえる',
        romaji: 'fumaeru',
        pitchAccent: '[3] 中高型',
        partOfSpeech: '一段他動詞',
        meaning: '以...為基礎、立足於、考慮到（前車之鑑／調查結果）',
        coreImage: '雙腳踏實喺「過往經驗或數據」上面，再作出下一步決策（〜を踏まえて）。',
        exampleJp: '今回[こんかい]のアンケート結果[けっか]を踏[ふ]まえて、来期[らいき]の計画[けいかく]を見直[みなお]す。',
        exampleHk: '根據今次嘅問卷調查結果，重新檢視下一期嘅計劃。',
      },
      {
        id: 'dt-n2-v2',
        level: 'N2',
        kanji: '見直す',
        reading: 'みなおす',
        romaji: 'minaosu',
        pitchAccent: '[0] 平板型 / [3] 中高型',
        partOfSpeech: '五段他動詞',
        meaning: '1. 重新審視／修改（計劃）；2. 刮目相看',
        coreImage: '新聞同商務超愛考佢嘅雙重意思：對制度係「重新檢討」，對人係「另眼相看」！',
        exampleJp: '業務[ぎょうむ]の効率[こうりつ]を上[あ]げるため、作業[さぎょう]の手順[てじゅん]を見直[みなお]した。',
        exampleHk: '為咗提升業務效率，重新檢討咗工作流程。',
      },
      {
        id: 'dt-n2-v3',
        level: 'N2',
        kanji: '恐れ入りますが',
        reading: 'おそれいりますが',
        romaji: 'osoreirimasu ga',
        pitchAccent: '[6] 中高型',
        partOfSpeech: '慣用寒暄語（クッション言葉）',
        meaning: '萬分抱歉／勞煩你...（商務最高級緩衝開場白）',
        coreImage: '喺要求客戶或上司幫手、或者婉拒對方之前加上呢句，禮貌度即刻升爆燈！',
        exampleJp: '恐[おそ]れ入[い]りますが、来週[らいしゅう]の金曜日[きんようび]までにご返信[へんしん]いただけますでしょうか。',
        exampleHk: '勞煩你，請問可唔可以喺下星期五或之前回覆呢？',
      },
    ],
    grammarPoint: {
      id: 'dt-n2-g1',
      level: 'N2',
      pattern: '〜に際して（にさいして）',
      formation: '名詞 / 動詞辞書形 ＋ に際して（の）',
      meaning: '值此...之際、當...嘅重要時刻',
      nuance: '用於正式場合（開張、留學、新項目啟動、報名申請），表示喺某個特別轉折時刻做準備或致辭。',
      cantoneseComparison: '相當於中文公文「值此新店開業之際」、「於辦理手續時」。',
      exampleJp: '新規[しんき]プロジェクトを始[はじ]めるに際[さい]して、各部署[かくぶしょ]の意見[いけん]を集[あつ]めた。',
      exampleHk: '喺展開新項目之際，收集咗各個部門嘅意見。',
    },
    readingArticle: {
      titleJp: '日本企業[にほんきぎょう]における「ハイブリッドワーク」の定着[ていちゃく]',
      titleHk: '日本企業中逐漸成為常態嘅「混合辦公模式」',
      contentJp:
        '近年[きんねん]、日本[にほん]の多[おお]くの企業[きぎょう]で働き方[はたらきかた]を見直[みなお]す動[うご]きが進[すす]んでいる。オフィスへの出社[しゅっしゃ]と在宅勤務[ざいたくきんむ]を組[く]み合[あ]わせる「ハイブリッドワーク」を導入[どうにゅう]するに際[さい]して、社員同士[しゃいんどうし]のコミュニケーション不足[ぶそく]をどう補[おぎな]うかが重要[じゅうよう]な課題[かだい]となっている。',
      translationHk:
        '近年，日本好多企業正持續推進重新檢視工作方式嘅改革。喺引入結合返公司同在家工作嘅「混合辦公模式」之際，如何彌補員工之間嘅溝通不足成為咗重要課題。',
      culturalTipHk: '喺日本商務電郵入面，開頭必寫「いつもお世話になっております」，結尾必寫「よろしくお願いいたします」。',
    },
    listeningDialogue: {
      scenarioZh: '線上會議中向客戶確認修改方案嘅時間表',
      scenarioJa: 'オンライン会議で取引先に修正案のスケジュールを確認する場面',
      lines: [
        {
          speaker: '担当者',
          textJp: '本日[ほんじつ]いただいたご意見[いけん]を踏[ふ]まえまして、企画書[きかくしょ]を再度[さいど]見直[みなお]します。',
          textHk: '根據今日收到嘅寶貴意見，我哋會再次重新檢視企劃書。',
        },
        {
          speaker: '取引先',
          textJp: '恐[おそ]れ入[い]りますが、木曜日[もくようび]の午前中[ごぜんちゅう]までに共有[きょうゆう]していただけますか。',
          textHk: '唔好意思勞煩晒，請問可唔可以喺星期四中午前分享俾我哋呢？',
        },
      ],
      speakingDrillJp: 'アンケート結果[けっか]を踏[ふ]まえて、サービス内容[ないよう]を見直[みなお]すことにいたしました。',
      speakingDrillHk: '根據問卷調查結果，我哋決定重新檢討服務內容。',
    },
    miniQuiz: {
      question: '「お申し込み（　　）、以下の注意事項を必ずお読みください。」空欄に入る最も適切な表現はどれですか？',
      options: ['に際して', 'につれて', 'のおかげで', 'に反して'],
      correctIndex: 0,
      explanation: '「お申し込みに際して（於報名申請之際）」係 N2 正式通知與申請須知最典型嘅高頻句型。',
    },
  },

  // N1 Pack 1
  {
    id: 'pack-n1-1',
    level: 'N1',
    themeTagZh: '日本深度社論・AI 時代與工匠精神',
    themeTagJa: '社説・AI時代と日本の職人精神',
    titleZh: '讀懂《朝日／讀賣》社論筆法：「〜を余儀なくされる・〜に他ならない」深度剖析',
    titleJa: '新聞社説の論理構造「〜を余儀なくされる・〜に他ならない」完全制覇',
    teacherIntroHk:
      '衝刺 N1 嘅同學好！N1 讀解同語彙最鍾意考「無奈被迫改變」同埋「斷言本質」嘅高階書面語。今日老師揀咗「AI 科技與日本傳統職人技藝」嘅評論專題，帶你掌握最高分嘅社論表達！',
    teacherIntroJa:
      'N1の評論や論説文では、筆者の強い主張や避けられない時代の変化を表す硬い表現が頻出します。論理の骨組みを掴みましょう。',
    sourceLabel: 'Sensei 每日特選・N1社論與文化哲學篇',
    vocabList: [
      {
        id: 'dt-n1-v1',
        level: 'N1',
        kanji: '培う',
        reading: 'つちかう',
        romaji: 'tsuchikau',
        pitchAccent: '[3] 中高型',
        partOfSpeech: '五段他動詞',
        meaning: '培養、孕育、長年累積（技術／經驗／人脈）',
        coreImage: '原本指將泥土培喺植物根部，引申為經過漫長歲月一點一滴累積出深厚實力。',
        exampleJp: '長年[ながねん]にわたって培[つちか]われた職人[しょくにん]の技[わざ]は、簡単[かんたん]には真似[まね]できない。',
        exampleHk: '經過長年累月孕育出嚟嘅工匠技藝，絕對唔係咁容易模仿得到。',
      },
      {
        id: 'dt-n1-v2',
        level: 'N1',
        kanji: '模索する',
        reading: 'もさくする',
        romaji: 'mosaku suru',
        pitchAccent: '[0] 平板型',
        partOfSpeech: '名詞・他動詞(する)',
        meaning: '摸索、探求（解決方案／出路）',
        coreImage: '喺未有現成答案嘅環境下，不斷嘗試去尋找新嘅可能性（解決策を模索する）。',
        exampleJp: '伝統産業[でんとうさんぎょう]と先端技術[せんたんぎじゅつ]が共存[きょうぞん]する道[みち]を模索[もさく]している。',
        exampleHk: '正喺度摸索傳統產業與尖端科技共存嘅出路。',
      },
      {
        id: 'dt-n1-v3',
        level: 'N1',
        kanji: '淘汰',
        reading: 'とうた',
        romaji: 'touta',
        pitchAccent: '[1] 頭高型',
        partOfSpeech: '名詞・他動詞(する)',
        meaning: '淘汰、篩選',
        coreImage: '時代轉變下「自然淘汰（しぜんとうた）」或者被市場淘汰（淘汰される）。',
        exampleJp: '時代[じだい]の変化[へんか]に対応[たいおう]できない企業[きぎょう]は、やがて淘汰[とうた]されていく。',
        exampleHk: '無法應對時代變化嘅企業，最終將會被淘汰。',
      },
    ],
    grammarPoint: {
      id: 'dt-n1-g1',
      level: 'N1',
      pattern: '〜を余儀（よぎ）なくされる',
      formation: '名詞（動作性） ＋ を余儀なくされる',
      meaning: '被迫無奈地...、不得不...',
      nuance: '「余儀ない」即係別無他法。因為外在環境（天災、經濟不景、時代巨輪）所迫，喺唔情願嘅情況下不得不作出改變（如：変更／閉鎖／撤退を余儀なくされる）。',
      cantoneseComparison: '相當於中文書面語「被迫無奈作出調整」、「不得不宣佈停業」。',
      exampleJp: '少子高齢化[しょうしこうれいか]に伴[ともな]い、多[おお]くの地方都市[ちほうとし]が計画[けいかく]の縮小[しゅくしょう]を余儀[よぎ]なくされている。',
      exampleHk: '伴隨住少子高齡化，好多地方城市都被迫無奈地縮減計劃規模。',
    },
    readingArticle: {
      titleJp: 'AI時代[じだい]における伝統工芸[でんとうこうげい]の継承[けいしょう]と革新[かくしん]',
      titleHk: 'AI 時代下日本傳統工藝嘅傳承與革新',
      contentJp:
        '後継者不足[こうけいしゃぶそく]により存続[そんぞく]の危機[きき]に直面[ちょくめん]し、廃業[はいぎょう]を余儀[よぎ]なくされる伝統工芸[でんとうこうげい]の工房[こうぼう]が少[すく]なくない。しかし近年[きんねん]、熟練[じゅくれん]の職人[しょくにん]が長年[ながねん]培[つちか]ってきた技術[ぎじゅつ]をAIや3Dセンサーで記録[きろく]し、次世代[じせだい]へ継承[けいしょう]する新[あたら]たな試[こころ]みが模索[もさく]されている。',
      translationHk:
        '由於後繼無人而面臨存亡危機、被迫無奈結業嘅傳統工藝工坊並唔少。然而近年，正喺度摸索一項新嘗試：利用 AI 同 3D 感測器將熟練工匠長年累月培養出嚟嘅技術記錄落嚟，傳承俾下一代。',
      culturalTipHk: 'N1 讀解見到「しかし近年〜」之後嘅句子，往往就係作者最想強調嘅核心論點！',
    },
    listeningDialogue: {
      scenarioZh: '日本電視台文化專題節目中，主持與評論員探討傳統工藝數碼化',
      scenarioJa: '報道番組で伝統工芸のデジタル化について議論する場面',
      lines: [
        {
          speaker: 'キャスター',
          textJp: '職人[しょくにん]の高齢化[こうれいか]が進[すす]む中[なか]、従来[じゅうらい]のやり方[かた]だけでは限界[げんかい]があるのではないでしょうか。',
          textHk: '喺工匠高齡化持續加劇之下，單靠以往嘅做法恐怕已經去到極限了吧。',
        },
        {
          speaker: 'コメンテーター',
          textJp: 'おっしゃる通[とお]りです。技術[ぎじゅつ]の本質[ほんしつ]を守[まも]りつつ、デジタルの力[ちから]を取[と]り入[い]れることが不可欠[ふかけつ]に他[ほか]なりません。',
          textHk: '正如你所講。喺守護技術本質嘅同時引入數碼力量，無疑係不可或缺嘅。',
        },
      ],
      speakingDrillJp: '長年[ながねん]培[つちか]ってきた経験[けいけん]を活[い]かし、新[あたら]たな解決策[かいけつさく]を模索[もさく]している。',
      speakingDrillHk: '善用長年累月培養出嚟嘅經驗，正喺度摸索全新嘅解決方案。',
    },
    miniQuiz: {
      question: '「激しい嵐のため、登山隊は計画の中止を（　　）。」空欄に入る最も適切な表現はどれですか？',
      options: [
        '余儀なくされた',
        'ものともしなかった',
        '皮切りにした',
        'ものと思われる',
      ],
      correctIndex: 0,
      explanation: '因為暴風雨（外在不可抗力原因），登山隊「被迫無奈不得不中止計劃」，用「中止を余儀なくされた」。',
    },
  },
];

// Additional rich curriculum items to expand StudyStage across N5-N1
export const EXTRA_VOCAB_POOL: VocabItem[] = [
  ...DAILY_TEACHER_LESSON_PACKS.flatMap((p) => p.vocabList),
  {
    id: 'ext-n5-v10',
    level: 'N5',
    kanji: '片付ける',
    reading: 'かたづける',
    romaji: 'katazukeru',
    pitchAccent: '[4] 中高型',
    partOfSpeech: '一段他動詞',
    meaning: '執拾、整理（房間／書枱）',
    coreImage: '將亂糟糟散落一地嘅嘢放返去原本整齊嘅角落（片［かた］＋付ける）。',
    exampleJp: '部屋[へや]をきれいに片付[かたづ]けました。',
    exampleHk: '將間房執拾得乾乾淨淨。',
  },
  {
    id: 'ext-n4-v10',
    level: 'N4',
    kanji: '間に合う',
    reading: 'まにあう',
    romaji: 'maniau',
    pitchAccent: '[3] 中高型',
    partOfSpeech: '五段自動詞',
    meaning: '趕得切、來得及（時間／電車）',
    coreImage: '喺最後期限嗰條線（間）剛好夾得切（合う）！趕唔切就係「間に合わない」。',
    exampleJp: '走[はし]れば8時[じ]の電車[でんしゃ]に間[ま]に合[あ]いますよ。',
    exampleHk: '跑過去嘅話仲趕得切八點鐘班電車㗎！',
  },
  {
    id: 'ext-n3-v10',
    level: 'N3',
    kanji: 'きっかけ',
    reading: 'きっかけ',
    romaji: 'kikkake',
    pitchAccent: '[0] 平板型',
    partOfSpeech: '名詞',
    meaning: '契機、起因、導火線',
    coreImage: '令你開始做某件事（例如學日文、鍾意日本）嘅嗰粒「啟動火花」。',
    exampleJp: '日本のアニメを見[み]たのが、日本語[にほんご]を勉強[べんきょう]するきっかけになりました。',
    exampleHk: '睇日本動漫成為咗我開始學日文嘅契機。',
  },
  {
    id: 'ext-n2-v10',
    level: 'N2',
    kanji: '妥協する',
    reading: 'だきょうする',
    romaji: 'dakyou suru',
    pitchAccent: '[0] 平板型',
    partOfSpeech: '名詞・自動詞(する)',
    meaning: '妥協、讓步、退而求其次',
    coreImage: '日本職人紀錄片最愛講「一切妥協しない（絕不作任何妥協）」。',
    exampleJp: '品質[ひんしつ]には一切[いっさい]妥協[だきょう]せず、最高[さいこう]のものを作[つく]る。',
    exampleHk: '對品質絕不妥協，打造出最頂尖嘅作品。',
  },
  {
    id: 'ext-n1-v10',
    level: 'N1',
    kanji: '網羅する',
    reading: 'もうらする',
    romaji: 'moura suru',
    pitchAccent: '[1] 頭高型',
    partOfSpeech: '名詞・他動詞(する)',
    meaning: '網羅、全面涵蓋、一網打盡',
    coreImage: '好似張開魚網（網）同捕鳥網（羅）咁，將所有重點一滴不漏全部包攬晒！',
    exampleJp: 'この一冊[いっさつ]でJLPT N1の頻出[ひんしゅつ]語彙[ごい]をすべて網羅[もうら]している。',
    exampleHk: '單靠呢一本書就已經全面涵蓋晒 JLPT N1 嘅所有高頻詞彙。',
  },
];

export const SUPPLEMENTAL_DAILY_VOCAB_BY_LEVEL: Record<JlptLevel, VocabItem[]> = {
  N5: [
    {
      id: 'dt-sup-n5-1',
      level: 'N5',
      kanji: 'お釣り',
      reading: 'おつり',
      romaji: 'otsuri',
      pitchAccent: '[0] 平板型',
      partOfSpeech: '名詞',
      meaning: '找續、找贖（零錢）',
      coreImage: '畀完現金之後店員找返俾你嘅錢：「200円のお釣りです（找你 200 円）」。',
      exampleJp: 'お釣[つ]りとレシートをお確[たし]かめください。',
      exampleHk: '請核對找續同埋收據。',
    },
    {
      id: 'dt-sup-n5-2',
      level: 'N5',
      kanji: '各駅停車',
      reading: 'かくえきていしゃ',
      romaji: 'kakuekiteisha',
      pitchAccent: '[5] 中高型',
      partOfSpeech: '名詞',
      meaning: '每站停車（慢車）',
      coreImage: '搭日本電車必分「急行（快車）」同「各駅停車（站站停）」，唔好上錯車飛過站！',
      exampleJp: '次[つぎ]の電車[でんしゃ]は各駅停車[かくえきていしゃ]です。',
      exampleHk: '下一班電車係每站停車嘅普通列車。',
    },
    {
      id: 'dt-sup-n5-3',
      level: 'N5',
      kanji: '持ち帰り',
      reading: 'もちかえり',
      romaji: 'mochikaeri',
      pitchAccent: '[0] 平板型',
      partOfSpeech: '名詞',
      meaning: '外賣自取（テイクアウト）',
      coreImage: '日本餐廳「店内（堂食）」稅率10%，「お持ち帰り（外賣）」輕減稅率8%！',
      exampleJp: 'お持[も]ち帰[かえ]りですか、店内[てんない]でお召[め]し上[あ]がりですか。',
      exampleHk: '請問係外賣拎走，定係喺店內堂食呢？',
    },
  ],
  N4: [
    {
      id: 'dt-sup-n4-1',
      level: 'N4',
      kanji: 'いつの間にか',
      reading: 'いつのまにか',
      romaji: 'itsunomanika',
      pitchAccent: '[4] 中高型',
      partOfSpeech: '副詞片語',
      meaning: '不知不覺間、唔覺意之間',
      coreImage: '動漫同日劇超常出！自己都冇察覺嗰陣，季節或者關係已經悄悄改變咗。',
      exampleJp: '本[ほん]を読[よ]んでいたら、いつの間[ま]にか眠[ねむ]ってしまった。',
      exampleHk: '睇緊書嗰陣，不知不覺間就瞓着咗。',
    },
    {
      id: 'dt-sup-n4-2',
      level: 'N4',
      kanji: '食べ放題',
      reading: 'たべほうだい',
      romaji: 'tabehoudai',
      pitchAccent: '[4] 中高型',
      partOfSpeech: '名詞',
      meaning: '任食、放題（All-you-can-eat）',
      coreImage: '「動詞ます形去ます ＋ 放題」＝任做！「飲み放題（任飲）」亦係居酒屋必備詞。',
      exampleJp: '焼肉[やきにく]の食[た]べ放題[ほうだい]コースを予約[よやく]しました。',
      exampleHk: '預訂咗燒肉任食放題套餐。',
    },
    {
      id: 'dt-sup-n4-3',
      level: 'N4',
      kanji: '思い出',
      reading: 'おもいで',
      romaji: 'omoide',
      pitchAccent: '[0] 平板型',
      partOfSpeech: '名詞',
      meaning: '回憶、難忘記憶',
      coreImage: '由心入面湧現出嚟（思い出す）嘅珍貴往事：「楽しい思い出を作る（創造開心回憶）」。',
      exampleJp: '友達[ともだち]との旅行[りょこう]は一生[いっしょう]の思[おも]い出[で]になった。',
      exampleHk: '同朋友去嘅呢次旅行，成為咗一世難忘嘅回憶。',
    },
  ],
  N3: [
    {
      id: 'dt-sup-n3-1',
      level: 'N3',
      kanji: 'ポイント還元',
      reading: 'ぽいんとかんげん',
      romaji: 'pointo kangen',
      pitchAccent: '[5] 中高型',
      partOfSpeech: '名詞・スル動詞',
      meaning: '積分回贈',
      coreImage: '日本無現金支付最吸引人嘅「5%ポイント還元（5%積分回贈）」，新聞與商場隨處可見。',
      exampleJp: 'アプリで払[はら]うと、最大[さいだい]10％のポイントが還元[かんげん]される。',
      exampleHk: '用 App 俾錢嘅話，最高可獲 10% 積分回贈。',
    },
    {
      id: 'dt-sup-n3-2',
      level: 'N3',
      kanji: '夢中になる',
      reading: 'むちゅうになる',
      romaji: 'muchuu ni naru',
      pitchAccent: '[0] 平板型',
      partOfSpeech: '慣用片語',
      meaning: '沉迷、全神貫注、着迷',
      coreImage: '好似行入夢境入面咁忘記晒時間！「ゲームに夢中になる（沉迷打機）」。',
      exampleJp: '面白[おもしろ]いアニメに夢中[むちゅう]になって、時間[じかん]を忘[わす]れた。',
      exampleHk: '太沉迷睇套超好睇嘅動漫，連時間都忘記埋。',
    },
    {
      id: 'dt-sup-n3-3',
      level: 'N3',
      kanji: '売り切れる',
      reading: 'うりきれる',
      romaji: 'urikireru',
      pitchAccent: '[4] 中高型',
      partOfSpeech: '一段自動詞',
      meaning: '賣晒、售罄（完売）',
      coreImage: '「売る」+「切れる（徹底完晒）」。限定周邊或門票「あっという間に売り切れた（轉眼賣晒）」。',
      exampleJp: '限定[げんてい]ケーキは午前中[ごぜんちゅう]に売[う]り切[き]れてしまった。',
      exampleHk: '限定蛋糕喺中午前已經賣晒喇。',
    },
  ],
  N2: [
    {
      id: 'dt-sup-n2-1',
      level: 'N2',
      kanji: '差し支えない',
      reading: 'さしつかえない',
      romaji: 'sashitsukaenai',
      pitchAccent: '[6] 中高型',
      partOfSpeech: 'い形容詞型表現',
      meaning: '無妨、無問題、唔緊要（商務鄭重語）',
      coreImage: '日企電郵超愛問「差し支えなければ（如果方便／無妨嘅話，請問可否...）」。',
      exampleJp: '差[さ]し支[つか]えなければ、明後日[あさって]の午後[ごご]にお伺[うかが]いしてもよろしいでしょうか。',
      exampleHk: '如果方便無妨嘅話，請問後日下晝過嚟拜訪你可以嗎？',
    },
    {
      id: 'dt-sup-n2-2',
      level: 'N2',
      kanji: '円滑',
      reading: 'えんかつ',
      romaji: 'enkatsu',
      pitchAccent: '[0] 平板型',
      partOfSpeech: 'な形容詞・名詞',
      meaning: '順暢、圓滑（溝通／業務推進）',
      coreImage: '必記黃金配搭：「コミュニケーションを円滑にする（令溝通更順暢）」、「業務を円滑に進める」。',
      exampleJp: '部署間[ぶしょかん]の連携[れんけい]を円滑[えんかつ]にするため、定例会[ていれいかい]を設[もう]けた。',
      exampleHk: '為咗令部門之間嘅協作更順暢，設立咗定期例會。',
    },
    {
      id: 'dt-sup-n2-3',
      level: 'N2',
      kanji: '定着する',
      reading: 'ていちゃくする',
      romaji: 'teichaku suru',
      pitchAccent: '[0] 平板型',
      partOfSpeech: '名詞・自動詞(する)',
      meaning: '扎根、成為常態、穩固落嚟',
      coreImage: '新制度、新習慣唔再只係一時熱潮，而係喺社會或公司入面徹底穩固落嚟。',
      exampleJp: 'リモートワークが新[あたら]しい働[はたら]き方[かた]として定着[ていちゃく]しつつある。',
      exampleHk: '遙距工作正逐漸穩固成為一種新嘅工作常態。',
    },
  ],
  N1: [
    {
      id: 'dt-sup-n1-1',
      level: 'N1',
      kanji: '継承する',
      reading: 'けいしょうする',
      romaji: 'keishou suru',
      pitchAccent: '[0] 平板型',
      partOfSpeech: '名詞・他動詞(する)',
      meaning: '繼承、傳承（文化／技術／衣缽）',
      coreImage: '將先輩千錘百煉嘅技藝與精神接棒傳落去（「伝統技術を次世代へ継承する」）。',
      exampleJp: '先人[せんじん]の知恵[ちえ]を次世代[じせだい]へと継承[けいしょう]していく責務[せきむ]がある。',
      exampleHk: '我哋肩負住將前人智慧傳承落去下一代嘅責任。',
    },
    {
      id: 'dt-sup-n1-2',
      level: 'N1',
      kanji: '直面する',
      reading: 'ちょくめんする',
      romaji: 'chokumen suru',
      pitchAccent: '[0] 平板型',
      partOfSpeech: '名詞・自動詞(する)',
      meaning: '直面、正面面臨（危機／難題）',
      coreImage: '對象必用助詞「に」：「存続の危機に直面する（面臨存亡危機）」、「深刻な課題に直面する」。',
      exampleJp: '多[おお]くの伝統産業[でんとうさんぎょう]が後継者不足[こうけいしゃぶそく]という課題[かだい]に直面[ちょくめん]している。',
      exampleHk: '眾多傳統產業正面臨後繼無人呢個嚴峻課題。',
    },
    {
      id: 'dt-sup-n1-3',
      level: 'N1',
      kanji: '不可欠',
      reading: 'ふかけつ',
      romaji: 'fukaketsu',
      pitchAccent: '[0] 平板型',
      partOfSpeech: 'な形容詞・名詞',
      meaning: '不可或缺、必不可少（必要不可欠）',
      coreImage: '社論斷言必用詞，常與「〜に他ならない」或「〜上で不可欠だ」連用。',
      exampleJp: '地域社会[ちいきしゃかい]の活性化[かっせいか]には、若者[わかもの]の視点[してん]が不可欠[ふかけつ]だ。',
      exampleHk: '要活化社區，年輕人嘅視角係不可或缺嘅。',
    },
  ],
};

export const SECONDARY_GRAMMAR_BY_LEVEL: Record<JlptLevel, GrammarPoint> = {
  N5: {
    id: 'dt-sec-n5-g',
    level: 'N5',
    pattern: '動詞て形 ＋ もいいですか（請求許可）',
    formation: '動詞て形 ＋ もいいですか',
    meaning: '請問我可唔可以...呀？（禮貌詢問許可）',
    meaningJa: '相手に許可を求める表現（〜してもよろしいですか）',
    nuance: '去日本商店、車站、餐廳最萬用嘅禮貌提問句型，答應時講「はい、どうぞ」，婉拒時講「すみません、ちょっと…」。',
    nuanceJa: '自分の行動について相手の許可を丁寧に尋ねる基本表現です。写真を撮る時や席に座る時など、日常のあらゆる場面で使われます。',
    cantoneseComparison: '對應廣東話「唔該，請問可唔可以影相／用 Suica 俾錢呀？」。',
    exampleJp: 'すみません、ここでSuicaを使[つか]ってもいいですか。',
    exampleHk: '唔好意思，請問呢度可唔可以用 Suica 卡俾錢呀？',
  },
  N4: {
    id: 'dt-sec-n4-g',
    level: 'N4',
    pattern: '〜ておく（事前準備 vs 保持原狀）',
    formation: '動詞て形 ＋ おく（口語縮約：〜とく）',
    meaning: '1. 預先做好準備；2. 暫時放住／維持原狀先',
    meaningJa: '次の行動のための事前準備、または現状をそのまま維持する表現',
    nuance: '除咗大家最熟嘅「預先買定飛（買っておく）」，N4 仲好鍾意考第二個意思「そのままにしておいて（維持原狀唔好郁佢住）」！',
    nuanceJa: '①将来の目的のために前もって準備する用法と、②「会議で使うから窓を開けておいて」のように一時的にその状態を保つ用法の2つがN4で頻出します。',
    cantoneseComparison: '廣東話「訂定飛先（事前準備）」同埋「擺喺度先啦（維持原狀）」。',
    exampleJp: '旅行[りょこう]の前[まえ]に、ホテルと新幹線[しんかんせん]を予約[よやく]しておきました。',
    exampleHk: '喺去旅行之前，已經預先訂好晒酒店同埋新幹線。',
  },
  N3: {
    id: 'dt-sec-n3-g',
    level: 'N3',
    pattern: '〜た結果（けっか）／ 〜のおかげで vs 〜せいで',
    formation: '動詞た形 / 名詞の ＋ 結果・おかげで（好結果）・せいで（壞結果）',
    meaning: '經過...嘅結果／多得...（正面）vs 都怪...（負面）',
    meaningJa: '原因と結果の対比（好結果への感謝「おかげで」・悪結果への非難「せいで」）',
    nuance: '日文對因果情緒分得好清楚：好結果用「おかげで（多得）」、壞結果怪責用「せいで（都怪）」、客觀中立報告用「結果」。',
    nuanceJa: '「〜のおかげで」は良い結果に対する感謝の気持ちを表し、「〜のせいで」は悪い結果に対する不満や原因の追及を表します。「〜た結果」は客観的な事実の報告に使います。',
    cantoneseComparison: '廣東話「多得有電子支付，快咗好多」vs「都怪唔記得叉電，俾唔到錢」。',
    exampleJp: 'キャッシュレス決済[けっさい]を導入[どうにゅう]した結果[けっか]、レジの待[ま]ち時間[じかん]が半分[はんぶん]になった。',
    exampleHk: '引入咗無現金支付嘅結果，收銀處排隊等候時間減半。',
  },
  N2: {
    id: 'dt-sec-n2-g',
    level: 'N2',
    pattern: '〜を踏まえて（〜をふまえて）',
    formation: '名詞 ＋ を踏まえて / を踏まえた上で',
    meaning: '以...為基礎、充分考慮到（過往結果／實況）之後...',
    meaningJa: '過去の経験・調査結果・現状などを前提や根拠として考慮した上で',
    nuance: '商務報告與企劃書極高頻句型！強調唔係憑空想像，而係「立足於反省、數據或客戶意見」之上作出下一步改善。',
    nuanceJa: '反省点やアンケート結果、社会状況などの事実をしっかりと考慮に入れ、それを土台として次の判断や行動を行うことを表すN2必須表現です。',
    cantoneseComparison: '相當於香港職場講「根據上次問卷嘅反映，我哋今次作出以下優化」。',
    exampleJp: '昨年度[さくねんど]の反省[はんせい]を踏[ふ]まえて、今年度[こんねんど]の計画[けいかく]を立[た]てた。',
    exampleHk: '立足於上年度嘅檢討反省，制定咗今年度嘅計劃。',
  },
  N1: {
    id: 'dt-sec-n1-g',
    level: 'N1',
    pattern: '〜に他（ほか）ならない',
    formation: '名詞 / な形容詞語幹 / 句子普通形＋の ＋ に他ならない',
    meaning: '無非就係...、正正就係...（強烈斷言本質與核心原因）',
    meaningJa: 'まさに〜だ、〜以外の何物でもない（本質や理由の強い断定）',
    nuance: '社論作者喺文章結尾一錘定音時最愛用嘅句型，用嚟揭示事物最深層嘅本質：「這不是別的，正正就是...！」。',
    nuanceJa: '「他の何物でもなく、まさにこれこそが真実・本質的な理由である」と筆者が強い確信を持って断定する論説文・評論文の重要表現です。',
    cantoneseComparison: '相當於中文評論「呢個成功無非都係工匠長年堅持嘅成果」。',
    exampleJp: '伝統[でんとう]が今[いま]も愛[あい]されるのは、職人[しょくにん]たちのたゆまぬ努力[どりょく]の結晶[けっしょう]に他[ほか]ならない。',
    exampleHk: '傳統之所以至今仍深受愛戴，無非正正就係工匠們不懈努力嘅結晶。',
  },
};

/**
 * Pure helper that enriches any DailyTeacherLessonPack so every daily study session has:
 * - 6 curated vocabulary items (doubled from 3)
 * - Complete Japanese explanations (`nuanceJa` & `meaningJa`) on both primary & secondary grammar points
 * - 4 realistic dialogue turns + 2 speaking shadowing drills
 * - 3 mini-quiz questions (vocab + grammar + reading comprehension)
 */
export function enrichDailyLessonPack(pack: DailyTeacherLessonPack): DailyTeacherLessonPack {
  const supVocab = SUPPLEMENTAL_DAILY_VOCAB_BY_LEVEL[pack.level] || SUPPLEMENTAL_DAILY_VOCAB_BY_LEVEL.N4;
  const existingKanji = new Set(pack.vocabList.map((v) => v.kanji));
  const mergedVocab = [
    ...pack.vocabList,
    ...supVocab.filter((v) => !existingKanji.has(v.kanji)),
  ].slice(0, 6);

  const primaryGrammar: GrammarPoint = {
    ...pack.grammarPoint,
    meaningJa:
      pack.grammarPoint.meaningJa ||
      `「${pack.grammarPoint.pattern}」の基本的な意味と文脈での働き`,
    nuanceJa:
      pack.grammarPoint.nuanceJa ||
      (pack.grammarPoint.pattern.includes('につれて')
        ? '一方（A）が徐々に変化するのに伴って、もう一方（B）も一緒に同じ方向へ変化することを表します（前件・後件ともに変化を表す動詞・形容詞を用い、状態表現や意向形は使えません）。'
        : `「${pack.grammarPoint.pattern}」（接続：${pack.grammarPoint.formation}）は、話し手の判断・順序・状態の変化などを的確に表す${pack.level}の重要文型です。前後の動詞の形や助詞のつながりに注意しましょう。`),
  };

  const secondaryGrammar: GrammarPoint =
    pack.secondaryGrammarPoint || SECONDARY_GRAMMAR_BY_LEVEL[pack.level] || SECONDARY_GRAMMAR_BY_LEVEL.N4;

  const baseLines = pack.listeningDialogue.lines || [];
  const enrichedLines =
    baseLines.length >= 4
      ? baseLines
      : [
          ...baseLines,
          {
            speaker: baseLines[0]?.speaker || '男',
            textJp: `なるほど、よく分[わ]かりました。ちなみに、${mergedVocab[0]?.kanji || 'これ'}についても教[おし]えてもらえますか。`,
            textHk: `原來係咁，我明白晒喇。順帶一問，關於「${mergedVocab[0]?.kanji || '呢樣嘢'}」都可以教埋我嗎？`,
          },
          {
            speaker: baseLines[1]?.speaker || '女',
            textJp: `もちろんです！実際[じっさい]に声[こえ]に出[だ]して一緒[いっしょ]に練習[れんしゅう]してみましょう。`,
            textHk: `當然可以啦！我哋一齊大聲讀出嚟練習下啦。`,
          },
        ];

  const extraQuizzes: DailyTeacherMiniQuizItem[] =
    pack.extraQuizzes && pack.extraQuizzes.length >= 2
      ? pack.extraQuizzes
      : [
          {
            question: `【語彙チェック】「${mergedVocab[0]?.exampleJp.replace(mergedVocab[0]?.kanji, '（　　）') || 'この言葉を（　　）使います。'}」空欄に入る今日の重要語彙はどれですか？`,
            options: [
              mergedVocab[0]?.kanji || '温める',
              mergedVocab[1]?.kanji || '袋',
              mergedVocab[2]?.kanji || '別々',
              mergedVocab[3]?.kanji || '確認',
            ],
            correctIndex: 0,
            explanation: `「${mergedVocab[0]?.kanji}（${mergedVocab[0]?.reading}）」意思係「${mergedVocab[0]?.meaning}」。${mergedVocab[0]?.coreImage}`,
            explanationJa: `正解は「${mergedVocab[0]?.kanji}（${mergedVocab[0]?.reading}）」です。文脈に最も合う重要語彙を選びます。`,
          },
          {
            question: `【応用文法チェック】「${secondaryGrammar.exampleJp}」この文で使われている文型「${secondaryGrammar.pattern}」の働きとして最も適切なものはどれですか？`,
            options: [
              secondaryGrammar.meaning,
              '過去の習慣を懐かしむ表現',
              '相手の行動を強く禁止する表現',
              '伝聞の不確かな情報を表す表現',
            ],
            correctIndex: 0,
            explanation: `「${secondaryGrammar.pattern}」表示「${secondaryGrammar.meaning}」。${secondaryGrammar.nuance}`,
            explanationJa: secondaryGrammar.nuanceJa || `「${secondaryGrammar.pattern}」の用法に関する問題です。`,
          },
        ];

  return {
    ...pack,
    vocabList: mergedVocab,
    grammarPoint: primaryGrammar,
    secondaryGrammarPoint: secondaryGrammar,
    readingArticle: {
      ...pack.readingArticle,
      culturalTipJa:
        pack.readingArticle.culturalTipJa ||
        `【読解＆文化コラム】この文章では「${primaryGrammar.pattern}」や重要語彙「${mergedVocab[0]?.kanji || ''}」が実際の文脈の中で使われています。接続詞や文末表現に注目して全体の論理を掴みましょう。`,
    },
    listeningDialogue: {
      ...pack.listeningDialogue,
      lines: enrichedLines,
      secondSpeakingDrillJp:
        pack.listeningDialogue.secondSpeakingDrillJp || secondaryGrammar.exampleJp,
      secondSpeakingDrillHk:
        pack.listeningDialogue.secondSpeakingDrillHk || secondaryGrammar.exampleHk,
    },
    miniQuiz: {
      ...pack.miniQuiz,
      explanationJa:
        pack.miniQuiz.explanationJa ||
        `正解は選択肢${pack.miniQuiz.correctIndex + 1}です。「${primaryGrammar.pattern}」と文脈のつながりを確認しましょう。`,
    },
    extraQuizzes,
  };
}

export const EXTRA_GRAMMAR_POOL: GrammarPoint[] = DAILY_TEACHER_LESSON_PACKS.flatMap((p) => {
  const enriched = enrichDailyLessonPack(p);
  return enriched.secondaryGrammarPoint
    ? [enriched.grammarPoint, enriched.secondaryGrammarPoint]
    : [enriched.grammarPoint];
});

export const EXTRA_READING_POOL: ReadingPassage[] = DAILY_TEACHER_LESSON_PACKS.map((p) => ({
  id: `ext-read-${p.id}`,
  level: p.level,
  title: p.titleZh,
  contextType: p.themeTagZh,
  contentJp: p.readingArticle.contentJp,
  translationHk: p.readingArticle.translationHk,
  keyTakeaway: p.readingArticle.culturalTipHk,
  comprehensionQuestion: p.miniQuiz,
}));

export const EXTRA_LISTENING_POOL: ListeningExercise[] = DAILY_TEACHER_LESSON_PACKS.map((p) => ({
  id: `ext-listen-${p.id}`,
  level: p.level,
  category: 'daily',
  titleZh: p.titleZh,
  titleJa: p.titleJa,
  scenarioZh: p.listeningDialogue.scenarioZh,
  scenarioJa: p.listeningDialogue.scenarioJa,
  dialogueLines: enrichDailyLessonPack(p).listeningDialogue.lines,
  questionJp: p.miniQuiz.question,
  questionHk: p.miniQuiz.question,
  options: p.miniQuiz.options,
  correctIndex: p.miniQuiz.correctIndex,
  explanationZh: p.miniQuiz.explanation,
  explanationJa: p.miniQuiz.explanation,
}));

export const EXTRA_SPEAKING_POOL: SpeakingPrompt[] = DAILY_TEACHER_LESSON_PACKS.map((p) => ({
  id: `ext-speak-${p.id}`,
  level: p.level,
  contextTagZh: p.themeTagZh,
  contextTagJa: p.themeTagJa,
  situationZh: p.listeningDialogue.scenarioZh,
  situationJa: p.listeningDialogue.scenarioJa,
  targetJp: p.listeningDialogue.speakingDrillJp,
  romaji: 'Sensei Daily Speaking Drill',
  meaningHk: p.listeningDialogue.speakingDrillHk,
  pitchTipZh: p.readingArticle.culturalTipHk,
  pitchTipJa: p.teacherIntroJa,
}));

/**
 * Pure helper to pick the Daily Teacher Lesson Pack for a given JLPT level and date/shuffle offset.
 * Ensures that every day (or every click of the random shuffle button) produces a rich curriculum pack.
 */
export function getDailyTeacherPack(
  level: JlptLevel,
  offsetOrDateSeed: number = 0
): DailyTeacherLessonPack {
  const matching = DAILY_TEACHER_LESSON_PACKS.filter((p) => p.level === level);
  const pool = matching.length > 0 ? matching : DAILY_TEACHER_LESSON_PACKS;
  const safeIndex = Math.abs(Math.floor(offsetOrDateSeed)) % pool.length;
  return enrichDailyLessonPack(pool[safeIndex]);
}

/**
 * Computes a deterministic integer seed from a date string like "2026-11-08"
 */
export function getDateSeedNumber(dateStr?: string): number {
  const target = dateStr || new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < target.length; i++) {
    hash = (hash * 31 + target.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Official-style JLPT Mock Exam Question Bank (N5 - N1)
 * Each level contains questions across all 3 official sections:
 * 1. vocab_grammar (言語知識：文字・語彙・文法)
 * 2. reading (読解)
 * 3. listening (聴解 - with Web Speech API audio scripts)
 */
export const JLPT_MOCK_EXAM_BANK: JlptMockExamQuestion[] = [
  // ================= N5 MOCK EXAM =================
  {
    id: 'mock-n5-1',
    level: 'N5',
    section: 'vocab_grammar',
    mondaiLabel: '問題1・漢字読み（文字・語彙）',
    promptJp: '＿＿＿の言葉の読み方として最もよいものを、1・2・3・4から一つ選びなさい。\n「毎朝、駅の前で「新聞」を買います。」',
    options: ['しんぶん', 'しんぷん', 'じんぶん', 'きくぶん'],
    correctIndex: 0,
    explanationHk: '「新聞（報紙）」嘅正確平假名讀音係「しんぶん (shinbun)」。',
    explanationJa: '「新聞」の読み方は「しんぶん」です。',
  },
  {
    id: 'mock-n5-2',
    level: 'N5',
    section: 'vocab_grammar',
    mondaiLabel: '問題2・文脈規定（語彙）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「このカレーはとても（　　）ですが、おいしいです。」',
    options: ['からい', 'あまい', 'わかい', 'せまい'],
    correctIndex: 0,
    explanationHk: '形容咖哩「雖然好辣（からい），但好好食」，所以揀「からい（辛い）」。',
    explanationJa: 'カレーの味を表す言葉として「からい（辛い）」が最も適切です。',
  },
  {
    id: 'mock-n5-3',
    level: 'N5',
    section: 'vocab_grammar',
    mondaiLabel: '問題3・文法形式の判断（文法）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「きのう、デパート（　　）友だちと映画を見ました。」',
    options: ['で', 'に', 'を', 'へ'],
    correctIndex: 0,
    explanationHk: '表示動作進行嘅場所（喺百貨公司入面睇戲）要用助詞「で」。',
    explanationJa: '動作が行われる場所を表す助詞は「で」です。',
  },
  {
    id: 'mock-n5-4',
    level: 'N5',
    section: 'reading',
    mondaiLabel: '問題4・内容理解（短文読解）',
    passageJp:
      '【図書館のお知らせ】\n来週の月曜日から水曜日まで、図書館の本の整理をします。その間は本を借りることができません。本を返す人は、入り口の横にある「返却ポスト」に入れてください。',
    promptJp: '来週の火曜日に本を返したい人は、どうしますか。',
    options: [
      '入り口の横のポストに本を入れる。',
      '図書館の中に入って職員に渡す。',
      '木曜日まで待ってから本を返す。',
      '月曜日の朝早くに図書館へ行く。',
    ],
    correctIndex: 0,
    explanationHk: '通告寫明星期一至三休館整理，還書嘅人請將書放入入口旁邊嘅「返却ポスト（還書箱）」。',
    explanationJa: '「本を返す人は、入り口の横にある返却ポストに入れてください」と書かれています。',
  },
  {
    id: 'mock-n5-5',
    level: 'N5',
    section: 'reading',
    mondaiLabel: '問題5・情報検索（読解）',
    passageJp:
      '【さくら日本語学校の授業時間】\n・午前のクラス：9:00〜12:15（月〜金）\n・午後のクラス：13:30〜16:45（月〜金）\n・夜の会話クラス：19:00〜20:30（火・木のみ）',
    promptJp: '昼間は会社で働いている人が、水曜日の夜に授業を受けたいです。どのクラスに入れますか。',
    options: [
      '水曜日の夜に受けられるクラスはない。',
      '夜の会話クラスに入れる。',
      '午後のクラスに入れる。',
      '午前のクラスに入れる。',
    ],
    correctIndex: 0,
    explanationHk: '夜間會話班只喺「火・木のみ（只限星期二、四）」上堂，星期三夜晚冇堂上。',
    explanationJa: '夜の会話クラスは「火・木のみ」なので、水曜日の夜は授業がありません。',
  },
  {
    id: 'mock-n5-6',
    level: 'N5',
    section: 'listening',
    mondaiLabel: '問題6・課題理解（聴解）',
    promptJp: '音声を聞いて、質問に答えなさい：男の人はこれからまず何をしますか。',
    audioScriptJp:
      '女の人と男の人が話しています。女：田中さん、会議の資料はもうコピーしましたか。男：はい、30部コピーしました。女：ありがとう。じゃあ、会議室の机の上に並べておいてください。あ、その前に、部長に資料を一部渡してくださいね。男：わかりました。すぐ行きます。質問：男の人はこれからまず何をしますか。',
    dialogueSpeakers: [
      { speaker: '女', lineJp: '田中さん、会議[かいぎ]の資料[しりょう]はもうコピーしましたか。' },
      { speaker: '男', lineJp: 'はい、30部[ぶ]コピーしました。' },
      { speaker: '女', lineJp: 'ありがとう。じゃあ、会議室[かいぎしつ]に並[なら]べておいてください。あ、その前[まえ]に、部長[ぶちょう]に資料[しりょう]を一部[いちぶ]渡[わた]してくださいね。' },
      { speaker: '男', lineJp: 'わかりました。すぐ行[い]きます。' },
    ],
    options: [
      '部長に資料を渡す',
      '資料を30部コピーする',
      '会議室の机に資料を並べる',
      'コーヒーを買いに行く',
    ],
    correctIndex: 0,
    explanationHk: '聽解最愛考「あ、その前に（呀，喺嗰樣之前...）」！女士最後補充叫佢先俾一份資料部長，所以男士首先要搵部長。',
    explanationJa: '「その前に、部長に資料を一部渡してくださいね」と言っているので、まず部長に資料を渡します。',
  },
  {
    id: 'mock-n5-7',
    level: 'N5',
    section: 'vocab_grammar',
    mondaiLabel: '問題7・漢字表記（文字・語彙）',
    promptJp: '＿＿＿の言葉はどう書きますか。1・2・3・4から最もよいものを一つ選びなさい。\n「日曜日は友だちと『えいが』を見に行きます。」',
    options: ['映画', '英画', '映書', '画映'],
    correctIndex: 0,
    explanationHk: '「えいが（電影）」漢字寫作「映画」。',
    explanationJa: '「えいが」の正しい漢字は「映画」です。',
  },
  {
    id: 'mock-n5-8',
    level: 'N5',
    section: 'vocab_grammar',
    mondaiLabel: '問題8・文の組み立て（文法）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「わたしは毎週日曜日に部屋を（　　）から、買い物に行きます。」',
    options: ['掃除して', '掃除し', '掃除した', '掃除する'],
    correctIndex: 0,
    explanationHk: '「動詞て形 ＋ から」表示先後順序（打掃完房間之後，再去買嘢）。',
    explanationJa: '「〜てから」は動作の順序（掃除した後に買い物に行く）を表します。',
  },
  {
    id: 'mock-n5-9',
    level: 'N5',
    section: 'reading',
    mondaiLabel: '問題9・内容理解（メール読解）',
    passageJp:
      '【マリアさんからキムさんへのメッセージ】\nキムさん、あしたのパーティーですが、わたしはケーキを買っていきます。飲み物は先生の家にたくさんあるそうですから、買わなくてもいいですよ。キムさんは紙皿とコップをお願いします！',
    promptJp: 'キムさんはあした、何を持っていきますか。',
    options: [
      '紙皿とコップ',
      'ケーキと飲み物',
      '飲み物だけ',
      'ケーキと紙皿',
    ],
    correctIndex: 0,
    explanationHk: 'Maria 買蛋糕、飲品喺老師屋企已經有好多唔使買，最後一句請 Kim 帶「紙皿とコップ（紙碟同杯）」。',
    explanationJa: '「キムさんは紙皿とコップをお願いします」と書かれています。',
  },
  {
    id: 'mock-n5-10',
    level: 'N5',
    section: 'listening',
    mondaiLabel: '問題10・ポイント理解（聴解）',
    promptJp: '音声を聞いて答えなさい：二人は何時のバスに乗りますか。',
    audioScriptJp:
      '男：美術館へ行くバスは何時ですか。\n女：ええと、10時15分と、10時45分がありますよ。\n男：いま10時5分だから、10時15分のバスにしましょう。\n女：あ、でも切符を買う場所が混んでいますね。次のバスにして、近くの喫茶店でコーヒーを飲みませんか。\n男：そうですね。そうしましょう。',
    dialogueSpeakers: [
      { speaker: '男', lineJp: '美術館[びじゅつかん]へ行[い]くバスは何時[なんじ]ですか。' },
      { speaker: '女', lineJp: 'ええと、10時[じ]15分[ふん]と、10時[じ]45分[ふん]がありますよ。' },
      { speaker: '男', lineJp: 'いま10時[じ]5分[ふん]だから、10時[じ]15分[ふん]のバスにしましょう。' },
      { speaker: '女', lineJp: 'あ、でも切符[きっぷ]を買[か]う場所[ばしょ]が混[こ]んでいますね。次[つぎ]のバスにして、近[ちか]くの喫茶店[きっさてん]でコーヒーを飲[の]みませんか。' },
      { speaker: '男', lineJp: 'そうですね。そうしましょう。' },
    ],
    options: ['10時45分のバス', '10時15分のバス', '10時05分のバス', '11時15分のバス'],
    correctIndex: 0,
    explanationHk: '雖然男士原本想搭 10:15 嘅巴士，但女士見買飛處好多人，提議改搭下一班（10:45）並去飲杯咖啡，男士最後同意（「そうしましょう」）。',
    explanationJa: '10時15分のバスではなく「次のバス（10時45分）にして」と提案し、男の人も同意しています。',
  },
  {
    id: 'mock-n5-11',
    level: 'N5',
    section: 'listening',
    mondaiLabel: '問題11・課題理解（聴解）',
    promptJp: '音声を聞いて答えなさい：女の人は昼ごはんに何を買いますか。',
    audioScriptJp:
      '男：お昼ごはん、コンビニへ買いに行くんですね。僕にもパンを一つ買ってきてくれませんか。\n女：いいですよ。わたしはお弁当とお茶を買います。パンは何がいいですか。\n男：たまごサンドをお願いします。お金はあとで払いますね。\n女：わかりました。',
    dialogueSpeakers: [
      { speaker: '男', lineJp: 'お昼[ひる]ごはん、コンビニへ買[か]いに行[い]くんですね。僕[ぼく]にもパンを一[ひと]つ買[か]ってきてくれませんか。' },
      { speaker: '女', lineJp: 'いいですよ。わたしはお弁当[べんとう]とお茶[ちゃ]を買[か]います。パンは何[なに]がいいですか。' },
      { speaker: '男', lineJp: 'たまごサンドをお願[ねが]いします。お金[かね]はあとで払[はら]いますね。' },
      { speaker: '女', lineJp: 'わかりました。' },
    ],
    options: [
      'お弁当とお茶とたまごサンド',
      'お弁当とお茶だけ',
      'たまごサンドとコーヒー',
      'おにぎりとお茶',
    ],
    correctIndex: 0,
    explanationHk: '女士買自己嘅「お弁当とお茶」之外，仲幫男士買埋一份「たまごサンド（雞蛋三文治）」。',
    explanationJa: '自分の「お弁当とお茶」に加えて、男の人に頼まれた「たまごサンド」を買います。',
  },
  {
    id: 'mock-n5-12',
    level: 'N5',
    section: 'listening',
    mondaiLabel: '問題12・即時応答（聴解）',
    promptJp: '音声を聞いて答えなさい：男の人はなぜきのう学校を休みましたか。',
    audioScriptJp:
      '女：リーさん、きのうは学校を休みましたね。風邪ですか。\n男：いいえ、体は元気だったんですが、朝起きたらおなかが痛くて、病院へ行きました。\n女：そうだったんですか。もう大丈夫ですか。\n男：はい、薬を飲んだのでもう元気です。',
    dialogueSpeakers: [
      { speaker: '女', lineJp: 'リーさん、きのうは学校[がっこう]を休[やす]みましたね。風邪[かぜ]ですか。' },
      { speaker: '男', lineJp: 'いいえ、朝[あさ]起[お]きたらおなかが痛[いた]くて、病院[びょういん]へ行[い]きました。' },
      { speaker: '女', lineJp: 'そうだったんですか。もう大丈夫[だいじょうぶ]ですか。' },
      { speaker: '男', lineJp: 'はい、薬[くすり]を飲[の]んだのでもう元気[げんき]です。' },
    ],
    options: ['おなかが痛かったから', '風邪をひいて熱があったから', '寝坊してバスに遅れたから', '国から家族が来たから'],
    correctIndex: 0,
    explanationHk: '男士否定咗感冒（「いいえ」），解釋係因為朝早起身肚痛（「おなかが痛くて」）去咗睇醫生。',
    explanationJa: '「朝起きたらおなかが痛くて、病院へ行きました」と言っています。',
  },

  // ================= N4 MOCK EXAM =================
  {
    id: 'mock-n4-1',
    level: 'N4',
    section: 'vocab_grammar',
    mondaiLabel: '問題1・漢字表記（文字・語彙）',
    promptJp: '＿＿＿の言葉はどう書きますか。1・2・3・4から最もよいものを一つ選びなさい。\n「明日の朝は早いので、目覚まし時計を「おく」ってから寝ます。」',
    options: ['セットして（合わせて）', '送って', '起きて', '置いて'],
    correctIndex: 0,
    explanationHk: '校鬧鐘用「目覚まし時計をセットする／合わせる」。',
    explanationJa: '目覚まし時計の時間を合わせることを「セットする」と言います。',
  },
  {
    id: 'mock-n4-2',
    level: 'N4',
    section: 'vocab_grammar',
    mondaiLabel: '問題2・文脈規定（語彙）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「急いで駅まで走ったので、8時の電車にやっと（　　）。」',
    options: ['間に合いました', '見つけました', '取り替えました', '片付けました'],
    correctIndex: 0,
    explanationHk: '「電車に間に合う（趕得切班電車）」係 N4 必考詞彙搭配。',
    explanationJa: '発車時刻に遅れずに乗れたという意味の「間に合いました」が正解です。',
  },
  {
    id: 'mock-n4-3',
    level: 'N4',
    section: 'vocab_grammar',
    mondaiLabel: '問題3・文法形式の判断（文法）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「窓が（　　）いますよ。寒いですから、閉めてもいいですか。」',
    options: ['開いて', '開けて', '閉まって', '閉めて'],
    correctIndex: 0,
    explanationHk: '助詞係「が」，而且後面講「好凍所以閂咗佢好冇？」，代表隻窗目前處於「打開咗嘅狀態（自動詞：開いています）」。',
    explanationJa: '助詞「が」とともに窓が開いている状態を表す自動詞「開いています」を選びます。',
  },
  {
    id: 'mock-n4-4',
    level: 'N4',
    section: 'reading',
    mondaiLabel: '問題4・内容理解（短文読解）',
    passageJp:
      '【山下さんへのメモ】\n山下さん、お疲れ様です。林です。\n今日15時からの打ち合わせですが、3階の会議室Aエアコンが故障しているため、4階の会議室Bに変更になりました。資料は私が持っていきますので、山下さんはパソコンだけ持ってきてください。',
    promptJp: 'メモを読んだ山下さんは、15時にどうしなければなりませんか。',
    options: [
      'パソコンを持って、4階の会議室Bへ行く。',
      '資料とパソコンを持って、3階の会議室Aへ行く。',
      'エアコンを直す人を呼んでから、4階へ行く。',
      '資料をコピーして、4階の会議室Bへ持っていく。',
    ],
    correctIndex: 0,
    explanationHk: '便條寫明會議地點改咗去「4階の会議室B」，而且資料由林先生帶，山下只需要帶電腦（パソコンだけ持ってきてください）。',
    explanationJa: '場所が4階の会議室Bに変更され、持ち物はパソコンだけです。',
  },
  {
    id: 'mock-n4-5',
    level: 'N4',
    section: 'reading',
    mondaiLabel: '問題5・理由把握（中篇読解）',
    passageJp:
      '私は小さい頃、野菜がぜんぜん食べられませんでした。しかし、高校生の時に北海道の農家でアルバイトをして、朝採れたばかりのトマトを食べた時、甘くてとても驚きました。それ以来、野菜が好きになり、今では毎日自分でサラダを作って食べています。',
    promptJp: '「私」が野菜を好きになったきっかけは何ですか。',
    options: [
      '北海道の農家で新鮮でおいしいトマトを食べたこと',
      '高校生の時に毎日自分でサラダを作るようになったこと',
      '小さい頃に母から野菜を食べるように言われたこと',
      '北海道のレストランで有名な料理を食べたこと',
    ],
    correctIndex: 0,
    explanationHk: '作者喺北海道農場打工時食到朝早剛摘落嚟（採れたばかり）嘅超甜番茄，自此（「それ以来」）就愛上食蔬菜。',
    explanationJa: '「朝採れたばかりのトマトを食べた時、甘くてとても驚きました。それ以来、野菜が好きになり」とあります。',
  },
  {
    id: 'mock-n4-6',
    level: 'N4',
    section: 'listening',
    mondaiLabel: '問題6・ポイント理解（聴解）',
    promptJp: '音声を聞いて答えなさい：二人は明日の日曜日、どこで会いますか。',
    audioScriptJp:
      '男：明日の映画、駅の近くの映画館だよね。10時に映画館の前で会おうか。\n女：うーん、日曜日は映画館の前がすごく混むから、駅の北改札口で会って、一緒に行かない？\n男：そうだね。じゃあ9時45分に北改札口で待ってるよ。',
    dialogueSpeakers: [
      { speaker: '男', lineJp: '明日[あした]の映画[えいが]、10時[じ]に映画館[えいがかん]の前[まえ]で会[あ]おうか。' },
      { speaker: '女', lineJp: 'うーん、日曜日[にちようび]は映画館[えいがかん]の前[まえ]がすごく混[こ]むから、駅[えき]の北改札口[きたかいさつぐち]で会[あ]って、一緒[いっしょ]に行[い]かない？' },
      { speaker: '男', lineJp: 'そうだね。じゃあ9時[じ]45分[ふん]に北改札口[きたかいさつぐち]で待[ま]ってるよ。' },
    ],
    options: [
      '駅の北改札口',
      '映画館の入り口の前',
      '駅の中のカフェ',
      '電車のホーム',
    ],
    correctIndex: 0,
    explanationHk: '雖然男士一開始提議喺戲院門口等，但女士話星期日好多人，提議改喺「駅の北改札口」見面，男士最後同意咗。',
    explanationJa: '女の人の提案で「駅の北改札口」で会うことになりました。',
  },
  {
    id: 'mock-n4-7',
    level: 'N4',
    section: 'vocab_grammar',
    mondaiLabel: '問題7・類義表現（語彙）',
    promptJp: '＿＿＿の言葉に意味が最も近いものを一つ選びなさい。\n「引っ越しの準備が『だいたい』終わりました。」',
    options: ['ほとんど', 'やっと', 'かならず', 'ぜんぜん'],
    correctIndex: 0,
    explanationHk: '「だいたい（大致上、差不多）」喺肯定句中同「ほとんど（幾乎、大部份）」意思最接近。',
    explanationJa: '「だいたい終わった」は「ほとんど終わった」とほぼ同じ意味です。',
  },
  {
    id: 'mock-n4-8',
    level: 'N4',
    section: 'vocab_grammar',
    mondaiLabel: '問題8・授受と敬語（文法）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「私が道に迷っていたら、親切な人が駅まで案内して（　　）。」',
    options: ['くれました', 'あげました', 'もらいました', 'やりました'],
    correctIndex: 0,
    explanationHk: '主語係「親切な人が（好心人主動為我做某事）」，所以用「〜てくれました」。如果主語係「私は親切な人に」先至用「もらいました」。',
    explanationJa: '主語が「親切な人が」なので、私に恩恵を与えてくれたことを表す「案内してくれました」が正解です。',
  },
  {
    id: 'mock-n4-9',
    level: 'N4',
    section: 'reading',
    mondaiLabel: '問題9・情報検索（案内板読解）',
    passageJp:
      '【みどり図書館・夏休み特別イベント】\n・絵本読み聞かせ会（小学生以下対象）：8月10日（土）10:30〜11:30（予約不要・無料）\n・本の修理ワークショップ（中学生以上対象）：8月11日（日）14:00〜16:00（要予約・材料費300円）',
    promptJp: '高校生の兄と7歳の妹が、予約なしで参加できるイベントはどれですか。',
    options: [
      '7歳の妹だけが、土曜日の「絵本読み聞かせ会」に参加できる。',
      '二人とも日曜日の「本の修理ワークショップ」に予約なしで参加できる。',
      '高校生の兄だけが、土曜日の「絵本読み聞かせ会」に参加できる。',
      '二人とも土曜日のイベントに無料で参加できる。',
    ],
    correctIndex: 0,
    explanationHk: '星期六嘅「絵本読み聞かせ会」唔使預約，但只限「小学生以下（7歲妹妹符合，高中生哥哥唔符合）」；星期日工作坊則必須預約（「要予約」）。',
    explanationJa: '予約不要なのは土曜日のイベントのみで、対象は「小学生以下（7歳の妹）」です。',
  },
  {
    id: 'mock-n4-10',
    level: 'N4',
    section: 'listening',
    mondaiLabel: '問題10・課題理解（聴解）',
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
      '企画書を新しく印刷して佐藤さんに渡す',
      '来週の会議の時間を変更する',
    ],
    correctIndex: 0,
    explanationHk: '男士最後講明順序：「まずデータを直してから、図表も見直すことにするよ（首先改好數據，跟住再調整圖表）」。',
    explanationJa: '「まずデータを直してから、図表も見直すことにするよ」と言っているので、まずデータを修正します。',
  },
  {
    id: 'mock-n4-11',
    level: 'N4',
    section: 'listening',
    mondaiLabel: '問題11・ポイント理解（聴解）',
    promptJp: '音声を聞いて答えなさい：女の人はどうして新しい靴を買いませんでしたか。',
    audioScriptJp:
      '男：あれ、デパートへ靴を買いに行くんじゃなかったの？何も買わなかったの？\n女：うん。すごくデザインが気に入った靴があったんだけど、私のサイズが売り切れていたの。\n男：そうか、値段が高すぎたのかと思ったよ。\n女：値段はセールで安かったから、本当に残念だったわ。',
    dialogueSpeakers: [
      { speaker: '男', lineJp: 'あれ、デパートへ靴[くつ]を買[か]いに行[い]くんじゃなかったの？何[なに]も買[か]わなかったの？' },
      { speaker: '女', lineJp: 'うん。すごくデザインが気[き]に入[い]った靴[くつ]があったんだけど、私[わたし]のサイズが売[う]り切[き]れていたの。' },
      { speaker: '男', lineJp: 'そうか、値段[ねだん]が高[たか]すぎたのかと思[おも]ったよ。' },
      { speaker: '女', lineJp: '値段[ねだん]はセールで安[やす]かったから、本当[ほんとう]に残念[ざんねん]だったわ。' },
    ],
    options: [
      '自分に合うサイズの靴が売り切れていたから',
      '値段が思ったより高すぎたから',
      '気に入るデザインの靴がなかったから',
      'デパートが休みで閉まっていたから',
    ],
    correctIndex: 0,
    explanationHk: '女士好鍾意個設計而且減價好平，但因為「私のサイズが売り切れていた（啱自己尺碼嘅鞋賣晒）」所以買唔成。',
    explanationJa: '「私のサイズが売り切れていたの」と理由を述べています。',
  },
  {
    id: 'mock-n4-12',
    level: 'N4',
    section: 'listening',
    mondaiLabel: '問題12・概要理解（聴解）',
    promptJp: '音声を聞いて答えなさい：男の人は週末に何をしましたか。',
    audioScriptJp:
      '女：週末は天気がよかったですね。海へ泳ぎに行きましたか。\n男：いや、実は金曜日の夜から少し熱が出ちゃって、土曜日は一日中家で寝ていたんだ。日曜日には熱が下がったから、近所の本屋へ行って小説を買って読んでいたよ。\n女：そうだったんですか。お大事にね。',
    dialogueSpeakers: [
      { speaker: '女', lineJp: '週末[しゅうまつ]は天気[てんき]がよかったですね。海[うみ]へ泳[およ]ぎに行[い]きましたか。' },
      { speaker: '男', lineJp: 'いや、実[じつ]は金曜日[きんようび]の夜[よる]から少[すこ]し熱[ねつ]が出[で]ちゃって、土曜日[どようび]は一日中[いちにちじゅう]家[いえ]で寝[ね]ていたんだ。' },
      { speaker: '男', lineJp: '日曜日[にちようび]には熱[ねつ]が下[さ]がったから、近所[きんじょ]の本屋[ほんや]へ行[い]って小説[しょうせつ]を買[か]って読[よ]んでいたよ。' },
      { speaker: '女', lineJp: 'そうだったんですか。お大事[だいじ]にね。' },
    ],
    options: [
      '土曜日は家で休んで、日曜日は本を読んで過ごした',
      '土曜日も日曜日も海へ行って泳いだ',
      '週末はずっと病院に入院していた',
      '友だちと一緒に遠くの山へ出かけた',
    ],
    correctIndex: 0,
    explanationHk: '男士因為發燒，星期六成日喺屋企瞓覺休息，星期日退燒後去附近書局買小説睇。',
    explanationJa: '土曜日は家で寝ていて、日曜日は本屋で小説を買って読んでいました。',
  },

  // ================= N3 MOCK EXAM =================
  {
    id: 'mock-n3-1',
    level: 'N3',
    section: 'vocab_grammar',
    mondaiLabel: '問題1・文脈規定（文字・語彙）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「キャッシュレス決済を使えば、レジで小銭を出す（　　）が省けて便利だ。」',
    options: ['手間', '手配', '手当', '手本'],
    correctIndex: 0,
    explanationHk: '「手間が省ける（省卻麻煩／工夫）」係 N3 必背慣用搭配。',
    explanationJa: '「手間が省ける」は時間や労力を節約できるという慣用表現です。',
  },
  {
    id: 'mock-n3-2',
    level: 'N3',
    section: 'vocab_grammar',
    mondaiLabel: '問題2・言い換え類義（語彙）',
    promptJp: '＿＿＿の言葉に意味が最も近いものを一つ選びなさい。\n「混雑を避けるため、『あらかじめ』チケットを購入しておいた。」',
    options: ['前もって', 'ついでに', 'たまたま', 'たちまち'],
    correctIndex: 0,
    explanationHk: '「あらかじめ（預先、事先）」同「前もって（事先）」係 N3 最常考嘅同義替換詞對！',
    explanationJa: '「あらかじめ」と「前もって」はどちらも「事前に」という意味です。',
  },
  {
    id: 'mock-n3-3',
    level: 'N3',
    section: 'vocab_grammar',
    mondaiLabel: '問題3・文法形式の判断（文法）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「日本のアニメを好きになったのを（　　）、独学で日本語を勉強し始めた。」',
    options: ['きっかけに', '最中に', 'おかげで', 'わりに'],
    correctIndex: 0,
    explanationHk: '「〜をきっかけに（以...為契機／開端）」表示開始做某件事嘅轉折動機。',
    explanationJa: '物事を始める動機や契機を表す「〜をきっかけに」が最も適切です。',
  },
  {
    id: 'mock-n3-4',
    level: 'N3',
    section: 'reading',
    mondaiLabel: '問題4・内容理解（短文読解）',
    passageJp:
      '読書をする際、「最後まで読まなければならない」と思い込むと、途中で難しくなった時に読書そのものが嫌になってしまうことがある。興味のない部分は飛ばしたり、合わないと思ったら別の本に切り替えたりするくらい気楽な気持ちで向き合うほうが、結果的に長く読書を続けられるのではないだろうか。',
    promptJp: '筆者が最も言いたいことは何か。',
    options: [
      '全部読もうと無理をせず、気楽な姿勢で本を読むほうが長続きする。',
      'どんなに難しい本でも、最後まであきらめずに読むことが大切だ。',
      '興味のある部分だけを読むと、本の内容が理解できなくなる。',
      '読書を長く続けるためには、簡単な本だけを選ぶべきだ。',
    ],
    correctIndex: 0,
    explanationHk: '句尾「〜くらい気楽な気持ちで向き合うほうが、結果的に長く読書を続けられるのではないだろうか（反問語氣表示作者主張）」點明：抱住輕鬆心態跳讀或換書，反而更能長久保持閱讀習慣。',
    explanationJa: '文末の「〜のではないだろうか」に筆者の主張が込められています。',
  },
  {
    id: 'mock-n3-5',
    level: 'N3',
    section: 'reading',
    mondaiLabel: '問題5・主張把握（中篇読解）',
    passageJp:
      '近年、商品の口コミ（レビュー）を参考にして買い物をする人が増えている。実際に使った人の感想は非常に役立つ一方で、中には特定の商品を高く評価しすぎたり、逆に根拠なく批判したりする書き込みも少なくない。そのため、星の数や一つの意見だけをうのみにするのではなく、複数の情報を比較して自分で判断する姿勢が求められている。',
    promptJp: 'ネットの口コミについて、筆者はどう考えているか。',
    options: [
      '便利な面もあるが、一つの意見をそのまま信じず自分で比較・判断すべきだ。',
      'うその書き込みが多いので、買い物の時に口コミは一切見ないほうがいい。',
      '星の数が多い商品の口コミなら、そのまま信用しても問題ない。',
      '批判的な口コミよりも、高く評価している口コミだけを参考にすべきだ。',
    ],
    correctIndex: 0,
    explanationHk: '「うのみにする（囫圇吞棗／盲目輕信）のではなく、複数の情報を比較して自分で判断する姿勢が求められている」清楚指出唔應該盲信單一評價，而要綜合比較判斷。',
    explanationJa: '「うのみにするのではなく、複数の情報を比較して自分で判断する姿勢が求められている」が答えの根拠です。',
  },
  {
    id: 'mock-n3-6',
    level: 'N3',
    section: 'listening',
    mondaiLabel: '問題6・課題理解（聴解）',
    promptJp: '音声を聞いて答えなさい：女の人はこれから何をしなければなりませんか。',
    audioScriptJp:
      '男：来週のセミナーだけど、参加者が予定より20名ほど増えそうなんだ。会場の椅子、足りるかな？\n女：えっ、そうなんですか。今の小ホールだとギリギリかもしれませんね。大ホールが空いているか、すぐ管理室に確認してみます。\n男：うん、頼むよ。配布資料の追加印刷は僕のほうでやっておくから。',
    dialogueSpeakers: [
      { speaker: '男', lineJp: '来週[らいしゅう]のセミナーだけど、参加者[さんかしゃ]が20名[めい]ほど増[ふ]えそうなんだ。会場[かいじょう]の椅子[いす]、足[た]りるかな？' },
      { speaker: '女', lineJp: '今の小ホールだとギリギリかもしれませんね。大ホールが空[あ]いているか、すぐ管理室[かんりしつ]に確認[かくにん]してみます。' },
      { speaker: '男', lineJp: 'うん、頼[たの]むよ。配布資料[はいふしりょう]の追加印刷[ついかいんさつ]は僕[ぼく]のほうでやっておくから。' },
    ],
    options: [
      '大ホールが使えるかどうか管理室に確認する',
      '配布資料を20部追加で印刷する',
      '小ホールに椅子を20脚運ぶ',
      '参加者にセミナー中止のメールを送る',
    ],
    correctIndex: 0,
    explanationHk: '女士講「大ホールが空いているか、すぐ管理室に確認してみます」，而加印資料係男士自己負責（「僕のほうでやっておく」）。',
    explanationJa: '女の人は「大ホールが空いているか、すぐ管理室に確認してみます」と言っています。',
  },
  {
    id: 'mock-n3-7',
    level: 'N3',
    section: 'vocab_grammar',
    mondaiLabel: '問題7・用法（語彙）',
    promptJp: '次の「さっそく」の使い方として最も適切なものを一つ選びなさい。',
    options: [
      '友だちに教えてもらった本を、さっそく本屋へ買いに行った。',
      '電車がさっそく遅れたので、会議に間に合わなかった。',
      'きのうは疲れていたので、夜12時にさっそく寝た。',
      '空が暗くなったと思ったら、さっそく雪が積もっていた。',
    ],
    correctIndex: 0,
    explanationHk: '「さっそく（馬上、立即）」用於積極、主動即刻採取行動（一聽完朋友介紹本書，即刻去書局買）。自然現象或消極遲到唔用「さっそく」。',
    explanationJa: '「さっそく」は、聞いたり思いついたりしたことをすぐに実行する時に使います。',
  },
  {
    id: 'mock-n3-8',
    level: 'N3',
    section: 'vocab_grammar',
    mondaiLabel: '問題8・文法形式の判断（文法）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「このケーキは値段が高い（　　）、あまりおいしくない。」',
    options: ['わりに', 'おかげで', 'につれて', 'ついでに'],
    correctIndex: 0,
    explanationHk: '「〜わりに（は）」表示「雖然價錢貴，但相對呢個價位嚟講並唔好食（與預期基準唔成比例）」。',
    explanationJa: '基準（値段が高い）から予想される程度と実際が異なることを表す「〜わりに」が正解です。',
  },
  {
    id: 'mock-n3-9',
    level: 'N3',
    section: 'reading',
    mondaiLabel: '問題9・情報検索（社内メール読解）',
    passageJp:
      '【総務部より：オフィス空調工事のお知らせ】\n今週土曜日（11月14日）は、ビル全体のエアコン点検工事のため、終日冷暖房が使用できません。また、13時から15時までは停電作業を行うため、エレベーターおよび社内のパソコン・コピー機もすべて停止します。休日に出勤される方は十分ご注意ください。',
    promptJp: '11月14日（土）の午前10時に出勤して仕事をする場合、どうなるか。',
    options: [
      'パソコンやエレベーターは使えるが、エアコンは使えない。',
      '停電中のため、パソコンもエレベーターも一切使えない。',
      '午前中はエアコンもパソコンも通常通りすべて使える。',
      'ビル全体が閉鎖されるため、社内に入ることができない。',
    ],
    correctIndex: 0,
    explanationHk: '冷暖氣係「終日（全日）」停用，而停電（影響升降機同電腦）只係「13時から15時まで」，所以朝早 10 點可以用電腦同升降機，但冇冷暖氣。',
    explanationJa: '空調は終日使用不可ですが、停電は13時〜15時のみなので午前10時はパソコンやエレベーターは使えます。',
  },
  {
    id: 'mock-n3-10',
    level: 'N3',
    section: 'listening',
    mondaiLabel: '問題10・課題理解（聴解）',
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
      '企画書を印刷して会議室へ持っていく',
      '来週のプレゼンを延期する連絡をする',
    ],
    correctIndex: 0,
    explanationHk: '男士最後講「まずデータを直してから、図表も見直すことにするよ」，所以第一步係修正企劃書入面嘅數據數字。',
    explanationJa: '「まずデータを直してから、図表も見直すことにするよ」と言っています。',
  },
  {
    id: 'mock-n3-11',
    level: 'N3',
    section: 'listening',
    mondaiLabel: '問題11・ポイント理解（聴解）',
    promptJp: '音声を聞いて答えなさい：女の人が今のアルバイトを選んだ一番の理由は何ですか。',
    audioScriptJp:
      '男：鈴木さん、先月から新しいカフェでアルバイトを始めたんだって？時給がいいの？\n女：ううん、時給は前の店とあまり変わらないんだけど、シフトの時間を毎週自由に決められるの。大学の授業やテスト期間に合わせやすいから、すごく助かってるよ。\n男：なるほど、それは学生にとって一番大事だよね。',
    dialogueSpeakers: [
      { speaker: '男', lineJp: '鈴木さん、先月[せんげつ]から新[あたら]しいカフェでアルバイトを始[はじ]めたんだって？時給[じきゅう]がいいの？' },
      { speaker: '女', lineJp: 'ううん、時給[じきゅう]は前[まえ]の店[みせ]とあまり変[か]わらないんだけど、シフトの時間[じかん]を毎週[まいしゅう]自由[じゆう]に決[き]められるの。' },
      { speaker: '女', lineJp: '大学[だいがく]の授業[じゅぎょう]やテスト期間[きかん]に合[あ]わせやすいから、すごく助[たす]かってるよ。' },
      { speaker: '男', lineJp: 'なるほど、それは学生[がくせい]にとって一番[いちばん]大事[だいじ]だよね。' },
    ],
    options: [
      '大学の予定に合わせて働く時間を自由に調整できるから',
      '前のアルバイト先よりも時給がずっと高いから',
      'カフェのコーヒーやケーキが無料で食べられるから',
      '自宅から歩いてすぐの場所にあるから',
    ],
    correctIndex: 0,
    explanationHk: '女士否定咗時薪高（「時給は前の店とあまり変わらない」），指出最吸引係「シフトの時間を毎週自由に決められる（可以配合大學上堂同考試自由編更）」。',
    explanationJa: '「シフトの時間を毎週自由に決められる」「大学の授業やテスト期間に合わせやすい」と言っています。',
  },
  {
    id: 'mock-n3-12',
    level: 'N3',
    section: 'listening',
    mondaiLabel: '問題12・概要理解（聴解）',
    promptJp: '音声を聞いて答えなさい：二人は来月の旅行についてどうすることにしましたか。',
    audioScriptJp:
      '女：来月の温泉旅行だけど、新幹線で行くか、レンタカーで行くか迷うね。\n男：うん。最初はレンタカーでドライブしながら行こうかと思っていたけど、冬は山道に雪が降って危ないらしいよ。\n女：そっか、雪道の運転はちょっと心配だね。じゃあ、今回は安全に新幹線で行って、現地のバスで回ろうよ。\n男：そうだね、そうしよう！',
    dialogueSpeakers: [
      { speaker: '女', lineJp: '来月[らいげつ]の温泉旅行[おんせんりょこう]だけど、新幹線[しんかんせん]で行[い]くか、レンタカーで行[い]くか迷[まよ]うね。' },
      { speaker: '男', lineJp: '最初[さいしょ]はレンタカーで行[い]こうかと思[おも]っていたけど、冬[ふゆ]は山道[やまみち]に雪[ゆき]が降[ふ]って危[あぶ]ないらしいよ。' },
      { speaker: '女', lineJp: '雪道[ゆきみち]の運転[うんてん]はちょっと心配[しんぱい]だね。じゃあ、今回[こんかい]は安全[あんぜん]に新幹線[しんかんせん]で行[い]って、現地[げんち]のバスで回[まわ]ろうよ。' },
      { speaker: '男', lineJp: 'そうだね、そうしよう！' },
    ],
    options: [
      '雪道の運転が危ないので、新幹線と現地のバスを使って行く',
      '自由に移動できるよう、最初からレンタカーを借りて行く',
      '冬は雪が降って危険なので、来月の温泉旅行は中止にする',
      '長距離バスを予約して、温泉旅館まで直接行く',
    ],
    correctIndex: 0,
    explanationHk: '因為冬天山路落雪自駕危險，兩人決定改搭新幹線去，去到當地再搭巴士遊覽。',
    explanationJa: '雪道の運転が心配なので、新幹線で行って現地のバスで回ることに決めました。',
  },

  // ================= N2 MOCK EXAM =================
  {
    id: 'mock-n2-1',
    level: 'N2',
    section: 'vocab_grammar',
    mondaiLabel: '問題1・文脈規定（文字・語彙）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「今回のアンケート調査の結果を（　　）、新商品の開発計画を見直すことにした。」',
    options: ['踏まえて', '伴って', '巡って', '限って'],
    correctIndex: 0,
    explanationHk: '「結果／経験を踏まえて（以...結果為基礎、考慮到...）」係 N2 商務及評論最高頻固定搭配。',
    explanationJa: '調査結果などを前提・基礎として判断することを「〜を踏まえて」と言います。',
  },
  {
    id: 'mock-n2-2',
    level: 'N2',
    section: 'vocab_grammar',
    mondaiLabel: '問題2・用法（語彙）',
    promptJp: '次の「妥協」の使い方として最も適切なものを一つ選びなさい。',
    options: [
      '彼は料理の味には一切妥協しない職人気質の店主だ。',
      '明日の会議の時間を妥協していただけませんか。',
      '新しいパソコンの性能を妥協してから購入した。',
      '電車の遅れを妥協するために早めに出発した。',
    ],
    correctIndex: 0,
    explanationHk: '「妥協（だきょう）」係自動詞，最典型用法係「味／品質に一切妥協しない（對味道或品質絕不妥協）」或「妥協点を見つける」。',
    explanationJa: '「味や品質に一切妥協しない」は最も自然で頻出のコロケーションです。',
  },
  {
    id: 'mock-n2-3',
    level: 'N2',
    section: 'vocab_grammar',
    mondaiLabel: '問題3・文法形式の判断（文法）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「海外へ留学する（　　）、奨学金の申請手続きやビザの準備を進めている。」',
    options: ['に際して', 'につけても', 'にしろ', 'に相違ない'],
    correctIndex: 0,
    explanationHk: '「〜に際して（當...之際）」接喺重大事件（留學、開業、申請）後面，表示喺嗰個重要時間點進行準備。',
    explanationJa: '特別な行事や節目の時を表す「〜に際して」が正解です。',
  },
  {
    id: 'mock-n2-4',
    level: 'N2',
    section: 'reading',
    mondaiLabel: '問題4・内容理解（評論読解）',
    passageJp:
      '効率性ばかりが重視される現代社会において、「無駄」は排除すべきものとして扱われがちだ。しかし、一見すると役に立たないように思える雑談や寄り道の中からこそ、既存の枠組みを超えた独創的なアイデアが生まれることも少なくない。ゆとりを失い、最短距離だけを追い求めることは、結果として創造性の芽を摘んでしまう危険性をはらんでいる。',
    promptJp: '筆者の考えと合っているものはどれか。',
    options: [
      '一見無駄に見える時間やゆとりが、新しい発想を生むきっかけになることがある。',
      '独創的なアイデアを生むためには、雑談や寄り道を完全にやめるべきだ。',
      '現代社会では最短距離で効率よく目標を達成することが最も重要だ。',
      '無駄な時間を減らせば減らすほど、人間の創造性は豊かになる。',
    ],
    correctIndex: 0,
    explanationHk: '文章透過逆接詞「しかし」帶出核心論點：看似無用嘅閒聊同兜路（雑談や寄り道），往往先至係孕育獨創想法嘅泉源；過度追求捷徑反而會扼殺創意。',
    explanationJa: '「一見すると役に立たないように思える雑談や寄り道の中からこそ、独創的なアイデアが生まれることも少なくない」と一致します。',
  },
  {
    id: 'mock-n2-5',
    level: 'N2',
    section: 'reading',
    mondaiLabel: '問題5・ビジネス文書理解（情報検索）',
    passageJp:
      '【社内通達：新経費精算システム導入のご案内】\n11月1日より、交通費および出張費の精算がすべてオンライン化されます。\n・10月31日までに発生した経費：従来通り紙の申請書に領収書原本を添付し、11月10日までに経理部へ提出してください。\n・11月1日以降に発生した経費：新システムから領収書の写真をアップロードして申請してください。',
    promptJp: '10月28日に出張した社員が、11月5日に経費を精算する場合、どうしなければならないか。',
    options: [
      '紙の申請書に領収書の原本を添えて、経理部へ提出する。',
      '新システムから領収書の写真をアップロードして申請する。',
      '10月31日を過ぎているため、経費の精算はできない。',
      '経理部に電話して、メールで領収書の写真を送る。',
    ],
    correctIndex: 0,
    explanationHk: 'N2 商務文書最愛考「發生日期 vs 申請日期」嘅陷阱！出差係 10 月 28 日（「10月31日までに発生した経費」），所以只要喺 11 月 10 日前用舊方法（紙本申請書＋收據正本）交去會計部即可。',
    explanationJa: '経費が発生した日が10月28日（10月31日まで）なので、紙の申請書に領収書原本を添付して11月10日までに提出します。',
  },
  {
    id: 'mock-n2-6',
    level: 'N2',
    section: 'listening',
    mondaiLabel: '問題6・概要理解（聴解）',
    promptJp: '音声を聞いて答えなさい：課長は企画書のどこを直してほしいと言っていますか。',
    audioScriptJp:
      '男：佐藤さん、この企画書、ターゲット層の分析や市場データはよく調べられていて説得力があるね。ただ、予算の内訳が少し大まかすぎるから、広告費と開発費をもっと細かく分けて書いてくれるかな。デザイン案はこのままで問題ないよ。\n女：承知いたしました。本日中に予算の項目を修正して再提出いたします。',
    dialogueSpeakers: [
      { speaker: '男', lineJp: '佐藤さん、この企画書[きかくしょ]、ターゲット層[そう]の分析[ぶんせき]や市場[しじょう]データはよく調[しら]べられていて説得力[せっとくりょく]があるね。' },
      { speaker: '男', lineJp: 'ただ、予算[よさん]の内訳[うちわけ]が少[すこ]し大[おお]まかすぎるから、広告費[こうこくひ]と開発費[かいはつひ]をもっと細[こま]かく分[わ]けて書[か]いてくれるかな。デザイン案[あん]はこのままで問題[もんだい]ないよ。' },
      { speaker: '女', lineJp: '承知[しょうち]いたしました。本日中[ほんじつじゅう]に予算[よさん]の項目[こうもく]を修正[しゅうせい]して再提出[さいていしゅつ]いたします。' },
    ],
    options: [
      '予算の内訳をもっと細かく分けて書くこと',
      'ターゲット層の分析データを集め直すこと',
      '商品のデザイン案を最初から作り直すこと',
      '市場データのグラフを削除すること',
    ],
    correctIndex: 0,
    explanationHk: '課長先讚賞市場數據同目標客群分析好有說服力，然後用「ただ（不過）」轉折指出：「予算の内訳が少し大まかすぎる（預算明細太粗略）」，要求細分廣告費與開發費。',
    explanationJa: '「ただ、予算の内訳が少し大まかすぎるから、広告費と開発費をもっと細かく分けて書いてくれるかな」と言っています。',
  },
  {
    id: 'mock-n2-7',
    level: 'N2',
    section: 'vocab_grammar',
    mondaiLabel: '問題7・語形成（文字・語彙）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「新システムの導入により、業務の（　　）が大幅に向上した。」',
    options: ['効率性', '効率的', '効率化', '効率感'],
    correctIndex: 0,
    explanationHk: '「業務の効率性が向上する（業務嘅效率性得以提升）」或「業務の効率化が進む」。後接「が向上した」，配名詞「効率性」最嚴謹自然。',
    explanationJa: '「〜が向上した」の主語になる抽象名詞「効率性」が最も適切です。',
  },
  {
    id: 'mock-n2-8',
    level: 'N2',
    section: 'vocab_grammar',
    mondaiLabel: '問題8・文法形式の判断（文法）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「この契約書は重要ですから、社長に相談して（　　）返事をします。」',
    options: ['からでないと', 'からといって', 'どころか', 'ばかりか'],
    correctIndex: 0,
    explanationHk: '「〜てからでないと…ない／できない（如果唔先做 A 嘅話，就唔能夠 B）」表示先請示社長係作出回覆嘅必要前提。',
    explanationJa: '「相談した後でなければ返事できない」という必要条件を表す「〜てからでないと」が正解です。',
  },
  {
    id: 'mock-n2-9',
    level: 'N2',
    section: 'reading',
    mondaiLabel: '問題9・主張比較（統合読解）',
    passageJp:
      '【A社の働き方改革】週3日のリモートワークを導入し、通勤時間の削減と集中できる環境づくりを優先している。\n【B社の働き方改革】あえて原則出社を維持する代わりに、社内にカフェスペースを設け、部署を超えた偶発的なコミュニケーションから新企画が生まれる仕組みを重視している。',
    promptJp: 'A社とB社の取り組みについて、正しく述べているものはどれか。',
    options: [
      'A社は個人の作業効率や通勤負担の軽減を重視し、B社は社員同士の対面での交流を重視している。',
      'A社もB社も、すべての社員に毎日自宅で働くことを義務づけている。',
      'B社は通勤時間を減らすために、社内のカフェスペースを廃止した。',
      'A社は部署を超えた雑談を増やすため、リモートワークを禁止している。',
    ],
    correctIndex: 0,
    explanationHk: 'A社透過遙距工作減省通勤時間並提升專注度；B社則維持返公司並設立 Cafe 空間促進跨部門交流。',
    explanationJa: 'A社は通勤削減と集中環境、B社は対面での偶発的なコミュニケーションを重視しています。',
  },
  {
    id: 'mock-n2-10',
    level: 'N2',
    section: 'listening',
    mondaiLabel: '問題10・課題理解（聴解）',
    promptJp: '音声を聞いて答えなさい：女の人はこの後まず何をしますか。',
    audioScriptJp:
      '女：部長、来月の展示会のパンフレットですが、印刷会社からサンプルが届きました。\n男：ありがとう。色合いもきれいだし、レイアウトもこれでいいね。じゃあ、本番の印刷を2000部発注してくれる？あ、でもその前に、裏面の問い合わせ先電話番号に間違いがないか、もう一度総務部に確認しておいて。\n女：かしこまりました。すぐに確認してから発注いたします。',
    dialogueSpeakers: [
      { speaker: '女', lineJp: '部長[ぶちょう]、来月[らいげつ]の展示会[てんじかい]のパンフレットですが、印刷会社[いんさつがいしゃ]からサンプルが届[とど]きました。' },
      { speaker: '男', lineJp: 'ありがとう。レイアウトもこれでいいね。じゃあ、本番[ほんばん]の印刷[いんさつ]を2000部[ぶ]発注[はっちゅう]してくれる？' },
      { speaker: '男', lineJp: 'あ、でもその前[まえ]に、裏面[うらめん]の問[と]い合[あ]わせ先[さき]電話番号[でんわばんごう]に間違[まちが]いがないか、総務部[そうむぶ]に確認[かくにん]しておいて。' },
      { speaker: '女', lineJp: 'かしこまりました。すぐに確認[かくにん]してから発注[はっちゅう]いたします。' },
    ],
    options: [
      '裏面の電話番号が正しいか総務部に確認する',
      '印刷会社に2000部の印刷をすぐ発注する',
      'パンフレットのレイアウトを最初から作り直す',
      '展示会の会場へパンフレットを運ぶ',
    ],
    correctIndex: 0,
    explanationHk: '部長喺叫佢落單印 2000 份之後補充：「あ、でもその前に（不過喺嗰樣之前）」，要先向總務部確認背面嘅查詢電話號碼有冇錯。',
    explanationJa: '「その前に、裏面の問い合わせ先電話番号に間違いがないか、もう一度総務部に確認しておいて」と言っています。',
  },
  {
    id: 'mock-n2-11',
    level: 'N2',
    section: 'listening',
    mondaiLabel: '問題11・ポイント理解（聴解）',
    promptJp: '音声を聞いて答えなさい：新製品の売上が伸びた最大の要因は何ですか。',
    audioScriptJp:
      '男：先月発売したワイヤレスイヤホン、予想以上に売上が伸びているそうだね。テレビCMの効果かな？\n女：実は今回はテレビCMは打っていないんです。ただ、機能をシンプルにして重さを従来の半分にしたところ、「長時間つけていても耳が疲れない」とSNSで口コミが広がったのが大きかったようです。\n男：なるほど、軽さと快適さが支持されたわけだね。',
    dialogueSpeakers: [
      { speaker: '男', lineJp: '先月[せんげつ]発売[はつばい]したイヤホン、予想以上[よそういじょう]に売上[うりあげ]が伸[の]びているそうだね。テレビCMの効果[こうか]かな？' },
      { speaker: '女', lineJp: '実[じつ]は今回[こんかい]はテレビCMは打[う]っていないんです。ただ、重[おも]さを従来[じゅうらい]の半分[はんぶん]にしたところ、「耳[みみ]が疲[つか]れない」とSNSで口コミが広[ひろ]がったのが大[おお]きかったようです。' },
      { speaker: '男', lineJp: 'なるほど、軽[かる]さと快適[かいてき]さが支持[しじ]されたわけだね。' },
    ],
    options: [
      '本体を軽くして耳が疲れにくい点がSNSの口コミで広まったこと',
      '有名な俳優を起用したテレビCMを大量に流したこと',
      '他社の製品よりも多彩で複雑な新機能をたくさん詰め込んだこと',
      '価格を従来の半分以下に大幅値下げしたこと',
    ],
    correctIndex: 0,
    explanationHk: '女士否定咗電視廣告，指出係因為將重量減半，令「戴好耐耳仔都唔攰」嘅口碑喺 SNS 上廣泛傳開。',
    explanationJa: '重さを従来の半分にし、「長時間つけていても耳が疲れない」とSNSで口コミが広がったことが要因です。',
  },
  {
    id: 'mock-n2-12',
    level: 'N2',
    section: 'listening',
    mondaiLabel: '問題12・即時応答（聴解）',
    promptJp: '音声を聞いて答えなさい：男の人はこの後どうしますか。',
    audioScriptJp:
      '男：あのう、来週の金曜日にある経営セミナーに申し込みたいんですが、まだ席は空いていますか。\n女：申し訳ございません。金曜日の回はすでに満席となっておりまして、キャンセル待ちでのご案内になります。なお、同じ内容のセミナーが翌週の火曜日にも追加開催されますが、いかがなさいますか。\n男：そうですか。火曜日は出張で参加できないので、金曜日のキャンセル待ちで登録をお願いします。',
    dialogueSpeakers: [
      { speaker: '男', lineJp: '来週[らいしゅう]の金曜日[きんようび]にある経営[けいえい]セミナーに申[もう]し込[こ]みたいんですが、まだ席[せき]は空[あ]いていますか。' },
      { speaker: '女', lineJp: '申[もう]し訳[わけ]ございません。金曜日[きんようび]の回[かい]はすでに満席[まんせき]で、キャンセル待[ま]ちになります。翌週[よくしゅう]の火曜日[かようび]にも追加開催[ついかかいさい]されますが、いかがなさいますか。' },
      { speaker: '男', lineJp: '火曜日[かようび]は出張[しゅっちょう]で参加[さんか]できないので、金曜日[きんようび]のキャンセル待[ま]ちで登録[とうろく]をお願[ねが]いします。' },
    ],
    options: [
      '金曜日のセミナーのキャンセル待ちに登録する',
      '翌週の火曜日の追加セミナーに申し込む',
      '出張の予定を変更して火曜日に参加する',
      'セミナーへの参加を完全に諦める',
    ],
    correctIndex: 0,
    explanationHk: '因為下星期二要出差去唔到，男士決定登記星期五場次嘅候補名單（「金曜日のキャンセル待ちで登録をお願いします」）。',
    explanationJa: '火曜日は出張で参加できないため、「金曜日のキャンセル待ちで登録をお願いします」と答えています。',
  },

  // ================= N1 MOCK EXAM =================
  {
    id: 'mock-n1-1',
    level: 'N1',
    section: 'vocab_grammar',
    mondaiLabel: '問題1・文脈規定（文字・語彙）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「長年の経験によって（　　）職人の鋭い勘は、最新のAIでも容易には再現できない。」',
    options: ['培われた', '企てられた', '阻まれた', '促された'],
    correctIndex: 0,
    explanationHk: '「長年の経験によって培われた（長年累月所培養／孕育出嚟嘅）」係 N1 最經典嘅語彙搭配。',
    explanationJa: '技術や能力などを長い時間をかけて養い育てることを「培う（つちかう）」と言います。',
  },
  {
    id: 'mock-n1-2',
    level: 'N1',
    section: 'vocab_grammar',
    mondaiLabel: '問題2・類義表現（語彙）',
    promptJp: '＿＿＿の言葉に意味が最も近いものを一つ選びなさい。\n「この辞書は、現代日本語の主要な慣用句をすべて『網羅して』いる。」',
    options: [
      '残らず取り入れて',
      '簡潔に省略して',
      '独自に作り出して',
      '厳しく批判して',
    ],
    correctIndex: 0,
    explanationHk: '「網羅（もうら）する」意思係一滴不漏、全面涵蓋，對應「残らず取り入れて（毫無遺漏地收錄）」。',
    explanationJa: '「網羅する」は、すべてのものを漏れなく集め収めるという意味です。',
  },
  {
    id: 'mock-n1-3',
    level: 'N1',
    section: 'vocab_grammar',
    mondaiLabel: '問題3・文法形式の判断（文法）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「原材料費の高騰により、多くの老舗飲食店がメニューの価格改定を（　　）。」',
    options: [
      '余儀なくされている',
      'ものともしていない',
      '禁じ得ない',
      '皮切りにしている',
    ],
    correctIndex: 0,
    explanationHk: '因為原材料價格飆升（外在壓力），眾多老字號餐廳「被迫無奈不得不調整價格（価格改定を余儀なくされている）」。',
    explanationJa: '不本意ながらそうせざるを得ない状況を表す「〜を余儀なくされている」が最も適切です。',
  },
  {
    id: 'mock-n1-4',
    level: 'N1',
    section: 'reading',
    mondaiLabel: '問題4・論理把握（評論文読解）',
    passageJp:
      '科学技術の進歩は、かつて人間が宿命として受け入れるしかなかった自然の制約を次々と克服してきたかに見える。しかし、いかに高度な予測モデルを構築しようとも、自然界の複雑な振る舞いを完全に制御下に置くことなど到底不可能である。技術を過信するあまり自然への畏怖を忘れることは、想定外の事態に直面した際の脆弱性をかえって高める結果に他ならない。',
    promptJp: '筆者がこの文章で最も主張したいことは何か。',
    options: [
      '科学技術を過信して自然への敬意や謙虚さを失うと、予想外の危機に弱くなってしまう。',
      '予測モデルをさらに高度化すれば、いずれ自然界のすべてを完全に制御できるようになる。',
      '科学技術は危険をもたらすだけなので、これ以上の研究開発は直ちに中止すべきだ。',
      'かつての人間は自然の制約を克服するために科学技術を過信しすぎていた。',
    ],
    correctIndex: 0,
    explanationHk: '句尾「〜に他ならない（無疑就係...）」係 N1 評論作者最強烈嘅結論標記：過度迷信科技而忘記對大自然嘅敬畏（畏怖），只會令人類面對突發災難時更加脆弱（脆弱性をかえって高める）。',
    explanationJa: '最終文の「技術を過信するあまり自然への畏怖を忘れることは、想定外の事態に直面した際の脆弱性をかえって高める結果に他ならない」が筆者の主張です。',
  },
  {
    id: 'mock-n1-5',
    level: 'N1',
    section: 'reading',
    mondaiLabel: '問題5・抽象論旨理解（長文読解）',
    passageJp:
      '言葉を学ぶということは、単に既存の概念に別の言語のラベルを貼り替える作業ではない。母語には存在しない微妙な語感の差異や、その社会が何を重んじてきたかという歴史的視座に触れることで、自らが自明としてきた思考の枠組みそのものを相対化する営みなのである。',
    promptJp: '筆者によると、「言葉を学ぶ」とはどういうことか。',
    options: [
      '異文化の価値観や語感に触れることで、自分のこれまでのものの見方を客観的に捉え直すこと。',
      '自分の母語にある単語を、外国語の単語に一つずつ正確に置き換えて暗記していくこと。',
      '母語の思考の枠組みを完全に捨て去り、外国語だけで考える習慣を身につけること。',
      'どの言語にも共通する普遍的なラベルを見つけ出し、効率よく意思疎通を図ること。',
    ],
    correctIndex: 0,
    explanationHk: '文章採用 N1 經典「A ではない、B なのである（唔係 A，而係 B！）」結構：學語言唔係單純換標籤，而係透過接觸異文化語感，將自己習以為常嘅思維框架「相対化する（客觀重新審視）」。',
    explanationJa: '「単にラベルを貼り替える作業ではない…自らが自明としてきた思考の枠組みそのものを相対化する営みなのである」に対応しています。',
  },
  {
    id: 'mock-n1-6',
    level: 'N1',
    section: 'listening',
    mondaiLabel: '問題6・統合理解（聴解）',
    promptJp: '音声を聞いて答えなさい：二人の専門家が共通して最も重要だと述べていることは何ですか。',
    audioScriptJp:
      '男：伝統工芸品の需要が落ち込む中、単に昔ながらの製法を固守するだけでは、市場から淘汰されるのを免れません。長年培われた職人技の核を守り抜きながらも、現代の生活に合った新たな用途やデザインを模索していくことが不可欠です。\n女：同感ですね。安易に大量生産に走れば本来の品質が損なわれてしまいますから、伝統の核心技術は維持しつつ、現代の消費者に響く新しい形へと昇華させる取り組みこそが求められています。',
    dialogueSpeakers: [
      { speaker: '男', lineJp: '伝統工芸品[でんとうこうげいひん]の需要[じゅよう]が落[お]ち込[こ]む中[なか]、単[たん]に昔[むかし]ながらの製法[せいほう]を固守[こしゅ]するだけでは、市場[しじょう]から淘汰[とうた]されるのを免[まぬが]れません。' },
      { speaker: '男', lineJp: '長年[ながねん]培[つちか]われた職人技[しょくにんわざ]の核[かく]を守[まも]り抜[ぬ]きながらも、現代[げんだい]の生活[せいかつ]に合[あ]った新[あたら]たな用途[ようと]やデザインを模索[もさく]していくことが不可欠[ふかけつ]です。' },
      { speaker: '女', lineJp: '同感[どうかん]ですね。伝統[でんとう]の核心技術[かくしんぎじゅつ]は維持[いじ]しつつ、現代[げんだい]の消費者[しょうひしゃ]に響[ひび]く新[あたら]しい形[かたち]へと昇華[しょうか]させる取[と]り組[く]みこそが求[もと]められています。' },
    ],
    options: [
      '伝統技術の核心を守りつつ、現代の生活に合った新しいデザインや用途を探ること',
      'コストを下げるために手作業をやめて、工場での大量生産に全面的に切り替えること',
      'デザインや用途を一切変えず、昔ながらの製法だけを守り続けること',
      '国内市場を諦めて、海外の富裕層向けにだけ高価な工芸品を販売すること',
    ],
    correctIndex: 0,
    explanationHk: '男女兩位專家一致認同：守護傳統技藝核心嘅同時，摸索符合現代生活嘅新設計同用途。',
    explanationJa: '二人とも「伝統の核・核心技術を守りつつ、現代に合った新たな用途・形を模索すること」が重要だと述べています。',
  },
  {
    id: 'mock-n1-7',
    level: 'N1',
    section: 'vocab_grammar',
    mondaiLabel: '問題7・用法（語彙）',
    promptJp: '次の「踏襲」の使い方として最も適切なものを一つ選びなさい。',
    options: [
      '新社長は、前任者が築いた経営方針を基本的に踏襲すると表明した。',
      '彼はライバル企業の最新技術を密かに踏襲して特許を出願した。',
      '台風の影響で、イベントの開催日程を踏襲せざるを得なくなった。',
      '長年の努力を踏襲した結果、ついに難関資格に合格した。',
    ],
    correctIndex: 0,
    explanationHk: '「踏襲（とうしゅう）する」意思係「沿襲、繼承（前人嘅方針、制度或傳統做法）」，最典型搭配係「前任者の方針／従来の形式を踏襲する」。',
    explanationJa: '「踏襲」は、これまでのやり方や方針などをそのまま受け継ぐという意味で使われます。',
  },
  {
    id: 'mock-n1-8',
    level: 'N1',
    section: 'vocab_grammar',
    mondaiLabel: '問題8・文法形式の判断（文法）',
    promptJp: '（　　）に入れるのに最もよいものを一つ選びなさい。\n「いかに優れた戦略であろうと、現場の理解と協力（　　）、成功はおぼつかない。」',
    options: ['なしには', 'ならでは', 'たりとも', 'とばかりに'],
    correctIndex: 0,
    explanationHk: '「〜なしには…ない／おぼつかない（如果冇...嘅話，就難以成功）」表示現場嘅理解與配合係不可或缺嘅條件。',
    explanationJa: '「〜がなければ成功は難しい」という必要条件を表す「〜なしには」が最も適切です。',
  },
  {
    id: 'mock-n1-9',
    level: 'N1',
    section: 'reading',
    mondaiLabel: '問題9・論旨把握（評論文読解）',
    passageJp:
      '情報のデジタル化と検索技術の高度化は、私たちに「いつでも答えにたどり着ける」という全能感を与えた。しかし、即座に得られる断片的な知識の集積は、必ずしも深い洞察や知恵へと直結しない。むしろ、答えの出ない問いを前にして試行錯誤し、思考を熟成させる「宙吊りの時間」に耐える力こそが、創造的な知的生産においては不可欠なのである。',
    promptJp: '筆者が最も強調したいことは何か。',
    options: [
      '創造的な思考には、すぐに答えを求めず自ら悩み考え抜く時間が必要だ。',
      '検索技術を活用して、できるだけ短時間で多くの断片的な知識を集めるべきだ。',
      'デジタル化された情報は誤りが多いため、紙の書籍だけを読むべきだ。',
      '答えの出ない問いについて考えるのは時間の無駄なので避けたほうがよい。',
    ],
    correctIndex: 0,
    explanationHk: '作者透過「むしろ〜こそが…不可欠なのである」強調：面對無標準答案嘅問題時，經歷反覆摸索與思考沉澱嘅時間，先至係創造性思考不可或缺嘅關鍵。',
    explanationJa: '「答えの出ない問いを前にして試行錯誤し、思考を熟成させる時間に耐える力こそが不可欠なのである」が筆者の結論です。',
  },
  {
    id: 'mock-n1-10',
    level: 'N1',
    section: 'listening',
    mondaiLabel: '問題10・課題理解（聴解）',
    promptJp: '音声を聞いて答えなさい：女の人はこの後、まず何に着手しますか。',
    audioScriptJp:
      '男：来期の海外展開プロジェクトだけど、現地法人の法規制の調査レポートはもうまとまった？\n女：はい、法務チームと連携して一通り完了しております。ただ、現地の流通パートナー候補3社の財務状況の比較データがまだ精査しきれていません。\n男：そうか。役員会議ではリスク評価が一番突っ込まれるからね。プロモーション施策の立案は後回しにしていいから、まずはその3社の財務比較を最優先で仕上げてくれないか。\n女：承知いたしました。直ちに取りかかります。',
    dialogueSpeakers: [
      { speaker: '男', lineJp: '来期[らいき]の海外展開[かいがいてんかい]プロジェクトだけど、法規制[ほうきせい]の調査[ちょうさ]レポートはもうまとまった？' },
      { speaker: '女', lineJp: 'はい、一通[ひととお]り完了[かんりょう]しております。ただ、現地[げんち]の流通[りゅうつう]パートナー候補[こうほ]3社[しゃ]の財務状況[ざいむじょうきょう]の比較[ひかく]データがまだ精査[せいさ]しきれていません。' },
      { speaker: '男', lineJp: 'プロモーション施策[しさく]の立案[りつあん]は後回[あとまわ]しにしていいから、まずはその3社[しゃ]の財務比較[ざいむひかく]を最優先[さいゆうせん]で仕上[しあ]げてくれないか。' },
      { speaker: '女', lineJp: '承知[しょうち]いたしました。直[ただ]ちに取りかかります。' },
    ],
    options: [
      '現地の流通パートナー候補3社の財務状況の比較データを精査する',
      '現地の法規制に関する調査レポートを最初から作成し直す',
      '海外向けのプロモーション施策の立案を先に進める',
      '役員会議の日程を延期するよう総務に連絡する',
    ],
    correctIndex: 0,
    explanationHk: '男士明確指示將宣傳企劃押後（「後回しにしていいから」），最優先完成當地 3 間流通夥伴候選公司嘅財務比較分析。',
    explanationJa: '「まずはその3社の財務比較を最優先で仕上げてくれないか」と指示されています。',
  },
  {
    id: 'mock-n1-11',
    level: 'N1',
    section: 'listening',
    mondaiLabel: '問題11・ポイント理解（聴解）',
    promptJp: '音声を聞いて答えなさい：研究者が今回の調査で最も意外だったと述べている点は何ですか。',
    audioScriptJp:
      '女：先生、都市部の緑地が住民の健康に与える影響についての調査、結果が出たそうですね。\n男：ええ。緑地が多い地域ほど住民のストレス値が低いというのは当初の仮説通りでした。しかし興味深いことに、公園の面積の広さそのものよりも、「自宅から徒歩5分以内に小さな植栽や街路樹が視界に入るか」という日常的な接触頻度のほうが、幸福度にはるかに強く相関していたのです。\n女：へえ、大きな公園が遠くにあるより、身近な緑のほうが効果的なんですね。',
    dialogueSpeakers: [
      { speaker: '女', lineJp: '先生[せんせい]、都市部[としぶ]の緑地[りょくち]が住民[じゅうみん]の健康[けんこう]に与[あた]える影響[えいきょう]についての調査[ちょうさ]、結果[けっか]が出[で]たそうですね。' },
      { speaker: '男', lineJp: 'ええ。緑地[りょくち]が多[おお]いほどストレス値[ち]が低[ひく]いというのは仮説通[かせつどお]りでした。しかし興味深[きょうみぶか]いことに、公園[こうえん]の面積[めんせき]の広[ひろ]さよりも、「徒歩[とほ]5分以内[ふんいない]に街路樹[がいろじゅ]などが視界[しかい]に入[はい]るか」という接触頻度[せっしょくひんど]のほうが、幸福度[こうふくど]に強[つよ]く相関[そうかん]していたのです。' },
      { speaker: '女', lineJp: 'へえ、大[おお]きな公園[こうえん]が遠[とお]くにあるより、身近[みぢか]な緑[みどり]のほうが効果的なんですね。' },
    ],
    options: [
      '公園の広さよりも、身近な緑を日常的に目にする頻度のほうが幸福度に強く影響していたこと',
      '都市部には緑地がまったく存在しないため、住民のストレス値が高かったこと',
      '公園の面積が広ければ広いほど、自宅からの距離に関係なく幸福度が最も高くなること',
      '緑地の有無は住民のストレスや健康状態と一切関係がなかったこと',
    ],
    correctIndex: 0,
    explanationHk: '研究者用「しかし興味深いことに」指出最令人意外嘅發現：比起公園面積大細，日常行路 5 分鐘內見唔見到樹木綠化嘅接觸頻率，同幸福感嘅相關性強得多。',
    explanationJa: '「公園の面積の広さそのものよりも、日常的な接触頻度のほうが幸福度にはるかに強く相関していた」と述べています。',
  },
  {
    id: 'mock-n1-12',
    level: 'N1',
    section: 'listening',
    mondaiLabel: '問題12・概要理解（聴解）',
    promptJp: '音声を聞いて答えなさい：二人は今後の図書館のあり方についてどう考えていますか。',
    audioScriptJp:
      '男：電子書籍の普及で、図書館の貸出冊数が減少傾向にあると言われていますね。\n女：ええ。でも、図書館の役割は単に本を無料で貸し出すことだけではありません。地域の人々が集い、調べ物をしたりワークショップを通じて知識を共有したりする「地域の知の拠点」としての価値はむしろ高まっています。\n男：おっしゃる通りですね。静かに本を読むだけの場所から、対話や学び合いを生む空間へと進化していく必要がありますね。',
    dialogueSpeakers: [
      { speaker: '男', lineJp: '電子書籍[でんししょせき]の普及[ふきゅう]で、図書館[としょかん]の貸出冊数[かしだしさっすう]が減少傾向[げんしょうけいこう]にあると言[い]われていますね。' },
      { speaker: '女', lineJp: 'ええ。でも、図書館[としょかん]の役割[やくわり]は単[たん]に本[ほん]を貸[か]し出[だ]すことだけではありません。地域[ちいき]の人々[ひとびと]が集[つど]い、知識[ちしき]を共有[きょうゆう]する「知[ち]の拠点[きょてん]」としての価値[かち]はむしろ高[たか]まっています。' },
      { speaker: '男', lineJp: 'おっしゃる通[とお]りですね。静[しず]かに本[ほん]を読[よ]むだけの場所[ばしょ]から、対話[たいわ]や学[まな]び合[あ]いを生[う]む空間[くうかん]へと進化[しんか]していく必要[ひつよう]がありますね。' },
    ],
    options: [
      '単なる本の貸出施設にとどまらず、地域住民が交流し学び合う拠点へと進化すべきだ',
      '電子書籍が普及したため、紙の本を置く図書館はすべて閉鎖すべきだ',
      '図書館での会話やワークショップを一切禁止し、静かな読書専用空間に戻すべきだ',
      '貸出冊数を増やすために、話題の漫画や雑誌だけを大量に購入すべきだ',
    ],
    correctIndex: 0,
    explanationHk: '兩人一致認為圖書館唔應該只係借書嘅地方，而應該進化成為社區居民交流、共同學習嘅「地域の知の拠点」。',
    explanationJa: '単なる本の貸出だけでなく、地域の人々が集い対話や学び合いを生む拠点へ進化すべきだと考えています。',
  },
  ...EXTENDED_JLPT_MOCK_EXAM_QUESTIONS,
];

/**
 * Pure helper to score a JLPT Mock Exam paper according to official JLPT 180-point rules:
 * - 3 Sections: vocab_grammar (0-60), reading (0-60), listening (0-60)
 * - Minimum section pass mark (基準点): 19 / 60 per section
 * - Overall pass mark (合格点): N5=80, N4=90, N3=95, N2=90, N1=100
 */
export function scoreJlptMockExam(
  questions: JlptMockExamQuestion[],
  userAnswers: Record<string, number>,
  level: JlptLevel
): JlptMockExamScoreReport {
  const sectionMeta: Array<{
    id: JlptExamSectionId;
    titleZh: string;
    titleJa: string;
  }> = [
    {
      id: 'vocab_grammar',
      titleZh: '言語知識（文字・語彙・文法）',
      titleJa: '言語知識（文字・語彙・文法）',
    },
    {
      id: 'reading',
      titleZh: '讀解（閱讀理解）',
      titleJa: '読解（Reading）',
    },
    {
      id: 'listening',
      titleZh: '聽解（聽力理解）',
      titleJa: '聴解（Listening）',
    },
  ];

  const sectionsResult = {} as Record<JlptExamSectionId, JlptSectionScore>;
  let totalScaledScore = 0;
  let totalCorrect = 0;
  let passedAllSections = true;

  for (const meta of sectionMeta) {
    const secQuestions = questions.filter((q) => q.section === meta.id);
    const count = secQuestions.length;
    const correct = secQuestions.filter((q) => userAnswers[q.id] === q.correctIndex).length;
    const scaled = count > 0 ? Math.round((correct / count) * 60) : 0;
    const minPass = 19;
    const passedSec = scaled >= minPass;

    if (!passedSec) {
      passedAllSections = false;
    }

    totalScaledScore += scaled;
    totalCorrect += correct;

    sectionsResult[meta.id] = {
      section: meta.id,
      titleZh: meta.titleZh,
      titleJa: meta.titleJa,
      correctCount: correct,
      totalQuestions: count,
      scaledScore: scaled,
      minPassingScore: minPass,
      passedSection: passedSec,
    };
  }

  const overallPassThreshold = JLPT_PASS_THRESHOLDS[level] || 90;
  const isPassed = totalScaledScore >= overallPassThreshold && passedAllSections;

  let rankGrade: 'S' | 'A' | 'B' | 'C' = 'C';
  if (totalScaledScore >= 150 && passedAllSections) {
    rankGrade = 'S';
  } else if (totalScaledScore >= 120 && passedAllSections) {
    rankGrade = 'A';
  } else if (isPassed) {
    rankGrade = 'B';
  }

  const feedbackHk = isPassed
    ? `恭喜合格！你喺 JLPT ${level} 全真模擬試取得 ${totalScaledScore}/180 分（合格線：${overallPassThreshold}分），而且三科均達到 19 分以上基準點！`
    : !passedAllSections
      ? `今次總分為 ${totalScaledScore}/180 分，但有單科未達 JLPT 19/60 分最低基準點（單科未達標即屬不合格）。建議針對弱項科目用 AI Sensei 進行特訓！`
      : `今次總分為 ${totalScaledScore}/180 分，距離 ${level} 合格線（${overallPassThreshold}分）仲差 ${overallPassThreshold - totalScaledScore} 分。檢視下方錯題詳解再挑戰一次啦！`;

  const feedbackJa = isPassed
    ? `合格おめでとうございます！JLPT ${level} 模擬試験で ${totalScaledScore}/180点（合格基準：${overallPassThreshold}点）を獲得し、全科目の基準点（19点以上）をクリアしました！`
    : `今回の総合得点は ${totalScaledScore}/180点でした。合格ライン（${overallPassThreshold}点・各科目19点以上）に向けて、間違えた問題の解説を復習しましょう。`;

  return {
    level,
    totalScaledScore,
    overallPassThreshold,
    passedAllSections,
    isPassed,
    rankGrade,
    sections: sectionsResult,
    totalCorrect,
    totalQuestions: questions.length,
    feedbackHk,
    feedbackJa,
  };
}

export interface ArenaQuizItem {
  id: string;
  level: JlptLevel;
  category: 'vocab' | 'grammar' | 'reading';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceTag?: string;
}

/**
 * Rich, multi-batch Quiz Arena Bank so that "實戰測驗場" has diverse questions
 * across vocabulary, grammar, and reading for N5-N1, plus converted items from
 * DAILY_TEACHER_LESSON_PACKS and JLPT_MOCK_EXAM_BANK.
 */
export const EXTENDED_QUIZ_ARENA_BANK: ArenaQuizItem[] = [
  // Convert Daily Teacher Lesson Pack mini-quizzes
  ...DAILY_TEACHER_LESSON_PACKS.map((p) => ({
    id: `arena-dt-${p.id}`,
    level: p.level,
    category: 'grammar' as const,
    question: p.miniQuiz.question,
    options: p.miniQuiz.options,
    correctIndex: p.miniQuiz.correctIndex,
    explanation: p.miniQuiz.explanation,
    sourceTag: `${p.themeTagZh}・每日講義題`,
  })),
  // Convert JLPT Mock Exam non-listening questions into QuizArena items
  ...JLPT_MOCK_EXAM_BANK.filter((q) => q.section !== 'listening').map((q) => ({
    id: `arena-mock-${q.id}`,
    level: q.level,
    category: (q.section === 'reading' ? 'reading' : 'vocab') as 'vocab' | 'grammar' | 'reading',
    question: q.passageJp ? `【文章】${q.passageJp}\n\n【質問】${q.promptJp}` : q.promptJp,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanationHk,
    sourceTag: `${q.mondaiLabel}`,
  })),
  // Extra N5 Arena Sets
  {
    id: 'arena-ext-n5-1',
    level: 'N5',
    category: 'vocab',
    question: '「きのうの夜は11時に（　　）。」空欄に入る最もよい言葉はどれですか？',
    options: ['寝ました', '起きました', '借りました', '貸しました'],
    correctIndex: 0,
    explanation: '「夜の11時（夜晚十一點）」最自然係「寝ました（瞓覺）」。',
    sourceTag: '生活作息・高頻題',
  },
  {
    id: 'arena-ext-n5-2',
    level: 'N5',
    category: 'grammar',
    question: '「東京から京都（　　）新幹線で2時間ぐらいかかります。」',
    options: ['まで', 'から', 'より', 'しか'],
    correctIndex: 0,
    explanation: '「A から B まで」表示由起點 A 到終點 B（由東京到京都）。',
    sourceTag: '鐵道交通・助詞必考',
  },
  {
    id: 'arena-ext-n5-3',
    level: 'N5',
    category: 'reading',
    question: '「この薬は、ご飯を食べたあとで飲んでください。」薬はいつ飲みますか？',
    options: ['食事のあと', '食事の前', '食事の最中', '寝る前だけ'],
    correctIndex: 0,
    explanation: '「ご飯を食べたあとで（食完飯之後）」即係「食事のあと」。',
    sourceTag: '生活指示・短文讀解',
  },
  {
    id: 'arena-ext-n5-4',
    level: 'N5',
    category: 'vocab',
    question: '「部屋が暗いですから、電気を（　　）ください。」',
    options: ['つけて', 'けして', 'あけて', 'しめて'],
    correctIndex: 0,
    explanation: '因為房間好暗（暗い），所以請「開燈（電気をつけてください）」。關燈係「消して（けして）」。',
    sourceTag: '家電操作・動詞配搭',
  },
  // Extra N4 Arena Sets
  {
    id: 'arena-ext-n4-1',
    level: 'N4',
    category: 'grammar',
    question: '「雨が降り（　　）ですから、傘を持って行ったほうがいいですよ。」',
    options: ['そう', 'よう', 'らしい', 'みたい'],
    correctIndex: 0,
    explanation: '睇見個天黑晒「好似就嚟落雨（眼前跡象推測）」，用動詞ます形去掉ます＋「そうです（雨が降りそうです）」。',
    sourceTag: '樣態推測・N4必考陷阱',
  },
  {
    id: 'arena-ext-n4-2',
    level: 'N4',
    category: 'vocab',
    question: '「パーティーの準備はもう全部（　　）しまいました。」',
    options: ['やって', 'なって', 'いって', 'きまって'],
    correctIndex: 0,
    explanation: '「準備をやってしまう（已經將準備工作全部搞掂晒）」，他動詞配「を」。',
    sourceTag: '日常社交・補助動詞',
  },
  {
    id: 'arena-ext-n4-3',
    level: 'N4',
    category: 'grammar',
    question: '「母は私に部屋の掃除を（　　）。」',
    options: ['させました', 'されました', 'できました', 'あげました'],
    correctIndex: 0,
    explanation: '阿媽叫／命令我打掃房間，屬於「使役形（掃除をさせる → させました）」。',
    sourceTag: '使役形・核心文法',
  },
  {
    id: 'arena-ext-n4-4',
    level: 'N4',
    category: 'reading',
    question: '「本日の映画チケットはすべて売り切れました。」これと同じ意味はどれですか？',
    options: [
      '今日のチケットはもう買うことができない。',
      '今日のチケットは安く買うことができる。',
      '明日のチケットもすべてなくなった。',
      '窓口に行けば今日のチケットが買える。',
    ],
    correctIndex: 0,
    explanation: '「本日（今日）」嘅戲飛已經「売り切れました（賣晒／售罄）」，所以今日已經買唔到飛。',
    sourceTag: '售票告示・實用讀解',
  },
  // Extra N3 Arena Sets
  {
    id: 'arena-ext-n3-1',
    level: 'N3',
    category: 'grammar',
    question: '「彼は日本に10年も住んでいる（　　）、ひらがなも読めない。」',
    options: ['わりに', 'おかげで', 'せいで', 'につれて'],
    correctIndex: 0,
    explanation: '「〜わりに（は）」表示與某個基準（住咗10年日本）唔成比例嘅意外事實（竟然連平假名都唔識讀）。',
    sourceTag: '逆接對比・N3高頻',
  },
  {
    id: 'arena-ext-n3-2',
    level: 'N3',
    category: 'vocab',
    question: '「明日のイベントが中止かどうかの（　　）がまだ来ない。」',
    options: ['連絡', '連想', '連続', '連帯'],
    correctIndex: 0,
    explanation: '關於活動是否取消嘅「通知／聯絡（連絡・れんらく）」仲未嚟。',
    sourceTag: '漢字熟語・同音異義',
  },
  {
    id: 'arena-ext-n3-3',
    level: 'N3',
    category: 'grammar',
    question: '「シャワーを浴びている（　　）宅配便が来て、出られなかった。」',
    options: ['最中に', 'うちに', 'ついでに', 'とたんに'],
    correctIndex: 0,
    explanation: '「〜最中に（さいちゅうに）」表示正當某動作進行到最中途嗰一刻（沖緊涼正中間），突然發生意外干擾（速遞員撳鐘）。',
    sourceTag: '時間同時性・必考辨析',
  },
  // Extra N2 Arena Sets
  {
    id: 'arena-ext-n2-1',
    level: 'N2',
    category: 'grammar',
    question: '「この美術館は、年齢や国籍（　　）、誰でも無料で入館できる。」',
    options: ['を問わず', 'に際して', 'を皮切りに', 'に先立って'],
    correctIndex: 0,
    explanation: '「〜を問わず（不論...／唔分...）」常配「年齢・性別・経験を問わず」。',
    sourceTag: '公共規定・N2核心句型',
  },
  {
    id: 'arena-ext-n2-2',
    level: 'N2',
    category: 'vocab',
    question: '「新幹線のダイヤが乱れ、多くの乗客に（　　）が生じた。」',
    options: ['混乱', '混雑', '混合', '混同'],
    correctIndex: 0,
    explanation: '因為列車班次大亂，導致現場出現「混亂（混乱・こんらんが生じる）」。',
    sourceTag: '新聞報導・N2頻出漢字',
  },
  {
    id: 'arena-ext-n2-3',
    level: 'N2',
    category: 'grammar',
    question: '「実際に自分の目で見ない（　　）、その噂を信じることはできない。」',
    options: ['ことには', 'ものなら', 'ばかりに', 'どころか'],
    correctIndex: 0,
    explanation: '「〜ないことには…ない」表示「如果唔先做 A 嘅話，就無法 B」（唔親眼睇過嘅話，就唔能夠相信）。',
    sourceTag: '必要條件・N2文法',
  },
  // Extra N1 Arena Sets
  {
    id: 'arena-ext-n1-1',
    level: 'N1',
    category: 'grammar',
    question: '「彼の今回の成功は、長年の地道な努力の結果（　　）。」',
    options: ['に他ならない', 'に満たない', 'に越したことはない', 'にあたらない'],
    correctIndex: 0,
    explanation: '「〜に他ならない（無疑就係...／不外乎係...）」用於斷言事物嘅真正本質或原因。',
    sourceTag: '社論斷言・N1最高頻',
  },
  {
    id: 'arena-ext-n1-2',
    level: 'N1',
    category: 'vocab',
    question: '「新しい制度を導入するには、既存のルールとの（　　）を図る必要がある。」',
    options: ['整合性', '画一性', '偶発性', '希少性'],
    correctIndex: 0,
    explanation: '「整合性を図る（せいごうせいをはかる）」意為確保新制度與既有規則之間嘅協調一致、無矛盾。',
    sourceTag: '政策評論・N1硬派詞彙',
  },
  {
    id: 'arena-ext-n1-3',
    level: 'N1',
    category: 'grammar',
    question: '「危険を（　　）、救助隊員たちは燃え盛る建物の中へ飛び込んでいった。」',
    options: ['ものともせず', 'よそに', 'かぎりに', '尻目に'],
    correctIndex: 0,
    explanation: '「〜をものともせず（不顧...／無懼艱險）」正面讚揚克服巨大困難或危險嘅英勇行為。',
    sourceTag: '新聞讚揚・N1書面語',
  },
];

/**
 * Pure helper that selects a varied, rotating batch of quiz questions for QuizArena
 * based on level, date seed, and user shuffle count so the user never sees a stuck/identical list.
 */
export function pickDynamicQuizQuestions<T extends { id: string; level: JlptLevel }>(
  allQuestions: T[],
  level: JlptLevel,
  batchOffset: number = 0,
  batchSize: number = 5
): T[] {
  const levelPool = allQuestions.filter((q) => q.level === level);
  if (levelPool.length === 0) return [];

  // Deduplicate by id
  const seen = new Set<string>();
  const uniquePool: T[] = [];
  for (const item of levelPool) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      uniquePool.push(item);
    }
  }

  if (uniquePool.length <= batchSize) {
    return rotatePool(uniquePool, batchOffset);
  }

  // Stride through the pool by batchOffset * 3 so each shuffle produces a distinct combination
  const startIdx = (Math.abs(batchOffset) * 3) % uniquePool.length;
  const rotated = [...uniquePool.slice(startIdx), ...uniquePool.slice(0, startIdx)];
  return rotated.slice(0, batchSize);
}

function rotatePool<T>(arr: T[], offset: number): T[] {
  if (arr.length <= 1) return arr;
  const shift = Math.abs(offset) % arr.length;
  return [...arr.slice(shift), ...arr.slice(0, shift)];
}

