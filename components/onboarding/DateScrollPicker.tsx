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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 7;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const CENTER_INDEX = Math.floor(VISIBLE_ITEMS / 2); // 3 for 7 items

interface DateScrollPickerProps {
  initialDate?: Date;
  onDateChange?: (date: Date) => void;
}

export default function DateScrollPicker({
  initialDate,
  onDateChange
}: DateScrollPickerProps) {
  const currentYear = new Date().getFullYear();

  // Default to 18 years ago
  const defaultDate = initialDate || new Date(currentYear - 18, 0, 1);
  const [year, setYear] = useState(defaultDate.getFullYear());
  const [month, setMonth] = useState(defaultDate.getMonth());
  const [day, setDay] = useState(defaultDate.getDate());

  const yearRef = useRef<ScrollView>(null);
  const monthRef = useRef<ScrollView>(null);
  const dayRef = useRef<ScrollView>(null);

  // Years from current year going back 100 years
  const yearValues = Array.from({ length: 100 }, (_, i) => currentYear - i);

  // Days in the selected month
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const daysInMonth = getDaysInMonth(year, month);
  const dayValues = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Adjust day if it exceeds days in month
  useEffect(() => {
    if (day > daysInMonth) {
      setDay(daysInMonth);
    }
  }, [month, year, daysInMonth]);

  // Initialize scroll positions
  useEffect(() => {
    const timer = setTimeout(() => {
      const yearIndex = yearValues.indexOf(year);
      yearRef.current?.scrollTo({ y: yearIndex * ITEM_HEIGHT, animated: false });
      monthRef.current?.scrollTo({ y: month * ITEM_HEIGHT, animated: false });
      dayRef.current?.scrollTo({ y: (day - 1) * ITEM_HEIGHT, animated: false });
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Notify parent of date changes
  useEffect(() => {
    onDateChange?.(new Date(year, month, day));
  }, [year, month, day]);

  const handleYearScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    if (yearValues[index] && yearValues[index] !== year) {
      Haptics.selectionAsync();
      setYear(yearValues[index]);
    }
  };

  const handleMonthScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    if (index >= 0 && index < 12 && index !== month) {
      Haptics.selectionAsync();
      setMonth(index);
    }
  };

  const handleDayScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    if (dayValues[index] && dayValues[index] !== day) {
      Haptics.selectionAsync();
      setDay(dayValues[index]);
    }
  };

  const renderPickerItem = (
    value: string | number,
    isSelected: boolean,
    isNumber: boolean = true
  ) => (
    <View style={styles.item}>
      <Text
        style={[
          styles.itemText,
          isNumber ? styles.numberText : styles.monthText,
          isSelected && styles.selectedText,
        ]}
      >
        {isNumber && typeof value === 'number'
          ? value.toString().padStart(2, '0')
          : value}
      </Text>
    </View>
  );

  // Spacer height to center the first/last items
  const spacerHeight = ITEM_HEIGHT * CENTER_INDEX;

  return (
    <View style={styles.container}>
      {/* Month Picker - First for layout */}
      <View style={[styles.pickerColumn, styles.monthColumn]}>
        <View style={styles.pickerWrapper}>
          {/* Selection highlight */}
          <View style={styles.selectionHighlight} />

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
            ref={monthRef}
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onMomentumScrollEnd={handleMonthScroll}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={{ height: spacerHeight }} />
            {MONTHS.map((m, idx) => (
              <React.Fragment key={idx}>
                {renderPickerItem(m, idx === month, false)}
              </React.Fragment>
            ))}
            <View style={{ height: spacerHeight }} />
          </ScrollView>
        </View>
      </View>

      {/* Day Picker */}
      <View style={styles.pickerColumn}>
        <View style={styles.pickerWrapper}>
          <View style={styles.selectionHighlight} />
          <LinearGradient
            colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0)']}
            locations={[0, 0.6, 1]}
            style={styles.gradientTop}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,1)']}
            locations={[0, 0.4, 1]}
            style={styles.gradientBottom}
            pointerEvents="none"
          />

          <ScrollView
            ref={dayRef}
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onMomentumScrollEnd={handleDayScroll}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={{ height: spacerHeight }} />
            {dayValues.map((d) => (
              <React.Fragment key={d}>
                {renderPickerItem(d, d === day, true)}
              </React.Fragment>
            ))}
            <View style={{ height: spacerHeight }} />
          </ScrollView>
        </View>
      </View>

      {/* Year Picker */}
      <View style={styles.pickerColumn}>
        <View style={styles.pickerWrapper}>
          <View style={styles.selectionHighlight} />
          <LinearGradient
            colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0)']}
            locations={[0, 0.6, 1]}
            style={styles.gradientTop}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,1)']}
            locations={[0, 0.4, 1]}
            style={styles.gradientBottom}
            pointerEvents="none"
          />

          <ScrollView
            ref={yearRef}
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onMomentumScrollEnd={handleYearScroll}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={{ height: spacerHeight }} />
            {yearValues.map((y) => (
              <React.Fragment key={y}>
                {renderPickerItem(y, y === year, true)}
              </React.Fragment>
            ))}
            <View style={{ height: spacerHeight }} />
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  pickerColumn: {
    flex: 1,
    maxWidth: 80,
    alignItems: 'center',
  },
  monthColumn: {
    maxWidth: 120,
  },
  pickerWrapper: {
    width: '100%',
    height: PICKER_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  selectionHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * CENTER_INDEX,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: '#F5F5F5',
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    zIndex: 1,
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
    fontSize: 18,
  },
  numberText: {
    fontSize: 20,
  },
  monthText: {
    fontSize: 18,
  },
  selectedText: {
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    fontWeight: '700',
    fontSize: 22,
  },
});
