# WhoDat

A real-time multiplayer "Who/What Am I?" guessing game. Each player is secretly assigned a real Wikipedia identity (or a host-supplied custom name) and must figure out who they are by asking yes/no questions on their turn.

---

## How to Play

1. One player creates a room and shares the room code.
2. Others join via the code. The host can add AI bots and optionally paste a custom name list.
3. When the game starts every player is assigned a secret identity — visible to everyone **except** the player themselves.
4. Players take turns. On your turn you either:
   - **Ask a question** ("Am I alive?", "Am I a scientist?") — the AI answers Yes or No using Wikipedia context.
   - **Make a guess** — if correct you win. If wrong, play continues.
5. The game ends when someone guesses correctly, or when a majority of human players vote to end.

---

## Features

- Real-time multiplayer via Socket.IO
- AI bot opponents with distinct personas (Standard, Sherlock, Joker, Toddler)
- Wikipedia-backed secret identities with full article context for accurate Yes/No answering
- Custom identity lists — the host can paste any names; the backend looks them up on Wikipedia automatically
- End-game vote — majority of human players can end the game early
- Host can remove players/bots from the lobby before the game starts
- Game-over reveal screen showing each player's identity and Wikipedia summary
- Automatic stale-lobby cleanup every 10 minutes
- Clerk-based authentication

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3, Vite, Pinia, Vue Router, Socket.IO client |
| Auth (frontend) | @clerk/vue |
| Backend | Node.js, Express 5, Socket.IO server |
| Auth (backend) | @clerk/express |
| Database | SQLite via better-sqlite3 |
| AI — Q&A answering | Qwen2.5-0.5B-Instruct (local ONNX via @huggingface/transformers) |
| AI — Bot turns | Google Gemini 2.5 Flash Lite |
| Identity data | Wikipedia REST API + local SQLite cache |

---

## Project Structure

```
WhoDat/
├── backend/
│   └── src/
│       ├── index.ts           # Express + Socket.IO server entry point
│       ├── socket.ts          # All socket event handlers
│       ├── db/index.ts        # SQLite init and migrations
│       ├── middleware/auth.ts # Clerk JWT middleware
│       ├── routes/game.ts     # REST API routes
│       └── services/
│           ├── gameManager.ts # Core game logic (rooms, turns, voting, kicking)
│           ├── ai.ts          # Qwen (Q&A) + Gemini (bot turns) integration
│           ├── ai_personas.ts # Bot persona definitions and system prompts
│           ├── wikipedia.ts   # Wikipedia fetch helpers
│           └── wikiCache.ts   # Background cache population
└── frontend/
    └── src/
        ├── stores/game.ts     # Pinia store — all socket state and actions
        ├── router/            # Vue Router routes
        └── views/
            ├── HomeView.vue        # Lobby browser / join by code
            ├── CreateGameView.vue  # Room creation
            ├── LobbyView.vue       # Pre-game lobby (players, bots, custom names)
            └── GameView.vue        # Active game — questions, guesses, vote, reveal
```

---

## Environment Variables

### Backend — `backend/.env`

```env
PORT=8080

# Clerk
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...

# Google Gemini (for AI bot turns)
GEMINI_API_KEY=AIza...
```

### Frontend — `frontend/.env`

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install & run

```bash
# Backend
cd backend
npm install
npm run dev        # listens on http://localhost:8080

# Frontend (separate terminal)
cd frontend
npm install
npm run dev        # listens on http://localhost:5173
```

The backend populates the Wikipedia identity cache on first start — this runs in the background and may take a minute or two.

### Build for production

```bash
# Backend
cd backend && npm run build && npm start

# Frontend
cd frontend && npm run build
# serve the dist/ folder from your web server or the backend's static middleware
```

---

## AI Models

**Q&A answering (Qwen2.5-0.5B-Instruct)**
Downloaded automatically via `@huggingface/transformers` on first run. Stored in the Hugging Face cache (`~/.cache/huggingface`). Uses the `q4f16` ONNX quantization (~300 MB).

**Bot turn generation (Gemini)**
Requires a `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com). Free tier is sufficient for development.
