/**
 * Tab Bar Layout
 *
 * Clean, light tab bar with equal spacing.
 * Home Dashboard is the center hero floating button.
 */

import { Tabs } from 'expo-router';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import {
  LayoutDashboard,
  Utensils,
  LifeBuoy,
  TrendingUp,
  User,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

// Light Theme Colors
const COLORS = {
  background: '#FFFFFF',
  border: '#F3F4F6',
  active: '#10B981',
  inactive: '#9CA3AF',
  heroBackground: '#10B981',
  heroBackgroundActive: '#059669',
};

// Custom Tab Bar Button for the center floating Home button
function CustomTabBarButton({ children, onPress, accessibilityState }: any) {
  const focused = accessibilityState?.selected;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onPress?.();
  };

  return (
    <View style={styles.centerButtonWrapper}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.heroButton,
          focused && styles.heroButtonActive,
          pressed && styles.heroButtonPressed,
        ]}
      >
        {children}
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: COLORS.active,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: Platform.OS === 'ios' ? 88 : 70,
          backgroundColor: COLORS.background,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          paddingTop: 12,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}
    >
      {/* Tab 1: SOS (Left) */}
      <Tabs.Screen
        name="sos"
        options={{
          title: 'SOS',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <LifeBuoy
                size={24}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
              {focused && <View style={styles.activeIndicator} />}
            </View>
          ),
        }}
      />

      {/* Tab 2: Nutrition (Left-Center) */}
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Nutrition',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <Utensils
                size={24}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
              {focused && <View style={styles.activeIndicator} />}
            </View>
          ),
        }}
      />

      {/* Tab 3: Home Dashboard (Center Hero) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarButton: (props) => <CustomTabBarButton {...props} />,
          tabBarIcon: () => (
            <LayoutDashboard
              size={26}
              color="#FFFFFF"
              strokeWidth={2.5}
            />
          ),
        }}
      />

      {/* Tab 4: Progress (Right-Center) */}
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <TrendingUp
                size={24}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
              {focused && <View style={styles.activeIndicator} />}
            </View>
          ),
        }}
      />

      {/* Tab 5: Profile (Right) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <User
                size={24}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
              {focused && <View style={styles.activeIndicator} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Icon wrapper for consistent sizing and indicator positioning
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 48,
    height: 32,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.active,
  },

  // Center button wrapper - takes flex: 1 from tabBarItemStyle
  centerButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Home Hero Floating Button
  heroButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.heroBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28, // Float above the tab bar
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  heroButtonActive: {
    backgroundColor: COLORS.heroBackgroundActive,
    shadowOpacity: 0.4,
  },
  heroButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
});
