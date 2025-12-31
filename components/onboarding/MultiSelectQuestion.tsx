import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Question } from '../../types/onboarding';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { OptionCard } from './OptionCard';
import { Theme } from '../../constants/Theme';

interface Props {
  question: Question;
}

export function MultiSelectQuestion({ question }: Props) {
  const { onboardingData, updateAnswer, goToNextStep } = useOnboarding();
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    (onboardingData[question.id as keyof typeof onboardingData] as string[]) || []
  );

  const minRequired = 1; // At least one goal must be selected
  const canAdvance = selectedOptions.length >= minRequired;

  const handleToggle = (optionId: string) => {
    setSelectedOptions((prev) => {
      const updated = prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId];

      // Update context immediately
      updateAnswer(question.id, updated);
      return updated;
    });
  };

  const handleNext = () => {
    if (canAdvance) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      goToNextStep();
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
          {selectedOptions.length > 0 && (
            <Text style={styles.counter}>
              {selectedOptions.length} selected
            </Text>
          )}
        </View>

        <View style={styles.options}>
          {question.options?.map((option) => (
            <OptionCard
              key={option.id}
              option={option}
              selected={selectedOptions.includes(option.id)}
              onPress={() => handleToggle(option.id)}
              type="multi"
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
  counter: {
    ...Theme.typography.body,
    fontFamily: Theme.fonts.semiBold,
    color: Theme.colors.primary,
    fontWeight: '600',
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
