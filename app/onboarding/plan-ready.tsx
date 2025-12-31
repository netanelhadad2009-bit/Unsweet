import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  CheckCircle2,
  PiggyBank,
  Flame,
  Heart,
  Check,
  Calendar,
  ChevronLeft,
  Scale,
  TrendingDown,
} from 'lucide-react-native';
import { Theme } from '../../constants/Theme';
import { useOnboarding } from '../../contexts/OnboardingContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Brand colors for accents
const BRAND_PURPLE = '#8B5CF6';
const ACCENT_LIGHT = 'rgba(0, 200, 151, 0.12)';

// Calculate target date (21 days from now)
const getTargetDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 21);
  return date;
};

const formatDate = (date: Date) => {
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
};

// Animated bar chart component showing declining sugar dependency
function SugarDependencyChart() {
  const barAnimations = useRef([...Array(7)].map(() => new Animated.Value(0))).current;

  // Bar heights representing declining dependency (percentage of max height)
  const barHeights = [100, 85, 70, 55, 40, 25, 10];
  const BAR_MAX_HEIGHT = 120;
  const BAR_WIDTH = (SCREEN_WIDTH - 120) / 7 - 8;

  useEffect(() => {
    // Animate bars sequentially
    const animations = barAnimations.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      })
    );
    Animated.stagger(100, animations).start();
  }, []);

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartBars}>
        {barHeights.map((height, index) => {
          const barHeight = (height / 100) * BAR_MAX_HEIGHT;
          const isLast = index === barHeights.length - 1;

          return (
            <Animated.View
              key={index}
              style={[
                styles.barWrapper,
                {
                  opacity: barAnimations[index],
                  transform: [{
                    translateY: barAnimations[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  }],
                },
              ]}
            >
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    width: BAR_WIDTH,
                    backgroundColor: isLast ? Theme.colors.primary : BRAND_PURPLE,
                  },
                ]}
              />
              {isLast && (
                <View style={styles.barLabel}>
                  <Text style={styles.barLabelText}>0%</Text>
                </View>
              )}
            </Animated.View>
          );
        })}
      </View>
      <View style={styles.chartXAxis}>
        <Text style={styles.chartAxisLabel}>Week 1</Text>
        <Text style={styles.chartAxisLabel}>Week 3</Text>
      </View>
    </View>
  );
}

// Impact stat card component
function ImpactCard({ icon: Icon, value, label, delay }: {
  icon: any;
  value: string;
  label: string;
  delay: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.impactCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.impactIconContainer}>
        <Icon size={24} color={Theme.colors.primary} strokeWidth={2} />
      </View>
      <Text style={styles.impactValue}>{value}</Text>
      <Text style={styles.impactLabel}>{label}</Text>
    </Animated.View>
  );
}

// Checklist item component
function ChecklistItem({ text, delay }: { text: string; delay: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.checklistItem, { opacity: fadeAnim }]}>
      <View style={styles.checklistIcon}>
        <Check size={16} color={Theme.colors.primary} strokeWidth={3} />
      </View>
      <Text style={styles.checklistText}>{text}</Text>
    </Animated.View>
  );
}

