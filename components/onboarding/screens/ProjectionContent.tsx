import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Text as SvgText } from 'react-native-svg';
import { Theme } from '../../../constants/Theme';
import { useOnboarding } from '../../../contexts/OnboardingContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48 - 32 - 8;
const CHART_HEIGHT = 220;
const PADDING_TOP = 30;
const PADDING_BOTTOM = 20;

// Chart points
const MARGIN = 10;
const x1 = MARGIN;
const y1 = PADDING_TOP;
const x2 = CHART_WIDTH - MARGIN;
const y2_unsweet = CHART_HEIGHT - PADDING_BOTTOM;
const y2_traditional = PADDING_TOP + 8;

const unsweetPath = `M ${x1} ${y1} C ${x1 + 120} ${y1}, ${x2 - 120} ${y2_unsweet}, ${x2} ${y2_unsweet}`;
const lowPointX = CHART_WIDTH * 0.5;
const lowPointY = CHART_HEIGHT * 0.52;
const traditionalPath = `M ${x1} ${y1} C ${x1 + 60} ${y1 + 40}, ${lowPointX - 40} ${lowPointY}, ${lowPointX} ${lowPointY} C ${lowPointX + 40} ${lowPointY}, ${x2 - 60} ${y2_traditional + 40}, ${x2} ${y2_traditional}`;

const unsweetStartPoint = { x: x1, y: y1 };
const unsweetEndPoint = { x: x2, y: y2_unsweet };

const bottomY = CHART_HEIGHT - PADDING_BOTTOM + 5;
const unsweetAreaPath = `${unsweetPath} L ${x2} ${bottomY} L ${x1} ${bottomY} Z`;
const traditionalAreaPath = `${traditionalPath} L ${x2} ${bottomY} L ${x1} ${bottomY} Z`;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const UNSWEET_PATH_LENGTH = 350;
const TRADITIONAL_PATH_LENGTH = 400;

function ComparisonChart() {
  const unsweetLineAnim = useRef(new Animated.Value(0)).current;
  const traditionalLineAnim = useRef(new Animated.Value(0)).current;
  const areaOpacity = useRef(new Animated.Value(0)).current;
  const endPointOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(areaOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(unsweetLineAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(traditionalLineAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ]),
      Animated.timing(endPointOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const unsweetStrokeDashoffset = unsweetLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [UNSWEET_PATH_LENGTH, 0],
  });

  const traditionalStrokeDashoffset = traditionalLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [TRADITIONAL_PATH_LENGTH, 0],
  });

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Your Sugar Cravings</Text>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="unsweetGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={Theme.colors.primary} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={Theme.colors.primary} stopOpacity="0.1" />
          </LinearGradient>
          <LinearGradient id="traditionalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#FF6B6B" stopOpacity="0.1" />
          </LinearGradient>
        </Defs>
        <AnimatedPath d={traditionalAreaPath} fill="url(#traditionalGradient)" opacity={areaOpacity} />
        <AnimatedPath d={unsweetAreaPath} fill="url(#unsweetGradient)" opacity={areaOpacity} />
        <AnimatedPath d={traditionalPath} stroke="#FF6B6B" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={TRADITIONAL_PATH_LENGTH} strokeDashoffset={traditionalStrokeDashoffset} />
        <AnimatedPath d={unsweetPath} stroke={Theme.colors.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={UNSWEET_PATH_LENGTH} strokeDashoffset={unsweetStrokeDashoffset} />
        <Circle cx={unsweetStartPoint.x} cy={unsweetStartPoint.y} r={6} fill="#FFFFFF" stroke="#1A1A2E" strokeWidth={2} />
        <AnimatedPath d={`M ${unsweetEndPoint.x - 6} ${unsweetEndPoint.y} a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0`} fill={Theme.colors.primary} stroke="#FFFFFF" strokeWidth={2} opacity={endPointOpacity} />
        <SvgText x={CHART_WIDTH - 5} y={PADDING_TOP - 8} fill="#1A1A2E" fontSize={13} fontWeight="500" textAnchor="end">Traditional Method</SvgText>
        <SvgText x={MARGIN + 5} y={CHART_HEIGHT - PADDING_BOTTOM - 10} fill="#1A1A2E" fontSize={13} fontWeight="600" textAnchor="start">With Unsweet</SvgText>
      </Svg>
      <View style={styles.xAxisLabels}>
        <Text style={styles.xAxisLabel}>Beginning</Text>
        <Text style={[styles.xAxisLabel, styles.xAxisLabelRight]}>Your Result</Text>
      </View>
      <View style={styles.statInsideCard}>
        <Text style={styles.statText}>
          <Text style={styles.statHighlight}>78%</Text>
          <Text style={styles.statText}> of our members successfully{'\n'}reduce sugar cravings with </Text>
          <Text style={styles.statHighlightBrand}>Unsweet</Text>
        </Text>
      </View>
    </View>
  );
}

