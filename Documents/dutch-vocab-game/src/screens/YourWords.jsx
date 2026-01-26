import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function YourWords({ goBack }) {
  const [words, setWords] = useState([]);
  const [filteredWords, setFilteredWords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [selectedDifficulties, setSelectedDifficulties] = useState(new Set());
  const [categories, setCategories] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Stats states
  const [stats, setStats] = useState({
    total: 0,
    mastered: 0,
    learning: 0,
    accuracy: 0,
  });

  // ============================================================================
  // EFFECT: Load words with progress and calculate stats
  // ============================================================================
  useEffect(() => {
    const fetchWords = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;

        if (!userId) {
          alert("You must be logged in.");
          goBack();
          return;
        }

        // 1. Fetch user_progress with word details
        const { data: progressData, error: progressError } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", userId);

        if (progressError) throw progressError;

        // 2. Fetch word details for each progress entry
        const progressWithWords = await Promise.all(
          (progressData || []).map(async (progress) => {
            const { data: word } = await supabase
              .from("words")
              .select("*")
              .eq("id", progress.word_id)
              .single();
            return { ...progress, words: word };
          })
        );

        // 3. Calculate mastery percent for each word
        const withPercentage = (progressWithWords || []).map((p) => {
          const total = p.correct_count + p.incorrect_count;
          const masteryPercent =
            total > 0
              ? Math.round((p.correct_count / total) * 100)
              : 0;
          return { ...p, masteryPercent, total };
        });

        // 4. Extract unique categories and initialize all as selected
        const uniqueCategories = [
          ...new Set(withPercentage.map((p) => p.words.category)),
        ].sort();
        setCategories(uniqueCategories);
        setSelectedCategories(new Set(uniqueCategories));

        // 5. Initialize all difficulties (1-10) as selected
        setSelectedDifficulties(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));

        // 6. Calculate overall stats
        const mastered = withPercentage.filter((w) => w.mastered).length;
        const totalCorrect = withPercentage.reduce(
          (sum, w) => sum + w.correct_count,
          0
        );
        const totalAttempts = withPercentage.reduce((sum, w) => sum + w.total, 0);
        const accuracy =
          totalAttempts > 0
            ? Math.round((totalCorrect / totalAttempts) * 100)
            : 0;

        setStats({
          total: withPercentage.length,
          mastered,
          learning: withPercentage.length - mastered,
          accuracy,
        });

        setWords(withPercentage);
        setFilteredWords(withPercentage);
      } catch (error) {
        console.error("Error fetching words:", error);
        alert("Failed to load words.");
      } finally {
        setLoading(false);
      }
    };

    fetchWords();
  }, []);

  // ============================================================================
  // EFFECT: Apply filters (search + categories + difficulty)
  // ============================================================================
  useEffect(() => {
    let filtered = words;

    // Search filter (English or Dutch)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (w) =>
          w.words.english.toLowerCase().includes(query) ||
          w.words.dutch.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategories.size > 0) {
      filtered = filtered.filter((w) =>
        selectedCategories.has(w.words.category)
      );
    }

    // Difficulty filter
    if (selectedDifficulties.size > 0) {
      filtered = filtered.filter((w) =>
        selectedDifficulties.has(w.words.difficulty)
      );
    }

    setFilteredWords(filtered);
  }, [searchQuery, selectedCategories, selectedDifficulties, words]);

  // ============================================================================
  // FUNCTION: Toggle category checkbox
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
  // FUNCTION: Toggle difficulty checkbox
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
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>📖 YOUR WORDS</h1>
          <button style={styles.backButton} onClick={goBack}>
            ← Back
          </button>
        </div>
        <div style={styles.loadingState}>Loading your words...</div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <div style={styles.container}>
      {/* HEADER - STICKY */}
      <div style={styles.header}>
        <h1 style={styles.title}>📖 YOUR WORDS</h1>
        <button
          style={styles.backButton}
          onClick={goBack}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#0891b2";
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#06b6d4";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          ← Back
        </button>
      </div>

      {/* STATS GRID */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <p style={styles.statValue}>{stats.total}</p>
          <p style={styles.statLabel}>Total Words</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statValue}>{stats.mastered}</p>
          <p style={styles.statLabel}>✅ Mastered</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statValue}>{stats.learning}</p>
          <p style={styles.statLabel}>🎯 Learning</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statValue}>{stats.accuracy}%</p>
          <p style={styles.statLabel}>📊 Accuracy</p>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div style={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search by English or Dutch..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* FILTERS TOGGLE */}
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
              <h4 style={styles.filterTitle}>Difficulty (1-10)</h4>
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
          </div>
        )}
      </div>

      {/* WORDS GRID */}
      <div style={styles.contentContainer}>
        {filteredWords.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No words found with current filters.</p>
            <p>Try adjusting your search or filters!</p>
          </div>
        ) : (
          <>
            <div style={styles.cardsGrid}>
              {filteredWords.map((progress) => {
                // Determine badge color
                let badge = styles.successBadge; // Default mastered
                if (!progress.mastered) {
                  if (progress.masteryPercent >= 60) {
                    badge = styles.warningBadge; // 60-99%
                  } else {
                    badge = styles.errorBadge; // 0-59%
                  }
                }

                return (
                  <div
                    key={progress.id}
                    style={styles.card}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow =
                        "0 6px 20px rgba(6,182,212,0.25)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.boxShadow =
                        "0 2px 8px rgba(0,0,0,0.1)";
                    }}
                  >
                    {/* Card Header */}
                    <div style={styles.cardHeader}>
                      <div style={styles.cardWords}>
                        <h3 style={styles.cardTitle}>
                          {progress.words.english}
                        </h3>
                        <p style={styles.cardSubtitle}>
                          {progress.words.dutch}
                        </p>
                      </div>
                      <div style={badge}>
                        {progress.mastered ? "✅" : `${progress.masteryPercent}%`}
                      </div>
                    </div>

                    {/* Card Stats */}
                    <div style={styles.cardStats}>
                      <div style={styles.statItemSmall}>
                        <span style={styles.statLabel}>✅</span>
                        {progress.correct_count}
                      </div>
                      <div style={styles.statItemSmall}>
                        <span style={styles.statLabel}>❌</span>
                        {progress.incorrect_count}
                      </div>
                      <div style={styles.statItemSmall}>
                        <span style={styles.statLabel}>📊</span>
                        {progress.total}
                      </div>
                    </div>

                    {/* Card Meta */}
                    <div style={styles.cardMeta}>
                      <span>📁 {progress.words.category}</span>
                      <span>📈 Lvl {progress.words.difficulty}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Results counter */}
            <div style={styles.resultCounter}>
              Showing {filteredWords.length} of {stats.total} words
            </div>
          </>
        )}
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
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    padding: "0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
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
  },
  title: {
    fontSize: "clamp(20px, 5vw, 32px)",
    fontWeight: "800",
    margin: 0,
    color: "white",
    textShadow: "0 2px 8px rgba(6,182,212,0.3)",
  },
  backButton: {
    padding: "8px 16px",
    backgroundColor: "#06b6d4",
    color: "#0f172a",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "clamp(12px, 2.5vw, 14px)",
    fontWeight: "600",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
    flexShrink: 0,
    marginLeft: "12px",
  },
  statsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
    gap: "12px",
    padding: "16px",
    maxWidth: "1000px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  statCard: {
    background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
    border: "1px solid rgba(6,182,212,0.2)",
    borderRadius: "10px",
    padding: "14px 12px",
    textAlign: "center",
    color: "white",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    minHeight: "90px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  statValue: {
    fontSize: "clamp(24px, 5vw, 32px)",
    fontWeight: "bold",
    color: "#fbbf24",
    margin: "0 0 6px 0",
  },
  statLabel: {
    fontSize: "clamp(10px, 2vw, 12px)",
    color: "#bfdbfe",
    margin: 0,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  searchContainer: {
    padding: "0 16px 12px 16px",
    maxWidth: "1000px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  searchInput: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid rgba(6,182,212,0.3)",
    background: "rgba(255,255,255,0.95)",
    color: "#0f172a",
    fontSize: "clamp(13px, 3vw, 14px)",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "all 0.2s ease",
  },
  filtersPanel: {
    padding: "0 16px 12px 16px",
    maxWidth: "1000px",
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
  filterTitle: {
    fontSize: "clamp(11px, 2vw, 12px)",
    color: "#06b6d4",
    margin: "0",
    fontWeight: "600",
    textTransform: "uppercase",
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
  contentContainer: {
    flex: 1,
    padding: "16px",
    maxWidth: "1000px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
    overflowY: "auto",
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "12px",
    marginBottom: "20px",
  },
  card: {
    background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
    border: "1px solid rgba(6,182,212,0.2)",
    borderRadius: "10px",
    padding: "14px",
    color: "white",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    transition: "all 0.2s ease",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
  },
  cardWords: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: "clamp(13px, 3vw, 15px)",
    fontWeight: "700",
    margin: "0",
    color: "#f0f9ff",
    wordBreak: "break-word",
  },
  cardSubtitle: {
    fontSize: "clamp(11px, 2.5vw, 12px)",
    color: "#bfdbfe",
    margin: "4px 0 0 0",
    fontWeight: "500",
    wordBreak: "break-word",
  },
  successBadge: {
    backgroundColor: "#22c55e",
    color: "white",
    padding: "6px 12px",
    borderRadius: "6px",
    fontWeight: "bold",
    fontSize: "clamp(12px, 2.5vw, 14px)",
    minWidth: "50px",
    textAlign: "center",
    flexShrink: 0,
  },
  warningBadge: {
    backgroundColor: "#f97316",
    color: "white",
    padding: "6px 12px",
    borderRadius: "6px",
    fontWeight: "bold",
    fontSize: "clamp(12px, 2.5vw, 14px)",
    minWidth: "50px",
    textAlign: "center",
    flexShrink: 0,
  },
  errorBadge: {
    backgroundColor: "#ef4444",
    color: "white",
    padding: "6px 12px",
    borderRadius: "6px",
    fontWeight: "bold",
    fontSize: "clamp(12px, 2.5vw, 14px)",
    minWidth: "50px",
    textAlign: "center",
    flexShrink: 0,
  },
  cardStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "6px",
  },
  statItemSmall: {
    background: "rgba(255,255,255,0.1)",
    padding: "6px 8px",
    borderRadius: "4px",
    textAlign: "center",
    color: "#bfdbfe",
    fontSize: "clamp(10px, 2vw, 12px)",
    fontWeight: "600",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
  },
  cardMeta: {
    display: "flex",
    gap: "8px",
    fontSize: "clamp(9px, 2vw, 11px)",
    color: "#bfdbfe",
    borderTop: "1px solid rgba(6,182,212,0.2)",
    paddingTop: "8px",
    marginTop: "8px",
    flexWrap: "wrap",
  },
  emptyState: {
    textAlign: "center",
    color: "#06b6d4",
    padding: "40px 20px",
    fontSize: "clamp(14px, 3vw, 16px)",
  },
  loadingState: {
    textAlign: "center",
    color: "#06b6d4",
    padding: "40px 20px",
    fontSize: "clamp(14px, 3vw, 16px)",
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  resultCounter: {
    textAlign: "center",
    color: "#bfdbfe",
    fontSize: "clamp(11px, 2vw, 12px)",
    padding: "12px 0",
    fontWeight: "500",
  },
};

export default YourWords;
