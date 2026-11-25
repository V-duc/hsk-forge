import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookMarked,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  GraduationCap,
  PenTool,
  RotateCcw,
  Target,
} from 'lucide-react';
import { computeStreak, getTodayKey, isMastered } from '../lib/srs';
import type { HskLevel, LevelFilter, NavTab, UserStore, VocabItem } from '../types';

interface DashboardViewProps {
  vocab: VocabItem[];
  store: UserStore;
  onSelectLevelAndNavigate: (level: LevelFilter, tab: NavTab) => void;
  onStartWrongWordsReview: () => void;
  onUpdateDailyGoal: (goal: number) => void;
  onResetProgress: () => void;
}

const LEVEL_META: Record<HskLevel, { badge: string; desc: string; color: string }> = {
  1: { badge: 'Sơ cấp 1 · 15 buổi', desc: 'Phát âm Pinyin, biến điệu, 150 từ giao tiếp sống còn & nét cơ bản', color: 'from-emerald-500 to-teal-500' },
  2: { badge: 'Sơ cấp 2 · 12 buổi', desc: 'Hội thoại trực tiếp, câu so sánh 比, bổ ngữ kết quả, trợ từ 着/过', color: 'from-cyan-500 to-sky-500' },
  3: { badge: 'Trung cấp 1 · 12 buổi', desc: 'Đọc không Pinyin, câu chữ 把, câu bị động 被, viết câu chữ Hán', color: 'from-blue-500 to-indigo-500' },
  4: { badge: 'Trung cấp 2 · 12 buổi', desc: 'Liên từ phức hợp, xếp câu A-B-C, đặt câu học thuật & chuẩn du học', color: 'from-amber-500 to-orange-500' },
  5: { badge: 'Cao cấp 1 · 10 buổi', desc: 'Đọc báo chí, thành ngữ 4 chữ, phân biệt hư từ & viết luận 80 chữ', color: 'from-rose-500 to-pink-600' },
  6: { badge: 'Cao cấp 2 · 8 buổi', desc: 'Bắt lỗi câu bệnh 病句, cụm từ đồng nghĩa sát sườn & viết tóm tắt 缩写', color: 'from-purple-500 to-fuchsia-600' },
};

