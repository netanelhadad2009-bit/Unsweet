/**
 * Analytics Service - AppsFlyer Event Tracking
 *
 * Provides a unified interface for tracking user events throughout the app.
 * Events are used to build conversion funnels in AppsFlyer dashboard.
 *
 * Funnel Events:
 * 1. onboarding_start - User starts the questionnaire
 * 2. onboarding_complete - User finishes questionnaire, views signup
 * 3. af_complete_registration - User successfully registers
 * 4. af_purchase - Handled by RevenueCat automatically
 * 5. add_journal_entry - User adds a food entry (core engagement)
 */

import appsFlyer from 'react-native-appsflyer';

// Event name constants for type safety
export const AnalyticsEvents = {
  ONBOARDING_START: 'onboarding_start',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  REGISTRATION_COMPLETE: 'af_complete_registration',
  ADD_JOURNAL_ENTRY: 'add_journal_entry',
} as const;

type EventValues = Record<string, string | number | boolean>;

// Track if SDK is likely initialized (based on timing)
let sdkInitTime: number | null = null;
const SDK_INIT_DELAY_MS = 4000; // AppsFlyer initializes ~2s after app start + buffer

/**
 * Mark SDK as initialized (call this after appsFlyer.initSdk succeeds)
 */
export const markSdkInitialized = (): void => {
  sdkInitTime = Date.now();
};

/**
 * Log an event to AppsFlyer
 *
 * @param eventName - The name of the event (use AnalyticsEvents constants)
 * @param eventValues - Optional key-value pairs for event parameters
 */
export const logEvent = async (
  eventName: string,
  eventValues: EventValues = {}
): Promise<void> => {
  try {
    // If SDK hasn't been marked as initialized, wait a bit
    // This handles events fired very early in app lifecycle
    if (!sdkInitTime) {
      await new Promise(resolve => setTimeout(resolve, SDK_INIT_DELAY_MS));
    }

    await appsFlyer.logEvent(eventName, eventValues);
  } catch (error: any) {
    // Don't throw - analytics failures shouldn't break the app
    // Network errors are common in dev/sandbox environments
    if (__DEV__ && !error?.message?.includes('network')) {
      console.error(`[Analytics] ❌ Failed to log event: ${eventName}`, error);
    }
  }
};

/**
 * Track onboarding start
 * Call when user enters the first onboarding screen
 */
export const trackOnboardingStart = (): void => {
  logEvent(AnalyticsEvents.ONBOARDING_START, {
    timestamp: Date.now(),
  });
};

/**
 * Track onboarding completion
 * Call when user finishes all questionnaire steps
 */
export const trackOnboardingComplete = (): void => {
  logEvent(AnalyticsEvents.ONBOARDING_COMPLETE, {
    timestamp: Date.now(),
  });
};

/**
 * Track successful registration
 * Call after user successfully creates an account
 *
 * @param method - The registration method used (email, apple, google)
 */
export const trackRegistrationComplete = (
  method: 'email' | 'apple' | 'google'
): void => {
  logEvent(AnalyticsEvents.REGISTRATION_COMPLETE, {
    registration_method: method,
    timestamp: Date.now(),
  });
};

/**
 * Track journal entry addition
 * Call when user successfully logs a food item
 *
 * @param itemName - Name of the food item
 * @param sugarLevel - Sugar level classification (safe, natural, avoid)
 * @param totalSugar - Total sugar in grams (optional)
 */
export const trackJournalEntry = (
  itemName: string,
  sugarLevel?: string,
  totalSugar?: number
): void => {
  const eventValues: EventValues = {
    item_name: itemName,
    timestamp: Date.now(),
  };

  if (sugarLevel) {
    eventValues.sugar_level = sugarLevel;
  }

  if (totalSugar !== undefined) {
    eventValues.total_sugar_grams = totalSugar;
  }

  logEvent(AnalyticsEvents.ADD_JOURNAL_ENTRY, eventValues);
};
