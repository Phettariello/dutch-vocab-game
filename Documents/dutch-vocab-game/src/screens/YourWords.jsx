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
  // EFFECT: Apply filters and sorting
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


    // Sort: 
    // 1. Mastery % ascendente (più difficili prima)
    // 2. Incorrect descendent (più errori prima)
    // 3. Correct ascendente (meno corrette prima)
    filtered.sort((a, b) => {
      if (a.masteryPercent !== b.masteryPercent) {
        return a.masteryPercent - b.masteryPercent;
      }
      if (a.incorrect_count !== b.incorrect_count) {
        return b.incorrect_count - a.incorrect_count;
      }
      return a.correct_count - b.correct_count;
    });


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


      {/* STATS GRID - 3 COLUMNS */}
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


            {/* Difficulty */}
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
          </div>
        )}
      </div>


      {/* WORDS LIST */}
      <div style={styles.contentContainer}>
        {filteredWords.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No words found with current filters.</p>
            <p>Try adjusting your search or filters!</p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div style={styles.tableHeader}>
              <div style={styles.colEnglish}>English</div>
              <div style={styles.colDutch}>Dutch</div>
              <div style={styles.colMastery}>Mastery</div>
              <div style={styles.colCorrect}>✅</div>
              <div style={styles.colIncorrect}>❌</div>
              <div style={styles.colLevel}>Level</div>
            </div>


            {/* Table Rows */}
            <div style={styles.tableBody}>
              {filteredWords.map((progress) => (
                <div key={progress.id} style={styles.tableRow}>
                  <div style={styles.colEnglish}>{progress.words.english}</div>
                  <div style={styles.colDutch}>{progress.words.dutch}</div>
                  <div style={styles.colMastery}>
                    <span
                      style={{
                        ...styles.masteryBadge,
                        backgroundColor:
                          progress.mastered
                            ? "#22c55e"
                            : progress.masteryPercent >= 60
                            ? "#f97316"
                            : "#ef4444",
                      }}
                    >
                      {progress.mastered ? "✅" : `${progress.masteryPercent}%`}
                    </span>
                  </div>
                  <div style={styles.colCorrect}>{progress.correct_count}</div>
                  <div style={styles.colIncorrect}>
                    {progress.incorrect_count}
                  </div>
                  <div style={styles.colLevel}>{progress.words.difficulty}</div>
                </div>
              ))}
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
    gridTemplateColumns: "repeat(3, 1fr)",
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
    padding: "12px",
    textAlign: "center",
    color: "white",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  statValue: {
    fontSize: "clamp(20px, 4vw, 28px)",
    fontWeight: "bold",
    color: "#fbbf24",
    margin: "0 0 4px 0",
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
  contentContainer: {
    flex: 1,
    padding: "16px",
    maxWidth: "1200px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
    overflowY: "auto",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "2fr 2fr 1.2fr 0.9fr 0.9fr 0.9fr",
    gap: "8px",
    padding: "12px",
    background: "rgba(6,182,212,0.1)",
    borderRadius: "8px 8px 0 0",
    borderBottom: "2px solid rgba(6,182,212,0.3)",
    fontWeight: "600",
    fontSize: "clamp(10px, 2vw, 12px)",
    color: "#06b6d4",
    position: "sticky",
    top: 0,
    zIndex: 10,
    alignItems: "center",
  },
  tableBody: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "2fr 2fr 1.2fr 0.9fr 0.9fr 0.9fr",
    gap: "8px",
    padding: "12px",
    background: "linear-gradient(135deg, rgba(30, 58, 138, 0.6) 0%, rgba(124, 58, 237, 0.3) 100%)",
    border: "1px solid rgba(6,182,212,0.15)",
    borderRadius: "6px",
    alignItems: "center",
    fontSize: "clamp(11px, 2.5vw, 13px)",
    color: "#bfdbfe",
    transition: "all 0.2s ease",
    overflow: "hidden",
  },
  colEnglish: {
    fontWeight: "600",
    color: "#f0f9ff",
    wordBreak: "break-word",
    whiteSpace: "normal",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  colDutch: {
    wordBreak: "break-word",
    whiteSpace: "normal",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  colMastery: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  masteryBadge: {
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "clamp(10px, 2vw, 11px)",
    fontWeight: "bold",
    color: "white",
    minWidth: "45px",
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  colCorrect: {
    textAlign: "center",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },
  colIncorrect: {
    textAlign: "center",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },
  colLevel: {
    textAlign: "center",
    fontWeight: "600",
    whiteSpace: "nowrap",
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