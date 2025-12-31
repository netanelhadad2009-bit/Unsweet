/**
 * Auth Helpers - Hard Reset Authentication Actions
 *
 * Provides logout and delete account functionality with proper
 * cleanup and navigation reset support.
 *
 * SECURITY: Uses UserDataService for complete data wipe on logout
 * to prevent data leakage between users.
 */

import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';
import { clearAllUserData } from '../services/UserDataService';

export async function logoutAction(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            // SECURITY: Clear ALL user data BEFORE signing out
            // This includes RevenueCat logout and all AsyncStorage
            await clearAllUserData();

            // Sign out from Supabase (triggers auth state change)
            await supabase.auth.signOut();

            resolve(true);
          } catch (error) {
            console.error('[Auth] Logout failed:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
            resolve(false);
          }
        },
      },
    ]);
  });
}

export async function deleteAccountAction(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('Delete Account', 'Are you sure? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          // Second confirmation
          Alert.alert(
            'Final Confirmation',
            'All your data will be lost forever. This cannot be reversed.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              {
                text: 'Delete Forever',
                style: 'destructive',
                onPress: async () => {
                  try {
                    // Call our secure RPC function to delete server data
                    const { error } = await supabase.rpc('delete_user');
                    if (error) throw error;

                    // SECURITY: Clear ALL local user data
                    await clearAllUserData();

                    // Sign out from Supabase
                    await supabase.auth.signOut();

                    resolve(true);
                  } catch (error) {
                    console.error('[Auth] Delete account failed:', error);
                    Alert.alert('Error', 'Failed to delete account. Please contact support.');
                    resolve(false);
                  }
                },
              },
            ]
          );
        },
      },
    ]);
  });
}
