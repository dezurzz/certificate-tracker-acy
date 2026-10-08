'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/db';
import { MOCK_SESSION_COOKIE as MOCK_COOKIE } from '@/lib/supabase/config';
import { useT } from '@/i18n/LanguageContext';
import { getErrorMessage } from '@/lib/errors';
import { can, parseRole, type Action, type PermissionContext, type Role } from '@/lib/permissions';
import { ROLE_LABELS } from '@/lib/roleLabels';

interface User {
  id: string;
  name: string;
  email: string;
  /** Display label of the role (translated). */
  role: string;
  /** Machine role from app_metadata (never from user_metadata). */
  roleKey: Role;
}

/** What we keep in state; the translated role label is derived at render time. */
type RawUser = Omit<User, 'role'>;

interface AuthContextType {
  user: User | null;
  /** Permission check for the signed-in user (false when signed out). */
  can: (action: Action, ctx?: PermissionContext) => boolean;
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

/** Minimal shape of a Supabase auth user that we read. */
interface SupabaseAuthUser {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string } & Record<string, unknown>;
  app_metadata?: { role?: unknown } & Record<string, unknown>;
}

function buildUser(u: SupabaseAuthUser): RawUser {
  const roleKey = parseRole(u.app_metadata?.role);
  return {
    id: u.id,
    name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Admin',
    email: u.email || '',
    roleKey,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [rawUser, setUser] = useState<RawUser | null>(null);
  const [loading, setLoading] = useState(true);
  const user = useMemo<User | null>(
    () => (rawUser ? { ...rawUser, role: t(ROLE_LABELS[rawUser.roleKey]) } : null),
    [rawUser, t]
  );

  const fetchSession = async () => {
    try {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const u = session.user;
          setUser(buildUser(u));
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
          id: 'dev-mock-user',
          name: profileName,
          email: 'dzaky@bki.academy',
          roleKey: 'admin',
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
          setUser(buildUser(u));
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
          setUser(buildUser(data.user));
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
            id: 'dev-mock-user',
            name: t('Admin Sistem'),
            email: 'dzaky@bki.academy',
              roleKey: 'admin',
          });
          setLoading(false);
          return { success: true };
        }
      }

      setLoading(false);
      return { success: false, error: 'Login failed: Invalid email or password' };
    } catch (err) {
      setLoading(false);
      return { success: false, error: getErrorMessage(err, 'Authentication error') };
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
    } catch (err) {
      return { success: false, error: getErrorMessage(err, 'Failed to update profile') };
    }
  };

  const canDo = useCallback(
    (action: Action, ctx?: PermissionContext) =>
      user ? can(user.roleKey, action, { userId: user.id, ...ctx }) : false,
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, can: canDo, loading, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

/** `const can = useCan(); can('data.write')`, `can('delete.lead', { ownerId: lead.created_by })`. */
export function useCan() {
  return useAuth().can;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
