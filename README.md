# Khidmat (خدمت) — Agentic AI Service Marketplace

**Khidmat** is an agentic AI-powered service orchestration platform designed specifically for hyperlocal home services in Pakistan (starting in Islamabad). It replaces rigid dropdown booking systems with an intuitive, conversational interface that natively understands English, Urdu, and Roman Urdu (both voice and text), while pairing users with local technicians using spatial PostGIS queries and pgvector semantic embeddings.

---

## Architecture Overview

```
                          ┌─────────────────────────────────────┐
                          │     Khidmat Mobile (Frontend)       │
                          │   Expo SDK 54 · React Native 0.81   │
                          │   Zustand · NativeWind · Voice AI   │
                          └──────────────────┬──────────────────┘
                                             │
                        HTTP REST / SSE      │ Voice Audio / Text
                        Auth & Live Events   │ Roman Urdu & English
                                             ▼
                          ┌─────────────────────────────────────┐
                          │     Khidmat Server (Backend)        │
                          │   Express 4 · LangGraph · Gemini    │
                          │   Spatial-Vector Hybrid Ranker      │
                          └──────────────────┬──────────────────┘
                                             │
                       PostgreSQL 15+ Client │ PostGIS Geometry & pgvector
                                             ▼
                          ┌─────────────────────────────────────┐
                          │   PostgreSQL + PostGIS + pgvector   │
                          │   Unified Spatial & Vector Database │
                          │   Users · Providers · Jobs · Dues   │
                          └─────────────────────────────────────┘
```

The repository is organized as a monorepo containing:
- **`khidmat-mobile/`**: Cross-platform Expo React Native app featuring conversational booking, voice messaging, marketplace quotes, provider mini-CRM, and a customer dues ledger.
- **`khidmat-server/`**: Express & LangGraph agent server backed by Gemini for natural-language orchestration, combined with a PostgreSQL database equipped with PostGIS (geographic radius) and pgvector (semantic skill matching).

---

## Key Features

1. **Agentic Conversational Orchestration**:
   - Multi-turn state machine powered by **LangGraph** and **Gemini Flash**.
   - Handles Urdu, Roman Urdu, and English seamlessly with speech-to-text audio input.
   - Clarifies ambiguities dynamically (urgency, location, preferred time slots).

2. **Unified Spatial & Vector Discovery**:
   - **PostGIS** geospatial indexing (`ST_DWithin`, `ST_Distance`) for sector-accurate kilometer calculations across Islamabad.
   - **pgvector** HNSW indexing for cosine similarity matching between customer job descriptions and provider skill embeddings.

3. **Two-Sided Marketplace & Dispatch Waves**:
   - Direct matching or multi-wave request dispatching where multiple nearby providers can submit quotes, visit fees, or custom timings.
   - Customer chooses the best offer; accepted quotes automatically turn into confirmed bookings.

4. **Provider Mini-CRM & "Udhar" / Dues Ledger**:
   - Offline customer book, appointments, and reminder notifications for independent tradespeople.
   - Micro-ERP dues ledger tracking credit ("udhar") and cash settlements.

5. **External Provider Discovery & Claims**:
   - Discovers third-party local business listings (e.g. Google Places) while enabling technicians to claim and verify their profiles via SMS challenge.

---

## Tech Stack

| Domain | Technology |
|---|---|
| **Mobile Runtime** | Expo SDK 54, React Native 0.81.5, React 19 |
| **Mobile Styling & State** | NativeWind (Tailwind CSS), Zustand, AsyncStorage |
| **Server Framework** | Node 20 (LTS), TypeScript (Strict), Express 4 |
| **AI & Agentic Graph** | `@langchain/langgraph`, `@langchain/google-genai` (Gemini 2.0 / 3.6 Flash) |
| **Database & Extensions** | PostgreSQL 15+, **PostGIS** (geospatial), **pgvector** (vector embeddings) |
| **Authentication & SMS** | PBKDF2/scrypt hashed credentials, Session Cookies, Twilio Verify v2 |

---

## Quick Start (Local Setup)

### Prerequisites

- **Node.js**: v20 or higher (`node -v`)
- **PostgreSQL**: v15 or higher with **PostGIS** and **pgvector** extensions installed
- **Expo Go**: Installed on your physical Android/iOS phone, or an active simulator
- **Google AI Studio API Key**: For Gemini Flash ([aistudio.google.com](https://aistudio.google.com/))

---

### Step 1: Database Setup & Migrations

1. Ensure your PostgreSQL service is running and create the `khidmat` database:
   ```sql
   CREATE DATABASE khidmat;
   ```
2. Navigate to the server folder and configure your `.env`:
   ```bash
   cd khidmat-server
   cp .env.example .env
   ```
   Set your `DATABASE_URL` and `GEMINI_API_KEY`:
   ```ini
   DATABASE_URL=postgresql://postgres:admin@localhost:5432/khidmat
   GEMINI_API_KEY=your_gemini_api_key_here
   AUTH_SECRET=a_random_32_character_secret_key
   ```
3. Run migrations and seed data in one step:
   ```bash
   npm run db:setup
   ```
   *(Applies `schema.sql`, incremental migrations in `src/db/migrations/`, and populates sample Islamabad providers and users from `seed.sql`)*.

---

### Step 2: Start the Backend Server

Inside `khidmat-server/`:
```bash
npm run dev
```
The server will start on `http://localhost:5000` with the log:
`[server] ... INFO Using PostgresDatabaseRepository with PostGIS & pgvector`

Verify health by opening `http://localhost:5000/health` in your browser.

---

### Step 3: Start the Mobile Client

In a second terminal window:
```bash
cd khidmat-mobile
cp .env.example .env
```

If testing on a physical phone with Expo Go, update `.env` to point to your development machine's local LAN IP:
```ini
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.XX:5000
```
*(If testing on Web or Android Emulator, `http://localhost:5000` or `http://10.0.2.2:5000` can be used).*

Install dependencies and launch Metro:
```bash
npm install
npx expo start -c
```
Scan the QR code with Expo Go on Android or the Camera app on iOS.

---

## Repository Structure

```
fyp-project/
├── README.md                      # Root monorepo guide (this file)
├── khidmat-mobile/                # Expo React Native mobile application
│   ├── app/                       # Expo Router screens (Chat, Bookings, Dues, CRM, Auth)
│   ├── components/                # Reusable UI widgets (ChatBubble, ProviderCard, Loaders)
│   ├── lib/                       # Stores (Zustand), API clients, audio recorder, utilities
│   └── package.json
└── khidmat-server/                # Express & LangGraph agent server
    ├── src/
    │   ├── agent/                 # LangGraph state machine, branch agents, and tools
    │   ├── db/                    # DB client, schema.sql, migrations/, repositories/
    │   │   ├── migrations/        # Incremental migration SQL scripts
    │   │   ├── repositories/      # Postgres & Memory repository implementations
    │   │   ├── migrate.ts         # Automated migration runner
    │   │   └── seed.ts            # Database seeder
    │   ├── routes/                # REST endpoints (auth, providers, dues, jobs, chat, voice)
    │   └── index.ts               # Express application entrypoint
    └── package.json
```

---

## Sub-Project Documentation

For in-depth details on each project layer:
- [Server Documentation & API Reference (khidmat-server/README.md)](file:///d:/Dev/fyp-project/khidmat-server/README.md)
- [Mobile Documentation & Wire Contracts (khidmat-mobile/README.md)](file:///d:/Dev/fyp-project/khidmat-mobile/README.md)
