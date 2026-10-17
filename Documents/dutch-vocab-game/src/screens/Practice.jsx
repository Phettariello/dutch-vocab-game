import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { primeKeyboard, releaseKeyboardPrimer } from "../keyboardPrimer";
import { playSound, buzz, unlockAudio } from "../sounds";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const CORRECT_CARD_MS = 1400; // how long the "correct" pop-up stays (tap to skip)
const ALL_DIFFICULTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Same accuracy buckets as Review / Your Words
const ACCURACY_BUCKETS = [
  { id: "0-25", label: "0–25%", test: (p) => p < 25 },
  { id: "25-50", label: "25–50%", test: (p) => p >= 25 && p < 50 },
  { id: "50-75", label: "50–75%", test: (p) => p >= 50 && p < 75 },
  { id: "75-99", label: "75–99%", test: (p) => p >= 75 && p < 100 },
  { id: "100", label: "100%", test: (p) => p >= 100 },
];
const ALL_BUCKET_IDS = ACCURACY_BUCKETS.map((b) => b.id);

// The last filter choices are remembered on this device
const PREFS_KEY = "practiceFilterPrefs";
const loadPrefs = () => {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || null;
  } catch (e) {
    return null;
  }
};

const STATUS_OPTIONS = [
  ["both", "All"],
  ["new", "New"],
  ["learning", "Learning"],
  ["mastered", "Mastered"],
];
const ROUND_SIZES = [
  [10, "10"],
  [20, "20"],
  [50, "50"],
  [0, "All"],
];

// "Words discovered" milestones (same as Play)
const MILESTONES = [50, 100, 150, 250, 500, 750, 1000];
const isMilestone = (n) => MILESTONES.includes(n) || (n > 1000 && n % 250 === 0);
const MILESTONE_TEXT = {
  50: "Your Dutch vocabulary is taking off!",
  100: "Triple digits! You are building something real.",
  150: "150 words! Keep going!",
  250: "A quarter of a thousand. Impressive!",
  500: "500 words! You could hold a real conversation now.",
  750: "750 words. You are on a roll!",
  1000: "ONE THOUSAND words. Legendary!",
};
const milestoneText = (n) => MILESTONE_TEXT[n] || "Another big step on your Dutch journey!";
const milestoneIcon = (n) => (n >= 1000 ? "👑" : n >= 500 ? "🏆" : n >= 250 ? "🌟" : "🎉");

const PRAISE = [
  "Great!", "Nice one!", "Spot on!", "Perfect!", "Well done!", "Brilliant!",
  "You're the best! 🏅", "Look at you go!", "Genius move! 🧠", "Boom! Nailed it!",
  "You make it look easy!", "Dutch master in the making!", "That's how it's done!",
  "Smooth! 😎", "Top class!", "Flawless!", "Tulip-level talent! 🌷", "Hoera! 🎉",
];
const PRAISE_HOT = ["On fire! 🔥", "You're heating up! 🔥", "Hot streak! 🔥", "Can't stop, won't stop!"];
const PRAISE_BLAZING = ["Unstoppable! 🔥", "You're on a roll! 🚀", "Legendary streak! 👑", "Absolute machine! 🤖"];
let lastPraise = "";
const pickPraise = (streak) => {
  const list = streak >= 5 ? PRAISE_BLAZING : streak >= 3 ? PRAISE_HOT : PRAISE;
  let choice = list[Math.floor(Math.random() * list.length)];
  if (choice === lastPraise) choice = list[(list.indexOf(choice) + 1) % list.length];
  lastPraise = choice;
  return choice;
};

const KEYFRAMES = `
@keyframes pConfettiFall {
  0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
}
@keyframes pPop {
  0%   { opacity: 0; transform: scale(0.3); }
  60%  { opacity: 1; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes pCardPop {
  0%   { opacity: 0; transform: scale(0.7) translateY(10px); }
  60%  { opacity: 1; transform: scale(1.06); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes pTimerShrink {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}
@keyframes pSparkle {
  0%, 100% { transform: rotate(0deg) scale(1); }
  50%      { transform: rotate(12deg) scale(1.15); }
}
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
`;

const shuffleArray = (list) => {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const normalize = (str) =>
  str
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/ï/g, "i")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/\s+/g, " ");

