/**
 * AppProviders - Clean Provider Composition
 *
 * Wraps the app with all necessary providers in the correct order.
 * Provider order matters:
 * - PostHogProvider must be outermost (for analytics in other providers)
 * - AuthProvider uses PostHog for identify/reset
 * - SubscriptionProvider needs session for RevenueCat
 * - OnboardingProvider is independent
 */

import React from 'react';
import { PostHogProvider } from 'posthog-react-native';
import { AuthProvider } from '../contexts/AuthContext';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';
import { OnboardingProvider } from '../contexts/OnboardingContext';
import { ScreenViewTracker } from './ScreenViewTracker';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <PostHogProvider
      apiKey="phc_c2ED0tBSqsuVpnJiM8WUUqSbwEYoGeFcWnKUz7NuQ5H"
      options={{
        host: "https://us.i.posthog.com",
        enableSessionReplay: true,
      }}
    >
      <AuthProvider>
        <ScreenViewTracker />
        <SubscriptionProvider>
          <OnboardingProvider>
            {children}
          </OnboardingProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </PostHogProvider>
  );
}
