/**
 * Auth Error Translation
 *
 * Maps Supabase error codes and messages to user-friendly strings.
 * Security note: Same error for wrong email vs wrong password prevents enumeration attacks.
 */

// Map of Supabase error codes to user-friendly messages
const ERROR_MAP: Record<string, string> = {
  // Auth errors
  'invalid_credentials': 'Invalid email or password.',
  'invalid_login_credentials': 'Invalid email or password.',
  'user_not_found': 'No account found with this email.',
  'email_not_confirmed': 'Please verify your email first.',

  // Signup errors
  'user_already_exists': 'An account with this email already exists.',
  'email_exists': 'This email is already registered.',

  // Password errors
  'weak_password': 'Password must be at least 8 characters.',

  // Rate limiting
  'over_request_rate_limit': 'Too many attempts. Please wait a moment.',
  'too_many_requests': 'Too many attempts. Try again later.',

  // Session errors
  'session_expired': 'Session expired. Please login again.',
  'refresh_token_not_found': 'Session expired. Please login again.',

  // OAuth errors
  'oauth_error': 'Authentication failed. Please try again.',
  'provider_error': 'Could not connect to authentication provider.',

  // Network
  'network_error': 'Network error. Check your connection.',
};

// Patterns to match error messages
const ERROR_PATTERNS: Array<[RegExp, string]> = [
  [/invalid.*credential/i, 'Invalid email or password.'],
  [/user.*not.*found/i, 'No account found with this email.'],
  [/email.*not.*confirmed/i, 'Please verify your email first.'],
  [/already.*exists|already.*registered/i, 'This email is already registered.'],
  [/too.*many|rate.*limit/i, 'Too many attempts. Try again later.'],
  [/network|connection|fetch|timeout/i, 'Network error. Check your connection.'],
  [/expired|invalid.*token/i, 'Session expired. Please login again.'],
  [/cancelled|canceled/i, 'Sign in was cancelled.'],
  [/no.*session/i, 'Authentication failed. Please try again.'],
];

/**
 * Translates Supabase auth errors to user-friendly messages
 */
export function translateAuthError(error: unknown): string {
  // Handle null/undefined
  if (!error) {
    return 'An error occurred. Please try again.';
  }

  // Extract error info
  let code: string | undefined;
  let message: string | undefined;
  let status: number | undefined;

  if (typeof error === 'object') {
    const err = error as any;
    code = err.code || err.error_code;
    message = err.message || err.error_description;
    status = err.status || err.statusCode;
  } else if (typeof error === 'string') {
    message = error;
  }

  // 1. Check by error code
  if (code) {
    const mapped = ERROR_MAP[code.toLowerCase()];
    if (mapped) return mapped;
  }

  // 2. Check by HTTP status
  if (status) {
    if (status === 400 || status === 401) {
      return 'Invalid email or password.';
    }
    if (status === 422) {
      return 'Invalid email format.';
    }
    if (status === 429) {
      return 'Too many attempts. Try again later.';
    }
    if (status >= 500) {
      return 'Server error. Please try again later.';
    }
  }

  // 3. Check message patterns
  if (message) {
    for (const [pattern, friendlyMessage] of ERROR_PATTERNS) {
      if (pattern.test(message)) {
        return friendlyMessage;
      }
    }
  }

  // 4. Default fallback
  return 'Login failed. Please try again.';
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}
