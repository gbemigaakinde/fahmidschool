/**
 * finance/reports.js
 *
 * Financial reporting section loaders — pure ES Module, Firebase v9+ modular SDK.
 *
 * Exports:
 *   loadOutstandingFeesReport()
 *   loadFinancialReports()
 *   updateSummaryDisplay(count, total)
 *   updateFinancialDisplays(...)
 *   exportFinancialReport(format)
 *   exportFinancialCSV(session, term)
 *   exportFinancialPDF(session, term)
 *
 * FIX 5  — alumni outstanding balance detection (surfaced in a dedicated table section)
 * FIX 6  — dual collection-rate logic (current-term rate + overall rate)
 */

import { db }                      from '../db.js';
import { getCurrentSettings }      from '../shared/settings.js';
import { calculateCurrentOutstanding } from './outstanding.js';
import { showToast }               from '../ui/toast.js';

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely read a number from a value that might be undefined, null, or NaN.
 * Returns 0 for any non-finite result.
 */
function safeNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Format a number as a Nigerian Naira string.
 */
function naira(amount) {
  return `₦${safeNum(amount).toLocaleString()}`;
}

/**
 * Retrieve a DOM element by ID. Returns null (never throws) so callers can
 * guard with a simple truthiness check.
 */
function el(id) {
  return document.getElementById(id);
}

/**
 * Set the textContent of an element if it exists. No-op otherwise.
 */
function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text;
}

// ─────────────────────────────────────────────────────────────────────────────
// loadOutstandingFeesReport
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load and render the outstanding fees report table.
 *
 * FIX 5: Alumni with outstanding balances are detected and rendered in a
 * clearly labelled section below active pupils, rather than being silently
 * skipped. Their totals are also added to the grand total.
 */
