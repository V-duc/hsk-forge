import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/DashboardView';
import { DictionaryView } from './components/DictionaryView';
import { ExamView } from './components/ExamView';
import { FlashcardView, type DeckMode } from './components/FlashcardView';
import { GrammarView } from './components/GrammarView';
import { LeaderboardView } from './components/LeaderboardView';
import { Navbar } from './components/Navbar';
import { RoadmapView } from './components/RoadmapView';
import { StrokeLabView } from './components/StrokeLabView';
import { apiFetchMe, apiSyncStore, clearAuthSession, getSavedAuth } from './lib/api';
import {
  computeStreak,
  DEFAULT_STORE,
  getTodayKey,
  gradeCard,
  loadStore,
  saveStore,
} from './lib/srs';
import type {
  AuthUser,
  CharInsight,
  CurriculumLevel,
  ExamHistoryItem,
  LevelFilter,
  NavTab,
  UserStore,
  VocabItem,
} from './types';

export default function App() {
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [charInsights, setCharInsights] = useState<Record<string, CharInsight>>({});
  const [curriculum, setCurriculum] = useState<Record<string, CurriculumLevel>>({});
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('roadmap');
  const [selectedLevel, setSelectedLevel] = useState<LevelFilter>(1);
  const [flashDeckMode, setFlashDeckMode] = useState<DeckMode>('smart');
  const [sessionFilter, setSessionFilter] = useState<{ label: string; wordIds: number[] } | null>(
    null
  );
  const [strokeText, setStrokeText] = useState('学习汉语');
  const [store, setStore] = useState<UserStore>(() => loadStore());
  const [toast, setToast] = useState<string | null>(null);

  // Multi-user Auth State
  const initialAuth = useMemo(() => getSavedAuth(), []);
  const [authToken, setAuthToken] = useState<string | null>(initialAuth.token);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(initialAuth.user);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const skipNextSyncRef = useRef(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((cur) => (cur === msg ? null : cur));
    }, 2600);
  };

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.BASE_URL || './';
    Promise.all([
      fetch(`${base}data/hsk-vocab.json`).then((r) => {
        if (!r.ok) throw new Error('Không thể tải dữ liệu từ vựng HSK');
        return r.json() as Promise<VocabItem[]>;
      }),
      fetch(`${base}data/char-insights.json`).then((r) => {
        if (!r.ok) return {} as Record<string, CharInsight>;
        return r.json() as Promise<Record<string, CharInsight>>;
      }),
      fetch(`${base}data/hsk-curriculum.json`).then((r) => {
        if (!r.ok) return {} as Record<string, CurriculumLevel>;
        return r.json() as Promise<Record<string, CurriculumLevel>>;
      }),
    ])
      .then(([vData, cData, currData]) => {
        if (cancelled) return;
        setVocab(vData);
        setCharInsights(cData);
        setCurriculum(currData);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadErr(err instanceof Error ? err.message : 'Lỗi nạp dữ liệu');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate cloud account progress on boot if logged in
  useEffect(() => {
    if (!authToken || !currentUser) return;
    let cancelled = false;
    apiFetchMe(authToken, currentUser).then((remoteStore) => {
      if (cancelled || !remoteStore) return;
      skipNextSyncRef.current = true;
      setStore(remoteStore);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save locally & debounce sync to Multi-User Server
  useEffect(() => {
    saveStore(store);
    if (!authToken || !currentUser) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void apiSyncStore(authToken, currentUser, store);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [store, authToken, currentUser]);

  const dueCount = useMemo(() => {
    const now = Date.now();
    return Object.values(store.srs).filter((r) => r.nextReview <= now).length;
  }, [store.srs]);

  const todayKey = getTodayKey();
  const todayDone = store.dailyCount[todayKey] ?? 0;
  const streak = useMemo(() => computeStreak(store.dailyCount), [store.dailyCount]);

  const handleGradeWord = (wordId: number, grade: 1 | 2 | 3 | 4) => {
    setStore((prev) => {
      const nextRec = gradeCard(prev.srs[wordId], wordId, grade);
      const tKey = getTodayKey();
      return {
        ...prev,
        srs: { ...prev.srs, [wordId]: nextRec },
        dailyCount: {
          ...prev.dailyCount,
          [tKey]: (prev.dailyCount[tKey] ?? 0) + 1,
        },
      };
    });
  };

  const handleToggleBookmark = (wordId: number) => {
    setStore((prev) => {
      const exists = prev.bookmarks.includes(wordId);
      const nextBookmarks = exists
        ? prev.bookmarks.filter((id) => id !== wordId)
        : [...prev.bookmarks, wordId];
      return { ...prev, bookmarks: nextBookmarks };
    });
  };

  const handleToggleCompleteSession = (sessionId: string) => {
    setStore((prev) => {
      const done = prev.completedSessions.includes(sessionId);
      const next = done
        ? prev.completedSessions.filter((id) => id !== sessionId)
        : [...prev.completedSessions, sessionId];
      return { ...prev, completedSessions: next };
    });
  };

  const handleToggleSessionStep = (sessionId: string, stepIdx: number) => {
    setStore((prev) => {
      const cur = prev.checkedSessionSteps[sessionId] ?? [];
      const nextSteps = cur.includes(stepIdx)
        ? cur.filter((x) => x !== stepIdx)
        : [...cur, stepIdx];
      return {
        ...prev,
        checkedSessionSteps: {
          ...prev.checkedSessionSteps,
          [sessionId]: nextSteps,
        },
      };
    });
  };

  const handleSaveExamResult = (result: ExamHistoryItem) => {
    setStore((prev) => ({
      ...prev,
      examHistory: [result, ...prev.examHistory].slice(0, 30),
    }));
  };

  const handlePushWrongToSrs = (wordIds: number[]) => {
    setStore((prev) => {
      const nextSrs = { ...prev.srs };
      const now = Date.now();
      for (const wid of wordIds) {
        nextSrs[wid] = gradeCard(nextSrs[wid], wid, 1, now);
      }
      return { ...prev, srs: nextSrs };
    });
    showToast(`Đã ghim ${wordIds.length} từ sai vào hàng đợi ưu tiên SRS!`);
  };

  const handleOpenStrokeLab = (word: string) => {
    setStrokeText(word);
    setActiveTab('writing');
  };

  const handleLogout = () => {
    clearAuthSession();
    setAuthToken(null);
    setCurrentUser(null);
    skipNextSyncRef.current = true;
    setStore({ ...DEFAULT_STORE });
    showToast('Đã đăng xuất tài khoản!');
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hsk-forge-backup-${getTodayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất file backup JSON!');
  };

  const handleImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<UserStore>;
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
        setStore({
          ...DEFAULT_STORE,
          ...parsed,
          srs: parsed.srs ?? {},
          bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
          dailyCount: parsed.dailyCount ?? {},
          examHistory: Array.isArray(parsed.examHistory) ? parsed.examHistory : [],
          completedSessions: Array.isArray(parsed.completedSessions)
            ? parsed.completedSessions
            : [],
          checkedSessionSteps: parsed.checkedSessionSteps ?? {},
        });
        showToast('Khôi phục dữ liệu học thành công!');
      } catch {
        showToast('File JSON không hợp lệ!');
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090A0F] flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-rose-600 flex items-center justify-center font-hanzi text-2xl font-black text-white animate-pulse">
          汉
        </div>
        <p className="text-xs font-mono-code text-zinc-400">
          Đang nạp 69 buổi học HSK 1-6, 4.993 từ vựng & phòng thi mô phỏng...
        </p>
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="min-h-screen bg-[#090A0F] flex items-center justify-center p-6">
        <div className="rounded-2xl border border-rose-800 bg-rose-950/30 p-6 max-w-md text-center space-y-2">
          <div className="text-base font-bold text-rose-300">Lỗi tải dữ liệu</div>
          <p className="text-xs text-zinc-300">{loadErr}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 flex flex-col lg:flex-row">
      <Navbar
        activeTab={activeTab}
        onSelectTab={(t) => {
          if (t === 'flashcards') {
            setFlashDeckMode('smart');
            setSessionFilter(null);
          }
          setActiveTab(t);
        }}
        selectedLevel={selectedLevel}
        onSelectLevel={(lv) => {
          setSelectedLevel(lv);
          setSessionFilter(null);
        }}
        dueCount={dueCount}
        streak={streak}
        todayDone={todayDone}
        dailyGoal={store.dailyGoal}
        speechRate={store.speechRate}
        onChangeSpeechRate={(rate) => setStore((s) => ({ ...s, speechRate: rate }))}
        currentUser={currentUser}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
      />

      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto w-full">
        {activeTab === 'dashboard' && (
          <DashboardView
            vocab={vocab}
            store={store}
            onSelectLevelAndNavigate={(lv, tab) => {
              setSelectedLevel(lv);
              setSessionFilter(null);
              if (tab === 'flashcards') setFlashDeckMode('smart');
              setActiveTab(tab);
            }}
            onStartWrongWordsReview={() => {
              setSelectedLevel('all');
              setSessionFilter(null);
              setFlashDeckMode('hard');
              setActiveTab('flashcards');
            }}
            onUpdateDailyGoal={(goal) => setStore((s) => ({ ...s, dailyGoal: goal }))}
            onResetProgress={() => {
              setStore({ ...DEFAULT_STORE });
              showToast('Đã xóa sạch tiến độ học!');
            }}
          />
        )}

        {activeTab === 'roadmap' && (
          <RoadmapView
            curriculum={curriculum}
            vocab={vocab}
            selectedLevel={selectedLevel}
            srsMap={store.srs}
            completedSessions={store.completedSessions}
            checkedSessionSteps={store.checkedSessionSteps}
            speechRate={store.speechRate}
            onChangeLevel={(lv) => setSelectedLevel(lv)}
            onToggleCompleteSession={handleToggleCompleteSession}
            onToggleSessionStep={handleToggleSessionStep}
            onStudySessionFlashcards={(label, wordIds) => {
              setSessionFilter({ label, wordIds });
              setActiveTab('flashcards');
            }}
            onOpenStrokeLab={handleOpenStrokeLab}
            onStartLevelExam={(lv) => {
              setSelectedLevel(lv);
              setActiveTab('exam');
            }}
          />
        )}

        {activeTab === 'flashcards' && (
          <FlashcardView
            vocab={vocab}
            charInsights={charInsights}
            selectedLevel={selectedLevel}
            srsMap={store.srs}
            bookmarks={store.bookmarks}
            speechRate={store.speechRate}
            initialDeckMode={flashDeckMode}
            sessionFilter={sessionFilter}
            onClearSessionFilter={() => setSessionFilter(null)}
            onGradeWord={handleGradeWord}
            onToggleBookmark={handleToggleBookmark}
            onOpenStrokeLab={handleOpenStrokeLab}
          />
        )}

        {activeTab === 'writing' && (
          <StrokeLabView
            vocab={vocab}
            charInsights={charInsights}
            selectedLevel={selectedLevel}
            speechRate={store.speechRate}
            initialText={strokeText}
          />
        )}

        {activeTab === 'exam' && (
          <ExamView
            vocab={vocab}
            selectedLevel={selectedLevel}
            speechRate={store.speechRate}
            onSaveExamResult={handleSaveExamResult}
            onPushWrongToSrs={handlePushWrongToSrs}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView
            currentUser={currentUser}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {activeTab === 'dictionary' && (
          <DictionaryView
            vocab={vocab}
            charInsights={charInsights}
            selectedLevel={selectedLevel}
            srsMap={store.srs}
            bookmarks={store.bookmarks}
            speechRate={store.speechRate}
            onToggleBookmark={handleToggleBookmark}
            onOpenStrokeLab={handleOpenStrokeLab}
          />
        )}

        {activeTab === 'grammar' && (
          <GrammarView selectedLevel={selectedLevel} speechRate={store.speechRate} />
        )}
      </main>

      {showAuthModal && (
        <AuthModal
          currentStore={store}
          onClose={() => setShowAuthModal(false)}
          onSuccess={(token, user, syncedStore) => {
            skipNextSyncRef.current = true;
            setAuthToken(token);
            setCurrentUser(user);
            setStore(syncedStore);
            setShowAuthModal(false);
            showToast(`Chào mừng ${user.displayName}! Tiến độ đã được đồng bộ.`);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-16 lg:bottom-6 right-4 lg:right-6 z-50 px-4 py-2.5 rounded-xl bg-zinc-900 border border-rose-500/50 text-xs font-semibold text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
