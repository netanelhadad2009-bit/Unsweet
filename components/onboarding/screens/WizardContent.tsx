import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Dimensions, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { Trophy } from 'lucide-react-native';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { ONBOARDING_QUESTIONS } from '../../../data/onboardingQuestions';
import { OptionCard } from '../OptionCard';
import { Theme } from '../../../constants/Theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 40;
const CHART_HEIGHT = 240;

// Chart data for commitment question
const CHART_POINTS = [
  { index: 0, day: 0, value: 0.15, label: '' },
  { index: 1, day: 8, value: 0.30, label: '3 Days' },
  { index: 2, day: 16, value: 0.55, label: '7 Days' },
  { index: 3, day: 30, value: 0.95, label: '30 Days' },
];

const PADDING = { left: 30, right: 30, top: 35, bottom: 25 };
const LINE_PATH_LENGTH = 400;
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

// Helper functions for commitment chart
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
    const prevX = getX(prev.day), prevY = getY(prev.value);
    const currX = getX(curr.day), currY = getY(curr.value);
    const cp1X = prevX + (currX - prevX) * 0.5, cp1Y = prevY;
    const cp2X = prevX + (currX - prevX) * 0.5, cp2Y = currY;
    path += ` C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${currX} ${currY}`;
  }
  return path;
};

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

