import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";


function Leaderboard({ onUserClick, goBack }) {
  const [activeTab, setActiveTab] = useState("allTime");
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [medals, setMedals] = useState({});
  const [usernames, setUsernames] = useState({});
  const [userLevels, setUserLevels] = useState({});
  const [userMasteredCounts, setUserMasteredCounts] = useState({});
  const [medalLeaderboard, setMedalLeaderboard] = useState([]);
  const [medalType, setMedalType] = useState("weekly"); // weekly or monthly


  // ============================================================================
  // EFFECT: Fetch on mount and tab change ONLY
  // ============================================================================
  useEffect(() => {
    if (activeTab === "medals") {
      fetchMedalLeaderboard();
    } else {
      fetchLeaderboard();
      fetchMedals();
      fetchUserLevels();
      fetchUserMasteredCounts();
    }
  }, [activeTab, medalType]);


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
  // FUNCTION: Fetch user mastered word counts
  // ============================================================================
  const fetchUserMasteredCounts = async () => {
    try {
      const { data: progressData } = await supabase
        .from("user_progress")
        .select("user_id, mastered");

      const masteredCounts = {};
      progressData?.forEach((progress) => {
        if (!masteredCounts[progress.user_id]) {
          masteredCounts[progress.user_id] = 0;
        }
        if (progress.mastered) {
          masteredCounts[progress.user_id]++;
        }
      });

      setUserMasteredCounts(masteredCounts);
    } catch (error) {
      console.error("Error fetching mastered counts:", error);
    }
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
      const userIds = [...new Set(progressData?.map((p) => p.user_id) || [])];


      userIds.forEach((userId) => {
        const wordsMastered = progressData?.filter(
          (p) => p.user_id === userId && p.mastered
        ).length || 0;
        levelMap[userId] = calculateLevel(wordsMastered);
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
  // FUNCTION: Fetch medal leaderboard
  // ============================================================================
  const fetchMedalLeaderboard = async () => {
    setLoading(true);
    try {
      const table = medalType === "weekly" ? "weekly_medals" : "monthly_medals";


      const { data: medalData, error } = await supabase
        .from(table)
        .select("user_id, medal_type");


      if (error) throw error;


      const medalCounts = {};
      medalData?.forEach((medal) => {
        if (!medalCounts[medal.user_id]) {
          medalCounts[medal.user_id] = { gold: 0, silver: 0, bronze: 0 };
        }
        medalCounts[medal.user_id][medal.medal_type]++;
      });


      const userIds = Object.keys(medalCounts);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("user_id", userIds);


      const usernamesMap = {};
      profilesData?.forEach((profile) => {
        usernamesMap[profile.user_id] = profile.username;
      });


      const combined = userIds
        .map((userId) => {
          const counts = medalCounts[userId];
          const totalScore = counts.gold * 3 + counts.silver * 2 + counts.bronze;
          return {
            user_id: userId,
            username: usernamesMap[userId] || `Player ${userId.slice(0, 8).toUpperCase()}`,
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


  // ============================================================================
  // FUNCTION: Get today start (00:00 CET) - ISO string for UTC comparison
  // ============================================================================
  const getTodayStart = () => {
    const now = new Date();
    // Create date at local midnight
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    // Adjust to CET (UTC+1, or UTC+2 in DST) and convert to ISO
    // For simplicity: get UTC timestamp of local midnight in CET context
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00+00:00`;
  };


  // ============================================================================
  // FUNCTION: Get week start (Monday 00:00 CET)
  // ============================================================================
  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - daysToSubtract);
    
    const year = weekStartDate.getFullYear();
    const month = String(weekStartDate.getMonth() + 1).padStart(2, '0');
    const day = String(weekStartDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00+00:00`;
  };


  // ============================================================================
  // FUNCTION: Get month start (1st day 00:00 CET)
  // ============================================================================
  const getMonthStart = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01T00:00:00+00:00`;
  };


  // ============================================================================
  // FUNCTION: Fetch leaderboard data
  // ============================================================================
  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let query = supabase.from("sessions").select("*");


      // Apply date filtering based on active tab
      if (activeTab === "today") {
        const todayStart = getTodayStart();
        console.log(`[Today] Filter from: ${todayStart}`);
        query = query.gte("created_at", todayStart);
      } else if (activeTab === "thisWeek") {
        const weekStart = getWeekStart();
        console.log(`[Week] Filter from: ${weekStart}`);
        query = query.gte("created_at", weekStart);
      } else if (activeTab === "thisMonth") {
        const monthStart = getMonthStart();
        console.log(`[Month] Filter from: ${monthStart}`);
        query = query.gte("created_at", monthStart);
      }


      const { data, error } = await query.order("score", {
        ascending: false,
      });


      if (error) throw error;

      console.log(`[${activeTab}] Found ${data?.length || 0} sessions`);


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
      margin: "12px 0 16px 0",
      textAlign: "center",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    tabsContainer: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
      gap: "8px",
      marginBottom: "20px",
      maxWidth: "700px",
      margin: "0 auto 20px auto",
    },
    tab: (isActive) => ({
      padding: "9px 12px",
      fontSize: "clamp(10px, 2.3vw, 12px)",
      fontWeight: "600",
      border: isActive ? "none" : "1px solid rgba(6,182,212,0.2)",
      borderRadius: "6px",
      cursor: "pointer",
      background: isActive
        ? "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)"
        : "rgba(6,182,212,0.08)",
      color: isActive ? "white" : "#06b6d4",
      transition: "all 0.3s ease",
      boxShadow: isActive ? "0 2px 8px rgba(6,182,212,0.3)" : "none",
      whiteSpace: "nowrap",
    }),
    medalTypeContainer: {
      display: "flex",
      gap: "8px",
      justifyContent: "center",
      marginBottom: "16px",
    },
    medalTypeButton: (isActive) => ({
      padding: "8px 16px",
      fontSize: "clamp(10px, 2.3vw, 12px)",
      fontWeight: "600",
      border: isActive ? "none" : "1px solid rgba(251, 191, 36, 0.3)",
      borderRadius: "6px",
      cursor: "pointer",
      background: isActive
        ? "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)"
        : "rgba(251, 191, 36, 0.1)",
      color: isActive ? "#0f172a" : "#fbbf24",
      transition: "all 0.3s ease",
      boxShadow: isActive ? "0 2px 8px rgba(251, 191, 36, 0.3)" : "none",
      whiteSpace: "nowrap",
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
      display: "grid",
      gridTemplateColumns: "45px 1fr auto",
      alignItems: "center",
      gap: "12px",
    },
    rank: {
      fontSize: "clamp(20px, 4vw, 28px)",
      fontWeight: "bold",
      textAlign: "center",
      color: "#fbbf24",
    },
    userInfo: {
      color: "white",
      minWidth: "0",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    },
    username: {
      fontSize: "clamp(13px, 3vw, 15px)",
      fontWeight: "700",
      margin: "0",
      color: "#f0f9ff",
      cursor: "pointer",
      transition: "color 0.2s",
      textDecoration: "underline",
      textDecorationColor: "rgba(6,182,212,0.3)",
    },
    levelBadge: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
      borderRadius: "6px",
      padding: "4px 10px",
      fontSize: "clamp(10px, 2vw, 12px)",
      fontWeight: "700",
      color: "#0f172a",
      minWidth: "42px",
      textAlign: "center",
      boxShadow: "0 2px 6px rgba(251, 191, 36, 0.3)",
      width: "fit-content",
    },
    stats: {
      fontSize: "clamp(9px, 2vw, 10px)",
      color: "#bfdbfe",
      margin: "0",
      display: "flex",
      gap: "14px",
      flexWrap: "wrap",
    },
    scoreSection: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "8px",
      minWidth: "80px",
    },
    score: {
      fontSize: "clamp(16px, 3vw, 20px)",
      fontWeight: "bold",
      color: "#fbbf24",
      textAlign: "right",
    },
    masteredBadge: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(34, 197, 94, 0.2)",
      border: "1px solid rgba(34, 197, 94, 0.5)",
      borderRadius: "6px",
      padding: "4px 8px",
      fontSize: "clamp(9px, 2vw, 10px)",
      fontWeight: "600",
      color: "#86efac",
      minWidth: "50px",
      textAlign: "center",
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
      fontSize: "clamp(8px, 2vw, 9px)",
      color: "#06b6d4",
      fontWeight: "600",
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
      fontSize: "clamp(12px, 2vw, 14px)",
    },
    medalEmoji: {
      fontSize: "clamp(18px, 3vw, 24px)",
    },
    medalScore: {
      fontSize: "clamp(14px, 3vw, 18px)",
      fontWeight: "bold",
      color: "#fbbf24",
      minWidth: "40px",
      textAlign: "center",
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
        {activeTab !== "medals" && (
          <p style={styles.subtitle}>
            {activeTab === "allTime"
              ? "All-Time Champions"
              : activeTab === "today"
              ? "Today's Top Performers"
              : activeTab === "thisWeek"
              ? "This Week's Stars"
              : activeTab === "thisMonth"
              ? "This Month's Heroes"
              : "Highest Scores"}
          </p>
        )}


        <div style={styles.tabsContainer}>
          <button
            style={styles.tab(activeTab === "today")}
            onClick={() => setActiveTab("today")}
          >
            📌 Today
          </button>
          <button
            style={styles.tab(activeTab === "thisWeek")}
            onClick={() => setActiveTab("thisWeek")}
          >
            📅 Week
          </button>
          <button
            style={styles.tab(activeTab === "thisMonth")}
            onClick={() => setActiveTab("thisMonth")}
          >
            📆 Month
          </button>
          <button
            style={styles.tab(activeTab === "allTime")}
            onClick={() => setActiveTab("allTime")}
          >
            ⭐ All Time
          </button>
          <button
            style={styles.tab(activeTab === "bestScore")}
            onClick={() => setActiveTab("bestScore")}
          >
            ⚡ Best
          </button>
          <button
            style={styles.tab(activeTab === "medals")}
            onClick={() => setActiveTab("medals")}
          >
            🏅 Medals
          </button>
        </div>


        {/* MEDALS SUB-TABS */}
        {activeTab === "medals" && (
          <>
            <p style={styles.subtitle}>Medal Champions</p>
            <div style={styles.medalTypeContainer}>
              <button
                style={styles.medalTypeButton(medalType === "weekly")}
                onClick={() => setMedalType("weekly")}
              >
                📅 Weekly
              </button>
              <button
                style={styles.medalTypeButton(medalType === "monthly")}
                onClick={() => setMedalType("monthly")}
              >
                📆 Monthly
              </button>
            </div>
          </>
        )}


        {loading ? (
          <div style={styles.loadingState}>Loading leaderboard...</div>
        ) : activeTab === "medals" ? (
          // MEDALS VIEW
          medalLeaderboard.length === 0 ? (
            <div style={styles.emptyState}>
              No medals awarded yet. Keep playing! 🎮
            </div>
          ) : (
            <div style={styles.listContainer}>
              {medalLeaderboard.map((entry, index) => (
                <div
                  key={entry.user_id}
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
                        onUserClick(entry.user_id, entry.username);
                      }}
                    >
                      {entry.username}
                    </h3>
                    <div style={styles.medalRow}>
                      {entry.gold > 0 && (
                        <div style={styles.medalItem}>
                          <span style={styles.medalEmoji}>🥇</span>
                          <span style={styles.medalScore}>{entry.gold}</span>
                        </div>
                      )}
                      {entry.silver > 0 && (
                        <div style={styles.medalItem}>
                          <span style={styles.medalEmoji}>🥈</span>
                          <span style={styles.medalScore}>{entry.silver}</span>
                        </div>
                      )}
                      {entry.bronze > 0 && (
                        <div style={styles.medalItem}>
                          <span style={styles.medalEmoji}>🥉</span>
                          <span style={styles.medalScore}>{entry.bronze}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={styles.score}>{entry.totalScore}</div>
                </div>
              ))}
            </div>
          )
        ) : leaderboard.length === 0 ? (
          // SCORES VIEW - EMPTY
          <div style={styles.emptyState}>
            No scores yet. Be the first to play! 🎮
          </div>
        ) : (
          // SCORES VIEW
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
              const masteredCount = userMasteredCounts[entry.user_id] || 0;
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
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <div style={styles.levelBadge}>{userLevel}</div>
                      <div style={styles.masteredBadge}>
                        📚 {masteredCount}
                      </div>
                    </div>
                    <p style={styles.stats}>
                      <span>📈 Level {entry.bestLevel}</span>
                      <span>🎮 {entry.sessionsPlayed} sessions</span>
                    </p>
                  </div>


                  <div style={styles.scoreSection}>
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