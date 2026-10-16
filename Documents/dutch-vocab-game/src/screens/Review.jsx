import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { playSound } from "../sounds";

// "Master" mode. The file is still called Review.jsx so Home.jsx keeps working.

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const CORRECT_CARD_MS = 1400; // how long the "correct" pop-up stays (tap to skip)

const KEYFRAMES = `
@keyframes rConfettiFall {
  0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
}
@keyframes rCardPop {
  0%   { opacity: 0; transform: scale(0.7) translateY(10px); }
  60%  { opacity: 1; transform: scale(1.06); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes rPop {
  0%   { opacity: 0; transform: scale(0.3); }
  60%  { opacity: 1; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes rTimerShrink {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}
@keyframes rHintOpen {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
`;

// Accuracy filter buckets (lower bound included, upper bound excluded)
const ACCURACY_BUCKETS = [
  { id: "0-25", label: "0–25%", test: (p) => p < 25 },
  { id: "25-50", label: "25–50%", test: (p) => p >= 25 && p < 50 },
  { id: "50-75", label: "50–75%", test: (p) => p >= 50 && p < 75 },
  { id: "75-99", label: "75–99%", test: (p) => p >= 75 && p < 100 },
  { id: "100", label: "100%", test: (p) => p >= 100 },
];
const ALL_BUCKET_IDS = ACCURACY_BUCKETS.map((b) => b.id);

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

// Small vibration (Android only). Follows the sound setting.
const buzz = (pattern) => {
  try {
    if (localStorage.getItem("soundEnabled") !== "false") navigator.vibrate?.(pattern);
  } catch (e) {}
};

