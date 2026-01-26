import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Leaderboard({ onUserClick, goBack }) {
  const [activeTab, setActiveTab] = useState("allTime");
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [medals, setMedals] = useState({});
  const [usernames, setUsernames] = useState({});
  const [userLevels, setUserLevels] = useState({});

  // ============================================================================
  // EFFECT: Fetch on mount and tab change ONLY
  // ============================================================================
  useEffect(() => {
    fetchLeaderboard();
    fetchMedals();
    fetchUserLevels();
    // NO auto-refresh interval - only fetch on tab change
  }, [activeTab]);

  // ============================================================================
  // FUNCTION: Calculate user level from words mastered
  // ============================================================================
  const calculateLevel = (wordsMastered) => {
    const levels = [
      { code: "A0", min: 0, max: 500 },
      { code: "A1", min: 501, max: 1000 },
      { code: "B1", min: 1001, max: 1500 },
      { code: "B2", min: 1501, max: 2000 },
      { code: "C1", min: 2001, max: 2500 },
      { code: "C2", min: 2501, max: 3000 },
    ];

    for (let level of levels) {
      if (wordsMastered >= level.min && wordsMastered <= level.max) {
        return level.code;
      }
    }
    return "C2";
  };

  // ============================================================================
  // FUNCTION: Fetch user levels
  // ============================================================================
  const fetchUserLevels = async () => {
    try {
      const { data: progressData } = await supabase
        .from("user_progress")
        .select("user_id, mastered");

      const levelMap = {};
      progressData?.forEach((entry) => {
        const wordsMastered = (progressData.filter(
          (p) => p.user_id === entry.user_id && p.mastered
        )).length;
        if (!levelMap[entry.user_id]) {
          levelMap[entry.user_id] = calculateLevel(wordsMastered);
        }
      });
      setUserLevels(levelMap);
    } catch (error) {
      console.error("Error fetching user levels:", error);
    }
  };

  // ============================================================================
  // FUNCTION: Fetch medals
  // ============================================================================
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

  // ============================================================================
  // FUNCTION: Fetch leaderboard data
  // ============================================================================
  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let query = supabase.from("sessions").select("*");

      // Apply date filtering based on active tab
      if (activeTab === "thisWeek") {
        const weekStart = getWeekStart();
        query = query.gte("created_at", weekStart.toISOString());
      } else if (activeTab === "thisMonth") {
        const monthStart = getMonthStart();
        query = query.gte("created_at", monthStart.toISOString());
      }

      const { data, error } = await query.order("score", {
        ascending: false,
      });

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

      // Convert to array and sort based on active tab
      let leaderboardData = Object.values(userStats);

      if (activeTab === "bestScore") {
        leaderboardData.sort(
          (a, b) => b.highestScore - a.highestScore
        );
      } else {
        leaderboardData.sort((a, b) => b.totalScore - a.totalScore);
      }

      leaderboardData = leaderboardData.slice(0, 10);

      // Fetch usernames
      const userIds = leaderboardData.map((entry) => entry.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("user_id", userIds);

      const usernamesMap = {};
      profilesData?.forEach((profile) => {
        usernamesMap[profile.user_id] = profile.username;
      });
      setUsernames(usernamesMap);

      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // FUNCTION: Get week start (Monday 00:00)
  // ============================================================================
  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToSubtract);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  // ============================================================================
  // FUNCTION: Get month start
  // ============================================================================
  const getMonthStart = () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    return monthStart;
  };

  // ============================================================================
  // FUNCTION: Get medal emoji for rank
  // ============================================================================
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
    subtitle: {
      fontSize: "clamp(12px, 2.5vw, 14px)",
      color: "#06b6d4",
      margin: "16px 0 20px 0",
      textAlign: "center",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    tabsContainer: {
      display: "flex",
      gap: "8px",
      justifyContent: "center",
      marginBottom: "24px",
      flexWrap: "wrap",
    },
    tab: (isActive) => ({
      padding: "10px 16px",
      fontSize: "clamp(11px, 2.5vw, 13px)",
      fontWeight: "600",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      background: isActive
        ? "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)"
        : "rgba(6,182,212,0.1)",
      color: isActive ? "white" : "#06b6d4",
      transition: "all 0.3s ease",
      boxShadow: isActive ? "0 4px 12px rgba(6,182,212,0.3)" : "none",
      border: isActive ? "none" : "1px solid rgba(6,182,212,0.2)",
    }),
    listContainer: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    },
    card: {
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "10px",
      padding: "14px",
      cursor: "pointer",
      transition: "all 0.3s ease",
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    rank: {
      fontSize: "clamp(20px, 4vw, 28px)",
      fontWeight: "bold",
      minWidth: "50px",
      textAlign: "center",
      color: "#fbbf24",
    },
    userInfo: {
      flex: 1,
      color: "white",
      minWidth: "0",
    },
    username: {
      fontSize: "clamp(13px, 3vw, 15px)",
      fontWeight: "700",
      margin: "0 0 6px 0",
      color: "#f0f9ff",
      cursor: "pointer",
      transition: "color 0.2s",
      textDecoration: "underline",
      textDecorationColor: "rgba(6,182,212,0.3)",
    },
    stats: {
      fontSize: "clamp(10px, 2vw, 11px)",
      color: "#bfdbfe",
      margin: "0",
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
    },
    score: {
      fontSize: "clamp(16px, 3vw, 20px)",
      fontWeight: "bold",
      color: "#fbbf24",
      minWidth: "70px",
      textAlign: "right",
      flexShrink: 0,
    },
    medalContainer: {
      display: "flex",
      gap: "6px",
      alignItems: "center",
      flexShrink: 0,
    },
    medal: {
      fontSize: "clamp(14px, 3vw, 16px)",
      display: "flex",
      alignItems: "center",
      gap: "2px",
    },
    medalCount: {
      fontSize: "clamp(9px, 2vw, 10px)",
      color: "#06b6d4",
      fontWeight: "600",
    },
    emptyState: {
      textAlign: "center",
      color: "#06b6d4",
      padding: "40px 20px",
      fontSize: "clamp(13px, 3vw, 14px)",
    },
    loadingState: {
      textAlign: "center",
      color: "#06b6d4",
      padding: "40px 20px",
      fontSize: "clamp(14px, 3vw, 16px)",
    },
  };

  return (
    <div style={styles.container}>
      {/* HEADER - STICKY */}
      <div style={styles.header}>
        <h1 style={styles.title}>🏆 LEADERBOARD</h1>
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
        <p style={styles.subtitle}>
          {activeTab === "allTime"
            ? "All-Time Champions"
            : activeTab === "thisWeek"
            ? "This Week's Stars"
            : activeTab === "thisMonth"
            ? "This Month's Heroes"
            : "Highest Scores"}
        </p>

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
          <button
            style={styles.tab(activeTab === "bestScore")}
            onClick={() => setActiveTab("bestScore")}
          >
            ⚡ Best Score
          </button>
        </div>

        {loading ? (
          <div style={styles.loadingState}>Loading leaderboard...</div>
        ) : leaderboard.length === 0 ? (
          <div style={styles.emptyState}>
            No scores yet. Be the first to play! 🎮
          </div>
        ) : (
          <div style={styles.listContainer}>
            {leaderboard.map((entry, index) => {
              const userMedals = medals[entry.user_id] || {
                gold: 0,
                silver: 0,
                bronze: 0,
              };
              const username =
                usernames[entry.user_id] ||
                `Player ${entry.user_id.slice(0, 8).toUpperCase()}`;
              const userLevel = userLevels[entry.user_id] || "A0";
              const displayScore =
                activeTab === "bestScore"
                  ? entry.highestScore
                  : entry.totalScore;

              return (
                <div
                  key={index}
                  style={styles.card}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 15px rgba(6,182,212,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow =
                      "0 2px 8px rgba(0,0,0,0.2)";
                  }}
                >
                  <div style={styles.rank}>{getMedalEmoji(index)}</div>

                  <div style={styles.userInfo}>
                    <h3
                      style={styles.username}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUserClick(entry.user_id, username);
                      }}
                    >
                      {username}
                    </h3>
                    <p style={styles.stats}>
                      <span>📊 {userLevel}</span>
                      <span>📈 Level {entry.bestLevel}</span>
                    </p>
                  </div>

                  <div style={styles.score}>
                    {displayScore?.toLocaleString()}
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Leaderboard;
