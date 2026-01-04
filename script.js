/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Main JavaScript File - Phases 4-7 Complete + Enhancements (Fixed)
 * 
 * Handles:
 * - Hamburger menu toggle (public, admin, teacher portals)
 * - Gallery lightbox
 * - Toast notifications
 * - Smooth scrolling
 * - Testimonials carousel (manual + auto)
 * - Keyboard navigation & accessibility
 * - Global error handling
 * 
 * @version 2.2.0
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

    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebar();
    });

    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !hamburger.contains(e.target) && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    });

    sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024 && sidebar.classList.contains('active')) toggleSidebar();
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            toggleSidebar();
            hamburger.focus();
        }
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > 1024 && sidebar.classList.contains('active')) toggleSidebar();
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
        if (e.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox();
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
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (history.pushState) history.pushState(null, null, href);
                targetElement.focus({ preventScroll: true });
            }
        });
    });
}

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

    const icon = { success: '✓', danger: '✕', warning: '⚠', info: 'ℹ' }[type] || '';
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
    if (window.showToast) showToast('Something went wrong. Please try again.', 'danger', 5000);
});

// ============================================
// ACCESSIBILITY: Keyboard Focus Indicator
// ============================================

document.body.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') document.body.classList.add('keyboard-nav');
});
document.body.addEventListener('mousedown', () => document.body.classList.remove('keyboard-nav'));

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
// TESTIMONIALS CAROUSEL (Vanilla JS)
// ============================================

function initTestimonialsCarousel() {
    document.querySelectorAll('[data-carousel]').forEach(carousel => {
        const track = carousel.querySelector('.carousel-track');
        const slides = Array.from(track?.children || []);
        const prevBtn = carousel.querySelector('.prev');
        const nextBtn = carousel.querySelector('.next');
        const dotsContainer = carousel.querySelector('.carousel-dots');

        if (!track || !prevBtn || !nextBtn || !dotsContainer || !slides.length) return;

        let current = 0;
        let interval;

        slides.forEach((_, index) => {
            const dot = document.createElement('button');
            if (index === 0) dot.classList.add('active');
            dotsContainer.appendChild(dot);
            dot.addEventListener('click', () => {
                goToSlide(index);
                resetAutoPlay();
            });
        });

        const dots = Array.from(dotsContainer.children);

        function goToSlide(index) {
            current = index;
            track.style.transform = `translateX(-${current * 100}%)`;
            dots.forEach(d => d.classList.remove('active'));
            dots[current].classList.add('active');
        }

        function next() {
            goToSlide((current + 1) % slides.length);
        }

        function prev() {
            goToSlide((current - 1 + slides.length) % slides.length);
        }

        function startAutoPlay() {
            interval = setInterval(next, 6000);
        }

        function resetAutoPlay() {
            clearInterval(interval);
            startAutoPlay();
        }

        nextBtn.addEventListener('click', () => { next(); resetAutoPlay(); });
        prevBtn.addEventListener('click', () => { prev(); resetAutoPlay(); });

        startAutoPlay();
    });
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initHamburgerMenu();
    initGalleryLightbox();
    initSmoothScroll();
    initTestimonialsCarousel();

    console.log('✓ Fahmid School website initialized successfully (v2.2.0 - Carousel Enhanced)');
});