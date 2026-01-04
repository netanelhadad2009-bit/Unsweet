import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { supabase } from '../../lib/supabase';
import { clearAllUserData } from '../../services/UserDataService';

export default function HomeScreen() {
  const router = useRouter();

  const handleSignOut = async () => {
    // Clear all user data (AsyncStorage + RevenueCat) before signing out
    // This prevents data leakage between users and subscription ghosting
    await clearAllUserData();
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Unsweet</Text>
        <Text style={styles.subtitle}>Your sugar-free journey starts here</Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Main App Content Coming Soon
          </Text>
          <Text style={styles.placeholderSubtext}>
            This is a placeholder for the main app functionality.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutButtonPressed,
          ]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    flex: 1,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Theme.fonts.extraBold,
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  subtitle: {
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  placeholder: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Theme.colors.border,
    borderStyle: 'dashed',
    marginBottom: Theme.spacing.xxl,
  },
  placeholderText: {
    fontFamily: Theme.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  placeholderSubtext: {
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
    color: Theme.colors.text.muted,
    textAlign: 'center',
  },
  signOutButton: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
  },
  signOutButtonPressed: {
    opacity: 0.7,
  },
  signOutButtonText: {
    fontFamily: Theme.fonts.semiBold,
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text.secondary,
  },
});
