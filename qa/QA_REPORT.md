# Khidmat Application QA Report

**Test date:** 2026-09-30  
**Scope:** `khidmat-mobile` (Expo/React Native/Web) and `khidmat-server` (Express/TypeScript, in-memory repository)  
**Safety:** Disposable accounts and in-memory data only. No production or third-party mutation.

## Executive Summary

Khidmat's core helper suite, authentication middleware, role separation, cross-account job access, dues ownership, validation boundaries, and web compilation are generally sound. All 57 existing automated tests passed, mobile TypeScript passed, and all 15 web routes exported successfully.

The build is **not release-ready** because a customer can supply `status: completed` when creating a job and then immediately create a provider review, bypassing the entire provider lifecycle. Other confirmed defects include an IDOR on review reads, a route-ordering failure that makes the favorites list unusable, acceptance of nonexistent favorites, malformed JSON returning 500, unrestricted CORS by default, and a failing mobile lint gate. Server type-checking could not finish even with a 4 GB heap and a three-minute timeout.

## Architecture and Inventory

- Client: Expo SDK 54, React Native 0.81, Expo Router, Zustand with AsyncStorage, NativeWind.
- Server: Express 4, Zod validation, bearer HMAC sessions, LangGraph/Gemini, SSE.
- Data: PostgreSQL/PostGIS/pgvector in configured environments; in-memory repository used for safe QA.
- Roles: customer and provider.
- Screens/routes: chat, auth/onboarding/reset, bookings list/detail, marketplace request detail, dues, settings, provider dashboard, provider CRM, external-provider discovery/claim.
- API groups: auth, chat/voice, providers, jobs/bookings, dues, marketplace requests/leads, external-provider claims, CRM.
- Existing tests: Node test runner; 57 tests across auth, geo/time/normalization, response/SSE helpers, repositories, marketplace/CRM, REST lifecycle, and voice.

## Test Statistics

| Result | Count |
|---|---:|
| Total executed cases | 93 |
| Passed | 83 |
| Failed | 8 |
| Blocked | 2 |
| Not tested | Native iOS/Android device behavior, real PostgreSQL/PostGIS/pgvector, Gemini, Twilio, Google Places, true slow/offline network, concurrency/load |

The 93 cases comprise 57 existing automated cases, 30 black-box API/security cases, and 6 build/browser quality gates.

## Confirmed Bugs

| Bug ID | Feature | Severity | Reproduction | Expected | Actual | Evidence / probable cause | Recommended fix |
|---|---|---|---|---|---|---|---|
| BUG-001 | Job lifecycle/reviews | **High** | Authenticate as customer; `POST /api/jobs` with valid data plus `status:"completed"`; then `POST /api/jobs/{id}/review`. | Creation starts only in a server-controlled initial state; review requires a legitimately completed lifecycle. | Job is created as completed (201), and review is accepted (201). | API `STATE-003/004`; `CreateJobSchema` accepts every lifecycle state and route spreads it into `createJob` at `src/schemas/api.ts:94`, `src/routes/jobs.ts:105`. | Remove client-controlled status from create schema; force `requested` server-side. Validate provider existence/assignment and completed transition audit before review. Add regression tests. |
| BUG-002 | Review authorization | **High** | Customer A creates/reviews a job; unrelated Customer B calls `GET /api/jobs/{id}/review`. | 403/404 unless requester owns the job or assigned provider. | 200 exposes review, customer/provider IDs, comment, and timestamp. | API `AUTHZ-010`; route reads by job ID without checking job ownership at `src/routes/jobs.ts:250-252`. | Load job first and reuse the same ownership check as `GET /api/jobs/:id`; return 404 or 403 consistently. |
| BUG-003 | Favorites list | **Medium** | Customer calls `GET /api/jobs/favorites`. | 200 with favorite IDs. | 404 `Job not found`, ID=`favorites`. | API `ROUTE-001`; dynamic `GET /:id` is registered at line 80 before static `GET /favorites` at line 291. | Move all static `/favorites` routes above `/:id`, or constrain the ID route pattern. |
| BUG-004 | Favorites integrity | **Medium** | Customer posts `{providerId:"does-not-exist"}` to `/api/jobs/favorites/toggle`. | 400/404. | 200 and nonexistent ID is stored as favorite. | API `VAL-003`; route calls `toggleFavoriteProvider` without provider lookup at `src/routes/jobs.ts:279-284`. | Validate ID type and provider existence before toggling; enforce FK in PostgreSQL. |
| BUG-005 | JSON error handling | **Low** | Send malformed JSON with `Content-Type: application/json` to `/api/auth/login`. | 400 malformed request. | 500 Internal Server Error. | API `AUTH-004`; generic error middleware maps body-parser `SyntaxError` to 500. | Detect `entity.parse.failed`/400 parser errors and return standardized 400 without stack details. |
| BUG-006 | CORS/security configuration | **Medium** | Send request with `Origin: https://evil.example` when `CORS_ORIGINS` is unset. | Explicit allowlist for a web-capable client or documented development-only behavior. | `Access-Control-Allow-Origin: *`. | API `SEC-001`; permissive fallback at `src/index.ts:27`; the project exports a web app. | Require an allowlist outside development; reject unknown origins. Keep native-client compatibility by allowing requests without `Origin`. |
| BUG-007 | Mobile lint/build quality | **Low** | Run `npm run lint` in mobile. | Exit 0. | Exit 1: 2 unescaped-entity errors and 14 warnings. | `components/provider/DuesLedgerCard.tsx:105`; missing hook dependencies and unused code elsewhere. | Fix JSX escaping, then resolve hook dependency warnings and dead imports. Enforce lint in CI. |
| BUG-008 | Small-screen home UX | **Low** | Render `/` at 390x844. | All labels remain fully visible and controls fit viewport. | External-provider CTA and microphone helper text clip horizontally. | `qa/home.png`; fixed/no-wrap content exceeds the available width. | Permit wrapping/shrinking, use responsive padding/font sizing, and add 320/375/390 px visual tests. |

