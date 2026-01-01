import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator, Platform, Linking, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Theme } from '../../../constants/Theme';
import { useOnboarding } from '../../../contexts/OnboardingContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// ANDROID-ONLY: Setup notification channel before requesting permissions
// Required for Android 8+ to display notifications properly
// iOS is NOT affected - skipped via Platform check
// ============================================================
async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
    });
  } catch {
    // Silently handle - channel creation might fail on some devices
  }
}

const COLORS = {
  iosBlue: '#007AFF', cardBg: '#E8E8E8', white: '#FFFFFF', black: '#000000',
  errorRed: '#F87171', errorBg: 'rgba(239, 68, 68, 0.1)', errorBorder: 'rgba(239, 68, 68, 0.2)',
  successBg: 'rgba(0, 200, 151, 0.1)', successBorder: 'rgba(0, 200, 151, 0.3)', mutedText: '#636E72',
};

type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'checking';

const SettingsIcon = ({ size = 20, color = Theme.colors.text.primary }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
    <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </Svg>
);

const BouncingHand = ({ visible }: { visible: boolean }) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.loop(Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -10, duration: 500, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])).start();
    }
  }, [visible]);
  if (!visible) return null;
  return <Animated.Text style={[styles.bouncingHand, { transform: [{ translateY: bounceAnim }] }]}>👆</Animated.Text>;
};

