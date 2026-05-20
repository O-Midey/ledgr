import { redactSensitive } from "@/lib/utils";

/**
 * Filter sensitive data from strings before they are streamed to the client
 * or written to logs.
 */
export function filterOutput(input: string): string {
  return redactSensitive(input);
}

/**
 * Deep-filter an object (e.g. tool result) before it reaches the client.
 * Converts to JSON string, redacts, parses back — safe for plain objects.
 */
export function filterObject<T>(obj: T): T {
  try {
    const raw = JSON.stringify(obj);
    const filtered = redactSensitive(raw);
    return JSON.parse(filtered) as T;
  } catch {
    return obj;
  }
}
