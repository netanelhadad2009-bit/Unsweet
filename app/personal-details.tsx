/**
 * Personal Details Screen
 *
 * Combined settings screen for:
 * - Body measurements (weight, height, age, gender)
 * - Tracking settings (quit date, weekly spend, sugar, calories)
 *
 * Uses waterfall pre-fill priority:
 * 1. Direct column value
 * 2. Onboarding data value
 * 3. Default value
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
  Target,
  Calendar,
  Flame,
  Wallet,
  Candy,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { format, startOfDay, differenceInCalendarDays } from 'date-fns';

// Colors matching iOS Settings light mode
const COLORS = {
  background: '#F2F2F7',
  cardBackground: '#FFFFFF',
  darkCard: '#1C1C1E',
  darkCardSecondary: '#3A3A3C',
  label: '#8E8E93',
  value: '#000000',
  border: '#E5E5EA',
  primary: '#10B981',
  primaryLight: 'rgba(16, 185, 129, 0.1)',
  white: '#FFFFFF',
};

// Default values for tracking
const DEFAULT_WEEKLY_SPEND = 30; // USD - typical weekly spend on sugary snacks in US
const DEFAULT_DAILY_SUGAR = 100;
const DEFAULT_DAILY_CALORIES = 400;

// Gender options
const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

interface ProfileData {
  id: string;
  created_at: string;
  quit_date: string | null;
  weekly_spend: number | null;
  daily_sugar_grams: number | null;
  daily_calories: number | null;
  longest_streak: number | null;
  longest_streak_ms: number | null; // Precise duration in milliseconds
  onboarding_data: {
    gender?: string;
    age?: number;
    height?: number;
    weight?: number;
    useImperial?: boolean;
    main_goals?: string[];
    weeklySpend?: number;
    dailySugar?: number;
    dailyCalories?: number;
  } | null;
}

// Helper function for waterfall priority
const getInitialValue = (
  directValue: number | null | undefined,
  onboardingValue: number | undefined,
  fallback: number
): string => {
  if (directValue !== null && directValue !== undefined) return directValue.toString();
  if (onboardingValue !== undefined && onboardingValue !== null) return onboardingValue.toString();
  return fallback.toString();
};

export default function PersonalDetailsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Body measurements form
  const [form, setForm] = useState({
    weight: '',
    height: '',
    age: '',
    gender: '',
  });

  // Tracking settings state
  // IMPORTANT: Initialize as undefined to prevent accidental overwrites if fetch fails
  const [quitDate, setQuitDate] = useState<Date | undefined>(undefined);
  const [originalQuitDate, setOriginalQuitDate] = useState<Date | undefined>(undefined); // Track original for streak calc
  const [weeklySpend, setWeeklySpend] = useState('');
  const [dailySugar, setDailySugar] = useState('');
  const [dailyCalories, setDailyCalories] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | undefined>(undefined); // Temp date for picker
  const [pickerMonth, setPickerMonth] = useState<Date>(new Date()); // Current month view

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, created_at, quit_date, weekly_spend, daily_sugar_grams, daily_calories, longest_streak, longest_streak_ms, onboarding_data')
        .eq('id', user.id)
        .single();

      if (error) {
        Alert.alert('Error', 'Failed to load profile data. Please try again.');
        return;
      }

      if (!data) {
        return;
      }

      setProfile(data);
      const onboardingData = data.onboarding_data;

      // Body measurements
      setForm({
        weight: onboardingData?.weight?.toString() || '',
        height: onboardingData?.height?.toString() || '',
        age: onboardingData?.age?.toString() || '',
        gender: onboardingData?.gender || '',
      });

      // Tracking settings with waterfall priority
      // Safety: Use quit_date, fallback to created_at, or use current date as last resort
      const quitDateValue = data.quit_date || data.created_at || new Date().toISOString();

      const quitDateObj = new Date(quitDateValue);

      // Only set if valid date was obtained
      if (!isNaN(quitDateObj.getTime())) {
        setQuitDate(quitDateObj);
        setOriginalQuitDate(quitDateObj); // Store original for streak calculation
        setTempDate(quitDateObj); // Initialize temp date for picker
      }

      setWeeklySpend(getInitialValue(
        data.weekly_spend,
        onboardingData?.weeklySpend,
        DEFAULT_WEEKLY_SPEND
      ));

      setDailySugar(getInitialValue(
        data.daily_sugar_grams,
        onboardingData?.dailySugar,
        DEFAULT_DAILY_SUGAR
      ));

      setDailyCalories(getInitialValue(
        data.daily_calories,
        onboardingData?.dailyCalories,
        DEFAULT_DAILY_CALORIES
      ));

    } catch (error: any) {
      Alert.alert('Error', `Failed to load profile: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = async () => {
    // CRITICAL: Block saves while data is still loading or quit_date hasn't been fetched
    if (loading) {
      Alert.alert('Please Wait', 'Data is still loading. Please try again in a moment.');
      return;
    }

    if (!quitDate) {
      Alert.alert('Error', 'Please select a valid quit date.');
      return;
    }

    if (!profile?.id) {
      Alert.alert('Error', 'Profile not loaded. Please try again.');
      return;
    }

    const weight = parseFloat(form.weight);
    const height = parseFloat(form.height);
    const age = parseInt(form.age, 10);
    const spend = parseInt(weeklySpend) || 0;
    const sugar = parseInt(dailySugar) || 0;
    const calories = parseInt(dailyCalories) || 0;

    // Validation
    if (form.weight && (isNaN(weight) || weight <= 0 || weight > 500)) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight.');
      return;
    }
    if (form.height && (isNaN(height) || height <= 0 || height > 300)) {
      Alert.alert('Invalid Height', 'Please enter a valid height in cm.');
      return;
    }
    if (form.age && (isNaN(age) || age <= 0 || age > 150)) {
      Alert.alert('Invalid Age', 'Please enter a valid age.');
      return;
    }
    if (spend < 0 || sugar < 0 || calories < 0) {
      Alert.alert('Invalid Value', 'Tracking values cannot be negative.');
      return;
    }

    setSaving(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Build updated onboarding data for body measurements
      const updatedOnboardingData = {
        ...profile?.onboarding_data,
        ...(form.weight && { weight }),
        ...(form.height && { height }),
        ...(form.age && { age }),
        ...(form.gender && { gender: form.gender }),
      };

      // Calculate current streak before potential reset
      // Safety: Use originalQuitDate if available, otherwise fall back to quitDate
      const now = new Date();
      const streakBaseDate = originalQuitDate ?? quitDate;

      // Calculate days (legacy, for backward compatibility)
      const currentStreak = Math.max(0, differenceInCalendarDays(now, streakBaseDate));
      const existingLongestStreak = profile?.longest_streak ?? 0;
      const newLongestStreak = Math.max(currentStreak, existingLongestStreak);

      // Calculate precise duration in milliseconds
      const currentDurationMs = Math.max(0, now.getTime() - streakBaseDate.getTime());
      const existingLongestMs = profile?.longest_streak_ms ?? 0;
      const newLongestMs = Math.max(currentDurationMs, existingLongestMs);

      // FORCE ISO FORMAT for quit_date - this is critical for Supabase timestamp columns
      const quitDateISO = quitDate.toISOString();

      // Prepare the update payload
      const updatePayload = {
        onboarding_data: updatedOnboardingData,
        quit_date: quitDateISO,
        weekly_spend: spend,
        daily_sugar_grams: sugar,
        daily_calories: calories,
        longest_streak: newLongestStreak,
        longest_streak_ms: newLongestMs,
        updated_at: new Date().toISOString(),
      };

      // Send to Supabase
      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', profile.id)
        .select('quit_date'); // Select to verify what was saved

      // EXPLICIT ERROR CHECK - show exact error to user
      if (error) {
        Alert.alert(
          'Save Failed',
          `Could not save your changes.\n\nError: ${error.message}\n\nPlease try again or contact support if this persists.`
        );
        return; // DO NOT navigate back on error
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Show success confirmation then navigate back
      Alert.alert(
        'Saved',
        'Your changes have been saved successfully.',
        [{ text: 'OK', onPress: () => router.back() }]
      );

    } catch (error: any) {
      Alert.alert(
        'Unexpected Error',
        `Something went wrong: ${error?.message || 'Unknown error'}\n\nPlease try again.`
      );
    } finally {
      setSaving(false);
    }
  };

  // Open date picker
  const openDatePicker = () => {
    // Safety: Don't open picker if quitDate hasn't loaded yet
    if (!quitDate) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempDate(quitDate);
    setPickerMonth(quitDate);
    setShowDatePicker(true);
  };

  // Confirm date selection
  const handleConfirmDate = () => {
    // Safety: Don't confirm if tempDate is undefined
    if (!tempDate) {
      setShowDatePicker(false);
      return;
    }
    setQuitDate(tempDate);
    setShowDatePicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Generate calendar days for the picker
  const generatePickerDays = () => {
    const year = pickerMonth.getFullYear();
    const month = pickerMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const today = startOfDay(new Date());

    const days: Array<{ date: Date | null; isDisabled: boolean }> = [];

    // Add empty slots for days before the 1st
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: null, isDisabled: true });
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isDisabled = date > today; // Can't select future dates
      days.push({ date, isDisabled });
    }

    return days;
  };

  // Navigate months
  const navigateMonth = (direction: 'prev' | 'next') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMonth = new Date(pickerMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setPickerMonth(newMonth);
  };

  // Check if can navigate to next month
  const canGoNext = () => {
    const nextMonth = new Date(pickerMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth <= new Date();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen
          options={{
            title: 'Personal Details',
            headerShown: true,
            headerStyle: { backgroundColor: 'white' },
            headerTintColor: '#1F2937',
            headerShadowVisible: false,
            headerBackTitleVisible: false,
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Personal Details',
          headerShown: true,
          headerStyle: { backgroundColor: 'white' },
          headerTintColor: '#1F2937',
          headerShadowVisible: false,
          headerBackTitleVisible: false,
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Goal Card */}
        <View style={styles.goalCard}>
          <View style={styles.goalCardLeft}>
            <Text style={styles.goalLabel}>My Goal</Text>
            <Text style={styles.goalValue}>Sugar Free</Text>
          </View>
          <View style={styles.goalBadge}>
            <Target size={14} color={COLORS.white} />
            <Text style={styles.goalBadgeText}>Forever</Text>
          </View>
        </View>

        {/* Body Measurements Section */}
        <Text style={styles.sectionLabel}>BODY MEASUREMENTS</Text>
        <View style={styles.formCard}>
          {/* Weight Row */}
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Current Weight</Text>
            <View style={styles.formInputWrapper}>
              <TextInput
                style={styles.formInput}
                value={form.weight}
                onChangeText={(t) => setForm({ ...form, weight: t })}
                keyboardType="numeric"
                placeholder="--"
                placeholderTextColor={COLORS.label}
                maxLength={5}
              />
              <Text style={styles.formUnit}>kg</Text>
            </View>
          </View>

          <View style={styles.formDivider} />

          {/* Height Row */}
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Height</Text>
            <View style={styles.formInputWrapper}>
              <TextInput
                style={styles.formInput}
                value={form.height}
                onChangeText={(t) => setForm({ ...form, height: t })}
                keyboardType="numeric"
                placeholder="--"
                placeholderTextColor={COLORS.label}
                maxLength={5}
              />
              <Text style={styles.formUnit}>cm</Text>
            </View>
          </View>

          <View style={styles.formDivider} />

          {/* Age Row */}
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Age</Text>
            <View style={styles.formInputWrapper}>
              <TextInput
                style={styles.formInput}
                value={form.age}
                onChangeText={(t) => setForm({ ...form, age: t })}
                keyboardType="numeric"
                placeholder="--"
                placeholderTextColor={COLORS.label}
                maxLength={3}
              />
              <Text style={styles.formUnit}>years</Text>
            </View>
          </View>

          <View style={styles.formDivider} />

          {/* Gender Row */}
          <View style={styles.formRowVertical}>
            <Text style={styles.formLabel}>Gender</Text>
            <View style={styles.genderSelector}>
              {GENDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.genderOption,
                    form.gender === option.value && styles.genderOptionSelected,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setForm({ ...form, gender: option.value });
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.genderOptionText,
                      form.gender === option.value && styles.genderOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Tracking Settings Section */}
        <Text style={styles.sectionLabel}>TRACKING SETTINGS</Text>
        <View style={styles.formCard}>
          {/* Quit Date */}
          <View style={styles.formRowVertical}>
            <View style={styles.trackingHeader}>
              <View style={[styles.trackingIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                <Calendar size={18} color="#6366F1" strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.formLabel}>Quit Date</Text>
                <Text style={styles.trackingDescription}>When you started sugar-free</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.dateButton, !quitDate && styles.dateButtonLoading]}
              onPress={openDatePicker}
              activeOpacity={0.7}
              disabled={!quitDate}
            >
              <Text style={styles.dateButtonText}>
                {quitDate ? format(quitDate, 'MMM d, yyyy') : 'Loading...'}
              </Text>
              {quitDate ? (
                <Calendar size={16} color={COLORS.primary} />
              ) : (
                <ActivityIndicator size="small" color={COLORS.primary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Custom JS Date Picker Modal */}
          <Modal
            visible={showDatePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.datePickerModalOverlay}>
              <View style={styles.datePickerModalContent}>
                {/* Header */}
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Select Date</Text>
                  <TouchableOpacity onPress={handleConfirmDate}>
                    <Text style={styles.datePickerDone}>Done</Text>
                  </TouchableOpacity>
                </View>

                {/* Month Navigation */}
                <View style={styles.monthNav}>
                  <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.monthNavButton}>
                    <ChevronLeft size={24} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={styles.monthNavTitle}>
                    {format(pickerMonth, 'MMMM yyyy')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigateMonth('next')}
                    style={[styles.monthNavButton, !canGoNext() && styles.monthNavDisabled]}
                    disabled={!canGoNext()}
                  >
                    <ChevronRight size={24} color={canGoNext() ? COLORS.primary : COLORS.label} />
                  </TouchableOpacity>
                </View>

                {/* Day Headers */}
                <View style={styles.dayHeaders}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <Text key={day} style={styles.dayHeader}>{day}</Text>
                  ))}
                </View>

                {/* Calendar Grid */}
                <View style={styles.calendarGrid}>
                  {generatePickerDays().map((item, index) => {
                    if (!item.date) {
                      return <View key={index} style={styles.calendarDayEmpty} />;
                    }

                    const isSelected = tempDate &&
                      item.date.getDate() === tempDate.getDate() &&
                      item.date.getMonth() === tempDate.getMonth() &&
                      item.date.getFullYear() === tempDate.getFullYear();

                    const isToday =
                      item.date.getDate() === new Date().getDate() &&
                      item.date.getMonth() === new Date().getMonth() &&
                      item.date.getFullYear() === new Date().getFullYear();

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.calendarDay,
                          isSelected && styles.calendarDaySelected,
                          item.isDisabled && styles.calendarDayDisabled,
                        ]}
                        onPress={() => {
                          if (!item.isDisabled) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setTempDate(item.date!);
                          }
                        }}
                        disabled={item.isDisabled}
                      >
                        <Text style={[
                          styles.calendarDayText,
                          isSelected && styles.calendarDayTextSelected,
                          isToday && !isSelected && styles.calendarDayTextToday,
                          item.isDisabled && styles.calendarDayTextDisabled,
                        ]}>
                          {item.date.getDate()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </Modal>

          <View style={styles.formDivider} />

          {/* Weekly Spend */}
          <View style={styles.formRowVertical}>
            <View style={styles.trackingHeader}>
              <View style={[styles.trackingIcon, { backgroundColor: COLORS.primaryLight }]}>
                <Wallet size={18} color={COLORS.primary} strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.formLabel}>Weekly Spend</Text>
                <Text style={styles.trackingDescription}>Past spend on sweets</Text>
              </View>
            </View>
            <View style={styles.trackingInputWrapper}>
              <Text style={styles.inputPrefix}>$</Text>
              <TextInput
                style={styles.trackingInput}
                value={weeklySpend}
                onChangeText={(t) => setWeeklySpend(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="30"
                placeholderTextColor={COLORS.label}
                maxLength={5}
              />
            </View>
          </View>

          <View style={styles.formDivider} />

          {/* Daily Sugar */}
          <View style={styles.formRowVertical}>
            <View style={styles.trackingHeader}>
              <View style={[styles.trackingIcon, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
                <Candy size={18} color="#EC4899" strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.formLabel}>Daily Sugar</Text>
                <Text style={styles.trackingDescription}>Grams avoided per day</Text>
              </View>
            </View>
            <View style={styles.trackingInputWrapper}>
              <TextInput
                style={styles.trackingInput}
                value={dailySugar}
                onChangeText={(t) => setDailySugar(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor={COLORS.label}
                maxLength={4}
              />
              <Text style={styles.inputSuffix}>g</Text>
            </View>
          </View>

          <View style={styles.formDivider} />

          {/* Daily Calories */}
          <View style={styles.formRowVertical}>
            <View style={styles.trackingHeader}>
              <View style={[styles.trackingIcon, { backgroundColor: 'rgba(249, 115, 22, 0.1)' }]}>
                <Flame size={18} color="#F97316" strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.formLabel}>Daily Calories</Text>
                <Text style={styles.trackingDescription}>Calories avoided per day</Text>
              </View>
            </View>
            <View style={styles.trackingInputWrapper}>
              <TextInput
                style={styles.trackingInput}
                value={dailyCalories}
                onChangeText={(t) => setDailyCalories(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="400"
                placeholderTextColor={COLORS.label}
                maxLength={5}
              />
              <Text style={styles.inputSuffix}>cal</Text>
            </View>
          </View>
        </View>

        {/* Info Text */}
        <Text style={styles.infoText}>
          These settings help calculate your savings and progress on the dashboard.
        </Text>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Check size={18} color={COLORS.white} strokeWidth={2.5} />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Goal Card
  goalCard: {
    backgroundColor: COLORS.darkCard,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  goalCardLeft: {
    gap: 4,
  },
  goalLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  goalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.white,
  },
  goalBadge: {
    backgroundColor: COLORS.darkCardSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goalBadgeText: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '600',
  },

  // Section Label
  sectionLabel: {
    fontSize: 13,
    color: COLORS.label,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 16,
    letterSpacing: 0.5,
  },

  // Form Card
  formCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  formLabel: {
    fontSize: 17,
    color: COLORS.value,
    fontWeight: '400',
  },
  formInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  formInput: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.value,
    textAlign: 'right',
    minWidth: 50,
    paddingVertical: 0,
  },
  formUnit: {
    fontSize: 17,
    color: COLORS.label,
    fontWeight: '400',
  },
  formDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 16,
  },
  formRowVertical: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },

  // Gender Selector
  genderSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  genderOptionSelected: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  genderOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.label,
  },
  genderOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Tracking Settings
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingDescription: {
    fontSize: 13,
    color: COLORS.label,
    marginTop: 2,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.value,
  },
  dateButtonLoading: {
    opacity: 0.6,
  },
  trackingInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  trackingInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.value,
    paddingVertical: 12,
  },
  inputPrefix: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginRight: 4,
  },
  inputSuffix: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.label,
    marginLeft: 4,
  },

  // Info Text
  infoText: {
    fontSize: 13,
    color: COLORS.label,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
    lineHeight: 18,
  },

  // Save Button
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Date Picker Modal
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  datePickerModalContent: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  datePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.value,
  },
  datePickerCancel: {
    fontSize: 17,
    color: COLORS.label,
  },
  datePickerDone: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Month Navigation
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  monthNavButton: {
    padding: 8,
  },
  monthNavDisabled: {
    opacity: 0.3,
  },
  monthNavTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.value,
  },

  // Day Headers
  dayHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.label,
  },

  // Calendar Grid
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayEmpty: {
    width: '14.28%',
    aspectRatio: 1,
  },
  calendarDaySelected: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  calendarDayDisabled: {
    opacity: 0.3,
  },
  calendarDayText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.value,
  },
  calendarDayTextSelected: {
    color: COLORS.white,
    fontWeight: '600',
  },
  calendarDayTextToday: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  calendarDayTextDisabled: {
    color: COLORS.label,
  },
});
