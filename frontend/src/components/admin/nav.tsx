"use client";

import { createContext, useContext } from "react";

export type AdminSection = "cups" | "seasons" | "tournaments" | "players" | "history";

export interface NavRequest {
  section: AdminSection;
  id: number;
  nonce: number;
}

interface AdminNavValue {
  navigate: (section: AdminSection, id: number) => void;
  request: NavRequest | null;
}

export const AdminNavContext = createContext<AdminNavValue>({ navigate: () => {}, request: null });

export const useAdminNav = (): AdminNavValue => useContext(AdminNavContext);
