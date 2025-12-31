import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Theme } from '../../../constants/Theme';
import { useOnboarding } from '../../../contexts/OnboardingContext';

let StoreReview: typeof import('expo-store-review') | null = null;
try { StoreReview = require('expo-store-review'); } catch {}

const TESTIMONIALS = [
  { id: 1, name: 'Sarah M.', avatar: 'https://i.pravatar.cc/150?img=5', rating: 5, text: "I never thought I could survive without chocolate. 3 weeks in and I don't even crave it anymore!" },
  { id: 2, name: 'David K.', avatar: 'https://i.pravatar.cc/150?img=11', rating: 5, text: 'The cravings analysis was spot on. Understanding WHY I eat sugar changed everything.' },
  { id: 3, name: 'Emma L.', avatar: 'https://i.pravatar.cc/150?img=9', rating: 5, text: 'Lost 8 lbs in the first month just by cutting sugar. This app made it so much easier.' },
];

const STAR_COLOR = '#FFB800';

const StarIcon = ({ size = 16, filled = true, color = STAR_COLOR }: { size?: number; filled?: boolean; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={filled ? color : 'transparent'} stroke={color} strokeWidth={filled ? 0 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const StarRating = ({ rating, size = 16 }: { rating: number; size?: number }) => (
  <View style={styles.starRating}>
    {[1, 2, 3, 4, 5].map((star) => (<StarIcon key={star} size={size} filled={star <= rating} />))}
  </View>
);

const LargeStar = ({ delay, onPress }: { delay: number; onPress: () => void }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([Animated.delay(delay), Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true })]).start();
  }, []);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.largeStarContainer, { transform: [{ scale: scaleAnim }] }]}>
        <Svg width={48} height={48} viewBox="0 0 24 24">
          <Defs><LinearGradient id={`starGradient${delay}`} x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0%" stopColor="#FFD700" /><Stop offset="100%" stopColor="#FFA500" /></LinearGradient></Defs>
          <Path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={`url(#starGradient${delay})`} />
        </Svg>
      </Animated.View>
    </TouchableOpacity>
  );
};

const TestimonialCard = ({ testimonial, index }: { testimonial: typeof TESTIMONIALS[0]; index: number }) => {
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: 300 + index * 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: 300 + index * 150, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.testimonialCard, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
      <View style={styles.testimonialHeader}>
        <Image source={{ uri: testimonial.avatar }} style={styles.avatar} />
        <Text style={styles.testimonialName}>{testimonial.name}</Text>
        <StarRating rating={testimonial.rating} size={16} />
      </View>
      <Text style={styles.testimonialText}>{testimonial.text}</Text>
    </Animated.View>
  );
};

export default function ReviewsContent() {
  const { goToNextScreen } = useOnboarding();
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);

  useEffect(() => {
    const buttonTimer = setTimeout(() => {
      setIsButtonEnabled(true);
    }, 2500);

    // Auto-trigger rating popup after 1 second
    const ratingTimer = setTimeout(async () => {
      if (StoreReview && await StoreReview.hasAction()) {
        try { await StoreReview.requestReview(); } catch {}
      }
    }, 1000);

    return () => {
      clearTimeout(buttonTimer);
      clearTimeout(ratingTimer);
    };
  }, []);

  const handleRate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (StoreReview && await StoreReview.hasAction()) {
      try { await StoreReview.requestReview(); } catch {}
    }
  };

  const handleContinue = () => {
    if (!isButtonEnabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    goToNextScreen();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><Text style={styles.title}>Give us a rating</Text></View>
        <View style={styles.starsWrapper}>
          <View style={styles.largeStarsContainer}>
            {[0, 1, 2, 3, 4].map((i) => (<LargeStar key={i} delay={i * 100} onPress={handleRate} />))}
          </View>
        </View>
        <View style={styles.subtitleContainer}><Text style={styles.subtitle}>Unsweet was built for{'\n'}people like you</Text></View>
        <View style={styles.avatarsRow}>
          {TESTIMONIALS.map((testimonial, index) => (
            <Image key={testimonial.id} source={{ uri: testimonial.avatar }} style={[styles.overlappingAvatar, { marginLeft: index === 0 ? 0 : -16, zIndex: TESTIMONIALS.length - index }]} />
          ))}
        </View>
        <View style={styles.testimonialsContainer}>
          {TESTIMONIALS.map((testimonial, index) => (<TestimonialCard key={testimonial.id} testimonial={testimonial} index={index} />))}
        </View>
      </ScrollView>
      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={handleContinue} disabled={!isButtonEnabled} style={[styles.continueButton, !isButtonEnabled && styles.continueButtonDisabled]} activeOpacity={0.8}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.sm, paddingBottom: Theme.spacing.xl },
  header: { alignItems: 'flex-start', marginBottom: Theme.spacing.md },
  title: { fontFamily: Theme.fonts.extraBold, fontSize: 32, fontWeight: '800', color: Theme.colors.text.primary, textAlign: 'left', letterSpacing: -0.5 },
  subtitleContainer: { alignItems: 'center', marginBottom: Theme.spacing.lg },
  subtitle: { fontFamily: Theme.fonts.extraBold, fontSize: 32, fontWeight: '800', color: Theme.colors.text.primary, textAlign: 'center', letterSpacing: -0.5 },
  starsWrapper: { alignItems: 'center', marginBottom: Theme.spacing.lg },
  largeStarsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255, 184, 0, 0.15)', paddingHorizontal: Theme.spacing.md, paddingVertical: Theme.spacing.sm, borderRadius: 40 },
  largeStarContainer: { padding: 2 },
  avatarsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: Theme.spacing.xl },
  overlappingAvatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: Theme.colors.background },
  starRating: { flexDirection: 'row', gap: 2 },
  testimonialsContainer: { gap: Theme.spacing.md },
  testimonialCard: { backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.lg, padding: Theme.spacing.md },
  testimonialHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Theme.spacing.sm, justifyContent: 'space-between' },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: Theme.spacing.sm },
  testimonialName: { fontFamily: Theme.fonts.bold, fontSize: 16, fontWeight: '700', color: Theme.colors.text.primary, flex: 1 },
  testimonialText: { fontFamily: Theme.fonts.regular, fontSize: 16, color: Theme.colors.text.secondary, lineHeight: 22 },
  buttonContainer: { paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.lg, backgroundColor: Theme.colors.background, borderTopWidth: 1, borderTopColor: Theme.colors.border },
  continueButton: { backgroundColor: Theme.colors.primary, borderRadius: Theme.borderRadius.lg, paddingVertical: Theme.spacing.md, alignItems: 'center', ...Theme.shadows.medium },
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { fontFamily: Theme.fonts.bold, color: Theme.colors.background, fontSize: 18, fontWeight: '700' },
});
