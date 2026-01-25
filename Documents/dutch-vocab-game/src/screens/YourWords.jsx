import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function YourWords({ goBack }) {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWords = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user.id;

        const { data: progressData, error: progressError } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", userId);

        if (progressError) throw progressError;

        // Fetch dettagli parole
        const progressWithWords = await Promise.all(
          (progressData || []).map(async (progress) => {
            const { data: word } = await supabase
              .from("words")
              .select("*")
              .eq("id", progress.word_id)
              .single();
            return { ...progress, words: word };
          })
        );

        const withPercentage = (progressWithWords || []).map((p) => {
          const total = p.correct_count + p.incorrect_count;
          const errorPercentage = total > 0 ? (p.incorrect_count / total) * 100 : 0;
          return { ...p, errorPercentage, total };
        });

        withPercentage.sort((a, b) => b.errorPercentage - a.errorPercentage);

        setWords(withPercentage);
      } catch (error) {
        console.error("Error fetching words:", error);
        alert("Failed to load words.");
      } finally {
        setLoading(false);
      }
    };

    fetchWords();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h1>Loading...</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: "50px", maxWidth: "1000px", margin: "0 auto" }}>
      <h1>📖 Your Words</h1>
      <p style={{ fontSize: "16px", color: "#666", marginBottom: "20px" }}>
        Total words: <strong>{words.length}</strong> | Ordered by error rate
      </p>

      {words.length === 0 ? (
        <p style={{ fontSize: "18px", color: "#666" }}>
          No words encountered yet! Start playing to see your statistics.
        </p>
      ) : (
        <div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "20px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0", borderBottom: "2px solid #ddd" }}>
                <th style={{ padding: "12px", textAlign: "left" }}>#</th>
                <th style={{ padding: "12px", textAlign: "left" }}>English</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Dutch</th>
                <th style={{ padding: "12px", textAlign: "center" }}>✅ Correct</th>
                <th style={{ padding: "12px", textAlign: "center" }}>❌ Incorrect</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Error %</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {words.map((progress, index) => {
                const errorColor =
                  progress.errorPercentage > 50
                    ? "#ff6b6b"
                    : progress.errorPercentage > 25
                    ? "#ffa500"
                    : "#4CAF50";

                return (
                  <tr
                    key={progress.id}
                    style={{
                      borderBottom: "1px solid #eee",
                      backgroundColor: index % 2 === 0 ? "#fafafa" : "white",
                    }}
                  >
                    <td style={{ padding: "12px" }}>{index + 1}</td>
                    <td style={{ padding: "12px" }}>
                      <strong>{progress.words.english}</strong>
                    </td>
                    <td style={{ padding: "12px" }}>
                      {progress.words.dutch}
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <span
                        style={{
                          backgroundColor: "#e8f5e9",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontWeight: "bold",
                          color: "#2e7d32",
                        }}
                      >
                        {progress.correct_count}
                      </span>
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <span
                        style={{
                          backgroundColor: "#ffebee",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontWeight: "bold",
                          color: "#c62828",
                        }}
                      >
                        {progress.incorrect_count}
                      </span>
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <span
                        style={{
                          backgroundColor: errorColor,
                          color: "white",
                          padding: "4px 12px",
                          borderRadius: "4px",
                          fontWeight: "bold",
                        }}
                      >
                        {progress.errorPercentage.toFixed(0)}%
                      </span>
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      {progress.mastered ? (
                        <span style={{ color: "#4CAF50", fontWeight: "bold" }}>
                          ✅ Mastered
                        </span>
                      ) : (
                        <span style={{ color: "#FF9800", fontWeight: "bold" }}>
                          ⚠️ Learning
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: "40px" }}>
            <h2>Detailed View</h2>
            {words.slice(0, 10).map((progress, index) => (
              <div
                key={progress.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "15px",
                  marginBottom: "15px",
                  backgroundColor: progress.errorPercentage > 50 ? "#ffebee" : "#f9f9f9",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                    marginBottom: "10px",
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 5px 0" }}>
                      {index + 1}. {progress.words.english}
                    </h3>
                    <p style={{ margin: "5px 0", fontSize: "16px", color: "#333" }}>
                      Dutch: <strong>{progress.words.dutch}</strong>
                    </p>
                  </div>
                  <div
                    style={{
                      backgroundColor:
                        progress.errorPercentage > 50
                          ? "#ff6b6b"
                          : progress.errorPercentage > 25
                          ? "#ffa500"
                          : "#4CAF50",
                      color: "white",
                      padding: "12px 20px",
                      borderRadius: "5px",
                      textAlign: "center",
                      minWidth: "120px",
                    }}
                  >
                    <p style={{ margin: "0", fontSize: "24px", fontWeight: "bold" }}>
                      {progress.errorPercentage.toFixed(0)}%
                    </p>
                    <p style={{ margin: "5px 0 0 0", fontSize: "12px" }}>Error Rate</p>
                  </div>
                </div>

                <div style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
                  <p style={{ margin: "3px 0" }}>
                    Category: <strong>{progress.words.category}</strong> | Difficulty:{" "}
                    <strong>{progress.words.difficulty}/10</strong>
                  </p>
                  <p style={{ margin: "3px 0" }}>
                    ✅ Correct: <strong>{progress.correct_count}</strong> | ❌ Incorrect:{" "}
                    <strong>{progress.incorrect_count}</strong> | Total: <strong>{progress.total}</strong>
                  </p>
                  <p style={{ margin: "3px 0" }}>
                    Status: {progress.mastered ? "✅ MASTERED" : `⚠️ ${progress.correct_count}/10 to master`}
                  </p>
                </div>

                {progress.words.example_nl && (
                  <div
                    style={{
                      backgroundColor: "#f5f5f5",
                      padding: "10px",
                      borderRadius: "5px",
                      fontSize: "13px",
                    }}
                  >
                    <p style={{ margin: "3px 0", fontStyle: "italic" }}>
                      <strong>Dutch:</strong> {progress.words.example_nl}
                    </p>
                    {progress.words.example_en && (
                      <p style={{ margin: "3px 0", color: "#666" }}>
                        <strong>English:</strong> {progress.words.example_en}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={goBack}
        style={{
          marginTop: "30px",
          padding: "10px 20px",
          backgroundColor: "#2196F3",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        Back to Menu
      </button>
    </div>
  );
}

export default YourWords;
