import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Leaderboard({ goBack }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRank, setUserRank] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          setCurrentUser(userData.user.id);
        }

        // Fetch all sessions grouped by user
        const { data: sessions } = await supabase
          .from("sessions")
          .select("user_id, score, level");

        if (sessions && sessions.length > 0) {
          // Group by user and calculate stats
          const userStats = {};
          sessions.forEach((session) => {
            if (!userStats[session.user_id]) {
              userStats[session.user_id] = {
                user_id: session.user_id,
                totalScore: 0,
                sessionsPlayed: 0,
                bestLevel: 0,
              };
            }
            userStats[session.user_id].totalScore += session.score;
            userStats[session.user_id].sessionsPlayed += 1;
            userStats[session.user_id].bestLevel = Math.max(
              userStats[session.user_id].bestLevel,
              session.level || 0
            );
          });

          // Convert to array and sort by score
          const sortedLeaderboard = Object.values(userStats)
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, 50); // Top 50

          setLeaderboard(sortedLeaderboard);

          // Find current user rank
          const rank = sortedLeaderboard.findIndex(
            (u) => u.user_id === userData?.user?.id
          );
          if (rank !== -1) {
            setUserRank(rank + 1);
          }
        }
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <h1>Loading...</h1>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🏆 Leaderboard</h1>
        <p style={styles.subtitle}>Top Players</p>
      </div>

      {currentUser && userRank && (
        <div style={styles.userRankCard}>
          <p style={styles.userRankText}>
            Your Rank: <strong>#{userRank}</strong>
          </p>
        </div>
      )}

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={styles.cellRank}>#</th>
              <th style={styles.cellName}>Player</th>
              <th style={styles.cellScore}>Score</th>
              <th style={styles.cellLevel}>Best Level</th>
              <th style={styles.cellSessions}>Sessions</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((user, index) => (
              <tr
                key={user.user_id}
                style={{
                  ...styles.row,
                  backgroundColor:
                    user.user_id === currentUser ? "#f0f7ff" : "white",
                }}
              >
                <td style={styles.cellRank}>
                  <span style={styles.rankMedal}>
                    {index === 0
                      ? "🥇"
                      : index === 1
                      ? "🥈"
                      : index === 2
                      ? "🥉"
                      : `${index + 1}`}
                  </span>
                </td>
                <td style={styles.cellName}>
                  Player {user.user_id.slice(0, 8).toUpperCase()}
                </td>
                <td style={styles.cellScore}>
                  <strong>{user.totalScore}</strong>
                </td>
                <td style={styles.cellLevel}>{user.bestLevel}</td>
                <td style={styles.cellSessions}>{user.sessionsPlayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={goBack} style={styles.backButton}>
        ← Back to Home
      </button>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    padding: "40px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    textAlign: "center",
    marginBottom: "40px",
  },
  title: {
    fontSize: "48px",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0 0 10px 0",
  },
  subtitle: {
    fontSize: "16px",
    color: "#64748b",
    margin: "0",
    fontWeight: "400",
  },
  userRankCard: {
    background: "white",
    border: "2px solid #3b82f6",
    borderRadius: "12px",
    padding: "20px",
    maxWidth: "600px",
    margin: "0 auto 30px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(59, 130, 246, 0.1)",
  },
  userRankText: {
    fontSize: "18px",
    color: "#1e293b",
    margin: "0",
    fontWeight: "600",
  },
  tableContainer: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    overflow: "hidden",
    maxWidth: "800px",
    margin: "0 auto 40px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  headerRow: {
    background: "#f8f9fa",
    borderBottom: "2px solid #e5e7eb",
  },
  row: {
    borderBottom: "1px solid #e5e7eb",
    transition: "background-color 0.3s ease",
  },
  cellRank: {
    padding: "16px",
    textAlign: "center",
    fontWeight: "600",
    color: "#1e293b",
    width: "60px",
  },
  cellName: {
    padding: "16px",
    textAlign: "left",
    color: "#475569",
    fontWeight: "500",
  },
  cellScore: {
    padding: "16px",
    textAlign: "center",
    color: "#1e293b",
    fontWeight: "600",
  },
  cellLevel: {
    padding: "16px",
    textAlign: "center",
    color: "#475569",
  },
  cellSessions: {
    padding: "16px",
    textAlign: "center",
    color: "#475569",
  },
  rankMedal: {
    fontSize: "20px",
    marginRight: "4px",
  },
  backButton: {
    display: "block",
    margin: "0 auto",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: "600",
    background: "#f3f4f6",
    color: "#64748b",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};

export default Leaderboard;
