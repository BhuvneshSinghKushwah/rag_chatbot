'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  User as FirebaseUser,
  onAuthChange,
  signInWithGoogle,
  sendMagicLink,
  signOut as firebaseSignOut,
  getIdToken,
  isFirebaseConfigured,
} from '@/lib/firebase';

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  role: UserRole;
  subscription_tier: 'free' | 'goated';
  storage_used: number;
  storage_limit: number;
  agent_count: number;
  agent_limit: number;
  email_verified: boolean;
  created_at: string;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async (token: string): Promise<UserProfile | null> => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch user profile:', response.status);
        return null;
      }

      const data = await response.json();
      if (data.authenticated && data.user) {
        return data.user;
      }
      return null;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return;

    try {
      const token = await firebaseUser.getIdToken();
      const profile = await fetchUserProfile(token);
      if (profile) {
        setUser(profile);
      }
    } catch (err) {
      console.error('Error refreshing profile:', err);
    }
  }, [firebaseUser, fetchUserProfile]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthChange(async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          const token = await fbUser.getIdToken();
          const profile = await fetchUserProfile(token);
          setUser(profile);
          setError(null);
        } catch (err) {
          console.error('Error during auth state change:', err);
          setError('Failed to load user profile');
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserProfile]);

  const handleSignInWithGoogle = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in with Google';
      console.error('Google sign-in error:', err);
      setError(errorMessage);
      setLoading(false);
    }
  }, []);

  const handleSendMagicLink = useCallback(async (email: string) => {
    setError(null);

    try {
      await sendMagicLink(email);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send magic link';
      console.error('Magic link error:', err);
      setError(errorMessage);
      throw err;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setError(null);

    try {
      await firebaseSignOut();
      setUser(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign out';
      console.error('Sign out error:', err);
      setError(errorMessage);
    }
  }, []);

  const handleGetToken = useCallback(async (): Promise<string | null> => {
    return getIdToken();
  }, []);

  const value: AuthContextType = {
    firebaseUser,
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signInWithGoogle: handleSignInWithGoogle,
    sendMagicLink: handleSendMagicLink,
    signOut: handleSignOut,
    getToken: handleGetToken,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRequireAuth() {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) {
    }
  }, [auth.loading, auth.isAuthenticated]);

  return auth;
}
