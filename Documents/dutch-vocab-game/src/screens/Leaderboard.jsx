import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Leaderboard({ onUserClick, goBack }) {
  const [activeTab, setActiveTab] = useState("allTime");
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [medals, setMedals] = useState({});
  const [usernames, setUsernames] = useState({});

  useEffect(() => {
    // Fetch immediatamente quando il tab cambia
    fetchLeaderboard();
    fetchMedals();

    // Auto-refresh ogni 10 secondi (meno invasivo)
    const interval = setInterval(() => {
      fetchLeaderboard();
      fetchMedals();
    }, 10000);

    // Refresh quando la pagina diventa visibile (user torna dal Play)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchLeaderboard();
        fetchMedals();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeTab]);

  const fetchMedals = async () => {
    try {
      const { data: weeklyMedals, error: weeklyError } = await supabase
        .from("weekly_medals")
        .select("user_id, medal_type");

      const { data: monthlyMedals, error: monthlyError } = await supabase
        .from("monthly_medals")
        .select("user_id, medal_type");

      if (!weeklyError && !monthlyError) {
        const medalCounts = {};
        [...(weeklyMedals || []), ...(monthlyMedals || [])].forEach((medal) => {
          if (!medalCounts[medal.user_id]) {
            medalCounts[medal.user_id] = { gold: 0, silver: 0, bronze: 0 };
          }
          medalCounts[medal.user_id][medal.medal_type]++;
        });
        setMedals(medalCounts);
      }
    } catch (error) {
      console.error("Error fetching medals:", error);
    }
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("sessions")
        .select("*")
        .order("score", { ascending: false });

      if (activeTab === "thisWeek") {
        const weekStart = getWeekStart();
        query = query.gte("created_at", weekStart.toISOString());
      } else if (activeTab === "thisMonth") {
        const monthStart = getMonthStart();
        query = query.gte("created_at", monthStart.toISOString());
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      // Group by user_id and calculate stats
      const userStats = {};
      data?.forEach((session) => {
        const userId = session.user_id;
        if (!userStats[userId]) {
          userStats[userId] = {
            user_id: userId,
            totalScore: 0,
            sessionsPlayed: 0,
            bestLevel: 0,
            highestScore: 0,
          };
        }
        userStats[userId].totalScore += session.score;
        userStats[userId].sessionsPlayed += 1;
        userStats[userId].bestLevel = Math.max(
          userStats[userId].bestLevel,
          session.level || 0
        );
        userStats[userId].highestScore = Math.max(
          userStats[userId].highestScore,
          session.score
        );
      });

      // Convert to array and sort by total score
      const leaderboardData = Object.values(userStats)
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10);

      // Fetch usernames for all users from PROFILES table
      const userIds = leaderboardData.map(entry => entry.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("user_id", userIds);

      const usernamesMap = {};
      profilesData?.forEach((profile) => {
        usernamesMap[profile.user_id] = profile.username;
      });
      setUsernames(usernamesMap);

      console.log("Leaderboard data:", leaderboardData);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToSubtract);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  const getMonthStart = () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    return monthStart;
  };

  const getMedalEmoji = (rank) => {
    if (rank === 0) return "🥇";
    if (rank === 1) return "🥈";
    if (rank === 2) return "🥉";
    return `#${rank + 1}`;
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
        ? "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)"
        : "rgba(255,255,255,0.1)",
      color: "white",
      transition: "all 0.3s ease",
      boxShadow: isActive ? "0 4px 15px rgba(6,182,212,0.4)" : "none",
    }),
    listContainer: {
      maxWidth: "700px",
      margin: "0 auto",
    },
    card: {
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "12px",
      padding: "20px",
      marginBottom: "16px",
      cursor: "pointer",
      transition: "all 0.3s ease",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
      display: "flex",
      alignItems: "center",
      gap: "20px",
    },
    rank: {
      fontSize: "32px",
      fontWeight: "bold",
      minWidth: "60px",
      textAlign: "center",
      color: "#06b6d4",
    },
    userInfo: {
      flex: 1,
      color: "white",
    },
    username: {
      fontSize: "18px",
      fontWeight: "700",
      margin: "0 0 8px 0",
      color: "#f0f9ff",
    },
    stats: {
      fontSize: "13px",
      color: "#bfdbfe",
      margin: "0",
      display: "flex",
      gap: "16px",
      flexWrap: "wrap",
    },
    score: {
      fontSize: "24px",
      fontWeight: "bold",
      color: "#fbbf24",
      minWidth: "100px",
      textAlign: "right",
    },
    medalContainer: {
      display: "flex",
      gap: "8px",
      alignItems: "center",
      marginLeft: "10px",
    },
    medal: {
      fontSize: "18px",
      display: "flex",
      alignItems: "center",
      gap: "4px",
    },
    medalCount: {
      fontSize: "12px",
      color: "#06b6d4",
      fontWeight: "600",
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
      border: "1px solid #06b6d4",
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
        <h1 style={styles.title}>🏆 LEADERBOARD</h1>
        <p style={styles.subtitle}>
          {activeTab === "allTime"
            ? "All-Time Champions"
            : activeTab === "thisWeek"
            ? "This Week's Stars"
            : "This Month's Heroes"}
        </p>
      </div>

      <div style={styles.tabsContainer}>
        <button
          style={styles.tab(activeTab === "allTime")}
          onClick={() => setActiveTab("allTime")}
        >
          ⭐ All Time
        </button>
        <button
          style={styles.tab(activeTab === "thisWeek")}
          onClick={() => setActiveTab("thisWeek")}
        >
          📅 This Week
        </button>
        <button
          style={styles.tab(activeTab === "thisMonth")}
          onClick={() => setActiveTab("thisMonth")}
        >
          📆 This Month
        </button>
      </div>

      <div style={styles.listContainer}>
        {loading ? (
          <div style={styles.emptyState}>Loading leaderboard...</div>
        ) : leaderboard.length === 0 ? (
          <div style={styles.emptyState}>
            No scores yet. Be the first to play! 🎮
          </div>
        ) : (
          leaderboard.map((entry, index) => {
            const userMedals = medals[entry.user_id] || {
              gold: 0,
              silver: 0,
              bronze: 0,
            };
            const username = usernames[entry.user_id] || `Player ${entry.user_id.slice(0, 8).toUpperCase()}`;

            return (
              <div
                key={index}
                style={styles.card}
                onClick={() =>
                  onUserClick(
                    entry.user_id,
                    username
                  )
                }
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
                <div style={styles.rank}>{getMedalEmoji(index)}</div>

                <div style={styles.userInfo}>
                  <h3 style={styles.username}>
                    {username}
                  </h3>
                  <p style={styles.stats}>
                    <span>📊 Score: {entry.totalScore?.toLocaleString()}</span>
                    <span>📈 Level: {entry.bestLevel}</span>
                    <span>🎮 Sessions: {entry.sessionsPlayed}</span>
                  </p>
                </div>

                <div style={styles.score}>
                  {entry.totalScore?.toLocaleString()}
                </div>

                {(userMedals.gold > 0 ||
                  userMedals.silver > 0 ||
                  userMedals.bronze > 0) && (
                  <div style={styles.medalContainer}>
                    {userMedals.gold > 0 && (
                      <div style={styles.medal}>
                        <span>🥇</span>
                        <span style={styles.medalCount}>
                          {userMedals.gold}
                        </span>
                      </div>
                    )}
                    {userMedals.silver > 0 && (
                      <div style={styles.medal}>
                        <span>🥈</span>
                        <span style={styles.medalCount}>
                          {userMedals.silver}
                        </span>
                      </div>
                    )}
                    {userMedals.bronze > 0 && (
                      <div style={styles.medal}>
                        <span>🥉</span>
                        <span style={styles.medalCount}>
                          {userMedals.bronze}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
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

export default Leaderboard;
