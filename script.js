/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Main JavaScript File – FIXED VERSION
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
 * @version 2.4.0 - FIXED
 * @date 2026-01-10
 */

'use strict';

/* =====================================================
   HAMBURGER MENU FUNCTIONALITY (ALL PORTALS)
===================================================== */

/**
 * FIXED: Hamburger menu initialization with proper null checks
 * Works for public site, admin portal, teacher portal, and pupil portal
 */
function initHamburgerMenu() {
    const hamburger = document.getElementById('hamburger');
    const sidebar =
        document.getElementById('sidebar') ||
        document.getElementById('admin-sidebar') ||
        document.getElementById('teacher-sidebar');

    // Check if elements exist BEFORE accessing them
    if (!hamburger) {
        console.log('Hamburger button not found - skipping menu initialization');
        return;
    }

    if (!sidebar) {
        console.log('Sidebar not found - skipping menu initialization');
        return;
    }

    // Prevent double initialization
    if (hamburger.dataset.initialized === 'true') {
        console.log('Hamburger menu already initialized');
        return;
    }
    
    hamburger.dataset.initialized = 'true';

    function toggleSidebar(forceClose = false) {
        if (forceClose) {
            hamburger.classList.remove('active');
            sidebar.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
            return;
        }

        const isActive = hamburger.classList.toggle('active');
        sidebar.classList.toggle('active', isActive);
        hamburger.setAttribute('aria-expanded', isActive);
        document.body.style.overflow = isActive ? 'hidden' : '';
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
            if (window.innerWidth <= 1024) {
                toggleSidebar(true);
            }
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
    
    console.log('✓ Hamburger menu initialized');
}

function initHeroSlideshow() {
    const hero = document.querySelector('.hero-slideshow');
    if (!hero) return;

    const slides = Array.from(hero.querySelectorAll('img'));
    if (!slides.length) return;

    let index = 0;
    slides[index].classList.add('visible'); // Show first image immediately

    // Start rotation
    setInterval(() => {
        slides[index].classList.remove('visible');
        index = (index + 1) % slides.length;
        slides[index].classList.add('visible');
    }, 6000);
}

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

/**
 * FIXED: Toast notifications with null checks
 */
window.showToast = function (message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');

    // Create container if it doesn't exist
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        
        // Check if body exists before appending
        if (document.body) {
            document.body.appendChild(container);
        } else {
            console.error('document.body not available for toast container');
            return;
        }
    }

    // Create the toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    // Add icons based on type
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

    // Add message text
    toast.appendChild(document.createTextNode(message));
    container.appendChild(toast);

    // Trigger CSS slide-in
    requestAnimationFrame(() => toast.classList.add('show'));

    // Automatically hide after duration
    const slideOutDuration = 300; // matches CSS slide-out animation
    setTimeout(() => {
        toast.classList.remove('show'); // trigger slide-out
        // Remove from DOM after animation ends
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, slideOutDuration);
    }, duration);
};

/* =====================================================
   LOADING INDICATOR
===================================================== */

window.showLoading = function(elementId, message = 'Loading...') {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = `
      <div style="text-align:center; padding:3rem; color:#666;">
        <div class="spinner" style="
          width: 40px;
          height: 40px;
          margin: 0 auto 1rem;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #2196F3;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        <p style="margin:0; font-size:14px;">${message}</p>
      </div>
    `;
  }
};

window.hideLoading = function(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = '';
  }
};

/* =====================================================
   NETWORK RETRY HELPER
===================================================== */

window.retryOperation = async function(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Retry ${i + 1}/${maxRetries}...`);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
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

/* =====================================================
   OFFLINE/ONLINE DETECTION
===================================================== */

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

/* =====================================================
   SCROLL-TRIGGERED ANIMATIONS
===================================================== */

function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                // Optionally unobserve after animation
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all elements with animate-on-scroll class
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
    });
}

/* =====================================================
   INITIALIZATION - MAIN ENTRY POINT
===================================================== */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded fired');
    
    // Set copyright year
    const yearEl = document.getElementById('copyright-year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    // Initialize components with error handling
    try {
        initHamburgerMenu();
    } catch (error) {
        console.error('Error initializing hamburger menu:', error);
    }

    try {
        initHeroSlideshow();
    } catch (error) {
        console.error('Error initializing hero slideshow:', error);
    }

    try {
        initGalleryLightbox();
    } catch (error) {
        console.error('Error initializing gallery lightbox:', error);
    }

    try {
        initGalleryCarousel();
    } catch (error) {
        console.error('Error initializing gallery carousel:', error);
    }

    try {
        initSmoothScroll();
    } catch (error) {
        console.error('Error initializing smooth scroll:', error);
    }

    try {
        initTestimonialsCarousel();
    } catch (error) {
        console.error('Error initializing testimonials:', error);
    }

    try {
        initScrollAnimations();
    } catch (error) {
        console.error('Error initializing scroll animations:', error);
    }

    console.log('✓ Script.js initialization complete');
});

/* =====================================================
   UNSAVED CHANGES PROTECTION
===================================================== */

// Track if there are unsaved changes in forms
let hasUnsavedChanges = false;

// Monitor all input fields in teacher and admin portals
document.addEventListener('input', (e) => {
  const target = e.target;
  
  // Only track form inputs, not search/filter fields
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    const isFilterField = target.id?.includes('filter') || 
                         target.id?.includes('search') ||
                         target.id?.includes('term') ||
                         target.id?.includes('session');
    
    if (!isFilterField) {
      hasUnsavedChanges = true;
    }
  }
});

// Reset flag when save buttons are clicked
document.addEventListener('click', (e) => {
  const target = e.target;
  
  if (target.classList.contains('btn-primary') || 
      target.textContent?.includes('Save') ||
      target.textContent?.includes('Submit')) {
    // Small delay to allow save operation to complete
    setTimeout(() => {
      hasUnsavedChanges = false;
    }, 1000);
  }
});

// Warn before leaving page with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    const message = 'You have unsaved changes. Are you sure you want to leave?';
    e.preventDefault();
    e.returnValue = message; // Standard way
    return message; // For older browsers
  }
});

// Warn before navigating away in single-page app
if (typeof window.showSection === 'function') {
  const originalShowSection = window.showSection;
  
  window.showSection = function(sectionId) {
    if (hasUnsavedChanges) {
      const confirm = window.confirm(
        'You have unsaved changes that will be lost.\n\n' +
        'Do you want to leave this section without saving?'
      );
      
      if (!confirm) {
        return; // Don't navigate
      }
      
      hasUnsavedChanges = false; // Reset if user confirms
    }
    
    return originalShowSection(sectionId);
  };
}

console.log('✓ Unsaved changes protection enabled');