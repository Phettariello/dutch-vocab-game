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

        const uniqueCategories = [...new Set(data.map((w) => w.category).filter(c => c))].sort();
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
      <div style={{ padding: "50px", textAlign: "center" }}>
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
    <div style={{ padding: "50px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>📚 Practice Mode</h1>
      <p style={{ fontSize: "16px", color: "#666", marginBottom: "30px" }}>
        Select categories and difficulty levels to practice. This mode doesn't affect your leaderboard score.
      </p>

      <div style={{ marginBottom: "40px" }}>
        <h2>Categories</h2>
        {categories.length > 0 && (
          <div style={{ marginBottom: "10px" }}>
            <button
              onClick={() => setSelectedCategories(categories)}
              style={{
                padding: "5px 10px",
                marginRight: "10px",
                backgroundColor: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedCategories([])}
              style={{
                padding: "5px 10px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Deselect All
            </button>
          </div>
        )}
        {categories.length === 0 ? (
          <p style={{ color: "red" }}>No categories found</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            {categories.map((category) => (
              <label
                key={category}
                style={{
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "5px",
                  cursor: "pointer",
                  backgroundColor: selectedCategories.includes(category)
                    ? "#e3f2fd"
                    : "white",
                  borderColor: selectedCategories.includes(category)
                    ? "#2196F3"
                    : "#ddd",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => toggleCategory(category)}
                />
                {category}
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: "40px" }}>
        <h2>Difficulty Levels</h2>
        <div style={{ marginBottom: "10px" }}>
          <button
            onClick={() => setSelectedDifficulties(difficulties)}
            style={{
              padding: "5px 10px",
              marginRight: "10px",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedDifficulties([])}
            style={{
              padding: "5px 10px",
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Deselect All
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "10px",
          }}
        >
          {difficulties.map((difficulty) => (
            <label
              key={difficulty}
              style={{
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "5px",
                cursor: "pointer",
                textAlign: "center",
                backgroundColor: selectedDifficulties.includes(difficulty)
                  ? "#e3f2fd"
                  : "white",
                borderColor: selectedDifficulties.includes(difficulty)
                  ? "#2196F3"
                  : "#ddd",
              }}
            >
              <input
                type="checkbox"
                checked={selectedDifficulties.includes(difficulty)}
                onChange={() => toggleDifficulty(difficulty)}
              />
              <div>{difficulty}</div>
            </label>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <button
          onClick={handleStartPractice}
          style={{
            padding: "12px 30px",
            fontSize: "18px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          Start Practice
        </button>
        <button
          onClick={goBack}
          style={{
            padding: "12px 30px",
            fontSize: "18px",
          }}
        >
          Back to Menu
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
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h1>Loading...</h1>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h1>No words found with those filters</h1>
        <button onClick={goBack}>Back to Selection</button>
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
    const percentage = Math.round((practiceStats.correct / practiceStats.total) * 100);

    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h1>📚 Practice Complete!</h1>
        <div style={{ fontSize: "24px", margin: "20px 0" }}>
          <p>Correct: {practiceStats.correct}/{practiceStats.total}</p>
          <p>Accuracy: {percentage}%</p>
        </div>
        <button
          onClick={goBack}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            margin: "10px",
          }}
        >
          Back to Selection
        </button>
        <button
          onClick={goBackMenu}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            margin: "10px",
          }}
        >
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h1>Practice Mode</h1>

      <div style={{ marginBottom: "30px", fontSize: "18px" }}>
        <p>
          <strong>Word {currentIndex + 1}/{words.length}</strong>
        </p>
        <p>
          Correct: {practiceStats.correct}/{practiceStats.total}
        </p>
      </div>

      <div style={{ fontSize: "28px", marginBottom: "20px" }}>
        Translate to Dutch: <strong>{currentWord.english}</strong>
      </div>

      {currentWord.example_nl && (
        <div
          style={{
            backgroundColor: "#f0f0f0",
            padding: "10px",
            borderRadius: "5px",
            marginBottom: "20px",
            fontSize: "14px",
          }}
        >
          <p style={{ margin: "5px 0", fontStyle: "italic", color: "#333" }}>
            <strong>Dutch:</strong> {currentWord.example_nl}
          </p>
          {currentWord.example_en && (
            <p style={{ margin: "5px 0", color: "#666" }}>
              <strong>English:</strong> {currentWord.example_en}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type Dutch translation"
          style={{
            padding: "12px",
            fontSize: "18px",
            width: "300px",
            marginRight: "10px",
          }}
          autoFocus
        />
        <button type="submit">Submit</button>
      </form>

      {feedback && (
        <p
          style={{
            fontSize: "20px",
            marginTop: "20px",
            color: feedback.includes("✅") ? "green" : "red",
          }}
        >
          {feedback}
        </p>
      )}

      <button onClick={goBack} style={{ marginTop: "30px" }}>
        Back to Selection
      </button>
    </div>
  );
}

export default Practice;