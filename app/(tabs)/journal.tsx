/**
 * Nutrition Scanner Screen - Pro Edition
 *
 * Smart Food Logger & Sugar Detector with multi-input scanning:
 * - AI Food Recognition (Camera)
 * - Barcode Product Lookup
 * - Ingredients OCR Scanner
 * - Gallery Upload
 * - Manual Entry
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Easing,
  Alert,
  Image as RNImage,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, startOfWeek, addDays, isSameDay, isToday as isTodayFns } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { analyzeFoodImage, analyzeLabelImage } from '../../services/aiService';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { trackJournalEntry } from '../../services/AnalyticsService';
import { supabase } from '../../lib/supabase';
import {
  getLocalMeals,
  saveLocalMeals,
  fetchMealsFromDatabase,
  saveMealToDatabase,
  deleteMealFromDatabase,
  performLoginSync,
} from '../../services/UserDataService';
import {
  Utensils,
  Plus,
  X,
  Sun,
  Sunset,
  Moon,
  Coffee,
  CheckCircle,
  AlertCircle,
  Leaf,
  Sparkles,
  Camera,
  Image,
  ScanBarcode,
  FileText,
  PenLine,
  Crosshair,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Trash2,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// NOTE: Storage is now user-scoped via UserDataService
// The old MEALS_STORAGE_KEY is deprecated and migrated automatically

// Light Theme Colors
const COLORS = {
  background: '#F2F2F7',
  cardBackground: '#FFFFFF',
  headingText: '#1C1C1E',
  bodyText: '#3C3C43',
  mutedText: '#8E8E93',
  primary: '#10B981',
  primaryLight: 'rgba(16, 185, 129, 0.1)',
  primaryDark: '#059669',
  border: '#E5E7EB',

  // Sugar level colors
  safe: '#22C55E',
  safeLight: 'rgba(34, 197, 94, 0.12)',
  safeBg: '#DCFCE7',

  natural: '#F59E0B',
  naturalLight: 'rgba(245, 158, 11, 0.12)',
  naturalBg: '#FEF3C7',

  avoid: '#EF4444',
  avoidLight: 'rgba(239, 68, 68, 0.12)',
  avoidBg: '#FEE2E2',

  // Meal time colors
  morning: '#F59E0B',
  noon: '#3B82F6',
  evening: '#8B5CF6',
  snack: '#EC4899',

  // Scanner colors
  scannerBg: '#000000',
  laserRed: '#EF4444',
  ocrFrame: '#3B82F6',
};

// Meal types
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type SugarLevel = 'safe' | 'natural' | 'avoid';
type ScanMode = 'camera' | 'gallery' | 'barcode' | 'ocr' | 'manual' | null;

interface Meal {
  id: string;
  name: string;
  type: MealType;
  sugarLevel: SugarLevel;
  timestamp: number;
  scannedFrom?: ScanMode;
  imageUri?: string;
  verdict?: string;
  sugarContent?: string;
}

interface ScanResult {
  name: string;
  sugarLevel: SugarLevel;
  confidence: number;
  source: string;
  imageUri?: string;
  verdict?: string;
  sugarContent?: string;
}

// Meal type config
const MEAL_CONFIG: Record<MealType, { label: string; Icon: any; color: string }> = {
  breakfast: { label: 'Breakfast', Icon: Sun, color: COLORS.morning },
  lunch: { label: 'Lunch', Icon: Sunset, color: COLORS.noon },
  dinner: { label: 'Dinner', Icon: Moon, color: COLORS.evening },
  snack: { label: 'Snack', Icon: Coffee, color: COLORS.snack },
};

// Sugar level config
const SUGAR_CONFIG: Record<SugarLevel, { label: string; description: string; Icon: any; color: string; bgColor: string }> = {
  safe: {
    label: 'Safe',
    description: 'No added sugar',
    Icon: CheckCircle,
    color: COLORS.safe,
    bgColor: COLORS.safeBg
  },
  natural: {
    label: 'Natural',
    description: 'Fruit / Dairy',
    Icon: Leaf,
    color: COLORS.primary,
    bgColor: COLORS.primaryLight
  },
  avoid: {
    label: 'Avoid',
    description: 'High in sugar',
    Icon: AlertCircle,
    color: COLORS.avoid,
    bgColor: COLORS.avoidBg
  },
};

// Scanner options (2x2 grid)
const SCANNER_OPTIONS: { mode: ScanMode; label: string; description: string; Icon: any; color: string }[] = [
  { mode: 'camera', label: 'Scan Food', description: 'AI Recognition', Icon: Camera, color: '#8B5CF6' },
  { mode: 'gallery', label: 'Upload Photo', description: 'From Gallery', Icon: Image, color: '#3B82F6' },
  { mode: 'barcode', label: 'Scan Barcode', description: 'Product Lookup', Icon: ScanBarcode, color: '#EF4444' },
  { mode: 'ocr', label: 'Scan Label', description: 'Ingredients OCR', Icon: FileText, color: '#F59E0B' },
];

// Manual entry option (full width)
const MANUAL_OPTION = {
  mode: 'manual' as ScanMode,
  label: 'Manual Entry',
  description: 'Search or type food name',
  Icon: PenLine,
  color: '#10B981',
};

// Validate meal data integrity - filter out corrupted entries
const validateMeal = (obj: any): obj is Meal => {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.timestamp === 'number' &&
    ['breakfast', 'lunch', 'dinner', 'snack'].includes(obj.type) &&
    ['safe', 'natural', 'avoid'].includes(obj.sugarLevel)
  );
};

// OpenFoodFacts API for barcode lookup
const lookupBarcode = async (barcode: string): Promise<ScanResult | null> => {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
    );
    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return null; // Product not found
    }

    const product = data.product;
    const productName = product.product_name || product.product_name_en || 'Unknown Product';

    // Get sugar content from nutriments
    const sugars = product.nutriments?.sugars_100g || product.nutriments?.sugars || 0;
    const nutriscore = product.nutriscore_grade?.toLowerCase();

    // Determine sugar level based on sugar content per 100g
    // WHO recommends: <5g = low, 5-15g = moderate, >15g = high
    let sugarLevel: SugarLevel;
    if (sugars <= 5) {
      sugarLevel = 'safe';
    } else if (sugars <= 15) {
      sugarLevel = 'natural';
    } else {
      sugarLevel = 'avoid';
    }

    // Also consider nutriscore if available
    if (nutriscore === 'e' || nutriscore === 'd') {
      sugarLevel = 'avoid';
    } else if (nutriscore === 'a' && sugarLevel !== 'avoid') {
      sugarLevel = 'safe';
    }

    // Format sugar content string
    const sugarContent = sugars > 0
      ? `${sugars.toFixed(1)}g per 100g`
      : 'Sugar-free';

    // Generate verdict based on sugar level
    const verdict = sugarLevel === 'safe'
      ? 'Low sugar content. A healthy choice for your diet.'
      : sugarLevel === 'natural'
      ? 'Moderate sugar content. Consume in moderation.'
      : 'High sugar content. Consider healthier alternatives.';

    return {
      name: productName,
      sugarLevel,
      confidence: 100,
      source: 'OpenFoodFacts Barcode',
      sugarContent,
      verdict,
    };
  } catch (error) {
    return null;
  }
};

// Format time
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Format month/year for header
const getMonthYear = (): string => {
  return format(new Date(), 'MMMM yyyy'); // e.g., "December 2025"
};

// Check if timestamp matches a specific date (ignoring time)
const isSameDateAs = (timestamp: number, targetDate: Date): boolean => {
  return isSameDay(new Date(timestamp), targetDate);
};

// Get week days starting from Sunday
const getWeekDays = (referenceDate: Date): Date[] => {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 0 }); // Sunday
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
};

// Week Calendar Strip Component
const WeekCalendarStrip = ({
  selectedDate,
  onSelectDate,
  meals,
}: {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  meals: Meal[];
}) => {
  const weekDays = getWeekDays(selectedDate);
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Check if a date has meals
  const hasMeals = (date: Date): boolean => {
    return meals.some(m => isSameDateAs(m.timestamp, date));
  };

  return (
    <View style={styles.weekStrip}>
      {weekDays.map((day, index) => {
        const isSelected = isSameDay(day, selectedDate);
        const isCurrentDay = isTodayFns(day);
        const dayHasMeals = hasMeals(day);

        return (
          <Pressable
            key={index}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectDate(day);
            }}
            style={[
              styles.weekDay,
              isSelected && styles.weekDaySelected,
            ]}
          >
            <Text style={[
              styles.weekDayLabel,
              isSelected && styles.weekDayLabelSelected,
            ]}>
              {dayLabels[index]}
            </Text>
            <Text style={[
              styles.weekDayNumber,
              isSelected && styles.weekDayNumberSelected,
              isCurrentDay && !isSelected && styles.weekDayNumberToday,
            ]}>
              {format(day, 'd')}
            </Text>
            {/* Meal indicator dot */}
            {dayHasMeals && !isSelected && (
              <View style={styles.mealIndicatorDot} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
};

// Premium Stat Widget Card
const StatWidget = ({
  count,
  label,
  Icon,
  colors,
}: {
  count: number;
  label: string;
  Icon: any;
  colors: { bg: string; border: string; text: string };
}) => (
  <View style={[styles.statWidget, { backgroundColor: colors.bg, borderColor: colors.border }]}>
    <Icon size={18} color={colors.text} strokeWidth={2} />
    <Text style={[styles.statWidgetNumber, { color: colors.text }]}>{count}</Text>
    <Text style={[styles.statWidgetLabel, { color: colors.text }]}>{label}</Text>
  </View>
);

// Day Summary Stats - Premium 3-Card Widget Design
const DaySummaryStats = ({ meals }: { meals: Meal[] }) => {
  const safeMeals = meals.filter(m => m.sugarLevel === 'safe').length;
  const naturalMeals = meals.filter(m => m.sugarLevel === 'natural').length;
  const avoidMeals = meals.filter(m => m.sugarLevel === 'avoid').length;
  const totalMeals = meals.length;

  if (totalMeals === 0) {
    return null; // Don't show stats when no meals
  }

  // Widget color configurations
  const WIDGET_COLORS = {
    safe: {
      bg: '#ECFDF5',      // emerald-50
      border: '#D1FAE5',  // emerald-100
      text: '#047857',    // emerald-700
    },
    natural: {
      bg: '#FFFBEB',      // amber-50
      border: '#FEF3C7',  // amber-100
      text: '#B45309',    // amber-700
    },
    avoid: {
      bg: '#FFF1F2',      // rose-50
      border: '#FFE4E6',  // rose-100
      text: '#BE123C',    // rose-700
    },
  };

  return (
    <View style={styles.statsWidgetRow}>
      <StatWidget
        count={safeMeals}
        label="SAFE"
        Icon={ShieldCheck}
        colors={WIDGET_COLORS.safe}
      />
      <StatWidget
        count={naturalMeals}
        label="NATURAL"
        Icon={Sun}
        colors={WIDGET_COLORS.natural}
      />
      <StatWidget
        count={avoidMeals}
        label="AVOID"
        Icon={AlertTriangle}
        colors={WIDGET_COLORS.avoid}
      />
    </View>
  );
};

// Meal Card Component - Premium Edition with Photo Support
const MealCard = ({ meal, onPress }: { meal: Meal; onPress: () => void }) => {
  const mealConfig = MEAL_CONFIG[meal.type];
  const sugarConfig = SUGAR_CONFIG[meal.sugarLevel];
  const MealIcon = mealConfig.Icon;
  const SugarIcon = sugarConfig.Icon;
  // Robust image check - ensure it's a valid non-empty string
  const hasImage = meal.imageUri && typeof meal.imageUri === 'string' && meal.imageUri.length > 0;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.mealCard,
        pressed && styles.mealCardPressed,
      ]}
    >
      {/* Left Side - Fixed width container for Photo or Icon */}
      <View style={styles.mealVisualContainer}>
        {hasImage ? (
          <RNImage
            source={{ uri: meal.imageUri }}
            style={styles.mealImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.mealIconCircle, { backgroundColor: `${mealConfig.color}15` }]}>
            <MealIcon size={26} color={mealConfig.color} strokeWidth={1.8} />
          </View>
        )}
      </View>

      {/* Middle - Meal Details */}
      <View style={styles.mealInfo}>
        <Text style={styles.mealName} numberOfLines={2}>{meal.name}</Text>
        <Text style={styles.mealMeta}>
          {mealConfig.label} • {formatTime(meal.timestamp)}
        </Text>
      </View>

      {/* Right Side - Verdict Badge */}
      <View style={[styles.verdictBadge, { backgroundColor: sugarConfig.bgColor }]}>
        <SugarIcon size={14} color={sugarConfig.color} strokeWidth={2.5} />
        <Text style={[styles.verdictText, { color: sugarConfig.color }]}>
          {sugarConfig.label}
        </Text>
      </View>
    </Pressable>
  );
};

