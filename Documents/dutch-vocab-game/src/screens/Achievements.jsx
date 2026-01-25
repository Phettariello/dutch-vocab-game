import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Achievements({ goBack, userId }) {
  const [stats, setStats] = useState({
    totalGames: 0,
    bestScore: 0,
    bestLevel: 0,
    averageScore: 0,
    totalWeeklyGold: 0,
    totalWeeklySilver: 0,
    totalWeeklyBronze: 0,
    totalMonthlyGold: 0,
    totalMonthlySilver: 0,
    totalMonthlyBronze: 0,
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
        .eq("user_id", userId);

      if (sessions && sessions.length > 0) {
        const bestScore = Math.max(...sessions.map((s) => s.score || 0));
        const bestLevel = Math.max(...sessions.map((s) => s.level || 0));
        const avgScore = Math.round(
          sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length
        );

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
        ].sort(
          (a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );

        setStats({
          totalGames: sessions.length,
          bestScore,
          bestLevel,
          averageScore: avgScore,
          totalWeeklyGold: weeklyCount.gold,
          totalWeeklySilver: weeklyCount.silver,
          totalWeeklyBronze: weeklyCount.bronze,
          totalMonthlyGold: monthlyCount.gold,
          totalMonthlySilver: monthlyCount.silver,
          totalMonthlyBronze: monthlyCount.bronze,
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
      padding: "40px 20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    header: {
      textAlign: "center",
      color: "white",
      marginBottom: "40px",
    },
    title: {
      fontSize: "48px",
      fontWeight: "bold",
      margin: "0 0 10px 0",
      textShadow: "0 2px 10px rgba(0,0,0,0.3)",
    },
    subtitle: {
      fontSize: "16px",
      color: "#06b6d4",
      margin: "0",
    },
    contentContainer: {
      maxWidth: "900px",
      margin: "0 auto",
    },
    section: {
      marginBottom: "40px",
    },
    sectionTitle: {
      fontSize: "24px",
      fontWeight: "700",
      color: "#06b6d4",
      margin: "0 0 20px 0",
      textTransform: "uppercase",
      letterSpacing: "1px",
      borderBottom: "2px solid rgba(6,182,212,0.3)",
      paddingBottom: "10px",
    },
    statGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "16px",
      marginBottom: "30px",
    },
    statCard: {
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "12px",
      padding: "24px",
      textAlign: "center",
      color: "white",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
      transition: "all 0.3s ease",
    },
    statValue: {
      fontSize: "36px",
      fontWeight: "bold",
      color: "#fbbf24",
      margin: "0 0 8px 0",
    },
    statLabel: {
      fontSize: "13px",
      color: "#bfdbfe",
      margin: "0",
      textTransform: "uppercase",
      fontWeight: "600",
      letterSpacing: "0.5px",
    },
    medalGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "12px",
    },
    medalCard: {
      background: "rgba(6,182,212,0.1)",
      border: "2px solid rgba(6,182,212,0.3)",
      borderRadius: "8px",
      padding: "16px",
      textAlign: "center",
      color: "white",
    },
    medalType: {
      fontSize: "12px",
      color: "#06b6d4",
      fontWeight: "600",
      textTransform: "uppercase",
      marginBottom: "8px",
    },
    medalContent: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: "8px",
      fontSize: "24px",
      marginBottom: "8px",
    },
    medalCount: {
      fontSize: "20px",
      fontWeight: "bold",
      color: "#fbbf24",
    },
    medalLabel: {
      fontSize: "12px",
      color: "#bfdbfe",
      margin: "0",
    },
    medalHistory: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    },
    medalHistoryItem: {
      background: "rgba(6,182,212,0.1)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "8px",
      padding: "16px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      color: "white",
    },
    medalHistoryEmoji: {
      fontSize: "28px",
      minWidth: "40px",
      textAlign: "center",
    },
    medalHistoryInfo: {
      flex: 1,
    },
    medalHistoryType: {
      fontSize: "14px",
      fontWeight: "600",
      color: "#06b6d4",
      margin: "0 0 4px 0",
      textTransform: "uppercase",
    },
    medalHistoryDate: {
      fontSize: "12px",
      color: "#bfdbfe",
      margin: "0",
    },
    backButton: {
      display: "inline-block",
      marginTop: "40px",
      padding: "12px 24px",
      backgroundColor: "rgba(255,255,255,0.1)",
      color: "white",
      border: "1px solid #06b6d4",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
      transition: "all 0.3s ease",
      textAlign: "center",
    },
    emptyState: {
      textAlign: "center",
      color: "#06b6d4",
      padding: "40px 20px",
      fontSize: "16px",
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
      <div style={styles.header}>
        <h1 style={styles.title}>🎖️ MY ACHIEVEMENTS</h1>
        <p style={styles.subtitle}>Your Gaming Journey</p>
      </div>

      <div style={styles.contentContainer}>
        {loading ? (
          <div style={styles.emptyState}>Loading achievements...</div>
        ) : (
          <>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>📊 Your Statistics</h2>
              <div style={styles.statGrid}>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.totalGames}</p>
                  <p style={styles.statLabel}>Games Played</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>
                    {stats.bestScore.toLocaleString()}
                  </p>
                  <p style={styles.statLabel}>Best Score</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{stats.bestLevel}</p>
                  <p style={styles.statLabel}>Best Level</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>
                    {stats.averageScore.toLocaleString()}
                  </p>
                  <p style={styles.statLabel}>Average Score</p>
                </div>
              </div>
            </div>

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

      <div style={{ textAlign: "center" }}>
        <button style={styles.backButton} onClick={goBack}>
          ← Back to Menu
        </button>
      </div>
    </div>
  );
}

export default Achievements;
