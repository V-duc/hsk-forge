import concurrent.futures
import json
import os
import re
import urllib.parse
import urllib.request

VOCAB_PATH = r"D:\Projects\hsk-web\public\data\hsk-vocab.json"
OUT_PATH = r"D:\Projects\hsk-web\public\data\hsk-curriculum.json"

with open(VOCAB_PATH, "r", encoding="utf-8") as f:
    all_vocab = json.load(f)

vocab_by_level: dict[int, list[dict]] = {lv: [] for lv in range(1, 7)}
for item in all_vocab:
    vocab_by_level[item["l"]].append(item)

# Structured official Standard Course topics per HSK level
LEVEL_BLUEPRINTS = {
    1: {
        "name": "HSK 1 - Nhập Môn & Phản Xạ Sống Còn",
        "totalHours": "30 - 35 giờ",
        "targetWords": 150,
        "examFormat": "Nghe hiểu (20 câu · 15p) + Đọc hiểu (20 câu · 17p) + Luyện viết nét & Nhại âm sơ cấp",
        "overview": "Xây nền phát âm Pinyin chuẩn Bắc Kinh, nắm quy tắc biến điệu (thanh 3, 一, 不), nhận diện 150 từ cốt lõi và 45 bộ thủ cơ bản để giao tiếp sinh hoạt tức thì.",
        "phases": [
            {"stage": "Chặng 1 (Buổi 1-5)", "focus": "Thanh mẫu, vận mẫu, biến điệu & mẫu câu chào hỏi, quốc tịch, gia đình"},
            {"stage": "Chặng 2 (Buổi 6-10)", "focus": "Thời gian, ngày tháng, tiền tệ, mua sắm, phương vị từ 在/有"},
            {"stage": "Chặng 3 (Buổi 11-15)", "focus": "Thời tiết, phương tiện đi lại, câu nhấn mạnh 是…的 & giải đề mô phỏng"},
        ],
        "sessions": [
            ("你好 - Chào hỏi & Quy tắc biến điệu thanh 3", ["Phát âm Pinyin", "Nghe phản xạ", "Viết nét cơ bản"], "Nắm thanh mẫu b p m f d t n l, 4 thanh điệu và quy tắc hai thanh 3 đi liền (你好 đọc thành ní hǎo).", "Chủ ngữ + 好 / 您好 (kính ngữ)", [
                ("你好！很高兴认识你。", "Nǐ hǎo! Hěn gāoxìng rènshi nǐ.", "Xin chào! Rất vui được làm quen với bạn."),
                ("对不起。— 没关系。", "Duìbuqǐ. — Méi guānxi.", "Xin lỗi. — Không sao đâu.")
            ], "Giáo trình chuẩn HSK 1 Bài 1"),
            ("谢谢你 - Cảm ơn, Tạm biệt & Khinh thanh", ["Phát âm Khinh thanh", "Giao tiếp lịch sự", "Viết nét móc/mác"], "Phát âm nhóm j q x z c s, đọc chuẩn thanh nhẹ (khinh thanh) cuối từ 谢谢, 客气, 爸爸, 妈妈.", "不客气 / 再见 / 明天见", [
                ("谢谢你！— 不客气。", "Xièxie nǐ! — Bú kèqi.", "Cảm ơn bạn! — Đừng khách sáo."),
                ("老师，再见！", "Lǎoshī, zàijiàn!", "Thưa thầy/cô, tạm biệt!")
            ], "Giáo trình chuẩn HSK 1 Bài 2"),
            ("你叫什么名字 - Hỏi tên & Quốc tịch", ["Nghe bắt tên riêng", "Đặt câu nghi vấn 什么/吗", "Nhận mặt chữ Hán"], "Sử dụng động từ 叫, 是 và đại từ nghi vấn 什么, 哪 để hỏi tên tuổi, quốc tịch.", "S + 叫 + Tên | S + 是 + 哪国人？", [
                ("你叫什么名字？", "Nǐ jiào shénme míngzi?", "Bạn tên là gì?"),
                ("我是越南人，他是中国人。", "Wǒ shì Yuènán rén, tā shì Zhōngguó rén.", "Tôi là người Việt Nam, anh ấy là người Trung Quốc.")
            ], "Giáo trình chuẩn HSK 1 Bài 3"),
            ("她是我的汉语老师 - Giới thiệu quan hệ", ["Phản xạ đại từ 谁/哪", "Trợ từ sở hữu 的", "Đọc không nhìn Pinyin"], "Phân biệt 谁 (ai) và 哪 (nào), dùng trợ từ kết cấu 的 chỉ quan hệ sở hữu và trợ từ 呢 hỏi ngược.", "Định ngữ + 的 + Danh từ | Còn … thì sao (…呢？)", [
                ("她是我的汉语老师。", "Tā shì wǒ de Hànyǔ lǎoshī.", "Cô ấy là giáo viên tiếng Trung của tôi."),
                ("他是谁？他是我的同学。", "Tā shì shéi? Tā shì wǒ de tóngxué.", "Cậu ấy là ai? Cậu ấy là bạn cùng lớp của tôi.")
            ], "Giáo trình chuẩn HSK 1 Bài 4"),
            ("她女儿今年二十岁 - Gia đình & Tuổi tác", ["Nghe con số 1-100", "Hỏi tuổi 几/多大", "Trợ từ thay đổi 了"], "Phân biệt 几 (hỏi số <10, trẻ nhỏ) và 多大 (hỏi tuổi người đồng trang lứa/người lớn).", "Nhà có mấy người: 几口人 | Hỏi tuổi: 今年多大？", [
                ("你家有几口人？", "Nǐ jiā yǒu jǐ kǒu rén?", "Nhà bạn có mấy người?"),
                ("她女儿今年二十岁了。", "Tā nǚ'ér jīnnián èrshí suì le.", "Con gái cô ấy năm nay 20 tuổi rồi.")
            ], "Giáo trình chuẩn HSK 1 Bài 5"),
            ("我会说汉语 - Năng lực & Kỹ năng", ["Động từ năng nguyện 会", "Câu vị ngữ tính từ 很", "Luyện nói trả lời nhanh"], "Dùng 会 biểu thị kỹ năng học được, cách dùng 怎么 hỏi phương thức thực hiện động tác.", "S + 会/不会 + V | 怎么 + V (viết/đọc thế nào)?", [
                ("我会说汉语，不会写汉字。", "Wǒ huì shuō Hànyǔ, bú huì xiě Hànzì.", "Tôi biết nói tiếng Trung nhưng chưa biết viết chữ Hán."),
                ("这个字怎么读？", "Zhège zì zěnme dú?", "Chữ này đọc như thế nào?")
            ], "Giáo trình chuẩn HSK 1 Bài 6"),
            ("今天几号 - Thứ, Ngày, Tháng & Lịch trình", ["Nghe lịch hẹn", "Trật tự thời gian tiếng Trung", "Câu liên động 去 + V"], "Nắm quy tắc thời gian từ lớn đến nhỏ (Năm → Tháng → Ngày → Thứ → Buổi → Giờ).", "Thời gian + S + 去 + Địa điểm + Làm gì", [
                ("今天九月二号，星期三。", "Jīntiān jiǔ yuè èr hào, xīngqīsān.", "Hôm nay là thứ Tư ngày 2 tháng 9."),
                ("明天我去看书。", "Míngtiān wǒ qù kàn shū.", "Ngày mai tôi đi đọc sách.")
            ], "Giáo trình chuẩn HSK 1 Bài 7"),
            ("我想喝茶 - Ăn uống, Mua sắm & Giá tiền", ["Nghe giá tiền 块/元", "Động từ 想", "Lượng từ 个/本/杯"], "Sử dụng 想 diễn đạt mong muốn, 多少/几 kèm lượng từ để hỏi số lượng và giá cả.", "S + 想 + V | 多少钱 (bao nhiêu tiền)?", [
                ("下午我想去商店买一个杯子。", "Xiàwǔ wǒ xiǎng qù shāngdiàn mǎi yí gè bēizi.", "Chiều nay tôi muốn ra cửa hàng mua một cái cốc."),
                ("这个多少钱？二十八块。", "Zhège duōshao qián? Èrshíbā kuài.", "Cái này bao nhiêu tiền? 28 tệ.")
            ], "Giáo trình chuẩn HSK 1 Bài 8"),
            ("你儿子在哪儿工作 - Nơi chốn & Nghề nghiệp", ["Giới từ 在", "Nghe địa điểm bệnh viện/trường học", "Viết bộ thủ chỉ nơi chốn"], "Phân biệt 在 làm động từ chính (ở tại đâu) và 在 làm giới từ chỉ nơi diễn ra hành động.", "S + 在 + Địa điểm + V", [
                ("我爸爸在医院工作，他是医生。", "Wǒ bàba zài yīyuàn gōngzuò, tā shì yīshēng.", "Bố tôi làm việc ở bệnh viện, ông ấy là bác sĩ."),
                ("小猫在椅子下面。", "Xiǎo māo zài yǐzi xiàmiàn.", "Con mèo nhỏ ở dưới gầm ghế.")
            ], "Giáo trình chuẩn HSK 1 Bài 9"),
            ("我能坐这儿吗 - Tồn hiện chữ 有 & Xin phép 能", ["Câu tồn hiện 有", "Xin phép 能/请", "Đọc hội thoại ngắn"], "Mô tả vật gì tồn tại ở vị trí nào bằng 有, phân biệt 能 (điều kiện cho phép) và 会 (kỹ năng).", "Phương vị từ + 有 + Danh từ | 我能…吗？", [
                ("桌子上有一台电脑和一本书。", "Zhuōzi shàng yǒu yì tái diànnǎo hé yì běn shū.", "Trên bàn có một chiếc máy tính và một quyển sách."),
                ("我能坐这儿吗？— 请坐。", "Wǒ néng zuò zhèr ma? — Qǐng zuò.", "Tôi ngồi đây được không? — Mời ngồi.")
            ], "Giáo trình chuẩn HSK 1 Bài 10"),
            ("现在几点 - Giờ giấc & Sinh hoạt hàng ngày", ["Nghe giờ hơn/kém 点/分", "Trạng ngữ thời gian", "Kể lịch trình cá nhân"], "Đọc giờ giấc chuẩn xác với 点, 分, 半, 刻 và đặt trạng ngữ thời gian trước hoặc sau chủ ngữ.", "S + Giờ giấc + V | 什么时候 (lúc nào)?", [
                ("现在八点十分，我们去学校吧。", "Xiànzài bā diǎn shí fēn, wǒmen qù xuéxiào ba.", "Bây giờ là 8 giờ 10 phút, tụi mình tới trường đi."),
                ("你什么时候回北京？", "Nǐ shénme shíhou huí Běijīng?", "Khi nào bạn về Bắc Kinh?")
            ], "Giáo trình chuẩn HSK 1 Bài 11"),
            ("明天天气怎么样 - Thời tiết & Mức độ 太…了", ["Nghe dự báo thời tiết", "Cảm thán 太…了", "Tính từ mức độ 很/不"], "Hỏi thời tiết hoặc tình trạng sự việc bằng 怎么样, dùng 太 + Adj + 了 để cảm thán.", "Chủ ngữ + 怎么样？ | 太 + Tính từ + 了", [
                ("昨天北京的天气怎么样？", "Zuótiān Běijīng de tiānqì zěnmeyàng?", "Thời tiết Bắc Kinh hôm qua thế nào?"),
                ("今天太热了，多喝一点儿水。", "Jīntiān tài rè le, duō hē yìdiǎnr shuǐ.", "Hôm nay nóng quá, uống thêm chút nước đi.")
            ], "Giáo trình chuẩn HSK 1 Bài 12"),
            ("他在学做中国菜呢 - Hành động đang diễn ra", ["Tiếp diễn 在…呢", "Gọi điện thoại 喂", "Nghe bắt hành động"], "Diễn tả hành động đang diễn ra ngay lúc nói bằng phó từ 在 kết hợp trợ từ 呢 cuối câu; phủ định dùng 没(在).", "S + 在 + V + O + 呢 | 没(在) + V", [
                ("喂，你在做什么呢？", "Wèi, nǐ zài zuò shénme ne?", "Alo, bạn đang làm gì đấy?"),
                ("他在学做中国菜呢。", "Tā zài xué zuò Zhōngguó cài ne.", "Anh ấy đang học nấu món Trung Quốc.")
            ], "Giáo trình chuẩn HSK 1 Bài 13"),
            ("她买了不少衣服 - Hành động hoàn thành 了", ["Trợ từ hoàn thành 了", "Phủ định quá khứ 没", "Danh từ 后 (sau khi)"], "Phân biệt 了 đứng cuối câu và V + 了 + Số lượng + Tân ngữ; phủ định quá khứ dùng 没 và bỏ 了.", "S + V + 了 + Cụm số lượng + O | S + 没 + V", [
                ("她去商店买了不少衣服。", "Tā qù shāngdiàn mǎi le bù shǎo yīfu.", "Cô ấy đi cửa hàng mua kha khá quần áo."),
                ("昨天我没看见张先生。", "Zuótiān wǒ méi kànjiàn Zhāng xiānsheng.", "Hôm qua tôi đã không nhìn thấy ông Trương.")
            ], "Giáo trình chuẩn HSK 1 Bài 14"),
            ("我是坐飞机来的 - Câu nhấn mạnh 是…的 & Tổng ôn", ["Cấu trúc 是…的", "Chiến thuật giải đề HSK 1", "Tổng duyệt 4 kỹ năng"], "Nắm vững cấu trúc nhấn mạnh thời gian, phương tiện, địa điểm của sự việc đã xảy ra với 是…的.", "S + 是 + Thời gian/Phương tiện + V + 的", [
                ("我是昨天和朋友坐飞机来北京的。", "Wǒ shì zuótiān hé péngyou zuò fēijī lái Běijīng de.", "Tôi đi máy bay cùng bạn tới Bắc Kinh vào ngày hôm qua."),
                ("我们是在大学认识的。", "Wǒmen shì zài dàxué rènshi de.", "Chúng tôi quen nhau ở trường đại học.")
            ], "Giáo trình chuẩn HSK 1 Bài 15"),
        ],
    },
    2: {
        "name": "HSK 2 - Phản Xạ Hội Thoại & Mở Rộng Câu",
        "totalHours": "35 - 40 giờ",
        "targetWords": 150,
        "examFormat": "Nghe hiểu (35 câu · 25p) + Đọc hiểu (25 câu · 22p) + Ghép câu & Nhắc lại khẩu ngữ",
        "overview": "Nâng tổng vốn từ lên 300 từ, làm chủ câu so sánh chữ 比, bổ ngữ kết quả, bổ ngữ thời lượng, trợ từ động thái 着/过 để giao tiếp trôi chảy các tình huống đời sống.",
        "phases": [
            {"stage": "Chặng 1 (Buổi 1-4)", "focus": "Du lịch, sức khỏe, thói quen sinh hoạt, trợ động từ 要, phó từ 最, cấu trúc 的"},
            {"stage": "Chặng 2 (Buổi 5-8)", "focus": "Mua sắm, hỏi đường, khoảng cách 离, câu hỏi chính phản, giới từ 对/给/从"},
            {"stage": "Chặng 3 (Buổi 9-12)", "focus": "Bổ ngữ kết quả, câu cầu khiến 别/不要, so sánh 比, trải nghiệm quá khứ 过"},
        ],
        "sessions": [
            ("九月去北京旅游最好 - Du lịch & Thời điểm lý tưởng", ["Trợ động từ 要", "Phó từ mức độ 最", "Ước lượng 几/多"], "Diễn tả nguyện vọng kế hoạch bằng 要 (phủ định thường dùng 不想) và nhấn mạnh bậc nhất bằng 最.", "S + 要 + V | 最 + Tính từ / Động từ tâm lý", [
                ("九月去北京旅游最好，不冷也不热。", "Jiǔ yuè qù Běijīng lǚyóu zuì hǎo, bù lěng yě bú rè.", "Tháng 9 đi Bắc Kinh du lịch là tuyệt nhất, không lạnh cũng chẳng nóng."),
                ("这个椅子五十多块钱。", "Zhège yǐzi wǔshí duō kuài qián.", "Chiếc ghế này hơn 50 tệ.")
            ], "Giáo trình chuẩn HSK 2 Bài 1"),
            ("我每天六点起床 - Thói quen, Sức khỏe & Câu hỏi 是不是", ["Câu hỏi xác nhận 是不是", "Đại từ 每", "Hỏi mức độ 多 + Adj"], "Dùng 是不是 khi người hỏi đã đoán được phần lớn sự thật và cần xác nhận nhanh.", "S + 是不是 + V? | 多高 / 多大 / 多重", [
                ("你很少生病，是不是很喜欢运动？", "Nǐ hěn shǎo shēngbìng, shìbushì hěn xǐhuan yùndòng?", "Bạn rất ít ốm, có phải rất thích tập thể thao không?"),
                ("我每天早上六点起床跑步。", "Wǒ měitiān zǎoshang liù diǎn qǐchuáng pǎobù.", "Sáng nào tôi cũng dậy lúc 6 giờ để chạy bộ.")
            ], "Giáo trình chuẩn HSK 2 Bài 2"),
            ("左边那个红色的是我的 - Miêu tả đồ vật & Lặp động từ", ["Cụm danh từ chữ 的", "一下 / Lặp động từ V+V", "Nhận diện màu sắc, vị trí"], "Lược danh từ trung tâm sau 的 (红色的 = cái màu đỏ) và làm mềm ngữ khí bằng lặp động từ 看看, 试试.", "Tính từ/Định ngữ + 的 | V + 一下 / V + V", [
                ("左边那个红色的是我的杯子。", "Zuǒbiān nàge hóngsè de shì wǒ de bēizi.", "Cái màu đỏ ở bên trái kia là cốc của tôi."),
                ("让我看一下你的新手表。", "Ràng wǒ kàn yíxià nǐ de xīn shǒubiǎo.", "Cho tôi xem thử đồng hồ mới của bạn một chút.")
            ], "Giáo trình chuẩn HSK 2 Bài 3"),
            ("这个工作是他帮我介绍的 - Công việc & Cấu trúc …的时候", ["Khung thời gian …的时候", "Phó từ 已经…了", "Nhấn mạnh tác nhân 是…的"], "Nối mệnh đề chỉ thời điểm diễn ra sự việc bằng …的时候 và diễn tả trạng thái hoàn tất bằng 已经…了.", "V / Adj + 的时候，S + V | 已经 + V + 了", [
                ("这个工作是他帮我介绍的。", "Zhège gōngzuò shì tā bāng wǒ jièshào de.", "Công việc này là do anh ấy giới thiệu giúp tôi."),
                ("给你打电话的时候，你正在开会。", "Gěi nǐ dǎ diànhuà de shíhou, nǐ zhèngzài kāihuì.", "Lúc gọi điện cho bạn thì bạn đang họp.")
            ], "Giáo trình chuẩn HSK 2 Bài 4"),
            ("就买这件吧 - Mua sắm, Đưa ra quyết định với 就", ["Phó từ 就", "Phó từ 还 (vẫn còn/khá)", "Liên từ 因为…所以…"], "Dùng 就 nhấn mạnh kết luận chốt hạ nhanh chóng và cặp nhân quả 因为…所以….", "因为 + Nguyên nhân，所以 + Kết quả | 就 + V + 吧", [
                ("这件衣服颜色不错，就买这件吧。", "Zhè jiàn yīfu yánsè búcuò, jiù mǎi zhè jiàn ba.", "Bộ đồ này màu ổn đấy, chốt mua chiếc này luôn đi."),
                ("因为外边下雨，所以我没去打篮球。", "Yīnwèi wàibiān xià yǔ, suǒyǐ wǒ méi qù dǎ lánqiú.", "Vì bên ngoài trời mưa nên tôi không đi chơi bóng rổ.")
            ], "Giáo trình chuẩn HSK 2 Bài 5"),
            ("你怎么不吃了 - Hỏi nguyên nhân 怎么 & Lặp lượng từ", ["Nghi vấn 怎么 + 不/没", "Lượng từ lặp 个个/件件", "Cấu trúc 但是"], "Dùng 怎么 + phủ định để hỏi nguyên nhân kèm thái độ ngạc nhiên; lặp lượng từ mang nghĩa 'mọi'.", "S + 怎么 + 不/没 + V? | Lượng từ lặp + 都…", [
                ("你怎么不吃了？菜不好吃吗？", "Nǐ zěnme bù chī le? Cài bù hǎochī ma?", "Sao bạn không ăn nữa? Món ăn không ngon à?"),
                ("你们班的同学个个都很努力。", "Nǐmen bān de tóngxué gègè dōu hěn nǔlì.", "Bạn học lớp các cậu ai nấy đều rất chăm chỉ.")
            ], "Giáo trình chuẩn HSK 2 Bài 6"),
            ("你家离公司远吗 - Khoảng cách 离 & Khung giờ còn lại", ["Giới từ khoảng cách 离", "Trợ từ 呢/过", "Câu hỏi chính phản V不V"], "Phân biệt 离 (khoảng cách tĩnh giữa A và B) với 从 (điểm xuất phát của chuyển động).", "A + 离 + B + 远/近 | 从 + A + 到 + B", [
                ("你家离公司远不远？", "Nǐ jiā lí gōngsī yuǎn bu yuǎn?", "Nhà bạn cách công ty có xa không?"),
                ("坐公共汽车要一个多小时呢。", "Zuò gōnggòng qìchē yào yí gè duō xiǎoshí ne.", "Đi xe buýt mất hơn một tiếng đồng hồ cơ.")
            ], "Giáo trình chuẩn HSK 2 Bài 7"),
            ("让我想想再告诉你 - Thứ tự hành động 再 vs 又", ["Câu kiêm ngữ 让/叫/请", "Phó từ 再 (lặp tương lai)", "Bổ ngữ kết quả 完/懂/见"], "Làm chủ câu sai khiến 让 + Ai + Làm gì và bổ ngữ kết quả gắn ngay sau động từ.", "让 + Tân ngữ + V | Đợi A xong rồi mới B: V1 + 再 + V2", [
                ("这件事让我想想再告诉你。", "Zhè jiàn shì ràng wǒ xiǎngxiang zài gàosu nǐ.", "Chuyện này để tôi suy nghĩ thêm rồi báo bạn sau."),
                ("黑板上的字你看得见吗？", "Hēibǎn shàng de zì nǐ kàn de jiàn ma?", "Chữ trên bảng đen bạn có nhìn thấy không?")
            ], "Giáo trình chuẩn HSK 2 Bài 8"),
            ("题太多，我没做完 - Bổ ngữ kết quả & Giới từ 从", ["Bổ ngữ kết quả 到/好/错/完", "Phủ định 没 + V+BNKQ", "Cấu trúc 第 + Số đếm"], "Ghép động từ với kết quả thực tế đạt được (做完 làm xong, 找着 tìm thấy, 听懂 nghe hiểu).", "S + V + 完/好/懂/错 + O | Phủ định: 没 + V + BNKQ", [
                ("今天的考试题太多，我没做完。", "Jīntiān de kǎoshì tí tài duō, wǒ méi zuò wán.", "Đề thi hôm nay nhiều câu quá, tôi làm chưa hết."),
                ("从明天开始，我每天跑五公里。", "Cóng míngtiān kāishǐ, wǒ měitiān pǎo wǔ gōnglǐ.", "Bắt đầu từ ngày mai, mỗi ngày tôi chạy 5 km.")
            ], "Giáo trình chuẩn HSK 2 Bài 9"),
            ("别找了，手机在桌子上呢 - Câu khuyên ngăn & Giới từ 对", ["Khuyên ngăn 不要…了 / 别…了", "Giới từ 对 + Ai/Việc gì", "Nghe hội thoại bẫy ý"], "Dùng 别…了 khuyên dừng hành động và 对 + Tân ngữ + Tính từ chỉ tác động đối với ai/cái gì.", "别 / 不要 + V + 了 | A + 对 + B + 很好/有用", [
                ("别找了，你的手机在桌子上呢。", "Bié zhǎo le, nǐ de shǒujī zài zhuōzi shàng ne.", "Đừng tìm nữa, điện thoại của bạn ở trên bàn kìa."),
                ("每天喝牛奶对身体很好。", "Měitiān hē niúnǎi duì shēntǐ hěn hǎo.", "Mỗi ngày uống sữa bò rất tốt cho sức khỏe.")
            ], "Giáo trình chuẩn HSK 2 Bài 10"),
            ("他比我大三岁 - Câu so sánh chữ 比 & Bổ ngữ trạng thái 得", ["So sánh hơn chữ 比", "Trợ từ trạng thái V + 得", "Phản xạ nói so sánh"], "Nắm quy tắc vàng: KHÔNG dùng 很 trước tính từ trong câu chữ 比; đánh giá hành động bằng V + 得 + Adj.", "A + 比 + B + Adj + (一点儿 / 多了 / Số lượng)", [
                ("哥哥比我大三岁，也比我高一点儿。", "Gēge bǐ wǒ dà sān suì, yě bǐ wǒ gāo yìdiǎnr.", "Anh trai lớn hơn tôi 3 tuổi và cũng cao hơn tôi một chút."),
                ("他今天起得非常早。", "Tā jīntiān qǐ de fēicháng zǎo.", "Hôm nay anh ấy dậy cực kỳ sớm.")
            ], "Giáo trình chuẩn HSK 2 Bài 11"),
            ("我看过那部电影 - Trải nghiệm 过, Trạng thái 着 & Tổng ôn", ["Trải nghiệm quá khứ V+过", "Trạng thái tĩnh V+着", "Bổ ngữ động lượng 次/遍"], "Phân biệt hoàn toàn 3 trợ từ 了 - 着 - 过 và hai động lượng từ 次 (số lần) vs 遍 (từ đầu chí cuối).", "S + (没) + V + 过 + O | V + 着 + O", [
                ("我去过两次北京，但没去过长城。", "Wǒ qù guo liǎng cì Běijīng, dàn méi qù guo Chángchéng.", "Tôi từng đi Bắc Kinh 2 lần nhưng chưa từng tới Vạn Lý Trường Thành."),
                ("门开着呢，外边下着雪。", "Mén kāizhe ne, wàibiān xiàzhe xuě.", "Cửa đang để mở, bên ngoài tuyết đang rơi.")
            ], "Giáo trình chuẩn HSK 2 Bài 12"),
        ],
    },
    3: {
        "name": "HSK 3 - Đột Phá Ngữ Pháp Trung Cấp & Viết Chữ Hán",
        "totalHours": "45 - 55 giờ",
        "targetWords": 300,
        "examFormat": "Nghe (40 câu) + Đọc không Pinyin (30 câu) + Viết câu & Điền chữ Hán (10 câu) + Khẩu ngữ HSKK Sơ cấp",
        "overview": "Bước ngoặt bỏ hoàn toàn Pinyin trong đề thi! Chinh phục toàn bộ hệ thống bổ ngữ (xu hướng, khả năng, mức độ) và hai cấu trúc xương sống tiếng Trung: câu chữ 把 và câu bị động chữ 被.",
        "phases": [
            {"stage": "Chặng 1 (Buổi 1-4)", "focus": "Bổ ngữ kết quả nâng cao, bổ ngữ xu hướng đơn & kép, liên từ nối tiếp"},
            {"stage": "Chặng 2 (Buổi 5-8)", "focus": "Bổ ngữ khả năng V得/不…, cấu trúc 越…越…, so sánh ngang bằng 跟…一样"},
            {"stage": "Chặng 3 (Buổi 9-12)", "focus": "Câu chữ 把, câu bị động 被, 除了…以外, đại từ nghi vấn phiếm chỉ & luyện viết câu"},
        ],
        "sessions": [
            ("周末你有什么打算 - Kế hoạch & Bổ ngữ kết quả 好", ["Đọc chữ Hán không Pinyin", "Bổ ngữ kết quả V+好", "Phủ định nhấn mạnh 一…也/都不"], "Dùng V+好 biểu thị hoàn tất chu đáo sẵn sàng và cấu trúc 一点儿也不 phủ định triệt để.", "V + 好 + 了 | 一 + Lượng từ + (N) + 也/都 + 不/没 + V", [
                ("周末的机票我已经买好了。", "Zhōumò de jīpiào wǒ yǐjīng mǎi hǎo le.", "Vé máy bay cuối tuần tôi đã mua xong xuôi cả rồi."),
                ("我一点儿也不累，不用休息。", "Wǒ yìdiǎnr yě bú lèi, búyòng xiūxi.", "Tôi chẳng mệt chút nào hết, không cần nghỉ ngơi đâu.")
            ], "Giáo trình chuẩn HSK 3 Bài 1"),
            ("他什么时候回来 - Bổ ngữ xu hướng đơn & kép", ["Bổ ngữ xu hướng 来/去", "Vị trí tân ngữ chỉ nơi chốn", "Ghép từ thành câu"], "Quy tắc sống còn: Tân ngữ chỉ ĐỊA ĐIỂM bắt buộc phải kẹp GIỮA động từ xu hướng và 来/去 (回家去, 进教室来).", "V + 上/下/进/出/回/过/起 + 来/去", [
                ("楼下有人叫你，你快下去看看吧。", "Lóuxià yǒu rén jiào nǐ, nǐ kuài xiàqu kànkan ba.", "Dưới lầu có người gọi cậu kìa, cậu mau đi xuống xem thử đi."),
                ("爸爸从北京买回来很多礼物。", "Bàba cóng Běijīng mǎi huílai hěn duō lǐwù.", "Bố mua mang về từ Bắc Kinh rất nhiều quà.")
            ], "Giáo trình chuẩn HSK 3 Bài 2"),
            ("桌子上放着很多饮料 - Câu tồn hiện 着 & Lựa chọn 还是/或者", ["Phân biệt 还是 và 或者", "Câu tồn hiện Địa điểm + V着", "Nghe suy luận ngữ cảnh"], "还是 dùng trong câu hỏi (hoặc mệnh đề nghi vấn phụ), còn 或者 chỉ dùng trong câu trần thuật!", "A + 还是 + B (câu hỏi) | A + 或者 + B (trần thuật)", [
                ("今天晚上我们吃米饭还是吃面条？", "Jīntiān wǎnshang wǒmen chī mǐfàn háishi chī miàntiáo?", "Tối nay chúng mình ăn cơm hay ăn mì?"),
                ("桌子上放着很多水果和饮料。", "Zhuōzi shàng fàngzhe hěn duō shuǐguǒ hé yǐnliào.", "Trên bàn đang bày rất nhiều trái cây và đồ uống.")
            ], "Giáo trình chuẩn HSK 3 Bài 3"),
            ("她总是笑着跟客人说话 - Hai hành động song song & Vừa…vừa…", ["Cấu trúc 又…又…", "Động tác kèm theo V1着V2", "Viết chữ Hán theo Pinyin"], "Dùng 又 Adj1 又 Adj2 chỉ hai tính chất cùng tồn tại và V1着 + V2 chỉ cách thức thực hiện V2.", "又 + Adj1 + 又 + Adj2 | V1 + 着 + V2", [
                ("这个西瓜又大又甜。", "Zhège xīguā yòu dà yòu tián.", "Quả dưa hấu này vừa to vừa ngọt."),
                ("服务员总是笑着跟客人说话。", "Fúwùyuán zǒngshì xiàozhe gēn kèrén shuōhuà.", "Nhân viên phục vụ luôn tươi cười nói chuyện với khách.")
            ], "Giáo trình chuẩn HSK 3 Bài 4"),
            ("我最近越来越胖了 - Cấu trúc tăng tiến 越来越 & 越 A 越 B", ["Cấu trúc 越 A 越 B", "Trợ từ thay đổi trạng thái 了", "Nghe bắt xu hướng biến đổi"], "Khi đã có 越来越 hoặc 越…越… thì tuyệt đối bỏ phó từ chỉ mức độ 很, 非常 đứng trước tính từ.", "越来越 + Adj | 越 + V1 + 越 + V2", [
                ("天气越来越冷了，多穿点儿衣服。", "Tiānqì yuèláiyuè lěng le, duō chuān diǎnr yīfu.", "Thời tiết ngày càng lạnh rồi, mặc thêm chút quần áo vào."),
                ("雨越下越大，我们等一会儿再走。", "Yǔ yuè xià yuè dà, wǒmen děng yíhuìr zài zǒu.", "Mưa càng rơi càng to, tụi mình đợi lát nữa hẵng đi.")
            ], "Giáo trình chuẩn HSK 3 Bài 5"),
            ("怎么突然找不到了 - Bổ ngữ khả năng V + 得/不 + Bổ ngữ", ["Bổ ngữ khả năng", "Phân biệt 刚才 và 刚", "Đọc lướt tìm thông tin"], "Diễn tả điều kiện khách quan cho phép hay ngăn cản đạt kết quả (看得清楚, 听不懂, 买不到, 坐不下).", "Khẳng định: V + 得 + BN | Phủ định: V + 不 + BN", [
                ("眼镜怎么突然找不到了？", "Yǎnjìng zěnme tūrán zhǎo bú dào le?", "Sao mắt kính tự dưng lại tìm không thấy nữa rồi?"),
                ("你说话太快，我听不清楚。", "Nǐ shuōhuà tài kuài, wǒ tīng bù qīngchu.", "Bạn nói nhanh quá, tôi nghe không rõ nổi.")
            ], "Giáo trình chuẩn HSK 3 Bài 6"),
            ("我跟她都认识五年了 - Bổ ngữ thời lượng & Khoảng thời gian", ["Bổ ngữ thời lượng", "Nửa 半 (半个小时 / 一个半小时)", "Biểu đạt hứng thú 对…感兴趣"], "Vị trí khoảng thời gian kéo dài của hành động và sự khác nhau giữa V了… (đã dừng) vs V了…了 (vẫn đang tiếp tục).", "S + V + 了 + Khoảng thời gian + O + (了)", [
                ("我跟她都认识五年了。", "Wǒ gēn tā dōu rènshi wǔ nián le.", "Tôi quen cô ấy đã được 5 năm nay rồi."),
                ("他对音乐特别感兴趣。", "Tā duì yīnyuè tèbié gǎn xìngqù.", "Anh ấy đặc biệt có hứng thú với âm nhạc.")
            ], "Giáo trình chuẩn HSK 3 Bài 7"),
            ("你去哪儿我就去哪儿 - Đại từ nghi vấn lặp lại & Cặp 就 / 才", ["Phân biệt 就 (sớm) vs 才 (muộn)", "Đại từ nghi vấn tương ứng", "Ghép câu HSK 3 Phần Viết"], "Cặp đối lập kinh điển trong đề thi HSK: 就 nhấn mạnh sớm/nhanh/thuận lợi; 才 nhấn mạnh muộn/khó khăn (KHÔNG đi với 了!).", "Thời gian + 就 + V + 了 | Thời gian + 才 + V (không 了)", [
                ("八点上课，他七点半就来了，我八点半才到。", "Bā diǎn shàngkè, tā qī diǎn bàn jiù lái le, wǒ bā diǎn bàn cái dào.", "8 giờ vào học, 7 rưỡi cậu ấy đã tới, còn 8 rưỡi tôi mới đến."),
                ("你去哪儿我就去哪儿。", "Nǐ qù nǎr wǒ jiù qù nǎr.", "Bạn đi đâu thì tôi đi đấy.")
            ], "Giáo trình chuẩn HSK 3 Bài 8"),
            ("她的汉语说得跟中国人一样好 - So sánh ngang bằng 跟…一样", ["So sánh 跟…一样", "Phủ định A 没有 B + Adj", "Luyện nói miêu tả so sánh"], "So sánh bằng nhau với 跟…一样 và so sánh kém hơn bằng A 没有 B + Tính từ.", "A + 跟 + B + 一样 (+ Adj) | A + 没有 + B + (这么/那么) + Adj", [
                ("她的汉语说得跟中国人一样好。", "Tā de Hànyǔ shuō de gēn Zhōngguó rén yíyàng hǎo.", "Tiếng Trung của cô ấy nói chuẩn y như người Trung Quốc."),
                ("今天没有昨天那么冷。", "Jīntiān méiyǒu zuótiān nàme lěng.", "Hôm nay không lạnh đến mức như hôm qua.")
            ], "Giáo trình chuẩn HSK 3 Bài 9"),
            ("把重要的东西放在我这儿吧 - Làm chủ hoàn toàn câu chữ 把", ["Câu chữ 把 + 在/到/给/成", "Quy tắc đặt phủ định trước 把", "Xếp từ thành câu chữ 把"], "Tân ngữ xác định được đẩy lên sau 把 để xử lý dứt điểm vị trí hoặc trạng thái (把书放在桌上, 把苹果吃完).", "S + (没/别/要) + 把 + Tân ngữ + V + 在/到/给/成/Kết quả", [
                ("请把重要的东西放在我这儿吧。", "Qǐng bǎ zhòngyào de dōngxi fàng zài wǒ zhèr ba.", "Hãy để những đồ quan trọng ở chỗ tôi đây này."),
                ("别忘了把空调关了。", "Bié wàng le bǎ kōngtiáo guān le.", "Đừng quên tắt điều hòa đi nhé.")
            ], "Giáo trình chuẩn HSK 3 Bài 10"),
            ("我的护照被你放到哪儿去了 - Câu bị động chữ 被 & 只有…才…", ["Câu bị động chữ 被/叫/让", "Điều kiện duy nhất 只有…才…", "Điều kiện đủ 只要…就…"], "Phân biệt sắc bén cặp điều kiện 只要…就… (chỉ cần… là…) và 只有…才… (chỉ có… mới…).", "Tân ngữ + 被 + (Tác nhân) + V + Thành phần khác", [
                ("我的照相机被弟弟借走了。", "Wǒ de zhàoxiàngjī bèi dìdi jiè zǒu le.", "Máy ảnh của tôi bị em trai mượn mang đi rồi."),
                ("只有多听多练，才能学好汉语。", "Zhǐyǒu duō tīng duō liàn, cái néng xué hǎo Hànyǔ.", "Chỉ có nghe nhiều luyện nhiều mới học giỏi tiếng Trung được.")
            ], "Giáo trình chuẩn HSK 3 Bài 11"),
            ("除了唱歌以外，他还喜欢跳舞 - Cấu trúc 除了…以外 & Tổng duyệt", ["除了…以外，都 / 还 / 也", "Bổ ngữ mức độ cực đại 极了/死了", "Chiến thuật 10 câu Viết HSK 3"], "Phân biệt 除了 A 以外… 还/也 (bao gồm cả A) với 除了 A 以外… 都 (loại trừ A ra).", "除了 + A + 以外，S + 还/也 (gộp) / 都 (trừ)", [
                ("除了英语以外，他还会说法语。", "Chúle Yīngyǔ yǐwài, tā hái huì shuō Fǎyǔ.", "Ngoài tiếng Anh ra, anh ấy còn biết nói cả tiếng Pháp."),
                ("听到这个好消息，大家高兴极了。", "Tīngdào zhège hǎo xiāoxi, dàjiā gāoxìng jíle.", "Nghe thấy tin vui này, mọi người mừng hết cỡ.")
            ], "Giáo trình chuẩn HSK 3 Bài 12"),
        ],
    },
    4: {
        "name": "HSK 4 - Chuẩn Du Học, Đọc Báo Ngắn & Đặt Câu Học Thuật",
        "totalHours": "65 - 80 giờ",
        "targetWords": 600,
        "examFormat": "Nghe (45 câu) + Đọc Điền từ / Sắp xếp câu / Đoạn văn (40 câu) + Viết Xếp câu & Đặt câu theo từ (15 câu) + HSKK Trung cấp",
        "overview": "Làm chủ 1.200 từ tích lũy, xử lý mượt hệ thống liên từ phức hợp (不仅…而且, 既然…就, 无论…都, 尽管…但是), kỹ thuật giải nhanh bài Sắp xếp A-B-C và Viết câu nhìn tranh.",
        "phases": [
            {"stage": "Chặng 1 (Buổi 1-4)", "focus": "Quan hệ tăng tiến, chuyển ngoặt, nhấn mạnh cực đoan 连…都, phó từ ngữ khí"},
            {"stage": "Chặng 2 (Buổi 5-8)", "focus": "Quan hệ giả thiết, nhượng bộ 尽管, điều kiện 无论/不管, suy luận 既然…就"},
            {"stage": "Chặng 3 (Buổi 9-12)", "focus": "Phân biệt từ cận nghĩa HSK 4, kỹ thuật sắp xếp A-B-C & đặt câu ăn trọn 100 điểm Viết"},
        ],
        "sessions": [
            ("简单的爱情 - Tình cảm, Ấn tượng & Tăng tiến 不仅…也/还/而且", ["Nghe hội thoại suy luận", "Liên từ 不仅…而且…", "Phó từ 从来 + Phủ định"], "Nắm vị trí chủ ngữ khi dùng 不仅…而且 và dùng 从来不/没 nhấn mạnh chưa bao giờ từ trước tới nay.", "S + 不仅 + V1，而且 + V2 | 从来 + 不/没 + V", [
                ("他不仅性格幽默，而且特别有责任心。", "Tā bùjǐn xìnggé yōumò, érqiě tèbié yǒu zérènxīn.", "Anh ấy không chỉ tính cách hài hước mà còn cực kỳ có trách nhiệm."),
                ("老张工作很认真，从来没迟到过。", "Lǎo Zhāng gōngzuò hěn rènzhēn, cónglái méi chídào guo.", "Lão Trương làm việc rất nghiêm túc, trước giờ chưa từng đi muộn.")
            ], "Giáo trình chuẩn HSK 4 Bài 1"),
            ("真正的朋友 - Giao tiếp xã hội & Chuyển ngoặt 正好 / 尽管", ["Liên từ nhượng bộ 尽管…但是", "Phó từ trùng hợp 正好", "Đọc điền từ loại"], "Dùng 尽管 nêu một sự thật nhượng bộ ở vế trước, vế sau bắt buộc đi với 但/可是/却 (không đi với 都 như 不管).", "尽管 + Sự thật nhượng bộ，但是/却 + Vế chuyển ngoặt", [
                ("尽管毕业很多年了，我们还是经常联系。", "Jǐnguǎn bìyè hěn duō nián le, wǒmen háishi jīngcháng liánxì.", "Mặc dù đã tốt nghiệp nhiều năm nhưng chúng tôi vẫn thường xuyên liên lạc."),
                ("外面下大雨，我正好带了伞。", "Wàimiàn xià dàyǔ, wǒ zhènghǎo dài le sǎn.", "Ngoài trời mưa to, may quá tôi vừa khéo mang theo ô.")
            ], "Giáo trình chuẩn HSK 4 Bài 2"),
            ("经理对我印象不错 - Phỏng vấn, Công sở & Phân biệt 挺 / 本来", ["Cấu trúc 挺…的", "Phó từ 本来 (vốn dĩ)", "另外 (ngoài ra)"], "Sử dụng 挺 + Adj + 的 trong giao tiếp lịch sự vừa phải và 本来 chỉ kế hoạch/tình trạng ban đầu đã thay đổi.", "挺 + Adj + 的 | 本来 + V1 (nhưng nay đã khác)", [
                ("这次面试，经理对我的印象挺不错的。", "Zhè cì miànshì, jīnglǐ duì wǒ de yìnxiàng tǐng búcuò de.", "Buổi phỏng vấn lần này, ấn tượng của giám đốc về tôi khá tốt."),
                ("我本来打算今天出发，但航班推迟了。", "Wǒ běnlái dǎsuàn jīntiān chūfā, dàn hángbān tuīchí le.", "Tôi vốn định hôm nay xuất phát nhưng chuyến bay bị hoãn rồi.")
            ], "Giáo trình chuẩn HSK 4 Bài 3"),
            ("不要太着急赚钱 - Sự nghiệp, Kinh nghiệm & Suy luận 既然…就", ["Cặp suy luận 既然…就…", "Giới từ 由 (do ai phụ trách)", "甚至 (thậm chí)"], "Phân biệt 既然 (tiền đề hai bên đã biết để rút ra đề nghị/suy luận) với 因为 (nguyên nhân khách quan).", "既然 + Tiền đề đã rõ，就 + Đề nghị/Kết luận", [
                ("既然选择了这个专业，就要坚持学下去。", "Jìrán xuǎnzé le zhège zhuānyè, jiù yào jiānchí xué xiàqu.", "Một khi đã chọn chuyên ngành này thì phải kiên trì học tới cùng."),
                ("这次活动完全由王经理负责。", "Zhè cì huódòng wánquán yóu Wáng jīnglǐ fùzé.", "Hoạt động lần này hoàn toàn do giám đốc Vương phụ trách.")
            ], "Giáo trình chuẩn HSK 4 Bài 4"),
            ("只买对的，不买贵的 - Tiêu dùng thông minh & Nhấn mạnh 连…都", ["Cấu trúc 连…都/也…", "Phân biệt 值得 (đáng giá)", "Sắp xếp mệnh đề A-B-C"], "Kỹ thuật giải bài Sắp xếp A-B-C: tìm cặp từ hô ứng (连…都, 即使…也) để khóa chặt vị trí mệnh đề đầu-cuối.", "连 + Ví dụ cực đoan + S + 都/也 + V", [
                ("质量这么好，价格也不贵，很值得买。", "Zhìliàng zhème hǎo, jiàgé yě bú guì, hěn zhídé mǎi.", "Chất lượng tốt thế này, giá lại không đắt, rất đáng mua."),
                ("他太忙了，连周末都要加班。", "Tā tài máng le, lián zhōumò dōu yào jiābān.", "Anh ấy bận quá, ngay cả cuối tuần cũng phải tăng ca.")
            ], "Giáo trình chuẩn HSK 4 Bài 5"),
            ("一分钱一分货 - Mua bán thương lượng & Càng…càng / Giả thiết 即使…也", ["Giả thiết nhượng bộ 即使…也", "Phó từ 究竟 / 到底", "Luyện đặt câu với động từ"], "Dùng 即使…也… cho giả thiết chưa xảy ra ('cho dù có… đi chăng nữa thì vẫn…').", "即使 + Giả thiết cực đoan，S + 也 + V", [
                ("一分钱一分货，贵有贵的道理。", "Yì fēn qián yì fēn huò, guì yǒu guì de dàolǐ.", "Tiền nào của nấy, đắt có cái lý của đắt."),
                ("即使遇到失败，也不要怀疑自己的能力。", "Jíshǐ yùdào shībài, yě búyào huáiyí zìjǐ de nénglì.", "Cho dù có gặp thất bại cũng đừng nghi ngờ năng lực của bản thân.")
            ], "Giáo trình chuẩn HSK 4 Bài 6"),
            ("最好的医生是自己 - Y tế, Lối sống & Điều kiện 无论 / 不管…都", ["Cấu trúc 无论/不管…都", "Phó từ 却 (đứng sau S)", "Đọc hiểu đoạn văn khoa học"], "Luật bất di bất dịch: sau 无论/不管 phải có yếu tố lựa chọn (A还是B, 多么) hoặc từ nghi vấn!", "无论/不管 + A 还是 B / Từ nghi vấn，S + 都 + V", [
                ("不管工作多忙，每天都要保证充足的睡眠。", "Bùguǎn gōngzuò duō máng, měitiān dōu yào bǎozhèng chōngzú de shuìmián.", "Bất kể công việc bận đến đâu, mỗi ngày đều phải đảm bảo ngủ đủ giấc."),
                ("道理谁都懂，做起来却不容易。", "Dàolǐ shéi dōu dǒng, zuò qǐlai què bù róngyì.", "Đạo lý thì ai cũng hiểu, nhưng bắt tay vào làm lại chẳng dễ.")
            ], "Giáo trình chuẩn HSK 4 Bài 7"),
            ("生活中不缺少美 - Thẩm mỹ, Tâm lý & Giới từ 按照 / 关于 / 对于", ["Phân biệt 关于 vs 对于", "Giới từ 按照 (chiếu theo)", "Kỹ năng nói HSKK Trung cấp"], "关于 nêu phạm vi chủ đề rộng (thường đứng đầu câu có dấu phẩy); 对于 chỉ rõ đối tượng mà thái độ hướng tới.", "关于 + Chủ đề，… | 按照 + Quy định/Kế hoạch + V", [
                ("请按照要求填写这张报名表。", "Qǐng ànzhào yāoqiú tiánxiě zhè zhāng bàomíngbiǎo.", "Vui lòng điền tờ đơn đăng ký này theo đúng yêu cầu."),
                ("生活中并不缺少美，而是缺少发现美的眼睛。", "Shēnghuó zhōng bìng bù quēshǎo měi, érshì quēshǎo fāxiàn měi de yǎnjing.", "Trong cuộc sống vốn không thiếu cái đẹp, mà thiếu đôi mắt phát hiện ra cái đẹp.")
            ], "Giáo trình chuẩn HSK 4 Bài 8"),
            ("阳光总在风雨后 - Vượt khó, Thành công & Cấu trúc 通过 / 经过", ["Phân biệt 通过 vs 经过", "Phó từ 难道 (lẽ nào - phản vấn)", "Viết câu hoàn chỉnh Phần 2"], "通过 nhấn mạnh phương thức/con đường dẫn tới kết quả; 经过 nhấn mạnh quá trình trải qua thời gian/gian khổ.", "难道 + Mệnh đề + 吗？ (phản vấn khẳng/phủ định ngược)", [
                ("通过这次实习，我积累了不少经验。", "Tōngguò zhè cì shíxí, wǒ jīlěi le bù shǎo jīngyàn.", "Thông qua đợt thực tập này, tôi đã tích lũy được kha khá kinh nghiệm."),
                ("这么明显的错误，难道你没看出来吗？", "Zhème míngxiǎn de cuòwù, nándào nǐ méi kàn chūlai ma?", "Lỗi rõ rành rành thế này, lẽ nào cậu không nhìn ra ư?")
            ], "Giáo trình chuẩn HSK 4 Bài 9"),
            ("幸福的标准 - Quan điểm sống & Khung ước lượng 大概 / 恐怕 / 似乎", ["Cấu trúc 恐怕 (e rằng/có lẽ)", "Liên từ 否则 (nếu không thì)", "然而 (tuy nhiên - văn viết)"], "Sử dụng 否则 nối hệ quả xấu nếu không làm theo vế trước và 恐怕 đưa ra dự đoán lịch sự.", "Mệnh đề yêu cầu，否则 + Hệ quả ngược lại", [
                ("快点儿出门吧，否则肯定会堵车。", "Kuài diǎnr chūmén ba, fǒuzé kěndìng huì dǔchē.", "Mau ra khỏi nhà đi, bằng không chắc chắn sẽ tắc đường."),
                ("每个人对幸福的标准都不一样。", "Měi gè rén duì xìngfú de biāozhǔn dōu bù yíyàng.", "Tiêu chuẩn về hạnh phúc của mỗi người đều không giống nhau.")
            ], "Giáo trình chuẩn HSK 4 Bài 10"),
            ("读书好，读好书，好读书 - Văn hóa đọc & Khung 既然 / 以免 / 纷纷", ["Liên từ tránh hậu quả 以免", "Phó từ 纷纷 (lũ lượt/nhao nhao)", "Đọc hiểu suy luận ý chính"], "以免 chỉ đặt ở đầu vế sau ('để tránh khỏi…'), không đứng đầu câu như 为了.", "Hành động phòng ngừa，以免 + Hậu quả không mong muốn", [
                ("出门前检查一下钥匙，以免忘在家里。", "Chūmén qián jiǎnchá yíxià yàoshi, yǐmiǎn wàng zài jiālǐ.", "Trước khi ra ngoài kiểm tra lại chìa khóa để khỏi quên ở nhà."),
                ("养成每天阅读的习惯让人终身受益。", "Yǎngchéng měitiān yuèdú de xíguàn ràng rén zhōngshēn shòuyì.", "Rèn thói quen đọc sách mỗi ngày giúp con người hưởng lợi suốt đời.")
            ], "Giáo trình chuẩn HSK 4 Bài 11"),
            ("用心发现世界 - Khoa học tự nhiên & Chiến thuật Tổng Duyệt HSK 4", ["Cấu trúc 一方面…另一方面", "Phân biệt 究竟 / 到底 / 果然", "Giải đề HSK 4 bấm giờ thực chiến"], "Tổng rà soát 10 mẫu câu ăn điểm phần Viết đặt câu theo tranh và mẹo quét từ khóa bài đọc dài HSK 4.", "一方面 + Khía cạnh 1，另一方面 + Khía cạnh 2", [
                ("结果果然跟专家预测的一模一样。", "Jiéguǒ guǒrán gēn zhuānjiā yùcè de yìmúyíyàng.", "Kết quả quả nhiên giống hệt như chuyên gia dự đoán."),
                ("这既能节约时间，又能提高工作效率。", "Zhè jì néng jiéyuē shíjiān, yòu néng tígāo gōngzuò xiàolǜ.", "Việc này vừa tiết kiệm thời gian vừa nâng cao hiệu suất công việc.")
            ], "Giáo trình chuẩn HSK 4 Bài 12"),
        ],
    },
    5: {
        "name": "HSK 5 - Đọc Báo Chính Thống, Thành Ngữ & Viết Đoạn Văn 80 Chữ",
        "totalHours": "90 - 110 giờ",
        "targetWords": 1300,
        "examFormat": "Nghe (45 câu) + Đọc Cloze dài & Văn bản 4 câu hỏi (45 câu) + Viết đoạn văn 80 chữ dùng 5 từ khóa & Viết theo tranh + HSKK Cao cấp",
        "overview": "Chinh phục kho 2.500 từ tích lũy, phân biệt sắc thái từ đồng nghĩa văn viết (书面语), thành ngữ 4 chữ (成语) và kỹ thuật viết đoạn văn nghị luận/tự sự 80 chữ mạch lạc.",
        "phases": [
            {"stage": "Chặng 1 (Buổi 1-4)", "focus": "Hư từ văn viết (如何, 何必, 反而, 简直), điền từ vào đoạn văn dài (完形填空)"},
            {"stage": "Chặng 2 (Buổi 5-8)", "focus": "Cấu trúc lựa chọn & quyết tâm (与其…不如, 宁可…也不, 非…不可, 何况)"},
            {"stage": "Chặng 3 (Buổi 9-12)", "focus": "Thành ngữ HSK 5 tần suất cao & Công thức viết 2 bài luận 80 chữ Phần 书写"},
        ],
        "sessions": [
            ("爱的细节 - Chi tiết đời sống & Hư từ văn viết 如何 / 靠 / 居然", ["Phó từ bất ngờ 居然/竟然", "Động từ 靠 (dựa vào)", "Đọc điền từ đoạn văn dài"], "Dùng 居然/竟然 nhấn mạnh sự việc hoàn toàn nằm ngoài dự liệu và 靠 chỉ chỗ dựa năng lực.", "S + 居然/竟然 + Kết quả trái dự đoán | 靠 + Năng lực/Đối tượng", [
                ("这么复杂的难题，他居然十分钟就解决了。", "Zhème fùzá de nántí, tā jūrán shí fēnzhōng jiù jiějué le.", "Bài toán hóc búa thế này mà cậu ta lại giải quyết xong chỉ trong 10 phút."),
                ("成功主要靠平时的努力和积累。", "Chénggōng zhǔyào kào píngshí de nǔlì hé jīlěi.", "Thành công chủ yếu dựa vào sự nỗ lực và tích lũy thường ngày.")
            ], "Giáo trình chuẩn HSK 5 Bài 1"),
            ("留串钥匙给父母 - Gia đình hiện đại & Phó từ 简直 / 始终 / 难免", ["Phó từ phóng đại 简直", "始终 (từ đầu chí cuối)", "难免 (khó tránh khỏi)"], "简直 mang sắc thái gần như hoàn toàn ('thật chẳng khác nào…'), thường đi cùng 像, 是, 太…了.", "S + 简直 + 像/是/太…了 | 始终 + (没/不) + V", [
                ("这里的风景美得简直像一幅画。", "Zhèlǐ de fēngjǐng měi de jiǎnzhí xiàng yì fú huà.", "Phong cảnh nơi đây đẹp đến mức cứ như một bức tranh vậy."),
                ("初次尝试新事物，难免会遇到一些挫折。", "Chūcì chángshì xīn shìwù, nánmiǎn huì yùdào yìxiē cuòzhé.", "Lần đầu thử sức cái mới, khó tránh khỏi gặp đôi chút vấp váp.")
            ], "Giáo trình chuẩn HSK 5 Bài 2"),
            ("人生有选择，一切可改变 - Bước ngoặt & Ngược kỳ vọng 反而", ["Phó từ 反而 vs 相反", "Cấu trúc 各自 (mỗi người tự…)", "Nghe bản tin & phỏng vấn"], "Ghi nhớ: 反而 là phó từ đứng SAU chủ ngữ; 相反 có thể đứng độc lập đầu vế câu kèm dấu phẩy.", "不但不/没…，(S) + 反而 + Kết quả ngược lại", [
                ("善意的批评不但不会伤害他，反而能促使他进步。", "Shànyì de pīpíng búdàn bú huì shānghài tā, fǎn'ér néng cùshǐ tā jìnbù.", "Lời phê bình thiện chí chẳng những không làm tổn thương mà trái lại còn thúc đẩy cậu ấy tiến bộ.")
            ], "Giáo trình chuẩn HSK 5 Bài 3"),
            ("子路背米 - Điển tích văn hóa & Lựa chọn 与其 A，不如 B", ["Cấu trúc 与其…不如…", "Đối lập với 宁可…也不…", "Đọc hiểu truyện ngụ ngôn"], "Phân biệt chuẩn xác phương án được chọn trong 与其 A 不如 B (chọn B) và 宁可 A 也不 B (chấp nhận A).", "与其 + Phương án dở (A)，不如 + Phương án hay (B)", [
                ("与其临渊羡鱼，不如退而结网。", "Yǔqí lín yuān xiàn yú, bùrú tuì ér jié wǎng.", "Thà lui về đan lưới còn hơn đứng bên vực thèm cá."),
                ("他宁可自己吃苦，也不愿连累家人。", "Tā nìngkě zìjǐ chīkǔ, yě bú yuàn liánlèi jiārén.", "Ông ấy thà tự mình chịu khổ chứ không muốn làm liên lụy người nhà.")
            ], "Giáo trình chuẩn HSK 5 Bài 4"),
            ("济南的泉水 - Du ký văn học & Giới từ 朝 / 向 / 往 + Bổ ngữ trạng thái", ["Phân biệt 朝 - 向 - 往", "Miêu tả cảnh vật sinh động", "Viết đoạn văn miêu tả tranh"], "朝 chỉ hướng mặt đối diện (không làm bổ ngữ sau V), 向 dùng được cả nghĩa trừu tượng (向他学习), 往 đi với động tác di chuyển.", "朝 + Hướng/Đối tượng + V | 向 + Đối tượng + Học hỏi/Xin lỗi", [
                ("小姑娘朝我挥了挥手，露出了灿烂的笑容。", "Xiǎo gūniang cháo wǒ huī le huī shǒu, lòuchū le cànlàn de xiàoróng.", "Cô bé vẫy tay về phía tôi, nở nụ cười rạng rỡ.")
            ], "Giáo trình chuẩn HSK 5 Bài 5"),
            ("除夕的由来 - Truyền thống & Cấu trúc quyết tâm 非…不可 / 何况", ["Khung bắt buộc 非…不可", "Liên từ bậc thang 何况", "Tích lũy thành ngữ 4 chữ"], "Dùng 非…不可 nhấn mạnh điều kiện bắt buộc và 更何况 để đẩy lập luận lên nấc cao hơn.", "S + 非 + Cụm động từ + 不可 | A，更何况 + B？", [
                ("要彻底掌握这门技术，非下苦功夫不可。", "Yào chèdǐ zhǎngwò zhè mén jìshù, fēi xià kǔ gōngfu bùkě.", "Muốn nắm triệt để kỹ thuật này thì nhất định phải bỏ công khổ luyện."),
                ("专业选手都觉得难，更何况我们业余爱好者呢？", "Zhuānyè xuǎnshǒu dōu juéde nán, gèng hékuàng wǒmen yèyú àihàozhě ne?", "Tuyển thủ chuyên nghiệp còn thấy khó, huống hồ dân nghiệp dư như tụi mình?")
            ], "Giáo trình chuẩn HSK 5 Bài 6"),
            ("成语故事两则 - Thành ngữ HSK 5 trọng tâm & Cấu trúc 幸亏 / 哪怕", ["Phó từ may mắn 幸亏/多亏", "Giả thiết 哪怕…也…", "Đọc nhanh bắt luận điểm"], "哪怕…也… ('dù cho chỉ là… đi nữa thì cũng…') nhấn mạnh giả thiết dù nhỏ nhất vẫn không làm lung lay vế sau.", "哪怕 + Giả thiết nhỏ nhất，S + 也 + V", [
                ("哪怕只有百分之一的希望，我们也要尽百分之百的努力。", "Nǎpà zhǐyǒu bǎifēnzhī yī de xīwàng, wǒmen yě yào jìn bǎifēnzhī bǎi de nǔlì.", "Dù chỉ có 1% hy vọng, chúng ta cũng phải dốc 100% nỗ lực."),
                ("幸亏提前备份了资料，不然损失就大了。", "Xìngkuī tíqián bèifèn le zīliào, bùrán sǔnshī jiù dà le.", "May mà sao lưu tài liệu từ trước, bằng không tổn thất lớn rồi.")
            ], "Giáo trình chuẩn HSK 5 Bài 7"),
            ("朝三暮四与思维转换 - Tư duy phản biện & Khung 在…看来 / 从而", ["Khung quan điểm 在…看来", "Liên từ hệ quả 从而", "Viết bài luận 80 chữ từ 5 từ khóa"], "Công thức vàng nối câu bài viết 80 chữ HSK 5: Mở đầu nêu tình huống → Dùng 从而/因此 dẫn kết quả → Chốt bài học bằng 在我看来.", "在 + Đối tượng + 看来，… | Vế hành động，从而 + Kết quả đạt được", [
                ("企业不断改进生产工艺，从而大幅降低了成本。", "Qǐyè búduàn gǎijìn shēngchǎn gōngyì, cóng'ér dàfú jiāngdī le chéngběn.", "Doanh nghiệp không ngừng cải tiến quy trình sản xuất, từ đó hạ mạnh chi phí.")
            ], "Giáo trình chuẩn HSK 5 Bài 8"),
            ("别样鲁迅 - Chân dung nhân vật & Phó từ 不禁 / 索性 / 偏偏", ["不禁 (không kìm được)", "索性 (chi bằng dứt khoát…)", "偏偏 (cứ trớ trêu thay)"], "Bộ 3 phó từ tâm lý xuất hiện dày đặc trong phần Điền từ (完形填空) của đề thi HSK 5.", "索性 + Hành động dứt khoát | 偏偏 + Sự việc trớ trêu", [
                ("既然睡不着，他索性起来把报告写完了。", "Jìrán shuì bù zháo, tā suǒxìng qǐlai bǎ bàogào xiě wán le.", "Đã không ngủ được, anh ấy dứt khoát dậy viết xong luôn bản báo cáo."),
                ("大家盼着周末晴天，谁知偏偏下起了暴雨。", "Dàjiā pànzhe zhōumò qíngtiān, shéizhī piānpiān xià qǐ le bàoyǔ.", "Mọi người mong cuối tuần nắng đẹp, ai dè trớ trêu thay lại đổ mưa rào.")
            ], "Giáo trình chuẩn HSK 5 Bài 9"),
            ("争论的奇迹 - Khoa học công nghệ & Phân biệt 陆续 / 连续 / 持续", ["陆续 vs 连续 vs 持续", "Giới từ 凭 (dựa vào bằng chứng/năng lực)", "Luyện nói thuyết trình 2 phút"], "陆续 (lần lượt kẻ trước người sau), 连续 (liên tiếp không đứt quãng), 持续 (duy trì kéo dài một trạng thái).", "凭(着) + Bản lĩnh/Giấy tờ + V", [
                ("观众们已经陆续进场了，演出马上开始。", "Guānzhòngmen yǐjīng lùxù jìnchǎng le, yǎnchū mǎshàng kāishǐ.", "Khán giả đã lần lượt vào sân, buổi biểu diễn sắp bắt đầu."),
                ("高温天气已经持续了整整一个星期。", "Gāowēn tiānqì yǐjīng chíxù le zhěngzhěng yí gè xīngqī.", "Thời tiết nắng nóng cao độ đã kéo dài suốt tròn một tuần.")
            ], "Giáo trình chuẩn HSK 5 Bài 10"),
        ],
    },
    6: {
        "name": "HSK 6 - Đỉnh Cao Học Thuật, Bắt Lỗi Câu Sai (病句) & Tóm Tắt Văn Bản",
        "totalHours": "120 - 150 giờ",
        "targetWords": 2500,
        "examFormat": "Nghe học thuật (50 câu) + Đọc Bắt lỗi 病句 / Điền cụm từ đồng nghĩa / Đọc sâu (50 câu) + Viết Tóm tắt bài văn 1.000 chữ còn 400 chữ + HSKK Cao cấp",
        "overview": "Làm chủ toàn bộ 5.000 từ HSK, giải phẫu 8 dạng câu bệnh (病句) kinh điển, phân biệt cụm 4 từ gần nghĩa sát sườn và rèn kỹ năng đọc nhớ - viết tóm tắt 缩写.",
        "phases": [
            {"stage": "Chặng 1 (Buổi 1-4)", "focus": "8 lỗi 病句 kinh điển (thiếu chủ ngữ, lệch cặp liên từ, thừa phủ định, sai trật tự định ngữ)"},
            {"stage": "Chặng 2 (Buổi 5-7)", "focus": "Hư từ học thuật HSK 6 (未免, 无非…而已, 得以, 以便, 固然, 尚且)"},
            {"stage": "Chặng 3 (Buổi 8-10)", "focus": "Phân biệt từ đồng nghĩa sát nghĩa (选词填空) & Kỹ thuật 缩写 tóm tắt 400 chữ"},
        ],
        "sessions": [
            ("吃亏也是一种福 - Triết lý nhân sinh & Bắt lỗi Câu Bệnh (病句) Phần 1", ["Giải phẫu lỗi Thiếu Chủ Ngữ", "Phó từ 未免 (xem ra hơi quá)", "Đọc nhanh 250 chữ/phút"], "Bẫy số 1 của HSK 6: đặt 通过/经过/由于/在…下 đầu câu ở cả 2 vế khiến toàn câu MẤT SẠCH CHỦ NGỮ!", "Sai: 通过这次活动，使我明白了… → Sửa: bỏ 通过 hoặc bỏ 使!", [
                ("通过这次调查，我们发现了问题的根源。", "Tōngguò zhè cì diàochá, wǒmen fāxiàn le wèntí de gēnyuán.", "Thông qua cuộc khảo sát này, chúng tôi đã phát hiện ra nguồn gốc vấn đề."),
                ("他刚来三天，你这样要求他未免太苛刻了。", "Tā gāng lái sān tiān, nǐ zhèyàng yāoqiú tā wèimiǎn tài kēkè le.", "Cậu ấy mới tới 3 ngày, anh yêu cầu thế thì xem ra hơi khắt khe quá.")
            ], "Giáo trình chuẩn HSK 6 Bài 1"),
            ("母亲的账单 - Sắc thái tu từ & Khung 无非 / 不过是 … 而已 / 罢了", ["Cấu trúc 无非…而已", "Lỗi phủ định ba lớp (避免不…)", "Thành ngữ cảm xúc gia đình"], "Bẫy phủ định chồng chéo trong 病句: sau 防止, 避免, 忌, 切勿, 难免…merely tránh dùng thêm 不!", "S + 无非(是) + Mệnh đề + 而已/罢了", [
                ("制定这项制度是为了防止类似事故再次发生。", "Zhìdìng zhè xiàng zhìdù shì wèile fángzhǐ lèisì shìgù zàicì fāshēng.", "Ban hành chế độ này là để ngăn ngừa sự cố tương tự tái diễn (không thêm 不!)."),
                ("我无非是提醒你一下罢了，别往心里去。", "Wǒ wúfēi shì tíxǐng nǐ yíxià bàle, bié wǎng xīnlǐ qù.", "Tôi chẳng qua chỉ nhắc cậu một tiếng thôi, đừng để bụng.")
            ], "Giáo trình chuẩn HSK 6 Bài 2"),
            ("PM2.5与环境治理 - Môi trường, Kinh tế & Cặp 得以 vs 以便", ["Phân biệt 得以 và 以便", "Lỗi 2 mặt vs 1 mặt (能否…关键在于)", "Nghe bản tin kinh tế xã hội"], "Bẫy 病句 hai mặt - một mặt: vế trước có 能否 / 是否 / 成败 (2 chiều) thì vế sau không được chỉ nêu 1 chiều khẳng định!", "Nhờ điều kiện → S + 得以 + V | Hành động + 以便 + Mục đích", [
                ("在救援队的努力下，被困人员终于得以脱险。", "Zài jiùyuánduì de nǔlì xià, bèi kùn rényuán zhōngyú déyǐ tuōxiǎn.", "Nhờ nỗ lực của đội cứu hộ, những người mắc kẹt cuối cùng đã thoát hiểm."),
                ("请提前预约，以便我们为您安排座位。", "Qǐng tíqián yùyuē, yǐbiàn wǒmen wèi nín ānpái zuòwèi.", "Xin vui lòng đặt lịch trước để chúng tôi tiện sắp xếp chỗ ngồi cho quý vị.")
            ], "Giáo trình chuẩn HSK 6 Bài 3"),
            ("历史文物保护 - Nhượng bộ học thuật 固然 … 但/可是 … & 尚且 … 何况", ["Cặp 固然…但…", "Bậc thang 尚且…更何况…", "Điền cụm 4 từ đồng nghĩa"], "固然 thừa nhận một sự thật khách quan ở vế đầu nhưng vế sau chuyển sang nhấn mạnh khía cạnh quan trọng hơn.", "A + 固然 + Đúng，但/不过 + B (trọng tâm hơn)", [
                ("天赋固然重要，但后天的勤奋才是决定性的。", "Tiānfù gùrán zhòngyào, dàn hòutiān de qínfèn cái shì juédìngxìng de.", "Thiên phú dĩ nhiên quan trọng, nhưng sự cần cù rèn luyện về sau mới mang tính quyết định.")
            ], "Giáo trình chuẩn HSK 6 Bài 4"),
            ("人工智能与未来职业 - Công nghệ cao & Phân biệt 鉴于 / 基于 / 至于", ["Giới từ học thuật 鉴于 / 基于", "Cấu trúc 之际 (nhân lúc…)", "Đọc ghép câu văn khuyết"], "鉴于 ('xét thấy tình hình…') mở đầu quyết định hành chính/nghiêm túc; 基于 ('dựa trên nền tảng…') chỉ cơ sở lý luận/dữ liệu.", "鉴于 + Tình hình thực tế，S + Đưa ra quyết định", [
                ("鉴于近期天气恶劣，原定的户外比赛暂时取消。", "Jiànyú jìnqī tiānqì èliè, yuándìng de hùwài bǐsài zànshí qǔxiāo.", "Xét thấy thời tiết gần đây khắc nghiệt, giải đấu ngoài trời dự kiến tạm thời hủy bỏ.")
            ], "Giáo trình chuẩn HSK 6 Bài 5"),
            ("时间管理的艺术 - Hiệu suất & Cấu trúc 反而 / 反倒 / 不妨 / 务必", ["Đề xuất khéo 不妨 (chi bằng thử…)", "Yêu cầu nghiêm ngặt 务必", "Lỗi sai kết hợp Động - Tân"], "不妨 dùng để gợi ý nhẹ nhàng không áp đặt ('cũng chẳng hại gì nếu thử…'); 务必 dùng nhấn mạnh mệnh lệnh bắt buộc.", "你不妨 + V (thử làm xem) | 请务必 + V (nhất định phải)", [
                ("遇到瓶颈时，不妨换一个角度思考问题。", "Yùdào píngjǐng shí, bùfáng huàn yí gè jiǎodù sīkǎo wèntí.", "Khi gặp nút thắt bế tắc, chi bằng thử đổi một góc độ khác để suy ngẫm vấn đề."),
                ("参加考试的考生请务必携带有效证件。", "Cānjiā kǎoshì de kǎoshēng qǐng wùbì xiédài yǒuxiào zhèngjiàn.", "Thí sinh dự thi xin nhất định phải mang theo giấy tờ tùy thân hợp lệ.")
            ], "Giáo trình chuẩn HSK 6 Bài 6"),
            ("中国建筑智慧 - Văn hóa kiến trúc & Khung 甚至 / 乃至 / 以致 vs 以至", ["Phân biệt 以致 (hậu quả xấu) vs 以至", "Liên từ 乃至 (thậm chí cho tới)", "Nghe diễn văn học thuật"], "以致 luôn dẫn ra kết quả TIÊU CỰC do nguyên nhân phía trước gây ra; 以至 chỉ mức độ kéo dài hoặc kết quả tự nhiên.", "Nguyên nhân sai lầm，以致 + Hậu quả đáng tiếc", [
                ("他事先缺乏调查，以致做出了错误的判断。", "Tā shìxiān quēfá diàochá, yǐzhì zuòchū le cuòwù de pànduàn.", "Anh ta thiếu khảo sát từ trước, dẫn đến đưa ra phán đoán sai lầm.")
            ], "Giáo trình chuẩn HSK 6 Bài 7"),
            ("缩写实战与全真冲刺 - Kỹ thuật Viết Tóm Tắt (缩写) & Tổng Duyệt HSK 6", ["Công thức 6 yếu tố bài 缩写", "Đặt tiêu đề chuẩn không mất điểm", "Phản xạ khẩu ngữ HSKK Cao cấp"], "10 phút đọc bài 1.000 chữ: khóa chặt Nhân vật + Bối cảnh + Mâu thuẫn + Cao trào + Kết cục; viết lại khách quan bằng ngôi thứ 3 (CẤM chèn bình luận cá nhân!).", "Ngôi thứ 3 khách quan · 380-420 chữ · Có tiêu đề chính giữa", [
                ("缩写时必须忠实于原文，切忌加入个人议论。", "Suōxiě shí bìxū zhōngshí yú yuánwén, qièjì jiārù gèrén yìlùn.", "Khi viết tóm tắt bắt buộc phải trung thành với nguyên tác, tuyệt đối kỵ chèn bình luận cá nhân.")
            ], "Luyện viết tóm tắt HSK 6 缩写"),
        ],
    },
}