// Meal Detail Modal - View and Delete
const MealDetailModal = ({
  visible,
  meal,
  onClose,
  onDelete,
}: {
  visible: boolean;
  meal: Meal | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(0);
      backdropAnim.setValue(0);
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 1,
          damping: 22,
          mass: 1,
          stiffness: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!meal) return null;

  const mealConfig = MEAL_CONFIG[meal.type];
  const sugarConfig = SUGAR_CONFIG[meal.sugarLevel];
  const SugarIcon = sugarConfig.Icon;
  const hasImage = meal.imageUri && typeof meal.imageUri === 'string' && meal.imageUri.length > 0;

  // Format date for display
  const formatMealDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (isToday) {
      return `Today, ${timeStr}`;
    }

    return `${format(date, 'MMM d')}, ${timeStr}`;
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Meal?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onDelete(meal.id);
            onClose();
          },
        },
      ]
    );
  };

  const sheetTranslate = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  // Gradient colors based on sugar level
  const gradientColors: [string, string, string] =
    meal.sugarLevel === 'safe'
      ? ['#22C55E', '#16A34A', '#15803D']
      : meal.sugarLevel === 'natural'
      ? ['#F59E0B', '#D97706', '#B45309']
      : ['#EF4444', '#DC2626', '#B91C1C'];

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
    >
      {/* Dark Backdrop */}
      <Animated.View
        style={[
          detailStyles.backdrop,
          { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Bottom Sheet Container */}
      <View style={detailStyles.sheetWrapper}>
        <Animated.View
          style={[
            detailStyles.sheetContainer,
            { transform: [{ translateY: sheetTranslate }] },
          ]}
        >
          {/* Handle Bar */}
          <View style={detailStyles.handleBar} />

          {/* Compact Header */}
          {hasImage ? (
            <View style={detailStyles.compactImageHeader}>
              <RNImage
                source={{ uri: meal.imageUri }}
                style={detailStyles.compactImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)']}
                style={detailStyles.compactImageGradient}
              />
              {/* Status Badge on Image */}
              <View style={[detailStyles.compactBadgeOnImage, { backgroundColor: sugarConfig.color }]}>
                <SugarIcon size={12} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={detailStyles.compactBadgeText}>{sugarConfig.label}</Text>
              </View>
            </View>
          ) : (
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={detailStyles.compactGradientHeader}
            >
              {/* Decorative circles */}
              <View style={detailStyles.compactDecorCircle1} />
              <View style={detailStyles.compactDecorCircle2} />

              {/* Icon Circle */}
              <View style={detailStyles.compactIconCircle}>
                <SugarIcon size={36} color="#FFFFFF" strokeWidth={1.5} />
              </View>
            </LinearGradient>
          )}

          {/* Content Body */}
          <View style={detailStyles.compactContent}>
            {/* Food Title */}
            <Text style={detailStyles.compactTitle} numberOfLines={2}>
              {meal.name}
            </Text>

            {/* Time & Type Subtitle */}
            <Text style={detailStyles.compactSubtitle}>
              {formatMealDate(meal.timestamp)} • {mealConfig.label}
            </Text>

            {/* Status Badge (for no-image, show here) */}
            {!hasImage && (
              <View style={[detailStyles.compactStatusPill, { backgroundColor: `${sugarConfig.color}15` }]}>
                <SugarIcon size={14} color={sugarConfig.color} strokeWidth={2.5} />
                <Text style={[detailStyles.compactStatusText, { color: sugarConfig.color }]}>
                  {sugarConfig.label}
                </Text>
              </View>
            )}

            {/* Sugar Content */}
            {meal.sugarContent && (
              <View style={detailStyles.compactInfoRow}>
                <Text style={detailStyles.compactInfoLabel}>Sugar</Text>
                <Text style={detailStyles.compactInfoValue}>{meal.sugarContent}</Text>
              </View>
            )}

            {/* AI Verdict */}
            {meal.verdict && (
              <View style={detailStyles.compactVerdictBox}>
                <View style={detailStyles.compactVerdictHeader}>
                  <Sparkles size={14} color={COLORS.primary} strokeWidth={2} />
                  <Text style={detailStyles.compactVerdictTitle}>AI Analysis</Text>
                </View>
                <Text style={detailStyles.compactVerdictText} numberOfLines={3}>
                  {meal.verdict}
                </Text>
              </View>
            )}

            {/* Scan Source */}
            {meal.scannedFrom && (
              <View style={detailStyles.compactInfoRow}>
                <Text style={detailStyles.compactInfoLabel}>Source</Text>
                <Text style={detailStyles.compactInfoValue}>
                  {meal.scannedFrom === 'camera' ? 'AI Camera' :
                   meal.scannedFrom === 'gallery' ? 'Photo' :
                   meal.scannedFrom === 'barcode' ? 'Barcode' :
                   meal.scannedFrom === 'ocr' ? 'Label' : 'Manual'}
                </Text>
              </View>
            )}

            {/* Delete Button */}
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [
                detailStyles.compactDeleteButton,
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Trash2 size={16} color="#DC2626" strokeWidth={2} />
              <Text style={detailStyles.compactDeleteText}>Delete Entry</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Animated Spinner Component
const AnimatedSpinner = ({ color = '#FFFFFF' }: { color?: string }) => {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <Loader2 size={32} color={color} strokeWidth={2.5} />
    </Animated.View>
  );
};

// Scan Options Overlay (Clean floating design with smooth animations)
const ScanOptionsSheet = ({
  visible,
  onClose,
  onSelectOption,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (mode: ScanMode) => void;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  // Individual box animations for staggered effect
  const box1Anim = useRef(new Animated.Value(0)).current;
  const box2Anim = useRef(new Animated.Value(0)).current;
  const box3Anim = useRef(new Animated.Value(0)).current;
  const box4Anim = useRef(new Animated.Value(0)).current;
  const manualAnim = useRef(new Animated.Value(0)).current;
  const closeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset all animations
      fadeAnim.setValue(0);
      slideAnim.setValue(60);
      box1Anim.setValue(0);
      box2Anim.setValue(0);
      box3Anim.setValue(0);
      box4Anim.setValue(0);
      manualAnim.setValue(0);
      closeAnim.setValue(0);

      // Smooth entrance: fade + slide up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          mass: 0.9,
          stiffness: 180,
          useNativeDriver: true,
        }),
      ]).start();

      // Staggered box animations
      const staggerDelay = 50;
      Animated.stagger(staggerDelay, [
        Animated.spring(box1Anim, {
          toValue: 1,
          damping: 14,
          mass: 0.8,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.spring(box2Anim, {
          toValue: 1,
          damping: 14,
          mass: 0.8,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.spring(box3Anim, {
          toValue: 1,
          damping: 14,
          mass: 0.8,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.spring(box4Anim, {
          toValue: 1,
          damping: 14,
          mass: 0.8,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.spring(manualAnim, {
          toValue: 1,
          damping: 14,
          mass: 0.8,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.spring(closeAnim, {
          toValue: 1,
          damping: 14,
          mass: 0.8,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Quick fade out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 40,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Helper to get animation style for each box
  const getBoxStyle = (anim: Animated.Value, isGridItem: boolean = false) => ({
    opacity: anim,
    // Grid items need explicit width to maintain 2x2 layout
    ...(isGridItem && { width: '47%' }),
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1],
        }),
      },
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [15, 0],
        }),
      },
    ],
  });

  const boxAnims = [box1Anim, box2Anim, box3Anim, box4Anim];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Dark Overlay - Tap to dismiss */}
      <Animated.View style={[styles.overlayBackground, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Centered Floating Content with slide-up */}
        <Animated.View
          style={[
            styles.floatingContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Scanner Options Grid (2x2) with staggered animations */}
          <View style={styles.scannerGrid}>
            {SCANNER_OPTIONS.map((option, index) => (
              <Animated.View key={option.mode} style={getBoxStyle(boxAnims[index], true)}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onSelectOption(option.mode);
                  }}
                  style={({ pressed }) => [
                    styles.scannerCardFull,
                    pressed && styles.scannerCardPressed,
                  ]}
                >
                  <View style={styles.scannerIconContainer}>
                    <option.Icon size={28} color={COLORS.primary} strokeWidth={1.8} />
                  </View>
                  <Text style={styles.scannerLabel}>{option.label}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>

          {/* Manual Entry - Full Width Card with animation */}
          <Animated.View style={getBoxStyle(manualAnim)}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onSelectOption(MANUAL_OPTION.mode);
              }}
              style={({ pressed }) => [
                styles.manualEntryButton,
                pressed && styles.manualEntryButtonPressed,
              ]}
            >
              <View style={styles.scannerIconContainer}>
                <MANUAL_OPTION.Icon size={28} color={COLORS.primary} strokeWidth={1.8} />
              </View>
              <Text style={styles.scannerLabel}>{MANUAL_OPTION.label}</Text>
            </Pressable>
          </Animated.View>

          {/* Close Button (Below boxes) with animation */}
          <Animated.View style={[styles.closeButtonContainer, getBoxStyle(closeAnim)]}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
            >
              <X size={22} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.closeButtonLabel}>Close</Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// Scanner View Component (Real Camera with overlays)
const ScannerView = ({
  mode,
  onClose,
  onResult,
  onPhotoCapture,
}: {
  mode: ScanMode;
  onClose: () => void;
  onResult: (result: ScanResult) => void;
  onPhotoCapture?: (photoUri: string, captureMode: ScanMode) => void;
}) => {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingText, setProcessingText] = useState('');
  const [, setCameraReady] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const laserAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const barcodeProcessingRef = useRef(false);
  const cameraRef = useRef<any>(null);

  // Laser animation for barcode
  useEffect(() => {
    if (mode === 'barcode') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [mode]);

  // Pulse animation for crosshair
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Handle barcode detection (for barcode mode)
  const handleBarcodeScanned = async ({ data }: { data: string; type: string }) => {
    // Prevent multiple scans
    if (barcodeProcessingRef.current || isProcessing || scannedBarcode === data) {
      return;
    }

    barcodeProcessingRef.current = true;
    setScannedBarcode(data);
    setErrorMessage(null);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsProcessing(true);
    setProcessingText('Looking up product...');

    // Lookup barcode in OpenFoodFacts
    const result = await lookupBarcode(data);

    if (result) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onResult(result);
    } else {
      // Product not found
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(`Product not found for barcode: ${data}`);
      setIsProcessing(false);
      barcodeProcessingRef.current = false;
      // Allow re-scanning after 2 seconds
      setTimeout(() => {
        setScannedBarcode(null);
        setErrorMessage(null);
      }, 3000);
    }
  };

  // Handle manual capture (for camera/ocr modes)
  const handleManualCapture = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsProcessing(true);
    setErrorMessage(null);

    // Both camera and OCR modes now capture real photos
    setProcessingText(mode === 'ocr' ? 'Capturing label...' : 'Capturing photo...');

    try {
      if (!cameraRef.current) {
        throw new Error('Camera not ready');
      }

      // Take photo - use higher quality for OCR/label reading
      const photo = await cameraRef.current.takePictureAsync({
        quality: mode === 'ocr' ? 0.9 : 0.7, // Higher quality for label reading
        base64: false,
      });

      if (!photo?.uri) {
        throw new Error('Failed to capture photo');
      }

      // Pass photo to parent for processing with the premium scanning animation
      if (onPhotoCapture) {
        onPhotoCapture(photo.uri, mode);
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(error instanceof Error ? error.message : 'Capture failed');
      setIsProcessing(false);
    }
  };

  const getModeConfig = () => {
    switch (mode) {
      case 'camera':
        return {
          title: 'AI Food Scanner',
          instruction: 'Point at your food and tap capture',
          buttonText: 'Capture',
          overlayType: 'crosshair',
          isDemo: false,
        };
      case 'barcode':
        return {
          title: 'Barcode Scanner',
          instruction: 'Align barcode in frame',
          buttonText: 'Scanning...',
          overlayType: 'laser',
          isDemo: false,
        };
      case 'ocr':
        return {
          title: 'Label Scanner',
          instruction: 'Frame the Nutrition Facts label and tap capture',
          buttonText: 'Capture Label',
          overlayType: 'frame',
          isDemo: false,
        };
      default:
        return {
          title: 'Scanner',
          instruction: 'Point at food',
          buttonText: 'Scan',
          overlayType: 'crosshair',
          isDemo: true,
        };
    }
  };

  const config = getModeConfig();
  const laserTranslate = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 80],
  });

  // Permission not yet determined
  if (!permission) {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen">
        <View style={styles.permissionContainer}>
          <View style={styles.permissionCard}>
            <Camera size={48} color={COLORS.primary} strokeWidth={1.5} />
            <Text style={styles.permissionTitle}>Camera Access</Text>
            <Text style={styles.permissionText}>Loading camera permissions...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Permission denied - show request UI
  if (!permission.granted) {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen">
        <View style={styles.permissionContainer}>
          <SafeAreaView style={styles.permissionSafeArea}>
            <Pressable onPress={onClose} style={styles.permissionCloseButton}>
              <X size={24} color={COLORS.headingText} />
            </Pressable>
          </SafeAreaView>
          <View style={styles.permissionCard}>
            <View style={styles.permissionIconContainer}>
              <Camera size={48} color={COLORS.primary} strokeWidth={1.5} />
            </View>
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionText}>
              To scan food and barcodes, we need access to your camera.
            </Text>
            <Pressable
              onPress={requestPermission}
              style={({ pressed }) => [
                styles.permissionButton,
                pressed && styles.permissionButtonPressed,
              ]}
            >
              <Text style={styles.permissionButtonText}>Grant Access</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.permissionCancelButton}>
              <Text style={styles.permissionCancelText}>Maybe Later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={styles.scannerContainer}>
        {/* Real Camera View */}
        <View style={styles.cameraView}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
            // Enable barcode scanning for barcode mode
            barcodeScannerSettings={mode === 'barcode' ? {
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'qr'],
            } : undefined}
            onBarcodeScanned={mode === 'barcode' && !isProcessing ? handleBarcodeScanned : undefined}
          />

          {/* Overlay based on mode */}
          {config.overlayType === 'crosshair' && (
            <Animated.View
              style={[
                styles.crosshairContainer,
                { transform: [{ scale: pulseAnim }] }
              ]}
            >
              <View style={styles.crosshairCorner} />
              <View style={[styles.crosshairCorner, styles.crosshairTopRight]} />
              <View style={[styles.crosshairCorner, styles.crosshairBottomLeft]} />
              <View style={[styles.crosshairCorner, styles.crosshairBottomRight]} />
              <Crosshair size={40} color="rgba(255,255,255,0.8)" strokeWidth={1.5} />
            </Animated.View>
          )}

          {config.overlayType === 'laser' && (
            <View style={styles.barcodeFrame}>
              <View style={styles.barcodeFrameBorder} />
              <Animated.View
                style={[
                  styles.laserLine,
                  { transform: [{ translateY: laserTranslate }] }
                ]}
              />
              <View style={styles.barcodeHint}>
                <ScanBarcode size={20} color="#FFFFFF" />
                <Text style={styles.barcodeHintText}>
                  {scannedBarcode ? `Scanned: ${scannedBarcode}` : 'Point at any barcode'}
                </Text>
              </View>
            </View>
          )}

          {config.overlayType === 'frame' && (
            <View style={styles.ocrFrame}>
              <View style={styles.ocrFrameBorder}>
                <FileText size={24} color={COLORS.ocrFrame} />
              </View>
              <Text style={styles.ocrHintText}>Position text here</Text>
            </View>
          )}

          {/* Error Message Overlay */}
          {errorMessage && !isProcessing && (
            <View style={styles.errorOverlay}>
              <View style={styles.errorCard}>
                <AlertCircle size={32} color={COLORS.avoid} />
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Text style={styles.errorHint}>Try another barcode or use Manual Entry</Text>
              </View>
            </View>
          )}

          {/* Processing Overlay */}
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <View style={styles.processingCard}>
                <AnimatedSpinner color={COLORS.primary} />
                <Text style={styles.processingText}>{processingText}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Header */}
        <View style={[styles.scannerHeader, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={onClose} style={styles.scannerCloseButton}>
            <X size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.scannerTitle}>{config.title}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Bottom Controls */}
        <SafeAreaView style={styles.scannerControls} edges={['bottom']}>
          <Text style={styles.scannerInstruction}>{config.instruction}</Text>
          {/* Show capture button for camera/ocr modes, barcode auto-detects */}
          {mode !== 'barcode' ? (
            <Pressable
              onPress={handleManualCapture}
              disabled={isProcessing}
              style={({ pressed }) => [
                styles.captureButton,
                pressed && !isProcessing && styles.captureButtonPressed,
                isProcessing && styles.captureButtonDisabled,
              ]}
            >
              {mode === 'camera' ? (
                <View style={styles.captureButtonInner} />
              ) : (
                <Text style={styles.captureButtonText}>{config.buttonText}</Text>
              )}
            </Pressable>
          ) : (
            // For barcode mode - show scanning indicator
            <View style={styles.scanningIndicator}>
              {!isProcessing && !errorMessage && (
                <>
                  <AnimatedSpinner color="#FFFFFF" />
                  <Text style={styles.scanningText}>Scanning for barcodes...</Text>
                </>
              )}
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

// Premium Log Meal Modal Component with Hero Image Layout
const LogMealModal = ({
  visible,
  onClose,
  onSave,
  prefillData,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (meal: Omit<Meal, 'id' | 'timestamp'>) => void;
  prefillData?: {
    name: string;
    sugarLevel: SugarLevel;
    source: string;
    confidence: number;
    imageUri?: string;
    verdict?: string;
    sugarContent?: string;
  } | null;
}) => {
  const [foodName, setFoodName] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [sugarLevel, setSugarLevel] = useState<SugarLevel | null>(null);
  const [scannedFrom, setScannedFrom] = useState<ScanMode>(null);
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [verdict, setVerdict] = useState<string | undefined>(undefined);
  const [sugarContent, setSugarContent] = useState<string | undefined>(undefined);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Auto-select meal type based on current time
  const getDefaultMealType = (): MealType => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 15 && hour < 18) return 'snack';
    return 'dinner';
  };

  // Apply prefill data when it changes
  useEffect(() => {
    if (prefillData) {
      setFoodName(prefillData.name);
      setSugarLevel(prefillData.sugarLevel);
      setScannedFrom(prefillData.source as ScanMode);
      setMealType(getDefaultMealType());
      setImageUri(prefillData.imageUri);
      setVerdict(prefillData.verdict);
      setSugarContent(prefillData.sugarContent);
    } else {
      setFoodName('');
      setSugarLevel(null);
      setScannedFrom(null);
      setMealType(getDefaultMealType());
      setImageUri(undefined);
      setVerdict(undefined);
      setSugarContent(undefined);
    }
  }, [prefillData]);

  // Animate content sheet on mount
  useEffect(() => {
    if (visible) {
      slideAnim.setValue(0);
      Animated.spring(slideAnim, {
        toValue: 1,
        damping: 20,
        mass: 1,
        stiffness: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleSave = () => {
    if (!foodName.trim() || !sugarLevel) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({
      name: foodName.trim(),
      type: mealType,
      sugarLevel,
      scannedFrom,
      imageUri,
      verdict,
      sugarContent,
    });

    setFoodName('');
    setMealType('lunch');
    setSugarLevel(null);
    setScannedFrom(null);
    setImageUri(undefined);
    setVerdict(undefined);
    setSugarContent(undefined);
    onClose();
  };

  const isValid = foodName.trim().length > 0 && sugarLevel !== null;
  const hasImage = prefillData?.imageUri;

  // Get verdict badge config
  const getVerdictConfig = (level: SugarLevel) => {
    switch (level) {
      case 'safe':
        return {
          label: 'Safe Choice',
          Icon: ShieldCheck,
          color: COLORS.safe,
          bgColor: 'rgba(34, 197, 94, 0.95)',
        };
      case 'natural':
        return {
          label: 'Natural Sugars',
          Icon: Leaf,
          color: COLORS.primary,
          bgColor: 'rgba(16, 185, 129, 0.95)',
        };
      case 'avoid':
        return {
          label: 'High Sugar',
          Icon: AlertTriangle,
          color: COLORS.avoid,
          bgColor: 'rgba(239, 68, 68, 0.95)',
        };
    }
  };

  // Dynamic theme color based on verdict
  const themeColor = sugarLevel ? SUGAR_CONFIG[sugarLevel].color : COLORS.primary;

  // Content sheet animation
  const contentTranslate = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={premiumStyles.container}>
        {/* Hero Image Section (Top 38%) */}
        {hasImage ? (
          <View style={premiumStyles.heroContainer}>
            <RNImage
              source={{ uri: prefillData.imageUri }}
              style={premiumStyles.heroImage}
              resizeMode="cover"
            />
            {/* Gradient Overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
              locations={[0, 0.5, 1]}
              style={premiumStyles.heroGradient}
            />

            {/* Floating Close Button - Same as ScannerView */}
            <SafeAreaView style={premiumStyles.heroCloseContainer} edges={['top']}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  premiumStyles.heroCloseButton,
                  pressed && premiumStyles.heroCloseButtonPressed,
                ]}
              >
                <X size={24} color="#FFFFFF" />
              </Pressable>
            </SafeAreaView>

            {/* Floating Verdict Badge */}
            {prefillData?.sugarLevel && (
              <View style={premiumStyles.verdictBadgeContainer}>
                <View
                  style={[
                    premiumStyles.verdictBadge,
                    { backgroundColor: getVerdictConfig(prefillData.sugarLevel).bgColor },
                  ]}
                >
                  {(() => {
                    const config = getVerdictConfig(prefillData.sugarLevel);
                    return (
                      <>
                        <config.Icon size={20} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={premiumStyles.verdictBadgeText}>{config.label}</Text>
                      </>
                    );
                  })()}
                </View>
              </View>
            )}
          </View>
        ) : (
          /* Digital Product Card Header for Barcode/Manual Entry */
          <View style={premiumStyles.fallbackHeader}>
            {(() => {
              // Determine gradient colors based on sugar level
              const effectiveLevel = prefillData?.sugarLevel || sugarLevel;
              const gradientColors: [string, string, string] = effectiveLevel === 'safe'
                ? ['#22C55E', '#16A34A', '#15803D'] // Green gradient
                : effectiveLevel === 'natural'
                ? ['#10B981', '#059669', '#047857'] // Mint/Emerald gradient
                : effectiveLevel === 'avoid'
                ? ['#EF4444', '#DC2626', '#B91C1C'] // Red gradient
                : [COLORS.primary, COLORS.primaryDark, '#065F46']; // Default mint

              // Determine icon based on sugar level
              const IconComponent = effectiveLevel === 'safe'
                ? ShieldCheck
                : effectiveLevel === 'natural'
                ? Leaf
                : effectiveLevel === 'avoid'
                ? AlertTriangle
                : prefillData?.source?.toLowerCase().includes('barcode')
                ? ScanBarcode
                : Utensils;

              // Get title and subtitle based on context
              const title = effectiveLevel
                ? prefillData?.name || 'Product Scanned'
                : 'Log Your Meal';
              const subtitle = effectiveLevel
                ? effectiveLevel === 'safe'
                  ? 'Safe Choice'
                  : effectiveLevel === 'natural'
                  ? 'Natural Sugars'
                  : 'High Sugar Alert'
                : 'Track what fuels your body';

              return (
                <>
                  <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={premiumStyles.fallbackGradient}
                  >
                    {/* Decorative Background Elements */}
                    <View style={premiumStyles.productCardBgDecor}>
                      <View style={premiumStyles.decorCircle1} />
                      <View style={premiumStyles.decorCircle2} />
                      <View style={premiumStyles.decorCircle3} />
                    </View>

                    <View style={premiumStyles.fallbackHeaderContent}>
                      {/* Large Icon Circle - Premium Design */}
                      <View style={premiumStyles.productCardIconOuter}>
                        <View style={premiumStyles.productCardIconCircle}>
                          <IconComponent size={44} color="#FFFFFF" strokeWidth={1.5} />
                        </View>
                      </View>

                      {/* Scanned Product Label */}
                      <Text style={premiumStyles.productCardLabel}>SCANNED PRODUCT</Text>

                      {/* Product Name / Title */}
                      <Text style={premiumStyles.productCardTitle} numberOfLines={2}>
                        {title}
                      </Text>

                      {/* Status Badge */}
                      <View style={premiumStyles.statusBadge}>
                        <IconComponent size={14} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={premiumStyles.statusBadgeText}>{subtitle}</Text>
                      </View>

                      {/* Sugar Content Display */}
                      {prefillData?.sugarContent && prefillData.sugarContent !== 'N/A' && (
                        <View style={premiumStyles.sugarContentBadge}>
                          <Text style={premiumStyles.sugarContentText}>
                            {prefillData.sugarContent}
                          </Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>

                  {/* Close Button - positioned outside gradient like image hero */}
                  <SafeAreaView style={premiumStyles.heroCloseContainer} edges={['top']}>
                    <Pressable
                      onPress={onClose}
                      style={({ pressed }) => [
                        premiumStyles.heroCloseButton,
                        pressed && premiumStyles.heroCloseButtonPressed,
                      ]}
                    >
                      <X size={24} color="#FFFFFF" />
                    </Pressable>
                  </SafeAreaView>
                </>
              );
            })()}
          </View>
        )}

        {/* Content Sheet (Bottom 62%) */}
        <Animated.View
          style={[
            premiumStyles.contentSheet,
            hasImage && premiumStyles.contentSheetWithImage,
            { transform: [{ translateY: contentTranslate }] },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              style={premiumStyles.scrollView}
              contentContainerStyle={premiumStyles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Drag Handle */}
              {hasImage && <View style={premiumStyles.dragHandle} />}

              {/* Food Name - Large Editable Title */}
              <View style={premiumStyles.titleSection}>
                <TextInput
                  style={premiumStyles.foodNameInput}
                  placeholder="What are you eating?"
                  placeholderTextColor={COLORS.mutedText}
                  value={foodName}
                  onChangeText={setFoodName}
                  multiline={false}
                  autoFocus={!hasImage}
                />
                {prefillData?.sugarLevel && (
                  <View style={[premiumStyles.editHint]}>
                    <Text style={premiumStyles.editHintText}>Tap to edit</Text>
                  </View>
                )}
              </View>

              {/* AI Verdict Explanation */}
              {prefillData?.verdict && (
                <View style={premiumStyles.verdictSection}>
                  <View style={premiumStyles.verdictHeader}>
                    <Sparkles size={16} color={themeColor} />
                    <Text style={[premiumStyles.verdictLabel, { color: themeColor }]}>
                      AI Analysis
                    </Text>
                  </View>
                  <Text style={premiumStyles.verdictText}>{prefillData.verdict}</Text>
                </View>
              )}

              {/* Meal Type - Compact Chip Row */}
              <View style={premiumStyles.mealTypeSection}>
                <Text style={premiumStyles.chipSectionLabel}>MEAL TYPE</Text>
                <View style={premiumStyles.mealTypeChipRow}>
                  {(Object.keys(MEAL_CONFIG) as MealType[]).map((type) => {
                    const config = MEAL_CONFIG[type];
                    const isSelected = mealType === type;
                    const IconComponent = config.Icon;

                    return (
                      <Pressable
                        key={type}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setMealType(type);
                        }}
                        style={[
                          premiumStyles.mealChip,
                          isSelected && premiumStyles.mealChipActive,
                        ]}
                      >
                        <IconComponent
                          size={14}
                          color={isSelected ? '#FFFFFF' : '#64748B'}
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            premiumStyles.mealChipText,
                            isSelected && premiumStyles.mealChipTextActive,
                          ]}
                        >
                          {config.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Sugar Level - Traffic Light Row */}
              <View style={premiumStyles.sugarSection}>
                <Text style={premiumStyles.chipSectionLabel}>SUGAR LEVEL</Text>
                <View style={premiumStyles.trafficLightRow}>
                  {(Object.keys(SUGAR_CONFIG) as SugarLevel[]).map((level) => {
                    const isSelected = sugarLevel === level;
                    const IconComponent = level === 'safe' ? CheckCircle : level === 'natural' ? Leaf : AlertCircle;

                    // Traffic light colors
                    const levelColors = {
                      safe: { bg: '#DCFCE7', border: '#22C55E', text: '#15803D' },
                      natural: { bg: '#D1FAE5', border: '#10B981', text: '#047857' },
                      avoid: { bg: '#FEE2E2', border: '#EF4444', text: '#B91C1C' },
                    };
                    const colors = levelColors[level];

                    return (
                      <Pressable
                        key={level}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setSugarLevel(level);
                        }}
                        style={[
                          premiumStyles.trafficLightCard,
                          isSelected ? {
                            backgroundColor: colors.bg,
                            borderColor: colors.border,
                            borderWidth: 2,
                          } : premiumStyles.trafficLightCardInactive,
                        ]}
                      >
                        <IconComponent
                          size={20}
                          color={isSelected ? colors.text : '#94A3B8'}
                          strokeWidth={2.5}
                        />
                        <Text
                          style={[
                            premiumStyles.trafficLightLabel,
                            isSelected ? { color: colors.text } : { color: '#94A3B8' },
                          ]}
                        >
                          {level === 'safe' ? 'Safe' : level === 'natural' ? 'Natural' : 'Avoid'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Dynamic Save Button */}
            <View style={premiumStyles.footer}>
              <Pressable
                onPress={handleSave}
                disabled={!isValid}
                style={({ pressed }) => [
                  premiumStyles.saveButton,
                  { backgroundColor: isValid ? themeColor : COLORS.mutedText },
                  pressed && isValid && premiumStyles.saveButtonPressed,
                ]}
              >
                <CheckCircle size={22} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={premiumStyles.saveButtonText}>
                  {prefillData ? 'Save to Journal' : 'Log Meal'}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Premium Modal Styles
const premiumStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // Hero Image Section
  heroContainer: {
    height: SCREEN_HEIGHT * 0.38,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroCloseContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingRight: 16,
    paddingTop: 54, // Increased from 8 to clear status bar/notch area
  },
  heroCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCloseButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    transform: [{ scale: 0.95 }],
  },

  // Verdict Badge
  verdictBadgeContainer: {
    position: 'absolute',
    bottom: -20,
    left: 20,
    zIndex: 10,
  },
  verdictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  verdictBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Digital Product Card Header (Barcode/Manual Entry)
  fallbackHeader: {
    height: SCREEN_HEIGHT * 0.38, // Match hero container height
    overflow: 'hidden',
    position: 'relative',
  },
  fallbackGradient: {
    flex: 1,
    position: 'relative',
  },
  productCardBgDecor: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: -60,
    right: -40,
  },
  decorCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    bottom: -30,
    left: -50,
  },
  decorCircle3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    top: 80,
    left: 30,
  },
  fallbackHeaderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  fallbackCloseHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fallbackCloseButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productCardIconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  productCardIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    // Subtle glow effect
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  productCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  productCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    marginBottom: 6,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sugarContentBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 16,
    marginTop: 2,
  },
  sugarContentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Content Sheet
  contentSheet: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    overflow: 'hidden',
  },
  contentSheetWithImage: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },

  // Food Name Title
  titleSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  foodNameInput: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.headingText,
    letterSpacing: -0.5,
    paddingVertical: 8,
    paddingHorizontal: 0,
    textAlign: 'left',
    width: '100%',
  },
  editHint: {
    marginTop: 4,
  },
  editHintText: {
    fontSize: 13,
    color: COLORS.mutedText,
  },

  // Verdict Section
  verdictSection: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  verdictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  verdictLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  verdictText: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
  },

  // Section Labels - Compact & Modern
  mealTypeSection: {
    marginBottom: 16,
  },
  chipSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Meal Type - Compact Chip Row
  mealTypeChipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  mealChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  mealChipActive: {
    backgroundColor: '#1E293B',
  },
  mealChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  mealChipTextActive: {
    color: '#FFFFFF',
  },

  // Sugar Level - Traffic Light Row
  sugarSection: {
    marginBottom: 20,
  },
  trafficLightRow: {
    flexDirection: 'row',
    gap: 10,
  },
  trafficLightCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    gap: 6,
  },
  trafficLightCardInactive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trafficLightLabel: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Footer
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

