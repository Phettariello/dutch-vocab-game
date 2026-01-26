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
  const [selectedDifficulties, setSelectedDifficulties] = useState(
    new Set(["beginner", "medium", "advanced"])
  );
  const [onlyNonMastered, setOnlyNonMastered] = useState(true);
  const [shuffle, setShuffle] = useState(false);

  // UI states
  const [categories, setCategories] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputRef = useRef(null);

  // ============================================================================
  // FUNCTION: Update user progress (salva direttamente in user_progress)
  // ============================================================================
  const updateUserProgress = async (wordId, isCorrect) => {
    if (!userId) return;

    try {
      // 1. Cerca se esiste già user_progress per questa word
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
        // 2. UPDATE: incrementa correct_count o incorrect_count
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
        // 3. INSERT: crea nuova riga
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

        // Get user's non-mastered words
        const { data: userProgress, error: progressError } = await supabase
          .from("user_progress")
          .select("word_id, correct_count, incorrect_count, mastered")
          .eq("user_id", currentUserId)
          .eq("mastered", false);

        if (progressError) throw progressError;

        if (userProgress.length === 0) {
          setWords([]);
          setLoading(false);
          return;
        }

        const wordIds = userProgress.map((p) => p.word_id);

        // Get word details
        const { data: wordDetails, error: wordsError } = await supabase
          .from("words")
          .select("*")
          .in("id", wordIds);

        if (wordsError) throw wordsError;

        // Merge word details with progress
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
          };
        });

        // Extract unique categories
        const uniqueCategories = [
          ...new Set(wordsWithProgress.map((w) => w.category)),
        ].sort();
        setCategories(uniqueCategories);

        // Initialize all categories as selected
        setSelectedCategories(new Set(uniqueCategories));

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

    // Filter by category
    if (selectedCategories.size > 0) {
      filtered = filtered.filter((w) =>
        selectedCategories.has(w.category)
      );
    }

    // Filter by difficulty
    if (selectedDifficulties.size > 0) {
      filtered = filtered.filter((w) => {
        const diff = w.difficulty;
        if (selectedDifficulties.has("beginner") && diff <= 3) return true;
        if (selectedDifficulties.has("medium") && diff >= 4 && diff <= 6)
          return true;
        if (selectedDifficulties.has("advanced") && diff >= 7) return true;
        return false;
      });
    }

    // Filter non-mastered
    if (onlyNonMastered) {
      filtered = filtered.filter((w) => !w.mastered);
    }

    // Shuffle if enabled
    if (shuffle) {
      filtered = [...filtered].sort(() => Math.random() - 0.5);
    } else {
      // Sort by mastery percent (ascending - hardest first)
      filtered = [...filtered].sort(
        (a, b) => a.masteryPercent - b.masteryPercent
      );
    }

    setReviewWords(filtered);
    setCurrentIndex(0);
  }, [words, selectedCategories, selectedDifficulties, onlyNonMastered, shuffle]);

  // ============================================================================
  // EFFECT: Auto-focus input on mount and after answer
  // ============================================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, [currentIndex, showAnswer]);

  // ============================================================================
  // FUNCTION: Normalize text for comparison
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

    // 🔥 SALVA PROGRESSO SU DATABASE
    await updateUserProgress(reviewWords[currentIndex].id, isCorrect);

    if (isCorrect) {
      setFeedback("✅ Correct!");
    } else {
      setFeedback(`❌ Wrong! The answer is '${reviewWords[currentIndex].dutch}'.`);
    }

    setShowAnswer(true);
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
  // LOADING STATE
  // ============================================================================
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <h1>Loading Review Words...</h1>
      </div>
    );
  }

  // ============================================================================
  // EMPTY STATE
  // ============================================================================
  if (words.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <h1>🎉 No words to review!</h1>
        <p>All your words are mastered. Great job!</p>
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
          <div style={styles.headerTop}>
            <h1 style={styles.title}>📚 Review Mode</h1>
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
              {/* Categories */}
              <div style={styles.filterGroup}>
                <h4 style={styles.filterTitle}>Categories</h4>
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

              {/* Difficulty */}
              <div style={styles.filterGroup}>
                <h4 style={styles.filterTitle}>Difficulty</h4>
                <div style={styles.checkboxGroup}>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedDifficulties.has("beginner")}
                      onChange={() => toggleDifficulty("beginner")}
                      style={styles.checkbox}
                    />
                    Beginner (1-3)
                  </label>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedDifficulties.has("medium")}
                      onChange={() => toggleDifficulty("medium")}
                      style={styles.checkbox}
                    />
                    Medium (4-6)
                  </label>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedDifficulties.has("advanced")}
                      onChange={() => toggleDifficulty("advanced")}
                      style={styles.checkbox}
                    />
                    Advanced (7-10)
                  </label>
                </div>
              </div>

              {/* Non-Mastered */}
              <div style={styles.filterGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={onlyNonMastered}
                    onChange={(e) => setOnlyNonMastered(e.target.checked)}
                    style={styles.checkbox}
                  />
                  Only non-mastered words
                </label>
              </div>

              {/* Shuffle */}
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
          <p>No words to review with current filters.</p>
          <p>Try adjusting your settings above.</p>
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
      {/* HEADER - STICKY */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>📚 Review</h1>
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

      {/* STATS GRID - COMPACT ON MOBILE */}
      <div style={styles.statsGrid}>
        <div style={styles.statItem}>
          <span>📊</span> {currentIndex + 1}/{reviewWords.length}
        </div>
        <div style={styles.statItem}>
          <span>📈</span> {currentWord.masteryPercent}%
        </div>
        <div style={styles.statItem}>
          <span>✅</span> {currentWord.correct_count}
        </div>
        <div style={styles.statItem}>
          <span>❌</span> {currentWord.incorrect_count}
        </div>
      </div>

      {/* MASTERY BAR */}
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

      {/* FILTERS PANEL */}
      <div style={styles.filtersPanel}>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          style={styles.filterToggle}
        >
          🔧 Filters {filtersOpen ? "▼" : "▶"}
        </button>

        {filtersOpen && (
          <div style={styles.filtersContent}>
            {/* Categories */}
            <div style={styles.filterGroup}>
              <h4 style={styles.filterTitle}>Categories</h4>
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

            {/* Difficulty */}
            <div style={styles.filterGroup}>
              <h4 style={styles.filterTitle}>Difficulty</h4>
              <div style={styles.checkboxGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selectedDifficulties.has("beginner")}
                    onChange={() => toggleDifficulty("beginner")}
                    style={styles.checkbox}
                  />
                  Beginner (1-3)
                </label>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selectedDifficulties.has("medium")}
                    onChange={() => toggleDifficulty("medium")}
                    style={styles.checkbox}
                  />
                  Medium (4-6)
                </label>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selectedDifficulties.has("advanced")}
                    onChange={() => toggleDifficulty("advanced")}
                    style={styles.checkbox}
                  />
                  Advanced (7-10)
                </label>
              </div>
            </div>

            {/* Non-Mastered */}
            <div style={styles.filterGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={onlyNonMastered}
                  onChange={(e) => setOnlyNonMastered(e.target.checked)}
                  style={styles.checkbox}
                />
                Only non-mastered words
              </label>
            </div>

            {/* Shuffle */}
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

      {/* QUESTION AREA - SCROLLABLE */}
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

// ============================================================================
// STYLES - MOBILE OPTIMIZED
// ============================================================================
const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
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
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "20px",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    textAlign: "center",
    paddingTop: "16px",
    paddingBottom: "8px",
    borderBottom: "1px solid #e5e7eb",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    maxWidth: "600px",
    margin: "0 auto 12px",
    paddingRight: "20px",
    paddingLeft: "20px",
  },
  title: {
    fontSize: "clamp(20px, 5vw, 32px)",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0",
  },
  progressBar: {
    height: "6px",
    background: "#e5e7eb",
    borderRadius: "10px",
    overflow: "hidden",
    maxWidth: "400px",
    margin: "0 auto",
    marginRight: "20px",
    marginLeft: "20px",
    marginBottom: "12px",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
    transition: "width 0.3s ease",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "8px",
    paddingLeft: "16px",
    paddingRight: "16px",
    paddingBottom: "12px",
    maxWidth: "600px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  statItem: {
    padding: "10px 12px",
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "clamp(11px, 2.5vw, 13px)",
    color: "#475569",
    fontWeight: "500",
    textAlign: "center",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  masteryBarContainer: {
    maxWidth: "600px",
    margin: "0 auto",
    paddingLeft: "16px",
    paddingRight: "16px",
    paddingBottom: "16px",
    width: "100%",
    boxSizing: "border-box",
  },
  masteryBar: {
    height: "10px",
    background: "#e5e7eb",
    borderRadius: "5px",
    overflow: "hidden",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
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
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "clamp(12px, 2.5vw, 14px)",
    fontWeight: "600",
    cursor: "pointer",
    color: "#475569",
    transition: "all 0.2s ease",
  },
  filtersContent: {
    marginTop: "8px",
    background: "white",
    border: "1px solid #e5e7eb",
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
  filterTitle: {
    fontSize: "11px",
    color: "#64748b",
    margin: "0",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  checkboxGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#475569",
    cursor: "pointer",
    userSelect: "none",
  },
  checkbox: {
    width: "16px",
    height: "16px",
    cursor: "pointer",
    accentColor: "#3b82f6",
  },
  scrollableContent: {
    flex: 1,
    overflowY: "auto",
    paddingBottom: "20px",
  },
  questionContainer: {
    textAlign: "center",
    paddingLeft: "16px",
    paddingRight: "16px",
    paddingTop: "16px",
    marginBottom: "16px",
  },
  questionLabel: {
    fontSize: "clamp(11px, 2.5vw, 13px)",
    color: "#64748b",
    margin: "0 0 6px 0",
  },
  questionText: {
    fontSize: "clamp(13px, 3vw, 16px)",
    color: "#64748b",
    margin: "0 0 10px 0",
    fontWeight: "500",
  },
  wordToTranslate: {
    fontSize: "clamp(28px, 7vw, 40px)",
    color: "#1e293b",
    margin: "0",
    fontWeight: "700",
    wordBreak: "break-word",
  },
  exampleBox: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "12px",
    maxWidth: "600px",
    margin: "0 auto 16px",
    marginLeft: "16px",
    marginRight: "16px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
    fontSize: "clamp(11px, 2.5vw, 12px)",
  },
  exampleNL: {
    color: "#475569",
    margin: "0 0 6px 0",
    lineHeight: "1.4",
  },
  exampleEN: {
    color: "#64748b",
    margin: "0",
    lineHeight: "1.4",
  },
  form: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
    paddingLeft: "16px",
    paddingRight: "16px",
    marginBottom: "16px",
    flexWrap: "wrap",
    maxWidth: "600px",
    margin: "0 auto 16px",
    width: "100%",
    boxSizing: "border-box",
  },
  input: {
    padding: "12px 12px",
    fontSize: "clamp(14px, 3vw, 16px)",
    border: "2px solid #e5e7eb",
    borderRadius: "6px",
    flex: "1 1 auto",
    minWidth: "180px",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  submitButton: {
    padding: "12px 20px",
    fontSize: "clamp(13px, 2.5vw, 14px)",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 6px rgba(59, 130, 246, 0.25)",
    whiteSpace: "nowrap",
  },
  feedback: {
    fontSize: "clamp(13px, 3vw, 16px)",
    fontWeight: "600",
    margin: "12px 16px 0 16px",
    minHeight: "24px",
    textAlign: "center",
  },
  answerDisplay: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "16px",
    maxWidth: "600px",
    margin: "12px 16px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  answerLabel: {
    fontSize: "clamp(11px, 2.5vw, 12px)",
    color: "#64748b",
    margin: "0 0 6px 0",
    fontWeight: "500",
  },
  answerText: {
    fontSize: "clamp(18px, 4vw, 22px)",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0",
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
    boxShadow: "0 2px 6px rgba(59, 130, 246, 0.25)",
    transition: "all 0.2s ease",
    display: "block",
    margin: "16px auto",
    maxWidth: "300px",
    width: "calc(100% - 32px)",
  },
  secondaryButton: {
    padding: "10px 16px",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    background: "#f3f4f6",
    color: "#475569",
    border: "1px solid #e5e7eb",
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
    paddingLeft: "16px",
    paddingRight: "16px",
    paddingTop: "8px",
  },
  emptyMessage: {
    textAlign: "center",
    color: "#64748b",
    padding: "40px 20px",
    fontSize: "14px",
  },
};

export default Review;
