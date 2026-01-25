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

  const handleSubmit = (e) => {
    e.preventDefault();
    const userAnswer = answer.toLowerCase().trim();
    const correctAnswer = words[currentIndex].dutch.toLowerCase().trim();
    const isCorrect = userAnswer === correctAnswer;

    if (isCorrect) {
      setFeedback("✅ Correct!");
    } else {
      setFeedback(`❌ Wrong! It's '${words[currentIndex].dutch}'.`);
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
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h1>Loading Review Words...</h1>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h1>🎉 No words to review!</h1>
        <p>All your words are mastered. Great job!</p>
        <button onClick={goBack} style={{ marginTop: "20px" }}>
          Back to Menu
        </button>
      </div>
    );
  }

  const currentWord = words[currentIndex];

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h1>📚 Review Mode</h1>

      <div style={{ marginBottom: "30px", fontSize: "16px" }}>
        <p>
          <strong>Word {currentIndex + 1}/{words.length}</strong>
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "20px",
            marginTop: "10px",
          }}
        >
          <div>
            <p style={{ margin: "0 0 5px 0" }}>Correct: {currentWord.correct_count}</p>
            <p style={{ margin: "0" }}>Incorrect: {currentWord.incorrect_count}</p>
          </div>
          <div>
            <p style={{ margin: "0" }}>
              <strong>Mastery: {currentWord.masteryPercent}%</strong>
            </p>
            <div
              style={{
                width: "100px",
                height: "8px",
                backgroundColor: "#ddd",
                borderRadius: "4px",
                marginTop: "5px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${currentWord.masteryPercent}%`,
                  height: "100%",
                  backgroundColor: "#4CAF50",
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: "28px", marginBottom: "20px" }}>
        Translate to Dutch: <strong>{currentWord.english}</strong>
      </div>

      {currentWord.example_en && (
        <div
          style={{
            backgroundColor: "#f0f0f0",
            padding: "10px",
            borderRadius: "5px",
            marginBottom: "20px",
            fontSize: "14px",
          }}
        >
          <p style={{ margin: "5px 0" }}>
            <strong>Example:</strong> {currentWord.example_en}
          </p>
          {currentWord.example_nl && (
            <p style={{ margin: "5px 0", color: "#666" }}>
              {currentWord.example_nl}
            </p>
          )}
        </div>
      )}

      {!showAnswer ? (
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
          <button type="submit">Check</button>
        </form>
      ) : (
        <div>
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
          <p style={{ fontSize: "16px", marginTop: "15px" }}>
            <strong>Answer: {currentWord.dutch}</strong>
          </p>
          <button
            onClick={nextWord}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              margin: "10px",
              backgroundColor: currentIndex < words.length - 1 ? "#2196F3" : "#ccc",
              color: "white",
              cursor: currentIndex < words.length - 1 ? "pointer" : "not-allowed",
            }}
            disabled={currentIndex >= words.length - 1}
          >
            Next Word →
          </button>
        </div>
      )}

      <div style={{ marginTop: "20px" }}>
        <button
          onClick={previousWord}
          disabled={currentIndex === 0}
          style={{ marginRight: "10px", opacity: currentIndex === 0 ? 0.5 : 1 }}
        >
          ← Previous
        </button>
        <button
          onClick={goBack}
          style={{ marginLeft: "10px" }}
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}

export default Review;
