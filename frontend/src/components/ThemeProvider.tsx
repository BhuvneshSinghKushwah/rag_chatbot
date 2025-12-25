'use client';

import { ReactNode, useEffect } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return <>{children}</>;
}
