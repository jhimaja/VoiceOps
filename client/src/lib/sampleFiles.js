// The "project" shown in the mock IDE. Edits only change React state, never your disk.
export const initialFiles = {
  "App.jsx": `import React from "react";

// A tiny component we will edit by voice
export default function App() {
  const title = "VoiceOps Demo";

  function handleClick() {
    console.log("Button clicked");
  }

  return (
    <div className="app">
      <h1>{title}</h1>
      <p>Edit this file with your voice.</p>
      <button onClick={handleClick}>
        Click me
      </button>
    </div>
  );
}`,
  "utils.js": `export function add(a, b) {
  return a + b;
}

export function formatName(first, last) {
  return first + " " + last;
}

export function isEven(n) {
  return n % 2 === 0;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}`,
  "styles.css": `.app {
  font-family: system-ui, sans-serif;
  padding: 24px;
}

h1 {
  font-size: 28px;
}

button {
  padding: 8px 16px;
  border-radius: 6px;
}`,
};
