# FourPlay — Connect Four Online

A responsive real-time Connect Four game built with React, Vite, Node.js, Express, and Socket.IO. Two players can create/join a room and play from separate devices. The server validates all moves and maintains the authoritative game state.

## Features

- Room creation and joining with a six-character code
- Red and Yellow player seats; guest names, no account required
- Real-time board synchronization using Socket.IO
- Server-side turn, column, win, and draw validation
- Horizontal, vertical, and diagonal win detection
- Rematches and room isolation
- 60-second reconnection grace period using a browser-held room token
- Abandoned room cleanup and a `/health` endpoint
- Responsive desktop/mobile interface and accessible labels
- Automated tests for game rules and room management

## Requirements

- Node.js 20 or newer
- npm 10 or compatible
- Git (for deployment)

## Run locally

From the repository root:

```bash
npm install
```

Create `client/.env.local`:

```env
VITE_SERVER_URL=http://localhost:4000
```

Create `server/.env` (or export these variables in your shell):

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

Start both apps in one terminal:

```bash
npm run dev
```

Open <http://localhost:5173>. The API health endpoint is <http://localhost:4000/health>.

Alternatively, run each app in a separate terminal:

```bash
npm run dev:server
npm run dev:client
```

## Tests and production build

```bash
npm test
npm run build
```

The server tests use Node's built-in test runner; no extra test framework is needed. The frontend production bundle is generated in `client/dist`.

## Deploy backend to Render

1. Push this repository to GitHub.
2. In Render, create a **Web Service** from the repository.
3. Set the service root directory to `server`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables:
   - `NODE_ENV=production`
   - `CLIENT_ORIGIN=https://YOUR-FRONTEND.vercel.app` (replace with the real Vercel origin; no trailing slash)
7. Deploy and verify `https://YOUR-BACKEND.onrender.com/health` returns JSON with `ok: true`.

The included `render.yaml` can be used as a starting point for Render Blueprint deployment. Set `CLIENT_ORIGIN` to the actual frontend origin after it is created.

## Deploy frontend to Vercel

1. Import the same GitHub repository into Vercel.
2. Set the project root directory to `client`.
3. Framework preset: Vite (usually auto-detected).
4. Add the environment variable `VITE_SERVER_URL=https://YOUR-BACKEND.onrender.com` (replace with your real backend URL; no trailing slash).
5. Deploy the frontend.
6. Copy the deployed frontend origin, then update Render's `CLIENT_ORIGIN` to that exact origin and redeploy/restart the backend if required.
7. Redeploy the frontend if you change `VITE_SERVER_URL`; Vite environment variables are embedded at build time.

The `client/vercel.json` rewrite ensures browser routes fall back to `index.html`.

## Production smoke test

Use two separate devices, ideally on different networks (for example, a laptop on Wi-Fi and a phone on mobile data):

1. Open the public Vercel URL on device A and create a room.
2. Copy the six-character room code and join from device B.
3. Confirm Red and Yellow names and the board appear on both screens.
4. Play alternating moves; verify both screens update without refresh.
5. Verify out-of-turn moves are rejected and full columns cannot accept another disc.
6. Play test games that win horizontally, vertically, and diagonally; also test a draw.
7. Reload a player browser or briefly disconnect its network; confirm the same player can rejoin within 60 seconds.
8. Leave one player disconnected for over 60 seconds; confirm the other player receives a forfeit win.
9. Play a rematch and confirm the board is reset.
10. Open a second room and confirm the games remain isolated.

## Game rules

- Board: 7 columns × 6 rows.
- Red starts; players alternate turns.
- A disc falls to the lowest empty slot in the selected column.
- Four connected discs horizontally, vertically, or diagonally win.
- A full board with no winner is a draw.
- The server is authoritative: clients send a column choice, never a claimed board or result.

## Architecture and limitations

- `client/`: React UI and Socket.IO client.
- `server/src/gameLogic.js`: board operations and win detection.
- `server/src/roomManager.js`: room seats, session tokens, reconnect timers, and cleanup.
- `server/src/index.js`: HTTP health route and Socket.IO event handlers.

Room state is held in process memory. This is appropriate for a small demo running on one server instance, but rooms are lost on server restarts and do not automatically share state across multiple backend instances. A scaled production version should use a shared store (such as Redis with a Socket.IO adapter) and durable persistence if needed. Hosting free-tier sleep/cold-start behavior can delay the first connection; check the provider's current plan limits.

## Socket events

Client → server:

- `room:create` `{ name }`
- `room:join` `{ code, name }`
- `room:rejoin` `{ code, token }`
- `game:move` `{ column }`
- `game:rematch` `{}`

Server → client:

- `game:state` sanitized room state
- `game:notice` disconnect / timeout notices

Action events use acknowledgement callbacks returning `{ ok: true, ... }` or `{ ok: false, error }`.
