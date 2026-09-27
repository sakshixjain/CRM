import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export type AgentOption = {
  id: number;
  name?: string;
  email?: string;
};

type AgentCtx = {
  agents: AgentOption[];
  loadingAgents: boolean;
  reload: () => Promise<void>;
};

const Ctx = createContext<AgentCtx | null>(null);

function unwrapArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && Array.isArray((res as any).data))
    return (res as any).data as T[];
  return [];
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const { user, token, loading } = useAuth();

  async function refreshAgents() {
    try {
      const isAdmin = user?.role_id === 1;
      const userEmail = (user?.email || "").toLowerCase();

      const res = await api.listAgents();
      const allAgents = unwrapArray<AgentOption>(res);

      if (!isAdmin && userEmail) {
        const match = allAgents.find(
          (a) => (a.email || "").toLowerCase() === userEmail
        );
        setAgents(match ? [match] : []);
      } else {
        setAgents(allAgents);
      }
    } catch (e: any) {
      setAgents([]);
      toast.error(e?.message || "Failed to load agents");
    }
  }

  useEffect(() => {
    if (loading) return;

    if (!token) {
      setAgents([]);
      setLoadingAgents(false);
      return;
    }

    (async () => {
      setLoadingAgents(true);
      await refreshAgents();
      setLoadingAgents(false);
    })();
  }, [loading, token, user]);

  const value = useMemo(
    () => ({ agents, loadingAgents, reload: refreshAgents }),
    [agents, loadingAgents]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgents() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAgents must be used inside <AgentProvider />");
  return ctx;
}