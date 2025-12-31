import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { HeartPulse } from 'lucide-react-native';
import { Question } from '../../types/onboarding';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { Theme } from '../../constants/Theme';

interface Props {
  question: Question;
}

export function InterstitialScreen({ question }: Props) {
  const { goToNextStep } = useOnboarding();
  const heartbeatScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Create heartbeat animation pattern: beat-beat-pause (subtle, natural)
    const heartbeat = Animated.sequence([
      // First beat
      Animated.timing(heartbeatScale, {
        toValue: 1.08,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(heartbeatScale, {
        toValue: 1.0,
        duration: 180,
        useNativeDriver: true,
      }),
      // Second beat
      Animated.timing(heartbeatScale, {
        toValue: 1.08,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(heartbeatScale, {
        toValue: 1.0,
        duration: 180,
        useNativeDriver: true,
      }),
      // Pause between heartbeats
      Animated.delay(500),
    ]);

    // Loop the heartbeat animation continuously
    Animated.loop(heartbeat).start();

    // Auto-advance after duration
    const timer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      goToNextStep();
    }, question.interstitialConfig?.duration || 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.heartContainer, { transform: [{ scale: heartbeatScale }] }]}>
        <HeartPulse
          size={160}
          color="#B00000"
          strokeWidth={3}
          fill="#B00000"
          fillOpacity={0.3}
        />
      </Animated.View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>{question.title}</Text>
        {question.subtitle && (
          <Text style={styles.subtitle}>{question.subtitle}</Text>
        )}
        {question.interstitialConfig?.message && (
          <Text style={styles.message}>{question.interstitialConfig.message}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
    gap: Theme.spacing.xxl,
  },
  heartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
    shadowColor: '#B00000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  textContainer: {
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  title: {
    ...Theme.typography.title,
    textAlign: 'center',
  },
  subtitle: {
    ...Theme.typography.subtitle,
    textAlign: 'center',
  },
  message: {
    ...Theme.typography.body,
    fontFamily: Theme.fonts.semiBold,
    color: Theme.colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
