import { computeStreak, DEFAULT_STORE, isMastered } from './srs';
import type { AuthUser, LeaderboardRow, UserStore } from '../types';

const TOKEN_KEY = 'hsk_forge_token_v1';
const USER_KEY = 'hsk_forge_user_v1';
const API_BASE_KEY = 'hsk_forge_api_base_v1';
const LOCAL_ACCOUNTS_KEY = 'hsk_forge_local_accounts_v1';

interface LocalAccountEntry {
  username: string;
  displayName: string;
  password: string;
  store: UserStore;
  updatedAt: number;
}

export function getApiBase(): string {
  try {
    return (localStorage.getItem(API_BASE_KEY) || '').replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function setApiBase(url: string): void {
  try {
    localStorage.setItem(API_BASE_KEY, url.trim().replace(/\/+$/, ''));
  } catch {
    // Ignore
  }
}

export function getSavedAuth(): { token: string | null; user: AuthUser | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    return {
      token,
      user: rawUser ? (JSON.parse(rawUser) as AuthUser) : null,
    };
  } catch {
    return { token: null, user: null };
  }
}

export function saveAuthSession(token: string, user: AuthUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore
  }
}

function normalizeStore(raw: Partial<UserStore> | undefined): UserStore {
  return {
    ...DEFAULT_STORE,
    ...(raw ?? {}),
    srs: raw?.srs ?? {},
    bookmarks: Array.isArray(raw?.bookmarks) ? raw.bookmarks : [],
    dailyCount: raw?.dailyCount ?? {},
    examHistory: Array.isArray(raw?.examHistory) ? raw.examHistory : [],
    completedSessions: Array.isArray(raw?.completedSessions) ? raw.completedSessions : [],
    checkedSessionSteps: raw?.checkedSessionSteps ?? {},
  };
}

function loadLocalAccounts(): Record<string, LocalAccountEntry> {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalAccountEntry>) : {};
  } catch {
    return {};
  }
}

function saveLocalAccounts(map: Record<string, LocalAccountEntry>): void {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(map));
  } catch {
    // Ignore
  }
}