export default function WizardContent() {
  const { onboardingData, updateAnswer, goToNextStep, setCurrentScreen } = useOnboarding();
  const currentStep = onboardingData.current_step;
  const currentQuestion = ONBOARDING_QUESTIONS[currentStep];
  const prevStepRef = useRef(currentStep);

  // For multi-select
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    (onboardingData.main_goals as string[]) || []
  );

  // Chart animations for commitment
  const lineAnim = useRef(new Animated.Value(0)).current;
  const areaOpacity1 = useRef(new Animated.Value(0)).current;
  const areaOpacity2 = useRef(new Animated.Value(0)).current;
  const areaOpacity3 = useRef(new Animated.Value(0)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;
  const trophyOpacity = useRef(new Animated.Value(0)).current;
  const trophyScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      prevStepRef.current = currentStep;
    }
  }, [currentStep]);

  // Start chart animation for commitment question
  useEffect(() => {
    if (currentQuestion?.type === 'commitment') {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(lineAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(areaOpacity1, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(areaOpacity2, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(areaOpacity3, { toValue: 1, duration: 400, useNativeDriver: true }),
          ]),
          Animated.timing(dotsOpacity, { toValue: 1, duration: 800, delay: 300, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(trophyOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(trophyScale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [currentQuestion?.type]);

  // For single-select - track selected option locally
  const [singleSelectedOption, setSingleSelectedOption] = useState<string | null>(
    (onboardingData[currentQuestion?.id as keyof typeof onboardingData] as string) || null
  );

  // Sync single-select state when question changes
  useEffect(() => {
    if (currentQuestion?.type === 'single-select') {
      const currentValue = onboardingData[currentQuestion.id as keyof typeof onboardingData] as string | null;
      setSingleSelectedOption(currentValue || null);
    }
  }, [currentStep, currentQuestion?.id]);

  const handleSingleSelect = (optionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSingleSelectedOption(optionId);
    updateAnswer(currentQuestion.id, optionId);
  };

  const handleSingleContinue = () => {
    if (!singleSelectedOption) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleAdvance();
  };

  const handleMultiToggle = (optionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOptions((prev) => {
      const updated = prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId];
      updateAnswer(currentQuestion.id, updated);
      return updated;
    });
  };

  const handleMultiContinue = () => {
    if (selectedOptions.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleAdvance();
  };

  const handleCommit = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateAnswer(currentQuestion.id, 'ready');
    // Last wizard step - go to method screen
    setCurrentScreen('method');
  };

  const handleAdvance = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    // After step 3 (sugar_frequency), go to efficacy
    if (currentStep === 3) {
      setCurrentScreen('efficacy');
    } else if (currentStep >= ONBOARDING_QUESTIONS.length - 1) {
      // Last step - go to method
      setCurrentScreen('method');
    } else {
      goToNextStep();
    }
  };

  if (!currentQuestion) return null;

  // Render single-select question
  if (currentQuestion.type === 'single-select') {
    const canAdvanceSingle = singleSelectedOption !== null;
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>{currentQuestion.title}</Text>
            {currentQuestion.subtitle && <Text style={styles.subtitle}>{currentQuestion.subtitle}</Text>}
          </View>
          <View style={styles.options}>
            {currentQuestion.options?.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                selected={singleSelectedOption === option.id}
                onPress={() => handleSingleSelect(option.id)}
                type="single"
              />
            ))}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Pressable
            disabled={!canAdvanceSingle}
            onPress={handleSingleContinue}
            style={({ pressed }) => [
              styles.continueButton,
              !canAdvanceSingle && styles.continueButtonDisabled,
              pressed && canAdvanceSingle && styles.continueButtonPressed,
            ]}
          >
            <Text style={[styles.continueButtonText, !canAdvanceSingle && styles.continueButtonTextDisabled]}>
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Render multi-select question
  if (currentQuestion.type === 'multi-select') {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>{currentQuestion.title}</Text>
            {currentQuestion.subtitle && <Text style={styles.subtitle}>{currentQuestion.subtitle}</Text>}
            {selectedOptions.length > 0 && (
              <Text style={styles.counter}>{selectedOptions.length} selected</Text>
            )}
          </View>
          <View style={styles.options}>
            {currentQuestion.options?.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                selected={selectedOptions.includes(option.id)}
                onPress={() => handleMultiToggle(option.id)}
                type="multi"
              />
            ))}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Pressable
            disabled={selectedOptions.length === 0}
            onPress={handleMultiContinue}
            style={({ pressed }) => [
              styles.continueButton,
              selectedOptions.length === 0 && styles.continueButtonDisabled,
              pressed && selectedOptions.length > 0 && styles.continueButtonPressed,
            ]}
          >
            <Text style={[styles.continueButtonText, selectedOptions.length === 0 && styles.continueButtonTextDisabled]}>
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Render commitment question with chart
  if (currentQuestion.type === 'commitment') {
    const linePath = generateSmoothPath(CHART_POINTS, CHART_WIDTH, CHART_HEIGHT);
    const positions = CHART_POINTS.map(point => getDotPosition(point.day, point.value, CHART_WIDTH, CHART_HEIGHT));
    const lastPos = positions[positions.length - 1];
    const strokeDashoffset = lineAnim.interpolate({ inputRange: [0, 1], outputRange: [LINE_PATH_LENGTH, 0] });

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.commitmentContent} showsVerticalScrollIndicator={false} scrollEnabled={false} bounces={false}>
          <View style={styles.header}>
            <Text style={styles.title}>You have great potential</Text>
            <Text style={styles.titleHighlight}>to crush your goal</Text>
            <Text style={styles.subtitle}>Your personalized plan is ready to guide you every step of the way</Text>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.cardTitle}>Your Sugar Craving Transition</Text>
            <View style={styles.chartContainer}>
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                {/* Shaded sections */}
                <AnimatedPath d={`M ${positions[0].x} ${CHART_HEIGHT - PADDING.bottom} L ${positions[0].x} ${positions[0].y} C ${positions[0].x + (positions[1].x - positions[0].x) * 0.5} ${positions[0].y}, ${positions[0].x + (positions[1].x - positions[0].x) * 0.5} ${positions[1].y}, ${positions[1].x} ${positions[1].y} L ${positions[1].x} ${CHART_HEIGHT - PADDING.bottom} Z`} fill="#FDF3EE" opacity={areaOpacity1} />
                <AnimatedPath d={`M ${positions[1].x} ${CHART_HEIGHT - PADDING.bottom} L ${positions[1].x} ${positions[1].y} C ${positions[1].x + (positions[2].x - positions[1].x) * 0.5} ${positions[1].y}, ${positions[1].x + (positions[2].x - positions[1].x) * 0.5} ${positions[2].y}, ${positions[2].x} ${positions[2].y} L ${positions[2].x} ${CHART_HEIGHT - PADDING.bottom} Z`} fill="#FAEAE0" opacity={areaOpacity2} />
                <AnimatedPath d={`M ${positions[2].x} ${CHART_HEIGHT - PADDING.bottom} L ${positions[2].x} ${positions[2].y} C ${positions[2].x + (positions[3].x - positions[2].x) * 0.5} ${positions[2].y}, ${positions[2].x + (positions[3].x - positions[2].x) * 0.5} ${positions[3].y}, ${positions[3].x} ${positions[3].y} L ${positions[3].x} ${CHART_HEIGHT - PADDING.bottom} Z`} fill="#F5DFD2" opacity={areaOpacity3} />

                {/* Guide line */}
                <Path d={`M ${PADDING.left} ${positions[2].y} L ${CHART_WIDTH - PADDING.right} ${positions[2].y}`} stroke="#E0E0E0" strokeWidth={1} strokeDasharray="4,4" />

                {/* X-axis */}
                <Path d={`M ${PADDING.left} ${CHART_HEIGHT - PADDING.bottom} L ${CHART_WIDTH - PADDING.right} ${CHART_HEIGHT - PADDING.bottom}`} stroke="#2D2D2D" strokeWidth={2} />

                {/* Animated curve */}
                <AnimatedPath d={linePath} stroke="#2D2D2D" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeDasharray={LINE_PATH_LENGTH} strokeDashoffset={strokeDashoffset} />

                {/* Dots */}
                <AnimatedG opacity={dotsOpacity}>
                  {positions.slice(0, -1).map((pos, i) => (
                    <Circle key={i} cx={pos.x} cy={pos.y} r={6} fill="#FFFFFF" stroke="#2D2D2D" strokeWidth={2} />
                  ))}
                </AnimatedG>
              </Svg>

              {/* Trophy */}
              <Animated.View style={[styles.trophyContainer, { left: lastPos.x - 46, top: lastPos.y - 18, opacity: trophyOpacity, transform: [{ scale: trophyScale }] }]}>
                <View style={styles.trophyCircle}>
                  <Trophy size={18} color="#FFFFFF" fill="#FFFFFF" />
                </View>
              </Animated.View>

              {/* X-axis labels */}
              <View style={styles.xAxisLabels}>
                {CHART_POINTS.map((point, i) => {
                  if (!point.label || i === 0) return null;
                  const midX = (positions[i - 1].x + positions[i].x) / 2;
                  return <Text key={i} style={[styles.xLabel, { left: midX - 47 }]}>{point.label}</Text>;
                })}
              </View>
            </View>

            <View style={styles.insightContainer}>
              <Text style={styles.insightText}>Based on Unsweet's data, cravings usually peak at Day 3 but drop significantly by Day 14.</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={handleCommit} style={({ pressed }) => [styles.continueButton, pressed && styles.continueButtonPressed]}>
            <Text style={styles.continueButtonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.sm, gap: Theme.spacing.xl, paddingBottom: Theme.spacing.xxl },
  commitmentContent: { flexGrow: 1, paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.sm, paddingBottom: Theme.spacing.md, justifyContent: 'flex-start' },
  header: { gap: Theme.spacing.sm },
  title: { fontFamily: Theme.fonts.extraBold, fontSize: 32, fontWeight: '800', color: Theme.colors.text.primary, letterSpacing: -0.5 },
  titleHighlight: { fontFamily: Theme.fonts.extraBold, fontSize: 32, fontWeight: '800', color: Theme.colors.primary, letterSpacing: -0.5, marginBottom: Theme.spacing.sm },
  subtitle: { fontFamily: Theme.fonts.regular, fontSize: 16, color: Theme.colors.text.secondary, lineHeight: 22 },
  counter: { fontFamily: Theme.fonts.semiBold, fontSize: 16, fontWeight: '600', color: Theme.colors.primary },
  options: { gap: Theme.spacing.md },
  footer: { paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md, borderTopWidth: 1, borderTopColor: Theme.colors.border, backgroundColor: Theme.colors.background },
  continueButton: { backgroundColor: Theme.colors.primary, borderRadius: Theme.borderRadius.lg, paddingVertical: Theme.spacing.md, alignItems: 'center', ...Theme.shadows.medium },
  continueButtonDisabled: { backgroundColor: Theme.colors.text.muted },
  continueButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  continueButtonText: { fontFamily: Theme.fonts.bold, color: Theme.colors.background, fontSize: 18, fontWeight: '700' },
  continueButtonTextDisabled: { color: Theme.colors.background, opacity: 0.7 },
  // Chart styles
  chartCard: { backgroundColor: '#F8F8F8', borderRadius: 24, paddingHorizontal: Theme.spacing.md, paddingTop: Theme.spacing.lg, paddingBottom: Theme.spacing.xl, marginVertical: Theme.spacing.lg },
  cardTitle: { fontFamily: Theme.fonts.semiBold, fontSize: 20, fontWeight: '600', color: Theme.colors.text.primary, textAlign: 'left', marginBottom: 0, paddingHorizontal: Theme.spacing.sm },
  chartContainer: { position: 'relative', alignItems: 'center', marginTop: -Theme.spacing.md, marginBottom: 0 },
  trophyContainer: { position: 'absolute', zIndex: 10 },
  trophyCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D4956A', justifyContent: 'center', alignItems: 'center' },
  xAxisLabels: { position: 'absolute', bottom: -5, left: 0, right: 0, height: 20 },
  xLabel: { position: 'absolute', fontFamily: Theme.fonts.semiBold, fontSize: 16, fontWeight: '600', color: Theme.colors.text.primary, textAlign: 'center', width: 55 },
  insightContainer: { marginTop: Theme.spacing.md, paddingTop: 0 },
  insightText: { fontFamily: Theme.fonts.regular, fontSize: 16, color: Theme.colors.text.secondary, textAlign: 'center', lineHeight: 24 },
});
