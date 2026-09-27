import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { storage } from "../lib/storage";

type AuthUser = {
  id?: number | string;
  name?: string;
  email?: string;
  role_id?: number;
  role_name?: string;
  company_id?: number | string;
  type?: string;
  is_active?: boolean;
};

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    contact_no: string,
    company_name: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(storage.getToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function boot() {
    try {
      setLoading(true);

      const t = storage.getToken();
      setToken(t);

      if (!t) {
        setUser(null);
        storage.clearCompanyId();
        return;
      }

      const me = await api.me();
      const nextUser = me?.user || null;

      setUser(nextUser);

      if (nextUser?.company_id !== undefined && nextUser?.company_id !== null) {
        storage.setCompanyId(nextUser.company_id);
      } else {
        storage.clearCompanyId();
      }
    } catch (e) {
      storage.clearToken();
      storage.clearCompanyId();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    boot();
  }, []);

  const value = useMemo<AuthContextType>(() => {
    const isAdmin = user?.role_id === 1 || user?.type === "admin";

    return {
      user,
      token,
      loading,

      login: async (email, password) => {
        setLoading(true);
        try {
          const res = await api.login({
            // action: "login",
            email,
            password,
          });

          const tok = res?.token;
          if (!tok) throw new Error("Token not received from server");

          storage.setToken(tok);
          setToken(tok);

          const nextUser = res?.user || null;

          if (nextUser) {
            setUser(nextUser);

            if (nextUser?.company_id !== undefined && nextUser?.company_id !== null) {
              storage.setCompanyId(nextUser.company_id);
            } else {
              storage.clearCompanyId();
            }
          } else {
            const me = await api.me();
            const meUser = me?.user || null;

            setUser(meUser);

            if (meUser?.company_id !== undefined && meUser?.company_id !== null) {
              storage.setCompanyId(meUser.company_id);
            } else {
              storage.clearCompanyId();
            }
          }
        } finally {
          setLoading(false);
        }
      },

      // signup: async (name, email, contact_no, company_name) => {
      //   setLoading(true);
      //   try {
      //     const res = await api.signup({
      //       name,
      //       email,
      //       contact_no,
      //       company_name,
      //     });

      //     const tok = res?.token;
      //     if (!tok) throw new Error("Token not received from server");

      //     storage.setToken(tok);
      //     setToken(tok);

      //     const nextUser = res?.user || null;
      //     setUser(nextUser);

      //     if (nextUser?.company_id !== undefined && nextUser?.company_id !== null) {
      //       storage.setCompanyId(nextUser.company_id);
      //     } else {
      //       storage.clearCompanyId();
      //     }
      //   } finally {
      //     setLoading(false);
      //   }
      // },

      signup: async (name, email, contact_no, company_name) => {
  setLoading(true);
  try {
    await api.signup({
      name,
      email,
      contact_no,
      company_name,
    });

    // signup ke time token save nahi karna
    // user state set nahi karna
    // company_id store nahi karna
  } finally {
    setLoading(false);
  }
},

      logout: async () => {
        try {
          if (token) {
            await api.logout?.();
          }
        } catch (e) {
        } finally {
          storage.clearToken();
          storage.clearCompanyId();
          setToken(null);
          setUser(null);
        }
      },

      isAdmin,
    };
  }, [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}