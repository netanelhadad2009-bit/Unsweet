import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Map, Heart, Zap, Check } from 'lucide-react-native';
import { useOnboarding } from '../contexts/OnboardingContext';
import { Theme } from '../constants/Theme';

interface BenefitProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function BenefitCard({ icon, title, description }: BenefitProps) {
  return (
    <View style={styles.benefitCard}>
      <View style={styles.benefitIconContainer}>
        {icon}
      </View>
      <View style={styles.benefitContent}>
        <View style={styles.benefitHeader}>
          <Check size={20} color={Theme.colors.primary} strokeWidth={3} />
          <Text style={styles.benefitTitle}>{title}</Text>
        </View>
        <Text style={styles.benefitDescription}>{description}</Text>
      </View>
    </View>
  );
}

export default function Paywall() {
  const router = useRouter();
  const { onboardingData } = useOnboarding();

  // Map spending range ID to readable text
  const getSpendingText = (): string => {
    const spendingMap: Record<string, string> = {
      'range_0_10': '$10',
      'range_10_30': '$30',
      'range_30_50': '$50',
      'range_50_plus': '$50+',
    };
    return spendingMap[onboardingData.weekly_spending || ''] || '$30';
  };

  const handleAnnualPurchase = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // TODO: Integrate with RevenueCat or Stripe for actual purchase
    // For now, navigate to sign-up
    router.push('/(auth)/sign-up');
  };

  const handleMonthlyPurchase = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: Integrate with payment provider
    router.push('/(auth)/sign-up');
  };

  const handleRestore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Implement restore purchases logic
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Personalized Plan is Ready</Text>
          <Text style={styles.subtitle}>Start Your New Life.</Text>
          <Text style={styles.description}>
            Unlock the 14-Day Reset and Lifetime Success Tools.
          </Text>
        </View>

        {/* Hero Benefits Section */}
        <View style={styles.benefitsContainer}>
          <BenefitCard
            icon={<Map size={28} color={Theme.colors.primary} strokeWidth={2.5} />}
            title="Roadmap"
            description="Full 14-Day Reset Plan"
          />
          <BenefitCard
            icon={<Heart size={28} color="#B00000" strokeWidth={2.5} fill="#B00000" fillOpacity={0.15} />}
            title="Healing"
            description="Unlock All Health Milestones"
          />
          <BenefitCard
            icon={<Zap size={28} color="#FFB84D" strokeWidth={2.5} fill="#FFB84D" fillOpacity={0.2} />}
            title="SOS Tool"
            description="Crisis Cravings Crusher Button"
          />
        </View>

        {/* Leverage/Urgency Text */}
        <View style={styles.urgencyContainer}>
          <Text style={styles.urgencyText}>
            Stop spending <Text style={styles.urgencyHighlight}>{getSpendingText()}</Text> weekly on snacks.
          </Text>
          <Text style={styles.urgencySubtext}>Invest in yourself.</Text>
        </View>

        {/* Pricing Options */}
        <View style={styles.pricingContainer}>
          {/* Primary CTA - Annual */}
          <Pressable
            onPress={handleAnnualPurchase}
            style={({ pressed }) => [
              styles.annualButton,
              pressed && styles.annualButtonPressed,
            ]}
          >
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <Text style={styles.annualButtonTitle}>Activate Full Access - $59.99/Year</Text>
            <Text style={styles.annualButtonSubtitle}>
              Get the 14-Day Reset + Lifetime Habit Tracking
            </Text>
            <View style={styles.priceBreakdown}>
              <Text style={styles.priceBreakdownText}>Only $4.99/month • Save 50%</Text>
            </View>
          </Pressable>

          {/* Secondary CTA - Monthly */}
          <Pressable
            onPress={handleMonthlyPurchase}
            style={({ pressed }) => [
              styles.monthlyButton,
              pressed && styles.monthlyButtonPressed,
            ]}
          >
            <Text style={styles.monthlyButtonTitle}>Monthly Access - $9.99/Month</Text>
            <Text style={styles.monthlyButtonSubtitle}>Cancel Anytime</Text>
          </Pressable>
        </View>

        {/* Footer Links */}
        <View style={styles.footer}>
          <Pressable onPress={handleRestore} style={styles.footerLink}>
            <Text style={styles.footerLinkText}>Restore Purchases</Text>
          </Pressable>
          <Text style={styles.footerDivider}>•</Text>
          <Pressable style={styles.footerLink}>
            <Text style={styles.footerLinkText}>Terms & Conditions</Text>
          </Pressable>
        </View>

        {/* Additional Footer Text */}
        <Text style={styles.disclaimerText}>
          Subscription automatically renews unless auto-renew is turned off at least 24 hours before
          the end of the current period.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxl,
    gap: Theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingTop: Theme.spacing.md,
  },
  title: {
    ...Theme.typography.title,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    color: Theme.colors.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Theme.colors.primary,
    textAlign: 'center',
  },
  description: {
    ...Theme.typography.subtitle,
    fontSize: 16,
    textAlign: 'center',
    marginTop: Theme.spacing.xs,
  },
  benefitsContainer: {
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Theme.colors.background,
    borderWidth: 1.5,
    borderColor: '#E0E4E8',
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  benefitIconContainer: {
    width: 48,
    height: 48,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: '#F0FFFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitContent: {
    flex: 1,
    gap: 6,
  },
  benefitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  benefitDescription: {
    fontSize: 15,
    color: Theme.colors.text.secondary,
    lineHeight: 20,
  },
  urgencyContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: '#FFF8F0',
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#FFE4C4',
  },
  urgencyText: {
    fontSize: 17,
    fontWeight: '600',
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  urgencyHighlight: {
    fontSize: 19,
    fontWeight: '800',
    color: '#D97706',
  },
  urgencySubtext: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.primary,
    marginTop: 4,
  },
  pricingContainer: {
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
  annualButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    position: 'relative',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  annualButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  bestValueBadge: {
    position: 'absolute',
    top: -12,
    backgroundColor: '#FFB84D',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  bestValueText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  annualButtonTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
    letterSpacing: -0.3,
  },
  annualButtonSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.95,
    textAlign: 'center',
    marginTop: 6,
  },
  priceBreakdown: {
    marginTop: Theme.spacing.sm,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  priceBreakdownText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  monthlyButton: {
    backgroundColor: '#F8F9FB',
    borderWidth: 2,
    borderColor: '#E0E4E8',
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    alignItems: 'center',
  },
  monthlyButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  monthlyButtonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  monthlyButtonSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.lg,
  },
  footerLink: {
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.sm,
  },
  footerLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.primary,
    textDecorationLine: 'underline',
  },
  footerDivider: {
    fontSize: 14,
    color: Theme.colors.text.muted,
  },
  disclaimerText: {
    fontSize: 12,
    color: Theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: Theme.spacing.md,
  },
});
