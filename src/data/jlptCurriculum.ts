import { JlptLevel } from '../utils/srsEngine';

export interface VocabItem {
  id: string;
  level: JlptLevel;
  kanji: string;
  reading: string;
  romaji: string;
  pitchAccent: string; // e.g., [0], [1], [2]
  partOfSpeech: string;
  meaning: string;
  coreImage: string; // Cognitive memory hook in Cantonese
  exampleJp: string; // Supports Kanji[furigana] syntax
  exampleHk: string;
}

export interface GrammarPoint {
  id: string;
  level: JlptLevel;
  pattern: string;
  formation: string;
  meaning: string;
  meaningJa?: string;
  nuance: string;
  nuanceJa?: string;
  cantoneseComparison: string;
  exampleJp: string;
  exampleHk: string;
}

/**
 * Returns the Japanese explanation (日本語での語感・用法解説) for a GrammarPoint,
 * using explicit nuanceJa when provided or synthesizing an accurate Japanese grammar note.
 */
export function getGrammarNuanceJa(g: GrammarPoint): string {
  if (g.nuanceJa && g.nuanceJa.trim().length > 0) {
    return g.nuanceJa.trim();
  }
  const p = g.pattern || '';
  if (p.includes('につれて') || p.includes('にしたがって')) {
    return '一方（A）が徐々に変化するのに伴って、もう一方（B）も一緒に同じ方向へ変化することを表します（前件・後件ともに変化を表す動詞・形容詞を用い、状態表現や意向形は使えません）。';
  }
  if (p.includes('にします') || p.includes('にする')) {
    return '複数の選択肢の中から自分の意志で一つを選んで決定する時（注文・買い物など）に使われる自然な表現です。';
  }
  if (p.includes('てから')) {
    return '動作Aが完了した後に動作Bを行うという「先後順序」を明確に強調する表現です。';
  }
  if (p.includes('ことにする') || p.includes('ことになる')) {
    return '「〜ことにする」は自分の意志・判断で決めること、「〜ことになる」は周囲の事情や規則・団体によって客観的に決まることを表します。';
  }
  if (p.includes('てみる')) {
    return '結果がどうなるか分からない状態で、まず試しにその動作を行って体験することを表します。';
  }
  if (p.includes('ちゃう') || p.includes('とく')) {
    return '日常会話やJLPT聴解で頻出する縮約形です。「〜てしまう→〜ちゃう（完了・後悔）」、「〜ておく→〜とく（事前準備）」となります。';
  }
  if (p.includes('に際して')) {
    return '何か特別な行事や新しい事業・手続きなどを始める重要な節目の時を表す硬い書き言葉です。';
  }
  if (p.includes('余儀なくされる')) {
    return '不本意ながら、周囲の状況や不可抗力によって仕方なくそうせざるを得ない状況に追い込まれることを表すN1頻出表現です。';
  }
  return `「${g.pattern}」（接続：${g.formation}）は、文脈における話し手の意図や事態の変化・論理関係を表す${g.level}の重要文型です。`;
}

