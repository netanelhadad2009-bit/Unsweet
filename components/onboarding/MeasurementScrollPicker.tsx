import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Theme } from '../../constants/Theme';

const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 7;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const CENTER_INDEX = Math.floor(VISIBLE_ITEMS / 2);
const SELECTION_BOX_HEIGHT = 56; // Slightly taller than item
const SELECTION_BOX_OFFSET = (SELECTION_BOX_HEIGHT - ITEM_HEIGHT) / 2;

interface MeasurementScrollPickerProps {
  values: number[];
  initialValue: number;
  unit: string;
  onValueChange: (value: number) => void;
}

export default function MeasurementScrollPicker({
  values,
  initialValue,
  unit,
  onValueChange,
}: MeasurementScrollPickerProps) {
  const [selectedValue, setSelectedValue] = useState(initialValue);
  const scrollRef = useRef<ScrollView>(null);

  // Initialize scroll position
  useEffect(() => {
    const timer = setTimeout(() => {
      const index = values.indexOf(selectedValue);
      if (index >= 0) {
        scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Update scroll position when initialValue changes (e.g., unit toggle)
  useEffect(() => {
    const index = values.indexOf(initialValue);
    if (index >= 0 && initialValue !== selectedValue) {
      setSelectedValue(initialValue);
      scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
    }
  }, [initialValue, values]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    if (values[index] !== undefined && values[index] !== selectedValue) {
      Haptics.selectionAsync();
      setSelectedValue(values[index]);
      onValueChange(values[index]);
    }
  };

  const spacerHeight = ITEM_HEIGHT * CENTER_INDEX;

  return (
    <View style={styles.outerWrapper}>
      {/* Selection highlight - outside overflow hidden */}
      <View style={styles.selectionHighlight} />

      <View style={styles.pickerWrapper}>
        {/* Top fade gradient */}
        <LinearGradient
          colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0)']}
          locations={[0, 0.6, 1]}
          style={styles.gradientTop}
          pointerEvents="none"
        />

        {/* Bottom fade gradient */}
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,1)']}
          locations={[0, 0.4, 1]}
          style={styles.gradientBottom}
          pointerEvents="none"
        />

        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleScroll}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={{ height: spacerHeight }} />
          {values.map((value) => (
            <View key={value} style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  value === selectedValue && styles.selectedText,
                ]}
              >
                {value} {unit}
              </Text>
            </View>
          ))}
          <View style={{ height: spacerHeight }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    flex: 1,
    height: PICKER_HEIGHT,
    position: 'relative',
  },
  pickerWrapper: {
    flex: 1,
    height: PICKER_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  selectionHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * CENTER_INDEX - SELECTION_BOX_OFFSET,
    left: -30,
    right: -30,
    height: SELECTION_BOX_HEIGHT,
    backgroundColor: '#F5F5F5',
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    zIndex: 0,
  },
  scrollView: {
    zIndex: 2,
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * CENTER_INDEX,
    zIndex: 3,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * CENTER_INDEX,
    zIndex: 3,
  },
  scrollContent: {
    paddingVertical: 0,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontFamily: Theme.fonts.medium,
    color: '#AAAAAA',
    fontSize: 20,
  },
  selectedText: {
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    fontWeight: '700',
    fontSize: 22,
  },
});
