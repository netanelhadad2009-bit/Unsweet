/**
 * UserDataService - Centralized User Data Management
 *
 * Handles:
 * - User-scoped local storage (prevents data leakage between users)
 * - Database sync for meals (data persistence)
 * - Complete data wipe on logout
 * - Data fetch on login
 *
 * SECURITY: All local data is scoped to user ID to prevent data leakage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

// Storage key prefixes - all user data should use these
const STORAGE_KEYS = {
  // User-scoped keys (include user ID in the key)
  MEALS: (userId: string) => `unsweet_meals_${userId}`,
  STREAK_DATA: (userId: string) => `unsweet_streak_${userId}`,

  // Legacy keys that need migration/cleanup
  LEGACY_MEALS: 'unsweet_nutrition_meals',
  LEGACY_STREAK_USER: 'unsweet_streak_user_id',
  LEGACY_LAST_ACTIVITY: 'unsweet_last_activity',
  LEGACY_CHECKIN_START: 'unsweet_checkin_streak_start',
  LEGACY_CHECKIN_VERSION: 'unsweet_checkin_streak_version',
  LEGACY_CELEBRATION_DATE: 'unsweet_streak_celebration_date',
  LEGACY_CELEBRATION_COUNT: 'unsweet_streak_celebration_count',
};

// Meal type matching journal.tsx
interface Meal {
  id: string;
  name: string;
  sugarLevel: 'none' | 'low' | 'moderate' | 'high';
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  timestamp: number;
  scannedFrom?: string | null;
  imageUri?: string;
  verdict?: string;
  sugarContent?: string;
}

// IMPORTANT: This key must persist across logouts to prevent subscription ghosting
// When User A purchases and logs out, User B should NOT get access to A's subscription
const SUBSCRIPTION_OWNER_KEY = 'unsweet_subscription_owner_id';

// Streak keys that should persist across logouts
// User scoping is handled in index.tsx - when a DIFFERENT user logs in, streak data is cleared
// This allows the SAME user to log out and back in without losing their streak
const STREAK_KEYS_TO_PRESERVE = [
  'unsweet_last_activity',
  'unsweet_checkin_streak_start',
  'unsweet_checkin_streak_version',
  'unsweet_streak_user_id',
  'unsweet_streak_celebration_date',
  'unsweet_streak_celebration_count',
];

/**
 * Clear ALL user data from local storage
 * Called on logout to prevent data leakage
 *
 * SECURITY NOTE: The subscription owner key is preserved to prevent
 * subscription ghosting (User B inheriting User A's subscription)
 *
 * STREAK NOTE: Streak keys are preserved so users don't lose their streak on logout.
 * Cross-user contamination is prevented by user scoping in index.tsx
 */
export async function clearAllUserData(): Promise<void> {
  try {
    console.log('[UserDataService] Clearing all user data...');

    // Get all keys and remove app-specific ones
    const allKeys = await AsyncStorage.getAllKeys();

    // Keys to clear: anything starting with 'unsweet_' or app-specific prefixes
    // EXCEPT subscription_owner_id (prevents ghosting) and streak keys (preserves streak on re-login)
    const keysToRemove = allKeys.filter(
      (key) =>
        (key.startsWith('unsweet_') ||
        key.startsWith('user_') ||
        key.startsWith('onboarding_') ||
        key.startsWith('profile_') ||
        key.startsWith('settings_') ||
        key.startsWith('cache_') ||
        key.startsWith('notifications_')) &&
        key !== SUBSCRIPTION_OWNER_KEY && // SECURITY: Preserve subscription owner
        !STREAK_KEYS_TO_PRESERVE.includes(key) // UX: Preserve streak data (user-scoped in index.tsx)
    );

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
      console.log(`[UserDataService] Cleared ${keysToRemove.length} storage keys`);
      console.log('[UserDataService] Note: Subscription owner and streak keys preserved');
    }

    // Log out from RevenueCat to reset subscription state
    try {
      await Purchases.logOut();
      console.log('[UserDataService] RevenueCat logged out');
    } catch (rcError) {
      // RevenueCat might not be configured yet, or user already anonymous
      console.log('[UserDataService] RevenueCat logout skipped:', rcError);
    }

    console.log('[UserDataService] All user data cleared successfully');
  } catch (error) {
    console.error('[UserDataService] Failed to clear user data:', error);
    throw error;
  }
}

