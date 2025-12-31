/**
 * Streak Details Screen - Premium Animated Version
 *
 * High-quality gamification center with:
 * - Animated flame with sway and pulse effects (using RN Animated)
 * - Weekly calendar with active/inactive day visualization
 * - Milestone progress tracking
 * - Share functionality
 */

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, Trophy, Share2, Target } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// Key for check-in streak in AsyncStorage (same as in index.tsx)
const CHECKIN_STREAK_START_KEY = 'unsweet_checkin_streak_start';
import { format, startOfWeek, addDays, isSameDay, isAfter, isBefore, startOfDay } from 'date-fns';
import Svg, { Path } from 'react-native-svg';

// Theme Colors - Light Mode with Orange/Fire Accents
const COLORS = {
  background: '#F9FAFB',
  cardBackground: '#FFFFFF',
  headingText: '#111827',
  bodyText: '#374151',
  mutedText: '#9CA3AF',
  border: '#E5E7EB',
  // Orange/Fire theme
  primary: '#F59E0B',
  primaryLight: 'rgba(245, 158, 11, 0.1)',
  primaryMedium: 'rgba(245, 158, 11, 0.2)',
  primaryDark: '#D97706',
  flame: '#F97316',
  flameGlow: 'rgba(249, 115, 22, 0.3)',
  // Progress
  progressTrack: '#E5E7EB',
  // Calendar
  dayInactive: '#D1D5DB',
  dayActive: '#F59E0B',
};

// Milestone definitions
const MILESTONES = [3, 7, 14, 21, 30, 60, 90, 100, 180, 365];

// Format duration as days for "Best Run" display on Day Streak page
const formatDurationAsDays = (ms: number): string => {
  if (ms <= 0) return '0 Days';

  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return '< 1 Day';
  }

  return days === 1 ? '1 Day' : `${days} Days`;
};