## Additional Risks (Code-Confirmed, Not Counted as Reproduced Failures)

- Logout is client-side only. Tokens remain valid for 30 days (`src/lib/auth.ts:9`, `khidmat-mobile/lib/stores/useAuthStore.ts:184`). Add server-side revocation/token versioning if logout is expected to invalidate stolen tokens.
- The bearer token is persisted in AsyncStorage (`useAuthStore.ts:207`), which is not secure credential storage. Use platform Keychain/Keystore via SecureStore for native apps.
- No application-level rate limiter was found for login, OTP request/verification, or password reset. Twilio may rate-limit production OTP, but login still needs throttling.
- The global JSON body limit is 25 MB for every endpoint (`src/index.ts:28`), increasing memory-exhaustion exposure. Apply small defaults and a larger limit only to audio routes.
- Express advertises `X-Powered-By`. Disable it as inexpensive hardening.

## Detailed Black-Box Test Cases

Common precondition: local server on port 5101 using the in-memory repository; disposable customer/provider accounts. Evidence is in `qa/api_blackbox.latest.log`.

| Test ID | Feature | Steps / Input | Expected | Actual | Result | Severity |
|---|---|---|---|---|---|---|
| API-001 | Health | GET `/health` | 200, status ok | 200, in-memory ok | PASS | Low |
| API-002 | Error envelope | GET unknown route | JSON 404 | JSON 404 | PASS | Low |
| AUTH-001 | Authentication | Protected GET, no token | 401 | 401 | PASS | High |
| AUTH-002 | Authentication | Protected GET, malformed token | 401 | 401 | PASS | High |
| AUTH-003 | Login validation | POST empty object | 400 field errors | 400 | PASS | Medium |
| AUTH-004 | Parser handling | POST malformed JSON | 400 | 500 | **FAIL** | Low |
| AUTH-005 | Phone validation | Three-digit phone | 400 | 400 | PASS | Medium |
| AUTHZ-001 | Provider onboarding | Auth A with spoofed userId | 403 | 403 | PASS | High |
| VAL-001 | Provider boundaries | experience 51, rate 20001, radius 101 | 400 | 400 | PASS | Medium |
| AUTHZ-002 | Role isolation | Customer GET dues | 403 | 403 | PASS | High |
| AUTHZ-003 | Role isolation | Provider POST customer job | 403 | 403 | PASS | High |
| AUTHZ-004 | Ownership binding | POST job with another customerId | Server binds caller | Caller ID stored | PASS | High |
| AUTHZ-005 | IDOR prevention | Other customer GET job | 403 | 403 | PASS | High |
| AUTHZ-006 | Assignment | Unassigned provider accepts job | 403 | 403 | PASS | High |
| STATE-001 | Lifecycle | Accept directly from requested | 409 | 409 | PASS | Medium |
| STATE-002 | Duplicate/retry | Repeat invalid acceptance | 409 | 409 | PASS | Medium |
| AUTHZ-007 | Lifecycle role | Customer sets in_progress | 403 | 403 | PASS | High |
| STATE-003 | Lifecycle creation | Customer creates status completed | Reject | 201 completed | **FAIL** | High |
| STATE-004 | Review integrity | Review forged completed job | Reject | 201 | **FAIL** | High |
| AUTHZ-010 | Review privacy | Other customer GET review | 403/404 | 200 with data | **FAIL** | High |
| ROUTE-001 | Favorites | GET favorites | 200 list | 404 job lookup | **FAIL** | Medium |
| VAL-002 | Favorites validation | Toggle without providerId | 400 | 400 | PASS | Medium |
| VAL-003 | Referential integrity | Toggle nonexistent provider | 400/404 | 200 | **FAIL** | Medium |
| DUES-001 | Unicode/boundary | Amount 1, Urdu + emoji name | 201, preserved | 201, preserved | PASS | Medium |
| DUES-002 | Amount boundary | Amount 0 | 400 | 400 | PASS | Medium |
| AUTHZ-008 | Dues ownership | Other provider pays due | 404/403 | 404 | PASS | High |
| VAL-004 | Coordinates | lat 91, lng 181 | 400 | 400 | PASS | Medium |
| VAL-005 | Chat validation | Whitespace-only message | 400 | 400 | PASS | Medium |
| AUTHZ-009 | Chat role | Provider POST chat | 403 | 403 | PASS | High |
| SEC-001 | CORS | Arbitrary Origin header | Not wildcard | Wildcard | **FAIL** | Medium |

