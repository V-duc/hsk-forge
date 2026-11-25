import type { SrsRecord, UserStore } from '../types';

const STORAGE_KEY = 'hsk_forge_store_v2';
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const DEFAULT_STORE: UserStore = {
  srs: {},
  bookmarks: [],
  dailyCount: {},
  dailyGoal: 30,
  speechRate: 0.9,
  showPinyinDefault: false,
  examHistory: [],
  completedSessions: [],
  checkedSessionSteps: {},
};

export function getTodayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function loadStore(): UserStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('hsk_forge_store_v1');
    if (!raw) return { ...DEFAULT_STORE };
    const parsed = JSON.parse(raw) as Partial<UserStore>;
    return {
      ...DEFAULT_STORE,
      ...parsed,
      srs: parsed.srs ?? {},
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      dailyCount: parsed.dailyCount ?? {},
      examHistory: Array.isArray(parsed.examHistory) ? parsed.examHistory : [],
      completedSessions: Array.isArray(parsed.completedSessions) ? parsed.completedSessions : [],
      checkedSessionSteps: parsed.checkedSessionSteps ?? {},
    };
  } catch {
    return { ...DEFAULT_STORE };
  }
}

export function saveStore(store: UserStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota errors
  }
}

export function gradeCard(
  prev: SrsRecord | undefined,
  wordId: number,
  grade: 1 | 2 | 3 | 4,
  now = Date.now()
): SrsRecord {
  const prevReps = prev?.reps ?? 0;
  const prevInterval = prev?.interval ?? 0;
  const prevEase = prev?.ease ?? 2.5;
  const prevLapses = prev?.lapses ?? 0;

  if (grade === 1) {
    return {
      wordId,
      reps: 0,
      interval: 0,
      ease: Math.max(1.3, Number((prevEase - 0.2).toFixed(2))),
      nextReview: now + 10 * MINUTE_MS,
      lapses: prevLapses + 1,
      lastGrade: 1,
      updatedAt: now,
    };
  }

  if (grade === 2) {
    const nextInterval = prevReps === 0 ? 1 : Math.max(1, Math.round(prevInterval * 1.2));
    return {
      wordId,
      reps: prevReps + 1,
      interval: nextInterval,
      ease: Math.max(1.3, Number((prevEase - 0.15).toFixed(2))),
      nextReview: prevReps === 0 ? now + 6 * 60 * MINUTE_MS : now + nextInterval * DAY_MS,
      lapses: prevLapses,
      lastGrade: 2,
      updatedAt: now,
    };
  }

  if (grade === 3) {
    let nextInterval = 1;
    if (prevReps === 0) nextInterval = 1;
    else if (prevReps === 1) nextInterval = 3;
    else nextInterval = Math.max(2, Math.round(prevInterval * prevEase));

    return {
      wordId,
      reps: prevReps + 1,
      interval: nextInterval,
      ease: prevEase,
      nextReview: now + nextInterval * DAY_MS,
      lapses: prevLapses,
      lastGrade: 3,
      updatedAt: now,
    };
  }

  let easyInterval = 4;
  if (prevReps === 0) easyInterval = 4;
  else if (prevReps === 1) easyInterval = 7;
  else easyInterval = Math.max(4, Math.round(prevInterval * prevEase * 1.3));

  return {
    wordId,
    reps: prevReps + 1,
    interval: easyInterval,
    ease: Math.min(3.2, Number((prevEase + 0.15).toFixed(2))),
    nextReview: now + easyInterval * DAY_MS,
    lapses: prevLapses,
    lastGrade: 4,
    updatedAt: now,
  };
}

export function previewIntervalLabel(prev: SrsRecord | undefined, grade: 1 | 2 | 3 | 4): string {
  const simulated = gradeCard(prev, 0, grade, 0);
  if (grade === 1) return '10 phút';
  if (grade === 2 && (prev?.reps ?? 0) === 0) return '6 giờ';
  return `${simulated.interval} ngày`;
}

export function computeStreak(dailyCount: Record<string, number>): number {
  let streak = 0;
  const cursor = new Date();
  const todayKey = getTodayKey(cursor);
  if (!dailyCount[todayKey]) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const key = getTodayKey(cursor);
    if ((dailyCount[key] ?? 0) > 0) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function isMastered(rec: SrsRecord | undefined): boolean {
  return Boolean(rec && rec.reps >= 2 && rec.interval >= 7);
}

export function stripVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function parseMeaningAndMeasureWords(vi: string): { cleanVi: string; measureWords: string | null } {
  const match = vi.match(/;\s*LT:([^;]+)/i) || vi.match(/^LT:([^;]+)/i);
  if (!match) return { cleanVi: vi, measureWords: null };
  const mw = match[1].trim();
  const cleanVi = vi
    .replace(/;\s*LT:[^;]+/gi, '')
    .replace(/^LT:[^;]+;?\s*/gi, '')
    .trim();
  return { cleanVi: cleanVi || vi, measureWords: mw };
}
