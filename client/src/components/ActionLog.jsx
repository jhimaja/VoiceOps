// Live "Voice Action History Log": what you said, and what Claude understood.
const BADGES = {
  ACTION_EDIT: { label: "EDIT", cls: "bg-[#3a2f12] text-[#ffc45c]" },
  ACTION_NAVIGATE: { label: "NAVIGATE", cls: "bg-[#1d2447] text-[#9fadff]" },
  ACTION_TERMINAL: { label: "TERMINAL", cls: "bg-[#12362c] text-[#5fe0b0]" },
};

function Details({ action }) {
  if (action.type === "ACTION_EDIT") {
    return (
      <div className="mt-2 space-y-1">
        {action.edits?.map((e, i) => (
          <div key={i} className="rounded bg-ink p-2 font-mono text-xs text-mute">
            <div className="text-[#ffc45c]">
              {e.mode} {e.mode === "insert" ? `after line ${e.start_line}` : `lines ${e.start_line}-${e.end_line ?? e.start_line}`}
            </div>
            {e.new_code && <pre className="mt-1 whitespace-pre-wrap text-[#d5d9e2]">{e.new_code}</pre>}
          </div>
        ))}
      </div>
    );
  }
  if (action.type === "ACTION_NAVIGATE") {
    return (
      <p className="mt-2 font-mono text-xs text-mute">
        {action.target_type === "line" ? `line ${action.line}` : `file ${action.file_name}`}
      </p>
    );
  }
  return <p className="mt-2 rounded bg-ink p-2 font-mono text-xs text-[#5fe0b0]">$ {action.command}</p>;
}

export default function ActionLog({ history }) {
  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-line bg-panel">
      <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Voice action history</h2>
      <div className="flex-1 space-y-3 overflow-auto p-3">
        {history.length === 0 && (
          <p className="p-2 text-sm text-mute">
            Nothing yet. Press the mic and say something like “go to line 12”.
          </p>
        )}
        {history.map((h) => (
          <article key={h.id} className="rounded-lg border border-line bg-[#1b202b] p-3">
            <div className="flex items-center justify-between text-xs text-mute">
              <span>{h.time}</span>
              {h.status === "parsing" && <span className="text-[#9fadff]">Asking Grok…</span>}
              {h.status === "done" && h.action && (
                <span className={`rounded px-2 py-0.5 font-semibold ${BADGES[h.action.type]?.cls}`}>
                  {BADGES[h.action.type]?.label}
                </span>
              )}
              {h.status === "error" && <span className="text-[#ff7a8a]">Failed</span>}
            </div>
            <p className="mt-2 text-sm">“{h.transcript}”</p>
            {h.action && (
              <>
                <p className="mt-1 text-xs text-mute">{h.action.summary}</p>
                <Details action={h.action} />
              </>
            )}
            {h.error && <p className="mt-2 text-xs text-[#ff7a8a]">{h.error}</p>}
          </article>
        ))}
      </div>
    </aside>
  );
}
