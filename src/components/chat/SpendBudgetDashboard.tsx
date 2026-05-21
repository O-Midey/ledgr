"use client";

import React from "react";
import type { SpendStatus } from "@/lib/useSpendBudget";

export interface SpendBudgetDashboardProps {
  status: SpendStatus;
  proposedAmount?: number;
}

export function SpendBudgetDashboard({
  status,
  proposedAmount,
}: SpendBudgetDashboardProps) {
  const canAffordProposed =
    !proposedAmount ||
    (proposedAmount <= status.perTx.limit &&
      proposedAmount <= status.session.remaining &&
      proposedAmount <= status.daily.remaining);

  return (
    <div className="spend-budget-dashboard">
      <div className="spend-header">
        <div className="spend-title">Spend Budget</div>
        {status.isAtLimit && (
          <div className="spend-alert">⚠️ {status.blockReason}</div>
        )}
      </div>

      {proposedAmount && !canAffordProposed && (
        <div className="spend-warning">
          Insufficient budget for {proposedAmount.toFixed(4)} ETH
        </div>
      )}

      <div className="spend-limits-grid">
        {/* Per-Transaction */}
        <div className="spend-limit-item">
          <div className="spend-limit-label">Per Transaction</div>
          <div className="spend-limit-value">
            {status.perTx.limit.toFixed(4)} ETH
          </div>
          <div className="spend-limit-sub">Max single transfer</div>
          {proposedAmount && proposedAmount > status.perTx.limit && (
            <div className="spend-limit-error">Amount exceeds limit</div>
          )}
        </div>

        {/* Session */}
        <div className="spend-limit-item">
          <div className="spend-limit-label">Session</div>
          <div className="spend-limit-bar">
            <div className="spend-bar-bg">
              <div
                className={`spend-bar-fill ${
                  status.session.percentUsed > 80
                    ? "critical"
                    : status.session.percentUsed > 50
                      ? "warning"
                      : "normal"
                }`}
                style={{
                  width: `${Math.min(100, status.session.percentUsed)}%`,
                }}
              />
            </div>
          </div>
          <div className="spend-limit-sub">
            {status.session.used.toFixed(4)} / {status.session.limit.toFixed(4)}{" "}
            ETH ({status.session.percentUsed.toFixed(0)}%)
          </div>
          {proposedAmount && proposedAmount > status.session.remaining && (
            <div className="spend-limit-error">
              {status.session.remaining.toFixed(4)} ETH available
            </div>
          )}
        </div>

        {/* Daily */}
        <div className="spend-limit-item">
          <div className="spend-limit-label">Daily (24h)</div>
          <div className="spend-limit-bar">
            <div className="spend-bar-bg">
              <div
                className={`spend-bar-fill ${
                  status.daily.percentUsed > 80
                    ? "critical"
                    : status.daily.percentUsed > 50
                      ? "warning"
                      : "normal"
                }`}
                style={{ width: `${Math.min(100, status.daily.percentUsed)}%` }}
              />
            </div>
          </div>
          <div className="spend-limit-sub">
            {status.daily.used.toFixed(4)} / {status.daily.limit.toFixed(4)} ETH
            ({status.daily.percentUsed.toFixed(0)}%)
          </div>
          {proposedAmount && proposedAmount > status.daily.remaining && (
            <div className="spend-limit-error">
              {status.daily.remaining.toFixed(4)} ETH available
            </div>
          )}
        </div>
      </div>

      {proposedAmount && canAffordProposed && (
        <div className="spend-confirm-ok">
          ✓ Budget available for {proposedAmount.toFixed(4)} ETH
        </div>
      )}
    </div>
  );
}
