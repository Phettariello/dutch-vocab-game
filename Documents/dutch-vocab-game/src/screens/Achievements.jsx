import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Achievements({ goBack, userId }) {
  const [stats, setStats] = useState({
    totalGames: 0,
    bestScore: 0,
    totalPoints: 0,
    bestLevel: 0,
    averageScore: 0,
    totalWeeklyGold: 0,
    totalWeeklySilver: 0,
    totalWeeklyBronze: 0,
    totalMonthlyGold: 0,
    totalMonthlySilver: 0,
    totalMonthlyBronze: 0,
    winRate: 0,
    totalWords: 0,
  });
  const [loading, setLoading] = useState(true);
  const [medalHistory, setMedalHistory] = useState([]);

  useEffect(() => {
    if (userId) {
      fetchAchievements();
    }
  }, [userId]);

  const fetchAchievements = async () => {
    setLoading(true);
    try {
      const { data: sessions } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (sessions && sessions.length > 0) {
        const bestScore = Math.max(...sessions.map((s) => s.score || 0));
        const bestLevel = Math.max(...sessions.map((s) => s.level || 0));
        const totalPoints = sessions.reduce((sum, s) => sum + (s.score || 0), 0);
        const avgScore = Math.round(totalPoints / sessions.length);
        const totalWords = sessions.reduce((sum, s) => sum + (s.total_words || 0), 0);
        const correctWords = sessions.reduce((sum, s) => sum + (s.correct_answers || 0), 0);
        const winRate = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0;

        const { data: weeklyMedals } = await supabase
          .from("weekly_medals")
          .select("medal_type, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        const { data: monthlyMedals } = await supabase
          .from("monthly_medals")
          .select("medal_type, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        let weeklyCount = { gold: 0, silver: 0, bronze: 0 };
        let monthlyCount = { gold: 0, silver: 0, bronze: 0 };

        weeklyMedals?.forEach((m) => {
          weeklyCount[m.medal_type]++;
        });
        monthlyMedals?.forEach((m) => {
          monthlyCount[m.medal_type]++;
        });

        const allMedals = [
          ...(weeklyMedals || []).map((m) => ({
            ...m,
            type: "weekly",
          })),
          ...(monthlyMedals || []).map((m) => ({
            ...m,
            type: "monthly",
          })),
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        setStats({
          totalGames: sessions.length,
          bestScore,
          totalPoints,
          bestLevel,
          averageScore: avgScore,
          totalWeeklyGold: weeklyCount.gold,
          totalWeeklySilver: weeklyCount.silver,
          totalWeeklyBronze: weeklyCount.bronze,
          totalMonthlyGold: monthlyCount.gold,
          totalMonthlySilver: monthlyCount.silver,
          totalMonthlyBronze: monthlyCount.bronze,
          winRate,
          totalWords,
        });

        setMedalHistory(allMedals);
      }
    } catch (error) {
      console.error("Error fetching achievements:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const styles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
      padding: "16px 16px 40px 16px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      paddingTop: "60px",
    },
    header: {
      textAlign: "center",
      color: "white",
      marginBottom: "24px",
    },
    title: {
      fontSize: "clamp(28px, 7vw, 48px)",
      fontWeight: "bold",
      margin: "0 0 8px 0",
      textShadow: "0 2px 10px rgba(0,0,0,0.3)",
    },
    subtitle: {
      fontSize: "clamp(13px, 3vw, 16px)",
      color: "#06b6d4",
      margin: "0",
    },
    backButtonTop: {
      position: "fixed",
      top: "16px",
      right: "16px",
      padding: "10px 16px",
      backgroundColor: "rgba(255,255,255,0.1)",
      color: "white",
      border: "1px solid #06b6d4",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "clamp(12px, 2.5vw, 14px)",
      fontWeight: "600",
      transition: "all 0.3s ease",
      zIndex: 1000,
      backdropFilter: "blur(10px)",
    },
    contentContainer: {
      maxWidth: "900px",
      margin: "0 auto",
    },
    section: {
      marginBottom: "28px",
    },
    sectionTitle: {
      fontSize: "clamp(18px, 4vw, 24px)",
      fontWeight: "700",
      color: "#06b6d4",
      margin: "0 0 16px 0",
      textTransform: "uppercase",
      letterSpacing: "1px",
      borderBottom: "2px solid rgba(6,182,212,0.3)",
      paddingBottom: "8px",
    },
    statGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
      gap: "12px",
      marginBottom: "24px",
    },
    statCard: {
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "12px",
      padding: "16px",
      textAlign: "center",
      color: "white",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
      transition: "all 0.3s ease",
    },
    statCardHighlight: {
      background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
      borderColor: "rgba(251, 191, 36, 0.5)",
    },
    statValue: {
      fontSize: "clamp(24px, 5vw, 36px)",
      fontWeight: "bold",
      color: "#fbbf24",
      margin: "0 0 6px 0",
    },
    statValueHighlight: {
      color: "#78350f",
    },
    statLabel: {
      fontSize: "clamp(11px, 2.5vw, 13px)",
      color: "#bfdbfe",
      margin: "0",
      textTransform: "uppercase",
      fontWeight: "600",
      letterSpacing: "0.5px",
    },
    statLabelHighlight: {
      color: "#78350f",
    },
    medalGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
      gap: "10px",
    },
    medalCard: {
      background: "rgba(6,182,212,0.1)",
      border: "2px solid rgba(6,182,212,0.3)",
      borderRadius: "8px",
      padding: "12px",
      textAlign: "center",
      color: "white",
      transition: "all 0.3s ease",
    },
    medalType: {
      fontSize: "clamp(10px, 2vw, 12px)",
      color: "#06b6d4",
      fontWeight: "600",
      textTransform: "uppercase",
      marginBottom: "6px",
    },
    medalContent: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: "6px",
      fontSize: "clamp(18px, 4vw, 24px)",
      marginBottom: "6px",
    },
    medalCount: {
      fontSize: "clamp(16px, 3vw, 20px)",
      fontWeight: "bold",
      color: "#fbbf24",
    },
    medalLabel: {
      fontSize: "clamp(10px, 2vw, 12px)",
      color: "#bfdbfe",
      margin: "0",
    },
    medalHistory: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    medalHistoryItem: {
      background: "rgba(6,182,212,0.1)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "8px",
      padding: "12px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      color: "white",
    },
    medalHistoryEmoji: {
      fontSize: "clamp(20px, 5vw, 28px)",
      minWidth: "40px",
      textAlign: "center",
    },
    medalHistoryInfo: {
      flex: 1,
    },
    medalHistoryType: {
      fontSize: "clamp(12px, 2.5vw, 14px)",
      fontWeight: "600",
      color: "#06b6d4",
      margin: "0 0 2px 0",
      textTransform: "uppercase",
    },
    medalHistoryDate: {
      fontSize: "clamp(10px, 2vw, 12px)",
      color: "#bfdbfe",
      margin: "0",
    },
    emptyState: {
      textAlign: "center",
      color: "#06b6d4",
      padding: "30px 16px",
      fontSize: "clamp(13px, 3vw, 16px)",
    },
  };

  if (!userId) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>🎖️ MY ACHIEVEMENTS</h1>
        </div>
        <div style={styles.emptyState}>Loading achievements...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <button
        style={styles.backButtonTop}
        onClick={goBack}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(6, 182, 212, 0.2)";
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.1)";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        ← Menu
      </button>

      <div style={styles.header}>
        <h1 style={styles.title}>🎖️ MY ACHIEVEMENTS</h1>
        <p style={styles.subtitle}>Your Gaming Journey</p>
      </div>

      <div style={styles.contentContainer}>
        {loading ? (
          <div style={styles.emptyState}>Loading achievements...</div>
        ) : (
          <>
            {/* STATISTICS */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>📊 Your Statistics</h2>
              <div style={styles.statGrid}>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.totalGames}</p>
                  <p style={styles.statLabel}>Games Played</p>
                </div>
                <div style={{ ...styles.statCard, ...styles.statCardHighlight }}>
                  <p style={{ ...styles.statValue, ...styles.statValueHighlight }}>
                    {stats.totalPoints.toLocaleString()}
                  </p>
                  <p style={{ ...styles.statLabel, ...styles.statLabelHighlight }}>
                    Total Points
                  </p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.bestScore.toLocaleString()}</p>
                  <p style={styles.statLabel}>Best Score</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.bestLevel}</p>
                  <p style={styles.statLabel}>Best Level</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.averageScore.toLocaleString()}</p>
                  <p style={styles.statLabel}>Avg Score</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.winRate}%</p>
                  <p style={styles.statLabel}>Accuracy</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.totalWords}</p>
                  <p style={styles.statLabel}>Words Learned</p>
                </div>
              </div>
            </div>

            {/* MEDALS */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>🥇 Medals Earned</h2>
              <div style={styles.medalGrid}>
                <div style={styles.medalCard}>
                  <div style={styles.medalType}>Weekly</div>
                  <div style={styles.medalContent}>
                    <span>🥇</span>
                    <span style={styles.medalCount}>
                      {stats.totalWeeklyGold}
                    </span>
                  </div>
                  <p style={styles.medalLabel}>Gold</p>
                </div>

                <div style={styles.medalCard}>
                  <div style={styles.medalType}>Weekly</div>
                  <div style={styles.medalContent}>
                    <span>🥈</span>
                    <span style={styles.medalCount}>
                      {stats.totalWeeklySilver}
                    </span>
                  </div>
                  <p style={styles.medalLabel}>Silver</p>
                </div>

                <div style={styles.medalCard}>
                  <div style={styles.medalType}>Weekly</div>
                  <div style={styles.medalContent}>
                    <span>🥉</span>
                    <span style={styles.medalCount}>
                      {stats.totalWeeklyBronze}
                    </span>
                  </div>
                  <p style={styles.medalLabel}>Bronze</p>
                </div>

                <div style={styles.medalCard}>
                  <div style={styles.medalType}>Monthly</div>
                  <div style={styles.medalContent}>
                    <span>🥇</span>
                    <span style={styles.medalCount}>
                      {stats.totalMonthlyGold}
                    </span>
                  </div>
                  <p style={styles.medalLabel}>Gold</p>
                </div>

                <div style={styles.medalCard}>
                  <div style={styles.medalType}>Monthly</div>
                  <div style={styles.medalContent}>
                    <span>🥈</span>
                    <span style={styles.medalCount}>
                      {stats.totalMonthlySilver}
                    </span>
                  </div>
                  <p style={styles.medalLabel}>Silver</p>
                </div>

                <div style={styles.medalCard}>
                  <div style={styles.medalType}>Monthly</div>
                  <div style={styles.medalContent}>
                    <span>🥉</span>
                    <span style={styles.medalCount}>
                      {stats.totalMonthlyBronze}
                    </span>
                  </div>
                  <p style={styles.medalLabel}>Bronze</p>
                </div>
              </div>
            </div>

            {/* MEDAL TIMELINE */}
            {medalHistory.length > 0 && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>📅 Medal Timeline</h2>
                <div style={styles.medalHistory}>
                  {medalHistory.slice(0, 10).map((medal, index) => {
                    const medalEmoji =
                      medal.medal_type === "gold"
                        ? "🥇"
                        : medal.medal_type === "silver"
                        ? "🥈"
                        : "🥉";
                    const medalLabel =
                      medal.medal_type.charAt(0).toUpperCase() +
                      medal.medal_type.slice(1);

                    return (
                      <div key={index} style={styles.medalHistoryItem}>
                        <div style={styles.medalHistoryEmoji}>
                          {medalEmoji}
                        </div>
                        <div style={styles.medalHistoryInfo}>
                          <p style={styles.medalHistoryType}>
                            {medalLabel}{" "}
                            {medal.type === "weekly" ? "Weekly" : "Monthly"}
                          </p>
                          <p style={styles.medalHistoryDate}>
                            {formatDate(medal.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Achievements;