export async function checkBackendOnline(): Promise<boolean> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/health`, { method: 'GET' });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data?.ok);
  } catch {
    return false;
  }
}

export async function apiRegister(
  username: string,
  displayName: string,
  password: string,
  currentStore: UserStore
): Promise<{ token: string; user: AuthUser; store: UserStore }> {
  const cleanUser = username.trim().toLowerCase();
  const cleanName = (displayName.trim() || cleanUser).slice(0, 40);
  const online = await checkBackendOnline();

  if (online) {
    const base = getApiBase();
    const res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUser,
        displayName: cleanName,
        password,
        store: currentStore,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      token?: string;
      user?: { id: number; username: string; displayName: string };
      store?: Partial<UserStore>;
    };
    if (!res.ok || !data.token || !data.user) {
      throw new Error(data.error || 'Đăng ký thất bại');
    }
    const authUser: AuthUser = { ...data.user, mode: 'cloud' };
    saveAuthSession(data.token, authUser);
    return { token: data.token, user: authUser, store: normalizeStore(data.store) };
  }

  // Fallback multi-profile account on static deployment when cloud server is offline
  if (!/^[a-z0-9_.-]{3,24}$/.test(cleanUser)) {
    throw new Error('Tên đăng nhập dài 3-24 ký tự (chữ thường, số, gạch dưới).');
  }
  if (password.length < 4) {
    throw new Error('Mật khẩu tối thiểu 4 ký tự.');
  }
  const accounts = loadLocalAccounts();
  if (accounts[cleanUser]) {
    throw new Error('Tài khoản này đã tồn tại trên thiết bị!');
  }
  accounts[cleanUser] = {
    username: cleanUser,
    displayName: cleanName,
    password,
    store: currentStore,
    updatedAt: Date.now(),
  };
  saveLocalAccounts(accounts);
  const authUser: AuthUser = { username: cleanUser, displayName: cleanName, mode: 'local' };
  const token = `local_${cleanUser}`;
  saveAuthSession(token, authUser);
  return { token, user: authUser, store: currentStore };
}

export async function apiLogin(
  username: string,
  password: string
): Promise<{ token: string; user: AuthUser; store: UserStore }> {
  const cleanUser = username.trim().toLowerCase();
  const online = await checkBackendOnline();

  if (online) {
    const base = getApiBase();
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUser, password }),
    });
    const data = (await res.json()) as {
      error?: string;
      token?: string;
      user?: { id: number; username: string; displayName: string };
      store?: Partial<UserStore>;
    };
    if (!res.ok || !data.token || !data.user) {
      throw new Error(data.error || 'Sai tài khoản hoặc mật khẩu');
    }
    const authUser: AuthUser = { ...data.user, mode: 'cloud' };
    saveAuthSession(data.token, authUser);
    return { token: data.token, user: authUser, store: normalizeStore(data.store) };
  }

  const accounts = loadLocalAccounts();
  const acc = accounts[cleanUser];
  if (!acc || acc.password !== password) {
    throw new Error('Sai tài khoản hoặc mật khẩu!');
  }
  const authUser: AuthUser = {
    username: acc.username,
    displayName: acc.displayName,
    mode: 'local',
  };
  const token = `local_${cleanUser}`;
  saveAuthSession(token, authUser);
  return { token, user: authUser, store: normalizeStore(acc.store) };
}

export async function apiFetchMe(token: string, user: AuthUser): Promise<UserStore | null> {
  if (user.mode === 'cloud') {
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { store?: Partial<UserStore> };
      return normalizeStore(data.store);
    } catch {
      return null;
    }
  }
  const accounts = loadLocalAccounts();
  const acc = accounts[user.username];
  return acc ? normalizeStore(acc.store) : null;
}

export async function apiSyncStore(
  token: string,
  user: AuthUser,
  store: UserStore
): Promise<boolean> {
  if (user.mode === 'cloud') {
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/sync`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ store }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  const accounts = loadLocalAccounts();
  if (accounts[user.username]) {
    accounts[user.username].store = store;
    accounts[user.username].updatedAt = Date.now();
    saveLocalAccounts(accounts);
  }
  return true;
}

export async function apiFetchLeaderboard(): Promise<{
  online: boolean;
  rows: LeaderboardRow[];
}> {
  const online = await checkBackendOnline();
  if (online) {
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/leaderboard`);
      if (res.ok) {
        const data = (await res.json()) as { leaderboard?: LeaderboardRow[] };
        return { online: true, rows: data.leaderboard ?? [] };
      }
    } catch {
      // Fall through
    }
  }

  // Fallback local multi-profile leaderboard
  const accounts = Object.values(loadLocalAccounts());
  const rows: LeaderboardRow[] = accounts
    .map((acc) => {
      const s = acc.store;
      const mastered = Object.values(s.srs ?? {}).filter((r) => isMastered(r)).length;
      const sessions = (s.completedSessions ?? []).length;
      const bestScore = (s.examHistory ?? []).reduce(
        (m, ex) => Math.max(m, ex.scaledScore ?? 0),
        0
      );
      const reviews = Object.values(s.dailyCount ?? {}).reduce((a, b) => a + b, 0);
      const streak = computeStreak(s.dailyCount ?? {});
      const xp = mastered * 10 + sessions * 25 + bestScore * 2 + reviews;
      return {
        username: acc.username,
        display_name: acc.displayName,
        mastered_count: mastered,
        sessions_done: sessions,
        best_hsk_score: bestScore,
        streak,
        total_reviews: reviews,
        xp,
        updated_at: acc.updatedAt,
      };
    })
    .sort((a, b) => b.xp - a.xp);

  return { online: false, rows };
}
