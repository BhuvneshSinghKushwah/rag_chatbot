'use client';

import { useState, useEffect } from 'react';
import { getFingerprint } from '@/services/fingerprint';

export function useFingerprint() {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fp = getFingerprint();
    setFingerprint(fp);
    setIsLoading(false);
  }, []);

  return { fingerprint, isLoading, error: null };
}