/**
 * Sync user with RevenueCat
 * Called on login to associate subscription with user
 */
export async function syncRevenueCatUser(userId: string): Promise<void> {
  try {
    console.log('[UserDataService] Syncing RevenueCat user:', userId);
    await Purchases.logIn(userId);
    console.log('[UserDataService] RevenueCat user synced');
  } catch (error) {
    console.error('[UserDataService] Failed to sync RevenueCat user:', error);
    // Don't throw - subscription sync failure shouldn't block login
  }
}

/**
 * Get user-scoped meals from local storage
 * Falls back to empty array if no data exists
 */
export async function getLocalMeals(userId: string): Promise<Meal[]> {
  try {
    const key = STORAGE_KEYS.MEALS(userId);
    const stored = await AsyncStorage.getItem(key);

    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }

    // Check for legacy data migration
    const legacyData = await AsyncStorage.getItem(STORAGE_KEYS.LEGACY_MEALS);
    if (legacyData) {
      console.log('[UserDataService] Migrating legacy meals data to user-scoped storage');
      const parsed = JSON.parse(legacyData);
      const meals = Array.isArray(parsed) ? parsed : [];

      // Save to user-scoped key
      await AsyncStorage.setItem(key, JSON.stringify(meals));

      // Remove legacy key
      await AsyncStorage.removeItem(STORAGE_KEYS.LEGACY_MEALS);

      return meals;
    }

    return [];
  } catch (error) {
    console.error('[UserDataService] Failed to get local meals:', error);
    return [];
  }
}

/**
 * Save meals to user-scoped local storage
 */
export async function saveLocalMeals(userId: string, meals: Meal[]): Promise<void> {
  try {
    const key = STORAGE_KEYS.MEALS(userId);
    await AsyncStorage.setItem(key, JSON.stringify(meals));
  } catch (error) {
    console.error('[UserDataService] Failed to save local meals:', error);
    throw error;
  }
}

/**
 * Fetch meals from Supabase database
 * Returns meals for the authenticated user (RLS enforced)
 */
export async function fetchMealsFromDatabase(): Promise<Meal[]> {
  try {
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      // Table might not exist yet - this is expected during migration
      if (error.code === '42P01') {
        console.log('[UserDataService] Meals table does not exist yet');
        return [];
      }
      throw error;
    }

    // Map database fields to local format
    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      sugarLevel: row.sugar_level,
      type: row.meal_type,
      timestamp: new Date(row.timestamp).getTime(),
      scannedFrom: row.scanned_from,
      imageUri: row.image_uri,
      verdict: row.verdict,
      sugarContent: row.sugar_content,
    }));
  } catch (error) {
    console.error('[UserDataService] Failed to fetch meals from database:', error);
    return [];
  }
}

/**
 * Upload an image to Supabase Storage and return the public URL
 * Converts local file:/// paths to permanent cloud storage URLs
 */
