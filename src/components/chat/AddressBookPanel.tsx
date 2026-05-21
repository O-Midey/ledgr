"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAddressBook, type AddressAlias } from "@/lib/useAddressBook";

export interface AddressBookPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAlias?: (alias: AddressAlias) => void;
}

export function AddressBookPanel({
  isOpen,
  onClose,
  onSelectAlias,
}: AddressBookPanelProps) {
  const { aliases, removeAlias, addAlias } = useAddressBook();
  const [newAddress, setNewAddress] = useState("");
  const [newAlias, setNewAlias] = useState("");
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        isOpen
      ) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const handleAddAlias = () => {
    setError("");
    if (!newAddress.trim() || !newAlias.trim()) {
      setError("Please enter both address and alias");
      return;
    }
    if (!addAlias(newAddress, newAlias)) {
      setError("Invalid address or alias");
      return;
    }
    setNewAddress("");
    setNewAlias("");
  };

  const handleSelectAlias = (alias: AddressAlias) => {
    onSelectAlias?.(alias);
    onClose();
  };

  return (
    <>
      {isOpen && <div className="address-book-overlay" onClick={onClose} />}
      <div
        ref={panelRef}
        className={`address-book-panel ${isOpen ? "open" : ""}`}
      >
        <div className="address-book-header">
          <h3>Address Book</h3>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close address book"
          >
            ✕
          </button>
        </div>

        <div className="address-book-content">
          {/* Add new alias section */}
          <div className="add-alias-section">
            <div className="add-alias-label">Add Address</div>
            <input
              type="text"
              placeholder="0x..."
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className="add-alias-input"
            />
            <input
              type="text"
              placeholder="e.g., My Wallet"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              className="add-alias-input"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddAlias();
              }}
            />
            {error && <div className="add-alias-error">{error}</div>}
            <button className="add-alias-btn" onClick={handleAddAlias}>
              Save
            </button>
          </div>

          {/* Saved aliases list */}
          <div className="aliases-list">
            {aliases.length === 0 ? (
              <div className="aliases-empty">No saved addresses yet</div>
            ) : (
              aliases.map((a) => (
                <div key={a.address} className="alias-item">
                  <div className="alias-info">
                    <div className="alias-name">{a.alias}</div>
                    <div className="alias-addr">{a.address.slice(0, 10)}…</div>
                  </div>
                  <div className="alias-actions">
                    <button
                      className="alias-action-btn use-btn"
                      onClick={() => handleSelectAlias(a)}
                      title="Use this address"
                    >
                      Use
                    </button>
                    <button
                      className="alias-action-btn delete-btn"
                      onClick={() => removeAlias(a.address)}
                      title="Remove this address"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
