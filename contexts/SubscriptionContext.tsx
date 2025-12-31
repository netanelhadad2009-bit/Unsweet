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
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  // Track current RevenueCat user ID to avoid redundant login calls
  const currentRevenueCatUserId = useRef<string | null>(null);

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
    const customerInfoListener = (info: CustomerInfo) => {
      updateProStatus(info);
      setCustomerInfo(info);
    };

    Purchases.addCustomerInfoUpdateListener(customerInfoListener);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
    };
  }, []);

  // Sync RevenueCat user ID with Supabase auth state
  // This ensures subscriptions are tied to Supabase accounts, not device anonymous IDs
  useEffect(() => {
    // Wait for RevenueCat to be initialized before syncing
    if (!isInitialized) return;

    const syncRevenueCatUser = async (userId: string | null, isLogin = false) => {
      // Safety timeout to prevent infinite white screen
      let timeoutId: NodeJS.Timeout | null = null;
      if (isLogin && userId) {
        setIsSyncingUser(true);
        // Timeout after 5 seconds to prevent white screen of death
        timeoutId = setTimeout(() => {
          console.warn('[Subscription] ⚠️ Sync timeout - clearing sync state');
          setIsSyncingUser(false);
        }, 5000);
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
            const info = await Purchases.logOut();
            currentRevenueCatUserId.current = null;
            await updateProStatus(info, null);
            setCustomerInfo(info);
          }
        }
      } catch (error) {
        console.error('[Subscription] ❌ Failed to sync RevenueCat user:', error);
      } finally {
        // Clear timeout and syncing state
        if (timeoutId) clearTimeout(timeoutId);
        if (isLogin) {
          setIsSyncingUser(false);
        }
      }
    };

    // Get initial session and sync (mark as login to block navigation)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        syncRevenueCatUser(session.user.id, true);
      } else {
        // No session - make sure sync state is cleared
        setIsSyncingUser(false);
        syncRevenueCatUser(null, false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user?.id) {
          // Sync immediately with login flag to block navigation until complete
          await syncRevenueCatUser(session.user.id, true);
        } else if (event === 'SIGNED_OUT') {
          await syncRevenueCatUser(null, false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [isInitialized]);

  // Update Pro status based on customer info
  // SECURITY: Only grant Pro if the current user owns the subscription OR can claim it
  const updateProStatus = async (info: CustomerInfo, userId?: string | null) => {
    const hasProEntitlement = typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';

    if (!hasProEntitlement) {
      setIsPro(false);
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
          return;
        }

        // Case 2: Different owner stored → DENY (subscription belongs to someone else on this device)
        // This prevents subscription ghosting when User B logs in after User A on same device
        if (storedOwnerId && storedOwnerId !== userId) {
          console.log('[Subscription] ⚠️ Subscription belongs to different user, denying Pro access');
          console.log(`[Subscription] Owner: ${storedOwnerId}, Current: ${userId}`);
          setIsPro(false);
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
          return;
        }
      } catch (error) {
        console.error('[Subscription] Error checking ownership:', error);
        // On error, still grant access if entitlement exists (fail open for UX)
        setIsPro(true);
        return;
      }
    }

    // No userId provided (anonymous) - don't grant Pro
    setIsPro(false);
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

      // SECURITY: Check ownership before granting access
      const storedOwnerId = await AsyncStorage.getItem(SUBSCRIPTION_OWNER_KEY);

      if (storedOwnerId && storedOwnerId !== user.id) {
        // Different owner - subscription belongs to another account
        console.log('[Subscription] ⚠️ Restore blocked: subscription belongs to different user');
        setCustomerInfo(info);
        setIsPro(false);
        Alert.alert(
          'Cannot Restore',
          'This subscription belongs to a different account. Please log in with the original account that made the purchase.'
        );
        return false;
      }

      // No owner recorded or same owner - claim/confirm ownership and grant access
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

      // Check current entitlement status BEFORE purchase
      // This helps us detect if Apple restored an existing subscription vs charged for new
      const preInfo = await Purchases.getCustomerInfo();
      const hadProBefore = typeof preInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';

      // SECURITY: If user already has entitlement AND a different owner exists
      // This means they're trying to use someone else's subscription
      const storedOwnerId = await AsyncStorage.getItem(SUBSCRIPTION_OWNER_KEY);
      if (hadProBefore && storedOwnerId && storedOwnerId !== user.id) {
        console.log('[Subscription] ⚠️ Purchase blocked: user has inherited entitlement from different owner');
        Alert.alert(
          'Subscription Exists',
          'An active subscription from a different account was found on this device. Please log in with the original account, or contact support.'
        );
        return false;
      }

      setIsLoading(true);
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);

      const hasProEntitlement = typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';

      if (hasProEntitlement) {
        // SECURITY: Check if this was a ghosted restoration (had entitlement before, different owner)
        // If they had no entitlement before and have it now → legitimate new purchase
        // If they had entitlement before but same owner or no owner → legitimate renewal/claim
        if (hadProBefore && storedOwnerId && storedOwnerId !== user.id) {
          // This shouldn't happen as we block above, but double-check
          console.log('[Subscription] ⚠️ Ghosting detected after purchase');
          setIsPro(false);
          setCustomerInfo(info);
          return false;
        }

        // Record this user as the subscription owner
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
