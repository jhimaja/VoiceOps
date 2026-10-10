# VoiceOps

Hands-free code editing and navigation. Speak a command, Grok AI turns it into one of three
structured actions, and the mock IDE executes it.

| Action | Example | What happens |
|---|---|---|
| ACTION_EDIT | "Add a state variable called count" | Lines inserted/replaced/deleted in the active file |
| ACTION_NAVIGATE | "Go to line 12", "Open utils" | Cursor jumps or file switches |
| ACTION_TERMINAL | "Run npm test" | Command shown in the simulated terminal |

## Setup

```bash
npm run install:all          # installs root, server and client dependencies
cp server/.env.example server/.env
# optional: open server/.env and paste your GROK_API_KEY (starts with xai-)
npm run dev                  # server on :3001, client on :5173
```

Open http://localhost:5173 in **Chrome or Edge** (Web Speech API). Allow microphone access.

## Two modes
- **Grok mode**: a valid `xai-...` key is in `server/.env`. Natural language works.
- **Demo mode**: no key. A pattern matcher handles a fixed set of commands ("go to line 12", "open utils",
  "run npm test", "add a state variable called count", "delete the console log").
- The header badge shows the active mode. Add a key later by editing `server/.env` and restarting `npm run dev`.
- If Grok is unreachable (no Wi-Fi, quota), the server falls back to the demo parser automatically.

## Structure

```
voiceops/
├── package.json            root scripts (runs both apps with concurrently)
├── server/
│   ├── index.js            Express + Grok (OpenAI-compatible) tool calling (POST /api/command)
│   ├── demoParser.js       offline pattern-matching parser (demo mode)
│   ├── package.json
│   └── .env.example
└── client/
    ├── index.html
    ├── vite.config.js      Tailwind plugin + /api proxy to :3001
    └── src/
        ├── App.jsx         IDE dashboard, state, action executor
        ├── components/     Editor, ActionLog, Terminal
        ├── hooks/useSpeech.js
        └── lib/            applyEdit, mockTerminal, sampleFiles
```

## Hackathon vs production

- The terminal is simulated. Never run LLM-generated shell commands directly; a real version needs
  an allow-list, a sandbox/container and user confirmation.
- Edits live in React state only. A real version would use Monaco/CodeMirror plus the filesystem or LSP.
- No auth or rate limiting on `/api/command`; add both before exposing it.

# VoiceOps — AI-Powered Hands-Free Code Editor

VoiceOps is an accessibility-focused developer tool that translates natural spoken language into precise code refactoring, editor navigation, and terminal commands in real time using xAI's Grok API.

## 🚀 Key Features
- **Hands-Free Coding:** Edit, navigate, and execute code using natural speech.
- **Context-Aware Intent Parsing:** Converts fuzzy spoken input into structured editor actions (`ACTION_EDIT`, `ACTION_NAVIGATE`, `ACTION_TERMINAL`).
- **File Upload Support:** Import and edit local code files (`.js`, `.jsx`, `.py`, `.html`, `.css`, `.json`, `.md`).
- **Interactive UI:** Real-time line highlighting, visual action history log, and interactive terminal console.

## 🛠️ Tech Stack
- **Frontend:** React, Tailwind CSS, Vite, Web Speech API
- **Backend:** Node.js, Express.js
- **AI Integration:** xAI Grok API (`grok-2-latest` / OpenAI SDK)

## ⚙️ Local Setup Instructions

### Prerequisites
- Node.js (v18+)
- Google Chrome or Microsoft Edge (for Web Speech API support)
- xAI Grok API Key

### 1. Clone the repository
```bash
git clone [https://github.com/jhimaja/voiceops.git](https://github.com/jhimaja/voiceops.git)
cd voiceops