export default function ProjectionContent() {
  const { goToNextScreen } = useOnboarding();
  const chartAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(chartAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    goToNextScreen();
  };

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Long-Term Results</Text>
        <Text style={styles.subtitle}>Based on the data you entered</Text>
      </View>
      <Animated.View style={[styles.chartWrapper, { opacity: chartAnim }]}>
        <ComparisonChart />
      </Animated.View>
      <View style={styles.buttonContainer}>
        <Pressable onPress={handleContinue} style={({ pressed }) => [styles.continueButton, pressed && styles.continueButtonPressed]}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.sm },
  header: { marginBottom: Theme.spacing.xl },
  title: { fontFamily: Theme.fonts.extraBold, fontSize: 32, fontWeight: '800', color: Theme.colors.text.primary, letterSpacing: -0.5, marginBottom: Theme.spacing.sm },
  subtitle: { fontFamily: Theme.fonts.regular, fontSize: 16, color: Theme.colors.text.secondary },
  chartWrapper: { marginBottom: Theme.spacing.xl, marginHorizontal: 4 },
  chartCard: { backgroundColor: '#F8F9FB', borderRadius: Theme.borderRadius.xl, paddingVertical: Theme.spacing.lg, paddingHorizontal: Theme.spacing.md, paddingBottom: Theme.spacing.md },
  chartTitle: { fontFamily: Theme.fonts.bold, fontSize: 24, fontWeight: '700', fontStyle: 'italic', color: Theme.colors.text.primary, marginBottom: Theme.spacing.xs },
  xAxisLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 2 },
  xAxisLabel: { fontFamily: Theme.fonts.bold, fontSize: 15, fontWeight: '700', color: Theme.colors.text.primary },
  xAxisLabelRight: { color: Theme.colors.primary },
  statInsideCard: { marginTop: Theme.spacing.md },
  statText: { fontFamily: Theme.fonts.medium, fontSize: 18, color: Theme.colors.text.primary, textAlign: 'center', lineHeight: 28 },
  statHighlight: { fontFamily: Theme.fonts.bold, color: Theme.colors.primary, fontWeight: '700' },
  statHighlightBrand: { fontFamily: Theme.fonts.bold, color: Theme.colors.primary, fontWeight: '700', fontStyle: 'italic' },
  buttonContainer: { marginTop: 'auto', paddingVertical: Theme.spacing.md, borderTopWidth: 1, borderTopColor: Theme.colors.border, backgroundColor: Theme.colors.background, marginHorizontal: -Theme.spacing.lg, paddingHorizontal: Theme.spacing.lg },
  continueButton: { backgroundColor: Theme.colors.primary, borderRadius: Theme.borderRadius.lg, paddingVertical: Theme.spacing.md, alignItems: 'center', ...Theme.shadows.medium },
  continueButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  continueButtonText: { fontFamily: Theme.fonts.bold, color: Theme.colors.background, fontSize: 18, fontWeight: '700' },
});
