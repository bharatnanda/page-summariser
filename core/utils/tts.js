/**
 * Lightweight TTS player built on the Web Speech API.
 *
 * Two modes:
 *   speakAll(text)          — speak a completed text (non-streaming).
 *   appendText(fullText)    — queue newly completed sentences as streaming text grows.
 *   flushRemaining()        — flush any trailing text once streaming ends.
 *
 * No external dependencies. ~120 lines.
 */

/** Safe per-utterance character limit (cross-browser). Chrome can silently drop very long utterances. */
const MAX_CHUNK = 180;

/**
 * Split text into sentence-sized chunks each ≤ MAX_CHUNK chars.
 * Breaks on sentence-ending punctuation first, then falls back to word boundaries.
 * @param {string} text
 * @returns {string[]}
 */
function chunkText(text) {
  if (!text || !text.trim()) return [];

  // Split on sentence-ending punctuation followed by whitespace or end-of-string.
  const rawSentences = text.match(/[^.!?]+[.!?]+\s*/g) || [];
  const trailing = text.replace(/[^.!?]+[.!?]+\s*/g, "").trim();
  if (trailing) rawSentences.push(trailing);

  const chunks = [];
  for (const sentence of rawSentences) {
    if (sentence.length <= MAX_CHUNK) {
      const t = sentence.trim();
      if (t) chunks.push(t);
      continue;
    }
    // Too long — break on word boundaries.
    let current = "";
    for (const word of sentence.split(/\s+/)) {
      if (!word) continue;
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > MAX_CHUNK && current) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }
  return chunks;
}

/**
 * From a partial text string, extract all *complete* sentence chunks
 * (i.e. ending in . ! or ?) and return them plus the number of characters consumed.
 * @param {string} text
 * @returns {{ sentences: string[], consumedLength: number }}
 */
function extractCompleteSentences(text) {
  const match = text.match(/^([\s\S]*[.!?])\s*/);
  if (!match) return { sentences: [], consumedLength: 0 };
  return { sentences: chunkText(match[1]), consumedLength: match[0].length };
}

