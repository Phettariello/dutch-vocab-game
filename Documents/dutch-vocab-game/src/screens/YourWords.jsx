import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function YourWords({ goBack }) {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [categories, setCategories] = useState([]);
  const [filteredWords, setFilteredWords] = useState([]);

  useEffect(() => {
    const fetchWords = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user.id;

        const { data: progressData, error: progressError } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", userId);

        if (progressError) throw progressError;

        // Fetch dettagli parole
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

        const withPercentage = (progressWithWords || []).map((p) => {
          const total = p.correct_count + p.incorrect_count;
          const errorPercentage = total > 0 ? (p.incorrect_count / total) * 100 : 0;
          return { ...p, errorPercentage, total };
        });

        withPercentage.sort((a, b) => b.errorPercentage - a.errorPercentage);

        // Estrai categorie uniche
        const uniqueCategories = [
          ...new Set(withPercentage.map((p) => p.words.category)),
        ].sort();
        setCategories(uniqueCategories);

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

  // Filtra parole quando cambiano i filtri
  useEffect(() => {
    let filtered = words;

    if (selectedCategory !== "all") {
      filtered = filtered.filter((w) => w.words.category === selectedCategory);
    }

    if (selectedDifficulty !== "all") {
      const diff = parseInt(selectedDifficulty);
      filtered = filtered.filter((w) => w.words.difficulty === diff);
    }

    setFilteredWords(filtered);
  }, [selectedCategory, selectedDifficulty, words]);

  const stats = {
    total: words.length,
    mastered: words.filter((w) => w.mastered).length,
    learning: words.filter((w) => !w.mastered).length,
  };

  const styles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
      padding: "20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "30px",
      position: "sticky",
      top: 0,
      zIndex: 100,
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
      padding: "20px 0",
    },
    title: {
      fontSize: "36px",
      fontWeight: "800",
      margin: 0,
      color: "white",
      textShadow: "0 2px 10px rgba(6,182,212,0.4)",
    },
    backButton: {
      padding: "12px 24px",
      backgroundColor: "#06b6d4",
      color: "#0f172a",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
      transition: "all 0.3s ease",
    },
    statsContainer: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: "16px",
      marginBottom: "30px",
      maxWidth: "1000px",
      margin: "0 auto 30px",
    },
    statCard: {
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "12px",
      padding: "20px",
      textAlign: "center",
      color: "white",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
    },
    statValue: {
      fontSize: "32px",
      fontWeight: "bold",
      color: "#fbbf24",
      margin: "0 0 8px 0",
    },
    statLabel: {
      fontSize: "12px",
      color: "#bfdbfe",
      margin: 0,
      textTransform: "uppercase",
      fontWeight: "600",
    },
    filterContainer: {
      maxWidth: "1000px",
      margin: "0 auto 30px",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "16px",
    },
    filterGroup: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    },
    filterLabel: {
      color: "#06b6d4",
      fontWeight: "700",
      fontSize: "13px",
      textTransform: "uppercase",
    },
    filterSelect: {
      padding: "10px 12px",
      borderRadius: "8px",
      border: "1px solid rgba(6,182,212,0.3)",
      background: "rgba(30, 58, 138, 0.8)",
      color: "white",
      fontSize: "14px",
      cursor: "pointer",
      transition: "all 0.3s ease",
    },
    contentContainer: {
      maxWidth: "1000px",
      margin: "0 auto",
    },
    cardsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
      gap: "16px",
      marginBottom: "40px",
    },
    card: {
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "12px",
      padding: "20px",
      color: "white",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
      transition: "all 0.3s ease",
      cursor: "pointer",
    },
    cardHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "start",
      marginBottom: "12px",
      gap: "12px",
    },
    cardTitle: {
      fontSize: "18px",
      fontWeight: "700",
      margin: "0 0 4px 0",
      color: "#f0f9ff",
    },
    cardSubtitle: {
      fontSize: "14px",
      color: "#bfdbfe",
      margin: 0,
      fontWeight: "500",
    },
    errorBadge: {
      backgroundColor: "#ef4444",
      color: "white",
      padding: "8px 16px",
      borderRadius: "8px",
      fontWeight: "bold",
      fontSize: "14px",
      minWidth: "80px",
      textAlign: "center",
    },
    warningBadge: {
      backgroundColor: "#f97316",
      color: "white",
      padding: "8px 16px",
      borderRadius: "8px",
      fontWeight: "bold",
      fontSize: "14px",
      minWidth: "80px",
      textAlign: "center",
    },
    successBadge: {
      backgroundColor: "#22c55e",
      color: "white",
      padding: "8px 16px",
      borderRadius: "8px",
      fontWeight: "bold",
      fontSize: "14px",
      minWidth: "80px",
      textAlign: "center",
    },
    cardStats: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: "8px",
      marginBottom: "12px",
      fontSize: "12px",
    },
    statItem: {
      background: "rgba(255,255,255,0.1)",
      padding: "8px",
      borderRadius: "6px",
      textAlign: "center",
      color: "#bfdbfe",
    },
    cardMeta: {
      display: "flex",
      gap: "12px",
      fontSize: "12px",
      color: "#bfdbfe",
      borderTop: "1px solid rgba(6,182,212,0.2)",
      paddingTop: "12px",
      marginTop: "12px",
    },
    emptyState: {
      textAlign: "center",
      color: "#06b6d4",
      padding: "40px 20px",
      fontSize: "16px",
    },
    loadingState: {
      textAlign: "center",
      color: "#06b6d4",
      padding: "40px 20px",
      fontSize: "16px",
    },
  };

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

  return (
    <div style={styles.container}>
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
          ← Back to Menu
        </button>
      </div>

      {/* Stats */}
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
          <p style={styles.statLabel}>⚠️ Learning</p>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filterContainer}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Category</label>
          <select
            style={styles.filterSelect}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Difficulty</label>
          <select
            style={styles.filterSelect}
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
          >
            <option value="all">All Levels</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
              <option key={level} value={level}>
                Level {level}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.contentContainer}>
        {filteredWords.length === 0 ? (
          <div style={styles.emptyState}>
            No words found with the selected filters. Try adjusting your selection!
          </div>
        ) : (
          <>
            <div style={styles.cardsGrid}>
              {filteredWords.map((progress, index) => {
                let badge;
                if (progress.mastered) {
                  badge = styles.successBadge;
                } else if (progress.errorPercentage > 50) {
                  badge = styles.errorBadge;
                } else {
                  badge = styles.warningBadge;
                }

                return (
                  <div
                    key={progress.id}
                    style={styles.card}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.boxShadow =
                        "0 8px 25px rgba(6,182,212,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.boxShadow =
                        "0 4px 15px rgba(0,0,0,0.2)";
                    }}
                  >
                    <div style={styles.cardHeader}>
                      <div style={{ flex: 1 }}>
                        <h3 style={styles.cardTitle}>
                          {progress.words.english}
                        </h3>
                        <p style={styles.cardSubtitle}>
                          {progress.words.dutch}
                        </p>
                      </div>
                      <div style={badge}>
                        {progress.mastered ? (
                          "✅ MASTERED"
                        ) : (
                          `${progress.errorPercentage.toFixed(0)}%`
                        )}
                      </div>
                    </div>

                    <div style={styles.cardStats}>
                      <div style={styles.statItem}>
                        ✅ {progress.correct_count}
                      </div>
                      <div style={styles.statItem}>
                        ❌ {progress.incorrect_count}
                      </div>
                      <div style={styles.statItem}>
                        Total: {progress.total}
                      </div>
                    </div>

                    <div style={styles.cardMeta}>
                      <span>📁 {progress.words.category}</span>
                      <span>📊 Level {progress.words.difficulty}/10</span>
                    </div>

                    {progress.words.example_nl && (
                      <div
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          padding: "10px",
                          borderRadius: "6px",
                          marginTop: "12px",
                          fontSize: "12px",
                          lineHeight: "1.4",
                          borderLeft: "3px solid #06b6d4",
                        }}
                      >
                        <p style={{ margin: "0 0 4px 0" }}>
                          <strong>NL:</strong> {progress.words.example_nl}
                        </p>
                        {progress.words.example_en && (
                          <p style={{ margin: 0, color: "#bfdbfe" }}>
                            <strong>EN:</strong> {progress.words.example_en}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                textAlign: "center",
                color: "#bfdbfe",
                marginBottom: "20px",
                fontSize: "14px",
              }}
            >
              Showing {filteredWords.length} of {stats.total} words
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default YourWords;
