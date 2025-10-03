# Chat POC

A proof of concept that combines a Node.js backend with a Vue 3 frontend to deliver a lightweight real-time chat experience. The goal is to showcase end-to-end messaging with persistence, WebSocket updates, and a modern database access layer built on Drizzle ORM.

## Architecture At A Glance
- **Backend (`/backend`)**: Express REST API plus Socket.IO gateway. Uses Drizzle ORM on top of a shared `pg` connection pool to store messages in Postgres. Redis powers the Socket.IO Redis adapter so additional backend instances can share events.
- **Frontend (`/frontend`)**: Vite + Vue 3 single-page client. Consumes REST endpoints for history and connects to Socket.IO for live updates.
- **Infrastructure**: Docker Compose spins up Postgres and Redis with local ports exposed (35432 and 36379 respectively). Plain SQL migrations live in `backend/sql` for quick seeding.

## Data Flow
1. A browser loads the Vue client and fetches `/api/messages` to display the latest chat history.
2. When a user submits a message, the frontend emits the `chat:send` Socket.IO event.
3. The backend validates the payload, inserts it through Drizzle (`messages` table), and emits `chat:message` to all sockets.
4. Every connected client receives the event and prepends the message to its local timeline.

## Backend Details
- **Runtime**: Node 20+, ECMAScript modules throughout.
- **Frameworks**: Express 4, Socket.IO 4, Drizzle ORM (`drizzle-orm/node-postgres` driver), ioredis.
- **Schema**: `backend/src/db/schema/messages.js` mirrors the SQL definition from `backend/sql/script-01.sql` (id, userId, content, createdAt).
- **Key Modules**:
  - `src/server.js` – entry point wiring HTTP, Socket.IO, graceful shutdown.
  - `src/app.js` – Express app, JSON middleware, routes, and error handler.
  - `src/routes/index.js` – REST endpoints (`GET /api/health`, `GET/POST /api/messages`).
  - `src/sockets/index.js` – Socket.IO events plus Redis adapter.
  - `src/dao/messageDAO.js` – Drizzle-based inserts and selects for the `messages` table.
  - `src/db/index.js` – central Drizzle instance and schema exports.

## Frontend Details
- **Stack**: Vue 3 with `<script setup>`, Vite dev server, Socket.IO client.
- **Behavior**: Generates a random user id per session, fetches recent history on mount, and listens for `chat:message` events to update the timeline instantly.
- **Location**: Source lives under `frontend/src` with the main UI in `App.vue`.

## Getting Started Locally
1. **Install dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
2. **Prepare environment variables**
   ```bash
   cd ../backend
   cp .env.example .env
   ```
3. **Start infrastructure**
   ```bash
   cd ..
   docker compose up -d
   ```
4. **Apply database schema** (if running for the first time)
   ```bash
   cd backend
   psql "$PG_URI" -f sql/script-01.sql
   ```
5. **Run the backend**
   ```bash
   npm run dev
   ```
6. **Run the frontend**
   ```bash
   cd ../frontend
   npm run dev
   ```
7. Open the Vite URL (default `http://localhost:5173`) to interact with the chat UI. The backend listens on `http://localhost:3000` by default.

## Socket Events & REST API
- **Socket.IO**
  - `chat:send` (client ? server): `{ userId: string, content: string }`
  - `chat:message` (server ? clients): persisted message record including `id` and `createdAt`
- **REST**
  - `GET /api/health` ? `{ ok: true, uptime }`
  - `GET /api/messages?limit=50&beforeId=123` ? paginated history ordered by newest first
  - `POST /api/messages` ? same payload as Socket.IO, responds with stored record

## Development Tips
- The backend uses Redis even in single-instance mode to keep the adapter path ready for scaling; make sure Redis is running before booting the server.
- Drizzle automatically maps camelCase properties from the `messages` table. The DAO methods return plain JavaScript objects ready for the API response.
- You can run `node --input-type=module -e "await import('./src/app.js')"` inside `backend` to smoke-test module loading without launching the whole server.

## Ideas For Future Iterations
- Replace the raw SQL migration with Drizzle kit migrations for better change tracking.
- Add authentication to associate messages with real users.
- Streamline frontend build output into a static bundle served by the Express app for a single deployment artifact.
- Instrument logging/monitoring (eg. pino + OpenTelemetry) to observe chat traffic in production scenarios.

Enjoy experimenting with the stack and feel free to extend it in any direction (presence indicators, message reactions, typing notifications, etc.).