/** Format seconds as M:SS */
function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export class TTSPlayer {
  constructor() {
    this._queue = [];
    this._currentUtterance = null;
    this._state = "idle"; // "idle" | "playing" | "paused"
    this._rate = 1.0;
    this._startTime = null;
    this._pausedElapsed = 0;
    this._timerInterval = null;

    // Streaming support
    this._fullText = "";
    this._queuedUpTo = 0;

    // Progress (character-weighted for linear advance)
    this._charsTotal = 0;
    this._charsDone = 0;

    /** @type {((state: "idle"|"playing"|"paused") => void) | null} */
    this.onStateChange = null;
    /** Fired every ~500 ms while playing: (elapsedSeconds, progressFraction) => void */
    this.onTick = null;
    /** Fired when all queued speech finishes. */
    this.onEnd = null;
  }

  /** Whether the Web Speech API is available in this context. */
  get supported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  get state() {
    return this._state;
  }

  /**
   * Speak a complete text (non-streaming path).
   * Replaces any ongoing speech.
   * @param {string} text
   */
  speakAll(text) {
    if (!this.supported) return;
    this.stop();
    const chunks = chunkText(text);
    this._fullText = text;
    this._queuedUpTo = text.length;
    this._queue = [...chunks];
    this._charsTotal = chunks.reduce((n, c) => n + c.length, 0);
    this._charsDone = 0;
    this._playNext();
  }

  /**
   * Append growing text (streaming path).
   * Detects newly completed sentences beyond what has already been queued and speaks them.
   * @param {string} fullText - the full accumulated text so far
   */
  appendText(fullText) {
    if (!this.supported) return;
    this._fullText = fullText;
    const newPart = fullText.slice(this._queuedUpTo);
    const { sentences, consumedLength } = extractCompleteSentences(newPart);
    if (sentences.length > 0) {
      this._queue.push(...sentences);
      this._charsTotal += sentences.reduce((n, c) => n + c.length, 0);
      this._queuedUpTo += consumedLength;
      if (this._state === "idle") this._playNext();
    }
  }

  /**
   * Flush any text that didn't end with punctuation once streaming is complete.
   */
  flushRemaining() {
    if (!this.supported) return;
    const remaining = this._fullText.slice(this._queuedUpTo).trim();
    if (remaining) {
      const chunks = chunkText(remaining);
      this._queue.push(...chunks);
      this._charsTotal += chunks.reduce((n, c) => n + c.length, 0);
      this._queuedUpTo = this._fullText.length;
      if (this._state === "idle") this._playNext();
    }
  }

  pause() {
    if (!this.supported || this._state !== "playing") return;
    window.speechSynthesis.pause();
    this._pausedElapsed += Date.now() - (this._startTime ?? Date.now());
    this._startTime = null;
    this._stopTimer();
    this._setState("paused");
  }

  resume() {
    if (!this.supported || this._state !== "paused") return;
    window.speechSynthesis.resume();
    this._startTime = Date.now();
    this._startTimer();
    this._setState("playing");
  }

  stop() {
    if (!this.supported) return;
    window.speechSynthesis.cancel();
    this._queue = [];
    this._currentUtterance = null;
    this._fullText = "";
    this._queuedUpTo = 0;
    this._charsTotal = 0;
    this._charsDone = 0;
    this._startTime = null;
    this._pausedElapsed = 0;
    this._stopTimer();
    this._setState("idle");
  }

  /**
   * Change playback rate. Restarts the current chunk at the new rate immediately.
   * @param {number} rate - e.g. 0.75, 1, 1.25, 1.5, 2
   */
  setRate(rate) {
    this._rate = rate;
    if (this._state === "playing" && this._currentUtterance) {
      // Re-queue the current chunk so it replays at the new rate.
      const requeued = this._currentUtterance.text;
      const remaining = [requeued, ...this._queue];
      this._charsDone = Math.max(0, this._charsDone - requeued.length);
      this._queue = remaining;
      window.speechSynthesis.cancel();
      this._currentUtterance = null;
      // cancel fires onerror("interrupted") on the current utterance — handled below.
      // Schedule _playNext on the next microtask to let the cancel settle.
      Promise.resolve().then(() => this._playNext());
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _setState(state) {
    this._state = state;
    this.onStateChange?.(state);
  }

  _startTimer() {
    this._stopTimer();
    this._timerInterval = setInterval(() => {
      const elapsed = Math.floor(
        (this._pausedElapsed + (Date.now() - (this._startTime ?? Date.now()))) / 1000
      );
      const fraction = this._charsTotal > 0
        ? Math.min(1, this._charsDone / this._charsTotal)
        : 0;
      this.onTick?.(elapsed, fraction);
    }, 500);
  }

  _stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  _playNext() {
    if (!this.supported) return;

    if (this._queue.length === 0) {
      if (this._state !== "idle") {
        this._pausedElapsed = 0;
        this._startTime = null;
        this._stopTimer();
        this._setState("idle");
        this.onEnd?.();
      }
      return;
    }

    const text = this._queue.shift();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this._rate;
    this._currentUtterance = utterance;

    utterance.onend = () => {
      this._charsDone += text.length;
      this._currentUtterance = null;
      this._playNext();
    };

    utterance.onerror = (e) => {
      // "interrupted" / "canceled" happen when stop() or setRate() cancels mid-speech — expected.
      if (e.error === "interrupted" || e.error === "canceled") return;
      console.warn("[TTS] utterance error:", e.error);
      this._currentUtterance = null;
      this._playNext();
    };

    window.speechSynthesis.speak(utterance);

    if (this._state !== "playing") {
      if (this._startTime === null) this._startTime = Date.now();
      this._startTimer();
      this._setState("playing");
    }
  }
}

export { formatTime };