// Animated Flame Component using RN Animated API
const AnimatedFlame = ({ size = 100 }: { size?: number }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Subtle sway animation (reduced movement)
    const swayAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(rotation, {
          toValue: -1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotation, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Subtle pulse animation (reduced intensity)
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.02,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.99,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    swayAnimation.start();
    pulseAnimation.start();

    return () => {
      swayAnimation.stop();
      pulseAnimation.stop();
    };
  }, []);

  const rotationInterpolate = rotation.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-1deg', '1deg'],
  });

  return (
    <View style={[flameStyles.container, { width: size, height: size }]}>
      {/* Animated Flame SVG */}
      <Animated.View
        style={[
          flameStyles.flameWrapper,
          {
            transform: [
              { rotate: rotationInterpolate },
              { scale: scale },
            ],
          },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 128 128">
          {/* Main Flame */}
          <Path
            fill="#F59E0B"
            d="M98.59 51.16c-4.23.92-7.88 3.28-9.59 7.35c-1.03 2.47-2.47 8.85-6.42 7.2c-1.89-.78-1.86-3.49-1.64-5.18c.47-3.47 2.03-6.64 3.1-9.94c1.1-3.42 2.05-6.86 2.73-10.4c2.28-11.72 1.65-25.22-6.64-34.59C78.73 4 75.2.3 72.87.22c-1.44-.04-.02 1.66.38 2.23c.81 1.17 1.49 2.44 2.01 3.77c6.13 15.64-8.98 27.55-18.91 36.82c-4.76 4.45-8.56 9.17-11.98 14.68c-.34.53-1.09 2.31-2.06 1.94c-1.15-.44-1.27-3.07-1.63-4.05c-.68-1.88-1.73-3.93-3.08-5.4c-2.61-2.86-6.26-4.79-10.21-4.53c-.15.01-.58.08-1.11.2c-.83.18-3.05.47-2.45 1.81c.31.69 1.22.63 1.87.82c8.34 2.56 8.15 11.3 6.8 18.32c-2.44 12.78-9.2 24.86-4.4 38c5.66 15.49 23.38 25.16 39.46 22.5c4.39-.72 9.45-2.14 13.39-4.26c4.19-2.26 8.78-5.35 12.05-8.83c4.21-4.47 6.89-10.2 7.68-16.27c.93-7.02-1.31-13.64-3.35-20.27c-2.46-8-5.29-21.06 4.93-24.97c.5-.2 1.5-.35 1.85-.88c1.3-1.94-4.94-.81-5.52-.69"
          />
          {/* Inner Flame Highlight */}
          <Path
            fill="#FEF3C7"
            fillOpacity={0.6}
            d="M68.13 106.07c2.12 1.78 5.09.91 7.09-.61c1.07-.81 1.99-1.85 2.59-3.06c.25-.52.54-1.18.54-1.77c0-.79-.47-1.57-.27-2.38c1.68-.33 3.76 4.5 3.97 5.62c1.68 8.83-6.64 16.11-14.67 17.52c-13.55 2.37-21.34-9.5-19.78-20.04c.97-6.56 5.37-11.07 9.85-15.57c3.71-3.73 7.15-6.93 8.35-11.78c.21-.86.16-2.18-.09-3.03c-.21-.73-.61-1.4-.63-2.19c-.06-1.66 1.55.51 1.92.93c4.46 5.03 5.73 12.46 4.54 18.96c-.77 4.2-3.77 7.2-4.82 11.22c-.61 2.29-.55 4.52 1.41 6.18"
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

const flameStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Small Flame SVG for Day Circles
const SmallFlame = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 128 128">
    <Path
      fill="#FFFFFF"
      d="M98.59 51.16c-4.23.92-7.88 3.28-9.59 7.35c-1.03 2.47-2.47 8.85-6.42 7.2c-1.89-.78-1.86-3.49-1.64-5.18c.47-3.47 2.03-6.64 3.1-9.94c1.1-3.42 2.05-6.86 2.73-10.4c2.28-11.72 1.65-25.22-6.64-34.59C78.73 4 75.2.3 72.87.22c-1.44-.04-.02 1.66.38 2.23c.81 1.17 1.49 2.44 2.01 3.77c6.13 15.64-8.98 27.55-18.91 36.82c-4.76 4.45-8.56 9.17-11.98 14.68c-.34.53-1.09 2.31-2.06 1.94c-1.15-.44-1.27-3.07-1.63-4.05c-.68-1.88-1.73-3.93-3.08-5.4c-2.61-2.86-6.26-4.79-10.21-4.53c-.15.01-.58.08-1.11.2c-.83.18-3.05.47-2.45 1.81c.31.69 1.22.63 1.87.82c8.34 2.56 8.15 11.3 6.8 18.32c-2.44 12.78-9.2 24.86-4.4 38c5.66 15.49 23.38 25.16 39.46 22.5c4.39-.72 9.45-2.14 13.39-4.26c4.19-2.26 8.78-5.35 12.05-8.83c4.21-4.47 6.89-10.2 7.68-16.27c.93-7.02-1.31-13.64-3.35-20.27c-2.46-8-5.29-21.06 4.93-24.97c.5-.2 1.5-.35 1.85-.88c1.3-1.94-4.94-.81-5.52-.69"
    />
  </Svg>
);

// Day Circle Component for Calendar
const DayCircle = ({
  day,
  isActive,
  isToday,
  delay,
}: {
  day: { date: Date; label: string };
  isActive: boolean;
  isToday: boolean;
  delay: number;
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: delay,
        damping: 12,
        stiffness: 100,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        delay: delay,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.dayContainer,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Text style={styles.dayLabel}>{day.label}</Text>
      <View
        style={[
          styles.dayCircle,
          isActive && styles.dayCircleActive,
          isToday && styles.dayCircleToday,
        ]}
      >
        {isActive ? (
          <SmallFlame size={20} />
        ) : (
          <View style={styles.dayDot} />
        )}
      </View>
      <Text style={[styles.dayNumber, isActive && styles.dayNumberActive]}>
        {format(day.date, 'd')}
      </Text>
    </Animated.View>
  );
};

export default function StreakDetailsScreen() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ quit_date: string; created_at: string; longest_streak: number | null; longest_streak_ms: number | null } | null>(null);
  const [checkinStreakStart, setCheckinStreakStart] = useState<string | null>(null); // For calendar - separate from quit_date

  // Entry animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [loading]);

  // Fetch profile data and check-in streak
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch check-in streak from AsyncStorage (for calendar)
      try {
        const checkinStart = await AsyncStorage.getItem(CHECKIN_STREAK_START_KEY);
        if (checkinStart) {
          setCheckinStreakStart(checkinStart);
        }
      } catch (storageError) {
        // Silently handle AsyncStorage errors
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('quit_date, created_at, longest_streak, longest_streak_ms')
          .eq('id', user.id)
          .single();

        if (profileData) {
          setProfile(profileData);
        }
      }
    } catch (error) {
      // Silently handle profile fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Calculate current streak (days of consecutive app opens)
  // This uses the check-in streak (resets only after 24h inactivity)
  // NOT the sugar-free streak (quit_date) which resets on "I Relapsed"
  const getCurrentStreak = (): number => {
    // Use check-in streak from AsyncStorage (consecutive app opens)
    // Falls back to quit_date for users who haven't had the check-in streak initialized yet
    const streakDateStr = checkinStreakStart || profile?.quit_date;
    if (!streakDateStr) return 0;

    const streakStart = startOfDay(new Date(streakDateStr));
    const now = startOfDay(new Date());
    const diffMs = now.getTime() - streakStart.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  // Get current duration in milliseconds (precise)
  const getCurrentDurationMs = (): number => {
    if (!profile?.quit_date) return 0;
    const quitDate = new Date(profile.quit_date);
    const now = new Date();
    return Math.max(0, now.getTime() - quitDate.getTime());
  };

  // Get best streak in milliseconds (max of current vs database record)
  const getBestStreakMs = (): number => {
    const currentMs = getCurrentDurationMs();
    const dbLongestMs = profile?.longest_streak_ms ?? 0;
    return Math.max(currentMs, dbLongestMs);
  };

  // Find the next milestone
  const getNextMilestone = (currentStreak: number): number => {
    for (const milestone of MILESTONES) {
      if (milestone > currentStreak) {
        return milestone;
      }
    }
    return Math.ceil((currentStreak + 1) / 100) * 100;
  };

  // Find the previous milestone
  const getPreviousMilestone = (currentStreak: number): number => {
    let prev = 0;
    for (const milestone of MILESTONES) {
      if (milestone <= currentStreak) {
        prev = milestone;
      } else {
        break;
      }
    }
    return prev;
  };

  // Calculate progress percentage
  const getMilestoneProgress = (currentStreak: number): number => {
    const next = getNextMilestone(currentStreak);
    const prev = getPreviousMilestone(currentStreak);
    const range = next - prev;
    if (range === 0) return 100;
    const progress = ((currentStreak - prev) / range) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  // Get days remaining to next milestone
  const getDaysToNext = (currentStreak: number): number => {
    return getNextMilestone(currentStreak) - currentStreak;
  };

  // Generate week days for calendar - uses check-in streak (separate from main sugar-free streak)
  // The check-in streak tracks daily app opens and resets after 24h inactivity
  // The main sugar-free streak (quit_date) only resets when user reports a relapse
  const getWeekDays = () => {
    const today = startOfDay(new Date());
    // Use check-in streak start for calendar, NOT quit_date
    // This way the calendar only resets after 24h inactivity, not when user reports sugar consumption
    // Fallback to quit_date if check-in streak hasn't been initialized yet (for existing users)
    const streakDateStr = checkinStreakStart || profile?.quit_date || profile?.created_at;

    const checkinDate = streakDateStr ? startOfDay(new Date(streakDateStr)) : null;
    const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Sunday

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

      // Day is active if it's >= check-in streak start AND <= today
      const isActive =
        checkinDate &&
        !isBefore(date, checkinDate) &&
        !isAfter(date, today);

      days.push({
        date,
        label: dayLabels[i],
        isActive: !!isActive,
        isToday: isSameDay(date, today),
      });
    }
    return days;
  };

  // Handle share
  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const streak = getCurrentStreak();
    try {
      await Share.share({
        message: `I'm on a ${streak} day streak quitting sugar! 🔥 #Unsweet`,
      });
    } catch (error: any) {
      // Silently handle share errors
    }
  };

  // Format start date
  const getFormattedStartDate = (): string => {
    if (!profile?.quit_date) return '-';
    return format(new Date(profile.quit_date), 'MMM d, yyyy');
  };

  const currentStreak = getCurrentStreak();
  const nextMilestone = getNextMilestone(currentStreak);
  const milestoneProgress = getMilestoneProgress(currentStreak);
  const daysToNext = getDaysToNext(currentStreak);
  const weekDays = getWeekDays();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen
          options={{
            title: 'Streak Details',
            headerShown: true,
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerShadowVisible: false,
            headerTintColor: COLORS.headingText,
            headerBackTitleVisible: false,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading streak...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Streak Details',
          headerShown: true,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerShadowVisible: false,
          headerTintColor: COLORS.headingText,
          headerBackTitleVisible: false,
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <Animated.View
          style={[
            styles.heroCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Animated Flame */}
          <AnimatedFlame size={120} />

          {/* Streak Number */}
          <Text style={styles.heroStreakNumber}>{currentStreak}</Text>
          <Text style={styles.heroStreakLabel}>Day Streak</Text>

          {/* Badge */}
          {currentStreak >= 7 && (
            <View style={styles.heroBadge}>
              <Trophy size={14} color="#D97706" fill="#FCD34D" />
              <Text style={styles.heroBadgeText}>On Fire!</Text>
            </View>
          )}
        </Animated.View>

        {/* Meta Row */}
        <Animated.View
          style={[
            styles.metaRow,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.metaItem}>
            <Calendar size={16} color={COLORS.mutedText} />
            <Text style={styles.metaLabel}>Started</Text>
            <Text style={styles.metaValue}>{getFormattedStartDate()}</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Trophy size={16} color={COLORS.primary} fill={COLORS.primaryLight} />
            <Text style={styles.metaLabel}>Best Run</Text>
            <Text style={styles.metaValue}>
              {formatDurationAsDays(getBestStreakMs())}
            </Text>
          </View>
        </Animated.View>

        {/* Calendar Card */}
        <Animated.View
          style={[
            styles.calendarCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.cardTitle}>This Week</Text>
          <View style={styles.calendarRow}>
            {weekDays.map((day, index) => (
              <DayCircle
                key={index}
                day={day}
                isActive={day.isActive}
                isToday={day.isToday}
                delay={index * 50}
              />
            ))}
          </View>
        </Animated.View>

        {/* Milestone Card */}
        <Animated.View
          style={[
            styles.milestoneCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.milestoneHeader}>
            <Target size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Next Milestone</Text>
          </View>

          <View style={styles.milestoneTargetRow}>
            <Text style={styles.milestoneTargetNumber}>{nextMilestone}</Text>
            <Text style={styles.milestoneTargetLabel}>days</Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${milestoneProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(milestoneProgress)}%</Text>
          </View>

          <Text style={styles.daysToGo}>
            {daysToNext} {daysToNext === 1 ? 'day' : 'days'} to go
          </Text>
        </Animated.View>

        {/* Milestone Roadmap */}
        <Animated.View
          style={[
            styles.roadmapCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.cardTitle}>Milestones</Text>
          <View style={styles.roadmapRow}>
            {MILESTONES.slice(0, 6).map((milestone) => {
              const isCompleted = currentStreak >= milestone;
              const isNext = milestone === nextMilestone;

              return (
                <View key={milestone} style={styles.roadmapItem}>
                  <View
                    style={[
                      styles.roadmapCircle,
                      isCompleted && styles.roadmapCircleCompleted,
                      isNext && styles.roadmapCircleNext,
                    ]}
                  >
                    {isCompleted ? (
                      <SmallFlame size={14} />
                    ) : (
                      <Text
                        style={[
                          styles.roadmapNumber,
                          isNext && styles.roadmapNumberNext,
                        ]}
                      >
                        {milestone}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.roadmapLabel,
                      isCompleted && styles.roadmapLabelCompleted,
                      isNext && styles.roadmapLabelNext,
                    ]}
                  >
                    {milestone}d
                  </Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Share Button */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <Pressable
            style={({ pressed }) => [
              styles.shareButton,
              pressed && styles.shareButtonPressed,
            ]}
            onPress={handleShare}
          >
            <Share2 size={20} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.shareButtonText}>Share Your Streak</Text>
          </Pressable>
        </Animated.View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.mutedText,
  },

  // Hero Section
  heroCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroStreakNumber: {
    fontSize: 80,
    fontWeight: '800',
    color: COLORS.headingText,
    letterSpacing: -3,
    marginTop: 8,
  },
  heroStreakLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.mutedText,
    marginTop: -4,
    letterSpacing: 0.5,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryMedium,
  },
  heroBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },

  // Meta Row
  metaRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: COLORS.mutedText,
    fontWeight: '500',
    marginTop: 4,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.headingText,
  },
  metaDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },

  // Calendar Card
  calendarCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.headingText,
    marginBottom: 16,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayContainer: {
    alignItems: 'center',
    gap: 6,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mutedText,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.dayInactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: COLORS.dayActive,
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: COLORS.primaryDark,
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.mutedText,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.mutedText,
  },
  dayNumberActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Milestone Card
  milestoneCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  milestoneTargetRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  milestoneTargetNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -2,
  },
  milestoneTargetLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.mutedText,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  progressTrack: {
    flex: 1,
    height: 12,
    backgroundColor: COLORS.progressTrack,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    minWidth: 45,
  },
  daysToGo: {
    fontSize: 14,
    color: COLORS.mutedText,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Roadmap Card
  roadmapCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roadmapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roadmapItem: {
    alignItems: 'center',
    gap: 6,
  },
  roadmapCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.progressTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadmapCircleCompleted: {
    backgroundColor: COLORS.primary,
  },
  roadmapCircleNext: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  roadmapNumber: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.mutedText,
  },
  roadmapNumberNext: {
    color: COLORS.primary,
  },
  roadmapLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.mutedText,
  },
  roadmapLabelCompleted: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  roadmapLabelNext: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Share Button
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  shareButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  shareButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  bottomSpacer: {
    height: 20,
  },
});
