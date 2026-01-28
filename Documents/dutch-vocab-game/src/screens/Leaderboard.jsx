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
  const [medalType, setMedalType] = useState("daily");


  // ============================================================================
  // EFFECT: Fetch on mount and tab change
  // ============================================================================
  useEffect(() => {
    if (activeTab === "medals") {
      fetchMedalLeaderboard();
    } else if (activeTab === "words") {
      fetchWordsLeaderboard();
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
  // FUNCTION: Fetch medals (weekly + monthly)
  // ============================================================================
  const fetchMedals = async () => {
    try {
      const { data: weeklyMedals } = await supabase
        .from("weekly_medals")
        .select("user_id, medal_type");

      const { data: monthlyMedals } = await supabase
        .from("monthly_medals")
        .select("user_id, medal_type");

      const medalCounts = {};
      [...(weeklyMedals || []), ...(monthlyMedals || [])].forEach((medal) => {
        if (!medalCounts[medal.user_id]) {
          medalCounts[medal.user_id] = { gold: 0, silver: 0, bronze: 0 };
        }
        medalCounts[medal.user_id][medal.medal_type]++;
      });
      setMedals(medalCounts);
    } catch (error) {
      console.error("Error fetching medals:", error);
    }
  };


  // ============================================================================
  // FUNCTION: Fetch words leaderboard
  // ============================================================================
  const fetchWordsLeaderboard = async () => {
    setLoading(true);
    try {
      const { data: progressData } = await supabase
        .from("user_progress")
        .select("user_id, mastered");

      const wordsCounts = {};
      progressData?.forEach((progress) => {
        if (!wordsCounts[progress.user_id]) {
          wordsCounts[progress.user_id] = 0;
        }
        if (progress.mastered) {
          wordsCounts[progress.user_id]++;
        }
      });

      let leaderboardData = Object.entries(wordsCounts).map(([userId, count]) => ({
        user_id: userId,
        wordsMastered: count,
      }));

      leaderboardData.sort((a, b) => b.wordsMastered - a.wordsMastered);
      leaderboardData = leaderboardData.slice(0, 10);

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
      console.error("Error fetching words leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };


  // ============================================================================
  // FUNCTION: Fetch medal leaderboard
  // ============================================================================
  const fetchMedalLeaderboard = async () => {
    setLoading(true);
    try {
      const table = 
        medalType === "daily" ? "daily_medals" :
        medalType === "weekly" ? "weekly_medals" :
        "monthly_medals";

      const { data: medalData } = await supabase
        .from(table)
        .select("user_id, medal_type");

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

      let combined = userIds
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
  // FUNCTION: Get today start
  // ============================================================================
  const getTodayStart = () => {
    const now = new Date();
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
  // FUNCTION: Get month start
  // ============================================================================
  const getMonthStart = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01T00:00:00+00:00`;
  };


  // ============================================================================
  // FUNCTION: Fetch leaderboard data (scores)
  // ============================================================================
  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let query = supabase.from("sessions").select("*");

      if (activeTab === "today") {
        const todayStart = getTodayStart();
        query = query.gte("created_at", todayStart);
      } else if (activeTab === "thisWeek") {
        const weekStart = getWeekStart();
        query = query.gte("created_at", weekStart);
      } else if (activeTab === "thisMonth") {
        const monthStart = getMonthStart();
        query = query.gte("created_at", monthStart);
      }

      const { data } = await query.order("score", { ascending: false });

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

      let leaderboardData = Object.values(userStats);

      if (activeTab === "bestScore") {
        leaderboardData.sort((a, b) => b.highestScore - a.highestScore);
      } else {
        leaderboardData.sort((a, b) => b.totalScore - a.totalScore);
      }

      leaderboardData = leaderboardData.slice(0, 10);

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
      maxWidth: "1200px",
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
    tabsContainerRow1: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "8px",
      marginBottom: "12px",
      maxWidth: "600px",
      margin: "0 auto 12px auto",
    },
    tabsContainerRow2: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "8px",
      marginBottom: "20px",
      maxWidth: "700px",
      margin: "0 auto 20px auto",
    },
    tab: (isActive) => ({
      padding: "10px 12px",
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
      flexWrap: "wrap",
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
    tableHeader: {
      display: "grid",
      gap: "12px",
      padding: "12px 14px",
      background: "rgba(6,182,212,0.1)",
      borderRadius: "8px 8px 0 0",
      borderBottom: "1px solid rgba(6,182,212,0.2)",
      fontWeight: "600",
      fontSize: "clamp(10px, 2vw, 11px)",
      color: "#06b6d4",
      marginBottom: "4px",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    tableRow: {
      display: "grid",
      gap: "12px",
      padding: "12px 14px",
      background: "linear-gradient(135deg, rgba(30, 58, 138, 0.5) 0%, rgba(124, 58, 237, 0.2) 100%)",
      border: "1px solid rgba(6,182,212,0.15)",
      borderRadius: "6px",
      marginBottom: "6px",
      fontSize: "clamp(11px, 2vw, 13px)",
      color: "white",
      transition: "all 0.2s ease",
      cursor: "pointer",
    },
    rowHover: {
      transform: "translateY(-1px)",
      boxShadow: "0 4px 12px rgba(6,182,212,0.2)",
    },
    rank: {
      fontSize: "clamp(16px, 3vw, 20px)",
      fontWeight: "bold",
      color: "#fbbf24",
      minWidth: "35px",
    },
    levelBadge: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
      borderRadius: "6px",
      padding: "4px 10px",
      fontSize: "clamp(10px, 2vw, 11px)",
      fontWeight: "700",
      color: "#0f172a",
      minWidth: "36px",
      textAlign: "center",
      boxShadow: "0 2px 6px rgba(251, 191, 36, 0.3)",
    },
    username: {
      fontWeight: "700",
      color: "#f0f9ff",
      cursor: "pointer",
      textDecoration: "underline",
      textDecorationColor: "rgba(6,182,212,0.3)",
      margin: 0,
      fontSize: "clamp(11px, 2.5vw, 13px)",
    },
    statValue: {
      fontSize: "clamp(12px, 2.5vw, 13px)",
      fontWeight: "bold",
      color: "#fbbf24",
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


  // ============================================================================
  // RENDER: Header + Rows per tab type
  // ============================================================================
  const renderScoresTable = (headerColumns) => {
    return (
      <>
        <div style={{
          ...styles.tableHeader,
          gridTemplateColumns: headerColumns.map(() => "1fr").join(" "),
        }}>
          {headerColumns.map((col) => (
            <div key={col}>{col}</div>
          ))}
        </div>

        {leaderboard.map((entry, index) => {
          const username =
            usernames[entry.user_id] ||
            `Player ${entry.user_id.slice(0, 8).toUpperCase()}`;
          const userLevel = userLevels[entry.user_id] || "A0";
          const masteredCount = userMasteredCounts[entry.user_id] || 0;
          const displayScore =
            activeTab === "bestScore" ? entry.highestScore : entry.totalScore;

          return (
            <div
              key={index}
              style={{
                ...styles.tableRow,
                gridTemplateColumns: headerColumns.map(() => "1fr").join(" "),
              }}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, styles.rowHover);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={styles.rank}>{getMedalEmoji(index)}</div>
              <div style={styles.levelBadge}>{userLevel}</div>
              <h3
                style={styles.username}
                onClick={(e) => {
                  e.stopPropagation();
                  onUserClick(entry.user_id, username);
                }}
              >
                {username}
              </h3>
              {activeTab === "words" && (
                <div style={styles.statValue}>{entry.wordsMastered} 📚</div>
              )}
              {activeTab !== "words" && (
                <>
                  <div style={styles.statValue}>{masteredCount} 📚</div>
                  <div style={styles.statValue}>
                    {displayScore?.toLocaleString()} ⭐
                  </div>
                </>
              )}
            </div>
          );
        })}
      </>
    );
  };


  const renderMedalsTable = () => {
    const headerColumns = ["Rank", "Player", "🥇", "🥈", "🥉", "Score"];
    
    return (
      <>
        <div style={{
          ...styles.tableHeader,
          gridTemplateColumns: "35px 1fr 50px 50px 50px 70px",
        }}>
          {headerColumns.map((col) => (
            <div key={col}>{col}</div>
          ))}
        </div>

        {medalLeaderboard.map((entry, index) => (
          <div
            key={entry.user_id}
            style={{
              ...styles.tableRow,
              gridTemplateColumns: "35px 1fr 50px 50px 50px 70px",
            }}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, styles.rowHover);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={styles.rank}>{getMedalEmoji(index)}</div>
            <h3
              style={styles.username}
              onClick={(e) => {
                e.stopPropagation();
                onUserClick(entry.user_id, entry.username);
              }}
            >
              {entry.username}
            </h3>
            <div style={{...styles.statValue, textAlign: "center"}}>
              {entry.gold > 0 ? entry.gold : "—"}
            </div>
            <div style={{...styles.statValue, textAlign: "center"}}>
              {entry.silver > 0 ? entry.silver : "—"}
            </div>
            <div style={{...styles.statValue, textAlign: "center"}}>
              {entry.bronze > 0 ? entry.bronze : "—"}
            </div>
            <div style={{...styles.statValue, textAlign: "center"}}>
              {entry.totalScore}
            </div>
          </div>
        ))}
      </>
    );
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
              ? "🌟 All-Time Champions"
              : activeTab === "today"
              ? "📌 Today's Top Performers"
              : activeTab === "thisWeek"
              ? "📅 This Week's Stars"
              : activeTab === "thisMonth"
              ? "📆 This Month's Heroes"
              : activeTab === "bestScore"
              ? "⚡ Highest Scores"
              : "📚 Words Masters"}
          </p>
        )}


        {/* ROW 1: Today, Week, Month */}
        <div style={styles.tabsContainerRow1}>
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
        </div>


        {/* ROW 2: All Time, Best, Words, Medals */}
        <div style={styles.tabsContainerRow2}>
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
            style={styles.tab(activeTab === "words")}
            onClick={() => setActiveTab("words")}
          >
            📚 Words
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
            <p style={styles.subtitle}>🏅 Medal Champions</p>
            <div style={styles.medalTypeContainer}>
              <button
                style={styles.medalTypeButton(medalType === "daily")}
                onClick={() => setMedalType("daily")}
              >
                ☀️ Daily
              </button>
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
          <div style={styles.loadingState}>⏳ Loading leaderboard...</div>
        ) : activeTab === "medals" ? (
          medalLeaderboard.length === 0 ? (
            <div style={styles.emptyState}>
              No medals awarded yet. Keep playing! 🎮
            </div>
          ) : (
            renderMedalsTable()
          )
        ) : leaderboard.length === 0 ? (
          <div style={styles.emptyState}>
            No scores yet. Be the first to play! 🎮
          </div>
        ) : activeTab === "words" ? (
          renderScoresTable(["", "", "Player", "Words"])
        ) : (
          renderScoresTable(["", "", "Player", "Words", "Score"])
        )}
      </div>
    </div>
  );
}


export default Leaderboard;