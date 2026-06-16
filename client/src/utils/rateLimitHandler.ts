/**
 * Rate Limit Handler — GitHub API Rate Limit Management
 * Handles 429 errors and provides user-friendly countdown messages
 */

export interface RateLimitInfo {
  isRateLimited: boolean;
  resetTime: number; // Unix timestamp in seconds
  remainingSeconds: number;
  message: string;
}

/**
 * Parse rate limit information from GitHub API response headers
 * 
 * @param response - Fetch Response object
 * @returns RateLimitInfo object with reset time and message
 */
export function parseRateLimitHeaders(response: Response): RateLimitInfo {
  const resetHeader = response.headers.get('X-RateLimit-Reset');
  const remainingHeader = response.headers.get('X-RateLimit-Remaining');
  
  if (!resetHeader) {
    return {
      isRateLimited: false,
      resetTime: 0,
      remainingSeconds: 0,
      message: '',
    };
  }

  const resetTime = parseInt(resetHeader, 10);
  const now = Math.floor(Date.now() / 1000);
  const remainingSeconds = Math.max(0, resetTime - now);
  const remaining = parseInt(remainingHeader || '0', 10);

  const minutes = Math.ceil(remainingSeconds / 60);
  const message = `⏱️ Rate limit alcanzado. ${remaining === 0 ? 'Disponible en' : 'Intenta de nuevo en'} ${minutes} minuto${minutes !== 1 ? 's' : ''}.`;

  return {
    isRateLimited: true,
    resetTime,
    remainingSeconds,
    message,
  };
}

/**
 * Format remaining time for display (e.g., "2m 30s")
 * 
 * @param seconds - Seconds remaining
 * @returns Formatted string
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return 'Disponible ahora';
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  if (minutes === 0) {
    return `${secs}s`;
  }
  if (secs === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${secs}s`;
}

/**
 * Create a countdown timer for rate limit reset
 * 
 * @param resetTime - Unix timestamp in seconds when rate limit resets
 * @param onTick - Callback function called every second with remaining seconds
 * @returns Cleanup function to stop the timer
 */
export function createRateLimitCountdown(
  resetTime: number,
  onTick: (remaining: number) => void
): () => void {
  const interval = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, resetTime - now);
    onTick(remaining);

    if (remaining <= 0) {
      clearInterval(interval);
    }
  }, 1000);

  return () => clearInterval(interval);
}

/**
 * Check if a fetch error is a rate limit error
 * 
 * @param error - Error object or response status
 * @returns true if it's a rate limit error
 */
export function isRateLimitError(status: number): boolean {
  return status === 429 || status === 403;
}

/**
 * Enhanced error message for rate limit scenarios
 * 
 * @param response - Fetch Response object
 * @param originalError - Original error message
 * @returns Enhanced error message with rate limit info
 */
export function enhanceErrorWithRateLimit(
  response: Response,
  originalError: string
): string {
  if (!isRateLimitError(response.status)) {
    return originalError;
  }

  const rateLimitInfo = parseRateLimitHeaders(response);
  if (rateLimitInfo.isRateLimited) {
    return rateLimitInfo.message;
  }

  return response.status === 429
    ? '⏱️ Rate limit alcanzado. Por favor, intenta de nuevo en unos minutos.'
    : originalError;
}
