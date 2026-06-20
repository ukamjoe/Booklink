"use client";

import { useEffect, useState } from "react";
import type { SyncRecord } from "@/types";

export function useSyncRecords(pollIntervalMs = 5000) {
  const [records, setRecords] = useState<SyncRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecords() {
      try {
        const res = await fetch("/api/sync");
        if (!res.ok) throw new Error("Could not load sync records");
        const data = await res.json();
        if (!cancelled) {
          setRecords(data.records);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchRecords();
    const interval = setInterval(fetchRecords, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollIntervalMs]);

  return { records, isLoading, error };
}
