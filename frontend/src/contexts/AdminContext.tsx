'use client';

import { createContext, useState, useCallback, ReactNode } from 'react';

interface AdminContextType {
  isAdmin: boolean;
  adminKey: string | null;
  login: (key: string) => Promise<boolean>;
  logout: () => void;
}

export const AdminContext = createContext<AdminContextType | null>(null);

interface AdminProviderProps {
  children: ReactNode;
}

export function AdminProvider({ children }: AdminProviderProps) {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const login = useCallback(async (key: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': key,
        },
      });
      if (response.ok) {
        setAdminKey(key);
        setIsAdmin(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setAdminKey(null);
    setIsAdmin(false);
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, adminKey, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}