const shuffleArray = (list) => {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

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
            animation: `rConfettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

function Review({ goBack }) {
  const [words, setWords] = useState([]);
  const [reviewWords, setReviewWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [userId, setUserId] = useState(null);

  // Answer flow
  const [locked, setLocked] = useState(false);
  const answerLockedRef = useRef(false);
  const [card, setCard] = useState(null); // wrong / mastered pop-up
  const [correctCard, setCorrectCard] = useState(null);
  const pendingNextRef = useRef(null);
  const correctTimerRef = useRef(null);
  const [mistakeError, setMistakeError] = useState("");
  const [streak, setStreak] = useState(0); // only used to pick the praise text
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [finished, setFinished] = useState(false);
  const [live, setLive] = useState({}); // fresh counts for words answered in this session

  // Hint
  const [hintOpen, setHintOpen] = useState(false);
  const [hints, setHints] = useState({}); // { [wordId]: { loading, items, error } }

  // Filter states
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [selectedDifficulties, setSelectedDifficulties] = useState(new Set());
  const [selectedAccuracy, setSelectedAccuracy] = useState(new Set(ALL_BUCKET_IDS));
  const [masteredFilter, setMasteredFilter] = useState("both");
  const [shuffle, setShuffle] = useState(false);

  // UI states
  const [categories, setCategories] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [notice, setNotice] = useState(null); // { type, title, message, onClose }
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const inputRef = useRef(null);

  // Audio popover in the header (same localStorage keys as Settings / Play)
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

  useEffect(() => () => clearTimeout(correctTimerRef.current), []);

  // ============================================================================
  // FUNCTION: Update user progress (+ save the wrong answer for the hint)
  // ============================================================================
  const updateUserProgress = async (word, isCorrect, typedAnswer) => {
    const fallback = { newlyMastered: false };
    if (!userId) return fallback;

    try {
      const { data: existing, error: fetchError } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("word_id", word.id)
        .maybeSingle();

      if (fetchError) {
        console.error("Fetch error:", fetchError);
        return fallback;
      }

      let correctCount;
      let incorrectCount;
      let newlyMastered = false;

      if (existing) {
        correctCount = existing.correct_count + (isCorrect ? 1 : 0);
        incorrectCount = existing.incorrect_count + (isCorrect ? 0 : 1);
        const isMastered = correctCount >= 10;
        newlyMastered = isCorrect && isMastered && !existing.mastered;

        await supabase
          .from("user_progress")
          .update({
            correct_count: correctCount,
            incorrect_count: incorrectCount,
            mastered: isMastered,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        correctCount = isCorrect ? 1 : 0;
        incorrectCount = isCorrect ? 0 : 1;
        await supabase.from("user_progress").insert([
          {
            user_id: userId,
            word_id: word.id,
            correct_count: correctCount,
            incorrect_count: incorrectCount,
            mastered: false,
            last_seen_at: new Date().toISOString(),
          },
        ]);
      }

      // Keep the on-screen numbers fresh without re-sorting the list
      const total = correctCount + incorrectCount;
      setLive((prev) => ({
        ...prev,
        [word.id]: {
          correct_count: correctCount,
          incorrect_count: incorrectCount,
          masteryPercent: total > 0 ? Math.round((correctCount / total) * 100) : 0,
          mastered: correctCount >= 10,
        },
      }));

      // History of wrong answers (feeds the Hint and "Your Words")
      if (!isCorrect) {
        const { error: mistakeInsertError } = await supabase.from("word_mistakes").insert({
          user_id: userId,
          word_id: word.id,
          user_answer: typedAnswer || "",
          correct_answer: word.dutch || "",
          level: null,
          mode: "master",
        });
        if (mistakeInsertError) {
          console.error("Could not save mistake:", mistakeInsertError);
          setMistakeError(mistakeInsertError.message || "Unknown error");
        } else {
          setMistakeError("");
          // The cached hint for this word is out of date now
          setHints((prev) => {
            const next = { ...prev };
            delete next[word.id];
            return next;
          });
        }
      }

      return { newlyMastered };
    } catch (error) {
      console.error("Error updating progress:", error);
      return fallback;
    }
  };

  // ============================================================================
  // FUNCTION: Submit error report to database
  // ============================================================================
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

  // ============================================================================
  // EFFECT: Load words with progress
  // ============================================================================
  useEffect(() => {
    const fetchWordsToReview = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const currentUserId = userData.user?.id;

        if (!currentUserId) {
          setNotice({
            type: "info",
            title: "Please sign in",
            message: "You need to be signed in to use Master mode.",
            onClose: goBack,
          });
          return;
        }

        setUserId(currentUserId);

        const { data: userProgress, error: progressError } = await supabase
          .from("user_progress")
          .select("word_id, correct_count, incorrect_count, mastered")
          .eq("user_id", currentUserId);

        if (progressError) throw progressError;

        if (userProgress.length === 0) {
          setWords([]);
          setLoading(false);
          return;
        }

        const wordIds = userProgress.map((p) => p.word_id);

        const { data: wordDetails, error: wordsError } = await supabase
          .from("words")
          .select("*")
          .in("id", wordIds);

        if (wordsError) throw wordsError;

        const wordsWithProgress = wordDetails.map((word) => {
          const progress = userProgress.find((p) => p.word_id === word.id);
          const masteryPercent =
            progress.correct_count + progress.incorrect_count > 0
              ? Math.round(
                  (progress.correct_count /
                    (progress.correct_count + progress.incorrect_count)) *
                    100
                )
              : 0;

          return {
            ...word,
            correct_count: progress.correct_count,
            incorrect_count: progress.incorrect_count,
            masteryPercent,
            mastered: progress.mastered,
          };
        });

        const uniqueCategories = [
          ...new Set(wordsWithProgress.map((w) => w.category)),
        ].sort();
        setCategories(uniqueCategories);

        setSelectedCategories(new Set(uniqueCategories));
        setSelectedDifficulties(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
        setSelectedAccuracy(new Set(ALL_BUCKET_IDS));

        setWords(wordsWithProgress);
      } catch (error) {
        console.error("Error fetching review words:", error);
        setNotice({
          type: "error",
          title: "Couldn't load your words",
          message: "Please check your connection and try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWordsToReview();
  }, []);

  // ============================================================================
  // EFFECT: Apply filters and shuffle
  // ============================================================================
  useEffect(() => {
    let filtered = words;

    if (selectedCategories.size > 0) {
      filtered = filtered.filter((w) => selectedCategories.has(w.category));
    }

    if (selectedDifficulties.size > 0) {
      filtered = filtered.filter((w) => selectedDifficulties.has(w.difficulty));
    }

    if (selectedAccuracy.size > 0) {
      const active = ACCURACY_BUCKETS.filter((b) => selectedAccuracy.has(b.id));
      filtered = filtered.filter((w) => active.some((b) => b.test(w.masteryPercent)));
    }

    if (masteredFilter === "nonmastered") {
      filtered = filtered.filter((w) => !w.mastered);
    } else if (masteredFilter === "mastered") {
      filtered = filtered.filter((w) => w.mastered);
    }

    if (shuffle) {
      filtered = shuffleArray(filtered);
    } else {
      filtered = [...filtered].sort((a, b) => a.masteryPercent - b.masteryPercent);
    }

    setReviewWords(filtered);
    setCurrentIndex(0);
    setHintOpen(false);
    setFinished(false);
    answerLockedRef.current = false;
    setLocked(false);
  }, [words, selectedCategories, selectedDifficulties, selectedAccuracy, masteredFilter, shuffle]);

  // ============================================================================
  // EFFECT: Keep the cursor in the answer bar
  // ============================================================================
  useEffect(() => {
    if (loading || finished) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, [currentIndex, loading, finished]);

  // iPhone: detect when the keyboard is open so the top area can shrink
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => setKeyboardOpen(window.innerHeight - vv.height > 150);
    vv.addEventListener("resize", check);
    check();
    return () => vv.removeEventListener("resize", check);
  }, []);

  // ============================================================================
  // FUNCTION: Normalize text
  // ============================================================================
  const normalize = (str) => {
    return str
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, "")
      .replace(/ï/g, "i")
      .replace(/ü/g, "u")
      .replace(/ö/g, "o")
      .replace(/\s+/g, " ");
  };

  const currentWord = reviewWords[currentIndex];

  // ============================================================================
  // FLOW: next word / correct pop-up
  // ============================================================================
  const advance = () => {
    setCard(null);
    setCorrectCard(null);
    setReportOpen(false);
    setReportText("");
    setReportNotes("");
    setAnswer("");
    setHintOpen(false);
    if (currentIndex >= reviewWords.length - 1) {
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
    if (currentIndex < reviewWords.length - 1) inputRef.current?.focus();
    advance();
  };

  // ============================================================================
  // FUNCTION: Handle answer submission
  // ============================================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (answerLockedRef.current || !currentWord) return;
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
    setSessionStats((s) => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      total: s.total + 1,
    }));
    setAnswer("");

    const saved = await updateUserProgress(word, isCorrect, typed);

    if (!isCorrect) {
      // Wrong answers wait until the player has read the correction
      setCard({
        kind: "wrong",
        wordId: word.id,
        english: word.english,
        dutch: word.dutch,
        userAnswer: typed,
      });
    } else if (saved.newlyMastered) {
      setTimeout(() => {
        playSound("celebrate");
        setCard({ kind: "mastered", wordId: word.id, english: word.english, dutch: word.dutch });
      }, 700);
    } else {
      showCorrectCard({ praise: pickPraise(newStreak), english: word.english, dutch: word.dutch }, advance);
    }
  };

  // ============================================================================
  // HINT: latest 5 wrong answers for this word
  // ============================================================================
  const toggleHint = async () => {
    const opening = !hintOpen;
    setHintOpen(opening);
    if (!opening || !userId || !currentWord) return;

    const id = currentWord.id;
    if (hints[id] && !hints[id].error) return; // already loaded

    setHints((prev) => ({ ...prev, [id]: { loading: true, items: [] } }));
    try {
      const { data, error } = await supabase
        .from("word_mistakes")
        .select("id, user_answer, created_at")
        .eq("user_id", userId)
        .eq("word_id", id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      setHints((prev) => ({ ...prev, [id]: { loading: false, items: data || [] } }));
    } catch (err) {
      console.error("Error loading hint:", err);
      setHints((prev) => ({
        ...prev,
        [id]: { loading: false, items: [], error: err.message || "Could not load the hint." },
      }));
    }
  };

  const formatShortDate = (value) =>
    new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  // ============================================================================
  // AUDIO CONTROLS
  // ============================================================================
  const closeAudio = () => {
    setAudioOpen(false);
    inputRef.current?.focus();
  };
  const changeSfxOn = (on) => {
    setSfxOn(on);
    localStorage.setItem("soundEnabled", String(on));
    if (on) setTimeout(() => playSound("correct"), 30);
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

  // ============================================================================
  // FILTER HELPERS
  // ============================================================================
  const toggleCategory = (cat) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(cat)) newSet.delete(cat);
    else newSet.add(cat);
    setSelectedCategories(newSet);
  };

  const toggleAllCategories = () => {
    if (selectedCategories.size === categories.length) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(categories));
    }
  };

  const toggleDifficulty = (diff) => {
    const newSet = new Set(selectedDifficulties);
    if (newSet.has(diff)) newSet.delete(diff);
    else newSet.add(diff);
    setSelectedDifficulties(newSet);
  };

  const toggleAllDifficulties = () => {
    if (selectedDifficulties.size === 10) {
      setSelectedDifficulties(new Set());
    } else {
      setSelectedDifficulties(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    }
  };

  const toggleAccuracy = (id) => {
    const newSet = new Set(selectedAccuracy);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedAccuracy(newSet);
  };

  const toggleAllAccuracy = () => {
    if (selectedAccuracy.size === ACCURACY_BUCKETS.length) {
      setSelectedAccuracy(new Set());
    } else {
      setSelectedAccuracy(new Set(ALL_BUCKET_IDS));
    }
  };

  const chip = (active) => ({
    ...styles.chip,
    ...(active ? styles.chipActive : {}),
  });

  const renderFilters = () => (
    <div style={styles.filtersPanel}>
      <button onClick={() => setFiltersOpen(!filtersOpen)} style={styles.filterToggle}>
        <span>🔧 Filters · {reviewWords.length} words</span>
        <span aria-hidden="true">{filtersOpen ? "▲" : "▼"}</span>
      </button>

      {filtersOpen && (
        <div style={styles.filtersContent}>
          <div style={styles.filterGroup}>
            <div style={styles.filterHeader}>
              <h4 style={styles.filterTitle}>Categories</h4>
              <button onClick={toggleAllCategories} style={styles.selectAllBtn}>
                {selectedCategories.size === categories.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div style={styles.chipGrid2}>
              {categories.map((cat) => (
                <label key={cat} style={chip(selectedCategories.has(cat))}>
                  <input
                    type="checkbox"
                    checked={selectedCategories.has(cat)}
                    onChange={() => toggleCategory(cat)}
                    style={styles.checkbox}
                  />
                  {cat}
                </label>
              ))}
            </div>
          </div>

          <div style={styles.filterGroup}>
            <div style={styles.filterHeader}>
              <h4 style={styles.filterTitle}>Difficulty (1-10)</h4>
              <button onClick={toggleAllDifficulties} style={styles.selectAllBtn}>
                {selectedDifficulties.size === 10 ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div style={styles.chipGrid5}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                <label
                  key={level}
                  style={{ ...chip(selectedDifficulties.has(level)), justifyContent: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={selectedDifficulties.has(level)}
                    onChange={() => toggleDifficulty(level)}
                    style={styles.checkbox}
                  />
                  {level}
                </label>
              ))}
            </div>
          </div>

          <div style={styles.filterGroup}>
            <div style={styles.filterHeader}>
              <h4 style={styles.filterTitle}>Accuracy</h4>
              <button onClick={toggleAllAccuracy} style={styles.selectAllBtn}>
                {selectedAccuracy.size === ACCURACY_BUCKETS.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div style={styles.chipGrid3}>
              {ACCURACY_BUCKETS.map((b) => (
                <label
                  key={b.id}
                  style={{ ...chip(selectedAccuracy.has(b.id)), justifyContent: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={selectedAccuracy.has(b.id)}
                    onChange={() => toggleAccuracy(b.id)}
                    style={styles.checkbox}
                  />
                  {b.label}
                </label>
              ))}
            </div>
          </div>

          <div style={styles.filterGroup}>
            <h4 style={styles.filterTitle}>Word status</h4>
            <div style={styles.segmented}>
              {[
                ["both", "All"],
                ["nonmastered", "Not mastered"],
                ["mastered", "Mastered"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMasteredFilter(value)}
                  style={{
                    ...styles.segment,
                    ...(masteredFilter === value ? styles.segmentActive : {}),
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.filterGroup}>
            <label style={{ ...chip(shuffle), justifyContent: "center" }}>
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
                style={styles.checkbox}
              />
              🔀 Shuffle order
            </label>
          </div>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // POP-UPS
  // ============================================================================
  const noticeTheme = {
    success: { icon: "✓", color: "#6ee7b7", bg: "rgba(16,185,129,0.15)", border: "#34d399" },
    error: { icon: "✕", color: "#fca5a5", bg: "rgba(248,113,113,0.15)", border: "#f87171" },
    info: { icon: "i", color: "#93c5fd", bg: "rgba(59,130,246,0.15)", border: "#60a5fa" },
  };

  const isLastWord = currentIndex >= reviewWords.length - 1;

  const popups = (
    <>
      <style>{KEYFRAMES}</style>

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

      {card && (
        <div role="dialog" aria-modal="true" aria-labelledby="master-card-title" style={styles.overlay}>
          {card.kind === "mastered" ? (
            <>
              <Confetti />
              <div style={{ ...styles.modalCard, textAlign: "center" }}>
                <div style={{ ...styles.bigEmoji, animation: "rPop 0.7s ease-out" }}>🏅</div>
                <p style={styles.masteredEyebrow}>WORD MASTERED</p>
                <h2 id="master-card-title" style={styles.cardTitle}>You know this one!</h2>
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
            <div style={{ ...styles.modalCard, textAlign: "center" }}>
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
              <h2 id="master-card-title" style={styles.cardTitle}>Learn from this one</h2>
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
            <div style={styles.modalCard}>
              <h2 id="master-card-title" style={styles.reportTitle}>Report a word issue</h2>
              <p style={styles.reportWord}>
                <strong>{card.english}</strong> → {card.dutch}
              </p>

              <label style={styles.formLabel} htmlFor="master-report-correction">
                What should the correct translation be?
              </label>
              <input
                id="master-report-correction"
                type="text"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Type the correct translation..."
                style={styles.reportInput}
              />

              <label style={{ ...styles.formLabel, marginTop: 12 }} htmlFor="master-report-notes">
                Extra notes (optional)
              </label>
              <textarea
                id="master-report-notes"
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

      {notice && (
        <div role="dialog" aria-modal="true" aria-labelledby="master-notice-title" style={{ ...styles.overlay, zIndex: 1200 }}>
          <div style={{ ...styles.modalCard, textAlign: "center" }}>
            <div
              style={{
                ...styles.modalIcon,
                color: noticeTheme[notice.type].color,
                background: noticeTheme[notice.type].bg,
                borderColor: noticeTheme[notice.type].border,
              }}
            >
              {noticeTheme[notice.type].icon}
            </div>
            <h2 id="master-notice-title" style={styles.modalTitle}>{notice.title}</h2>
            <p style={styles.modalText}>{notice.message}</p>
            <button type="button" onClick={closeNotice} style={styles.modalPrimaryButton}>
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (loading) {
    return (
      <>
        <div style={styles.loadingContainer}>
          <h1 style={styles.loadingText}>Loading your words...</h1>
        </div>
        {popups}
      </>
    );
  }

  // ============================================================================
  // EMPTY STATE (no progress yet)
  // ============================================================================
  if (words.length === 0) {
    return (
      <>
        <div style={styles.loadingContainer}>
          <div style={{ fontSize: 64 }}>🎯</div>
          <h1 style={{ ...styles.loadingText, textAlign: "center", marginTop: 8 }}>
            Nothing to master yet
          </h1>
          <p style={styles.loadingSubtext}>
            Play or Practice a few words first. They will show up here.
          </p>
          <button onClick={goBack} style={styles.primaryButton}>
            ← Menu
          </button>
        </div>
        {popups}
      </>
    );
  }

  // ============================================================================
  // HEADER (title, sound settings, menu)
  // ============================================================================
  const header = (
    <div style={styles.header}>
      <h1 style={styles.title}>🎯 Master</h1>
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
          onClick={goBack}
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
          {keyboardOpen ? "←" : "← Menu"}
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
                onPointerUp={() => playSound("correct")}
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

  // ============================================================================
  // NO WORDS AFTER FILTERS
  // ============================================================================
  if (reviewWords.length === 0) {
    return (
      <>
        <div style={styles.container}>
          <div style={styles.stickyTop}>{header}</div>
          <div style={{ height: 12 }} />
          {renderFilters()}
          <div style={styles.emptyMessage}>
            <div style={{ fontSize: 48 }}>🔍</div>
            <p style={styles.emptyTitle}>No words match these filters</p>
            <p style={styles.emptyText}>Open the filters above and select more categories, levels or accuracy ranges.</p>
          </div>
        </div>
        {popups}
      </>
    );
  }

  // ============================================================================
  // FINISHED (reached the end of the list)
  // ============================================================================
  if (finished) {
    const pct =
      sessionStats.total > 0
        ? Math.round((sessionStats.correct / sessionStats.total) * 100)
        : 0;
    return (
      <>
        <div style={styles.loadingContainer}>
          <style>{KEYFRAMES}</style>
          <div style={{ fontSize: 64, animation: "rPop 0.7s ease-out" }}>🎯</div>
          <h1 style={{ ...styles.loadingText, textAlign: "center", marginTop: 8 }}>
            Round complete!
          </h1>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <p style={styles.statValue}>{sessionStats.correct}/{sessionStats.total}</p>
              <p style={styles.statLabel}>Correct</p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statValue}>{pct}%</p>
              <p style={styles.statLabel}>Accuracy</p>
            </div>
          </div>
          <div style={styles.finishButtons}>
            <button
              onClick={() => {
                setFinished(false);
                setCurrentIndex(0);
                setSessionStats({ correct: 0, total: 0 });
                setStreak(0);
                answerLockedRef.current = false;
                setLocked(false);
              }}
              style={styles.primaryButton}
            >
              Go again
            </button>
            <button onClick={goBack} style={styles.secondaryButton}>
              ← Menu
            </button>
          </div>
        </div>
        {popups}
      </>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  const shownWord = { ...currentWord, ...(live[currentWord.id] || {}) };
  const hint = hints[currentWord.id];

  return (
    <>
      <div style={styles.container}>
        <div style={styles.stickyTop}>
          {header}

          <div style={keyboardOpen ? styles.hudCompact : styles.hud}>
            <div style={styles.scoreWrap}>
              <span style={keyboardOpen ? styles.scoreCompact : styles.scoreBig}>
                {shownWord.masteryPercent}%
              </span>
              <span style={styles.scoreLabel}>mastery</span>
            </div>
            <div style={styles.chipRow}>
              <span style={styles.pillGreen}>✅ {shownWord.correct_count}</span>
              <span style={styles.pillRed}>❌ {shownWord.incorrect_count}</span>
              {shownWord.mastered && <span style={styles.pillGold}>🏅 Mastered</span>}
            </div>
          </div>

          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${((currentIndex + 1) / reviewWords.length) * 100}%`,
              }}
            />
          </div>
        </div>

        <div style={{ height: 12 }} />
        {renderFilters()}

        <div style={styles.questionContainer}>
          <p style={styles.questionLabel}>
            Question {currentIndex + 1}/{reviewWords.length}
          </p>
          <h2 style={styles.questionText}>Translate to Dutch:</h2>
          <h1
            style={{
              ...styles.wordToTranslate,
              ...(keyboardOpen ? { fontSize: "28px" } : {}),
            }}
          >
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

        {/* HINT */}
        <div style={styles.hintWrap}>
          <button
            type="button"
            onClick={toggleHint}
            onMouseDown={(e) => e.preventDefault()}
            aria-expanded={hintOpen}
            style={{ ...styles.hintToggle, ...(hintOpen ? styles.hintToggleOpen : {}) }}
          >
            <span>💡 Hint · your recent wrong answers</span>
            <span aria-hidden="true">{hintOpen ? "▲" : "▼"}</span>
          </button>

          {hintOpen && (
            <div style={styles.hintPanel}>
              {!hint || hint.loading ? (
                <p style={styles.hintMuted}>Loading…</p>
              ) : hint.error ? (
                <p style={styles.hintError}>⚠️ {hint.error}</p>
              ) : hint.items.length === 0 ? (
                <p style={styles.hintMuted}>
                  No wrong answers recorded for this word yet. Nothing to avoid here!
                </p>
              ) : (
                <>
                  <p style={styles.hintIntro}>
                    You already tried these (last {hint.items.length}). They were all wrong:
                  </p>
                  <div style={styles.hintList}>
                    {hint.items.map((m) => (
                      <div key={m.id} style={styles.hintRow}>
                        <span style={styles.hintAnswer}>
                          {m.user_answer && m.user_answer.trim() ? m.user_answer : <em>No answer entered</em>}
                        </span>
                        <span style={styles.hintDate}>{formatShortDate(m.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={(e) => {
              if (!answerLockedRef.current) setAnswer(e.target.value);
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
            disabled={locked}
            onMouseDown={(e) => e.preventDefault()}
          >
            Check
          </button>
        </form>

        <div style={{ height: 24 }} />
      </div>
      {popups}
    </>
  );
}

const styles = {
  // ---------- Layout (same shell as Play) ----------
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
  header: {
    position: "relative",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid rgba(6,182,212,0.2)",
    gap: "8px",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
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

  // ---------- Header audio controls (same as Play) ----------
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

  // ---------- Top stats ----------
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
    padding: "6px 16px 6px",
  },
  scoreWrap: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
  },
  scoreBig: {
    fontSize: "clamp(34px, 10vw, 44px)",
    fontWeight: "800",
    color: "#fbbf24",
    lineHeight: 1,
    textShadow: "0 2px 12px rgba(251,191,36,0.35)",
    fontVariantNumeric: "tabular-nums",
  },
  scoreCompact: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#fbbf24",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  scoreLabel: {
    fontSize: "13px",
    color: "#93c5fd",
    fontWeight: "600",
  },
  chipRow: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  pillGreen: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#86efac",
    background: "rgba(34,197,94,0.16)",
    border: "1px solid rgba(34,197,94,0.4)",
    borderRadius: "999px",
    padding: "2px 9px",
    whiteSpace: "nowrap",
  },
  pillRed: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#fca5a5",
    background: "rgba(239,68,68,0.16)",
    border: "1px solid rgba(239,68,68,0.4)",
    borderRadius: "999px",
    padding: "2px 9px",
    whiteSpace: "nowrap",
  },
  pillGold: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#fcd34d",
    background: "rgba(251,191,36,0.16)",
    border: "1px solid rgba(251,191,36,0.4)",
    borderRadius: "999px",
    padding: "2px 9px",
    whiteSpace: "nowrap",
  },
  progressBar: {
    height: "6px",
    background: "rgba(6,182,212,0.2)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
    transition: "width 0.3s ease",
  },

  // ---------- Filters ----------
  filtersPanel: {
    padding: "0 16px 4px",
    maxWidth: "600px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  filterToggle: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "11px 14px",
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    fontFamily: "inherit",
    cursor: "pointer",
    color: "#bfdbfe",
  },
  filtersContent: {
    marginTop: "8px",
    background: "rgba(30, 58, 138, 0.8)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "10px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  filterHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
  },
  filterTitle: {
    fontSize: "13px",
    color: "#67e8f9",
    margin: "0",
    fontWeight: "700",
  },
  selectAllBtn: {
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
  chipGrid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  chipGrid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  },
  chipGrid5: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "8px",
  },
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
  chipActive: {
    background: "rgba(6,182,212,0.15)",
    borderColor: "#06b6d4",
    color: "white",
  },
  checkbox: {
    width: "14px",
    height: "14px",
    cursor: "pointer",
    accentColor: "#06b6d4",
    flexShrink: 0,
  },
  segmented: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "6px",
  },
  segment: {
    padding: "10px 6px",
    fontSize: "13px",
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

  // ---------- Question ----------
  questionContainer: {
    textAlign: "center",
    padding: "16px 20px 0",
    marginBottom: "16px",
  },
  questionLabel: {
    fontSize: "13px",
    color: "#93c5fd",
    margin: "0 0 6px 0",
    fontWeight: "600",
  },
  questionText: {
    fontSize: "clamp(13px, 3vw, 14px)",
    color: "#bfdbfe",
    margin: "0 0 8px 0",
    fontWeight: "500",
  },
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
  exampleNL: {
    color: "#bfdbfe",
    margin: "0 0 8px 0",
    fontSize: "clamp(15px, 4vw, 17px)",
    lineHeight: 1.45,
  },
  exampleEN: {
    color: "#cbd5e1",
    margin: "0",
    fontSize: "clamp(14px, 3.6vw, 16px)",
    lineHeight: 1.45,
  },

  // ---------- Hint ----------
  hintWrap: {
    width: "100%",
    maxWidth: "600px",
    alignSelf: "center",
    boxSizing: "border-box",
    padding: "0 16px 12px",
  },
  hintToggle: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    background: "rgba(251,191,36,0.1)",
    border: "1px solid rgba(251,191,36,0.4)",
    borderRadius: "10px",
    color: "#fcd34d",
    fontSize: "13px",
    fontWeight: "700",
    fontFamily: "inherit",
    cursor: "pointer",
    textAlign: "left",
  },
  hintToggleOpen: {
    background: "rgba(251,191,36,0.18)",
  },
  hintPanel: {
    marginTop: "8px",
    padding: "12px 14px",
    borderRadius: "10px",
    background: "rgba(30, 58, 138, 0.7)",
    border: "1px solid rgba(251,191,36,0.3)",
    animation: "rHintOpen 0.2s ease-out",
  },
  hintIntro: {
    margin: "0 0 10px",
    color: "#cbd5e1",
    fontSize: "13px",
    lineHeight: 1.4,
  },
  hintMuted: { margin: 0, color: "#93c5fd", fontSize: "13px", lineHeight: 1.5 },
  hintError: { margin: 0, color: "#fde68a", fontSize: "13px", lineHeight: 1.5, overflowWrap: "anywhere" },
  hintList: { display: "flex", flexDirection: "column", gap: "6px" },
  hintRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    padding: "8px 10px",
    borderRadius: "8px",
    background: "rgba(248,113,113,0.1)",
    border: "1px solid rgba(248,113,113,0.3)",
  },
  hintAnswer: {
    color: "#fecaca",
    fontSize: "15px",
    fontWeight: "700",
    overflowWrap: "anywhere",
    textDecoration: "line-through",
    textDecorationColor: "rgba(248,113,113,0.6)",
  },
  hintDate: { color: "#cbd5e1", fontSize: "11px", flexShrink: 0 },

  // ---------- Answer form ----------
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
  secondaryButton: {
    padding: "12px 20px",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    fontWeight: "600",
    background: "rgba(255,255,255,0.1)",
    color: "#06b6d4",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "inherit",
    width: "100%",
  },
  primaryButton: {
    padding: "12px 24px",
    fontSize: "clamp(13px, 2.5vw, 14px)",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
    fontFamily: "inherit",
    width: "100%",
  },

  // ---------- Finished ----------
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
    maxWidth: "400px",
    margin: "20px auto 24px",
    width: "100%",
  },
  statCard: {
    background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
    border: "1px solid rgba(6,182,212,0.2)",
    borderRadius: "10px",
    padding: "14px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  },
  statValue: { fontSize: "clamp(20px, 4vw, 28px)", fontWeight: "700", color: "#fbbf24", margin: "0 0 4px 0" },
  statLabel: {
    fontSize: "clamp(10px, 2vw, 11px)",
    color: "#bfdbfe",
    margin: "0",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  finishButtons: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxWidth: "320px",
    width: "100%",
  },

  // ---------- Empty / loading ----------
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    fontFamily: FONT,
    padding: "20px",
  },
  loadingText: {
    fontSize: "clamp(20px, 5vw, 28px)",
    color: "white",
    margin: "0",
    fontWeight: "700",
  },
  loadingSubtext: {
    fontSize: "clamp(14px, 3vw, 16px)",
    color: "#bfdbfe",
    margin: "12px 0 24px 0",
    textAlign: "center",
    maxWidth: "320px",
    lineHeight: 1.5,
  },
  emptyMessage: {
    textAlign: "center",
    padding: "40px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "white",
    fontSize: "18px",
    fontWeight: "700",
    margin: "8px 0 6px",
  },
  emptyText: {
    color: "#bfdbfe",
    fontSize: "14px",
    margin: "0",
    lineHeight: 1.5,
  },

  // ---------- Correct pop-up (same as Play) ----------
  correctOverlay: {
    position: "fixed", inset: 0, zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "18px", background: "rgba(2, 6, 23, 0.55)", cursor: "pointer", fontFamily: FONT,
  },
  correctCard: {
    width: "100%", maxWidth: "320px", boxSizing: "border-box", padding: "22px 20px 16px", borderRadius: "24px",
    textAlign: "center", color: "#f8fafc", background: "linear-gradient(160deg, #134e4a 0%, #172554 100%)",
    border: "1px solid rgba(52,211,153,0.6)", boxShadow: "0 20px 60px rgba(0,0,0,0.45), 0 0 30px rgba(52,211,153,0.2)",
    animation: "rCardPop 0.35s ease-out",
  },
  correctBadge: {
    width: "46px", height: "46px", margin: "0 auto 8px", borderRadius: "50%", display: "flex", alignItems: "center",
    justifyContent: "center", background: "rgba(16,185,129,0.18)", border: "2px solid #34d399", color: "#6ee7b7",
    fontSize: "24px", fontWeight: 900,
  },
  correctTitle: { margin: "0 0 6px", fontSize: "24px", fontWeight: 850, lineHeight: 1.2 },
  correctWords: { margin: "0 0 14px", color: "#cbd5e1", fontSize: "15px", overflowWrap: "anywhere" },
  correctTimerTrack: { height: "4px", borderRadius: "999px", background: "rgba(255,255,255,0.12)", overflow: "hidden" },
  correctTimerFill: { height: "100%", background: "linear-gradient(90deg, #34d399, #06b6d4)", transformOrigin: "left center", animationName: "rTimerShrink", animationTimingFunction: "linear", animationFillMode: "forwards" },
  correctHint: { margin: "8px 0 0", fontSize: "11px", color: "#94a3b8" },

  // ---------- Wrong / mastered / notice pop-ups (same look as Play) ----------
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
    textAlign: "left",
    background: "linear-gradient(160deg, #1e293b 0%, #172554 100%)",
    border: "1px solid rgba(148,163,184,0.35)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
  },
  modalIcon: {
    width: "48px",
    height: "48px",
    margin: "0 auto 12px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid",
    fontSize: "24px",
    fontWeight: 900,
  },
  bigEmoji: { fontSize: "64px", lineHeight: 1, margin: "0 auto 8px" },
  wrongEyebrow: { margin: "0 0 5px", color: "#fca5a5", fontSize: "12px", fontWeight: 900, letterSpacing: "2px" },
  masteredEyebrow: { margin: "0 0 5px", color: "#fcd34d", fontSize: "12px", fontWeight: 900, letterSpacing: "2px" },
  cardTitle: { margin: "0 0 12px", fontSize: "24px", lineHeight: 1.2, fontWeight: 850 },
  cardEnglish: { margin: "0 0 14px", fontSize: "17px", color: "#cbd5e1" },
  cardNote: {
    margin: "14px 0 18px",
    color: "#cbd5e1",
    fontSize: "14px",
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
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
  correctAnswerDutch: {
    color: "#ecfdf5",
    fontSize: "clamp(24px, 7vw, 32px)",
    overflowWrap: "anywhere",
    lineHeight: 1.2,
  },
  modalTitle: {
    margin: "0 0 8px",
    fontSize: "22px",
    lineHeight: 1.2,
    fontWeight: 850,
    textAlign: "center",
  },
  modalText: {
    margin: "0 0 20px",
    color: "#cbd5e1",
    fontSize: "15px",
    lineHeight: 1.5,
    textAlign: "center",
  },
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
  formLabel: {
    display: "block",
    marginBottom: "6px",
    fontSize: "13px",
    color: "#bfdbfe",
    fontWeight: "600",
  },
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

export default Review;
