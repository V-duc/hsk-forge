import {
  BookOpen,
  Compass,
  Download,
  Flame,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  PenTool,
  Search,
  Trophy,
  Upload,
  UserCheck,
  UserPlus,
  Volume2,
} from 'lucide-react';
import type { AuthUser, LevelFilter, NavTab } from '../types';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  selectedLevel: LevelFilter;
  onSelectLevel: (level: LevelFilter) => void;
  dueCount: number;
  streak: number;
  todayDone: number;
  dailyGoal: number;
  speechRate: number;
  onChangeSpeechRate: (rate: number) => void;
  currentUser: AuthUser | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
}

const NAV_ITEMS: { id: NavTab; label: string; short: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Tổng quan', short: 'Tổng quan', icon: LayoutDashboard },
  { id: 'roadmap', label: 'Lộ trình Buổi học', short: 'Lộ trình', icon: Compass },
  { id: 'exam', label: 'Thi Mô Phỏng 4 Kỹ Năng', short: 'Thi thử', icon: GraduationCap },
  { id: 'leaderboard', label: 'Bảng Xếp Hạng', short: 'Đua Top', icon: Trophy },
  { id: 'flashcards', label: 'SRS Flashcard', short: 'SRS', icon: Layers },
  { id: 'writing', label: 'Luyện viết Hán tự', short: 'Tập viết', icon: PenTool },
  { id: 'dictionary', label: 'Từ điển HSK 1-6', short: 'Từ điển', icon: Search },
  { id: 'grammar', label: 'Kho Ngữ pháp', short: 'Ngữ pháp', icon: BookOpen },
];

const LEVELS: LevelFilter[] = ['all', 1, 2, 3, 4, 5, 6];

export function Navbar({
  activeTab,
  onSelectTab,
  selectedLevel,
  onSelectLevel,
  dueCount,
  streak,
  todayDone,
  dailyGoal,
  speechRate,
  onChangeSpeechRate,
  currentUser,
  onOpenAuth,
  onLogout,
  onExportJson,
  onImportJson,
}: NavbarProps) {
  const goalPct = Math.min(100, Math.round((todayDone / Math.max(1, dailyGoal)) * 100));

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-68 lg:shrink-0 border-r border-zinc-800/80 bg-[#0C0E14] min-h-screen sticky top-0 h-screen select-none">
        <div className="p-4 border-b border-zinc-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-600/25 border border-rose-400/30 font-hanzi text-xl font-black text-white">
            汉
          </div>
          <div>
            <div className="font-extrabold tracking-tight text-base text-white flex items-center gap-2">
              HSK FORGE
              <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-zinc-800 text-rose-400 border border-zinc-700">
                ONLINE
              </span>
            </div>
            <p className="text-xs text-zinc-400">Multi-User · Thi 4 Kỹ năng</p>
          </div>
        </div>

        {/* Multi-user Account Strip */}
        <div className="px-4 py-3 border-b border-zinc-800/60 bg-[#0A0C12]">
          {currentUser ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {currentUser.displayName}
                </div>
                <div className="text-[10px] font-mono-code text-emerald-400 truncate">
                  @{currentUser.username} · {currentUser.mode === 'cloud' ? 'Đã đồng bộ Cloud' : 'Hồ sơ máy'}
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-rose-400 cursor-pointer"
                title="Đăng xuất / Đổi tài khoản"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="w-full py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow shadow-rose-600/25 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Đăng ký / Đăng nhập tài khoản
            </button>
          )}
        </div>

        {/* Global HSK Level Filter */}
        <div className="px-4 pt-3 pb-3 border-b border-zinc-800/60">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
            Cấp độ mục tiêu
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {LEVELS.map((lv) => {
              const active = selectedLevel === lv;
              return (
                <button
                  key={String(lv)}
                  onClick={() => onSelectLevel(lv)}
                  className={`py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                    active
                      ? 'bg-rose-600 text-white shadow shadow-rose-600/30'
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800'
                  } ${lv === 'all' ? 'col-span-2' : ''}`}
                >
                  {lv === 'all' ? 'Tất cả (1-6)' : `HSK ${lv}`}
                </button>
              );
            })}
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                  active
                    ? 'bg-rose-600/15 text-rose-400 border border-rose-500/30'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-rose-400' : 'text-zinc-500'}`} />
                  {item.label}
                </span>
                {item.id === 'flashcards' && dueCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-mono-code font-bold rounded-full bg-rose-600 text-white">
                    {dueCount > 99 ? '99+' : dueCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800/80 space-y-2.5 bg-[#0A0B10]">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <Flame className="w-4 h-4 fill-amber-400/20" />
              Chuỗi {streak} ngày
            </span>
            <span className="font-mono-code text-zinc-400">
              {todayDone}/{dailyGoal} thẻ
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-300"
              style={{ width: `${goalPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between pt-0.5 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
              Tốc độ đọc
            </span>
            <div className="flex gap-1">
              {[0.7, 0.9, 1.1].map((r) => (
                <button
                  key={r}
                  onClick={() => onChangeSpeechRate(r)}
                  className={`px-1.5 py-0.5 rounded font-mono-code text-[11px] cursor-pointer ${
                    Math.abs(speechRate - r) < 0.05
                      ? 'bg-zinc-700 text-white font-bold'
                      : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              onClick={onExportJson}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Lưu JSON
            </button>
            <label className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Nạp JSON
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportJson(file);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-30 bg-[#0C0E14]/95 backdrop-blur border-b border-zinc-800 px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-rose-600 flex items-center justify-center font-hanzi font-black text-white text-sm">
            汉
          </div>
          <span className="font-bold text-xs text-white">HSK FORGE</span>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={String(selectedLevel)}
            onChange={(e) => {
              const v = e.target.value;
              onSelectLevel(v === 'all' ? 'all' : (Number(v) as LevelFilter));
            }}
            className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-[11px] font-bold text-zinc-100"
          >
            <option value="all">HSK 1-6</option>
            {[1, 2, 3, 4, 5, 6].map((lv) => (
              <option key={lv} value={lv}>
                HSK {lv}
              </option>
            ))}
          </select>

          {currentUser ? (
            <button
              onClick={onLogout}
              className="px-2 py-1 rounded bg-emerald-950/60 border border-emerald-700/50 text-[11px] font-bold text-emerald-300"
              title="Đổi tài khoản"
            >
              @{currentUser.username}
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-2.5 py-1 rounded bg-rose-600 text-[11px] font-bold text-white"
            >
              Đăng nhập
            </button>
          )}
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0C0E14]/95 backdrop-blur border-t border-zinc-800 grid grid-cols-8 py-1.5 px-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 rounded text-[8px] font-medium relative ${
                active ? 'text-rose-400' : 'text-zinc-500'
              }`}
            >
              <Icon className="w-3.5 h-3.5 mb-0.5" />
              <span className="truncate max-w-full px-0.5">{item.short}</span>
              {item.id === 'flashcards' && dueCount > 0 && (
                <span className="absolute top-0.5 right-1 w-1.5 h-1.5 rounded-full bg-rose-500" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
