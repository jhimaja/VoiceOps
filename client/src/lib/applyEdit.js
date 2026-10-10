const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

// Apply Claude's list of edits to a file. All line numbers refer to the ORIGINAL
// text, so we apply from the bottom up and earlier line numbers stay valid.
export function applyEdits(code, edits = []) {
  const lines = code.split("\n");
  const total = lines.length;

  const sorted = [...edits].sort((a, b) => b.start_line - a.start_line);
  let firstChanged = Infinity;
  let lastChanged = 0;

  for (const edit of sorted) {
    const newLines = edit.new_code ? edit.new_code.replace(/\n$/, "").split("\n") : [];

    if (edit.mode === "insert") {
      const after = clamp(edit.start_line, 0, total);
      lines.splice(after, 0, ...newLines);
      firstChanged = Math.min(firstChanged, after + 1);
      lastChanged = Math.max(lastChanged, after + newLines.length);
    } else {
      const start = clamp(edit.start_line, 1, total);
      const end = clamp(edit.end_line ?? start, start, total);
      const replacement = edit.mode === "delete" ? [] : newLines;
      lines.splice(start - 1, end - start + 1, ...replacement);
      firstChanged = Math.min(firstChanged, start);
      lastChanged = Math.max(lastChanged, start + Math.max(replacement.length, 1) - 1);
    }
  }

  return {
    code: lines.join("\n"),
    firstLine: firstChanged === Infinity ? 1 : firstChanged,
    lastLine: lastChanged || 1,
  };
}
