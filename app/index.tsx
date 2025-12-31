import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Theme } from '../constants/Theme';

export default function Index() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* App Name Header */}
      <View style={styles.headerSection}>
        <Text style={styles.appName}>Unsweet</Text>
      </View>

      {/* Top Visual Section */}
      <View style={styles.heroSection}>
        <Image
          source={require('@/assets/images/welcome-hero.webp')}
          style={styles.heroImage}
          resizeMode="contain"
        />
      </View>

      {/* Bottom Section - Content & CTA (40%) */}
      <View style={styles.contentSection}>
        <View style={styles.textContainer}>
          {/* Title */}
          <Text style={styles.title}>
            Kick the Sugar.{'\n'}Reclaim Your Energy.
          </Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            The smartest way to track cravings and build healthy habits.
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          {/* Primary Button */}
          <Pressable
            onPress={() => router.push('/onboarding/flow')}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>

          {/* Secondary Button */}
          <Pressable
            onPress={() => router.push('/(auth)/login')}
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
    backgroundColor: '#F8F9FA', // Premium Soft Gray/White
  },

  // Header Section
  headerSection: {
    paddingTop: 60,
    paddingBottom: 10,
    alignItems: 'center',
  },

  appName: {
    fontFamily: Theme.fonts.bold,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3436',
    letterSpacing: 0.5,
  },

  // Hero Section
  heroSection: {
    height: 450,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  heroImage: {
    width: '120%',
    height: '120%',
  },

  // Content Section (Bottom)
  contentSection: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 48,
    justifyContent: 'flex-end',
  },

  // Text Container
  textContainer: {
    gap: 12,
    marginBottom: 24,
  },
  title: {
    fontFamily: Theme.fonts.bold,
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2D3436', // Dark Gunmetal
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: Theme.fonts.regular,
    fontSize: 18,
    color: '#636E72', // Gray
    lineHeight: 28,
    letterSpacing: 0.2,
  },

  // Buttons
  buttonContainer: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#00C897', // Deep Mint Green
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#00C897',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    fontFamily: Theme.fonts.bold,
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
    fontFamily: Theme.fonts.medium,
    color: '#636E72', // Gray
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
