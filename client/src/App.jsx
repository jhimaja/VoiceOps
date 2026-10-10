import { useEffect, useRef, useState } from "react";
import Editor from "./components/Editor.jsx";
import ActionLog from "./components/ActionLog.jsx";
import Terminal from "./components/Terminal.jsx";
import { useSpeech } from "./hooks/useSpeech.js";
import { initialFiles } from "./lib/sampleFiles.js";
import { applyEdits } from "./lib/applyEdit.js";
import { runMockCommand } from "./lib/mockTerminal.js";

const EXAMPLES = [
  "Add a state variable called count",
  "Go to line 12",
  "Open utils",
  "Run npm test",
  "Delete the console log",
];

// ---- File upload settings ---------------------------------------------------
const SUPPORTED_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".css", ".json", ".md"];
const ACCEPT_ATTR = SUPPORTED_EXTENSIONS.join(","); // used by the hidden <input type="file">
// Only the active file is sent to the AI on each command, so keep files small
// (about 2,500 lines). Raise this if you need bigger files.
const MAX_FILE_BYTES = 100 * 1024;

const isSupported = (name) => SUPPORTED_EXTENSIONS.includes(name.slice(name.lastIndexOf(".")).toLowerCase());
const hasFiles = (e) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

// FileReader is callback-based; wrap it in a Promise so we can use await.
const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function App() {
  const [files, setFiles] = useState(initialFiles);
  const [activeFile, setActiveFile] = useState("App.jsx");
  const [cursorLine, setCursorLine] = useState(1);
  const [flash, setFlash] = useState(null);
  const [history, setHistory] = useState([]);
  const [terminal, setTerminal] = useState([{ type: "out", text: "VoiceOps terminal ready. Commands are simulated." }]);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const nextId = useRef(1);
  const [mode, setMode] = useState("");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState({ ok: "", warn: "" });
  const fileInputRef = useRef(null);

  // Ask the server which mode it started in: "grok" (real AI) or "demo" (pattern matching).
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setMode(d.mode))
      .catch(() => setMode("offline"));
  }, []);

  // Clear the upload message after a few seconds.
  useEffect(() => {
    if (!notice.ok && !notice.warn) return;
    const t = setTimeout(() => setNotice({ ok: "", warn: "" }), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  // If a file is dropped outside the sidebar, stop the browser from navigating away to open it.
  useEffect(() => {
    const stop = (e) => hasFiles(e) && e.preventDefault();
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);

  // ------------------------------------------------------------ file upload
  async function handleFiles(fileList) {
    const picked = Array.from(fileList || []); // copy now: the input is cleared right after this call
    if (picked.length === 0) return;

    const added = {};
    const skipped = [];
    let lastName = "";

    for (const file of picked) {
      if (!isSupported(file.name)) {
        skipped.push(`${file.name} (unsupported type)`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        skipped.push(`${file.name} (over ${MAX_FILE_BYTES / 1024} KB)`);
        continue;
      }
      try {
        const text = await readFileAsText(file);
        if (text.includes("\u0000")) {
          skipped.push(`${file.name} (not plain text)`); // binary files contain NUL characters
          continue;
        }
        // Remove the BOM and use "\n" line endings so line numbers match what the editor shows.
        added[file.name] = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
        lastName = file.name;
      } catch {
        skipped.push(`${file.name} (could not be read)`);
      }
    }

    const count = Object.keys(added).length;
    if (count > 0) {
      setFiles((prev) => ({ ...prev, ...added })); // same name = update, new name = append
      setActiveFile(lastName); // open the last uploaded file
      setCursorLine(1);
      setFlash(null);
    }
    setNotice({
      ok: count > 0 ? `Added ${count} file${count > 1 ? "s" : ""}` : "",
      warn: skipped.length > 0 ? `Skipped: ${skipped.join(", ")}` : "",
    });
  }

  // ------------------------------------------------------------------ actions
  function runCommand(cmd) {
    if (cmd === "clear") return setTerminal([]);
    setTerminal((t) => [...t, { type: "cmd", text: cmd }]);
    runMockCommand(cmd).forEach((line, i) =>
      setTimeout(() => setTerminal((t) => [...t, line]), 300 * (i + 1))
    );
  }

  function runEdit(action) {
    const result = applyEdits(files[activeFile], action.edits);
    setFiles((f) => ({ ...f, [activeFile]: result.code }));
    setCursorLine(result.firstLine);
    const id = nextId.current++;
    setFlash({ from: result.firstLine, to: result.lastLine, id });
  }

  function runNavigate(action) {
    if (action.target_type === "file") {
      const wanted = (action.file_name || "").toLowerCase();
      const match = Object.keys(files).find((n) => n.toLowerCase() === wanted) ||
        Object.keys(files).find((n) => n.toLowerCase().includes(wanted.replace(/\.\w+$/, "")));
      if (match) {
        setActiveFile(match);
        setCursorLine(1);
        setFlash(null);
      }
    } else {
      const total = files[activeFile].split("\n").length;
      setCursorLine(Math.min(Math.max(action.line || 1, 1), total));
    }
  }

  function execute(action) {
    if (action.type === "ACTION_EDIT") runEdit(action);
    else if (action.type === "ACTION_NAVIGATE") runNavigate(action);
    else if (action.type === "ACTION_TERMINAL") runCommand(action.command);
  }

  // ----------------------------------------------- send a command to the API
  async function handleCommand(transcript) {
    const text = transcript.trim();
    if (!text) return;

    const id = nextId.current++;
    setHistory((h) => [{ id, time: timeNow(), transcript: text, status: "parsing" }, ...h]);
    setBusy(true);

    try {
      const res = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          fileName: activeFile,
          code: files[activeFile],
          cursorLine,
          fileNames: Object.keys(files),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      setHistory((h) => h.map((x) => (x.id === id ? { ...x, status: "done", action: data.action } : x)));
      execute(data.action);
    } catch (err) {
      setHistory((h) => h.map((x) => (x.id === id ? { ...x, status: "error", error: err.message } : x)));
    } finally {
      setBusy(false);
    }
  }

  const speech = useSpeech(handleCommand);

  function submitTyped(e) {
    e.preventDefault();
    handleCommand(typed);
    setTyped("");
  }

  // --------------------------------------------------------------------- UI
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-line bg-panel px-5 py-3">
        <h1 className="text-lg font-semibold tracking-tight">VoiceOps</h1>
        {mode && (
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              mode === "grok" ? "bg-[#12362c] text-[#5fe0b0]" : "bg-[#3a2f12] text-[#ffc45c]"
            }`}
            title={mode === "grok" ? "Commands are parsed by Grok" : "No API key: simple pattern matching"}
          >
            {mode === "grok" ? "Grok" : mode === "demo" ? "Demo mode" : "Server offline"}
          </span>
        )}

        <button
          onClick={speech.listening ? speech.stop : speech.start}
          disabled={!speech.supported}
          aria-pressed={speech.listening}
          className={`flex h-11 items-center gap-3 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5c7a] disabled:cursor-not-allowed disabled:opacity-40 ${
            speech.listening ? "bg-[#ff5c7a] text-white" : "bg-[#262c39] text-[#d5d9e2] hover:bg-[#2f3748]"
          }`}
        >
          {speech.listening ? (
            <span className="flex h-4 items-center gap-0.5" aria-hidden="true">
              {[0, 0.15, 0.3, 0.45].map((d) => (
                <span key={d} className="vo-bar" style={{ animationDelay: `${d}s` }} />
              ))}
            </span>
          ) : (
            <span aria-hidden="true">●</span>
          )}
          {speech.listening ? "Listening… tap to stop" : "Speak a command"}
        </button>

        <p className="min-w-0 flex-1 truncate text-sm text-mute" aria-live="polite">
          {!speech.supported
            ? "Speech input needs Chrome or Edge. You can still type commands."
            : speech.error
            ? `Mic error: ${speech.error}`
            : busy
            ? "Grok is parsing your command…"
            : speech.interim || "Try: “add a state variable called count”"}
        </p>

        <form onSubmit={submitTyped} className="flex items-center gap-2">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="or type a command"
            className="w-64 rounded-md border border-line bg-ink px-3 py-2 text-sm placeholder:text-mute focus-visible:outline-2 focus-visible:outline-[#7c8cff]"
          />
          <button
            type="submit"
            disabled={busy || !typed.trim()}
            className="rounded-md bg-[#262c39] px-3 py-2 text-sm font-medium hover:bg-[#2f3748] disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-line bg-ink px-5 py-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => handleCommand(ex)}
            disabled={busy}
            className="rounded-full border border-line px-3 py-1 text-xs text-mute hover:border-[#7c8cff] hover:text-[#d5d9e2] disabled:opacity-40"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Files"
          onDragOver={(e) => {
            if (hasFiles(e)) {
              e.preventDefault();
              setDragging(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`flex w-52 shrink-0 flex-col border-r border-line transition-colors ${
            dragging ? "bg-[#1f2636] ring-2 ring-inset ring-[#7c8cff]" : "bg-panel"
          }`}
        >
          <div className="border-b border-line p-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = ""; // so picking the same file again still triggers onChange
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-[#262c39] px-3 py-2 text-sm font-medium text-[#d5d9e2] transition-colors hover:bg-[#2f3748] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c8cff]"
            >
              <span aria-hidden="true">+</span> Upload File
            </button>
            <p className="mt-2 text-center text-[11px] leading-4 text-mute">
              {dragging ? "Drop to add files" : "or drag & drop code files here"}
            </p>
            <div aria-live="polite" className="empty:hidden">
              {notice.ok && <p className="mt-2 text-xs text-[#5fe0b0]">{notice.ok}</p>}
              {notice.warn && <p className="mt-2 break-words text-xs text-[#ffc45c]">{notice.warn}</p>}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto py-2">
            {Object.keys(files).map((name) => (
              <button
                key={name}
                title={name}
                onClick={() => {
                  setActiveFile(name);
                  setCursorLine(1);
                  setFlash(null);
                }}
                className={`block w-full truncate px-4 py-1.5 text-left font-mono text-[13px] ${
                  name === activeFile ? "bg-[#1f2636] text-white" : "text-mute hover:text-[#d5d9e2]"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </nav>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-2 text-xs text-mute">
            <span className="font-mono text-[#d5d9e2]">{activeFile}</span>
            <span>Ln {cursorLine}</span>
          </div>
          <Editor
            fileName={activeFile}
            code={files[activeFile]}
            activeLine={cursorLine}
            flash={flash}
            onLineClick={setCursorLine}
          />
          <Terminal lines={terminal} onRun={runCommand} />
        </main>

        <ActionLog history={history} />
      </div>
    </div>
  );
}
