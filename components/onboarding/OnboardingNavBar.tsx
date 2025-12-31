import { View, Pressable, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Theme } from '../../constants/Theme';

interface OnboardingNavBarProps {
  progress: number; // 0 to 100
  showBackButton?: boolean;
  onBack?: () => void; // Optional custom back handler
}

export function OnboardingNavBar({ progress, showBackButton = true, onBack }: OnboardingNavBarProps) {
  const router = useRouter();
  const animatedProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: Theme.animation.duration.slow,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const widthInterpolated = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      {showBackButton ? (
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={24} color={Theme.colors.primary} strokeWidth={2.5} />
        </Pressable>
      ) : (
        <View style={styles.backButtonPlaceholder} />
      )}

      <View style={styles.progressContainer}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: widthInterpolated }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  backButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  progressContainer: {
    flex: 1,
  },
  track: {
    height: 6,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.full,
  },
});
