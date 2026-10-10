import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { parseDemo } from "./demoParser.js";

const PORT = process.env.PORT || 3001;
const MODEL = process.env.GROK_MODEL || "grok-4-1-fast-non-reasoning";

// A real xAI key starts with "xai-". Anything else (empty, placeholder) means demo mode.
const apiKey = process.env.GROK_API_KEY || "";
const hasKey = apiKey.startsWith("xai-");
const DEMO_MODE = process.env.DEMO_MODE === "true" || !hasKey;

// Grok speaks the OpenAI protocol, so we use the official `openai` package and just change the base URL.
const grok = hasKey ? new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" }) : null;

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------------------------
// Tool definitions in OpenAI "function calling" format.
// Each tool maps 1:1 to one VoiceOps action type.
// With tool_choice: "required" the model MUST call one of them.
// ---------------------------------------------------------------------------
const tools = [
  {
    type: "function",
    function: {
      name: "edit_code",
      description:
        "Insert, replace or delete code in the ACTIVE file. Use for requests like " +
        "'add a state variable called count', 'rename this function', 'delete line 5'. " +
        "A single request may need several edits (e.g. an import at the top AND a new line in the body).",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "One short sentence describing the change, for the history log.",
          },
          edits: {
            type: "array",
            description:
              "List of edits. ALL line numbers refer to the ORIGINAL numbered code, not to the result of earlier edits. " +
              "Edits must not overlap.",
            items: {
              type: "object",
              properties: {
                mode: {
                  type: "string",
                  enum: ["insert", "replace", "delete"],
                  description:
                    "insert = add new_code AFTER start_line (0 means top of file). " +
                    "replace = overwrite lines start_line..end_line with new_code. " +
                    "delete = remove lines start_line..end_line.",
                },
                start_line: {
                  type: "integer",
                  description: "1-based line number. For insert: the line to insert AFTER.",
                },
                end_line: {
                  type: "integer",
                  description: "1-based inclusive end line. Required for replace/delete. Omit for insert.",
                },
                new_code: {
                  type: "string",
                  description:
                    "Raw code only: no markdown fences, no line numbers. Match the file's indentation. Omit for delete.",
                },
              },
              required: ["mode", "start_line"],
            },
          },
        },
        required: ["summary", "edits"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate",
      description:
        "Move the cursor to a line in the active file, or open a different file. " +
        "Use for 'go to line 20', 'open utils', 'jump to the handleClick function'.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "One short sentence for the history log." },
          target_type: { type: "string", enum: ["line", "file"] },
          line: {
            type: "integer",
            description:
              "1-based line number. Required when target_type is 'line'. " +
              "If the user names a function or symbol, find it in the numbered code and use its line.",
          },
          file_name: {
            type: "string",
            description: "Exact name from the available files list. Required when target_type is 'file'.",
          },
        },
        required: ["summary", "target_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_terminal",
      description:
        "Run a shell command in the terminal panel. Use for 'run npm test', 'install axios', 'git status'.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "One short sentence for the history log." },
          command: {
            type: "string",
            description: "The exact command only, e.g. 'npm test'. No explanation, no backticks.",
          },
        },
        required: ["summary", "command"],
      },
    },
  },
];

// Tool name -> VoiceOps action type (what the client understands)
const TOOL_TO_ACTION = {
  edit_code: "ACTION_EDIT",
  navigate: "ACTION_NAVIGATE",
  run_terminal: "ACTION_TERMINAL",
};

const SYSTEM_PROMPT = `You are the command parser inside VoiceOps, a voice-controlled code editor.
The user speaks a command; you turn it into exactly ONE tool call.

Rules:
- The text comes from speech recognition and may contain mistakes (homophones, missing punctuation). Infer the intent.
- The code is shown with line numbers like "12| code". Use those numbers for start_line/end_line. Never include them in new_code.
- "here", "this line" or "this" means the cursor line given in the request.
- For edits, produce minimal, correct code that fits the file's language and style. If the change needs an import (for example useState for a React state variable), add it as a second edit in the same call. All line numbers refer to the ORIGINAL numbered code.
- For navigation to a file, pick the closest match from the available files list.
- For terminal commands, return only the command.
- Always call a tool. Never reply with plain text.`;

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, mode: DEMO_MODE ? "demo" : "grok", model: MODEL })
);

app.post("/api/command", async (req, res) => {
  const { transcript, fileName, code, cursorLine, fileNames } = req.body ?? {};

  if (!transcript || typeof transcript !== "string") {
    return res.status(400).json({ error: "transcript is required" });
  }

  // No key: use the offline pattern-matching parser.
  if (DEMO_MODE) {
    try {
      return res.json({ action: parseDemo(transcript, code, fileNames), mode: "demo" });
    } catch (err) {
      return res.status(422).json({ error: err.message });
    }
  }

  const numbered = String(code ?? "")
    .split("\n")
    .map((line, i) => `${i + 1}| ${line}`)
    .join("\n");

  const userMessage = [
    `Spoken command: "${transcript}"`,
    ``,
    `Active file: ${fileName}`,
    `Cursor line: ${cursorLine}`,
    `Available files: ${(fileNames ?? []).join(", ")}`,
    ``,
    `Active file contents:`,
    numbered,
  ].join("\n");

  try {
    const completion = await grok.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 2048,
      temperature: 0, // we want a deterministic parse, not creativity
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      tools,
      tool_choice: "required", // the model must call a tool
    });

    // OpenAI-style response: choices[0].message.tool_calls[0].function = { name, arguments (JSON string) }
    const toolCall = completion.choices?.[0]?.message?.tool_calls?.[0];
    const toolName = toolCall?.function?.name;
    if (!toolCall || !TOOL_TO_ACTION[toolName]) {
      return res.status(502).json({ error: "Grok did not return a valid action." });
    }

    let args;
    try {
      args = JSON.parse(toolCall.function.arguments || "{}");
    } catch {
      return res.status(502).json({ error: "Grok returned malformed tool arguments." });
    }

    // Same response shape the client already expects: { action: { type, ...fields } }
    res.json({
      action: { type: TOOL_TO_ACTION[toolName], ...args },
      mode: "grok",
      model: MODEL,
    });
  } catch (err) {
    console.error("Grok API error:", err?.message ?? err);
    // Fallback: if Grok is unreachable (no Wi-Fi, quota), try the offline parser so the demo keeps going.
    try {
      const action = parseDemo(transcript, code, fileNames);
      return res.json({ action: { ...action, summary: `[offline fallback] ${action.summary}` }, mode: "fallback" });
    } catch {
      return res.status(500).json({ error: err?.message ?? "Grok API request failed" });
    }
  }
});

app.listen(PORT, () =>
  console.log(
    `VoiceOps server on http://localhost:${PORT} | mode: ${
      DEMO_MODE ? "DEMO (no AI, pattern matching)" : "GROK (" + MODEL + ")"
    }`
  )
);
