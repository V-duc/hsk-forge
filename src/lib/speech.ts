let cachedVoice: SpeechSynthesisVoice | null = null;
let activeDialogueSession = 0;

function resolveChineseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  cachedVoice =
    voices.find((v) => v.lang === 'zh-CN' && /Xiaoxiao|Yunxi|Google|Natural|Microsoft/i.test(v.name)) ||
    voices.find((v) => v.lang === 'zh-CN') ||
    voices.find((v) => v.lang.toLowerCase().startsWith('zh')) ||
    null;

  return cachedVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    resolveChineseVoice();
  };
}

export function stopSpeech(): void {
  activeDialogueSession += 1;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}

export function speakChinese(text: string, rate = 0.9, pitch = 1.0): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return;
  try {
    stopSpeech();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = resolveChineseVoice();
    if (voice) utter.voice = voice;
    utter.lang = 'zh-CN';
    utter.rate = Math.max(0.5, Math.min(1.4, rate));
    utter.pitch = Math.max(0.6, Math.min(1.4, pitch));
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore unsupported environments
  }
}

export interface DialogueTurn {
  speaker: 'M' | 'F' | 'Q';
  zh: string;
}

export function speakDialogue(
  turns: DialogueTurn[],
  rate = 0.9,
  onDone?: () => void
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !turns.length) {
    onDone?.();
    return;
  }
  stopSpeech();
  const sessionId = activeDialogueSession;
  const voice = resolveChineseVoice();

  let idx = 0;
  const playNext = () => {
    if (sessionId !== activeDialogueSession) return;
    if (idx >= turns.length) {
      onDone?.();
      return;
    }
    const turn = turns[idx];
    idx += 1;
    const utter = new SpeechSynthesisUtterance(turn.zh);
    if (voice) utter.voice = voice;
    utter.lang = 'zh-CN';
    utter.rate = Math.max(0.55, Math.min(1.3, rate));
    utter.pitch = turn.speaker === 'M' ? 0.82 : turn.speaker === 'F' ? 1.22 : 1.0;
    utter.onend = () => {
      window.setTimeout(playNext, 340);
    };
    utter.onerror = () => {
      onDone?.();
    };
    window.speechSynthesis.speak(utter);
  };

  playNext();
}
