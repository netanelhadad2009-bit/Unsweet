/**
 * Sign Up Screen
 *
 * This screen handles three authentication methods:
 * 1. Apple Sign In (SSO)
 * 2. Google Sign In (SSO)
 * 3. Email/Password Registration
 *
 * Upon successful registration, it creates a user profile in Supabase
 * with all onboarding data and navigates to the Paywall.
 *
 * NATIVE CONFIGURATION REQUIRED:
 * ================================
 * For Apple Sign In to work, add to app.config.js or app.json:
 * {
 *   "expo": {
 *     "ios": {
 *       "usesAppleSignIn": true,
 *       "bundleIdentifier": "com.yourcompany.unsweet"
 *     }
 *   }
 * }
 *
 * For Google Sign In, add to .env and app.config.js:
 * - GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
 * - GOOGLE_IOS_CLIENT_ID=your-google-ios-client-id.apps.googleusercontent.com
 *
 * Supabase Dashboard Configuration:
 * - Enable Apple provider with Service ID and Team ID
 * - Enable Google provider with Web Client ID and Secret
 * - Set redirect URL: exp://your-tunnel-url or your-app-scheme://
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
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { Theme } from '../../constants/Theme';
import { OnboardingAnswers } from '../../types/onboarding';
import { translateAuthError, isValidEmail } from '../../lib/auth/errors';
import { usePostHog } from 'posthog-react-native';
import {
  checkRateLimit,
  recordFailedAttempt,
  resetAttempts,
  formatRateLimitMessage,
} from '../../lib/auth/rateLimit';
import { trackRegistrationComplete } from '../../services/AnalyticsService';

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

// Auth mode toggle
type AuthMode = 'signup' | 'login';

// The app's custom URL scheme from app.json
const APP_SCHEME = 'unsweet';

// Legal document URLs
const TERMS_URL = 'https://unsweettermsofservice.carrd.co/';
const PRIVACY_URL = 'https://unsweetprivacypolicy.carrd.co/';

// Get the correct redirect URL for OAuth
// This ensures the OAuth callback uses the app's custom scheme
const getOAuthRedirectUrl = (): string => {
  // Use the app's custom scheme directly for OAuth redirects
  // This works in both development builds and production
  return `${APP_SCHEME}://signup`;
};

export default function SignUpScreen() {
  const router = useRouter();
  const { onboardingData } = useOnboarding();
  const posthog = usePostHog();

  // Form state
  const [authMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'email' | 'apple' | 'google' | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Ref to track if component is mounted (prevents state updates after unmount)
  const isMountedRef = useRef(true);

  // NOTE: No auth listener needed here - auth flows call handleAuthSuccess directly
  // This avoids race conditions between listeners and direct handler navigation

  // Cleanup: mark as unmounted when component unmounts
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Creates or updates user profile with onboarding data
   * Uses upsert to handle both new and existing profiles
   */
  const ensureUserProfile = async (
    userId: string,
    userEmail: string,
    displayName: string,
    onboardingAnswers: OnboardingAnswers
  ): Promise<void> => {
    // Prepare onboarding data for storage
    const onboardingDataToSave = {
      gender: onboardingAnswers.gender,
      birthdate: onboardingAnswers.birthdate,
      age: onboardingAnswers.age,
      height: onboardingAnswers.height,
      weight: onboardingAnswers.weight,
      useImperial: onboardingAnswers.useImperial,
      main_goals: onboardingAnswers.main_goals,
      biggest_weakness: onboardingAnswers.biggest_weakness,
      craving_time: onboardingAnswers.craving_time,
      sugar_frequency: onboardingAnswers.sugar_frequency,
      post_binge_feeling: onboardingAnswers.post_binge_feeling,
      sleep_impact: onboardingAnswers.sleep_impact,
      quit_attempts: onboardingAnswers.quit_attempts,
      weekly_spending: onboardingAnswers.weekly_spending,
      commitment: onboardingAnswers.commitment,
      completed_at: new Date().toISOString(),
    };

    // Use RPC function to upsert profile (bypasses RLS)
    const { error: rpcError } = await supabase.rpc('upsert_profile', {
      user_id: userId,
      user_email: userEmail.trim(),
      user_full_name: displayName.trim(),
      user_onboarding_data: onboardingDataToSave,
    });

    if (rpcError) {
      throw new Error(`Failed to save profile: ${rpcError.message}`);
    }
  };

  /**
   * Handle successful authentication (both email and SSO)
   */
  const handleAuthSuccess = async (
    userId: string,
    userEmail: string,
    authMethod: 'email' | 'apple' | 'google' = 'email'
  ) => {
    try {
      // Track registration completion for analytics funnel
      trackRegistrationComplete(authMethod);

      // PostHog: Track signup completed
      posthog?.capture('signup_completed', {
        auth_method: authMethod,
      });

      // Check if we have onboarding data to save (signup mode)
      const hasOnboardingData = onboardingData.main_goals && onboardingData.main_goals.length > 0;

      if (hasOnboardingData) {
        // Signup mode - save onboarding data
        await ensureUserProfile(
          userId,
          userEmail,
          fullName || userEmail.split('@')[0], // Use email prefix as fallback name
          onboardingData
        );
        // DON'T clear onboarding data here - plan-ready page needs it to display personalized stats
        // It will be cleared when user proceeds from plan-ready to paywall
      }
      // Login mode - just navigate, profile already exists

      // Haptic feedback for success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to plan-ready screen (shows personalized plan before paywall)
      router.replace('/onboarding/plan-ready');
    } catch (err: any) {
      // Don't block navigation for profile issues - user is authenticated
      // DON'T clear onboarding data - plan-ready page needs it
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/onboarding/plan-ready');
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  /**
   * Email/Password Sign Up
   */
  const handleEmailSignUp = async () => {
    // Prevent double-submit
    if (isLoading) return;

    setError(null);

    // Sanitize email
    const trimmedEmail = email.trim().toLowerCase();

    // Validation
    if (!trimmedEmail) {
      setError('Please enter your email');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!password) {
      setError('Please enter a password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!fullName.trim()) {
      setError('Please enter your name');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Check onboarding completion
    if (onboardingData.main_goals.length === 0) {
      setError('Please complete the onboarding quiz first');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Check rate limit AFTER client validation (don't count validation errors)
    const rateLimitCheck = checkRateLimit('signup');
    if (rateLimitCheck.isLocked) {
      setError(formatRateLimitMessage(rateLimitCheck.remainingSeconds));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsLoading(true);
    setLoadingProvider('email');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

      if (authError) {
        // Only record failed attempt on actual API errors
        recordFailedAttempt('signup');
        // Use error translation for user-friendly message
        const userFriendlyError = translateAuthError(authError);
        setError(userFriendlyError);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (!authData.user) {
        recordFailedAttempt('signup');
        setError('Registration failed. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // Success - reset attempt counter and create profile
      resetAttempts('signup');
      await handleAuthSuccess(authData.user.id, trimmedEmail);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      recordFailedAttempt('signup');
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
   * Email/Password Sign In (for existing users)
   */
  const handleEmailSignIn = async () => {
    // Prevent double-submit
    if (isLoading) return;

    setError(null);

    // Sanitize email
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError('Please enter your email address');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!password) {
      setError('Please enter your password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Check rate limit AFTER client validation (don't count validation errors)
    const rateLimitCheck = checkRateLimit('signup-login');
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
        recordFailedAttempt('signup-login');
        // Use error translation for user-friendly message
        const userFriendlyError = translateAuthError(authError);
        setError(userFriendlyError);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (!authData.user) {
        recordFailedAttempt('signup-login');
        setError('Login failed. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // Success - reset attempt counter and navigate
      resetAttempts('signup-login');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/paywall');
    } catch (err: any) {
      if (!isMountedRef.current) return;
      recordFailedAttempt('signup-login');
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
   * Apple Sign In (Native)
   *
   * Uses expo-apple-authentication for native Apple Sign In popup
   * Then passes the identity token to Supabase via signInWithIdToken
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

      // Extract the identity token
      const { identityToken, fullName, email } = credential;

      if (!identityToken) {
        throw new Error('No identity token received from Apple');
      }

      // Sign in to Supabase with the Apple identity token
      const { data, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
      });

      if (signInError) {
        throw signInError;
      }

      if (data?.user) {
        // Use Apple's provided name/email if available, otherwise fall back to Supabase data
        const displayName = fullName
          ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim()
          : data.user.user_metadata?.full_name || '';
        const userEmail = email || data.user.email || '';

        await handleAuthSuccess(data.user.id, userEmail, 'apple');
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;

      // Handle Apple Sign In specific errors
      if (err.code === 'ERR_REQUEST_CANCELED' || err.code === 'ERR_CANCELED') {
        // User cancelled - don't show error
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
   *
   * CONFIGURATION REQUIRED:
   * 1. Enable Google Sign In in Supabase Dashboard > Authentication > Providers
   * 2. Add your Google Web Client ID and Client Secret
   * 3. Configure OAuth consent screen in Google Cloud Console
   */
  const handleGoogleSignIn = async () => {
    // Prevent double-submit
    if (isLoading) return;

    setError(null);
    setIsLoading(true);
    setLoadingProvider('google');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Create the deep link URL for the app to receive the callback
      const redirectUrl = getOAuthRedirectUrl();

      const { data, error: oAuthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // This is where Supabase will redirect AFTER processing the OAuth callback
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
        // Open the OAuth URL in a browser session
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
          // Extract the tokens from the URL and set the session
          const url = result.url;

          // Check for error in URL
          if (url.includes('error=')) {
            const errorMatch = url.match(/error_description=([^&]+)/);
            const errorDesc = errorMatch ? decodeURIComponent(errorMatch[1]) : 'Authentication failed';
            throw new Error(errorDesc);
          }

          // Parse the URL to get tokens
          let tokensFound = false;
          if (url.includes('access_token') || url.includes('refresh_token')) {
            // Extract hash fragment
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
                // Save profile with onboarding data
                if (sessionData?.user) {
                  await handleAuthSuccess(sessionData.user.id, sessionData.user.email || '', 'google');
                } else {
                  throw new Error('Session created but no user data returned');
                }
              }
            }
          }

          if (!tokensFound) {
            // Check if session was set by Supabase automatically
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              await handleAuthSuccess(session.user.id, session.user.email || '', 'google');
            } else {
              setError('Authentication completed but no session was created. Please try again.');
            }
          }
        } else if (result.type === 'cancel') {
          setError('Sign in was cancelled');
        } else if (result.type === 'dismiss') {
          // User dismissed the browser - check if session exists
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await handleAuthSuccess(session.user.id, session.user.email || '', 'google');
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

  const isSignUp = authMode === 'signup';

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
              <Text style={styles.title}>
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </Text>
              <Text style={styles.subtitle}>
                {isSignUp
                  ? 'Sign up to start your sugar-free journey'
                  : 'Log in to continue your progress'}
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
              {/* Apple Sign In Button - iOS ONLY */}
              {Platform.OS === 'ios' && (
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
              )}

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
              {isSignUp && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={[styles.input, isLoading && styles.inputDisabled]}
                    placeholder="Enter your name"
                    placeholderTextColor={Theme.colors.text.muted}
                    value={fullName}
                    onChangeText={setFullName}
                    textContentType="name"
                    autoCapitalize="words"
                    editable={!isLoading}
                  />
                </View>
              )}

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
                  placeholder={isSignUp ? 'At least 6 characters' : 'Enter your password'}
                  placeholderTextColor={Theme.colors.text.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                  editable={!isLoading}
                />
              </View>

              {isSignUp && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <TextInput
                    style={[styles.input, isLoading && styles.inputDisabled]}
                    placeholder="Re-enter your password"
                    placeholderTextColor={Theme.colors.text.muted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    textContentType="newPassword"
                    editable={!isLoading}
                  />
                </View>
              )}

              {/* Submit Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.submitButtonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={isSignUp ? handleEmailSignUp : handleEmailSignIn}
                disabled={isLoading}
              >
                {loadingProvider === 'email' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {isSignUp ? 'Create Account' : 'Log In'}
                  </Text>
                )}
              </Pressable>

              {/* Legal Terms */}
              {isSignUp && (
                <Text style={styles.legalText}>
                  By signing up, you agree to our{'\n'}
                  <Text
                    style={styles.legalLink}
                    onPress={() => Linking.openURL(TERMS_URL)}
                  >
                    Terms of Service
                  </Text>
                  {' '}and{' '}
                  <Text
                    style={styles.legalLink}
                    onPress={() => Linking.openURL(PRIVACY_URL)}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              )}
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
    textAlign: 'left',
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

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Theme.spacing.xl,
  },
  toggleText: {
    fontFamily: Theme.fonts.regular,
    fontSize: 15,
    color: Theme.colors.text.light,
  },
  toggleLink: {
    fontFamily: Theme.fonts.bold,
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.primary,
  },

  // Terms
  termsText: {
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    color: Theme.colors.text.muted,
    textAlign: 'center',
    marginTop: Theme.spacing.lg,
    lineHeight: 18,
  },

  // Legal text below signup button
  legalText: {
    fontFamily: Theme.fonts.regular,
    fontSize: 13,
    color: '#64748B', // slate-500
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  legalLink: {
    fontFamily: Theme.fonts.semiBold,
    fontWeight: '600',
    color: '#475569', // slate-600 for better contrast
    textDecorationLine: 'underline',
  },
});
