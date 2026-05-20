# Copilot Instructions — Ledgr

## Project Overview

Ledgr is a chat-based agentic AI application for crypto wallet operations on Sepolia.
Users interact via natural language to check balances, send transactions, view history,
estimate gas fees, and fetch token pricing context.

This is an AI engineering interview project and must demonstrate production-grade
agentic reliability, security controls, and architecture clarity.

---

## Scope and Runtime Mode

- Network is **Sepolia only**.
- Mainnet is out of scope.
- Production runtime uses real blockchain reads/writes only.
- Simulated wallet logic may exist for tests/dev fixtures, but must not replace
  real Sepolia execution in production runtime paths.

---

## Architecture Principle

Reliability is an **architectural property**, not a model property.
Every component has a clear responsibility and communicates through typed,
validated interfaces.

### Required Component Pipeline (P0)

All requests must flow through this exact chain:

`GoalManager -> Planner -> ToolRouter -> ExecutionGateway -> Verifier -> SafetySupervisor -> AuditLog`

#### Hard Rules (never violate)

1. No direct tool calls outside `ExecutionGateway`.
2. Side-effectful operations must run simulate-before-actuate.
3. All tool schemas are Zod-defined and validated.
4. All business errors are typed `StructuredError` variants.
5. Every execution attempt (success/failure/safe-halt/idempotency-hit) is audited.
6. `SafetySupervisor` veto is final.
7. TypeScript strict mode; no `any`.
8. Components depend on interfaces, never concrete implementations.

---

## Cross-Cutting Concerns

- **Memory**: WorkingMemory + EpisodicMemory.
- **Observability**: Log plan, tool call, result, error.
- **Graceful Degradation**: Fail clearly and suggest next steps.
- **Context Management**: prune/summarize as token usage approaches limits.

---

## Suggested Folder Structure

```text
src/
├── agent/
│   ├── goalManager.ts
│   ├── planner.ts
│   ├── toolRouter.ts
│   ├── executionGateway.ts
│   ├── verifier.ts
│   └── supervisor.ts
├── memory/
│   ├── workingMemory.ts
│   └── episodicMemory.ts
├── tools/
│   ├── index.ts
│   ├── getBalance.ts
│   ├── sendTransaction.ts
│   ├── getTransactionHistory.ts
│   ├── estimateGas.ts
│   ├── getTokenPrice.ts
│   └── resolveAddress.ts
├── wallet/
│   ├── blockchainClient.ts
│   ├── walletClient.ts
│   ├── connectedWallet.ts
│   ├── wagmiConfig.ts
│   └── walletStore.ts
├── audit/
│   └── auditLog.ts
├── types/
│   ├── agent.ts
│   ├── wallet.ts
│   ├── errors.ts
│   └── audit.ts
├── lib/
│   ├── constants.ts
│   ├── idempotency.ts
│   ├── circuitBreaker.ts
│   ├── contextManager.ts
│   └── utils.ts
├── prompts/
│   └── systemPrompt.ts
├── security/
│   ├── injectionGuard.ts
│   ├── outputFilter.ts
│   ├── rateLimiter.ts
│   └── spendTracker.ts
└── components/
    ├── chat/
    ├── wallet/
    ├── transactions/
    ├── audit/
    └── ui/
```

---

## Type Contracts (P0)

Define types before implementation.
Major contracts live in `src/types/*`.

- `GoalIntent`
- `ActionPlan`
- `ToolCall`
- `ExecutionResult`
- `StructuredError` family
- `AuditEntry`

### Error Rules

- Never throw raw strings.
- Never throw generic `Error` for business logic.
- Always use typed `StructuredError` subclasses with:
  - `code`
  - `message`
  - optional `context`

---

## Tool Definition Contract

Every tool must expose:

- `name`
- `description`
- `schema` (Zod)
- `idempotent`
- `sideEffects`
- `execute()`

Rules:

- Read-only tools: `sideEffects: false`.
- Side-effectful tools (e.g., `sendTransaction`): `sideEffects: true` and must include idempotency.
- Tool schemas must be strict and constrained.

---

## ExecutionGateway Contract (P0)

`ExecutionGateway` is the only place where tools execute.

Required order for side-effectful tools:

0. Idempotency check
1. Schema validation
2. Preconditions
3. Simulation
4. Verifier approval
5. SafetySupervisor check
6. Commit execution
7. Audit write
8. Idempotency record

If simulation or supervisor fails, commit is blocked.

---

## Idempotency (P0)

- Every side-effectful tool call must carry `idempotencyKey`.
- Check key before any validation/simulation/commit.
- Duplicate key returns cached result without re-execution.
- TTL is required.
- Store is append-only; never overwrite an existing entry.

---

## Circuit Breaker (P1)

Per-tool breaker with states:

- `CLOSED`
- `OPEN`
- `HALF_OPEN`

ToolRouter must check breaker state before route.
ExecutionGateway reports success/failure to breaker.

