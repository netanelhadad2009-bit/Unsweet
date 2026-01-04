/**
 * useAppsFlyerInit - AppsFlyer SDK Initialization Hook
 *
 * Handles:
 * - ATT (App Tracking Transparency) permission request on iOS
 * - AppsFlyer SDK initialization after ATT response
 * - Deep link and conversion data listeners
 *
 * IMPORTANT: Waits for auth to be stable before initializing
 * to ensure proper timing and avoid issues with splash screen.
 */

import { useEffect, useRef } from 'react';
import { Platform, InteractionManager } from 'react-native';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import appsFlyer from 'react-native-appsflyer';
import { markSdkInitialized } from '../services/AnalyticsService';

// AppsFlyer Configuration
const APPSFLYER_DEV_KEY = 'Tm4JBxwBJwU7s9kuDWw9qE';
const APPLE_APP_ID = '6739663479'; // App Store Connect ID

interface UseAppsFlyerInitOptions {
  initialized: boolean;
  isAuthStable: boolean;
}

export function useAppsFlyerInit({ initialized, isAuthStable }: UseAppsFlyerInitOptions) {
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
          (error: unknown) => {
            console.error('[AppsFlyer] SDK init failed:', error);
          }
        );

        appsFlyer.onInstallConversionData(() => {});

        appsFlyer.onDeepLink(() => {});
      }, 2000);
    });

    return () => interactionHandle.cancel();
  }, [initialized, isAuthStable]);
}
