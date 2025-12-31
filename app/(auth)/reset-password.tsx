/**
 * Reset Password Confirmation Screen
 *
 * This screen is opened when the user clicks the password reset link in their email.
 * It extracts the tokens from the deep link, sets the session, and allows the user
 * to enter a new password.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { CheckCircle2, AlertCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Theme } from '../../constants/Theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Extract tokens from URL and set session
  useEffect(() => {
    async function handlePasswordResetLink() {
      try {
        // First, try to get the current URL
        const initialUrl = await Linking.getInitialURL();

        // Check if we have tokens in the URL fragment
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        if (initialUrl) {
          // Parse tokens from URL fragment (#access_token=xxx&refresh_token=xxx)
          const hashIndex = initialUrl.indexOf('#');
          if (hashIndex !== -1) {
            const fragment = initialUrl.substring(hashIndex + 1);
            const fragmentParams = new URLSearchParams(fragment);
            accessToken = fragmentParams.get('access_token');
            refreshToken = fragmentParams.get('refresh_token');
            if (accessToken && refreshToken) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (sessionError) {
                setError('Invalid or expired reset link. Please request a new one.');
                setIsCheckingSession(false);
                return;
              }

              setSessionReady(true);
              setIsCheckingSession(false);
              return;
            }
          }
        }

        // Check if params contain tokens (from expo-router)
        if (params.access_token && params.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: params.access_token as string,
            refresh_token: params.refresh_token as string,
          });

          if (sessionError) {
            setError('Invalid or expired reset link. Please request a new one.');
            setIsCheckingSession(false);
            return;
          }

          setSessionReady(true);
          setIsCheckingSession(false);
          return;
        }

        // Check if we already have a valid session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionReady(true);
          setIsCheckingSession(false);
          return;
        }

        // No valid session or tokens found
        setError('Invalid or expired reset link. Please request a new one.');
        setIsCheckingSession(false);
      } catch (err) {
        setError('Something went wrong. Please try again.');
        setIsCheckingSession(false);
      }
    }

    handlePasswordResetLink();
  }, [params]);

  const validatePassword = (): boolean => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleUpdatePassword = async () => {
    setError(null);

    if (!validatePassword()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        Alert.alert(
          'Success',
          'Your password has been updated successfully. Please log in with your new password.',
          [
            {
              text: 'OK',
              onPress: async () => {
                // Sign out and redirect to login
                await supabase.auth.signOut();
                router.replace('/(auth)/login');
              },
            },
          ]
        );
      }
    } catch (err: any) {
      setError('Something went wrong. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestNewLink = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(auth)/forgot-password');
  };

  // Loading state while checking session
  if (isCheckingSession) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={[styles.container, styles.centered]} edges={['top', 'bottom']}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Verifying reset link...</Text>
        </SafeAreaView>
      </>
    );
  }

  // Error state - invalid or expired link
  if (!sessionReady && error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={[styles.container, styles.centered]} edges={['top', 'bottom']}>
          <View style={styles.errorIconContainer}>
            <AlertCircle size={64} color="#DC2626" strokeWidth={1.5} />
          </View>
          <Text style={styles.errorTitle}>Link Expired</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
            ]}
            onPress={handleRequestNewLink}
          >
            <Text style={styles.submitButtonText}>Request New Link</Text>
          </Pressable>
        </SafeAreaView>
      </>
    );
  }

  // Main password reset form
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.successIconContainer}>
                <CheckCircle2 size={48} color={Theme.colors.primary} strokeWidth={1.5} />
              </View>
              <Text style={styles.title}>Set New Password</Text>
              <Text style={styles.subtitle}>
                Enter your new password below. Make sure it's at least 6 characters.
              </Text>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Password Form */}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={[styles.input, isLoading && styles.inputDisabled]}
                  placeholder="Enter new password"
                  placeholderTextColor={Theme.colors.text.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="newPassword"
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={[styles.input, isLoading && styles.inputDisabled]}
                  placeholder="Confirm new password"
                  placeholderTextColor={Theme.colors.text.muted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  textContentType="newPassword"
                  editable={!isLoading}
                />
              </View>

              {/* Submit Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.submitButtonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleUpdatePassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Update Password</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xxl,
  },

  // Loading State
  loadingText: {
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    color: Theme.colors.text.secondary,
    marginTop: Theme.spacing.lg,
  },

  // Error State
  errorIconContainer: {
    marginBottom: Theme.spacing.lg,
  },
  errorTitle: {
    fontFamily: Theme.fonts.bold,
    fontSize: 24,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: Theme.spacing.sm,
  },
  errorMessage: {
    fontFamily: Theme.fonts.regular,
    fontSize: 16,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xl,
    lineHeight: 24,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  successIconContainer: {
    marginBottom: Theme.spacing.md,
  },
  title: {
    fontFamily: Theme.fonts.bold,
    fontSize: 28,
    fontWeight: '700',
    color: Theme.colors.text.main,
    marginBottom: Theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Theme.fonts.regular,
    fontSize: 16,
    color: Theme.colors.text.light,
    lineHeight: 24,
    textAlign: 'center',
  },

  // Error Box
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
  },

  // Form
  form: {
    gap: Theme.spacing.md,
  },
  inputContainer: {
    gap: Theme.spacing.xs,
  },
  label: {
    fontFamily: Theme.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text.main,
    marginLeft: Theme.spacing.xs,
  },
  input: {
    fontFamily: Theme.fonts.regular,
    fontSize: 16,
    color: Theme.colors.text.main,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
  },
  inputDisabled: {
    opacity: 0.6,
  },

  // Submit Button
  submitButton: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: Theme.spacing.md + 2,
    borderRadius: Theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: Theme.spacing.sm,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  submitButtonText: {
    fontFamily: Theme.fonts.bold,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Disabled state
  buttonDisabled: {
    opacity: 0.6,
  },
});
