/**
 * finance/pdf-report.js
 *
 * Comprehensive Financial Report PDF Generator — pure ES Module, Firebase v12.8.0
 * modular SDK (CDN imports).
 *
 * @version 2.0.0
 * @requires jsPDF        (window.jspdf)    — loaded via CDN script tag
 * @requires autoTable    (jspdf-autotable) — loaded via CDN script tag
 * @requires Chart.js     (window.Chart)    — loaded via CDN script tag
 *
 * Exported surface:
 *   generateComprehensiveFinancialReport() — async named export
 *
 * All other functions are module-private.
 */

import { db }                          from '../db.js';
import { getCurrentSettings }          from '../shared/settings.js';
import { calculateCurrentOutstanding } from './outstanding.js';
import { showToast }                   from '../ui/toast.js';

import {
  collection,
  getDocs,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js';

// ─────────────────────────────────────────────────────────────────────────────
// Internal utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely coerce a value to a finite number, returning 0 for anything invalid.
 */
function safeNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Format a number as Nigerian Naira.
 */
function naira(amount) {
  return `₦${safeNum(amount).toLocaleString()}`;
}

/**
 * Return today's ISO date string (YYYY-MM-DD) for use in filenames.
 */
function isoDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Guard: throws a descriptive Error if a globally expected library is absent.
 * Checked once at the top of the public entry-point so failures are
 * reported early with a clear message rather than cryptically mid-render.
 */
function assertGlobals() {
  if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
    throw new Error(
      'jsPDF is not loaded. Add the jsPDF CDN script tag before using this module.'
    );
  }
  if (typeof window.Chart === 'undefined') {
    throw new Error(
      'Chart.js is not loaded. Add the Chart.js CDN script tag before using this module.'
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry-point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate and download the comprehensive financial PDF report.
 *
 * @returns {Promise<void>}
 */
export async function generateComprehensiveFinancialReport() {
  try {
    assertGlobals();

    console.log('📊 Starting comprehensive financial report generation…');
    showToast('Generating comprehensive financial report…', 'info', 3000);

    // Step 1: Gather all required data.
    const reportData = await gatherFinancialData();

    if (!reportData.success) {
      throw new Error(reportData.error ?? 'Failed to gather financial data');
    }

    // Step 2: Perform statistical analysis.
    const analytics = performFinancialAnalysis(reportData);

    // Step 3: Generate chart images (data URLs).
    const charts = await generateCharts(reportData, analytics);

    // Step 4: Compose PDF.
    const pdf = createPDFReport(reportData, analytics, charts);

    // Step 5: Trigger download.
    const filename =
      `Financial_Report_${reportData.session.replace(/\//g, '-')}_${reportData.term}_${isoDate()}.pdf`;
    pdf.save(filename);

    showToast('✓ Comprehensive financial report downloaded successfully', 'success', 5000);
    console.log('✅ Report generation complete');

  } catch (error) {
    console.error('❌ Report generation failed:', error);
    showToast(`Failed to generate report: ${error.message}`, 'danger', 8000);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA GATHERING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all financial data required for the report.
 *
 * Uses calculateCurrentOutstanding() as the single source of truth for
 * per-pupil fee amounts, consistent with the rest of the finance module.
 *
 * @returns {Promise<object>} Structured report-data object.
 */
async function gatherFinancialData() {
  try {
    console.log('📋 Gathering financial data…');

    // ── Settings ──────────────────────────────────────────────────────────
    const settings = await getCurrentSettings();
    const session  = settings?.session;
    const term     = settings?.term;

    if (!session || !term) {
      return {
        success: false,
        error: 'School settings not configured. Please set session and term first.',
      };
    }

    console.log(`Session: ${session}, Term: ${term}`);

    // ── Pupils ────────────────────────────────────────────────────────────
    const pupilsSnap = await getDocs(collection(db, 'pupils'));

    if (pupilsSnap.empty) {
      return { success: false, error: 'No pupils found in system' };
    }

    const pupils = [];

    let totalExpected    = 0;
    let totalCollected   = 0;
    let totalOutstanding = 0;

    const statusCount = {
      paid:             0,
      partial:          0,
      owing:            0,
      owingWithArrears: 0,
    };

    // classSummary keyed by classId for O(1) accumulation.
    const classSummaryMap = {};

    // Run all per-pupil calculations concurrently for performance.
    // Each promise is isolated so one failure does not abort the others.
    await Promise.all(
      pupilsSnap.docs.map(async (pupilDoc) => {
        const pupilId = pupilDoc.id;

        try {
          const result = await calculateCurrentOutstanding(pupilId, session, term);

          // Skip pupils with no fee configured (result carries a .reason string).
          if (result?.reason) return;

          const amountDue   = safeNum(result.amountDue);
          const arrears     = safeNum(result.arrears);
          const totalDue    = safeNum(result.totalDue);
          const totalPaid   = safeNum(result.totalPaid);
          const balance     = safeNum(result.balance);
          const classId     = result.classId ?? '__unknown__';
          const className   = result.className ?? 'Unknown';

          pupils.push({
            id:        pupilId,
            name:      result.pupilName ?? '',
            className,
            classId,
            amountDue,
            arrears,
            totalDue,
            totalPaid,
            balance,
            status: result.status ?? 'owing',
          });

          totalExpected    += totalDue;
          totalCollected   += totalPaid;
          totalOutstanding += balance;

          // Status distribution — matches original logic exactly.
          if (balance === 0 && totalPaid > 0) {
            statusCount.paid++;
          } else if (totalPaid > 0 && balance > 0) {
            statusCount.partial++;
          } else if (arrears > 0) {
            statusCount.owingWithArrears++;
          } else {
            statusCount.owing++;
          }

          // Class aggregation.
          if (!classSummaryMap[classId]) {
            classSummaryMap[classId] = {
              className,
              pupils:      0,
              expected:    0,
              collected:   0,
              outstanding: 0,
            };
          }
          classSummaryMap[classId].pupils++;
          classSummaryMap[classId].expected    += totalDue;
          classSummaryMap[classId].collected   += totalPaid;
          classSummaryMap[classId].outstanding += balance;

        } catch (err) {
          console.error(`Error processing pupil ${pupilId}:`, err.message);
        }
      })
    );

    // ── Payment transactions ───────────────────────────────────────────────
    // Query by session + term to minimise data transfer.
    const txQuery = query(
      collection(db, 'payment_transactions'),
      where('session', '==', session),
      where('term',    '==', term)
    );
    const transactionsSnap = await getDocs(txQuery);

    const transactions  = [];
    const paymentMethods = {};

    transactionsSnap.forEach((doc) => {
      const tx     = doc.data();
      const amount = safeNum(tx.amountPaid);
      const method = tx.paymentMethod || 'Cash';

      transactions.push({
        receiptNo: tx.receiptNo ?? null,
        pupilId:   tx.pupilId   ?? null,
        pupilName: tx.pupilName ?? '',
        amount,
        method,
        // Guard: toDate() only exists on Firestore Timestamps.
        date: tx.paymentDate?.toDate?.() ?? null,
      });

      paymentMethods[method] = (paymentMethods[method] ?? 0) + 1;
    });

    // ── Fee structures (for reference only) ───────────────────────────────
    const feeStructuresSnap = await getDocs(collection(db, 'fee_structures'));
    const feeStructures     = [];

    feeStructuresSnap.forEach((doc) => {
      const data = doc.data();
      feeStructures.push({
        classId:   data.classId   ?? null,
        className: data.className ?? '',
        total:     safeNum(data.total),
        fees:      data.fees ?? {},
      });
    });

    // ── Sort and return ───────────────────────────────────────────────────
    const classSummary = Object.values(classSummaryMap).sort((a, b) =>
      a.className.localeCompare(b.className)
    );

    console.log(
      `✓ Gathered data: ${pupils.length} pupils, ${transactions.length} transactions`
    );

    return {
      success:     true,
      session,
      term,
      // Pass raw settings for optional session-date use in timing analysis.
      settings,
      generatedAt: new Date(),
      pupils,
      transactions,
      feeStructures,
      summary: {
        totalPupils:    pupils.length,
        totalExpected,
        totalCollected,
        totalOutstanding,
        collectionRate:
          totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
        statusCount,
        classSummary,
      },
      paymentMethods,
    };

  } catch (error) {
    console.error('Data gathering error:', error);
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICAL ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive analytics from the gathered report data.
 * Pure computation — no I/O.
 *
 * @param {object} reportData
 * @returns {object} Analytics result object.
 */
function performFinancialAnalysis(reportData) {
  console.log('📊 Performing statistical analysis…');

  const { pupils, transactions, summary } = reportData;

  const paymentTiming  = analyzePaymentTiming(transactions, reportData);
  const totalTxAmount  = transactions.reduce((s, tx) => s + safeNum(tx.amount), 0);
  const avgPaymentSize = transactions.length > 0 ? totalTxAmount / transactions.length : 0;

  const pupilsWithArrears = pupils.filter((p) => p.arrears > 0);
  const totalArrears      = pupilsWithArrears.reduce((s, p) => s + p.arrears, 0);
  const avgArrears        = pupilsWithArrears.length > 0
    ? totalArrears / pupilsWithArrears.length
    : 0;

  const classEfficiency = summary.classSummary
    .map((cls) => ({
      className:      cls.className,
      collectionRate: cls.expected > 0 ? (cls.collected / cls.expected) * 100 : 0,
      pupils:         cls.pupils,
    }))
    .sort((a, b) => b.collectionRate - a.collectionRate);

  const paymentDistribution = analyzePaymentDistribution(pupils);
  const healthScore         = calculateFinancialHealthScore(summary, paymentTiming);

  console.log(`✓ Analysis complete. Health score: ${healthScore.toFixed(1)}/100`);

  return {
    paymentTiming,
    avgPaymentSize,
    arrears: {
      count:      pupilsWithArrears.length,
      total:      totalArrears,
      average:    avgArrears,
      percentage: pupils.length > 0
        ? (pupilsWithArrears.length / pupils.length) * 100
        : 0,
    },
    classEfficiency,
    paymentDistribution,
    healthScore,
  };
}

/**
 * Bucket transactions into early / on-time / late / unknown based on days
 * elapsed since the session start date.
 *
 * @param {Array}  transactions
 * @param {object} reportData    — used to read session start date safely
 * @returns {{ early: number, onTime: number, late: number, unknown: number }}
 */
function analyzePaymentTiming(transactions, reportData) {
  const timing = { early: 0, onTime: 0, late: 0, unknown: 0 };

  if (transactions.length === 0) return timing;

  // Prefer the Firestore Timestamp; fall back to a sentinel far in the past
  // so unknown dates don't corrupt the bucket counts.
  let sessionStart;
  try {
    const rawDate = reportData.settings?.currentSession?.startDate;
    sessionStart  = rawDate?.toDate?.() ?? null;
  } catch (_) {
    sessionStart = null;
  }

  transactions.forEach((tx) => {
    if (!tx.date) {
      timing.unknown++;
      return;
    }
    if (!sessionStart) {
      // Cannot determine timing without a reference date — treat as unknown.
      timing.unknown++;
      return;
    }

    const daysSince = Math.floor(
      (tx.date.getTime() - sessionStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince < 30) {
      timing.early++;
    } else if (daysSince <= 60) {
      timing.onTime++;
    } else {
      timing.late++;
    }
  });

  return timing;
}

/**
 * Count pupils by payment completion level.
 *
 * @param {Array} pupils
 * @returns {{ fullPayment: number, partialPayment: number, noPayment: number }}
 */
function analyzePaymentDistribution(pupils) {
  return {
    fullPayment:    pupils.filter((p) => p.balance === 0 && p.totalPaid > 0).length,
    partialPayment: pupils.filter((p) => p.totalPaid > 0 && p.balance > 0).length,
    noPayment:      pupils.filter((p) => p.totalPaid === 0).length,
  };
}

/**
 * Compute a 0–100 financial health score.
 *
 * Methodology:
 *   40 pts — collection rate
 *   30 pts — payment timeliness
 *   20 pts — arrears management (proxy: collected / expected)
 *   10 pts — full-payment ratio
 *
 * @param {object} summary
 * @param {object} paymentTiming
 * @returns {number}
 */
function calculateFinancialHealthScore(summary, paymentTiming) {
  let score = 0;

  // Collection rate (40 pts).
  score += (safeNum(summary.collectionRate) / 100) * 40;

  // Timeliness (30 pts).
  const totalTimed =
    paymentTiming.early + paymentTiming.onTime + paymentTiming.late;
  if (totalTimed > 0) {
    score +=
      ((paymentTiming.early + paymentTiming.onTime) / totalTimed) * 30;
  }

  // Arrears management (20 pts) — mirrors original: collected/expected proxy.
  const expected = safeNum(summary.totalExpected);
  if (expected > 0) {
    score += (safeNum(summary.totalCollected) / expected) * 20;
  }

  // Payment distribution (10 pts).
  const totalPupils = safeNum(summary.totalPupils) || 1;
  score += (safeNum(summary.statusCount?.paid) / totalPupils) * 10;

  return Math.min(100, Math.max(0, score));
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render all four Chart.js charts off-screen and capture them as PNG data URLs.
 *
 * A single hidden canvas is reused for all charts to avoid creating multiple
 * detached canvas elements. Each chart is fully destroyed before the next one
 * is created, and the canvas is removed from the DOM inside a `finally` block
 * to prevent leaks even when a chart throws.
 *
 * @param {object} reportData
 * @param {object} analytics
 * @returns {Promise<{ revenueOverview, paymentMethods, classEfficiency, statusDistribution }>}
 */
async function generateCharts(reportData, analytics) {
  console.log('📈 Generating charts…');

  const charts = {
    revenueOverview:    null,
    paymentMethods:     null,
    classEfficiency:    null,
    statusDistribution: null,
  };

  // Create a single off-screen canvas.
  const canvas        = document.createElement('canvas');
  canvas.width        = 800;
  canvas.height       = 400;
  canvas.style.cssText = 'position:absolute; left:-9999px; top:-9999px;';
  document.body.appendChild(canvas);

  try {
    charts.revenueOverview    = await renderChart(() =>
      buildRevenueChart(canvas, reportData)
    );
    charts.paymentMethods     = await renderChart(() =>
      buildPaymentMethodsChart(canvas, reportData)
    );
    charts.classEfficiency    = await renderChart(() =>
      buildClassEfficiencyChart(canvas, analytics)
    );
    charts.statusDistribution = await renderChart(() =>
      buildStatusDistributionChart(canvas, reportData)
    );

    console.log('✓ All charts generated');

  } catch (error) {
    console.error('Chart generation error:', error);
    // Partial charts are returned; caller renders what it has.

  } finally {
    // Always remove the canvas — even if a chart threw.
    document.body.removeChild(canvas);
  }

  return charts;
}

/**
 * Generic chart renderer.
 *
 * Accepts a factory function that creates and returns a Chart.js instance
 * already attached to a canvas. Waits for Chart.js animation to complete,
 * then exports the canvas as a PNG data URL and destroys the chart.
 *
 * Using the animation `onComplete` callback (with `duration:0` for the
 * revenue bar chart) and a small `requestAnimationFrame` + `setTimeout`
 * guard ensures the canvas bitmap is fully committed before `toDataURL`
 * is called, avoiding the blank-image bug present in the original code.
 *
 * @param {() => Chart} factory  — creates the Chart instance and returns it
 * @returns {Promise<string|null>}
 */
function renderChart(factory) {
  return new Promise((resolve) => {
    let chart;

    try {
      chart = factory();
    } catch (err) {
      console.error('Chart factory error:', err);
      resolve(null);
      return;
    }

    if (!chart) {
      resolve(null);
      return;
    }

    // For charts with animation disabled we still go through rAF + timeout
    // so the browser has a chance to composite the canvas pixels.
    const capture = () => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            const dataUrl = chart.canvas.toDataURL('image/png', 1.0);
            chart.destroy();
            resolve(dataUrl || null);
          } catch (err) {
            console.error('toDataURL error:', err);
            chart.destroy();
            resolve(null);
          }
        }, 200);
      });
    };

    // If Chart.js fires onComplete we use it; otherwise we fall back to a
    // fixed 500 ms delay (matches original pie/doughnut chart approach).
    const originalOnComplete = chart.options?.animation?.onComplete;
    if (originalOnComplete) {
      // Already wired in the builder — nothing to do here.
      // The builder resolves via the callback chain.
      // (This branch is used by buildRevenueChart.)
    } else {
      // Pie / doughnut / horizontal bar — no onComplete callback registered.
      setTimeout(capture, 500);
    }
  });
}

// ── Individual chart builders ─────────────────────────────────────────────────

/**
 * Revenue overview bar chart.
 * Returns the Chart instance; capture is triggered via animation.onComplete.
 */
function buildRevenueChart(canvas, reportData) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // We need to resolve from inside the animation callback, so we wrap this
  // builder differently. renderChart detects the onComplete is present and
  // does nothing; the builder resolves the outer renderChart promise by
  // smuggling the resolve function through a closure.
  //
  // To keep the API clean, buildRevenueChart returns a special chart object
  // whose options.animation.onComplete resolves a promise that renderChart
  // never sees. Instead, renderChart is given a factory that itself returns
  // a Promise<string> — but that would break the factory signature.
  //
  // Simpler approach: disable animation (duration:0) and let the generic
  // capture path in renderChart handle the timing. This is safe because
  // the canvas is fully painted synchronously when animation.duration=0.

  return new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Expected Revenue', 'Collected Revenue', 'Outstanding'],
      datasets: [{
        label:           'Amount (₦)',
        data: [
          safeNum(reportData.summary.totalExpected),
          safeNum(reportData.summary.totalCollected),
          safeNum(reportData.summary.totalOutstanding),
        ],
        backgroundColor: [
          'rgba(54, 162, 235, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(255, 99, 132, 0.8)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 2,
      }],
    },
    options: {
      responsive: false,
      animation: { duration: 0 },      // synchronous paint — capture is safe
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text:    'Revenue Overview',
          font:    { size: 16, weight: 'bold' },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => naira(value),
          },
        },
      },
    },
  });
}

