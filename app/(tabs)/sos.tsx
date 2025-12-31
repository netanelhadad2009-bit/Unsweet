/**
 * SOS / Panic Mode Screen - Premium Edition
 *
 * High-end, immersive distraction tool to fight sugar cravings:
 * - Hypnotic Breather: Animated breathing circle with 4-7-8 technique
 * - Pop the Craving: Satisfying bubble wrap simulator with heavy haptics
 * - Play the Tape Forward: Consequence visualizer to force future thinking
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Pressable,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Wind,
  Brain,
  Check,
  Play,
  Pause,
  Sparkles,
  Heart,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Trophy,
  RefreshCw,
  Clock,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Premium Calm Theme
const COLORS = {
  // Backgrounds
  background: '#F8FAFC', // Soft slate
  cardBackground: '#FFFFFF',
  cardBackgroundAlt: '#F1F5F9',

  // Accent colors
  teal: '#14B8A6',
  tealLight: 'rgba(20, 184, 166, 0.1)',
  tealMedium: 'rgba(20, 184, 166, 0.2)',
  tealGlow: 'rgba(20, 184, 166, 0.15)',

  mint: '#10B981',
  mintLight: 'rgba(16, 185, 129, 0.1)',

  // Text
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  // Bubble colors - satisfying gradient
  bubbleColors: ['#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6'],
  bubblePopped: '#E2E8F0',

  // Success
  success: '#22C55E',
  successLight: 'rgba(34, 197, 94, 0.15)',

  // Play the Tape Forward cards - Premium Edition
  crashBg: '#E11D48',        // Rose-600
  crashBgLight: '#F43F5E',   // Rose-500
  crashBgDark: '#BE123C',    // Rose-700

  victoryBg: '#059669',      // Emerald-600
  victoryBgLight: '#10B981', // Emerald-500
  victoryBgDark: '#047857',  // Emerald-700

  // Breathing phases
  inhale: '#14B8A6',
  hold: '#6366F1',
  exhale: '#F59E0B',

  border: '#E2E8F0',
  shadow: '#0F172A',
};

// Play the Tape Forward - Timeline data
const CRASH_TIMELINE = [
  { time: '10 mins', text: 'Brief pleasure fades...', opacity: 0.7 },
  { time: '1 hour', text: 'Sugar crash & fatigue', opacity: 1 },
  { time: 'Tomorrow', text: 'Guilt & Day 0 reset', opacity: 1 },
];

const VICTORY_TIMELINE = [
  { time: '15 mins', text: 'Cravings fade away...', opacity: 0.7 },
  { time: '1 hour', text: 'Surge of self-control', opacity: 1 },
  { time: 'Tomorrow', text: 'Waking up PROUD!', opacity: 1 },
];

// Breathing timings (4-7-8 technique)
const BREATH_TIMINGS = {
  inhale: 4000,
  hold: 7000,
  exhale: 8000,
};

// Bubble grid
const GRID_SIZE = 5;
const BUBBLE_SIZE = (SCREEN_WIDTH - 80) / GRID_SIZE - 10;

// Animated Bubble Component (using standard Animated API)
const AnimatedBubble = ({
  index,
  isPopped,
  onPop,
}: {
  index: number;
  isPopped: boolean;
  onPop: () => void;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const colorIndex = index % COLORS.bubbleColors.length;

  const handlePress = () => {
    if (isPopped) return;

    // Heavy haptic for satisfying pop
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Pop animation
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.2,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(opacity, {
      toValue: 0.3,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Delayed callback
    setTimeout(() => onPop(), 50);
  };

  // Reset animation when bubble is restored
  useEffect(() => {
    if (!isPopped) {
      Animated.spring(scale, {
        toValue: 1,
        damping: 12,
        useNativeDriver: true,
      }).start();
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isPopped]);

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          styles.bubble,
          {
            transform: [{ scale }],
            opacity,
            backgroundColor: isPopped
              ? COLORS.bubblePopped
              : COLORS.bubbleColors[colorIndex],
          },
        ]}
      >
        {!isPopped && (
          <>
            <View style={styles.bubbleShine} />
            <View style={styles.bubbleShineSmall} />
          </>
        )}
      </Animated.View>
    </Pressable>
  );
};

// Breathing Circle Component (using standard Animated API)
const BreathingCircle = ({
  isActive,
  phase,
  onToggle,
  cycleCount,
}: {
  isActive: boolean;
  phase: 'idle' | 'inhale' | 'hold' | 'exhale';
  onToggle: () => void;
  cycleCount: number;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const innerOpacity = useRef(new Animated.Value(0.3)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef<Animated.CompositeAnimation | null>(null);
  const pulseAnim = useRef<Animated.CompositeAnimation | null>(null);

  // Cleanup animations on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (rotationAnim.current) rotationAnim.current.stop();
      if (pulseAnim.current) pulseAnim.current.stop();
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      // Continuous ring rotation
      rotationAnim.current = Animated.loop(
        Animated.timing(ringRotation, {
          toValue: 360,
          duration: 20000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotationAnim.current.start();

      // Phase-based animations
      if (phase === 'inhale') {
        Animated.timing(scale, {
          toValue: 1.5,
          duration: BREATH_TIMINGS.inhale,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start();
        Animated.timing(innerOpacity, {
          toValue: 0.8,
          duration: BREATH_TIMINGS.inhale,
          useNativeDriver: true,
        }).start();
      } else if (phase === 'hold') {
        // Subtle pulse during hold
        pulseAnim.current = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseScale, {
              toValue: 1.05,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(pulseScale, {
              toValue: 1,
              duration: 700,
              useNativeDriver: true,
            }),
          ])
        );
        pulseAnim.current.start();
      } else if (phase === 'exhale') {
        if (pulseAnim.current) {
          pulseAnim.current.stop();
        }
        pulseScale.setValue(1);
        Animated.timing(scale, {
          toValue: 1,
          duration: BREATH_TIMINGS.exhale,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start();
        Animated.timing(innerOpacity, {
          toValue: 0.3,
          duration: BREATH_TIMINGS.exhale,
          useNativeDriver: true,
        }).start();
      }
    } else {
      // Reset
      if (rotationAnim.current) {
        rotationAnim.current.stop();
      }
      if (pulseAnim.current) {
        pulseAnim.current.stop();
      }
      Animated.timing(scale, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
      Animated.timing(innerOpacity, {
        toValue: 0.3,
        duration: 500,
        useNativeDriver: true,
      }).start();
      pulseScale.setValue(1);
      ringRotation.setValue(0);
    }
  }, [isActive, phase]);

  const rotateInterpolate = ringRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const getPhaseColor = () => {
    switch (phase) {
      case 'inhale': return COLORS.inhale;
      case 'hold': return COLORS.hold;
      case 'exhale': return COLORS.exhale;
      default: return COLORS.teal;
    }
  };

  const getPhaseText = () => {
    switch (phase) {
      case 'inhale': return 'Breathe In';
      case 'hold': return 'Hold';
      case 'exhale': return 'Breathe Out';
      default: return 'Start';
    }
  };

  const getPhaseTime = () => {
    switch (phase) {
      case 'inhale': return '4 seconds';
      case 'hold': return '7 seconds';
      case 'exhale': return '8 seconds';
      default: return 'Tap to begin';
    }
  };

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.9}
      style={styles.breathingContainer}
    >
      {/* Outer decorative ring */}
      <Animated.View
        style={[
          styles.decorativeRing,
          { transform: [{ rotate: rotateInterpolate }] },
        ]}
      >
        {[...Array(12)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.ringDot,
              {
                transform: [
                  { rotate: `${i * 30}deg` },
                  { translateY: -95 },
                ],
                backgroundColor: i % 3 === 0 ? getPhaseColor() : COLORS.border,
              },
            ]}
          />
        ))}
      </Animated.View>

      {/* Animated glow circle */}
      <Animated.View
        style={[
          styles.glowCircle,
          {
            transform: [
              { scale: Animated.multiply(scale, pulseScale) },
            ],
            opacity: innerOpacity,
            backgroundColor: getPhaseColor(),
          },
        ]}
      />

      {/* Inner content circle */}
      <View style={[styles.innerCircle, { borderColor: getPhaseColor() }]}>
        <Text style={[styles.phaseText, { color: getPhaseColor() }]}>
          {getPhaseText()}
        </Text>
        <Text style={styles.phaseTime}>{getPhaseTime()}</Text>
        {isActive && (
          <Text style={styles.cycleText}>Cycle {cycleCount + 1}</Text>
        )}
      </View>

      {/* Play/Pause indicator */}
      <View style={[styles.playPauseButton, { backgroundColor: getPhaseColor() }]}>
        {isActive ? (
          <Pause size={16} color="#FFFFFF" strokeWidth={2.5} />
        ) : (
          <Play size={16} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
        )}
      </View>
    </TouchableOpacity>
  );
};

