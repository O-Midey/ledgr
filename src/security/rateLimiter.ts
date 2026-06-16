import { RATE_LIMIT_RPM } from "@/lib/constants";

interface WindowRecord {
  count: number;
  windowStart: number;
}

const store = new Map<string, WindowRecord>();
const windowMs = 60_000; // 1 minute
let lastSweep = Date.now();

/** Drop expired windows so the per-IP map can't grow unbounded. */
function sweepExpired(now: number): void {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [ip, record] of store) {
    if (now - record.windowStart >= windowMs) store.delete(ip);
  }
}

/**
 * Sliding-window rate limiter keyed by IP.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkRateLimit(
  ip: string,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  sweepExpired(now);
  const record = store.get(ip);

  if (!record || now - record.windowStart >= windowMs) {
    store.set(ip, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (record.count < RATE_LIMIT_RPM) {
    record.count += 1;
    return { allowed: true };
  }

  const retryAfterMs = windowMs - (now - record.windowStart);
  return { allowed: false, retryAfterMs };
}