export function DashboardView({
  vocab,
  store,
  onSelectLevelAndNavigate,
  onStartWrongWordsReview,
  onUpdateDailyGoal,
  onResetProgress,
}: DashboardViewProps) {
  const now = Date.now();
  const todayKey = getTodayKey();
  const todayDone = store.dailyCount[todayKey] ?? 0;
  const streak = computeStreak(store.dailyCount);

  const srsValues = Object.values(store.srs);
  const dueTotal = srsValues.filter((r) => r.nextReview <= now).length;
  const masteredTotal = srsValues.filter((r) => isMastered(r)).length;
  const learningTotal = srsValues.length - masteredTotal;
  const hardWordsCount = srsValues.filter((r) => r.lapses > 0).length;

  const levels: HskLevel[] = [1, 2, 3, 4, 5, 6];

  return (
    <div className="space-y-8 pb-20 lg:pb-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-[#12141E] via-[#0E1017] to-[#1A0D14] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-6 -top-8 font-hanzi text-[150px] font-black text-rose-500/[0.05] select-none leading-none">
          汉语
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold">
              <span>Giáo án từng buổi kèm Video YouTube + Phòng thi máy đủ 4 kỹ năng</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Hệ sinh thái học & luyện thi <span className="text-rose-500">HSK 1-6</span> thực chiến
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Mỗi buổi học chia sẵn kỹ năng trọng tâm, bài giảng YouTube tại chỗ, quy trình 5 bước, bộ từ Hán Việt riêng cho buổi đó và phòng thi mô phỏng đủ Nghe · Đọc · Viết · Khẩu ngữ HSKK.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              onClick={() => onSelectLevelAndNavigate(1, 'roadmap')}
              className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-rose-600/25 transition cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              Mở Lộ trình Buổi học hôm nay
            </button>
            <button
              onClick={() => onSelectLevelAndNavigate('all', 'exam')}
              className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 font-bold text-sm flex items-center gap-2 transition cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-amber-400" />
              Thi mô phỏng 4 kỹ năng
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800/90 bg-[#0E1017] p-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Đến hạn ôn (SRS)</p>
            <p className="text-2xl font-extrabold font-mono-code text-rose-400 mt-1">{dueTotal}</p>
            <p className="text-xs text-zinc-500 mt-1">Đang theo học: {learningTotal} từ</p>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/90 bg-[#0E1017] p-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Buổi học hoàn tất</p>
            <p className="text-2xl font-extrabold font-mono-code text-emerald-400 mt-1">
              {store.completedSessions.length}/69
            </p>
            <p className="text-xs text-zinc-500 mt-1">Thuộc vững: {masteredTotal} từ</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/90 bg-[#0E1017] p-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Chuỗi ngày liên tiếp</p>
            <p className="text-2xl font-extrabold font-mono-code text-amber-400 mt-1">{streak} ngày</p>
            <p className="text-xs text-zinc-500 mt-1">Hôm nay đã lật: {todayDone} lượt</p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/90 bg-[#0E1017] p-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Mục tiêu hàng ngày</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-extrabold font-mono-code text-sky-400">
                {todayDone}/{store.dailyGoal}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              {[20, 30, 50, 100].map((g) => (
                <button
                  key={g}
                  onClick={() => onUpdateDailyGoal(g)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono-code rounded cursor-pointer ${
                    store.dailyGoal === g
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400">
            <Target className="w-5 h-5" />
          </div>
        </div>
      </div>

      {hardWordsCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-sm font-bold text-amber-200">
                Phát hiện {hardWordsCount} từ hay quên / trả lời sai trong đề thi
              </div>
              <p className="text-xs text-zinc-400">
                Quét sạch danh sách từ yếu trước khi mở thêm buổi học mới.
              </p>
            </div>
          </div>
          <button
            onClick={onStartWrongWordsReview}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            Ôn từ yếu ngay
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 6 HSK Level Roadmaps */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-rose-500" />
            Chọn cấp độ để vào Lộ trình Buổi học hoặc Thi thử
          </h2>
          <button
            onClick={() => onSelectLevelAndNavigate('all', 'writing')}
            className="text-xs font-semibold text-zinc-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
          >
            <PenTool className="w-3.5 h-3.5" />
            Mở phòng luyện viết chữ Hán
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {levels.map((lv) => {
            const levelWords = vocab.filter((w) => w.l === lv);
            const total = levelWords.length;
            let seen = 0;
            let mastered = 0;
            let due = 0;
            for (const w of levelWords) {
              const rec = store.srs[w.id];
              if (rec) {
                seen += 1;
                if (isMastered(rec)) mastered += 1;
                if (rec.nextReview <= now) due += 1;
              }
            }
            const pct = total > 0 ? Math.round((seen / total) * 100) : 0;
            const meta = LEVEL_META[lv];

            return (
              <div
                key={lv}
                className="rounded-xl border border-zinc-800/90 bg-[#0E1017] hover:border-zinc-700 transition p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-black text-white bg-gradient-to-r ${meta.color}`}
                      >
                        HSK {lv}
                      </span>
                      <span className="text-xs font-semibold text-zinc-400">{meta.badge}</span>
                    </div>
                    <span className="font-mono-code text-xs text-zinc-400">{total} từ</span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed min-h-[36px]">{meta.desc}</p>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono-code">
                      <span className="text-zinc-400">
                        Đã học: <strong className="text-zinc-200">{seen}</strong> ({pct}%)
                      </span>
                      <span className="text-emerald-400">Thuộc vững: {mastered}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                      <div
                        className={`h-full bg-gradient-to-r ${meta.color} transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-zinc-800/70">
                  <button
                    onClick={() => onSelectLevelAndNavigate(lv, 'roadmap')}
                    className="py-2 px-2 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-xs font-bold text-rose-300 transition cursor-pointer"
                  >
                    Lộ trình
                  </button>
                  <button
                    onClick={() => onSelectLevelAndNavigate(lv, 'flashcards')}
                    className="py-2 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 transition cursor-pointer"
                  >
                    SRS {due > 0 ? `(${due})` : ''}
                  </button>
                  <button
                    onClick={() => onSelectLevelAndNavigate(lv, 'exam')}
                    className="py-2 px-2 rounded-lg bg-zinc-900 hover:bg-amber-500/15 hover:text-amber-300 border border-zinc-800 text-xs font-semibold text-zinc-200 transition cursor-pointer"
                  >
                    Thi 4 KN
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Exam Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-[#0E1017] p-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-amber-400" />
            Lịch sử thi mô phỏng gần đây
          </h3>

          {store.examHistory.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
              Chưa có bài thi nào. Bấm "Thi mô phỏng 4 kỹ năng" để làm bài kiểm tra đầu tiên!
            </div>
          ) : (
            <div className="space-y-2.5">
              {store.examHistory.slice(0, 6).map((ex) => {
                const maxScore = ex.maxScaledScore ?? 300;
                const passed = ex.scaledScore >= maxScore * 0.6;
                return (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded font-mono-code font-bold ${
                          passed
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {ex.scaledScore}/{maxScore}
                      </span>
                      <div>
                        <div className="font-semibold text-zinc-200">
                          {ex.level === 'all' ? 'Tổng hợp HSK 1-6' : `Đề HSK ${ex.level}`} ({ex.mode})
                        </div>
                        <div className="text-zinc-500">
                          Đạt {ex.score}/{ex.total} mục · {ex.durationSec}s
                          {ex.skillScores ? ` · HSKK ${ex.skillScores.speaking}/100` : ''}
                        </div>
                      </div>
                    </div>
                    <span className="text-zinc-500 font-mono-code">
                      {new Date(ex.date).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-[#0E1017] p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-2">Phím tắt tốc độ</h3>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li className="flex justify-between">
                <span>Lật thẻ Flashcard</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-mono-code text-zinc-200">
                  Space
                </kbd>
              </li>
              <li className="flex justify-between">
                <span>Chấm mức nhớ SM-2</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-mono-code text-zinc-200">
                  1 - 4
                </kbd>
              </li>
              <li className="flex justify-between">
                <span>Nghe lại phát âm chuẩn</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-mono-code text-zinc-200">
                  R
                </kbd>
              </li>
              <li className="flex justify-between">
                <span>Ẩn / hiện gợi ý Pinyin</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-mono-code text-zinc-200">
                  P
                </kbd>
              </li>
            </ul>
          </div>

          <div className="pt-5 mt-5 border-t border-zinc-800/80">
            <button
              onClick={() => {
                if (window.confirm('Xóa toàn bộ lịch sử SRS, tiến độ buổi học và điểm thi trên trình duyệt này?')) {
                  onResetProgress();
                }
              }}
              className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-rose-950/50 border border-zinc-800 hover:border-rose-700/50 text-xs text-zinc-400 hover:text-rose-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Xóa trắng dữ liệu học
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