// Premium Timeline Card Component for "Play the Tape Forward"
const TimelineCard = ({
  type,
  isExpanded,
  onToggle,
}: {
  type: 'crash' | 'victory';
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const isCrash = type === 'crash';
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Heavy haptic for impact
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Press animation
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.96,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 12,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();

    // Smooth layout animation
    LayoutAnimation.configureNext({
      duration: 350,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.spring, springDamping: 0.85 },
    });

    onToggle();
  };

  // Card configuration
  const config = isCrash
    ? {
        bgColor: COLORS.crashBg,
        bgColorLight: COLORS.crashBgLight,
        title: 'IF I EAT SUGAR...',
        Icon: AlertTriangle,
        timeline: CRASH_TIMELINE,
      }
    : {
        bgColor: COLORS.victoryBg,
        bgColorLight: COLORS.victoryBgLight,
        title: 'IF I STAY STRONG...',
        Icon: Trophy,
        timeline: VICTORY_TIMELINE,
      };

  const CardIcon = config.Icon;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        style={[
          styles.timelineCard,
          { backgroundColor: isExpanded ? config.bgColorLight : config.bgColor },
        ]}
      >
        {/* Background Icon (decorative) */}
        <View style={styles.bgIconContainer}>
          <CardIcon
            size={100}
            color="rgba(255, 255, 255, 0.12)"
            strokeWidth={1.5}
          />
        </View>

        {/* Header */}
        <View style={styles.timelineHeader}>
          <Text style={styles.timelineTitle}>{config.title}</Text>
          <View style={styles.chevronCircle}>
            {isExpanded ? (
              <ChevronUp size={18} color="#FFFFFF" strokeWidth={2.5} />
            ) : (
              <ChevronDown size={18} color="#FFFFFF" strokeWidth={2.5} />
            )}
          </View>
        </View>

        {/* Expanded Timeline */}
        {isExpanded && (
          <View style={styles.timelineContent}>
            {config.timeline.map((item, index) => (
              <View key={index} style={styles.timelineRow}>
                {/* Time badge */}
                <View style={styles.timeBadge}>
                  <Clock size={12} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.timeText}>{item.time}</Text>
                </View>

                {/* Connector line */}
                {index < config.timeline.length - 1 && (
                  <View style={styles.connectorLine} />
                )}

                {/* Content */}
                <Text
                  style={[
                    styles.timelineItemText,
                    { opacity: item.opacity },
                    item.opacity === 1 && styles.timelineItemBold,
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

// Play the Tape Forward Component - Premium Edition
const PlayTheTapeForward = () => {
  const [expandedCard, setExpandedCard] = useState<'crash' | 'victory' | null>(null);

  const toggleCard = (type: 'crash' | 'victory') => {
    setExpandedCard(expandedCard === type ? null : type);
  };

  return (
    <View style={styles.tapeForwardContainer}>
      <TimelineCard
        type="crash"
        isExpanded={expandedCard === 'crash'}
        onToggle={() => toggleCard('crash')}
      />
      <TimelineCard
        type="victory"
        isExpanded={expandedCard === 'victory'}
        onToggle={() => toggleCard('victory')}
      />
    </View>
  );
};

export default function SOSScreen() {
  // Breathing state
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'idle' | 'inhale' | 'hold' | 'exhale'>('idle');
  const [cycleCount, setCycleCount] = useState(0);
  const [breathTimer, setBreathTimer] = useState<NodeJS.Timeout | null>(null);

  // Bubble state
  const [bubbles, setBubbles] = useState<boolean[]>(Array(GRID_SIZE * GRID_SIZE).fill(false));
  const [poppedCount, setPoppedCount] = useState(0);
  const allPopped = poppedCount === GRID_SIZE * GRID_SIZE;

  // Ref to store all active timers for proper cleanup
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  // Clear all breathing timers
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current = [];
    if (breathTimer) clearTimeout(breathTimer);
  }, [breathTimer]);

  // Cleanup on unmount - clears ALL timers to prevent memory leaks
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // Breathing cycle logic - now properly tracks all timers
  const runBreathingCycle = useCallback(() => {
    // Clear any existing timers before starting new cycle
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current = [];

    // Inhale
    setBreathPhase('inhale');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const holdTimer = setTimeout(() => {
      setBreathPhase('hold');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, BREATH_TIMINGS.inhale);

    const exhaleTimer = setTimeout(() => {
      setBreathPhase('exhale');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, BREATH_TIMINGS.inhale + BREATH_TIMINGS.hold);

    const nextCycleTimer = setTimeout(() => {
      setCycleCount(prev => prev + 1);
      runBreathingCycle();
    }, BREATH_TIMINGS.inhale + BREATH_TIMINGS.hold + BREATH_TIMINGS.exhale);

    // Store all timers for cleanup
    timersRef.current = [holdTimer, exhaleTimer, nextCycleTimer];
    setBreathTimer(nextCycleTimer);
  }, []);

  const toggleBreathing = () => {
    if (isBreathing) {
      // Stop - clear ALL timers to prevent state updates after stop
      setIsBreathing(false);
      setBreathPhase('idle');
      clearAllTimers();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      // Start
      setIsBreathing(true);
      setCycleCount(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      runBreathingCycle();
    }
  };

  // Bubble handlers
  const popBubble = (index: number) => {
    if (bubbles[index]) return;

    const newBubbles = [...bubbles];
    newBubbles[index] = true;
    setBubbles(newBubbles);

    const newCount = poppedCount + 1;
    setPoppedCount(newCount);

    if (newCount === GRID_SIZE * GRID_SIZE) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const resetBubbles = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBubbles(Array(GRID_SIZE * GRID_SIZE).fill(false));
    setPoppedCount(0);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - Standard Left-Aligned */}
        <View style={styles.header}>
          <Text style={styles.title}>Calm Mode</Text>
          <Text style={styles.subtitle}>
            This craving is temporary. Let's get through it together.
          </Text>
        </View>

        {/* Breathing Exercise */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Wind size={20} color={COLORS.teal} />
            <Text style={styles.sectionTitle}>Hypnotic Breather</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            4-7-8 breathing technique to calm your nervous system
          </Text>

          <View style={styles.breathingCard}>
            <BreathingCircle
              isActive={isBreathing}
              phase={breathPhase}
              onToggle={toggleBreathing}
              cycleCount={cycleCount}
            />
          </View>
        </View>

        {/* Pop the Craving */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={20} color={COLORS.teal} />
            <Text style={styles.sectionTitle}>Pop the Craving</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Satisfying tactile distraction - pop every bubble
          </Text>

          <View style={styles.bubbleCard}>
            {allPopped ? (
              <View style={styles.completedContainer}>
                <View style={styles.successCircle}>
                  <Check size={40} color={COLORS.success} strokeWidth={3} />
                </View>
                <Text style={styles.completedTitle}>Craving Crushed!</Text>
                <Text style={styles.completedSubtext}>
                  You did it. The urge has passed.
                </Text>
                <Pressable
                  onPress={resetBubbles}
                  style={({ pressed }) => [
                    styles.playAgainButton,
                    pressed && styles.playAgainButtonPressed,
                  ]}
                >
                  <RefreshCw size={18} color={COLORS.text} />
                  <Text style={styles.playAgainText}>Pop Again</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${(poppedCount / (GRID_SIZE * GRID_SIZE)) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {poppedCount} / {GRID_SIZE * GRID_SIZE} bubbles popped
                </Text>
                <View style={styles.bubbleGrid}>
                  {bubbles.map((isPopped, index) => (
                    <AnimatedBubble
                      key={index}
                      index={index}
                      isPopped={isPopped}
                      onPop={() => popBubble(index)}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Play the Tape Forward */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Brain size={20} color={COLORS.teal} />
            <Text style={styles.sectionTitle}>Play the Tape Forward</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Visualize the consequences of your next choice
          </Text>

          <PlayTheTapeForward />
        </View>

        {/* Bottom Reminder */}
        <View style={styles.reminderCard}>
          <Heart size={20} color={COLORS.teal} fill={COLORS.tealLight} />
          <Text style={styles.reminderText}>
            Cravings peak at 10-20 minutes, then fade.{'\n'}
            You're stronger than this moment.
          </Text>
        </View>
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
    paddingBottom: 120,
  },

  // Header - Standard Left-Aligned
  header: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    lineHeight: 22,
  },

  // Sections
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 16,
    marginLeft: 28,
  },

  // Breathing
  breathingCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  breathingContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorativeRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  glowCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  innerCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: COLORS.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  phaseText: {
    fontSize: 18,
    fontWeight: '700',
  },
  phaseTime: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  cycleText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 8,
    fontWeight: '500',
  },
  playPauseButton: {
    position: 'absolute',
    bottom: -10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },

  // Bubble Game
  bubbleCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 24,
    padding: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.cardBackgroundAlt,
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.teal,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  bubbleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  bubbleShine: {
    position: 'absolute',
    top: BUBBLE_SIZE * 0.15,
    left: BUBBLE_SIZE * 0.15,
    width: BUBBLE_SIZE * 0.35,
    height: BUBBLE_SIZE * 0.35,
    borderRadius: BUBBLE_SIZE * 0.175,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  bubbleShineSmall: {
    position: 'absolute',
    top: BUBBLE_SIZE * 0.4,
    left: BUBBLE_SIZE * 0.45,
    width: BUBBLE_SIZE * 0.12,
    height: BUBBLE_SIZE * 0.12,
    borderRadius: BUBBLE_SIZE * 0.06,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },

  // Completed state
  completedContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.success,
    marginBottom: 8,
  },
  completedSubtext: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginBottom: 24,
    textAlign: 'center',
  },
  playAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.cardBackgroundAlt,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  playAgainButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  playAgainText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Play the Tape Forward - Premium Timeline Cards
  tapeForwardContainer: {
    gap: 16,
  },
  timelineCard: {
    borderRadius: 24,
    padding: 20,
    paddingRight: 24,
    minHeight: 80,
    overflow: 'hidden',
    position: 'relative',
    // Heavy shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  bgIconContainer: {
    position: 'absolute',
    right: -15,
    top: -10,
    opacity: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineContent: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    gap: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    position: 'relative',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 90,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  connectorLine: {
    position: 'absolute',
    left: 45,
    top: 32,
    width: 2,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
  },
  timelineItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  timelineItemBold: {
    fontWeight: '700',
    fontSize: 17,
  },

  // Reminder
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.tealLight,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.tealMedium,
  },
  reminderText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.teal,
    lineHeight: 22,
    fontWeight: '500',
  },
});
