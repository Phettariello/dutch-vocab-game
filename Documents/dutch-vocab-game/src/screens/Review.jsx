import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

// "Master" mode. The file is still called Review.jsx so Home.jsx keeps working.
function Review({ goBack }) {
  const [words, setWords] = useState([]);
  const [reviewWords, setReviewWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [userId, setUserId] = useState(null);

  // Filter states
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [selectedDifficulties, setSelectedDifficulties] = useState(new Set());
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

  // ============================================================================
  // FUNCTION: Update user progress
  // ============================================================================
  const updateUserProgress = async (wordId, isCorrect) => {
    if (!userId) return;

    try {
      const { data: existing, error: fetchError } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("word_id", wordId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Fetch error:", fetchError);
        return;
      }

      if (existing) {
        const newCorrectCount = isCorrect
          ? existing.correct_count + 1
          : existing.correct_count;
        const newIncorrectCount = !isCorrect
          ? existing.incorrect_count + 1
          : existing.incorrect_count;
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
      } else {
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
      }
    } catch (error) {
      console.error("Error updating progress:", error);
    }
  };

  // ============================================================================
  // FUNCTION: Submit error report to database
  // ============================================================================
  const submitErrorReport = async () => {
    if (!reportText.trim() || !userId) return;

    setReportLoading(true);
    try {
      const word = reviewWords[currentIndex];

      await supabase.from("word_issues").insert([
        {
          word_id: word.id,
          user_id: userId,
          english: word.english,
          dutch: word.dutch,
          user_answer: answer.trim(),
          suggested_correction: reportText.trim(),
          feedback_text: reportNotes.trim(),
          resolved: false,
        },
      ]);

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

    if (masteredFilter === "nonmastered") {
      filtered = filtered.filter((w) => !w.mastered);
    } else if (masteredFilter === "mastered") {
      filtered = filtered.filter((w) => w.mastered);
    }

    if (shuffle) {
      filtered = [...filtered].sort(() => Math.random() - 0.5);
    } else {
      filtered = [...filtered].sort(
        (a, b) => a.masteryPercent - b.masteryPercent
      );
    }

    setReviewWords(filtered);
    setCurrentIndex(0);
  }, [words, selectedCategories, selectedDifficulties, masteredFilter, shuffle]);

  // ============================================================================
  // EFFECT: Auto-focus input
  // ============================================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, [currentIndex, showAnswer]);

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

  // ============================================================================
  // FUNCTION: Handle answer submission
  // ============================================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    const userAnswer = answer.toLowerCase().trim();

    const correctFull = reviewWords[currentIndex].dutch.toLowerCase().trim();
    const correctBase = correctFull
      .split(",")[0]
      .replace(/^(de |het |een |het )/, "")
      .trim();

    const normalizedAnswer = normalize(userAnswer);
    const normalizedFull = normalize(correctFull);
    const normalizedBase = normalize(correctBase);
    const normalizedWithDe = normalize(`de ${correctBase}`);
    const normalizedWithHet = normalize(`het ${correctBase}`);

    const isCorrect =
      normalizedAnswer === normalizedFull ||
      normalizedAnswer === normalizedBase ||
      normalizedAnswer === normalizedWithDe ||
      normalizedAnswer === normalizedWithHet;

    await updateUserProgress(reviewWords[currentIndex].id, isCorrect);

    if (isCorrect) {
      setFeedback("✅ Correct!");
    } else {
      setFeedback(`❌ Wrong! The answer is '${reviewWords[currentIndex].dutch}'.`);
    }

    setShowAnswer(true);
    setReportOpen(false);
  };

  // ============================================================================
  // FUNCTION: Navigate to next / previous word
  // ============================================================================
  const resetCard = () => {
    setAnswer("");
    setFeedback("");
    setShowAnswer(false);
    setReportOpen(false);
    setReportText("");
    setReportNotes("");
  };

  const nextWord = () => {
    if (currentIndex < reviewWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetCard();
    }
  };

  const previousWord = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetCard();
    }
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

  const currentWord = reviewWords[currentIndex];
  const isCorrectAnswer = feedback.includes("✅");

  // ============================================================================
  // POP-UPS (replace the browser alert boxes)
  // ============================================================================
  const noticeTheme = {
    success: { icon: "✓", color: "#6ee7b7", bg: "rgba(16,185,129,0.15)", border: "#34d399" },
    error: { icon: "✕", color: "#fca5a5", bg: "rgba(248,113,113,0.15)", border: "#f87171" },
    info: { icon: "i", color: "#93c5fd", bg: "rgba(59,130,246,0.15)", border: "#60a5fa" },
  };

  const popups = (
    <>
      {notice && (
        <div role="dialog" aria-modal="true" aria-labelledby="master-notice-title" style={styles.overlay}>
          <div style={styles.modalCard}>
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

      {reportOpen && showAnswer && currentWord && !notice && (
        <div role="dialog" aria-modal="true" aria-labelledby="master-report-title" style={styles.overlay}>
          <div style={styles.modalCard}>
            <h2 id="master-report-title" style={styles.reportTitle}>Report a word issue</h2>
            <p style={styles.reportWord}>
              <strong>{currentWord.english}</strong> → {currentWord.dutch}
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
                Cancel
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
  // HEADER (shared by the next two states)
  // ============================================================================
  const header = (
    <div style={styles.header}>
      <h1 style={styles.title}>🎯 Master</h1>
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
            <p style={styles.emptyText}>Open the filters above and select more categories or levels.</p>
          </div>
        </div>
        {popups}
      </>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  const isLast = currentIndex >= reviewWords.length - 1;

  return (
    <>
      <div style={styles.container}>
        <div style={styles.stickyTop}>
          {header}

          <div style={keyboardOpen ? styles.hudCompact : styles.hud}>
            <div style={styles.scoreWrap}>
              <span style={keyboardOpen ? styles.scoreCompact : styles.scoreBig}>
                {currentWord.masteryPercent}%
              </span>
              <span style={styles.scoreLabel}>mastery</span>
            </div>
            <div style={styles.chipRow}>
              <span style={styles.pillGreen}>✅ {currentWord.correct_count}</span>
              <span style={styles.pillRed}>❌ {currentWord.incorrect_count}</span>
              {currentWord.mastered && <span style={styles.pillGold}>🏅 Mastered</span>}
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

        {!showAnswer ? (
          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              ref={inputRef}
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type the translation..."
              style={styles.input}
            />
            <button type="submit" style={styles.submitButton}>
              Check
            </button>
          </form>
        ) : (
          <div style={styles.resultWrap}>
            <div style={isCorrectAnswer ? styles.resultCardCorrect : styles.resultCardWrong}>
              <div
                style={{
                  ...styles.resultIcon,
                  ...(isCorrectAnswer ? styles.resultIconCorrect : styles.resultIconWrong),
                }}
              >
                {isCorrectAnswer ? "✓" : "✕"}
              </div>
              <h2 style={styles.resultTitle}>
                {isCorrectAnswer ? "Correct!" : "Not quite"}
              </h2>

              <div style={styles.correctAnswerBox}>
                <span style={styles.correctAnswerLabel}>Correct answer</span>
                <strong style={styles.correctAnswerDutch}>{currentWord.dutch}</strong>
              </div>

              {!isCorrectAnswer && (
                <p style={styles.resultNote}>
                  {answer.trim() ? (
                    <>
                      Your answer: <strong>{answer.trim()}</strong>
                    </>
                  ) : (
                    "No answer entered"
                  )}
                </p>
              )}
            </div>

            <button
              onClick={nextWord}
              disabled={isLast}
              style={{
                ...styles.nextButton,
                opacity: isLast ? 0.5 : 1,
                cursor: isLast ? "not-allowed" : "pointer",
              }}
            >
              {isLast ? "Last word reached" : "Next word →"}
            </button>

            {!isCorrectAnswer && (
              <button onClick={() => setReportOpen(true)} style={styles.reportLinkButton}>
                ⚑ Report issue with this word
              </button>
            )}
          </div>
        )}

        <div style={styles.navigationButtons}>
          <button
            onClick={previousWord}
            disabled={currentIndex === 0}
            style={{
              ...styles.secondaryButton,
              opacity: currentIndex === 0 ? 0.5 : 1,
              cursor: currentIndex === 0 ? "not-allowed" : "pointer",
            }}
          >
            ← Previous
          </button>
          <button onClick={goBack} style={styles.secondaryButton}>
            ← Menu
          </button>
        </div>

        <div style={{ height: 24 }} />
      </div>
      {popups}
    </>
  );
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

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

  // ---------- Result card ----------
  resultWrap: {
    width: "100%",
    maxWidth: "600px",
    alignSelf: "center",
    boxSizing: "border-box",
    padding: "0 16px",
  },
  resultCardCorrect: {
    padding: "20px 18px",
    borderRadius: "20px",
    textAlign: "center",
    color: "#f8fafc",
    background: "linear-gradient(160deg, #134e4a 0%, #172554 100%)",
    border: "1px solid rgba(52,211,153,0.5)",
    boxShadow: "0 12px 36px rgba(0,0,0,0.3)",
  },
  resultCardWrong: {
    padding: "20px 18px",
    borderRadius: "20px",
    textAlign: "center",
    color: "#f8fafc",
    background: "linear-gradient(160deg, #1e293b 0%, #172554 100%)",
    border: "1px solid rgba(248,113,113,0.5)",
    boxShadow: "0 12px 36px rgba(0,0,0,0.3)",
  },
  resultIcon: {
    width: "44px",
    height: "44px",
    margin: "0 auto 8px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
    fontWeight: 900,
    border: "2px solid",
  },
  resultIconCorrect: {
    background: "rgba(16,185,129,0.15)",
    borderColor: "#34d399",
    color: "#6ee7b7",
  },
  resultIconWrong: {
    background: "rgba(248,113,113,0.15)",
    borderColor: "#f87171",
    color: "#fca5a5",
  },
  resultTitle: {
    margin: "0 0 14px",
    fontSize: "22px",
    lineHeight: 1.2,
    fontWeight: 850,
  },
  correctAnswerBox: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "16px 14px",
    borderRadius: "16px",
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(52,211,153,0.55)",
  },
  correctAnswerLabel: {
    color: "#6ee7b7",
    fontSize: "12px",
    fontWeight: 800,
  },
  correctAnswerDutch: {
    color: "#ecfdf5",
    fontSize: "clamp(24px, 7vw, 32px)",
    overflowWrap: "anywhere",
    lineHeight: 1.2,
  },
  resultNote: {
    margin: "14px 0 0",
    color: "#cbd5e1",
    fontSize: "14px",
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
  nextButton: {
    width: "100%",
    marginTop: "14px",
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
  navigationButtons: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    flexWrap: "wrap",
    padding: "18px 16px 0",
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
    flex: "1 1 140px",
    maxWidth: "200px",
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

  // ---------- Pop-ups (same look as the Play wrong-answer card) ----------
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
