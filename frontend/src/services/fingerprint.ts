const FINGERPRINT_STORAGE_KEY = 'user_fingerprint';
let cachedFingerprint: string | null = null;

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getFingerprint(): string {
  if (cachedFingerprint) {
    return cachedFingerprint;
  }

  if (typeof window === 'undefined') {
    return generateUUID();
  }

  const stored = localStorage.getItem(FINGERPRINT_STORAGE_KEY);
  if (stored) {
    cachedFingerprint = stored;
    return stored;
  }

  const fingerprint = generateUUID();
  localStorage.setItem(FINGERPRINT_STORAGE_KEY, fingerprint);
  cachedFingerprint = fingerprint;
  return fingerprint;
}

export async function generateFingerprint(): Promise<string> {
  return getFingerprint();
}

export function clearFingerprintCache(): void {
  cachedFingerprint = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(FINGERPRINT_STORAGE_KEY);
  }
}
