import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { Theme } from '../../constants/Theme';

interface Props {
  progress: number; // 10 to 100
}

export function ProgressBar({ progress }: Props) {
  const animatedProgress = useRef(new Animated.Value(10)).current;

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

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: widthInterpolated }]} />
      </View>
      <Text style={styles.label}>{Math.round(progress)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  track: {
    flex: 1,
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
  label: {
    ...Theme.typography.body,
    fontFamily: Theme.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text.light,
    minWidth: 40,
    textAlign: 'right',
  },
});
