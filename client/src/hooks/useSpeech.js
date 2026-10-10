import { useCallback, useRef, useState } from "react";

// Thin wrapper around the browser Web Speech API (works in Chrome and Edge).
// onFinal(text) is called once per finished utterance.
export function useSpeech(onFinal) {
  const SpeechRecognition =
    typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  const recRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal; // always call the latest handler (fresh state)

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");

  const start = useCallback(() => {
    if (!SpeechRecognition || recRef.current) return;
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = true; // show words while the user is still talking
    rec.continuous = false; // one command per press

    rec.onstart = () => {
      setListening(true);
      setError("");
    };
    rec.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) onFinalRef.current(finalText.trim());
    };
    rec.onerror = (event) => setError(event.error);
    rec.onend = () => {
      setListening(false);
      setInterim("");
      recRef.current = null;
    };

    recRef.current = rec;
    rec.start();
  }, [SpeechRecognition]);

  const stop = useCallback(() => recRef.current?.stop(), []);

  return { supported: Boolean(SpeechRecognition), listening, interim, error, start, stop };
}
