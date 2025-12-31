import { Platform } from 'react-native';

// Notifications module - only available in native builds
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
} catch (error) {
  // Module not available in Expo Go or not properly linked
}

// Configure notification handler if available
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (!Notifications) {
    return 'undetermined';
  }
  const { status } = await Notifications.getPermissionsAsync();
  return status as NotificationPermissionStatus;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!Notifications) {
    return 'granted'; // Simulate granted for Expo Go development
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return 'granted';
  }

  if (existingStatus === 'denied') {
    return 'denied';
  }

  // This will show the REAL native iOS/Android permission dialog
  const { status } = await Notifications.requestPermissionsAsync();
  return status as NotificationPermissionStatus;
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications) {
    return null;
  }

  try {
    const permissionStatus = await requestNotificationPermission();

    if (permissionStatus !== 'granted') {
      return null;
    }

    // Get the Expo push token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00C897',
      });
    }

    return token.data;
  } catch (error) {
    return null;
  }
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: any
): Promise<string | null> {
  if (!Notifications) {
    return null;
  }

  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger,
  });
}

export async function cancelAllNotifications(): Promise<void> {
  if (!Notifications) {
    return;
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export function isNotificationsAvailable(): boolean {
  return Notifications !== null;
}
