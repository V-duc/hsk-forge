import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Headphones,
  Layers,
  Mic,
  PenTool,
  Play,
  RotateCcw,
  Square,
  Volume2,
  XCircle,
} from 'lucide-react';
import {
  LISTENING_DIALOGUES,
  READING_SEEDS,
  SPEAKING_SEEDS,
  WRITING_SEEDS,
  type ListeningDialogueSeed,
  type ReadingClozeOrOrderSeed,
  type SpeakingSeed,
  type WritingSeed,
} from '../data/examBank';
import { speakChinese, speakDialogue, stopSpeech } from '../lib/speech';
import { parseMeaningAndMeasureWords } from '../lib/srs';
import type {
  ExamHistoryItem,
  ExamMode,
  HskLevel,
  LevelFilter,
  SkillScores,
  VocabItem,
} from '../types';

interface ExamViewProps {
  vocab: VocabItem[];
  selectedLevel: LevelFilter;
  speechRate: number;
  onSaveExamResult: (result: ExamHistoryItem) => void;
  onPushWrongToSrs: (wordIds: number[]) => void;
}

type SkillSection = 'listening' | 'reading' | 'writing' | 'speaking';

type SimItem =
  | {
      uid: string;
      section: 'listening';
      kind: 'listen_tf';
      word: VocabItem;
      displayedMeaning: string;
      isTrue: boolean;
    }
  | {
      uid: string;
      section: 'listening';
      kind: 'listen_dialogue';
      seed: ListeningDialogueSeed;
    }
  | {
      uid: string;
      section: 'listening';
      kind: 'listen_vocab';
      target: VocabItem;
      options: VocabItem[];
    }
  | {
      uid: string;
      section: 'reading';
      kind: 'read_seed';
      seed: ReadingClozeOrOrderSeed;
    }
  | {
      uid: string;
      section: 'reading';
      kind: 'read_vocab';
      target: VocabItem;
      options: VocabItem[];
    }
  | {
      uid: string;
      section: 'writing';
      kind: 'write_seed';
      seed: WritingSeed;
      shuffledTokens?: string[];
    }
  | {
      uid: string;
      section: 'writing';
      kind: 'write_dictation';
      target: VocabItem;
    }
  | {
      uid: string;
      section: 'speaking';
      kind: 'speak_seed';
      seed: SpeakingSeed;
    };

interface UserResponse {
  choiceIdx?: number; // for MCQ / TF (1 = True, 0 = False)
  textValue?: string; // for writing assemble / input / compose
  spokenTranscript?: string;
  speakingScorePct?: number; // 0..100
  audioUrl?: string;
}

// Browser SpeechRecognition typing
interface SpeechRecInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecInstance) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecInstance;
    webkitSpeechRecognition?: new () => SpeechRecInstance;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeHanziOnly(str: string): string {
  return Array.from(str)
    .filter((c) => c >= '\u4e00' && c <= '\u9fff')
    .join('');
}

function computeCharOverlapScore(expectedZh: string, actualZh: string): number {
  const exp = normalizeHanziOnly(expectedZh);
  const act = normalizeHanziOnly(actualZh);
  if (!exp || !act) return 0;
  let matched = 0;
  const remaining = Array.from(act);
  for (const ch of exp) {
    const idx = remaining.indexOf(ch);
    if (idx !== -1) {
      matched += 1;
      remaining.splice(idx, 1);
    }
  }
  return Math.min(100, Math.round((matched / exp.length) * 100));
}

function evaluateItem(item: SimItem, resp: UserResponse | undefined): { points: number; maxPoints: number; wrongWordId?: number } {
  const maxPoints = 100;
  if (!resp) {
    const wid =
      item.kind === 'listen_tf'
        ? item.word.id
        : item.kind === 'listen_vocab' || item.kind === 'read_vocab' || item.kind === 'write_dictation'
          ? item.target.id
          : undefined;
    return { points: 0, maxPoints, wrongWordId: wid };
  }

  if (item.kind === 'listen_tf') {
    const expected = item.isTrue ? 1 : 0;
    const ok = resp.choiceIdx === expected;
    return { points: ok ? 100 : 0, maxPoints, wrongWordId: ok ? undefined : item.word.id };
  }

  if (item.kind === 'listen_dialogue' || item.kind === 'read_seed') {
    const ok = resp.choiceIdx === item.seed.correctIdx;
    return { points: ok ? 100 : 0, maxPoints };
  }

  if (item.kind === 'listen_vocab' || item.kind === 'read_vocab') {
    const chosen = item.options[resp.choiceIdx ?? -1];
    const ok = chosen?.id === item.target.id;
    return { points: ok ? 100 : 0, maxPoints, wrongWordId: ok ? undefined : item.target.id };
  }

  if (item.kind === 'write_dictation') {
    const clean = (resp.textValue ?? '').trim();
    const ok = clean === item.target.h;
    return { points: ok ? 100 : 0, maxPoints, wrongWordId: ok ? undefined : item.target.id };
  }

  if (item.kind === 'write_seed') {
    const val = (resp.textValue ?? '').trim();
    if (!val) return { points: 0, maxPoints };

    if (item.seed.subtype === 'scramble' || item.seed.subtype === 'pinyin_fill') {
      const ok = normalizeHanziOnly(val) === normalizeHanziOnly(item.seed.answerZh);
      return { points: ok ? 100 : 0, maxPoints };
    }

    // keyword_compose grading
    const kws = item.seed.keywords ?? [];
    const hitCount = kws.filter((kw) => val.includes(kw)).length;
    const hanziLen = normalizeHanziOnly(val).length;
    const minLen = item.seed.level >= 5 ? 22 : 10;
    const kwRatio = kws.length > 0 ? hitCount / kws.length : 1;
    const lenRatio = Math.min(1, hanziLen / minLen);
    const hasPunct = /[。！？!?]/.test(val) ? 0.1 : 0;
    const score = Math.min(100, Math.round((kwRatio * 0.65 + lenRatio * 0.25 + hasPunct) * 100));
    return { points: score, maxPoints };
  }

  // speak_seed
  if (typeof resp.speakingScorePct === 'number') {
    return { points: resp.speakingScorePct, maxPoints };
  }
  return { points: 0, maxPoints };
}