export async function uploadMealImage(localUri: string, mealId: string): Promise<string | null> {
  try {
    // Skip if not a local file URI (already uploaded or no image)
    if (!localUri || !localUri.startsWith('file://')) {
      return localUri || null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[UserDataService] No authenticated user, skipping image upload');
      return localUri; // Keep local URI as fallback
    }

    // Read the image file as base64
    const base64Data = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Determine file extension from URI
    const extension = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';

    // Create a unique filename: userId/mealId_timestamp.extension
    const fileName = `${user.id}/${mealId}_${Date.now()}.${extension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('meal-images')
      .upload(fileName, decode(base64Data), {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error('[UserDataService] Failed to upload image:', error);
      return localUri; // Keep local URI as fallback
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('meal-images')
      .getPublicUrl(fileName);

    console.log('[UserDataService] Image uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('[UserDataService] Image upload error:', error);
    return localUri; // Keep local URI as fallback
  }
}

/**
 * Save a meal to the database
 * Uses upsert to handle both insert and update
 * Automatically uploads local images to Supabase Storage
 */
export async function saveMealToDatabase(meal: Meal): Promise<string | undefined> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[UserDataService] No authenticated user, skipping database sync');
      return meal.imageUri;
    }

    // Upload image to Supabase Storage if it's a local file
    let permanentImageUri = meal.imageUri;
    if (meal.imageUri && meal.imageUri.startsWith('file://')) {
      const uploadedUrl = await uploadMealImage(meal.imageUri, meal.id);
      if (uploadedUrl && !uploadedUrl.startsWith('file://')) {
        permanentImageUri = uploadedUrl;
        console.log('[UserDataService] Image uploaded, using permanent URL');
      }
    }

    const { error } = await supabase
      .from('meals')
      .upsert({
        id: meal.id,
        user_id: user.id,
        name: meal.name,
        sugar_level: meal.sugarLevel,
        meal_type: meal.type,
        timestamp: new Date(meal.timestamp).toISOString(),
        scanned_from: meal.scannedFrom,
        image_uri: permanentImageUri,
        verdict: meal.verdict,
        sugar_content: meal.sugarContent,
      });

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        console.log('[UserDataService] Meals table does not exist yet, skipping sync');
        return meal.imageUri;
      }
      throw error;
    }

    // Return the permanent URL so it can be saved locally too
    return permanentImageUri;
  } catch (error) {
    console.error('[UserDataService] Failed to save meal to database:', error);
    // Don't throw - local storage is the source of truth for now
    return meal.imageUri;
  }
}

/**
 * Delete a meal from the database
 */
export async function deleteMealFromDatabase(mealId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('meals')
      .delete()
      .eq('id', mealId);

    if (error && error.code !== '42P01') {
      throw error;
    }
  } catch (error) {
    console.error('[UserDataService] Failed to delete meal from database:', error);
  }
}

/**
 * Sync local meals to database (bulk operation)
 * Called on login to ensure server has latest data
 */
export async function syncMealsToDatabase(meals: Meal[]): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || meals.length === 0) return;

    const mealsWithUserId = meals.map((meal) => ({
      id: meal.id,
      user_id: user.id,
      name: meal.name,
      sugar_level: meal.sugarLevel,
      meal_type: meal.type,
      timestamp: new Date(meal.timestamp).toISOString(),
      scanned_from: meal.scannedFrom,
      image_uri: meal.imageUri,
      verdict: meal.verdict,
      sugar_content: meal.sugarContent,
    }));

    const { error } = await supabase
      .from('meals')
      .upsert(mealsWithUserId, { onConflict: 'id' });

    if (error && error.code !== '42P01') {
      console.error('[UserDataService] Failed to sync meals to database:', error);
    } else {
      console.log(`[UserDataService] Synced ${meals.length} meals to database`);
    }
  } catch (error) {
    console.error('[UserDataService] Failed to sync meals to database:', error);
  }
}

/**
 * Full login sync - fetch data from server and merge with local
 * Called after successful authentication
 */
export async function performLoginSync(userId: string): Promise<{
  meals: Meal[];
}> {
  console.log('[UserDataService] Performing login sync for user:', userId);

  try {
    // 1. Sync RevenueCat
    await syncRevenueCatUser(userId);

    // 2. Get local meals (user-scoped)
    const localMeals = await getLocalMeals(userId);

    // 3. Fetch meals from database
    const serverMeals = await fetchMealsFromDatabase();

    // 4. Merge meals (server takes precedence, but include local-only meals)
    const serverMealIds = new Set(serverMeals.map((m) => m.id));
    const localOnlyMeals = localMeals.filter((m) => !serverMealIds.has(m.id));

    // Combine: server meals + local-only meals
    const mergedMeals = [...serverMeals, ...localOnlyMeals];

    // 5. Save merged meals locally
    await saveLocalMeals(userId, mergedMeals);

    // 6. Sync local-only meals to server
    if (localOnlyMeals.length > 0) {
      await syncMealsToDatabase(localOnlyMeals);
    }

    console.log('[UserDataService] Login sync complete:', {
      serverMeals: serverMeals.length,
      localOnlyMeals: localOnlyMeals.length,
      totalMeals: mergedMeals.length,
    });

    return { meals: mergedMeals };
  } catch (error) {
    console.error('[UserDataService] Login sync failed:', error);
    // Return local data as fallback
    const localMeals = await getLocalMeals(userId);
    return { meals: localMeals };
  }
}