export default function NotificationsContent() {
  const { goToNextScreen } = useOnboarding();
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('checking');
  const cardAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => { checkPermissionStatus(); }, []);

  useEffect(() => {
    if (permissionStatus !== 'checking') {
      Animated.parallel([
        Animated.spring(cardAnim, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [permissionStatus]);

  async function checkPermissionStatus() {
    if (!Device.isDevice) { setPermissionStatus('prompt'); return; }
    try {
      // ============================================================
      // ANDROID 13+ FIX: Always show prompt UI on initial check
      // Android 13+ can return canAskAgain=false even on fresh install
      // before ever requesting permission. Only show Settings UI AFTER
      // the user has actually tried to request permission.
      // ============================================================
      const { status } = await Notifications.getPermissionsAsync();

      if (status === 'granted') {
        // Already granted - skip this screen
        goToNextScreen();
      } else {
        // Not granted - always show prompt UI first
        // Settings UI will only appear after user tries to enable and gets denied
        setPermissionStatus('prompt');
      }
    } catch { setPermissionStatus('prompt'); }
  }

  async function handleRequestPermission() {
    if (loading) return;
    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // ============================================================
      // ANDROID-ONLY: Setup notification channel BEFORE requesting permission
      // This is required for Android 8+ and helps with Android 13+ permission flow
      // iOS skips this step (handled inside the function)
      // ============================================================
      await setupAndroidNotificationChannel();

      // Request notification permissions
      // On Android 13+, this triggers the POST_NOTIFICATIONS runtime permission dialog
      // On iOS, this triggers the standard iOS notification permission dialog
      const { status, canAskAgain } = await Notifications.requestPermissionsAsync({
        android: {
          // Request all notification capabilities on Android
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
        },
      });

      if (status === 'granted') {
        setPermissionStatus('granted');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => goToNextScreen(), 500);
      } else if (canAskAgain === false) {
        // User permanently denied - show settings UI
        setPermissionStatus('denied');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        // User denied but can ask again - continue without blocking
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setTimeout(() => goToNextScreen(), 500);
      }
    } catch {
      // On error, continue to next screen rather than blocking the user
      setTimeout(() => goToNextScreen(), 1000);
    } finally { setLoading(false); }
  }

  const handleDeny = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); goToNextScreen(); };
  const handleSkip = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); goToNextScreen(); };
  const handleOpenSettings = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try { Platform.OS === 'ios' ? await Linking.openURL('app-settings:') : await Linking.openSettings(); } catch {}
  };

  if (permissionStatus === 'checking') {
    return <View style={styles.container}><ActivityIndicator size="large" color={Theme.colors.primary} /></View>;
  }

  return (
    <View style={styles.content}>
      <View style={styles.headingContainer}><Text style={styles.heading}>Stay on track{'\n'}with notifications</Text></View>
      {permissionStatus === 'prompt' ? (
        <Animated.View style={[styles.cardContainer, { opacity: cardAnim, transform: [{ scale: cardScale }] }]}>
          <View style={styles.card}>
            <View style={styles.cardHeader}><Text style={styles.cardTitle}>"Unsweet" Would Like to Send You Notifications</Text></View>
            <View style={styles.cardButtons}>
              <TouchableOpacity style={styles.denyButton} onPress={handleDeny} activeOpacity={0.7}><Text style={styles.denyButtonText}>Don't Allow</Text></TouchableOpacity>
              <TouchableOpacity style={styles.allowButton} onPress={handleRequestPermission} activeOpacity={0.8} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.allowButtonText}>Allow</Text>}
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.handContainer}><BouncingHand visible={!loading} /></View>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.deniedContainer, { opacity: cardAnim, transform: [{ scale: cardScale }] }]}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {Platform.OS === 'android'
                ? "Notifications are disabled. On Android, you'll need to enable them in your device Settings to receive meal reminders."
                : "Notifications denied. You can enable them from Settings later."}
            </Text>
          </View>
          <TouchableOpacity style={styles.settingsButton} onPress={handleOpenSettings} activeOpacity={0.8}>
            <SettingsIcon size={20} color={COLORS.white} /><Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}><Text style={styles.skipButtonText}>Continue without notifications</Text></TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headingContainer: { marginBottom: 48, paddingHorizontal: 24 },
  heading: { fontFamily: Theme.fonts.extraBold, fontSize: 32, fontWeight: '800', color: Theme.colors.text.primary, textAlign: 'center', lineHeight: 40 },
  cardContainer: { alignItems: 'center' },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 28, overflow: 'hidden', width: Math.min(340, SCREEN_WIDTH - 40), shadowColor: COLORS.black, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  cardHeader: { paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24 },
  cardTitle: { fontFamily: Theme.fonts.semiBold, fontSize: 17, fontWeight: '600', color: COLORS.black, textAlign: 'center', lineHeight: 24 },
  cardButtons: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  denyButton: { flex: 1, height: 50, backgroundColor: 'rgba(0, 0, 0, 0.08)', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  denyButtonText: { fontFamily: Theme.fonts.semiBold, fontSize: 17, fontWeight: '600', color: COLORS.black },
  allowButton: { flex: 1, height: 50, backgroundColor: COLORS.iosBlue, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  allowButtonText: { fontFamily: Theme.fonts.semiBold, fontSize: 17, fontWeight: '600', color: COLORS.white },
  handContainer: { marginTop: 20, marginLeft: 120, height: 60 },
  bouncingHand: { fontSize: 48 },
  deniedContainer: { alignItems: 'center', paddingHorizontal: 24, width: '100%', maxWidth: 340 },
  errorBox: { backgroundColor: COLORS.errorBg, borderWidth: 1, borderColor: COLORS.errorBorder, borderRadius: 16, padding: 16, marginBottom: 24, width: '100%' },
  errorText: { fontFamily: Theme.fonts.regular, fontSize: 14, color: COLORS.errorRed, textAlign: 'center', lineHeight: 20 },
  settingsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, backgroundColor: Theme.colors.primary, borderRadius: 28, paddingHorizontal: 32, width: '100%', marginBottom: 16, ...Theme.shadows.medium },
  settingsButtonText: { fontFamily: Theme.fonts.bold, fontSize: 18, fontWeight: '700', color: COLORS.white },
  skipButton: { height: 48, alignItems: 'center', justifyContent: 'center' },
  skipButtonText: { fontFamily: Theme.fonts.medium, fontSize: 16, fontWeight: '500', color: COLORS.mutedText },
});
