'use client';

export function useTheme() {
  return {
    theme: 'dark' as const,
    resolvedTheme: 'dark' as const,
  };
}
