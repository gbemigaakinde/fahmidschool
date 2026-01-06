/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Main JavaScript File – Phases 4–7 Complete + Enhancements
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
 * @version 2.3.0
 * @date 2026-01-04
 */

'use strict';

/* =====================================================
   HAMBURGER MENU FUNCTIONALITY (ALL PORTALS)
===================================================== */

function initHamburgerMenu() {
    const hamburger = document.getElementById('hamburger');
    const sidebar =
        document.getElementById('sidebar') ||
        document.getElementById('admin-sidebar') ||
        document.getElementById('teacher-sidebar');

    if (!hamburger || !sidebar) return;

    function toggleSidebar(forceClose = false) {
        if (forceClose) {
            hamburger.classList.remove('active');
            sidebar.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
            return;
        }

        hamburger.classList.toggle('active');
        sidebar.classList.toggle('active');

        const expanded = sidebar.classList.contains('active');
        hamburger.setAttribute('aria-expanded', expanded);
        document.body.style.overflow = expanded ? 'hidden' : '';
    }

    hamburger.addEventListener('click', e => {
        e.stopPropagation();
        toggleSidebar();
    });

    document.addEventListener('click', e => {
        if (
            sidebar.classList.contains('active') &&
            !sidebar.contains(e.target) &&
            !hamburger.contains(e.target)
        ) {
            toggleSidebar(true);
        }
    });

    sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024) toggleSidebar(true);
        });
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            toggleSidebar(true);
            hamburger.focus();
        }
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > 1024 && sidebar.classList.contains('active')) {
                toggleSidebar(true);
            }
        }, 250);
    });
}

function initHeroSlideshow() {
    const hero = document.querySelector('.hero-slideshow');
    if (!hero) return;

    const slides = Array.from(hero.querySelectorAll('img'));
    if (!slides.length) return;

    let index = 0;

    // Wait for all images to load
    let loadedCount = 0;
    slides.forEach(img => {
        if (img.complete) {
            loadedCount++;
        } else {
            img.addEventListener('load', () => {
                loadedCount++;
                if (loadedCount === slides.length) startSlideshow();
            });
            img.addEventListener('error', () => {
                loadedCount++;
                if (loadedCount === slides.length) startSlideshow();
            });
        }
    });

    // If all images already loaded
    if (loadedCount === slides.length) startSlideshow();

    function startSlideshow() {
        // Show first image
        slides[index].classList.add('visible');

        // Slide interval
        setInterval(() => {
            slides[index].classList.remove('visible');
            index = (index + 1) % slides.length;
            slides[index].classList.add('visible');
        }, 6000); // 6 seconds per slide
    }
}

// Start the hero slideshow when page loads
window.addEventListener('load', initHeroSlideshow);

/* =====================================================
   GALLERY LIGHTBOX
===================================================== */

function initGalleryLightbox() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.lightbox-close');

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

        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute(
            'aria-label',
            `View larger image: ${img.alt || 'Gallery image'}`
        );
        item.style.cursor = 'pointer';

        item.addEventListener('click', () => openLightbox(img.src, img.alt));
        item.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openLightbox(img.src, img.alt);
            }
        });
    });

    lightbox.addEventListener('click', closeLightbox);
    closeBtn?.addEventListener('click', e => {
        e.stopPropagation();
        closeLightbox();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });
}

function initGalleryCarousel() {
    const carousels = document.querySelectorAll('.gallery-carousel');

    carousels.forEach(carousel => {
        const track = carousel.querySelector('.gallery-track');
        if (!track) return;

        // Duplicate images for seamless scroll
        const images = Array.from(track.children);
        images.forEach(img => {
            const clone = img.cloneNode(true);
            track.appendChild(clone);
        });

        let speed = 0.5; // pixels per frame
        let position = 0;

        function animate() {
            position -= speed;
            if (Math.abs(position) >= track.scrollWidth / 2) {
                position = 0; // reset for infinite loop
            }
            track.style.transform = `translateX(${position}px)`;
            requestAnimationFrame(animate);
        }

        animate();

        // Pause on hover
        carousel.addEventListener('mouseenter', () => { speed = 0; });
        carousel.addEventListener('mouseleave', () => { speed = 0.5; });
    });
}

window.addEventListener('DOMContentLoaded', initGalleryCarousel);

/* =====================================================
   SMOOTH SCROLLING
===================================================== */

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#' || href.startsWith('#/')) return;

            const target = document.getElementById(href.substring(1));
            if (!target) return;

            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (history.pushState) history.pushState(null, '', href);
            target.focus({ preventScroll: true });
        });
    });
}

/* =====================================================
   TOAST NOTIFICATIONS
===================================================== */

