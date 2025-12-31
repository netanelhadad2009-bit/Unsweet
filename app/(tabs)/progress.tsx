/**
 * Progress & Analytics Screen - Health Journey Edition
 *
 * Shows users their biological progress through:
 * - Statistics Tab: Health Timeline milestones, Weekly Meal Quality, Savings
 * - Feelings Tab: Mood Graph, Weekly Average, Log Entry
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
// SVG imports removed - unused in current implementation
import {
  TrendingUp,
  Wallet,
  Flame,
  Target,
  Heart,
  PenLine,
  BarChart3,
  Candy,
  Check,
  Lock,
  Zap,
  Moon,
  Sparkles,
  Battery,
  Brain,
  Activity,
  Clock,
  Award,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { startOfDay } from 'date-fns';
import { getLocalMeals } from '../../services/UserDataService';

// Key for check-in streak in AsyncStorage (same as in index.tsx)
const CHECKIN_STREAK_START_KEY = 'unsweet_checkin_streak_start';

// NOTE: Meals storage is now user-scoped via UserDataService

// Sugar level type
type SugarLevel = 'safe' | 'natural' | 'avoid';

// Meal log interface (matching journal.tsx)
interface MealLog {
  id: string;
  name: string;
  type: string;  // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  sugarLevel: SugarLevel;
  timestamp: number;
  scannedFrom?: string;
  imageUri?: string;
  verdict?: string;
  sugarContent?: string;
}

// Validate meal data integrity - filter out corrupted entries
const validateMealLog = (obj: any): obj is MealLog => {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.timestamp === 'number' &&
    ['safe', 'natural', 'avoid'].includes(obj.sugarLevel)
  );
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Light Theme Colors (Apple Health style)
const COLORS = {
  background: '#F2F2F7',
  cardBackground: '#FFFFFF',
  headingText: '#1C1C1E',
  bodyText: '#3C3C43',
  mutedText: '#8E8E93',
  primary: '#10B981',
  primaryLight: 'rgba(16, 185, 129, 0.1)',
  primaryMedium: 'rgba(16, 185, 129, 0.2)',
  danger: '#FF3B30',
  dangerLight: 'rgba(255, 59, 48, 0.15)',
  border: '#E5E5EA',
  segmentBg: '#E5E5EA',
  sugarColor: '#FF2D55',
  // Health timeline colors
  completed: '#10B981',
  completedLight: 'rgba(16, 185, 129, 0.15)',
  inProgress: '#F59E0B',
  inProgressLight: 'rgba(245, 158, 11, 0.15)',
  locked: '#9CA3AF',
  lockedLight: 'rgba(156, 163, 175, 0.1)',
};

// Health Milestones based on sugar-free journey
const HEALTH_MILESTONES = [
  {
    id: 'blood_sugar',
    title: 'Blood Sugar Stabilizes',
    description: 'Your blood glucose levels begin returning to normal range',
    hours: 24,
    icon: Activity,
    color: '#EF4444',
  },
  {
    id: 'cravings_peak',
    title: 'Cravings Peak & Drop',
    description: 'The worst cravings are behind you - your brain is adapting',
    hours: 72, // 3 days
    icon: Brain,
    color: '#8B5CF6',
  },
  {
    id: 'energy_boost',
    title: 'Energy Levels Increase',
    description: 'No more sugar crashes - steady energy throughout the day',
    hours: 168, // 7 days
    icon: Zap,
    color: '#F59E0B',
  },
  {
    id: 'sleep_quality',
    title: 'Sleep Quality Improves',
    description: 'Deeper, more restorative sleep cycles',
    hours: 336, // 14 days
    icon: Moon,
    color: '#6366F1',
  },
  {
    id: 'skin_clear',
    title: 'Skin Complexion Clears',
    description: 'Reduced inflammation leads to healthier, clearer skin',
    hours: 720, // 30 days
    icon: Sparkles,
    color: '#EC4899',
  },
  {
    id: 'immune_boost',
    title: 'Immune System Strengthens',
    description: 'Your body\'s defense mechanisms are significantly improved',
    hours: 1440, // 60 days
    icon: Heart,
    color: '#10B981',
  },
  {
    id: 'metabolism',
    title: 'Metabolism Optimized',
    description: 'Your body efficiently burns fat for fuel',
    hours: 2160, // 90 days
    icon: Battery,
    color: '#0EA5E9',
  },
];

// Mood emoji mapping
const MOOD_EMOJIS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😣', label: 'Terrible' },
  2: { emoji: '🙁', label: 'Bad' },
  3: { emoji: '😐', label: 'Okay' },
  4: { emoji: '🙂', label: 'Good' },
  5: { emoji: '🤩', label: 'Amazing' },
};

// Default values
const DEFAULT_WEEKLY_SPEND = 30; // USD - typical weekly spend on sugary snacks in US
const DEFAULT_DAILY_SUGAR = 100;

interface ProfileData {
  id: string;
  quit_date: string;
  created_at: string;
  weekly_spend: number | null;
  daily_sugar_grams: number | null;
  onboarding_data?: {
    weeklySpend?: number;
    weight?: number;
    goalWeight?: number;
  };
}

interface MoodLog {
  id: string;
  score: number;
  created_at: string;
}

type TabType = 'statistics' | 'feelings';

// Health Milestone Component
const HealthMilestone = ({
  milestone,
  elapsedHours,
  isLast,
}: {
  milestone: typeof HEALTH_MILESTONES[0];
  elapsedHours: number;
  isLast: boolean;
}) => {
  const progress = Math.min(1, elapsedHours / milestone.hours);
  const isCompleted = progress >= 1;
  const isInProgress = progress > 0 && progress < 1;
  const isLocked = progress === 0;

  const Icon = milestone.icon;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isInProgress) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
    return undefined;
  }, [isInProgress]);

  // Format remaining time
  const getRemainingTime = (): string => {
    const remainingHours = milestone.hours - elapsedHours;
    if (remainingHours <= 0) return '';
    if (remainingHours < 24) {
      return `${Math.ceil(remainingHours)}h left`;
    }
    const days = Math.ceil(remainingHours / 24);
    return `${days}d left`;
  };

  return (
    <View style={milestoneStyles.container}>
      {/* Timeline connector */}
      <View style={milestoneStyles.timelineColumn}>
        <Animated.View
          style={[
            milestoneStyles.iconCircle,
            isCompleted && { backgroundColor: COLORS.completedLight, borderColor: COLORS.completed },
            isInProgress && {
              backgroundColor: COLORS.inProgressLight,
              borderColor: COLORS.inProgress,
              transform: [{ scale: pulseAnim }],
            },
            isLocked && { backgroundColor: COLORS.lockedLight, borderColor: COLORS.locked },
          ]}
        >
          {isCompleted ? (
            <Check size={20} color={COLORS.completed} strokeWidth={3} />
          ) : isInProgress ? (
            <Icon size={20} color={COLORS.inProgress} />
          ) : (
            <Lock size={16} color={COLORS.locked} />
          )}
        </Animated.View>
        {!isLast && (
          <View
            style={[
              milestoneStyles.connector,
              isCompleted && { backgroundColor: COLORS.completed },
            ]}
          />
        )}
      </View>

      {/* Content */}
      <View style={[
        milestoneStyles.content,
        isCompleted && milestoneStyles.contentCompleted,
        isInProgress && milestoneStyles.contentInProgress,
      ]}>
        <View style={milestoneStyles.header}>
          <Text style={[
            milestoneStyles.title,
            isCompleted && milestoneStyles.titleCompleted,
            isLocked && milestoneStyles.titleLocked,
          ]}>
            {milestone.title}
          </Text>
          {isCompleted && (
            <View style={milestoneStyles.completedBadge}>
              <Text style={milestoneStyles.completedBadgeText}>Achieved!</Text>
            </View>
          )}
          {isInProgress && (
            <Text style={milestoneStyles.remainingText}>{getRemainingTime()}</Text>
          )}
        </View>

        <Text style={[
          milestoneStyles.description,
          isLocked && milestoneStyles.descriptionLocked,
        ]}>
          {milestone.description}
        </Text>

        {/* Progress bar for in-progress milestone */}
        {isInProgress && (
          <View style={milestoneStyles.progressContainer}>
            <View style={milestoneStyles.progressTrack}>
              <View
                style={[
                  milestoneStyles.progressFill,
                  { width: `${progress * 100}%` },
                ]}
              />
            </View>
            <Text style={milestoneStyles.progressText}>{Math.round(progress * 100)}%</Text>
          </View>
        )}

        {/* Time indicator */}
        <View style={milestoneStyles.timeRow}>
          <Clock size={12} color={COLORS.mutedText} />
          <Text style={milestoneStyles.timeText}>
            {milestone.hours < 24
              ? `${milestone.hours} hours`
              : `${Math.round(milestone.hours / 24)} days`}
          </Text>
        </View>
      </View>
    </View>
  );
};

const milestoneStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  timelineColumn: {
    alignItems: 'center',
    width: 50,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
    zIndex: 1,
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginTop: -4,
    marginBottom: -4,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginLeft: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contentCompleted: {
    borderColor: COLORS.completed,
    borderWidth: 1.5,
  },
  contentInProgress: {
    borderColor: COLORS.inProgress,
    borderWidth: 1.5,
    shadowColor: COLORS.inProgress,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.headingText,
    flex: 1,
  },
  titleCompleted: {
    color: COLORS.completed,
  },
  titleLocked: {
    color: COLORS.mutedText,
  },
  completedBadge: {
    backgroundColor: COLORS.completedLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.completed,
  },
  remainingText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.inProgress,
  },
  description: {
    fontSize: 14,
    color: COLORS.bodyText,
    lineHeight: 20,
    marginBottom: 12,
  },
  descriptionLocked: {
    color: COLORS.mutedText,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.inProgress,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.inProgress,
    minWidth: 35,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.mutedText,
  },
});

// Weekly Meal Quality Chart Component
interface DayMealData {
  date: Date;
  dayLabel: string;
  cleanCount: number;  // safe + natural
  avoidCount: number;  // avoid
}

const WeeklyMealQuality = ({ meals }: { meals: MealLog[] }) => {
  // Process last 7 days of data
  const getDayData = (): DayMealData[] => {
    const today = startOfDay(new Date());
    const days: DayMealData[] = [];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayStart = startOfDay(date).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const dayMeals = meals.filter(
        m => m.timestamp >= dayStart && m.timestamp < dayEnd
      );

      const cleanCount = dayMeals.filter(
        m => m.sugarLevel === 'safe' || m.sugarLevel === 'natural'
      ).length;
      const avoidCount = dayMeals.filter(m => m.sugarLevel === 'avoid').length;

      days.push({
        date,
        dayLabel: dayLabels[date.getDay()],
        cleanCount,
        avoidCount,
      });
    }

    return days;
  };

  const dayData = getDayData();
  const maxMeals = Math.max(
    5, // Minimum scale of 5
    ...dayData.map(d => Math.max(d.cleanCount, d.avoidCount))
  );

  // Calculate totals for summary
  const totalClean = dayData.reduce((sum, d) => sum + d.cleanCount, 0);
  const totalAvoid = dayData.reduce((sum, d) => sum + d.avoidCount, 0);
  const totalMeals = totalClean + totalAvoid;
  const cleanPercentage = totalMeals > 0 ? Math.round((totalClean / totalMeals) * 100) : 0;

  // Check if we have any data
  const hasData = totalMeals > 0;

  if (!hasData) {
    return (
      <View style={mealChartStyles.emptyContainer}>
        <BarChart3 size={40} color={COLORS.mutedText} />
        <Text style={mealChartStyles.emptyTitle}>No Meals Logged Yet</Text>
        <Text style={mealChartStyles.emptySubtext}>
          Start logging your meals to see your weekly analysis
        </Text>
      </View>
    );
  }

  return (
    <View style={mealChartStyles.container}>
      {/* Summary Stats */}
      <View style={mealChartStyles.summaryRow}>
        <View style={[mealChartStyles.summaryCard, { borderColor: COLORS.completed }]}>
          <Text style={[mealChartStyles.summaryValue, { color: COLORS.completed }]}>
            {totalClean}
          </Text>
          <Text style={mealChartStyles.summaryLabel}>Clean Meals</Text>
        </View>
        <View style={[mealChartStyles.summaryCard, { borderColor: COLORS.danger }]}>
          <Text style={[mealChartStyles.summaryValue, { color: COLORS.danger }]}>
            {totalAvoid}
          </Text>
          <Text style={mealChartStyles.summaryLabel}>Avoid Meals</Text>
        </View>
      </View>

      {/* Bar Chart */}
      <View style={mealChartStyles.chartContainer}>
        {dayData.map((day, index) => {
          const cleanHeight = day.cleanCount > 0
            ? Math.max(4, (day.cleanCount / maxMeals) * 120)
            : 2;
          const avoidHeight = day.avoidCount > 0
            ? Math.max(4, (day.avoidCount / maxMeals) * 120)
            : 2;
          const isToday = index === dayData.length - 1;

          return (
            <View key={index} style={mealChartStyles.dayColumn}>
              {/* Bars Container */}
              <View style={mealChartStyles.barsContainer}>
                {/* Clean Bar (Green) */}
                <View
                  style={[
                    mealChartStyles.bar,
                    mealChartStyles.cleanBar,
                    { height: cleanHeight },
                  ]}
                />
                {/* Avoid Bar (Red) */}
                <View
                  style={[
                    mealChartStyles.bar,
                    mealChartStyles.avoidBar,
                    { height: avoidHeight },
                  ]}
                />
              </View>
              {/* Day Label */}
              <Text style={[
                mealChartStyles.dayLabel,
                isToday && mealChartStyles.dayLabelToday,
              ]}>
                {day.dayLabel}
              </Text>
              {isToday && <View style={mealChartStyles.todayDot} />}
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={mealChartStyles.legendContainer}>
        <View style={mealChartStyles.legendItem}>
          <View style={[mealChartStyles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={mealChartStyles.legendText}>Clean (Safe/Natural)</Text>
        </View>
        <View style={mealChartStyles.legendItem}>
          <View style={[mealChartStyles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={mealChartStyles.legendText}>Limit (Avoid)</Text>
        </View>
      </View>

      {/* Clean Percentage */}
      <View style={mealChartStyles.percentageContainer}>
        <Award size={16} color={COLORS.completed} />
        <Text style={mealChartStyles.percentageText}>
          {cleanPercentage}% clean eating this week
        </Text>
      </View>
    </View>
  );
};

const mealChartStyles = StyleSheet.create({
  container: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.headingText,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.mutedText,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.mutedText,
    marginTop: 4,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    paddingTop: 20,
    marginBottom: 16,
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginBottom: 8,
  },
  bar: {
    width: 12,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 2,
  },
  cleanBar: {
    backgroundColor: '#10B981',
  },
  avoidBar: {
    backgroundColor: '#EF4444',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.mutedText,
  },
  dayLabelToday: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
    paddingTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.bodyText,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.completed,
  },
});

export default function ProgressScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('statistics');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [checkinStreakDays, setCheckinStreakDays] = useState<number>(0); // Days from check-in streak (consecutive app opens)

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Fetch profile with tracking columns
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, quit_date, created_at, weekly_spend, daily_sugar_grams, onboarding_data')
          .eq('id', user.id)
          .single();

        if (profileData) {
          setProfile(profileData);
        }

        // Fetch check-in streak from AsyncStorage (for "Days" stat)
        try {
          const checkinStart = await AsyncStorage.getItem(CHECKIN_STREAK_START_KEY);
          if (checkinStart) {
            const checkinDate = startOfDay(new Date(checkinStart));
            const today = startOfDay(new Date());
            const diffMs = today.getTime() - checkinDate.getTime();
            const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
            setCheckinStreakDays(days);
          } else if (profileData?.quit_date) {
            // Fallback to quit_date if check-in streak not initialized
            const quitDate = startOfDay(new Date(profileData.quit_date));
            const today = startOfDay(new Date());
            const diffMs = today.getTime() - quitDate.getTime();
            const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
            setCheckinStreakDays(days);
          }
        } catch (storageError) {
          // Silently handle storage errors
        }

        // Fetch meals from user-scoped storage
        try {
          const loadedMeals = await getLocalMeals(user.id);
          // Filter out corrupted entries, keep only valid meals
          const validMeals = loadedMeals.filter(validateMealLog);
          setMeals(validMeals);
        } catch (mealsError) {
          console.error('[Progress] Failed to load meals:', mealsError);
          // Silently handle corrupted data
          setMeals([]);
        }

        // Fetch mood logs (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: moodData } = await supabase
          .from('mood_logs')
          .select('id, score, created_at')
          .eq('user_id', user.id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: true });

        if (moodData) {
          setMoodLogs(moodData);
        }
      }
    } catch (error) {
      // Silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Handle tab switch
  const handleTabSwitch = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  // Calculate hours elapsed since quit_date
  const getElapsedHours = () => {
    if (!profile?.quit_date) return 0;
    const quitDate = new Date(profile.quit_date);
    const now = new Date();
    const diffMs = now.getTime() - quitDate.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
  };

  // Get precise fractional days elapsed (for metric calculations)
  // SAFETY: NaN guards for invalid dates
  const getPreciseDaysElapsed = () => {
    if (!profile?.quit_date) return 0;
    const quitDate = new Date(profile.quit_date);
    // Guard against invalid date parsing
    if (isNaN(quitDate.getTime())) return 0;
    const now = new Date();
    const diffMs = now.getTime() - quitDate.getTime();
    if (diffMs < 0 || isNaN(diffMs)) return 0;
    const days = diffMs / (1000 * 60 * 60 * 24);
    return isNaN(days) ? 0 : days;
  };

  // Get weekly spend with waterfall priority
  const getWeeklySpend = () => {
    if (profile?.weekly_spend !== null && profile?.weekly_spend !== undefined) {
      return profile.weekly_spend;
    }
    if (profile?.onboarding_data?.weeklySpend !== undefined) {
      return profile.onboarding_data.weeklySpend;
    }
    return DEFAULT_WEEKLY_SPEND;
  };

  // Calculate total savings
  // SAFETY: NaN guards for division and multiplication
  const getTotalSavings = () => {
    const weeklySpend = getWeeklySpend();
    const preciseDays = getPreciseDaysElapsed();
    if (isNaN(weeklySpend) || isNaN(preciseDays) || preciseDays === 0) {
      return '$0';
    }
    const dailySpend = weeklySpend / 7;
    const saved = dailySpend * preciseDays;

    if (isNaN(saved) || !isFinite(saved)) return '$0';
    if (saved >= 1) {
      return `$${Math.floor(saved)}`;
    }
    return `$${saved.toFixed(1)}`;
  };

  // Calculate annual projection
  // SAFETY: NaN guards for division
  const getAnnualProjection = () => {
    const weeklySpend = getWeeklySpend();
    if (isNaN(weeklySpend)) return '$0';
    const dailySpend = weeklySpend / 7;
    const yearly = Math.round(dailySpend * 365);
    if (isNaN(yearly) || !isFinite(yearly)) return '$0';
    return `$${yearly.toLocaleString()}`;
  };

  // Calculate sugar avoided
  // SAFETY: NaN guards for multiplication
  const getSugarAvoided = () => {
    const dailySugar = profile?.daily_sugar_grams ?? DEFAULT_DAILY_SUGAR;
    const preciseDays = getPreciseDaysElapsed();
    if (isNaN(dailySugar) || isNaN(preciseDays)) return '0g';
    const totalGrams = dailySugar * preciseDays;

    if (isNaN(totalGrams) || !isFinite(totalGrams)) return '0g';
    if (totalGrams >= 1000) {
      return `${(totalGrams / 1000).toFixed(1)}kg`;
    }
    if (totalGrams < 10) {
      return `${totalGrams.toFixed(1)}g`;
    }
    return `${Math.floor(totalGrams)}g`;
  };

  // Get mood data for last 7 days - memoized for performance
  const moodChartData = useMemo(() => {
    const last7Days: { date: string; value: number | null }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayLog = moodLogs.find(log => {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        return logDate === dateStr;
      });

      last7Days.push({
        date: dateStr,
        value: dayLog ? dayLog.score : null,
      });
    }

    const chartData = last7Days
      .filter(day => day.value !== null)
      .map((day, index, arr) => ({
        value: day.value as number,
        label: index === 0 || index === arr.length - 1
          ? new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })
          : '',
        dataPointText: '',
      }));

    return chartData;
  }, [moodLogs]);

  // Calculate weekly average mood - memoized for performance
  const weeklyAverage = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weekLogs = moodLogs.filter(log => new Date(log.created_at) >= sevenDaysAgo);
    if (weekLogs.length === 0) return null;

    const sum = weekLogs.reduce((acc, log) => acc + log.score, 0);
    const avg = sum / weekLogs.length;
    // Guard against NaN from division
    return isNaN(avg) ? null : avg;
  }, [moodLogs]);

  // Get logs count this week - memoized for performance
  const weeklyLogsCount = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return moodLogs.filter(log => new Date(log.created_at) >= sevenDaysAgo).length;
  }, [moodLogs]);

  // Get mood label from score
  const getMoodLabel = (score: number) => {
    const roundedScore = Math.round(score);
    return MOOD_EMOJIS[roundedScore] || MOOD_EMOJIS[3];
  };

  // Memoized calculations for derived values
  const elapsedHours = getElapsedHours();
  const totalSavings = getTotalSavings();
  const annualProjection = getAnnualProjection();
  const sugarAvoided = getSugarAvoided();
  // Note: moodChartData, weeklyAverage, weeklyLogsCount are already memoized above
  // Note: getDaysSugarFree is only needed internally by getElapsedHours

  // Count completed milestones
  const completedMilestones = HEALTH_MILESTONES.filter(m => elapsedHours >= m.hours).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Progress</Text>
          <Text style={styles.subtitle}>Your health transformation journey</Text>
        </View>

        {/* Segmented Control */}
        <View style={styles.segmentedControl}>
          <Pressable
            onPress={() => handleTabSwitch('statistics')}
            style={[
              styles.segmentButton,
              activeTab === 'statistics' && styles.segmentButtonActive,
            ]}
          >
            <BarChart3
              size={16}
              color={activeTab === 'statistics' ? COLORS.primary : COLORS.mutedText}
            />
            <Text
              style={[
                styles.segmentText,
                activeTab === 'statistics' && styles.segmentTextActive,
              ]}
            >
              Health
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleTabSwitch('feelings')}
            style={[
              styles.segmentButton,
              activeTab === 'feelings' && styles.segmentButtonActive,
            ]}
          >
            <Heart
              size={16}
              color={activeTab === 'feelings' ? COLORS.primary : COLORS.mutedText}
              fill={activeTab === 'feelings' ? COLORS.primary : 'transparent'}
            />
            <Text
              style={[
                styles.segmentText,
                activeTab === 'feelings' && styles.segmentTextActive,
              ]}
            >
              Feelings
            </Text>
          </Pressable>
        </View>

        {/* Statistics Tab Content */}
        {activeTab === 'statistics' && (
          <>
            {/* Stats Overview - 2x2 Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Flame size={20} color={COLORS.primary} />
                  <Text style={styles.statValue}>{checkinStreakDays}</Text>
                  <Text style={styles.statLabel}>Days</Text>
                </View>
                <View style={styles.statCard}>
                  <Wallet size={20} color={COLORS.primary} />
                  <Text style={styles.statValue}>{totalSavings}</Text>
                  <Text style={styles.statLabel}>Saved</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Candy size={20} color={COLORS.sugarColor} />
                  <Text style={styles.statValue}>{sugarAvoided}</Text>
                  <Text style={styles.statLabel}>Sugar Avoided</Text>
                </View>
                <View style={styles.statCard}>
                  <Target size={20} color={COLORS.primary} />
                  <Text style={styles.statValue}>{annualProjection}</Text>
                  <Text style={styles.statLabel}>Yearly</Text>
                </View>
              </View>
            </View>

            {/* Health Timeline */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Activity size={20} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Health Timeline</Text>
                <View style={styles.milestoneBadge}>
                  <Text style={styles.milestoneBadgeText}>
                    {completedMilestones}/{HEALTH_MILESTONES.length}
                  </Text>
                </View>
              </View>

              <View style={styles.timelineContainer}>
                {HEALTH_MILESTONES.map((milestone, index) => (
                  <HealthMilestone
                    key={milestone.id}
                    milestone={milestone}
                    elapsedHours={elapsedHours}
                    isLast={index === HEALTH_MILESTONES.length - 1}
                  />
                ))}
              </View>
            </View>

            {/* Weekly Meal Quality */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <BarChart3 size={20} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Weekly Analysis</Text>
              </View>

              <View style={styles.mealQualityCard}>
                <WeeklyMealQuality meals={meals} />
              </View>
            </View>

            {/* Savings Projection */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <TrendingUp size={20} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Savings Projection</Text>
              </View>

              <View style={styles.savingsCard}>
                <View style={styles.savingsRow}>
                  <View style={styles.savingsItem}>
                    <Text style={styles.savingsLabel}>Total Saved</Text>
                    <Text style={styles.savingsValue}>{totalSavings}</Text>
                  </View>
                  <View style={styles.savingsDivider} />
                  <View style={styles.savingsItem}>
                    <Text style={styles.savingsLabel}>Annual Projection</Text>
                    <Text style={styles.savingsValueLarge}>{annualProjection}</Text>
                  </View>
                </View>

                <View style={styles.savingsInfo}>
                  <Text style={styles.savingsInfoText}>
                    Based on your weekly spend of ${getWeeklySpend()}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Feelings Tab Content */}
        {activeTab === 'feelings' && (
          <>
            {/* Mood Summary Cards */}
            <View style={styles.moodStatsRow}>
              <View style={styles.moodStatCard}>
                <Text style={styles.moodStatLabel}>Weekly Average</Text>
                {weeklyAverage !== null ? (
                  <View style={styles.moodStatValueRow}>
                    <Text style={styles.moodStatEmoji}>
                      {getMoodLabel(weeklyAverage).emoji}
                    </Text>
                    <View>
                      <Text style={styles.moodStatValue}>
                        {weeklyAverage.toFixed(1)}
                      </Text>
                      <Text style={styles.moodStatValueLabel}>
                        {getMoodLabel(weeklyAverage).label}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.moodStatEmpty}>No data</Text>
                )}
              </View>
              <View style={styles.moodStatCard}>
                <Text style={styles.moodStatLabel}>This Week</Text>
                <View style={styles.moodStatValueRow}>
                  <Text style={styles.moodStatCountValue}>{weeklyLogsCount}</Text>
                  <Text style={styles.moodStatCountLabel}>
                    {weeklyLogsCount === 1 ? 'entry' : 'entries'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Mood Chart */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Heart size={20} color={COLORS.primary} fill={COLORS.primary} />
                <Text style={styles.sectionTitle}>Mood Trend</Text>
              </View>

              <View style={styles.moodChartCard}>
                {moodChartData.length >= 1 ? (
                  <View style={styles.moodChartContainer}>
                    {/* Emoji Y-axis labels */}
                    <View style={styles.emojiYAxis}>
                      {[5, 4, 3, 2, 1].map(score => (
                        <Text key={score} style={styles.emojiYAxisLabel}>
                          {MOOD_EMOJIS[score].emoji}
                        </Text>
                      ))}
                    </View>
                    <View style={styles.moodChartWrapper}>
                      {moodChartData.length === 1 ? (
                        // Single data point - show centered dot with value
                        <View style={styles.singlePointContainer}>
                          <Text style={styles.singlePointEmoji}>
                            {MOOD_EMOJIS[moodChartData[0].value]?.emoji || '😐'}
                          </Text>
                          <Text style={styles.singlePointLabel}>
                            Today's mood: {MOOD_EMOJIS[moodChartData[0].value]?.label || 'Okay'}
                          </Text>
                          <Text style={styles.singlePointHint}>
                            Log more to see your trend
                          </Text>
                        </View>
                      ) : (
                        <LineChart
                          data={moodChartData}
                          width={SCREEN_WIDTH - 120}
                          height={160}
                          spacing={(SCREEN_WIDTH - 160) / Math.max(1, moodChartData.length - 1)}
                          initialSpacing={10}
                          endSpacing={10}
                          color={COLORS.primary}
                          thickness={3}
                          hideDataPoints={false}
                          dataPointsColor={COLORS.primary}
                          dataPointsRadius={6}
                          startFillColor={COLORS.primaryLight}
                          endFillColor={COLORS.primaryLight}
                          startOpacity={0.4}
                          endOpacity={0.1}
                          areaChart
                          curved
                          yAxisTextStyle={{ color: COLORS.mutedText, fontSize: 11 }}
                          xAxisLabelTextStyle={{ color: COLORS.mutedText, fontSize: 10 }}
                          hideRules
                          hideYAxisText
                          yAxisColor="transparent"
                          xAxisColor={COLORS.border}
                          maxValue={5}
                          noOfSections={4}
                          yAxisOffset={1}
                        />
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyChart}>
                    <Heart size={32} color={COLORS.mutedText} />
                    <Text style={styles.emptyChartText}>No mood data yet</Text>
                    <Text style={styles.emptyChartSubtext}>
                      Log your mood daily to see trends
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Mood Legend */}
            <View style={styles.moodLegendCard}>
              <Text style={styles.moodLegendTitle}>Mood Scale</Text>
              <View style={styles.moodLegendGrid}>
                {[5, 4, 3, 2, 1].map(score => (
                  <View key={score} style={styles.moodLegendItem}>
                    <Text style={styles.moodLegendEmoji}>{MOOD_EMOJIS[score].emoji}</Text>
                    <Text style={styles.moodLegendLabel}>{MOOD_EMOJIS[score].label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Log Mood CTA */}
            <TouchableOpacity
              style={styles.logMoodButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({ pathname: '/mood-tracker', params: { title: 'Mood Tracker' } });
              }}
              activeOpacity={0.8}
            >
              <PenLine size={20} color="#FFFFFF" />
              <Text style={styles.logMoodButtonText}>Log How I Feel</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  // Header
  header: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.headingText,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.mutedText,
  },

  // Segmented Control
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: COLORS.segmentBg,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.cardBackground,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.mutedText,
  },
  segmentTextActive: {
    color: COLORS.primary,
  },

  // Stats Grid
  statsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.headingText,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.mutedText,
    fontWeight: '500',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.headingText,
    flex: 1,
  },
  milestoneBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  milestoneBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Timeline
  timelineContainer: {
    paddingTop: 8,
  },

  // Meal Quality Card
  mealQualityCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
  },

  // Savings
  savingsCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingsItem: {
    flex: 1,
    alignItems: 'center',
  },
  savingsDivider: {
    width: 1,
    height: 50,
    backgroundColor: COLORS.border,
  },
  savingsLabel: {
    fontSize: 13,
    color: COLORS.mutedText,
    marginBottom: 4,
  },
  savingsValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
  },
  savingsValueLarge: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.headingText,
  },
  savingsInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  savingsInfoText: {
    fontSize: 13,
    color: COLORS.mutedText,
  },

  // Mood Stats Row
  moodStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  moodStatCard: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
  },
  moodStatLabel: {
    fontSize: 13,
    color: COLORS.mutedText,
    marginBottom: 12,
  },
  moodStatValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moodStatEmoji: {
    fontSize: 36,
  },
  moodStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
  moodStatValueLabel: {
    fontSize: 13,
    color: COLORS.mutedText,
  },
  moodStatEmpty: {
    fontSize: 16,
    color: COLORS.mutedText,
  },
  moodStatCountValue: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.headingText,
  },
  moodStatCountLabel: {
    fontSize: 14,
    color: COLORS.mutedText,
    marginLeft: 6,
    alignSelf: 'flex-end',
    marginBottom: 6,
  },

  // Mood Chart
  moodChartCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
  },
  moodChartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiYAxis: {
    width: 30,
    justifyContent: 'space-between',
    height: 160,
    paddingVertical: 8,
  },
  emojiYAxisLabel: {
    fontSize: 16,
    textAlign: 'center',
  },
  moodChartWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyChartText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.headingText,
  },
  emptyChartSubtext: {
    fontSize: 14,
    color: COLORS.mutedText,
  },
  // Single data point display
  singlePointContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
    gap: 8,
  },
  singlePointEmoji: {
    fontSize: 48,
  },
  singlePointLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.headingText,
  },
  singlePointHint: {
    fontSize: 13,
    color: COLORS.mutedText,
    marginTop: 4,
  },

  // Mood Legend
  moodLegendCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  moodLegendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.headingText,
    marginBottom: 12,
    textAlign: 'center',
  },
  moodLegendGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  moodLegendItem: {
    alignItems: 'center',
    gap: 4,
  },
  moodLegendEmoji: {
    fontSize: 24,
  },
  moodLegendLabel: {
    fontSize: 11,
    color: COLORS.mutedText,
  },

  // Log Mood Button
  logMoodButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logMoodButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
