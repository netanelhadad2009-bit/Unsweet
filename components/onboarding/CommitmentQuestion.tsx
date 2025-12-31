import { View, Text, StyleSheet, Pressable, Dimensions, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { Trophy } from 'lucide-react-native';
import { Question } from '../../types/onboarding';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { Theme } from '../../constants/Theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 40;
const CHART_HEIGHT = 240;

// Create animated components
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

// Estimated path length for animation
const LINE_PATH_LENGTH = 400;

// Chart data points - position values for visual spacing, labels mark END of each period
const CHART_POINTS = [
  { index: 0, day: 0, value: 0.15, label: '' },
  { index: 1, day: 8, value: 0.30, label: '3 Days' },
  { index: 2, day: 16, value: 0.55, label: '7 Days' },
  { index: 3, day: 30, value: 0.95, label: '30 Days' },
];

const PADDING = { left: 30, right: 30, top: 35, bottom: 25 };

// Generate smooth Bezier curve path
const generateSmoothPath = (points: typeof CHART_POINTS, width: number, height: number): string => {
  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;
  const maxDay = points[points.length - 1].day;
  const minDay = points[0].day;

  const getX = (day: number) => PADDING.left + ((day - minDay) / (maxDay - minDay)) * chartWidth;
  const getY = (value: number) => PADDING.top + (1 - value) * chartHeight;

  let path = `M ${getX(points[0].day)} ${getY(points[0].value)}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const prevX = getX(prev.day);
    const prevY = getY(prev.value);
    const currX = getX(curr.day);
    const currY = getY(curr.value);

    const cp1X = prevX + (currX - prevX) * 0.5;
    const cp1Y = prevY;
    const cp2X = prevX + (currX - prevX) * 0.5;
    const cp2Y = currY;

    path += ` C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${currX} ${currY}`;
  }

  return path;
};

// Get dot positions using day values
const getDotPosition = (day: number, value: number, width: number, height: number) => {
  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;
  const maxDay = CHART_POINTS[CHART_POINTS.length - 1].day;
  const minDay = CHART_POINTS[0].day;

  return {
    x: PADDING.left + ((day - minDay) / (maxDay - minDay)) * chartWidth,
    y: PADDING.top + (1 - value) * chartHeight,
  };
};

interface Props {
  question: Question;
}

export function CommitmentQuestion({ question }: Props) {
  const router = useRouter();
  const { updateAnswer } = useOnboarding();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const chartFadeAnim = useRef(new Animated.Value(0)).current;

  // Chart animation values
  const lineAnim = useRef(new Animated.Value(0)).current;
  const areaOpacity1 = useRef(new Animated.Value(0)).current;
  const areaOpacity2 = useRef(new Animated.Value(0)).current;
  const areaOpacity3 = useRef(new Animated.Value(0)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;
  const trophyOpacity = useRef(new Animated.Value(0)).current;
  const trophyScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.sequence([
      // Fade in header
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Fade in chart card
      Animated.timing(chartFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Animate chart elements
      Animated.parallel([
        // Draw the line
        Animated.timing(lineAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        // Fade in areas sequentially
        Animated.sequence([
          Animated.timing(areaOpacity1, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(areaOpacity2, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(areaOpacity3, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        // Fade in dots
        Animated.timing(dotsOpacity, {
          toValue: 1,
          duration: 800,
          delay: 300,
          useNativeDriver: true,
        }),
      ]),
      // Animate trophy at the end
      Animated.parallel([
        Animated.timing(trophyOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(trophyScale, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  // Interpolate stroke dash offset (from full length to 0)
  const strokeDashoffset = lineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [LINE_PATH_LENGTH, 0],
  });

  const handleCommit = (optionId: string) => {
    updateAnswer(question.id, optionId);

    if (optionId === 'ready') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/onboarding/method');
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const linePath = generateSmoothPath(CHART_POINTS, CHART_WIDTH, CHART_HEIGHT);

  // Get positions for each point using day values
  const positions = CHART_POINTS.map(point =>
    getDotPosition(point.day, point.value, CHART_WIDTH, CHART_HEIGHT)
  );

  const lastPos = positions[positions.length - 1];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
          bounces={false}
        >
          {/* Header */}
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <Text style={styles.title}>You have great potential</Text>
            <Text style={styles.titleHighlight}>to crush your goal</Text>
            <Text style={styles.subtitle}>
              Your personalized plan is ready to guide you every step of the way
            </Text>
          </Animated.View>

          {/* Chart Card */}
          <Animated.View style={[styles.chartCard, { opacity: chartFadeAnim }]}>
            <Text style={styles.cardTitle}>Your Sugar Craving Transition</Text>

            <View style={styles.chartContainer}>
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                {/* Shaded sections between each pair of points - bounded by curve */}
                <AnimatedPath
                  d={`M ${positions[0].x} ${CHART_HEIGHT - PADDING.bottom} L ${positions[0].x} ${positions[0].y} C ${positions[0].x + (positions[1].x - positions[0].x) * 0.5} ${positions[0].y}, ${positions[0].x + (positions[1].x - positions[0].x) * 0.5} ${positions[1].y}, ${positions[1].x} ${positions[1].y} L ${positions[1].x} ${CHART_HEIGHT - PADDING.bottom} Z`}
                  fill="#FDF3EE"
                  opacity={areaOpacity1}
                />
                <AnimatedPath
                  d={`M ${positions[1].x} ${CHART_HEIGHT - PADDING.bottom} L ${positions[1].x} ${positions[1].y} C ${positions[1].x + (positions[2].x - positions[1].x) * 0.5} ${positions[1].y}, ${positions[1].x + (positions[2].x - positions[1].x) * 0.5} ${positions[2].y}, ${positions[2].x} ${positions[2].y} L ${positions[2].x} ${CHART_HEIGHT - PADDING.bottom} Z`}
                  fill="#FAEAE0"
                  opacity={areaOpacity2}
                />
                <AnimatedPath
                  d={`M ${positions[2].x} ${CHART_HEIGHT - PADDING.bottom} L ${positions[2].x} ${positions[2].y} C ${positions[2].x + (positions[3].x - positions[2].x) * 0.5} ${positions[2].y}, ${positions[2].x + (positions[3].x - positions[2].x) * 0.5} ${positions[3].y}, ${positions[3].x} ${positions[3].y} L ${positions[3].x} ${CHART_HEIGHT - PADDING.bottom} Z`}
                  fill="#F5DFD2"
                  opacity={areaOpacity3}
                />

                {/* Horizontal guide line at 7 Days point */}
                <Path
                  d={`M ${PADDING.left} ${positions[2].y} L ${CHART_WIDTH - PADDING.right} ${positions[2].y}`}
                  stroke="#E0E0E0"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />

                {/* X-axis line */}
                <Path
                  d={`M ${PADDING.left} ${CHART_HEIGHT - PADDING.bottom} L ${CHART_WIDTH - PADDING.right} ${CHART_HEIGHT - PADDING.bottom}`}
                  stroke="#2D2D2D"
                  strokeWidth={2}
                />

                {/* Main curve line - animated */}
                <AnimatedPath
                  d={linePath}
                  stroke="#2D2D2D"
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={LINE_PATH_LENGTH}
                  strokeDashoffset={strokeDashoffset}
                />

                {/* Hollow dots - all except the last one */}
                <AnimatedG opacity={dotsOpacity}>
                  {positions.slice(0, -1).map((pos, i) => (
                    <Circle key={i} cx={pos.x} cy={pos.y} r={6} fill="#FFFFFF" stroke="#2D2D2D" strokeWidth={2} />
                  ))}
                </AnimatedG>
              </Svg>

              {/* Trophy in circle at end - animated */}
              <Animated.View
                style={[
                  styles.trophyContainer,
                  {
                    left: lastPos.x - 46,
                    top: lastPos.y - 18,
                    opacity: trophyOpacity,
                    transform: [{ scale: trophyScale }],
                  }
                ]}
              >
                <View style={styles.trophyCircle}>
                  <Trophy size={18} color="#FFFFFF" fill="#FFFFFF" />
                </View>
              </Animated.View>

              {/* X-axis labels - positioned in the middle between each pair of dots */}
              <View style={styles.xAxisLabels}>
                {CHART_POINTS.map((point, i) => {
                  if (!point.label || i === 0) return null;

                  // Position label exactly in the middle between previous dot and current dot
                  const prevX = positions[i - 1].x;
                  const currX = positions[i].x;
                  const midX = (prevX + currX) / 2;

                  return (
                    <Text key={i} style={[styles.xLabel, { left: midX - 47 }]}>
                      {point.label}
                    </Text>
                  );
                })}
              </View>
            </View>

            <View style={styles.insightContainer}>
              <Text style={styles.insightText}>
                Based on Unsweet's data, cravings usually peak at Day 3 but drop significantly by Day 14.
              </Text>
            </View>
          </Animated.View>

        </ScrollView>

        {/* Button */}
        <View style={styles.buttonContainer}>
          <Pressable
            onPress={() => handleCommit('ready')}
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.continueButtonPressed,
            ]}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.md,
    justifyContent: 'flex-start',
  },
  header: {
    marginBottom: Theme.spacing.sm,
  },
  title: {
    fontFamily: Theme.fonts.extraBold,
    fontSize: 32,
    fontWeight: '800',
    color: Theme.colors.text.primary,
    letterSpacing: -0.5,
  },
  titleHighlight: {
    fontFamily: Theme.fonts.extraBold,
    fontSize: 32,
    fontWeight: '800',
    color: Theme.colors.primary,
    letterSpacing: -0.5,
    marginBottom: Theme.spacing.sm,
  },
  subtitle: {
    fontFamily: Theme.fonts.regular,
    fontSize: 16,
    color: Theme.colors.text.secondary,
    lineHeight: 22,
    marginTop: Theme.spacing.xs,
  },
  chartCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 24,
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
    marginVertical: Theme.spacing.lg,
  },
  cardTitle: {
    fontFamily: Theme.fonts.semiBold,
    fontSize: 20,
    fontWeight: '600',
    color: Theme.colors.text.primary,
    textAlign: 'left',
    marginBottom: 0,
    paddingHorizontal: Theme.spacing.sm,
  },
  chartContainer: {
    position: 'relative',
    alignItems: 'center',
    marginTop: -Theme.spacing.md,
    marginBottom: 0,
  },
  trophyContainer: {
    position: 'absolute',
    zIndex: 10,
  },
  trophyCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D4956A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  xAxisLabels: {
    position: 'absolute',
    bottom: -5,
    left: 0,
    right: 0,
    height: 20,
  },
  xLabel: {
    position: 'absolute',
    fontFamily: Theme.fonts.semiBold,
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text.primary,
    textAlign: 'center',
    width: 55,
  },
  insightContainer: {
    marginTop: Theme.spacing.md,
    paddingTop: 0,
  },
  insightText: {
    fontFamily: Theme.fonts.regular,
    fontSize: 16,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    paddingBottom: 0,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    backgroundColor: Theme.colors.background,
  },
  continueButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  continueButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  continueButtonText: {
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background,
    fontSize: 18,
    fontWeight: '700',
  },
});
