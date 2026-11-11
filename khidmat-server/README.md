# Khidmat — Server

Agentic backend for the Khidmat AI service orchestrator. Combines conversational AI (LangGraph + Gemini Flash) with a high-performance spatial-vector PostgreSQL backend (PostGIS + pgvector) to match, dispatch, and manage hyperlocal home service requests across Islamabad.

---

## Architecture & Capabilities

1. **Agentic Conversational Orchestration**:
   - Multi-turn state machine powered by `@langchain/langgraph` and `@langchain/google-genai`.
   - Native comprehension of Urdu, Roman Urdu, and English across both voice and text inputs.
   - Emits Server-Sent Events (SSE) tracing agent thoughts, slot extractions, provider rankings, and booking confirmations.

2. **Dual Database Architecture (Postgres + In-Memory Fallback)**:
   - **PostgreSQL 15+**: Uses **PostGIS** (`ST_DWithin`, `ST_Distance`) for sector-accurate kilometer radiuses and **pgvector** for 768-dimensional skill cosine similarity ranking.
   - **In-Memory Store**: Auto-activates if `DATABASE_URL` is omitted or PostgreSQL is unreachable, allowing zero-dependency local testing.

3. **Two-Sided Marketplace & Dispatch Waves**:
   - Customer service requests can be dispatched in ranking waves to candidate technicians.
   - Technicians submit competitive bids/quotes, visit fees, or custom timing options.

4. **Micro-ERP Dues & Provider Mini-CRM**:
   - Khata/dues ledger tracking customer credit ("udhar") and cash settlements.
   - Mini-CRM for offline customer management, appointments, and reminder notifications.

5. **External Provider Discovery & Verification**:
   - Ingests third-party listings (e.g. Google Places) with strict privacy boundaries until verified by technicians via phone/SMS challenges.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node 20 (LTS) + TypeScript 5.9 (Strict) |
| Web Framework | Express 4 |
| Agent Orchestrator | `@langchain/langgraph` (state machine, conditional branching, multi-turn) |
| LLM | Google Gemini 2.0 / 3.6 Flash via `@langchain/google-genai` |
| Database | PostgreSQL 15+ with **PostGIS** and **pgvector** |
| Database Client | `pg` + `pgvector` |
| Validation | Zod |

---

## Project Layout

```
src/
├── agent/
│   ├── config.ts           # Typed accessors for RunnableConfig
│   ├── eventQueue.ts       # Producer/consumer queue feeding SSE streams
│   ├── events.ts           # AgentEvent wire contract (mirrors mobile client)
│   ├── graph.ts            # LangGraph: intent classification → branch agents → tools
│   ├── prompts.ts          # System prompts (Roman Urdu normalizer, classifier, tools)
│   ├── runAgent.ts         # AsyncGenerator bridging graph events to SSE
│   ├── sessions.ts         # Thread state with 1-hour idle eviction
│   └── tools.ts            # 9 agent tools (search, rank, verify, book, remind)
├── config/
│   ├── constants.ts        # Earth radius, reminder lead times, scoring weights
│   └── env.ts              # Validated environment configuration (fails fast on boot)
├── db/
│   ├── migrations/         # Incremental SQL migration scripts (001 - 004)
│   ├── repositories/       # PostgresDatabaseRepository & MemoryDatabaseRepository
│   ├── client.ts           # PostgreSQL connection pool & pgvector registration
│   ├── index.ts            # Dynamic repository resolver (Postgres or In-Memory)
│   ├── migrate.ts          # Migration runner (applies schema.sql + migrations/)
│   ├── seed.ts            # Seeder populating demo users, providers, and dues
│   ├── schema.sql          # Unified spatial-vector and relational SQL schema
│   ├── seed.sql            # Seed dataset for Islamabad sectors
│   └── types.ts            # Core database entity & repository interfaces
├── lib/
│   ├── bookings.ts         # Booking summary formatter for prompts
│   ├── gemini.ts           # Gemini LLM client singleton
│   ├── geo.ts              # Pure Haversine distance calculator
│   ├── logger.ts           # Structured timestamped server logger
│   ├── requestLogger.ts    # HTTP request/response latency logger
│   ├── responseHandler.ts  # Standardized API response envelopes
│   ├── sse.ts              # SSE headers and event writer helpers
│   └── time.ts             # Time parsing and slot validation utilities
├── routes/
│   ├── auth.ts             # User/Provider registration, login, phone OTP verification
│   ├── chat.ts             # POST /chat (SSE conversational booking stream)
│   ├── crm.ts              # Provider mini-CRM (offline customers, appointments)
│   ├── dues.ts             # Customer dues & credit ledger (/api/dues)
│   ├── externalProviders.ts# Google Places provider claiming & verification
│   ├── jobs.ts             # Job lifecycle, updates, and live dispatch SSE streams
│   ├── marketplace.ts      # Multi-wave service requests & provider lead bids
│   ├── providers.ts        # Spatial search, profile lookup, status toggle
│   └── voice.ts            # Speech-to-text audio transcription & Roman Urdu normalization
└── index.ts                # Express server bootstrap & graceful shutdown
```

