'use client';

import { ReactNode } from 'react';
import { AdminProvider } from '@/contexts/AdminContext';
import { ThemeProvider } from '@/components/ThemeProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <AdminProvider>{children}</AdminProvider>
    </ThemeProvider>
  );
}
