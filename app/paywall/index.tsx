/**
 * Paywall Screen - Dual-Plan Selection UI
 *
 * Features:
 * - Two selectable plan cards (Annual & Monthly)
 * - Dynamic pricing from RevenueCat
 * - Graceful error handling
 */

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
  Alert,
  Linking,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { CheckCircle, Lock, X, Check, Sparkles } from 'lucide-react-native';
import Purchases, { PurchasesPackage, PurchasesOffering } from 'react-native-purchases';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { supabase } from '../../lib/supabase';
import { Theme } from '../../constants/Theme';
import { TERMS_URL, PRIVACY_URL } from '../../constants/Links';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// DEV MODE - controls debug panel and skip button visibility
const DEV_MODE = __DEV__;

// Header image
const HEADER_IMAGE_URI = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80';

// Benefits
const BENEFITS = [
  'Instantly spot hidden sugars in any meal.',
  'Unlimited AI analysis – track everything.',
  'Make smarter choices, feel better daily.',
];

function BenefitRow({ text }: { text: string }) {
  return (
    <View style={styles.benefitRow}>
      <CheckCircle size={20} color={Theme.colors.primary} strokeWidth={2.5} />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

// Plan Card Component
interface PlanCardProps {
  title: string;
  badge?: string;
  price: string;
  period: string;
  subtext?: string;
  isSelected: boolean;
  onSelect: () => void;
}

function PlanCard({ title, badge, price, period, subtext, isSelected, onSelect }: PlanCardProps) {
  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.planCard,
        isSelected && styles.planCardSelected,
      ]}
    >
      {/* Badge */}
      {badge && (
        <View style={styles.planBadge}>
          <Sparkles size={12} color="#B45309" strokeWidth={2.5} />
          <Text style={styles.planBadgeText}>{badge}</Text>
        </View>
      )}

      {/* Content Row */}
      <View style={styles.planContent}>
        {/* Radio Button */}
        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
          {isSelected && (
            <View style={styles.radioInner}>
              <Check size={14} color="#FFFFFF" strokeWidth={3} />
            </View>
          )}
        </View>

        {/* Plan Info */}
        <View style={styles.planInfo}>
          <Text style={[styles.planTitle, isSelected && styles.planTitleSelected]}>
            {title}
          </Text>
          {subtext && <Text style={styles.planSubtext}>{subtext}</Text>}
        </View>

        {/* Price */}
        <View style={styles.planPriceContainer}>
          <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
            {price}
          </Text>
          <Text style={styles.planPeriod}>{period}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Paywall() {
  const router = useRouter();
  const { isPro, restorePurchases, isInitialized, purchasePackage, isSyncingUser } = useSubscription();

  // Track if user is authenticated - paywall should only show for logged-in non-Pro users
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Local state for offerings (fetch directly for better debugging)
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Package state
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

  // Purchase state
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Ref to track if offerings loaded (avoids stale closure in timeout)
  const offeringsLoadedRef = useRef(false);

  // Animation
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Check auth state on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });
  }, []);

  // Fetch offerings from RevenueCat
  const fetchOfferings = useCallback(async () => {
    setIsLoadingOfferings(true);
    setLoadError(null);

    try {
      const offerings = await Purchases.getOfferings();

      // Get the current offering or fallback to first available
      let activeOffering = offerings.current;

      if (!activeOffering) {
        const allKeys = Object.keys(offerings.all);
        if (allKeys.length > 0) {
          activeOffering = offerings.all[allKeys[0]];
        }
      }

      if (!activeOffering) {
        setLoadError('No subscription plans available.');
        setIsLoadingOfferings(false);
        return;
      }

      setOffering(activeOffering);

      // Find monthly and annual packages
      let foundMonthly: PurchasesPackage | null = null;
      let foundAnnual: PurchasesPackage | null = null;

      // Method 1: Try standard identifiers
      foundMonthly = activeOffering.monthly ?? null;
      foundAnnual = activeOffering.annual ?? null;

      // Method 2: Search by packageType
      if (!foundMonthly || !foundAnnual) {
        activeOffering.availablePackages.forEach(pkg => {
          if (pkg.packageType === 'MONTHLY' && !foundMonthly) {
            foundMonthly = pkg;
          }
          if (pkg.packageType === 'ANNUAL' && !foundAnnual) {
            foundAnnual = pkg;
          }
        });
      }

      // Method 3: Search by identifier name
      if (!foundMonthly || !foundAnnual) {
        activeOffering.availablePackages.forEach(pkg => {
          const id = pkg.identifier.toLowerCase();
          if ((id.includes('monthly') || id.includes('month')) && !foundMonthly) {
            foundMonthly = pkg;
          }
          if ((id.includes('annual') || id.includes('yearly') || id.includes('year')) && !foundAnnual) {
            foundAnnual = pkg;
          }
        });
      }

      // Method 4: Fallback to first two packages
      if (!foundMonthly && !foundAnnual && activeOffering.availablePackages.length >= 2) {
        const pkgs = activeOffering.availablePackages;
        if (pkgs[0].product.price > pkgs[1].product.price) {
          foundAnnual = pkgs[0];
          foundMonthly = pkgs[1];
        } else {
          foundAnnual = pkgs[1];
          foundMonthly = pkgs[0];
        }
      }

      // Method 5: Single package fallback
      if (!foundMonthly && !foundAnnual && activeOffering.availablePackages.length === 1) {
        foundMonthly = activeOffering.availablePackages[0];
      }

      setMonthlyPackage(foundMonthly);
      setAnnualPackage(foundAnnual);

      // Auto-select annual (or monthly if no annual)
      const defaultSelection = foundAnnual ?? foundMonthly;
      setSelectedPackage(defaultSelection);

      // Mark as loaded (prevents spurious timeout)
      offeringsLoadedRef.current = true;

      if (!foundMonthly && !foundAnnual) {
        setLoadError('No valid subscription packages found.');
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // User-friendly error message
      let userMessage = 'Failed to load plans. ';
      if (errorMessage.includes('no App Store products')) {
        userMessage = 'No subscription products configured.';
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else {
        userMessage += 'Please try again later.';
      }

      setLoadError(userMessage);
    } finally {
      setIsLoadingOfferings(false);
    }
  }, []);

  // Fetch when RevenueCat is initialized
  useEffect(() => {
    if (!isInitialized) return;

    fetchOfferings();

    // Timeout after 15 seconds if still loading
    const timeout = setTimeout(() => {
      if (!offeringsLoadedRef.current) {
        setLoadError('Timed out loading plans. Please check your internet connection and try again.');
        setIsLoadingOfferings(false);
      }
    }, 15000);

    return () => clearTimeout(timeout);
  }, [isInitialized, fetchOfferings]);

  // Redirect if Pro
  useEffect(() => {
    if (isPro) {
      router.replace('/(tabs)');
    }
  }, [isPro, router]);

  // FLICKER PREVENTION: Don't render paywall UI until we know user should see it
  // This prevents brief flash of paywall during navigation transitions
  // Return null if:
  // 1. Still checking auth state
  // 2. User is not authenticated (shouldn't be here)
  // 3. User is Pro (being redirected to tabs)
  // 4. Still syncing user (subscription status unknown)
  if (isAuthenticated === null || !isAuthenticated || isPro || isSyncingUser) {
    return null;
  }

  // Button animation
  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start();
  };

  // Purchase handler - uses context's purchasePackage for security checks
  const handlePurchase = async () => {
    if (!selectedPackage) {
      Alert.alert('Error', 'Please select a plan first.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPurchasing(true);

    try {
      // Use context's purchasePackage which has ownership/ghosting protection
      const success = await purchasePackage(selectedPackage);

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Welcome to Pro!', 'You now have full access to all features.', [
          { text: 'Let\'s Go!', onPress: () => router.replace('/(tabs)') }
        ]);
      }
      // If not successful, the purchasePackage function shows appropriate alerts
    } catch (error: unknown) {
      // Safely check for user cancellation
      const isCancelled = (error as any)?.userCancelled === true;
      const errorMessage = error instanceof Error ? error.message : 'Please try again.';

      if (!isCancelled) {
        // Only show error for non-cancellation failures
        Alert.alert('Purchase Failed', errorMessage);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  // Restore handler
  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRestoring(true);

    try {
      await restorePurchases();
    } finally {
      setIsRestoring(false);
    }
  };

  // Skip (DEV only)
  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(tabs)');
  };

  // Select plan
  const selectPlan = (pkg: PurchasesPackage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPackage(pkg);
  };

  // Calculate monthly equivalent for annual
  const getMonthlyEquivalent = (annual: PurchasesPackage): string => {
    const monthly = annual.product.price / 12;
    return `${annual.product.currencyCode} ${monthly.toFixed(2)}/mo`;
  };

  // Get button text
  const getButtonText = (): string => {
    if (isLoadingOfferings) return 'Loading Plans...';
    if (loadError) return 'Tap to Retry';
    if (!selectedPackage) return 'Select a Plan';
    const planName = selectedPackage.packageType === 'ANNUAL' ? 'Yearly' : 'Monthly';
    return `Start with ${planName} Plan`;
  };

  // Handle button press (purchase or retry)
  const handleButtonPress = () => {
    if (loadError) {
      fetchOfferings();
      return;
    }
    handlePurchase();
  };

  const hasPackages = monthlyPackage || annualPackage;

  return (
    <View style={styles.container}>
      {/* Hero Image */}
      <ImageBackground
        source={{ uri: HEADER_IMAGE_URI }}
        style={styles.heroBackground}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(255,255,255,1)']}
          locations={[0, 0.5, 1]}
          style={styles.heroGradient}
        />

        {DEV_MODE && (
          <SafeAreaView edges={['top']} style={styles.skipButtonContainer}>
            <Pressable style={styles.skipButton} onPress={handleSkip}>
              <X size={22} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>
          </SafeAreaView>
        )}
      </ImageBackground>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Headlines */}
        <Text style={styles.headline}>
          Take Control of Your{'\n'}Sugar Intake Today.
        </Text>
        <Text style={styles.subheadline}>
          Stop guessing. Make confident, healthy food choices instantly.
        </Text>

        {/* Benefits */}
        <View style={styles.benefitsContainer}>
          {BENEFITS.map((benefit, index) => (
            <BenefitRow key={index} text={benefit} />
          ))}
        </View>

        {/* Loading State */}
        {isLoadingOfferings && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loadingText}>Loading plans...</Text>
          </View>
        )}

        {/* Error State */}
        {loadError && !isLoadingOfferings && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable onPress={fetchOfferings} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Tap to Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Plan Selection Cards */}
        {hasPackages && !isLoadingOfferings && !loadError && (
          <View style={styles.plansContainer}>
            {/* Annual Plan */}
            {annualPackage && (
              <PlanCard
                title="Yearly Plan"
                badge="Best Value"
                price={annualPackage.product.priceString}
                period="/year"
                subtext={monthlyPackage ? getMonthlyEquivalent(annualPackage) : undefined}
                isSelected={selectedPackage?.identifier === annualPackage.identifier}
                onSelect={() => selectPlan(annualPackage)}
              />
            )}

            {/* Monthly Plan */}
            {monthlyPackage && (
              <PlanCard
                title="Monthly Plan"
                badge={!annualPackage ? 'Flexible' : undefined}
                price={monthlyPackage.product.priceString}
                period="/month"
                isSelected={selectedPackage?.identifier === monthlyPackage.identifier}
                onSelect={() => selectPlan(monthlyPackage)}
              />
            )}
          </View>
        )}

        {/* Trust Signal */}
        <View style={styles.trustContainer}>
          <Lock size={14} color={Theme.colors.text.muted} strokeWidth={2} />
          <Text style={styles.trustText}>
            Secure payment via {Platform.OS === 'ios' ? 'Apple' : 'Google Play'}. Cancel anytime.
          </Text>
        </View>

        {/* CTA Button */}
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Pressable
            onPress={handleButtonPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isPurchasing || (isLoadingOfferings && !loadError)}
            style={[
              styles.ctaButton,
              (isPurchasing || (isLoadingOfferings && !loadError)) && styles.ctaButtonDisabled,
            ]}
          >
            {(isPurchasing || isLoadingOfferings) && !loadError ? (
              <View style={styles.ctaButtonContent}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.ctaButtonText}>{isLoadingOfferings ? 'Loading Plans...' : ''}</Text>
              </View>
            ) : (
              <Text style={styles.ctaButtonText}>{getButtonText()}</Text>
            )}
          </Pressable>
        </Animated.View>

        {/* Footer Links */}
        <View style={styles.footerLinks}>
          <Pressable onPress={handleRestore} disabled={isRestoring} style={styles.footerLink}>
            {isRestoring ? (
              <ActivityIndicator size="small" color={Theme.colors.primary} />
            ) : (
              <Text style={styles.footerLinkText}>Restore Purchases</Text>
            )}
          </Pressable>
          <Text style={styles.footerDivider}>|</Text>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)} style={styles.footerLink}>
            <Text style={styles.footerLinkText}>Terms</Text>
          </Pressable>
          <Text style={styles.footerDivider}>|</Text>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} style={styles.footerLink}>
            <Text style={styles.footerLinkText}>Privacy</Text>
          </Pressable>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
        </Text>

        {/* DEV Skip Link */}
        {DEV_MODE && (
          <Pressable onPress={handleSkip} style={styles.devSkipLink}>
            <Text style={styles.devSkipText}>Skip for now (Dev Mode)</Text>
          </Pressable>
        )}

        {/* Debug Panel */}
        {DEV_MODE && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>🔧 DEBUG INFO</Text>
            <Text style={styles.debugText}>RC Initialized: {isInitialized.toString()}</Text>
            <Text style={styles.debugText}>Offering: {offering?.identifier ?? 'null'}</Text>
            <Text style={styles.debugText}>Monthly: {monthlyPackage?.product.priceString ?? 'N/A'}</Text>
            <Text style={styles.debugText}>Annual: {annualPackage?.product.priceString ?? 'N/A'}</Text>
            <Text style={styles.debugText}>Selected: {selectedPackage?.identifier ?? 'none'}</Text>
            <Text style={styles.debugText}>Loading: {isLoadingOfferings.toString()}</Text>
            <Text style={styles.debugText}>Error: {loadError ?? 'none'}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const HERO_HEIGHT = SCREEN_HEIGHT * 0.25;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  heroBackground: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  skipButtonContainer: {
    position: 'absolute',
    top: 0,
    right: 16,
  },
  skipButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    marginTop: -16,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.xxl,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: Theme.colors.text.primary,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: Theme.spacing.sm,
  },
  subheadline: {
    fontSize: 15,
    fontWeight: '400',
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.sm,
  },
  benefitsContainer: {
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: 2,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Theme.colors.text.primary,
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: Theme.colors.text.secondary,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.primary,
  },
  plansContainer: {
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  planCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    padding: Theme.spacing.md,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: 'rgba(0, 200, 151, 0.06)',
  },
  planBadge: {
    position: 'absolute',
    top: -10,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    textTransform: 'uppercase',
  },
  planContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingTop: 4,
  },
  radioOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: Theme.colors.primary,
  },
  radioInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planInfo: {
    flex: 1,
  },
  planTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Theme.colors.text.primary,
  },
  planTitleSelected: {
    color: Theme.colors.primary,
  },
  planSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: Theme.colors.text.secondary,
    marginTop: 2,
  },
  planPriceContainer: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.text.primary,
  },
  planPriceSelected: {
    color: Theme.colors.primary,
  },
  planPeriod: {
    fontSize: 12,
    fontWeight: '500',
    color: Theme.colors.text.muted,
  },
  trustContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Theme.spacing.md,
  },
  trustText: {
    fontSize: 12,
    fontWeight: '400',
    color: Theme.colors.text.muted,
  },
  ctaButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
    marginBottom: Theme.spacing.lg,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  footerLink: {
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.xs,
    minWidth: 50,
    alignItems: 'center',
  },
  footerLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.primary,
  },
  footerDivider: {
    fontSize: 13,
    color: Theme.colors.text.muted,
  },
  disclaimer: {
    fontSize: 10,
    fontWeight: '400',
    color: Theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: Theme.spacing.md,
  },
  devSkipLink: {
    marginTop: Theme.spacing.md,
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
  },
  devSkipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Theme.colors.text.muted,
    textDecorationLine: 'underline',
  },
  debugContainer: {
    marginTop: Theme.spacing.lg,
    padding: Theme.spacing.md,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00ff88',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#00ff88',
    marginBottom: 3,
  },
});
