/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Main JavaScript File - Phases 4-7 Complete + Enhancements
 * 
 * Handles:
 * - Hamburger menu toggle (public, admin, teacher portals)
 * - Gallery lightbox
 * - Toast notifications
 * - Smooth scrolling
 * - Scroll-triggered fade-in animations
 * - Keyboard navigation & accessibility
 * - Global error handling
 * 
 * @version 2.1.0
 * @date 2026-01-04
 */

'use strict';

// ============================================
// HAMBURGER MENU FUNCTIONALITY (All Portals)
// ============================================

function initHamburgerMenu() {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar') || 
                    document.getElementById('admin-sidebar') || 
                    document.getElementById('teacher-sidebar');
    
    if (!hamburger || !sidebar) return;

    function toggleSidebar() {
        hamburger.classList.toggle('active');
        sidebar.classList.toggle('active');
        
        const isExpanded = sidebar.classList.contains('active');
        hamburger.setAttribute('aria-expanded', isExpanded);
        
        document.body.style.overflow = isExpanded ? 'hidden' : '';
    }

    // Toggle on hamburger click
    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebar();
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !hamburger.contains(e.target) && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    });

    // Close when clicking a link inside sidebar (mobile only)
    sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024 && sidebar.classList.contains('active')) {
                toggleSidebar();
            }
        });
    });

    // Close with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            toggleSidebar();
            hamburger.focus();
        }
    });

    // Reset on resize (desktop view)
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
// GALLERY LIGHTBOX
// ============================================

function initGalleryLightbox() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.querySelector('.lightbox-close');

    if (!galleryItems.length || !lightbox || !lightboxImg) return;

    function openLightbox(src, alt) {
        lightboxImg.src = src;
        lightboxImg.alt = alt || 'Gallery image';
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
        lightbox.focus();
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        lightboxImg.src = '';
    }

    galleryItems.forEach(item => {
        const img = item.querySelector('img');
        if (!img) return;

        item.addEventListener('click', () => openLightbox(img.src, img.alt));
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openLightbox(img.src, img.alt);
            }
        });
        item.style.cursor = 'pointer';
        item.setAttribute('tabindex', '0');
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', `View larger image: ${img.alt || 'Gallery image'}`);
    });

    lightbox.addEventListener('click', closeLightbox);

    if (lightboxClose) {
        lightboxClose.addEventListener('click', (e) => {
            e.stopPropagation();
            closeLightbox();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });
}

// ============================================
// SMOOTH SCROLL FOR ANCHOR LINKS
// ============================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#' || href.startsWith('#/')) return;

            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });

                if (history.pushState) {
                    history.pushState(null, null, href);
                }

                targetElement.focus({ preventScroll: true });
            }
        });
    });
}

// ============================================
// SCROLL-BASED FADE-IN ANIMATIONS
// ============================================

function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target); // Animate once
            }
        });
    }, observerOptions);

    document.querySelectorAll('.card, .admin-card, .stat-card, .gallery-item').forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
        observer.observe(el);
    });
}

// Add this to your CSS for the animation
// .fade-in { opacity: 1 !important; transform: translateY(0) !important; }

// ============================================
// TOAST NOTIFICATIONS
// ============================================

window.showToast = function(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    const icon = {
        success: '✓',
        danger: '✕',
        warning: '⚠',
        info: 'ℹ'
    }[type] || '';

    if (icon) {
        const iconSpan = document.createElement('span');
        iconSpan.textContent = icon + ' ';
        iconSpan.style.fontSize = '1.2em';
        toast.appendChild(iconSpan);
    }

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
};

// ============================================
// GLOBAL ERROR HANDLING
// ============================================

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.showToast && !event.message.includes('Script error')) {
        showToast('An unexpected error occurred. Please try refreshing the page.', 'danger', 6000);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.showToast) {
        showToast('Something went wrong. Please try again.', 'danger', 5000);
    }
});

// ============================================
// ACCESSIBILITY: Keyboard Focus Indicator
// ============================================

document.body.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        document.body.classList.add('keyboard-nav');
    }
});

document.body.addEventListener('mousedown', () => {
    document.body.classList.remove('keyboard-nav');
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

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

function announceToScreenReader(message, priority = 'polite') {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'visually-hidden';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
}

window.FahmidUtils = { debounce, throttle, announceToScreenReader };

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initHamburgerMenu();
    initGalleryLightbox();
    initSmoothScroll();
    initScrollAnimations();

    console.log('✓ Fahmid School website initialized successfully (v2.1.0)');
});