def fetch_yt_videos(query: str) -> list[dict]:
    try:
        url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(query)
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="replace")

        pattern = re.compile(
            r'"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)"\}\]'
        )
        seen = set()
        results = []
        for vid, title in pattern.findall(html):
            if vid in seen:
                continue
            seen.add(vid)
            clean_title = title.replace("\\u0026", "&").replace('\\"', '"')
            results.append(
                {
                    "videoId": vid,
                    "title": clean_title,
                    "url": f"https://www.youtube.com/watch?v={vid}",
                }
            )
            if len(results) >= 3:
                break
        return results
    except Exception as e:
        print("YT fetch warning for", query, ":", e)
        return []


# Gather all unique search queries and fetch in parallel!
all_queries = []
for lv, bp in LEVEL_BLUEPRINTS.items():
    for sess in bp["sessions"]:
        all_queries.append(sess[5])

print(f"Fetching verified YouTube videos for {len(all_queries)} HSK 1-6 sessions in parallel...")
query_to_videos: dict[str, list[dict]] = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    future_map = {pool.submit(fetch_yt_videos, q): q for q in all_queries}
    for fut in concurrent.futures.as_completed(future_map):
        q = future_map[fut]
        query_to_videos[q] = fut.result()

resolved_count = sum(1 for v in query_to_videos.values() if len(v) > 0)
print(f"Resolved real YouTube video IDs for {resolved_count}/{len(all_queries)} sessions!")

