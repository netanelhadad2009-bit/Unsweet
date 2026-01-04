/**
 * ScreenViewTracker - Automatic Screen View Analytics
 *
 * Tracks screen navigation changes and sends analytics events to PostHog.
 * Uses usePathname from expo-router to detect route changes.
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { usePostHog } from 'posthog-react-native';

export function ScreenViewTracker() {
  const pathname = usePathname();
  const posthog = usePostHog();
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    // Only track if pathname has changed (avoid duplicate events on re-renders)
    if (pathname && pathname !== previousPathnameRef.current) {
      posthog?.capture('$screen', {
        $screen_name: pathname,
      });
      previousPathnameRef.current = pathname;
    }
  }, [pathname, posthog]);

  return null; // This component doesn't render anything
}
