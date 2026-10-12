import React from "react";
import ReactDOM from "react-dom/client";
import Login from "./screens/Login.jsx";
import "./index.css";

// iPhone fix: when the keyboard opens, iOS slides the visible screen up.
// This keeps the value of that shift in a CSS variable so the top bar
// (level, hearts, score) can follow the visible screen.
if (window.visualViewport) {
  const vv = window.visualViewport;
  const updateViewportOffset = () => {
    document.documentElement.style.setProperty(
      "--vv-top",
      `${vv.offsetTop}px`
    );
    document.documentElement.style.setProperty(
      "--vv-height",
      `${vv.height}px`
    );
  };
  vv.addEventListener("resize", updateViewportOffset);
  vv.addEventListener("scroll", updateViewportOffset);
  updateViewportOffset();
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Login />
  </React.StrictMode>
);
