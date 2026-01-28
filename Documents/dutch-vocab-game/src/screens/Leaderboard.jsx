import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";


function Leaderboard({ onUserClick, goBack }) {
  const [activeTab, setActiveTab] = useState("allTime");
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usernames, setUsernames] = useState({});
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
    }
  }, [activeTab, medalType]);


  // ============================================================================
  // FUNCTION: Get date range start
  // ============================================================================
  const getTodayStart = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00+00:00`;
  };

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

  const getMonthStart = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01T00:00:00+00:00`;
  };


  // ============================================================================
  // FUNCTION: Award medals to top 3 users
  // ============================================================================
  const awardMedals = async (table, topUsers) => {
    if (topUsers.length === 0) return;

    const medals = [
      { user_id: topUsers[0]?.user_id, medal_type: "gold" },
      { user_id: topUsers[1]?.user_id, medal_type: "silver" },
      { user_id: topUsers[2]?.user_id, medal_type: "bronze" },
    ].filter((m) => m.user_id);

    for (const medal of medals) {
      const { data: existing } = await supabase
        .from(table)
        .select("id")
        .eq("user_id", medal.user_id)
        .eq("medal_type", medal.medal_type)
        .single();

      if (!existing) {
        await supabase.from(table).insert({
          user_id: medal.user_id,
          medal_type: medal.medal_type,
          awarded_at: new Date().toISOString(),
        });
      }
    }
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

      // Award medals for today/week/month
      if (activeTab === "today") {
        const topToday = leaderboardData.slice(0, 3);
        await awardMedals("daily_medals", topToday);
      } else if (activeTab === "thisWeek") {
        const topWeek = leaderboardData.slice(0, 3);
        await awardMedals("weekly_medals", topWeek);
      } else if (activeTab === "thisMonth") {
        const topMonth = leaderboardData.slice(0, 3);
        await awardMedals("monthly_medals", topMonth);
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
  // FUNCTION: Fetch words leaderboard
  // ============================================================================
  const fetchWordsLeaderboard = async () => {
    setLoading(true);
    try {
      const { data: progressData } = await supabase
        .from("user_progress")
        .select("user_id, mastered");

      const { data: wordsData } = await supabase
        .from("words")
        .select("id");

      const totalWords = wordsData?.length || 0;

      const wordsCounts = {};
      progressData?.forEach((progress) => {
        if (!wordsCounts[progress.user_id]) {
          wordsCounts[progress.user_id] = 0;
        }
        if (progress.mastered) {
          wordsCounts[progress.user_id]++;
        }
      });

      let leaderboardData = Object.entries(wordsCounts).map(([userId, masteredCount]) => ({
        user_id: userId,
        wordsMastered: masteredCount,
        totalWords: totalWords,
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
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "8px",
      marginBottom: "20px",
      maxWidth: "800px",
      margin: "0 auto 20px auto",
    },
    tabsContainerRow2: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "8px",
      marginBottom: "20px",
      maxWidth: "600px",
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
      fontSize: "clamp(14px, 2.5vw, 16px)",
      fontWeight: "bold",
      color: "#fbbf24",
      minWidth: "20px",
      textAlign: "center",
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
    medalValue: {
      fontSize: "clamp(11px, 2.3vw, 12px)",
      fontWeight: "bold",
      color: "#fbbf24",
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


  // ============================================================================
  // RENDER: Scores Table (All Time, Today, Week, Month)
  // ============================================================================
  const renderScoresTable = (headerColumns, gridTemplate) => {
    return (
      <>
        <div style={{
          ...styles.tableHeader,
          gridTemplateColumns: gridTemplate,
        }}>
          {headerColumns.map((col) => (
            <div key={col}>{col}</div>
          ))}
        </div>

        {leaderboard.map((entry, index) => {
          const username =
            usernames[entry.user_id] ||
            `Player ${entry.user_id.slice(0, 8).toUpperCase()}`;
          const displayScore =
            activeTab === "bestScore" ? entry.highestScore : entry.totalScore;

          return (
            <div
              key={index}
              style={{
                ...styles.tableRow,
                gridTemplateColumns: gridTemplate,
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
                  onUserClick(entry.user_id, username);
                }}
              >
                {username}
              </h3>
              {activeTab === "words" && (
                <>
                  <div style={styles.statValue}>{entry.wordsMastered}</div>
                  <div style={styles.statValue}>{entry.totalWords}</div>
                </>
              )}
              {activeTab === "bestScore" && (
                <>
                  <div style={styles.statValue}>{entry.maxCorrectAnswers || "—"}</div>
                  <div style={styles.statValue}>{entry.bestLevel || "—"}</div>
                  <div style={styles.statValue}>{displayScore?.toLocaleString()}</div>
                </>
              )}
              {(activeTab === "allTime" || activeTab === "today" || activeTab === "thisWeek" || activeTab === "thisMonth") && activeTab !== "bestScore" && (
                <div style={styles.statValue}>{displayScore?.toLocaleString()}</div>
              )}
            </div>
          );
        })}
      </>
    );
  };


  // ============================================================================
  // RENDER: Medals Table
  // ============================================================================
  const renderMedalsTable = () => {
    const headerColumns = ["", "Player", "🥇", "🥈", "🥉", "Score"];
    
    return (
      <>
        <div style={{
          ...styles.tableHeader,
          gridTemplateColumns: "20px 1fr 40px 40px 40px 60px",
        }}>
          {headerColumns.map((col) => (
            <div key={col} style={col !== "" && col !== "Player" ? { textAlign: "center" } : {}}>{col}</div>
          ))}
        </div>

        {medalLeaderboard.map((entry, index) => (
          <div
            key={entry.user_id}
            style={{
              ...styles.tableRow,
              gridTemplateColumns: "20px 1fr 40px 40px 40px 60px",
            }}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, styles.rowHover);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{...styles.rank, minWidth: "20px"}}>{getMedalEmoji(index)}</div>
            <h3
              style={styles.username}
              onClick={(e) => {
                e.stopPropagation();
                onUserClick(entry.user_id, entry.username);
              }}
            >
              {entry.username}
            </h3>
            <div style={styles.medalValue}>
              {entry.gold > 0 ? entry.gold : "—"}
            </div>
            <div style={styles.medalValue}>
              {entry.silver > 0 ? entry.silver : "—"}
            </div>
            <div style={styles.medalValue}>
              {entry.bronze > 0 ? entry.bronze : "—"}
            </div>
            <div style={{...styles.medalValue, textAlign: "right"}}>
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


        {/* TABS ROW 1: Today, Week, Month, Medals */}
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
          <button
            style={styles.tab(activeTab === "medals")}
            onClick={() => setActiveTab("medals")}
          >
            🏅 Medals
          </button>
        </div>


        {/* TABS ROW 2: All Time, Best, Words */}
        {activeTab !== "medals" && (
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
          </div>
        )}


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
          renderScoresTable(["", "Player", "Mastered", "Total"], "20px 1fr 70px 70px")
        ) : activeTab === "bestScore" ? (
          renderScoresTable(["", "Player", "Correct", "Level", "Best Score"], "20px 1fr 70px 50px 80px")
        ) : (
          renderScoresTable(["", "Player", "Score"], "20px 1fr 80px")
        )}
      </div>
    </div>
  );
}


export default Leaderboard;