import { Pressable, Text, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Theme } from '../../constants/Theme';
import { Option } from '../../types/onboarding';
import * as Icons from './OptionIcons';

interface Props {
  option: Option;
  selected: boolean;
  onPress: () => void;
  type: 'single' | 'multi';
}

export function OptionCard({ option, selected, onPress }: Props) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  // Map icon names to components
  const getIconComponent = () => {
    if (!option.iconComponent) return null;

    const IconComponent = (Icons as any)[option.iconComponent];
    if (!IconComponent) return null;

    return <IconComponent selected={selected} />;
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      {getIconComponent() && (
        <View style={styles.iconWrapper}>
          {getIconComponent()}
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={[styles.label, selected && styles.labelSelected]}>
            {option.label}
          </Text>
          {option.description && (
            <Text style={[styles.description, selected && styles.descriptionSelected]}>
              {option.description}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.background,
    borderWidth: 1.5,
    borderColor: '#E0E4E8',
    borderRadius: Theme.borderRadius.xl,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  selected: {
    borderColor: Theme.colors.primary,
    borderWidth: 2,
    backgroundColor: Theme.colors.primary,
    shadowColor: Theme.colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  iconWrapper: {
    marginLeft: Theme.spacing.md,
    marginRight: Theme.spacing.sm,
  },
  content: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 6,
  },
  label: {
    ...Theme.typography.optionLabel,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  labelSelected: {
    fontFamily: Theme.fonts.bold,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  description: {
    ...Theme.typography.optionDescription,
    fontSize: 14,
    lineHeight: 18,
    opacity: 0.7,
  },
  descriptionSelected: {
    color: '#FFFFFF',
    opacity: 0.9,
  },
});
