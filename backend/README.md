# Slot Backend (Deno Deploy + Deno KV)

Minimal backend for:
- Daily credits per anonymous player (IP hash)
- Win reporting endpoint (client handles all game logic)
- Recent/top leaderboard endpoints

## Endpoints
- `GET /health`
- `GET /api/player/state`
- `POST /api/report-win`
- `GET /api/leaderboard/recent?limit=20`
- `GET /api/leaderboard/top?limit=20`

## Local Run
Prereqs: Deno 2+

Note: local `Deno.openKv()` currently requires `--unstable-kv`.
The provided tasks already include it.

By default, local development uses a persistent KV file at `backend/data/local-kv.sqlite3`.

```bash
deno task --config backend/deno.json dev
```

The service should be running at http://localhost:8000


## Run tests

```bash
deno test src/main_test.ts
```

### Use hosted KV from local machine (via Deno tunnel)

To run local code against your hosted Deno Deploy KV, use managed mode + tunnel:

```bash
$env:KV_MODE='managed'
deno task --config backend/deno.json dev:managed
```

This is the recommended way to validate cloud KV behavior before production rollout.

---

### API Contract Change

**Note:** The backend no longer provides a `/api/spin` endpoint. All game logic (spins, bonus, etc.) is handled client-side. The client must POST the bet and win results to `/api/report-win` after each spin or bonus sequence:

```
POST /api/report-win
{
	betAmount: number,   // cost of spin or bonus
	winAmount: number,   // win amount for spin or bonus
	gameId?: string,     // optional game identifier
	bonusType?: string,  // optional bonus type
	...extra             // any extra metadata
}
```

The backend will deduct the bet, credit the win, update the player's balance, and record the win for the leaderboard.

If you run directly (without tasks), include:

```bash
KV_PATH=./backend/data/local-kv.sqlite3 deno run --unstable-kv --allow-net --allow-env --allow-read --allow-write backend/src/main.ts
```

To reset local KV state, stop the server and delete `backend/data/local-kv.sqlite3`.

## Environment Variables
- `APP_SECRET` (required in real deploy): used to hash IP
- `DAILY_BUDGET` (default `1000`)
- `MAX_RECENT_EVENTS` (default `1000`)
- `ALLOWED_ORIGINS` (comma-separated allowlist, optional)
- `KV_PATH` (optional local override for KV file path)
- `KV_MODE` (`auto` | `local` | `managed`, default `auto`)

`KV_MODE` behavior:
- `auto`: hosted KV on Deploy, local file KV on local machine
- `local`: always use local file KV
- `managed`: always use managed KV (pair with `--tunnel` task locally)

Example:

```bash
APP_SECRET="replace-me" DAILY_BUDGET=1000 ALLOWED_ORIGINS="https://<user>.github.io" deno task --config backend/deno.json start
```

## Deploy (Deno Deploy)
1. Create project from this repo.
2. Set entrypoint to `backend/src/main.ts`.
3. Add env vars (`APP_SECRET`, optional others).
4. Deploy.

Use the Deno Deploy public URL as your frontend `VITE_API_BASE_URL`.
