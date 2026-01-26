import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Achievements({ goBack, userId }) {
  const [stats, setStats] = useState({
    totalGames: 0,
    bestScore: 0,
    totalPoints: 0,
    bestLevel: 0,
    maxCorrectAnswers: 0,
    wordsMastered: 0,
    userLevel: "A0",
    levelName: "Beginner",
    levelProgress: 0,
    wordsNeeded: 500,
    totalWeeklyGold: 0,
    totalWeeklySilver: 0,
    totalWeeklyBronze: 0,
    totalMonthlyGold: 0,
    totalMonthlySilver: 0,
    totalMonthlyBronze: 0,
  });
  const [loading, setLoading] = useState(true);
  const [topResults, setTopResults] = useState([]);

  // ============================================================================
  // FUNCTION: Calculate user level based on words mastered
  // ============================================================================
  const calculateUserLevel = (wordsMastered) => {
    const levels = [
      { code: "A0", name: "Beginner", min: 0, max: 500 },
      { code: "A1", name: "Elementary", min: 501, max: 1000 },
      { code: "B1", name: "Intermediate", min: 1001, max: 1500 },
      { code: "B2", name: "Upper Intermediate", min: 1501, max: 2000 },
      { code: "C1", name: "Advanced", min: 2001, max: 2500 },
      { code: "C2", name: "Mastery", min: 2501, max: 3000 },
    ];

    let currentLevel = levels[0];
    let nextLevel = levels[1] || levels[0];
    let progress = 0;

    for (let i = 0; i < levels.length; i++) {
      if (wordsMastered >= levels[i].min && wordsMastered <= levels[i].max) {
        currentLevel = levels[i];
        nextLevel = levels[i + 1] || levels[i];
        const rangeSize = currentLevel.max - currentLevel.min + 1;
        const wordsInRange = wordsMastered - currentLevel.min;
        progress = (wordsInRange / rangeSize) * 100;
        break;
      }
    }

    // If mastered >= 3000, set to C2
    if (wordsMastered >= 3000) {
      currentLevel = levels[5];
      nextLevel = levels[5];
      progress = 100;
    }

    const wordsNeeded = nextLevel.max;

    return {
      userLevel: currentLevel.code,
      levelName: currentLevel.name,
      levelProgress: progress,
      wordsNeeded: wordsNeeded,
    };
  };

  // ============================================================================
  // EFFECT: Fetch all achievements data
  // ============================================================================
  useEffect(() => {
    if (userId && String(userId).trim().length > 0) {
      fetchAchievements();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const fetchAchievements = async () => {
    setLoading(true);
    try {
      // 1. Fetch user sessions (Play mode)
      const { data: sessions } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", userId)
        .order("score", { ascending: false });

      // 2. Fetch user word progress (mastered words)
      const { data: progressData } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", userId);

      // 3. Fetch weekly medals
      const { data: weeklyMedals } = await supabase
        .from("weekly_medals")
        .select("medal_type")
        .eq("user_id", userId);

      // 4. Fetch monthly medals
      const { data: monthlyMedals } = await supabase
        .from("monthly_medals")
        .select("medal_type")
        .eq("user_id", userId);

      // Calculate statistics
      const totalGames = sessions?.length || 0;
      const bestScore = Math.max(...(sessions?.map((s) => s.score || 0) || [0]));
      const totalPoints = sessions?.reduce((sum, s) => sum + (s.score || 0), 0) || 0;
      const bestLevel = Math.max(...(sessions?.map((s) => s.level || 0) || [0]));
      const maxCorrectAnswers = Math.max(
        ...(sessions?.map((s) => s.correct_answers || 0) || [0])
      );

      // Words mastered (where mastered = true)
      const wordsMastered = progressData?.filter((w) => w.mastered).length || 0;

      // Calculate user level
      const levelInfo = calculateUserLevel(wordsMastered);

      // Count medals
      let weeklyCount = { gold: 0, silver: 0, bronze: 0 };
      let monthlyCount = { gold: 0, silver: 0, bronze: 0 };

      weeklyMedals?.forEach((m) => {
        weeklyCount[m.medal_type]++;
      });
      monthlyMedals?.forEach((m) => {
        monthlyCount[m.medal_type]++;
      });

      setStats({
        totalGames,
        bestScore,
        totalPoints,
        bestLevel,
        maxCorrectAnswers,
        wordsMastered,
        ...levelInfo,
        totalWeeklyGold: weeklyCount.gold,
        totalWeeklySilver: weeklyCount.silver,
        totalWeeklyBronze: weeklyCount.bronze,
        totalMonthlyGold: monthlyCount.gold,
        totalMonthlySilver: monthlyCount.silver,
        totalMonthlyBronze: monthlyCount.bronze,
      });

      // Top 10 results
      if (sessions && sessions.length > 0) {
        const topSessions = sessions.slice(0, 10).map((s) => ({
          score: s.score,
          level: s.level,
          correctAnswers: s.correct_answers,
        }));
        setTopResults(topSessions);
      }
    } catch (error) {
      console.error("Error fetching achievements:", error);
    } finally {
      setLoading(false);
    }
  };

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
    contentContainer: {
      flex: 1,
      padding: "16px",
      maxWidth: "1000px",
      margin: "0 auto",
      width: "100%",
      boxSizing: "border-box",
      overflowY: "auto",
    },
    section: {
      marginBottom: "28px",
    },
    levelCard: {
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      border: "2px solid rgba(251, 191, 36, 0.3)",
      borderRadius: "12px",
      padding: "16px",
      color: "white",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
    },
    levelHeader: {
      display: "flex",
      alignItems: "center",
      gap: "16px",
      marginBottom: "12px",
    },
    levelBadge: {
      background: "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
      borderRadius: "10px",
      padding: "12px 16px",
      textAlign: "center",
      minWidth: "70px",
      boxShadow: "0 4px 12px rgba(251, 191, 36, 0.3)",
    },
    levelText: {
      fontSize: "clamp(18px, 4vw, 24px)",
      fontWeight: "bold",
      color: "#0f172a",
    },
    levelInfo: {
      flex: 1,
    },
    levelTitle: {
      fontSize: "clamp(14px, 3vw, 16px)",
      fontWeight: "700",
      margin: "0 0 4px 0",
      color: "#fbbf24",
    },
    levelProgress: {
      fontSize: "clamp(12px, 2.5vw, 13px)",
      color: "#bfdbfe",
      margin: "0",
    },
    progressBarContainer: {
      width: "100%",
      height: "8px",
      background: "rgba(0,0,0,0.2)",
      borderRadius: "4px",
      overflow: "hidden",
      marginBottom: "6px",
    },
    progressBar: {
      height: "100%",
      background: "linear-gradient(90deg, #06b6d4 0%, #fbbf24 100%)",
      transition: "width 0.3s ease",
    },
    progressText: {
      fontSize: "clamp(10px, 2vw, 11px)",
      color: "#bfdbfe",
      margin: "0",
      textAlign: "right",
    },
    sectionTitle: {
      fontSize: "clamp(14px, 3vw, 16px)",
      fontWeight: "700",
      color: "#06b6d4",
      margin: "0 0 12px 0",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      borderBottom: "1px solid rgba(6,182,212,0.2)",
      paddingBottom: "8px",
    },
    statGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
      gap: "12px",
      marginBottom: "16px",
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
      fontSize: "clamp(18px, 4vw, 24px)",
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
    medalSection: {
      background: "rgba(6,182,212,0.08)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "8px",
      padding: "12px",
      marginBottom: "12px",
    },
    medalSectionTitle: {
      fontSize: "clamp(11px, 2vw, 12px)",
      color: "#06b6d4",
      fontWeight: "600",
      margin: "0 0 8px 0",
      textTransform: "uppercase",
    },
    medalRow: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "8px",
    },
    medalCard: {
      background: "rgba(6,182,212,0.1)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "6px",
      padding: "8px",
      textAlign: "center",
      color: "white",
    },
    medalEmoji: {
      fontSize: "clamp(16px, 3vw, 20px)",
      marginBottom: "4px",
    },
    medalCount: {
      fontSize: "clamp(14px, 3vw, 16px)",
      fontWeight: "bold",
      color: "#fbbf24",
      margin: "0",
    },
    medalLabel: {
      fontSize: "clamp(9px, 2vw, 10px)",
      color: "#bfdbfe",
      margin: "2px 0 0 0",
      textTransform: "uppercase",
    },
    tableHeader: {
      display: "grid",
      gridTemplateColumns: "1fr 0.8fr 1fr",
      gap: "8px",
      padding: "10px 12px",
      background: "rgba(6,182,212,0.1)",
      borderRadius: "6px 6px 0 0",
      borderBottom: "1px solid rgba(6,182,212,0.3)",
      fontWeight: "600",
      fontSize: "clamp(10px, 2vw, 11px)",
      color: "#06b6d4",
      alignItems: "center",
    },
    tableBody: {
      display: "flex",
      flexDirection: "column",
      gap: "1px",
    },
    tableRow: {
      display: "grid",
      gridTemplateColumns: "1fr 0.8fr 1fr",
      gap: "8px",
      padding: "10px 12px",
      background: "linear-gradient(135deg, rgba(30, 58, 138, 0.6) 0%, rgba(124, 58, 237, 0.3) 100%)",
      border: "1px solid rgba(6,182,212,0.15)",
      borderRadius: "6px",
      alignItems: "center",
      fontSize: "clamp(10px, 2vw, 12px)",
      color: "#bfdbfe",
    },
    colScore: {
      fontWeight: "600",
      color: "#fbbf24",
    },
    colLevel: {
      textAlign: "center",
      fontWeight: "600",
    },
    colCorrect: {
      textAlign: "center",
    },
    emptyState: {
      textAlign: "center",
      color: "#06b6d4",
      padding: "30px 16px",
      fontSize: "clamp(13px, 3vw, 14px)",
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
  };

  if (!userId) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>🎖️ MY ACHIEVEMENTS</h1>
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
            ← Menu
          </button>
        </div>
        <div style={styles.loadingState}>
          ❌ Error: userId not available
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* HEADER - STICKY */}
      <div style={styles.header}>
        <h1 style={styles.title}>🎖️ MY ACHIEVEMENTS</h1>
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
          ← Menu
        </button>
      </div>

      {/* CONTENT */}
      <div style={styles.contentContainer}>
        {loading ? (
          <div style={styles.loadingState}>Loading achievements...</div>
        ) : (
          <>
            {/* USER LEVEL */}
            <div style={styles.section}>
              <div style={styles.levelCard}>
                <div style={styles.levelHeader}>
                  <div style={styles.levelBadge}>
                    <span style={styles.levelText}>{stats.userLevel}</span>
                  </div>
                  <div style={styles.levelInfo}>
                    <p style={styles.levelTitle}>{stats.levelName}</p>
                    <p style={styles.levelProgress}>
                      {stats.wordsMastered} / {stats.wordsNeeded} Words
                    </p>
                  </div>
                </div>
                <div style={styles.progressBarContainer}>
                  <div
                    style={{
                      ...styles.progressBar,
                      width: `${Math.min(stats.levelProgress, 100)}%`,
                    }}
                  ></div>
                </div>
                <p style={styles.progressText}>
                  {Math.round(Math.min(stats.levelProgress, 100))}% to next level
                </p>
              </div>
            </div>

            {/* STATISTICS */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>📊 Your Statistics</h2>
              <div style={styles.statGrid}>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.totalGames}</p>
                  <p style={styles.statLabel}>Games Played</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.totalPoints.toLocaleString()}</p>
                  <p style={styles.statLabel}>Total Points</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.bestScore}</p>
                  <p style={styles.statLabel}>Best Score</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.bestLevel}</p>
                  <p style={styles.statLabel}>Best Level</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.maxCorrectAnswers}</p>
                  <p style={styles.statLabel}>Max Correct</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.wordsMastered}</p>
                  <p style={styles.statLabel}>Words Mastered</p>
                </div>
              </div>
            </div>

            {/* TOP RESULTS */}
            {topResults.length > 0 && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>🏆 Top Results</h2>
                <div style={styles.tableHeader}>
                  <div>Score</div>
                  <div style={{ textAlign: "center" }}>Level</div>
                  <div style={{ textAlign: "center" }}>Correct</div>
                </div>
                <div style={styles.tableBody}>
                  {topResults.map((result, index) => (
                    <div key={index} style={styles.tableRow}>
                      <div style={styles.colScore}>{result.score}</div>
                      <div style={styles.colLevel}>{result.level}</div>
                      <div style={styles.colCorrect}>
                        {result.correctAnswers}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MEDALS */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>🥇 Medals Earned</h2>

              {/* Weekly Medals */}
              <div style={styles.medalSection}>
                <p style={styles.medalSectionTitle}>📅 Weekly Medals</p>
                <div style={styles.medalRow}>
                  <div style={styles.medalCard}>
                    <div style={styles.medalEmoji}>🥇</div>
                    <p style={styles.medalCount}>{stats.totalWeeklyGold}</p>
                    <p style={styles.medalLabel}>Gold</p>
                  </div>
                  <div style={styles.medalCard}>
                    <div style={styles.medalEmoji}>🥈</div>
                    <p style={styles.medalCount}>{stats.totalWeeklySilver}</p>
                    <p style={styles.medalLabel}>Silver</p>
                  </div>
                  <div style={styles.medalCard}>
                    <div style={styles.medalEmoji}>🥉</div>
                    <p style={styles.medalCount}>{stats.totalWeeklyBronze}</p>
                    <p style={styles.medalLabel}>Bronze</p>
                  </div>
                </div>
              </div>

              {/* Monthly Medals */}
              <div style={styles.medalSection}>
                <p style={styles.medalSectionTitle}>📆 Monthly Medals</p>
                <div style={styles.medalRow}>
                  <div style={styles.medalCard}>
                    <div style={styles.medalEmoji}>🥇</div>
                    <p style={styles.medalCount}>{stats.totalMonthlyGold}</p>
                    <p style={styles.medalLabel}>Gold</p>
                  </div>
                  <div style={styles.medalCard}>
                    <div style={styles.medalEmoji}>🥈</div>
                    <p style={styles.medalCount}>{stats.totalMonthlySilver}</p>
                    <p style={styles.medalLabel}>Silver</p>
                  </div>
                  <div style={styles.medalCard}>
                    <div style={styles.medalEmoji}>🥉</div>
                    <p style={styles.medalCount}>{stats.totalMonthlyBronze}</p>
                    <p style={styles.medalLabel}>Bronze</p>
                  </div>
                </div>
              </div>
            </div>

            {topResults.length === 0 && !loading && (
              <div style={styles.emptyState}>
                <p>No game sessions yet. Start playing to see your results! 🎮</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Achievements;