# Build final curriculum structure slicing all level vocabulary cleanly across sessions
curriculum_out = {}

for lv in range(1, 7):
    bp = LEVEL_BLUEPRINTS[lv]
    sessions_raw = bp["sessions"]
    lv_words = vocab_by_level[lv]
    n_sess = len(sessions_raw)
    chunk_size = max(1, (len(lv_words) + n_sess - 1) // n_sess)

    built_sessions = []
    for idx, (title, skills, content_desc, formula, examples, yt_query) in enumerate(sessions_raw):
        start_i = idx * chunk_size
        end_i = min(len(lv_words), (idx + 1) * chunk_size) if idx < n_sess - 1 else len(lv_words)
        slice_words = lv_words[start_i:end_i]
        # Take up to 24 core words directly for session preview + pass full word IDs for SRS launch
        word_ids = [w["id"] for w in slice_words]

        study_steps = [
            f"Bước 1 · Khởi động Nghe & Video (12 phút): Bật video bài giảng '{yt_query}' ngay bên dưới, nghe 1 lượt nắm ngữ cảnh rồi nhại to (Shadowing) 3 lần theo tốc độ gốc.",
            f"Bước 2 · Khóa nghĩa Từ vựng bằng Hán Việt (15 phút): Quét {min(len(word_ids), 25)} từ trọng tâm của Buổi {idx + 1}, bấm 'Luyện SRS bộ từ buổi này' cho tới khi không còn thẻ Quên.",
            f"Bước 3 · Khắc sâu mặt chữ Hán (10 phút): Chọn 5 từ nhiều nét nhất trong bảng từ bên dưới, đẩy sang Phòng Tập Viết kẻ tay trên ô chữ Mễ không nhìn bóng mờ.",
            f"Bước 4 · Nạp Ngữ pháp & Đặt câu (10 phút): Nắm chắc khung '{formula}', tự đọc to và viết lại 2 câu ví dụ mẫu bằng chữ Hán.",
            "Bước 5 · Chốt sổ kiểm tra 4 kỹ năng (8 phút): Qua mục Thi Thử làm 1 bài Mini-Test hoặc thu âm nhắc lại câu mẫu trước khi tích Hoàn thành buổi học.",
        ]

        videos = query_to_videos.get(yt_query, [])
        search_fallback = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(yt_query)

        built_sessions.append(
            {
                "id": f"hsk{lv}-s{idx + 1}",
                "sessionNum": idx + 1,
                "level": lv,
                "title": title,
                "skills": skills,
                "content": content_desc,
                "formula": formula,
                "examples": [{"zh": z, "py": p, "vi": v} for (z, p, v) in examples],
                "wordIds": word_ids,
                "studyMethod": study_steps,
                "videos": videos,
                "youtubeSearchUrl": search_fallback,
                "youtubeQuery": yt_query,
            }
        )

    curriculum_out[str(lv)] = {
        "level": lv,
        "name": bp["name"],
        "totalHours": bp["totalHours"],
        "targetWords": len(lv_words),
        "examFormat": bp["examFormat"],
        "overview": bp["overview"],
        "phases": bp["phases"],
        "sessions": built_sessions,
    }

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(curriculum_out, f, ensure_ascii=False, separators=(",", ":"))

print(f"Saved {OUT_PATH} ({os.path.getsize(OUT_PATH)//1024} KB)")
