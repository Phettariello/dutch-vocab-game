import React, { useState } from "react";
import { supabase } from "../supabaseClient";

function Practice() {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);

  const categories = ["Verbs", "Nouns", "Adjectives", "Phrases"];
  const difficulties = ["A1", "A2", "B1", "B2"];

  const toggleCategory = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const toggleDifficulty = (difficulty) => {
    setSelectedDifficulties((prev) =>
      prev.includes(difficulty)
        ? prev.filter((d) => d !== difficulty)
        : [...prev, difficulty]
    );
  };

  const handleStartGame = () => {
    if (selectedCategories.length === 0 || selectedDifficulties.length === 0) {
      alert("Please select at least one category and one difficulty.");
      return;
    }
    setGameStarted(true);
  };

  if (gameStarted) {
    return (
      <PracticeGame
        categories={selectedCategories}
        difficulties={selectedDifficulties}
        goBack={() => setGameStarted(false)}
        goBackMenu={() => {
          setGameStarted(false);
          setSelectedCategories([]);
          setSelectedDifficulties([]);
        }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📚 Practice Mode</h1>
      <p style={styles.subtitle}>Select categories and difficulty levels to practice</p>

      <div style={styles.selectionsBox}>
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📂 Categories</h2>
          <div style={styles.buttonGrid}>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                style={{
                  ...styles.selectionButton,
                  ...(selectedCategories.includes(category)
                    ? styles.selectionButtonActive
                    : {}),
                }}
              >
                {category}
                {selectedCategories.includes(category) && " ✓"}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📊 Difficulty</h2>
          <div style={styles.buttonGrid}>
            {difficulties.map((difficulty) => (
              <button
                key={difficulty}
                onClick={() => toggleDifficulty(difficulty)}
                style={{
                  ...styles.selectionButton,
                  ...(selectedDifficulties.includes(difficulty)
                    ? styles.selectionButtonActive
                    : {}),
                }}
              >
                {difficulty}
                {selectedDifficulties.includes(difficulty) && " ✓"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={handleStartGame} style={styles.startButton}>
        🚀 Start Practice
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
  title: {
    fontSize: "40px",
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
    margin: "0 0 15px 0",
  },
  subtitle: {
    fontSize: "16px",
    color: "#64748b",
    textAlign: "center",
    margin: "0 0 40px 0",
  },
  selectionsBox: {
    maxWidth: "800px",
    margin: "0 auto 40px",
    background: "white",
    borderRadius: "16px",
    padding: "40px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    border: "1px solid #e5e7eb",
  },
  section: {
    marginBottom: "40px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#1e293b",
    margin: "0 0 20px 0",
  },
  buttonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "12px",
  },
  selectionButton: {
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: "500",
    background: "#f3f4f6",
    color: "#64748b",
    border: "2px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  selectionButtonActive: {
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "2px solid #3b82f6",
  },
  startButton: {
    display: "block",
    margin: "0 auto",
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
  },
};

function PracticeGame({ categories, difficulties, goBack, goBackMenu }) {
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [practiceStats, setPracticeStats] = useState({ correct: 0, total: 0 });
  const [gameOver, setGameOver] = useState(false);

  React.useEffect(() => {
    const fetchWords = async () => {
      try {
        let query = supabase.from("words").select("*");

        if (categories.length > 0) {
          query = query.in("category", categories);
        }

        if (difficulties.length > 0) {
          query = query.in("difficulty", difficulties);
        }

        const { data, error } = await query.limit(20);

        if (error) throw error;

        const shuffled = data.sort(() => Math.random() - 0.5);
        setWords(shuffled);
      } catch (error) {
        console.error("Error fetching practice words:", error);
        alert("Failed to load words.");
        goBackMenu();
      } finally {
        setLoading(false);
      }
    };

    fetchWords();
  }, []);

  if (loading) {
    return (
      <div style={practiceGameStyles.container}>
        <h1>Loading...</h1>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div style={practiceGameStyles.container}>
        <h1>No words found with those filters</h1>
        <button onClick={goBack} style={practiceGameStyles.backButton}>
          Back to Selection
        </button>
      </div>
    );
  }

  const currentWord = words[currentIndex];

  const handleSubmit = (e) => {
    e.preventDefault();
    const userAnswer = answer.toLowerCase().trim();

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

    const correctFull = currentWord.dutch.toLowerCase().trim();
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
      setPracticeStats((prev) => ({
        correct: prev.correct + 1,
        total: prev.total + 1,
      }));
    } else {
      setFeedback(`❌ Wrong! It's '${currentWord.dutch}'.`);
      setPracticeStats((prev) => ({
        correct: prev.correct,
        total: prev.total + 1,
      }));
    }

    setAnswer("");

    if (currentIndex >= words.length - 1) {
      setTimeout(() => {
        setGameOver(true);
      }, 2000);
    } else {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setFeedback("");
      }, 2000);
    }
  };

  if (gameOver) {
    const percentage = Math.round(
      (practiceStats.correct / practiceStats.total) * 100
    );

    return (
      <div style={practiceGameStyles.gameOverContainer}>
        <h1 style={practiceGameStyles.gameOverTitle}>📚 Practice Complete!</h1>
        <div style={practiceGameStyles.statsBox}>
          <p style={practiceGameStyles.statLine}>
            Correct: <strong>{practiceStats.correct}/{practiceStats.total}</strong>
          </p>
          <p style={practiceGameStyles.statLine}>
            Accuracy: <strong>{percentage}%</strong>
          </p>
        </div>
        <div style={practiceGameStyles.buttonGroup}>
          <button onClick={goBack} style={practiceGameStyles.primaryButton}>
            Back to Selection
          </button>
          <button onClick={goBackMenu} style={practiceGameStyles.secondaryButton}>
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={practiceGameStyles.container}>
      <div style={practiceGameStyles.header}>
        <h1 style={practiceGameStyles.title}>
          Practice Mode - Word {currentIndex + 1}/{words.length}
        </h1>
        <div style={practiceGameStyles.progressBar}>
          <div
            style={{
              ...practiceGameStyles.progressFill,
              width: `${((currentIndex + 1) / words.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div style={practiceGameStyles.stats}>
        <div style={practiceGameStyles.statItem}>
          <span>✅</span> Correct: <strong>{practiceStats.correct}</strong>
        </div>
        <div style={practiceGameStyles.statItem}>
          <span>📊</span> Total: <strong>{practiceStats.total}</strong>
        </div>
      </div>

      <div style={practiceGameStyles.questionContainer}>
        <h2 style={practiceGameStyles.questionText}>Traduci in Olandese:</h2>
        <h1 style={practiceGameStyles.wordToTranslate}>{currentWord.english}</h1>
      </div>

      {currentWord.example_nl && (
        <div style={practiceGameStyles.exampleBox}>
          <p style={practiceGameStyles.exampleNL}>
            <strong>🇳🇱</strong> {currentWord.example_nl}
          </p>
          {currentWord.example_en && (
            <p style={practiceGameStyles.exampleEN}>
              <strong>🇬🇧</strong> {currentWord.example_en}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} style={practiceGameStyles.form}>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Scrivi la traduzione..."
          style={practiceGameStyles.input}
          autoFocus
        />
        <button type="submit" style={practiceGameStyles.submitButton}>
          Invia
        </button>
      </form>

      {feedback && (
        <p
          style={{
            ...practiceGameStyles.feedback,
            color: feedback.includes("✅") ? "#10b981" : "#ef4444",
          }}
        >
          {feedback}
        </p>
      )}

      <button onClick={goBack} style={practiceGameStyles.abandonButton}>
        ← Back to Selection
      </button>
    </div>
  );
}

const practiceGameStyles = {
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
    fontSize: "28px",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0 0 20px 0",
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
  stats: {
    display: "flex",
    justifyContent: "center",
    gap: "40px",
    marginBottom: "40px",
    flexWrap: "wrap",
  },
  statItem: {
    fontSize: "16px",
    color: "#475569",
    fontWeight: "500",
  },
  questionContainer: {
    textAlign: "center",
    marginBottom: "40px",
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
  abandonButton: {
    padding: "12px 24px",
    fontSize: "14px",
    background: "#f3f4f6",
    color: "#64748b",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    display: "block",
    margin: "0 auto",
  },
  gameOverContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  gameOverTitle: {
    fontSize: "40px",
    color: "#1e293b",
    margin: "0 0 30px 0",
  },
  statsBox: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "30px",
    marginBottom: "30px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    minWidth: "300px",
  },
  statLine: {
    fontSize: "18px",
    color: "#475569",
    margin: "12px 0",
  },
  buttonGroup: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  primaryButton: {
    padding: "12px 32px",
    fontSize: "16px",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(59, 130, 246, 0.2)",
    transition: "all 0.3s ease",
  },
  secondaryButton: {
    padding: "12px 32px",
    fontSize: "16px",
    fontWeight: "600",
    background: "white",
    color: "#64748b",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  backButton: {
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: "600",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    background: "white",
    color: "#64748b",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
};

export default Practice;
