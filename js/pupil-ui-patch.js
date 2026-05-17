/**
 * PUPIL PORTAL — UI PATCH (pupil-ui-patch.js)
 * 
 * Purpose: Applies design-only overrides on top of pupil.js.
 * - Does NOT modify any Firebase queries, calculations, or business logic.
 * - Runs AFTER pupil.js loads.
 * - Patches renderProfile() to also update the hero greeting with bold name.
 * - Overrides the empty-state HTML in loadSessionResults to use the new design.
 * 
 * Load order in HTML:
 *   pupil.js  ← existing file, untouched
 *   pupil-ui-patch.js  ← this file
 */

(function() {
  'use strict';

  // ── Wait for DOM + pupil.js to be ready ──────────────────────
  window.addEventListener('load', function() {

    // ── 1. Patch renderProfile to update hero greeting ────────
    // The original renderProfile is defined in pupil.js.
    // We wrap it so the hero greeting always reflects the pupil's name.
    const _originalRenderProfile = window.renderProfile || 
      (typeof renderProfile !== 'undefined' ? renderProfile : null);

    if (typeof renderProfile === 'function') {
      // Wrap the function defined in pupil.js scope
      // (since it's not explicitly exported, we do this via a global patch)
      window.__renderProfileOriginal = renderProfile;
    }

    // Observe changes to #pupil-name-display to keep hero in sync
    // (renderProfile sets textContent on this element)
    const nameEl = document.getElementById('pupil-name-display');
    if (nameEl) {
      const obs = new MutationObserver(() => {
        const name = nameEl.textContent?.trim();
        const greetingEl = document.getElementById('pupil-welcome');
        if (name && name !== 'Loading…' && name !== '-' && greetingEl) {
          greetingEl.innerHTML = `Hello, <strong>${name}</strong>!`;
        }
      });
      obs.observe(nameEl, { childList: true, characterData: true, subtree: true });
    }

    // ── 2. Patch results empty-state to use new design ───────
    // We observe the results-container and replace the plain <p> empty state
    // with a richer pp-empty component.
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
      const resultsObs = new MutationObserver(() => {
        const p = resultsContainer.querySelector('p[style*="text-align:center"]');
        if (p && p.parentElement === resultsContainer) {
          const text = p.textContent || '';
          resultsContainer.innerHTML = `
            <div class="pp-empty">
              <svg class="pp-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <p class="pp-empty__title">No Results Available</p>
              <p class="pp-empty__text">${text.includes('soon') 
                ? 'Your teachers will upload scores and admin will approve them soon.'
                : 'No approved results found for this session.'}</p>
            </div>`;
        }
      });
      resultsObs.observe(resultsContainer, { childList: true });
    }

    // ── 3. Ensure fee section becomes visible when JS shows it ─
    // loadFeeBalance() does: feeSection.style.display = 'block'
    // Our getElementById proxy already routes 'fee-balance-section' → 'pp-fees'
    // But we also need pp-fees to pick up the pp-card styling.
    const ppFees = document.getElementById('pp-fees');
    if (ppFees) {
      // When display changes to block, re-run lucide icons
      const feeObs = new MutationObserver(() => {
        if (ppFees.style.display !== 'none') {
          if (typeof lucide !== 'undefined') {
            lucide.createIcons();
          }
        }
      });
      feeObs.observe(ppFees, { attributes: true, attributeFilter: ['style'] });
    }

  });

})();
