/**
 * AuthContext - Centralized Authentication State Management
 *
 * Handles:
 * - Session persistence and auto-login
 * - Supabase auth state changes
 * - Deep links for OAuth and password reset
 * - PostHog user identification
 * - Auth stability for preventing race conditions
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { usePostHog } from 'posthog-react-native';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

// Global flag to prevent landing modal when signout is from login verification failure
// This allows the login screen to show its error message instead of the modal
let skipNextLandingModal = false;

export const setSkipNextLandingModal = (skip: boolean) => {
  skipNextLandingModal = skip;
};

// Global state for login error that persists across remounts
// This is needed because Stack remounts when auth state changes
let persistedLoginError: string | null = null;

export const setPersistedLoginError = (error: string | null) => {
  persistedLoginError = error;
};

export const getPersistedLoginError = (): string | null => {
  const error = persistedLoginError;
  persistedLoginError = null; // Clear after reading (one-time use)
  return error;
};

interface AuthContextType {
  session: Session | null;
  initialized: boolean;
  isAuthStable: boolean;
  forceShowLanding: boolean;
  setForceShowLanding: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const posthog = usePostHog();

  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [forceShowLanding, setForceShowLanding] = useState(false);
  const [isAuthStable, setIsAuthStable] = useState(false);

  // Handle deep links for OAuth callback and password reset
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;

      // Check if this is a password reset link
      if (url.includes('reset-password') && url.includes('access_token')) {
        const hashIndex = url.indexOf('#');
        if (hashIndex !== -1) {
          const fragment = url.substring(hashIndex + 1);
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const type = params.get('type');

          if (accessToken && refreshToken && type === 'recovery') {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!error) {
              router.replace('/(auth)/reset-password');
            }
          }
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription.remove();
  }, [router]);

  // Setup Auth Listener - Simple and Clean
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // IMPORTANT: Set forceShowLanding BEFORE session to ensure proper render order
        // When user signs out, force show landing page (unless skipped for login verification)
        if (event === 'SIGNED_OUT') {
          // PostHog: Reset user identity on logout for data privacy
          posthog?.reset();

          if (skipNextLandingModal) {
            skipNextLandingModal = false; // Reset the flag
          } else {
            setForceShowLanding(true);
          }
        }

        // When user signs in, allow normal navigation
        if (event === 'SIGNED_IN') {
          // PostHog: Identify user on login
          if (newSession?.user) {
            const userProperties: Record<string, string> = {};
            if (newSession.user.email) {
              userProperties.email = newSession.user.email;
            }
            posthog?.identify(newSession.user.id, userProperties);
          }

          setForceShowLanding(false);
        }

        // Note: INITIAL_SESSION and TOKEN_REFRESHED don't change forceShowLanding

        setSession(newSession);
        setInitialized(true);
      }
    );

    return () => subscription.unsubscribe();
  }, [posthog]);

  // Auth stability delay - prevents race conditions during LOGOUT only
  // We don't reset on login because it interferes with pending navigation (signup → plan-ready)
  const prevSessionRef = useRef<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!initialized) return undefined;

    // Detect logout: previous session existed, now it's null
    const isLogout = prevSessionRef.current !== undefined &&
                     prevSessionRef.current !== null &&
                     session === null;

    if (isLogout) {
      // Only reset stability on logout to allow landing page transition
      setIsAuthStable(false);
      const stabilityTimer = setTimeout(() => {
        setIsAuthStable(true);
      }, 200);
      prevSessionRef.current = session;
      return () => clearTimeout(stabilityTimer);
    }

    // For login or initial session, mark as stable immediately
    prevSessionRef.current = session;
    if (!isAuthStable) {
      setIsAuthStable(true);
    }
    return undefined;
  }, [session, initialized]);

  // Hide splash screen once auth is fully resolved
  const onLayoutReady = useCallback(async () => {
    if (initialized && isAuthStable) {
      // Small delay to ensure navigation state is committed
      await new Promise(resolve => setTimeout(resolve, 50));
      await SplashScreen.hideAsync();
    }
  }, [initialized, isAuthStable]);

  useEffect(() => {
    onLayoutReady();
  }, [onLayoutReady]);

  // Dedicated effect for handling logout navigation
  useEffect(() => {
    if (forceShowLanding && !session && initialized) {
      // Use a small delay to ensure state has settled
      const timer = setTimeout(() => {
        router.replace('/');
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [forceShowLanding, session, initialized, router]);

  const value: AuthContextType = {
    session,
    initialized,
    isAuthStable,
    forceShowLanding,
    setForceShowLanding,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
