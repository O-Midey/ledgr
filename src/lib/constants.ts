export const SUPPORTED_CHAIN_ID = 11155111;

export const SEPOLIA_EXPLORER_BASE = "https://sepolia.etherscan.io";

export const MAX_STEPS_PER_TURN = Number(process.env.MAX_STEPS_PER_TURN ?? 10);
export const RATE_LIMIT_RPM = Number(process.env.RATE_LIMIT_RPM ?? 20);

// Spend limits (in ETH)
export const MAX_SINGLE_TX_ETH = 0.1;
export const MAX_SESSION_ETH = 0.5;
export const MAX_DAILY_ETH = 1.0;

// Idempotency
export const IDEMPOTENCY_TTL_MS = 1000 * 60 * 60; // 1 hour

// Circuit breaker
export const CIRCUIT_FAILURE_THRESHOLD = 5;
export const CIRCUIT_RESET_TIMEOUT_MS = 30_000;

// Context window
export const CONTEXT_TOKEN_THRESHOLD = 80_000;
export const CONTEXT_SUMMARY_TARGET = 20_000;

// Zod field limits
export const MAX_ADDRESS_LEN = 42;
export const MAX_MEMO_LEN = 140;
export const MAX_USER_MESSAGE_LEN = 2_000;

export const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";
