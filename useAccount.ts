"use client";

import { useEffect, useState } from "react";

interface Account {
  id: string;
  email: string;
  firmName: string | null;
  subscriptionStatus: "inactive" | "active" | "past_due" | "canceled";
  karbonConnected: boolean;
}

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnauthenticated, setIsUnauthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchAccount() {
      try {
        const res = await fetch("/api/account");
        if (res.status === 401) {
          if (!cancelled) setIsUnauthenticated(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) setAccount(data);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchAccount();
    return () => {
      cancelled = true;
    };
  }, []);

  return { account, isLoading, isUnauthenticated };
}
