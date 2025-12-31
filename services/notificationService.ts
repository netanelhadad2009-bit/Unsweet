/**
 * Notification Service
 *
 * Handles local push notifications for meal reminders and streak preservation.
 * Uses expo-notifications for scheduling daily reminders.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for notification preference
export const NOTIFICATIONS_ENABLED_KEY = 'unsweet_notifications_enabled';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and register for push notifications
 * @returns The push token if successful, undefined otherwise
 */
export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  // Only works on physical devices
  if (!Device.isDevice) {
    return undefined;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return undefined;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
    });

    // Create a channel specifically for reminders
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Daily Reminders',
      description: 'Meal logging and streak reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
    });
  }

  // Get the Expo push token (for local notifications, we don't need this but it's good to have)
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // Uses the project ID from app.json
    });
    return token.data;
  } catch (error) {
    return undefined;
  }
}

/**
 * Schedule daily reminder notifications
 * Cancels all existing notifications first to avoid duplicates
 */
export async function scheduleDailyReminders(): Promise<void> {
  // Cancel all existing scheduled notifications first
  await cancelAllNotifications();

  // Schedule lunch reminder at 12:00 PM
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Lunch time? 🥗',
      body: "Make sure there's no hidden sugar in your meal!",
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 12,
      minute: 0,
    },
  });

  // Schedule streak saver reminder at 8:00 PM (20:00)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Don't break your streak! 🔥",
      body: 'Log your meals for today to keep your progress alive.',
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
}

/**
 * Cancel all pending scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Check if notifications are enabled in user preferences
 * @returns true if enabled, false otherwise
 */
export async function getNotificationPreference(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    // Default to true if not set (first time user)
    if (value === null) {
      return true;
    }
    return value === 'true';
  } catch (error) {
    return true; // Default to enabled
  }
}

/**
 * Save notification preference to storage
 * @param enabled - Whether notifications should be enabled
 */
export async function setNotificationPreference(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled.toString());
  } catch (error) {
    // Silently handle storage errors
  }
}

/**
 * Enable notifications - request permissions, save preference, and schedule reminders
 * @returns true if successful, false otherwise
 */
export async function enableNotifications(): Promise<boolean> {
  try {
    // Request permissions (token not stored - we use it for local notifications only)
    await registerForPushNotificationsAsync();

    // Check if we got permission
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return false;
    }

    // Schedule daily reminders
    await scheduleDailyReminders();

    // Save preference
    await setNotificationPreference(true);

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Disable notifications - cancel all scheduled and save preference
 */
export async function disableNotifications(): Promise<void> {
  try {
    // Cancel all scheduled notifications
    await cancelAllNotifications();

    // Save preference
    await setNotificationPreference(false);
  } catch (error) {
    // Silently handle errors
  }
}

/**
 * Initialize notifications on app start
 * Checks user preference and schedules reminders if enabled
 */
export async function initializeNotifications(): Promise<void> {
  try {
    const isEnabled = await getNotificationPreference();

    if (isEnabled) {
      // Check if we have permissions
      const { status } = await Notifications.getPermissionsAsync();

      if (status === 'granted') {
        // Re-schedule reminders (in case app was reinstalled or updated)
        await scheduleDailyReminders();
      } else {
        // Try to get permissions
        await enableNotifications();
      }
    }
  } catch (error) {
    // Silently handle initialization errors
  }
}

/**
 * Send a test notification immediately (for debugging)
 */
export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Notification 🧪',
      body: 'Notifications are working correctly!',
      sound: true,
    },
    trigger: null, // Immediate
  });
}
