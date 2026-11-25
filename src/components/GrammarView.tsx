import { useMemo, useState } from 'react';
import { AlertCircle, BookOpen, Search, Volume2 } from 'lucide-react';
import { GRAMMAR_PATTERNS } from '../data/grammarData';
import { speakChinese } from '../lib/speech';
import { stripVietnameseAccents } from '../lib/srs';
import type { LevelFilter } from '../types';

interface GrammarViewProps {
  selectedLevel: LevelFilter;
  speechRate: number;
}

export function GrammarView({ selectedLevel, speechRate }: GrammarViewProps) {
  const [search, setSearch] = useState('');

  const list = useMemo(() => {
    const q = stripVietnameseAccents(search.trim().toLowerCase());
    return GRAMMAR_PATTERNS.filter((g) => {
      if (selectedLevel !== 'all' && g.level !== selectedLevel) return false;
      if (!q) return true;
      const hay = stripVietnameseAccents(
        `${g.title} ${g.structure} ${g.summary} ${g.trap} ${g.examples.map((e) => e.zh + ' ' + e.vi).join(' ')}`
      );
      return hay.includes(q) || g.title.toLowerCase().includes(search.trim().toLowerCase());
    });
  }, [selectedLevel, search]);

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      <div className="rounded-2xl border border-zinc-800 bg-[#0E1017] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-rose-500" />
            Kho Chủ Điểm Ngữ Pháp & Bẫy Đề Thi HSK 1-6
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Tổng hợp các cấu trúc ăn điểm phần Sắp xếp câu, Điền từ và Sửa câu sai (病句) từ HSK 1 đến HSK 6.
          </p>
        </div>

        <div className="relative sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm 把, 被, 既然, 未免..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:outline-none text-xs text-white"
          />
        </div>
      </div>

      <div className="space-y-4">
        {list.map((g) => (
          <div key={g.id} className="rounded-2xl border border-zinc-800 bg-[#0E1017] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-md bg-rose-600/20 border border-rose-500/30 text-rose-400 text-xs font-black">
                  HSK {g.level}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white font-hanzi">{g.title}</h3>
              </div>
            </div>

            {/* Formula Box */}
            <div className="rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-3 font-mono-code text-xs sm:text-sm text-amber-300">
              Công thức: {g.structure}
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">{g.summary}</p>

            {/* Exam Trap Warning */}
            <div className="rounded-xl bg-rose-950/25 border border-rose-500/25 px-4 py-3 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-200/90 leading-relaxed">
                <strong className="text-rose-400">Bẫy đề thi: </strong>
                {g.trap}
              </p>
            </div>

            {/* Examples */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {g.examples.map((ex, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-zinc-900/80 border border-zinc-800/80 p-3.5 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="font-hanzi text-base font-bold text-white">{ex.zh}</div>
                    <div className="text-xs text-amber-300/90">{ex.py}</div>
                    <div className="text-xs text-zinc-400">{ex.vi}</div>
                  </div>
                  <button
                    onClick={() => speakChinese(ex.zh, speechRate)}
                    className="p-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-rose-400 shrink-0 cursor-pointer"
                    title="Nghe câu ví dụ"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
