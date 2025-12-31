import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Theme } from '../../../constants/Theme';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import MeasurementScrollPicker from '../MeasurementScrollPicker';

// Unit conversion helpers
const kgToLbs = (kg: number): number => Math.round(kg * 2.205);
const lbsToKg = (lbs: number): number => Math.round(lbs / 2.205);

// Generate value ranges
const generateHeightValuesCm = (): number[] => {
  const values: number[] = [];
  for (let cm = 120; cm <= 220; cm++) {
    values.push(cm);
  }
  return values;
};

const generateWeightValuesKg = (): number[] => {
  const values: number[] = [];
  for (let kg = 30; kg <= 200; kg++) {
    values.push(kg);
  }
  return values;
};

const generateHeightValuesInches = (): number[] => {
  const values: number[] = [];
  for (let inches = 48; inches <= 86; inches++) {
    values.push(inches);
  }
  return values;
};

const generateWeightValuesLbs = (): number[] => {
  const values: number[] = [];
  for (let lbs = 66; lbs <= 440; lbs++) {
    values.push(lbs);
  }
  return values;
};

export default function MeasurementsContent() {
  const { onboardingData, updateBioData, goToNextScreen } = useOnboarding();

  // Unit toggle state
  const [useImperial, setUseImperial] = useState(onboardingData.useImperial || false);

  // Metric values (stored internally)
  const [heightCm, setHeightCm] = useState<number>(onboardingData.height || 170);
  const [weightKg, setWeightKg] = useState<number>(onboardingData.weight || 70);

  const handleUnitToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUseImperial(value);
  };

  const handleHeightChange = (value: number) => {
    if (useImperial) {
      const cm = Math.round(value * 2.54);
      setHeightCm(cm);
    } else {
      setHeightCm(value);
    }
  };

  const handleWeightChange = (value: number) => {
    if (useImperial) {
      const kg = lbsToKg(value);
      setWeightKg(kg);
    } else {
      setWeightKg(value);
    }
  };

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Save all measurements (always stored in metric)
    updateBioData('height', heightCm);
    updateBioData('weight', weightKg);
    updateBioData('useImperial', useImperial);

    goToNextScreen();
  };

  // Get display values based on unit
  const heightValues = useImperial ? generateHeightValuesInches() : generateHeightValuesCm();
  const weightValues = useImperial ? generateWeightValuesLbs() : generateWeightValuesKg();

  const currentHeightValue = useImperial
    ? Math.round(heightCm / 2.54)
    : heightCm;

  const currentWeightValue = useImperial
    ? kgToLbs(weightKg)
    : weightKg;

  return (
    <View style={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your measurements</Text>
        <Text style={styles.subtitle}>
          Used to calculate BMI and personalized goals
        </Text>
      </View>

      {/* Unit Toggle */}
      <View style={styles.unitToggleContainer}>
        <Text style={[styles.unitLabel, !useImperial && styles.unitLabelActive]}>
          Metric
        </Text>
        <Switch
          value={useImperial}
          onValueChange={handleUnitToggle}
          trackColor={{ false: Theme.colors.primary, true: Theme.colors.primary }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={Theme.colors.primary}
          style={styles.switch}
        />
        <Text style={[styles.unitLabel, useImperial && styles.unitLabelActive]}>
          Imperial
        </Text>
      </View>

      {/* Pickers Container */}
      <View style={styles.pickersContainer}>
        {/* Height Picker */}
        <View style={styles.pickerColumn}>
          <Text style={styles.pickerTitle}>Height</Text>
          <MeasurementScrollPicker
            values={heightValues}
            initialValue={currentHeightValue}
            unit={useImperial ? '"' : 'cm'}
            onValueChange={handleHeightChange}
            key={`height-${useImperial}`}
          />
        </View>

        {/* Weight Picker */}
        <View style={styles.pickerColumn}>
          <Text style={styles.pickerTitle}>Weight</Text>
          <MeasurementScrollPicker
            values={weightValues}
            initialValue={currentWeightValue}
            unit={useImperial ? 'lbs' : 'kg'}
            onValueChange={handleWeightChange}
            key={`weight-${useImperial}`}
          />
        </View>
      </View>

      {/* Continue Button */}
      <View style={styles.buttonContainer}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.continueButtonPressed,
          ]}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
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
  unitToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  unitLabel: {
    fontFamily: Theme.fonts.medium,
    fontSize: 18,
    color: Theme.colors.text.muted,
  },
  unitLabelActive: {
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    fontWeight: '700',
  },
  switch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  pickersContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.sm,
    gap: 8,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 170,
  },
  pickerTitle: {
    fontFamily: Theme.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
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
});
