import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function MedalLeaderboard({ goBack }) {
  const [activeTab, setActiveTab] = useState("weekly");
  const [medalLeaderboard, setMedalLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMedalLeaderboard();
  }, [activeTab]);

  const fetchMedalLeaderboard = async () => {
    setLoading(true);
    try {
      let table = activeTab === "weekly" ? "weekly_medals" : "monthly_medals";

      const { data: medals, error } = await supabase
        .from(table)
        .select("user_id, medal_type");

      if (error) throw error;

      const medalCounts = {};
      medals.forEach((medal) => {
        if (!medalCounts[medal.user_id]) {
          medalCounts[medal.user_id] = { gold: 0, silver: 0, bronze: 0 };
        }
        medalCounts[medal.user_id][medal.medal_type]++;
      });

      const userIds = Object.keys(medalCounts);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      const combined = userIds
        .map((userId) => {
          const profile = profiles?.find((p) => p.id === userId);
          const counts = medalCounts[userId];
          const totalScore = counts.gold * 3 + counts.silver * 2 + counts.bronze;
          return {
            userId,
            username: profile?.username || "Unknown",
            ...counts,
            totalScore,
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);

      setMedalLeaderboard(combined);
    } catch (error) {
      console.error("Error fetching medal leaderboard:", error);
    } finally {
      setLoading(false);
    }
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
      color: "#fbbf24",
      margin: "0",
    },
    tabsContainer: {
      display: "flex",
      gap: "10px",
      justifyContent: "center",
      marginBottom: "30px",
      flexWrap: "wrap",
    },
    tab: (isActive) => ({
      padding: "12px 24px",
      fontSize: "14px",
      fontWeight: "600",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      background: isActive
        ? "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)"
        : "rgba(255,255,255,0.1)",
      color: isActive ? "#0f172a" : "white",
      transition: "all 0.3s ease",
      boxShadow: isActive ? "0 4px 15px rgba(251,191,36,0.4)" : "none",
    }),
    listContainer: {
      maxWidth: "700px",
      margin: "0 auto",
    },
    card: {
      background: "linear-gradient(135deg, #7c3aed 0%, #1e3a8a 100%)",
      border: "1px solid rgba(251,191,36,0.2)",
      borderRadius: "12px",
      padding: "20px",
      marginBottom: "16px",
      transition: "all 0.3s ease",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
      display: "flex",
      alignItems: "center",
      gap: "20px",
    },
    rank: {
      fontSize: "28px",
      fontWeight: "bold",
      minWidth: "50px",
      textAlign: "center",
      color: "#fbbf24",
    },
    userInfo: {
      flex: 1,
      color: "white",
    },
    username: {
      fontSize: "18px",
      fontWeight: "700",
      margin: "0",
      color: "#f0f9ff",
    },
    medalRow: {
      display: "flex",
      gap: "20px",
      marginTop: "12px",
      alignItems: "center",
    },
    medalItem: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "14px",
    },
    medalEmoji: {
      fontSize: "24px",
    },
    medalCount: {
      fontSize: "18px",
      fontWeight: "bold",
      color: "#fbbf24",
      minWidth: "30px",
      textAlign: "center",
    },
    emptyState: {
      textAlign: "center",
      color: "#06b6d4",
      padding: "40px 20px",
      fontSize: "16px",
    },
    backButton: {
      display: "inline-block",
      marginTop: "40px",
      padding: "12px 24px",
      backgroundColor: "rgba(255,255,255,0.1)",
      color: "white",
      border: "1px solid #fbbf24",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
      transition: "all 0.3s ease",
      textAlign: "center",
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🏅 MEDAL CHAMPIONS</h1>
        <p style={styles.subtitle}>
          {activeTab === "weekly"
            ? "Weekly Medal Standings"
            : "Monthly Medal Standings"}
        </p>
      </div>

      <div style={styles.tabsContainer}>
        <button
          style={styles.tab(activeTab === "weekly")}
          onClick={() => setActiveTab("weekly")}
        >
          📅 Weekly
        </button>
        <button
          style={styles.tab(activeTab === "monthly")}
          onClick={() => setActiveTab("monthly")}
        >
          📆 Monthly
        </button>
      </div>

      <div style={styles.listContainer}>
        {loading ? (
          <div style={styles.emptyState}>Loading medals...</div>
        ) : medalLeaderboard.length === 0 ? (
          <div style={styles.emptyState}>
            No medals awarded yet. Keep playing! 🎮
          </div>
        ) : (
          medalLeaderboard.map((entry, index) => (
            <div key={entry.userId} style={styles.card}>
              <div style={styles.rank}>#{index + 1}</div>

              <div style={styles.userInfo}>
                <h3 style={styles.username}>{entry.username}</h3>
                <div style={styles.medalRow}>
                  <div style={styles.medalItem}>
                    <span style={styles.medalEmoji}>🥇</span>
                    <span style={styles.medalCount}>{entry.gold}</span>
                  </div>
                  <div style={styles.medalItem}>
                    <span style={styles.medalEmoji}>🥈</span>
                    <span style={styles.medalCount}>{entry.silver}</span>
                  </div>
                  <div style={styles.medalItem}>
                    <span style={styles.medalEmoji}>🥉</span>
                    <span style={styles.medalCount}>{entry.bronze}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
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

export default MedalLeaderboard;
