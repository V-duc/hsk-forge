import { useEffect, useMemo, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  PenTool,
  Play,
  RefreshCw,
  Repeat,
  Shuffle,
  Volume2,
} from 'lucide-react';
import { speakChinese } from '../lib/speech';
import type { CharInsight, LevelFilter, VocabItem } from '../types';

interface StrokeLabViewProps {
  vocab: VocabItem[];
  charInsights: Record<string, CharInsight>;
  selectedLevel: LevelFilter;
  speechRate: number;
  initialText: string;
}

export function StrokeLabView({
  vocab,
  charInsights,
  selectedLevel,
  speechRate,
  initialText,
}: StrokeLabViewProps) {
  const [inputText, setInputText] = useState(initialText || '学习汉语');
  const [activeCharIdx, setActiveCharIdx] = useState(0);
  const [mode, setMode] = useState<'watch' | 'quiz'>('watch');
  const [showOutline, setShowOutline] = useState(true);
  const [quizStatus, setQuizStatus] = useState<{
    strokeNum: number;
    mistakes: number;
    completed: boolean;
  }>({ strokeNum: 0, mistakes: 0, completed: false });
  const [loadError, setLoadError] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const writerRef = useRef<HanziWriter | null>(null);

  useEffect(() => {
    if (initialText) {
      setInputText(initialText);
      setActiveCharIdx(0);
    }
  }, [initialText]);

  const chars = useMemo(() => {
    const extracted = Array.from(inputText).filter((c) => c >= '\u4e00' && c <= '\u9fff');
    return extracted.length > 0 ? extracted : ['学'];
  }, [inputText]);

  const activeChar = chars[Math.min(activeCharIdx, chars.length - 1)] || '学';
  const insight = charInsights[activeChar];

  // Related compound words in HSK
  const relatedWords = useMemo(() => {
    return vocab.filter((w) => w.h.includes(activeChar)).slice(0, 8);
  }, [vocab, activeChar]);

  const pickRandomWord = () => {
    const pool = selectedLevel === 'all' ? vocab : vocab.filter((w) => w.l === selectedLevel);
    if (!pool.length) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setInputText(picked.h);
    setActiveCharIdx(0);
    speakChinese(picked.h, speechRate);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';
    setLoadError(false);
    setQuizStatus({ strokeNum: 0, mistakes: 0, completed: false });

    const writer = HanziWriter.create(el, activeChar, {
      width: 280,
      height: 280,
      padding: 18,
      showOutline,
      showCharacter: mode === 'watch',
      strokeAnimationSpeed: 1.15,
      delayBetweenStrokes: 160,
      strokeColor: '#F4F4F5',
      radicalColor: '#F43F5E',
      outlineColor: '#27272A',
      drawingColor: '#38BDF8',
      drawingWidth: 18,
      highlightColor: '#FBBF24',
      highlightCompleteColor: '#10B981',
      onLoadCharDataError: () => {
        setLoadError(true);
      },
    });

    writerRef.current = writer;

    if (mode === 'quiz') {
      writer.quiz({
        showHintAfterMisses: 2,
        highlightOnComplete: true,
        onCorrectStroke: (data) => {
          setQuizStatus({
            strokeNum: data.strokeNum + 1,
            mistakes: data.totalMistakes,
            completed: false,
          });
        },
        onMistake: (data) => {
          setQuizStatus({
            strokeNum: data.strokeNum,
            mistakes: data.totalMistakes,
            completed: false,
          });
        },
        onComplete: (summary) => {
          setQuizStatus((prev) => ({
            ...prev,
            mistakes: summary.totalMistakes,
            completed: true,
          }));
          speakChinese(activeChar, speechRate);
        },
      });
    }

    return () => {
      try {
        writer.cancelQuiz();
      } catch {
        // Ignore cleanup error
      }
      writerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChar, mode]);

  useEffect(() => {
    const w = writerRef.current;
    if (!w) return;
    if (showOutline) w.showOutline();
    else w.hideOutline();
  }, [showOutline]);

  const startQuizAgain = () => {
    setMode('quiz');
    const w = writerRef.current;
    if (!w) return;
    setQuizStatus({ strokeNum: 0, mistakes: 0, completed: false });
    w.hideCharacter();
    w.quiz({
      showHintAfterMisses: 2,
      highlightOnComplete: true,
      onCorrectStroke: (data) => {
        setQuizStatus({
          strokeNum: data.strokeNum + 1,
          mistakes: data.totalMistakes,
          completed: false,
        });
      },
      onMistake: (data) => {
        setQuizStatus({
          strokeNum: data.strokeNum,
          mistakes: data.totalMistakes,
          completed: false,
        });
      },
      onComplete: (summary) => {
        setQuizStatus((prev) => ({
          ...prev,
          mistakes: summary.totalMistakes,
          completed: true,
        }));
        speakChinese(activeChar, speechRate);
      },
    });
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Top Input Bar */}
      <div className="rounded-2xl border border-zinc-800 bg-[#0E1017] p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setActiveCharIdx(0);
            }}
            placeholder="Nhập chữ Hán bất kỳ để phân tích bút thuận (VD: 经济, 北京, 喜欢)..."
            className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:outline-none font-hanzi text-base text-white"
          />
        </div>
        <button
          onClick={pickRandomWord}
          className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Shuffle className="w-4 h-4 text-rose-400" />
          Bốc từ ngẫu nhiên
        </button>
      </div>

      {/* Character Selector Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {chars.map((ch, idx) => {
          const active = idx === activeCharIdx;
          return (
            <button
              key={`${ch}-${idx}`}
              onClick={() => setActiveCharIdx(idx)}
              className={`w-12 h-12 rounded-xl font-hanzi text-2xl font-bold transition cursor-pointer ${
                active
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 border border-rose-400/50'
                  : 'bg-[#0E1017] text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              {ch}
            </button>
          );
        })}
      </div>

      {/* Main Split Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Mizige Canvas & Controls */}
        <div className="lg:col-span-5 rounded-2xl border border-zinc-800 bg-[#0E1017] p-6 flex flex-col items-center">
          {/* Mode Switcher */}
          <div className="w-full grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
            <button
              onClick={() => setMode('watch')}
              className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                mode === 'watch' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Xem nét mẫu
            </button>
            <button
              onClick={() => setMode('quiz')}
              className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'quiz' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              Tự tay tập viết
            </button>
          </div>

          {/* Mizige SVG Grid Wrapper */}
          <div className="relative w-[280px] h-[280px] rounded-xl border-2 border-rose-500/40 bg-[#0B0D14] overflow-hidden shadow-inner select-none touch-none">
            {/* Traditional Diagonal & Crosshair Guide Lines */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 280 280"
            >
              <line x1="140" y1="0" x2="140" y2="280" stroke="rgba(244,63,94,0.22)" strokeDasharray="5,5" />
              <line x1="0" y1="140" x2="280" y2="140" stroke="rgba(244,63,94,0.22)" strokeDasharray="5,5" />
              <line x1="0" y1="0" x2="280" y2="280" stroke="rgba(244,63,94,0.12)" strokeDasharray="4,6" />
              <line x1="280" y1="0" x2="0" y2="280" stroke="rgba(244,63,94,0.12)" strokeDasharray="4,6" />
            </svg>

            <div ref={containerRef} className="relative z-10 w-full h-full cursor-crosshair" />

            {loadError && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4 text-center text-xs text-rose-300">
                Không tải được dữ liệu nét chữ (kiểm tra kết nối mạng cho chữ hiếm).
              </div>
            )}
          </div>

          {/* Quiz Status or Watch Legend */}
          {mode === 'quiz' ? (
            <div className="w-full mt-4 rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-3 flex items-center justify-between text-xs">
              {quizStatus.completed ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Hoàn thành chuẩn xác! (Sai: {quizStatus.mistakes})
                </span>
              ) : (
                <span className="text-sky-300 font-medium">
                  Dùng chuột/ngón tay kéo theo thứ tự nét (Đã vẽ: {quizStatus.strokeNum} · Sai: {quizStatus.mistakes})
                </span>
              )}
              <button
                onClick={startQuizAgain}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 cursor-pointer"
                title="Viết lại từ đầu"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4 mt-4 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                Bộ thủ chính
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-100 inline-block" />
                Nét cấu thành
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full grid grid-cols-3 gap-2 mt-4">
            <button
              onClick={() => {
                setMode('watch');
                setTimeout(() => writerRef.current?.animateCharacter(), 30);
              }}
              className="py-2 px-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-rose-400" />
              Chạy nét
            </button>
            <button
              onClick={() => {
                setMode('watch');
                setTimeout(() => writerRef.current?.loopCharacterAnimation(), 30);
              }}
              className="py-2 px-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Repeat className="w-3.5 h-3.5 text-amber-400" />
              Lặp nét
            </button>
            <button
              onClick={() => setShowOutline((v) => !v)}
              className="py-2 px-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {showOutline ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showOutline ? 'Ẩn bóng mờ' : 'Hiện bóng'}
            </button>
          </div>
        </div>

        {/* Right: Character Insights, Mnemonics & Compound Words */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-800 bg-[#0E1017] p-6 space-y-5">
          <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-hanzi text-4xl font-bold text-white">{activeChar}</span>
                <div>
                  <div className="flex items-center gap-2">
                    {insight?.hv && (
                      <span className="px-2.5 py-0.5 rounded bg-rose-600/20 border border-rose-500/30 text-rose-400 text-xs font-black uppercase">
                        Âm Hán Việt: {insight.hv}
                      </span>
                    )}
                    {insight?.p && (
                      <span className="text-base font-bold text-amber-300">{insight.p}</span>
                    )}
                  </div>
                  {insight?.vi && <p className="text-sm text-zinc-200 mt-1">{insight.vi}</p>}
                </div>
              </div>
            </div>

            <button
              onClick={() => speakChinese(activeChar, speechRate)}
              className="p-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
              title="Phát âm chữ này"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>

          {/* Mnemonic & Stroke Order Guide */}
          {(insight?.mn || insight?.sh) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {insight.mn && (
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/25 p-4 space-y-1">
                  <div className="text-xs font-bold text-amber-400 uppercase">Chiết tự & Mẹo nhớ lâu</div>
                  <p className="text-xs text-zinc-200 leading-relaxed">{insight.mn}</p>
                </div>
              )}
              {insight.sh && (
                <div className="rounded-xl bg-sky-500/5 border border-sky-500/25 p-4 space-y-1">
                  <div className="text-xs font-bold text-sky-400 uppercase">Quy tắc bút thuận</div>
                  <p className="text-xs text-zinc-200 leading-relaxed">{insight.sh}</p>
                </div>
              )}
            </div>
          )}

          {/* Compound Words in HSK */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Từ ghép HSK chứa chữ "{activeChar}"
            </h3>
            {relatedWords.length === 0 ? (
              <p className="text-xs text-zinc-500">Không có từ ghép khác trong danh mục HSK.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {relatedWords.map((rw) => (
                  <div
                    key={rw.id}
                    onClick={() => {
                      setInputText(rw.h);
                      setActiveCharIdx(0);
                      speakChinese(rw.h, speechRate);
                    }}
                    className="rounded-xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-3 flex items-center justify-between gap-2 cursor-pointer transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-hanzi text-lg font-bold text-white">{rw.h}</span>
                        <span className="text-xs text-amber-300">{rw.p}</span>
                        <span className="text-[10px] font-mono-code text-zinc-500">HSK {rw.l}</span>
                      </div>
                      <p className="text-xs text-zinc-400 truncate">{rw.vi}</p>
                    </div>
                    <Volume2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
