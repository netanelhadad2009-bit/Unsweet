import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Question } from '../../types/onboarding';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { OptionCard } from './OptionCard';
import { Theme } from '../../constants/Theme';

interface Props {
  question: Question;
}

export function SingleSelectQuestion({ question }: Props) {
  const router = useRouter();
  const { onboardingData, updateAnswer, goToNextStep } = useOnboarding();
  const [selectedOption, setSelectedOption] = useState<string | null>(
    (onboardingData[question.id as keyof typeof onboardingData] as string) || null
  );

  const canAdvance = selectedOption !== null;

  const handleSelect = (optionId: string) => {
    // Update local state
    setSelectedOption(optionId);

    // Update context immediately
    updateAnswer(question.id, optionId);

    // Haptic feedback on selection
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleNext = () => {
    if (canAdvance) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Navigate to efficacy screen after sugar_frequency question
      if (question.id === 'sugar_frequency') {
        router.push('/onboarding/efficacy');
      } else {
        goToNextStep();
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{question.title}</Text>
          {question.subtitle && (
            <Text style={styles.subtitle}>{question.subtitle}</Text>
          )}
        </View>

        <View style={styles.options}>
          {question.options?.map((option) => (
            <OptionCard
              key={option.id}
              option={option}
              selected={selectedOption === option.id}
              onPress={() => handleSelect(option.id)}
              type="single"
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={!canAdvance}
          onPress={handleNext}
          style={({ pressed }) => [
            styles.nextButton,
            !canAdvance && styles.nextButtonDisabled,
            pressed && canAdvance && styles.nextButtonPressed,
          ]}
        >
          <Text style={[styles.nextButtonText, !canAdvance && styles.nextButtonTextDisabled]}>
            Continue
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
    gap: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xxl,
  },
  header: {
    gap: Theme.spacing.sm,
  },
  title: {
    ...Theme.typography.title,
  },
  subtitle: {
    ...Theme.typography.subtitle,
  },
  options: {
    gap: Theme.spacing.md,
  },
  footer: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    backgroundColor: Theme.colors.background,
  },
  nextButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  nextButtonDisabled: {
    backgroundColor: Theme.colors.text.muted,
  },
  nextButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  nextButtonText: {
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background,
    fontSize: 18,
    fontWeight: '700',
  },
  nextButtonTextDisabled: {
    color: Theme.colors.background,
    opacity: 0.7,
  },
});
