export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type LevelFilter = 'all' | HskLevel;
export type NavTab =
  | 'dashboard'
  | 'roadmap'
  | 'flashcards'
  | 'writing'
  | 'exam'
  | 'leaderboard'
  | 'dictionary'
  | 'grammar';

export type ExamMode = 'full_simulation' | 'listening' | 'reading' | 'writing' | 'speaking';

export interface AuthUser {
  id?: number;
  username: string;
  displayName: string;
  mode: 'cloud' | 'local';
}

export interface LeaderboardRow {
  username: string;
  display_name: string;
  mastered_count: number;
  sessions_done: number;
  best_hsk_score: number;
  streak: number;
  total_reviews: number;
  xp: number;
  updated_at: number;
}

export interface VocabItem {
  id: number;
  l: HskLevel;
  h: string;
  p: string;
  pn: string;
  hv: string;
  vi: string;
  en: string;
}

export interface RadicalInfo {
  r: string;
  m: string;
  h: string;
}

export interface CharInsight {
  p: string;
  hv: string;
  vi: string;
  sc: number;
  mn: string;
  sh: string;
  rad: RadicalInfo[];
}

export interface SrsRecord {
  wordId: number;
  reps: number;
  interval: number;
  ease: number;
  nextReview: number;
  lapses: number;
  lastGrade: 1 | 2 | 3 | 4;
  updatedAt: number;
}

export interface SkillScores {
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
}

export interface ExamHistoryItem {
  id: string;
  date: number;
  level: LevelFilter;
  mode: ExamMode;
  score: number;
  total: number;
  scaledScore: number;
  maxScaledScore: number;
  skillScores?: SkillScores;
  durationSec: number;
  wrongWordIds: number[];
}

export interface UserStore {
  srs: Record<number, SrsRecord>;
  bookmarks: number[];
  dailyCount: Record<string, number>;
  dailyGoal: number;
  speechRate: number;
  showPinyinDefault: boolean;
  examHistory: ExamHistoryItem[];
  completedSessions: string[];
  checkedSessionSteps: Record<string, number[]>;
}

export interface GrammarPattern {
  id: string;
  level: HskLevel;
  title: string;
  structure: string;
  summary: string;
  trap: string;
  examples: {
    zh: string;
    py: string;
    vi: string;
  }[];
}

export interface VideoLink {
  videoId: string;
  title: string;
  url: string;
}

export interface CurriculumSession {
  id: string;
  sessionNum: number;
  level: HskLevel;
  title: string;
  skills: string[];
  content: string;
  formula: string;
  examples: { zh: string; py: string; vi: string }[];
  wordIds: number[];
  studyMethod: string[];
  videos: VideoLink[];
  youtubeSearchUrl: string;
  youtubeQuery: string;
}

export interface CurriculumLevel {
  level: HskLevel;
  name: string;
  totalHours: string;
  targetWords: number;
  examFormat: string;
  overview: string;
  phases: { stage: string; focus: string }[];
  sessions: CurriculumSession[];
}
