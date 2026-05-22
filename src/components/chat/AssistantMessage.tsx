"use client";

import { useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ActivityTrace,
  TxPreviewCard,
  type ToolUIPart,
  type TxPreviewStatus,
} from "./TxPreviewCard";

export function AssistantMessage({
  content,
  toolParts,
  isStreaming,
  txStatus,
}: {
  content: string;
  toolParts: ToolUIPart[];
  isStreaming: boolean;
  txStatus: TxPreviewStatus | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [content]);

  const previewTools = toolParts.filter((tp) => {
    const name = tp.toolName ?? tp.type.replace(/^tool-/, "");
    return name === "estimateGas" || name === "sendTransaction";
  });

  const badgeTools = toolParts.filter((tp) => {
    const name = tp.toolName ?? tp.type.replace(/^tool-/, "");
    return name !== "estimateGas" && name !== "sendTransaction";
  });

  return (
    <div className="assistant-msg-wrapper">
      <div className="msg-assistant-content">
        <ReactMarkdown>{content}</ReactMarkdown>
        {isStreaming && <span className="stream-cursor">▋</span>}
      </div>

      {badgeTools.length > 0 && (
        <div className="preview-tools">
          {badgeTools.map((tp, index) => {
            const toolName = tp.toolName ?? tp.type.replace(/^tool-/, "");
            const state = tp.state;
            const cls =
              state === "output-available"
                ? "done"
                : state === "output-error"
                  ? "error"
                  : "running";
            const icon =
              state === "output-available"
                ? "✓"
                : state === "output-error"
                  ? "✕"
                  : "…";
            return (
              <span key={index} className={`tool-badge ${cls}`}>
                {icon} {toolName}
              </span>
            );
          })}
        </div>
      )}

      {previewTools.map((tp) => (
        <TxPreviewCard key={tp.toolCallId} part={tp} txStatus={txStatus} />
      ))}

      <ActivityTrace toolParts={toolParts} />

      {content && (
        <div className="msg-actions">
          <button
            className="msg-action-btn"
            onClick={handleCopy}
            title="Copy"
            type="button"
          >
            {copied ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6L5 9L10 3"
                  stroke="var(--success)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect
                  x="1"
                  y="3"
                  width="7"
                  height="8"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
                <path
                  d="M4 3V2C4 1.4 4.4 1 5 1H10C10.6 1 11 1.4 11 2V7C11 7.6 10.6 8 10 8H9"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
