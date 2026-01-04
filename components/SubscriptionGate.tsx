/**
 * SubscriptionGate - Subscription-Based Routing Guard
 *
 * Controls access to protected routes based on subscription status.
 * Redirects users appropriately based on their Pro status.
 *
 * CRITICAL: This gate blocks access to tabs until subscription status is confirmed.
 * Also handles redirecting logged-in users from landing page to the right destination.
 */

import React from 'react';
import { useSegments, Redirect } from 'expo-router';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Session } from '@supabase/supabase-js';

interface SubscriptionGateProps {
  children: React.ReactNode;
  session: Session | null;
}

export function SubscriptionGate({ children, session }: SubscriptionGateProps) {
  const segments = useSegments();
  const { isPro, isLoading, isInitialized, isSyncingUser, isProDetermined } = useSubscription();

  const inTabsGroup = segments[0] === '(tabs)';
  const isOnLandingPage = !segments[0] || segments[0] === 'index';
  const isOnPaywall = segments[0] === 'paywall';

  // Check if we're still waiting for subscription status
  // Include isSyncingUser to wait for RevenueCat to identify returning users
  // CRITICAL: Also wait for isProDetermined to ensure isPro has been explicitly set
  // This prevents redirects based on the default isPro=false before sync completes
  const isWaitingForStatus = !isInitialized || isLoading || isSyncingUser || !isProDetermined;

  // CRITICAL: For logged-in users, wait for subscription status before any redirect
  // This prevents the flash of paywall for Pro users (including returning subscribers)
  if (session && (isOnLandingPage || isOnPaywall) && isWaitingForStatus) {
    return null; // Keep splash screen visible
  }

  // CRITICAL: Block rendering tabs until subscription status is confirmed
  // This prevents any flash of app content while checking subscription
  if (inTabsGroup && isWaitingForStatus) {
    return null;
  }

  // SYNCHRONOUS REDIRECT: Logged-in user on landing page -> redirect based on Pro status
  // This prevents flash of paywall for Pro users
  if (session && isOnLandingPage && !isWaitingForStatus) {
    if (isPro) {
      return <Redirect href="/(tabs)" />;
    } else {
      return <Redirect href="/paywall" />;
    }
  }

  // SYNCHRONOUS REDIRECT: Pro user on paywall -> redirect to tabs
  if (session && isOnPaywall && isPro && !isWaitingForStatus) {
    return <Redirect href="/(tabs)" />;
  }

  // SYNCHRONOUS REDIRECT: Non-pro users trying to access tabs get sent to paywall
  // This uses the Redirect component for immediate navigation (no useEffect delay)
  if (inTabsGroup && !isPro && !isWaitingForStatus) {
    return <Redirect href="/paywall" />;
  }

  return <>{children}</>;
}
