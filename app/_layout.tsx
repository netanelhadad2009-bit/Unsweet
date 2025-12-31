/**
 * Root Layout - Auth Guard
 *
 * Strict authentication guard that handles:
 * - Session persistence and auto-login
 * - Logout redirection (the "Traffic Cop")
 * - Deep links for OAuth and password reset
 * - Splash screen control to prevent flash of unauthenticated content
 */

import { Stack, useRouter, useSegments, Redirect } from 'expo-router';
import { View, StyleSheet, Text, Pressable, Image, Modal, Platform, InteractionManager } from 'react-native';
import { useEffect, useState, useCallback, useRef } from 'react';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import appsFlyer from 'react-native-appsflyer';
import { markSdkInitialized } from '../services/AnalyticsService';

// Prevent the splash screen from auto-hiding before auth is resolved
SplashScreen.preventAutoHideAsync();

// AppsFlyer Configuration
const APPSFLYER_DEV_KEY = 'Tm4JBxwBJwU7s9kuDWw9qE';
const APPLE_APP_ID = '6739663479'; // App Store Connect ID

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
import '../global.css';
import { OnboardingProvider } from '../contexts/OnboardingContext';
import { SubscriptionProvider, useSubscription } from '../contexts/SubscriptionContext';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { initializeNotifications } from '../services/notificationService';

