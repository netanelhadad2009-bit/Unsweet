import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRef, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle } from 'react-native-svg';
import { Theme } from '../../../constants/Theme';
import { useOnboarding } from '../../../contexts/OnboardingContext';

// Male Icon Component
function MaleIcon({ color = '#4A90D9', size = 80 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="10" cy="14" r="5" stroke={color} strokeWidth="2" fill="none" />
      <Path
        d="M14.5 9.5L19 5M19 5H15M19 5V9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Female Icon Component
function FemaleIcon({ color = '#E85D75', size = 80 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="9" r="5" stroke={color} strokeWidth="2" fill="none" />
      <Path
        d="M12 14V20M9 17H15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Other/Non-binary Icon Component (combined male+female symbol)
function OtherIcon({ color = '#9B8ACB', size = 80 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth="2" fill="none" />
      <Path
        d="M12 8V3M9.5 5.5L12 3L14.5 5.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 16V21M9.5 18.5L12 21L14.5 18.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function GenderContent() {
  const { updateBioData, goToNextScreen } = useOnboarding();

  // Animation values for cards
  const maleScale = useRef(new Animated.Value(0.9)).current;
  const femaleScale = useRef(new Animated.Value(0.9)).current;
  const otherScale = useRef(new Animated.Value(0.9)).current;

  // Ref to track navigation timeout for cleanup
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Card entrance animations
    Animated.stagger(50, [
      Animated.spring(maleScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(femaleScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(otherScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Cleanup timeout on unmount to prevent memory leaks
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  const handleSelectGender = useCallback((gender: 'male' | 'female' | 'other') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateBioData('gender', gender);

    // Brief delay for visual feedback before navigation
    navigationTimeoutRef.current = setTimeout(() => {
      goToNextScreen();
    }, 150);
  }, [updateBioData, goToNextScreen]);

  return (
    <View style={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>What's your gender?</Text>
        <Text style={styles.subtitle}>
          This helps us personalize your experience
        </Text>
      </View>

      {/* Gender Cards - Vertical Stack */}
      <View style={styles.cardsContainer}>
        {/* Male Card */}
        <Animated.View style={{ transform: [{ scale: maleScale }] }}>
          <Pressable
            onPress={() => handleSelectGender('male')}
            style={({ pressed }) => [
              styles.genderCard,
              styles.maleCard,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <MaleIcon size={48} />
              </View>
              <Text style={styles.cardLabel}>Male</Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* Female Card */}
        <Animated.View style={{ transform: [{ scale: femaleScale }] }}>
          <Pressable
            onPress={() => handleSelectGender('female')}
            style={({ pressed }) => [
              styles.genderCard,
              styles.femaleCard,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <FemaleIcon size={48} />
              </View>
              <Text style={styles.cardLabel}>Female</Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* Other Card */}
        <Animated.View style={{ transform: [{ scale: otherScale }] }}>
          <Pressable
            onPress={() => handleSelectGender('other')}
            style={({ pressed }) => [
              styles.genderCard,
              styles.otherCard,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <OtherIcon size={48} />
              </View>
              <Text style={styles.cardLabel}>Other</Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
  },
  header: {
    marginBottom: Theme.spacing.xl,
  },
  title: {
    fontFamily: Theme.fonts.extraBold,
    fontSize: 32,
    fontWeight: '800',
    color: Theme.colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: Theme.spacing.sm,
  },
  subtitle: {
    fontFamily: Theme.fonts.regular,
    fontSize: 16,
    color: Theme.colors.text.secondary,
    lineHeight: 24,
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: Theme.spacing.md,
    paddingBottom: Theme.spacing.xl,
  },
  genderCard: {
    borderRadius: Theme.borderRadius.xl,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    ...Theme.shadows.medium,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  maleCard: {
    backgroundColor: '#EEF4FB',
    borderWidth: 2,
    borderColor: '#C5DAF0',
  },
  femaleCard: {
    backgroundColor: '#FCEEF1',
    borderWidth: 2,
    borderColor: '#F5D0D8',
  },
  otherCard: {
    backgroundColor: '#F3F0F9',
    borderWidth: 2,
    borderColor: '#D8D0E8',
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    width: 48,
    alignItems: 'center',
  },
  cardLabel: {
    fontFamily: Theme.fonts.bold,
    fontSize: 22,
    fontWeight: '700',
    color: Theme.colors.text.primary,
    letterSpacing: -0.3,
  },
});