/**
 * Payment methods pie chart.
 */
function buildPaymentMethodsChart(canvas, reportData) {
  const methods = Object.keys(reportData.paymentMethods ?? {});
  const counts  = Object.values(reportData.paymentMethods ?? {});

  if (methods.length === 0) return null;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const colors = [
    'rgba(255, 99, 132, 0.8)',
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 206, 86, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(153, 102, 255, 0.8)',
  ];

  return new window.Chart(ctx, {
    type: 'pie',
    data: {
      labels:   methods,
      datasets: [{
        data:            counts,
        backgroundColor: colors.slice(0, methods.length),
        borderColor:     '#fff',
        borderWidth:     2,
      }],
    },
    options: {
      responsive: false,
      animation:  { duration: 0 },
      plugins: {
        legend: { position: 'right' },
        title: {
          display: true,
          text:    'Payment Methods Distribution',
          font:    { size: 16, weight: 'bold' },
        },
      },
    },
  });
}

/**
 * Collection efficiency horizontal bar chart (top 8 classes by rate).
 */
function buildClassEfficiencyChart(canvas, analytics) {
  const topClasses = (analytics.classEfficiency ?? []).slice(0, 8);

  if (topClasses.length === 0) return null;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  return new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels:   topClasses.map((c) => c.className),
      datasets: [{
        label:           'Collection Rate (%)',
        data:            topClasses.map((c) => c.collectionRate),
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
        borderColor:     'rgba(75, 192, 192, 1)',
        borderWidth:     2,
      }],
    },
    options: {
      indexAxis:  'y',
      responsive: false,
      animation:  { duration: 0 },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text:    'Collection Efficiency by Class',
          font:    { size: 16, weight: 'bold' },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          max:         100,
          ticks: {
            callback: (value) => `${value}%`,
          },
        },
      },
    },
  });
}

