import { useState } from 'react';
import { Cloud, LogIn, Server, UserPlus, X } from 'lucide-react';
import { apiLogin, apiRegister, getApiBase, setApiBase } from '../lib/api';
import type { AuthUser, UserStore } from '../types';

interface AuthModalProps {
  currentStore: UserStore;
  onClose: () => void;
  onSuccess: (token: string, user: AuthUser, store: UserStore) => void;
}

export function AuthModal({ currentStore, onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [customApi, setCustomApi] = useState(() => getApiBase());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    setApiBase(customApi);

    try {
      const result =
        tab === 'register'
          ? await apiRegister(username, displayName, password, currentStore)
          : await apiLogin(username, password);
      onSuccess(result.token, result.user, result.store);
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'Xảy ra lỗi xác thực');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-[#10121B] p-6 space-y-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-600/20 text-rose-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Tài Khoản Học Viên</h3>
              <p className="text-xs text-zinc-400">
                Lưu tiến độ riêng cho từng người & đua Top Bảng Xếp Hạng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErr(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'register' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Đăng ký mới
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErr(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'login' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Đăng nhập
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">
              Tên đăng nhập (viết liền không dấu)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="vd: minh_hsk5"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:outline-none text-sm text-white"
            />
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Tên hiển thị trên Bảng Xếp Hạng
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="vd: Minh Nguyễn"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:outline-none text-sm text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Mật khẩu</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 4 ký tự..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:outline-none text-sm text-white"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
          >
            <Server className="w-3 h-3" />
            {showAdvanced ? 'Ẩn cấu hình máy chủ đồng bộ' : 'Cấu hình địa chỉ API Server (tùy chọn)'}
          </button>

          {showAdvanced && (
            <div>
              <input
                type="text"
                value={customApi}
                onChange={(e) => setCustomApi(e.target.value)}
                placeholder="Để trống nếu dùng chung domain server hiện tại..."
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono-code text-zinc-300"
              />
            </div>
          )}

          {err && (
            <div className="rounded-xl bg-rose-950/50 border border-rose-700/50 px-3.5 py-2.5 text-xs text-rose-300">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-extrabold text-sm transition cursor-pointer"
          >
            {busy
              ? 'Đang xử lý...'
              : tab === 'register'
                ? 'Tạo tài khoản & Lưu tiến độ hiện tại'
                : 'Đăng nhập & Tải tiến độ'}
          </button>
        </form>
      </div>
    </div>
  );
}