export default function PlanReadyScreen() {
  const router = useRouter();
  const { onboardingData, clearOnboardingData } = useOnboarding();

  const celebrationAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const targetDate = getTargetDate();

  // Calculate personalized stats based on onboarding data
  // Weekly spending options: 'range_0_10', 'range_10_30', 'range_30_50', 'range_50_plus'
  const weeklySpending = onboardingData.weekly_spending || 'range_30_50';
  const weeklyAmount = weeklySpending === 'range_0_10' ? 5 :
                       weeklySpending === 'range_10_30' ? 20 :
                       weeklySpending === 'range_30_50' ? 40 :
                       weeklySpending === 'range_50_plus' ? 60 : 30;
  const monthlySavings = Math.round(weeklyAmount * 4); // Weekly × 4 weeks

  // Calculate projected weight loss based on sugar consumption frequency
  // Frequency options: 'every_day', 'few_times_week', 'weekends', 'when_stressed'
  // Typical weight loss: 2-4 kg over 3 weeks when cutting sugar
  const currentWeight = onboardingData.weight || 70;
  const sugarFrequency = onboardingData.sugar_frequency || 'few_times_week';
  const weightLossKg = sugarFrequency === 'every_day' ? 3.5 :
                       sugarFrequency === 'few_times_week' ? 2.5 :
                       sugarFrequency === 'weekends' ? 2 :
                       sugarFrequency === 'when_stressed' ? 1.5 : 2;
  const projectedWeight = Math.round(currentWeight - weightLossKg);
  const useImperial = onboardingData.useImperial || false;

  useEffect(() => {
    // Celebration animation
    Animated.parallel([
      Animated.timing(celebrationAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGetStarted = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Clear onboarding data now that we're done displaying it
    clearOnboardingData();
    // Navigate to paywall - user must subscribe to access the app
    router.replace('/paywall');
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Clear onboarding data and go to welcome page
    clearOnboardingData();
    router.replace('/');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Navigation Header */}
        <View style={styles.navBar}>
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
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '100%' }]} />
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section A: Celebration Header */}
          <Animated.View
            style={[
              styles.celebrationSection,
              {
                opacity: celebrationAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.checkIconContainer}>
              <CheckCircle2 size={72} color={Theme.colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.congratsTitle}>Congratulations!</Text>
            <Text style={styles.congratsSubtitle}>
              Your custom sugar-detox plan is ready.
            </Text>
          </Animated.View>

          {/* Section B: Weight Projection Card */}
          <View style={styles.weightCard}>
            <View style={styles.weightCardHeader}>
              <View style={styles.weightIconContainer}>
                <Scale size={28} color={Theme.colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.weightCardTitle}>Your Weight Goal</Text>
            </View>
            <View style={styles.weightProjection}>
              <View style={styles.weightColumn}>
                <Text style={styles.weightLabel}>Now</Text>
                <Text style={styles.weightValueCurrent}>
                  {currentWeight}{useImperial ? ' lbs' : ' kg'}
                </Text>
              </View>
              <View style={styles.weightArrow}>
                <TrendingDown size={32} color={Theme.colors.primary} strokeWidth={2.5} />
              </View>
              <View style={styles.weightColumn}>
                <Text style={styles.weightLabel}>In 21 Days</Text>
                <Text style={styles.weightValueTarget}>
                  {projectedWeight}{useImperial ? ' lbs' : ' kg'}
                </Text>
              </View>
            </View>
            <View style={styles.weightLossBadge}>
              <Text style={styles.weightLossText}>
                -{weightLossKg} {useImperial ? 'lbs' : 'kg'} projected
              </Text>
            </View>
          </View>

          {/* Section C: Timeline Card */}
          <View style={styles.timelineCard}>
            <View style={styles.timelineHeader}>
              <Calendar size={20} color={Theme.colors.text.secondary} strokeWidth={2} />
              <Text style={styles.timelineLabel}>Sugar Free By:</Text>
            </View>
            <Text style={styles.targetDate}>{formatDate(targetDate)}</Text>

            <View style={styles.chartSection}>
              <Text style={styles.chartLabel}>Projected Sugar Dependency</Text>
              <SugarDependencyChart />
            </View>
          </View>

          {/* Section C: Projected Impact */}
          <View style={styles.impactSection}>
            <Text style={styles.sectionTitle}>Your Projected Impact</Text>
            <View style={styles.impactCardsRow}>
              <ImpactCard
                icon={PiggyBank}
                value={`$${monthlySavings}`}
                label="Saved/Month"
                delay={200}
              />
              <ImpactCard
                icon={Flame}
                value="12,000"
                label="Calories Saved"
                delay={350}
              />
              <ImpactCard
                icon={Heart}
                value="+40%"
                label="Energy Boost"
                delay={500}
              />
            </View>
          </View>

          {/* Section D: Daily Routine Preview */}
          <View style={styles.routineSection}>
            <Text style={styles.sectionTitle}>How you'll reach your goal:</Text>
            <View style={styles.checklistContainer}>
              <ChecklistItem
                text="Follow your daily sugar budget."
                delay={600}
              />
              <ChecklistItem
                text="Log meals to identify hidden triggers."
                delay={750}
              />
              <ChecklistItem
                text="Use the SOS button for cravings."
                delay={900}
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer CTA */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && styles.ctaButtonPressed,
            ]}
            onPress={handleGetStarted}
          >
            <Text style={styles.ctaButtonText}>Let's Get Started!</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },

  // Navigation
  navBar: {
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
  progressContainer: {
    flex: 1,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.full,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
  },

  // Section A: Celebration
  celebrationSection: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
  },
  checkIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: ACCENT_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  congratsTitle: {
    fontFamily: Theme.fonts.extraBold,
    fontSize: 32,
    fontWeight: '800',
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  congratsSubtitle: {
    fontFamily: Theme.fonts.regular,
    fontSize: 16,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
  },

  // Section B: Weight Projection Card
  weightCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
  },
  weightCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  weightIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ACCENT_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weightCardTitle: {
    fontFamily: Theme.fonts.bold,
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.text.primary,
  },
  weightProjection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  weightColumn: {
    alignItems: 'center',
    flex: 1,
  },
  weightLabel: {
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
    color: Theme.colors.text.muted,
    marginBottom: Theme.spacing.xs,
  },
  weightValueCurrent: {
    fontFamily: Theme.fonts.extraBold,
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.text.primary,
  },
  weightValueTarget: {
    fontFamily: Theme.fonts.extraBold,
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.primary,
  },
  weightArrow: {
    paddingHorizontal: Theme.spacing.md,
  },
  weightLossBadge: {
    backgroundColor: ACCENT_LIGHT,
    borderRadius: Theme.borderRadius.full,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    alignSelf: 'center',
  },
  weightLossText: {
    fontFamily: Theme.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.primary,
  },

  // Section C: Timeline Card
  timelineCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.xs,
  },
  timelineLabel: {
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    color: Theme.colors.text.secondary,
  },
  targetDate: {
    fontFamily: Theme.fonts.extraBold,
    fontSize: 28,
    fontWeight: '800',
    color: BRAND_PURPLE,
    marginBottom: Theme.spacing.lg,
  },
  chartSection: {
    marginTop: Theme.spacing.sm,
  },
  chartLabel: {
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
    color: Theme.colors.text.muted,
    marginBottom: Theme.spacing.md,
  },

  // Chart
  chartContainer: {
    paddingTop: Theme.spacing.sm,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingHorizontal: Theme.spacing.sm,
  },
  barWrapper: {
    alignItems: 'center',
  },
  bar: {
    borderRadius: 4,
  },
  barLabel: {
    marginTop: 4,
  },
  barLabelText: {
    fontFamily: Theme.fonts.bold,
    fontSize: 12,
    color: Theme.colors.primary,
  },
  chartXAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  chartAxisLabel: {
    fontFamily: Theme.fonts.regular,
    fontSize: 12,
    color: Theme.colors.text.muted,
  },

  // Section C: Impact
  impactSection: {
    marginBottom: Theme.spacing.lg,
  },
  sectionTitle: {
    fontFamily: Theme.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
  },
  impactCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  impactCard: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    alignItems: 'center',
  },
  impactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ACCENT_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  impactValue: {
    fontFamily: Theme.fonts.extraBold,
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  impactLabel: {
    fontFamily: Theme.fonts.regular,
    fontSize: 11,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
  },

  // Section D: Routine
  routineSection: {
    marginBottom: Theme.spacing.lg,
  },
  checklistContainer: {
    gap: Theme.spacing.md,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  checklistIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checklistText: {
    flex: 1,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
    color: Theme.colors.text.primary,
  },

  // Footer
  footer: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    backgroundColor: Theme.colors.background,
  },
  ctaButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.md + 2,
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  ctaButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  ctaButtonText: {
    fontFamily: Theme.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
