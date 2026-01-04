/**
 * LandingPageContent - Landing Page UI After Logout
 *
 * Displays the hero branding and action buttons for the landing page.
 * Used in the modal overlay when user logs out.
 */

import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export function LandingPageContent() {
  const router = useRouter();
  const { setForceShowLanding } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>Unsweet</Text>
      </View>
      <View style={styles.hero}>
        <Image
          source={require('@/assets/images/welcome-hero.webp')}
          style={styles.heroImage}
          resizeMode="contain"
        />
      </View>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            Kick the Sugar.{'\n'}Reclaim Your Energy.
          </Text>
          <Text style={styles.subtitle}>
            The smartest way to track cravings and build healthy habits.
          </Text>
        </View>
        <View style={styles.buttonContainer}>
          <Pressable
            onPress={() => {
              setForceShowLanding(false);
              router.replace('/onboarding/flow');
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setForceShowLanding(false);
              router.replace('/(auth)/login');
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>I have an account</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 10,
    alignItems: 'center',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3436',
    letterSpacing: 0.5,
  },
  hero: {
    height: 450,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  heroImage: {
    width: '120%',
    height: '120%',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 48,
    justifyContent: 'flex-end',
  },
  textContainer: {
    gap: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2D3436',
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    color: '#636E72',
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  buttonContainer: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#00C897',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#00C897',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonPressed: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: '#636E72',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
