import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Review({ goBack }) {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    const fetchWordsToReview = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;

        if (!userId) {
          alert("You must be logged in to use Review Mode.");
          goBack();
          return;
        }

        // Get user's non-mastered words
        const { data: userProgress, error: progressError } = await supabase
          .from("user_progress")
          .select("word_id, correct_count, incorrect_count, mastered")
          .eq("user_id", userId)
          .eq("mastered", false);

        if (progressError) throw progressError;

        if (userProgress.length === 0) {
          setWords([]);
          setLoading(false);
          return;
        }

        const wordIds = userProgress.map((p) => p.word_id);

        // Get word details
        const { data: wordDetails, error: wordsError } = await supabase
          .from("words")
          .select("*")
          .in("id", wordIds);

        if (wordsError) throw wordsError;

        // Merge word details with progress
        const wordsWithProgress = wordDetails.map((word) => {
          const progress = userProgress.find((p) => p.word_id === word.id);
          const masteryPercent =
            progress.correct_count + progress.incorrect_count > 0
              ? Math.round(
                  (progress.correct_count /
                    (progress.correct_count + progress.incorrect_count)) *
                    100
                )
              : 0;

          return {
            ...word,
            correct_count: progress.correct_count,
            incorrect_count: progress.incorrect_count,
            masteryPercent,
          };
        });

        // Sort by mastery percent (ascending - show hardest first)
        const sorted = wordsWithProgress.sort(
          (a, b) => a.masteryPercent - b.masteryPercent
        );

        setWords(sorted);
      } catch (error) {
        console.error("Error fetching review words:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWordsToReview();
  }, []);

  const normalize = (str) => {
    return str
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, "")
      .replace(/ï/g, "i")
      .replace(/ü/g, "u")
      .replace(/ö/g, "o")
      .replace(/\s+/g, " ");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const userAnswer = answer.toLowerCase().trim();

    const correctFull = words[currentIndex].dutch.toLowerCase().trim();
    const correctBase = correctFull
      .split(",")[0]
      .replace(/^(de |het |een |het )/, "")
      .trim();

    const normalizedAnswer = normalize(userAnswer);
    const normalizedFull = normalize(correctFull);
    const normalizedBase = normalize(correctBase);
    const normalizedWithDe = normalize(`de ${correctBase}`);
    const normalizedWithHet = normalize(`het ${correctBase}`);

    const isCorrect =
      normalizedAnswer === normalizedFull ||
      normalizedAnswer === normalizedBase ||
      normalizedAnswer === normalizedWithDe ||
      normalizedAnswer === normalizedWithHet;

    if (isCorrect) {
      setFeedback("✅ Correct!");
    } else {
      setFeedback(`❌ Wrong! The answer is '${words[currentIndex].dutch}'.`);
    }

    setShowAnswer(true);
  };

  const nextWord = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswer("");
      setFeedback("");
      setShowAnswer(false);
    }
  };

  const previousWord = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setAnswer("");
      setFeedback("");
      setShowAnswer(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <h1>Loading Review Words...</h1>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <h1>🎉 No words to review!</h1>
        <p>All your words are mastered. Great job!</p>
        <button onClick={goBack} style={styles.secondaryButton}>
          Back to Menu
        </button>
      </div>
    );
  }

  const currentWord = words[currentIndex];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>📚 Review Mode</h1>
        </div>
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${((currentIndex + 1) / words.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statItem}>
          <span>📊</span> Progress: <strong>{currentIndex + 1}/{words.length}</strong>
        </div>
        <div style={styles.statItem}>
          <span>📈</span> Mastery: <strong>{currentWord.masteryPercent}%</strong>
        </div>
        <div style={styles.statItem}>
          <span>✅</span> Correct: <strong>{currentWord.correct_count}</strong>
        </div>
        <div style={styles.statItem}>
          <span>❌</span> Incorrect: <strong>{currentWord.incorrect_count}</strong>
        </div>
      </div>

      <div style={styles.masteryBarContainer}>
        <div style={styles.masteryBar}>
          <div
            style={{
              width: `${currentWord.masteryPercent}%`,
              height: "100%",
              background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
              transition: "width 0.3s ease",
              borderRadius: "4px",
            }}
          />
        </div>
      </div>

      <div style={styles.questionContainer}>
        <p style={styles.questionLabel}>
          Question {currentIndex + 1}/{words.length}
        </p>
        <h2 style={styles.questionText}>Translate to Dutch:</h2>
        <h1 style={styles.wordToTranslate}>{currentWord.english}</h1>
      </div>

      {currentWord.example_nl && (
        <div style={styles.exampleBox}>
          <p style={styles.exampleNL}>
            <strong>🇳🇱</strong> {currentWord.example_nl}
          </p>
          {currentWord.example_en && (
            <p style={styles.exampleEN}>
              <strong>🇬🇧</strong> {currentWord.example_en}
            </p>
          )}
        </div>
      )}

      {!showAnswer ? (
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Enter the translation..."
            style={styles.input}
            autoFocus
          />
          <button type="submit" style={styles.submitButton}>
            Check
          </button>
        </form>
      ) : (
        <div>
          {feedback && (
            <p
              style={{
                ...styles.feedback,
                color: feedback.includes("✅") ? "#10b981" : "#ef4444",
              }}
            >
              {feedback}
            </p>
          )}
          <div style={styles.answerDisplay}>
            <p style={styles.answerLabel}>Correct Answer:</p>
            <p style={styles.answerText}>{currentWord.dutch}</p>
          </div>
          <button
            onClick={nextWord}
            style={{
              ...styles.primaryButton,
              opacity: currentIndex < words.length - 1 ? 1 : 0.5,
              cursor:
                currentIndex < words.length - 1 ? "pointer" : "not-allowed",
            }}
            disabled={currentIndex >= words.length - 1}
          >
            Next Word →
          </button>
        </div>
      )}

      <div style={styles.navigationButtons}>
        <button
          onClick={previousWord}
          disabled={currentIndex === 0}
          style={{
            ...styles.secondaryButton,
            opacity: currentIndex === 0 ? 0.5 : 1,
            cursor: currentIndex === 0 ? "not-allowed" : "pointer",
          }}
        >
          ← Previous
        </button>
        <button onClick={goBack} style={styles.secondaryButton}>
          Back to Menu
        </button>
      </div>
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
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    textAlign: "center",
    marginBottom: "40px",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    maxWidth: "600px",
    margin: "0 auto 20px",
  },
  title: {
    fontSize: "32px",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0",
  },
  progressBar: {
    height: "8px",
    background: "#e5e7eb",
    borderRadius: "10px",
    overflow: "hidden",
    maxWidth: "400px",
    margin: "0 auto",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
    transition: "width 0.3s ease",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "16px",
    maxWidth: "700px",
    margin: "0 auto 30px",
  },
  statItem: {
    padding: "16px",
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "14px",
    color: "#475569",
    fontWeight: "500",
    textAlign: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  masteryBarContainer: {
    maxWidth: "600px",
    margin: "0 auto 30px",
  },
  masteryBar: {
    height: "12px",
    background: "#e5e7eb",
    borderRadius: "6px",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  questionContainer: {
    textAlign: "center",
    marginBottom: "40px",
  },
  questionLabel: {
    fontSize: "14px",
    color: "#64748b",
    margin: "0 0 10px 0",
  },
  questionText: {
    fontSize: "18px",
    color: "#64748b",
    margin: "0 0 15px 0",
    fontWeight: "500",
  },
  wordToTranslate: {
    fontSize: "44px",
    color: "#1e293b",
    margin: "0",
    fontWeight: "700",
  },
  exampleBox: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "20px",
    maxWidth: "600px",
    margin: "0 auto 30px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  exampleNL: {
    fontSize: "14px",
    color: "#475569",
    margin: "0 0 10px 0",
  },
  exampleEN: {
    fontSize: "14px",
    color: "#64748b",
    margin: "0",
  },
  form: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    marginBottom: "30px",
    flexWrap: "wrap",
  },
  input: {
    padding: "12px 16px",
    fontSize: "16px",
    border: "2px solid #e5e7eb",
    borderRadius: "8px",
    width: "300px",
    transition: "all 0.3s ease",
    fontFamily: "inherit",
  },
  submitButton: {
    padding: "12px 32px",
    fontSize: "16px",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
  },
  feedback: {
    fontSize: "18px",
    fontWeight: "600",
    margin: "20px 0",
    minHeight: "30px",
    textAlign: "center",
  },
  answerDisplay: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "24px",
    maxWidth: "600px",
    margin: "20px auto",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  answerLabel: {
    fontSize: "14px",
    color: "#64748b",
    margin: "0 0 10px 0",
    fontWeight: "500",
  },
  answerText: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0",
  },
  primaryButton: {
    padding: "14px 40px",
    fontSize: "16px",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
    transition: "all 0.3s ease",
    display: "block",
    margin: "30px auto",
  },
  secondaryButton: {
    padding: "12px 24px",
    fontSize: "14px",
    background: "#f3f4f6",
    color: "#475569",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontWeight: "500",
  },
  navigationButtons: {
    display: "flex",
    gap: "16px",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: "40px",
  },
};

export default Review;
