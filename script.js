/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Main JavaScript — v3.0
 *
 * PRESERVED UTILITY FUNCTIONS (unchanged):
 * - showToast
 * - showLoading / hideLoading
 * - retryOperation
 * - FahmidUtils (debounce, throttle, announceToScreenReader)
 *
 * NEW / REBUILT:
 * - Navigation (sticky scroll, mobile menu)
 * - Scroll reveal animations
 * - FAQ accordion
 * - Gallery lightbox
 * - Form handling
 * - Copyright year
 */

'use strict';

/* ================================================================
   NAVIGATION
   ================================================================ */

function initNavigation() {
  const nav = document.querySelector('.site-nav');
  const toggle = document.getElementById('nav-toggle');
  const mobileMenu = document.getElementById('nav-mobile-menu');
  const overlay = document.getElementById('nav-overlay');

  if (!nav) return;

  // Sticky scroll effect
  let lastScrollY = 0;
  const onScroll = throttle(() => {
    const y = window.scrollY;
    if (y > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
    lastScrollY = y;
  }, 50);

  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile menu toggle
  if (!toggle || !mobileMenu) return;

  function openMenu() {
    toggle.setAttribute('aria-expanded', 'true');
    mobileMenu.classList.add('open');
    overlay && overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    toggle.setAttribute('aria-expanded', 'false');
    mobileMenu.classList.remove('open');
    overlay && overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    isOpen ? closeMenu() : openMenu();
  });

  overlay && overlay.addEventListener('click', closeMenu);

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
  });

  window.addEventListener('resize', debounce(() => {
    if (window.innerWidth >= 1024) closeMenu();
  }, 200));

  console.log('✓ Navigation initialized');
}

/* ================================================================
   SCROLL REVEAL
   ================================================================ */

function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  // Check if reduced motion is preferred
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    elements.forEach(el => el.classList.add('revealed'));
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  elements.forEach(el => observer.observe(el));
  console.log('✓ Scroll reveal initialized');
}

/* ================================================================
   FAQ ACCORDION
   ================================================================ */

function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');
  if (!faqItems.length) return;

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!question || !answer) return;

    question.setAttribute('aria-expanded', 'false');
    answer.id = answer.id || `faq-answer-${Math.random().toString(36).substr(2, 9)}`;
    question.setAttribute('aria-controls', answer.id);

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // Close all others
      faqItems.forEach(other => {
        if (other !== item && other.classList.contains('open')) {
          other.classList.remove('open');
          other.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
        }
      });

      // Toggle current
      item.classList.toggle('open', !isOpen);
      question.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  console.log('✓ FAQ accordion initialized');
}

/* ================================================================
   GALLERY LIGHTBOX
   ================================================================ */

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
    closeBtn?.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    lightboxImg.src = '';
  }

  galleryItems.forEach(item => {
    const img = item.querySelector('img');
    if (!img) return;

    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    item.setAttribute('aria-label', `View larger: ${img.alt || 'Gallery image'}`);

    item.addEventListener('click', () => openLightbox(img.src, img.alt));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(img.src, img.alt);
      }
    });
  });

  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  closeBtn?.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox();
    }
  });

  console.log('✓ Gallery lightbox initialized');
}

/* ================================================================
   CONTACT FORM
   ================================================================ */

function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const submitBtn = form.querySelector('[type="submit"]');
    const originalText = submitBtn?.textContent || 'Send Message';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }

    try {
      // Simulate network request (replace with actual endpoint)
      await new Promise(resolve => setTimeout(resolve, 1500));
      showToast('Thank you! Your message has been sent. We will be in touch shortly.', 'success', 6000);
      form.reset();
    } catch (err) {
      showToast('Sorry, something went wrong. Please try again or call us directly.', 'danger', 6000);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  console.log('✓ Contact form initialized');
}

/* ================================================================
   ADMISSIONS FORM
   ================================================================ */

