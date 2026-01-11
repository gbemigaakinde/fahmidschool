/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Enhanced Button Loading States
 * 
 * Purpose: Provide consistent loading states for all buttons
 * 
 * @version 1.0.0
 * @date 2026-01-11
 */

'use strict';

/**
 * Button Loading Manager
 * Handles loading states for buttons consistently across the app
 */
window.ButtonLoader = (function() {
  
  // Store original button states
  const buttonStates = new WeakMap();
  
  /**
   * Show loading state on button
   * @param {HTMLElement|string} button - Button element or selector
   * @param {string} loadingText - Text to show while loading
   * @returns {Function} restore - Function to restore original state
   */
  function showLoading(button, loadingText = 'Loading...') {
    const btn = typeof button === 'string' ? document.querySelector(button) : button;
    
    if (!btn) {
      console.warn('ButtonLoader: Button not found');
      return () => {};
    }
    
    // Save original state
    buttonStates.set(btn, {
      innerHTML: btn.innerHTML,
      disabled: btn.disabled,
      cursor: btn.style.cursor,
      opacity: btn.style.opacity
    });
    
    // Apply loading state
    btn.disabled = true;
    btn.style.cursor = 'not-allowed';
    btn.style.opacity = '0.65';
    
    // Create loading content with spinner
    btn.innerHTML = `
      <span style="display:inline-flex; align-items:center; gap:0.5rem;">
        <span class="btn-spinner" style="
          width: 14px;
          height: 14px;
          border: 2px solid transparent;
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        "></span>
        ${loadingText}
      </span>
    `;
    
    // Return restore function
    return () => restore(btn);
  }
  
  /**
   * Restore button to original state
   */
  function restore(button) {
    const btn = typeof button === 'string' ? document.querySelector(button) : button;
    
    if (!btn) {
      console.warn('ButtonLoader: Button not found for restore');
      return;
    }
    
    const originalState = buttonStates.get(btn);
    
    if (!originalState) {
      console.warn('ButtonLoader: No saved state found');
      return;
    }
    
    // Restore original state
    btn.innerHTML = originalState.innerHTML;
    btn.disabled = originalState.disabled;
    btn.style.cursor = originalState.cursor;
    btn.style.opacity = originalState.opacity;
    
    // Clean up
    buttonStates.delete(btn);
  }
  
  /**
   * Wrap an async function with automatic loading state
   * @param {HTMLElement|string} button
   * @param {Function} asyncFn - Async function to execute
   * @param {string} loadingText - Loading text
   */
  async function withLoading(button, asyncFn, loadingText = 'Loading...') {
    const restore = showLoading(button, loadingText);
    
    try {
      const result = await asyncFn();
      return result;
    } catch (error) {
      throw error;
    } finally {
      restore();
    }
  }
  
  /**
   * Show success state briefly before restoring
   */
  function showSuccess(button, successText = '✓ Success', duration = 2000) {
    const btn = typeof button === 'string' ? document.querySelector(button) : button;
    
    if (!btn) return;
    
    // Save current state
    const originalHTML = btn.innerHTML;
    const originalDisabled = btn.disabled;
    
    // Show success
    btn.innerHTML = successText;
    btn.disabled = true;
    btn.style.background = '#4CAF50';
    btn.style.color = 'white';
    
    // Restore after duration
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = originalDisabled;
      btn.style.background = '';
      btn.style.color = '';
    }, duration);
  }
  
  /**
   * Show error state briefly before restoring
   */
  function showError(button, errorText = '✗ Error', duration = 2000) {
    const btn = typeof button === 'string' ? document.querySelector(button) : button;
    
    if (!btn) return;
    
    // Save current state
    const originalHTML = btn.innerHTML;
    const originalDisabled = btn.disabled;
    
    // Show error
    btn.innerHTML = errorText;
    btn.disabled = true;
    btn.style.background = '#f44336';
    btn.style.color = 'white';
    
    // Restore after duration
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = originalDisabled;
      btn.style.background = '';
      btn.style.color = '';
    }, duration);
  }
  
  // Public API
  return {
    showLoading,
    restore,
    withLoading,
    showSuccess,
    showError
  };
})();

/**
 * Add global CSS for button spinner animation if not exists
 */
if (!document.querySelector('#btn-spinner-styles')) {
  const style = document.createElement('style');
  style.id = 'btn-spinner-styles';
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .btn-spinner {
      display: inline-block;
      animation: spin 0.8s linear infinite;
    }
    
    /* Enhanced button states */
    .btn:disabled {
      cursor: not-allowed !important;
      opacity: 0.65;
    }
    
    .btn-loading {
      position: relative;
      pointer-events: none;
    }
    
    /* Success/Error flash animations */
    @keyframes flashSuccess {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    
    @keyframes flashError {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
  `;
  document.head.appendChild(style);
}

console.log('✓ Button loading states manager loaded');