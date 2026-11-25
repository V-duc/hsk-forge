import type { HskLevel } from '../types';
import type { DialogueTurn } from '../lib/speech';

export interface ListeningDialogueSeed {
  id: string;
  level: HskLevel;
  turns: DialogueTurn[];
  questionZh: string;
  options: string[];
  correctIdx: number;
  explanationVi: string;
}

export interface ReadingClozeOrOrderSeed {
  id: string;
  level: HskLevel;
  subtype: 'cloze' | 'order' | 'passage';
  promptZh: string;
  questionZh: string;
  options: string[];
  correctIdx: number;
  explanationVi: string;
}

export interface WritingSeed {
  id: string;
  level: HskLevel;
  subtype: 'scramble' | 'pinyin_fill' | 'keyword_compose';
  instructionVi: string;
  tokens?: string[]; // for scramble
  answerZh: string;
  pinyinHint?: string;
  sentenceWithBlank?: string; // for pinyin_fill e.g. "明天我们去机场 ( ___ ) 朋友。"
  keywords?: string[]; // for keyword_compose
  explanationVi: string;
}

export interface SpeakingSeed {
  id: string;
  level: HskLevel;
  subtype: 'repeat' | 'open_answer';
  promptZh: string;
  pinyin: string;
  meaningVi: string;
  sampleAnswerZh?: string;
  keyElements?: string[];
}