// Main Component
export default function NutritionScreen() {
  const router = useRouter();
  const { isPro } = useSubscription();

  const [meals, setMeals] = useState<Meal[]>([]);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerMode, setScannerMode] = useState<ScanMode>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [prefillData, setPrefillData] = useState<{
    name: string;
    sugarLevel: SugarLevel;
    source: string;
    confidence: number;
    imageUri?: string;
    verdict?: string;
    sugarContent?: string;
  } | null>(null);
  const [, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load meals from user-scoped storage with database sync
  const loadMeals = useCallback(async () => {
    try {
      // Get current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // No user logged in - clear meals and return
        setMeals([]);
        setCurrentUserId(null);
        setLoading(false);
        return;
      }

      // Check if this is a different user than before
      if (currentUserId !== null && currentUserId !== user.id) {
        // User changed - clear old data first
        setMeals([]);
      }

      setCurrentUserId(user.id);

      // Use UserDataService for user-scoped storage with database sync
      const { meals: loadedMeals } = await performLoginSync(user.id);

      // Filter out corrupted entries, keep only valid meals
      const validMeals = loadedMeals.filter(validateMeal);
      setMeals(validMeals);
    } catch (error) {
      console.error('[Journal] Failed to load meals:', error);
      // Silently handle errors - start fresh
      setMeals([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Refetch meals when screen comes into focus (critical for data sync)
  useFocusEffect(
    useCallback(() => {
      loadMeals();
    }, [loadMeals])
  );

  // Save meals to user-scoped storage with database sync
  const saveMeals = useCallback(async (newMeals: Meal[], previousMeals: Meal[], newMeal?: Meal) => {
    try {
      if (!currentUserId) {
        console.warn('[Journal] Cannot save meals - no user logged in');
        return;
      }

      // Save to user-scoped local storage first
      await saveLocalMeals(currentUserId, newMeals);

      // Sync new meal to database (if provided)
      // This also uploads images and returns the permanent URL
      if (newMeal) {
        const permanentImageUri = await saveMealToDatabase(newMeal);

        // If image was uploaded, update local storage with permanent URL
        if (permanentImageUri && permanentImageUri !== newMeal.imageUri) {
          const updatedMeals = newMeals.map(m =>
            m.id === newMeal.id ? { ...m, imageUri: permanentImageUri } : m
          );
          await saveLocalMeals(currentUserId, updatedMeals);
          // Update state with permanent URL
          setMeals(updatedMeals);
        }
      }
    } catch (error) {
      console.error('[Journal] Failed to save meals:', error);
      // Rollback on storage failure
      setMeals(previousMeals);
      Alert.alert('Error', 'Failed to save. Please try again.');
    }
  }, [currentUserId]);

  // Add new meal with functional update and database sync
  const handleAddMeal = useCallback((mealData: Omit<Meal, 'id' | 'timestamp'>) => {
    const newMeal: Meal = {
      ...mealData,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };

    // Track journal entry for analytics funnel
    trackJournalEntry(newMeal.name, newMeal.sugarLevel);

    setMeals(prevMeals => {
      const updatedMeals = [newMeal, ...prevMeals];
      saveMeals(updatedMeals, prevMeals, newMeal);
      return updatedMeals;
    });
    setPrefillData(null);
  }, [saveMeals]);

  // Delete meal with database sync
  const handleDeleteMeal = useCallback((id: string) => {
    setMeals(prevMeals => {
      const updatedMeals = prevMeals.filter(m => m.id !== id);
      saveMeals(updatedMeals, prevMeals);
      // Also delete from database
      deleteMealFromDatabase(id);
      return updatedMeals;
    });
  }, [saveMeals]);

  // Open meal detail
  const openMealDetail = useCallback((meal: Meal) => {
    setSelectedMeal(meal);
    setShowDetailModal(true);
  }, []);

  // State for image processing animation (used by both gallery and camera)
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [processingImageUri, setProcessingImageUri] = useState<string | null>(null);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Scanning line animation effect
  useEffect(() => {
    if (isImageProcessing && processingImageUri) {
      const runScanAnimation = () => {
        scanLineAnim.setValue(0);
        Animated.loop(
          Animated.sequence([
            Animated.timing(scanLineAnim, {
              toValue: 1,
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scanLineAnim, {
              toValue: 0,
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start();
      };
      runScanAnimation();
    }
  }, [isImageProcessing, processingImageUri]);

  // Handle gallery image picker with real AI analysis
  const pickImageFromGallery = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant access to your photo library to upload food photos.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;

      // Show processing indicator with image
      setProcessingImageUri(imageUri);
      setIsImageProcessing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        // Analyze with GPT-4o
        const aiResult = await analyzeFoodImage(imageUri);

        setIsImageProcessing(false);
        setProcessingImageUri(null);

        if ('error' in aiResult) {
          // AI analysis failed
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            'Analysis Failed',
            aiResult.message,
            [
              { text: 'Try Again', onPress: () => pickImageFromGallery() },
              { text: 'Manual Entry', onPress: () => { setPrefillData(null); setShowLogModal(true); } },
            ]
          );
          return;
        }

        // Check if AI couldn't identify food
        if (aiResult.name === 'Not Food') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Alert.alert(
            'Food Not Recognized',
            aiResult.verdict || 'Please take a clear photo of the food item.',
            [
              {
                text: 'Try Again',
                onPress: () => pickImageFromGallery(),
              },
              {
                text: 'Manual Entry',
                onPress: () => {
                  setPrefillData(null);
                  setShowLogModal(true);
                },
              },
            ]
          );
          return;
        }

        // Success - show result with image and verdict
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPrefillData({
          name: aiResult.name,
          sugarLevel: aiResult.sugarLevel,
          source: aiResult.source,
          confidence: aiResult.confidence,
          imageUri: imageUri,
          verdict: aiResult.verdict,
          sugarContent: aiResult.sugarContent,
        });
        setShowLogModal(true);
      } catch (error) {
        setIsImageProcessing(false);
        setProcessingImageUri(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Error',
          'Failed to analyze image. Please try again.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  // Handle scan option selection
  const handleSelectScanOption = async (mode: ScanMode) => {
    setShowScanOptions(false);

    if (mode === 'manual') {
      // Manual entry is free - no AI required
      setPrefillData(null);
      setShowLogModal(true);
    } else {
      // AI-powered features require Pro subscription
      if (!isPro) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        router.push('/paywall');
        return;
      }

      if (mode === 'gallery') {
        // Handle gallery separately - doesn't need camera
        await pickImageFromGallery();
      } else {
        // Camera, Barcode, OCR - use camera view
        setScannerMode(mode);
        setShowScanner(true);
      }
    }
  };

  // Handle scan result
  const handleScanResult = (result: ScanResult) => {
    setShowScanner(false);
    setScannerMode(null);
    setPrefillData({
      name: result.name,
      sugarLevel: result.sugarLevel,
      source: result.source,
      confidence: result.confidence,
      imageUri: result.imageUri,
      verdict: result.verdict,
      sugarContent: result.sugarContent,
    });
    setShowLogModal(true);
  };

  // Handle camera photo capture - show premium scanning animation
  const handlePhotoCapture = async (photoUri: string, captureMode: ScanMode = 'camera') => {
    // Close scanner and show scanning animation
    setShowScanner(false);
    setScannerMode(null);
    setProcessingImageUri(photoUri);
    setIsImageProcessing(true);

    const isLabelMode = captureMode === 'ocr';

    try {
      // Use appropriate AI analysis based on mode
      const aiResult = isLabelMode
        ? await analyzeLabelImage(photoUri)
        : await analyzeFoodImage(photoUri);

      setIsImageProcessing(false);
      setProcessingImageUri(null);

      if ('error' in aiResult) {
        // AI analysis failed
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          isLabelMode ? 'Label Analysis Failed' : 'Analysis Failed',
          aiResult.message,
          [
            { text: 'Try Again', onPress: () => { setScannerMode(captureMode); setShowScanner(true); } },
            { text: 'Manual Entry', onPress: () => { setPrefillData(null); setShowLogModal(true); } },
          ]
        );
        return;
      }

      // Check if AI couldn't identify the content
      const notRecognized = isLabelMode
        ? aiResult.name === 'Not a Label'
        : aiResult.name === 'Not Food';

      if (notRecognized) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          isLabelMode ? 'Label Not Recognized' : 'Food Not Recognized',
          aiResult.verdict || (isLabelMode
            ? 'Please take a clear photo of the Nutrition Facts label.'
            : 'Please take a clear photo of the food item.'),
          [
            {
              text: 'Try Again',
              onPress: () => {
                setScannerMode(captureMode);
                setShowScanner(true);
              },
            },
            {
              text: 'Manual Entry',
              onPress: () => {
                setPrefillData(null);
                setShowLogModal(true);
              },
            },
          ]
        );
        return;
      }

      // Success - show result
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPrefillData({
        name: aiResult.name,
        sugarLevel: aiResult.sugarLevel,
        source: aiResult.source,
        confidence: aiResult.confidence,
        imageUri: photoUri,
        verdict: aiResult.verdict,
        sugarContent: aiResult.sugarContent,
      });
      setShowLogModal(true);
    } catch (error) {
      setIsImageProcessing(false);
      setProcessingImageUri(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        isLabelMode ? 'Failed to analyze label. Please try again.' : 'Failed to analyze image. Please try again.',
        [
          { text: 'Try Again', onPress: () => { setScannerMode(captureMode); setShowScanner(true); } },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  // Filter meals by selected date
  const filteredMeals = meals.filter(m => isSameDateAs(m.timestamp, selectedDate));
  const isSelectedDateToday = isTodayFns(selectedDate);

  // Get formatted date for section title
  const getSelectedDateLabel = () => {
    if (isSelectedDateToday) return 'Today';
    return format(selectedDate, 'EEEE, MMM d');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - Journal Title with Month/Year */}
        <View style={styles.header}>
          <Text style={styles.title}>Journal</Text>
          <Text style={styles.monthYearText}>{getMonthYear()}</Text>
        </View>

        {/* Week Calendar Strip */}
        <WeekCalendarStrip
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          meals={meals}
        />

        {/* Day Summary Stats - No Card Box */}
        <DaySummaryStats meals={filteredMeals} />

        {/* Food Timeline */}
        <View style={styles.timelineSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{getSelectedDateLabel()}</Text>
            <Text style={styles.sectionCount}>{filteredMeals.length} logged</Text>
          </View>

          {filteredMeals.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Utensils size={40} color={COLORS.mutedText} strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyTitle}>
                {isSelectedDateToday ? 'No meals logged yet' : 'No meals on this day'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {isSelectedDateToday
                  ? 'Tap the button below to scan or log your first meal.'
                  : 'Select today to log a new meal.'}
              </Text>
              {isSelectedDateToday ? (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowScanOptions(true);
                  }}
                  style={styles.emptyScanButton}
                >
                  <Camera size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.emptyScanButtonText}>Scan Meal</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedDate(new Date());
                  }}
                  style={styles.goToTodayButton}
                >
                  <Text style={styles.goToTodayText}>Go to Today</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.mealsList}>
              {filteredMeals.map((meal) => (
                <MealCard key={meal.id} meal={meal} onPress={() => openMealDetail(meal)} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setShowScanOptions(true);
        }}
        style={({ pressed }) => [
          styles.fab,
          pressed && styles.fabPressed,
        ]}
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
        <Text style={styles.fabText}>Log Meal</Text>
      </Pressable>

      {/* Scan Options Bottom Sheet */}
      <ScanOptionsSheet
        visible={showScanOptions}
        onClose={() => setShowScanOptions(false)}
        onSelectOption={handleSelectScanOption}
      />

      {/* Scanner View */}
      {showScanner && scannerMode && (
        <ScannerView
          mode={scannerMode}
          onClose={() => {
            setShowScanner(false);
            setScannerMode(null);
          }}
          onResult={handleScanResult}
          onPhotoCapture={handlePhotoCapture}
        />
      )}

      {/* Meal Detail Modal */}
      <MealDetailModal
        visible={showDetailModal}
        meal={selectedMeal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedMeal(null);
        }}
        onDelete={handleDeleteMeal}
      />

      {/* Log Meal Modal */}
      <LogMealModal
        visible={showLogModal}
        onClose={() => {
          setShowLogModal(false);
          setPrefillData(null);
        }}
        onSave={handleAddMeal}
        prefillData={prefillData}
      />

      {/* Full-Screen AI Scanning Experience */}
      {isImageProcessing && processingImageUri && (
        <Modal visible animationType="fade" transparent statusBarTranslucent>
          <View style={styles.scannerFullScreen}>
            {/* Dark Overlay Background */}
            <View style={styles.scannerDarkBg} />

            {/* Center Content */}
            <View style={styles.scannerCenterContent}>
              {/* Image Card with Scanner */}
              <View style={styles.scannerImageCard}>
                {/* The Image */}
                <RNImage
                  source={{ uri: processingImageUri }}
                  style={styles.scannerImage}
                  resizeMode="cover"
                />

                {/* Corner Brackets on Image */}
                <View style={styles.scannerCornerTL} />
                <View style={styles.scannerCornerTR} />
                <View style={styles.scannerCornerBL} />
                <View style={styles.scannerCornerBR} />

                {/* Animated Scanning Line Over Image */}
                <Animated.View
                  style={[
                    styles.scannerLaserLine,
                    {
                      transform: [
                        {
                          translateY: scanLineAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, SCREEN_WIDTH - 80],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['transparent', '#10B981', '#34D399', '#10B981', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.scannerLaserGradient}
                  />
                  <View style={styles.scannerLaserGlow} />
                </Animated.View>
              </View>

              {/* Text Below Image */}
              <View style={styles.scannerTextContent}>
                <View style={styles.scannerSpinnerRow}>
                  <AnimatedSpinner color="#10B981" />
                </View>
                <Text style={styles.scannerAnalyzingTitle}>Analyzing the image...</Text>
                <Text style={styles.scannerAnalyzingSubtitle}>This may take a few seconds</Text>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Premium off-white/slate background
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24, // Slightly more padding for premium feel
    paddingBottom: 130,
  },

  // Header - Journal Style
  header: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.headingText,
    letterSpacing: -0.5,
  },
  monthYearText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.mutedText,
    marginTop: 2,
  },

  // Week Calendar Strip
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingVertical: 8,
  },
  weekDay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    minWidth: 40,
  },
  weekDaySelected: {
    backgroundColor: COLORS.headingText,
  },
  weekDayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.mutedText,
    marginBottom: 4,
  },
  weekDayLabelSelected: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.headingText,
  },
  weekDayNumberSelected: {
    color: '#FFFFFF',
  },
  weekDayNumberToday: {
    color: COLORS.primary,
  },
  mealIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },

  // Stats Widget Row - Premium 3-Card Design
  statsWidgetRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statWidget: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  statWidgetNumber: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 6,
    marginBottom: 2,
  },
  statWidgetLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Go to Today Button
  goToTodayButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  goToTodayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Stats Section - No Card Box (Apple Health Style)
  statsSection: {
    marginBottom: 32,
    marginTop: 8,
  },
  hugeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  hugeStat: {
    alignItems: 'center',
    flex: 1,
  },
  hugeStatNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.headingText,
    letterSpacing: -1.5,
    marginBottom: 4,
  },
  hugeStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  hugeStatLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Slim Progress Bar
  slimProgressContainer: {
    alignItems: 'center',
  },
  slimProgressTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  slimProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  slimProgressLabel: {
    fontSize: 13,
    color: COLORS.mutedText,
    marginTop: 10,
    fontWeight: '500',
  },

  // Timeline Section
  timelineSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.headingText,
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 13,
    color: COLORS.mutedText,
    fontWeight: '500',
  },

  // Meal Card - Premium Compact
  mealsList: {
    gap: 12,
  },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  mealCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  // Fixed width container for meal visual (image or icon)
  mealVisualContainer: {
    width: 56,
    height: 56,
    marginRight: 14,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  mealImage: {
    width: '100%',
    height: '100%',
  },
  mealIconCircle: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealInfo: {
    flex: 1,
    paddingRight: 8,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.headingText,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  mealMeta: {
    fontSize: 13,
    color: COLORS.mutedText,
    fontWeight: '500',
  },
  verdictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  verdictText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // Empty State - Minimal
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.headingText,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.mutedText,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    marginTop: 20,
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyScanButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // FAB - Premium Floating Effect
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 105 : 90,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 32,
    gap: 10,
    // Stronger shadow for premium floating effect
    shadowColor: '#059669', // Darker green for shadow
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.95,
  },
  fabText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Scan Options Overlay (Floating on dark background - no container box)
  overlayBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
  },
  floatingContainer: {
    width: '100%',
    maxWidth: 340,
  },
  overlayHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  overlayTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  overlaySubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },

  // Scanner Grid (2x2)
  scannerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
    marginBottom: 16,
  },
  scannerCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  // Full width card for use inside animated wrapper
  scannerCardFull: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  scannerCardPressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: '#F2F2F7',
  },
  scannerIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  scannerLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.headingText,
    marginBottom: 4,
  },
  scannerDesc: {
    fontSize: 12,
    color: COLORS.mutedText,
    textAlign: 'center',
  },

  // Overlay Divider
  overlayDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  overlayDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  overlayDividerText: {
    paddingHorizontal: 16,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '500',
  },

  // Manual Entry Button (Full Width - spans both columns)
  manualEntryButton: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  manualEntryButtonPressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: '#F2F2F7',
  },
  manualIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  manualLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.headingText,
    marginBottom: 2,
  },
  manualDesc: {
    fontSize: 13,
    color: COLORS.mutedText,
  },
  manualArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualArrowText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Close Button (Below boxes)
  closeButtonContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  closeButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2A2A2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  closeButtonPressed: {
    backgroundColor: '#3A3A3E',
    transform: [{ scale: 0.95 }],
  },
  closeButtonLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },

  // Scanner View
  scannerContainer: {
    flex: 1,
    backgroundColor: COLORS.scannerBg,
  },
  cameraView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraSimBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraSimText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    marginTop: 12,
  },
  galleryPlaceholder: {
    alignItems: 'center',
  },
  galleryText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    marginTop: 12,
  },
  scannerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scannerCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scannerControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerInstruction: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 24,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  captureButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  captureButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.headingText,
    textAlign: 'center',
  },

  // Crosshair overlay
  crosshairContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairCorner: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 8,
  },
  crosshairTopRight: {
    left: undefined,
    right: 0,
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
  },
  crosshairBottomLeft: {
    top: undefined,
    bottom: 0,
    borderTopWidth: 0,
    borderBottomWidth: 3,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 8,
  },
  crosshairBottomRight: {
    top: undefined,
    left: undefined,
    right: 0,
    bottom: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 8,
  },

  // Barcode overlay
  barcodeFrame: {
    width: SCREEN_WIDTH - 80,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeFrameBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
  },
  laserLine: {
    width: '90%',
    height: 3,
    backgroundColor: COLORS.laserRed,
    borderRadius: 2,
    shadowColor: COLORS.laserRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  barcodeHint: {
    position: 'absolute',
    bottom: -40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barcodeHintText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },

  // OCR overlay
  ocrFrame: {
    width: SCREEN_WIDTH - 60,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrFrameBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: COLORS.ocrFrame,
    borderRadius: 12,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrHintText: {
    position: 'absolute',
    bottom: -30,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },

  // Processing overlay
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.headingText,
  },

  // Error Overlay
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.headingText,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 13,
    color: COLORS.mutedText,
    textAlign: 'center',
  },

  // Scanning Indicator (for barcode mode)
  scanningIndicator: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  scanningText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.headingText,
  },
  modalScrollView: {
    flex: 1,
  },
  modalContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Scan Result Banner
  scanResultBanner: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  scanResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  scanResultSource: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scanResultContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scanResultText: {
    flex: 1,
  },
  scanResultName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.headingText,
    marginBottom: 2,
  },
  scanResultLevel: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Input Sections
  inputSection: {
    marginBottom: 28,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.headingText,
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 14,
    color: COLORS.mutedText,
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.headingText,
    paddingVertical: 14,
    marginLeft: 12,
  },

  // Meal Type Grid
  mealTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mealTypeButton: {
    width: (SCREEN_WIDTH - 52) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 10,
  },
  mealTypeText: {
    fontSize: 15,
    color: COLORS.bodyText,
    fontWeight: '500',
  },

  // Sugar Level Selection
  sugarLevelContainer: {
    gap: 12,
  },
  sugarLevelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  sugarLevelIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sugarLevelLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.headingText,
    marginRight: 8,
  },
  sugarLevelDesc: {
    fontSize: 14,
    color: COLORS.mutedText,
    flex: 1,
    textAlign: 'right',
  },

  // Modal Footer
  modalFooter: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.mutedText,
    shadowOpacity: 0,
  },
  saveButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Permission Request UI
  permissionContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
  },
  permissionCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  permissionCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  permissionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.headingText,
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 15,
    color: COLORS.mutedText,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  permissionButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  permissionButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  permissionButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  permissionCancelButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  permissionCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.mutedText,
  },

  // Full-Screen AI Scanner - Centered Card Style
  scannerFullScreen: {
    flex: 1,
  },
  scannerDarkBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  scannerCenterContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  scannerImageCard: {
    width: SCREEN_WIDTH - 60,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  scannerImage: {
    width: '100%',
    height: '100%',
  },
  scannerLaserLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 3,
    zIndex: 10,
  },
  scannerLaserGradient: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  scannerLaserGlow: {
    position: 'absolute',
    left: '5%',
    right: '5%',
    top: -10,
    height: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  // Corner brackets on image
  scannerCornerTL: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#10B981',
    borderTopLeftRadius: 4,
  },
  scannerCornerTR: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#10B981',
    borderTopRightRadius: 4,
  },
  scannerCornerBL: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#10B981',
    borderBottomLeftRadius: 4,
  },
  scannerCornerBR: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#10B981',
    borderBottomRightRadius: 4,
  },
  scannerTextContent: {
    alignItems: 'center',
    marginTop: 32,
    gap: 8,
  },
  scannerSpinnerRow: {
    marginBottom: 8,
  },
  scannerAnalyzingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  scannerAnalyzingSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
  },
});

