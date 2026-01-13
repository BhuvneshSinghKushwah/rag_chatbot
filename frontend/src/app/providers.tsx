'use client';

import { ReactNode } from 'react';
import { AdminProvider } from '@/contexts/AdminContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AdminProvider>{children}</AdminProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