export async function loadOutstandingFeesReport() {
  const container = el('outstanding-fees-table');
  if (!container) return;

  const tbody = container.querySelector('tbody');
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="7" class="table-loading">Loading outstanding fees…</td></tr>';

  try {
    const settings    = await getCurrentSettings();
    const session     = settings?.session;
    const currentTerm = settings?.term;

    if (!session || !currentTerm) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center; color:var(--color-danger);">' +
        'School settings not configured. Please set session and term first.</td></tr>';
      updateSummaryDisplay(0, 0);
      return;
    }

    // Fetch all pupils in a single read.
    const pupilsSnap = await getDocs(collection(db, 'pupils'));

    if (pupilsSnap.empty) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center; padding:var(--space-2xl);">No pupils enrolled</td></tr>';
      updateSummaryDisplay(0, 0);
      return;
    }

    const outstandingPupils = [];   // active pupils with balance > 0
    const alumniWithBalance = [];   // FIX 5: alumni with outstanding balance
    let   totalOutstanding  = 0;
    let   errorCount        = 0;

    // Process every pupil document.
    const processingPromises = pupilsSnap.docs.map(async (pupilDoc) => {
      const pupilId   = pupilDoc.id;
      const pupilData = pupilDoc.data();

      const isAlumni =
        pupilData.status === 'alumni' || pupilData.isActive === false;

      try {
        const result = await calculateCurrentOutstanding(pupilId, session, currentTerm);

        // Skip pupils with no fee configuration.
        if (result?.reason) return;

        if (isAlumni) {
          // FIX 5: surface alumni debt instead of silently ignoring it.
          if (safeNum(result.balance) > 0) {
            alumniWithBalance.push({ ...result, isAlumni: true });
          }
        } else {
          if (safeNum(result.balance) > 0) {
            outstandingPupils.push(result);
          }
          // FIX 3 integration: log credit for admin awareness.
          if (result.status === 'overpaid') {
            console.info(
              `ℹ️ ${result.pupilName} has credit of ${naira(result.credit)}`
            );
          }
        }
      } catch (err) {
        console.error(`❌ Outstanding calc error for pupil ${pupilId}:`, err.message);
        errorCount++;
      }
    });

    // Run all calculations concurrently for performance.
    await Promise.all(processingPromises);

    tbody.innerHTML = '';

    const noData =
      outstandingPupils.length === 0 && alumniWithBalance.length === 0;

    if (noData) {
      tbody.innerHTML =
        `<tr><td colspan="7" style="text-align:center; color:var(--color-success); padding:var(--space-2xl);">` +
        `✓ All fees collected for ${currentTerm}!</td></tr>`;
      updateSummaryDisplay(0, 0);

      if (errorCount > 0) {
        showToast(
          `Report complete with ${errorCount} error(s). Check console.`,
          'warning',
          6000
        );
      }
      return;
    }

    // Sort active pupils by balance descending (highest debt first).
    outstandingPupils.sort((a, b) => safeNum(b.balance) - safeNum(a.balance));

    const fragment = document.createDocumentFragment();

    // ── Active pupils ─────────────────────────────────────────────────────
    for (const pupil of outstandingPupils) {
      const baseFee     = safeNum(pupil.baseFee);
      const amountDue   = safeNum(pupil.amountDue);
      const arrears     = safeNum(pupil.arrears);
      const totalPaid   = safeNum(pupil.totalPaid);
      const balance     = safeNum(pupil.balance);

      let feeDisplay = naira(amountDue);
      if (amountDue !== baseFee) {
        const discountColor = amountDue < baseFee ? '#2196F3' : '#ff9800';
        feeDisplay =
          `<span style="text-decoration:line-through; color:#999;">${naira(baseFee)}</span>` +
          `<br><strong style="color:${discountColor};">${naira(amountDue)}</strong>`;
      }

      const arrearsNote =
        arrears > 0
          ? `<br><span style="color:#dc3545; font-size:0.85em; font-weight:600;">` +
            `+ ${naira(arrears)} arrears</span>`
          : '';

      const statusLabel =
        pupil.status === 'partial'    ? 'Partial' :
        arrears > 0                   ? 'With Arrears' :
                                        'Owing';

      const statusBg =
        pupil.status === 'partial'    ? '#ff9800' :
        arrears > 0                   ? '#dc3545' :
                                        '#f44336';

      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td data-label="Pupil Name">${pupil.pupilName ?? '—'}</td>` +
        `<td data-label="Class">${pupil.className ?? '—'}</td>` +
        `<td data-label="Amount Due">${feeDisplay}${arrearsNote}</td>` +
        `<td data-label="Total Paid">${naira(totalPaid)}</td>` +
        `<td data-label="Balance" class="text-bold text-danger">${naira(balance)}</td>` +
        `<td data-label="Status">` +
          `<span class="status-badge" style="background:${statusBg};">${statusLabel}</span>` +
        `</td>` +
        `<td data-label="Term">${currentTerm}</td>`;

      fragment.appendChild(tr);
      totalOutstanding += balance;
    }

    // ── FIX 5: Alumni section ─────────────────────────────────────────────
    if (alumniWithBalance.length > 0) {
      alumniWithBalance.sort((a, b) => safeNum(b.balance) - safeNum(a.balance));

      const headerTr = document.createElement('tr');
      headerTr.innerHTML =
        `<td colspan="7" style="` +
          `background:#fff3cd; color:#856404; font-weight:700;` +
          `padding:var(--space-sm) var(--space-md);` +
          `border-top:2px solid #ffc107;">` +
        `⚠️ Alumni with Outstanding Balances (${alumniWithBalance.length}) — ` +
        `Resolve before finalising graduation records` +
        `</td>`;
      fragment.appendChild(headerTr);

      for (const pupil of alumniWithBalance) {
        const balance   = safeNum(pupil.balance);
        const amountDue = safeNum(pupil.amountDue);
        const totalPaid = safeNum(pupil.totalPaid);

        const tr = document.createElement('tr');
        tr.style.background = '#fffdf0';
        tr.innerHTML =
          `<td data-label="Pupil Name">${pupil.pupilName ?? '—'} <em style="color:#856404;">(Alumni)</em></td>` +
          `<td data-label="Class">${pupil.className ?? '—'}</td>` +
          `<td data-label="Amount Due">${naira(amountDue)}</td>` +
          `<td data-label="Total Paid">${naira(totalPaid)}</td>` +
          `<td data-label="Balance" style="font-weight:700; color:#856404;">${naira(balance)}</td>` +
          `<td data-label="Status">` +
            `<span class="status-badge" style="background:#856404;">Alumni - Owing</span>` +
          `</td>` +
          `<td data-label="Term">${currentTerm}</td>`;

        fragment.appendChild(tr);
        totalOutstanding += balance;
      }
    }

    tbody.appendChild(fragment);

    updateSummaryDisplay(
      outstandingPupils.length + alumniWithBalance.length,
      totalOutstanding
    );

    if (errorCount > 0) {
      showToast(
        `Report loaded with ${errorCount} error(s). Some pupils may be missing.`,
        'warning',
        6000
      );
    }

  } catch (err) {
    console.error('❌ loadOutstandingFeesReport error:', err);
    if (tbody) {
      tbody.innerHTML =
        `<tr><td colspan="7" style="text-align:center; color:var(--color-danger);">` +
        `Error: ${err.message}</td></tr>`;
    }
    updateSummaryDisplay(0, 0);
    showToast('Failed to load outstanding fees report', 'danger');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// loadFinancialReports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load and render the financial summary report.
 *
 * FIX 6: Two separate collection rates are computed and surfaced:
 *   (a) Current-term rate — collections vs this term's fees only.
 *   (b) Overall rate      — collections vs total debt (fees + arrears).
 */
export async function loadFinancialReports() {
  try {
    const settings    = await getCurrentSettings();
    const session     = settings?.session;
    const currentTerm = settings?.term;

    if (!session || !currentTerm) {
      showToast('School settings not configured. Please set session and term.', 'warning');
      return;
    }

    console.log(`📊 Generating financial report for ${session} — ${currentTerm}`);

    const pupilsSnap = await getDocs(collection(db, 'pupils'));

    if (pupilsSnap.empty) {
      updateFinancialDisplays(0, 0, 0, 0, 0, 0, 0, session, currentTerm);
      return;
    }

    console.log(`✓ Found ${pupilsSnap.size} pupils for financial report`);

    // FIX 6: Track current-term fees and arrears separately.
    let totalCurrentFees = 0;
    let totalArrears     = 0;
    let totalCollected   = 0;
    let totalOutstanding = 0;
    let paidInFull       = 0;
    let partialPayments  = 0;
    let noPayment        = 0;

    let processedCount = 0;
    let skippedCount   = 0;
    let errorCount     = 0;

    // Process all pupils concurrently.
    const processingPromises = pupilsSnap.docs.map(async (pupilDoc) => {
      const pupilId   = pupilDoc.id;
      const pupilData = pupilDoc.data();

      if (pupilData.status === 'alumni' || pupilData.isActive === false) {
        skippedCount++;
        return;
      }

      try {
        const result = await calculateCurrentOutstanding(pupilId, session, currentTerm);

        if (result?.reason) {
          skippedCount++;
          return;
        }

        // FIX 6: Accumulate current-term fees and arrears separately.
        totalCurrentFees += safeNum(result.amountDue);
        totalArrears     += safeNum(result.arrears);
        totalCollected   += safeNum(result.totalPaid);
        totalOutstanding += safeNum(result.balance);

        const balance   = safeNum(result.balance);
        const totalPaid = safeNum(result.totalPaid);

        if (balance === 0 && totalPaid > 0) {
          paidInFull++;
        } else if (totalPaid > 0 && balance > 0) {
          partialPayments++;
        } else if (totalPaid === 0) {
          noPayment++;
        }

        processedCount++;

      } catch (err) {
        console.error(
          `❌ Financial report calc error for ${pupilData.name ?? pupilId}:`,
          err.message
        );
        errorCount++;
      }
    });

    await Promise.all(processingPromises);

    console.log('\n📊 Financial Report Summary:');
    console.log(`   Processed:           ${processedCount} pupils`);
    console.log(`   Skipped:             ${skippedCount}`);
    console.log(`   Errors:              ${errorCount}`);
    console.log(`   Current term fees:   ${naira(totalCurrentFees)}`);
    console.log(`   Arrears:             ${naira(totalArrears)}`);
    console.log(`   Collected:           ${naira(totalCollected)}`);
    console.log(`   Outstanding:         ${naira(totalOutstanding)}`);

    const totalExpected = totalCurrentFees + totalArrears;

    // FIX 6(a): Current-term collection rate.
    // Cap collected at currentFees so arrears over-payment doesn't inflate this.
    const currentTermCollected     = Math.min(totalCollected, totalCurrentFees);
    const currentTermCollectionRate =
      totalCurrentFees > 0
        ? ((currentTermCollected / totalCurrentFees) * 100).toFixed(1)
        : '0.0';

    // FIX 6(b): Overall collection rate (collections vs total debt).
    const overallCollectionRate =
      totalExpected > 0
        ? ((totalCollected / totalExpected) * 100).toFixed(1)
        : '0.0';

    console.log(`   Current-term rate:   ${currentTermCollectionRate}%`);
    console.log(`   Overall rate:        ${overallCollectionRate}%`);

    // Primary display uses the overall rate (matches existing HTML element).
    updateFinancialDisplays(
      totalExpected,
      totalCollected,
      totalOutstanding,
      overallCollectionRate,
      paidInFull,
      partialPayments,
      noPayment,
      session,
      currentTerm
    );

    // FIX 6: Surface current-term rate if the element exists (no-op if absent).
    setText('report-current-term-collection-rate', `${currentTermCollectionRate}%`);

    console.log('✅ Financial report generated successfully');

    if (errorCount > 0) {
      showToast(
        `Report generated with ${errorCount} error(s). Some pupils may be missing.`,
        'warning',
        6000
      );
    }

  } catch (err) {
    console.error('❌ loadFinancialReports error:', err);
    showToast('Failed to load financial reports', 'danger');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateSummaryDisplay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update the outstanding fees summary counters in the DOM.
 *
 * @param {number} count   — number of pupils with outstanding balances
 * @param {number} total   — total outstanding amount in naira
 */
export function updateSummaryDisplay(count, total) {
  setText('outstanding-count', String(safeNum(count)));
  setText('outstanding-total', naira(total));
}

// ─────────────────────────────────────────────────────────────────────────────
// updateFinancialDisplays
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update all financial summary DOM elements.
 *
 * @param {number} totalExpected
 * @param {number} totalCollected
 * @param {number} totalOutstanding
 * @param {string|number} collectionRate   — overall rate (percentage string or number)
 * @param {number} paidInFull
 * @param {number} partialPayments
 * @param {number} noPayment
 * @param {string} session
 * @param {string} term
 */
export function updateFinancialDisplays(
  totalExpected,
  totalCollected,
  totalOutstanding,
  collectionRate,
  paidInFull,
  partialPayments,
  noPayment,
  session,
  term
) {
  setText('report-total-expected',    naira(totalExpected));
  setText('report-total-collected',   naira(totalCollected));
  setText('report-total-outstanding', naira(totalOutstanding));
  setText('report-collection-rate',   `${collectionRate}%`);
  setText('report-paid-full',         String(safeNum(paidInFull)));
  setText('report-partial',           String(safeNum(partialPayments)));
  setText('report-owing',             String(safeNum(noPayment)));
  setText('report-session-display',   session ?? '—');
  setText('report-term-display',      term    ?? '—');
}

// ─────────────────────────────────────────────────────────────────────────────
// exportFinancialReport (dispatcher)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatch to the correct export format.
 *
 * @param {'csv'|'pdf'} format
 */
export async function exportFinancialReport(format) {
  if (format !== 'csv' && format !== 'pdf') {
    showToast('Invalid export format', 'warning');
    return;
  }

  try {
    const settings = await getCurrentSettings();
    const session  = settings?.session;
    const term     = settings?.term;

    if (!session || !term) {
      showToast('School settings not configured. Cannot export.', 'warning');
      return;
    }

    if (format === 'csv') {
      await exportFinancialCSV(session, term);
    } else {
      await exportFinancialPDF(session, term);
    }

  } catch (err) {
    console.error('❌ exportFinancialReport error:', err);
    showToast(`Failed to export report: ${err.message}`, 'danger');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// exportFinancialCSV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build and trigger a CSV download of the financial report.
 *
 * Uses calculateCurrentOutstanding as the single source of truth.
 *
 * @param {string} session
 * @param {string} term
 */
export async function exportFinancialCSV(session, term) {
  try {
    showToast('Preparing CSV export…', 'info', 2000);

    const pupilsSnap = await getDocs(collection(db, 'pupils'));

    if (pupilsSnap.empty) {
      showToast('No pupils found', 'warning');
      return;
    }

    const reportData    = [];
    let   processedCount = 0;
    let   skippedCount   = 0;

    console.log(`📊 Exporting financial data for ${pupilsSnap.size} pupils…`);

    const processingPromises = pupilsSnap.docs.map(async (pupilDoc) => {
      const pupilId = pupilDoc.id;

      try {
        const result = await calculateCurrentOutstanding(pupilId, session, term);

        if (result?.reason) {
          skippedCount++;
          return;
        }

        // Thread-safe push — Promise.all guarantees no interleaving issues here
        // because each promise writes its own entry (no shared mutable state).
        reportData.push({
          pupilName:   result.pupilName   ?? '',
          className:   result.className   ?? '',
          baseFee:     safeNum(result.baseFee),
          adjustedFee: safeNum(result.amountDue),
          arrears:     safeNum(result.arrears),
          totalDue:    safeNum(result.totalDue),
          totalPaid:   safeNum(result.totalPaid),
          balance:     safeNum(result.balance),
          status:      result.status      ?? '',
        });

        processedCount++;

      } catch (err) {
        console.error(`Error processing pupil ${pupilId} for CSV:`, err.message);
        skippedCount++;
      }
    });

    await Promise.all(processingPromises);

    if (reportData.length === 0) {
      showToast('No financial data to export', 'warning');
      return;
    }

    // Sort alphabetically by pupil name for a predictable output order.
    reportData.sort((a, b) => a.pupilName.localeCompare(b.pupilName));

    console.log(`✓ CSV export data prepared: ${processedCount} pupils`);

    // ── Build CSV ─────────────────────────────────────────────────────────
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const headers = [
      'Pupil Name', 'Class', 'Base Fee', 'Adjusted Fee',
      'Arrears', 'Total Due', 'Total Paid', 'Balance', 'Status',
    ];

    const rows = reportData.map((p) => [
      escape(p.pupilName),
      escape(p.className),
      p.baseFee,
      p.adjustedFee,
      p.arrears,
      p.totalDue,
      p.totalPaid,
      p.balance,
      escape(p.status),
    ].join(','));

    // Summary block appended below the data.
    const totalExpected  = reportData.reduce((s, p) => s + p.totalDue,  0);
    const totalCollected = reportData.reduce((s, p) => s + p.totalPaid, 0);
    const totalBalance   = reportData.reduce((s, p) => s + p.balance,   0);
    const collectionRate =
      totalExpected > 0
        ? ((totalCollected / totalExpected) * 100).toFixed(1)
        : '0.0';

    const summary = [
      '',
      'SUMMARY,,,,,,,,',
      `Pupils Processed,${processedCount}`,
      `Pupils Skipped,${skippedCount}`,
      `Total Expected,,,,, ${totalExpected}`,
      `Total Collected,,,,,, ${totalCollected}`,
      `Total Outstanding,,,,,,, ${totalBalance}`,
      `Collection Rate,${collectionRate}%`,
    ];

    const csv = [
      headers.join(','),
      ...rows,
      ...summary,
    ].join('\n');

    _downloadBlob(
      csv,
      'text/csv;charset=utf-8;',
      `Financial_Report_${session.replace(/\//g, '-')}_${term}_${_isoDate()}.csv`
    );

    showToast(`✓ CSV exported: ${reportData.length} pupils`, 'success');

  } catch (err) {
    console.error('❌ exportFinancialCSV error:', err);
    showToast('Failed to export CSV', 'danger');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// exportFinancialPDF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build and trigger a PDF download of the financial report using jsPDF + autoTable.
 *
 * Requires window.jspdf to be available (loaded via CDN).
 *
 * @param {string} session
 * @param {string} term
 */
export async function exportFinancialPDF(session, term) {
  try {
    if (typeof window.jspdf === 'undefined') {
      showToast('PDF library not loaded. Please refresh the page.', 'danger');
      return;
    }

    showToast('Preparing PDF export…', 'info', 2000);

    const pupilsSnap = await getDocs(collection(db, 'pupils'));

    if (pupilsSnap.empty) {
      showToast('No pupils found', 'warning');
      return;
    }

    const reportData    = [];
    let   processedCount = 0;
    let   skippedCount   = 0;

    console.log(`📊 Preparing PDF for ${pupilsSnap.size} pupils…`);

    const processingPromises = pupilsSnap.docs.map(async (pupilDoc) => {
      const pupilId = pupilDoc.id;

      try {
        const result = await calculateCurrentOutstanding(pupilId, session, term);

        if (result?.reason) {
          skippedCount++;
          return;
        }

        reportData.push({
          pupilName:   result.pupilName   ?? '',
          className:   result.className   ?? '',
          adjustedFee: safeNum(result.amountDue),
          arrears:     safeNum(result.arrears),
          totalDue:    safeNum(result.totalDue),
          totalPaid:   safeNum(result.totalPaid),
          balance:     safeNum(result.balance),
          status:      result.status      ?? '',
        });

        processedCount++;

      } catch (err) {
        console.error(`Error processing pupil ${pupilId} for PDF:`, err.message);
        skippedCount++;
      }
    });

    await Promise.all(processingPromises);

    if (reportData.length === 0) {
      showToast('No financial data to export', 'warning');
      return;
    }

    // Sort alphabetically.
    reportData.sort((a, b) => a.pupilName.localeCompare(b.pupilName));

    console.log(`✓ PDF data prepared: ${processedCount} pupils`);

    // ── Build PDF ─────────────────────────────────────────────────────────
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FAHMID NURSERY & PRIMARY SCHOOL', 105, 15, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Financial Report', 105, 25, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Session: ${session} | Term: ${term}`, 105, 32, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 105, 38, { align: 'center' });

    const tableBody = reportData.map((p) => [
      p.pupilName,
      p.className,
      naira(p.adjustedFee),
      naira(p.arrears),
      naira(p.totalPaid),
      naira(p.balance),
      _capitalise(p.status),
    ]);

    doc.autoTable({
      startY: 45,
      head: [['Pupil', 'Class', 'Fee', 'Arrears', 'Paid', 'Balance', 'Status']],
      body: tableBody,
      theme: 'grid',
      styles:     { fontSize: 8 },
      headStyles: { fillColor: [0, 178, 255] },
    });

    // ── Summary block ─────────────────────────────────────────────────────
    const totalExpected  = reportData.reduce((s, p) => s + p.totalDue,  0);
    const totalCollected = reportData.reduce((s, p) => s + p.totalPaid, 0);
    const totalBalance   = reportData.reduce((s, p) => s + p.balance,   0);
    const collectionRate =
      totalExpected > 0
        ? ((totalCollected / totalExpected) * 100).toFixed(1)
        : '0.0';

    const finalY = (doc.lastAutoTable?.finalY ?? 45) + 12;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 14, finalY);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const summaryLines = [
      [`Pupils Processed:`,   String(processedCount)],
      [`Pupils Skipped:`,     String(skippedCount)],
      [`Total Expected:`,     naira(totalExpected)],
      [`Total Collected:`,    naira(totalCollected)],
      [`Total Outstanding:`,  naira(totalBalance)],
      [`Collection Rate:`,    `${collectionRate}%`],
    ];

    summaryLines.forEach(([label, value], i) => {
      const y = finalY + 8 + i * 6;
      doc.text(label, 14, y);
      doc.text(value, 80, y);
    });

    doc.save(
      `Financial_Report_${session.replace(/\//g, '-')}_${term}_${_isoDate()}.pdf`
    );

    showToast(`✓ PDF exported: ${reportData.length} pupils`, 'success');

  } catch (err) {
    console.error('❌ exportFinancialPDF error:', err);
    showToast('Failed to export PDF', 'danger');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger a browser file download from an in-memory string.
 */
function _downloadBlob(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * ISO date string for file naming (YYYY-MM-DD).
 */
function _isoDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Capitalise the first letter of a string.
 */
function _capitalise(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
