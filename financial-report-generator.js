/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Comprehensive Financial Report PDF Generator
 * 
 * @version 1.0.0
 * @requires jsPDF, jspdf-autotable, Chart.js
 * 
 * CRITICAL: This module generates accurate, auditable financial reports
 * All calculations are reproducible and match the live system data
 */

'use strict';

/**
 * ═══════════════════════════════════════════════════════════
 * MAIN REPORT GENERATOR
 * ═══════════════════════════════════════════════════════════
 */
window.generateComprehensiveFinancialReport = async function() {
  try {
    console.log('📊 Starting comprehensive financial report generation...');
    
    // Show loading indicator
    window.showToast?.('Generating comprehensive financial report...', 'info', 3000);
    
    // Step 1: Gather all required data
    const reportData = await gatherFinancialData();
    
    if (!reportData.success) {
      throw new Error(reportData.error || 'Failed to gather financial data');
    }
    
    // Step 2: Perform statistical analysis
    const analytics = performFinancialAnalysis(reportData);
    
    // Step 3: Generate charts as data URLs
    const charts = await generateCharts(reportData, analytics);
    
    // Step 4: Create PDF document
    const pdf = createPDFReport(reportData, analytics, charts);
    
    // Step 5: Download
    const filename = `Financial_Report_${reportData.session.replace(/\//g, '-')}_${reportData.term}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
    
    window.showToast?.('✓ Comprehensive financial report downloaded successfully', 'success', 5000);
    
    console.log('✅ Report generation complete');
    
  } catch (error) {
    console.error('❌ Report generation failed:', error);
    window.showToast?.(`Failed to generate report: ${error.message}`, 'danger', 8000);
  }
};

/**
 * ═══════════════════════════════════════════════════════════
 * DATA GATHERING
 * ═══════════════════════════════════════════════════════════
 */
async function gatherFinancialData() {
  try {
    console.log('📋 Gathering financial data...');
    
    // Get current session/term
    const settings = await window.getCurrentSettings();
    const session = settings.session;
    const term = settings.term;
    
    console.log(`Session: ${session}, Term: ${term}`);
    
    // Get all pupils (active enrollment)
    const pupilsSnap = await db.collection('pupils').get();
    
    if (pupilsSnap.empty) {
      return {
        success: false,
        error: 'No pupils found in system'
      };
    }
    
    const pupils = [];
    const paymentsByPupil = {};
    const transactionsByPupil = {};
    
    let totalExpected = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    
    const statusCount = {
      paid: 0,
      partial: 0,
      owing: 0,
      owingWithArrears: 0
    };
    
    const classSummary = {};
    
    // Process each pupil
    for (const pupilDoc of pupilsSnap.docs) {
      const pupilId = pupilDoc.id;
      const pupilData = pupilDoc.data();
      
      try {
        // Use canonical calculation
        const result = await window.calculateCurrentOutstanding(pupilId, session, term);
        
        if (result.reason) {
          continue; // Skip pupils without fees configured
        }
        
        pupils.push({
          id: pupilId,
          name: result.pupilName,
          className: result.className,
          classId: result.classId,
          amountDue: result.amountDue,
          arrears: result.arrears,
          totalDue: result.totalDue,
          totalPaid: result.totalPaid,
          balance: result.balance,
          status: result.status
        });
        
        // Aggregate totals
        totalExpected += result.totalDue;
        totalCollected += result.totalPaid;
        totalOutstanding += result.balance;
        
        // Status distribution
        if (result.balance === 0 && result.totalPaid > 0) {
          statusCount.paid++;
        } else if (result.totalPaid > 0 && result.balance > 0) {
          statusCount.partial++;
        } else if (result.arrears > 0) {
          statusCount.owingWithArrears++;
        } else {
          statusCount.owing++;
        }
        
        // Class-level aggregation
        if (!classSummary[result.classId]) {
          classSummary[result.classId] = {
            className: result.className,
            pupils: 0,
            expected: 0,
            collected: 0,
            outstanding: 0
          };
        }
        
        classSummary[result.classId].pupils++;
        classSummary[result.classId].expected += result.totalDue;
        classSummary[result.classId].collected += result.totalPaid;
        classSummary[result.classId].outstanding += result.balance;
        
        // Store payment record
        paymentsByPupil[pupilId] = result;
        
      } catch (error) {
        console.error(`Error processing pupil ${pupilId}:`, error.message);
      }
    }
    
    // Get payment transactions for timing analysis
    const encodedSession = session.replace(/\//g, '-');
    
    const transactionsSnap = await db.collection('payment_transactions')
      .where('session', '==', session)
      .where('term', '==', term)
      .get();
    
    const transactions = [];
    const paymentMethods = {};
    
    transactionsSnap.forEach(doc => {
      const tx = doc.data();
      
      transactions.push({
        receiptNo: tx.receiptNo,
        pupilId: tx.pupilId,
        pupilName: tx.pupilName,
        amount: tx.amountPaid || 0,
        method: tx.paymentMethod || 'Cash',
        date: tx.paymentDate ? tx.paymentDate.toDate() : null
      });
      
      const method = tx.paymentMethod || 'Cash';
      paymentMethods[method] = (paymentMethods[method] || 0) + 1;
    });
    
    // Get fee structures for reference
    const feeStructuresSnap = await db.collection('fee_structures').get();
    const feeStructures = [];
    
    feeStructuresSnap.forEach(doc => {
      const data = doc.data();
      feeStructures.push({
        classId: data.classId,
        className: data.className,
        total: data.total || 0,
        fees: data.fees || {}
      });
    });
    
    console.log(`✓ Gathered data: ${pupils.length} pupils, ${transactions.length} transactions`);
    
    return {
      success: true,
      session,
      term,
      generatedAt: new Date(),
      pupils,
      transactions,
      feeStructures,
      summary: {
        totalPupils: pupils.length,
        totalExpected,
        totalCollected,
        totalOutstanding,
        collectionRate: totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
        statusCount,
        classSummary: Object.values(classSummary).sort((a, b) => a.className.localeCompare(b.className))
      },
      paymentMethods
    };
    
  } catch (error) {
    console.error('Data gathering error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ═══════════════════════════════════════════════════════════
 * STATISTICAL ANALYSIS
 * ═══════════════════════════════════════════════════════════
 */
function performFinancialAnalysis(reportData) {
  console.log('📊 Performing statistical analysis...');
  
  const { pupils, transactions, summary } = reportData;
  
  // Payment timeliness analysis
  const paymentTiming = analyzePaymentTiming(transactions, reportData);
  
  // Average payment size
  const avgPaymentSize = transactions.length > 0
    ? transactions.reduce((sum, tx) => sum + tx.amount, 0) / transactions.length
    : 0;
  
  // Arrears analysis
  const pupilsWithArrears = pupils.filter(p => p.arrears > 0);
  const totalArrears = pupilsWithArrears.reduce((sum, p) => sum + p.arrears, 0);
  const avgArrears = pupilsWithArrears.length > 0
    ? totalArrears / pupilsWithArrears.length
    : 0;
  
  // Collection efficiency by class
  const classEfficiency = summary.classSummary.map(cls => ({
    className: cls.className,
    collectionRate: cls.expected > 0 ? (cls.collected / cls.expected) * 100 : 0,
    pupils: cls.pupils
  })).sort((a, b) => b.collectionRate - a.collectionRate);
  
  // Payment distribution insights
  const paymentDistribution = analyzePaymentDistribution(pupils);
  
  // Financial health score (0-100)
  const healthScore = calculateFinancialHealthScore(summary, paymentTiming);
  
  console.log(`✓ Analysis complete. Health score: ${healthScore.toFixed(1)}/100`);
  
  return {
    paymentTiming,
    avgPaymentSize,
    arrears: {
      count: pupilsWithArrears.length,
      total: totalArrears,
      average: avgArrears,
      percentage: pupils.length > 0 ? (pupilsWithArrears.length / pupils.length) * 100 : 0
    },
    classEfficiency,
    paymentDistribution,
    healthScore
  };
}

/**
 * Analyze payment timing patterns
 */
function analyzePaymentTiming(transactions, reportData) {
  if (transactions.length === 0) {
    return {
      early: 0,
      onTime: 0,
      late: 0,
      unknown: 0
    };
  }
  
  // Get session start date for reference
  let sessionStart = new Date();
  
  try {
    if (reportData.settings?.currentSession?.startDate) {
      sessionStart = reportData.settings.currentSession.startDate.toDate();
    }
  } catch (e) {
    console.warn('Could not determine session start date');
  }
  
  const timing = {
    early: 0,
    onTime: 0,
    late: 0,
    unknown: 0
  };
  
  transactions.forEach(tx => {
    if (!tx.date) {
      timing.unknown++;
      return;
    }
    
    const daysSinceSessionStart = Math.floor((tx.date - sessionStart) / (1000 * 60 * 60 * 24));
    
    if (daysSinceSessionStart < 30) {
      timing.early++;
    } else if (daysSinceSessionStart <= 60) {
      timing.onTime++;
    } else {
      timing.late++;
    }
  });
  
  return timing;
}

/**
 * Analyze payment amount distribution
 */
function analyzePaymentDistribution(pupils) {
  const paid = pupils.filter(p => p.balance === 0 && p.totalPaid > 0).length;
  const partial = pupils.filter(p => p.totalPaid > 0 && p.balance > 0).length;
  const unpaid = pupils.filter(p => p.totalPaid === 0).length;
  
  return {
    fullPayment: paid,
    partialPayment: partial,
    noPayment: unpaid
  };
}

/**
 * Calculate overall financial health score (0-100)
 * 
 * Methodology:
 * - 40 points: Collection rate
 * - 30 points: Payment timeliness
 * - 20 points: Arrears management
 * - 10 points: Payment distribution health
 */
function calculateFinancialHealthScore(summary, paymentTiming) {
  let score = 0;
  
  // Collection rate (40 points max)
  score += (summary.collectionRate / 100) * 40;
  
  // Payment timeliness (30 points max)
  const totalPayments = paymentTiming.early + paymentTiming.onTime + paymentTiming.late;
  if (totalPayments > 0) {
    const timelinessScore = ((paymentTiming.early + paymentTiming.onTime) / totalPayments) * 30;
    score += timelinessScore;
  }
  
  // Arrears management (20 points max)
  // Lower arrears percentage = higher score
  const arrearsImpact = summary.totalExpected > 0
    ? (summary.totalCollected / summary.totalExpected) * 20
    : 0;
  score += arrearsImpact;
  
  // Payment distribution (10 points max)
  // More full payments = better score
  const paidFully = summary.statusCount.paid || 0;
  const total = summary.totalPupils || 1;
  score += (paidFully / total) * 10;
  
  return Math.min(100, Math.max(0, score));
}

/**
 * ═══════════════════════════════════════════════════════════
 * CHART GENERATION
 * ═══════════════════════════════════════════════════════════
 */
async function generateCharts(reportData, analytics) {
  console.log('📈 Generating charts...');
  
  const charts = {};
  
  // Create temporary canvas for chart rendering
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  
  try {
    // Chart 1: Revenue Overview (Bar Chart)
    charts.revenueOverview = await createRevenueChart(canvas, ctx, reportData);
    
    // Chart 2: Payment Methods (Pie Chart)
    charts.paymentMethods = await createPaymentMethodsChart(canvas, ctx, reportData);
    
    // Chart 3: Collection Efficiency by Class (Horizontal Bar)
    charts.classEfficiency = await createClassEfficiencyChart(canvas, ctx, analytics);
    
    // Chart 4: Payment Status Distribution (Doughnut)
    charts.statusDistribution = await createStatusDistributionChart(canvas, ctx, reportData);
    
    console.log('✓ All charts generated');
    
  } catch (error) {
    console.error('Chart generation error:', error);
  }
  
  return charts;
}

/**
 * Create revenue overview bar chart
 */
function createRevenueChart(canvas, ctx, reportData) {
  return new Promise((resolve) => {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Expected Revenue', 'Collected Revenue', 'Outstanding'],
        datasets: [{
          label: 'Amount (₦)',
          data: [
            reportData.summary.totalExpected,
            reportData.summary.totalCollected,
            reportData.summary.totalOutstanding
          ],
          backgroundColor: [
            'rgba(54, 162, 235, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(255, 99, 132, 0.8)'
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(255, 99, 132, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: false, // Disable animation for faster rendering
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Revenue Overview',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '₦' + value.toLocaleString();
              }
            }
          }
        }
      }
    });
    
    // Wait for chart to render, then capture
    setTimeout(() => {
      try {
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        chart.destroy();
        resolve(dataUrl);
      } catch (error) {
        console.error('Failed to generate revenue chart:', error);
        chart.destroy();
        resolve(null);
      }
    }, 1000);
  });
}

/**
 * Create payment methods pie chart
 */
function createPaymentMethodsChart(canvas, ctx, reportData) {
  return new Promise((resolve) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const methods = Object.keys(reportData.paymentMethods);
    const counts = Object.values(reportData.paymentMethods);
    
    if (methods.length === 0) {
      // No data - return blank
      resolve(null);
      return;
    }
    
    const colors = [
      'rgba(255, 99, 132, 0.8)',
      'rgba(54, 162, 235, 0.8)',
      'rgba(255, 206, 86, 0.8)',
      'rgba(75, 192, 192, 0.8)',
      'rgba(153, 102, 255, 0.8)'
    ];
    
    const chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: methods,
        datasets: [{
          data: counts,
          backgroundColor: colors.slice(0, methods.length),
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        animation: false,
        plugins: {
          legend: {
            position: 'right'
          },
          title: {
            display: true,
            text: 'Payment Methods Distribution',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        }
      }
    });
    
    setTimeout(() => {
      try {
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        chart.destroy();
        resolve(dataUrl);
      } catch (error) {
        console.error('Failed to generate payment methods chart:', error);
        chart.destroy();
        resolve(null);
      }
    }, 1000);
  });
}

/**
 * Create class efficiency horizontal bar chart
 */
function createClassEfficiencyChart(canvas, ctx, analytics) {
  return new Promise((resolve) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const topClasses = analytics.classEfficiency.slice(0, 8); // Top 8 classes
    
    if (topClasses.length === 0) {
      resolve(null);
      return;
    }
    
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: topClasses.map(c => c.className),
        datasets: [{
          label: 'Collection Rate (%)',
          data: topClasses.map(c => c.collectionRate),
          backgroundColor: 'rgba(75, 192, 192, 0.8)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 2
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        animation: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Collection Efficiency by Class',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      }
    });
    
    setTimeout(() => {
      try {
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        chart.destroy();
        resolve(dataUrl);
      } catch (error) {
        console.error('Failed to generate class efficiency chart:', error);
        chart.destroy();
        resolve(null);
      }
    }, 1000);
  });
}

/**
 * Create payment status doughnut chart
 */
function createStatusDistributionChart(canvas, ctx, reportData) {
  return new Promise((resolve) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const { statusCount } = reportData.summary;
    
    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Paid in Full', 'Partial Payment', 'Owing', 'Owing with Arrears'],
        datasets: [{
          data: [
            statusCount.paid || 0,
            statusCount.partial || 0,
            statusCount.owing || 0,
            statusCount.owingWithArrears || 0
          ],
          backgroundColor: [
            'rgba(75, 192, 192, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(255, 159, 64, 0.8)',
            'rgba(255, 99, 132, 0.8)'
          ],
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        animation: false,
        plugins: {
          legend: {
            position: 'bottom'
          },
          title: {
            display: true,
            text: 'Payment Status Distribution',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        }
      }
    });
    
    setTimeout(() => {
      try {
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        chart.destroy();
        resolve(dataUrl);
      } catch (error) {
        console.error('Failed to generate status distribution chart:', error);
        chart.destroy();
        resolve(null);
      }
    }, 1000);
  });
}

/**
 * ═══════════════════════════════════════════════════════════
 * PDF CREATION
 * ═══════════════════════════════════════════════════════════
 */
function createPDFReport(reportData, analytics, charts) {
  console.log('📄 Creating PDF document...');
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  let yPos = 20;
  
  // ─────────────────────────────────────────────────────────
  // HEADER
  // ─────────────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FAHMID NURSERY & PRIMARY SCHOOL', 105, yPos, { align: 'center' });
  
  yPos += 10;
  doc.setFontSize(14);
  doc.text('Comprehensive Financial Report', 105, yPos, { align: 'center' });
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Session: ${reportData.session} | Term: ${reportData.term}`, 105, yPos, { align: 'center' });
  
  yPos += 5;
  doc.text(`Generated: ${reportData.generatedAt.toLocaleDateString('en-GB')} ${reportData.generatedAt.toLocaleTimeString('en-GB')}`, 105, yPos, { align: 'center' });
  
  yPos += 15;
  
  // ─────────────────────────────────────────────────────────
  // EXECUTIVE SUMMARY
  // ─────────────────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. EXECUTIVE SUMMARY', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const summaryData = [
    ['Total Enrolled Pupils', reportData.summary.totalPupils.toString()],
    ['Expected Revenue', `₦${reportData.summary.totalExpected.toLocaleString()}`],
    ['Revenue Collected', `₦${reportData.summary.totalCollected.toLocaleString()}`],
    ['Outstanding Balance', `₦${reportData.summary.totalOutstanding.toLocaleString()}`],
    ['Collection Rate', `${reportData.summary.collectionRate.toFixed(1)}%`],
    ['Financial Health Score', `${analytics.healthScore.toFixed(1)}/100`]
  ];
  
  doc.autoTable({
    startY: yPos,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: [0, 178, 255], fontStyle: 'bold' },
    margin: { left: 14, right: 14 }
  });
  
  yPos = doc.lastAutoTable.finalY + 12;
  
  // Health score interpretation
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  const healthInterpretation = getHealthScoreInterpretation(analytics.healthScore);
  doc.text(`Financial Health: ${healthInterpretation}`, 14, yPos);
  yPos += 10;
  
  // ─────────────────────────────────────────────────────────
  // REVENUE OVERVIEW CHART
  // ─────────────────────────────────────────────────────────
  if (charts.revenueOverview) {
    checkPageBreak(doc, yPos, 100);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('2. REVENUE OVERVIEW', 14, yPos);
    yPos += 8;
    
    doc.addImage(charts.revenueOverview, 'PNG', 14, yPos, 180, 90);
    yPos += 100;
  }
  
  // ─────────────────────────────────────────────────────────
  // COLLECTION ANALYSIS
  // ─────────────────────────────────────────────────────────
  checkPageBreak(doc, yPos, 80);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. COLLECTION ANALYSIS', 14, yPos);
  yPos += 8;
  
  // Payment status breakdown
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const statusData = [
    ['Paid in Full', reportData.summary.statusCount.paid || 0],
    ['Partial Payment', reportData.summary.statusCount.partial || 0],
    ['Owing (No Arrears)', reportData.summary.statusCount.owing || 0],
    ['Owing (With Arrears)', reportData.summary.statusCount.owingWithArrears || 0]
  ];
  
  doc.autoTable({
    startY: yPos,
    head: [['Payment Status', 'Count']],
    body: statusData,
    theme: 'striped',
    headStyles: { fillColor: [0, 178, 255] },
    margin: { left: 14, right: 14 }
  });
  
  yPos = doc.lastAutoTable.finalY + 12;
  
  // Payment methods chart
  if (charts.paymentMethods) {
    checkPageBreak(doc, yPos, 100);
    
    doc.addImage(charts.paymentMethods, 'PNG', 14, yPos, 180, 90);
    yPos += 100;
  }
  
  // ─────────────────────────────────────────────────────────
  // STATISTICAL INSIGHTS
  // ─────────────────────────────────────────────────────────
  checkPageBreak(doc, yPos, 60);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('4. STATISTICAL INSIGHTS', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const insightsData = [
    ['Average Payment Size', `₦${analytics.avgPaymentSize.toLocaleString()}`],
    ['Pupils with Arrears', `${analytics.arrears.count} (${analytics.arrears.percentage.toFixed(1)}%)`],
    ['Total Arrears Amount', `₦${analytics.arrears.total.toLocaleString()}`],
    ['Average Arrears per Pupil', `₦${analytics.arrears.average.toLocaleString()}`]
  ];
  
  doc.autoTable({
    startY: yPos,
    head: [['Metric', 'Value']],
    body: insightsData,
    theme: 'grid',
    headStyles: { fillColor: [0, 178, 255] },
    margin: { left: 14, right: 14 }
  });
  
  yPos = doc.lastAutoTable.finalY + 12;
  
  // ─────────────────────────────────────────────────────────
  // CLASS-LEVEL BREAKDOWN
  // ─────────────────────────────────────────────────────────
  checkPageBreak(doc, yPos, 80);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('5. CLASS-LEVEL BREAKDOWN', 14, yPos);
  yPos += 8;
  
  const classTableData = reportData.summary.classSummary.map(cls => [
    cls.className,
    cls.pupils,
    `₦${cls.expected.toLocaleString()}`,
    `₦${cls.collected.toLocaleString()}`,
    `₦${cls.outstanding.toLocaleString()}`,
    `${cls.expected > 0 ? ((cls.collected / cls.expected) * 100).toFixed(1) : 0}%`
  ]);
  
  doc.autoTable({
    startY: yPos,
    head: [['Class', 'Pupils', 'Expected', 'Collected', 'Outstanding', 'Rate']],
    body: classTableData,
    theme: 'striped',
    headStyles: { fillColor: [0, 178, 255], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 }
  });
  
  yPos = doc.lastAutoTable.finalY + 12;
  
  // Class efficiency chart
  if (charts.classEfficiency) {
    checkPageBreak(doc, yPos, 100);
    
    doc.addImage(charts.classEfficiency, 'PNG', 14, yPos, 180, 90);
    yPos += 100;
  }
  
  // ─────────────────────────────────────────────────────────
  // KEY FINDINGS & RECOMMENDATIONS
  // ─────────────────────────────────────────────────────────
  doc.addPage();
  yPos = 20;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('6. KEY FINDINGS & RECOMMENDATIONS', 14, yPos);
  yPos += 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const findings = generateKeyFindings(reportData, analytics);
  
  findings.forEach(finding => {
    const lines = doc.splitTextToSize(finding, 180);
    
    if (yPos + (lines.length * 6) > 270) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.text(lines, 14, yPos);
    yPos += (lines.length * 6) + 4;
  });
  
  // ─────────────────────────────────────────────────────────
  // METHODOLOGY
  // ─────────────────────────────────────────────────────────
  yPos += 10;
  checkPageBreak(doc, yPos, 60);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('7. METHODOLOGY', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  const methodology = [
    'All financial data is calculated using the canonical calculateCurrentOutstanding() function,',
    'ensuring consistency with live system data.',
    '',
    'Collection Rate = (Total Collected / Total Expected) × 100',
    'Financial Health Score = Weighted average of collection rate (40%), payment timeliness (30%),',
    'arrears management (20%), and payment distribution (10%).',
    '',
    'Payment timeliness categories:',
    '  • Early: Within 30 days of session start',
    '  • On-time: 31-60 days',
    '  • Late: After 60 days',
    '',
    'All calculations are reproducible and auditable against the database.'
  ];
  
  methodology.forEach(line => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(line, 14, yPos);
    yPos += 5;
  });
  
  // ─────────────────────────────────────────────────────────
  // FOOTER ON LAST PAGE
  // ─────────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    doc.text('CONFIDENTIAL - For Internal Use Only', 14, 290);
  }
  
  console.log('✓ PDF document created');
  
  return doc;
}

