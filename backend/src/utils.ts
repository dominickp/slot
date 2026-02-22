export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getIpHash(ip: string, secret: string): Promise<string> {
  const ipHash = await sha256Hex(`${ip}:${secret}`);
  console.log("ip hash", ipHash, ip);
  return ipHash;
}

export function getClientIp(
  request: Request,
  connInfo?: Deno.ServeHandlerInfo,
): string {
  const headersToCheck = ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"];

  for (const headerName of headersToCheck) {
    const raw = request.headers.get(headerName);
    if (raw) {
      // x-forwarded-for can be a list; the first one is the original client
      const first = raw.split(",")[0]?.trim();
      if (first) return first;
    }
  }

  // Fallback: Use Deno's native connection info if available
  if (connInfo?.remoteAddr.transport === "tcp") {
    return connInfo.remoteAddr.hostname;
  }

  return "unknown";
}
