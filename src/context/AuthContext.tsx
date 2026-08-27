'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/db';

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
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

    // Mock fallback
    if (typeof window !== 'undefined') {
      const mockSession = localStorage.getItem('bki_mock_session');
      if (mockSession === 'true') {
        const profileName = localStorage.getItem('profileName') || 'System Admin';
        setUser({
          name: profileName,
          email: 'dzaky@bki.academy',
          role: 'System Admin',
        });
      } else {
        setUser(null);
      }
    }
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
          // If Supabase signed out, check if mock is active before clearing
          const mockSession = localStorage.getItem('bki_mock_session');
          if (mockSession !== 'true') {
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
        if (error) {
          setLoading(false);
          return { success: false, error: error.message };
        }
        if (data.user) {
          setUser({
            name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Admin',
            email: data.user.email || '',
            role: data.user.user_metadata?.role || 'Admin',
          });
          setLoading(false);
          return { success: true };
        }
      } else {
        // Mock fallback
        if (email === 'dzaky@bki.academy' && pass === 'Dzaky123BKI') {
          if (typeof window !== 'undefined') {
            localStorage.setItem('bki_mock_session', 'true');
            localStorage.setItem('profileName', 'System Admin');
          }
          setUser({
            name: 'System Admin',
            email: 'dzaky@bki.academy',
            role: 'System Admin',
          });
          setLoading(false);
          return { success: true };
        } else {
          setLoading(false);
          return { success: false, error: 'Local login failed: Use dzaky@bki.academy and password "Dzaky123BKI"' };
        }
      }
    } catch (err: any) {
      setLoading(false);
      return { success: false, error: err?.message || 'Authentication error' };
    }
    setLoading(false);
    return { success: false, error: 'Auth provider mismatch' };
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
      localStorage.removeItem('bki_mock_session');
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
