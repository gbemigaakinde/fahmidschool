/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Main JavaScript File - Phases 4-7 Complete
 * 
 * Handles:
 * - Hamburger menu toggle
 * - Gallery lightbox
 * - Toast notifications
 * - Keyboard navigation
 * 
 * @version 2.0.0
 * @date 2026-01-03
 */

'use strict';

// ============================================
// PHASE 4: HAMBURGER MENU FUNCTIONALITY
// ============================================

/**
 * Initialize hamburger menu functionality
 * Handles mobile navigation toggle with proper ARIA attributes
 */
function initHamburgerMenu() {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar') || document.getElementById('admin-sidebar') || document.getElementById('teacher-sidebar');
    
    if (!hamburger || !sidebar) return;

    /**
     * Toggle sidebar visibility
     */
    function toggleSidebar() {
        hamburger.classList.toggle('active');
        sidebar.classList.toggle('active');
        
        // Update ARIA attribute for accessibility
        const isExpanded = sidebar.classList.contains('active');
        hamburger.setAttribute('aria-expanded', isExpanded);
        
        // Prevent body scroll when sidebar is open on mobile
        if (isExpanded) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    // Click handler
    hamburger.addEventListener('click', toggleSidebar);

    /**
     * Close sidebar when clicking outside
     * @param {Event} e - Click event
     */
    function handleOutsideClick(e) {
        if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
            if (sidebar.classList.contains('active')) {
                toggleSidebar();
            }
        }
    }

    document.addEventListener('click', handleOutsideClick);

    /**
     * Close sidebar with Escape key
     * @param {KeyboardEvent} e - Keyboard event
     */
    function handleEscapeKey(e) {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            toggleSidebar();
            hamburger.focus(); // Return focus to trigger element
        }
    }

    document.addEventListener('keydown', handleEscapeKey);

    // Close sidebar when window is resized above mobile breakpoint
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > 1024 && sidebar.classList.contains('active')) {
                toggleSidebar();
            }
        }, 250);
    });
}

// ============================================
// PHASE 4: GALLERY LIGHTBOX
// ============================================

/**
 * Initialize gallery lightbox functionality
 * Handles image viewing with keyboard navigation
 */
function initGalleryLightbox() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.querySelector('.lightbox-close');

    if (!galleryItems.length || !lightbox || !lightboxImg) return;

    /**
     * Open lightbox with image
     * @param {string} src - Image source URL
     * @param {string} alt - Image alt text
     */
    function openLightbox(src, alt) {
        lightboxImg.src = src;
        lightboxImg.alt = alt;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focus the lightbox for keyboard navigation
        lightbox.focus();
    }

    /**
     * Close lightbox
     */
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        lightboxImg.src = '';
    }

    // Add click handlers to gallery items
    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            const img = item.querySelector('img');
            if (img) {
                openLightbox(img.src, img.alt);
            }
        });

        // Keyboard support for gallery items
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const img = item.querySelector('img');
                if (img) {
                    openLightbox(img.src, img.alt);
                }
            }
        });
    });

    // Close lightbox on click
    lightbox.addEventListener('click', closeLightbox);

    // Close button click
    if (lightboxClose) {
        lightboxClose.addEventListener('click', (e) => {
            e.stopPropagation();
            closeLightbox();
        });
    }

    // Close lightbox with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });
}

// ============================================
// PHASE 5: TOAST NOTIFICATIONS
// ============================================

/**
 * Show toast notification
 * @param {string} message - Toast message to display
 * @param {string} type - Toast type: 'success', 'danger', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
window.showToast = function(message, type = 'info', duration = 3000) {
    // Get or create toast container
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    
    // Add icon based on type
    const icon = getToastIcon(type);
    if (icon) {
        const iconSpan = document.createElement('span');
        iconSpan.textContent = icon;
        iconSpan.style.fontSize = '1.2em';
        toast.insertBefore(iconSpan, toast.firstChild);
    }

    container.appendChild(toast);

    // Trigger show animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove toast after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300); // Match transition duration
    }, duration);
};

/**
 * Get icon for toast type
 * @param {string} type - Toast type
 * @returns {string} Emoji icon
 */
function getToastIcon(type) {
    const icons = {
        success: '✓',
        danger: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    return icons[type] || '';
}

// ============================================
// PHASE 7: SMOOTH SCROLL FOR ANCHOR LINKS
// ============================================

/**
 * Initialize smooth scrolling for anchor links
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Skip if it's just '#' or if it's a hash change for SPAs
            if (href === '#' || href.startsWith('#/')) return;

            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });

                // Update URL without jumping
                if (history.pushState) {
                    history.pushState(null, null, href);
                }

                // Focus the target for accessibility
                targetElement.focus({ preventScroll: true });
            }
        });
    });
}

// ============================================
// PHASE 7: FORM ENHANCEMENT UTILITIES
// ============================================

/**
 * Debounce function for performance optimization
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function for performance optimization
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit time in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================
// PHASE 6: ERROR HANDLING
// ============================================

/**
 * Global error handler
 * Catches unhandled errors and displays user-friendly messages
 */
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    // Don't show toast for script loading errors
    if (event.message.includes('Script error')) {
        return;
    }

    // Show user-friendly error message
    if (window.showToast) {
        showToast('An unexpected error occurred. Please refresh the page.', 'danger', 5000);
    }
});

/**
 * Handle unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    if (window.showToast) {
        showToast('An error occurred while processing your request.', 'danger', 5000);
    }
});

// ============================================
// PHASE 7: ACCESSIBILITY ENHANCEMENTS
// ============================================

/**
 * Announce to screen readers
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
function announceToScreenReader(message, priority = 'polite') {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'visually-hidden';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize all functionality when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    // Phase 4: Navigation
    initHamburgerMenu();
    initGalleryLightbox();
    initSmoothScroll();

    // Phase 7: Add focus visible class for keyboard navigation
    document.body.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            document.body.classList.add('keyboard-nav');
        }
    });

    document.body.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-nav');
    });

    // Log initialization success (Phase 6: Debugging)
    if (console && console.log) {
        console.log('✓ Fahmid School website initialized successfully');
    }
});

// ============================================
// UTILITY EXPORTS (for other scripts)
// ============================================

/**
 * Export utility functions for use in other scripts
 */
window.FahmidUtils = {
    debounce,
    throttle,
    announceToScreenReader
};