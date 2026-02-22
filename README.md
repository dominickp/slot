# Slot Machine - Le Dancer

A dance-game-themed slot with game mechanics borrowed from "Le Bandit".

## Note
This is an **educational/demo project**, not intended for real gambling.

## Quick Start

### Prerequisites
- Node.js 16+ (for development)
- Modern browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:5173
```

### Local build options

```bash
# Normal local build
npm run build

# Simulate GitHub Pages base path locally (bash)
VITE_BASE_PATH=/slot/ npm run build

# Simulate GitHub Pages base path locally (PowerShell)
$env:VITE_BASE_PATH='/slot/'
npm run build
```

### Tests

```
npm run test
npm test -- src/games/luckyscape/rtpBenchmark.test.js
```

## Backend (Deno Deploy)

This repo now includes a backend scaffold in `backend/` for daily credits and leaderboards.

### Frontend env

Set API base URL for real backend mode:

```bash
# .env.local
VITE_API_BASE_URL=https://<your-deno-deploy-url>
```

### Backend local run

```bash
# Requires Deno 2+ (task includes --unstable-kv for Deno KV)
deno task --config backend/deno.json dev
```

See `backend/README.md` for endpoint details and deploy steps.
