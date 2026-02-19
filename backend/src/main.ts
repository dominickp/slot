const DAILY_BUDGET = Number(Deno.env.get("DAILY_BUDGET") || 1000);
const MAX_LEADERBOARD_LIMIT = 50;
const DEFAULT_LEADERBOARD_LIMIT = 20;
const MAX_RECENT_EVENTS = Number(Deno.env.get("MAX_RECENT_EVENTS") || 1000);

const ALLOWED_ORIGINS = String(Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const APP_SECRET = String(Deno.env.get("APP_SECRET") || "dev-secret-change-me");
const IS_DEPLOY = Boolean(Deno.env.get("DENO_DEPLOYMENT_ID"));
const KV_PATH = String(Deno.env.get("KV_PATH") || "").trim();
const DEFAULT_LOCAL_KV_PATH = "./data/local-kv.sqlite3";
const KV_MODE = String(Deno.env.get("KV_MODE") || "auto").toLowerCase();

type CreditsRecord = {
  remaining: number;
  updatedAt: number;
  lastResetDay: string; // Tracks when the user last received their daily allowance
};

type WinEvent = {
  amount: number;
  gameId: string;
  at: number;
  playerTag: string;
};

function resolveKvTarget(): string | undefined {
  if (KV_MODE === "managed") {
    return undefined;
  }

  if (KV_MODE === "local") {
    return KV_PATH || DEFAULT_LOCAL_KV_PATH;
  }

  if (IS_DEPLOY) {
    return undefined;
  }

  return KV_PATH || DEFAULT_LOCAL_KV_PATH;
}

const kv = await Deno.openKv(resolveKvTarget());

function jsonResponse(body: unknown, status = 200, origin?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

function corsHeaders(origin?: string): HeadersInit {
  if (!origin) {
    return {
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    };
  }

  const isAllowed =
    ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);
  return {
    "access-control-allow-origin": isAllowed ? origin : "null",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  };
}

function getOrigin(request: Request): string | undefined {
  return request.headers.get("origin") || undefined;
}

function getClientIp(request: Request): string {
  const headersToCheck = ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"];

  for (const headerName of headersToCheck) {
    const raw = request.headers.get(headerName);
    if (!raw) {
      continue;
    }

    const first = raw.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return "unknown";
}

function getDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function createEventId(): string {
  return crypto.randomUUID();
}

function createPlayerTag(ipHash: string): string {
  return `P-${ipHash.slice(0, 4).toUpperCase()}`;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getIpHash(ip: string): Promise<string> {
  return sha256Hex(`${ip}:${APP_SECRET}`);
}

function creditsKey(ipHash: string): Deno.KvKey {
  // We store one persistent record per player.
  return ["credits", ipHash];
}

async function getOrInitCredits(
  dayKey: string,
  ipHash: string,
): Promise<CreditsRecord> {
  const key = creditsKey(ipHash);
  const existing = await kv.get<CreditsRecord>(key);

  if (existing.value) {
    let record = existing.value;

    // Apply daily top-up if it's a new day
    if (record.lastResetDay !== dayKey) {
      const updatedRemaining = Math.max(record.remaining, DAILY_BUDGET);
      record = {
        remaining: updatedRemaining,
        updatedAt: Date.now(),
        lastResetDay: dayKey,
      };
      await kv.set(key, record);
    }
    return record;
  }

  const initialRecord: CreditsRecord = {
    remaining: DAILY_BUDGET,
    updatedAt: Date.now(),
    lastResetDay: dayKey,
  };

  await kv.set(key, initialRecord);
  return initialRecord;
}

function parseLimit(url: URL): number {
  const raw = Number(
    url.searchParams.get("limit") || DEFAULT_LEADERBOARD_LIMIT,
  );
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_LEADERBOARD_LIMIT;
  }
  return Math.min(Math.floor(raw), MAX_LEADERBOARD_LIMIT);
}

async function trimRecentEvents(): Promise<void> {
  let count = 0;
  const keysToDelete: Deno.KvKey[] = [];

  for await (const entry of kv.list({ prefix: ["wins", "recent"] })) {
    count += 1;
    if (count > MAX_RECENT_EVENTS) {
      keysToDelete.push(entry.key);
    }
  }

  if (keysToDelete.length === 0) {
    return;
  }

  for (const key of keysToDelete) {
    await kv.delete(key);
  }
}

const MAX_TOP_WINS = 500;

async function trimTopWins(): Promise<void> {
  let count = 0;
  const keysToDelete: Deno.KvKey[] = [];
  for await (const entry of kv.list({ prefix: ["wins", "top"] })) {
    count += 1;
    if (count > MAX_TOP_WINS) {
      keysToDelete.push(entry.key);
    }
  }
  if (keysToDelete.length === 0) {
    return;
  }
  for (const key of keysToDelete) {
    await kv.delete(key);
  }
}

async function recordWinEvent(win: WinEvent): Promise<void> {
  const eventId = createEventId();
  const recentKey: Deno.KvKey = ["wins", "recent", win.at, eventId];
  const topKey: Deno.KvKey = ["wins", "top", -win.amount, win.at, eventId];

  await kv.set(recentKey, win);
  await kv.set(topKey, win);
  await trimRecentEvents();
  await trimTopWins();
}

async function updateCreditsWithRetry(
  dayKey: string,
  ipHash: string,
  betAmount: number,
  winAmount: number,
): Promise<
  | { ok: true; remaining: number }
  | { ok: false; reason: "INSUFFICIENT_CREDITS" }
> {
  const key = creditsKey(ipHash);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await kv.get<CreditsRecord>(key);

    // Default to a fresh state if the user has no record
    const base = current.value || {
      remaining: DAILY_BUDGET,
      updatedAt: Date.now(),
      lastResetDay: dayKey,
    };

    // Calculate effective balance based on daily rollover logic
    let effectiveRemaining = base.remaining;
    if (base.lastResetDay !== dayKey) {
      effectiveRemaining = Math.max(effectiveRemaining, DAILY_BUDGET);
    }

    if (betAmount > effectiveRemaining) {
      return { ok: false, reason: "INSUFFICIENT_CREDITS" };
    }

    const remaining = Math.max(0, effectiveRemaining - betAmount + winAmount);
    const next: CreditsRecord = {
      remaining,
      updatedAt: Date.now(),
      lastResetDay: dayKey,
    };

    const result = await kv.atomic().check(current).set(key, next).commit();
    if (result.ok) {
      return { ok: true, remaining };
    }
  }

  return { ok: false, reason: "INSUFFICIENT_CREDITS" };
}

async function handlePlayerState(request: Request): Promise<Response> {
  const origin = getOrigin(request);
  const ipHash = await getIpHash(getClientIp(request));
  const dayKey = getDayKey();
  const credits = await getOrInitCredits(dayKey, ipHash);

  return jsonResponse(
    {
      ok: true,
      remainingCredits: credits.remaining,
      dailyBudget: DAILY_BUDGET,
      resetAt: `${dayKey}T23:59:59.999Z`,
      serverTime: Date.now(),
    },
    200,
    origin,
  );
}

type ReportWinPayload = {
  betAmount: number;
  winAmount: number;
  gameId?: string;
  bonusType?: string;
  [key: string]: unknown;
};

async function handleReportWin(request: Request): Promise<Response> {
  const origin = getOrigin(request);
  let payload: ReportWinPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, error: "Invalid JSON payload" },
      400,
      origin,
    );
  }

  const betAmount = Number(payload.betAmount);
  const winAmount = Number(payload.winAmount);
  const gameId = String(payload.gameId || "luckyscape");
  const bonusType = payload.bonusType ? String(payload.bonusType) : undefined;

  if (!Number.isFinite(betAmount) || betAmount < 0) {
    return jsonResponse(
      { ok: false, error: "betAmount must be >= 0" },
      400,
      origin,
    );
  }
  if (!Number.isFinite(winAmount) || winAmount < 0) {
    return jsonResponse(
      { ok: false, error: "winAmount must be >= 0" },
      400,
      origin,
    );
  }

  const ipHash = await getIpHash(getClientIp(request));
  const playerTag = createPlayerTag(ipHash);
  const dayKey = getDayKey();

  const creditsUpdate = await updateCreditsWithRetry(
    dayKey,
    ipHash,
    betAmount,
    winAmount,
  );
  if (!creditsUpdate.ok) {
    return jsonResponse(
      { ok: false, error: creditsUpdate.reason },
      409,
      origin,
    );
  }

  if (winAmount > 0) {
    await recordWinEvent({
      amount: winAmount,
      gameId,
      at: Date.now(),
      playerTag,
    });
  }

  return jsonResponse(
    {
      ok: true,
      remainingCredits: creditsUpdate.remaining,
      betAmount,
      winAmount,
      gameId,
      bonusType,
      dailyBudget: DAILY_BUDGET,
      serverTime: Date.now(),
    },
    200,
    origin,
  );
}

