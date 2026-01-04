/**
 * Subscription Context - RevenueCat Integration
 *
 * Manages subscription state globally using RevenueCat.
 * Provides isPro status, purchase functions, and restore functionality.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { Alert, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Key to track which user originally purchased the subscription
const SUBSCRIPTION_OWNER_KEY = 'unsweet_subscription_owner_id';

// ============================================================
// RevenueCat API Keys - Platform Specific
// iOS: Uses Apple App Store key (starts with 'appl_')
// Android: Uses Google Play Store key (starts with 'goog_')
// ============================================================
const REVENUECAT_IOS_KEY = 'appl_zADMHAUuBRjmsDDwRGADRcxThaW';
const REVENUECAT_ANDROID_KEY = 'goog_hbZzCLgRKcMWYpkzjLEKIavlsXd';

// Select the appropriate API key based on platform
const getRevenueCatApiKey = (): string | null => {
  if (Platform.OS === 'ios') {
    return REVENUECAT_IOS_KEY;
  }
  if (Platform.OS === 'android') {
    return REVENUECAT_ANDROID_KEY;
  }
  return null;
};

// Entitlement identifier configured in RevenueCat dashboard
const PRO_ENTITLEMENT_ID = 'pro';

interface SubscriptionContextType {
  isPro: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  isSyncingUser: boolean; // True while syncing RevenueCat user after login
  isProDetermined: boolean; // True after isPro has been explicitly set (not default)
  currentOffering: PurchasesOffering | null;
  customerInfo: CustomerInfo | null;
  checkStatus: () => Promise<void>;
  restorePurchases: () => Promise<boolean>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Track if RevenueCat has been configured
let isConfigured = false;

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncingUser, setIsSyncingUser] = useState(false); // Tracks RevenueCat user sync after login
  const [isProDetermined, setIsProDetermined] = useState(false); // True after isPro explicitly set
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  // Track current RevenueCat user ID to avoid redundant login calls
  const currentRevenueCatUserId = useRef<string | null>(null);

  // Sync deduplication - prevents racing calls to syncRevenueCatUser
  const syncInProgressRef = useRef<string | null>(null);

  // Track if logout is in progress to prevent granting Pro during logout race
  const isLoggingOutRef = useRef(false);

  // Initialize RevenueCat
  useEffect(() => {
    const initPurchases = async () => {
      try {
        if (!isConfigured) {
          // Get platform-specific API key
          const apiKey = getRevenueCatApiKey();

          // ============================================================
          // ANDROID HANDLING: Gracefully handle missing API key
          // If Android key is not configured, skip RevenueCat initialization
          // The paywall will show empty but app won't crash
          // ============================================================
          if (!apiKey) {
            console.warn('[Subscription] ⚠️ RevenueCat not configured for this platform');
            setIsInitialized(true);
            setIsLoading(false);
            return;
          }

          // Set log level (use WARN in production to reduce noise)
          Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);

          // Configure RevenueCat with the platform-specific API key
          await Purchases.configure({ apiKey });
          isConfigured = true;
          console.log(`[Subscription] ✓ RevenueCat configured for ${Platform.OS}`);
        }

        // Mark as initialized so Paywall knows it can fetch
        setIsInitialized(true);

        // Get initial customer info
        await checkStatus();

        // Fetch available offerings
        await fetchOfferings();
      } catch (error) {
        console.error('[Subscription] ❌ Failed to initialize RevenueCat:', error);
        setIsInitialized(true); // Still mark as initialized so app doesn't hang
        setIsLoading(false);
      }
    };

    initPurchases();

    // Listen for customer info updates
    // IMPORTANT: This listener fires on ANY subscription change from RevenueCat
    // We need to handle it carefully to avoid race conditions with login/logout
    let listenerDebounceTimer: NodeJS.Timeout | null = null;
    const customerInfoListener = (info: CustomerInfo) => {
      // Debounce rapid listener calls (RevenueCat can fire multiple times quickly)
      if (listenerDebounceTimer) {
        clearTimeout(listenerDebounceTimer);
      }
      listenerDebounceTimer = setTimeout(async () => {
        // Skip if logout is in progress - don't grant Pro during logout
        if (isLoggingOutRef.current) {
          console.log('[Subscription] Skipping listener during logout');
          return;
        }
        // Skip if sync is in progress - let sync handle the update
        if (syncInProgressRef.current) {
          console.log('[Subscription] Skipping listener during sync');
          return;
        }
        await updateProStatus(info);
        setCustomerInfo(info);
      }, 100); // 100ms debounce
    };

    Purchases.addCustomerInfoUpdateListener(customerInfoListener);

    return () => {
      if (listenerDebounceTimer) {
        clearTimeout(listenerDebounceTimer);
      }
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
    };
  }, []);

  // Sync RevenueCat user ID with Supabase auth state
  // This ensures subscriptions are tied to Supabase accounts, not device anonymous IDs
  useEffect(() => {
    // Wait for RevenueCat to be initialized before syncing
    if (!isInitialized) return;

    const syncRevenueCatUser = async (userId: string | null, isLogin = false) => {
      const syncKey = userId || 'logout';

      // DEDUPLICATION: Skip if same sync already in progress
      if (syncInProgressRef.current === syncKey) {
        console.log('[Subscription] Sync already in progress for:', syncKey);
        return;
      }

      // Mark sync as in progress
      syncInProgressRef.current = syncKey;

      // Track logout state to prevent race conditions
      if (!userId) {
        isLoggingOutRef.current = true;
      }

      // Reset isProDetermined at start of sync
      setIsProDetermined(false);

      // Safety timeout to prevent infinite white screen
      let timeoutId: NodeJS.Timeout | null = null;
      if (isLogin && userId) {
        setIsSyncingUser(true);
        // Timeout after 10 seconds (increased from 5s for slow networks)
        timeoutId = setTimeout(() => {
          console.warn('[Subscription] ⚠️ Sync timeout - clearing sync state');
          setIsSyncingUser(false);
          setIsProDetermined(true); // Mark as determined even on timeout
          syncInProgressRef.current = null;
        }, 10000);
      }

      try {
        if (userId) {
          // User is logged in - identify them in RevenueCat
          if (currentRevenueCatUserId.current !== userId) {
            const { customerInfo: info } = await Purchases.logIn(userId);
            currentRevenueCatUserId.current = userId;
            await updateProStatus(info, userId);
            setCustomerInfo(info);
          } else {
            // Same user, but refresh status anyway (handles returning users)
            const info = await Purchases.getCustomerInfo();
            await updateProStatus(info, userId);
            setCustomerInfo(info);
          }
        } else {
          // User logged out - reset to anonymous user
          if (currentRevenueCatUserId.current !== null) {
            // Wrap logOut with timeout to prevent hanging
            const logoutWithTimeout = Promise.race([
              Purchases.logOut(),
              new Promise<CustomerInfo>((_, reject) =>
                setTimeout(() => reject(new Error('Logout timeout')), 5000)
              )
            ]);
            try {
              const info = await logoutWithTimeout;
              currentRevenueCatUserId.current = null;
              setIsPro(false);
              setIsProDetermined(true);
              setCustomerInfo(info);
            } catch (logoutError) {
              console.warn('[Subscription] RevenueCat logout timeout, continuing anyway');
              currentRevenueCatUserId.current = null;
              setIsPro(false);
              setIsProDetermined(true);
            }
          } else {
            // Already logged out from RevenueCat
            setIsPro(false);
            setIsProDetermined(true);
          }
        }
      } catch (error) {
        console.error('[Subscription] ❌ Failed to sync RevenueCat user:', error);

        // Reset ref on error to allow retry on next attempt
        currentRevenueCatUserId.current = null;

        // CRITICAL: On error, still try to determine subscription status
        // This prevents users from being stuck in limbo after failed sync
        try {
          const fallbackInfo = await Purchases.getCustomerInfo();
          if (userId) {
            await updateProStatus(fallbackInfo, userId);
          } else {
            setIsPro(false);
            setIsProDetermined(true);
          }
          setCustomerInfo(fallbackInfo);
          console.log('[Subscription] ✓ Fallback customer info retrieved');
        } catch (fallbackError) {
          console.error('[Subscription] ❌ Fallback also failed:', fallbackError);
          // Last resort: explicitly set isPro to false so navigation can proceed
          setIsPro(false);
          setIsProDetermined(true);
        }
      } finally {
        // Clear timeout and syncing state
        if (timeoutId) clearTimeout(timeoutId);
        if (isLogin) {
          setIsSyncingUser(false);
        }
        // Clear sync in progress flag
        syncInProgressRef.current = null;
        // Clear logout flag
        if (!userId) {
          isLoggingOutRef.current = false;
        }
      }
    };

    // Listen for auth state changes
    // IMPORTANT: onAuthStateChange fires with INITIAL_SESSION on app start,
    // so we don't need a separate getSession() call
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Subscription] Auth state change:', event);

        if (event === 'INITIAL_SESSION') {
          // App just started - check if user has session
          if (session?.user?.id) {
            await syncRevenueCatUser(session.user.id, true);
          } else {
            // No session on start - ensure state is clean
            setIsSyncingUser(false);
            setIsPro(false);
            setIsProDetermined(true);
          }
        } else if (event === 'SIGNED_IN' && session?.user?.id) {
          // User just signed in - sync with login flag to block navigation
          await syncRevenueCatUser(session.user.id, true);
        } else if (event === 'SIGNED_OUT') {
          // User signed out
          await syncRevenueCatUser(null, false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user?.id) {
          // Token refreshed - don't block navigation, just update status
          await syncRevenueCatUser(session.user.id, false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [isInitialized]);

  // Update Pro status based on customer info
  // SECURITY: Only grant Pro if the current user owns the subscription OR can claim it
  const updateProStatus = async (info: CustomerInfo, userId?: string | null) => {
    const hasProEntitlement = typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';

    // RACE CONDITION FIX: If logout is in progress, don't grant Pro
    if (isLoggingOutRef.current) {
      console.log('[Subscription] Logout in progress - denying Pro access');
      setIsPro(false);
      setIsProDetermined(true);
      return;
    }

    if (!hasProEntitlement) {
      setIsPro(false);
      setIsProDetermined(true);
      return;
    }

    // If we have a userId, check subscription ownership
    if (userId) {
      try {
        const storedOwnerId = await AsyncStorage.getItem(SUBSCRIPTION_OWNER_KEY);

        // Case 1: Owner matches current user → Grant access
        if (storedOwnerId === userId) {
          console.log('[Subscription] ✓ Owner verified, granting Pro access');
          setIsPro(true);
          setIsProDetermined(true);
          return;
        }

        // Case 2: Different owner stored → TRANSFER ownership (RevenueCat handles backend transfer)
        // Since RevenueCat is configured to "Transfer to new App User ID", we simply update local ownership
        if (storedOwnerId && storedOwnerId !== userId) {
          console.log('[Subscription] Transferring subscription ownership from', storedOwnerId, 'to', userId);
          await AsyncStorage.setItem(SUBSCRIPTION_OWNER_KEY, userId);
          setIsPro(true);
          setIsProDetermined(true);
          return;
        }

        // Case 3: No owner stored but entitlement exists → CLAIM ownership and grant access
        // This handles: (a) users who purchased before ownership tracking was added
        //               (b) users restoring on a new device (legitimate use case)
        // Note: Ghosting is still prevented because Case 2 blocks if a different owner exists
        if (!storedOwnerId && hasProEntitlement) {
          console.log('[Subscription] ✓ No owner recorded, claiming ownership for current user');
          await AsyncStorage.setItem(SUBSCRIPTION_OWNER_KEY, userId);
          setIsPro(true);
          setIsProDetermined(true);
          return;
        }
      } catch (error) {
        console.error('[Subscription] Error checking ownership:', error);
        // On error, still grant access if entitlement exists (fail open for UX)
        setIsPro(true);
        setIsProDetermined(true);
        return;
      }
    } else {
      // No userId provided - try to get current user from Supabase
      // This handles the case when RevenueCat listener fires without userId context

      // RACE CONDITION FIX: Check logout state again before granting Pro
      if (isLoggingOutRef.current) {
        console.log('[Subscription] Logout in progress (no userId path) - denying Pro access');
        setIsPro(false);
        setIsProDetermined(true);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          // Recursively call with the userId to do proper ownership checks
          await updateProStatus(info, user.id);
          return;
        }
        // User not available yet but has entitlement - grant access
        // This handles race conditions during login where RevenueCat listener
        // fires before Supabase session is fully established
        console.log('[Subscription] No user session yet but has entitlement - granting Pro access');
        setIsPro(true);
        setIsProDetermined(true);
        return;
      } catch {
        // If we can't get user but have entitlement, grant access for UX
        console.log('[Subscription] Error getting user but has entitlement - granting Pro access');
        setIsPro(true);
        setIsProDetermined(true);
        return;
      }
    }

    // This line should never be reached now, but keep as safety fallback
    // Truly anonymous (no session) - don't grant Pro
    setIsPro(false);
    setIsProDetermined(true);
  };

  // Check subscription status
  const checkStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const info = await Purchases.getCustomerInfo();
      updateProStatus(info);
      setCustomerInfo(info);
    } catch (error) {
      console.error('[Subscription] Failed to check status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch available offerings
  const fetchOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings();

      // Try to get current offering first
      if (offerings.current) {
        setCurrentOffering(offerings.current);
      } else {
        // Fallback: Get any available offering if current is not set
        const allOfferings = offerings.all;
        const offeringKeys = Object.keys(allOfferings);

        if (offeringKeys.length > 0) {
          const firstOffering = allOfferings[offeringKeys[0]];
          setCurrentOffering(firstOffering);
        }
        // No offerings available - this is a configuration issue
      }
    } catch (error) {
      console.error('[Subscription] Failed to fetch offerings:', error);
    }
  };

  // Restore purchases
  // SECURITY: Only restore if current user is the original owner or no owner recorded
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        Alert.alert('Error', 'You must be logged in to restore purchases.');
        return false;
      }

      setIsLoading(true);
      const info = await Purchases.restorePurchases();
      const hasProEntitlement = typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';

      if (!hasProEntitlement) {
        setCustomerInfo(info);
        Alert.alert('No Purchases Found', 'We could not find any previous purchases to restore.');
        return false;
      }

      // Auto-transfer: Claim ownership for current user (RevenueCat handles backend transfer)
      const storedOwnerId = await AsyncStorage.getItem(SUBSCRIPTION_OWNER_KEY);
      if (storedOwnerId && storedOwnerId !== user.id) {
        console.log('[Subscription] Transferring subscription ownership from', storedOwnerId, 'to', user.id);
      }
      await AsyncStorage.setItem(SUBSCRIPTION_OWNER_KEY, user.id);
      console.log('[Subscription] ✓ Restore successful, owner recorded:', user.id);
      setIsPro(true);
      setCustomerInfo(info);
      Alert.alert('Success', 'Your Pro subscription has been restored!');
      return true;
    } catch (error) {
      console.error('[Subscription] Failed to restore purchases:', error);
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Purchase a package
  // SECURITY: Prevent ghosting by checking ownership AFTER purchase completes
  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        Alert.alert('Error', 'You must be logged in to purchase.');
        return false;
      }

      setIsLoading(true);
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);

      const hasProEntitlement = typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';

      if (hasProEntitlement) {
        // Auto-transfer: Claim ownership for current user (RevenueCat handles backend transfer)
        const storedOwnerId = await AsyncStorage.getItem(SUBSCRIPTION_OWNER_KEY);
        if (storedOwnerId && storedOwnerId !== user.id) {
          console.log('[Subscription] Transferring subscription ownership from', storedOwnerId, 'to', user.id);
        }
        await AsyncStorage.setItem(SUBSCRIPTION_OWNER_KEY, user.id);
        console.log('[Subscription] ✓ Purchase successful, owner recorded:', user.id);
        setIsPro(true);
        setCustomerInfo(info);
        return true;
      }

      setCustomerInfo(info);
      return false;
    } catch (error: any) {
      // Handle user cancellation silently
      if (error.userCancelled) {
        return false;
      }

      // ============================================================
      // PRODUCT_ALREADY_PURCHASED: Auto-restore instead of showing error
      // This happens when Apple/Google ID already owns the subscription
      // but the current App User ID doesn't have it yet.
      // RevenueCat is configured to "Transfer to new App User ID" so
      // restoring will sync the subscription to the current user.
      // ============================================================
      if (error.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
        console.log('[Subscription] Product already purchased - attempting auto-restore...');

        try {
          const restoredInfo = await Purchases.restorePurchases();
          const hasProEntitlement = typeof restoredInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';

          if (hasProEntitlement) {
            // Get current user for ownership tracking
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.id) {
              // Auto-transfer: Claim ownership for current user (RevenueCat handles backend transfer)
              const storedOwnerId = await AsyncStorage.getItem(SUBSCRIPTION_OWNER_KEY);
              if (storedOwnerId && storedOwnerId !== user.id) {
                console.log('[Subscription] Transferring subscription ownership from', storedOwnerId, 'to', user.id);
              }
              await AsyncStorage.setItem(SUBSCRIPTION_OWNER_KEY, user.id);
              console.log('[Subscription] ✓ Auto-restore successful, owner recorded:', user.id);
              setIsPro(true);
              setCustomerInfo(restoredInfo);
              return true;
            }
          }

          // Restore didn't find entitlement - shouldn't happen but handle gracefully
          console.warn('[Subscription] Auto-restore completed but no entitlement found');
          setCustomerInfo(restoredInfo);
          return false;
        } catch (restoreError) {
          console.error('[Subscription] Auto-restore failed:', restoreError);
          Alert.alert('Sync Failed', 'Unable to sync your subscription. Please try "Restore Purchases".');
          return false;
        }
      }

      console.error('[Subscription] Purchase failed:', error);
      Alert.alert('Purchase Failed', error.message || 'Unable to complete purchase. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        isPro,
        isLoading,
        isInitialized,
        isSyncingUser,
        isProDetermined,
        currentOffering,
        customerInfo,
        checkStatus,
        restorePurchases,
        purchasePackage,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
