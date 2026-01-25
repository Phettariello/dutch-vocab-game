import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Practice({ goBack }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [practiceStarted, setPracticeStarted] = useState(false);

  const difficulties = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from("words")
          .select("category");

        if (error) throw error;

        const uniqueCategories = [
          ...new Set(data.map((w) => w.category).filter((c) => c)),
        ].sort();
        console.log("Loaded categories:", uniqueCategories);
        setCategories(uniqueCategories);
      } catch (error) {
        console.error("Error fetching categories:", error);
        alert("Failed to load categories");
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

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

  const handleStartPractice = () => {
    if (selectedCategories.length === 0 || selectedDifficulties.length === 0) {
      alert("Please select at least one category and one difficulty level!");
      return;
    }
    setPracticeStarted(true);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <h1>Loading...</h1>
      </div>
    );
  }

  if (practiceStarted) {
    return (
      <PracticeGame
        categories={selectedCategories}
        difficulties={selectedDifficulties}
        goBack={() => setPracticeStarted(false)}
        goBackMenu={goBack}
      />
    );
  }

  return (
    <div style={styles.selectionContainer}>
      <h1 style={styles.selectionTitle}>📚 Practice Mode</h1>
      <p style={styles.selectionSubtitle}>
        Select categories and difficulty levels to practice. This mode doesn't
        affect your leaderboard score.
      </p>

      <div style={styles.selectionSection}>
        <h2 style={styles.sectionTitle}>Categories</h2>
        {categories.length > 0 && (
          <div style={styles.buttonGroup}>
            <button
              onClick={() => setSelectedCategories(categories)}
              style={styles.selectAllButton}
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedCategories([])}
              style={styles.deselectAllButton}
            >
              Deselect All
            </button>
          </div>
        )}
        {categories.length === 0 ? (
          <p style={styles.errorText}>No categories found</p>
        ) : (
          <div style={styles.grid2Col}>
            {categories.map((category) => (
              <label
                key={category}
                style={{
                  ...styles.checkboxLabel,
                  backgroundColor: selectedCategories.includes(category)
                    ? "#e3f2fd"
                    : "white",
                  borderColor: selectedCategories.includes(category)
                    ? "#3b82f6"
                    : "#e5e7eb",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => toggleCategory(category)}
                  style={styles.checkbox}
                />
                {category}
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={styles.selectionSection}>
        <h2 style={styles.sectionTitle}>Difficulty Levels</h2>
        <div style={styles.buttonGroup}>
          <button
            onClick={() => setSelectedDifficulties(difficulties)}
            style={styles.selectAllButton}
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedDifficulties([])}
            style={styles.deselectAllButton}
          >
            Deselect All
          </button>
        </div>
        <div style={styles.grid5Col}>
          {difficulties.map((difficulty) => (
            <label
              key={difficulty}
              style={{
                ...styles.checkboxLabel,
                backgroundColor: selectedDifficulties.includes(difficulty)
                  ? "#e3f2fd"
                  : "white",
                borderColor: selectedDifficulties.includes(difficulty)
                  ? "#3b82f6"
                  : "#e5e7eb",
                textAlign: "center",
              }}
            >
              <input
                type="checkbox"
                checked={selectedDifficulties.includes(difficulty)}
                onChange={() => toggleDifficulty(difficulty)}
                style={styles.checkbox}
              />
              <div>{difficulty}</div>
            </label>
          ))}
        </div>
      </div>

      <div style={styles.buttonContainer}>
        <button
          onClick={handleStartPractice}
          style={styles.primaryButton}
        >
          Start Practice
        </button>
        <button onClick={goBack} style={styles.secondaryButton}>
          ← Back to Menu
        </button>
      </div>
    </div>
  );
}

function PracticeGame({ categories, difficulties, goBack, goBackMenu }) {
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [practiceStats, setPracticeStats] = useState({ correct: 0, total: 0 });
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
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

        console.log("Loaded words:", data?.length || 0);
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
      <div style={styles.loadingContainer}>
        <h1>Loading...</h1>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <h1>No words found with those filters</h1>
        <button onClick={goBack} style={styles.secondaryButton}>
          Back to Selection
        </button>
      </div>
    );
  }

  const currentWord = words[currentIndex];

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
      setFeedback(`❌ Wrong! The answer is '${currentWord.dutch}'.`);
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
      <div style={styles.gameOverContainer}>
        <h1 style={styles.gameOverTitle}>📚 Practice Complete!</h1>
        <div style={styles.statsContainer}>
          <div style={styles.statBox}>
            <p style={styles.statLabel}>Correct</p>
            <p style={styles.statValue}>
              {practiceStats.correct}/{practiceStats.total}
            </p>
          </div>
          <div style={styles.statBox}>
            <p style={styles.statLabel}>Accuracy</p>
            <p style={styles.statValue}>{percentage}%</p>
          </div>
        </div>
        <div style={styles.buttonContainer}>
          <button onClick={goBack} style={styles.primaryButton}>
            Back to Selection
          </button>
          <button onClick={goBackMenu} style={styles.secondaryButton}>
            ← Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>Practice Mode</h1>
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

      <div style={styles.stats}>
        <div style={styles.statItem}>
          <span>📊</span> Progress: <strong>{currentIndex + 1}/{words.length}</strong>
        </div>
        <div style={styles.statItem}>
          <span>✅</span> Correct: <strong>{practiceStats.correct}/{practiceStats.total}</strong>
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

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Enter the translation..."
          style={styles.input}
          disabled={gameOver}
          autoFocus
        />
        <button type="submit" style={styles.submitButton} disabled={gameOver}>
          Submit
        </button>
      </form>

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

      <button onClick={goBack} style={styles.exitButton} disabled={gameOver}>
        ← Exit
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
  selectionContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    padding: "40px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    maxWidth: "700px",
    margin: "0 auto",
  },
  selectionTitle: {
    fontSize: "36px",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0 0 10px 0",
    textAlign: "center",
  },
  selectionSubtitle: {
    fontSize: "14px",
    color: "#64748b",
    textAlign: "center",
    marginBottom: "30px",
  },
  selectionSection: {
    marginBottom: "40px",
  },
  sectionTitle: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: "16px",
  },
  buttonGroup: {
    display: "flex",
    gap: "10px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  selectAllButton: {
    padding: "8px 16px",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all 0.2s ease",
  },
  deselectAllButton: {
    padding: "8px 16px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all 0.2s ease",
  },
  grid2Col: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  grid5Col: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "12px",
  },
  checkboxLabel: {
    padding: "12px",
    border: "2px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "#1e293b",
  },
  checkbox: {
    cursor: "pointer",
    width: "18px",
    height: "18px",
  },
  errorText: {
    color: "#ef4444",
    fontSize: "14px",
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
  exitButton: {
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
    fontSize: "48px",
    color: "#1e293b",
    margin: "0 0 40px 0",
  },
  statsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "20px",
    maxWidth: "600px",
    marginBottom: "40px",
  },
  statBox: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "24px",
    textAlign: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  statLabel: {
    fontSize: "14px",
    color: "#64748b",
    margin: "0 0 10px 0",
  },
  statValue: {
    fontSize: "32px",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0",
  },
  buttonContainer: {
    display: "flex",
    gap: "20px",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: "40px",
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
  },
  secondaryButton: {
    padding: "14px 40px",
    fontSize: "16px",
    fontWeight: "600",
    background: "#f3f4f6",
    color: "#475569",
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

export default Practice;