const SECTION_LABELS: Record<SkillSection, { title: string; zh: string; badge: string }> = {
  listening: { title: 'Phần I · Nghe Hiểu', zh: '听力', badge: '100 điểm' },
  reading: { title: 'Phần II · Đọc Hiểu', zh: '阅读', badge: '100 điểm' },
  writing: { title: 'Phần III · Viết Chữ & Đặt Câu', zh: '书写', badge: '100 điểm' },
  speaking: { title: 'Phần IV · Khẩu Ngữ HSKK', zh: '口语', badge: '100 điểm' },
};

export function ExamView({
  vocab,
  selectedLevel,
  speechRate,
  onSaveExamResult,
  onPushWrongToSrs,
}: ExamViewProps) {
  const [examMode, setExamMode] = useState<ExamMode>('full_simulation');
  const [strictAudioLimit, setStrictAudioLimit] = useState(true);
  const [phase, setPhase] = useState<'setup' | 'running' | 'report'>('setup');

  const [items, setItems] = useState<SimItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [responses, setResponses] = useState<Record<string, UserResponse>>({});
  const [playCounts, setPlayCounts] = useState<Record<string, number>>({});
  const [startedAt, setStartedAt] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [pushedWrong, setPushedWrong] = useState(false);

  // Speaking recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecRef = useRef<SpeechRecInstance | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const targetLevel: HskLevel | 'all' = selectedLevel;

  const startSimulation = () => {
    stopSpeech();
    const pool = targetLevel === 'all' ? vocab : vocab.filter((w) => w.l === targetLevel);
    if (pool.length < 10) return;

    const lvMatch = (lv: HskLevel) =>
      targetLevel === 'all' ? true : lv === targetLevel || Math.abs(lv - targetLevel) <= 1;

    const built: SimItem[] = [];
    const wantListening = examMode === 'full_simulation' || examMode === 'listening';
    const wantReading = examMode === 'full_simulation' || examMode === 'reading';
    const wantWriting = examMode === 'full_simulation' || examMode === 'writing';
    const wantSpeaking = examMode === 'full_simulation' || examMode === 'speaking';

    if (wantListening) {
      // 1. True/False Audio statements
      const tfWords = shuffle(pool).slice(0, 2);
      tfWords.forEach((w, idx) => {
        const isTrue = idx % 2 === 0;
        const other = pool.find((x) => x.id !== w.id) ?? w;
        built.push({
          uid: `l-tf-${idx}`,
          section: 'listening',
          kind: 'listen_tf',
          word: w,
          displayedMeaning: parseMeaningAndMeasureWords(isTrue ? w.vi : other.vi).cleanVi,
          isTrue,
        });
      });

      // 2. Multi-speaker Dialogues (男 / 女 / 问)
      const dlSeeds = shuffle(LISTENING_DIALOGUES.filter((d) => lvMatch(d.level))).slice(0, 2);
      dlSeeds.forEach((seed, idx) => {
        built.push({ uid: `l-dl-${idx}`, section: 'listening', kind: 'listen_dialogue', seed });
      });

      // 3. Audio Vocab Comprehension
      const lvWords = shuffle(pool).slice(0, 2);
      lvWords.forEach((target, idx) => {
        const distractors = shuffle(pool.filter((x) => x.id !== target.id)).slice(0, 3);
        built.push({
          uid: `l-vc-${idx}`,
          section: 'listening',
          kind: 'listen_vocab',
          target,
          options: shuffle([target, ...distractors]),
        });
      });
    }

    if (wantReading) {
      // 1. Cloze / Sentence Order A-B-C / Passage / Faulty Sentence 病句
      const rdSeeds = shuffle(READING_SEEDS.filter((r) => lvMatch(r.level))).slice(0, 3);
      rdSeeds.forEach((seed, idx) => {
        built.push({ uid: `r-sd-${idx}`, section: 'reading', kind: 'read_seed', seed });
      });

      // 2. No-pinyin Hanzi reading comprehension
      const rvWords = shuffle(pool).slice(0, 3);
      rvWords.forEach((target, idx) => {
        const sameLen = pool.filter((x) => x.id !== target.id && x.h.length === target.h.length);
        const src = sameLen.length >= 6 ? sameLen : pool.filter((x) => x.id !== target.id);
        const distractors = shuffle(src).slice(0, 3);
        built.push({
          uid: `r-vc-${idx}`,
          section: 'reading',
          kind: 'read_vocab',
          target,
          options: shuffle([target, ...distractors]),
        });
      });
    }

    if (wantWriting) {
      // 1. Word-tile scramble & Keyword composition seeds
      const wrSeeds = shuffle(WRITING_SEEDS.filter((w) => lvMatch(w.level))).slice(0, 3);
      wrSeeds.forEach((seed, idx) => {
        built.push({
          uid: `w-sd-${idx}`,
          section: 'writing',
          kind: 'write_seed',
          seed,
          shuffledTokens: seed.tokens ? shuffle(seed.tokens) : undefined,
        });
      });

      // 2. Pinyin + Vietnamese -> Type exact Hanzi characters
      const dictWords = shuffle(pool).slice(0, 2);
      dictWords.forEach((target, idx) => {
        built.push({
          uid: `w-dc-${idx}`,
          section: 'writing',
          kind: 'write_dictation',
          target,
        });
      });
    }

    if (wantSpeaking) {
      const spSeeds = shuffle(SPEAKING_SEEDS.filter((s) => lvMatch(s.level))).slice(0, 2);
      spSeeds.forEach((seed, idx) => {
        built.push({ uid: `s-sd-${idx}`, section: 'speaking', kind: 'speak_seed', seed });
      });
    }

    setItems(built);
    setCursor(0);
    setResponses({});
    setPlayCounts({});
    setPushedWrong(false);
    setStartedAt(Date.now());
    setRemainingSec(built.length * 45);
    setPhase('running');
  };

  const stopActiveRecording = useCallback(() => {
    try {
      speechRecRef.current?.stop();
    } catch {
      // Ignore
    }
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // Ignore
    }
    setIsRecording(false);
  }, []);

  const submitExam = useCallback(
    (finalResp: Record<string, UserResponse>) => {
      stopActiveRecording();
      stopSpeech();

      const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const secTotals: Record<SkillSection, { earned: number; max: number }> = {
        listening: { earned: 0, max: 0 },
        reading: { earned: 0, max: 0 },
        writing: { earned: 0, max: 0 },
        speaking: { earned: 0, max: 0 },
      };

      let passedItems = 0;
      const wrongIds: number[] = [];

      for (const it of items) {
        const res = evaluateItem(it, finalResp[it.uid]);
        secTotals[it.section].earned += res.points;
        secTotals[it.section].max += res.maxPoints;
        if (res.points >= 60) passedItems += 1;
        if (res.wrongWordId) wrongIds.push(res.wrongWordId);
      }

      const calcSec100 = (s: SkillSection) =>
        secTotals[s].max > 0 ? Math.round((secTotals[s].earned / secTotals[s].max) * 100) : 0;

      const skillScores: SkillScores = {
        listening: calcSec100('listening'),
        reading: calcSec100('reading'),
        writing: calcSec100('writing'),
        speaking: calcSec100('speaking'),
      };

      const isFull = examMode === 'full_simulation';
      const scaledScore = isFull
        ? skillScores.listening + skillScores.reading + skillScores.writing
        : calcSec100(examMode as SkillSection);
      const maxScaledScore = isFull ? 300 : 100;

      onSaveExamResult({
        id: `sim_${Date.now()}`,
        date: Date.now(),
        level: selectedLevel,
        mode: examMode,
        score: passedItems,
        total: items.length,
        scaledScore,
        maxScaledScore,
        skillScores,
        durationSec,
        wrongWordIds: Array.from(new Set(wrongIds)),
      });

      setPhase('report');
    },
    [examMode, items, onSaveExamResult, selectedLevel, startedAt, stopActiveRecording]
  );

  // Countdown timer
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          submitExam(responses);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, responses, submitExam]);

  const currentItem = items[cursor];
  const maxAudioPlays =
    !strictAudioLimit ? 99 : selectedLevel === 1 || selectedLevel === 2 ? 2 : 1;

  const triggerAudioForItem = (it: SimItem) => {
    const used = playCounts[it.uid] ?? 0;
    if (it.section === 'listening' && used >= maxAudioPlays) return;
    setPlayCounts((p) => ({ ...p, [it.uid]: used + 1 }));

    if (it.kind === 'listen_tf') {
      speakChinese(it.word.h, speechRate);
    } else if (it.kind === 'listen_vocab') {
      speakChinese(it.target.h, speechRate);
    } else if (it.kind === 'listen_dialogue') {
      speakDialogue(it.seed.turns, speechRate);
    } else if (it.kind === 'speak_seed') {
      speakChinese(it.seed.promptZh, speechRate);
    }
  };

  // Start / Stop Microphone + Mandarin SpeechRecognition for Speaking Section
  const toggleRecordingForSpeaking = async (seed: SpeakingSeed, uid: string) => {
    if (isRecording) {
      stopActiveRecording();
      return;
    }

    stopSpeech();
    setIsRecording(true);
    audioChunksRef.current = [];

    // 1. Start MediaRecorder so user can replay their own voice
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setResponses((prev) => ({
            ...prev,
            [uid]: {
              ...prev[uid],
              audioUrl: url,
              speakingScorePct: prev[uid]?.speakingScorePct ?? 75,
            },
          }));
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
    } catch {
      // Microphone permission denied or unavailable
    }

    // 2. Start Web Speech Recognition (zh-CN) for automatic Hanzi pronunciation scoring
    const RecCtor = getSpeechRecognitionCtor();
    if (RecCtor) {
      try {
        const rec = new RecCtor();
        rec.lang = 'zh-CN';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (ev) => {
          let transcript = '';
          for (let i = 0; i < ev.results.length; i++) {
            transcript += ev.results[i][0].transcript;
          }
          const scorePct =
            seed.subtype === 'repeat'
              ? computeCharOverlapScore(seed.promptZh, transcript)
              : Math.min(
                  100,
                  Math.round(
                    (normalizeHanziOnly(transcript).length / 12) * 60 +
                      ((seed.keyElements ?? []).filter((k) => transcript.includes(k)).length /
                        Math.max(1, (seed.keyElements ?? []).length)) *
                        40
                  )
                );

          setResponses((prev) => ({
            ...prev,
            [uid]: {
              ...prev[uid],
              spokenTranscript: transcript,
              speakingScorePct: scorePct,
            },
          }));
        };
        rec.onerror = () => setIsRecording(false);
        rec.onend = () => setIsRecording(false);
        speechRecRef.current = rec;
        rec.start();
      } catch {
        // Ignore browser SpeechRecognition error
      }
    }
  };

  const sectionGroups = useMemo(() => {
    const order: SkillSection[] = ['listening', 'reading', 'writing', 'speaking'];
    return order
      .map((sec) => ({
        section: sec,
        items: items.map((it, idx) => ({ it, idx })).filter((x) => x.it.section === sec),
      }))
      .filter((g) => g.items.length > 0);
  }, [items]);

  if (phase === 'setup') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-20 lg:pb-8">
        <div className="rounded-2xl border border-zinc-800 bg-[#0E1017] p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
              PHÒNG THI MÁY MÔ PHỎNG HSK & HSKK (机考模拟)
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              Thi Thử Mô Phỏng Đủ Tất Cả Kỹ Năng ({selectedLevel === 'all' ? 'Tổng hợp HSK 1-6' : `HSK ${selectedLevel}`})
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Bao phủ trọn vẹn 4 kỹ năng của kỳ thi thật: <strong>Nghe hiểu (听力)</strong> hội thoại Nam/Nữ giới hạn lượt phát, <strong>Đọc hiểu (阅读)</strong> điền từ/xếp câu A-B-C/bắt lỗi 病句, <strong>Viết (书写)</strong> ghép từ thành câu & viết đoạn văn theo từ khóa, và <strong>Khẩu ngữ HSKK (口语)</strong> thu âm nhận diện giọng nói tiếng Trung trực tiếp.
            </p>
          </div>

          {/* 5 Exam Modes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => setExamMode('full_simulation')}
              className={`md:col-span-2 p-5 rounded-xl border text-left transition cursor-pointer ${
                examMode === 'full_simulation'
                  ? 'bg-rose-600/15 border-rose-500 text-white shadow-lg shadow-rose-600/10'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-extrabold flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-rose-400" />
                  Thi Mô Phỏng Toàn Diện Đủ 4 Kỹ Năng (Nghe · Đọc · Viết · Nói)
                </span>
                <span className="px-2.5 py-0.5 rounded bg-rose-600 text-white text-xs font-mono-code font-bold">
                  300đ HSK + 100đ HSKK
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5">
                Chạy tuần tự qua cả 4 phần thi chuẩn cấu trúc Hanban/CTI: Nghe phán đoán & hội thoại → Đọc ngữ cảnh & xếp câu → Viết ghép câu & đặt câu → Thu âm Khẩu ngữ.
              </p>
            </button>

            {(
              [
                {
                  id: 'listening',
                  icon: Headphones,
                  title: 'Chuyên đề Kỹ năng Nghe (听力)',
                  desc: 'Nghe phán đoán Đúng/Sai + Hội thoại 2 giọng Nam/Nữ kèm câu hỏi suy luận',
                },
                {
                  id: 'reading',
                  icon: BookOpen,
                  title: 'Chuyên đề Kỹ năng Đọc (阅读)',
                  desc: 'Điền từ trống, sắp xếp mệnh đề A-B-C, đọc đoạn văn chữ Hán & bắt lỗi 病句',
                },
                {
                  id: 'writing',
                  icon: PenTool,
                  title: 'Chuyên đề Kỹ năng Viết (书写)',
                  desc: 'Xếp thẻ từ rời thành câu, nhìn Pinyin gõ chữ Hán & viết đoạn văn chứa từ khóa',
                },
                {
                  id: 'speaking',
                  icon: Mic,
                  title: 'Chuyên đề Khẩu ngữ HSKK (口语)',
                  desc: 'Nghe nhắc lại nguyên văn & trả lời câu hỏi mở bằng thu âm nhận diện zh-CN',
                },
              ] as const
            ).map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setExamMode(m.id)}
                  className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                    examMode === m.id
                      ? 'bg-rose-600/15 border-rose-500 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-sm font-bold flex items-center gap-2">
                    <Icon className="w-4 h-4 text-rose-400" />
                    {m.title}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{m.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Exam Room Rules */}
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-zinc-200">
                Chế độ giới hạn lượt nghe chuẩn phòng thi thật
              </div>
              <p className="text-[11px] text-zinc-500">
                Khi bật: HSK 1-2 được nghe tối đa 2 lần/câu; HSK 3-6 chỉ được nghe đúng 1 lần duy nhất.
              </p>
            </div>
            <button
              onClick={() => setStrictAudioLimit((v) => !v)}
              className={`px-4 py-2 rounded-lg text-xs font-bold border shrink-0 cursor-pointer ${
                strictAudioLimit
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400'
              }`}
            >
              {strictAudioLimit ? 'Giới hạn lượt nghe: BẬT' : 'Nghe lại tự do: TẮT'}
            </button>
          </div>

          <button
            onClick={startSimulation}
            className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            Vào Phòng Thi Mô Phỏng Ngay
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'running' && currentItem) {
    const mins = String(Math.floor(remainingSec / 60)).padStart(2, '0');
    const secs = String(remainingSec % 60).padStart(2, '0');
    const curResp = responses[currentItem.uid] ?? {};
    const usedPlays = playCounts[currentItem.uid] ?? 0;
    const playsLeft = Math.max(0, maxAudioPlays - usedPlays);

    return (
      <div className="max-w-4xl mx-auto space-y-5 pb-20 lg:pb-8">
        {/* Top Exam Header */}
        <div className="rounded-xl border border-zinc-800 bg-[#0E1017] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-black font-hanzi">
              {SECTION_LABELS[currentItem.section].zh}
            </span>
            <span className="text-xs sm:text-sm font-bold text-white">
              {SECTION_LABELS[currentItem.section].title}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span
              className={`font-mono-code text-sm font-bold flex items-center gap-1.5 ${
                remainingSec <= 30 ? 'text-rose-400 animate-pulse' : 'text-amber-400'
              }`}
            >
              <Clock className="w-4 h-4" />
              {mins}:{secs}
            </span>
            <button
              onClick={() => submitExam(responses)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer"
            >
              Nộp bài chấm điểm
            </button>
          </div>
        </div>

        {/* Section Tabs Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {sectionGroups.map((g) => {
            const active = g.section === currentItem.section;
            const doneCnt = g.items.filter(({ it }) => responses[it.uid] !== undefined).length;
            return (
              <button
                key={g.section}
                onClick={() => {
                  stopActiveRecording();
                  setCursor(g.items[0].idx);
                }}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  active
                    ? 'bg-rose-600/15 border-rose-500 text-white'
                    : 'bg-[#0E1017] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="text-xs font-bold">{SECTION_LABELS[g.section].title}</div>
                <div className="text-[11px] font-mono-code text-zinc-500 mt-0.5">
                  Đã làm: {doneCnt}/{g.items.length}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Question Workspace */}
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-[#131622] to-[#0D0F17] p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-mono-code font-bold text-zinc-200">
              Câu {cursor + 1} / {items.length}
            </span>
            {currentItem.section === 'listening' && (
              <span className="font-mono-code text-amber-300">
                {strictAudioLimit ? `Lượt nghe còn lại: ${playsLeft}` : 'Chế độ nghe tự do'}
              </span>
            )}
          </div>

          {/* === 1. LISTENING TRUE/FALSE === */}
          {currentItem.kind === 'listen_tf' && (
            <div className="space-y-6 text-center">
              <p className="text-xs text-zinc-400">
                Nghe băng ghi âm và phán đoán nghĩa bên dưới Đúng (对) hay Sai (错):
              </p>
              <button
                disabled={playsLeft <= 0}
                onClick={() => triggerAudioForItem(currentItem)}
                className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition cursor-pointer ${
                  playsLeft > 0
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <Headphones className="w-9 h-9" />
              </button>

              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 max-w-md mx-auto">
                <div className="text-xs text-zinc-500 mb-1">Nội dung đối chiếu:</div>
                <div className="text-lg font-bold text-white">{currentItem.displayedMeaning}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                {[
                  { val: 1, label: '✓ Đúng (对)' },
                  { val: 0, label: '✗ Sai (错)' },
                ].map((btn) => (
                  <button
                    key={btn.val}
                    onClick={() =>
                      setResponses((p) => ({ ...p, [currentItem.uid]: { choiceIdx: btn.val } }))
                    }
                    className={`py-3.5 rounded-xl font-bold text-sm border transition cursor-pointer ${
                      curResp.choiceIdx === btn.val
                        ? 'bg-rose-600 border-rose-400 text-white'
                        : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-zinc-200'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* === 2. LISTENING MULTI-SPEAKER DIALOGUE === */}
          {currentItem.kind === 'listen_dialogue' && (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <p className="text-xs text-zinc-400">
                  Bấm phát đoạn hội thoại giữa Nam (男) và Nữ (女), sau đó chọn đáp án đúng cho câu hỏi cuối băng:
                </p>
                <button
                  disabled={playsLeft <= 0}
                  onClick={() => triggerAudioForItem(currentItem)}
                  className={`mx-auto px-6 py-3.5 rounded-2xl font-bold text-xs flex items-center gap-2.5 transition cursor-pointer ${
                    playsLeft > 0
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <Volume2 className="w-5 h-5" />
                  Phát băng hội thoại Nam - Nữ ({playsLeft > 90 ? '∞' : playsLeft} lượt)
                </button>
                <div className="font-hanzi text-base font-bold text-amber-300 pt-1">
                  问：{currentItem.seed.questionZh}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentItem.seed.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() =>
                      setResponses((p) => ({ ...p, [currentItem.uid]: { choiceIdx: idx } }))
                    }
                    className={`p-4 rounded-xl border text-left font-hanzi text-sm font-semibold transition cursor-pointer ${
                      curResp.choiceIdx === idx
                        ? 'bg-rose-600/20 border-rose-500 text-white'
                        : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-zinc-200'
                    }`}
                  >
                    <span className="font-mono-code text-rose-400 mr-2">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* === 3. LISTENING VOCAB === */}
          {currentItem.kind === 'listen_vocab' && (
            <div className="space-y-6 text-center">
              <p className="text-xs text-zinc-400">Nghe từ vựng và chọn nghĩa chính xác:</p>
              <button
                disabled={playsLeft <= 0}
                onClick={() => triggerAudioForItem(currentItem)}
                className={`mx-auto w-18 h-18 rounded-full flex items-center justify-center transition cursor-pointer ${
                  playsLeft > 0 ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                <Volume2 className="w-8 h-8" />
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {currentItem.options.map((opt, idx) => (
                  <button
                    key={opt.id}
                    onClick={() =>
                      setResponses((p) => ({ ...p, [currentItem.uid]: { choiceIdx: idx } }))
                    }
                    className={`p-4 rounded-xl border text-sm font-medium transition cursor-pointer ${
                      curResp.choiceIdx === idx
                        ? 'bg-rose-600/20 border-rose-500 text-white'
                        : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-zinc-200'
                    }`}
                  >
                    <span className="font-mono-code text-rose-400 mr-2">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    {parseMeaningAndMeasureWords(opt.vi).cleanVi}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* === 4. READING SEEDS (Cloze / Order A-B-C / Passage / 病句) === */}
          {currentItem.kind === 'read_seed' && (
            <div className="space-y-5">
              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-5 font-hanzi text-base sm:text-lg leading-relaxed text-white whitespace-pre-line">
                {currentItem.seed.promptZh}
              </div>
              <div className="text-xs sm:text-sm font-bold text-amber-300 font-hanzi">
                {currentItem.seed.questionZh}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentItem.seed.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() =>
                      setResponses((p) => ({ ...p, [currentItem.uid]: { choiceIdx: idx } }))
                    }
                    className={`p-4 rounded-xl border text-left font-hanzi text-sm font-medium transition cursor-pointer ${
                      curResp.choiceIdx === idx
                        ? 'bg-rose-600/20 border-rose-500 text-white'
                        : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-zinc-200'
                    }`}
                  >
                    <span className="font-mono-code text-rose-400 mr-2">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* === 5. READING VOCAB (NO PINYIN) === */}
          {currentItem.kind === 'read_vocab' && (
            <div className="space-y-6 text-center">
              <div className="text-xs text-zinc-400">
                Nhận diện mặt chữ Hán (ẩn Pinyin) và chọn nghĩa tương ứng:
              </div>
              <div className="font-hanzi text-5xl font-bold text-white py-2">
                {currentItem.target.h}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {currentItem.options.map((opt, idx) => (
                  <button
                    key={opt.id}
                    onClick={() =>
                      setResponses((p) => ({ ...p, [currentItem.uid]: { choiceIdx: idx } }))
                    }
                    className={`p-4 rounded-xl border text-sm font-medium transition cursor-pointer ${
                      curResp.choiceIdx === idx
                        ? 'bg-rose-600/20 border-rose-500 text-white'
                        : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-zinc-200'
                    }`}
                  >
                    <span className="font-mono-code text-rose-400 mr-2">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    {parseMeaningAndMeasureWords(opt.vi).cleanVi}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* === 6. WRITING SEEDS (Word-tile Scramble / Pinyin Fill / Keyword Essay) === */}
          {currentItem.kind === 'write_seed' && (
            <div className="space-y-5">
              <div className="text-sm font-bold text-amber-300">
                {currentItem.seed.instructionVi}
              </div>

              {currentItem.seed.subtype === 'scramble' && currentItem.shuffledTokens && (
                <div className="space-y-4">
                  {/* Assemble bar */}
                  <div className="min-h-[56px] rounded-xl bg-zinc-950 border border-zinc-700 p-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-hanzi text-xl font-bold text-white tracking-wide">
                      {curResp.textValue || (
                        <span className="text-xs font-sans font-normal text-zinc-500">
                          Bấm vào các thẻ từ bên dưới theo đúng trật tự câu...
                        </span>
                      )}
                    </span>
                    {curResp.textValue && (
                      <button
                        onClick={() =>
                          setResponses((p) => ({ ...p, [currentItem.uid]: { textValue: '' } }))
                        }
                        className="px-2.5 py-1 rounded bg-zinc-800 text-xs text-zinc-300 hover:text-white cursor-pointer"
                      >
                        Xóa xếp lại
                      </button>
                    )}
                  </div>

                  {/* Word tiles */}
                  <div className="flex flex-wrap gap-2.5">
                    {currentItem.shuffledTokens.map((tok, i) => (
                      <button
                        key={`${tok}-${i}`}
                        onClick={() =>
                          setResponses((p) => ({
                            ...p,
                            [currentItem.uid]: { textValue: (curResp.textValue ?? '') + tok },
                          }))
                        }
                        className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-rose-600/25 border border-zinc-700 hover:border-rose-500 font-hanzi text-lg font-bold text-white transition cursor-pointer"
                      >
                        {tok}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentItem.seed.subtype === 'pinyin_fill' && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 font-hanzi text-lg text-white">
                    {currentItem.seed.sentenceWithBlank}
                  </div>
                  <input
                    type="text"
                    value={curResp.textValue ?? ''}
                    onChange={(e) =>
                      setResponses((p) => ({
                        ...p,
                        [currentItem.uid]: { textValue: e.target.value },
                      }))
                    }
                    placeholder={`Gõ chữ Hán tương ứng với ${currentItem.seed.pinyinHint ?? ''}...`}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-700 focus:border-rose-500 focus:outline-none font-hanzi text-xl text-white"
                  />
                </div>
              )}

              {currentItem.seed.subtype === 'keyword_compose' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-zinc-400">Từ khóa bắt buộc:</span>
                    {(currentItem.seed.keywords ?? []).map((kw) => {
                      const included = (curResp.textValue ?? '').includes(kw);
                      return (
                        <span
                          key={kw}
                          className={`px-3 py-1 rounded-lg font-hanzi text-sm font-bold border ${
                            included
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          {kw} {included ? '✓' : ''}
                        </span>
                      );
                    })}
                  </div>
                  <textarea
                    rows={4}
                    value={curResp.textValue ?? ''}
                    onChange={(e) =>
                      setResponses((p) => ({
                        ...p,
                        [currentItem.uid]: { textValue: e.target.value },
                      }))
                    }
                    placeholder="Nhập câu hoặc đoạn văn bằng chữ Hán (nhớ kết thúc bằng dấu 。)..."
                    className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-700 focus:border-rose-500 focus:outline-none font-hanzi text-base text-white"
                  />
                  <div className="text-right text-xs font-mono-code text-zinc-500">
                    Số chữ Hán đã gõ: {normalizeHanziOnly(curResp.textValue ?? '').length}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === 7. WRITING DICTATION === */}
          {currentItem.kind === 'write_dictation' && (
            <div className="space-y-4">
              <div className="text-sm font-bold text-amber-300">
                Chính tả chữ Hán: Nhìn phiên âm Pinyin & nghĩa để gõ đúng từ chữ Hán:
              </div>
              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-5 text-center space-y-1">
                <div className="text-2xl font-bold text-amber-300">{currentItem.target.p}</div>
                <div className="text-sm text-zinc-300">
                  {parseMeaningAndMeasureWords(currentItem.target.vi).cleanVi}
                </div>
                {currentItem.target.hv && (
                  <div className="text-xs uppercase text-indigo-400 font-bold">
                    Âm Hán Việt: {currentItem.target.hv}
                  </div>
                )}
              </div>
              <input
                type="text"
                value={curResp.textValue ?? ''}
                onChange={(e) =>
                  setResponses((p) => ({
                    ...p,
                    [currentItem.uid]: { textValue: e.target.value },
                  }))
                }
                placeholder="Bật bộ gõ tiếng Trung và nhập chữ Hán tại đây..."
                className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-700 focus:border-rose-500 focus:outline-none font-hanzi text-2xl text-center text-white"
              />
            </div>
          )}

          {/* === 8. SPEAKING HSKK === */}
          {currentItem.kind === 'speak_seed' && (
            <div className="space-y-5">
              <div className="text-sm font-bold text-amber-300">{currentItem.seed.meaningVi}</div>
              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-hanzi text-xl sm:text-2xl font-bold text-white">
                      {currentItem.seed.promptZh}
                    </div>
                    <div className="text-xs text-amber-300 mt-1">{currentItem.seed.pinyin}</div>
                  </div>
                  <button
                    onClick={() => triggerAudioForItem(currentItem)}
                    className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-rose-400 shrink-0 cursor-pointer"
                    title="Nghe câu mẫu"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Microphone Record + Speech Recognition Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => toggleRecordingForSpeaking(currentItem.seed, currentItem.uid)}
                  className={`px-5 py-3 rounded-xl font-extrabold text-xs flex items-center gap-2 transition cursor-pointer ${
                    isRecording
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <Square className="w-4 h-4 fill-white" />
                      Dừng thu âm & Chấm điểm
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      Bấm thu âm giọng nói (zh-CN)
                    </>
                  )}
                </button>

                {curResp.audioUrl && (
                  <audio controls src={curResp.audioUrl} className="h-10 rounded-lg" />
                )}
              </div>

              {curResp.spokenTranscript && (
                <div className="rounded-xl bg-zinc-950 border border-emerald-700/40 p-3.5 text-xs space-y-1">
                  <div className="text-zinc-400">Hệ thống nhận diện giọng đọc của bạn:</div>
                  <div className="font-hanzi text-base font-bold text-emerald-300">
                    {curResp.spokenTranscript}
                  </div>
                  <div className="font-mono-code text-amber-300">
                    Độ chuẩn khớp tự động: {curResp.speakingScorePct ?? 0}%
                  </div>
                </div>
              )}

              {/* Manual self-grading fallback if browser blocks SpeechRecognition */}
              <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                <span>Tự chấm đối chiếu phát âm (nếu không cắm micro):</span>
                <div className="flex gap-1.5">
                  {[
                    { pct: 50, label: 'Còn ngập ngừng (50%)' },
                    { pct: 80, label: 'Trôi chảy (80%)' },
                    { pct: 100, label: 'Chuẩn thanh điệu (100%)' },
                  ].map((g) => (
                    <button
                      key={g.pct}
                      onClick={() =>
                        setResponses((p) => ({
                          ...p,
                          [currentItem.uid]: { ...curResp, speakingScorePct: g.pct },
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                        curResp.speakingScorePct === g.pct
                          ? 'bg-emerald-600 border-emerald-400 text-white font-bold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Prev / Next Question Footer */}
          <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
            <button
              disabled={cursor === 0}
              onClick={() => {
                stopActiveRecording();
                setCursor((c) => Math.max(0, c - 1));
              }}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 text-xs font-bold text-zinc-200 cursor-pointer"
            >
              ← Câu trước
            </button>

            {cursor + 1 < items.length ? (
              <button
                onClick={() => {
                  stopActiveRecording();
                  setCursor((c) => c + 1);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-extrabold text-white cursor-pointer"
              >
                Câu tiếp theo →
              </button>
            ) : (
              <button
                onClick={() => submitExam(responses)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-extrabold text-white cursor-pointer"
              >
                Hoàn thành & Chấm điểm
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === REPORT PHASE ===
  const secCalc: Record<SkillSection, { earned: number; max: number }> = {
    listening: { earned: 0, max: 0 },
    reading: { earned: 0, max: 0 },
    writing: { earned: 0, max: 0 },
    speaking: { earned: 0, max: 0 },
  };
  const wrongWordIds: number[] = [];

  for (const it of items) {
    const r = evaluateItem(it, responses[it.uid]);
    secCalc[it.section].earned += r.points;
    secCalc[it.section].max += r.maxPoints;
    if (r.wrongWordId) wrongWordIds.push(r.wrongWordId);
  }

  const s100 = (s: SkillSection) =>
    secCalc[s].max > 0 ? Math.round((secCalc[s].earned / secCalc[s].max) * 100) : 0;

  const isFull = examMode === 'full_simulation';
  const hskTotal300 = s100('listening') + s100('reading') + s100('writing');
  const hskk100 = s100('speaking');
  const singleScore = !isFull ? s100(examMode as SkillSection) : 0;
  const passed = isFull ? hskTotal300 >= 180 : singleScore >= 60;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 lg:pb-8">
      <div className="rounded-2xl border border-zinc-800 bg-[#0E1017] p-6 sm:p-8 space-y-6 text-center">
        <Award className={`w-12 h-12 mx-auto ${passed ? 'text-emerald-400' : 'text-rose-400'}`} />
        {isFull ? (
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-black font-mono-code text-white">
              {hskTotal300} <span className="text-lg text-zinc-500">/ 300 điểm HSK</span>
            </div>
            <div className="text-sm font-mono-code text-sky-400 font-bold">
              Điểm Khẩu ngữ HSKK: {hskk100} / 100
            </div>
            <div className={`text-sm font-extrabold pt-1 ${passed ? 'text-emerald-400' : 'text-rose-400'}`}>
              {passed ? 'ĐẠT CHUẨN ĐỖ HSK (≥ 180/300)' : 'CHƯA ĐẠT CHUẨN HSK (Cần ≥ 180/300)'}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-black font-mono-code text-white">
              {singleScore} <span className="text-lg text-zinc-500">/ 100 điểm</span>
            </div>
            <div className={`text-sm font-extrabold ${passed ? 'text-emerald-400' : 'text-rose-400'}`}>
              {passed ? 'ĐẠT YÊU CẦU KỸ NĂNG (≥ 60/100)' : 'CHƯA ĐẠT (Cần ≥ 60/100)'}
            </div>
          </div>
        )}

        {/* 4-Skill Score Breakdown */}
        {isFull && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-left">
            {(['listening', 'reading', 'writing', 'speaking'] as SkillSection[]).map((sec) => {
              const val = s100(sec);
              return (
                <div key={sec} className="rounded-xl bg-zinc-950 border border-zinc-800 p-3.5">
                  <div className="text-xs text-zinc-400">{SECTION_LABELS[sec].zh} · {sec.toUpperCase()}</div>
                  <div className="text-xl font-black font-mono-code text-white mt-1">{val}/100</div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 mt-2 overflow-hidden">
                    <div
                      className={`h-full ${val >= 60 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${val}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            onClick={startSimulation}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Thi đề mới
          </button>
          <button
            onClick={() => setPhase('setup')}
            className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold cursor-pointer"
          >
            Đổi cấu hình thi
          </button>
          {wrongWordIds.length > 0 && (
            <button
              disabled={pushedWrong}
              onClick={() => {
                onPushWrongToSrs(Array.from(new Set(wrongWordIds)));
                setPushedWrong(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-extrabold flex items-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              {pushedWrong ? 'Đã ghim vào SRS!' : `Đẩy ${Array.from(new Set(wrongWordIds)).length} từ sai về SRS`}
            </button>
          )}
        </div>
      </div>

      {/* Detailed Answer Key & Transcripts */}
      <div className="rounded-2xl border border-zinc-800 bg-[#0E1017] p-5 sm:p-6 space-y-3">
        <h3 className="text-sm font-bold text-white">Giải thích chi tiết, Transcript Nghe & Đáp án mẫu</h3>
        <div className="space-y-3">
          {items.map((it, idx) => {
            const ev = evaluateItem(it, responses[it.uid]);
            const ok = ev.points >= 60;
            return (
              <div
                key={it.uid}
                className={`rounded-xl p-4 border space-y-1.5 text-xs ${
                  ok ? 'bg-emerald-950/10 border-emerald-800/40' : 'bg-rose-950/15 border-rose-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                    {ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    Câu {idx + 1} · {SECTION_LABELS[it.section].zh}
                  </span>
                  <span className="font-mono-code font-bold text-amber-300">{ev.points}/100đ</span>
                </div>

                {it.kind === 'listen_tf' && (
                  <div className="text-zinc-300">
                    Từ phát âm: <strong className="font-hanzi text-base text-white">{it.word.h}</strong> ({it.word.p}) : {it.word.vi} → Đáp án: <strong>{it.isTrue ? 'Đúng (对)' : 'Sai (错)'}</strong>
                  </div>
                )}

                {it.kind === 'listen_dialogue' && (
                  <div className="space-y-1 text-zinc-300">
                    <div className="font-hanzi text-zinc-200">
                      Transcript: {it.seed.turns.map((t) => `${t.speaker}: ${t.zh}`).join(' / ')}
                    </div>
                    <div className="text-emerald-300">Đáp án đúng: {it.seed.options[it.seed.correctIdx]}</div>
                    <div className="text-zinc-400">{it.seed.explanationVi}</div>
                  </div>
                )}

                {(it.kind === 'listen_vocab' || it.kind === 'read_vocab' || it.kind === 'write_dictation') && (
                  <div className="text-zinc-300">
                    Đáp án chuẩn: <strong className="font-hanzi text-base text-white">{it.target.h}</strong> ({it.target.p}) : {parseMeaningAndMeasureWords(it.target.vi).cleanVi}
                  </div>
                )}

                {it.kind === 'read_seed' && (
                  <div className="space-y-1 text-zinc-300">
                    <div className="text-emerald-300 font-hanzi">Đáp án: {it.seed.options[it.seed.correctIdx]}</div>
                    <div className="text-zinc-400">{it.seed.explanationVi}</div>
                  </div>
                )}

                {it.kind === 'write_seed' && (
                  <div className="space-y-1 text-zinc-300">
                    <div>Bài làm của bạn: <span className="font-hanzi text-white">{responses[it.uid]?.textValue || '(Bỏ trống)'}</span></div>
                    <div className="text-emerald-300 font-hanzi">Câu mẫu chuẩn: {it.seed.answerZh}</div>
                    <div className="text-zinc-400">{it.seed.explanationVi}</div>
                  </div>
                )}

                {it.kind === 'speak_seed' && (
                  <div className="space-y-1 text-zinc-300">
                    <div className="font-hanzi text-white">Đề khẩu ngữ: {it.seed.promptZh}</div>
                    {it.seed.sampleAnswerZh && (
                      <div className="text-emerald-300 font-hanzi">Trả lời mẫu điểm cao: {it.seed.sampleAnswerZh}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
