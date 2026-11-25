import { useCallback, useEffect, useState } from 'react';
import { Crown, Flame, RefreshCw, Trophy, UserPlus } from 'lucide-react';
import { apiFetchLeaderboard } from '../lib/api';
import type { AuthUser, LeaderboardRow } from '../types';

interface LeaderboardViewProps {
  currentUser: AuthUser | null;
  onOpenAuth: () => void;
}

export function LeaderboardView({ currentUser, onOpenAuth }: LeaderboardViewProps) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await apiFetchLeaderboard();
    setRows(res.rows);
    setOnline(res.online);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 lg:pb-8">
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-[#151324] via-[#0E1017] to-[#1A0E14] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400">
            <Trophy className="w-4 h-4" />
            BẢNG PHONG THẦN HỌC VIÊN HSK
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            Đấu Trường Xếp Hạng Nhiều Người Học
          </h2>
          <p className="text-xs text-zinc-400">
            Trạng thái:{' '}
            <span className={online ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
              {online ? 'Máy chủ Multi-User trực tuyến (Realtime SQLite)' : 'Chế độ tài khoản cục bộ'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {!currentUser && (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Đăng ký ghi danh
            </button>
          )}
          <button
            onClick={() => void refresh()}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-800 bg-[#0E1017] overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Crown className="w-10 h-10 text-amber-400 mx-auto" />
            <div className="text-sm font-bold text-white">
              Chưa có học viên nào ghi danh trên bảng xếp hạng!
            </div>
            <p className="text-xs text-zinc-400">
              Hãy bấm "Đăng ký ghi danh" để chiếm vị trí Top 1 đầu tiên của server.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Hạng</th>
                  <th className="py-3.5 px-4">Học viên</th>
                  <th className="py-3.5 px-4 text-right">Điểm Chiến Lực</th>
                  <th className="py-3.5 px-4 text-right">Buổi xong</th>
                  <th className="py-3.5 px-4 text-right">Từ thuộc vững</th>
                  <th className="py-3.5 px-4 text-right">Đỉnh HSK /300</th>
                  <th className="py-3.5 px-4 text-right">Chuỗi ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {rows.map((r, idx) => {
                  const isMe = currentUser?.username === r.username;
                  return (
                    <tr
                      key={r.username}
                      className={isMe ? 'bg-rose-600/10' : 'hover:bg-zinc-900/50'}
                    >
                      <td className="py-3.5 px-4 font-mono-code font-black">
                        {idx === 0 ? (
                          <span className="text-amber-400 text-sm">#1 👑</span>
                        ) : idx === 1 ? (
                          <span className="text-zinc-200 text-sm">#2</span>
                        ) : idx === 2 ? (
                          <span className="text-amber-600 text-sm">#3</span>
                        ) : (
                          <span className="text-zinc-500">#{idx + 1}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white flex items-center gap-2">
                          {r.display_name}
                          {isMe && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-[10px] text-white">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono-code text-zinc-500">@{r.username}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-code font-extrabold text-rose-400">
                        {r.xp.toLocaleString()} XP
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-code text-emerald-400 font-bold">
                        {r.sessions_done}/69
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-code text-zinc-200">
                        {r.mastered_count}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-code text-sky-400 font-bold">
                        {r.best_hsk_score}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-code text-amber-400 font-bold">
                        <span className="inline-flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5" />
                          {r.streak}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
