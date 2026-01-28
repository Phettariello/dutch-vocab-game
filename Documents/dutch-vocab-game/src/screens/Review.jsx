import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

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
      const currentWord = reviewWords[currentIndex];
      
      await supabase.from("word_issues").insert([
        {
          word_id: currentWord.id,
          user_id: userId,
          english: currentWord.english,
          dutch: currentWord.dutch,
          user_answer: answer.trim(),
          suggested_correction: reportText.trim(),
          feedback_text: reportNotes.trim(),
          resolved: false,
        },
      ]);

      setReportText("");
      setReportNotes("");
      setReportOpen(false);
      
      alert("✅ Thank you! Your report has been submitted. We'll review it soon!");
    } catch (error) {
      console.error("Error submitting report:", error);
      alert("❌ Error submitting report. Please try again.");
    } finally {
      setReportLoading(false);
    }
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
          alert("You must be logged in to use Review Mode.");
          goBack();
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
      filtered = filtered.filter((w) =>
        selectedCategories.has(w.category)
      );
    }

    if (selectedDifficulties.size > 0) {
      filtered = filtered.filter((w) =>
        selectedDifficulties.has(w.difficulty)
      );
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
  // FUNCTION: Navigate to next word
  // ============================================================================
  const nextWord = () => {
    if (currentIndex < reviewWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswer("");
      setFeedback("");
      setShowAnswer(false);
      setReportOpen(false);
      setReportText("");
      setReportNotes("");
    }
  };

  // ============================================================================
  // FUNCTION: Navigate to previous word
  // ============================================================================
  const previousWord = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setAnswer("");
      setFeedback("");
      setShowAnswer(false);
      setReportOpen(false);
      setReportText("");
      setReportNotes("");
    }
  };

  // ============================================================================
  // FUNCTION: Toggle category filter
  // ============================================================================
  const toggleCategory = (cat) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(cat)) {
      newSet.delete(cat);
    } else {
      newSet.add(cat);
    }
    setSelectedCategories(newSet);
  };

  // ============================================================================
  // FUNCTION: Select All/Deselect All categories
  // ============================================================================
  const toggleAllCategories = () => {
    if (selectedCategories.size === categories.length) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(categories));
    }
  };

  // ============================================================================
  // FUNCTION: Toggle difficulty filter
  // ============================================================================
  const toggleDifficulty = (diff) => {
    const newSet = new Set(selectedDifficulties);
    if (newSet.has(diff)) {
      newSet.delete(diff);
    } else {
      newSet.add(diff);
    }
    setSelectedDifficulties(newSet);
  };

  // ============================================================================
  // FUNCTION: Select All/Deselect All difficulties
  // ============================================================================
  const toggleAllDifficulties = () => {
    if (selectedDifficulties.size === 10) {
      setSelectedDifficulties(new Set());
    } else {
      setSelectedDifficulties(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    }
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <h1 style={styles.loadingText}>Loading Review Words...</h1>
      </div>
    );
  }

  // ============================================================================
  // EMPTY STATE
  // ============================================================================
  if (words.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <h1 style={styles.loadingText}>🎉 No words to review!</h1>
        <p style={styles.loadingSubtext}>All your words are mastered. Great job!</p>
        <button onClick={goBack} style={styles.secondaryButton}>
          Back to Menu
        </button>
      </div>
    );
  }

  // ============================================================================
  // NO WORDS AFTER FILTERS
  // ============================================================================
  if (reviewWords.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>📚 Review</h1>
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

        <div style={styles.filtersPanel}>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            style={styles.filterToggle}
          >
            🔧 Filters {filtersOpen ? "▼" : "▶"}
          </button>

          {filtersOpen && (
            <div style={styles.filtersContent}>
              <div style={styles.filterGroup}>
                <div style={styles.filterHeader}>
                  <h4 style={styles.filterTitle}>Categories</h4>
                  <button
                    onClick={toggleAllCategories}
                    style={styles.selectAllBtn}
                  >
                    {selectedCategories.size === categories.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>
                <div style={styles.checkboxGroup}>
                  {categories.map((cat) => (
                    <label key={cat} style={styles.checkboxLabel}>
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
                  <button
                    onClick={toggleAllDifficulties}
                    style={styles.selectAllBtn}
                  >
                    {selectedDifficulties.size === 10 ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div style={styles.difficultyGrid}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                    <label key={level} style={styles.checkboxLabelSmall}>
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
                <h4 style={styles.filterTitle}>Word Status</h4>
                <div style={styles.checkboxGroup}>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="radio"
                      name="mastered"
                      checked={masteredFilter === "nonmastered"}
                      onChange={() => setMasteredFilter("nonmastered")}
                      style={styles.checkbox}
                    />
                    Non-mastered only
                  </label>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="radio"
                      name="mastered"
                      checked={masteredFilter === "mastered"}
                      onChange={() => setMasteredFilter("mastered")}
                      style={styles.checkbox}
                    />
                    Mastered only
                  </label>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="radio"
                      name="mastered"
                      checked={masteredFilter === "both"}
                      onChange={() => setMasteredFilter("both")}
                      style={styles.checkbox}
                    />
                    Both
                  </label>
                </div>
              </div>

              <div style={styles.filterGroup}>
                <label style={styles.checkboxLabel}>
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

        <div style={styles.emptyMessage}>
          <p style={styles.emptyMessageText}>No words to review with current filters.</p>
          <p style={styles.emptyMessageText}>Try adjusting your settings above.</p>
        </div>

        <button onClick={goBack} style={styles.secondaryButton}>
          Back to Menu
        </button>
      </div>
    );
  }

  const currentWord = reviewWords[currentIndex];

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📚 Review</h1>
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

      <div style={styles.progressBar}>
        <div
          style={{
            ...styles.progressFill,
            width: `${((currentIndex + 1) / reviewWords.length) * 100}%`,
          }}
        />
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statItem}>
          📊 {currentIndex + 1}/{reviewWords.length}
        </div>
        <div style={styles.statItem}>
          📈 {currentWord.masteryPercent}%
        </div>
        <div style={styles.statItem}>
          ✅ {currentWord.correct_count}
        </div>
        <div style={styles.statItem}>
          ❌ {currentWord.incorrect_count}
        </div>
      </div>

      <div style={styles.masteryBarContainer}>
        <div style={styles.masteryBar}>
          <div
            style={{
              width: `${currentWord.masteryPercent}%`,
              height: "100%",
              background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
              transition: "width 0.3s ease",
              borderRadius: "4px",
            }}
          />
        </div>
      </div>

      <div style={styles.filtersPanel}>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          style={styles.filterToggle}
        >
          🔧 Filters {filtersOpen ? "▼" : "▶"}
        </button>

        {filtersOpen && (
          <div style={styles.filtersContent}>
            <div style={styles.filterGroup}>
              <div style={styles.filterHeader}>
                <h4 style={styles.filterTitle}>Categories</h4>
                <button
                  onClick={toggleAllCategories}
                  style={styles.selectAllBtn}
                >
                  {selectedCategories.size === categories.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
              <div style={styles.checkboxGroup}>
                {categories.map((cat) => (
                  <label key={cat} style={styles.checkboxLabel}>
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
                <button
                  onClick={toggleAllDifficulties}
                  style={styles.selectAllBtn}
                >
                  {selectedDifficulties.size === 10 ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div style={styles.difficultyGrid}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                  <label key={level} style={styles.checkboxLabelSmall}>
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
              <h4 style={styles.filterTitle}>Word Status</h4>
              <div style={styles.checkboxGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="radio"
                    name="mastered"
                    checked={masteredFilter === "nonmastered"}
                    onChange={() => setMasteredFilter("nonmastered")}
                    style={styles.checkbox}
                  />
                  Non-mastered only
                </label>
                <label style={styles.checkboxLabel}>
                  <input
                    type="radio"
                    name="mastered"
                    checked={masteredFilter === "mastered"}
                    onChange={() => setMasteredFilter("mastered")}
                    style={styles.checkbox}
                  />
                  Mastered only
                </label>
                <label style={styles.checkboxLabel}>
                  <input
                    type="radio"
                    name="mastered"
                    checked={masteredFilter === "both"}
                    onChange={() => setMasteredFilter("both")}
                    style={styles.checkbox}
                  />
                  Both
                </label>
              </div>
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.checkboxLabel}>
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

      <div style={styles.scrollableContent}>
        <div style={styles.questionContainer}>
          <p style={styles.questionLabel}>
            Question {currentIndex + 1}/{reviewWords.length}
          </p>
          <h2 style={styles.questionText}>Translate to Dutch:</h2>
          <h1 style={styles.wordToTranslate}>{currentWord.english}</h1>
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
              placeholder="Enter the translation..."
              style={styles.input}
            />
            <button type="submit" style={styles.submitButton}>
              Check
            </button>
          </form>
        ) : (
          <div>
            {feedback && (
              <p
                style={{
                  ...styles.feedback,
                  color: feedback.includes("✅") ? "#10b981" : "#ef4444",
                }}
              >
                {feedback}
              </p>
            )}
            <div style={styles.answerDisplay}>
              <p style={styles.answerLabel}>Correct Answer:</p>
              <p style={styles.answerText}>{currentWord.dutch}</p>
            </div>

            {feedback.includes("❌") && !reportOpen && (
              <button
                onClick={() => setReportOpen(true)}
                style={styles.reportButton}
              >
                🚨 Report Error
              </button>
            )}

            {reportOpen && feedback.includes("❌") && (
              <div style={styles.reportForm}>
                <h3 style={styles.reportTitle}>Report Incorrect Translation</h3>
                
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>What should the correct translation be?</label>
                  <input
                    type="text"
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder="Enter correct translation..."
                    style={styles.reportInput}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Additional notes (optional)</label>
                  <textarea
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                    placeholder="Add any extra context..."
                    style={styles.reportTextarea}
                  />
                </div>

                <div style={styles.reportButtonsGroup}>
                  <button
                    onClick={submitErrorReport}
                    disabled={reportLoading || !reportText.trim()}
                    style={{
                      ...styles.submitReportBtn,
                      opacity: reportLoading || !reportText.trim() ? 0.6 : 1,
                      cursor: reportLoading || !reportText.trim() ? "not-allowed" : "pointer",
                    }}
                  >
                    {reportLoading ? "Submitting..." : "Submit Report"}
                  </button>
                  <button
                    onClick={() => {
                      setReportOpen(false);
                      setReportText("");
                      setReportNotes("");
                    }}
                    style={styles.cancelReportBtn}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={nextWord}
              style={{
                ...styles.primaryButton,
                opacity: currentIndex < reviewWords.length - 1 ? 1 : 0.5,
                cursor:
                  currentIndex < reviewWords.length - 1 ? "pointer" : "not-allowed",
              }}
              disabled={currentIndex >= reviewWords.length - 1}
            >
              Next Word →
            </button>
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
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    padding: "0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
    margin: "12px 0 20px 0",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(6,182,212,0.2)",
    gap: "12px",
  },
  title: {
    fontSize: "clamp(20px, 5vw, 28px)",
    fontWeight: "800",
    margin: "0",
    color: "white",
    textShadow: "0 2px 8px rgba(6,182,212,0.3)",
    flex: 1,
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
  progressBar: {
    height: "6px",
    background: "rgba(6,182,212,0.2)",
    borderRadius: "8px",
    overflow: "hidden",
    margin: "12px 20px 0",
    maxWidth: "calc(100% - 40px)",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
    transition: "width 0.3s ease",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
    padding: "12px 16px",
    maxWidth: "800px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  statItem: {
    padding: "10px 8px",
    background: "rgba(30, 58, 138, 0.6)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "6px",
    fontSize: "clamp(10px, 2.2vw, 12px)",
    color: "#bfdbfe",
    fontWeight: "500",
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  masteryBarContainer: {
    maxWidth: "600px",
    margin: "0 auto",
    paddingLeft: "16px",
    paddingRight: "16px",
    paddingBottom: "12px",
    width: "100%",
    boxSizing: "border-box",
  },
  masteryBar: {
    height: "10px",
    background: "rgba(6,182,212,0.2)",
    borderRadius: "5px",
    overflow: "hidden",
  },
  filtersPanel: {
    paddingLeft: "16px",
    paddingRight: "16px",
    paddingBottom: "12px",
    maxWidth: "600px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  filterToggle: {
    width: "100%",
    padding: "10px 12px",
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "6px",
    fontSize: "clamp(12px, 2.5vw, 14px)",
    fontWeight: "600",
    cursor: "pointer",
    color: "#bfdbfe",
    transition: "all 0.2s ease",
  },
  filtersContent: {
    marginTop: "8px",
    background: "rgba(30, 58, 138, 0.8)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "8px",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  filterHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
  },
  filterTitle: {
    fontSize: "clamp(11px, 2vw, 12px)",
    color: "#06b6d4",
    margin: "0",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  selectAllBtn: {
    padding: "4px 8px",
    fontSize: "clamp(10px, 2vw, 11px)",
    background: "#06b6d4",
    color: "#0f172a",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "600",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
  },
  checkboxGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  difficultyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "6px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    color: "#bfdbfe",
    cursor: "pointer",
    userSelect: "none",
  },
  checkboxLabelSmall: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "clamp(11px, 2vw, 12px)",
    color: "#bfdbfe",
    cursor: "pointer",
    userSelect: "none",
  },
  checkbox: {
    width: "14px",
    height: "14px",
    cursor: "pointer",
    accentColor: "#06b6d4",
  },
  scrollableContent: {
    flex: 1,
    overflowY: "auto",
    paddingBottom: "20px",
  },
  questionContainer: {
    textAlign: "center",
    padding: "0 20px",
    paddingTop: "16px",
    marginBottom: "16px",
  },
  questionLabel: {
    fontSize: "clamp(11px, 2.5vw, 12px)",
    color: "#93c5fd",
    margin: "0 0 6px 0",
  },
  questionText: {
    fontSize: "clamp(12px, 2.5vw, 13px)",
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
    borderRadius: "8px",
    padding: "12px",
    margin: "0 20px 16px",
    fontSize: "clamp(11px, 2.5vw, 12px)",
  },
  exampleNL: {
    color: "#93c5fd",
    margin: "0 0 6px 0",
  },
  exampleEN: {
    color: "#cbd5e1",
    margin: "0",
    fontSize: "clamp(10px, 2.5vw, 11px)",
  },
  form: {
    display: "flex",
    gap: "8px",
    padding: "0 20px 12px",
  },
  input: {
    padding: "10px 12px",
    fontSize: "clamp(13px, 3vw, 14px)",
    border: "1px solid rgba(6,182,212,0.4)",
    borderRadius: "6px",
    flex: 1,
    minWidth: "120px",
    background: "rgba(255,255,255,0.95)",
    color: "#0f172a",
    transition: "all 0.2s ease",
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
    transition: "all 0.2s ease",
    boxShadow: "0 2px 6px rgba(59, 130, 246, 0.2)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  feedback: {
    fontSize: "clamp(13px, 3vw, 14px)",
    fontWeight: "600",
    margin: "12px 20px 0",
    minHeight: "24px",
    textAlign: "center",
  },
  answerDisplay: {
    background: "rgba(30, 58, 138, 0.6)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "8px",
    padding: "16px",
    margin: "12px 20px",
  },
  answerLabel: {
    fontSize: "clamp(11px, 2.5vw, 12px)",
    color: "#93c5fd",
    margin: "0 0 6px 0",
    fontWeight: "500",
  },
  answerText: {
    fontSize: "clamp(18px, 4vw, 22px)",
    fontWeight: "700",
    color: "white",
    margin: "0",
  },
  reportButton: {
    padding: "10px 16px",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    fontWeight: "600",
    background: "rgba(239, 68, 68, 0.2)",
    color: "#fca5a5",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "block",
    margin: "12px auto",
  },
  reportForm: {
    background: "rgba(30, 58, 138, 0.8)",
    border: "2px solid rgba(239, 68, 68, 0.4)",
    borderRadius: "8px",
    padding: "16px",
    margin: "12px 20px",
  },
  reportTitle: {
    fontSize: "clamp(13px, 2.5vw, 14px)",
    color: "#fca5a5",
    margin: "0 0 12px 0",
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  formLabel: {
    fontSize: "clamp(11px, 2.5vw, 12px)",
    color: "#bfdbfe",
    fontWeight: "500",
  },
  reportInput: {
    padding: "10px 12px",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "6px",
    background: "rgba(255,255,255,0.95)",
    color: "#0f172a",
    fontFamily: "inherit",
  },
  reportTextarea: {
    padding: "10px 12px",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "6px",
    background: "rgba(255,255,255,0.95)",
    color: "#0f172a",
    fontFamily: "inherit",
    minHeight: "80px",
    resize: "vertical",
  },
  reportButtonsGroup: {
    display: "flex",
    gap: "8px",
    marginTop: "12px",
  },
  submitReportBtn: {
    flex: 1,
    padding: "10px 12px",
    fontSize: "clamp(11px, 2.5vw, 12px)",
    fontWeight: "600",
    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  cancelReportBtn: {
    flex: 1,
    padding: "10px 12px",
    fontSize: "clamp(11px, 2.5vw, 12px)",
    fontWeight: "600",
    background: "rgba(255,255,255,0.1)",
    color: "#bfdbfe",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  primaryButton: {
    padding: "12px 20px",
    fontSize: "clamp(13px, 2.5vw, 14px)",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(59, 130, 246, 0.2)",
    transition: "all 0.2s ease",
    display: "block",
    margin: "16px auto",
    maxWidth: "300px",
    width: "calc(100% - 32px)",
  },
  secondaryButton: {
    padding: "10px 16px",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    background: "rgba(255,255,255,0.1)",
    color: "#06b6d4",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontWeight: "500",
  },
  navigationButtons: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
    flexWrap: "wrap",
    padding: "8px 16px",
  },
  emptyMessage: {
    textAlign: "center",
    padding: "40px 20px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyMessageText: {
    color: "#bfdbfe",
    fontSize: "clamp(13px, 2.5vw, 14px)",
    margin: "6px 0",
  },
};

export default Review;
