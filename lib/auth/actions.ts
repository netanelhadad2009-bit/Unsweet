/**
 * Auth Actions - Helper utilities for logout and account deletion
 *
 * Provides clean, reusable functions for:
 * - Clearing local data (AsyncStorage)
 * - Performing logout with cleanup
 * - Performing account deletion with cleanup
 */

import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Clear all local app data from AsyncStorage
 * This ensures no stale data remains after logout/delete
 */
export async function clearLocalData(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();

    // Filter for app-specific keys to clear
    const appKeys = keys.filter(
      (key) =>
        key.startsWith('user_') ||
        key.startsWith('onboarding_') ||
        key.startsWith('profile_') ||
        key.startsWith('settings_') ||
        key.startsWith('cache_')
    );

    if (appKeys.length > 0) {
      await AsyncStorage.multiRemove(appKeys);
    }
  } catch (e) {
    // Silently handle storage errors
  }
}

/**
 * Perform logout with full cleanup
 * - Signs out from Supabase
 * - Clears local AsyncStorage data
 */
export async function performLogout(): Promise<{ success: boolean; error?: any }> {
  try {
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }

    // Clear local data
    await clearLocalData();

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Perform account deletion with full cleanup
 * - Calls the secure delete_user RPC function
 * - Signs out from Supabase
 * - Clears local AsyncStorage data
 */
export async function performDeleteAccount(): Promise<{ success: boolean; error?: any }> {
  try {
    // Call the secure SQL function to delete user data
    const { error: rpcError } = await supabase.rpc('delete_user');
    if (rpcError) {
      throw rpcError;
    }

    // Sign out after successful deletion
    await supabase.auth.signOut();

    // Clear all local data
    await clearLocalData();

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}
