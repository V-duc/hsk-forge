import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  PenTool,
  Shuffle,
  Sparkles,
  Star,
  Turtle,
  Volume2,
  X,
} from 'lucide-react';
import { speakChinese } from '../lib/speech';
import { parseMeaningAndMeasureWords, previewIntervalLabel } from '../lib/srs';
import type { CharInsight, LevelFilter, SrsRecord, VocabItem } from '../types';

export type DeckMode = 'smart' | 'due' | 'bookmarked' | 'hard';

interface FlashcardViewProps {
  vocab: VocabItem[];
  charInsights: Record<string, CharInsight>;
  selectedLevel: LevelFilter;
  srsMap: Record<number, SrsRecord>;
  bookmarks: number[];
  speechRate: number;
  initialDeckMode?: DeckMode;
  sessionFilter?: { label: string; wordIds: number[] } | null;
  onClearSessionFilter?: () => void;
  onGradeWord: (wordId: number, grade: 1 | 2 | 3 | 4) => void;
  onToggleBookmark: (wordId: number) => void;
  onOpenStrokeLab: (word: string) => void;
}

export function FlashcardView({
  vocab,
  charInsights,
  selectedLevel,
  srsMap,
  bookmarks,
  speechRate,
  initialDeckMode = 'smart',
  sessionFilter = null,
  onClearSessionFilter,
  onGradeWord,
  onToggleBookmark,
  onOpenStrokeLab,
}: FlashcardViewProps) {
  const [deckMode, setDeckMode] = useState<DeckMode>(initialDeckMode);
  const [flipped, setFlipped] = useState(false);
  const [showPinyinFront, setShowPinyinFront] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [cursor, setCursor] = useState(0);

  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);

  const deck = useMemo(() => {
    const now = Date.now();
    let base: VocabItem[];

    if (sessionFilter && sessionFilter.wordIds.length > 0) {
      const idSet = new Set(sessionFilter.wordIds);
      base = vocab.filter((w) => idSet.has(w.id));
    } else {
      base = selectedLevel === 'all' ? vocab : vocab.filter((w) => w.l === selectedLevel);
    }

    let filtered: VocabItem[] = [];
    if (sessionFilter) {
      filtered = base;
    } else if (deckMode === 'due') {
      filtered = base.filter((w) => {
        const rec = srsMap[w.id];
        return rec && rec.nextReview <= now;
      });
    } else if (deckMode === 'bookmarked') {
      filtered = base.filter((w) => bookmarkSet.has(w.id));
    } else if (deckMode === 'hard') {
      filtered = base.filter((w) => (srsMap[w.id]?.lapses ?? 0) > 0);
    } else {
      const due: VocabItem[] = [];
      const fresh: VocabItem[] = [];
      const later: VocabItem[] = [];
      for (const w of base) {
        const rec = srsMap[w.id];
        if (!rec) fresh.push(w);
        else if (rec.nextReview <= now) due.push(w);
        else later.push(w);
      }
      filtered = [...due, ...fresh, ...later];
    }

    if (shuffleSeed > 0) {
      const copy = [...filtered];
      let s = shuffleSeed;
      for (let i = copy.length - 1; i > 0; i--) {
        s = (s * 1664525 + 1013904223) % 4294967296;
        const j = s % (i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }

    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocab, selectedLevel, deckMode, shuffleSeed, bookmarks.length, sessionFilter]);

  const safeCursor = deck.length > 0 ? cursor % deck.length : 0;
  const currentWord = deck[safeCursor] ?? null;
  const currentSrs = currentWord ? srsMap[currentWord.id] : undefined;

  const handleGrade = useCallback(
    (grade: 1 | 2 | 3 | 4) => {
      if (!currentWord) return;
      onGradeWord(currentWord.id, grade);
      setFlipped(false);
      setCursor((prev) => (prev + 1 < deck.length ? prev + 1 : 0));
    },
    [currentWord, deck.length, onGradeWord]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => {
          const next = !f;
          if (next && currentWord) speakChinese(currentWord.h, speechRate);
          return next;
        });
      } else if (e.key === 'r' || e.key === 'R') {
        if (currentWord) speakChinese(currentWord.h, speechRate);
      } else if (e.key === 'p' || e.key === 'P') {
        setShowPinyinFront((v) => !v);
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        handleGrade(Number(e.key) as 1 | 2 | 3 | 4);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentWord, flipped, handleGrade, speechRate]);

  const parsedVi = useMemo(
    () => (currentWord ? parseMeaningAndMeasureWords(currentWord.vi) : { cleanVi: '', measureWords: null }),
    [currentWord]
  );

  const charsInWord = useMemo(() => {
    if (!currentWord) return [];
    return Array.from(currentWord.h).filter((ch) => ch >= '\u4e00' && ch <= '\u9fff');
  }, [currentWord]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 lg:pb-8">
      {/* Active Session Filter Banner */}
      {sessionFilter && (
        <div className="rounded-xl bg-rose-600/15 border border-rose-500/40 px-4 py-3 flex items-center justify-between">
          <div className="text-xs font-bold text-rose-200">
            Đang khóa bộ từ của: <span className="text-white">{sessionFilter.label}</span> ({deck.length} từ)
          </div>
          {onClearSessionFilter && (
            <button
              onClick={() => {
                onClearSessionFilter();
                setCursor(0);
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Mở toàn bộ kho thẻ
            </button>
          )}
        </div>
      )}

      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!sessionFilter ? (
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'smart', label: 'Hàng đợi thông minh' },
                { id: 'due', label: 'Đến hạn ôn' },
                { id: 'bookmarked', label: 'Đã lưu sao' },
                { id: 'hard', label: 'Từ hay quên' },
              ] as { id: DeckMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setDeckMode(m.id);
                  setCursor(0);
                  setFlipped(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  deckMode === m.id
                    ? 'bg-rose-600 text-white shadow shadow-rose-600/25'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPinyinFront((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5 cursor-pointer"
          >
            {showPinyinFront ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5" />}
            Pinyin mặt trước
          </button>
          <button
            onClick={() => {
              setShuffleSeed((s) => s + 1);
              setCursor(0);
              setFlipped(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5 cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Trộn thẻ
          </button>
        </div>
      </div>

      {!currentWord ? (
        <div className="rounded-2xl border border-zinc-800 bg-[#0E1017] p-12 text-center space-y-3">
          <Sparkles className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-lg font-bold text-white">Không còn thẻ nào trong bộ lọc này!</h3>
          <p className="text-xs text-zinc-400">
            Chuyển sang chế độ "Hàng đợi thông minh" hoặc chọn cấp độ HSK khác để học tiếp từ mới.
          </p>
          <button
            onClick={() => setDeckMode('smart')}
            className="mt-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
          >
            Mở hàng đợi thông minh
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>
              Thẻ <strong className="font-mono-code text-zinc-200">{safeCursor + 1}</strong> /{' '}
              <span className="font-mono-code">{deck.length}</span>
            </span>
            <span className="font-mono-code">
              {currentSrs
                ? `Chu kỳ: ${currentSrs.interval}d · Hệ số: ${currentSrs.ease} · Quên: ${currentSrs.lapses}`
                : 'Thẻ mới tinh'}
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-[#131622] to-[#0D0F17] shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-rose-600/20 text-rose-400 border border-rose-500/30">
                  HSK {currentWord.l}
                </span>
                <span className="text-xs font-mono-code text-zinc-500">#{currentWord.id}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => speakChinese(currentWord.h, speechRate)}
                  className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-rose-400 transition cursor-pointer"
                  title="Phát âm chuẩn (Phím R)"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => speakChinese(currentWord.h, 0.6)}
                  className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-amber-400 transition cursor-pointer"
                  title="Phát âm chậm 0.6x"
                >
                  <Turtle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onOpenStrokeLab(currentWord.h)}
                  className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-sky-400 transition cursor-pointer"
                  title="Tập viết chữ này"
                >
                  <PenTool className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onToggleBookmark(currentWord.id)}
                  className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition cursor-pointer"
                  title="Đánh dấu sao"
                >
                  <Star
                    className={`w-4 h-4 ${
                      bookmarkSet.has(currentWord.id)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-zinc-400 hover:text-amber-300'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div
              onClick={() => {
                const next = !flipped;
                setFlipped(next);
                if (next) speakChinese(currentWord.h, speechRate);
              }}
              className="px-6 py-10 sm:py-14 text-center cursor-pointer select-none min-h-[280px] flex flex-col items-center justify-center"
            >
              {(showPinyinFront || flipped) && (
                <div className="text-xl sm:text-2xl font-semibold text-amber-300 tracking-wide mb-2">
                  {currentWord.p}
                </div>
              )}

              <div className="font-hanzi text-6xl sm:text-7xl font-bold text-white tracking-wider my-2">
                {currentWord.h}
              </div>

              {!flipped ? (
                <p className="text-xs text-zinc-500 mt-6">
                  Chạm vào thẻ hoặc bấm{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-mono-code">
                    Space
                  </kbd>{' '}
                  để lật đáp án
                </p>
              ) : (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-xl mt-6 pt-6 border-t border-zinc-800/90 text-left space-y-4 cursor-default"
                >
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {currentWord.hv && (
                      <span className="px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                        Hán Việt: {currentWord.hv}
                      </span>
                    )}
                    {parsedVi.measureWords && (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold font-hanzi">
                        Lượng từ: {parsedVi.measureWords}
                      </span>
                    )}
                  </div>

                  <div className="text-center space-y-1.5">
                    <div className="text-lg sm:text-xl font-bold text-zinc-100 leading-snug">
                      {parsedVi.cleanVi}
                    </div>
                    {currentWord.en && currentWord.en !== parsedVi.cleanVi && (
                      <div className="text-xs text-zinc-500">{currentWord.en}</div>
                    )}
                  </div>

                  {charsInWord.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      {charsInWord.map((ch, idx) => {
                        const info = charInsights[ch];
                        return (
                          <div
                            key={`${ch}-${idx}`}
                            className="rounded-xl bg-zinc-900/85 border border-zinc-800 p-3 flex items-start gap-3"
                          >
                            <button
                              onClick={() => onOpenStrokeLab(ch)}
                              className="w-11 h-11 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-rose-500/50 font-hanzi text-2xl font-bold text-white shrink-0 flex items-center justify-center cursor-pointer"
                              title="Xem thứ tự nét viết"
                            >
                              {ch}
                            </button>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-2 text-xs">
                                {info?.hv && (
                                  <span className="font-bold uppercase text-rose-400">{info.hv}</span>
                                )}
                                {info?.p && <span className="text-zinc-400">{info.p}</span>}
                                {info?.sc ? (
                                  <span className="text-[10px] font-mono-code text-zinc-500">
                                    {info.sc} nét
                                  </span>
                                ) : null}
                              </div>
                              {info?.vi && (
                                <p className="text-xs text-zinc-300 line-clamp-2">{info.vi}</p>
                              )}
                              {info?.mn && (
                                <p className="text-[11px] text-amber-300/85 leading-relaxed pt-0.5">
                                  Mẹo: {info.mn}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {flipped && (
              <div className="p-4 bg-[#0A0C12] border-t border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  onClick={() => handleGrade(1)}
                  className="py-2.5 px-3 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-700/50 text-rose-200 flex flex-col items-center transition cursor-pointer"
                >
                  <span className="text-xs font-bold">1 · Quên sạch</span>
                  <span className="text-[11px] font-mono-code text-rose-400">
                    {previewIntervalLabel(currentSrs, 1)}
                  </span>
                </button>
                <button
                  onClick={() => handleGrade(2)}
                  className="py-2.5 px-3 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-700/40 text-amber-200 flex flex-col items-center transition cursor-pointer"
                >
                  <span className="text-xs font-bold">2 · Nhớ mang máng</span>
                  <span className="text-[11px] font-mono-code text-amber-400">
                    {previewIntervalLabel(currentSrs, 2)}
                  </span>
                </button>
                <button
                  onClick={() => handleGrade(3)}
                  className="py-2.5 px-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-700/40 text-emerald-200 flex flex-col items-center transition cursor-pointer"
                >
                  <span className="text-xs font-bold">3 · Nhớ tốt</span>
                  <span className="text-[11px] font-mono-code text-emerald-400">
                    {previewIntervalLabel(currentSrs, 3)}
                  </span>
                </button>
                <button
                  onClick={() => handleGrade(4)}
                  className="py-2.5 px-3 rounded-xl bg-sky-950/40 hover:bg-sky-900/50 border border-sky-700/40 text-sky-200 flex flex-col items-center transition cursor-pointer"
                >
                  <span className="text-xs font-bold">4 · Quá dễ</span>
                  <span className="text-[11px] font-mono-code text-sky-400">
                    {previewIntervalLabel(currentSrs, 4)}
                  </span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
