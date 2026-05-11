// shared/retry.js
// Network retry helper with exponential backoff (ES Module)

import { showToast } from '../ui/toast.js';

/**
 * Retry an async operation with exponential backoff.
 * Retries only on transient network/availability errors.
 * Backoff schedule: 1s → 2s → 4s → 8s (capped at 8s)
 *
 * @param {Function} operation      - Async function to attempt
 * @param {number}  [maxRetries=3]  - Maximum number of attempts
 * @param {string}  [operationName='Operation'] - Label used in toast feedback
 * @returns {Promise<any>}
 */
export async function retryWithBackoff(operation, maxRetries = 3, operationName = 'Operation') {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        showToast(`Retrying ${operationName}... (Attempt ${attempt}/${maxRetries})`, 'info', 2000);
      }

      const result = await operation();

      if (attempt > 1) {
        showToast(`✓ ${operationName} succeeded after ${attempt} attempt(s)`, 'success', 3000);
      }

      return result;

    } catch (error) {
      lastError = error;

      const isRetryable =
        error?.code === 'unavailable'       ||
        error?.code === 'deadline-exceeded' ||
        error?.code === 'cancelled'         ||
        /network|timeout|unavailable/i.test(error?.message || '');

      if (!isRetryable) {
        console.error(`Non-retryable error during ${operationName}:`, error);
        throw error;
      }

      console.warn(`${operationName} failed (attempt ${attempt}/${maxRetries}):`, error.code || error.message);

      if (attempt === maxRetries) {
        showToast(`${operationName} failed after ${maxRetries} attempts. Please check your connection.`, 'danger', 6000);
        throw lastError;
      }

      const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      console.log(`Waiting ${backoffTime}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
  }

  // Should never reach here, but safety fallback
  throw lastError;
}
