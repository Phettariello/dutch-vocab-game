import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function userProfile({ userId, username, onClose }) {
  const [userSessions, setUserSessions] = useState([]);
  const [userMedals, setUserMedals] = useState({
    weeklyGold: 0,
    weeklySilver: 0,
    weeklyBronze: 0,
    monthlyGold: 0,
    monthlySilver: 0,
    monthlyBronze: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState({
    bestScore: 0,
    bestLevel: 0,
    totalGames: 0,
    averageScore: 0,
  });

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", userId)
        .order("score", { ascending: false })
        .limit(10);

      if (sessionsError) throw sessionsError;

      setUserSessions(sessions || []);

      if (sessions && sessions.length > 0) {
        const bestScore = Math.max(...sessions.map((s) => s.score || 0));
        const bestLevel = Math.max(...sessions.map((s) => s.level || 0));
        const avgScore = Math.round(
          sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length
        );

        setUserStats({
          bestScore,
          bestLevel,
          totalGames: sessions.length,
          averageScore: avgScore,
        });
      }

      const { data: weeklyMedals } = await supabase
        .from("weekly_medals")
        .select("medal_type")
        .eq("user_id", userId);

      const { data: monthlyMedals } = await supabase
        .from("monthly_medals")
        .select("medal_type")
        .eq("user_id", userId);

      const weeklyCount = { gold: 0, silver: 0, bronze: 0 };
      const monthlyCount = { gold: 0, silver: 0, bronze: 0 };

      weeklyMedals?.forEach((m) => {
        weeklyCount[m.medal_type]++;
      });
      monthlyMedals?.forEach((m) => {
        monthlyCount[m.medal_type]++;
      });

      setUserMedals({
        weeklyGold: weeklyCount.gold,
        weeklySilver: weeklyCount.silver,
        weeklyBronze: weeklyCount.bronze,
        monthlyGold: monthlyCount.gold,
        monthlySilver: monthlyCount.silver,
        monthlyBronze: monthlyCount.bronze,
      });
    } catch (error) {
      console.error("Error fetching user data:", error);
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
    overlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px",
    },
    modal: {
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
      borderRadius: "16px",
      maxWidth: "600px",
      width: "100%",
      maxHeight: "80vh",
      overflow: "auto",
      border: "1px solid rgba(6,182,212,0.3)",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    header: {
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      padding: "40px 30px",
      color: "white",
      borderBottom: "1px solid rgba(6,182,212,0.2)",
      textAlign: "center",
    },
    headerTitle: {
      fontSize: "36px",
      fontWeight: "bold",
      margin: "0 0 10px 0",
    },
    headerSubtitle: {
      fontSize: "14px",
      color: "#06b6d4",
      margin: "0",
    },
    content: {
      padding: "30px",
    },
    sectionTitle: {
      fontSize: "16px",
      fontWeight: "700",
      color: "#06b6d4",
      margin: "30px 0 16px 0",
      textTransform: "uppercase",
      letterSpacing: "1px",
    },
    statGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "12px",
      marginBottom: "30px",
    },
    statCard: {
      background: "rgba(6,182,212,0.1)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "8px",
      padding: "16px",
      textAlign: "center",
      color: "white",
    },
    statValue: {
      fontSize: "28px",
      fontWeight: "bold",
      color: "#fbbf24",
      margin: "0 0 4px 0",
    },
    statLabel: {
      fontSize: "12px",
      color: "#bfdbfe",
      margin: "0",
      textTransform: "uppercase",
    },
    medalRow: {
      display: "flex",
      gap: "20px",
      marginBottom: "20px",
      padding: "12px",
      background: "rgba(6,182,212,0.05)",
      borderRadius: "8px",
      borderLeft: "3px solid #06b6d4",
    },
    medalItem: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    medalEmoji: {
      fontSize: "24px",
    },
    medalCount: {
      fontSize: "18px",
      fontWeight: "bold",
      color: "#fbbf24",
    },
    medalLabel: {
      fontSize: "12px",
      color: "#bfdbfe",
    },
    sessionsList: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    },
    sessionCard: {
      background: "rgba(6,182,212,0.1)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "8px",
      padding: "12px",
      color: "white",
    },
    sessionRank: {
      fontSize: "12px",
      color: "#06b6d4",
      fontWeight: "600",
      marginBottom: "4px",
    },
    sessionScore: {
      fontSize: "18px",
      fontWeight: "bold",
      color: "#fbbf24",
      marginBottom: "4px",
    },
    sessionDate: {
      fontSize: "12px",
      color: "#bfdbfe",
    },
    closeButton: {
      position: "absolute",
      top: "20px",
      right: "20px",
      background: "rgba(255,255,255,0.1)",
      border: "1px solid #06b6d4",
      color: "white",
      width: "40px",
      height: "40px",
      borderRadius: "50%",
      cursor: "pointer",
      fontSize: "20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.3s ease",
    },
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={styles.modal}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <button
          style={styles.closeButton}
          onClick={onClose}
          onMouseEnter={(e) => {
            e.target.style.background = "rgba(255,255,255,0.2)";
          }}
          onMouseLeave={(e) => {
            e.target.style.background = "rgba(255,255,255,0.1)";
          }}
        >
          ✕
        </button>

        <div style={styles.header}>
          <h2 style={styles.headerTitle}>{username}</h2>
          <p style={styles.headerSubtitle}>Player Profile</p>
        </div>

        <div style={styles.content}>
          {loading ? (
            <p style={{ color: "#06b6d4", textAlign: "center" }}>
              Loading profile...
            </p>
          ) : (
            <>
              <h3 style={styles.sectionTitle}>📊 Statistics</h3>
              <div style={styles.statGrid}>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>
                    {userStats.bestScore.toLocaleString()}
                  </p>
                  <p style={styles.statLabel}>Best Score</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{userStats.bestLevel}</p>
                  <p style={styles.statLabel}>Best Level</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>{userStats.totalGames}</p>
                  <p style={styles.statLabel}>Games Played</p>
                </div>
                <div style={styles.statCard}>
                  <p style={styles.statValue}>
                    {userStats.averageScore.toLocaleString()}
                  </p>
                  <p style={styles.statLabel}>Avg Score</p>
                </div>
              </div>

              <h3 style={styles.sectionTitle}>🏅 Achievements</h3>

              <div style={styles.medalRow}>
                <div style={{ color: "#06b6d4", fontSize: "12px", fontWeight: "600" }}>
                  WEEKLY
                </div>
                <div style={styles.medalItem}>
                  <span style={styles.medalEmoji}>🥇</span>
                  <span style={styles.medalCount}>
                    {userMedals.weeklyGold}
                  </span>
                </div>
                <div style={styles.medalItem}>
                  <span style={styles.medalEmoji}>🥈</span>
                  <span style={styles.medalCount}>
                    {userMedals.weeklySilver}
                  </span>
                </div>
                <div style={styles.medalItem}>
                  <span style={styles.medalEmoji}>🥉</span>
                  <span style={styles.medalCount}>
                    {userMedals.weeklyBronze}
                  </span>
                </div>
              </div>

              <div style={styles.medalRow}>
                <div style={{ color: "#06b6d4", fontSize: "12px", fontWeight: "600" }}>
                  MONTHLY
                </div>
                <div style={styles.medalItem}>
                  <span style={styles.medalEmoji}>🥇</span>
                  <span style={styles.medalCount}>
                    {userMedals.monthlyGold}
                  </span>
                </div>
                <div style={styles.medalItem}>
                  <span style={styles.medalEmoji}>🥈</span>
                  <span style={styles.medalCount}>
                    {userMedals.monthlySilver}
                  </span>
                </div>
                <div style={styles.medalItem}>
                  <span style={styles.medalEmoji}>🥉</span>
                  <span style={styles.medalCount}>
                    {userMedals.monthlyBronze}
                  </span>
                </div>
              </div>

              <h3 style={styles.sectionTitle}>🎮 Top 10 Sessions</h3>
              {userSessions.length === 0 ? (
                <p style={{ color: "#06b6d4" }}>No sessions yet.</p>
              ) : (
                <div style={styles.sessionsList}>
                  {userSessions.map((session, index) => (
                    <div key={index} style={styles.sessionCard}>
                      <div style={styles.sessionRank}>#{index + 1}</div>
                      <div style={styles.sessionScore}>
                        {session.score?.toLocaleString()} pts
                      </div>
                      <div style={styles.sessionDate}>
                        📈 Level {session.level} • {formatDate(session.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default userProfile;