If OPEN, fail fast with clear user-facing fallback.

---

## Context Window Management (P1)

When token usage exceeds threshold:

- preserve system prompt
- preserve latest turns
- summarize older turns into compact system summary
- never prune active-step tool outputs

---

## Sepolia Blockchain Integration (P0)

### Clients

- `publicClient` (read-only): Sepolia via `ALCHEMY_RPC_URL`
- `walletClient` (server-side signing): Sepolia, private key from env

### Tool Behavior

- `getBalance`: real Sepolia reads
- `estimateGas`: real Sepolia estimate
- `getTransactionHistory`: real transfers (Alchemy Sepolia)
- `sendTransaction`: simulate-before-actuate and return explorer link

### Successful send response must include

- amount
- truncated destination
- tx hash
- `https://sepolia.etherscan.io/tx/<hash>`

---

## Wallet Connection (P0)

Use RainbowKit + wagmi.

### Rules

- User signs transactions in-wallet.
- App never receives user private keys.
- No seed phrase/private key entry UI.
- Do not use wagmi hooks in server code or API routes.

### Wrong Network Guard (mandatory)

If connected chain is not Sepolia:

- block all transaction actions
- show persistent warning
- provide switch-to-Sepolia action

Never allow transaction attempts on unsupported chains.

### Dual wallet model

- **Connected wallet**: default user path (wallet signs)
- **Agent demo wallet**: server test wallet path for demos, still gated by
  `ExecutionGateway`, `SafetySupervisor`, idempotency, and audit.

---

## Security Controls (P0)

### 1) Injection Guard

- Scan every user message before planning.
- Detect instruction override and prompt-exfiltration patterns.
- Sanitize control tokens from input and tool outputs.
- Log detections to audit with elevated severity.

### 2) Zod Hardening

For user-supplied strings:

- do not use unconstrained `z.string()`
- include max length
- include regex/format constraints
- trim before validation where applicable

For transaction schemas:

- enforce address format
- enforce positive finite amount
- enforce max single tx
- prevent send-to-self
- constrain token enum
- constrain memo length/content

### 3) Spend Tracking

- enforce cumulative session and daily limits
- block over-limit actions before execution
- append spend events immutably

### 4) Rate Limiting

- apply in `/api/chat` as first middleware step
- sliding-window per IP
- return `429` + `Retry-After`

### 5) Prompt Protection

For extraction attempts, return fixed safe reply:

`I can't share my configuration. How can I help you with your wallet?`

### 6) Output Redaction

Filter secrets from outbound responses/logs:

- API keys
- private key-like hex
- env var leakage patterns

### 7) Audit Integrity

Audit log must be:

- append-only
- immutable entries
- hash-chained
- no update/delete mutation paths

### 8) HTTP Security Headers

Set strict security headers in `next.config.ts`.

Minimum:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- strict `Referrer-Policy`
- restrictive `Permissions-Policy`
- CSP with explicit sources

---

## Security Prohibitions (hard fail)

Never generate or merge code containing:

- direct tool calls bypassing `ExecutionGateway`
- `eval()` or `new Function()`
- `dangerouslySetInnerHTML`
- hardcoded secrets
- unconstrained user schemas
- mutable audit writes (`update`/`delete`/in-place mutation)
- client access to server secrets (`ANTHROPIC_API_KEY`, `ALCHEMY_API_KEY`, `WALLET_PRIVATE_KEY`)
- production logs with sensitive wallet/user payloads
- `any` in strict TypeScript

---

## Environment Contract

Required vars:

- `ANTHROPIC_API_KEY`
- `ALCHEMY_API_KEY`
- `ALCHEMY_RPC_URL`
- `WALLET_PRIVATE_KEY` (test wallet only)
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_WALLET_ADDRESS`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `MAX_STEPS_PER_TURN` (optional)
- `RATE_LIMIT_RPM` (optional)

Commit `.env.example` with placeholders only.
Never commit `.env.local`.

---

## AI Route Integration Rules

In `app/api/chat/route.ts`:

- apply rate limiter first
- run injection scan before planning
- load system prompt server-side only
- route tool calls through gateway only
- audit every step/tool result/error
- redact outbound output before streaming
- cap step budget (`MAX_STEPS_PER_TURN`)

---

## UX Requirements (P1/P2)

### Required (P1)

- Stream-drop resilience:
  - auto-retry once
  - then manual retry UI state
- Optimistic transaction UI:
  - append pending row on confirm
  - reconcile to confirmed/failed

### Recommended (P2)

- reasoning trace panel (collapsible)
- audit timeline with collapsible JSON details
- suggestion chips on empty chat
- polished empty states for chat/history/audit

---

## Edge Cases (must be handled)

- insufficient balance
- daily/session/single-tx limit breaches
- malformed address
- ambiguous intent (ask one clarifying question)
- send-to-self
- zero amount
- unknown alias resolution
- empty history
- repeated tool failures leading to safe-halt
- user cancellation during confirmation
- fat-finger large input protection
- wrong network connected

---

## Testing Matrix

### P0 (required)

- `ExecutionGateway`
  - schema block
  - simulation block
  - supervisor veto
  - idempotency hit
  - audit on success/failure
- `InjectionGuard`
  - override detection
  - clean pass-through
- `SpendTracker`
  - cumulative allow/deny
- `IdempotencyStore`
  - TTL hit
  - post-TTL re-exec
  - no overwrite

### P1/P2 (recommended)

- circuit breaker transitions
- context pruning behavior
- stream recovery UX
- wrong-network guard UI
- audit hash-chain integrity checks

---

## Naming and Code Style

- Files: `camelCase.ts` / `PascalCase.tsx`
- Components: `PascalCase`
- Hooks: `useXxx`
- Stores: `useXxxStore`
- Constants: `SCREAMING_SNAKE_CASE`
- Schemas: `xxxSchema`

Comment intent, not obvious mechanics.

---

## Merge Gate

A change is complete only when all are true:

1. P0 pipeline enforced end-to-end.
2. Real Sepolia send path returns explorer link.
3. Wallet connect + wrong-network blocking works.
4. P0 security controls active in runtime path.
5. P0 tests pass in CI.
6. No prohibited patterns present.

---

## Milestone Checklist (Execution Focus)

Use this sequence; do not start a later milestone before passing the current one.

### Milestone 1 — Foundation + Contracts

- [ ] Next.js 14 app initialized with strict TypeScript.
- [ ] Core dependencies added: `ai`, `zod`, `viem`, `wagmi`, `@rainbow-me/rainbowkit`, `vitest`.
- [ ] `src/types/*` contracts created (`GoalIntent`, `ToolCall`, `ExecutionResult`, `StructuredError`, `AuditEntry`).
- [ ] `.env.example` added with required placeholders only.

Exit criteria:

- [ ] Project builds locally.
- [ ] No `any` in P0 files.

### Milestone 2 — Agent Core Pipeline (No UI Polish)

- [ ] `GoalManager`, `Planner`, `ToolRouter` skeletons implemented.
- [ ] `ExecutionGateway` enforces required order (idempotency -> schema -> preconditions -> simulation -> verifier -> supervisor -> commit -> audit).
- [ ] `Verifier` and `SafetySupervisor` wired as mandatory gates.
- [ ] `AuditLog` append-only + hash-chain baseline implemented.

Exit criteria:

- [ ] Tools execute only via `ExecutionGateway`.
- [ ] Failed simulation or supervisor veto blocks commit.

### Milestone 3 — Sepolia Tools (Vertical Slice)

- [ ] `getBalance` implemented with Sepolia `publicClient`.
- [ ] `sendTransaction` implemented with simulate-before-actuate and explorer URL output.
- [ ] `idempotencyKey` required for side-effectful calls.
- [ ] Transaction preconditions enforced (address format, non-zero amount, send-to-self block).

Exit criteria:

- [ ] Successful send returns tx hash + `https://sepolia.etherscan.io/tx/<hash>`.
- [ ] Duplicate idempotency key does not re-execute.

### Milestone 4 — Wallet Connection + Network Guard

- [ ] RainbowKit/wagmi providers wired in app root.
- [ ] Connected wallet state (`address`, `chainId`, `isConnected`) available in client UI.
- [ ] Wrong-network guard blocks transaction actions when not on Sepolia.
- [ ] Switch-to-Sepolia action exposed in UI.

Exit criteria:

- [ ] User can connect wallet and transact only on Sepolia.
- [ ] No wagmi hooks used in server/API code.

### Milestone 5 — Security Runtime Wiring

- [ ] Rate limiter applied first in `/api/chat`.
- [ ] Injection guard applied before planning.
- [ ] Tool output sanitization applied before context re-entry.
- [ ] Output redaction applied before streaming to client.

Exit criteria:

- [ ] Prompt extraction attempts return fixed safe response.
- [ ] Sensitive patterns are redacted from outbound responses.

### Milestone 6 — P0 Test Gate

- [ ] `ExecutionGateway` tests: schema block, simulation block, supervisor veto, idempotency hit, audit write.
- [ ] `InjectionGuard` tests: malicious detection + clean pass-through.
- [ ] `SpendTracker` tests: cumulative allow/deny.
- [ ] `IdempotencyStore` tests: TTL behavior + no overwrite.

Exit criteria:

- [ ] All P0 tests pass in CI.
- [ ] Merge Gate conditions fully satisfied.

---

## Reviewer Signal Priorities

1. Architecture clarity
2. Security depth
3. Simulate-before-actuate visibility
4. Reasoning trace transparency
5. Edge-case handling quality
6. UI polish
7. Audit integrity

---

## Principle

Reliability is architectural.
If a feature bypasses architecture constraints, it is incomplete.