export const LISTENING_DIALOGUES: ListeningDialogueSeed[] = [
  {
    id: 'ld-1-1',
    level: 1,
    turns: [
      { speaker: 'M', zh: '请问，今天几号？是星期四吗？' },
      { speaker: 'F', zh: '今天九月十号，不是星期四，是星期五。' },
      { speaker: 'Q', zh: '今天星期几？' },
    ],
    questionZh: '今天星期几？',
    options: ['星期四 (Thứ Năm)', '星期五 (Thứ Sáu)', '星期六 (Thứ Bảy)', '星期日 (Chủ Nhật)'],
    correctIdx: 1,
    explanationVi: 'Người nữ phủ định 星期四 và chốt: 是星期五 (Hôm nay là thứ Sáu).',
  },
  {
    id: 'ld-1-2',
    level: 1,
    turns: [
      { speaker: 'F', zh: '下午你想去商店买什么？' },
      { speaker: 'M', zh: '我想买一个杯子，再买一点儿水果。' },
      { speaker: 'Q', zh: '男的下午想买什么？' },
    ],
    questionZh: '男的下午想买什么？',
    options: ['衣服和书', '杯子和水果', '电脑和椅子', '茶和米饭'],
    correctIdx: 1,
    explanationVi: 'Người nam nói rõ: 我想买一个杯子，再买一点儿水果 (mua cốc và hoa quả).',
  },
  {
    id: 'ld-2-1',
    level: 2,
    turns: [
      { speaker: 'M', zh: '你家离公司远吗？每天怎么去上班？' },
      { speaker: 'F', zh: '很近，走路十分钟就到了，不用坐公共汽车。' },
      { speaker: 'Q', zh: '女的每天怎么去上班？' },
    ],
    questionZh: '女的每天怎么去上班？',
    options: ['坐公共汽车', '开出租车', '走路去', '骑自行车'],
    correctIdx: 2,
    explanationVi: 'Người nữ nói 很近，走路十分钟就到了 (đi bộ 10 phút là tới, không cần đi xe buýt).',
  },
  {
    id: 'ld-2-2',
    level: 2,
    turns: [
      { speaker: 'F', zh: '这件白衣服真漂亮，比那件红的便宜二十块钱。' },
      { speaker: 'M', zh: '那我们就买这件白的吧。' },
      { speaker: 'Q', zh: '他们决定买哪件衣服？' },
    ],
    questionZh: '他们决定买哪件衣服？',
    options: ['红色的那件', '白色的这件', '黑色的那件', '两件都不买'],
    correctIdx: 1,
    explanationVi: 'Người nam chốt: 那我们就买这件白的吧 (quyết định mua chiếc màu trắng).',
  },
  {
    id: 'ld-3-1',
    level: 3,
    turns: [
      { speaker: 'M', zh: '糟糕，我把去上海的火车票忘在家里了。' },
      { speaker: 'F', zh: '别着急，现在才七点，坐出租车回去拿还来得及。' },
      { speaker: 'Q', zh: '女的是什么意思？' },
    ],
    questionZh: '女的是什么意思？',
    options: ['火车已经开了', '现在回去拿票还有时间', '应该重新买一张票', '不用坐火车去了'],
    correctIdx: 1,
    explanationVi: '来得及 có nghĩa là vẫn còn kịp giờ để bắt taxi quay về nhà lấy vé.',
  },
  {
    id: 'ld-3-2',
    level: 3,
    turns: [
      { speaker: 'F', zh: '八点开会，小王七点半就到办公室了，你怎么八点一刻才来？' },
      { speaker: 'M', zh: '对不起，路上堵车堵得太厉害了。' },
      { speaker: 'Q', zh: '男的为什么迟到了？' },
    ],
    questionZh: '男的为什么迟到了？',
    options: ['起床起晚了', '记错开会时间了', '路上堵车了', '去接客户了'],
    correctIdx: 2,
    explanationVi: 'Người nam giải thích: 路上堵车堵得太厉害了 (trên đường tắc xe dữ quá).',
  },
  {
    id: 'ld-4-1',
    level: 4,
    turns: [
      { speaker: 'M', zh: '这份市场调查报告本来应该今天交，但我还差最后一部分数据没核对完。' },
      { speaker: 'F', zh: '没关系，张经理出差了，你明天中午前发到他邮箱就行。' },
      { speaker: 'Q', zh: '关于那份报告，可以知道什么？' },
    ],
    questionZh: '关于那份报告，可以知道什么？',
    options: ['已经发给张经理了', '数据全部核对完了', '可以推迟到明天中午交', '张经理觉得很不满意'],
    correctIdx: 2,
    explanationVi: 'Người nữ cho phép nộp qua email trước buổi trưa ngày mai vì giám đốc Trương đi công tác.',
  },
  {
    id: 'ld-5-1',
    level: 5,
    turns: [
      { speaker: 'F', zh: '听说你们部门新招的实习生不仅外语流利，而且编程能力也很出色？' },
      { speaker: 'M', zh: '确实如此，唯一美中不足的是缺乏实际项目经验，遇到突发状况容易紧张。' },
      { speaker: 'Q', zh: '男的认为那个实习生怎么样？' },
    ],
    questionZh: '男的认为那个实习生怎么样？',
    options: ['外语水平一般', '缺少实际项目经验', '不愿意学习新技术', '性格过于骄傲'],
    correctIdx: 1,
    explanationVi: '美中不足 (điểm tiếc nuối duy nhất) là 缺乏实际项目经验 (thiếu kinh nghiệm dự án thực tế).',
  },
  {
    id: 'ld-6-1',
    level: 6,
    turns: [
      { speaker: 'M', zh: '部分传统书店试图通过售卖咖啡和文创产品来吸引客流，但图书销量并未因此显著增长。' },
      { speaker: 'F', zh: '这无非是治标不治本罢了，书店的核心竞争力终究在于优质的选书品味与阅读氛围。' },
      { speaker: 'Q', zh: '女的对传统书店转型的看法是什么？' },
    ],
    questionZh: '女的对传统书店转型的看法是什么？',
    options: ['应该彻底放弃卖书', '应当扩大咖啡区面积', '关键在于提升选书质量与氛围', '价格昂贵导致读者流失'],
    correctIdx: 2,
    explanationVi: '治标不治本 (chữa ngọn không chữa gốc); cốt lõi vẫn là 优质的选书品味与阅读氛围.',
  },
];

