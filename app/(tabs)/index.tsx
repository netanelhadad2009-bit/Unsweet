/**
 * Home Dashboard Screen
 *
 * Motivational dashboard tracking user's sugar-free journey in real-time.
 * Features a Duolingo-style progress ring that fills over 24 hours.
 * Includes manual timer control (reset streak on relapse).
 * NEW: Week calendar strip for time-travel to view past days.
 */

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import {
  Wallet,
  Flame,
  Smile,
  Activity,
  ChevronRight,
  Zap,
  Heart,
  Sparkles,
  Brain,
  X,
  RotateCcw,
  AlertTriangle,
  Trophy,
  Candy,
  Calendar,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import {
  format,
  isSameDay,
  isBefore,
  differenceInDays,
  startOfDay,
  endOfDay,
  subDays,
} from 'date-fns';

// Light Theme Colors (Apple Health style)
const COLORS = {
  background: '#F2F2F7',
  cardBackground: '#FFFFFF',
  headingText: '#1C1C1E',
  bodyText: '#3C3C43',
  mutedText: '#8E8E93',
  primary: '#10B981',
  primaryLight: 'rgba(16, 185, 129, 0.1)',
  primaryGlow: 'rgba(16, 185, 129, 0.15)',
  border: '#E5E5EA',
  progressTrack: '#E5E7EB',
  ringBackground: '#F3F4F6',
  danger: '#FF3B30',
  dangerLight: 'rgba(255, 59, 48, 0.1)',
  // Accent colors for gains cards
  walletColor: '#10B981',
  flameColor: '#FF6B35',
  sugarColor: '#FF2D55',
  lifeColor: '#FF2D55',
  moodColor: '#5856D6',
  // Trophy/Best streak color
  goldColor: '#FFB800',
  goldLight: 'rgba(255, 184, 0, 0.15)',
  // Calendar colors
  calendarInactive: '#E5E5EA',
  calendarText: '#3C3C43',
};

// Small Flame SVG Component (matches streak-details page)
const SmallFlame = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 128 128">
    <Path
      fill="#F59E0B"
      d="M98.59 51.16c-4.23.92-7.88 3.28-9.59 7.35c-1.03 2.47-2.47 8.85-6.42 7.2c-1.89-.78-1.86-3.49-1.64-5.18c.47-3.47 2.03-6.64 3.1-9.94c1.1-3.42 2.05-6.86 2.73-10.4c2.28-11.72 1.65-25.22-6.64-34.59C78.73 4 75.2.3 72.87.22c-1.44-.04-.02 1.66.38 2.23c.81 1.17 1.49 2.44 2.01 3.77c6.13 15.64-8.98 27.55-18.91 36.82c-4.76 4.45-8.56 9.17-11.98 14.68c-.34.53-1.09 2.31-2.06 1.94c-1.15-.44-1.27-3.07-1.63-4.05c-.68-1.88-1.73-3.93-3.08-5.4c-2.61-2.86-6.26-4.79-10.21-4.53c-.15.01-.58.08-1.11.2c-.83.18-3.05.47-2.45 1.81c.31.69 1.22.63 1.87.82c8.34 2.56 8.15 11.3 6.8 18.32c-2.44 12.78-9.2 24.86-4.4 38c5.66 15.49 23.38 25.16 39.46 22.5c4.39-.72 9.45-2.14 13.39-4.26c4.19-2.26 8.78-5.35 12.05-8.83c4.21-4.47 6.89-10.2 7.68-16.27c.93-7.02-1.31-13.64-3.35-20.27c-2.46-8-5.29-21.06 4.93-24.97c.5-.2 1.5-.35 1.85-.88c1.3-1.94-4.94-.81-5.52-.69"
    />
  </Svg>
);

// Recovery stages with biological milestones
const RECOVERY_STAGES = [
  {
    id: 'blood_pressure',
    title: 'Blood Pressure Normalizing',
    description: 'Your blood pressure and heart rate are returning to healthier levels.',
    durationMinutes: 20,
    icon: Heart,
    color: '#FF3B30',
  },
  {
    id: 'insulin_drop',
    title: 'Insulin Levels Dropping',
    description: 'Your body is starting to regulate insulin more efficiently.',
    durationMinutes: 60 * 24, // 24 hours
    icon: Zap,
    color: '#FF9500',
  },
  {
    id: 'cravings_peak',
    title: 'Cravings Peak Over',
    description: 'The worst sugar cravings are behind you. Your brain is adapting.',
    durationMinutes: 60 * 24 * 3, // 3 days
    icon: Brain,
    color: '#AF52DE',
  },
  {
    id: 'skin_improvement',
    title: 'Skin Appearance Improving',
    description: 'Reduced inflammation is helping your skin look clearer and healthier.',
    durationMinutes: 60 * 24 * 7, // 1 week
    icon: Sparkles,
    color: '#5856D6',
  },
  {
    id: 'energy_stable',
    title: 'Energy Levels Stable',
    description: 'No more sugar crashes. Your energy is consistent throughout the day.',
    durationMinutes: 60 * 24 * 14, // 2 weeks
    icon: Activity,
    color: '#34C759',
  },
  {
    id: 'taste_reset',
    title: 'Taste Buds Reset',
    description: 'Natural foods taste sweeter. Your palate has been recalibrated.',
    durationMinutes: 60 * 24 * 30, // 1 month
    icon: Smile,
    color: '#FF2D55',
  },
];

// Default values (used if database columns don't exist yet)
const DEFAULT_DAILY_CALORIES = 400;
const DEFAULT_DAILY_SUGAR_GRAMS = 100;
const DEFAULT_WEEKLY_SPEND = 30; // USD - typical weekly spend on sugary snacks in US
const LIFE_MINUTES_PER_DAY = 15; // Minutes of life regained per sugar-free day

// 24-hour inactivity check for check-in streak (calendar sequence)
// This is SEPARATE from the main sugar-free streak (quit_date)
// IMPORTANT: These keys are user-scoped via STREAK_USER_KEY to prevent cross-user contamination
const LAST_ACTIVITY_KEY = 'unsweet_last_activity';
const CHECKIN_STREAK_START_KEY = 'unsweet_checkin_streak_start'; // When current check-in sequence started
const CHECKIN_STREAK_VERSION_KEY = 'unsweet_checkin_streak_version'; // Migration version
const STREAK_USER_KEY = 'unsweet_streak_user_id'; // Tracks which user owns the streak data
const CURRENT_CHECKIN_VERSION = '3'; // Increment this to trigger re-initialization (was 2, now 3 for user-scoping fix)
const INACTIVITY_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Streak celebration tracking - show celebration only once per day when streak increases
const STREAK_CELEBRATION_DATE_KEY = 'unsweet_streak_celebration_date';
const STREAK_CELEBRATION_COUNT_KEY = 'unsweet_streak_celebration_count';