export interface ReadingPassage {
  id: string;
  level: JlptLevel;
  title: string;
  contextType: string;
  contentJp: string;
  translationHk: string;
  keyTakeaway: string;
  comprehensionQuestion: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export interface QuizQuestion {
  id: string;
  level: JlptLevel;
  category: 'vocab' | 'grammar' | 'reading';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LevelMeta {
  level: JlptLevel;
  title: string;
  subtitle: string;
  cefr: string;
  targetVocabCount: number;
  targetKanjiCount: number;
  studyStrategy: string;
}

export const LEVEL_METADATA: Record<JlptLevel, LevelMeta> = {
  N5: {
    level: 'N5',
    title: '入門基礎・生活生存會話',
    subtitle: '掌握平假名、片假名、基本助詞（は・が・を・に・で）與動詞ます／て形變化',
    cefr: 'CEFR A1',
    targetVocabCount: 800,
    targetKanjiCount: 100,
    studyStrategy: '切忌死背單字表！將名詞連同助詞同動詞一齊當作「語塊 (Chunks)」大聲朗讀。',
  },
  N4: {
    level: 'N4',
    title: '初級進階・日常社交與受授表達',
    subtitle: '精通自動詞／他動詞配對、可能形、受身形、使役形與基礎敬語（あげる・もらう・くれる）',
    cefr: 'CEFR A2',
    targetVocabCount: 1500,
    targetKanjiCount: 300,
    studyStrategy: '重點建立「視覺方向感」：日文非常重視動作由邊個發起、恩惠向邊個流動。',
  },
  N3: {
    level: 'N3',
    title: '中級橋樑・新聞口語與書面語轉換',
    subtitle: '跨越口語同正式文章嘅分水嶺，掌握逆接、推測、傳聞及高頻複合動詞',
    cefr: 'CEFR B1',
    targetVocabCount: 3750,
    targetKanjiCount: 650,
    studyStrategy: '開始透過真實短文（可理解輸入 i+1）學字，留意相近文法背後說話者嘅情緒同主觀立場。',
  },
  N2: {
    level: 'N2',
    title: '商務實戰・職場書信與深度評論',
    subtitle: '流利閱讀日本報章專欄、商務敬語電郵、因果邏輯句型（〜に際して・〜を問わず）',
    cefr: 'CEFR B2',
    targetVocabCount: 6000,
    targetKanjiCount: 1000,
    studyStrategy: '訓練長難句「主幹拆解法」：先搵出主語同句尾核心謂語，再拆解中間嘅修飾子句。',
  },
  N1: {
    level: 'N1',
    title: '母語精熟・學術論述與古典語感',
    subtitle: '駕馭抽象哲學評論、文學修辭、文語殘留句式（〜んばかりに・〜を禁じ得ない）與微細語氣',
    cefr: 'CEFR C1',
    targetVocabCount: 10000,
    targetKanjiCount: 2000,
    studyStrategy: '深入體會漢字詞喺日文同中文之間嘅「微妙語義偏差」，結合大量原著輸入與 AI 對練。',
  },
};

export const VOCAB_DATABASE: VocabItem[] = [
  // N5
  {
    id: 'n5-v1',
    level: 'N5',
    kanji: '約束',
    reading: 'やくそく',
    romaji: 'yakusoku',
    pitchAccent: '[0] 平板型',
    partOfSpeech: '名詞・スル動詞',
    meaning: '約定、承諾、預約',
    coreImage: '唔單止係情侶「約定」，同朋友約食飯、同客戶約時間全部都叫「約束」。記住黃金搭配：約束を守る（守約）／約束を破る（毀約）。',
    exampleJp: '明日[あした]、友達[ともだち]と映画[えいが]を見[み]る約束[やくそく]があります。',
    exampleHk: '聽日我同朋友約好咗一齊睇戲。',
  },
  {
    id: 'n5-v2',
    level: 'N5',
    kanji: '出かける',
    reading: 'でかける',
    romaji: 'dekakeru',
    pitchAccent: '[0] 平板型',
    partOfSpeech: '下一段自動詞',
    meaning: '出門、外出（去行街或辦事）',
    coreImage: '「出る」只係由入面行出門口個動作；「出かける」帶有「有目的地出街／準備返屋企」嘅生活感。',
    exampleJp: '日曜日[にちようび]はどこかへ出[で]かけますか。',
    exampleHk: '禮拜日你會唔會出街去邊度行下呀？',
  },
  {
    id: 'n5-v3',
    level: 'N5',
    kanji: '大丈夫',
    reading: 'だいじょうぶ',
    romaji: 'daijoubu',
    pitchAccent: '[3] 中高型',
    partOfSpeech: 'な形容詞',
    meaning: '冇問題、唔緊要、放心（亦可用於委婉拒絕）',
    coreImage: '日本生存第一神詞！便利店店員問「レジ袋はご利用ですか（要唔要膠袋？）」答一句「大丈夫です」就係禮貌拒絕「唔使喇，唔該」。',
    exampleJp: '袋[ふくろ]は大丈[だいじょう]夫[ぶ]です。そのままください。',
    exampleHk: '唔使袋喇唔該，就咁俾我就得。',
  },
  {
    id: 'n5-v4',
    level: 'N5',
    kanji: '気をつける',
    reading: 'きをつける',
    romaji: 'ki wo tsukeru',
    pitchAccent: '[4] 起伏型',
    partOfSpeech: '慣用片語（下一段）',
    meaning: '小心、留神、保重',
    coreImage: '字面係「將注意力（気）貼（つける）喺某件事上面」。分別時講「気をつけて帰ってね」就係「路上小心返屋企呀」。',
    exampleJp: '夜道[よみち]は暗[くら]いですから、車[くるま]に気[き]をつけてください。',
    exampleHk: '夜路好黑，請小心車輛。',
  },

  // N4
  {
    id: 'n4-v1',
    level: 'N4',
    kanji: '間に合う',
    reading: 'まにあう',
    romaji: 'maniau',
    pitchAccent: '[3] 中高型',
    partOfSpeech: '五段自動詞',
    meaning: '趕得切、來得及、夠用',
    coreImage: '「間（時間／空隙）」+「に合う（吻合）」。啱啱好卡喺死線之前趕到！對象用助詞「に」：終電に間に合う（趕得切尾班車）。',
    exampleJp: '今[いま]すぐタクシーに乗[の]れば、会議[かいぎ]に間[ま]に合[あ]います。',
    exampleHk: '如果而家即刻搭的士嘅話，仲趕得切開會。',
  },
  {
    id: 'n4-v2',
    level: 'N4',
    kanji: '遠慮する',
    reading: 'えんりょする',
    romaji: 'enryo suru',
    pitchAccent: '[0] 平板型',
    partOfSpeech: '名詞・スル動詞',
    meaning: '客氣、推辭、避免（做某行為）',
    coreImage: '日本人社交核心概念：因為顧慮對方感受而「收斂自己」。請人食嘢會講「遠慮しないで（唔使客氣）」；叫人唔好食煙會講「タバコはご遠慮ください」。',
    exampleJp: 'どうぞ遠慮[えんりょ]なく、たくさん食[た]べてくださいね。',
    exampleHk: '請千萬唔好客氣，食多啲啦！',
  },
  {
    id: 'n4-v3',
    level: 'N4',
    kanji: '都合',
    reading: 'つごう',
    romaji: 'tsugou',
    pitchAccent: '[0] 平板型',
    partOfSpeech: '名詞',
    meaning: '時間安排、方便與否、情況',
    coreImage: '約日本人必用！「都合がいい（時間方便）」、「都合が悪い（時間唔夾／唔方便）」，比直接講「暇（得閒）」禮貌得多。',
    exampleJp: '来週[らいしゅう]の金曜日[きんようび]はご都合[つごう]いかがでしょうか。',
    exampleHk: '請問下禮拜五你時間方唔方便呢？',
  },
  {
    id: 'n4-v4',
    level: 'N4',
    kanji: '片付ける',
    reading: 'かたづける',
    romaji: 'katadukeru',
    pitchAccent: '[4] 中高型',
    partOfSpeech: '下一段他動詞',
    meaning: '執拾、整理、解決（問題／工作）',
    coreImage: '將散亂嘅嘢歸邊（片）放好。除咗「机の上を片付ける（執書枱）」，仲可以講「仕事を片付ける（搞掂手頭工作）」。',
    exampleJp: '散[ち]らかった部屋[へや]をきれいに片付[かたづ]けました。',
    exampleHk: '將凌亂嘅房執得乾乾淨淨。',
  },

  // N3
  {
    id: 'n3-v1',
    level: 'N3',
    kanji: 'きっかけ',
    reading: 'きっかけ',
    romaji: 'kikkake',
    pitchAccent: '[0] 平板型',
    partOfSpeech: '名詞',
    meaning: '契機、導火線、開始嘅原因',
    coreImage: '啟動一件事嘅「第一粒火花／扳機」。日本面試或傾計最愛問：「日本語を勉強したきっかけは何ですか？（學日文嘅契機係咩？）」',
    exampleJp: 'アニメを見[み]たことがきっかけで、日本語[にほんご]に興味[きょうみ]を持[も]ちました。',
    exampleHk: '因為睇咗動漫做契機，開始對日文產生興趣。',
  },
  {
    id: 'n3-v2',
    level: 'N3',
    kanji: 'もったいない',
    reading: 'もったいない',
    romaji: 'mottainai',
    pitchAccent: '[5] 中高型',
    partOfSpeech: 'い形容詞',
    meaning: '浪費、可惜、暴殄天物、受寵若驚',
    coreImage: '源自佛教用語，指事物仲有價值卻白白浪費咗（時間、食物、才華），好似廣東話講「嘥晒／折墮」。',
    exampleJp: 'まだ使[つか]えるのに捨[す]ててしまうのはもったいない。',
    exampleHk: '明明仲用得但係掉咗佢，真係太嘥喇。',
  },
  {
    id: 'n3-v3',
    level: 'N3',
    kanji: '徹夜',
    reading: 'てつや',
    romaji: 'tetsuya',
    pitchAccent: '[0] 平板型',
    partOfSpeech: '名詞・スル動詞',
    meaning: '通宵、捱通頂',
    coreImage: '「徹（貫穿）」+「夜（成晚）」，即係廣東話嘅「開通頂」。試験前に徹夜で勉強する（考試前開通頂溫書）。',
    exampleJp: '締[し]め切[き]りに間[ま]に合[あ]わせるため、徹夜[てつや]で作業[さぎょう]した。',
    exampleHk: '為咗趕及死線，開通頂做嘢。',
  },
  {
    id: 'n3-v4',
    level: 'N3',
    kanji: '納得する',
    reading: 'なっとくする',
    romaji: 'nattoku suru',
    pitchAccent: '[0] 平板型',
    partOfSpeech: '名詞・スル動詞',
    meaning: '打從心底理解並接受、心服口服',
    coreImage: '唔單止係表面「明咗（わかる）」，而係聽完解釋覺得「好有道理，我完全接受！」嗰種釋懷感。',
    exampleJp: '彼[かれ]の丁寧[ていねい]な説明[せつめい]を聞[き]いて、ようやく納得[なっとく]した。',
    exampleHk: '聽完佢詳盡嘅解釋之後，終於心服口服咁明白晒。',
  },

  // N2
  {
    id: 'n2-v1',
    level: 'N2',
    kanji: '妥協',
    reading: 'だきょう',
    romaji: 'dakyou',
    pitchAccent: '[0] 平板型',
    partOfSpeech: '名詞・スル動詞',
    meaning: '妥協、讓步、退而求其次',
    coreImage: '商務談判及職涯高頻詞。日本人形容工匠精神常講「一切妥協しない（絕不妥協／唔將就）」。',
    exampleJp: '品質[ひんしつ]にかけては、一切[いっさい]妥協[だきょう]しない方針[ほうしん]だ。',
    exampleHk: '喺品質方面，我哋嘅方針係絕不妥協。',
  },
  {
    id: 'n2-v2',
    level: 'N2',
    kanji: '見直す',
    reading: 'みなおす',
    romaji: 'minaosu',
    pitchAccent: '[0]/[3]',
    partOfSpeech: '五段他動詞',
    meaning: '1. 重新審視／檢討；2. 對某人刮目相看',
    coreImage: '「見る」+「直す（重新做）」。一詞兩義必考：檢討計劃（計画を見直す）vs 發現對方原來咁勁而另眼相看（彼を見直した！）。',
    exampleJp: '生活習慣[せいかつしゅうかん]を根本[こんぽん]から見直[みなお]す必要[ひつよう]がある。',
    exampleHk: '有必要由根本重新檢視生活習慣。',
  },
  {
    id: 'n2-v3',
    level: 'N2',
    kanji: '充実',
    reading: 'じゅうじつ',
    romaji: 'juujitsu',
    pitchAccent: '[0] 平板型',
    partOfSpeech: '名詞・スル動詞',
    meaning: '充實、完善、豐富飽滿',
    coreImage: '內容填得滿滿、好有滿足感。既可形容「充実した毎日（充實嘅每一日）」，亦可形容服務設備完善「サポート体制が充実している」。',
    exampleJp: '趣味[しゅみ]と仕事[しごと]を両立[りょうりつ]させ、充実[じゅうじつ]した日々[ひび]を送[おく]っている。',
    exampleHk: '兼顧興趣同工作，過住充實嘅每一日。',
  },
  {
    id: 'n2-v4',
    level: 'N2',
    kanji: '契機',
    reading: 'けいき',
    romaji: 'keiki',
    pitchAccent: '[1] 頭高型',
    partOfSpeech: '名詞',
    meaning: '契機、轉捩點（書面鄭重語）',
    coreImage: '即係 N3「きっかけ」嘅高階新聞／商務書面版！常配句型「〜を契機に（して）」（以...為契機／轉捩點）。',
    exampleJp: '法改正[ほうかいせい]を契機[けいき]に、業界全体[ぎょうかいぜんたい]の意識[いしき]が変[か]わった。',
    exampleHk: '以修例為契機，成個行業嘅意識都改變咗。',
  },

  // N1
  {
    id: 'n1-v1',
    level: 'N1',
    kanji: '措置',
    reading: 'そち',
    romaji: 'sochi',
    pitchAccent: '[1] 頭高型',
    partOfSpeech: '名詞・スル動詞',
    meaning: '措施、處置、應對手段',
    coreImage: '政府、機構針對問題採取嘅正式對策。必記黃金動詞配搭：「措置を講じる（採取措施）」、「措置をとる」。',
    exampleJp: '政府[せいふ]は緊急[きんきゅう]の経済対策[けいざいたいさく]として特別[とくべつ]な措置[そち]を講[こう]じた。',
    exampleHk: '政府採取咗特別措施作為緊急經濟對策。',
  },
  {
    id: 'n1-v2',
    level: 'N1',
    kanji: '絶妙',
    reading: 'ぜつみょう',
    romaji: 'zetsumyou',
    pitchAccent: '[0] 平板型',
    partOfSpeech: 'な形容詞',
    meaning: '絕妙、恰到好處、精妙絕倫',
    coreImage: '難以言喻咁啱啱好！最常配搭「絶妙なタイミング（絕妙嘅時機）」、「絶妙なバランス（微妙而完美嘅平衡）」。',
    exampleJp: '甘[あま]さと酸味[さんみ]が絶妙[ぜつみょう]なバランスで調和[ちょうわ]している。',
    exampleHk: '甜味同酸味以絕妙嘅平衡融合埋一齊。',
  },
  {
    id: 'n1-v3',
    level: 'N1',
    kanji: '懸念',
    reading: 'けねん',
    romaji: 'kenen',
    pitchAccent: '[1] 頭高型',
    partOfSpeech: '名詞・スル動詞',
    meaning: '憂慮、擔心、顧慮（正式評論語）',
    coreImage: '比「心配」正式十倍，指對未來可能發生嘅負面影響抱有深層憂慮。常配「懸念される（令人擔憂）」、「懸念を抱く」。',
    exampleJp: '環境破壊[かんきょうはかい]がさらなる気候変動[きこうへんどう]を招[まね]くことが懸念[けねん]されている。',
    exampleHk: '外界憂慮環境破壞會招致更嚴重嘅氣候變化。',
  },
  {
    id: 'n1-v4',
    level: 'N1',
    kanji: '淘汰',
    reading: 'とうた',
    romaji: 'touta',
    pitchAccent: '[1] 頭高型',
    partOfSpeech: '名詞・スル動詞',
    meaning: '淘汰、篩選（留強汰弱）',
    coreImage: '用水沖走沙石留低金粒。商界與自然界高頻詞：「自然淘汰（物競天擇）」、「時代遅れの企業が淘汰される」。',
    exampleJp: '技術革新[ぎじゅつかくしん]の波[なみ]に乗[の]り遅[おく]れた企業[きぎょう]は市場[しじょう]から淘汰[とうた]される。',
    exampleHk: '趕唔上技術革新浪潮嘅企業將會被市場淘汰。',
  },
];

export const GRAMMAR_DATABASE: GrammarPoint[] = [
  {
    id: 'n5-g1',
    level: 'N5',
    pattern: '〜てから',
    formation: '動詞て形 + から',
    meaning: '做完 A 之後，再做 B（強調先後順序）',
    meaningJa: 'Aの動作が終わった後に、Bの動作をする（順序の強調）',
    nuance: '動作 A 係動作 B 嘅前奏或者必要步驟，說話者特登想強調「先 A 後 B」嘅次序。',
    nuanceJa: '動作Aが完了してから次の動作Bに移るという「時間的な先後順序」を話し手が意識的に強調したい時に使います。',
    cantoneseComparison: '廣東話「洗手先食飯」個「先」字放喺動詞後面；日文「手を洗ってから食べます」必須用「てから」接駁。',
    exampleJp: '日本[にほん]へ来[き]てから、毎日[まいにち]自炊[じすい]しています。',
    exampleHk: '嚟咗日本之後，我日日都自己煮飯。',
  },
  {
    id: 'n5-g2',
    level: 'N5',
    pattern: '〜たり〜たりする',
    formation: '動詞た形 + り、動詞た形 + り + する',
    meaning: '又做下 A、又做下 B（列舉代表性動作）',
    meaningJa: 'いくつかの動作を例として挙げる表現（〜たり〜たりする）',
    nuance: '暗示除咗 A 同 B 之外仲有做其他類似嘅事，唔係全部列晒出嚟。最尾一定要加「する／します」！',
    nuanceJa: '複数の行動の中から代表的な例を2つほど挙げ、「他にもいろいろなことをする」というニュアンスを含みます。文末には必ず「する／します」が必要です。',
    cantoneseComparison: '廣東話會講「放假我會睇下書、聽下歌咁啦」，日文千祈唔好漏咗句尾個「します」。',
    exampleJp: '休日[きゅうじつ]はカフェで本[ほん]を読[よ]んだり、音楽[おんがく]を聞[き]いたりします。',
    exampleHk: '放假嗰陣我會喺 Cafe 睇下書、聽下歌咁。',
  },
  {
    id: 'n4-g1',
    level: 'N4',
    pattern: '〜てある vs 〜ている',
    formation: '他動詞て形 + ある ／ 自動詞て形 + いる',
    meaning: '（人為刻意做好並保持）嘅狀態 vs（自然持續緊）嘅狀態',
    meaningJa: '目的を持って行われた結果の状態（他動詞＋てある）vs 自然な状態（自動詞＋ている）',
    nuance: '「窓が開けてある」暗示有人特登為咗通風等目的而開咗窗；「窓が開いている」只係客觀描述隻窗而家開咗。',
    nuanceJa: '「〜てある」は誰かが何かの目的のために意図的にその動作を行い、その結果が残っていることを表します。「〜ている」は単なる客観的な状態の描写です。',
    cantoneseComparison: '廣東話兩句都叫「隻窗開咗」，但日文考 N4 必考你有冇留意背後「人為準備好嘅意圖」！',
    exampleJp: 'お客様[きゃくさま]が来[く]るので、部屋[へや]はもう暖[あたた]めてあります。',
    exampleHk: '因為有客人嚟，間房已經（特登）開定暖氣暖好咗喇。',
  },
  {
    id: 'n4-g2',
    level: 'N4',
    pattern: '〜ようにする',
    formation: '動詞辞書形／ない形 + ようにする',
    meaning: '盡量做到...、養成...嘅習慣（持續努力）',
    meaningJa: 'ある目標や習慣を実現するために意識的に努力・心がける',
    nuance: '表示自己有意識咁去控制行為、培養好習慣。「ようにしている」則表示已經將呢個努力變成日常習慣。',
    nuanceJa: 'すぐにはできないことや日頃の行動について、意識して心がけることを表します。「〜ようにしている」は継続的な習慣を表します。',
    cantoneseComparison: '對應廣東話「我呢排盡量早啲瞓／堅持日日飲水」。',
    exampleJp: '健康[けんこう]のために、毎日[まいにち]エレベーターを使[つか]わず階段[かいだん]で上[あ]がるようにしています。',
    exampleHk: '為咗健康，我平日盡量唔搭𨋢，堅持行樓梯上樓。',
  },
  {
    id: 'n3-g1',
    level: 'N3',
    pattern: '〜わけにはいかない',
    formation: '動詞辞書形／ない形 + わけにはいかない',
    meaning: '從情理、責任或立場上嚟講，實在唔能夠...',
    meaningJa: '立場・責任・社会的な事情から考えて「〜するべきではない／できない」',
    nuance: '唔係能力上做唔到，而係因為社會責任、道德或者心理壓力，「就算想偷懶都唔可以咁做」。',
    nuanceJa: '能力的に不可能なのではなく、自分の立場や責任・常識・道徳的な理由から「そうするわけにはいかない（我慢しなければならない）」という強い自制を表します。',
    cantoneseComparison: '廣東話「聽日就考 JLPT，今晚真係唔可以早瞓！」種責任感就係用「寝るわけにはいかない」。',
    exampleJp: '大切[たいせつ]なプロジェクトを任[まか]された以上[いじょう]、途中[とちゅう]で諦[あきら]めるわけにはいかない。',
    exampleHk: '既然被委任咗咁重要嘅專案，就更加唔能夠半途而廢。',
  },
  {
    id: 'n3-g2',
    level: 'N3',
    pattern: '〜ついでに',
    formation: '動詞辞書形／た形 ／ 名詞 + の + ついでに',
    meaning: '順便...（做主動作 A 嘅時候順手做埋次要動作 B）',
    meaningJa: '本来の目的（A）を行う機会を利用して、別のこと（B）も一緒に行う',
    nuance: 'A 係主要原本要做嘅事，B 係順路搭單做埋嘅小事，千祈唔可以將主次倒轉！',
    nuanceJa: '前件（A）が主な目的の行動であり、後件（B）はその機会を利用してついでに行う付随的な行動です。主従関係を逆にすることはできません。',
    cantoneseComparison: '廣東話「落街買餸順便寄埋封信」：「買い物に行くついでに、手紙を出した」。',
    exampleJp: '散歩[さんぽ]のついでに、コンビニで牛乳[ぎゅうにゅう]を買[か]ってきた。',
    exampleHk: '去散步嗰陣，順便喺便利店買埋牛奶返嚟。',
  },
  {
    id: 'n2-g1',
    level: 'N2',
    pattern: '〜に際して（〜にさいして）',
    formation: '名詞 ／ 動詞辞書形 + に際して',
    meaning: '值此...之際、當...嘅重要時刻',
    meaningJa: 'ある特別な行事や重要な行動を始めるにあたって（改まった表現）',
    nuance: '用於正式商務、典禮或重大行動（開業、留學、簽約、申請）開始之前。唔可以用喺「食飯之際」等日常瑣事。',
    nuanceJa: 'ビジネスや式典、進学、新規事業の開始など、人生や仕事における重要な節目の機会に何かを行う時に使われる硬い表現です。日常のささいな動作には使えません。',
    cantoneseComparison: '相等於香港公文或致辭嘅「值此新店開幕之際／於遞交申請時」。',
    exampleJp: '新規事業[しんきじぎょう]の立[た]ち上[あ]げに際[さい]して、徹底的[てっていてき]な市場調査[しじょうちょうさ]を行[おこな]った。',
    exampleHk: '喺啟動新業務之際，進行咗徹底嘅市場調查。',
  },
  {
    id: 'n2-g2',
    level: 'N2',
    pattern: '〜を問わず（〜をとわず）',
    formation: '名詞 + を問わず',
    meaning: '不論...、不拘...（不受條件限制）',
    meaningJa: '〜に関係なく、どの条件であってもすべて対象になる',
    nuance: '前面常接一對相反詞或範圍詞（男女・年齢・経験の有無・昼夜），表示「無論係邊一種都一樣適用」。',
    nuanceJa: '「年齢・性別・国籍・経験の有無・昼夜」など、対立する語や範囲を表す名詞を受け、その条件に関係なくすべてに当てはまることを表します。',
    cantoneseComparison: '招聘廣告常見：「不論有無經驗、年齡不拘，一律歡迎應徵」。',
    exampleJp: 'このボランティア活動[かつどう]は、年齢[ねんれい]や経験[けいけん]を問[と]わず誰[だれ]でも参加[さんか]できます。',
    exampleHk: '呢個義工活動不論年齡同經驗，任何人都可以參加。',
  },
  {
    id: 'n1-g1',
    level: 'N1',
    pattern: '〜を禁じ得ない（〜をきんじえない）',
    formation: '感情名詞（涙・同情・怒り・驚き） + を禁じ得ない',
    meaning: '禁唔住...、情不自禁感到...（文語最高級感嘆）',
    meaningJa: '強い感情（涙・同情・怒り・驚きなど）が自然に湧き上がって抑えられない',
    nuance: '「禁じる（抑制）」+「得ない（無法）」，即係內心湧起嘅強烈感情完全壓抑唔住。屬於 N1 典型書面評論語。',
    nuanceJa: 'ある事態に直面して、心の中に湧き上がる感情（同情・涙・怒り・驚きなど）を自分の意志ではどうしても抑えることができないという硬い書き言葉です。',
    cantoneseComparison: '相當於中文書面語「令人不禁落淚／深表同情／難掩憤慨」。',
    exampleJp: '被災地[ひさいち]の惨状[さんじょう]を目[め]の当[あ]たりにして、同情[どうじょう]の念[ねん]を禁[きん]じ得[え]なかった。',
    exampleHk: '親眼目睹災區嘅慘況，實在禁唔住湧起同情之心。',
  },
  {
    id: 'n1-g2',
    level: 'N1',
    pattern: '〜んばかりだ／〜んばかりに',
    formation: '動詞ない形（去ない）+ んばかり（する -> せんばかり）',
    meaning: '簡直就好似快要...一樣（極度誇張嘅比喻狀態）',
    meaningJa: '今にも〜しそうなほど激しい様子・態度である（比喩的強調）',
    nuance: '實際上未真係發生，但外表態度、氣勢已經去到臨界點，好似下一秒就會爆發咁。',
    nuanceJa: '実際にはその動作をしていないが、外から見た様子や勢いが「今にも〜しそうだ」と感じられるほど極端であることを比喩的に強調する表現です。',
    cantoneseComparison: '廣東話形容「個心緊張到爭啲跳出嚟」、「觀眾興奮到就嚟拆天咁滯」。',
    exampleJp: '会場[かいじょう]は割[わ]れんばかりの拍手[はくしゅ]と歓声[かんせい]に包[つつ]まれた。',
    exampleHk: '會場被震耳欲聾（簡直好似要震裂會場一樣）嘅掌聲同歡呼聲包圍住。',
  },
];

export const READING_DATABASE: ReadingPassage[] = [
  {
    id: 'n5-r1',
    level: 'N5',
    title: '東京での初めての週末',
    contextType: '日記・生活隨筆',
    contentJp:
      '先週[せんしゅう]から東京[とうきょう]での生活[せいかつ]が始[はじ]まりました。きのうは日曜日[にちようび]だったので、近[ちか]くのスーパーへ買[か]い物[もの]に行[い]きました。日本のスーパーにはお弁[べん]当[とう]や果物[くだもの]がたくさんあります。夕方[ゆうがた]7時[じ]すぎに行[い]くと、お弁[べん]当[とう]が安[やす]くなっていました。とてもおいしかったです。',
    translationHk:
      '由上個禮拜開始，我展開咗喺東京嘅生活。尋日係禮拜日，所以我去咗附近嘅超市買嘢。日本嘅超市有好多便當同生果。傍晚過咗 7 點之後去嘅話，便當已經減價變平咗。真係好好食。',
    keyTakeaway: '留意「〜くなっていました」表示去到超市嗰一刻，便當已經處於「變平咗（特價）」嘅狀態。',
    comprehensionQuestion: {
      question: 'この人はどうして夕方7時すぎにお弁当を安く買えましたか？',
      options: [
        '夜になるとスーパーのお弁当が値下げされるから',
        '友達がスーパーで働いているから',
        '日曜日は朝からずっと半額だから',
        '自分で料理を作ったから',
      ],
      correctIndex: 0,
      explanation: '文中提到「夕方7時すぎに行くと、お弁当が安くなっていました」，日本超市喺傍晚過後會為熟食便當貼減價貼紙。',
    },
  },
  {
    id: 'n4-r1',
    level: 'N4',
    title: '図書館の利用案内メール',
    contextType: '公共設施通知',
    contentJp:
      'さくら図書館[としょかん]をご利[り]用[よう]いただき、ありがとうございます。来月[らいげつ]10日[とおか]から15日[にち]まで、館内[かんない]のコンピュータシステムを新[あたら]しくするため、図書館[としょかん]はお休[やす]みになります。休館中[きゅうかんちゅう]に本[ほん]を返[かえ]したい方[かた]は、正面玄関[しょうめんげんかん]の横[よこ]にある「返却[へんきゃく]ポスト」に入[い]れておいてください。',
    translationHk:
      '多謝閣下使用櫻花圖書館。下個月 10 號至 15 號期間，為咗更新館內嘅電腦系統，圖書館將會休館。休館期間想還書嘅讀者，請將書本放入正門旁邊嘅「還書箱」入面。',
    keyTakeaway: 'N4 資訊檢索題必考「期間內可以做咩／唔可以做咩」以及「〜ておいてください（請預先放好）」嘅指示。',
    comprehensionQuestion: {
      question: '来月12日に本を返したい場合、どうすればいいですか？',
      options: [
        '正面玄関の横にある返却ポストに入れる',
        '16日まで待ってから窓口で返すしかない',
        '図書館の中のスタッフに直接渡す',
        'インターネットで返却手続きをする',
      ],
      correctIndex: 0,
      explanation: '12 號屬於休館期間（10號至15號），通知明確指出休館期間還書可放入正門旁邊嘅「返却ポスト（還書箱）」。',
    },
  },
  {
    id: 'n3-r1',
    level: 'N3',
    title: '「聴く力」が人間関係を変える',
    contextType: '專欄評論',
    contentJp:
      'コミュニケーションが上手[じょうず]な人[ひと]というと、面白[おもしろ]い話[はなし]ができる人[ひと]を思[おも]い浮[う]かべがちだ。しかし、実際[じっさい]に相手[あいて]から信頼[しんらい]されるのは、自分[じぶん]が話[はな]すことよりも、相手[あいて]の言葉[ことば]にしっかり耳[みみ]を傾[かたむ]けられる人[ひと]である。うなずきながら丁寧[ていねい]に聴[き]くだけで、相手[あいて]は「受[う]け入[い]れられている」と安心[あんしん]するのだ。',
    translationHk:
      '講起溝通技巧好嘅人，大家往往好容易聯想到識講有趣話題嘅人。然而，實際上能夠獲得對方信賴嘅，比起自己滔滔不絕咁講，反而係能夠專心傾聽對方說話嘅人。單單係一邊點頭一邊用心傾聽，對方就會覺得「自己被接納緊」而感到安心。',
    keyTakeaway: '掌握日文議論文黃金轉折結構：「〜がちだ（一般人容易咁諗）」＋「しかし、実際に〜のは...である（但作者真正主張係後者）」。',
    comprehensionQuestion: {
      question: '筆者が最も伝えたいことは何ですか？',
      options: [
        '信頼関係を築くには、まず相手の話を丁寧に聴く姿勢が重要だ',
        '面白い冗談を言える人だけがビジネスで成功できる',
        '自分の意見を全く言わないほうが人間関係がうまくいく',
        'うなずくだけでは相手に安心感を与えることはできない',
      ],
      correctIndex: 0,
      explanation: '「しかし、実際に...」後面先係作者核心論點：真正獲信賴嘅係「相手の言葉にしっかり耳を傾けられる人（能用心傾聽對方說話嘅人）」。',
    },
  },
  {
    id: 'n2-r1',
    level: 'N2',
    title: 'リモートワーク時代の雑談の価値',
    contextType: '商務趨勢分析',
    contentJp:
      '在宅勤務[ざいたくきんむ]の普及[ふきゅう]に伴[ともな]い、業務[ぎょうむ]の効率[こうりつ]が上[あ]がったという声[こえ]が多[おお]い一方[いっぽう]で、社員間[しゃいんかん]の「何気[なにげ]ない雑談[ざつだん]」が失[うしな]われたことを懸念[けねん]する企業[きぎょう]も少[すく]なくない。一見[いっけん]無駄[むだ]に思[おも]える雑談[ざつだん]だが、そこには新[あたら]しいアイデアの種[たね]や、トラブルを未然[みぜん]に防[ふせ]ぐヒントが隠[かく]されていることが多[おお]いからだ。',
    translationHk:
      '隨住在家工作普及，雖然好多人反映工作效率提升咗，但另一方面，擔心員工之間失去「不經意嘅閒聊」嘅企業亦唔少。閒聊表面睇落好似浪費時間，但當中往往隱藏住新構思嘅種子，以及防範問題於未然嘅線索。',
    keyTakeaway: '注意「一見〜に思えるが、実は...」呢個 N2/N1 最愛考嘅欲揚先抑結構。',
    comprehensionQuestion: {
      question: '本文によると、社員間の「雑談」にはどのような役割がありますか？',
      options: [
        '新しい発想が生まれたり、問題を早めに防いだりするきっかけになる',
        '業務の効率を大幅に下げる原因にしかならない',
        '在宅勤務の普及によって以前よりも自然に増えている',
        '公式な会議の時間を短縮するために義務付けられている',
      ],
      correctIndex: 0,
      explanation: '文中最後一句指出閒聊入面「新しいアイデアの種や、トラブルを未然に防ぐヒントが隠されている（隱藏住新念頭同預防問題嘅提示）」。',
    },
  },
  {
    id: 'n1-r1',
    level: 'N1',
    title: '知識の蓄積と「忘却」の効用',
    contextType: '認知科學與哲學評論',
    contentJp:
      '情報化社会[じょうほうかしゃかい]において、我々[われわれ]はあらゆる知識[ちしき]を記憶[きおく]し保持[ほじ]し続[つづ]けることを善[ぜん]としがちである。しかしながら、人間[にんげん]の思考[しこう]が創造性[そうぞうせい]を発[はっ]揮[き]するためには、むしろ適度[てきど]な「忘却[ぼうきゃく]」が不可欠[ふかけつ]ではないだろうか。枝葉末節[しようまっせつ]の記憶[きおく]を削[そ]ぎ落[お]とすことで初[はじ]めて、物事[ものごと]の本質的[ほんしつてき]な構造[こうぞう]が浮[う]かび上[あ]がってくるのである。',
    translationHk:
      '喺資訊化社會入面，我哋往往傾向將記住並持續保存所有知識視為美德。然而，為咗令人類嘅思考發揮創造力，適度嘅「遺忘」反而係不可或缺嘅唔係咩？正正因為削走咗枝節瑣碎嘅記憶，事物最本質嘅結構先至能夠浮現出嚟。',
    keyTakeaway: 'N1 必考反詰語氣「〜ではないだろうか（難道唔係...嗎？＝作者強烈肯定）」同埋「〜ことで初めて...（唯有透過...先至能夠...）」。',
    comprehensionQuestion: {
      question: '筆者は「忘却」についてどのように捉えていますか？',
      options: [
        '瑣末な情報を手放すことで本質を見抜き、創造性を生み出すために必要なもの',
        '情報化社会において可能な限り克服しなければならない人間の欠点',
        '重要な構造まで失ってしまうため、思考力を低下させる危険なもの',
        'デジタル技術によって完全に代替されるべき過去の機能',
      ],
      correctIndex: 0,
      explanation: '作者透過「適度な忘却が不可欠ではないだろうか」及「枝葉末節の記憶を削ぎ落とすことで初めて、本質的な構造が浮かび上がる」肯定適度遺忘對洞察本質與創造力嘅價值。',
    },
  },
];

export const QUIZ_BANK: QuizQuestion[] = [
  // N5
  {
    id: 'q-n5-1',
    level: 'N5',
    category: 'vocab',
    question: '「明日は友達と映画を見る（ 約束 ）があります。」（　）の正しい読み方はどれですか？',
    options: ['やくそく', 'ようそく', 'やくぞく', 'よやく'],
    correctIndex: 0,
    explanation: '「約束」讀作「やくそく (yakusoku)」，意思係約定。注意「束」係清音「そく」，唔好讀濁音。',
  },
  {
    id: 'q-n5-2',
    level: 'N5',
    category: 'grammar',
    question: '「手を洗っ（　　）、晩ご飯を食べます。」空欄に入る最も適切なものはどれですか？',
    options: ['てから', 'たり', 'ながら', 'ても'],
    correctIndex: 0,
    explanation: '「動詞て形＋から」表示動作先後順序：「洗完手之後，先至食晚飯」。',
  },
  {
    id: 'q-n5-3',
    level: 'N5',
    category: 'grammar',
    question: '「休日は家で映画を見（　　）、本を読んだりします。」',
    options: ['たり', 'たら', 'ても', 'てから'],
    correctIndex: 0,
    explanation: '「〜たり、〜たりする」用嚟列舉放假做嘅代表性活動（睇下戲、睇下書咁）。',
  },

  // N4
  {
    id: 'q-n4-1',
    level: 'N4',
    category: 'vocab',
    question: '「今から走れば、8時の電車に（　　）よ！」',
    options: ['間に合います', '片付けます', '遠慮します', '出かけます'],
    correctIndex: 0,
    explanation: '「電車に間に合う」意思係「趕得切班電車」。「間に合う」前面嘅目標對象固定用助詞「に」。',
  },
  {
    id: 'q-n4-2',
    level: 'N4',
    category: 'grammar',
    question: '「パーティーの準備はもう全部し（　　）から、安心してください。」',
    options: ['てあります', 'ています', 'てしまいます', 'てみます'],
    correctIndex: 0,
    explanation: '「他動詞＋てあります」強調為咗某個目的（派對）已經人為特登準備妥當，而且效果持續緊。',
  },
  {
    id: 'q-n4-3',
    level: 'N4',
    category: 'grammar',
    question: '「健康のために、毎日野菜をたくさん（　　）ようにしています。」',
    options: ['食べる', '食べた', '食べて', '食べよう'],
    correctIndex: 0,
    explanation: '「動詞辭書形／ない形＋ようにしています」表示持續努力養成某個習慣。',
  },

  // N3
  {
    id: 'q-n3-1',
    level: 'N3',
    category: 'vocab',
    question: '「まだ食べられる料理を全部捨ててしまうなんて、（　　）ですね。」',
    options: ['もったいない', 'だらしがない', 'おもいがけない', 'やむをえない'],
    correctIndex: 0,
    explanation: '「もったいない」指仲有用、仲食得嘅嘢白白浪費咗，好可惜／好嘥。',
  },
  {
    id: 'q-n3-2',
    level: 'N3',
    category: 'grammar',
    question: '「明日は大切な面接があるから、今夜は風邪をひいても休む（　　）。」',
    options: ['わけにはいかない', 'ことはない', 'はずがない', 'に違いない'],
    correctIndex: 0,
    explanation: '「〜わけにはいかない」表示因為有重要責任或立場（聽日有重要面試），情理上絕對唔能夠請假休息。',
  },
  {
    id: 'q-n3-3',
    level: 'N3',
    category: 'grammar',
    question: '「銀行へ行った（　　）、郵便局ではがきを買った。」',
    options: ['ついでに', 'おかげで', 'くせに', 'かわりに'],
    correctIndex: 0,
    explanation: '「〜ついでに」表示去銀行辦正事嗰陣，「順便」去郵局買埋明信片。',
  },

  // N2
  {
    id: 'q-n2-1',
    level: 'N2',
    category: 'vocab',
    question: '「彼は危機的状況で素晴らしいリーダーシップを発揮し、私は彼のことを（　　）。」',
    options: ['見直した', '見落とした', '見送った', '見極めた'],
    correctIndex: 0,
    explanation: '「人を見直す」除咗檢討之外，仲有「重新評價某人、對佢刮目相看／另眼相看」嘅意思！',
  },
  {
    id: 'q-n2-2',
    level: 'N2',
    category: 'grammar',
    question: '「当社では経験の有無（　　）、やる気のある人材を広く募集しています。」',
    options: ['を問わず', 'に際して', 'を機に', 'に先立って'],
    correctIndex: 0,
    explanation: '「経験の有無を問わず」係商務招聘固定搭配，意思係「不論有無經驗」。',
  },
  {
    id: 'q-n2-3',
    level: 'N2',
    category: 'grammar',
    question: '「海外留学へ出発する（　　）、お世話になった先生方に挨拶をした。」',
    options: ['に際して', 'を問わず', 'につれて', 'に反して'],
    correctIndex: 0,
    explanation: '「〜に際して」用於重大事件或轉折時刻（出發留學之際），向老師致意。',
  },

  // N1
  {
    id: 'q-n1-1',
    level: 'N1',
    category: 'vocab',
    question: '「政府は感染症の拡大を防ぐため、速やかに緊急の（　　）を講じた。」',
    options: ['措置', '懸念', '淘汰', '妥協'],
    correctIndex: 0,
    explanation: '「措置を講じる（そちをこうじる）」係 N1 必記固定慣用搭配，意思係「採取應對措施」。',
  },
  {
    id: 'q-n1-2',
    level: 'N1',
    category: 'grammar',
    question: '「長年の努力が実を結び、優勝が決まった瞬間、選手たちは泣か（　　）ばかりに喜び合った。」',
    options: ['ん', 'ない', 'ず', 'まい'],
    correctIndex: 0,
    explanation: '「動詞ない形去ない＋んばかりに」（泣かんばかりに）形容激動到簡直快要喊出嚟一樣。',
  },
  {
    id: 'q-n1-3',
    level: 'N1',
    category: 'grammar',
    question: '「あの誠実な彼が不正に関わっていたとは、驚き（　　）。」',
    options: ['を禁じ得ない', 'に堪えない', 'を余儀なくされた', 'に相違ない'],
    correctIndex: 0,
    explanation: '「驚きを禁じ得ない」意思係「禁唔住感到震驚／難掩驚訝之情」。',
  },
];

export const SAMPLE_MATERIALS = [
  {
    id: 'sample-kyoto',
    title: 'N3/N2 京都夜間賞楓與日本文化短文',
    level: 'N3' as JlptLevel,
    content:
      '日本の春といえば桜ですが、秋の紅葉も多くの人々を魅了します。特に京都の歴史ある寺院では、11月になると夜間に特別なライトアップが行われることも珍しくありません。昼間の穏やかな雰囲気とは対照的に、光に照らされた紅葉が池の水面に映り込む光景は、息をのむほど幻想的です。訪れる際は、事前の予約が必要な場合もあるため、早めに確認しておくことをおすすめします。',
  },
  {
    id: 'sample-business',
    title: 'N2/N1 商務敬語電郵：會議改期請求',
    level: 'N2' as JlptLevel,
    content:
      '株式会社佐藤商事 営業部 鈴木様\n平素は格別のご高配を賜り、厚く御礼申し上げます。先日は新製品プロジェクトの打ち合わせに際しまして、貴重なお時間をいただき誠にありがとうございました。さて、来週火曜日に予定しております次回会議の件ですが、弊社内の緊急の事情により、日程を変更していただくことは可能でしょうか。ご多忙のところ大変恐縮ではございますが、何卒ご検討のほどよろしくお願い申し上げます。',
  },
  {
    id: 'sample-cafe',
    title: 'N5/N4 日本餐廳點餐與便利店實戰對話',
    level: 'N5' as JlptLevel,
    content:
      '店員：いらっしゃいませ。店内でお召し上がりですか。\n客：はい、ここで食べます。この抹茶ケーキとホットコーヒーを一つずつお願いします。\n店員：かしこまりました。お会計は850円になります。ポイントカードはお持ちですか。\n客：いいえ、大丈夫です。クレジットカードで払ってもいいですか。\n店員：はい、こちらにカードをタッチしてください。レシートのお返しです。ごゆっくりどうぞ。',
  },
];