/**
 * Payment status doughnut chart.
 */
function buildStatusDistributionChart(canvas, reportData) {
  const sc = reportData.summary?.statusCount ?? {};

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  return new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Paid in Full', 'Partial Payment', 'Owing', 'Owing with Arrears'],
      datasets: [{
        data: [
          safeNum(sc.paid),
          safeNum(sc.partial),
          safeNum(sc.owing),
          safeNum(sc.owingWithArrears),
        ],
        backgroundColor: [
          'rgba(75, 192, 192, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(255, 159, 64, 0.8)',
          'rgba(255, 99, 132, 0.8)',
        ],
        borderColor:  '#fff',
        borderWidth:  2,
      }],
    },
    options: {
      responsive: false,
      animation:  { duration: 0 },
      plugins: {
        legend: { position: 'bottom' },
        title: {
          display: true,
          text:    'Payment Status Distribution',
          font:    { size: 16, weight: 'bold' },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF CREATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compose the full multi-page PDF report.
 *
 * @param {object} reportData
 * @param {object} analytics
 * @param {object} charts       — keyed PNG data URLs (value may be null)
 * @returns {jsPDF}
 */
function createPDFReport(reportData, analytics, charts) {
  console.log('📄 Creating PDF document…');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 20;   // current vertical cursor

  // ── Helper: advance cursor, add page break when needed ──────────────────
  function requireSpace(needed) {
    if (y + needed > 270) {
      doc.addPage();
      y = 20;
    }
  }

  function gap(pts = 8) { y += pts; }

  // ── HEADER ───────────────────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FAHMID NURSERY & PRIMARY SCHOOL', 105, y, { align: 'center' });
  gap(10);

  doc.setFontSize(14);
  doc.text('Comprehensive Financial Report', 105, y, { align: 'center' });
  gap(8);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Session: ${reportData.session} | Term: ${reportData.term}`,
    105, y, { align: 'center' }
  );
  gap(5);

  const generatedAt = reportData.generatedAt instanceof Date
    ? reportData.generatedAt
    : new Date();

  doc.text(
    `Generated: ${generatedAt.toLocaleDateString('en-GB')} ${generatedAt.toLocaleTimeString('en-GB')}`,
    105, y, { align: 'center' }
  );
  gap(15);

  // ── 1. EXECUTIVE SUMMARY ─────────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. EXECUTIVE SUMMARY', 14, y);
  gap(8);

  const summaryTableData = [
    ['Total Enrolled Pupils',  String(safeNum(reportData.summary.totalPupils))],
    ['Expected Revenue',       naira(reportData.summary.totalExpected)],
    ['Revenue Collected',      naira(reportData.summary.totalCollected)],
    ['Outstanding Balance',    naira(reportData.summary.totalOutstanding)],
    ['Collection Rate',        `${safeNum(reportData.summary.collectionRate).toFixed(1)}%`],
    ['Financial Health Score', `${safeNum(analytics.healthScore).toFixed(1)}/100`],
  ];

  doc.autoTable({
    startY:     y,
    head:       [['Metric', 'Value']],
    body:       summaryTableData,
    theme:      'grid',
    headStyles: { fillColor: [0, 178, 255], fontStyle: 'bold' },
    margin:     { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 12;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Financial Health: ${getHealthScoreInterpretation(analytics.healthScore)}`,
    14, y
  );
  gap(10);

  // ── 2. REVENUE OVERVIEW CHART ────────────────────────────────────────────
  if (charts.revenueOverview) {
    requireSpace(108);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('2. REVENUE OVERVIEW', 14, y);
    gap(8);

    doc.addImage(charts.revenueOverview, 'PNG', 14, y, 180, 90);
    gap(100);
  }

  // ── 3. COLLECTION ANALYSIS ───────────────────────────────────────────────
  requireSpace(80);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. COLLECTION ANALYSIS', 14, y);
  gap(8);

  const sc = reportData.summary.statusCount;
  const statusTableData = [
    ['Paid in Full',           safeNum(sc.paid)],
    ['Partial Payment',        safeNum(sc.partial)],
    ['Owing (No Arrears)',     safeNum(sc.owing)],
    ['Owing (With Arrears)',   safeNum(sc.owingWithArrears)],
  ];

  doc.autoTable({
    startY:     y,
    head:       [['Payment Status', 'Count']],
    body:       statusTableData,
    theme:      'striped',
    headStyles: { fillColor: [0, 178, 255] },
    margin:     { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 12;

  if (charts.paymentMethods) {
    requireSpace(100);
    doc.addImage(charts.paymentMethods, 'PNG', 14, y, 180, 90);
    gap(100);
  }

  // ── 4. STATISTICAL INSIGHTS ──────────────────────────────────────────────
  requireSpace(60);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('4. STATISTICAL INSIGHTS', 14, y);
  gap(8);

  const insightsData = [
    ['Average Payment Size',        naira(analytics.avgPaymentSize)],
    ['Pupils with Arrears',         `${safeNum(analytics.arrears.count)} (${safeNum(analytics.arrears.percentage).toFixed(1)}%)`],
    ['Total Arrears Amount',        naira(analytics.arrears.total)],
    ['Average Arrears per Pupil',   naira(analytics.arrears.average)],
  ];

  doc.autoTable({
    startY:     y,
    head:       [['Metric', 'Value']],
    body:       insightsData,
    theme:      'grid',
    headStyles: { fillColor: [0, 178, 255] },
    margin:     { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 12;

  // ── 5. CLASS-LEVEL BREAKDOWN ─────────────────────────────────────────────
  requireSpace(80);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('5. CLASS-LEVEL BREAKDOWN', 14, y);
  gap(8);

  const classTableData = reportData.summary.classSummary.map((cls) => {
    const rate = cls.expected > 0
      ? ((cls.collected / cls.expected) * 100).toFixed(1)
      : '0.0';
    return [
      cls.className,
      cls.pupils,
      naira(cls.expected),
      naira(cls.collected),
      naira(cls.outstanding),
      `${rate}%`,
    ];
  });

  doc.autoTable({
    startY:      y,
    head:        [['Class', 'Pupils', 'Expected', 'Collected', 'Outstanding', 'Rate']],
    body:        classTableData,
    theme:       'striped',
    headStyles:  { fillColor: [0, 178, 255], fontSize: 9 },
    bodyStyles:  { fontSize: 8 },
    margin:      { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 12;

  if (charts.classEfficiency) {
    requireSpace(100);
    doc.addImage(charts.classEfficiency, 'PNG', 14, y, 180, 90);
    gap(100);
  }

  // ── 6. KEY FINDINGS & RECOMMENDATIONS ───────────────────────────────────
  doc.addPage();
  y = 20;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('6. KEY FINDINGS & RECOMMENDATIONS', 14, y);
  gap(10);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const findings = generateKeyFindings(reportData, analytics);

  findings.forEach((finding) => {
    const lines = doc.splitTextToSize(finding, 180);
    const needed = lines.length * 6 + 4;

    if (y + needed > 270) {
      doc.addPage();
      y = 20;
    }

    doc.text(lines, 14, y);
    y += needed;
  });

  // ── 7. METHODOLOGY ───────────────────────────────────────────────────────
  gap(10);
  requireSpace(60);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('7. METHODOLOGY', 14, y);
  gap(8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const methodologyLines = [
    'All financial data is calculated using the canonical calculateCurrentOutstanding() function,',
    'ensuring consistency with live system data.',
    '',
    'Collection Rate = (Total Collected / Total Expected) × 100',
    'Financial Health Score = Weighted average of collection rate (40%), payment timeliness (30%),',
    'arrears management (20%), and payment distribution (10%).',
    '',
    'Payment timeliness categories:',
    '  • Early: Within 30 days of session start',
    '  • On-time: 31–60 days',
    '  • Late: After 60 days',
    '',
    'All calculations are reproducible and auditable against the database.',
  ];

  methodologyLines.forEach((line) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(line, 14, y);
    y += 5;
  });

  // ── PAGE FOOTERS ─────────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    doc.text('CONFIDENTIAL — For Internal Use Only', 14, 290);
    // Reset text colour for subsequent pages (jsPDF persists state).
    doc.setTextColor(0);
  }

  console.log('✓ PDF document created');

  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return a plain-English interpretation of a 0–100 health score.
 *
 * @param {number} score
 * @returns {string}
 */
function getHealthScoreInterpretation(score) {
  const s = safeNum(score);
  if (s >= 90) return 'Excellent — Strong financial performance';
  if (s >= 75) return 'Good — Healthy collection rates';
  if (s >= 60) return 'Fair — Room for improvement';
  if (s >= 40) return 'Poor — Requires attention';
  return 'Critical — Immediate action needed';
}

/**
 * Produce a list of bullet-point findings and recommendations.
 *
 * @param {object} reportData
 * @param {object} analytics
 * @returns {string[]}
 */
function generateKeyFindings(reportData, analytics) {
  const findings = [];
  const rate     = safeNum(reportData.summary?.collectionRate);

  // Collection rate finding.
  if (rate >= 80) {
    findings.push(
      `• Strong collection performance at ${rate.toFixed(1)}%, indicating effective fee collection processes.`
    );
  } else if (rate >= 60) {
    findings.push(
      `• Collection rate of ${rate.toFixed(1)}% is moderate. Consider implementing payment reminders and follow-up procedures.`
    );
  } else {
    findings.push(
      `• Collection rate of ${rate.toFixed(1)}% is below target. Immediate action required to improve fee collection.`
    );
  }

  // Arrears finding.
  const arrearsPercent = safeNum(analytics.arrears?.percentage);
  const arrearsCount   = safeNum(analytics.arrears?.count);
  const arrearsTotal   = safeNum(analytics.arrears?.total);

  if (arrearsPercent > 30) {
    findings.push(
      `• ${arrearsPercent.toFixed(1)}% of pupils have outstanding arrears totalling ${naira(arrearsTotal)}. Arrears recovery strategy recommended.`
    );
  } else if (arrearsCount > 0) {
    findings.push(
      `• ${arrearsCount} pupil(s) have arrears. Total outstanding: ${naira(arrearsTotal)}.`
    );
  }

  // Class performance.
  const ce        = analytics.classEfficiency ?? [];
  const bestClass = ce[0];
  const worstClass = ce[ce.length - 1];

  if (bestClass && worstClass && bestClass !== worstClass) {
    findings.push(
      `• Best performing class: ${bestClass.className} (${safeNum(bestClass.collectionRate).toFixed(1)}% collection rate). ` +
      `Lowest: ${worstClass.className} (${safeNum(worstClass.collectionRate).toFixed(1)}%).`
    );
  }

  // Payment methods.
  const methodEntries = Object.entries(reportData.paymentMethods ?? {});
  if (methodEntries.length > 0) {
    const [topMethod, topCount] = methodEntries.sort((a, b) => b[1] - a[1])[0];
    findings.push(
      `• Most common payment method: ${topMethod} (${topCount} transaction${topCount !== 1 ? 's' : ''}).`
    );
  }

  // Recommendations block.
  findings.push('');
  findings.push('RECOMMENDATIONS:');

  if (rate < 80) {
    findings.push('• Implement automated payment reminders via SMS/email');
    findings.push('• Consider instalment payment plans for struggling families');
  }

  if (arrearsPercent > 20) {
    findings.push('• Launch targeted arrears recovery campaign');
    findings.push('• Offer payment grace periods for pupils with consistent arrears');
  }

  if (worstClass && safeNum(worstClass.collectionRate) < 50) {
    findings.push(
      `• Focus collection efforts on ${worstClass.className} (currently ${safeNum(worstClass.collectionRate).toFixed(1)}%)`
    );
  }

  return findings;
}
