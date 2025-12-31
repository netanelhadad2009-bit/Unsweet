import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { HeartHandshake, Lock } from 'lucide-react-native';
import { Theme } from '../../../constants/Theme';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export default function MethodContent() {
  const { goToNextScreen } = useOnboarding();

  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(buttonAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    goToNextScreen();
  };

  return (
    <View style={styles.content}>
      <Animated.View style={[styles.mainContent, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.illustrationContainer}>
          <View style={styles.outerRing3}>
            <View style={styles.outerRing2}>
              <View style={styles.outerRing1}>
                <View style={styles.innerCircle}>
                  <HeartHandshake size={80} color={Theme.colors.primary} strokeWidth={1.5} />
                </View>
              </View>
            </View>
          </View>
        </View>
        <Text style={styles.title}>Thank you for{'\n'}trusting us</Text>
        <Text style={styles.subtitle}>Now let's personalize Unsweet for you...</Text>
      </Animated.View>

      <Animated.View style={[styles.privacyCard, { opacity: cardAnim }]}>
        <View style={styles.lockBadge}>
          <Lock size={18} color={Theme.colors.primary} strokeWidth={2} />
        </View>
        <Text style={styles.privacyTitle}>Your privacy and security matter to us.</Text>
        <Text style={styles.privacyText}>We promise to always keep your personal information private and secure.</Text>
      </Animated.View>

      <Animated.View style={[styles.buttonContainer, { opacity: buttonAnim }]}>
        <Pressable onPress={handleContinue} style={({ pressed }) => [styles.continueButton, pressed && styles.continueButtonPressed]}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: Theme.spacing.lg, justifyContent: 'space-between' },
  mainContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: Theme.spacing.xl },
  illustrationContainer: { marginBottom: Theme.spacing.xl },
  outerRing3: { width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(253, 203, 110, 0.15)', justifyContent: 'center', alignItems: 'center' },
  outerRing2: { width: 195, height: 195, borderRadius: 97.5, backgroundColor: 'rgba(0, 200, 151, 0.12)', justifyContent: 'center', alignItems: 'center' },
  outerRing1: { width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(0, 200, 151, 0.2)', justifyContent: 'center', alignItems: 'center' },
  innerCircle: { width: 145, height: 145, borderRadius: 72.5, backgroundColor: Theme.colors.background, justifyContent: 'center', alignItems: 'center', ...Theme.shadows.small },
  title: { fontFamily: Theme.fonts.extraBold, fontSize: 32, fontWeight: '800', color: Theme.colors.text.primary, textAlign: 'center', letterSpacing: -0.5, marginBottom: Theme.spacing.md },
  subtitle: { fontFamily: Theme.fonts.regular, fontSize: 17, color: Theme.colors.text.secondary, textAlign: 'center', lineHeight: 24 },
  privacyCard: { backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.lg, padding: Theme.spacing.lg, alignItems: 'center', marginBottom: Theme.spacing.lg },
  lockBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0, 200, 151, 0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: Theme.spacing.md, marginTop: -Theme.spacing.xl - 6 },
  privacyTitle: { fontFamily: Theme.fonts.bold, fontSize: 16, fontWeight: '700', color: Theme.colors.text.primary, textAlign: 'center', marginBottom: Theme.spacing.xs },
  privacyText: { fontFamily: Theme.fonts.regular, fontSize: 14, color: Theme.colors.text.secondary, textAlign: 'center', lineHeight: 20 },
  buttonContainer: { paddingVertical: Theme.spacing.md, backgroundColor: Theme.colors.background, borderTopWidth: 1, borderTopColor: Theme.colors.border, marginHorizontal: -Theme.spacing.lg, paddingHorizontal: Theme.spacing.lg },
  continueButton: { backgroundColor: Theme.colors.primary, borderRadius: Theme.borderRadius.lg, paddingVertical: Theme.spacing.md, alignItems: 'center', ...Theme.shadows.medium },
  continueButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  continueButtonText: { fontFamily: Theme.fonts.bold, color: Theme.colors.background, fontSize: 18, fontWeight: '700' },
});
