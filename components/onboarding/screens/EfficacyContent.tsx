import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { Theme } from '../../../constants/Theme';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export default function EfficacyContent() {
  const { goToNextStep, setCurrentScreen } = useOnboarding();

  const leftBarHeight = useRef(new Animated.Value(0)).current;
  const rightBarHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(leftBarHeight, { toValue: 60, duration: 500, useNativeDriver: false }),
      Animated.timing(rightBarHeight, { toValue: 120, duration: 700, useNativeDriver: false }),
    ]).start();
  }, []);

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Advance wizard step and go back to wizard (which continues from step 4)
    goToNextStep();
    setCurrentScreen('wizard');
  };

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Quit Sugar 2x Faster</Text>
        <Text style={styles.titleHighlight}>with Unsweet vs On Your Own</Text>
      </View>

      <View style={styles.comparisonContainer}>
        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Without{'\n'}Unsweet</Text>
            <View style={styles.barContainer}>
              <Animated.View style={[styles.barSmall, { height: leftBarHeight }]}>
                <Text style={styles.barSmallText}>20%</Text>
              </Animated.View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabelHighlight}>With{'\n'}Unsweet</Text>
            <View style={styles.barContainer}>
              <Animated.View style={[styles.barLarge, { height: rightBarHeight }]}>
                <Text style={styles.barLargeText}>2X</Text>
              </Animated.View>
            </View>
          </View>
        </View>

        <Text style={styles.caption}>
          Unsweet makes it easy and holds you accountable.
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <Pressable onPress={handleContinue} style={({ pressed }) => [styles.continueButton, pressed && styles.continueButtonPressed]}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.sm, justifyContent: 'space-between' },
  header: { alignItems: 'flex-start', marginBottom: Theme.spacing.md },
  title: { fontFamily: Theme.fonts.extraBold, fontSize: 32, fontWeight: '800', color: Theme.colors.text.primary, letterSpacing: -0.5 },
  titleHighlight: { fontFamily: Theme.fonts.extraBold, fontSize: 32, fontWeight: '800', color: Theme.colors.primary, letterSpacing: -0.5 },
  comparisonContainer: { backgroundColor: '#F2F2F7', borderRadius: 20, padding: Theme.spacing.lg, paddingTop: Theme.spacing.xxl, marginVertical: Theme.spacing.md },
  cardsRow: { flexDirection: 'row', justifyContent: 'center', gap: Theme.spacing.md },
  card: { width: 105, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', alignItems: 'center', minHeight: 200 },
  cardLabel: { fontFamily: Theme.fonts.bold, fontSize: 16, fontWeight: '700', color: Theme.colors.text.primary, textAlign: 'center', paddingTop: Theme.spacing.lg, paddingHorizontal: Theme.spacing.sm, marginBottom: Theme.spacing.md, minHeight: 44 },
  cardLabelHighlight: { fontFamily: Theme.fonts.bold, fontSize: 16, fontWeight: '700', color: Theme.colors.text.primary, textAlign: 'center', paddingTop: Theme.spacing.lg, paddingHorizontal: Theme.spacing.sm, marginBottom: Theme.spacing.md, minHeight: 44 },
  barContainer: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', width: '100%' },
  barSmall: { width: '100%', backgroundColor: '#E5E5EA', borderTopLeftRadius: 12, borderTopRightRadius: 12, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: Theme.spacing.md },
  barSmallText: { fontFamily: Theme.fonts.semiBold, fontSize: 20, fontWeight: '600', color: '#8E8E93' },
  barLarge: { width: '100%', backgroundColor: Theme.colors.primary, borderTopLeftRadius: 12, borderTopRightRadius: 12, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: Theme.spacing.md },
  barLargeText: { fontFamily: Theme.fonts.bold, fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  caption: { fontFamily: Theme.fonts.medium, fontSize: 16, color: Theme.colors.text.secondary, textAlign: 'center', marginTop: Theme.spacing.lg, lineHeight: 22 },
  buttonContainer: { paddingVertical: Theme.spacing.md, borderTopWidth: 1, borderTopColor: Theme.colors.border, backgroundColor: Theme.colors.background, marginHorizontal: -Theme.spacing.lg, paddingHorizontal: Theme.spacing.lg },
  continueButton: { backgroundColor: Theme.colors.primary, borderRadius: Theme.borderRadius.lg, paddingVertical: Theme.spacing.md, alignItems: 'center', ...Theme.shadows.medium },
  continueButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  continueButtonText: { fontFamily: Theme.fonts.bold, color: Theme.colors.background, fontSize: 18, fontWeight: '700' },
});
