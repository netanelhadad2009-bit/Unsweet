/**
 * Profile Screen
 *
 * Clean settings menu with navigation to detailed screens.
 * Features user profile card and organized menu sections.
 */

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  Linking,
  ActivityIndicator,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useState, useCallback, useRef } from 'react';
import {
  User,
  LogOut,
  Bell,
  FileText,
  Trash2,
  Mail,
  ChevronRight,
  RotateCcw,
  Shield,
  Crown,
  X,
  Sliders,
  Heart,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { clearAllUserData } from '../../services/UserDataService';
import {
  getNotificationPreference,
  enableNotifications,
  disableNotifications,
} from '../../services/notificationService';

// Light Theme Colors (matching onboarding)
const COLORS = {
  background: '#F9FAFB',
  cardBackground: '#FFFFFF',
  headingText: '#111827',
  bodyText: '#4B5563',
  mutedText: '#9CA3AF',
  primary: '#10B981',
  primaryLight: 'rgba(16, 185, 129, 0.1)',
  border: '#E5E7EB',
  danger: '#EF4444',
  dangerLight: 'rgba(239, 68, 68, 0.1)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.1)',
  gold: '#EAB308',
  goldLight: 'rgba(234, 179, 8, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

// Types
interface ProfileData {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

// URLs for legal pages
const TERMS_URL = 'https://unsweettermsofservice.carrd.co/';
const PRIVACY_URL = 'https://unsweetprivacypolicy.carrd.co/';
const SUPPORT_EMAIL = 'netanel.hadad2580@gmail.com';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const hasInitiallyLoaded = useRef(false);

  // Name editing modal state
  const [isNameModalVisible, setNameModalVisible] = useState(false);
  const [tempName, setTempName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch profile data and notification preference when screen is focused
  useFocusEffect(
    useCallback(() => {
      getProfile();
      loadNotificationPreference();
    }, [])
  );

  // Load notification preference from storage
  const loadNotificationPreference = async () => {
    const isEnabled = await getNotificationPreference();
    setNotificationsEnabled(isEnabled);
  };

  const getProfile = useCallback(async () => {
    try {
      if (!hasInitiallyLoaded.current) {
        setLoading(true);
      }
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, created_at')
          .eq('id', user.id)
          .single();

        if (error) {
          // Fallback profile
          const fallbackProfile: ProfileData = {
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || null,
            created_at: new Date().toISOString(),
          };
          setProfile(fallbackProfile);
        } else if (data) {
          setProfile(data);
        }
      }
    } catch (error) {
      // Silently handle profile fetch errors
    } finally {
      hasInitiallyLoaded.current = true;
      setLoading(false);
    }
  }, []);

  // Check if the name is a valid display name
  const isValidDisplayName = (name: string | null, email: string | null): boolean => {
    if (!name) return false;
    if (email) {
      const emailPrefix = email.split('@')[0];
      if (name === emailPrefix) return false;
    }
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(name)) return false;
    const randomPattern = /^[a-z0-9]{20,}$/i;
    if (randomPattern.test(name)) return false;
    if (name.length > 15 && !name.includes(' ')) return false;
    return true;
  };

  // Get display name with fallback
  const getDisplayName = (): string | null => {
    const name = profile?.full_name;
    const email = profile?.email;
    if (isValidDisplayName(name, email)) {
      return name!;
    }
    return null;
  };

  // Get initials for avatar
  const getInitials = (): string => {
    const name = getDisplayName();
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Check if email should be shown
  const shouldShowEmail = (): boolean => {
    const email = profile?.email;
    if (!email) return false;
    if (email.includes('privaterelay')) return false;
    if (email.includes('appleid')) return false;
    return true;
  };

  // Handle opening name edit modal
  const handleEditName = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempName(getDisplayName() || '');
    setNameModalVisible(true);
  };

  // Handle saving new name
  const handleSaveName = async () => {
    if (!tempName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    try {
      setIsSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: tempName.trim() })
        .eq('id', profile?.id);

      if (error) {
        Alert.alert('Error', 'Failed to update name. Please try again.');
        return;
      }

      setProfile(prev => prev ? { ...prev, full_name: tempName.trim() } : prev);
      setNameModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle opening personal details screen
  const handleEditStats = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/personal-details');
  };

  // Handle sign out - SECURITY: Clear all local data before signing out
  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);

            // SECURITY: Clear ALL user data using centralized service
            // This clears AsyncStorage, RevenueCat, and all user state
            await clearAllUserData();

            // Sign out from Supabase (triggers auth state change)
            await supabase.auth.signOut();

            // Auth guard in _layout.tsx handles navigation to landing page
          } catch (error) {
            setLoading(false);
            console.error('[Profile] Sign out failed:', error);
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  // Handle delete account
  const handleDeleteAccount = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'All your data will be lost forever. Confirm delete?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    setLoading(true);
                    try {
                      // Delete server-side data
                      const { error } = await supabase.rpc('delete_user');
                      if (error) throw error;

                      // SECURITY: Clear ALL local user data
                      await clearAllUserData();

                      // Sign out from Supabase
                      await supabase.auth.signOut();
                    } catch (error) {
                      setLoading(false);
                      Alert.alert('Error', 'Failed to delete account. Please try again.');
                      console.error('[Profile] Delete error:', error);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // Handle contact support
  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Unsweet Support Request`);
  };

  // Handle open URL
  const handleOpenURL = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url);
  };

  // Handle restore purchases
  const handleRestorePurchases = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Restore Purchases', 'Checking for previous purchases...');
  };

  // Toggle notifications
  const toggleNotifications = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (value) {
      // Enable notifications
      const success = await enableNotifications();
      if (success) {
        setNotificationsEnabled(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // Permission denied or error
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in your device settings to receive reminders.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        setNotificationsEnabled(false);
      }
    } else {
      // Disable notifications
      await disableNotifications();
      setNotificationsEnabled(false);
    }
  };

  // Handle reset all data (for demo purposes)
  const handleResetData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Reset All Data',
      'This will clear all your meals, progress, streak data, and settings. You will be taken back to the onboarding flow.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              // SECURITY: Clear ALL user data using centralized service
              await clearAllUserData();

              // Sign out to trigger fresh state
              await supabase.auth.signOut();

              // Navigate to onboarding after a brief delay
              setTimeout(() => {
                router.replace('/onboarding/flow');
              }, 100);
            } catch (error) {
              setLoading(false);
              console.error('[Profile] Reset error:', error);
              Alert.alert('Error', 'Failed to reset data. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Handle share/invite
  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message:
          "I'm quitting sugar with Unsweet! Join me on the journey to a healthier life. Download the app: https://unsweet.app",
      });
    } catch (error: any) {
      // Silently handle share errors
    }
  };

  // Show loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = getDisplayName();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Title */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Interactive Profile Card */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={handleEditName}
          activeOpacity={0.7}
        >
          {/* Avatar with Initials */}
          <View style={styles.profileAvatar}>
            {displayName ? (
              <Text style={styles.avatarText}>{getInitials()}</Text>
            ) : (
              <User size={28} color="#FFFFFF" strokeWidth={1.8} />
            )}
          </View>

          {/* Text Info */}
          <View style={styles.profileInfo}>
            <View style={styles.memberBadge}>
              <Crown size={14} color={COLORS.gold} strokeWidth={2.5} />
              <Text style={styles.memberBadgeText}>Unsweet Member</Text>
            </View>
            <Text style={[
              styles.profileName,
              !displayName && styles.profileNamePlaceholder
            ]}>
              {displayName || 'Tap to set name'}
            </Text>
            {shouldShowEmail() && (
              <Text style={styles.profileEmail}>{profile?.email}</Text>
            )}
          </View>

          <ChevronRight size={22} color={COLORS.mutedText} />
        </TouchableOpacity>

        {/* Personal Details Menu Item */}
        <Text style={styles.sectionTitle}>My Info</Text>
        <View style={styles.menuSection}>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={handleEditStats}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <View style={styles.menuIconContainer}>
              <Sliders size={20} color={COLORS.bodyText} strokeWidth={2} />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuText}>Personal Details</Text>
              <Text style={styles.menuSubtext}>Body stats & tracking settings</Text>
            </View>
            <ChevronRight size={20} color={COLORS.mutedText} />
          </Pressable>
        </View>

        {/* App Settings Section */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.menuSection}>
          <View style={styles.menuItemWithToggle}>
            <View style={styles.menuIconContainer}>
              <Bell size={20} color={COLORS.bodyText} strokeWidth={2} />
            </View>
            <Text style={styles.menuText}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={notificationsEnabled ? COLORS.primary : '#f4f3f4'}
              ios_backgroundColor={COLORS.border}
            />
          </View>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={handleRestorePurchases}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <View style={styles.menuIconContainer}>
              <RotateCcw size={20} color={COLORS.bodyText} strokeWidth={2} />
            </View>
            <Text style={styles.menuText}>Restore Purchases</Text>
            <ChevronRight size={20} color={COLORS.mutedText} />
          </Pressable>
        </View>

        {/* Support Section */}
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.menuSection}>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={handleContactSupport}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <View style={styles.menuIconContainer}>
              <Mail size={20} color={COLORS.bodyText} strokeWidth={2} />
            </View>
            <Text style={styles.menuText}>Contact Support</Text>
            <ChevronRight size={20} color={COLORS.mutedText} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => handleOpenURL(TERMS_URL)}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <View style={styles.menuIconContainer}>
              <FileText size={20} color={COLORS.bodyText} strokeWidth={2} />
            </View>
            <Text style={styles.menuText}>Terms of Service</Text>
            <ChevronRight size={20} color={COLORS.mutedText} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => handleOpenURL(PRIVACY_URL)}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <View style={styles.menuIconContainer}>
              <Shield size={20} color={COLORS.bodyText} strokeWidth={2} />
            </View>
            <Text style={styles.menuText}>Privacy Policy</Text>
            <ChevronRight size={20} color={COLORS.mutedText} />
          </Pressable>
        </View>

        {/* Community Section - Invite a Friend */}
        <Text style={styles.sectionTitle}>Community</Text>
        <Pressable
          style={({ pressed }) => [styles.inviteCard, pressed && styles.inviteCardPressed]}
          onPress={handleShare}
        >
          <View style={styles.inviteIconContainer}>
            <Heart size={24} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
          </View>
          <View style={styles.inviteContent}>
            <Text style={styles.inviteTitle}>Invite a Friend</Text>
            <Text style={styles.inviteSubtitle}>Help others quit sugar together</Text>
          </View>
          <ChevronRight size={20} color={COLORS.primary} />
        </Pressable>

        {/* Account Actions */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuSection}>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={handleResetData}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <View style={[styles.menuIconContainer, styles.menuIconWarning]}>
              <RefreshCw size={20} color={COLORS.warning} strokeWidth={2} />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuText, styles.menuTextWarning]}>Reset Data</Text>
              <Text style={styles.menuSubtext}>Clear all progress & restart onboarding</Text>
            </View>
            <ChevronRight size={20} color={COLORS.warning} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={handleSignOut}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <View style={[styles.menuIconContainer, styles.menuIconDanger]}>
              <LogOut size={20} color={COLORS.danger} strokeWidth={2} />
            </View>
            <Text style={[styles.menuText, styles.menuTextDanger]}>Sign Out</Text>
            <ChevronRight size={20} color={COLORS.danger} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={handleDeleteAccount}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <View style={[styles.menuIconContainer, styles.menuIconDanger]}>
              <Trash2 size={20} color={COLORS.danger} strokeWidth={2} />
            </View>
            <Text style={[styles.menuText, styles.menuTextDanger]}>Delete Account</Text>
            <ChevronRight size={20} color={COLORS.danger} />
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>Unsweet v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Name Edit Modal */}
      <Modal
        visible={isNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setNameModalVisible(false)}
          />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Name</Text>
              <TouchableOpacity
                onPress={() => setNameModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <X size={24} color={COLORS.mutedText} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              value={tempName}
              onChangeText={setTempName}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.mutedText}
              autoFocus
              autoCapitalize="words"
              maxLength={50}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setNameModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, isSaving && styles.modalSaveButtonDisabled]}
                onPress={handleSaveName}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.bodyText,
  },

  // Header
  header: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.headingText,
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 14,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  memberBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.headingText,
  },
  profileNamePlaceholder: {
    color: COLORS.mutedText,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.mutedText,
    marginTop: 2,
  },

  // Section Title
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 4,
    paddingHorizontal: 20,
  },

  // Menu Section
  menuSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuItemWithToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuItemPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuIconDanger: {
    backgroundColor: COLORS.dangerLight,
  },
  menuIconWarning: {
    backgroundColor: COLORS.warningLight,
  },
  menuItemContent: {
    flex: 1,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.headingText,
  },
  menuSubtext: {
    fontSize: 13,
    color: COLORS.mutedText,
    marginTop: 2,
  },
  menuTextDanger: {
    color: COLORS.danger,
  },
  menuTextWarning: {
    color: COLORS.warning,
  },

  // Invite Card
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  inviteCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  inviteIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  inviteContent: {
    flex: 1,
  },
  inviteTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.headingText,
    marginBottom: 2,
  },
  inviteSubtitle: {
    fontSize: 14,
    color: COLORS.bodyText,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
    gap: 4,
  },
  versionText: {
    fontSize: 12,
    color: COLORS.mutedText,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  modalContainer: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.headingText,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.headingText,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.bodyText,
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    opacity: 0.7,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
