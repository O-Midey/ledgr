import { useState, useEffect, useCallback } from "react";
import { isAddress, getAddress } from "viem";

export interface AddressAlias {
  address: `0x${string}`;
  alias: string;
  addedAt: number;
}

const STORAGE_KEY = "ledgr-address-book";

function loadAddresses(): AddressAlias[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

export function useAddressBook() {
  const [aliases, setAliases] = useState<AddressAlias[]>(() => loadAddresses());

  // Persist to localStorage whenever aliases change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(aliases));
    } catch {
      // Ignore storage errors
    }
  }, [aliases]);

  const addAlias = useCallback(
    (address: string, alias: string): boolean => {
      if (!alias.trim()) return false;
      if (!isAddress(address)) return false;

      const normalizedAddr = getAddress(address) as `0x${string}`;
      const trimmedAlias = alias.trim();

      // Check if alias already exists for this address
      if (aliases.some((a) => a.address === normalizedAddr)) {
        // Update existing
        setAliases((prev) =>
          prev.map((a) =>
            a.address === normalizedAddr ? { ...a, alias: trimmedAlias } : a,
          ),
        );
      } else {
        // Add new
        setAliases((prev) => [
          ...prev,
          {
            address: normalizedAddr,
            alias: trimmedAlias,
            addedAt: Date.now(),
          },
        ]);
      }
      return true;
    },
    [aliases],
  );

  const removeAlias = useCallback((address: string): void => {
    if (!isAddress(address)) return;
    const normalizedAddr = getAddress(address) as `0x${string}`;
    setAliases((prev) => prev.filter((a) => a.address !== normalizedAddr));
  }, []);

  const getAlias = useCallback(
    (address: string): string | null => {
      if (!isAddress(address)) return null;
      try {
        const normalizedAddr = getAddress(address) as `0x${string}`;
        return aliases.find((a) => a.address === normalizedAddr)?.alias ?? null;
      } catch {
        return null;
      }
    },
    [aliases],
  );

  const searchAliases = useCallback(
    (query: string): AddressAlias[] => {
      if (!query.trim()) return aliases;
      const q = query.toLowerCase();
      return aliases.filter(
        (a) =>
          a.alias.toLowerCase().includes(q) ||
          a.address.toLowerCase().includes(q),
      );
    },
    [aliases],
  );

  return {
    aliases,
    addAlias,
    removeAlias,
    getAlias,
    searchAliases,
  };
}