export const READING_SEEDS: ReadingClozeOrOrderSeed[] = [
  {
    id: 'rd-1-1',
    level: 1,
    subtype: 'cloze',
    promptZh: '王医生在医院工作，他女儿今年八（ ___ ）了。',
    questionZh: 'Chọn từ điền vào chỗ trống đúng ngữ pháp HSK 1:',
    options: ['岁 (suì)', '月 (yuè)', '块 (kuài)', '本 (běn)'],
    correctIdx: 0,
    explanationVi: 'Nói về số tuổi (8 tuổi) dùng danh từ chỉ đơn vị tuổi tác 岁.',
  },
  {
    id: 'rd-2-1',
    level: 2,
    subtype: 'cloze',
    promptZh: '今天天气（ ___ ）昨天冷得多，你出门多穿件衣服吧。',
    questionZh: 'Chọn hư từ đúng điền vào câu so sánh:',
    options: ['离 (lí)', '比 (bǐ)', '向 (xiàng)', '往 (wǎng)'],
    correctIdx: 1,
    explanationVi: 'Cấu trúc câu so sánh hơn kém: A + 比 + B + Tính từ + 得多.',
  },
  {
    id: 'rd-3-1',
    level: 3,
    subtype: 'passage',
    promptZh: '很多人觉得年轻的时候应该多赚钱，等老了再去旅游。其实，有些地方只有年轻、体力好的时候才爬得上去；等老了，即使有时间也有钱，身体却受不了了。',
    questionZh: '这段话主要想告诉我们什么？',
    options: [
      '老年人更喜欢去爬山',
      '有些事应该趁年轻的时候去做',
      '旅游不需要花太多钱',
      '年轻的时候不用努力工作',
    ],
    correctIdx: 1,
    explanationVi: 'Đoạn văn nhấn mạnh nhiều nơi chỉ lúc trẻ khỏe mới leo nổi (爬得上去), nên làm khi còn trẻ.',
  },
  {
    id: 'rd-4-1',
    level: 4,
    subtype: 'order',
    promptZh: 'A. 还能培养独立解决问题的能力\nB. 出国留学不仅能提高外语水平\nC. 因此越来越受年轻人的欢迎',
    questionZh: 'Sắp xếp thứ tự đúng của 3 mệnh đề A - B - C (排列顺序):',
    options: ['B → A → C', 'A → B → C', 'C → B → A', 'B → C → A'],
    correctIdx: 0,
    explanationVi: 'Cặp liên từ khóa: B (不仅…) nối sang A (还能…), và C (因此…) chốt kết quả cuối câu.',
  },
  {
    id: 'rd-4-2',
    level: 4,
    subtype: 'order',
    promptZh: 'A. 都应该认真对待每一个细节\nB. 无论做多么简单的工作\nC. 这样才能赢得别人的信任',
    questionZh: 'Sắp xếp thứ tự đúng của 3 mệnh đề A - B - C:',
    options: ['A → B → C', 'B → A → C', 'B → C → A', 'C → B → A'],
    correctIdx: 1,
    explanationVi: 'Khung 无论… (B) bắt buộc đi trước 都… (A), sau đó dẫn đến kết quả 这样才能… (C).',
  },
  {
    id: 'rd-5-1',
    level: 5,
    subtype: 'passage',
    promptZh: '心理学研究表明，适度的压力能够激发人的潜能，使注意力更加集中；然而一旦压力超过承受极限，不但无法提高效率，反而会导致焦虑和失眠。因此，学会调节情绪至关重要。',
    questionZh: '根据这段话，下列哪项正确？',
    options: [
      '任何压力都会导致失眠',
      '压力越大工作效率越高',
      '适度的压力有助于集中注意力',
      '人们无法控制自己的情绪',
    ],
    correctIdx: 2,
    explanationVi: 'Bài nêu rõ: 适度的压力能够激发人的潜能，使注意力更加集中 (áp lực vừa phải giúp tập trung chú ý).',
  },
  {
    id: 'rd-6-1',
    level: 6,
    subtype: 'passage',
    promptZh: '请选出下列句子中没有语病（không mắc lỗi ngữ pháp 病句）的一项：',
    questionZh: 'Tìm câu ĐÚNG ngữ pháp chuẩn HSK 6 (3 câu còn lại là 病句):',
    options: [
      '通过这次安全培训，使全体员工增强了防范意识。',
      '为了避免今后不再发生类似的错误，我们必须严格把关。',
      '一个人能否取得成功，关键在于他是否具备坚持不懈的精神。',
      '他的写作水平明显改进了。',
    ],
    correctIdx: 2,
    explanationVi: 'Câu 1 khuyết chủ ngữ (通过…使…); Câu 2 thừa phủ định (避免不再); Câu 4 sai kết hợp (水平 phải đi với 提高, không đi với 改进). Câu 3 khớp chuẩn 2 chiều 能否…是否…!',
  },
];