window.showToast = function (message, type = 'info', duration = 3000) {
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

    const icons = {
        success: '✓',
        danger: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    if (icons[type]) {
        const icon = document.createElement('span');
        icon.textContent = icons[type] + ' ';
        icon.style.fontSize = '1.2em';
        toast.appendChild(icon);
    }

    toast.appendChild(document.createTextNode(message));
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
};

/* =====================================================
   GLOBAL ERROR HANDLING
===================================================== */

window.addEventListener('error', e => {
    console.error('Global error:', e.error);
    if (window.showToast && !String(e.message).includes('Script error')) {
        showToast('An unexpected error occurred. Please refresh the page.', 'danger', 6000);
    }
});

window.addEventListener('unhandledrejection', e => {
    console.error('Unhandled promise rejection:', e.reason);
    window.showToast?.('Something went wrong. Please try again.', 'danger', 5000);
});

/* =====================================================
   ACCESSIBILITY: KEYBOARD NAVIGATION
===================================================== */

document.body.addEventListener('keydown', e => {
    if (e.key === 'Tab') document.body.classList.add('keyboard-nav');
});

document.body.addEventListener('mousedown', () => {
    document.body.classList.remove('keyboard-nav');
});

/* =====================================================
   UTILITY FUNCTIONS
===================================================== */

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(null, args), delay);
    };
}

function throttle(fn, limit) {
    let locked = false;
    return (...args) => {
        if (!locked) {
            fn.apply(null, args);
            locked = true;
            setTimeout(() => (locked = false), limit);
        }
    };
}

function announceToScreenReader(message, priority = 'polite') {
    const el = document.createElement('div');
    el.className = 'visually-hidden';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', priority);
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

window.FahmidUtils = { debounce, throttle, announceToScreenReader };

/* =====================================================
   TESTIMONIALS CAROUSEL
===================================================== */

function initTestimonialsCarousel() {
    const carousels = document.querySelectorAll('[data-carousel]');
    
    carousels.forEach(carousel => {
        const wrapper = carousel.querySelector('.carousel-wrapper');
        const track = carousel.querySelector('.carousel-track');
        const slides = Array.from(track.children);
        const prevBtn = carousel.querySelector('.carousel-btn.prev');
        const nextBtn = carousel.querySelector('.carousel-btn.next');
        const dotsContainer = carousel.querySelector('.carousel-dots');

        if (slides.length === 0) return;

        let currentIndex = 0;
        let autoplayInterval;

        // Create dots
        dotsContainer.innerHTML = '';
        slides.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
            if (i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(i));
            dotsContainer.appendChild(dot);
        });
        const dots = dotsContainer.querySelectorAll('button');

        function updateDots() {
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentIndex);
            });
        }

        function goToSlide(index) {
            currentIndex = index;
            track.style.transform = `translateX(-${currentIndex * 100}%)`;
            updateDots();
            resetAutoplay();
        }

        function nextSlide() {
            currentIndex = (currentIndex + 1) % slides.length;
            goToSlide(currentIndex);
        }

        function prevSlide() {
            currentIndex = (currentIndex - 1 + slides.length) % slides.length;
            goToSlide(currentIndex);
        }

        function startAutoplay() {
            autoplayInterval = setInterval(nextSlide, 6000);
        }

        function resetAutoplay() {
            clearInterval(autoplayInterval);
            startAutoplay();
        }

        function stopAutoplay() {
            clearInterval(autoplayInterval);
        }

        // Event listeners
        nextBtn.addEventListener('click', nextSlide);
        prevBtn.addEventListener('click', prevSlide);

        // Pause on hover
        carousel.addEventListener('mouseenter', stopAutoplay);
        carousel.addEventListener('mouseleave', startAutoplay);

        // Touch/swipe support
        let touchStartX = 0;
        carousel.addEventListener('touchstart', e => {
            touchStartX = e.touches[0].clientX;
        });
        carousel.addEventListener('touchend', e => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) nextSlide();
                else prevSlide();
            }
        });

        // Start autoplay
        startAutoplay();
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initTestimonialsCarousel);

/* =====================================================
   INITIALIZATION
===================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initHamburgerMenu();
    initGalleryLightbox();
    initSmoothScroll();
    initTestimonialsCarousel();

    // ← Add this here
    document.querySelectorAll('.admin-sidebar a[data-section]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) showSection(section);
        });
    });

    console.log('✓ Fahmid School website initialized successfully (v2.3.0)');
});

// Offline/Online Detection
window.addEventListener('online', () => {
    if (window.showToast) {
        window.showToast('✓ Internet connection restored', 'success', 3000);
    }
});

window.addEventListener('offline', () => {
    if (window.showToast) {
        window.showToast('⚠️ No internet connection. Some features may not work.', 'warning', 10000);
    }
});

console.log('✓ Offline detection enabled');