// Mood options for display
const MOOD_OPTIONS = [
  { score: 1, emoji: '😣', label: 'Terrible' },
  { score: 2, emoji: '🙁', label: 'Bad' },
  { score: 3, emoji: '😐', label: 'Okay' },
  { score: 4, emoji: '🙂', label: 'Good' },
  { score: 5, emoji: '🤩', label: 'Amazing' },
];

// Format duration precisely (e.g., "5d 12h", "14h 30m") for Best Run and countdown
const formatDurationPrecise = (ms: number): string => {
  if (ms <= 0) return '0m';

  const totalMinutes = Math.floor(ms / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
};

// Circular Progress Ring Component
interface CircularProgressProps {
  size: number;
  strokeWidth: number;
  progress: number; // 0 to 1
  children?: React.ReactNode;
}

function CircularProgress({ size, strokeWidth, progress, children }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#10B981" />
            <Stop offset="100%" stopColor="#34D399" />
          </LinearGradient>
        </Defs>
        {/* Background Ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.ringBackground}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress Ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {/* Center Content */}
      <View style={styles.ringCenter}>
        {children}
      </View>
    </View>
  );
}

// Week Calendar Strip Component
interface WeekCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

function WeekCalendar({ selectedDate, onSelectDate }: WeekCalendarProps) {
  // Generate last 7 days (today at the end)
  // Note: Computed fresh each render to handle midnight transitions correctly
  const today = startOfDay(new Date());
  const dates = Array.from({ length: 7 }, (_, i) => {
    return subDays(new Date(), 6 - i);
  });

  const handleDatePress = (date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectDate(date);
  };

  return (
    <View style={styles.weekCalendar}>
      {dates.map((date, index) => {
        const isSelected = isSameDay(date, selectedDate);
        const isToday = isSameDay(date, today);
        const isPast = isBefore(startOfDay(date), today);
        const dayName = format(date, 'EEE');
        const dayNum = format(date, 'd');

        return (
          <Pressable
            key={index}
            onPress={() => handleDatePress(date)}
            style={[
              styles.calendarDay,
              isSelected && styles.calendarDaySelected,
            ]}
          >
            <Text style={[
              styles.calendarDayName,
              isSelected && styles.calendarDayNameSelected,
            ]}>
              {dayName}
            </Text>
            <View style={[
              styles.calendarDayNumCircle,
              isPast && !isSelected && styles.calendarDayNumCirclePast,
              !isPast && !isSelected && styles.calendarDayNumCircleFuture,
              isSelected && styles.calendarDayNumCircleSelected,
            ]}>
              <Text style={[
                styles.calendarDayNum,
                isSelected && styles.calendarDayNumSelected,
                isToday && !isSelected && styles.calendarDayNumToday,
              ]}>
                {dayNum}
              </Text>
            </View>
            {isToday && (
              <View style={[
                styles.calendarTodayDot,
                isSelected && styles.calendarTodayDotSelected,
              ]} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

interface ProfileData {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  quit_date: string; // When user started their sugar-free journey
  // Tracking columns with defaults
  weekly_spend: number; // Weekly spend on sweets (default 100)
  daily_sugar_grams: number; // Daily sugar intake in grams (default 100)
  daily_calories: number; // Daily calories from sugar (default 400)
  longest_streak: number | null; // Best streak ever achieved (days - legacy)
  longest_streak_ms: number | null; // Best streak in milliseconds (precise)
  // Legacy onboarding data (may contain additional info)
  onboarding_data: {
    weeklySpend?: number;
    gender?: string;
  } | null;
}

interface ElapsedTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMinutes: number;
  totalSeconds: number;
}

export default function DashboardScreen() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState<ElapsedTime>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalMinutes: 0,
    totalSeconds: 0,
  });
  const [latestMood, setLatestMood] = useState<{ score: number; emoji: string; label: string } | null>(null);
  const [checkinStreakDays, setCheckinStreakDays] = useState<number>(0); // Days from check-in streak (consecutive app opens)
  const [, setLongestHistoricalStreak] = useState<number>(0); // Longest streak from streak_history table
  const hasInitiallyLoaded = useRef(false);
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Streak management modal state
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Streak celebration modal state
  const [celebrationModalVisible, setCelebrationModalVisible] = useState(false);
  const [celebrationStreakCount, setCelebrationStreakCount] = useState(0);

  // Check if selected date is today
  const isToday = useMemo(() => isSameDay(selectedDate, new Date()), [selectedDate]);

  // Fetch profile data with all tracking columns
  const fetchProfile = useCallback(async () => {
    try {
      if (!hasInitiallyLoaded.current) {
        setLoading(true);
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Fetch all tracking columns
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, created_at, quit_date, weekly_spend, daily_sugar_grams, daily_calories, longest_streak, longest_streak_ms, onboarding_data')
          .eq('id', user.id)
          .single();

        if (error) {
          // Error handled silently - profile will be null
        } else if (data) {
          // Use quit_date directly - this is the main sugar-free streak (only reset by "I Relapsed")
          const quitDate = data.quit_date || data.created_at;
          const longestStreak = data.longest_streak;
          const longestStreakMs = data.longest_streak_ms;

          // Check for 24-hour inactivity - only affects check-in streak (calendar sequence)
          // This does NOT affect the main sugar-free streak (quit_date)
          try {
            const storedUserId = await AsyncStorage.getItem(STREAK_USER_KEY);
            let lastActivityStr = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
            let checkinStartStr = await AsyncStorage.getItem(CHECKIN_STREAK_START_KEY);
            const checkinVersion = await AsyncStorage.getItem(CHECKIN_STREAK_VERSION_KEY);
            const now = new Date();
            const nowMs = now.getTime();
            const nowIso = now.toISOString();

            // USER SCOPING: If streak data belongs to a different user, clear it all
            // This prevents cross-user contamination when switching accounts
            if (storedUserId && storedUserId !== user.id) {
              await AsyncStorage.multiRemove([
                LAST_ACTIVITY_KEY,
                CHECKIN_STREAK_START_KEY,
                CHECKIN_STREAK_VERSION_KEY,
                STREAK_CELEBRATION_DATE_KEY,
                STREAK_CELEBRATION_COUNT_KEY,
              ]);
              // Reset local variables to trigger re-initialization
              lastActivityStr = null;
              checkinStartStr = null;
            }

            // Store current user ID for future checks
            await AsyncStorage.setItem(STREAK_USER_KEY, user.id);

            // Migration: If version is outdated, clear check-in streak to re-initialize properly
            if (checkinVersion !== CURRENT_CHECKIN_VERSION) {
              await AsyncStorage.removeItem(CHECKIN_STREAK_START_KEY);
              await AsyncStorage.setItem(CHECKIN_STREAK_VERSION_KEY, CURRENT_CHECKIN_VERSION);
              checkinStartStr = null; // Force re-initialization below
            }

            if (lastActivityStr) {
              const lastActivityMs = parseInt(lastActivityStr, 10);
              // Guard against NaN from corrupted data
              if (!isNaN(lastActivityMs)) {
                const timeSinceLastActivity = nowMs - lastActivityMs;

                // If more than 24 hours since last app open, reset ONLY the check-in streak
                if (timeSinceLastActivity > INACTIVITY_THRESHOLD_MS) {
                  // Reset check-in streak start to now (but keep sugar-free quit_date unchanged!)
                  await AsyncStorage.setItem(CHECKIN_STREAK_START_KEY, nowIso);

                  // Notify user about check-in streak reset (not the main streak)
                  Alert.alert(
                    'Check-in Streak Reset',
                    "It's been more than 24 hours since your last visit. Your daily check-in streak has reset, but your sugar-free streak is still going!",
                    [{ text: 'OK', style: 'default' }]
                  );
                }
              }
            }

            // Initialize check-in streak start if not exists
            // NOTE: Check-in streak is INDEPENDENT from sugar-free streak (quit_date)
            // - Sugar-free streak (quit_date) = total time since journey started (never resets except via "I Relapsed")
            // - Check-in streak = consecutive days of app opens (resets after 24hr inactivity)
            if (!checkinStartStr) {
              // First time user or streak was just reset - start from today
              await AsyncStorage.setItem(CHECKIN_STREAK_START_KEY, nowIso);
            }
            // NOTE: We no longer reset check-in streak to quit_date
            // The check-in streak should only track consecutive app opens, not journey duration

            // Update last activity timestamp
            await AsyncStorage.setItem(LAST_ACTIVITY_KEY, nowMs.toString());

            // Calculate check-in streak days for display
            // Read the final value (after any resets or fixes)
            const finalCheckinStart = await AsyncStorage.getItem(CHECKIN_STREAK_START_KEY);
            if (finalCheckinStart) {
              const checkinDate = startOfDay(new Date(finalCheckinStart));
              const today = startOfDay(new Date());
              const diffMs = today.getTime() - checkinDate.getTime();
              const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
              setCheckinStreakDays(days);

              // Check if we should show streak celebration
              // Only show if: 1) It's a new day, 2) Streak has increased
              try {
                const todayStr = format(today, 'yyyy-MM-dd');
                const lastCelebrationDate = await AsyncStorage.getItem(STREAK_CELEBRATION_DATE_KEY);
                const lastCelebrationCountStr = await AsyncStorage.getItem(STREAK_CELEBRATION_COUNT_KEY);
                const lastCelebrationCount = lastCelebrationCountStr ? parseInt(lastCelebrationCountStr, 10) : 0;

                // Show celebration if:
                // 1. We haven't shown celebration today (new day)
                // 2. Current streak is greater than last celebrated streak (streak increased)
                // 3. Streak is at least 1 day (don't celebrate day 0)
                if (lastCelebrationDate !== todayStr && days > lastCelebrationCount && days >= 1) {
                  setCelebrationStreakCount(days);
                  setCelebrationModalVisible(true);

                  // Update last celebration date and count
                  await AsyncStorage.setItem(STREAK_CELEBRATION_DATE_KEY, todayStr);
                  await AsyncStorage.setItem(STREAK_CELEBRATION_COUNT_KEY, days.toString());
                }
              } catch (celebrationError) {
                // Silently handle celebration check errors
              }
            }
          } catch (storageError) {
            // Silently handle AsyncStorage errors
          }

          // Apply defaults for any missing values
          // Priority: column value > onboarding_data value > default
          const weeklySpend = data.weekly_spend ?? data.onboarding_data?.weeklySpend ?? 100;

          const profileData: ProfileData = {
            id: data.id,
            full_name: data.full_name,
            email: data.email,
            created_at: data.created_at,
            quit_date: quitDate,
            weekly_spend: weeklySpend,
            daily_sugar_grams: data.daily_sugar_grams ?? 100,
            daily_calories: data.daily_calories ?? 400,
            longest_streak: longestStreak,
            longest_streak_ms: longestStreakMs,
            onboarding_data: data.onboarding_data,
          };
          setProfile(profileData);
        }
      }
    } catch (error) {
      // Silently handle profile fetch errors
    } finally {
      hasInitiallyLoaded.current = true;
      setLoading(false);
    }
  }, []);

  // Fetch mood for selected date
  const fetchMoodForDate = useCallback(async (date: Date) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const dayStart = startOfDay(date).toISOString();
        const dayEnd = endOfDay(date).toISOString();

        const { data, error } = await supabase
          .from('mood_logs')
          .select('score')
          .eq('user_id', user.id)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          const moodInfo = MOOD_OPTIONS.find(m => m.score === data.score) || MOOD_OPTIONS[3];
          setLatestMood(moodInfo);
        } else {
          setLatestMood(null);
        }
      }
    } catch (error) {
      // Silently fail - mood_logs table might not exist yet
      setLatestMood(null);
    }
  }, []);

  // Fetch longest historical streak from streak_history table
  const fetchLongestStreak = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('streak_history')
          .select('duration_days')
          .eq('user_id', user.id)
          .order('duration_days', { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          setLongestHistoricalStreak(data.duration_days);
        }
      }
    } catch (error) {
      // Silently fail - streak_history table might not exist yet
    }
  }, []);

  // Fetch profile and streak history on focus
  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      fetchLongestStreak();
    }, [fetchProfile, fetchLongestStreak])
  );

  // Fetch mood when selected date changes
  useEffect(() => {
    fetchMoodForDate(selectedDate);
  }, [selectedDate, fetchMoodForDate]);

  // Calculate elapsed time from quit date to target date
  const calculateElapsedTime = useCallback((quitDate: Date, targetDate: Date): ElapsedTime => {
    const diffMs = targetDate.getTime() - quitDate.getTime();

    if (diffMs < 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMinutes: 0, totalSeconds: 0 };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;

    return { days, hours, minutes, seconds, totalMinutes, totalSeconds };
  }, []);

  // Live timer effect - uses quit_date from profile
  useEffect(() => {
    if (!profile) return;

    // Use quit_date (the dedicated column for tracking streak)
    const quitDateStr = profile.quit_date || profile.created_at;
    const quitDate = new Date(quitDateStr);

    // For past dates, calculate static elapsed time at end of that day
    if (!isToday) {
      // Calculate elapsed time from quit date to end of selected day
      const endOfSelectedDay = endOfDay(selectedDate);
      setElapsedTime(calculateElapsedTime(quitDate, endOfSelectedDay));
      return;
    }

    // For today, use live timer
    setElapsedTime(calculateElapsedTime(quitDate, new Date()));

    // Update every second for today
    timerRef.current = setInterval(() => {
      setElapsedTime(calculateElapsedTime(quitDate, new Date()));
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [profile, calculateElapsedTime, selectedDate, isToday]);

  // Format time with leading zeros
  const formatTime = (num: number) => num.toString().padStart(2, '0');

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Get user's first name
  const getFirstName = () => {
    if (!profile?.full_name) return '';
    const firstName = profile.full_name.split(' ')[0];
    // Avoid returning email prefixes or UUIDs
    if (firstName.includes('@') || firstName.length > 20) return '';
    return `, ${firstName}`;
  };

  // Get formatted date for header (always shows today)
  const getFormattedDate = () => {
    return format(new Date(), 'EEEE, MMMM d');
  };

  // Get selected date display
  const getSelectedDateDisplay = () => {
    if (isToday) {
      return 'Today';
    }
    return format(selectedDate, 'EEEE, MMM d');
  };

  // Calculate 24-hour ring progress
  const calculateRingProgress = () => {
    if (!isToday) {
      // Past days are 100% complete
      return 1;
    }
    const { hours, minutes, seconds } = elapsedTime;
    const secondsIntoDay = (hours % 24) * 3600 + minutes * 60 + seconds;
    const progress = secondsIntoDay / 86400;
    return Math.min(progress, 1);
  };

  // Calculate FULL days elapsed from quit date to selected date (no fractional days)
  const getDaysElapsed = useCallback(() => {
    if (!profile?.quit_date) return 0;
    const quitDate = startOfDay(new Date(profile.quit_date));
    const targetDate = startOfDay(selectedDate);
    const days = differenceInDays(targetDate, quitDate);
    return Math.max(0, days);
  }, [profile, selectedDate]);

  // Get precise days elapsed respecting selectedDate vs quit_date relationship
  // - If selectedDate is before quit_date: returns 0
  // - If selectedDate is today: uses live time (fractional)
  // - If selectedDate is past (after quit_date): uses end of that day
  const getCalculationDaysElapsed = useCallback(() => {
    if (!profile?.quit_date) return 0;

    const quitDate = new Date(profile.quit_date);

    // Determine the calculation end point
    const isViewingToday = isSameDay(selectedDate, new Date());
    const calculationEnd = isViewingToday ? new Date() : endOfDay(selectedDate);

    // If selected date is before quit date, return 0
    if (isBefore(calculationEnd, quitDate)) {
      return 0;
    }

    // Calculate precise days from quit date to calculation end
    const diffMs = calculationEnd.getTime() - quitDate.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
  }, [profile, selectedDate]);

  // Check if selected date is STRICTLY before the quit date (for UI messaging)
  // The Start Day itself should show partial progress, not "Not Started"
  const isBeforeQuitDate = useMemo(() => {
    if (!profile?.quit_date) return false;
    const quitDate = new Date(profile.quit_date);
    // Only return true if selected day is BEFORE the quit day (not same day)
    return isBefore(selectedDate, quitDate) && !isSameDay(selectedDate, quitDate);
  }, [profile, selectedDate]);

  // Calculate money saved: (weekly_spend / 7) * daysElapsed
  const calculateMoneySaved = useCallback(() => {
    const weeklySpend = profile?.weekly_spend ?? DEFAULT_WEEKLY_SPEND;
    if (weeklySpend === 0) return '$0';

    const daysPassed = getCalculationDaysElapsed();
    if (daysPassed === 0) return '$0';

    const dailySpend = weeklySpend / 7;
    const saved = dailySpend * daysPassed;

    // Show 1 decimal if < 1, otherwise integer
    if (saved >= 1) {
      return `$${Math.floor(saved)}`;
    }
    return `$${saved.toFixed(1)}`;
  }, [profile, getCalculationDaysElapsed]);

  // Calculate calories saved: daily_calories * daysElapsed
  const calculateCaloriesSaved = useCallback(() => {
    const dailyCalories = profile?.daily_calories ?? DEFAULT_DAILY_CALORIES;
    const daysPassed = getCalculationDaysElapsed();

    if (daysPassed === 0) return '0';

    const calories = dailyCalories * daysPassed;

    if (calories >= 1000) {
      return `${(calories / 1000).toFixed(1)}k`;
    }
    return Math.floor(calories).toString();
  }, [profile, getCalculationDaysElapsed]);

  // Calculate sugar grams avoided: daily_sugar_grams * daysElapsed
  const calculateSugarSaved = useCallback(() => {
    const dailySugar = profile?.daily_sugar_grams ?? DEFAULT_DAILY_SUGAR_GRAMS;
    const daysPassed = getCalculationDaysElapsed();

    if (daysPassed === 0) return '0g';

    const totalGrams = dailySugar * daysPassed;

    if (totalGrams >= 1000) {
      return `${(totalGrams / 1000).toFixed(1)}kg`;
    }
    if (totalGrams < 10) {
      return `${totalGrams.toFixed(1)}g`;
    }
    return `${Math.floor(totalGrams)}g`;
  }, [profile, getCalculationDaysElapsed]);

  // Calculate life time regained: daysElapsed * 15 minutes
  const calculateLifeRegained = useCallback(() => {
    const daysPassed = getCalculationDaysElapsed();

    if (daysPassed === 0) return '0 Mins';

    const totalMinutes = daysPassed * LIFE_MINUTES_PER_DAY;

    if (totalMinutes < 60) {
      return `${Math.floor(totalMinutes)} Mins`;
    }

    const totalHours = totalMinutes / 60;
    if (totalHours < 24) {
      return `${totalHours.toFixed(1)} Hrs`;
    }

    const totalDays = totalHours / 24;
    return `${totalDays.toFixed(1)} Days`;
  }, [getCalculationDaysElapsed]);

  // Get current and next recovery stage
  const getRecoveryProgress = () => {
    const { totalMinutes } = elapsedTime;

    let currentStageIndex = -1;
    for (let i = RECOVERY_STAGES.length - 1; i >= 0; i--) {
      if (totalMinutes >= RECOVERY_STAGES[i].durationMinutes) {
        currentStageIndex = i;
        break;
      }
    }

    if (currentStageIndex === -1) {
      const nextStage = RECOVERY_STAGES[0];
      const progress = (totalMinutes / nextStage.durationMinutes) * 100;
      return {
        currentStage: null,
        nextStage,
        progress: Math.min(progress, 100),
        isComplete: false,
      };
    }

    if (currentStageIndex === RECOVERY_STAGES.length - 1) {
      return {
        currentStage: RECOVERY_STAGES[currentStageIndex],
        nextStage: null,
        progress: 100,
        isComplete: true,
      };
    }

    const currentStage = RECOVERY_STAGES[currentStageIndex];
    const nextStage = RECOVERY_STAGES[currentStageIndex + 1];
    const stageStartMinutes = currentStage.durationMinutes;
    const stageDuration = nextStage.durationMinutes - stageStartMinutes;
    const minutesIntoStage = totalMinutes - stageStartMinutes;
    const progress = (minutesIntoStage / stageDuration) * 100;

    return {
      currentStage,
      nextStage,
      progress: Math.min(progress, 100),
      isComplete: false,
    };
  };

  // Get current duration in milliseconds
  const getCurrentDurationMs = useCallback(() => {
    if (!profile?.quit_date) return 0;
    const quitDate = new Date(profile.quit_date);
    const now = new Date();
    return Math.max(0, now.getTime() - quitDate.getTime());
  }, [profile?.quit_date]);

  // Get best streak in milliseconds (max of current vs database record)
  const getBestStreakMs = useCallback(() => {
    const currentMs = getCurrentDurationMs();
    const dbLongestMs = profile?.longest_streak_ms ?? 0;
    return Math.max(currentMs, dbLongestMs);
  }, [getCurrentDurationMs, profile?.longest_streak_ms]);

  // Check if current duration beats the database record
  const isNewRecord = useCallback(() => {
    const currentMs = getCurrentDurationMs();
    const dbLongestMs = profile?.longest_streak_ms ?? 0;
    return currentMs > 0 && currentMs > dbLongestMs;
  }, [getCurrentDurationMs, profile?.longest_streak_ms]);

  // Get milliseconds left to beat the record
  const getTimeToRecordMs = useCallback(() => {
    const currentMs = getCurrentDurationMs();
    const dbLongestMs = profile?.longest_streak_ms ?? 0;
    return Math.max(0, dbLongestMs - currentMs);
  }, [getCurrentDurationMs, profile?.longest_streak_ms]);

  // Handle opening timer modal
  const handleTimerPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimerModalVisible(true);
  };

  // Handle relapse - user explicitly reports consuming sugar, reset streak
  const handleRelapse = () => {
    Alert.alert(
      'Reset Streak?',
      'This will reset your progress to Day 0. Your best streak record will be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSaving(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

              const now = new Date();
              const nowIso = now.toISOString();

              // Calculate best streak before resetting
              const currentStreak = elapsedTime.days;
              const existingLongestStreak = profile?.longest_streak ?? 0;
              const newLongestStreak = Math.max(currentStreak, existingLongestStreak);

              // Calculate precise duration in milliseconds
              const quitDate = profile?.quit_date ? new Date(profile.quit_date) : now;
              const currentDurationMs = Math.max(0, now.getTime() - quitDate.getTime());
              const existingLongestMs = profile?.longest_streak_ms ?? 0;
              const newLongestMs = Math.max(currentDurationMs, existingLongestMs);

              // Update database with new quit_date and preserve best streak
              const { error } = await supabase
                .from('profiles')
                .update({
                  quit_date: nowIso,
                  longest_streak: newLongestStreak,
                  longest_streak_ms: newLongestMs,
                })
                .eq('id', profile?.id);

              if (error) {
                Alert.alert('Error', 'Failed to reset streak. Please try again.');
                return;
              }

              // Update local state
              setProfile(prev => prev ? {
                ...prev,
                quit_date: nowIso,
                longest_streak: newLongestStreak,
                longest_streak_ms: newLongestMs
              } : null);
              setSelectedDate(new Date()); // Reset to today
              setTimerModalVisible(false);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Streak Reset', "Don't worry - every journey has setbacks. You've got this!");
            } catch (error) {
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  };

  // Handle card press
  const handleCardPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Handle celebration modal close
  const handleCelebrationClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCelebrationModalVisible(false);
  };

  // Handle celebration modal "View Details" button
  const handleCelebrationViewDetails = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCelebrationModalVisible(false);
    router.push('/streak-details');
  };

  // Handle mood card press - navigate to mood tracker
  const handleMoodPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/mood-tracker', params: { title: 'Mood Tracker' } });
  };

  // Format quit date for display
  const formatQuitDate = () => {
    if (!profile?.quit_date) return '';
    const date = new Date(profile.quit_date);
    return format(date, 'MMM d, yyyy h:mm a');
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const recoveryProgress = getRecoveryProgress();
  const RecoveryIcon = recoveryProgress.nextStage?.icon || Activity;
  const ringProgress = calculateRingProgress();
  const daysElapsed = getDaysElapsed();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - App Logo + Name with Streak Badge */}
        <View style={styles.header}>
          <View style={styles.appBrandContainer}>
            <Image
              source={require('../../assets/app-logo.png')}
              style={styles.appLogo}
            />
            <Text style={styles.appName}>Unsweet</Text>
          </View>

          {/* Streak Fire Badge - Tap to view streak details */}
          <TouchableOpacity
            style={styles.streakBadgeContainer}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/streak-details');
            }}
          >
            <SmallFlame size={20} />
            <Text style={styles.streakBadgeText}>{checkinStreakDays}</Text>
          </TouchableOpacity>
        </View>

        {/* Week Calendar Strip */}
        <WeekCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {/* Selected Date Indicator */}
        {!isToday && (
          <View style={styles.pastDateBanner}>
            <Calendar size={16} color={COLORS.primary} />
            <Text style={styles.pastDateText}>
              Viewing {getSelectedDateDisplay()}
            </Text>
            <Pressable
              onPress={() => setSelectedDate(new Date())}
              style={styles.backToTodayButton}
            >
              <Text style={styles.backToTodayText}>Back to Today</Text>
            </Pressable>
          </View>
        )}

        {/* Hero Progress Ring Card - Clickable */}
        <TouchableOpacity
          onPress={handleTimerPress}
          activeOpacity={0.95}
          style={styles.heroCard}
        >
          <CircularProgress
            size={240}
            strokeWidth={18}
            progress={isBeforeQuitDate ? 0 : ringProgress}
          >
            {isBeforeQuitDate ? (
              <>
                {/* Selected date is before the journey started */}
                <Calendar size={32} color={COLORS.mutedText} />
                <Text style={styles.notStartedText}>Not Started</Text>
                <Text style={styles.notStartedSubtext}>Journey began later</Text>
              </>
            ) : isToday ? (
              <>
                {/* Live Timer Display */}
                <Text style={styles.timerText}>
                  {formatTime(elapsedTime.hours)}:{formatTime(elapsedTime.minutes)}:{formatTime(elapsedTime.seconds)}
                </Text>
                {/* Day Streak - uses check-in streak (consecutive app opens) */}
                <View style={styles.streakBadge}>
                  <Flame size={16} color={COLORS.primary} strokeWidth={2.5} />
                  <Text style={styles.streakText}>Day {checkinStreakDays} Streak</Text>
                </View>
              </>
            ) : (
              <>
                {/* Static Day Display for Past Dates */}
                <Text style={styles.pastDayNumber}>Day {daysElapsed}</Text>
                <Text style={styles.pastDayLabel}>Completed</Text>
              </>
            )}
          </CircularProgress>

          {/* Sugar Free Label */}
          <Text style={styles.sugarFreeLabel}>Sugar Free</Text>

          {/* Best Streak Badge & Motivation */}
          {getBestStreakMs() > 0 && (
            <View style={styles.bestStreakContainer}>
              <View style={styles.bestStreakBadge}>
                <Trophy size={14} color={COLORS.goldColor} strokeWidth={2.5} />
                <Text style={styles.bestStreakText}>
                  Best: {formatDurationPrecise(getBestStreakMs())}
                </Text>
                {isNewRecord() && (
                  <View style={styles.newRecordBadge}>
                    <Text style={styles.newRecordText}>NEW!</Text>
                  </View>
                )}
              </View>
              {/* Motivation Text */}
              {getTimeToRecordMs() > 0 ? (
                <Text style={styles.motivationText}>
                  Break record in {formatDurationPrecise(getTimeToRecordMs())}!
                </Text>
              ) : isNewRecord() ? (
                <Text style={styles.motivationTextSuccess}>
                  You're unstoppable!
                </Text>
              ) : null}
            </View>
          )}

          {/* Tap hint */}
          <Text style={styles.tapHint}>Tap to manage streak</Text>

          {/* Today's Progress Bar */}
          <View style={styles.dailyProgressContainer}>
            <View style={styles.dailyProgressLabels}>
              <Text style={styles.dailyProgressLabel}>
                {isToday ? "Today's Progress" : 'Day Progress'}
              </Text>
              <Text style={styles.dailyProgressPercent}>{Math.round(ringProgress * 100)}%</Text>
            </View>
            <View style={styles.dailyProgressTrack}>
              <View style={[styles.dailyProgressFill, { width: `${ringProgress * 100}%` }]} />
            </View>
          </View>
        </TouchableOpacity>

        {/* The Gains - 2x2 Grid (Quantitative Metrics) */}
        <Text style={styles.sectionTitle}>Your Gains</Text>
        <View style={styles.gainsGrid}>
          {/* Row 1 */}
          <View style={styles.gainsRow}>
            {/* Money Saved */}
            <Pressable
              style={({ pressed }) => [styles.gainCard, pressed && styles.cardPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/analytics/money', params: { title: 'Money Saved' } });
              }}
            >
              <View style={[styles.gainIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Wallet size={24} color={COLORS.walletColor} strokeWidth={2} />
              </View>
              <Text style={styles.gainValue}>{calculateMoneySaved()}</Text>
              <Text style={styles.gainLabel}>Saved</Text>
            </Pressable>

            {/* Calories Not Eaten */}
            <Pressable
              style={({ pressed }) => [styles.gainCard, pressed && styles.cardPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/analytics/calories', params: { title: 'Calories Avoided' } });
              }}
            >
              <View style={[styles.gainIconContainer, { backgroundColor: 'rgba(255, 107, 53, 0.1)' }]}>
                <Flame size={24} color={COLORS.flameColor} strokeWidth={2} />
              </View>
              <Text style={styles.gainValue}>{calculateCaloriesSaved()}</Text>
              <Text style={styles.gainLabel}>Calories</Text>
            </Pressable>
          </View>

          {/* Row 2 */}
          <View style={styles.gainsRow}>
            {/* Sugar Not Eaten */}
            <Pressable
              style={({ pressed }) => [styles.gainCard, pressed && styles.cardPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/analytics/sugar', params: { title: 'Sugar Avoided' } });
              }}
            >
              <View style={[styles.gainIconContainer, { backgroundColor: 'rgba(255, 45, 85, 0.1)' }]}>
                <Candy size={24} color={COLORS.sugarColor} strokeWidth={2} />
              </View>
              <Text style={styles.gainValue}>{calculateSugarSaved()}</Text>
              <Text style={styles.gainLabel}>Sugar Avoided</Text>
            </Pressable>

            {/* Life Regained */}
            <Pressable
              style={({ pressed }) => [styles.gainCard, pressed && styles.cardPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/analytics/life', params: { title: 'Life Regained' } });
              }}
            >
              <View style={[styles.gainIconContainer, { backgroundColor: 'rgba(255, 45, 85, 0.1)' }]}>
                <Heart size={24} color={COLORS.lifeColor} strokeWidth={2} fill={COLORS.lifeColor} />
              </View>
              <Text style={styles.gainValue}>{calculateLifeRegained()}</Text>
              <Text style={styles.gainLabel}>Life Regained</Text>
            </Pressable>
          </View>
        </View>

        {/* Mood Check-in Card */}
        <Pressable
          style={({ pressed }) => [styles.moodCheckinCard, pressed && styles.cardPressed]}
          onPress={handleMoodPress}
        >
          <View style={styles.moodCheckinContent}>
            <View style={[styles.moodCheckinIcon, { backgroundColor: 'rgba(88, 86, 214, 0.1)' }]}>
              {latestMood ? (
                <Text style={{ fontSize: 28 }}>{latestMood.emoji}</Text>
              ) : (
                <Smile size={28} color={COLORS.moodColor} strokeWidth={2} />
              )}
            </View>
            <View style={styles.moodCheckinInfo}>
              <Text style={styles.moodCheckinLabel}>
                {isToday ? 'How are you feeling?' : `Mood on ${format(selectedDate, 'MMM d')}`}
              </Text>
              <Text style={styles.moodCheckinStatus}>
                {latestMood ? `Feeling ${latestMood.label}` : (isToday ? 'Tap to log your mood' : 'No mood logged')}
              </Text>
            </View>
          </View>
          {isToday && <ChevronRight size={20} color={COLORS.mutedText} />}
        </Pressable>

        {/* Body Status - Recovery Card */}
        <Text style={styles.sectionTitle}>Body Status</Text>
        <Pressable
          style={({ pressed }) => [styles.recoveryCard, pressed && styles.cardPressed]}
          onPress={handleCardPress}
        >
          <View style={styles.recoveryHeader}>
            <View style={[styles.recoveryIconContainer, { backgroundColor: `${recoveryProgress.nextStage?.color || COLORS.primary}15` }]}>
              <RecoveryIcon
                size={24}
                color={recoveryProgress.nextStage?.color || COLORS.primary}
                strokeWidth={2}
              />
            </View>
            <View style={styles.recoveryInfo}>
              <Text style={styles.recoveryTitle}>
                {recoveryProgress.isComplete
                  ? 'All Stages Complete!'
                  : recoveryProgress.nextStage?.title || 'Recovery Started'}
              </Text>
              <Text style={styles.recoveryDescription}>
                {recoveryProgress.isComplete
                  ? 'You have achieved all biological recovery milestones.'
                  : recoveryProgress.nextStage?.description || 'Your body is starting to heal.'}
              </Text>
            </View>
            <ChevronRight size={20} color={COLORS.mutedText} />
          </View>

          {/* Progress Bar */}
          <View style={styles.recoveryProgressContainer}>
            <View style={styles.recoveryProgressLabels}>
              <Text style={styles.recoveryProgressLabel}>Progress</Text>
              <Text style={styles.recoveryProgressPercent}>
                {Math.round(recoveryProgress.progress)}%
              </Text>
            </View>
            <View style={styles.recoveryProgressTrack}>
              <View
                style={[
                  styles.recoveryProgressFill,
                  {
                    width: `${recoveryProgress.progress}%`,
                    backgroundColor: recoveryProgress.nextStage?.color || COLORS.primary,
                  },
                ]}
              />
            </View>
          </View>

          {/* Stage indicator */}
          {recoveryProgress.currentStage && !recoveryProgress.isComplete && (
            <View style={styles.stageIndicator}>
              <Text style={styles.stageIndicatorText}>
                ✓ {recoveryProgress.currentStage.title}
              </Text>
            </View>
          )}
        </Pressable>

        {/* Quick Tip */}
        <Pressable
          style={({ pressed }) => [styles.tipCard, pressed && styles.cardPressed]}
          onPress={handleCardPress}
        >
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>💡 Daily Tip</Text>
            <Text style={styles.tipText}>
              When cravings hit, drink a glass of water and wait 10 minutes. Most cravings pass within this time.
            </Text>
          </View>
          <ChevronRight size={20} color={COLORS.primary} />
        </Pressable>
      </ScrollView>

      {/* Streak Management Modal */}
      <Modal
        visible={timerModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTimerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setTimerModalVisible(false)}
          />
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Streak</Text>
              <TouchableOpacity
                onPress={() => setTimerModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <X size={24} color={COLORS.mutedText} />
              </TouchableOpacity>
            </View>

            {/* Current Streak Info */}
            <View style={styles.streakInfoCard}>
              <Text style={styles.streakInfoLabel}>Started On</Text>
              <Text style={styles.streakInfoValue}>{formatQuitDate()}</Text>
              <Text style={styles.streakInfoDays}>{elapsedTime.days} days sugar-free</Text>
            </View>

            {/* Reset Streak Option */}
            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleRelapse}
                activeOpacity={0.7}
                disabled={isSaving}
              >
                <View style={[styles.modalOptionIcon, { backgroundColor: COLORS.dangerLight }]}>
                  <RotateCcw size={22} color={COLORS.danger} />
                </View>
                <View style={styles.modalOptionContent}>
                  <Text style={[styles.modalOptionTitle, { color: COLORS.danger }]}>I Relapsed</Text>
                  <Text style={styles.modalOptionDescription}>
                    Reset your streak to start fresh today
                  </Text>
                </View>
                <ChevronRight size={20} color={COLORS.mutedText} />
              </TouchableOpacity>
            </View>

            {/* Encouragement */}
            <View style={styles.encouragementCard}>
              <AlertTriangle size={18} color="#F59E0B" />
              <Text style={styles.encouragementText}>
                Setbacks are part of the journey. What matters is getting back on track!
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Streak Celebration Modal */}
      <Modal
        visible={celebrationModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={handleCelebrationClose}
      >
        <View style={styles.celebrationOverlay}>
          <Pressable
            style={styles.celebrationBackdrop}
            onPress={handleCelebrationClose}
          />
          <View style={styles.celebrationContent}>
            {/* Animated Flame Icon */}
            <View style={styles.celebrationFlameContainer}>
              <SmallFlame size={80} />
            </View>

            {/* Streak Count */}
            <Text style={styles.celebrationStreakNumber}>{celebrationStreakCount}</Text>
            <Text style={styles.celebrationStreakLabel}>Day Streak!</Text>

            {/* Motivational Message */}
            <Text style={styles.celebrationMessage}>
              {celebrationStreakCount === 1
                ? "You've started your journey! Keep going!"
                : celebrationStreakCount < 7
                ? "You're building momentum! Every day counts!"
                : celebrationStreakCount < 30
                ? "Amazing progress! You're crushing it!"
                : "Incredible dedication! You're unstoppable!"}
            </Text>

            {/* Action Buttons */}
            <View style={styles.celebrationButtons}>
              <TouchableOpacity
                style={styles.celebrationPrimaryButton}
                onPress={handleCelebrationViewDetails}
                activeOpacity={0.9}
              >
                <Trophy size={18} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.celebrationPrimaryButtonText}>View Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.celebrationSecondaryButton}
                onPress={handleCelebrationClose}
                activeOpacity={0.7}
              >
                <Text style={styles.celebrationSecondaryButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  appBrandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appLogo: {
    width: 90,
    height: 90,
    marginLeft: -16,
    marginRight: -20,
    marginVertical: -20,
  },
  appName: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.headingText,
    letterSpacing: -0.5,
  },
  // Streak Fire Badge
  streakBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  streakBadgeText: {
    color: COLORS.headingText,
    fontSize: 16,
    fontWeight: '700',
  },

  // Week Calendar
  weekCalendar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  calendarDay: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    minWidth: 44,
    borderRadius: 16,
  },
  calendarDaySelected: {
    backgroundColor: COLORS.primary,
  },
  calendarDayName: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.mutedText,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  calendarDayNameSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  // Circle wrapper for day number
  calendarDayNumCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayNumCirclePast: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.mutedText,
  },
  calendarDayNumCircleFuture: {
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: COLORS.calendarText,
  },
  calendarDayNumCircleSelected: {
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: '#FFFFFF',
  },
  calendarDayNum: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.calendarText,
  },
  calendarDayNumSelected: {
    color: '#FFFFFF',
  },
  calendarDayNumToday: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  calendarTodayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
  calendarTodayDotSelected: {
    backgroundColor: COLORS.primary,
  },

  // Past Date Banner
  pastDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 8,
  },
  pastDateText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  backToTodayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  backToTodayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Hero Card with Progress Ring
  heroCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    marginBottom: 28,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  heroCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },

  // Ring Center Content
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 42,
    fontWeight: '700',
    color: COLORS.headingText,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginBottom: 8,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Past Day Display
  pastDayNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.headingText,
    letterSpacing: -1,
  },
  pastDayLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 4,
  },

  // Not Started Display (for dates before quit_date)
  notStartedText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.mutedText,
    marginTop: 12,
  },
  notStartedSubtext: {
    fontSize: 14,
    color: COLORS.mutedText,
    marginTop: 4,
  },

  sugarFreeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 20,
    marginBottom: 8,
  },
  tapHint: {
    fontSize: 12,
    color: COLORS.mutedText,
    marginBottom: 16,
  },

  // Best Streak Badge
  bestStreakContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  bestStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  bestStreakText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.goldColor,
  },
  newRecordBadge: {
    backgroundColor: COLORS.goldColor,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 2,
  },
  newRecordText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  motivationText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.mutedText,
    marginTop: 4,
  },
  motivationTextSuccess: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.goldColor,
    marginTop: 4,
    letterSpacing: 0.5,
  },

  // Daily Progress Bar
  dailyProgressContainer: {
    width: '100%',
  },
  dailyProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dailyProgressLabel: {
    fontSize: 13,
    color: COLORS.bodyText,
    fontWeight: '500',
  },
  dailyProgressPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  dailyProgressTrack: {
    height: 8,
    backgroundColor: COLORS.ringBackground,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dailyProgressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },

  // Section Title
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.headingText,
    marginTop: 8,
    marginBottom: 16,
    letterSpacing: -0.3,
  },

  // Gains Grid - 2x2
  gainsGrid: {
    gap: 12,
    marginBottom: 28,
  },
  gainsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gainCard: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  gainIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gainValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.headingText,
    marginBottom: 4,
  },
  gainLabel: {
    fontSize: 12,
    color: COLORS.mutedText,
    fontWeight: '500',
  },

  // Mood Check-in Card
  moodCheckinCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  moodCheckinContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodCheckinIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  moodCheckinInfo: {
    flex: 1,
  },
  moodCheckinLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.headingText,
    marginBottom: 4,
  },
  moodCheckinStatus: {
    fontSize: 14,
    color: COLORS.mutedText,
  },

  // Recovery Card
  recoveryCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  recoveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recoveryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  recoveryInfo: {
    flex: 1,
  },
  recoveryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.headingText,
    marginBottom: 4,
  },
  recoveryDescription: {
    fontSize: 13,
    color: COLORS.mutedText,
    lineHeight: 18,
  },
  recoveryProgressContainer: {
    marginTop: 16,
  },
  recoveryProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recoveryProgressLabel: {
    fontSize: 13,
    color: COLORS.bodyText,
    fontWeight: '500',
  },
  recoveryProgressPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  recoveryProgressTrack: {
    height: 8,
    backgroundColor: COLORS.progressTrack,
    borderRadius: 4,
    overflow: 'hidden',
  },
  recoveryProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  stageIndicator: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  stageIndicatorText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },

  // Tip Card
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  tipContent: {
    flex: 1,
    marginRight: 12,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 6,
  },
  tipText: {
    fontSize: 14,
    color: COLORS.bodyText,
    lineHeight: 20,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.headingText,
  },
  modalCloseButton: {
    padding: 4,
  },

  // Streak Info Card
  streakInfoCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  streakInfoLabel: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  streakInfoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.headingText,
    marginBottom: 4,
  },
  streakInfoDays: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Modal Options
  modalOptions: {
    gap: 12,
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
  },
  modalOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modalOptionContent: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.headingText,
    marginBottom: 2,
  },
  modalOptionDescription: {
    fontSize: 13,
    color: COLORS.mutedText,
  },

  // Encouragement Card
  encouragementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 14,
  },
  encouragementText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.bodyText,
    lineHeight: 18,
  },

  // Celebration Modal Styles
  celebrationOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebrationBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  celebrationContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginHorizontal: 32,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  celebrationFlameContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  celebrationStreakNumber: {
    fontSize: 72,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: -2,
  },
  celebrationStreakLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.headingText,
    marginTop: -4,
    marginBottom: 16,
  },
  celebrationMessage: {
    fontSize: 16,
    color: COLORS.bodyText,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  celebrationButtons: {
    width: '100%',
    gap: 12,
  },
  celebrationPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  celebrationPrimaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  celebrationSecondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  celebrationSecondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.mutedText,
  },
});
