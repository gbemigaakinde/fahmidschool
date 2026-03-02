/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Main JavaScript — v3.1
 * Full replacement for script.js — includes all UI fixes.
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

  const onScroll = throttle(() => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, 50);
  window.addEventListener('scroll', onScroll, { passive: true });

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
    toggle.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu();
  });

  overlay && overlay.addEventListener('click', closeMenu);
  mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', debounce(() => { if (window.innerWidth >= 1024) closeMenu(); }, 200));

  console.log('✓ Navigation initialized');
}

/* ================================================================
   SCROLL REVEAL
   ================================================================ */

function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.forEach(el => el.classList.add('revealed'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  elements.forEach(el => observer.observe(el));
  console.log('✓ Scroll reveal initialized');
}

/*/*
  In script.js, replace initTypingHeadline() with this.
  The animation is now pure CSS (clip-path), so JS only needs
  to handle the reduced-motion preference gracefully.
*/

function initTypingHeadline() {
  const line2 = document.querySelector('.hero h1 .hero-line-2');
  if (!line2) return;

  // If user prefers reduced motion, skip the animation entirely
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    line2.style.clipPath = 'inset(0 0% 0 0)';
    line2.style.animation = 'none';
  }

  console.log('✓ Hero headline initialized');
}

/* ================================================================
   FIX: COUNT-UP — trust bar numbers animate from 0
   Requires data-target and data-suffix on .trust-number elements.
   ================================================================ */

function initCountUp() {
  const els = document.querySelectorAll('.trust-number[data-target]');
  if (!els.length) return;

  function easeOutQuad(t) { return t * (2 - t); }

  function animateCount(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';

    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const duration = 1800;
    const start = performance.now();

    function tick(now) {
      const elapsed = Math.min(now - start, duration);
      const current = Math.round(easeOutQuad(elapsed / duration) * target);
      el.textContent = current + suffix;
      if (elapsed < duration) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target + suffix;
      }
    }

    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  els.forEach(el => {
    // Start at 0 so the count-up is visible from the beginning
    el.textContent = '0' + (el.dataset.suffix || '');
    observer.observe(el);
  });

  console.log('✓ Count-up initialized');
}

/* ================================================================
   FIX: TESTIMONIAL MARQUEE — pixel-perfect seamless loop
   - Removes any old hard-coded clones
   - Clones Set A dynamically
   - Measures exact pixel width after paint
   - Sets --set-width as a CSS custom property (no rounding drift)
   ================================================================ */

function initTestimonialMarquee() {
  const track = document.getElementById('testimonials-track') ||
                document.querySelector('.testimonials-track');
  if (!track) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Remove any previously hard-coded clone cards
  track.querySelectorAll('.testimonial-card-clone').forEach(el => el.remove());

  // Collect original Set A cards
  const setA = Array.from(track.children);
  if (!setA.length) return;

  // Clone Set A → Set B
  setA.forEach(card => {
    const clone = card.cloneNode(true);
    clone.classList.add('testimonial-card-clone');
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });

  // After two paint frames (guarantees stable layout), measure Set A
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const gap = parseFloat(getComputedStyle(track).gap) || 24;
      let setWidth = 0;
      setA.forEach(card => {
        setWidth += card.getBoundingClientRect().width + gap;
      });

      // Apply exact pixel width — eliminates sub-pixel drift
      track.style.setProperty('--set-width', `${setWidth}px`);

      // ~85px/s feels smooth for testimonial cards
      const duration = Math.max(20, Math.round(setWidth / 85));
      track.style.setProperty('--marquee-duration', `${duration}s`);

      console.log(`✓ Marquee: ${setWidth.toFixed(0)}px / ${duration}s`);
    });
  });
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
    answer.id = answer.id || `faq-${Math.random().toString(36).substr(2, 8)}`;
    question.setAttribute('aria-controls', answer.id);

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      faqItems.forEach(other => {
        if (other !== item && other.classList.contains('open')) {
          other.classList.remove('open');
          other.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
        }
      });
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
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(img.src, img.alt); }
    });
  });

  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  closeBtn?.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox();
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
    const original = submitBtn?.textContent || 'Send Message';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }
    try {
      await new Promise(r => setTimeout(r, 1500));
      showToast('Thank you! Your message has been sent. We will be in touch shortly.', 'success', 6000);
      form.reset();
    } catch {
      showToast('Sorry, something went wrong. Please try again or call us directly.', 'danger', 6000);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = original; }
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
    const original = submitBtn?.textContent || 'Submit Enquiry';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }
    try {
      await new Promise(r => setTimeout(r, 1500));
      showToast('Enquiry submitted! Our admissions team will contact you within 2 working days.', 'success', 8000);
      form.reset();
    } catch {
      showToast('Submission failed. Please call us directly or try again.', 'danger', 6000);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = original; }
    }
  });
}

