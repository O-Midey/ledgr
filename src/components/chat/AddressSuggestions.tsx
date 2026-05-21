"use client";

import React from "react";
import { useAddressBook, type AddressAlias } from "@/lib/useAddressBook";

export interface AddressSuggestionsProps {
  query: string;
  isOpen: boolean;
  onSelect: (alias: AddressAlias) => void;
}

export function AddressSuggestions({
  query,
  isOpen,
  onSelect,
}: AddressSuggestionsProps) {
  const { searchAliases } = useAddressBook();

  if (!isOpen || !query.trim()) {
    return null;
  }

  const suggestions = searchAliases(query).slice(0, 5); // Limit to 5 suggestions

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="address-suggestions">
      {suggestions.map((alias) => (
        <button
          key={alias.address}
          className="address-suggestion-item"
          onClick={() => onSelect(alias)}
        >
          <div className="suggestion-label">{alias.alias}</div>
          <div className="suggestion-addr">{alias.address.slice(0, 12)}…</div>
        </button>
      ))}
    </div>
  );
}
