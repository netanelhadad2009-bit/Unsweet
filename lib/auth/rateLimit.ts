/**
 * Client-Side Auth Rate Limiting
 *
 * Relaxed rate limiting to prevent spam while being forgiving to real users.
 * - Only counts actual API failures (not client-side validation errors)
 * - Resets on successful authentication
 * - Short lockout duration for genuine users who make mistakes
 */

// Relaxed rate limiting constants
const MAX_ATTEMPTS = 10; // Allow 10 attempts before lockout
const LOCKOUT_DURATION_MS = 30000; // 30 seconds lockout (short and forgiving)

// In-memory storage for attempt tracking (resets on app restart)
interface AttemptRecord {
  count: number;
  lastAttemptTime: number;
  lockedUntil: number | null;
}

const attemptRecords: Map<string, AttemptRecord> = new Map();

/**
 * Get or create an attempt record for a given key (e.g., 'login', 'signup', 'forgot-password')
 */
function getAttemptRecord(key: string): AttemptRecord {
  if (!attemptRecords.has(key)) {
    attemptRecords.set(key, {
      count: 0,
      lastAttemptTime: 0,
      lockedUntil: null,
    });
  }
  return attemptRecords.get(key)!;
}

/**
 * Check if the user is currently rate limited
 * @param key - The action key (e.g., 'login', 'signup')
 * @returns Object with isLocked status and remaining seconds if locked
 */
export function checkRateLimit(key: string): { isLocked: boolean; remainingSeconds: number } {
  const record = getAttemptRecord(key);
  const now = Date.now();

  // Check if lockout has expired
  if (record.lockedUntil && now >= record.lockedUntil) {
    // Lockout expired - reset the record
    record.count = 0;
    record.lockedUntil = null;
  }

  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingMs = record.lockedUntil - now;
    return {
      isLocked: true,
      remainingSeconds: Math.ceil(remainingMs / 1000),
    };
  }

  return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Record a failed API attempt (NOT for client-side validation errors)
 * Only call this when the API returns an actual error
 * @param key - The action key (e.g., 'login', 'signup')
 * @returns true if now locked out, false otherwise
 */
export function recordFailedAttempt(key: string): boolean {
  const record = getAttemptRecord(key);
  const now = Date.now();

  // Increment attempt count
  record.count += 1;
  record.lastAttemptTime = now;

  // Check if we've hit the limit
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    return true; // Now locked out
  }

  return false;
}

/**
 * Reset attempt counter on successful authentication
 * @param key - The action key (e.g., 'login', 'signup')
 */
export function resetAttempts(key: string): void {
  const record = getAttemptRecord(key);
  record.count = 0;
  record.lockedUntil = null;
  record.lastAttemptTime = 0;
}

/**
 * Get remaining attempts before lockout
 * @param key - The action key (e.g., 'login', 'signup')
 * @returns Number of attempts remaining
 */
export function getRemainingAttempts(key: string): number {
  const record = getAttemptRecord(key);
  return Math.max(0, MAX_ATTEMPTS - record.count);
}

/**
 * Format a user-friendly rate limit message
 * @param remainingSeconds - Seconds until lockout expires
 * @returns User-friendly message
 */
export function formatRateLimitMessage(remainingSeconds: number): string {
  if (remainingSeconds <= 60) {
    return `Too many attempts. Please wait ${remainingSeconds} seconds before trying again.`;
  }
  const minutes = Math.ceil(remainingSeconds / 60);
  return `Too many attempts. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`;
}
