'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/db';
import { MOCK_SESSION_COOKIE as MOCK_COOKIE } from '@/lib/supabase/config';
import { useT } from '@/i18n/LanguageContext';

interface User {
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (name: string) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Demo/mock login exists for local development only. The `process.env.NODE_ENV`
 * checks below are inlined at build time, so in production the demo credentials
 * and the localStorage mock session are removed from the bundle entirely.
 */
const MOCK_SESSION_KEY = 'bki_mock_session';

/**
 * proxy.ts cannot read localStorage, so the dev-only demo session is mirrored in a cookie.
 * Production builds drop this (and proxy.ts ignores the cookie there).
 */
function setMockCookie(on: boolean) {
  if (process.env.NODE_ENV === 'production' || typeof document === 'undefined') return;
  document.cookie = on ? `${MOCK_COOKIE}=1; path=/; samesite=lax` : `${MOCK_COOKIE}=; path=/; max-age=0`;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const u = session.user;
          setUser({
            name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Admin',
            email: u.email || '',
            role: u.user_metadata?.role || 'Admin',
          });
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.error("Supabase auth check failed, falling back", e);
    }

    if (process.env.NODE_ENV !== 'production') {
      // Dev-only mock session
      if (typeof window !== 'undefined' && localStorage.getItem(MOCK_SESSION_KEY) === 'true') {
        setMockCookie(true);
        const profileName = localStorage.getItem('profileName') || 'System Admin';
        setUser({
          name: profileName,
          email: 'dzaky@bki.academy',
          role: 'System Admin',
        });
        setLoading(false);
        return;
      }
    } else if (typeof window !== 'undefined') {
      // Production: drop any leftover mock flag so it can never grant access
      localStorage.removeItem(MOCK_SESSION_KEY);
      setMockCookie(false);
    }
    setUser(null);
    setLoading(false);
  };

  useEffect(() => {
    fetchSession();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
          const u = session.user;
          setUser({
            name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Admin',
            email: u.email || '',
            role: u.user_metadata?.role || 'Admin',
          });
        } else {
          // If Supabase signed out, keep a dev-only mock session alive
          const mockActive =
            process.env.NODE_ENV !== 'production' && localStorage.getItem(MOCK_SESSION_KEY) === 'true';
          if (!mockActive) {
            setUser(null);
          }
        }
        setLoading(false);
      });
      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const signIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (!error && data?.user) {
          setUser({
            name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Admin',
            email: data.user.email || '',
            role: data.user.user_metadata?.role || 'Admin',
          });
          setLoading(false);
          return { success: true };
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        // Dev-only demo user (stripped from production builds)
        if (email.toLowerCase() === 'dzaky@bki.academy' && (pass === 'Dzaky123' || pass === 'Dzaky123BKI')) {
          localStorage.setItem(MOCK_SESSION_KEY, 'true');
          localStorage.setItem('profileName', 'System Admin');
          setMockCookie(true);
          setUser({
            name: t('Admin Sistem'),
            email: 'dzaky@bki.academy',
            role: 'System Admin',
          });
          setLoading(false);
          return { success: true };
        }
      }

      setLoading(false);
      return { success: false, error: 'Login failed: Invalid email or password' };
    } catch (err: any) {
      setLoading(false);
      return { success: false, error: err?.message || 'Authentication error' };
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error(e);
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(MOCK_SESSION_KEY);
    }
    setUser(null);
    setLoading(false);
  };

  const updateProfile = async (name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (supabase) {
        const { error } = await supabase.auth.updateUser({
          data: { full_name: name }
        });
        if (error) return { success: false, error: error.message };
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('profileName', name);
      }
      setUser(prev => prev ? { ...prev, name } : null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update profile' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
