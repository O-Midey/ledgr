"use client";

import { useMemo, useState } from "react";

interface AuditEntry {
  action: string;
  time: string;
  status: "success" | "running" | "error";
  eventType: string;
  severity: "info" | "warn" | "error" | "critical";
  toolName?: string;
  hash?: string;
  previousHash?: string;
}

export function WalletSidebar({
  address,
  isConnected,
  auditEntries,
  balanceData,
  balanceLoading,
}: {
  address?: string;
  isConnected: boolean;
  auditEntries: AuditEntry[];
  balanceData?: { formatted: string; symbol: string } | null;
  balanceLoading: boolean;
}) {
  const shortAddr = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;
  const [copied, setCopied] = useState(false);
  const [toolFilter, setToolFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<
    "none" | "tool" | "severity" | "event"
  >("severity");

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toolOptions = useMemo(
    () =>
      Array.from(
        new Set(auditEntries.map((entry) => entry.toolName).filter(Boolean)),
      ),
    [auditEntries],
  );
  const eventOptions = useMemo(
    () => Array.from(new Set(auditEntries.map((entry) => entry.eventType))),
    [auditEntries],
  );

  const filteredAuditEntries = useMemo(
    () =>
      auditEntries.filter((entry) => {
        if (toolFilter !== "all" && entry.toolName !== toolFilter) return false;
        if (severityFilter !== "all" && entry.severity !== severityFilter) {
          return false;
        }
        if (eventFilter !== "all" && entry.eventType !== eventFilter) {
          return false;
        }
        return true;
      }),
    [auditEntries, toolFilter, severityFilter, eventFilter],
  );

  const groupedAuditEntries = useMemo(() => {
    if (groupBy === "none") {
      return [{ label: "All", entries: filteredAuditEntries }];
    }

    const bucket = new Map<string, AuditEntry[]>();
    for (const entry of filteredAuditEntries) {
      const key =
        groupBy === "tool"
          ? (entry.toolName ?? "unknown")
          : groupBy === "severity"
            ? entry.severity
            : entry.eventType;
      const current = bucket.get(key) ?? [];
      current.push(entry);
      bucket.set(key, current);
    }

    return Array.from(bucket.entries()).map(([label, entries]) => ({
      label,
      entries,
    }));
  }, [filteredAuditEntries, groupBy]);

  return (
    <div className="sidebar-inner">
      <div className="sidebar-section">
        <div className="sidebar-label">Wallet</div>
        {isConnected && address ? (
          <>
            <button
              className="address-chip"
              title={copied ? "Copied!" : address}
              onClick={copyAddress}
            >
              {copied ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5L4.5 7.5L8.5 2.5"
                    stroke="var(--success)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect
                    x="1"
                    y="3"
                    width="6"
                    height="6"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <path
                    d="M3 3V2C3 1.4 3.4 1 4 1H8C8.6 1 9 1.4 9 2V6C9 6.6 8.6 7 8 7H7"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                </svg>
              )}
              {shortAddr}
            </button>
            <div style={{ marginTop: 8 }}>
              <div className="network-badge">
                <span className="network-dot" />
                Sepolia
              </div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Not connected
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">Balance</div>
        {isConnected ? (
          balanceLoading ? (
            <div>
              <div
                className="skeleton"
                style={{ width: 80, height: 22, marginBottom: 4 }}
              />
              <div className="skeleton" style={{ width: 50, height: 12 }} />
            </div>
          ) : (
            <>
              <div className="balance-display">
                {balanceData
                  ? parseFloat(balanceData.formatted).toFixed(4)
                  : "—"}
              </div>
              <div className="balance-sub">
                {balanceData?.symbol ?? "ETH"} · Sepolia
              </div>
            </>
          )
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Connect wallet
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">Network</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { label: "Chain", value: "Sepolia" },
            { label: "Chain ID", value: "11155111" },
            { label: "RPC", value: "Alchemy" },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
              }}
            >
              <span style={{ color: "var(--text-3)" }}>{row.label}</span>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono)",
                  color: "var(--text-2)",
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-section sidebar-audit">
        <div className="sidebar-label">Audit Log</div>
        <div className="audit-controls">
          <select
            className="audit-select"
            value={toolFilter}
            onChange={(event) => setToolFilter(event.target.value)}
          >
            <option value="all">All tools</option>
            {toolOptions.map((tool) => (
              <option key={tool} value={tool}>
                {tool}
              </option>
            ))}
          </select>
          <select
            className="audit-select"
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
          >
            <option value="all">All severity</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
          <select
            className="audit-select"
            value={eventFilter}
            onChange={(event) => setEventFilter(event.target.value)}
          >
            <option value="all">All events</option>
            {eventOptions.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
          <select
            className="audit-select"
            value={groupBy}
            onChange={(event) =>
              setGroupBy(
                event.target.value as "none" | "tool" | "severity" | "event",
              )
            }
          >
            <option value="severity">Group: severity</option>
            <option value="tool">Group: tool</option>
            <option value="event">Group: event</option>
            <option value="none">No grouping</option>
          </select>
        </div>
        <div className="audit-scroll">
          {filteredAuditEntries.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              No activity yet
            </div>
          ) : (
            groupedAuditEntries.map((group) => (
              <div key={group.label} className="audit-group">
                {groupBy !== "none" && (
                  <div className="audit-group-label">{group.label}</div>
                )}
                {group.entries.map((entry, index) => (
                  <details
                    key={`${group.label}-${index}-${entry.time}`}
                    className="audit-entry"
                  >
                    <summary className="audit-entry-summary">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background:
                              entry.status === "success"
                                ? "var(--success)"
                                : entry.status === "running"
                                  ? "var(--accent)"
                                  : "var(--danger)",
                            animation:
                              entry.status === "running"
                                ? "pulse-dot 1.5s ease-in-out infinite"
                                : "none",
                          }}
                        />
                        <span className="audit-action">{entry.action}</span>
                      </div>
                      <span className="audit-time">{entry.time}</span>
                    </summary>
                    <div className="audit-entry-details">
                      <div className="audit-meta-row">
                        <span>event</span>
                        <span>{entry.eventType}</span>
                      </div>
                      <div className="audit-meta-row">
                        <span>severity</span>
                        <span>{entry.severity}</span>
                      </div>
                      {entry.toolName && (
                        <div className="audit-meta-row">
                          <span>tool</span>
                          <span>{entry.toolName}</span>
                        </div>
                      )}
                      {entry.hash && (
                        <div className="audit-meta-row">
                          <span>hash</span>
                          <span className="audit-hash">{`${entry.hash.slice(0, 10)}…${entry.hash.slice(-8)}`}</span>
                        </div>
                      )}
                      {entry.previousHash && (
                        <div className="audit-meta-row">
                          <span>prev</span>
                          <span className="audit-hash">{`${entry.previousHash.slice(0, 10)}…${entry.previousHash.slice(-8)}`}</span>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sidebar-section sidebar-safety">
        <div className="sidebar-label">Safety</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {[
            { label: "Simulation", ok: true },
            { label: "Supervisor", ok: true },
            { label: "Audit Log", ok: true },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 11,
              }}
            >
              <span style={{ color: "var(--text-3)" }}>{item.label}</span>
              <span
                style={{
                  color: item.ok ? "var(--success)" : "var(--danger)",
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: 10,
                }}
              >
                {item.ok ? "active" : "off"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
