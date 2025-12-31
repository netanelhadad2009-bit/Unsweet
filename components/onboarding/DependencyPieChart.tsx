import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Theme } from '../../constants/Theme';
import { useOnboarding } from '../../contexts/OnboardingContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_SIZE = Math.min(SCREEN_WIDTH * 0.85, 320);
const CENTER = CHART_SIZE / 2;
const RADIUS = CHART_SIZE / 2 - 20;
const STROKE_WIDTH = 45;

// Calculate dependency level based on onboarding answers
function calculateDependencyLevel(answers: {
  sugar_frequency?: string | null;
  quit_attempts?: string | null;
  post_binge_feeling?: string | null;
  craving_time?: string | null;
}): number {
  let score = 0;

  // Sugar frequency scoring (0-30 points)
  switch (answers.sugar_frequency) {
    case 'every_day': score += 30; break;
    case 'few_times_week': score += 20; break;
    case 'when_stressed': score += 15; break;
    case 'weekends': score += 10; break;
  }

  // Quit attempts scoring (0-30 points)
  switch (answers.quit_attempts) {
    case 'multiple_failed': score += 30; break;
    case 'currently_struggling': score += 25; break;
    case 'once_twice': score += 15; break;
    case 'first_attempt': score += 5; break;
  }

  // Post-binge feeling scoring (0-20 points)
  switch (answers.post_binge_feeling) {
    case 'guilty': score += 20; break;
    case 'anxious': score += 18; break;
    case 'low_energy': score += 15; break;
    case 'bloated': score += 12; break;
  }

  // Craving time scoring (0-20 points)
  switch (answers.craving_time) {
    case 'late_night': score += 20; break;
    case 'evening': score += 15; break;
    case 'afternoon': score += 12; break;
    case 'morning': score += 10; break;
  }

  // Normalize to percentage (max possible is 100)
  return Math.min(Math.max(score, 35), 85); // Keep between 35-85% for realism
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function DependencyPieChart() {
  const { onboardingData } = useOnboarding();

  // Calculate the dependency percentage based on answers
  const dependencyPercent = calculateDependencyLevel({
    sugar_frequency: onboardingData.sugar_frequency,
    quit_attempts: onboardingData.quit_attempts,
    post_binge_feeling: onboardingData.post_binge_feeling,
    craving_time: onboardingData.craving_time,
  });

  const controlPercent = 100 - dependencyPercent;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Calculate circumference and stroke dasharray
  const circumference = 2 * Math.PI * RADIUS;
  const dependencyDash = (dependencyPercent / 100) * circumference;
  const controlDash = (controlPercent / 100) * circumference;

  useEffect(() => {
    // Dramatic entrance animation sequence
    Animated.sequence([
      // First: fade in and scale up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // Then: animate the progress fill
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: false,
      }),
    ]).start();

    // Subtle pulse animation for the center
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [dependencyPercent]);

  // Interpolate animated progress for the stroke dashoffset
  const animatedDependencyOffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, circumference - dependencyDash],
  });

  const animatedControlOffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, circumference - controlDash],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Chart Title */}
      <Text style={styles.chartTitle}>Your Sugar Dependency Analysis</Text>

      {/* Main Pie Chart */}
      <View style={styles.chartWrapper}>
        <Svg width={CHART_SIZE} height={CHART_SIZE} viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}>
          <Defs>
            <LinearGradient id="dependencyGradient" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#DC2626" />
              <Stop offset="1" stopColor="#991B1B" />
            </LinearGradient>
            <LinearGradient id="controlGradient" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={Theme.colors.primary} />
              <Stop offset="1" stopColor="#059669" />
            </LinearGradient>
          </Defs>

          {/* Background track */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke="#F3F4F6"
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />

          {/* Control segment (green - bottom layer) */}
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke="url(#controlGradient)"
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${controlDash} ${circumference}`}
            strokeDashoffset={animatedControlOffset}
            transform={`rotate(${-90 + (dependencyPercent / 100) * 360} ${CENTER} ${CENTER})`}
          />

          {/* Dependency segment (red - top layer, starting from top) */}
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke="url(#dependencyGradient)"
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dependencyDash} ${circumference}`}
            strokeDashoffset={animatedDependencyOffset}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        </Svg>

        {/* Center Content */}
        <Animated.View style={[styles.centerContent, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.percentageContainer}>
            <Animated.Text style={styles.percentageNumber}>
              {dependencyPercent}
            </Animated.Text>
            <Text style={styles.percentageSymbol}>%</Text>
          </View>
          <Text style={styles.centerLabel}>Sugar{'\n'}Dependency</Text>
        </Animated.View>
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dependencyDot]} />
          <View style={styles.legendTextContainer}>
            <Text style={styles.legendLabel}>Sugar Dependency</Text>
            <Text style={styles.legendValue}>{dependencyPercent}%</Text>
          </View>
        </View>

        <View style={styles.legendDivider} />

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.controlDot]} />
          <View style={styles.legendTextContainer}>
            <Text style={styles.legendLabel}>Level of Control</Text>
            <Text style={[styles.legendValue, styles.controlValue]}>{controlPercent}%</Text>
          </View>
        </View>
      </View>

      {/* Motivational Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          {dependencyPercent >= 70
            ? "Your dependency is high, but that's exactly why this program works for people like you."
            : dependencyPercent >= 50
            ? "You're in a critical zone where action now can prevent deeper dependency."
            : "You have a solid foundation. Let's strengthen your control even further."}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  chartTitle: {
    fontFamily: Theme.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text.main,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  chartWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.lg,
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  percentageNumber: {
    fontFamily: Theme.fonts.extraBold,
    fontSize: 56,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: -2,
  },
  percentageSymbol: {
    fontFamily: Theme.fonts.bold,
    fontSize: 24,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 8,
  },
  centerLabel: {
    fontFamily: Theme.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text.light,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: -4,
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    ...Theme.shadows.small,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dependencyDot: {
    backgroundColor: '#DC2626',
  },
  controlDot: {
    backgroundColor: Theme.colors.primary,
  },
  legendTextContainer: {
    alignItems: 'flex-start',
  },
  legendLabel: {
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    color: Theme.colors.text.light,
  },
  legendValue: {
    fontFamily: Theme.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
  },
  controlValue: {
    color: Theme.colors.primary,
  },
  legendDivider: {
    width: 1,
    height: 40,
    backgroundColor: Theme.colors.border,
  },
  messageContainer: {
    paddingHorizontal: Theme.spacing.md,
  },
  messageText: {
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    fontWeight: '500',
    color: Theme.colors.text.light,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