async function handleLeaderboardRecent(request: Request): Promise<Response> {
  const origin = getOrigin(request);
  const url = new URL(request.url);
  const limit = parseLimit(url);

  const rows: WinEvent[] = [];
  for await (const entry of kv.list<WinEvent>(
    { prefix: ["wins", "recent"] },
    { reverse: true, limit },
  )) {
    if (entry.value) {
      rows.push(entry.value);
    }
  }

  return jsonResponse({ ok: true, rows }, 200, origin);
}

async function handleLeaderboardTop(request: Request): Promise<Response> {
  const origin = getOrigin(request);
  const url = new URL(request.url);
  const limit = parseLimit(url);

  const rows: WinEvent[] = [];
  for await (const entry of kv.list<WinEvent>(
    { prefix: ["wins", "top"] },
    { limit },
  )) {
    if (entry.value) {
      rows.push(entry.value);
    }
  }

  return jsonResponse({ ok: true, rows }, 200, origin);
}

Deno.serve((request) => {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(getOrigin(request)),
    });
  }

  if (url.pathname === "/health") {
    return jsonResponse(
      { ok: true, service: "slot-backend" },
      200,
      getOrigin(request),
    );
  }

  if (url.pathname === "/api/player/state" && request.method === "GET") {
    return handlePlayerState(request);
  }

  if (url.pathname === "/api/report-win" && request.method === "POST") {
    return handleReportWin(request);
  }

  if (url.pathname === "/api/leaderboard/recent" && request.method === "GET") {
    return handleLeaderboardRecent(request);
  }

  if (url.pathname === "/api/leaderboard/top" && request.method === "GET") {
    return handleLeaderboardTop(request);
  }

  return jsonResponse(
    { ok: false, error: "Not found" },
    404,
    getOrigin(request),
  );
});
