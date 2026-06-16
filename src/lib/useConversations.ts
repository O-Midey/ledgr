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
  const [conversations, setConversations] = useState<ConversationMeta[]>(() =>
    loadConversations(),
  );
  const [activeId, setActiveId] = useState<string>(() => {
    const existing = readActiveSessionId();
    if (existing) return existing;
    // Bootstrap first conversation
    const list = loadConversations();
    if (list.length > 0) {
      writeActiveSessionId(list[0].id);
      return list[0].id;
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
    return id;
  });

  // Keep localStorage in sync whenever conversations change
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

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
