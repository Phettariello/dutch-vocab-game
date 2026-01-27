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


  const toggleAllCategories = () => {
    if (selectedCategories.length === categories.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories([...categories]);
    }
  };


  const toggleDifficulty = (difficulty) => {
    setSelectedDifficulties((prev) =>
      prev.includes(difficulty)
        ? prev.filter((d) => d !== difficulty)
        : [...prev, difficulty]
    );
  };


  const toggleAllDifficulties = () => {
    if (selectedDifficulties.length === difficulties.length) {
      setSelectedDifficulties([]);
    } else {
      setSelectedDifficulties([...difficulties]);
    }
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
        <h1 style={styles.loadingText}>Loading...</h1>
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
      <div style={styles.selectionHeader}>
        <h1 style={styles.selectionTitle}>📚 Practice Mode</h1>
        <button
          onClick={goBack}
          style={styles.backButton}
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
      <p style={styles.selectionSubtitle}>
        Select categories and difficulty levels to practice. Your progress will be saved.
      </p>


      <div style={styles.selectionSection}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Categories</h2>
          <div style={styles.buttonGroup}>
            <button
              onClick={toggleAllCategories}
              style={styles.selectAllButton}
            >
              {selectedCategories.length === categories.length
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>
        </div>
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
                    ? "rgba(6,182,212,0.15)"
                    : "rgba(30, 58, 138, 0.4)",
                  borderColor: selectedCategories.includes(category)
                    ? "#06b6d4"
                    : "rgba(6,182,212,0.3)",
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
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Difficulty Levels (1-10)</h2>
          <div style={styles.buttonGroup}>
            <button
              onClick={toggleAllDifficulties}
              style={styles.selectAllButton}
            >
              {selectedDifficulties.length === difficulties.length
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>
        </div>
        <div style={styles.grid5Col}>
          {difficulties.map((difficulty) => (
            <label
              key={difficulty}
              style={{
                ...styles.checkboxLabelSmall,
                backgroundColor: selectedDifficulties.includes(difficulty)
                  ? "rgba(6,182,212,0.15)"
                  : "rgba(30, 58, 138, 0.4)",
                borderColor: selectedDifficulties.includes(difficulty)
                  ? "#06b6d4"
                  : "rgba(6,182,212,0.3)",
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
  const [userId, setUserId] = useState(null);


  useEffect(() => {
    const fetchWords = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const currentUserId = userData.user?.id;
        setUserId(currentUserId);


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


  // ============================================================================
  // FUNCTION: Update user progress (salva in user_progress)
  // ============================================================================
  const updateUserProgress = async (wordId, isCorrect) => {
    if (!userId) return;


    try {
      // 1. Cerca se esiste già user_progress per questa word
      const { data: existing, error: fetchError } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("word_id", wordId)
        .single();


      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Fetch error:", fetchError);
        return;
      }


      if (existing) {
        // 2. UPDATE: incrementa correct_count o incorrect_count
        const newCorrectCount = isCorrect
          ? existing.correct_count + 1
          : existing.correct_count;
        const newIncorrectCount = !isCorrect
          ? existing.incorrect_count + 1
          : existing.incorrect_count;
        const isMastered = newCorrectCount >= 10;


        await supabase
          .from("user_progress")
          .update({
            correct_count: newCorrectCount,
            incorrect_count: newIncorrectCount,
            mastered: isMastered,
            last_seen_at: new Date(),
          })
          .eq("id", existing.id);
      } else {
        // 3. INSERT: crea nuova riga
        await supabase.from("user_progress").insert([
          {
            user_id: userId,
            word_id: wordId,
            correct_count: isCorrect ? 1 : 0,
            incorrect_count: !isCorrect ? 1 : 0,
            mastered: false,
            last_seen_at: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error("Error updating progress:", error);
    }
  };


  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <h1 style={styles.loadingText}>Loading...</h1>
      </div>
    );
  }


  if (words.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <h1 style={styles.loadingText}>No words found with those filters</h1>
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


  const handleSubmit = async (e) => {
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


    // 🔥 SALVA PROGRESSO SU DATABASE
    await updateUserProgress(currentWord.id, isCorrect);


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
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <p style={styles.statValue}>{practiceStats.correct}/{practiceStats.total}</p>
            <p style={styles.statLabel}>Correct</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statValue}>{percentage}%</p>
            <p style={styles.statLabel}>Accuracy</p>
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
        <h1 style={styles.title}>📚 Practice</h1>
        <button
          onClick={goBack}
          style={styles.backButton}
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


      <div style={styles.progressBar}>
        <div
          style={{
            ...styles.progressFill,
            width: `${((currentIndex + 1) / words.length) * 100}%`,
          }}
        />
      </div>


      <div style={styles.stats}>
        <div style={styles.statItem}>
          <span>📊</span> {currentIndex + 1}/{words.length}
        </div>
        <div style={styles.statItem}>
          <span>✅</span> {practiceStats.correct}/{practiceStats.total}
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
    </div>
  );
}


const styles = {
  // ============================================================================
  // SELECTION PAGE STYLES
  // ============================================================================
  selectionContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    padding: "20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  selectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    gap: "12px",
  },
  selectionTitle: {
    fontSize: "clamp(24px, 5vw, 32px)",
    fontWeight: "800",
    color: "white",
    margin: "0",
    textShadow: "0 2px 8px rgba(6,182,212,0.3)",
    flex: 1,
  },
  backButton: {
    padding: "8px 12px",
    fontSize: "clamp(11px, 2.5vw, 12px)",
    background: "#06b6d4",
    color: "#0f172a",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  selectionSubtitle: {
    fontSize: "clamp(13px, 2.5vw, 14px)",
    color: "#bfdbfe",
    textAlign: "center",
    marginBottom: "30px",
  },
  selectionSection: {
    marginBottom: "30px",
    maxWidth: "600px",
    margin: "0 auto 30px",
    width: "100%",
    boxSizing: "border-box",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  sectionTitle: {
    fontSize: "clamp(16px, 3vw, 18px)",
    fontWeight: "600",
    color: "white",
    margin: "0",
  },
  buttonGroup: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  selectAllButton: {
    padding: "6px 12px",
    fontSize: "clamp(11px, 2vw, 12px)",
    background: "#06b6d4",
    color: "#0f172a",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "600",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
  },
  grid2Col: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  grid5Col: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "8px",
  },
  checkboxLabel: {
    padding: "12px",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    color: "#bfdbfe",
  },
  checkboxLabelSmall: {
    padding: "10px",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    fontSize: "clamp(11px, 2vw, 12px)",
    color: "#bfdbfe",
    flexDirection: "column",
  },
  checkbox: {
    cursor: "pointer",
    width: "14px",
    height: "14px",
    accentColor: "#06b6d4",
  },
  errorText: {
    color: "#fca5a5",
    fontSize: "clamp(12px, 2.5vw, 13px)",
  },
  buttonContainer: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    justifyContent: "center",
    maxWidth: "600px",
    margin: "0 auto",
    width: "100%",
  },
  primaryButton: {
    padding: "12px 24px",
    fontSize: "clamp(13px, 2.5vw, 14px)",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(59, 130, 246, 0.2)",
    transition: "all 0.2s ease",
    flex: "1 1 140px",
    minWidth: "120px",
  },
  secondaryButton: {
    padding: "12px 24px",
    fontSize: "clamp(13px, 2.5vw, 14px)",
    fontWeight: "600",
    background: "rgba(255,255,255,0.1)",
    color: "#06b6d4",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    flex: "1 1 140px",
    minWidth: "120px",
  },


  // ============================================================================
  // GAME PAGE STYLES
  // ============================================================================
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
    gap: "12px",
  },
  title: {
    fontSize: "clamp(20px, 5vw, 28px)",
    fontWeight: "800",
    margin: "0",
    color: "white",
    textShadow: "0 2px 8px rgba(6,182,212,0.3)",
    flex: 1,
  },
  progressBar: {
    height: "6px",
    background: "rgba(6,182,212,0.2)",
    borderRadius: "8px",
    overflow: "hidden",
    margin: "12px 20px 0",
    maxWidth: "calc(100% - 40px)",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
    transition: "width 0.3s ease",
  },
  stats: {
    display: "flex",
    justifyContent: "center",
    gap: "32px",
    padding: "16px 20px",
    fontSize: "clamp(12px, 3vw, 14px)",
  },
  statItem: {
    color: "#bfdbfe",
    fontWeight: "600",
  },
  questionContainer: {
    textAlign: "center",
    padding: "0 20px",
    marginBottom: "16px",
  },
  questionLabel: {
    fontSize: "clamp(11px, 2.5vw, 12px)",
    color: "#93c5fd",
    margin: "0 0 6px 0",
  },
  questionText: {
    fontSize: "clamp(12px, 2.5vw, 13px)",
    color: "#bfdbfe",
    margin: "0 0 8px 0",
    fontWeight: "500",
  },
  wordToTranslate: {
    fontSize: "clamp(28px, 7vw, 40px)",
    color: "white",
    margin: "0",
    fontWeight: "700",
    wordBreak: "break-word",
  },
  exampleBox: {
    background: "rgba(30, 58, 138, 0.6)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "8px",
    padding: "12px",
    margin: "0 20px 16px",
    fontSize: "clamp(11px, 2.5vw, 12px)",
  },
  exampleNL: {
    color: "#93c5fd",
    margin: "0 0 6px 0",
  },
  exampleEN: {
    color: "#cbd5e1",
    margin: "0",
    fontSize: "clamp(10px, 2.5vw, 11px)",
  },
  form: {
    display: "flex",
    gap: "8px",
    padding: "0 20px 12px",
  },
  input: {
    padding: "10px 12px",
    fontSize: "clamp(13px, 3vw, 14px)",
    border: "1px solid rgba(6,182,212,0.4)",
    borderRadius: "6px",
    flex: 1,
    minWidth: "120px",
    background: "rgba(255,255,255,0.95)",
    color: "#0f172a",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
  },
  submitButton: {
    padding: "10px 16px",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 6px rgba(59, 130, 246, 0.2)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  feedback: {
    fontSize: "clamp(13px, 3vw, 14px)",
    fontWeight: "600",
    margin: "12px 20px 0",
    minHeight: "24px",
    textAlign: "center",
  },
  gameOverContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  gameOverTitle: {
    fontSize: "clamp(28px, 6vw, 40px)",
    color: "white",
    margin: "0 0 30px 0",
    textAlign: "center",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
    maxWidth: "400px",
    margin: "0 auto 30px",
    width: "100%",
  },
  statCard: {
    background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
    border: "1px solid rgba(6,182,212,0.2)",
    borderRadius: "10px",
    padding: "14px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  statValue: {
    fontSize: "clamp(20px, 4vw, 28px)",
    fontWeight: "700",
    color: "#fbbf24",
    margin: "0 0 4px 0",
  },
  statLabel: {
    fontSize: "clamp(10px, 2vw, 11px)",
    color: "#bfdbfe",
    margin: "0",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "20px",
  },
  loadingText: {
    fontSize: "clamp(20px, 5vw, 28px)",
    color: "white",
    margin: "0",
    fontWeight: "700",
  },
};


export default Practice;
