# Slot Backend Plan (GitHub Pages + Simple Server)

## Original ask
I have this slot machine app which is being published to github pages.

Right now, the entire app is front-end only.

It would be nice if we could track the user's wins on a small leaderboard, showing recent wins or top wins. It would also be cool if we limited the amount of credits each user had. Maybe give them 1000 credits per day, so they don't just have infinite money. But I'd like to do that without making them register, so something simple like tracking per IP address.

How can we approach this in a simple way? We are deploying the front end apo to github pages. Is there a simple way to make a backend to add these features? I guess we'll need a database. We could use the free teir of deno KV, or something else if there's a simpler solution. I'd like you to come up with a concise plan to acheivee this and work on a planning document in a markdown file in this repo that we can iterate on the plan

## 1) Goals
- Keep frontend hosted on GitHub Pages.
- Add a **daily credit cap** (e.g., 1000 credits/day/player).
- Add a small **leaderboard** (recent wins + top wins).
- Avoid user registration/login.
- Keep ops and cost low (free tier friendly).

## 2) Constraints and Reality Check
- GitHub Pages is static-only, so backend must be hosted separately.
- Without accounts, identity is best-effort only.
- **IP-only tracking is simple but imperfect**:
  - Shared IPs (households, schools, mobile carriers) can collide.
  - Users can bypass via VPN/mobile network changes.
- For this project scope, IP-based limits are acceptable if treated as casual anti-abuse, not strict security.

## 3) Recommended Stack (MVP)
- **API runtime:** Deno Deploy
- **Database:** Deno KV
- **Frontend hosting:** GitHub Pages (unchanged)

Why this fits:
- No server management.
- Free tier available.
- KV is enough for daily credits + leaderboard lists.
- JS/TS stack is straightforward to wire from current frontend.

## 4) High-Level Architecture
1. Frontend calls backend for each spin request.
2. Backend determines player key from IP (or IP hash).
3. Backend checks and updates daily remaining credits atomically.
4. Backend computes/validates spin result and records win (if any).
5. Backend returns spin result + updated balance + leaderboard snippets.

> Important: If you want real integrity, payout logic should run on backend, not frontend.

## 5) API Shape (MVP)
### `POST /api/spin`
Request:
```json
{ "gameId": "luckyscape", "betAmount": 10 }
```
Response:
```json
{
  "ok": true,
  "reelStops": [1, 4, 1],
  "winAmount": 50,
  "betAmount": 10,
  "remainingCredits": 940,
  "dailyBudget": 1000,
  "serverTime": 1760000000000
}
```

Validation rules:
- Reject if `betAmount <= 0`.
- Reject if `betAmount > remainingCredits`.
- Optional: enforce max bet.

### `GET /api/leaderboard/top?limit=20`
- Returns top wins (e.g., highest single win in last 7 days or all-time).

### `GET /api/leaderboard/recent?limit=20`
- Returns most recent wins.

### `GET /api/player/state`
- Returns `{ remainingCredits, dailyBudget, resetAt }`.

## 6) Data Model in Deno KV (simple keys)
Use UTC day buckets, e.g., `2026-02-18`.

- Player daily credits:
  - `['credits', dayKey, ipHash] -> { remaining: number, updatedAt: number }`
- Recent wins stream:
  - `['wins', 'recent', timestamp, eventId] -> { amount, gameId, at, playerTag }`
- Top wins index:
  - `['wins', 'top', paddedAmountDesc, eventId] -> { amount, gameId, at, playerTag }`

Implementation notes:
- Store **hashed IP** (`sha256(ip + serverSecret)`), not raw IP.
- `playerTag` should be short anonymous label, e.g., `"P-8F3A"`.
- Keep only latest N recent records (trim job during writes).

## 7) Credit Reset Strategy
- Daily reset is derived from UTC day key.
- First request of a new day initializes `remaining = 1000`.
- No cron required; lazy reset on access is enough.

## 8) Anti-Abuse and Fairness (MVP level)
- Use backend-side random + payout calculation.
- Add basic rate limiting per IP (e.g., requests/minute).
- Add CORS allowlist for your GitHub Pages origin.
- Never trust client-provided win amount.

## 9) Frontend Changes in This Repo
- Extend `src/api/backend.js` to support a real API base URL from env:
  - `VITE_API_BASE_URL`
- For production mode, call:
  - `POST {API_BASE}/api/spin`
  - `GET {API_BASE}/api/player/state`
  - leaderboard endpoints
- Keep current demo mode fallback for local/offline use.

## 10) Deployment Plan
### Phase 1 (1-2 sessions)
- Create Deno Deploy service with `/api/spin` + `/api/player/state`.
- Implement daily credit cap (1000).
- Wire frontend to call backend when `demoMode=false`.

### Phase 2 (fast follow)
- Move RNG + payout calculation to backend-authoritative flow.

### Phase 3
- Add recent/top leaderboard endpoints.
- Display leaderboard panel in UI.

### Phase 4
- Harden:
  - rate limits
  - CORS allowlist
  - better logging/metrics

## 11) Success Criteria
- User starts day with 1000 credits.
- Credits decrease by bet and increase by wins on backend response.
- User cannot bet above remaining credits.
- Recent/top wins populate consistently.
- Frontend on GitHub Pages works with remote API URL.

## 12) Risks / Tradeoffs
- IP identity is weak and not unique.
- No account recovery or persistent identity guarantees.
- Free tiers may impose throughput/storage limits.

## 13) Optional Alternative (if you want less custom backend code)
- **Supabase** (Postgres + Edge Functions) is a common simple option.
- Still no-login possible, but you will need RLS/public API design.
- Better querying than KV, but slightly more setup complexity.

## 14) Confirmed Next Iteration Decisions (2026-02-18)
1. Backend choice: **Deno Deploy + Deno KV**.
2. Leaderboard scope: **recent + top**.
3. Reset timezone: **UTC** (simplest implementation).
4. RNG approach: keep current flow for initial backend hookup, then **fast-follow to backend-authoritative RNG + payout**.

## 15) Implementation Status
### Completed in repo
- Added Deno backend scaffold at `backend/`.
- Implemented endpoints:
  - `GET /health`
  - `GET /api/player/state`
  - `POST /api/spin`
  - `GET /api/leaderboard/recent?limit=20`
  - `GET /api/leaderboard/top?limit=20`
- Implemented Deno KV storage for:
  - daily credits keyed by UTC day + hashed IP
  - recent wins + top wins indexes
- Extended frontend API client (`src/api/backend.js`) with:
  - `VITE_API_BASE_URL` support
  - `getPlayerState()`
  - `getRecentWins()`
  - `getTopWins()`

### Next implementation step
- Wire `GameController` to use backend credits as authoritative source (replace local-only `currentBalance` flow).
- Add leaderboard panel rendering from new API methods.
- Fast-follow: move RNG/payout rules to full backend-authoritative game logic matching LuckyScape features.
