// src/screens/Settings.jsx
import React from "react";

function Settings({ goBack }) {
  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h1>Settings</h1>
      <p>Qui metteremo tema, suoni, ecc.</p>
      <button onClick={goBack}>Torna al Menu</button>
    </div>
  );
}

export default Settings;
