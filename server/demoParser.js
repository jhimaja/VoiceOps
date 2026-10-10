// Offline "demo mode" parser: simple pattern matching, no AI.
// Returns the same action shape that Claude's tools produce, so the client does not care which one answered.

const toCamel = (words) =>
  words
    .trim()
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("")
    .replace(/[^A-Za-z0-9_$]/g, "");

export function parseDemo(transcript, code, fileNames = []) {
  const text = transcript.toLowerCase().trim().replace(/[.!?]+$/, "");
  const lines = String(code ?? "").split("\n");
  let m;

  // --- NAVIGATE: "go to line 12", "jump to line 5", "line 7"
  if ((m = text.match(/(?:go to|jump to|goto|move to)?\s*line\s+(\d+)/))) {
    return { type: "ACTION_NAVIGATE", summary: `Jump to line ${m[1]}`, target_type: "line", line: Number(m[1]) };
  }

  // --- NAVIGATE: "open utils", "switch to styles"
  if ((m = text.match(/^(?:open|switch to|go to|show)\s+(?:the\s+)?(?:file\s+)?([\w.\-]+)/))) {
    const wanted = m[1].replace(/\.\w+$/, "");
    const file = fileNames.find((f) => f.toLowerCase().replace(/\.\w+$/, "") === wanted);
    if (file) return { type: "ACTION_NAVIGATE", summary: `Open ${file}`, target_type: "file", file_name: file };
  }

  // --- TERMINAL: "run npm test", "execute git status"
  if ((m = text.match(/^(?:run|execute)\s+(.+)/))) {
    return { type: "ACTION_TERMINAL", summary: `Run ${m[1]}`, command: m[1] };
  }

  // --- EDIT: "add a state variable called count"
  if ((m = text.match(/(?:add|create|make)\s+(?:a\s+)?(?:react\s+)?state(?:\s+variable)?\s+(?:called|named)\s+([a-z0-9 ]+)/))) {
    const name = toCamel(m[1]);
    const setter = "set" + name[0].toUpperCase() + name.slice(1);
    const importIdx = lines.findIndex((l) => /^import .*react/i.test(l));
    const fnIdx = lines.findIndex((l) => /function\s+[A-Z]\w*\s*\(/.test(l));
    const edits = [];

    if (importIdx >= 0 && !/useState/.test(lines[importIdx])) {
      const line = lines[importIdx];
      const updated = /\{[^}]*\}/.test(line)
        ? line.replace(/\{\s*([^}]*?)\s*\}/, (_m, a) => `{ ${a}, useState }`)
        : line.replace(/^import React\s+from/, "import React, { useState } from");
      edits.push({ mode: "replace", start_line: importIdx + 1, end_line: importIdx + 1, new_code: updated });
    }
    if (fnIdx >= 0) {
      edits.push({
        mode: "insert",
        start_line: fnIdx + 1,
        new_code: `  const [${name}, ${setter}] = useState(0);`,
      });
    }
    if (edits.length) return { type: "ACTION_EDIT", summary: `Add state variable ${name}`, edits };
  }

  // --- EDIT: "delete line 5", "delete the console log"
  if ((m = text.match(/(?:delete|remove)\s+line\s+(\d+)/))) {
    const n = Number(m[1]);
    return { type: "ACTION_EDIT", summary: `Delete line ${n}`, edits: [{ mode: "delete", start_line: n, end_line: n }] };
  }
  if (/(?:delete|remove)\s+(?:the\s+)?console\s*\.?\s*log/.test(text)) {
    const idx = lines.findIndex((l) => l.includes("console.log"));
    if (idx >= 0) {
      return {
        type: "ACTION_EDIT",
        summary: `Delete console.log on line ${idx + 1}`,
        edits: [{ mode: "delete", start_line: idx + 1, end_line: idx + 1 }],
      };
    }
  }

  throw new Error(
    'Demo mode did not understand that. Try: "go to line 12", "open utils", "run npm test", ' +
      '"add a state variable called count", "delete the console log".'
  );
}
