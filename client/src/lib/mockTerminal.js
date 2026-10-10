// A fake shell. Nothing is ever executed on your machine. That is deliberate:
// letting an LLM run real commands is a security risk (see README).
export function runMockCommand(raw) {
  const cmd = raw.trim();

  if (/^npm (run )?test$|^npm t$/.test(cmd)) {
    return [
      { type: "out", text: "> voiceops-demo@1.0.0 test" },
      { type: "out", text: "> vitest run" },
      { type: "ok", text: " PASS  utils.test.js  (3 tests)" },
      { type: "ok", text: " PASS  App.test.jsx   (2 tests)" },
      { type: "ok", text: "Tests: 5 passed, 5 total" },
    ];
  }
  if (/^npm (i|install)/.test(cmd)) {
    return [
      { type: "out", text: "added 128 packages in 3s" },
      { type: "ok", text: "found 0 vulnerabilities" },
    ];
  }
  if (/^npm (run )?(dev|start)$/.test(cmd)) {
    return [
      { type: "ok", text: "VITE ready in 312 ms" },
      { type: "out", text: "Local: http://localhost:5173/" },
    ];
  }
  if (/^npm run build$/.test(cmd)) {
    return [
      { type: "out", text: "transforming 34 modules..." },
      { type: "ok", text: "built in 1.84s" },
    ];
  }
  if (/^git status$/.test(cmd)) {
    return [
      { type: "out", text: "On branch main" },
      { type: "out", text: "Changes not staged for commit:" },
      { type: "err", text: "  modified:   App.jsx" },
    ];
  }
  if (/^git (add|commit|push)/.test(cmd)) {
    return [{ type: "ok", text: `${cmd} - done` }];
  }
  if (cmd === "ls") return [{ type: "out", text: "App.jsx  utils.js  styles.css  package.json" }];
  if (cmd === "pwd") return [{ type: "out", text: "/home/dev/voiceops-demo" }];

  return [{ type: "out", text: `(simulated) ${cmd}` }];
}
