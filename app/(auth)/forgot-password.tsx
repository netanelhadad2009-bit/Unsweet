/**
 * Forgot Password Screen
 *
 * Allows users to request a password reset email.
 * The email contains a deep link that opens the reset confirmation screen.
 */

import { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronLeft } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Theme } from '../../constants/Theme';
import { translateAuthError } from '../../lib/auth/errors';
import {
  checkRateLimit,
  recordFailedAttempt,
  resetAttempts,
  formatRateLimitMessage,
} from '../../lib/auth/rateLimit';

// The app's custom URL scheme
const APP_SCHEME = 'unsweet';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Ref to track if component is mounted (prevents state updates after unmount)
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleResetPassword = async () => {
    // Prevent double-submit
    if (isLoading) return;

    // Validate email
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Check rate limit AFTER client validation (don't count validation errors)
    const rateLimitCheck = checkRateLimit('forgot-password');
    if (rateLimitCheck.isLocked) {
      setMessage({ type: 'error', text: formatRateLimitMessage(rateLimitCheck.remainingSeconds) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsLoading(true);
    setMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Request password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${APP_SCHEME}://reset-password`,
      });

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

      if (error) {
        // Only record failed attempt on actual API errors
        recordFailedAttempt('forgot-password');
        // Use error translation for user-friendly message
        const userFriendlyError = translateAuthError(error);
        setMessage({ type: 'error', text: userFriendlyError });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        // Success - reset attempt counter
        resetAttempts('forgot-password');
        setMessage({
          type: 'success',
          text: 'Check your email for a password reset link. It may take a few minutes to arrive.',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      recordFailedAttempt('forgot-password');
      const userFriendlyError = translateAuthError(err);
      setMessage({ type: 'error', text: userFriendlyError });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

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
            {/* Back Button */}
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={24} color={Theme.colors.primary} strokeWidth={2.5} />
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>
            </View>

            {/* Message Box */}
            {message && (
              <View
                style={[
                  styles.messageBox,
                  message.type === 'success' ? styles.successBox : styles.errorBox,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.type === 'success' ? styles.successText : styles.errorText,
                  ]}
                >
                  {message.text}
                </Text>
              </View>
            )}

            {/* Email Form */}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, isLoading && styles.inputDisabled]}
                  placeholder="your@email.com"
                  placeholderTextColor={Theme.colors.text.muted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
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
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Send Reset Link</Text>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.xxl,
  },

  // Back Button
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: Theme.spacing.xl,
    gap: Theme.spacing.xs,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    color: Theme.colors.primary,
  },

  // Header
  header: {
    marginBottom: Theme.spacing.xl,
  },
  title: {
    fontFamily: Theme.fonts.bold,
    fontSize: 32,
    fontWeight: '700',
    color: Theme.colors.text.main,
    marginBottom: Theme.spacing.sm,
  },
  subtitle: {
    fontFamily: Theme.fonts.regular,
    fontSize: 16,
    color: Theme.colors.text.light,
    lineHeight: 24,
  },

  // Message Box
  messageBox: {
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    marginBottom: Theme.spacing.lg,
    borderWidth: 1,
  },
  successBox: {
    backgroundColor: 'rgba(0, 200, 151, 0.1)',
    borderColor: 'rgba(0, 200, 151, 0.3)',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  messageText: {
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  successText: {
    color: Theme.colors.primary,
  },
  errorText: {
    color: '#DC2626',
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
