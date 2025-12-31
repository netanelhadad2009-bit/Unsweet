/**
 * Analytics Detail Screen
 *
 * Shows detailed breakdown and historical graph for a specific metric:
 * - money: Money saved over time
 * - calories: Calories avoided over time
 * - sugar: Sugar grams avoided over time
 * - life: Life time regained over time
 *
 * All data is fetched from the profiles table and calculated in real-time.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-gifted-charts';
import {
  Wallet,
  Flame,
  Candy,
  Heart,
  TrendingUp,
  Lightbulb,
  Calendar,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import {
  eachDayOfInterval,
  format,
  startOfDay,
  differenceInDays,
} from 'date-fns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Default values (same as Dashboard)
const DEFAULT_DAILY_CALORIES = 400;
const DEFAULT_DAILY_SUGAR_GRAMS = 100;
const DEFAULT_WEEKLY_SPEND = 30; // USD - typical weekly spend on sugary snacks in US
const LIFE_MINUTES_PER_DAY = 15;

// Metric configurations
const METRIC_CONFIG = {
  money: {
    title: 'Money Saved',
    icon: Wallet,
    color: '#10B981',
    colorLight: 'rgba(16, 185, 129, 0.1)',
    unit: '$',
    unitPosition: 'prefix' as const,
    facts: [
      'The average American spends $20-50 per week on sugary snacks and drinks.',
      'Cutting sugar can save you enough for a weekend getaway every month!',
      'Your savings could fund a gym membership or healthy cooking classes.',
      'In one year, you could save enough for a new wardrobe or tech gadget.',
    ],
  },
  calories: {
    title: 'Calories Avoided',
    icon: Flame,
    color: '#F97316',
    colorLight: 'rgba(249, 115, 22, 0.1)',
    unit: 'cal',
    unitPosition: 'suffix' as const,
    facts: [
      'The average sugary drink contains 150-200 empty calories.',
      '3,500 calories equals about 0.45kg of body weight.',
      'Avoiding 400 calories daily could lead to 3-4kg weight loss per month.',
      'Those "empty" calories provide zero nutritional value to your body.',
    ],
  },
  sugar: {
    title: 'Sugar Avoided',
    icon: Candy,
    color: '#EC4899',
    colorLight: 'rgba(236, 72, 153, 0.1)',
    unit: 'g',
    unitPosition: 'suffix' as const,
    facts: [
      'The WHO recommends less than 25g of added sugar per day.',
      'One can of soda contains about 39g of sugar - more than a full day\'s allowance!',
      'Excess sugar is linked to inflammation, aging skin, and energy crashes.',
      'Your taste buds reset after 2-3 weeks without added sugar.',
    ],
  },
  life: {
    title: 'Life Regained',
    icon: Heart,
    color: '#F43F5E',
    colorLight: 'rgba(244, 63, 94, 0.1)',
    unit: '',
    unitPosition: 'suffix' as const,
    facts: [
      'Reducing sugar intake is linked to lower risk of heart disease and diabetes.',
      'Studies show that cutting sugar can add years to your life expectancy.',
      'Your cells function better without constant sugar spikes.',
      'Lower inflammation means slower aging and better quality of life.',
    ],
  },
};

interface ProfileData {
  id: string;
  quit_date: string;
  created_at: string;
  weekly_spend: number;
  daily_sugar_grams: number;
  daily_calories: number;
  onboarding_data?: {
    weeklySpend?: number;
  } | null;
}

type MetricType = 'money' | 'calories' | 'sugar' | 'life';

interface ChartDataPoint {
  value: number;
  label: string;
  dataPointText?: string;
}

export default function AnalyticsDetailScreen() {
  const { type, title } = useLocalSearchParams<{ type: string; title?: string }>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const metricType = (type as MetricType) || 'money';
  const config = METRIC_CONFIG[metricType] || METRIC_CONFIG.money;
  const IconComponent = config.icon;

  // Fetch profile data with all tracking columns
  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        try {
          setLoading(true);
          const { data: { user } } = await supabase.auth.getUser();

          if (user) {
            const { data, error } = await supabase
              .from('profiles')
              .select('id, quit_date, created_at, weekly_spend, daily_sugar_grams, daily_calories, onboarding_data')
              .eq('id', user.id)
              .single();

            if (error) {
              // Silently handle profile fetch errors
            } else if (data) {
              // Apply defaults (same priority as Dashboard)
              const weeklySpend = data.weekly_spend ?? data.onboarding_data?.weeklySpend ?? DEFAULT_WEEKLY_SPEND;

              const profileData: ProfileData = {
                id: data.id,
                quit_date: data.quit_date || data.created_at,
                created_at: data.created_at,
                weekly_spend: weeklySpend,
                daily_sugar_grams: data.daily_sugar_grams ?? DEFAULT_DAILY_SUGAR_GRAMS,
                daily_calories: data.daily_calories ?? DEFAULT_DAILY_CALORIES,
                onboarding_data: data.onboarding_data,
              };
              setProfile(profileData);
            }
          }
        } catch (error) {
          // Silently handle profile fetch errors
        } finally {
          setLoading(false);
        }
      };

      fetchProfile();
    }, [])
  );

  // Get daily rate based on metric type
  const getDailyRate = useCallback((): number => {
    if (!profile) return 0;

    switch (metricType) {
      case 'money':
        return profile.weekly_spend / 7;
      case 'calories':
        return profile.daily_calories;
      case 'sugar':
        return profile.daily_sugar_grams;
      case 'life':
        return LIFE_MINUTES_PER_DAY;
      default:
        return 0;
    }
  }, [profile, metricType]);

  // Calculate full days elapsed (same as Dashboard)
  const daysElapsed = useMemo(() => {
    if (!profile?.quit_date) return 0;
    const quitDate = startOfDay(new Date(profile.quit_date));
    const today = startOfDay(new Date());
    const days = differenceInDays(today, quitDate);
    return Math.max(0, days);
  }, [profile]);

  // Calculate precise days (fractional, for today's running total)
  const preciseDaysElapsed = useMemo(() => {
    if (!profile?.quit_date) return 0;
    const quitDate = new Date(profile.quit_date);
    const now = new Date();
    const diffMs = now.getTime() - quitDate.getTime();
    if (diffMs < 0) return 0;
    return diffMs / (1000 * 60 * 60 * 24);
  }, [profile]);

  // Generate chart data using eachDayOfInterval
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!profile?.quit_date) return [];

    const quitDate = startOfDay(new Date(profile.quit_date));
    const today = startOfDay(new Date());

    // Handle same-day case
    if (quitDate >= today) {
      return [{
        value: 0,
        label: 'Start',
      }];
    }

    // Get all days from quit date to today
    const allDays = eachDayOfInterval({ start: quitDate, end: today });

    // Limit to last 30 days for chart readability
    const daysToShow = allDays.length > 30 ? allDays.slice(-30) : allDays;
    const startIndex = allDays.length - daysToShow.length;

    const dailyRate = getDailyRate();

    return daysToShow.map((date, index) => {
      // Calculate cumulative value up to this day
      const dayNumber = startIndex + index;
      const cumulativeValue = dailyRate * dayNumber;

      // Determine label (show first, last, and some middle points)
      let label = '';
      if (index === 0) {
        label = daysToShow.length > 7 ? format(date, 'd/M') : 'Start';
      } else if (index === daysToShow.length - 1) {
        label = 'Today';
      } else if (daysToShow.length <= 7) {
        label = format(date, 'EEE');
      } else if (index % Math.ceil(daysToShow.length / 5) === 0) {
        label = format(date, 'd/M');
      }

      return {
        value: cumulativeValue,
        label,
      };
    });
  }, [profile, getDailyRate]);

  // Get current total value (matches Dashboard exactly)
  const getCurrentValue = useCallback((): { value: number; formatted: string } => {
    const dailyRate = getDailyRate();
    // Use precise days for real-time total
    const rawValue = dailyRate * preciseDaysElapsed;

    switch (metricType) {
      case 'money':
        return {
          value: rawValue,
          formatted: `$${Math.floor(rawValue)}`,
        };
      case 'calories':
        const calories = Math.floor(rawValue);
        if (calories >= 1000) {
          return {
            value: rawValue,
            formatted: `${(calories / 1000).toFixed(1)}k`,
          };
        }
        return { value: rawValue, formatted: `${calories}` };
      case 'sugar':
        const grams = Math.floor(rawValue);
        if (grams >= 1000) {
          return {
            value: rawValue,
            formatted: `${(grams / 1000).toFixed(1)}kg`,
          };
        }
        return { value: rawValue, formatted: `${grams}g` };
      case 'life':
        const totalMinutes = Math.floor(rawValue);
        if (totalMinutes < 60) {
          return { value: rawValue, formatted: `${totalMinutes} Mins` };
        }
        const totalHours = totalMinutes / 60;
        if (totalHours < 24) {
          return { value: rawValue, formatted: `${totalHours.toFixed(1)} Hrs` };
        }
        const totalDays = totalHours / 24;
        return { value: rawValue, formatted: `${totalDays.toFixed(1)} Days` };
      default:
        return { value: 0, formatted: '0' };
    }
  }, [getDailyRate, preciseDaysElapsed, metricType]);

  // Get monthly projection
  const getMonthlyProjection = useCallback((): string => {
    const dailyRate = getDailyRate();
    const monthlyValue = dailyRate * 30;

    switch (metricType) {
      case 'money':
        return `$${Math.round(monthlyValue)}`;
      case 'calories':
        return `${(monthlyValue / 1000).toFixed(1)}k cal`;
      case 'sugar':
        return `${(monthlyValue / 1000).toFixed(1)}kg`;
      case 'life':
        const hours = monthlyValue / 60;
        return `${hours.toFixed(1)} Hrs`;
      default:
        return '0';
    }
  }, [getDailyRate, metricType]);

  // Get yearly projection
  const getYearlyProjection = useCallback((): string => {
    const dailyRate = getDailyRate();
    const yearlyValue = dailyRate * 365;

    switch (metricType) {
      case 'money':
        return `$${Math.round(yearlyValue).toLocaleString()}`;
      case 'calories':
        return `${(yearlyValue / 1000).toFixed(0)}k cal`;
      case 'sugar':
        return `${(yearlyValue / 1000).toFixed(1)}kg`;
      case 'life':
        const days = yearlyValue / 60 / 24;
        return `${days.toFixed(1)} Days`;
      default:
        return '0';
    }
  }, [getDailyRate, metricType]);

  // Get daily rate display text
  const getDailyRateDisplay = useCallback((): string => {
    const rate = getDailyRate();
    switch (metricType) {
      case 'money':
        return `$${rate.toFixed(1)}/day ($${profile?.weekly_spend || 0}/week)`;
      case 'calories':
        return `${Math.round(rate)} calories/day`;
      case 'sugar':
        return `${Math.round(rate)}g sugar/day`;
      case 'life':
        return `${rate} minutes/day`;
      default:
        return '';
    }
  }, [getDailyRate, profile, metricType]);

  // Get random fact (stable per session)
  const randomFact = useMemo(() => {
    const facts = config.facts;
    return facts[Math.floor(Math.random() * facts.length)];
  }, [config]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={config.color} />
        </View>
      </SafeAreaView>
    );
  }

  const currentValue = getCurrentValue();

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* Use passed title for instant display, fallback to config */}
      <Stack.Screen options={{ title: (title as string) || config.title }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={[styles.heroCard, { backgroundColor: config.colorLight }]}>
          <View style={[styles.heroIconContainer, { backgroundColor: config.color }]}>
            <IconComponent size={32} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text style={[styles.heroValue, { color: config.color }]}>
            {currentValue.formatted}
          </Text>
          <Text style={styles.heroLabel}>Total {config.title}</Text>
          <View style={styles.heroBadge}>
            <TrendingUp size={14} color={config.color} />
            <Text style={[styles.heroBadgeText, { color: config.color }]}>
              in {daysElapsed} {daysElapsed === 1 ? 'day' : 'days'}
            </Text>
          </View>
        </View>

        {/* Chart Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Calendar size={20} color={config.color} />
            <Text style={styles.sectionTitle}>Progress Over Time</Text>
          </View>

          <View style={styles.chartCard}>
            {chartData.length > 1 ? (
              <LineChart
                data={chartData}
                width={SCREEN_WIDTH - 80}
                height={200}
                spacing={chartData.length > 1 ? (SCREEN_WIDTH - 120) / Math.max(chartData.length - 1, 1) : 50}
                initialSpacing={20}
                endSpacing={20}
                color={config.color}
                thickness={3}
                hideDataPoints={chartData.length > 15}
                dataPointsColor={config.color}
                dataPointsRadius={4}
                startFillColor={config.colorLight}
                endFillColor={config.colorLight}
                startOpacity={0.4}
                endOpacity={0.1}
                areaChart
                curved
                yAxisTextStyle={{ color: '#8E8E93', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#8E8E93', fontSize: 10 }}
                hideRules
                hideYAxisText={false}
                yAxisColor="transparent"
                xAxisColor="#E5E5EA"
              />
            ) : (
              <View style={styles.emptyChart}>
                <IconComponent size={40} color="#8E8E93" />
                <Text style={styles.emptyChartText}>
                  Check back tomorrow for your progress chart!
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Projections Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={20} color={config.color} />
            <Text style={styles.sectionTitle}>Projections</Text>
          </View>

          <View style={styles.projectionsCard}>
            <View style={styles.projectionRow}>
              <View style={styles.projectionItem}>
                <Text style={styles.projectionLabel}>Monthly</Text>
                <Text style={[styles.projectionValue, { color: config.color }]}>
                  {getMonthlyProjection()}
                </Text>
              </View>
              <View style={styles.projectionDivider} />
              <View style={styles.projectionItem}>
                <Text style={styles.projectionLabel}>Yearly</Text>
                <Text style={[styles.projectionValue, { color: config.color }]}>
                  {getYearlyProjection()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Did You Know Card */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Lightbulb size={20} color="#F59E0B" />
            <Text style={styles.sectionTitle}>Did You Know?</Text>
          </View>

          <View style={styles.factCard}>
            <Text style={styles.factText}>{randomFact}</Text>
          </View>
        </View>

        {/* Daily Rate Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Your Daily Rate</Text>
          <Text style={styles.infoText}>{getDailyRateDisplay()}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
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
    paddingBottom: 40,
    paddingTop: 16,
  },

  // Hero Card
  heroCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroValue: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 4,
  },
  heroLabel: {
    fontSize: 16,
    color: '#3C3C43',
    fontWeight: '500',
    marginBottom: 12,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 20,
  },
  heroBadgeText: {
    fontSize: 14,
    fontWeight: '600',
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
    color: '#1C1C1E',
  },

  // Chart Card
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyChartText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },

  // Fact Card
  factCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 16,
    padding: 20,
  },
  factText: {
    fontSize: 15,
    color: '#3C3C43',
    lineHeight: 22,
  },

  // Projections Card
  projectionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  projectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectionItem: {
    flex: 1,
    alignItems: 'center',
  },
  projectionDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#E5E5EA',
  },
  projectionLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  projectionValue: {
    fontSize: 24,
    fontWeight: '700',
  },

  // Info Card
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
});
