/**
 * Login Screen
 *
 * This screen handles three authentication methods for existing users:
 * 1. Apple Sign In (SSO)
 * 2. Google Sign In (SSO)
 * 3. Email/Password Login
 *
 * Upon successful login, navigates to the main app.
 */

import { useState, useEffect, useRef } from 'react';
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
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { Theme } from '../../constants/Theme';
import { translateAuthError, isValidEmail } from '../../lib/auth/errors';
import {
  checkRateLimit,
  recordFailedAttempt,
  resetAttempts,
  formatRateLimitMessage,
} from '../../lib/auth/rateLimit';
import { setSkipNextLandingModal, setPersistedLoginError, getPersistedLoginError } from '../_layout';

// Google Icon SVG Component
const GoogleIcon = () => (
  <Svg width={26} height={26} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </Svg>
);

// Apple Icon SVG Component
const AppleIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="#FFFFFF">
    <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </Svg>
);

// Required for OAuth to work properly
WebBrowser.maybeCompleteAuthSession();

// The app's custom URL scheme from app.json
const APP_SCHEME = 'unsweet';

// Get the correct redirect URL for OAuth
// Use the same redirect URL as signup since it's already configured in Supabase dashboard
const getOAuthRedirectUrl = (): string => {
  return `${APP_SCHEME}://signup`;
};

