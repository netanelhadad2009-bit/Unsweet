import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { HeartPulse } from 'lucide-react-native';
import { Theme } from '../../../constants/Theme';

const ANALYSIS_DURATION = 3000;

interface AnalysisContentProps {
  onComplete: () => void;
}

export default function AnalysisContent({ onComplete }: AnalysisContentProps) {
  const heartbeatScale = useRef(new Animated.Value(1)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const [showButton, setShowButton] = useState(false);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete();
  };

  useEffect(() => {
    // Create heartbeat animation
    const heartbeat = Animated.sequence([
      Animated.timing(heartbeatScale, { toValue: 1.08, duration: 180, useNativeDriver: true }),
      Animated.timing(heartbeatScale, { toValue: 1.0, duration: 180, useNativeDriver: true }),
      Animated.timing(heartbeatScale, { toValue: 1.08, duration: 180, useNativeDriver: true }),
      Animated.timing(heartbeatScale, { toValue: 1.0, duration: 180, useNativeDriver: true }),
      Animated.delay(500),
    ]);

    Animated.loop(heartbeat).start();

    // Auto-advance after duration
    const timer = setTimeout(() => {
      handleContinue();
    }, ANALYSIS_DURATION);

    // Show fallback button after auto-advance time
    const buttonTimer = setTimeout(() => {
      setShowButton(true);
      Animated.timing(buttonOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, ANALYSIS_DURATION + 500);

    return () => {
      clearTimeout(timer);
      clearTimeout(buttonTimer);
    };
  }, []);

  return (
    <View style={styles.content}>
      <Animated.View style={[styles.heartContainer, { transform: [{ scale: heartbeatScale }] }]}>
        <HeartPulse size={160} color="#B00000" strokeWidth={3} fill="#B00000" fillOpacity={0.3} />
      </Animated.View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>Analyzing your metabolic profile...</Text>
        <Text style={styles.subtitle}>Creating your personalized plan</Text>
        <Text style={styles.message}>Almost there!</Text>
      </View>

      {showButton && (
        <Animated.View style={[styles.buttonContainer, { opacity: buttonOpacity }]}>
          <Pressable onPress={handleContinue} style={({ pressed }) => [styles.continueButton, pressed && styles.continueButtonPressed]}>
            <Text style={styles.continueButtonText}>Continue</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Theme.spacing.xl, gap: Theme.spacing.xxl },
  heartContainer: { justifyContent: 'center', alignItems: 'center', padding: Theme.spacing.lg, shadowColor: '#B00000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 20 },
  textContainer: { alignItems: 'center', gap: Theme.spacing.md },
  title: { fontFamily: Theme.fonts.extraBold, fontSize: 32, fontWeight: '800', color: Theme.colors.text.primary, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontFamily: Theme.fonts.regular, fontSize: 16, color: Theme.colors.text.secondary, textAlign: 'center', lineHeight: 22 },
  message: { fontFamily: Theme.fonts.semiBold, fontSize: 16, fontWeight: '600', color: Theme.colors.primary, textAlign: 'center' },
  buttonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.lg, backgroundColor: Theme.colors.background, borderTopWidth: 1, borderTopColor: Theme.colors.border },
  continueButton: { backgroundColor: Theme.colors.primary, borderRadius: Theme.borderRadius.lg, paddingVertical: Theme.spacing.md, alignItems: 'center', ...Theme.shadows.medium },
  continueButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  continueButtonText: { fontFamily: Theme.fonts.bold, color: Theme.colors.background, fontSize: 18, fontWeight: '700' },
});