// Supabase returns max 1000 rows per request, so read big tables page by page
async function fetchAllRows(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await buildQuery().range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

// word_id -> { correct, incorrect, mastered } (rows of the same word are summed)
async function loadProgress(userId) {
  const rows = await fetchAllRows(() =>
    supabase
      .from("user_progress")
      .select("word_id, correct_count, incorrect_count, mastered")
      .eq("user_id", userId)
      .order("id")
  );
  const map = new Map();
  rows.forEach((r) => {
    const cur = map.get(r.word_id) || { correct: 0, incorrect: 0, mastered: false };
    cur.correct += r.correct_count || 0;
    cur.incorrect += r.incorrect_count || 0;
    cur.mastered = cur.mastered || !!r.mastered;
    map.set(r.word_id, cur);
  });
  return map;
}

// ============================================================================
// SHARED PIECES
// ============================================================================
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.6,
        size: 6 + Math.random() * 6,
        color: ["#fbbf24", "#06b6d4", "#7c3aed", "#22c55e", "#ef4444", "#3b82f6"][i % 6],
      })),
    []
  );
  return (
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 1100 }}>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: "-20px",
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            borderRadius: "2px",
            animation: `pConfettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

const NOTICE_THEME = {
  success: { icon: "✓", color: "#6ee7b7", bg: "rgba(16,185,129,0.15)", border: "#34d399" },
  error: { icon: "✕", color: "#fca5a5", bg: "rgba(248,113,113,0.15)", border: "#f87171" },
  info: { icon: "i", color: "#93c5fd", bg: "rgba(59,130,246,0.15)", border: "#60a5fa" },
};

// Simple pop-up used instead of the browser alert boxes
function NoticeModal({ notice, onClose }) {
  if (!notice) return null;
  const theme = NOTICE_THEME[notice.type || "info"];
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="practice-notice-title" style={{ ...styles.overlay, zIndex: 1200 }}>
      <div style={styles.modalCard}>
        <div style={{ ...styles.modalIcon, color: theme.color, background: theme.bg, borderColor: theme.border }}>
          {theme.icon}
        </div>
        <h2 id="practice-notice-title" style={styles.modalTitle}>{notice.title}</h2>
        <p style={styles.modalText}>{notice.message}</p>
        <button type="button" onClick={onClose} style={styles.modalPrimaryButton}>OK</button>
      </div>
    </div>
  );
}

// Header with sound settings (same as Play / Review). Always visible.
function PracticeHeader({ title, backLabel, onBack, onPopoverClose }) {
  const [audioOpen, setAudioOpen] = useState(false);
  const [sfxOn, setSfxOn] = useState(() => localStorage.getItem("soundEnabled") !== "false");
  const [sfxVol, setSfxVol] = useState(() => {
    const v = parseFloat(localStorage.getItem("volume"));
    return Number.isNaN(v) ? 70 : v;
  });
  const [musicOn, setMusicOn] = useState(() => localStorage.getItem("backgroundMusicEnabled") !== "false");
  const [musicVol, setMusicVol] = useState(() => {
    const raw = localStorage.getItem("backgroundMusicVolume");
    const v = Number(raw);
    return raw === null || Number.isNaN(v) ? 20 : v;
  });

  const closeAudio = () => {
    setAudioOpen(false);
    onPopoverClose?.();
  };
  const changeSfxOn = (on) => {
    setSfxOn(on);
    localStorage.setItem("soundEnabled", String(on));
    if (on) setTimeout(() => playSound("pop"), 30);
  };
  const changeSfxVol = (v) => {
    setSfxVol(v);
    localStorage.setItem("volume", String(v));
  };
  const applyMusic = (enabled, vol) => {
    localStorage.setItem("backgroundMusicEnabled", String(enabled));
    localStorage.setItem("backgroundMusicVolume", String(vol));
    window.dispatchEvent(new CustomEvent("background-music-setting-changed"));
    document.querySelectorAll("audio").forEach((audio) => {
      const source = audio.currentSrc || audio.src || "";
      if (source.includes("background-music")) {
        audio.volume = vol / 100;
        if (enabled && audio.paused) audio.play().catch(() => {});
      }
    });
  };
  const changeMusicOn = (on) => {
    setMusicOn(on);
    applyMusic(on, musicVol);
  };
  const changeMusicVol = (v) => {
    setMusicVol(v);
    applyMusic(musicOn, v);
  };

  return (
    <div style={styles.header}>
      <h1 style={styles.title}>{title}</h1>
      <div style={styles.headerRight}>
        <button
          type="button"
          onClick={() => setAudioOpen((v) => !v)}
          style={styles.audioButton}
          aria-label="Sound settings"
          aria-expanded={audioOpen}
        >
          {sfxOn || musicOn ? "🔊" : "🔇"}
        </button>
        <button
          onClick={onBack}
          style={styles.backButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#0891b2";
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#06b6d4";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {backLabel}
        </button>
      </div>

      {audioOpen && (
        <>
          <div style={styles.audioBackdrop} onClick={closeAudio} />
          <div style={styles.audioPopover} role="dialog" aria-label="Sound settings">
            <div style={styles.audioRow}>
              <span style={styles.audioLabel}>🔊 Sound effects</span>
              <button
                type="button"
                role="switch"
                aria-checked={sfxOn}
                aria-label="Sound effects"
                onClick={() => changeSfxOn(!sfxOn)}
                style={styles.audioToggle(sfxOn)}
              >
                <span style={styles.audioKnob(sfxOn)} />
              </button>
            </div>
            <div style={styles.audioSliderRow}>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={sfxVol}
                disabled={!sfxOn}
                aria-label="Sound effects volume"
                onChange={(e) => changeSfxVol(Number(e.target.value))}
                onPointerUp={() => playSound("pop")}
                style={styles.audioRange}
              />
              <strong style={styles.audioValue}>{sfxVol}%</strong>
            </div>

            <div style={{ ...styles.audioRow, marginTop: 10 }}>
              <span style={styles.audioLabel}>🎵 Music</span>
              <button
                type="button"
                role="switch"
                aria-checked={musicOn}
                aria-label="Background music"
                onClick={() => changeMusicOn(!musicOn)}
                style={styles.audioToggle(musicOn)}
              >
                <span style={styles.audioKnob(musicOn)} />
              </button>
            </div>
            <div style={styles.audioSliderRow}>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={musicVol}
                disabled={!musicOn}
                aria-label="Music volume"
                onChange={(e) => changeMusicVol(Number(e.target.value))}
                style={styles.audioRange}
              />
              <strong style={styles.audioValue}>{musicVol}%</strong>
            </div>

            <button type="button" onClick={closeAudio} style={styles.audioDone}>
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// SELECTION SCREEN
// ============================================================================
function Practice({ goBack }) {
  const [allWords, setAllWords] = useState([]);
  const [progress, setProgress] = useState(() => new Map());
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedCategories, setSelectedCategories] = useState(() => new Set());
  const [selectedDifficulties, setSelectedDifficulties] = useState(() => new Set());
  const [selectedAccuracy, setSelectedAccuracy] = useState(() => new Set(ALL_BUCKET_IDS));
  const [statusFilter, setStatusFilter] = useState(() => loadPrefs()?.statusFilter ?? "both");
  const [shuffle, setShuffle] = useState(() => loadPrefs()?.shuffle ?? true);
  const [roundSize, setRoundSize] = useState(() => loadPrefs()?.roundSize ?? 20);

  const [session, setSession] = useState(null); // { id, words }
  const [notice, setNotice] = useState(null);

  // Load every word + the player's progress once
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) throw new Error("You must be signed in to practise.");
        const [wordRows, progressMap] = await Promise.all([
          fetchAllRows(() => supabase.from("words").select("*").order("id")),
          loadProgress(uid),
        ]);
        if (!active) return;
        setUserId(uid);
        setAllWords(wordRows);
        setProgress(progressMap);

        // Start from the last choices; first time (or if nothing is left) everything is selected,
        // so a round can always start
        const prefs = loadPrefs();
        const cats = [...new Set(wordRows.map((w) => w.category).filter(Boolean))];
        const keepCats = (prefs?.categories || []).filter((c) => cats.includes(c));
        const keepDiffs = (prefs?.difficulties || []).filter((d) => ALL_DIFFICULTIES.includes(d));
        const keepAcc = (prefs?.accuracy || []).filter((id) => ALL_BUCKET_IDS.includes(id));
        setSelectedCategories(new Set(keepCats.length ? keepCats : cats));
        setSelectedDifficulties(new Set(keepDiffs.length ? keepDiffs : ALL_DIFFICULTIES));
        setSelectedAccuracy(new Set(keepAcc.length ? keepAcc : ALL_BUCKET_IDS));
      } catch (error) {
        console.error("Error loading practice data:", error);
        if (active) setLoadError(error?.message || "Please check your connection and try again.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const categories = useMemo(
    () => [...new Set(allWords.map((w) => w.category).filter(Boolean))].sort(),
    [allWords]
  );

  // Words that match the filters. New (never seen) words count as 0% accuracy.
  const filterWords = useCallback(
    (progressMap) => {
      if (selectedCategories.size === 0 || selectedDifficulties.size === 0) return [];
      const buckets = ACCURACY_BUCKETS.filter((b) => selectedAccuracy.has(b.id));
      const out = [];
      for (const w of allWords) {
        if (!selectedCategories.has(w.category) || !selectedDifficulties.has(w.difficulty)) continue;
        const p = progressMap.get(w.id);
        const seen = !!p;
        const total = p ? p.correct + p.incorrect : 0;
        const mastery = total > 0 ? Math.round((p.correct / total) * 100) : 0;
        const mastered = !!p?.mastered;
        if (statusFilter === "new" && seen) continue;
        if (statusFilter === "learning" && (!seen || mastered)) continue;
        if (statusFilter === "mastered" && !mastered) continue;
        if (!buckets.some((b) => b.test(mastery))) continue;
        out.push({ word: w, mastery });
      }
      return out;
    },
    [allWords, selectedCategories, selectedDifficulties, selectedAccuracy, statusFilter]
  );

  const matching = useMemo(() => filterWords(progress), [filterWords, progress]);

  const savePrefs = () => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          categories: [...selectedCategories],
          difficulties: [...selectedDifficulties],
          accuracy: [...selectedAccuracy],
          statusFilter,
          shuffle,
          roundSize,
        })
      );
    } catch (e) {
      // remembering the choices is optional
    }
  };

  // Random order, or weakest words first
  const buildSession = (list) => {
    savePrefs();
    const ordered = shuffleArray(list);
    if (!shuffle) ordered.sort((a, b) => a.mastery - b.mastery);
    let picked = ordered.map((x) => x.word);
    if (roundSize > 0) picked = picked.slice(0, roundSize);
    return { id: Date.now(), words: picked };
  };

  const refreshProgress = async () => {
    if (!userId) return progress;
    try {
      const map = await loadProgress(userId);
      setProgress(map);
      return map;
    } catch (error) {
      console.error("Could not refresh progress:", error);
      return progress;
    }
  };

  const handleStart = () => {
    if (selectedCategories.size === 0 || selectedDifficulties.size === 0) {
      setNotice({
        type: "info",
        title: "Almost there",
        message: "Please select at least one category and one difficulty level.",
      });
      return;
    }
    if (matching.length === 0) {
      setNotice({
        type: "info",
        title: "No words match",
        message: "Nothing matches these filters. Try more categories, levels or accuracy ranges.",
      });
      return;
    }
    // Sound and keyboard can only start during this tap
    unlockAudio();
    primeKeyboard();
    setSession(buildSession(matching));
  };

  const closeSession = () => {
    setSession(null);
    refreshProgress(); // so counts on this screen include the round just played
  };

  const restartSession = async () => {
    unlockAudio();
    primeKeyboard();
    const map = await refreshProgress();
    const list = filterWords(map);
    if (list.length === 0) {
      releaseKeyboardPrimer();
      setSession(null);
      setNotice({
        type: "info",
        title: "No words left",
        message: "No words match these filters any more. Try changing them.",
      });
      return;
    }
    setSession(buildSession(list));
  };

  const toggleIn = (set, setter, value) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };
  const toggleAllCategories = () =>
    setSelectedCategories(selectedCategories.size === categories.length ? new Set() : new Set(categories));
  const toggleAllDifficulties = () =>
    setSelectedDifficulties(selectedDifficulties.size === 10 ? new Set() : new Set(ALL_DIFFICULTIES));
  const toggleAllAccuracy = () =>
    setSelectedAccuracy(selectedAccuracy.size === ACCURACY_BUCKETS.length ? new Set() : new Set(ALL_BUCKET_IDS));

  const chip = (active) => ({ ...styles.chip, ...(active ? styles.chipActive : {}) });

  if (loading) {
    return (
      <div style={styles.shell}>
        <PracticeHeader title="📚 Practice" backLabel="← Menu" onBack={goBack} />
        <div style={styles.centerState}>
          <h1 style={styles.loadingText}>Loading...</h1>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.shell}>
        <PracticeHeader title="📚 Practice" backLabel="← Menu" onBack={goBack} />
        <div style={styles.centerState}>
          <div style={{ fontSize: 44 }}>⚠️</div>
          <p style={{ margin: "8px 0 16px", color: "#fde68a", maxWidth: 320, overflowWrap: "anywhere" }}>{loadError}</p>
          <button style={styles.primaryButton} onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <PracticeGame
        key={session.id}
        words={session.words}
        userId={userId}
        initialKnown={new Set(progress.keys())}
        onBack={closeSession}
        onMenu={goBack}
        onRestart={restartSession}
      />
    );
  }

  const needsPick = selectedCategories.size === 0 || selectedDifficulties.size === 0;
  const roundCount = roundSize > 0 ? Math.min(roundSize, matching.length) : matching.length;

  return (
    <div style={styles.shell}>
      <style>{KEYFRAMES}</style>
      <PracticeHeader title="📚 Practice" backLabel="← Menu" onBack={goBack} />

      <div style={styles.scrollArea}>
        <div style={styles.selectionBody}>
          <p style={styles.selectionSubtitle}>
            Pick what you want to practise. Your last choices are remembered.
          </p>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Categories</h2>
              <button onClick={toggleAllCategories} style={styles.selectAllButton}>
                {selectedCategories.size === categories.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            {categories.length === 0 ? (
              <p style={styles.errorText}>No categories found</p>
            ) : (
              <div style={styles.grid2Col}>
                {categories.map((category) => (
                  <label key={category} style={chip(selectedCategories.has(category))}>
                    <input
                      type="checkbox"
                      checked={selectedCategories.has(category)}
                      onChange={() => toggleIn(selectedCategories, setSelectedCategories, category)}
                      style={styles.checkbox}
                    />
                    {category}
                  </label>
                ))}
              </div>
            )}
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Difficulty (1-10)</h2>
              <button onClick={toggleAllDifficulties} style={styles.selectAllButton}>
                {selectedDifficulties.size === 10 ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div style={styles.grid5Col}>
              {ALL_DIFFICULTIES.map((level) => (
                <label key={level} style={{ ...chip(selectedDifficulties.has(level)), justifyContent: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedDifficulties.has(level)}
                    onChange={() => toggleIn(selectedDifficulties, setSelectedDifficulties, level)}
                    style={styles.checkbox}
                  />
                  {level}
                </label>
              ))}
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Accuracy</h2>
              <button onClick={toggleAllAccuracy} style={styles.selectAllButton}>
                {selectedAccuracy.size === ACCURACY_BUCKETS.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div style={styles.grid3Col}>
              {ACCURACY_BUCKETS.map((b) => (
                <label key={b.id} style={{ ...chip(selectedAccuracy.has(b.id)), justifyContent: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedAccuracy.has(b.id)}
                    onChange={() => toggleIn(selectedAccuracy, setSelectedAccuracy, b.id)}
                    style={styles.checkbox}
                  />
                  {b.label}
                </label>
              ))}
            </div>
            <p style={styles.hintText}>Words you have not seen yet count as 0%.</p>
          </section>

          <section style={styles.card}>
            <h2 style={{ ...styles.sectionTitle, marginBottom: 12 }}>Word status</h2>
            <div style={styles.segmented4}>
              {STATUS_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  style={{ ...styles.segment, ...(statusFilter === value ? styles.segmentActive : {}) }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p style={styles.hintText}>
              New = never answered · Learning = seen, not mastered yet · Mastered = 10 correct answers.
            </p>
          </section>

          <section style={styles.card}>
            <h2 style={{ ...styles.sectionTitle, marginBottom: 12 }}>Round</h2>
            <label style={{ ...chip(shuffle), justifyContent: "center" }}>
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
                style={styles.checkbox}
              />
              🔀 Shuffle order
            </label>
            <p style={styles.hintText}>
              {shuffle ? "Words come in a random order." : "Your weakest words come first."}
            </p>
            <h3 style={styles.subTitle}>Words per round</h3>
            <div style={styles.segmented4}>
              {ROUND_SIZES.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRoundSize(value)}
                  style={{ ...styles.segment, ...(roundSize === value ? styles.segmentActive : {}) }}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div style={styles.footerBar}>
        <div style={styles.footerInner}>
          <p style={styles.matchText}>
            {needsPick
              ? "Pick a category and a difficulty to begin"
              : `${matching.length.toLocaleString()} ${matching.length === 1 ? "word matches" : "words match"}`}
          </p>
          <button
            onClick={handleStart}
            style={{ ...styles.primaryButton, opacity: !needsPick && matching.length > 0 ? 1 : 0.6 }}
          >
            {!needsPick && matching.length > 0
              ? `Start practice (${roundCount} ${roundCount === 1 ? "word" : "words"}) →`
              : "Start practice →"}
          </button>
        </div>
      </div>

      <NoticeModal notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}

// ============================================================================
// GAME SCREEN
// ============================================================================
function PracticeGame({ words, userId, initialKnown, onBack, onMenu, onRestart }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [locked, setLocked] = useState(false);
  const answerLockedRef = useRef(false);
  const inputRef = useRef(null);

  const [card, setCard] = useState(null); // wrong / mastered pop-up
  const [correctCard, setCorrectCard] = useState(null);
  const pendingNextRef = useRef(null);
  const correctTimerRef = useRef(null);
  const masteredTimerRef = useRef(null);

  const [streak, setStreak] = useState(0); // used for praise text and the 🔥 chip
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [finished, setFinished] = useState(false);

  // New words, mastered words, milestones
  const [newWordCard, setNewWordCard] = useState(null);
  const [newWords, setNewWords] = useState([]);
  const [masteredWords, setMasteredWords] = useState([]);
  const knownWordIdsRef = useRef(new Set(initialKnown));
  const celebratedRef = useRef(new Set());
  const [milestonesReached, setMilestonesReached] = useState([]);
  const [milestoneCard, setMilestoneCard] = useState(null);
  const milestoneShownRef = useRef(new Set());

  const [mistakeError, setMistakeError] = useState("");
  const [saveError, setSaveError] = useState("");

  // Report an issue with a word
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  const [notice, setNotice] = useState(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(
    () => () => {
      clearTimeout(correctTimerRef.current);
      clearTimeout(masteredTimerRef.current);
    },
    []
  );

  // iPhone: detect when the keyboard is open so the top area can shrink
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => setKeyboardOpen(window.innerHeight - vv.height > 150);
    vv.addEventListener("resize", check);
    check();
    return () => vv.removeEventListener("resize", check);
  }, []);

  // Keep the keyboard open: cursor goes straight into the answer bar
  useEffect(() => {
    if (finished) return;
    inputRef.current?.focus();
    releaseKeyboardPrimer();
  }, [currentIndex, finished]);

  const currentWord = words[currentIndex];

  // New word detection: a word with no row in user_progress has never been seen
  useEffect(() => {
    if (finished || !currentWord) return;
    if (card || correctCard) return;
    // A milestone pop-up goes first
    if (milestoneCard || milestonesReached.some((m) => !milestoneShownRef.current.has(m))) return;
    if (celebratedRef.current.has(currentWord.id) || knownWordIdsRef.current.has(currentWord.id)) return;
    celebratedRef.current.add(currentWord.id);
    setNewWords((list) => [...list, { id: currentWord.id, english: currentWord.english, dutch: currentWord.dutch }]);
    setNewWordCard({ english: currentWord.english });
    playSound("newword");
    buzz([40, 50, 90]);
  }, [finished, currentWord, card, correctCard, milestoneCard, milestonesReached]);

  // Show a milestone pop-up as soon as no other pop-up is open
  useEffect(() => {
    if (milestoneCard || finished) return;
    if (card || correctCard || newWordCard) return;
    const next = milestonesReached.find((m) => !milestoneShownRef.current.has(m));
    if (!next) return;
    milestoneShownRef.current.add(next);
    setMilestoneCard(next);
    playSound("milestone");
    buzz([60, 40, 60, 40, 140]);
  }, [milestonesReached, milestoneCard, finished, card, correctCard, newWordCard]);

  // Sound when the round ends well
  useEffect(() => {
    if (!finished || stats.total === 0) return;
    if (stats.correct / stats.total >= 0.6) playSound("celebrate");
  }, [finished]);

  // ---------- progress ----------
  const saveAttempt = async (word, isCorrect, typedAnswer) => {
    const fallback = { newlyMastered: false };
    if (!userId) return fallback;

    try {
      const { data: existing, error: fetchError } = await supabase
        .from("user_progress")
        .select("id, correct_count, incorrect_count, mastered")
        .eq("user_id", userId)
        .eq("word_id", word.id)
        .maybeSingle();
      if (fetchError) throw fetchError;

      let newlyMastered = false;

      if (existing) {
        const correctCount = Number(existing.correct_count || 0) + (isCorrect ? 1 : 0);
        const incorrectCount = Number(existing.incorrect_count || 0) + (isCorrect ? 0 : 1);
        const isMastered = correctCount >= 10;
        newlyMastered = isCorrect && isMastered && !existing.mastered;
        const { error: updateError } = await supabase
          .from("user_progress")
          .update({
            correct_count: correctCount,
            incorrect_count: incorrectCount,
            mastered: isMastered,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("user_progress").insert({
          user_id: userId,
          word_id: word.id,
          correct_count: isCorrect ? 1 : 0,
          incorrect_count: isCorrect ? 0 : 1,
          mastered: false,
          last_seen_at: new Date().toISOString(),
        });
        if (insertError) throw insertError;
      }

      // Count words discovered; announce milestones (50, 100, 250, ...)
      const sizeBefore = knownWordIdsRef.current.size;
      knownWordIdsRef.current.add(word.id);
      const sizeAfter = knownWordIdsRef.current.size;
      if (sizeAfter > sizeBefore && isMilestone(sizeAfter)) {
        setMilestonesReached((list) => [...list, sizeAfter]);
      }

      // History of wrong answers (shown in Your Words and used by the Review hint)
      if (!isCorrect) {
        const { error: mistakeInsertError } = await supabase.from("word_mistakes").insert({
          user_id: userId,
          word_id: word.id,
          user_answer: typedAnswer || "",
          correct_answer: word.dutch || "",
          level: null,
          mode: "practice",
        });
        if (mistakeInsertError) {
          console.error("Could not save mistake:", mistakeInsertError);
          setMistakeError(mistakeInsertError.message || "Unknown error");
        } else {
          setMistakeError("");
        }
      }

      setSaveError("");
      return { newlyMastered };
    } catch (error) {
      console.error("Error updating progress:", error);
      setSaveError(error?.message || "Unknown database error");
      return fallback;
    }
  };

  // ---------- flow ----------
  const isLastWord = currentIndex >= words.length - 1;

  const advance = () => {
    setCard(null);
    setCorrectCard(null);
    setReportOpen(false);
    setReportText("");
    setReportNotes("");
    setAnswer("");
    if (isLastWord) {
      setFinished(true);
      return;
    }
    setCurrentIndex((i) => i + 1);
    answerLockedRef.current = false;
    setLocked(false);
  };

  const finishCorrectCard = () => {
    clearTimeout(correctTimerRef.current);
    const next = pendingNextRef.current;
    pendingNextRef.current = null;
    if (!next) return;
    setCorrectCard(null);
    inputRef.current?.focus(); // inside the tap, so the iPhone keyboard stays open
    next();
  };

  const showCorrectCard = (data, next) => {
    setCorrectCard(data);
    pendingNextRef.current = next;
    clearTimeout(correctTimerRef.current);
    correctTimerRef.current = setTimeout(finishCorrectCard, CORRECT_CARD_MS);
  };

  const continueFromCard = () => {
    if (!isLastWord) inputRef.current?.focus();
    advance();
  };

  const closeNewWordCard = () => {
    playSound("pop");
    setNewWordCard(null);
    inputRef.current?.focus();
  };

  const closeMilestoneCard = () => {
    playSound("pop");
    setMilestoneCard(null);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (answerLockedRef.current || finished || !currentWord || newWordCard || milestoneCard) return;
    answerLockedRef.current = true;
    setLocked(true);

    const word = currentWord;
    const typed = answer.trim();
    const userAnswer = answer.toLowerCase().trim();

    const correctFull = word.dutch.toLowerCase().trim();
    const correctBase = correctFull
      .split(",")[0]
      .replace(/^(de |het |een |het )/, "")
      .trim();

    const normalizedAnswer = normalize(userAnswer);
    const isCorrect =
      normalizedAnswer === normalize(correctFull) ||
      normalizedAnswer === normalize(correctBase) ||
      normalizedAnswer === normalize(`de ${correctBase}`) ||
      normalizedAnswer === normalize(`het ${correctBase}`);

    playSound(isCorrect ? "correct" : "wrong");
    buzz(isCorrect ? 30 : [80, 40, 120]);

    const newStreak = isCorrect ? streak + 1 : 0;
    setStreak(newStreak);
    setStats((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    setResults((list) => [...list, { wordId: word.id, english: word.english, dutch: word.dutch, correct: isCorrect }]);
    setAnswer("");

    const saved = await saveAttempt(word, isCorrect, typed);

    if (!isCorrect) {
      // Wrong answers wait until the player has read the correction
      setCard({ kind: "wrong", wordId: word.id, english: word.english, dutch: word.dutch, userAnswer: typed });
    } else if (saved.newlyMastered) {
      masteredTimerRef.current = setTimeout(() => {
        playSound("celebrate");
        setMasteredWords((list) => [...list, { id: word.id, english: word.english, dutch: word.dutch }]);
        setCard({ kind: "mastered", wordId: word.id, english: word.english, dutch: word.dutch });
      }, 700);
    } else {
      showCorrectCard({ praise: pickPraise(newStreak), english: word.english, dutch: word.dutch }, advance);
    }
  };

  // ---------- report an issue ----------
  const submitErrorReport = async () => {
    if (!reportText.trim() || !userId || !card) return;
    setReportLoading(true);
    try {
      const { error } = await supabase.from("word_issues").insert([
        {
          word_id: card.wordId,
          user_id: userId,
          english: card.english,
          dutch: card.dutch,
          user_answer: card.userAnswer || "",
          suggested_correction: reportText.trim(),
          feedback_text: reportNotes.trim(),
          resolved: false,
        },
      ]);
      if (error) throw error;
      setReportText("");
      setReportNotes("");
      setReportOpen(false);
      setNotice({
        type: "success",
        title: "Report sent",
        message: "Thanks for helping us improve the word list. We'll look into it soon.",
      });
    } catch (error) {
      console.error("Error submitting report:", error);
      setNotice({
        type: "error",
        title: "Couldn't send report",
        message: "Something went wrong while sending your report. Please try again.",
      });
    } finally {
      setReportLoading(false);
    }
  };

  const closeNotice = () => {
    const callback = notice?.onClose;
    setNotice(null);
    if (callback) callback();
  };

  // ---------- finished ----------
  if (finished) {
    const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    const missed = [];
    const seenMissed = new Set();
    results.forEach((r) => {
      if (!r.correct && !seenMissed.has(r.wordId)) {
        seenMissed.add(r.wordId);
        missed.push(r);
      }
    });

    return (
      <>
        <div style={styles.finishContainer}>
          <style>{KEYFRAMES}</style>
          {pct >= 60 && <Confetti />}
          <div style={{ fontSize: 64, textAlign: "center", animation: "pPop 0.7s ease-out" }}>📚</div>
          <h1 style={styles.finishTitle}>Practice complete!</h1>

          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <p style={styles.statValue}>{stats.correct}/{stats.total}</p>
              <p style={styles.statLabel}>Correct</p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statValue}>{pct}%</p>
              <p style={styles.statLabel}>Accuracy</p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statValue}>✨ {newWords.length}</p>
              <p style={styles.statLabel}>New words</p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statValue}>🏅 {masteredWords.length}</p>
              <p style={styles.statLabel}>Mastered</p>
            </div>
          </div>

          {milestonesReached.length > 0 && (
            <p style={{ ...styles.saveStatus, color: "#fcd34d" }}>
              🏆 Milestone reached: {milestonesReached.map((m) => `${m.toLocaleString()} words`).join(" · ")}
            </p>
          )}
          {saveError && (
            <p role="alert" style={{ ...styles.saveStatus, color: "#fde68a" }}>
              ⚠️ Some answers could not be saved: {saveError}
            </p>
          )}

          <div style={styles.buttonContainer}>
            <button onClick={onRestart} style={styles.primaryButton}>Practise again</button>
            <button onClick={onBack} style={styles.secondaryButton}>Change filters</button>
            <button onClick={onMenu} style={styles.secondaryButton}>← Menu</button>
          </div>

          {newWords.length > 0 && (
            <div style={{ ...styles.listSection, border: "1px solid rgba(251,191,36,0.35)" }}>
              <h2 style={{ ...styles.listTitle, color: "#fcd34d" }}>✨ New words</h2>
              <div style={styles.listRows}>
                {newWords.slice(0, 12).map((item) => (
                  <div key={item.id} style={styles.listRow}>
                    <span style={styles.listEnglish}>{item.english}</span>
                    <span style={styles.listDutch}>{item.dutch}</span>
                  </div>
                ))}
                {newWords.length > 12 && (
                  <p style={{ ...styles.listDutch, textAlign: "center", margin: 0 }}>
                    + {newWords.length - 12} more in Your Words
                  </p>
                )}
              </div>
            </div>
          )}

          {missed.length > 0 && (
            <div style={styles.listSection}>
              <h2 style={styles.listTitle}>📝 Missed words</h2>
              <div style={styles.listRows}>
                {missed.slice(0, 10).map((item) => (
                  <div key={item.wordId} style={styles.listRow}>
                    <span style={styles.listEnglish}>{item.english}</span>
                    <span style={styles.listDutch}>{item.dutch}</span>
                  </div>
                ))}
                {missed.length > 10 && (
                  <p style={{ ...styles.listDutch, textAlign: "center", margin: 0 }}>
                    + {missed.length - 10} more in Your Words
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <NoticeModal notice={notice} onClose={closeNotice} />
      </>
    );
  }

  if (!currentWord) return null;

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;

  return (
    <>
      <div style={styles.container}>
        <style>{KEYFRAMES}</style>

        <div style={styles.stickyTop}>
          <PracticeHeader
            title="📚 Practice"
            backLabel={keyboardOpen ? "←" : "← Back"}
            onBack={onBack}
            onPopoverClose={() => inputRef.current?.focus()}
          />

          <div style={keyboardOpen ? styles.hudCompact : styles.hud}>
            <div style={styles.scoreWrap}>
              <span style={keyboardOpen ? styles.scoreCompact : styles.scoreBig}>{stats.correct}</span>
              <span style={styles.scoreLabel}>
                correct{stats.total > 0 ? ` of ${stats.total}` : ""}
              </span>
            </div>
            <div style={styles.chipRow}>
              {streak >= 2 && <span style={styles.pillOrange}>🔥 {streak}</span>}
              {accuracy !== null && <span style={styles.pillBlue}>🎯 {accuracy}%</span>}
            </div>
          </div>

          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${((currentIndex + 1) / words.length) * 100}%`,
              }}
            />
          </div>
        </div>

        <div style={styles.questionContainer}>
          <p style={styles.questionLabel}>
            Question {currentIndex + 1}/{words.length}
          </p>
          <h2 style={styles.questionText}>Translate to Dutch:</h2>
          <h1 style={{ ...styles.wordToTranslate, ...(keyboardOpen ? { fontSize: "28px" } : {}) }}>
            {currentWord.english}
          </h1>
        </div>

        {currentWord.example_nl && (
          <div style={styles.exampleBox}>
            <p style={styles.exampleNL}>
              <strong>🇳🇱</strong> {currentWord.example_nl}
            </p>
            {currentWord.example_en && (
              <p style={styles.exampleEN}>
                <strong>🇬🇧</strong> {currentWord.example_en}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={(e) => {
              if (!answerLockedRef.current && !newWordCard && !milestoneCard) setAnswer(e.target.value);
            }}
            placeholder="Type the translation..."
            style={styles.input}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
          />
          <button
            type="submit"
            style={styles.submitButton}
            disabled={locked || !!newWordCard || !!milestoneCard}
            onMouseDown={(e) => e.preventDefault()}
          >
            Submit
          </button>
        </form>

        {saveError && (
          <p role="alert" style={styles.saveWarning}>
            ⚠️ This answer could not be saved: {saveError}
          </p>
        )}

        <div style={{ height: 24 }} />
      </div>

      {/* CORRECT */}
      {correctCard && !card && (
        <div
          role="status"
          aria-live="polite"
          style={styles.correctOverlay}
          onMouseDown={(e) => e.preventDefault()}
          onClick={finishCorrectCard}
        >
          <div style={styles.correctCard}>
            <div style={styles.correctBadge}>✓</div>
            <h2 style={styles.correctTitle}>{correctCard.praise}</h2>
            <p style={styles.correctWords}>
              {correctCard.english} → <strong>{correctCard.dutch}</strong>
            </p>
            <div style={styles.correctTimerTrack}>
              <div style={{ ...styles.correctTimerFill, animationDuration: `${CORRECT_CARD_MS}ms` }} />
            </div>
            <p style={styles.correctHint}>Tap to continue</p>
          </div>
        </div>
      )}

      {/* NEW WORD */}
      {newWordCard && !card && (
        <div role="dialog" aria-modal="true" aria-labelledby="practice-new-title" style={styles.overlay}>
          <Confetti />
          <div style={styles.modalCard}>
            <div style={{ ...styles.bigEmoji }}>
              <span style={{ display: "inline-block", animation: "pSparkle 1.6s ease-in-out infinite" }}>✨</span>
            </div>
            <p style={styles.newWordEyebrow}>NEW WORD DISCOVERED</p>
            <h2 id="practice-new-title" style={styles.cardTitle}>You haven't met this one yet</h2>
            <div style={styles.newWordBox}>
              <span style={styles.newWordLabel}>ENGLISH</span>
              <strong style={styles.newWordEnglish}>{newWordCard.english}</strong>
            </div>
            <p style={styles.cardNote}>Take your best guess. It joins Your Words as soon as you answer.</p>
            <button type="button" onClick={closeNewWordCard} style={styles.modalPrimaryButton}>
              Let's try it<span aria-hidden="true"> →</span>
            </button>
          </div>
        </div>
      )}

      {/* MILESTONE */}
      {milestoneCard && !card && (
        <div role="dialog" aria-modal="true" aria-labelledby="practice-milestone-title" style={styles.overlay}>
          <Confetti />
          <div
            style={{
              ...styles.modalCard,
              border: "1px solid rgba(251,191,36,0.6)",
              boxShadow: "0 24px 70px rgba(0,0,0,0.5), 0 0 50px rgba(251,191,36,0.25)",
            }}
          >
            <div style={styles.bigEmoji}>{milestoneIcon(milestoneCard)}</div>
            <p style={styles.newWordEyebrow}>MILESTONE REACHED</p>
            <h2 id="practice-milestone-title" style={styles.cardTitle}>
              {milestoneCard.toLocaleString()} words discovered!
            </h2>
            <div style={styles.newWordBox}>
              <strong style={styles.newWordEnglish}>{milestoneCard.toLocaleString()}</strong>
              <span style={styles.newWordLabel}>WORDS IN YOUR WORDS</span>
            </div>
            <p style={styles.cardNote}>{milestoneText(milestoneCard)}</p>
            <button type="button" onClick={closeMilestoneCard} style={styles.modalPrimaryButton}>
              Keep going<span aria-hidden="true"> →</span>
            </button>
          </div>
        </div>
      )}

      {/* WRONG / MASTERED / REPORT */}
      {card && (
        <div role="dialog" aria-modal="true" aria-labelledby="practice-card-title" style={styles.overlay}>
          {card.kind === "mastered" ? (
            <>
              <Confetti />
              <div style={styles.modalCard}>
                <div style={styles.bigEmoji}>🏅</div>
                <p style={styles.masteredEyebrow}>WORD MASTERED</p>
                <h2 id="practice-card-title" style={styles.cardTitle}>You know this one!</h2>
                <p style={styles.cardEnglish}>{card.english}</p>
                <div style={styles.correctAnswerBox}>
                  <span style={styles.correctAnswerLabel}>DUTCH</span>
                  <strong style={styles.correctAnswerDutch}>{card.dutch}</strong>
                </div>
                <p style={styles.cardNote}>10 correct answers. It now counts as a mastered word.</p>
                <button type="button" onClick={continueFromCard} style={styles.modalPrimaryButton}>
                  {isLastWord ? "See results" : "Keep going"}
                  <span aria-hidden="true"> →</span>
                </button>
              </div>
            </>
          ) : !reportOpen ? (
            <div style={styles.modalCard}>
              <div
                style={{
                  ...styles.modalIcon,
                  color: "#fca5a5",
                  background: "rgba(248,113,113,0.15)",
                  borderColor: "#f87171",
                }}
              >
                ✕
              </div>
              <p style={styles.wrongEyebrow}>NOT QUITE</p>
              <h2 id="practice-card-title" style={styles.cardTitle}>Learn from this one</h2>
              <p style={styles.cardEnglish}>{card.english}</p>
              <div style={styles.correctAnswerBox}>
                <span style={styles.correctAnswerLabel}>CORRECT ANSWER</span>
                <strong style={styles.correctAnswerDutch}>{card.dutch}</strong>
              </div>
              <p style={styles.cardNote}>
                {card.userAnswer ? (
                  <>
                    Your answer: <strong>{card.userAnswer}</strong>
                  </>
                ) : (
                  "No answer entered"
                )}
              </p>
              {mistakeError && (
                <p role="alert" style={styles.mistakeWarning}>
                  ⚠️ This mistake could not be saved to your history: {mistakeError}
                </p>
              )}
              <button type="button" onClick={continueFromCard} style={styles.modalPrimaryButton}>
                {isLastWord ? "See results" : "Next question"}
                <span aria-hidden="true"> →</span>
              </button>
              <button type="button" onClick={() => setReportOpen(true)} style={styles.reportLinkButton}>
                ⚑ Report issue with this word
              </button>
            </div>
          ) : (
            <div style={{ ...styles.modalCard, textAlign: "left" }}>
              <h2 id="practice-card-title" style={styles.reportTitle}>Report a word issue</h2>
              <p style={styles.reportWord}>
                <strong>{card.english}</strong> → {card.dutch}
              </p>

              <label style={styles.formLabel} htmlFor="practice-report-correction">
                What should the correct translation be?
              </label>
              <input
                id="practice-report-correction"
                type="text"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Type the correct translation..."
                style={styles.reportInput}
              />

              <label style={{ ...styles.formLabel, marginTop: 12 }} htmlFor="practice-report-notes">
                Extra notes (optional)
              </label>
              <textarea
                id="practice-report-notes"
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="Add any extra context..."
                maxLength={1000}
                rows={3}
                style={styles.reportTextarea}
              />

              <div style={styles.reportActions}>
                <button
                  type="button"
                  onClick={() => {
                    setReportOpen(false);
                    setReportText("");
                    setReportNotes("");
                  }}
                  style={styles.reportCancelButton}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={submitErrorReport}
                  disabled={reportLoading || !reportText.trim()}
                  style={{
                    ...styles.reportSubmitButton,
                    opacity: reportLoading || !reportText.trim() ? 0.6 : 1,
                    cursor: reportLoading || !reportText.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {reportLoading ? "Sending..." : "Send report"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <NoticeModal notice={notice} onClose={closeNotice} />
    </>
  );
}

const styles = {
  // ---------- Shells ----------
  // Selection screen: header and footer stay put, only the middle scrolls
  shell: {
    position: "fixed",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    fontFamily: FONT,
    overflow: "hidden",
  },
  scrollArea: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    overscrollBehavior: "contain",
  },
  centerState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "40px 20px",
  },
  // Game screen (same as Play / Review)
  container: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: "var(--vv-height, 100%)",
    transform: "translateY(var(--vv-top, 0px))",
    overflowY: "auto",
    overflowX: "hidden",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    padding: "0",
    fontFamily: FONT,
    display: "flex",
    flexDirection: "column",
  },
  stickyTop: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
  },

  // ---------- Header (same as Play / Review) ----------
  header: {
    position: "relative",
    zIndex: 100,
    flex: "0 0 auto",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "max(12px, env(safe-area-inset-top)) 16px 12px",
    borderBottom: "1px solid rgba(6,182,212,0.2)",
    gap: "8px",
  },
  headerRight: { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 },
  title: {
    fontSize: "clamp(18px, 5vw, 24px)",
    fontWeight: "800",
    margin: "0",
    color: "white",
    textShadow: "0 2px 8px rgba(6,182,212,0.3)",
    flex: "1 1 auto",
    whiteSpace: "nowrap",
  },
  backButton: {
    padding: "8px 12px",
    fontSize: "clamp(11px, 2.5vw, 12px)",
    background: "#06b6d4",
    color: "#0f172a",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  audioButton: {
    padding: "6px 9px", fontSize: "16px", lineHeight: 1, background: "rgba(255,255,255,0.1)", color: "white",
    border: "1px solid rgba(6,182,212,0.4)", borderRadius: "6px", cursor: "pointer", flexShrink: 0,
  },
  audioBackdrop: { position: "fixed", inset: 0, zIndex: 1, background: "transparent" },
  audioPopover: {
    position: "absolute", top: "calc(100% + 6px)", right: "12px", zIndex: 2, width: "min(300px, calc(100vw - 24px))",
    boxSizing: "border-box", padding: "14px", borderRadius: "14px", color: "#f8fafc",
    background: "linear-gradient(160deg, #1e293b 0%, #172554 100%)", border: "1px solid rgba(148,163,184,0.35)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.5)",
  },
  audioRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  audioLabel: { fontSize: "14px", fontWeight: 700, color: "#e2e8f0" },
  audioToggle: (on) => ({
    position: "relative", width: "46px", height: "26px", borderRadius: "13px", border: "none", cursor: "pointer",
    background: on ? "#06b6d4" : "#64748b", transition: "background 0.2s ease", flexShrink: 0, padding: 0,
  }),
  audioKnob: (on) => ({
    position: "absolute", top: "3px", left: on ? "23px" : "3px", width: "20px", height: "20px", borderRadius: "50%",
    background: "white", transition: "left 0.2s ease",
  }),
  audioSliderRow: { display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" },
  audioRange: { flex: 1, minWidth: 0, height: "32px", accentColor: "#06b6d4", touchAction: "pan-y", cursor: "pointer" },
  audioValue: { width: "42px", textAlign: "right", fontSize: "13px", color: "#fff", fontVariantNumeric: "tabular-nums" },
  audioDone: {
    width: "100%", marginTop: "12px", padding: "10px", borderRadius: "10px", border: "none", cursor: "pointer",
    fontWeight: 700, fontFamily: "inherit", color: "#0f172a", background: "#06b6d4",
  },

  // ---------- Selection ----------
  selectionBody: {
    width: "100%",
    maxWidth: "600px",
    margin: "0 auto",
    padding: "16px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  selectionSubtitle: { fontSize: "14px", color: "#bfdbfe", textAlign: "center", margin: "0" },
  card: {
    background: "rgba(30, 58, 138, 0.8)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "12px",
    padding: "14px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  sectionTitle: { fontSize: "16px", fontWeight: "700", color: "#67e8f9", margin: "0" },
  subTitle: { fontSize: "13px", fontWeight: "700", color: "#67e8f9", margin: "16px 0 8px" },
  hintText: { margin: "10px 0 0", fontSize: "12px", color: "#93c5fd", lineHeight: 1.4 },
  selectAllButton: {
    padding: "5px 10px",
    fontSize: "12px",
    background: "#06b6d4",
    color: "#0f172a",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },
  grid2Col: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
  grid3Col: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" },
  grid5Col: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" },
  chip: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "8px",
    background: "rgba(30, 58, 138, 0.4)",
    color: "#bfdbfe",
    fontSize: "13px",
    cursor: "pointer",
    userSelect: "none",
    transition: "all 0.2s ease",
  },
  chipActive: { background: "rgba(6,182,212,0.15)", borderColor: "#06b6d4", color: "white" },
  checkbox: { width: "14px", height: "14px", cursor: "pointer", accentColor: "#06b6d4", flexShrink: 0 },
  segmented4: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" },
  segment: {
    padding: "10px 4px",
    fontSize: "12px",
    fontWeight: "600",
    fontFamily: "inherit",
    color: "#bfdbfe",
    background: "rgba(30, 58, 138, 0.4)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "8px",
    cursor: "pointer",
  },
  segmentActive: {
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    borderColor: "transparent",
    color: "white",
  },
  errorText: { color: "#fca5a5", fontSize: "14px", margin: 0 },
  footerBar: {
    flex: "0 0 auto",
    padding: "10px 16px max(12px, env(safe-area-inset-bottom))",
    background: "#10224f",
    borderTop: "1px solid rgba(6,182,212,0.3)",
    boxShadow: "0 -6px 18px rgba(0,0,0,0.3)",
  },
  footerInner: {
    maxWidth: "600px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "stretch",
  },
  matchText: { margin: 0, textAlign: "center", color: "#bfdbfe", fontSize: "13px", fontWeight: "600" },
  primaryButton: {
    padding: "14px 24px",
    fontSize: "16px",
    fontWeight: "700",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
    fontFamily: "inherit",
    width: "100%",
    maxWidth: "450px",
    alignSelf: "center",
  },
  secondaryButton: {
    padding: "12px 20px",
    fontSize: "14px",
    fontWeight: "600",
    background: "rgba(255,255,255,0.1)",
    color: "#06b6d4",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "10px",
    cursor: "pointer",
    fontFamily: "inherit",
    width: "100%",
    maxWidth: "450px",
    alignSelf: "center",
  },
  loadingText: { fontSize: "clamp(20px, 5vw, 28px)", color: "white", margin: "0", fontWeight: "700" },

  // ---------- Game top bar ----------
  hud: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "12px 16px 10px",
  },
  hudCompact: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "6px 16px",
  },
  scoreWrap: { display: "flex", alignItems: "baseline", gap: "8px" },
  scoreBig: {
    fontSize: "clamp(34px, 10vw, 44px)",
    fontWeight: "800",
    color: "#fbbf24",
    lineHeight: 1,
    textShadow: "0 2px 12px rgba(251,191,36,0.35)",
    fontVariantNumeric: "tabular-nums",
  },
  scoreCompact: { fontSize: "22px", fontWeight: "800", color: "#fbbf24", lineHeight: 1, fontVariantNumeric: "tabular-nums" },
  scoreLabel: { fontSize: "13px", color: "#93c5fd", fontWeight: "600" },
  chipRow: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
  pillBlue: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#93c5fd",
    background: "rgba(59,130,246,0.16)",
    border: "1px solid rgba(59,130,246,0.4)",
    borderRadius: "999px",
    padding: "2px 9px",
    whiteSpace: "nowrap",
  },
  pillOrange: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#fdba74",
    background: "rgba(249,115,22,0.18)",
    border: "1px solid rgba(249,115,22,0.4)",
    borderRadius: "999px",
    padding: "2px 9px",
    whiteSpace: "nowrap",
  },
  progressBar: { height: "6px", background: "rgba(6,182,212,0.2)", overflow: "hidden" },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
    transition: "width 0.3s ease",
  },

  // ---------- Question ----------
  questionContainer: { textAlign: "center", padding: "16px 20px 0", marginBottom: "16px" },
  questionLabel: { fontSize: "13px", color: "#93c5fd", margin: "0 0 6px 0", fontWeight: "600" },
  questionText: { fontSize: "clamp(13px, 3vw, 14px)", color: "#bfdbfe", margin: "0 0 8px 0", fontWeight: "500" },
  wordToTranslate: {
    fontSize: "clamp(28px, 7vw, 40px)",
    color: "white",
    margin: "0",
    fontWeight: "700",
    wordBreak: "break-word",
  },
  exampleBox: {
    background: "rgba(30, 58, 138, 0.6)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "10px",
    padding: "14px 16px",
    margin: "0 16px 16px",
    maxWidth: "600px",
    boxSizing: "border-box",
    alignSelf: "center",
    width: "calc(100% - 32px)",
  },
  exampleNL: { color: "#bfdbfe", margin: "0 0 8px 0", fontSize: "clamp(15px, 4vw, 17px)", lineHeight: 1.45 },
  exampleEN: { color: "#cbd5e1", margin: "0", fontSize: "clamp(14px, 3.6vw, 16px)", lineHeight: 1.45 },
  form: {
    display: "flex",
    gap: "8px",
    padding: "0 16px 12px",
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "600px",
    alignSelf: "center",
  },
  input: {
    padding: "10px 12px",
    fontSize: "16px",
    border: "1px solid rgba(6,182,212,0.4)",
    borderRadius: "6px",
    flex: 1,
    minWidth: 0,
    boxSizing: "border-box",
    background: "rgba(255,255,255,0.95)",
    color: "#0f172a",
    fontFamily: "inherit",
  },
  submitButton: {
    padding: "10px 16px",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(59, 130, 246, 0.2)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  saveWarning: {
    margin: "0 16px 12px", padding: "8px 10px", borderRadius: "10px", fontSize: "12px", textAlign: "left",
    color: "#fde68a", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.4)",
    overflowWrap: "anywhere", alignSelf: "center", maxWidth: "568px", boxSizing: "border-box",
  },

  // ---------- Finished screen ----------
  finishContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "max(24px, env(safe-area-inset-top)) 16px 32px",
    boxSizing: "border-box",
    fontFamily: FONT,
  },
  finishTitle: { fontSize: "clamp(26px, 6vw, 36px)", color: "white", margin: "8px 0 20px", textAlign: "center" },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
    maxWidth: "400px",
    margin: "0 auto 16px",
    width: "100%",
  },
  statCard: {
    background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
    border: "1px solid rgba(6,182,212,0.2)",
    borderRadius: "10px",
    padding: "14px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  statValue: { fontSize: "clamp(20px, 4vw, 28px)", fontWeight: "700", color: "#fbbf24", margin: "0 0 4px 0" },
  statLabel: {
    fontSize: "clamp(10px, 2vw, 11px)",
    color: "#bfdbfe",
    margin: "0",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  saveStatus: { textAlign: "center", fontSize: "13px", fontWeight: "600", margin: "0 0 14px" },
  buttonContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxWidth: "450px",
    width: "100%",
    alignItems: "center",
    marginBottom: "20px",
  },
  listSection: {
    background: "rgba(30, 58, 138, 0.6)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "10px",
    padding: "14px",
    maxWidth: "450px",
    margin: "0 auto 16px",
    width: "100%",
    boxSizing: "border-box",
  },
  listTitle: { fontSize: "14px", color: "#fca5a5", margin: "0 0 12px 0", fontWeight: "600" },
  listRows: { display: "flex", flexDirection: "column", gap: "8px" },
  listRow: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "10px",
    background: "rgba(30, 58, 138, 0.8)",
    borderRadius: "6px",
    border: "1px solid rgba(6,182,212,0.2)",
  },
  listEnglish: { fontWeight: "600", color: "white", fontSize: "13px" },
  listDutch: { color: "#93c5fd", fontSize: "12px" },

  // ---------- Correct pop-up (same as Review) ----------
  correctOverlay: {
    position: "fixed", inset: 0, zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "18px", background: "rgba(2, 6, 23, 0.55)", cursor: "pointer", fontFamily: FONT,
  },
  correctCard: {
    width: "100%", maxWidth: "320px", boxSizing: "border-box", padding: "22px 20px 16px", borderRadius: "24px",
    textAlign: "center", color: "#f8fafc", background: "linear-gradient(160deg, #134e4a 0%, #172554 100%)",
    border: "1px solid rgba(52,211,153,0.6)", boxShadow: "0 20px 60px rgba(0,0,0,0.45), 0 0 30px rgba(52,211,153,0.2)",
    animation: "pCardPop 0.35s ease-out",
  },
  correctBadge: {
    width: "46px", height: "46px", margin: "0 auto 8px", borderRadius: "50%", display: "flex", alignItems: "center",
    justifyContent: "center", background: "rgba(16,185,129,0.18)", border: "2px solid #34d399", color: "#6ee7b7",
    fontSize: "24px", fontWeight: 900,
  },
  correctTitle: { margin: "0 0 6px", fontSize: "24px", fontWeight: 850, lineHeight: 1.2 },
  correctWords: { margin: "0 0 14px", color: "#cbd5e1", fontSize: "15px", overflowWrap: "anywhere" },
  correctTimerTrack: { height: "4px", borderRadius: "999px", background: "rgba(255,255,255,0.12)", overflow: "hidden" },
  correctTimerFill: {
    height: "100%", background: "linear-gradient(90deg, #34d399, #06b6d4)", transformOrigin: "left center",
    animationName: "pTimerShrink", animationTimingFunction: "linear", animationFillMode: "forwards",
  },
  correctHint: { margin: "8px 0 0", fontSize: "11px", color: "#94a3b8" },

  // ---------- Modals (wrong / mastered / new word / milestone / notice) ----------
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "max(18px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom))",
    background: "rgba(2, 6, 23, 0.82)",
    backdropFilter: "blur(8px)",
    overflowY: "auto",
    fontFamily: FONT,
  },
  modalCard: {
    width: "100%",
    maxWidth: "420px",
    maxHeight: "100%",
    overflowY: "auto",
    boxSizing: "border-box",
    padding: "26px 22px 22px",
    borderRadius: "26px",
    color: "#f8fafc",
    textAlign: "center",
    background: "linear-gradient(160deg, #1e293b 0%, #172554 100%)",
    border: "1px solid rgba(148,163,184,0.35)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
  },
  modalIcon: {
    width: "48px",
    height: "48px",
    margin: "0 auto 10px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid",
    fontSize: "24px",
    fontWeight: 900,
  },
  bigEmoji: { fontSize: "64px", lineHeight: 1, margin: "0 auto 8px", textAlign: "center", animation: "pPop 0.7s ease-out" },
  wrongEyebrow: { margin: "0 0 5px", color: "#fca5a5", fontSize: "12px", fontWeight: 900, letterSpacing: "2px" },
  masteredEyebrow: { margin: "0 0 5px", color: "#fcd34d", fontSize: "12px", fontWeight: 900, letterSpacing: "2px" },
  newWordEyebrow: { margin: "0 0 5px", color: "#fcd34d", fontSize: "12px", fontWeight: 900, letterSpacing: "2px" },
  newWordBox: {
    display: "flex", flexDirection: "column", gap: "7px", padding: "17px 14px", borderRadius: "16px",
    background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.55)",
  },
  newWordLabel: { color: "#fcd34d", fontSize: "11px", fontWeight: 900, letterSpacing: "1.5px" },
  newWordEnglish: { color: "#fffbeb", fontSize: "clamp(24px, 7vw, 32px)", overflowWrap: "anywhere", lineHeight: 1.2 },
  cardTitle: { margin: "0 0 12px", fontSize: "24px", lineHeight: 1.2, fontWeight: 850 },
  cardEnglish: { margin: "0 0 14px", fontSize: "17px", color: "#cbd5e1" },
  cardNote: { margin: "14px 0 18px", color: "#cbd5e1", fontSize: "14px", lineHeight: 1.5, overflowWrap: "anywhere" },
  mistakeWarning: {
    margin: "0 0 14px", padding: "8px 10px", borderRadius: "10px", fontSize: "12px", textAlign: "left",
    color: "#fde68a", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.4)",
    overflowWrap: "anywhere",
  },
  correctAnswerBox: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    padding: "17px 14px",
    borderRadius: "16px",
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(52,211,153,0.55)",
  },
  correctAnswerLabel: { color: "#6ee7b7", fontSize: "11px", fontWeight: 900, letterSpacing: "1.5px" },
  correctAnswerDutch: { color: "#ecfdf5", fontSize: "clamp(24px, 7vw, 32px)", overflowWrap: "anywhere", lineHeight: 1.2 },
  modalTitle: { margin: "0 0 8px", fontSize: "22px", lineHeight: 1.2, fontWeight: 850 },
  modalText: { margin: "0 0 20px", color: "#cbd5e1", fontSize: "15px", lineHeight: 1.5 },
  modalPrimaryButton: {
    width: "100%",
    border: 0,
    borderRadius: "14px",
    padding: "15px 18px",
    color: "#052e2b",
    background: "linear-gradient(135deg, #6ee7b7, #34d399)",
    fontSize: "16px",
    fontWeight: 850,
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: "0 8px 22px rgba(16,185,129,0.2)",
  },
  reportLinkButton: {
    display: "block",
    margin: "12px auto 0",
    padding: "10px 12px",
    border: "1px solid rgba(148,163,184,0.35)",
    borderRadius: "10px",
    color: "#cbd5e1",
    background: "transparent",
    fontSize: "13px",
    fontFamily: "inherit",
    cursor: "pointer",
  },
  reportTitle: { margin: "0 0 8px", fontSize: "20px", fontWeight: 850 },
  reportWord: { margin: "0 0 14px", color: "#bfdbfe", fontSize: "15px" },
  formLabel: { display: "block", marginBottom: "6px", fontSize: "13px", color: "#bfdbfe", fontWeight: "600" },
  reportInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    fontSize: "16px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    background: "#ffffff",
    color: "#111827",
    fontFamily: "inherit",
    colorScheme: "light",
  },
  reportTextarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px",
    minHeight: "88px",
    borderRadius: "7px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    font: "inherit",
    fontSize: "16px",
    resize: "vertical",
    color: "#111827",
    caretColor: "#111827",
    colorScheme: "light",
  },
  reportActions: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" },
  reportCancelButton: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #64748b",
    color: "white",
    background: "transparent",
    fontFamily: "inherit",
    cursor: "pointer",
  },
  reportSubmitButton: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "none",
    color: "white",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    fontWeight: "700",
    fontFamily: "inherit",
  },
};

export default Practice;