export default function LoginScreen() {
  const router = useRouter();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'email' | 'apple' | 'google' | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Track if we've already handled auth to prevent duplicate processing
  const [authHandled, setAuthHandled] = useState(false);

  // Ref to track if component is mounted (prevents state updates after unmount)
  const isMountedRef = useRef(true);

  // Check for persisted error on mount (survives Stack remount)
  useEffect(() => {
    const persistedError = getPersistedLoginError();
    if (persistedError) {
      setError(persistedError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    // Cleanup: mark as unmounted
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Check if user has completed registration (has onboarding data)
   * A user who properly signed up will have onboarding_data populated.
   * OAuth auto-created profiles will have onboarding_data = NULL.
   */
  const checkUserHasCompletedRegistration = async (userId: string): Promise<boolean> => {
    try {
      // Add a timeout using Promise.race
      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Profile check timed out')), 10000)
      );

      // Check for onboarding_data, not just profile existence
      // A properly registered user will have completed the onboarding questionnaire
      const queryPromise = supabase
        .from('profiles')
        .select('id, onboarding_data')
        .eq('id', userId)
        .maybeSingle();

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        return false;
      }

      // User must have both a profile AND completed onboarding
      // If onboarding_data is null, they haven't properly registered
      return !!data && !!data.onboarding_data;
    } catch (err: any) {
      throw err;
    }
  };

  /**
   * Handle successful OAuth sign-in - verify user has completed registration
   */
  const handleOAuthSuccess = async (userId: string) => {
    // Prevent duplicate handling
    if (authHandled) {
      // Still clear loading state when returning early
      setIsLoading(false);
      setLoadingProvider(null);
      return true;
    }
    setAuthHandled(true);

    try {
      // Check if user has completed registration (has onboarding data)
      const hasCompletedRegistration = await checkUserHasCompletedRegistration(userId);

      if (!hasCompletedRegistration) {
        // User hasn't completed registration - sign them out and show error

        const errorMessage = 'No account found with this email. Please sign up first to create an account.';

        // Skip the landing modal so user stays on login page
        setSkipNextLandingModal(true);

        // Set persisted error BEFORE signOut (survives Stack remount)
        setPersistedLoginError(errorMessage);

        await supabase.auth.signOut();

        // Also set local error in case remount doesn't happen
        setError(errorMessage);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setAuthHandled(false); // Reset so they can try again
        return false;
      }

      // User has completed registration - allow login
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
      return true;
    } catch (err: any) {
      const userFriendlyError = translateAuthError(err);
      setError(userFriendlyError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setAuthHandled(false);
      return false;
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  // Listen for auth state changes
  // Button handlers directly manage auth flow to avoid race conditions
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async () => {
      // Auth state changes are handled by button handlers
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  /**
   * Email/Password Sign In
   */
  const handleEmailSignIn = async () => {
    // Prevent double-submit
    if (isLoading) return;

    setError(null);

    // Client-side validation
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError('Please enter your email address.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Check rate limit AFTER client validation (don't count validation errors)
    const rateLimitCheck = checkRateLimit('login');
    if (rateLimitCheck.isLocked) {
      setError(formatRateLimitMessage(rateLimitCheck.remainingSeconds));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsLoading(true);
    setLoadingProvider('email');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

      if (authError) {
        // Only record failed attempt on actual API errors
        recordFailedAttempt('login');
        // Use error translation for user-friendly message
        const userFriendlyError = translateAuthError(authError);
        setError(userFriendlyError);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (!authData.session || !authData.user) {
        recordFailedAttempt('login');
        setError('Login failed. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // Success - reset attempt counter and navigate
      resetAttempts('login');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (err: any) {
      if (!isMountedRef.current) return;
      recordFailedAttempt('login');
      const userFriendlyError = translateAuthError(err);
      setError(userFriendlyError);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setLoadingProvider(null);
      }
    }
  };

  /**
   * Apple Sign In (SSO) - Native implementation
   */
  const handleAppleSignIn = async () => {
    // Prevent double-submit
    if (isLoading) return;

    setError(null);
    setIsLoading(true);
    setLoadingProvider('apple');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Get native Apple credential with native popup
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken } = credential;

      if (!identityToken) {
        throw new Error('No identity token received from Apple');
      }

      // Sign in to Supabase with the Apple identity token
      const { data, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
      });

      if (signInError) throw signInError;

      if (data?.user) {
        // Verify user profile exists and has completed registration
        await handleOAuthSuccess(data.user.id);
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;

      // Handle Apple Sign In specific errors (user cancelled)
      if (err.code === 'ERR_REQUEST_CANCELED' || err.code === 'ERR_CANCELED') {
        setIsLoading(false);
        setLoadingProvider(null);
        return;
      }

      const userFriendlyError = translateAuthError(err);
      setError(userFriendlyError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setLoadingProvider(null);
      }
    }
  };

  /**
   * Google Sign In (SSO)
   */
  const handleGoogleSignIn = async () => {
    // Prevent double-submit
    if (isLoading) return;

    setError(null);
    setIsLoading(true);
    setLoadingProvider('google');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const redirectUrl = getOAuthRedirectUrl();

      const { data, error: oAuthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (oAuthError) throw oAuthError;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
          const url = result.url;

          // Check for error in URL
          if (url.includes('error=')) {
            const errorMatch = url.match(/error_description=([^&]+)/);
            const errorDesc = errorMatch ? decodeURIComponent(errorMatch[1]) : 'Authentication failed';
            throw new Error(errorDesc);
          }

          let tokensFound = false;
          if (url.includes('access_token') || url.includes('refresh_token')) {
            const hashIndex = url.indexOf('#');
            if (hashIndex !== -1) {
              const hash = url.substring(hashIndex + 1);
              const params = new URLSearchParams(hash);
              const accessToken = params.get('access_token');
              const refreshToken = params.get('refresh_token');

              if (accessToken && refreshToken) {
                tokensFound = true;
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });

                if (sessionError) {
                  throw sessionError;
                }

                // Verify user profile exists before allowing login
                if (sessionData?.user) {
                  await handleOAuthSuccess(sessionData.user.id);
                }
              }
            }
          }

          if (!tokensFound) {
            // Check if session was set by Supabase automatically
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              await handleOAuthSuccess(session.user.id);
            } else {
              setError('Authentication completed but no session was created. Please try again.');
            }
          }
        } else if (result.type === 'cancel') {
          setError('Sign in was cancelled');
        } else if (result.type === 'dismiss') {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await handleOAuthSuccess(session.user.id);
          } else {
            setError('Sign in was cancelled');
          }
        } else {
          setError('Authentication failed. Please try again.');
        }
      } else {
        setError('Could not start Google Sign In. Please try again.');
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      const userFriendlyError = translateAuthError(err);
      setError(userFriendlyError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setLoadingProvider(null);
      }
    }
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
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>
                Log in to continue your progress
              </Text>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* SSO Buttons */}
            <View style={styles.ssoContainer}>
              {/* Apple Sign In Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.ssoButton,
                  styles.appleButton,
                  pressed && styles.ssoButtonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleAppleSignIn}
                disabled={isLoading}
              >
                {loadingProvider === 'apple' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <AppleIcon />
                    <Text style={styles.appleButtonText}>
                      Continue with Apple
                    </Text>
                  </>
                )}
              </Pressable>

              {/* Google Sign In Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.ssoButton,
                  styles.googleButton,
                  pressed && styles.ssoButtonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
              >
                {loadingProvider === 'google' ? (
                  <ActivityIndicator color="#2D3436" size="small" />
                ) : (
                  <>
                    <GoogleIcon />
                    <Text style={styles.googleButtonText}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Separator */}
            <View style={styles.separatorContainer}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>or</Text>
              <View style={styles.separatorLine} />
            </View>

            {/* Email/Password Form */}
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

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={[styles.input, isLoading && styles.inputDisabled]}
                  placeholder="Enter your password"
                  placeholderTextColor={Theme.colors.text.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="password"
                  editable={!isLoading}
                />
              </View>

              {/* Forgot Password Link */}
              <Pressable
                onPress={() => router.push('/(auth)/forgot-password')}
                style={styles.forgotPasswordLink}
                disabled={isLoading}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </Pressable>

              {/* Submit Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.submitButtonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleEmailSignIn}
                disabled={isLoading}
              >
                {loadingProvider === 'email' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Log In</Text>
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
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xxl,
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

  // Error
  errorContainer: {
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

  // SSO Buttons
  ssoContainer: {
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  ssoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.lg,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  ssoButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  appleButtonText: {
    fontFamily: Theme.fonts.semiBold,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  googleButtonText: {
    fontFamily: Theme.fonts.semiBold,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },

  // Separator
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Theme.spacing.lg,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: Theme.colors.border,
  },
  separatorText: {
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
    color: Theme.colors.text.muted,
    marginHorizontal: Theme.spacing.md,
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

  // Forgot Password
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    paddingVertical: Theme.spacing.xs,
  },
  forgotPasswordText: {
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    color: Theme.colors.primary,
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
