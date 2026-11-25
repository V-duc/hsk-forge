import { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  ExternalLink,
  GraduationCap,
  Layers,
  ListChecks,
  PenTool,
  PlayCircle,
  Sparkles,
  Video,
  Volume2,
} from 'lucide-react';
import { speakChinese } from '../lib/speech';
import { parseMeaningAndMeasureWords } from '../lib/srs';
import type {
  CurriculumLevel,
  HskLevel,
  LevelFilter,
  SrsRecord,
  VocabItem,
} from '../types';

interface RoadmapViewProps {
  curriculum: Record<string, CurriculumLevel>;
  vocab: VocabItem[];
  selectedLevel: LevelFilter;
  srsMap: Record<number, SrsRecord>;
  completedSessions: string[];
  checkedSessionSteps: Record<string, number[]>;
  speechRate: number;
  onChangeLevel: (lv: HskLevel) => void;
  onToggleCompleteSession: (sessionId: string) => void;
  onToggleSessionStep: (sessionId: string, stepIdx: number) => void;
  onStudySessionFlashcards: (label: string, wordIds: number[]) => void;
  onOpenStrokeLab: (word: string) => void;
  onStartLevelExam: (lv: HskLevel) => void;
}

export function RoadmapView({
  curriculum,
  vocab,
  selectedLevel,
  srsMap,
  completedSessions,
  checkedSessionSteps,
  speechRate,
  onChangeLevel,
  onToggleCompleteSession,
  onToggleSessionStep,
  onStudySessionFlashcards,
  onOpenStrokeLab,
  onStartLevelExam,
}: RoadmapViewProps) {
  const activeLevel: HskLevel = selectedLevel === 'all' ? 1 : selectedLevel;
  const levelData = curriculum[String(activeLevel)];

  const [selectedSessionIdx, setSelectedSessionIdx] = useState(0);
  const [embeddedVideoId, setEmbeddedVideoId] = useState<string | null>(null);
  const [showAllSessionWords, setShowAllSessionWords] = useState(false);

  const vocabMap = useMemo(() => {
    const m = new Map<number, VocabItem>();
    for (const w of vocab) m.set(w.id, w);
    return m;
  }, [vocab]);

  if (!levelData) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-[#0E1017] p-8 text-center text-sm text-zinc-400">
        Đang tải lộ trình học chi tiết...
      </div>
    );
  }

  const sessions = levelData.sessions;
  const safeIdx = Math.min(selectedSessionIdx, Math.max(0, sessions.length - 1));
  const currentSession = sessions[safeIdx];

  const completedInLevel = sessions.filter((s) => completedSessions.includes(s.id)).length;
  const progressPct = Math.round((completedInLevel / Math.max(1, sessions.length)) * 100);

  const sessionWords = currentSession.wordIds
    .map((id) => vocabMap.get(id))
    .filter((w): w is VocabItem => Boolean(w));

  const displayedWords = showAllSessionWords ? sessionWords : sessionWords.slice(0, 18);
  const checkedSteps = checkedSessionSteps[currentSession.id] ?? [];
  const isSessionDone = completedSessions.includes(currentSession.id);

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Level Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3, 4, 5, 6] as HskLevel[]).map((lv) => {
            const lvCurr = curriculum[String(lv)];
            const doneCnt = lvCurr
              ? lvCurr.sessions.filter((s) => completedSessions.includes(s.id)).length
              : 0;
            const totalCnt = lvCurr?.sessions.length ?? 0;
            const active = activeLevel === lv;
            return (
              <button
                key={lv}
                onClick={() => {
                  onChangeLevel(lv);
                  setSelectedSessionIdx(0);
                  setEmbeddedVideoId(null);
                  setShowAllSessionWords(false);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
                  active
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/25'
                    : 'bg-[#0E1017] text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                <span>Lộ trình HSK {lv}</span>
                <span
                  className={`px-1.5 py-0.5 rounded font-mono-code text-[10px] ${
                    active ? 'bg-black/25 text-white' : 'bg-zinc-900 text-zinc-400'
                  }`}
                >
                  {doneCnt}/{totalCnt}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onStartLevelExam(activeLevel)}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <GraduationCap className="w-4 h-4" />
          Thi mô phỏng đủ 4 kỹ năng HSK {activeLevel}
        </button>
      </div>

      {/* Master Level Roadmap Overview */}
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-[#121521] to-[#0C0E14] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-rose-400">
              <Compass className="w-4 h-4" />
              BẢN ĐỒ LỘ TRÌNH TOÀN CẤP ĐỘ
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">{levelData.name}</h2>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{levelData.overview}</p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0 text-xs">
            <div className="rounded-xl bg-zinc-950/90 border border-zinc-800 px-3.5 py-2.5">
              <div className="text-zinc-500">Thời lượng chuẩn</div>
              <div className="font-mono-code font-bold text-white mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                {levelData.totalHours}
              </div>
            </div>
            <div className="rounded-xl bg-zinc-950/90 border border-zinc-800 px-3.5 py-2.5">
              <div className="text-zinc-500">Từ vựng cấp này</div>
              <div className="font-mono-code font-bold text-emerald-400 mt-0.5">
                +{levelData.targetWords} từ mới
              </div>
            </div>
            <div className="rounded-xl bg-zinc-950/90 border border-zinc-800 px-3.5 py-2.5">
              <div className="text-zinc-500">Tiến độ buổi học</div>
              <div className="font-mono-code font-bold text-rose-400 mt-0.5">
                {completedInLevel}/{sessions.length} buổi ({progressPct}%)
              </div>
            </div>
          </div>
        </div>

        {/* 3 Stage Milestones */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {levelData.phases.map((ph, idx) => (
            <div
              key={idx}
              className="rounded-xl bg-zinc-950/75 border border-zinc-800/90 p-3.5 space-y-1"
            >
              <div className="text-xs font-extrabold text-amber-300">{ph.stage}</div>
              <p className="text-xs text-zinc-400 leading-relaxed">{ph.focus}</p>
            </div>
          ))}
        </div>

        <div className="text-xs text-zinc-400 bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5">
          <strong className="text-zinc-200">Cấu trúc bài thi đầu ra: </strong>
          {levelData.examFormat}
        </div>
      </div>

      {/* Main Split: Left Session Selector | Right Detailed Daily Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Session List */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-800 bg-[#0E1017] p-4 space-y-2 max-h-[750px] overflow-y-auto">
          <div className="px-2 py-1 text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
            <span>Danh sách {sessions.length} buổi học</span>
            <span className="font-mono-code text-emerald-400">{completedInLevel} xong</span>
          </div>

          {sessions.map((s, idx) => {
            const active = idx === safeIdx;
            const done = completedSessions.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedSessionIdx(idx);
                  setEmbeddedVideoId(null);
                  setShowAllSessionWords(false);
                }}
                className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-3 cursor-pointer ${
                  active
                    ? 'bg-rose-600/15 border-rose-500/50 text-white'
                    : 'bg-zinc-950/70 hover:bg-zinc-900 border-zinc-800/80 text-zinc-300'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Circle className={`w-4 h-4 ${active ? 'text-rose-400' : 'text-zinc-600'}`} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono-code font-bold text-rose-400">
                      BUỔI {s.sessionNum}
                    </span>
                    <span className="text-[10px] font-mono-code text-zinc-500">
                      {s.wordIds.length} từ
                    </span>
                  </div>
                  <div className="text-xs font-bold font-hanzi truncate mt-0.5">{s.title}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Column: Detailed Session Blueprint ("Buổi hôm đấy") */}
        <div className="lg:col-span-8 space-y-5">
          {/* 1. Header + Skills + Complete Toggle */}
          <div className="rounded-2xl border border-zinc-800 bg-[#0E1017] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-mono-code font-bold text-rose-400">
                  GIÁO ÁN CHI TIẾT · HSK {activeLevel} · BUỔI {currentSession.sessionNum}/{sessions.length}
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white font-hanzi mt-1">
                  {currentSession.title}
                </h3>
              </div>

              <button
                onClick={() => onToggleCompleteSession(currentSession.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  isSessionDone
                    ? 'bg-emerald-600 text-white shadow shadow-emerald-600/25'
                    : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSessionDone ? 'Đã hoàn thành buổi này' : 'Đánh dấu hoàn thành buổi'}
              </button>
            </div>

            {/* Skills trained today */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                1. Kỹ năng rèn luyện trong buổi hôm nay
              </div>
              <div className="flex flex-wrap gap-2">
                {currentSession.skills.map((sk, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold"
                  >
                    ✓ {sk}
                  </span>
                ))}
              </div>
            </div>

            {/* Core Content & Grammar */}
            <div className="space-y-3 pt-3 border-t border-zinc-800/80">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-rose-400" />
                2. Nội dung trọng tâm & Ngữ pháp cốt lõi
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed">{currentSession.content}</p>

              <div className="rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-3 font-mono-code text-xs sm:text-sm text-amber-300">
                Mẫu cấu trúc: {currentSession.formula}
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {currentSession.examples.map((ex, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-3.5 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="font-hanzi text-base font-bold text-white">{ex.zh}</div>
                      <div className="text-xs text-amber-300">{ex.py}</div>
                      <div className="text-xs text-zinc-400">{ex.vi}</div>
                    </div>
                    <button
                      onClick={() => speakChinese(ex.zh, speechRate)}
                      className="p-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-rose-400 shrink-0 cursor-pointer"
                      title="Nghe câu mẫu"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. YouTube Video Lectures for Today's Session */}
          <div className="rounded-2xl border border-zinc-800 bg-[#0E1017] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Video className="w-4 h-4 text-red-500" />
                3. Video YouTube bài giảng cho buổi hôm nay
              </div>
              <a
                href={currentSession.youtubeSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                Tìm thêm video "{currentSession.youtubeQuery}"
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {embeddedVideoId && (
              <div className="rounded-xl overflow-hidden border border-zinc-700 bg-black aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${embeddedVideoId}?autoplay=1`}
                  title="HSK YouTube Lesson"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            )}

            {currentSession.videos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {currentSession.videos.map((vid) => {
                  const playing = embeddedVideoId === vid.videoId;
                  return (
                    <div
                      key={vid.videoId}
                      className={`rounded-xl border overflow-hidden flex flex-col justify-between transition ${
                        playing
                          ? 'border-rose-500 bg-rose-950/20'
                          : 'border-zinc-800 bg-zinc-950/80 hover:border-zinc-700'
                      }`}
                    >
                      <div>
                        <div
                          onClick={() => setEmbeddedVideoId(playing ? null : vid.videoId)}
                          className="relative aspect-video bg-zinc-900 cursor-pointer group overflow-hidden"
                        >
                          <img
                            src={`https://i.ytimg.com/vi/${vid.videoId}/mqdefault.jpg`}
                            alt={vid.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/25 transition">
                            <PlayCircle className="w-10 h-10 text-white drop-shadow" />
                          </div>
                        </div>
                        <p className="p-3 text-xs font-semibold text-zinc-200 line-clamp-2 leading-snug">
                          {vid.title}
                        </p>
                      </div>

                      <div className="px-3 pb-3 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setEmbeddedVideoId(playing ? null : vid.videoId)}
                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          {playing ? 'Đóng trình phát' : 'Xem tại chỗ'}
                        </button>
                        <a
                          href={vid.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
                        >
                          Mở YouTube
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 flex items-center justify-between">
                <span className="text-xs text-zinc-300">
                  Mở danh sách bài giảng YouTube chuẩn cho <strong>{currentSession.youtubeQuery}</strong>:
                </span>
                <a
                  href={currentSession.youtubeSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Video className="w-4 h-4" />
                  Xem trên YouTube
                </a>
              </div>
            )}
          </div>

          {/* 4. Step-by-Step Study Method for Today */}
          <div className="rounded-2xl border border-zinc-800 bg-[#0E1017] p-5 sm:p-6 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <ListChecks className="w-4 h-4 text-emerald-400" />
              4. Quy trình cách học chuẩn cho buổi hôm nay (55 phút)
            </div>
            <div className="space-y-2">
              {currentSession.studyMethod.map((step, idx) => {
                const done = checkedSteps.includes(idx);
                return (
                  <div
                    key={idx}
                    onClick={() => onToggleSessionStep(currentSession.id, idx)}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                      done
                        ? 'bg-emerald-950/20 border-emerald-700/40 text-zinc-400 line-through'
                        : 'bg-zinc-950/80 hover:bg-zinc-900 border-zinc-800 text-zinc-200'
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                    )}
                    <span className="text-xs leading-relaxed">{step}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Vocabulary Assigned to Today's Session */}
          <div className="rounded-2xl border border-zinc-800 bg-[#0E1017] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  5. Danh mục Từ vựng của buổi hôm nay ({sessionWords.length} từ)
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Bấm vào loa để nghe, bấm Tập viết để kẻ nét chữ, hoặc nạp nguyên gói vào SRS Flashcard.
                </p>
              </div>

              <button
                onClick={() =>
                  onStudySessionFlashcards(
                    `HSK ${activeLevel} · Buổi ${currentSession.sessionNum}`,
                    currentSession.wordIds
                  )
                }
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                Học Flashcard riêng bộ từ buổi này ({sessionWords.length} từ)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {displayedWords.map((w) => {
                const { cleanVi } = parseMeaningAndMeasureWords(w.vi);
                const learned = Boolean(srsMap[w.id]);
                return (
                  <div
                    key={w.id}
                    className="rounded-xl bg-zinc-950/90 border border-zinc-800 p-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-hanzi text-xl font-bold text-white">{w.h}</span>
                        <span className="text-xs font-semibold text-amber-300">{w.p}</span>
                        {w.hv && (
                          <span className="text-[10px] font-bold uppercase text-indigo-400">
                            [{w.hv}]
                          </span>
                        )}
                        {learned && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" title="Đã học SRS" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{cleanVi}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => speakChinese(w.h, speechRate)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-rose-400 cursor-pointer"
                        title="Nghe phát âm"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onOpenStrokeLab(w.h)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-sky-400 cursor-pointer"
                        title="Luyện viết chữ này"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {sessionWords.length > 18 && (
              <button
                onClick={() => setShowAllSessionWords((v) => !v)}
                className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 cursor-pointer"
              >
                {showAllSessionWords
                  ? 'Thu gọn danh sách từ'
                  : `Xem toàn bộ ${sessionWords.length} từ của buổi này`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