## Existing Regression Suite

All 57 existing cases passed: 2 constants, 4 sector mapping, 8 repository/marketplace/CRM, 2 auth crypto/session, 2 booking summary, 2 external claim privacy/signing, 4 geo, 2 lifecycle, 5 language normalization, 3 list parsing, 3 response envelope, 3 SSE framing, 10 time parsing, 5 REST API workflows, and 2 voice API cases.

## Build, Browser, Console, and Performance Checks

| Gate | Result | Evidence |
|---|---|---|
| Server tests | PASS | 57/57 in 4.4 s |
| Mobile TypeScript | PASS | `tsc --noEmit` exit 0 |
| Mobile lint | FAIL | 2 errors, 14 warnings |
| Web export/static rendering | PASS | 15 routes; JS bundle 2.9 MB, CSS 24.4 KB |
| Headless Chrome home route, 390x844 | PASS with UX defect | App rendered; screenshot `qa/home.png`; no crash screen |
| Server TypeScript | BLOCKED | Default heap OOM at ~2 GB; 4 GB run exceeded 3 minutes |
| Remaining interactive browser flows/console/network panel | BLOCKED | Chrome CLI could render one isolated route, but repeated profile sessions failed to emit artifacts reliably; no browser automation framework is installed |

The initial web JavaScript bundle is 2.9 MB, which is a performance concern for mobile web. Black-box API checks were generally fast (2–57 ms after warm-up; health startup sample 246 ms). No load/stress testing was performed.

## Coverage

Tested: authentication validation and token rejection; customer/provider role separation; provider onboarding boundaries; job creation/ownership/lifecycle; reviews; favorites; dues; marketplace coordinate validation; chat validation; JSON error handling; CORS; health/404 envelopes; helper libraries; repository flows; SSE framing/dispatch tests; voice API tests; web compilation and home rendering.

Code-reviewed: all server route groups, schemas, auth signing/hashing, client stores/fetch layer, route layouts, all app screens, and API call sites.

## Remaining Risks and Untested Areas

- PostgreSQL-specific constraints, transactions, migrations, PostGIS queries, pgvector ranking, and N+1 query behavior require a disposable real database.
- Gemini, Twilio Verify, Google Places, external claim completion, and real voice transcription require sandbox credentials or mocks with contract fixtures.
- Native microphone, location permissions, phone/WhatsApp deep links, haptics, keyboard behavior, screen-reader semantics, and iOS/Android layout require devices/emulators.
- Full browser interaction (clicks, history, refresh, duplicate submit, local-storage session reload, throttled/offline network, console/network capture) needs Playwright/Appium/Detox or a stable DevTools session.
- Concurrent request selection/job updates and database race behavior were not stressed; add transaction-level integration tests.
- Pagination/filtering/sorting are not implemented on list APIs, so scalability behavior could not be validated.

## Recommended Release Gate

Block release until BUG-001 through BUG-003 are fixed and regression-tested. Before public web deployment, also address BUG-006, secure token storage/revocation expectations, rate limiting, and the oversized global body limit. CI should require server/mobile typecheck, lint, unit/integration tests, and an automated browser smoke suite.

## Remediation Update — 2026-09-30

BUG-001 through BUG-008 were addressed and regression-tested:

- Job creation now ignores client lifecycle state, verifies the provider, and assigns only `requested` or `dispatched` server-side.
- Review reads now enforce customer/provider ownership.
- The favorites list route is registered before `/:id`; nonexistent providers are rejected.
- Duplicate lifecycle transitions are rejected with 409.
- Malformed JSON now returns 400; arbitrary browser origins no longer receive CORS permission; `X-Powered-By` is disabled.
- Mobile lint errors/warnings were resolved and narrow-screen labels now wrap/shrink.
- The server regression suite passes 58/58; the fixed black-box suite passes 30/30; mobile lint/typecheck and the 15-route web export pass.

The server TypeScript quality gate remains unresolved: semantic checking still exhausts a 4 GB Node heap. Runtime tests and `tsx` execution pass, but compiler memory behavior needs a focused dependency/type-isolation investigation before making server typecheck a reliable CI gate.
