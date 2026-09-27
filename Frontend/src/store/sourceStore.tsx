import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export type SourceOption = {
  id: number;
  name: string;
};

type SourceCtx = {
  sources: SourceOption[];
  loadingSources: boolean;
  reload: () => Promise<void>;
};

const Ctx = createContext<SourceCtx | null>(null);

function unwrapArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && Array.isArray((res as any).data))
    return (res as any).data as T[];
  return [];
}

export function SourceProvider({ children }: { children: React.ReactNode }) {
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const { token, loading } = useAuth();

  async function refreshSources() {
    try {
      const res = await api.listLeadSource();
      setSources(unwrapArray<SourceOption>(res));
    } catch (e: any) {
      setSources([]);
      toast.error(e?.message || "Failed to load sources");
    }
  }

  useEffect(() => {
    if (loading) return;

    if (!token) {
      setSources([]);
      setLoadingSources(false);
      return;
    }

    (async () => {
      setLoadingSources(true);
      await refreshSources();
      setLoadingSources(false);
    })();
  }, [loading, token]);

  const value = useMemo(
    () => ({
      sources,
      loadingSources,
      reload: refreshSources,
    }),
    [sources, loadingSources]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSources() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSources must be used inside <SourceProvider />");
  return ctx;
}