// Inner component that handles subscription-based routing
// Must be inside SubscriptionProvider to use useSubscription
// CRITICAL: This gate blocks access to tabs until subscription status is confirmed
// Also handles redirecting logged-in users from landing page to the right destination
function SubscriptionGate({ children, session }: { children: React.ReactNode; session: Session | null }) {
  const segments = useSegments();
  const { isPro, isLoading, isInitialized, isSyncingUser } = useSubscription();

  const inTabsGroup = segments[0] === '(tabs)';
  const isOnLandingPage = !segments[0] || segments[0] === 'index';
  const isOnPaywall = segments[0] === 'paywall';

  // Check if we're still waiting for subscription status
  // Include isSyncingUser to wait for RevenueCat to identify returning users
  const isWaitingForStatus = !isInitialized || isLoading || isSyncingUser;

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

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

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
          if (skipNextLandingModal) {
            skipNextLandingModal = false; // Reset the flag
          } else {
            setForceShowLanding(true);
          }
        }

        // When user signs in, allow normal navigation
        if (event === 'SIGNED_IN') {
          setForceShowLanding(false);
        }

        // Note: INITIAL_SESSION and TOKEN_REFRESHED don't change forceShowLanding

        setSession(newSession);
        setInitialized(true);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Auth stability delay - prevents race conditions during LOGOUT only
  // We don't reset on login because it interferes with pending navigation (signup → plan-ready)
  const prevSessionRef = useRef<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!initialized) return;

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
  }, [session, initialized]);

  // Hide splash screen once auth is fully resolved
  // This prevents the flash of unauthenticated content
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
  // This runs AFTER forceShowLanding becomes true and commits the navigation
  useEffect(() => {
    if (forceShowLanding && !session && initialized) {
      // Use a small delay to ensure state has settled
      const timer = setTimeout(() => {
        router.replace('/');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [forceShowLanding, session, initialized, router]);

  // Initialize notifications when user is authenticated
  useEffect(() => {
    if (initialized && session) {
      initializeNotifications();
    }
  }, [initialized, session]);

  // AppsFlyer SDK initialization with ATT request
  const appsFlyerInitialized = useRef(false);

  useEffect(() => {
    // Wait for auth to be stable (splash screen hidden) before initializing
    if (!initialized || !isAuthStable) return;
    if (appsFlyerInitialized.current) return;

    // Mark as initialized IMMEDIATELY to prevent double execution
    appsFlyerInitialized.current = true;

    // Wait for all animations/interactions to complete
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      // Additional delay to ensure UI is fully visible and stable
      setTimeout(async () => {
        // Request tracking permission on iOS (shows ATT popup)
        if (Platform.OS === 'ios') {
          try {
            await requestTrackingPermissionsAsync();
          } catch (error) {
            console.error('[AppsFlyer] ATT request error:', error);
          }
        }

        // Initialize AppsFlyer after ATT response
        appsFlyer.initSdk(
          {
            devKey: APPSFLYER_DEV_KEY,
            isDebug: __DEV__,
            appId: APPLE_APP_ID,
            onInstallConversionDataListener: true,
            onDeepLinkListener: true,
            timeToWaitForATTUserAuthorization: 0, // Already handled ATT above
          },
          () => {
            markSdkInitialized();
          },
          (error) => {
            console.error('[AppsFlyer] SDK init failed:', error);
          }
        );

        appsFlyer.onInstallConversionData(() => {});

        appsFlyer.onDeepLink(() => {});
      }, 2000);
    });

    return () => interactionHandle.cancel();
  }, [initialized, isAuthStable]);

  // THE AUTH GUARD - Traffic Cop Logic (useEffect version for runtime navigation)
  // This handles navigation changes DURING the app lifecycle (not initial load)
  // Initial load redirect is handled synchronously in render via <Redirect>
  useEffect(() => {
    // Skip auth guard when:
    // - Not initialized yet
    // - Forcing landing page (logout flow)
    // - Auth state is not stable (session just changed)
    if (!initialized || forceShowLanding || !isAuthStable) return;

    const inTabsGroup = segments[0] === '(tabs)';

    // Rule 1: User NOT logged in but in protected area -> Kick to Landing
    // Exception: Allow unauthenticated users in onboarding/signup flows
    if (!session && inTabsGroup) {
      router.replace('/');
      return;
    }

    // Note: Rule 2 (logged in on landing -> tabs) is now handled in render
    // via <Redirect> component to prevent flash of unauthenticated content
  }, [session, initialized, segments, router, forceShowLanding, isAuthStable]);

  // CRITICAL: Don't render navigation until auth is fully resolved
  // This keeps the native splash screen visible and prevents flash of unauthenticated content
  if (!initialized || !isAuthStable) {
    // Return null to keep native splash screen visible
    // The splash will be hidden by onLayoutReady once auth is stable
    return null;
  }

  // Route detection for various checks
  const isOnLandingPage = !segments[0] || segments[0] === 'index';
  const isOnOnboarding = segments[0] === 'onboarding';
  const isOnSignup = segments[0] === 'signup';
  const isOnPaywall = segments[0] === 'paywall';
  const isOnTabs = segments[0] === '(tabs)';
  const isInProtectedFlow = isOnOnboarding || isOnSignup || isOnPaywall;

  // NOTE: Logged-in user redirect is now handled by SubscriptionGate
  // This prevents flash of paywall for Pro users by waiting for subscription status


  // FORCE SHOW LANDING PAGE after logout (bypasses broken navigation)
  // NOTE: We intentionally do NOT use a key on Stack to prevent remounting
  // which would cancel pending navigations during signup/login flows

  // Landing page content component (used in both Modal and fallback)
  const LandingPageContent = () => (
    <View style={styles.landingContainer}>
      <View style={styles.landingHeader}>
        <Text style={styles.landingAppName}>Unsweet</Text>
      </View>
      <View style={styles.landingHero}>
        <Image
          source={require('@/assets/images/welcome-hero.webp')}
          style={styles.landingHeroImage}
          resizeMode="contain"
        />
      </View>
      <View style={styles.landingContent}>
        <View style={styles.landingTextContainer}>
          <Text style={styles.landingTitle}>
            Kick the Sugar.{'\n'}Reclaim Your Energy.
          </Text>
          <Text style={styles.landingSubtitle}>
            The smartest way to track cravings and build healthy habits.
          </Text>
        </View>
        <View style={styles.landingButtonContainer}>
          <Pressable
            onPress={() => {
              setForceShowLanding(false);
              router.replace('/onboarding/flow');
            }}
            style={({ pressed }) => [
              styles.landingPrimaryButton,
              pressed && styles.landingButtonPressed,
            ]}
          >
            <Text style={styles.landingPrimaryButtonText}>Get Started</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setForceShowLanding(false);
              router.replace('/(auth)/login');
            }}
            style={({ pressed }) => [
              styles.landingSecondaryButton,
              pressed && styles.landingSecondaryButtonPressed,
            ]}
          >
            <Text style={styles.landingSecondaryButtonText}>I have an account</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  // If forceShowLanding is true and no session, show landing modal over everything
  const showLandingOverlay = forceShowLanding && !session;

  return (
    <SubscriptionProvider>
    <OnboardingProvider>
      <SubscriptionGate session={session}>
      {/* Full-screen modal that covers everything when logout happens */}
      <Modal
        visible={showLandingOverlay}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          // Android back button - navigate to onboarding
          setForceShowLanding(false);
          router.replace('/onboarding/flow');
        }}
      >
        <LandingPageContent />
      </Modal>

      <Stack
        screenOptions={{
          title: '', // Prevents filename from flashing before dynamic title loads
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerTintColor: '#1C1C1E',
          headerTitleStyle: {
            fontWeight: 'bold',
            color: '#1C1C1E',
          },
          headerShadowVisible: false,
          headerBackTitle: '',
          headerBackTitleVisible: false,
          animation: 'fade',
          animationDuration: 300,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Unsweet',
            headerShown: false
          }}
        />
        <Stack.Screen
          name="onboarding/flow"
          options={{
            headerShown: false,
            gestureEnabled: false,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="onboarding/plan-ready"
          options={{
            headerShown: false,
            gestureEnabled: false,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="paywall/index"
          options={{
            title: 'Choose Your Plan',
            headerShown: false,
            presentation: 'card',
            gestureEnabled: false, // Prevent swipe back - user must subscribe
          }}
        />
        <Stack.Screen
          name="signup/index"
          options={{
            title: 'Sign Up',
            headerShown: false,
            presentation: 'card'
          }}
        />
        <Stack.Screen
          name="(auth)/login"
          options={{
            title: 'Login',
            headerShown: true
          }}
        />
        <Stack.Screen
          name="(auth)/forgot-password"
          options={{
            title: 'Forgot Password',
            headerShown: false
          }}
        />
        <Stack.Screen
          name="(auth)/reset-password"
          options={{
            title: 'Reset Password',
            headerShown: false
          }}
        />
        <Stack.Screen
          name="(auth)/sign-up"
          options={{
            title: 'Create Account',
            headerShown: true
          }}
        />
        <Stack.Screen
          name="(app)"
          options={{
            headerShown: false
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="personal-details"
          options={{
            title: 'Personal Details',
            headerShown: true,
            headerStyle: { backgroundColor: 'white' },
            headerShadowVisible: false,
            headerTintColor: '#1F2937',
            headerBackTitleVisible: false,
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <Stack.Screen
          name="analytics/[type]"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: '#F2F2F7' },
            headerShadowVisible: false,
            headerTintColor: '#10B981',
          }}
        />
        <Stack.Screen
          name="mood-tracker"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: '#F8FAF9' },
            headerShadowVisible: false,
            headerTintColor: '#10B981',
          }}
        />
        <Stack.Screen
          name="streak-details"
          options={{
            title: 'Streak Details',
            headerShown: true,
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerShadowVisible: false,
            headerTintColor: '#1C1C1E',
            headerBackTitleVisible: false,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
      </Stack>
      </SubscriptionGate>
    </OnboardingProvider>
    </SubscriptionProvider>
  );
}

const styles = StyleSheet.create({
  // Landing page styles (for forced render after logout)
  landingContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  landingHeader: {
    paddingTop: 60,
    paddingBottom: 10,
    alignItems: 'center',
  },
  landingAppName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3436',
    letterSpacing: 0.5,
  },
  landingHero: {
    height: 450,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  landingHeroImage: {
    width: '120%',
    height: '120%',
  },
  landingContent: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 48,
    justifyContent: 'flex-end',
  },
  landingTextContainer: {
    gap: 12,
    marginBottom: 24,
  },
  landingTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2D3436',
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  landingSubtitle: {
    fontSize: 18,
    color: '#636E72',
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  landingButtonContainer: {
    gap: 16,
  },
  landingPrimaryButton: {
    backgroundColor: '#00C897',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#00C897',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  landingButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  landingPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  landingSecondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  landingSecondaryButtonPressed: {
    opacity: 0.6,
  },
  landingSecondaryButtonText: {
    color: '#636E72',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
