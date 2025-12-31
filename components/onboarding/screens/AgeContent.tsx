import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Theme } from '../../../constants/Theme';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import DateScrollPicker from '../DateScrollPicker';

// Calculate age from birthdate
const calculateAge = (birthdate: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const monthDiff = today.getMonth() - birthdate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
    age--;
  }

  return age;
};

export default function AgeContent() {
  const { onboardingData, updateBioData, goToNextScreen } = useOnboarding();

  // Initialize from existing birthdate or default to 18 years ago
  const getInitialDate = (): Date => {
    if (onboardingData.birthdate) {
      return new Date(onboardingData.birthdate);
    }
    const defaultDate = new Date();
    defaultDate.setFullYear(defaultDate.getFullYear() - 18);
    defaultDate.setMonth(0);
    defaultDate.setDate(1);
    return defaultDate;
  };

  const [selectedDate, setSelectedDate] = useState<Date>(getInitialDate());
  const [displayAge, setDisplayAge] = useState<number>(calculateAge(getInitialDate()));

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    setDisplayAge(calculateAge(date));
  };

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Store both birthdate (as ISO string) and calculated age
    const birthdateISO = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const age = calculateAge(selectedDate);

    updateBioData('birthdate', birthdateISO);
    updateBioData('age', age);

    goToNextScreen();
  };

  // Validate age (must be at least 13)
  const isValidAge = displayAge >= 13 && displayAge <= 120;

  return (
    <View style={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>When were you born?</Text>
        <Text style={styles.subtitle}>
          Your age helps us personalize your plan
        </Text>
      </View>

      {/* Date Picker */}
      <View style={styles.pickerContainer}>
        <DateScrollPicker
          initialDate={selectedDate}
          onDateChange={handleDateChange}
        />
      </View>

      {/* Continue Button */}
      <View style={styles.buttonContainer}>
        <Pressable
          onPress={handleContinue}
          disabled={!isValidAge}
          style={({ pressed }) => [
            styles.continueButton,
            !isValidAge && styles.continueButtonDisabled,
            pressed && isValidAge && styles.continueButtonPressed,
          ]}
        >
          <Text
            style={[
              styles.continueButtonText,
              !isValidAge && styles.continueButtonTextDisabled,
            ]}
          >
            Continue
          </Text>
        </Pressable>

        {!isValidAge && (
          <Text style={styles.errorText}>
            You must be at least 13 years old to use this app
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
  },
  header: {
    marginBottom: Theme.spacing.lg,
  },
  title: {
    fontFamily: Theme.fonts.extraBold,
    fontSize: 32,
    fontWeight: '800',
    color: Theme.colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: Theme.spacing.sm,
  },
  subtitle: {
    fontFamily: Theme.fonts.regular,
    fontSize: 16,
    color: Theme.colors.text.secondary,
    lineHeight: 24,
  },
  pickerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Theme.spacing.lg,
  },
  buttonContainer: {
    paddingVertical: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    backgroundColor: Theme.colors.background,
    marginHorizontal: -Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.lg,
  },
  continueButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  continueButtonDisabled: {
    backgroundColor: Theme.colors.text.muted,
  },
  continueButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  continueButtonText: {
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background,
    fontSize: 18,
    fontWeight: '700',
  },
  continueButtonTextDisabled: {
    color: Theme.colors.background,
    opacity: 0.7,
  },
  errorText: {
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    color: Theme.colors.danger,
    textAlign: 'center',
    marginTop: Theme.spacing.md,
  },
});