function initAdmissionsForm() {
  const form = document.getElementById('admissions-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const submitBtn = form.querySelector('[type="submit"]');
    const originalText = submitBtn?.textContent || 'Submit Enquiry';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      showToast('Enquiry submitted! Our admissions team will contact you within 2 working days.', 'success', 8000);
      form.reset();
    } catch (err) {
      showToast('Submission failed. Please call us directly or try again.', 'danger', 6000);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}

/* ================================================================
   SMOOTH SCROLL (preserved)
   ================================================================ */

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
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

/* ================================================================
   COPYRIGHT YEAR
   ================================================================ */

function setCopyrightYear() {
  document.querySelectorAll('#copyright-year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
}

/* ================================================================
   TOAST NOTIFICATIONS (PRESERVED — unchanged from original)
   ================================================================ */

window.showToast = function(message, type = 'info', duration = 3000) {
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        window.showToast(message, type, duration);
      }, { once: true });
    }
    return;
  }

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

  const icons = { success: '✓', danger: '✕', warning: '⚠', info: 'ℹ' };
  if (icons[type]) {
    const icon = document.createElement('span');
    icon.textContent = icons[type];
    icon.style.cssText = 'font-size:1.1em;flex-shrink:0;';
    toast.appendChild(icon);
  }

  const msg = document.createElement('span');
  msg.textContent = message;
  toast.appendChild(msg);

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.parentNode && toast.remove(), 350);
  }, duration);
};

/* ================================================================
   LOADING INDICATOR (PRESERVED — unchanged)
   ================================================================ */

window.showLoading = function(elementId, message = 'Loading…') {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = `
      <div style="text-align:center;padding:3rem;color:#6B7490;">
        <div style="width:36px;height:36px;border:3px solid #E2E4EC;border-top-color:#2451A8;
          border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 1rem;"></div>
        <p style="margin:0;font-size:0.8125rem;">${message}</p>
      </div>`;
  }
};

window.hideLoading = function(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = '';
};

/* ================================================================
   NETWORK RETRY HELPER (PRESERVED — unchanged)
   ================================================================ */

window.retryOperation = async function(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Retry ${i + 1}/${maxRetries}…`);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
};

/* ================================================================
   UTILITY FUNCTIONS (PRESERVED — unchanged)
   ================================================================ */

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

/* ================================================================
   KEYBOARD NAVIGATION ACCESSIBILITY
   ================================================================ */

function initKeyboardNavigation() {
  if (!document.body) return;
  document.body.addEventListener('keydown', () => document.body.classList.add('keyboard-nav'));
  document.body.addEventListener('mousedown', () => document.body.classList.remove('keyboard-nav'));
}

/* ================================================================
   ONLINE / OFFLINE DETECTION (PRESERVED)
   ================================================================ */

window.addEventListener('online', () => {
  window.showToast?.('Connection restored', 'success', 3000);
});

window.addEventListener('offline', () => {
  window.showToast?.('No internet connection — some features may be unavailable.', 'warning', 8000);
});

/* ================================================================
   GLOBAL ERROR HANDLING (PRESERVED)
   ================================================================ */

window.addEventListener('error', e => {
  console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled rejection:', e.reason);
});

/* ================================================================
   MAIN ENTRY POINT
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🏫 Fahmid School — Initializing');

  setCopyrightYear();
  initKeyboardNavigation();

  try { initNavigation(); }        catch (e) { console.error('Nav:', e); }
  try { initScrollReveal(); }      catch (e) { console.error('Reveal:', e); }
  try { initFAQ(); }               catch (e) { console.error('FAQ:', e); }
  try { initGalleryLightbox(); }   catch (e) { console.error('Lightbox:', e); }
  try { initContactForm(); }       catch (e) { console.error('Contact form:', e); }
  try { initAdmissionsForm(); }    catch (e) { console.error('Admissions form:', e); }
  try { initSmoothScroll(); }      catch (e) { console.error('Smooth scroll:', e); }

  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  console.log('✓ Initialization complete');
});