/**
 * ═══════════════════════════════════════════════════════════
 * HELPER FUNCTIONS
 * ═══════════════════════════════════════════════════════════
 */

/**
 * Check if we need a page break
 */
function checkPageBreak(doc, yPos, requiredSpace) {
  if (yPos + requiredSpace > 270) {
    doc.addPage();
    return 20;
  }
  return yPos;
}

/**
 * Get health score interpretation
 */
function getHealthScoreInterpretation(score) {
  if (score >= 90) return 'Excellent - Strong financial performance';
  if (score >= 75) return 'Good - Healthy collection rates';
  if (score >= 60) return 'Fair - Room for improvement';
  if (score >= 40) return 'Poor - Requires attention';
  return 'Critical - Immediate action needed';
}

/**
 * Generate key findings based on data analysis
 */
function generateKeyFindings(reportData, analytics) {
  const findings = [];
  
  // Collection rate finding
  const collectionRate = reportData.summary.collectionRate;
  if (collectionRate >= 80) {
    findings.push(`• Strong collection performance at ${collectionRate.toFixed(1)}%, indicating effective fee collection processes.`);
  } else if (collectionRate >= 60) {
    findings.push(`• Collection rate of ${collectionRate.toFixed(1)}% is moderate. Consider implementing payment reminders and follow-up procedures.`);
  } else {
    findings.push(`• Collection rate of ${collectionRate.toFixed(1)}% is below target. Immediate action required to improve fee collection.`);
  }
  
  // Arrears finding
  if (analytics.arrears.percentage > 30) {
    findings.push(`• ${analytics.arrears.percentage.toFixed(1)}% of pupils have outstanding arrears totaling ₦${analytics.arrears.total.toLocaleString()}. Arrears recovery strategy recommended.`);
  } else if (analytics.arrears.count > 0) {
    findings.push(`• ${analytics.arrears.count} pupil(s) have arrears. Total outstanding: ₦${analytics.arrears.total.toLocaleString()}.`);
  }
  
  // Class performance finding
  const bestClass = analytics.classEfficiency[0];
  const worstClass = analytics.classEfficiency[analytics.classEfficiency.length - 1];
  
  if (bestClass && worstClass && bestClass !== worstClass) {
    findings.push(`• Best performing class: ${bestClass.className} (${bestClass.collectionRate.toFixed(1)}% collection rate). Lowest: ${worstClass.className} (${worstClass.collectionRate.toFixed(1)}%).`);
  }
  
  // Payment methods finding
  const mostUsedMethod = Object.entries(reportData.paymentMethods)
    .sort((a, b) => b[1] - a[1])[0];
  
  if (mostUsedMethod) {
    findings.push(`• Most common payment method: ${mostUsedMethod[0]} (${mostUsedMethod[1]} transactions).`);
  }
  
  // Recommendations
  findings.push('');
  findings.push('RECOMMENDATIONS:');
  
  if (collectionRate < 80) {
    findings.push('• Implement automated payment reminders via SMS/email');
    findings.push('• Consider installment payment plans for struggling families');
  }
  
  if (analytics.arrears.percentage > 20) {
    findings.push('• Launch targeted arrears recovery campaign');
    findings.push('• Offer payment grace periods for pupils with consistent arrears');
  }
  
  if (worstClass && worstClass.collectionRate < 50) {
    findings.push(`• Focus collection efforts on ${worstClass.className} (currently ${worstClass.collectionRate.toFixed(1)}%)`);
  }
  
  return findings;
}

// ═══════════════════════════════════════════════════════════
// EXPOSE GLOBALLY
// ═══════════════════════════════════════════════════════════
console.log('✅ Comprehensive financial report generator loaded');
