import { useEffect, useRef, useState } from "react";

const COLORS = { cmd: "text-[#d5d9e2]", out: "text-mute", ok: "text-[#5fe0b0]", err: "text-[#ff7a8a]" };

// Mock terminal: shows commands run by voice, and also accepts typed commands.
export default function Terminal({ lines, onRun }) {
  const [value, setValue] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  function submit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    onRun(value.trim());
    setValue("");
  }

  return (
    <section className="flex h-56 shrink-0 flex-col border-t border-line bg-[#0d1016]">
      <h2 className="border-b border-line px-4 py-2 text-xs font-semibold text-mute">Terminal</h2>
      <div className="flex-1 overflow-auto px-4 py-2 font-mono text-[13px] leading-5">
        {lines.map((l, i) => (
          <div key={i} className={COLORS[l.type]}>
            {l.type === "cmd" ? `$ ${l.text}` : l.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex items-center gap-2 border-t border-line px-4 py-2 font-mono text-[13px]">
        <span className="text-[#5fe0b0]">$</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="type a command, or say one"
          className="flex-1 bg-transparent outline-none placeholder:text-mute focus-visible:outline-none"
        />
      </form>
    </section>
  );
}