export const WRITING_SEEDS: WritingSeed[] = [
  {
    id: 'wr-1-1',
    level: 1,
    subtype: 'scramble',
    instructionVi: 'Sắp xếp các từ rời rạc thành câu hoàn chỉnh chuẩn ngữ pháp:',
    tokens: ['昨天', '是', '我', '来北京', '的'],
    answerZh: '我是昨天来北京的',
    explanationVi: 'Cấu trúc nhấn mạnh thời gian trong quá khứ: 我 + 是 + 昨天 + 来北京 + 的.',
  },
  {
    id: 'wr-2-1',
    level: 2,
    subtype: 'scramble',
    instructionVi: 'Sắp xếp thành câu so sánh chữ 比 chuẩn xác:',
    tokens: ['今天', '冷得多', '比', '昨天'],
    answerZh: '今天比昨天冷得多',
    explanationVi: 'A (今天) + 比 + B (昨天) + Tính từ + Mức độ (冷得多).',
  },
  {
    id: 'wr-3-1',
    level: 3,
    subtype: 'scramble',
    instructionVi: 'Sắp xếp thành câu chữ 把 hoàn chỉnh (Phần 1 Đề Viết HSK 3):',
    tokens: ['请', '放在', '把', '桌子上', '那本词典'],
    answerZh: '请把那本词典放在桌子上',
    explanationVi: '请 + 把 + Tân ngữ xác định (那本词典) + Động từ (放在) + Vị trí (桌子上).',
  },
  {
    id: 'wr-3-2',
    level: 3,
    subtype: 'pinyin_fill',
    instructionVi: 'Nhìn Pinyin trong ngoặc và gõ đúng chữ Hán vào ô trống (Phần 2 Đề Viết HSK 3):',
    sentenceWithBlank: '遇到困难的时候，我们应该互相 ( bāng zhù ) ___ 。',
    pinyinHint: 'bāng zhù (giúp đỡ)',
    answerZh: '帮助',
    explanationVi: 'Từ chuẩn HSK 3: 帮助 (bāngzhù - giúp đỡ).',
  },
  {
    id: 'wr-4-1',
    level: 4,
    subtype: 'scramble',
    instructionVi: 'Sắp xếp thành câu bị động kết hợp phủ định (Phần 1 Đề Viết HSK 4):',
    tokens: ['那份文件', '被', '还没有', '翻译完'],
    answerZh: '那份文件还没有被翻译完',
    explanationVi: 'Phó từ phủ định (还没有) bắt buộc phải đứng TRƯỚC chữ 被: 那份文件还没有被翻译完.',
  },
  {
    id: 'wr-4-2',
    level: 4,
    subtype: 'keyword_compose',
    instructionVi: 'Đặt 1 câu tiếng Trung hoàn chỉnh (tối thiểu 10 chữ Hán) có sử dụng từ khóa bắt buộc sau:',
    keywords: ['不仅', '而且'],
    answerZh: '他不仅会说流利的汉语，而且非常了解中国文化。',
    explanationVi: 'Câu cần chứa đủ cặp liên từ 不仅 … 而且 … và kết thúc bằng dấu câu chuẩn.',
  },
  {
    id: 'wr-5-1',
    level: 5,
    subtype: 'keyword_compose',
    instructionVi: 'Viết một đoạn văn ngắn (tối thiểu 25 chữ Hán) sử dụng TẤT CẢ các từ khóa chỉ định (Mô phỏng câu 99 HSK 5):',
    keywords: ['坚持', '克服', '反而'],
    answerZh: '面对工作中的困难，他不但没有放弃，反而咬紧牙关坚持了下来，最终成功克服了所有障碍。',
    explanationVi: 'Bài viết cần lồng ghép tự nhiên cả 3 từ khóa 坚持, 克服, 反而 theo đúng ngữ pháp phó từ 反而.',
  },
  {
    id: 'wr-6-1',
    level: 6,
    subtype: 'keyword_compose',
    instructionVi: 'Viết đoạn tóm tắt / lập luận ngắn (tối thiểu 35 chữ Hán) vận dụng chuẩn xác các từ học thuật HSK 6 sau:',
    keywords: ['固然', '得以', '长远'],
    answerZh: '眼前的经济利益固然诱人，但只有注重环境保护，生态平衡才得以维持，社会也才能实现长远的发展。',
    explanationVi: 'Sử dụng 固然…但… để nhượng bộ, 得以 đứng trước động từ hai âm tiết 维持, và 长远 làm định ngữ.',
  },
];

