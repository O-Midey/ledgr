import {
  CONTEXT_TOKEN_THRESHOLD,
  CONTEXT_SUMMARY_TARGET,
} from "@/lib/constants";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Working memory holds the active conversation turn context.
 * Manages token budget and prunes/summarises when approaching limit.
 */
export class WorkingMemory {
  private messages: ChatMessage[] = [];
  private systemPrompt: string = "";

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  appendMessage(message: ChatMessage): void {
    this.messages.push(message);
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /** Rough token estimate: ~4 chars per token */
  estimateTokens(): number {
    const allText =
      this.messages.map((m) => JSON.stringify(m)).join("") + this.systemPrompt;
    return Math.ceil(allText.length / 4);
  }

  needsPruning(): boolean {
    return this.estimateTokens() > CONTEXT_TOKEN_THRESHOLD;
  }

  /**
   * Prune older messages down to target token budget.
   * Preserves: system prompt, most recent messages, active tool call outputs.
   */
  prune(summary: string): void {
    // Keep the system prompt separate; insert summary as system context
    const targetChars = CONTEXT_SUMMARY_TARGET * 4;
    let kept: ChatMessage[] = [];
    let charCount = 0;

    // Walk from newest to oldest, keeping messages within budget
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msgLen = JSON.stringify(this.messages[i]).length;
      if (charCount + msgLen > targetChars) break;
      kept.unshift(this.messages[i]);
      charCount += msgLen;
    }

    // Prepend a summary assistant message
    if (summary) {
      kept = [
        { role: "assistant", content: `[Context summary]: ${summary}` },
        ...kept,
      ];
    }

    this.messages = kept;
  }

  reset(): void {
    this.messages = [];
  }
}
