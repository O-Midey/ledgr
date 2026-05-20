/**
 * EpisodicMemory stores summarized past sessions for long-term context.
 * Each episode represents a completed conversation turn summary.
 */

export interface Episode {
  readonly id: string;
  readonly timestamp: number;
  readonly summary: string;
  readonly toolsUsed: string[];
}

export class EpisodicMemory {
  private readonly episodes: Episode[] = [];

  addEpisode(episode: Omit<Episode, "id" | "timestamp">): void {
    const entry: Episode = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...episode,
    };
    this.episodes.push(entry);
  }

  /** Return the N most recent episodes for context injection. */
  getRecent(n = 5): Episode[] {
    return this.episodes.slice(-n);
  }

  getAll(): Episode[] {
    return [...this.episodes];
  }

  clear(): void {
    this.episodes.length = 0;
  }
}
