import { useEffect, useRef } from "react";

// Read-only code view with a line-number gutter. The active line is highlighted,
// and lines touched by the last edit flash briefly.
export default function Editor({ fileName, code, activeLine, flash, onLineClick }) {
  const lines = code.split("\n");
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLine, fileName]);

  return (
    <div className="flex-1 overflow-auto bg-ink py-3 font-mono text-[13px] leading-6">
      {lines.map((text, i) => {
        const n = i + 1;
        const isActive = n === activeLine;
        const isFlash = flash && n >= flash.from && n <= flash.to;
        return (
          <div
            key={`${flash?.id ?? 0}-${n}`}
            ref={isActive ? activeRef : null}
            onClick={() => onLineClick(n)}
            className={`flex cursor-pointer ${isActive ? "bg-[#1f2636]" : "hover:bg-[#161a23]"} ${isFlash ? "vo-flash" : ""}`}
          >
            <span
              className={`w-12 shrink-0 select-none pr-4 text-right ${
                isActive ? "border-r-2 border-[#7c8cff] text-[#aab4ff]" : "border-r-2 border-transparent text-mute"
              }`}
            >
              {n}
            </span>
            <pre className="whitespace-pre pl-4">{text || " "}</pre>
          </div>
        );
      })}
    </div>
  );
}
