import { useMemo, useState } from 'react';
import { PenTool, Search, Star, Volume2, X } from 'lucide-react';
import { speakChinese } from '../lib/speech';
import { isMastered, parseMeaningAndMeasureWords, stripVietnameseAccents } from '../lib/srs';
import type { CharInsight, LevelFilter, SrsRecord, VocabItem } from '../types';

interface DictionaryViewProps {
  vocab: VocabItem[];
  charInsights: Record<string, CharInsight>;
  selectedLevel: LevelFilter;
  srsMap: Record<number, SrsRecord>;
  bookmarks: number[];
  speechRate: number;
  onToggleBookmark: (wordId: number) => void;
  onOpenStrokeLab: (word: string) => void;
}

type StatusFilter = 'all' | 'bookmarked' | 'mastered' | 'unseen';

export function DictionaryView({
  vocab,
  charInsights,
  selectedLevel,
  srsMap,
  bookmarks,
  speechRate,
  onToggleBookmark,
  onOpenStrokeLab,
}: DictionaryViewProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [visibleLimit, setVisibleLimit] = useState(60);
  const [inspectedWord, setInspectedWord] = useState<VocabItem | null>(null);

  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);

  const filtered = useMemo(() => {
    const qRaw = query.trim().toLowerCase();
    const qNoAccent = stripVietnameseAccents(qRaw);
    const qCompact = qNoAccent.replace(/\s+/g, '');

    return vocab.filter((w) => {
      if (selectedLevel !== 'all' && w.l !== selectedLevel) return false;
      if (statusFilter === 'bookmarked' && !bookmarkSet.has(w.id)) return false;
      if (statusFilter === 'mastered' && !isMastered(srsMap[w.id])) return false;
      if (statusFilter === 'unseen' && srsMap[w.id]) return false;

      if (!qRaw) return true;
      if (w.h.includes(qRaw)) return true;
      if (w.pn.includes(qCompact)) return true;
      if (w.p.toLowerCase().includes(qRaw)) return true;
      if (w.hv && (w.hv.includes(qRaw) || stripVietnameseAccents(w.hv).includes(qNoAccent))) return true;
      if (w.vi.toLowerCase().includes(qRaw) || stripVietnameseAccents(w.vi).includes(qNoAccent)) return true;
      if (w.en.toLowerCase().includes(qRaw)) return true;
      return false;
    });
  }, [vocab, selectedLevel, statusFilter, query, bookmarkSet, srsMap]);

  const displayed = filtered.slice(0, visibleLimit);

  return (
    <div className="space-y-5 pb-20 lg:pb-8">
      {/* Search & Filter Header */}
      <div className="rounded-2xl border border-zinc-800 bg-[#0E1017] p-4 sm:p-5 space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisibleLimit(60);
            }}
            placeholder="Tra chữ Hán (经济), Pinyin không dấu (jingji), âm Hán Việt (kinh tế) hoặc nghĩa tiếng Việt..."
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:outline-none text-sm text-white placeholder:text-zinc-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'bookmarked', label: 'Đã lưu sao' },
                { id: 'mastered', label: 'Đã thuộc vững' },
                { id: 'unseen', label: 'Chưa học' },
              ] as { id: StatusFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setStatusFilter(f.id);
                  setVisibleLimit(60);
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-rose-600 text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="font-mono-code text-zinc-400">
            Tìm thấy <strong className="text-white">{filtered.length.toLocaleString()}</strong> từ
          </span>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {displayed.map((w) => {
          const { cleanVi, measureWords } = parseMeaningAndMeasureWords(w.vi);
          const rec = srsMap[w.id];
          const starred = bookmarkSet.has(w.id);

          return (
            <div
              key={w.id}
              onClick={() => setInspectedWord(w)}
              className="rounded-xl border border-zinc-800/90 bg-[#0E1017] hover:border-zinc-600 p-4 transition cursor-pointer flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-hanzi text-2xl font-bold text-white">{w.h}</span>
                      <span className="text-sm font-medium text-amber-300">{w.p}</span>
                    </div>
                    {w.hv && (
                      <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 mt-0.5">
                        {w.hv}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold bg-zinc-900 border border-zinc-800 text-zinc-400">
                      HSK {w.l}
                    </span>
                    <button
                      onClick={() => speakChinese(w.h, speechRate)}
                      className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 cursor-pointer"
                      title="Nghe phát âm"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onToggleBookmark(w.id)}
                      className="p-1.5 rounded-md hover:bg-zinc-800 cursor-pointer"
                      title="Lưu từ"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          starred ? 'fill-amber-400 text-amber-400' : 'text-zinc-500'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-zinc-300 mt-2 line-clamp-2 leading-relaxed">{cleanVi}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px]">
                <span className="text-zinc-500">
                  {measureWords ? `LT: ${measureWords}` : rec ? `Chu kỳ SRS: ${rec.interval}d` : 'Chưa ôn SRS'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenStrokeLab(w.h);
                  }}
                  className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <PenTool className="w-3 h-3" />
                  Tập viết
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More */}
      {visibleLimit < filtered.length && (
        <div className="text-center pt-2">
          <button
            onClick={() => setVisibleLimit((v) => v + 90)}
            className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200 cursor-pointer"
          >
            Xem thêm ({filtered.length - visibleLimit} từ còn lại)
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {inspectedWord && (
        <div
          onClick={() => setInspectedWord(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-[#11131C] p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-rose-600/20 text-rose-400 border border-rose-500/30 text-xs font-bold">
                    HSK {inspectedWord.l}
                  </span>
                  {inspectedWord.hv && (
                    <span className="px-2.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-xs font-bold uppercase">
                      {inspectedWord.hv}
                    </span>
                  )}
                </div>
                <div className="font-hanzi text-5xl font-bold text-white mt-2">{inspectedWord.h}</div>
                <div className="text-lg text-amber-300 font-semibold mt-1">{inspectedWord.p}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => speakChinese(inspectedWord.h, speechRate)}
                  className="p-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setInspectedWord(null)}
                  className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-zinc-800 pt-4">
              <div className="text-xs font-semibold uppercase text-zinc-500">Nghĩa Tiếng Việt</div>
              <div className="text-base font-semibold text-zinc-100">{inspectedWord.vi}</div>
              {inspectedWord.en && <div className="text-xs text-zinc-400">EN: {inspectedWord.en}</div>}
            </div>

            {/* Character Breakdown */}
            <div className="space-y-2 border-t border-zinc-800 pt-4">
              <div className="text-xs font-semibold uppercase text-zinc-500">Phân tích từng chữ Hán</div>
              {Array.from(inspectedWord.h)
                .filter((c) => c >= '\u4e00' && c <= '\u9fff')
                .map((ch, idx) => {
                  const ci = charInsights[ch];
                  return (
                    <div
                      key={`${ch}-${idx}`}
                      className="rounded-xl bg-zinc-900/90 border border-zinc-800 p-3.5 flex items-start gap-3"
                    >
                      <div className="font-hanzi text-3xl font-bold text-white w-12 h-12 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                        {ch}
                      </div>
                      <div className="space-y-1 text-xs flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold uppercase text-rose-400">{ci?.hv || 'Hán tự'}</span>
                          {ci?.p && <span className="text-amber-300">{ci.p}</span>}
                          {ci?.sc ? <span className="text-zinc-500 font-mono-code">{ci.sc} nét</span> : null}
                        </div>
                        {ci?.vi && <div className="text-zinc-200">{ci.vi}</div>}
                        {ci?.mn && <div className="text-amber-300/90">Mẹo nhớ: {ci.mn}</div>}
                        {ci?.sh && <div className="text-zinc-400">Bút thuận: {ci.sh}</div>}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  const target = inspectedWord.h;
                  setInspectedWord(null);
                  onOpenStrokeLab(target);
                }}
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <PenTool className="w-3.5 h-3.5" />
                Đưa sang Phòng Tập Viết
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