/* ================================================================
   SMOOTH SCROLL
   ================================================================ */

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

/* ================================================================
   COPYRIGHT YEAR
   ================================================================ */

function setCopyrightYear() {
  document.querySelectorAll('#copyright-year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
}

/* ================================================================
   TOAST NOTIFICATIONS (preserved)
   ================================================================ */

window.showToast = function (message, type = 'info', duration = 3000) {
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => window.showToast(message, type, duration), { once: true });
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
   LOADING INDICATOR (preserved)
   ================================================================ */

window.showLoading = function (elementId, message = 'Loading…') {
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

window.hideLoading = function (elementId) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = '';
};

/* ================================================================
   RETRY HELPER (preserved)
   ================================================================ */

window.retryOperation = async function (operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
};

/* ================================================================
   UTILITY FUNCTIONS
   ================================================================ */

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn.apply(null, args), delay); };
}

function throttle(fn, limit) {
  let locked = false;
  return (...args) => {
    if (!locked) { fn.apply(null, args); locked = true; setTimeout(() => (locked = false), limit); }
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
   KEYBOARD NAVIGATION
   ================================================================ */

function initKeyboardNavigation() {
  if (!document.body) return;
  document.body.addEventListener('keydown', () => document.body.classList.add('keyboard-nav'));
  document.body.addEventListener('mousedown', () => document.body.classList.remove('keyboard-nav'));
}

/* ================================================================
   ONLINE / OFFLINE
   ================================================================ */

window.addEventListener('online', () => window.showToast?.('Connection restored', 'success', 3000));
window.addEventListener('offline', () => window.showToast?.('No internet connection — some features may be unavailable.', 'warning', 8000));

/* ================================================================
   ERROR HANDLING
   ================================================================ */

window.addEventListener('error', e => console.error('Global error:', e.error));
window.addEventListener('unhandledrejection', e => console.error('Unhandled rejection:', e.reason));

/* ================================================================
   MAIN ENTRY POINT
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🏫 Fahmid School — Initializing v3.1');

  setCopyrightYear();
  initKeyboardNavigation();

  try { initNavigation(); }            catch (e) { console.error('Nav:', e); }
  try { initScrollReveal(); }          catch (e) { console.error('Reveal:', e); }
  try { initTypingHeadline(); }        catch (e) { console.error('Typing:', e); }
  try { initCountUp(); }               catch (e) { console.error('CountUp:', e); }
  try { initTestimonialMarquee(); }    catch (e) { console.error('Marquee:', e); }
  try { initFAQ(); }                   catch (e) { console.error('FAQ:', e); }
  try { initGalleryLightbox(); }       catch (e) { console.error('Lightbox:', e); }
  try { initContactForm(); }           catch (e) { console.error('Contact form:', e); }
  try { initAdmissionsForm(); }        catch (e) { console.error('Admissions form:', e); }
  try { initSmoothScroll(); }          catch (e) { console.error('Smooth scroll:', e); }

  if (typeof lucide !== 'undefined') lucide.createIcons();

  console.log('✓ Initialization complete');
});