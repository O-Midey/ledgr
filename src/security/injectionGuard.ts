import { InjectionDetectedError } from "@/types/errors";
import { MAX_USER_MESSAGE_LEN } from "@/lib/constants";

/**
 * Patterns that indicate prompt injection or instruction override attempts.
 * Ordered from most critical to supplementary signals.
 */
const INJECTION_PATTERNS: RegExp[] = [
  // Classic override phrases
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  /disregard\s+(all\s+)?previous\s+instructions?/i,
  /forget\s+(all\s+)?previous\s+instructions?/i,
  /you\s+are\s+now\s+[a-z]/i,
  /new\s+persona/i,
  // Exfiltration attempts
  /repeat\s+(your\s+)?(system\s+prompt|instructions)/i,
  /print\s+(your\s+)?(system\s+prompt|instructions)/i,
  /reveal\s+(your\s+)?(system\s+prompt|instructions|api\s+key)/i,
  /what\s+(is\s+)?your\s+system\s+prompt/i,
  /show\s+me\s+your\s+(prompt|instructions|configuration)/i,
  // Role escalation
  /act\s+as\s+(a\s+)?(developer|admin|root|superuser)/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /bypass\s+(security|restrictions?|safety)/i,
  /jailbreak/i,
  // Control token injection
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /\[SYSTEM\]/i,
  /###\s*instruction/i,
];

/** Control tokens to strip from user input before use. */
const CONTROL_TOKEN_PATTERNS: RegExp[] = [
  /<\|[^|>]{0,30}\|>/g,
  /\[INST\]|\[\/INST\]/g,
  /<<SYS>>|<\/SYS>>/g,
];

/**
 * Scan a user message for injection signals.
 * Throws InjectionDetectedError if a pattern matches.
 */
export function scanForInjection(input: string): void {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      throw new InjectionDetectedError(pattern.source);
    }
  }
}

/**
 * Sanitize user input by removing control tokens and trimming to max length.
 * Does NOT throw — use scanForInjection for blocking logic.
 */
export function sanitizeInput(input: string): string {
  let out = input.slice(0, MAX_USER_MESSAGE_LEN);
  for (const pattern of CONTROL_TOKEN_PATTERNS) {
    out = out.replace(pattern, "");
  }
  return out.trim();
}

/**
 * Sanitize tool output before it re-enters the model context.
 * Strips control tokens that could hijack subsequent turns.
 */
export function sanitizeToolOutput(output: string): string {
  let out = output;
  for (const pattern of CONTROL_TOKEN_PATTERNS) {
    out = out.replace(pattern, "");
  }
  return out;
}
