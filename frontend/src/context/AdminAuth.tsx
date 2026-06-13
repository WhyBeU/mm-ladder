"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getToken, setToken, clearToken, verifyToken } from "@/lib/adminApi";

interface AdminAuthValue {
  ready: boolean;
  authed: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      // Defer so we don't call setState synchronously inside the effect body.
      queueMicrotask(() => setReady(true));
      return;
    }
    verifyToken()
      .then(() => setAuthed(true))
      .catch(() => clearToken())
      .finally(() => setReady(true));
  }, []);

  const login = async (token: string) => {
    setToken(token);
    try {
      await verifyToken();
      setAuthed(true);
    } catch (e) {
      clearToken();
      throw e;
    }
  };

  const logout = () => {
    clearToken();
    setAuthed(false);
  };

  return <Ctx.Provider value={{ ready, authed, login, logout }}>{children}</Ctx.Provider>;
}

export const useAdminAuth = (): AdminAuthValue => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdminAuth outside provider");
  return v;
};