---

## Local Development & Setup

### 1. Configure Environment

Copy the template and configure your secrets:
```powershell
cp .env.example .env
```

Key variables inside `.env`:
```ini
PORT=5000
DATABASE_URL=postgresql://postgres:admin@localhost:5432/khidmat
GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio
AUTH_SECRET=a_random_secret_string_minimum_32_characters
```

### 2. Database Migration & Seeding

Ensure PostgreSQL is running, then run:
```powershell
# Run migrations and seed data in one step
npm run db:setup

# Or run individually:
npm run db:migrate   # Applies schema.sql + src/db/migrations/
npm run db:seed      # Populates Islamabad demo providers, users, and dues
```

### 3. Run Server

```powershell
npm run dev
```
The server will boot on `http://localhost:5000`. You will see:
`[server] ... INFO Using PostgresDatabaseRepository with PostGIS & pgvector`

---

## Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `tsx watch src/index.ts` | Development server with hot reload on file changes |
| `npm run db:migrate` | `tsx src/db/migrate.ts` | Runs `schema.sql` and all pending migrations in `src/db/migrations/` |
| `npm run db:seed` | `tsx src/db/seed.ts` | Populates database with sample Islamabad technicians & dues |
| `npm run db:setup` | `tsx src/db/migrate.ts && tsx src/db/seed.ts` | Full database setup (migrate + seed) |
| `npm test` | `node --import tsx --test src/**/*.test.ts` | Executes full 57+ unit & API integration test suite |
| `npm run typecheck` | `tsc --noEmit` | Strict TypeScript compilation check |
| `npm run build` | `tsc` | Compiles TypeScript codebase to `dist/` |
| `npm start` | `node dist/index.js` | Runs the compiled production server |

---

## REST & SSE API Reference

### Health & Server Info
- `GET /health`: Server status, database driver in use (`postgresql` or `in-memory`), uptime.
- `GET /`: Service metadata and list of available root endpoints.

### Conversational AI & Voice
- `POST /chat` (or `POST /api/chat`): Accepts user text/session, opens an SSE stream emitting `thought`, `understanding`, `searching`, `ranking`, `recommendation`, `booking`, `confirmed`.
- `POST /api/voice/transcribe`: Accepts audio base64, transcribes via Gemini/Whisper, and normalizes Roman Urdu slang into standardized sector and intent terms.

### Authentication (`/api/auth`)
- `POST /api/auth/register`: Create customer or provider account.
- `POST /api/auth/login`: Phone + PIN password login; returns session token.
- `POST /api/auth/otp/send`: Initiates SMS verification (Twilio Verify or dev PIN `1234`).
- `POST /api/auth/otp/verify`: Confirms OTP code and verifies phone.
- `GET /api/auth/me`: Retrieves current authenticated user profile.
- `POST /api/auth/logout`: Clears session.

### Providers & Spatial Matching (`/api/providers`)
- `GET /api/providers/search?category=ac&lat=33.647&lng=72.951&radiusKm=10`: Spatial PostGIS search ranked by distance, rating, and cosine similarity.
- `GET /api/providers/:id`: Provider details including availability slots and rating.
- `POST /api/providers/onboard`: Register a technician profile with service radius.
- `PATCH /api/providers/:id/status`: Toggle online/offline availability.

### Jobs & Live Dispatch (`/api/jobs`)
- `POST /api/jobs`: Create and dispatch a new booking.
- `GET /api/jobs/customer/:customerId`: Retrieve bookings for a specific customer.
- `GET /api/jobs/provider/:providerId`: Retrieve jobs assigned to a technician.
- `PATCH /api/jobs/:id/status`: Transition lifecycle: `requested` → `matched` → `dispatched` → `accepted` → `in_progress` → `completed` / `cancelled`.
- `GET /api/jobs/provider/:providerId/live`: SSE stream for real-time incoming job dispatch alerts.

### Marketplace Fulfillment (`/api/marketplace`)
- `POST /api/marketplace/requests`: Post a service request for multi-provider bidding.
- `GET /api/marketplace/requests/:id`: View request status and received provider bids.
- `POST /api/marketplace/leads/:dispatchId/respond`: Provider accepts lead and proposes quote/time.
- `POST /api/marketplace/requests/:id/choose`: Customer selects winning bid, creating a confirmed job.

### Provider Mini-CRM & Dues (`/api/crm` & `/api/dues`)
- `GET /api/dues/provider/:providerId`: Provider's receivables / udhar ledger.
- `POST /api/dues`: Record a new due or unpaid balance.
- `PATCH /api/dues/:id/status`: Mark due as `paid`.
- `GET /api/crm/customers`: Offline customer directory for providers.
- `POST /api/crm/appointments`: Schedule non-marketplace direct customer appointments.

### External Provider Discovery (`/api/external-providers`)
- `GET /api/external-providers/search`: Search unclaimed Google Places listings.
- `POST /api/external-providers/claim`: Initiate technician ownership claim challenge.
- `POST /api/external-providers/verify`: Verify phone SMS challenge to activate profile.
