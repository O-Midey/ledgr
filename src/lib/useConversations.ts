"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { generateId } from "@/lib/utils";

const CHAT_MESSAGES_PREFIX = "ledgr-chat-messages:";

/** A conversation is "empty" when it has no persisted messages yet. */
function conversationIsEmpty(id: string): boolean {
  try {
    const raw = localStorage.getItem(`${CHAT_MESSAGES_PREFIX}${id}`);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    return !Array.isArray(parsed) || parsed.length === 0;
  } catch {
    return true;
  }
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

const CONVERSATIONS_KEY = "ledgr-conversations";
const ACTIVE_SESSION_KEY = "ledgr-active-session";

function loadConversations(): ConversationMeta[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ConversationMeta[];
  } catch {
    return [];
  }
}

function saveConversations(list: ConversationMeta[]): void {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function readActiveSessionId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function writeActiveSessionId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
  } catch {
    /* ignore */
  }
}

export function useConversations() {
  // Start from a deterministic, storage-free state so the server-rendered HTML
  // and the first client render match. Reading localStorage (or calling
  // generateId/Date.now) in the initializer would diverge between server and
  // client and trip a hydration mismatch. The real state is loaded in the mount
  // effect below, after hydration. `hydrated` lets callers hold off on
  // rendering conversation-dependent UI until then.
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  // Load persisted conversations and resolve the active session once, on the
  // client, after mount — bootstrapping a first conversation if none exist.
  // This is the sanctioned "sync from an external system after hydration" use
  // of setState-in-effect: it runs once and React batches the updates into a
  // single render, so it doesn't cascade.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const list = loadConversations();
    const existing = readActiveSessionId();

    if (existing) {
      setConversations(list);
      setActiveId(existing);
      setHydrated(true);
      return;
    }
    if (list.length > 0) {
      writeActiveSessionId(list[0].id);
      setConversations(list);
      setActiveId(list[0].id);
      setHydrated(true);
      return;
    }
    const id = generateId();
    const first: ConversationMeta = {
      id,
      title: "New conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveConversations([first]);
    writeActiveSessionId(id);
    setConversations([first]);
    setActiveId(id);
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Keep localStorage in sync whenever conversations change — but not before
  // hydration, or the initial empty state would clobber the persisted list.
  useEffect(() => {
    if (!hydrated) return;
    saveConversations(conversations);
  }, [conversations, hydrated]);

  // Refs mirror the latest values so stable callbacks can read them without
  // being re-created on every conversation/active change.
  const conversationsRef = useRef(conversations);
  const activeIdRef = useRef(activeId);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const createConversation = useCallback((): string => {
    // If the active conversation is still a pristine, empty chat, just surface
    // it instead of stacking another identical "New conversation".
    const currentActiveId = activeIdRef.current;
    const active = conversationsRef.current.find(
      (c) => c.id === currentActiveId,
    );
    if (
      active &&
      active.title === "New conversation" &&
      conversationIsEmpty(currentActiveId)
    ) {
      writeActiveSessionId(currentActiveId);
      setActiveId(currentActiveId);
      return currentActiveId;
    }

    const id = generateId();
    const meta: ConversationMeta = {
      id,
      title: "New conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [meta, ...prev]);
    writeActiveSessionId(id);
    setActiveId(id);
    return id;
  }, []);

  const switchConversation = useCallback((id: string): void => {
    writeActiveSessionId(id);
    setActiveId(id);
  }, []);

  const deleteConversation = useCallback(
    (id: string): void => {
      // Remove messages from localStorage
      try {
        localStorage.removeItem(`ledgr-chat-messages:${id}`);
      } catch {
        /* ignore */
      }
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (id === activeId) {
          // Switch to most recent remaining, or create new
          if (next.length > 0) {
            writeActiveSessionId(next[0].id);
            setActiveId(next[0].id);
          } else {
            const newId = generateId();
            const fresh: ConversationMeta = {
              id: newId,
              title: "New conversation",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            saveConversations([fresh]);
            writeActiveSessionId(newId);
            setActiveId(newId);
            return [fresh];
          }
        }
        return next;
      });
    },
    [activeId],
  );

  /** Call this when the first user message is sent to set a meaningful title */
  const setTitle = useCallback((id: string, title: string): void => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, title: title.slice(0, 60), updatedAt: Date.now() }
          : c,
      ),
    );
  }, []);

  /**
   * Set an auto-generated title, but only if the user hasn't already named the
   * chat — never clobbers a meaningful title with a later auto-title.
   */
  const autoTitle = useCallback((id: string, title: string): void => {
    const clean = title.trim();
    if (!clean) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id && c.title === "New conversation"
          ? { ...c, title: clean.slice(0, 60), updatedAt: Date.now() }
          : c,
      ),
    );
  }, []);

  /** Touch updatedAt when a new message arrives */
  const touchConversation = useCallback((id: string): void => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, updatedAt: Date.now() } : c)),
    );
  }, []);

  return {
    hydrated,
    conversations,
    activeId,
    createConversation,
    switchConversation,
    deleteConversation,
    setTitle,
    autoTitle,
    touchConversation,
  };
}
