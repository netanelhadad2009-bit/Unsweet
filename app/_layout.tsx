/**
 * Root Layout - Navigation Structure
 *
 * Simplified layout that handles:
 * - Stack navigation configuration
 * - Android back button handler
 * - Landing page modal for logout flow
 * - AppsFlyer SDK initialization
 *
 * Auth, providers, and subscription logic are extracted to dedicated modules.
 */

import { Stack, useRouter, useSegments } from 'expo-router';
import { Modal, Platform, BackHandler, I18nManager } from 'react-native';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

// ============================================================
// ANDROID-ONLY: Force LTR (Left-to-Right) layout
// Prevents Hebrew/Arabic system language from flipping the English app UI
// iOS is NOT affected - this check ensures iOS Gold Master stays untouched
// ============================================================
if (Platform.OS === 'android') {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}

import '../global.css';
import { AppProviders } from '../components/AppProviders';
import { SubscriptionGate } from '../components/SubscriptionGate';
import { LandingPageContent } from '../components/LandingPageContent';
import { useAuth } from '../contexts/AuthContext';
import { useAppsFlyerInit } from '../hooks/useAppsFlyerInit';
import { initializeNotifications } from '../services/notificationService';

// Prevent the splash screen from auto-hiding before auth is resolved
SplashScreen.preventAutoHideAsync();

// Re-export global state setters for use in other components
export { setSkipNextLandingModal, setPersistedLoginError, getPersistedLoginError } from '../contexts/AuthContext';

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const { session, initialized, isAuthStable, forceShowLanding, setForceShowLanding } = useAuth();

  // Initialize AppsFlyer SDK with ATT request
  useAppsFlyerInit({ initialized, isAuthStable });

  // Initialize notifications when user is authenticated
  useEffect(() => {
    if (initialized && session) {
      initializeNotifications();
    }
  }, [initialized, session]);

  // ============================================================
  // ANDROID-ONLY: Hardware Back Button Handler
  // Provides native Android navigation experience
  // iOS is NOT affected - wrapped in Platform.OS check
  // ============================================================
  useEffect(() => {
    // Skip entirely on iOS - this effect does nothing on iOS
    if (Platform.OS !== 'android') return;

    const handleBackPress = () => {
      // Check if we can go back in the navigation stack
      if (router.canGoBack()) {
        router.back();
        return true; // Prevent default behavior (exit app)
      }
      // At root - allow default behavior (minimize/exit app)
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [router]);

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
    // The splash will be hidden by AuthContext once auth is stable
    return null;
  }

  // If forceShowLanding is true and no session, show landing modal over everything
  const showLandingOverlay = forceShowLanding && !session;

  return (
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
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootLayoutContent />
    </AppProviders>
  );
}
