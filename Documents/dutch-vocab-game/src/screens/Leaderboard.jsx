import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Leaderboard({ goBack }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRank, setUserRank] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;

        // Fetch all sessions grouped by user, get best score
        const { data: sessions, error } = await supabase
          .from("sessions")
          .select("user_id, score")
          .order("score", { ascending: false });

        if (error) throw error;

        // Group by user_id and get max score
        const userBestScores = {};
        sessions.forEach((session) => {
          if (!userBestScores[session.user_id] || session.score > userBestScores[session.user_id]) {
            userBestScores[session.user_id] = session.score;
          }
        });

        // Convert to array and sort
        const leaderboardData = Object.entries(userBestScores)
          .map(([uid, score]) => ({
            user_id: uid,
            best_score: score,
          }))
          .sort((a, b) => b.best_score - a.best_score);

        setLeaderboard(leaderboardData);

        // Find user's rank
        if (userId) {
          const rank = leaderboardData.findIndex((entry) => entry.user_id === userId) + 1;
          const userScore = userBestScores[userId] || 0;
          setUserRank({ rank, score: userScore });
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
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h1>Loading Leaderboard...</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h1>🏆 Leaderboard</h1>

      {userRank && (
        <div
          style={{
            backgroundColor: "#fff3cd",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "30px",
            fontSize: "16px",
          }}
        >
          <p>
            <strong>Your Rank:</strong> #{userRank.rank} | <strong>Best Score:</strong> {userRank.score}
          </p>
        </div>
      )}

      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          textAlign: "left",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          padding: "20px",
        }}
      >
        {leaderboard.length > 0 ? (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                <th style={{ padding: "10px", textAlign: "left" }}>Rank</th>
                <th style={{ padding: "10px", textAlign: "left" }}>User ID</th>
                <th style={{ padding: "10px", textAlign: "right" }}>Best Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.slice(0, 20).map((entry, index) => (
                <tr
                  key={entry.user_id}
                  style={{
                    borderBottom: "1px solid #eee",
                    backgroundColor: index % 2 === 0 ? "#fff" : "#f5f5f5",
                  }}
                >
                  <td style={{ padding: "10px" }}>
                    <strong>#{index + 1}</strong>
                  </td>
                  <td style={{ padding: "10px" }}>
                    {entry.user_id.substring(0, 8)}...
                  </td>
                  <td style={{ padding: "10px", textAlign: "right" }}>
                    <strong>{entry.best_score}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No sessions yet. Play a game to appear on the leaderboard!</p>
        )}
      </div>

      <button
        onClick={goBack}
        style={{ marginTop: "30px", padding: "10px 20px", fontSize: "16px" }}
      >
        Back to Menu
      </button>
    </div>
  );
}

export default Leaderboard;