// Meal Detail Modal Styles - Compact Bottom Sheet
const detailStyles = StyleSheet.create({
  // Backdrop overlay
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },

  // Bottom sheet wrapper - aligns sheet to bottom
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  // The sheet container
  sheetContainer: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: SCREEN_HEIGHT * 0.70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },

  // Handle bar at top
  handleBar: {
    width: 48,
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },

  // Compact Image Header
  compactImageHeader: {
    height: 140,
    position: 'relative',
    overflow: 'hidden',
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
  compactImageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  compactBadgeOnImage: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  compactBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Compact Gradient Header (no image)
  compactGradientHeader: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  compactDecorCircle1: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  compactDecorCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  compactIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },

  // Content Body
  compactContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },

  // Food Title
  compactTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.headingText,
    letterSpacing: -0.3,
    marginBottom: 4,
  },

  // Subtitle (time & type)
  compactSubtitle: {
    fontSize: 13,
    color: COLORS.mutedText,
    marginBottom: 12,
  },

  // Status Pill (for no-image state)
  compactStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 5,
    marginBottom: 12,
  },
  compactStatusText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Info Row
  compactInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  compactInfoLabel: {
    fontSize: 14,
    color: COLORS.mutedText,
    fontWeight: '500',
  },
  compactInfoValue: {
    fontSize: 14,
    color: COLORS.headingText,
    fontWeight: '600',
  },

  // AI Verdict Box (compact)
  compactVerdictBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  compactVerdictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  compactVerdictTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  compactVerdictText: {
    fontSize: 13,
    color: COLORS.bodyText,
    lineHeight: 18,
  },

  // Delete Button (compact)
  compactDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    marginTop: 16,
  },
  compactDeleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
});
