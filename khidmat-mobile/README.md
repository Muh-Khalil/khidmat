# Khidmat — Mobile

Chat-first, voice-enabled mobile client for the Khidmat AI service orchestrator. Designed for customers and service providers in Pakistan, featuring conversational booking, voice messaging, marketplace quotes, a provider mini-CRM, and a customer dues ledger.

Built with **Expo SDK 54**, **React Native 0.81**, **Zustand**, and **NativeWind (Tailwind CSS)**.

---

## Key Features

1. **Agentic Voice & Text Chat (`app/(tabs)/index.tsx`)**:
   - Speak or type in Urdu, Roman Urdu, or English (e.g., *"AC cooling nahi kar raha, G-13 mein aaj sham ko koi bhej dein"*).
   - In-app audio recording with automatic transcription and dialect normalization.
   - Real-time Server-Sent Events (SSE) streaming revealing agent thoughts, understanding, provider search, and confirmed bookings.

2. **Phone Authentication & OTP (`app/auth.tsx`)**:
   - Support for customer and service provider roles.
   - Phone verification via SMS OTP (powered by Twilio Verify v2 in production, or instant dev code `1234`).
   - Secure PIN authentication and session persistence.

3. **Customer Dues & "Udhar" Ledger (`app/(tabs)/dues.tsx`)**:
   - Tracks credit balances, past payments, and pending dues between customers and technicians.

4. **Bookings & Job Tracking (`app/(tabs)/bookings.tsx` & `app/bookings/[id].tsx`)**:
   - Persisted booking records with operational lifecycle tracking (`requested` → `matched` → `dispatched` → `accepted` → `in_progress` → `completed`).
   - Retains the conversational reasoning and context behind each booking.

5. **Provider Mini-CRM (`app/provider/crm.tsx`)**:
   - Enables independent technicians to track offline clients, record appointments, and schedule automated reminders.

6. **Marketplace Bids & External Claims (`app/requests/[id].tsx` & `app/providers/external.tsx`)**:
   - Compare multiple quotes and visit fees from nearby providers before booking.
   - Discover and claim third-party business listings (Google Places) via mobile phone verification.

---

## App Routes & Screens

| Route | Screen / Purpose |
|---|---|
| `app/auth.tsx` | Phone registration, PIN login, and SMS OTP verification modal |
| `app/(tabs)/index.tsx` | Main AI conversational assistant (Voice recording + Chat thread) |
| `app/(tabs)/bookings.tsx` | Active and historical bookings list with status badges |
| `app/bookings/[id].tsx` | Booking details, technician info, and cancellation options |
| `app/(tabs)/dues.tsx` | Customer dues & credit ledger ("Khata") |
| `app/(tabs)/settings.tsx` | Sector selector (Islamabad F/G/E sectors), backend URL status, profile |
| `app/provider/crm.tsx` | Provider offline customer book & appointment calendar |
| `app/providers/external.tsx` | Google Places external technician discovery and claim challenge |
| `app/requests/[id].tsx` | Marketplace request status & provider quote comparison |

---

## Project Layout

```
app/
├── (tabs)/
│   ├── _layout.tsx         # Bottom tab navigation (Chat, Bookings, Dues, Settings)
│   ├── index.tsx           # Voice & text AI assistant screen
│   ├── bookings.tsx        # Customer booking history
│   ├── dues.tsx            # Dues / credit ledger screen
│   └── settings.tsx        # Settings, profile, and sector selection
├── bookings/[id].tsx       # Individual booking detail view
├── provider/crm.tsx        # Provider mini-CRM for offline clients & calendar
├── providers/external.tsx  # Google Places claiming screen
├── requests/[id].tsx       # Marketplace request quotes view
├── auth.tsx                # Phone authentication & OTP verification
└── _layout.tsx             # Root stack layout & keyboard providers
components/
├── ChatBubble.tsx          # Conversational messages & agent narration bubbles
├── ProviderCard.tsx        # Technician profile card with rating & distance
├── InputBar.tsx            # Text input with microphone audio recorder button
├── StatusBadge.tsx         # Job lifecycle status indicator
└── ChatLoaders.tsx         # Agent thinking & searching skeleton loaders
lib/
├── agent/                  # SSE stream parser and AgentEvent wire contract
├── stores/                 # Zustand stores (useAuthStore, useBookingsStore, useSettingsStore)
├── api/                    # HTTP client for REST & Voice endpoints
└── util/                   # Audio recording, Haversine geo distance, date formatters
```

---

## Local Development & Setup

### Prerequisites

- **Node.js**: v20 or higher
- **Expo Go**: Installed on your Android device (Google Play Store) or iOS device (App Store)
- Active **`khidmat-server`** running on your local network

---

### Step 1: Install Dependencies

```bash
cd khidmat-mobile
npm install
```

---

### Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```ini
# When testing on a PHYSICAL PHONE with Expo Go:
# Replace localhost with your development PC's local LAN IP (e.g. 192.168.1.50)
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.XX:5000

# When testing on Web or Desktop:
# EXPO_PUBLIC_API_BASE_URL=http://localhost:5000
```

> **Important**: Physical mobile phones cannot resolve `http://localhost`. Ensure your phone and PC are connected to the same Wi-Fi network and use your PC's local IP address (find it via `ipconfig` on Windows).

---

### Step 3: Start Expo Metro Bundler

```bash
npx expo start -c
```

- **Android (Expo Go)**: Scan the QR code displayed in your terminal using the Expo Go app.
- **iOS (Expo Go)**: Scan the QR code using the built-in iOS Camera app.
- **Web**: Press `w` in the terminal to open the web preview.

---

## Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm start` | `expo start` | Starts the Metro bundler |
| `npm run android` | `expo run:android` | Builds and launches on connected Android emulator/device |
| `npm run ios` | `expo run:ios` | Launches in iOS simulator (macOS only) |
| `npm run typecheck` | `tsc --noEmit` | Strict TypeScript verification |
| `npm run lint` | `eslint .` | Linting with Expo ESLint configuration |

---

## Wire Contract (Mobile ↔ Server)

The mobile client communicates with the server via:
1. **REST Endpoints**: `/api/auth/*`, `/api/jobs/*`, `/api/dues/*`, `/api/crm/*`, `/api/voice/transcribe`.
2. **SSE Streaming (`POST /chat`)**: Streams real-time `AgentEvent` payloads (`thought`, `understanding`, `searching`, `ranking`, `recommendation`, `booking`, `confirmed`).

See [lib/agent/types.ts](file:///d:/Dev/fyp-project/khidmat-mobile/lib/agent/types.ts) for full TypeScript wire interfaces.