export const SPEAKING_SEEDS: SpeakingSeed[] = [
  {
    id: 'sp-1-1',
    level: 1,
    subtype: 'repeat',
    promptZh: '我是昨天坐飞机来北京的。',
    pinyin: 'Wǒ shì zuótiān zuò fēijī lái Běijīng de.',
    meaningVi: 'Nghe câu mẫu và đọc to nhắc lại nguyên văn vào micro:',
  },
  {
    id: 'sp-2-1',
    level: 2,
    subtype: 'repeat',
    promptZh: '每天早睡早起对身体健康非常有帮助。',
    pinyin: 'Měitiān zǎo shuì zǎo qǐ duì shēntǐ jiànkāng fēicháng yǒu bāngzhù.',
    meaningVi: 'Nghe và nhắc lại trôi chảy không ngắt quãng:',
  },
  {
    id: 'sp-3-1',
    level: 3,
    subtype: 'open_answer',
    promptZh: '请说说你周末一般喜欢做什么？为什么？',
    pinyin: 'Qǐng shuōshuo nǐ zhōumò yìbān xǐhuan zuò shénme? Wèishénme?',
    meaningVi: 'Trả lời câu hỏi khẩu ngữ (2-3 câu): Cuối tuần bạn thường thích làm gì? Tại sao?',
    sampleAnswerZh: '周末我一般喜欢去图书馆看书或者跟朋友一起运动，因为这样既能放松心情，又能锻炼身体。',
    keyElements: ['周末', '喜欢', '因为'],
  },
  {
    id: 'sp-4-1',
    level: 4,
    subtype: 'open_answer',
    promptZh: '在你看来，学好一门外语最重要的方法是什么？',
    pinyin: 'Zài nǐ kànlái, xué hǎo yì mén wàiyǔ zuì zhòngyào de fāngfǎ shì shénme?',
    meaningVi: 'Trả lời khẩu ngữ HSKK Trung cấp: Theo bạn, phương pháp quan trọng nhất để học giỏi ngoại ngữ là gì?',
    sampleAnswerZh: '在我看来，学好外语不仅要每天坚持积累词汇，而且要勇敢地开口跟别人交流，不怕犯错。',
    keyElements: ['外语', '坚持', '交流'],
  },
  {
    id: 'sp-5-1',
    level: 5,
    subtype: 'open_answer',
    promptZh: '有人喜欢稳定的工作，有人喜欢充满挑战的工作，你怎么看？',
    pinyin: 'Yǒurén xǐhuan wěndìng de gōngzuò, yǒurén xǐhuan chōngmǎn tiǎozhàn de gōngzuò, nǐ zěnme kàn?',
    meaningVi: 'Bình luận quan điểm HSKK Cao cấp: Giữa công việc ổn định và công việc giàu thử thách, bạn nhìn nhận thế nào?',
    sampleAnswerZh: '我认为年轻人与其安于现状，不如选择具有挑战性的工作，这样才能不断激发潜能，积累宝贵的经验。',
    keyElements: ['工作', '挑战', '经验'],
  },
  {
    id: 'sp-6-1',
    level: 6,
    subtype: 'open_answer',
    promptZh: '请谈谈人工智能的发展对未来教育带来的机遇与挑战。',
    pinyin: 'Qǐng tántan réngōng zhìnéng de fāzhǎn duì wèilái jiàoyù dàilái de jīyù yǔ tiǎozhàn.',
    meaningVi: 'Diễn thuyết ngắn HSKK Cao cấp: Cơ hội và thách thức của AI đối với giáo dục tương lai.',
    sampleAnswerZh: '人工智能固然能让个性化学习得以普及，但我们绝不能过度依赖技术，培养独立思考能力始终是教育的核心。',
    keyElements: ['人工智能', '教育', '思考'],
  },
];
