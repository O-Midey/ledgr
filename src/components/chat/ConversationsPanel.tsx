"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ConversationMeta } from "@/lib/useConversations";

interface ConversationsPanelProps {
  isOpen: boolean;
  conversations: ConversationMeta[];
  activeId: string;
  generatingTitleId?: string | null;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onClose: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ConversationsPanel({
  isOpen,
  conversations,
  activeId,
  generatingTitleId,
  onSwitch,
  onNew,
  onDelete,
  onRename,
  onClose,
}: ConversationsPanelProps) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus the search field when the panel opens (after the slide-in settles).
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => searchRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  const beginRename = (c: ConversationMeta) => {
    setEditingId(c.id);
    setDraft(c.title === "New conversation" ? "" : c.title);
  };

  const commitRename = (id: string) => {
    const next = draft.trim();
    if (next) onRename(id, next);
    setEditingId(null);
    setDraft("");
  };

  const cancelRename = () => {
    setEditingId(null);
    setDraft("");
  };

  return (
    <>
      {isOpen && (
        <div className="conv-backdrop" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={`conv-panel${isOpen ? " open" : ""}`}
        aria-label="Conversations"
      >
        <div className="conv-panel-header">
          <span className="conv-panel-title">Conversations</span>
          <button
            type="button"
            className="conv-panel-close"
            onClick={onClose}
            aria-label="Close conversations"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <button type="button" className="conv-new-btn" onClick={onNew}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1v10M1 6h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          New conversation
        </button>

        <div className="conv-search">
          <svg
            width="13"
            height="13"
            viewBox="0 0 13 13"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="5.5"
              cy="5.5"
              r="4"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M8.5 8.5L11.5 11.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={searchRef}
            type="text"
            className="conv-search-input"
            placeholder="Search conversations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search conversations"
          />
          {query && (
            <button
              type="button"
              className="conv-search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path
                  d="M1.5 1.5l8 8M9.5 1.5l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        <ul className="conv-list" role="listbox" aria-label="Conversation list">
          {filtered.length === 0 && (
            <li className="conv-empty">
              {query ? "No matches" : "No conversations yet"}
            </li>
          )}
          {filtered.map((c) => {
            const isEditing = editingId === c.id;
            const isGenerating =
              generatingTitleId === c.id && c.title === "New conversation";

            return (
              <li
                key={c.id}
                role="option"
                aria-selected={c.id === activeId}
                className={`conv-item${c.id === activeId ? " active" : ""}`}
              >
                {isEditing ? (
                  <input
                    type="text"
                    className="conv-rename-input"
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitRename(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(c.id);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelRename();
                      }
                    }}
                    aria-label="Rename conversation"
                  />
                ) : (
                  <button
                    type="button"
                    className="conv-item-btn"
                    onClick={() => {
                      onSwitch(c.id);
                      onClose();
                    }}
                    onDoubleClick={() => beginRename(c)}
                  >
                    {isGenerating ? (
                      <span
                        className="conv-item-title-shimmer"
                        aria-label="Generating title"
                      />
                    ) : (
                      <span className="conv-item-title">{c.title}</span>
                    )}
                    <span className="conv-item-time">{timeAgo(c.updatedAt)}</span>
                  </button>
                )}

                {!isEditing && (
                  <div className="conv-item-actions">
                    <button
                      type="button"
                      className="conv-item-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        beginRename(c);
                      }}
                      aria-label={`Rename conversation: ${c.title}`}
                      title="Rename"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M8.5 1.5l2 2L4 10l-2.5.5L2 8l6.5-6.5z"
                          stroke="currentColor"
                          strokeWidth="1.1"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="conv-item-action conv-item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                      aria-label={`Delete conversation: ${c.title}`}
                      title="Delete"
                    >
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path
                          d="M1.5 1.5l8 8M9.5 1.5l-8 8"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}
