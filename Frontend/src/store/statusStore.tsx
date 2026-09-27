import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export type LeadStatus = {
  id: number;
  name: string;
  color?: string | null;
};

type StatusCtx = {
  statuses: LeadStatus[];
  loading: boolean;
  reload: () => Promise<void>;
};

const Ctx = createContext<StatusCtx | null>(null);

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loadingState, setLoadingState] = useState(true);
  const { token, loading } = useAuth();

  async function refreshStatuses() {
    try {
      const res = await api.leadStatus.list();
      const list = (res as any)?.data ?? res;
      setStatuses(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setStatuses([]);
      toast.error(e?.message || "Failed to load statuses");
    }
  }

  useEffect(() => {
    if (loading) return;

    if (!token) {
      setStatuses([]);
      setLoadingState(false);
      return;
    }

    (async () => {
      setLoadingState(true);
      await refreshStatuses();
      setLoadingState(false);
    })();
  }, [loading, token]);

  const value = useMemo(
    () => ({
      statuses,
      loading: loadingState,
      reload: refreshStatuses,
    }),
    [statuses, loadingState]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStatuses() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStatuses must be used inside <StatusProvider />");
  return ctx;
}