import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

interface IconProps {
  selected: boolean;
}

const ICON_SIZE = 24;

// Time of Day Icons
export const MorningIcon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Sun rising with rays */}
        <Path
          d="M12 2V4M12 20V22M4 12H2M6.31 6.31L4.9 4.9M17.69 6.31L19.1 4.9M22 12H20"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d="M12 6C8.69 6 6 8.69 6 12H18C18 8.69 15.31 6 12 6Z"
          fill={color}
        />
        <Path d="M4 16H20" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
};

export const AfternoonIcon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Full sun */}
        <Circle cx={12} cy={12} r={5} fill={color} />
        <Path
          d="M12 2V4M12 20V22M4 12H2M6.31 6.31L4.9 4.9M17.69 6.31L19.1 4.9M6.31 17.69L4.9 19.1M17.69 17.69L19.1 19.1M22 12H20"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

export const EveningIcon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Sun setting */}
        <Path
          d="M12 10V4M4 12H2M6.31 6.31L4.9 4.9M17.69 6.31L19.1 4.9M22 12H20"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d="M6 14C6 10.69 8.69 8 12 8C15.31 8 18 10.69 18 14H6Z"
          fill={color}
        />
        <Path d="M2 18H22" stroke={color} strokeWidth={2} strokeLinecap="round" />
        <Path d="M4 14H20" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
};

export const LateNightIcon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Crescent moon */}
        <Path
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
          fill={color}
        />
      </Svg>
    </View>
  );
};

// Sleep Impact Icons
export const WakeMiddleIcon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Wide awake eye */}
        <Path
          d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={12} cy={12} r={3} fill={color} />
      </Svg>
    </View>
  );
};

export const SleepIcon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Bed */}
        <Path
          d="M3 18V12C3 10.9 3.9 10 5 10H19C20.1 10 21 10.9 21 12V18"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path d="M3 18H21" stroke={color} strokeWidth={2} strokeLinecap="round" />
        <Path d="M3 18V20M21 18V20" stroke={color} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={7} cy={7} r={2} fill={color} />
        <Path d="M3 12V8" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
};

export const ExhaustedIcon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Battery low */}
        <Rect x={2} y={7} width={18} height={10} rx={2} stroke={color} strokeWidth={2} />
        <Path d="M22 10V14" stroke={color} strokeWidth={2} strokeLinecap="round" />
        <Rect x={4} y={9} width={4} height={6} fill={color} />
      </Svg>
    </View>
  );
};

// Quit Attempts Icons
export const MultipleFailedIcon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Refresh/retry arrows */}
        <Path
          d="M1 4V10H7"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M23 20V14H17"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

export const OnceIcon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Number 2 */}
        <Path
          d="M7 8C7 5.79 8.79 4 11 4H13C15.21 4 17 5.79 17 8C17 10.21 15.21 12 13 12H11L17 20H7"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

export const FirstAttemptIcon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Star/sparkle */}
        <Path
          d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
          fill={color}
        />
      </Svg>
    </View>
  );
};

export const StruggleIcon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Flexed bicep */}
        <Path
          d="M12 4C10.5 4 9 5.5 9 7C9 8.5 9.5 10 8 12C6.5 14 4 15 4 17C4 19 6 21 9 21H15C18 21 20 19 20 17C20 15 18 14 17 12C16 10 16 8.5 16 7C16 5.5 14.5 4 13 4"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M9 11C9 11 10 9 12 9C14 9 15 11 15 11"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

// Money Icons
export const Money1Icon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Single coin */}
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
        <Path
          d="M12 7V17M15 9.5C15 8.12 13.66 7 12 7C10.34 7 9 8.12 9 9.5C9 10.88 10.34 12 12 12C13.66 12 15 13.12 15 14.5C15 15.88 13.66 17 12 17C10.34 17 9 15.88 9 14.5"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

export const Money2Icon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Dollar bills */}
        <Rect x={2} y={6} width={20} height={12} rx={2} stroke={color} strokeWidth={2} />
        <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
        <Path d="M6 6V18M18 6V18" stroke={color} strokeWidth={2} />
      </Svg>
    </View>
  );
};

export const Money3Icon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Money bag */}
        <Path
          d="M12 3L9 6H15L12 3Z"
          fill={color}
        />
        <Path
          d="M8 6C6 8 4 11 4 14C4 18 7.58 21 12 21C16.42 21 20 18 20 14C20 11 18 8 16 6H8Z"
          fill={color}
        />
        <Path
          d="M12 10V16M14 11.5C14 10.67 13.1 10 12 10C10.9 10 10 10.67 10 11.5C10 12.33 10.9 13 12 13C13.1 13 14 13.67 14 14.5C14 15.33 13.1 16 12 16C10.9 16 10 15.33 10 14.5"
          stroke={selected ? '#1F2937' : '#FFFFFF'}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

export const MoneyShockIcon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Explosion/fire with dollar */}
        <Path
          d="M12 2C12 2 14 5 14 7C14 8.1 13.1 9 12 9C10.9 9 10 8.1 10 7C10 5 12 2 12 2Z"
          fill={color}
        />
        <Path
          d="M8 6C8 6 9 8 9 9.5C9 10.33 8.33 11 7.5 11C6.67 11 6 10.33 6 9.5C6 8 8 6 8 6Z"
          fill={color}
        />
        <Path
          d="M16 6C16 6 17 8 17 9.5C17 10.33 16.33 11 15.5 11C14.67 11 14 10.33 14 9.5C14 8 16 6 16 6Z"
          fill={color}
        />
        <Circle cx={12} cy={16} r={5} stroke={color} strokeWidth={2} />
        <Path
          d="M12 13V19M13.5 14.25C13.5 13.56 12.83 13 12 13C11.17 13 10.5 13.56 10.5 14.25C10.5 14.94 11.17 15.5 12 15.5C12.83 15.5 13.5 16.06 13.5 16.75C13.5 17.44 12.83 18 12 18C11.17 18 10.5 17.44 10.5 16.75"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

// Additional icon for "No noticeable difference"
export const NoDifferenceIcon = ({ selected }: IconProps) => {
  const color = selected ? '#FFFFFF' : '#1F2937';
  return (
    <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
        {/* Check mark / thumbs up */}
        <Path
          d="M20 6L9 17L4 12"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
