import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { primeKeyboard, releaseKeyboardPrimer } from "../keyboardPrimer";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

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
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
`;

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
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
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

// Simple pop-up used instead of the browser alert boxes
function NoticeModal({ notice, onClose }) {
  if (!notice) return null;
  const theme = {
    error: { icon: "✕", color: "#fca5a5", bg: "rgba(248,113,113,0.15)", border: "#f87171" },
    info: { icon: "i", color: "#93c5fd", bg: "rgba(59,130,246,0.15)", border: "#60a5fa" },
  }[notice.type || "info"];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="practice-notice-title" style={styles.overlay}>
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

// ============================================================================
// SELECTION SCREEN
// ============================================================================
function Practice({ goBack }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [notice, setNotice] = useState(null);

  const difficulties = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase.from("words").select("category");
        if (error) throw error;

        const uniqueCategories = [
          ...new Set(data.map((w) => w.category).filter((c) => c)),
        ].sort();
        setCategories(uniqueCategories);
      } catch (error) {
        console.error("Error fetching categories:", error);
        setNotice({
          type: "error",
          title: "Couldn't load categories",
          message: "Please check your connection and try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const toggleCategory = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const toggleAllCategories = () => {
    setSelectedCategories(selectedCategories.length === categories.length ? [] : [...categories]);
  };

  const toggleDifficulty = (difficulty) => {
    setSelectedDifficulties((prev) =>
      prev.includes(difficulty) ? prev.filter((d) => d !== difficulty) : [...prev, difficulty]
    );
  };

  const toggleAllDifficulties = () => {
    setSelectedDifficulties(
      selectedDifficulties.length === difficulties.length ? [] : [...difficulties]
    );
  };

  const handleStartPractice = () => {
    if (selectedCategories.length === 0 || selectedDifficulties.length === 0) {
      setNotice({
        type: "info",
        title: "Almost there",
        message: "Please select at least one category and one difficulty level.",
      });
      return;
    }
    // Open the keyboard during this tap; the answer bar takes over when it appears
    primeKeyboard();
    setPracticeStarted(true);
  };

  const chip = (active) => ({ ...styles.chip, ...(active ? styles.chipActive : {}) });

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <h1 style={styles.loadingText}>Loading...</h1>
      </div>
    );
  }

  if (practiceStarted) {
    return (
      <PracticeGame
        categories={selectedCategories}
        difficulties={selectedDifficulties}
        goBack={() => setPracticeStarted(false)}
        goBackMenu={goBack}
      />
    );
  }

  const ready = selectedCategories.length > 0 && selectedDifficulties.length > 0;

  return (
    <>
      <div style={styles.selectionContainer}>
        <div style={styles.header}>
          <h1 style={styles.title}>📚 Practice</h1>
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
            ← Menu
          </button>
        </div>

        <div style={styles.selectionBody}>
          <p style={styles.selectionSubtitle}>
            Pick what you want to practise. Your progress is saved.
          </p>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Categories</h2>
              <button onClick={toggleAllCategories} style={styles.selectAllButton}>
                {selectedCategories.length === categories.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            {categories.length === 0 ? (
              <p style={styles.errorText}>No categories found</p>
            ) : (
              <div style={styles.grid2Col}>
                {categories.map((category) => (
                  <label key={category} style={chip(selectedCategories.includes(category))}>
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => toggleCategory(category)}
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
                {selectedDifficulties.length === difficulties.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div style={styles.grid5Col}>
              {difficulties.map((difficulty) => (
                <label
                  key={difficulty}
                  style={{ ...chip(selectedDifficulties.includes(difficulty)), justifyContent: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={selectedDifficulties.includes(difficulty)}
                    onChange={() => toggleDifficulty(difficulty)}
                    style={styles.checkbox}
                  />
                  {difficulty}
                </label>
              ))}
            </div>
          </section>

          <button
            onClick={handleStartPractice}
            style={{ ...styles.primaryButton, opacity: ready ? 1 : 0.6 }}
          >
            Start practice →
          </button>
          <button onClick={goBack} style={styles.secondaryButton}>
            ← Back to menu
          </button>
        </div>
      </div>
      <NoticeModal notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

// ============================================================================
// GAME SCREEN
// ============================================================================
function PracticeGame({ categories, difficulties, goBack, goBackMenu }) {
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null); // null | { correct: boolean }
  const [loading, setLoading] = useState(true);
  const [practiceStats, setPracticeStats] = useState({ correct: 0, total: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [userId, setUserId] = useState(null);
  const [locked, setLocked] = useState(false);
  const [card, setCard] = useState(null); // pop-up after a wrong answer / mastered word
  const [notice, setNotice] = useState(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const answerLockedRef = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const fetchWords = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        setUserId(userData.user?.id);

        let query = supabase.from("words").select("*");
        if (categories.length > 0) query = query.in("category", categories);
        if (difficulties.length > 0) query = query.in("difficulty", difficulties);

        const { data, error } = await query.limit(20);
        if (error) throw error;

        setWords(data.sort(() => Math.random() - 0.5));
      } catch (error) {
        console.error("Error fetching practice words:", error);
        releaseKeyboardPrimer();
        setNotice({
          type: "error",
          title: "Couldn't load words",
          message: "Please check your connection and try again.",
          onClose: goBackMenu,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWords();
  }, []);

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
    if (loading || gameOver) return;
    const el = inputRef.current;
    if (el) el.focus();
    releaseKeyboardPrimer();
  }, [loading, gameOver, currentIndex, words.length]);

  // ---------- progress ----------
  const updateUserProgress = async (wordId, isCorrect) => {
    if (!userId) return { newlyMastered: false };

    try {
      const { data: existing, error: fetchError } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("word_id", wordId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Fetch error:", fetchError);
        return { newlyMastered: false };
      }

      if (existing) {
        const newCorrectCount = isCorrect ? existing.correct_count + 1 : existing.correct_count;
        const newIncorrectCount = !isCorrect ? existing.incorrect_count + 1 : existing.incorrect_count;
        const isMastered = newCorrectCount >= 10;

        await supabase
          .from("user_progress")
          .update({
            correct_count: newCorrectCount,
            incorrect_count: newIncorrectCount,
            mastered: isMastered,
            last_seen_at: new Date(),
          })
          .eq("id", existing.id);

        return { newlyMastered: isMastered && !existing.mastered };
      }

      await supabase.from("user_progress").insert([
        {
          user_id: userId,
          word_id: wordId,
          correct_count: isCorrect ? 1 : 0,
          incorrect_count: !isCorrect ? 1 : 0,
          mastered: false,
          last_seen_at: new Date(),
        },
      ]);
    } catch (error) {
      console.error("Error updating progress:", error);
    }
    return { newlyMastered: false };
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

  // Move on to the next word (or finish)
  const advance = () => {
    setCard(null);
    setResult(null);
    setAnswer("");
    if (currentIndex >= words.length - 1) {
      setGameOver(true);
      return;
    }
    setCurrentIndex(currentIndex + 1);
    answerLockedRef.current = false;
    setLocked(false);
  };

  const continueFromCard = () => {
    // Focus inside the tap, so the keyboard comes straight back on iPhone
    if (currentIndex < words.length - 1) inputRef.current?.focus();
    advance();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (answerLockedRef.current || gameOver || loading) return;
    answerLockedRef.current = true;
    setLocked(true);

    const currentWord = words[currentIndex];
    const userAnswer = answer.toLowerCase().trim();

    const correctFull = currentWord.dutch.toLowerCase().trim();
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

    const saved = await updateUserProgress(currentWord.id, isCorrect);

    setResult({ correct: isCorrect });
    setPracticeStats((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
    setAnswer("");

    if (!isCorrect) {
      // Wrong answers wait until the player has read the correction
      setCard({
        kind: "wrong",
        english: currentWord.english,
        dutch: currentWord.dutch,
        userAnswer: answer.trim(),
      });
    } else if (saved?.newlyMastered) {
      setTimeout(() => {
        setCard({ kind: "mastered", english: currentWord.english, dutch: currentWord.dutch });
      }, 700);
    } else {
      setTimeout(advance, 2000);
    }
  };

  // ---------- screens ----------
  if (loading) {
    return (
      <>
        <div style={styles.loadingContainer}>
          <h1 style={styles.loadingText}>Loading...</h1>
        </div>
        <NoticeModal
          notice={notice}
          onClose={() => {
            const cb = notice?.onClose;
            setNotice(null);
            if (cb) cb();
          }}
        />
      </>
    );
  }

  if (words.length === 0) {
    return (
      <>
        <div style={styles.loadingContainer}>
          <div style={{ fontSize: 64 }}>🔍</div>
          <h1 style={{ ...styles.loadingText, textAlign: "center", marginTop: 8 }}>
            No words found
          </h1>
          <p style={styles.loadingSubtext}>Nothing matches those filters. Try other categories or levels.</p>
          <button onClick={goBack} style={styles.primaryButton}>
            Back to selection
          </button>
        </div>
        <NoticeModal
          notice={notice}
          onClose={() => {
            const cb = notice?.onClose;
            setNotice(null);
            if (cb) cb();
          }}
        />
      </>
    );
  }

  if (gameOver) {
    const percentage =
      practiceStats.total > 0
        ? Math.round((practiceStats.correct / practiceStats.total) * 100)
        : 0;

    return (
      <div style={styles.gameOverContainer}>
        <style>{KEYFRAMES}</style>
        <div style={{ fontSize: 64, textAlign: "center", animation: "pPop 0.7s ease-out" }}>📚</div>
        <h1 style={styles.gameOverTitle}>Practice complete!</h1>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <p style={styles.statValue}>{practiceStats.correct}/{practiceStats.total}</p>
            <p style={styles.statLabel}>Correct</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statValue}>{percentage}%</p>
            <p style={styles.statLabel}>Accuracy</p>
          </div>
        </div>
        <div style={styles.buttonContainer}>
          <button onClick={goBack} style={styles.primaryButton}>
            Back to selection
          </button>
          <button onClick={goBackMenu} style={styles.secondaryButton}>
            ← Menu
          </button>
        </div>
      </div>
    );
  }

  const currentWord = words[currentIndex];
  const accuracy =
    practiceStats.total > 0
      ? Math.round((practiceStats.correct / practiceStats.total) * 100)
      : null;

  return (
    <>
      <div style={styles.container}>
        <style>{KEYFRAMES}</style>

        <div style={styles.stickyTop}>
          <div style={styles.header}>
            <h1 style={styles.title}>📚 Practice</h1>
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

          <div style={keyboardOpen ? styles.hudCompact : styles.hud}>
            <div style={styles.scoreWrap}>
              <span style={keyboardOpen ? styles.scoreCompact : styles.scoreBig}>
                {practiceStats.correct}
              </span>
              <span style={styles.scoreLabel}>
                correct{practiceStats.total > 0 ? ` of ${practiceStats.total}` : ""}
              </span>
            </div>
            {accuracy !== null && <span style={styles.pillBlue}>🎯 {accuracy}%</span>}
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

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={(e) => {
              if (!answerLockedRef.current) setAnswer(e.target.value);
            }}
            placeholder="Type the translation..."
            style={{
              ...styles.input,
              ...(result?.correct ? styles.inputCorrect : {}),
            }}
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
            Submit
          </button>
        </form>

        {result?.correct && !card && (
          <p style={styles.feedbackCorrect}>✅ Correct!</p>
        )}
      </div>

      {card && (
        <div role="dialog" aria-modal="true" aria-labelledby="practice-card-title" style={styles.overlay}>
          {card.kind === "mastered" ? (
            <>
              <Confetti />
              <div style={styles.modalCard}>
                <div style={{ ...styles.bigEmoji, textAlign: "center" }}>🏅</div>
                <p style={styles.masteredEyebrow}>WORD MASTERED</p>
                <h2 id="practice-card-title" style={styles.modalTitle}>You know this one!</h2>
                <p style={styles.cardEnglish}>{card.english}</p>
                <div style={styles.correctAnswerBox}>
                  <span style={styles.correctAnswerLabel}>DUTCH</span>
                  <strong style={styles.correctAnswerDutch}>{card.dutch}</strong>
                </div>
                <p style={styles.cardNote}>10 correct answers. It now counts as a mastered word.</p>
                <button type="button" onClick={continueFromCard} style={styles.modalPrimaryButton}>
                  {currentIndex >= words.length - 1 ? "See results" : "Keep going"}
                  <span aria-hidden="true"> →</span>
                </button>
              </div>
            </>
          ) : (
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
              <h2 id="practice-card-title" style={styles.modalTitle}>Learn from this one</h2>
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
              <button type="button" onClick={continueFromCard} style={styles.modalPrimaryButton}>
                {currentIndex >= words.length - 1 ? "See results" : "Next question"}
                <span aria-hidden="true"> →</span>
              </button>
            </div>
          )}
        </div>
      )}

      <NoticeModal
        notice={notice}
        onClose={() => {
          const cb = notice?.onClose;
          setNotice(null);
          if (cb) cb();
        }}
      />
    </>
  );
}

const styles = {
  // ---------- Shell (same as Play) ----------
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
  selectionContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
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
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid rgba(6,182,212,0.2)",
    gap: "8px",
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
  selectionSubtitle: {
    fontSize: "14px",
    color: "#bfdbfe",
    textAlign: "center",
    margin: "0",
  },
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
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#67e8f9",
    margin: "0",
  },
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
  errorText: { color: "#fca5a5", fontSize: "14px", margin: 0 },
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
  scoreCompact: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#fbbf24",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  scoreLabel: { fontSize: "13px", color: "#93c5fd", fontWeight: "600" },
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
  progressBar: { height: "6px", background: "rgba(6,182,212,0.2)", overflow: "hidden" },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
    transition: "width 0.3s ease",
  },

  // ---------- Question ----------
  questionContainer: { textAlign: "center", padding: "16px 20px 0", marginBottom: "16px" },
  questionLabel: { fontSize: "13px", color: "#93c5fd", margin: "0 0 6px 0", fontWeight: "600" },
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
    margin: "0 20px 16px",
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
  form: {
    display: "flex",
    gap: "8px",
    padding: "0 16px 12px",
    boxSizing: "border-box",
    width: "100%",
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
    transition: "all 0.2s ease",
    fontFamily: "inherit",
  },
  inputCorrect: {
    borderColor: "#22c55e",
    boxShadow: "0 0 0 3px rgba(34,197,94,0.4)",
    background: "#ecfdf5",
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
  feedbackCorrect: {
    fontSize: "clamp(14px, 3vw, 15px)",
    fontWeight: "700",
    margin: "8px 20px 0",
    textAlign: "center",
    color: "#10b981",
  },

  // ---------- Finished screen ----------
  gameOverContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: FONT,
  },
  gameOverTitle: {
    fontSize: "clamp(26px, 6vw, 36px)",
    color: "white",
    margin: "8px 0 24px 0",
    textAlign: "center",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
    maxWidth: "400px",
    margin: "0 auto 24px",
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
  buttonContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxWidth: "450px",
    width: "100%",
    alignItems: "center",
  },

  // ---------- Loading ----------
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
  loadingText: { fontSize: "clamp(20px, 5vw, 28px)", color: "white", margin: "0", fontWeight: "700" },
  loadingSubtext: {
    fontSize: "clamp(14px, 3vw, 16px)",
    color: "#bfdbfe",
    margin: "12px 0 24px 0",
    textAlign: "center",
    maxWidth: "320px",
    lineHeight: 1.5,
  },

  // ---------- Pop-ups (same look as Play) ----------
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
  bigEmoji: { fontSize: "64px", lineHeight: 1, margin: "0 auto 8px", animation: "pPop 0.7s ease-out" },
  wrongEyebrow: { margin: "0 0 5px", color: "#fca5a5", fontSize: "12px", fontWeight: 900, letterSpacing: "2px" },
  masteredEyebrow: { margin: "0 0 5px", color: "#fcd34d", fontSize: "12px", fontWeight: 900, letterSpacing: "2px" },
  modalTitle: { margin: "0 0 12px", fontSize: "24px", lineHeight: 1.2, fontWeight: 850 },
  modalText: { margin: "0 0 20px", color: "#cbd5e1", fontSize: "15px", lineHeight: 1.5 },
  cardEnglish: { margin: "0 0 14px", fontSize: "17px", color: "#cbd5e1" },
  cardNote: {
    margin: "14px 0 18px",
    color: "#cbd5e1",
    fontSize: "14px",
    lineHeight: 1.5,
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
};

export default Practice;
