/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Pupils Data Export Module
 * Handles Excel and PDF exports with beautiful formatting
 */

'use strict';

/* ======================================== 
   EXCEL EXPORT USING SHEETJS
======================================== */

async function exportPupilsToExcel() {
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-loading">Generating Excel...</span>';
  }
  
  try {
    window.showToast?.('Preparing Excel export...', 'info', 3000);
    
    const pupilsSnapshot = await window.db.collection('pupils')
      .orderBy('name')
      .get();
    
    if (pupilsSnapshot.empty) {
      window.showToast?.('No pupils data to export', 'warning');
      return;
    }
    
    const excelData = [];
    
    // Main header row
    excelData.push([
      'S/N',
      'Full Name',
      'Admission No',
      'Date of Birth',
      'Gender',
      'Class',
      'Assigned Teacher',
      'Parent/Guardian Name',
      'Parent Email',
      'Contact Number',
      'Address'
    ]);

    // Sub-header row with italic note under Full Name
    excelData.push([
      '',
      '(First name first)',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ]);
    
    let serialNumber = 1;
    pupilsSnapshot.forEach(doc => {
      const pupil = doc.data();
      
      let className = '-';
      if (pupil.class) {
        if (typeof pupil.class === 'object' && pupil.class.name) {
          className = pupil.class.name;
        } else if (typeof pupil.class === 'string') {
          className = pupil.class;
        }
      }
      
      let teacherName = '-';
      if (pupil.assignedTeacher) {
        if (typeof pupil.assignedTeacher === 'object' && pupil.assignedTeacher.name) {
          teacherName = pupil.assignedTeacher.name;
        } else if (typeof pupil.assignedTeacher === 'string') {
          teacherName = pupil.assignedTeacher;
        }
      }
      
      let dob = '-';
      if (pupil.dob) {
        try {
          dob = new Date(pupil.dob).toLocaleDateString('en-GB');
        } catch (e) {
          dob = pupil.dob;
        }
      }
      
      excelData.push([
        serialNumber++,
        pupil.name || '-',
        pupil.admissionNo || '-',
        dob,
        pupil.gender || '-',
        className,
        teacherName,
        pupil.parentName || '-',
        pupil.parentEmail || '-',
        pupil.contact || '-',
        pupil.address || '-'
      ]);
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Style the sub-header cell (row index 1, col index 1 = B2) as italic grey
    const subHeaderCellRef = XLSX.utils.encode_cell({ r: 1, c: 1 });
    if (!ws[subHeaderCellRef]) ws[subHeaderCellRef] = { v: '(First name first)', t: 's' };
    ws[subHeaderCellRef].s = {
      font: { italic: true, color: { rgb: '888888' }, sz: 9 },
      alignment: { horizontal: 'left' }
    };
    
    ws['!cols'] = [
      { wch: 6 },
      { wch: 25 },
      { wch: 15 },
      { wch: 12 },
      { wch: 10 },
      { wch: 20 },
      { wch: 25 },
      { wch: 25 },
      { wch: 30 },
      { wch: 18 },
      { wch: 35 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Pupils Data');
    
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const filename = `Fahmid_Pupils_Data_${dateStr}.xlsx`;
    
    XLSX.writeFile(wb, filename);
    
    window.showToast?.(
      `✓ Excel file exported successfully!\nFile: ${filename}`,
      'success',
      5000
    );
    
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    window.handleError?.(error, 'Failed to export Excel file');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '📊 Export to Excel';
    }
  }
}

/* ======================================== 
   PDF EXPORT USING JSPDF & AUTOTABLE
======================================== */

/* ── Analysis helpers ────────────────────────────────────────────────────── */

/**
 * Build all analysis objects from the raw pupils snapshot.
 * Kept pure (no PDF calls) so it is easy to test or reuse.
 */
function buildAnalysis(pupilsSnapshot) {
  const today = new Date();

  // Accumulators
  const classCounts   = {};   // className -> { total, male, female, other }
  const teacherCounts = {};   // teacherName -> pupil count
  let   totalMale     = 0;
  let   totalFemale   = 0;
  let   totalOther    = 0;
  let   missingEmail  = 0;
  let   missingPhone  = 0;
  let   missingBoth   = 0;
  let   missingDob    = 0;

  // Age bands relevant to nursery/primary (years)
  const ageBands = {
    'Under 3':  0,
    '3 – 5':    0,
    '6 – 8':    0,
    '9 – 11':   0,
    '12 – 14':  0,
    '15+':      0,
    'Unknown':  0
  };

  pupilsSnapshot.forEach(doc => {
    const p = doc.data();

    // ── Class ──────────────────────────────────────────────────────────────
    let className = 'Unassigned';
    if (p.class) {
      if (typeof p.class === 'object' && p.class.name) className = p.class.name;
      else if (typeof p.class === 'string')             className = p.class;
    }
    if (!classCounts[className]) {
      classCounts[className] = { total: 0, male: 0, female: 0, other: 0 };
    }
    classCounts[className].total++;

    // ── Gender ─────────────────────────────────────────────────────────────
    const gender = (p.gender || '').toLowerCase();
    if (gender === 'male') {
      totalMale++;
      classCounts[className].male++;
    } else if (gender === 'female') {
      totalFemale++;
      classCounts[className].female++;
    } else {
      totalOther++;
      classCounts[className].other++;
    }

    // ── Teacher ────────────────────────────────────────────────────────────
    let teacherName = 'Unassigned';
    if (p.assignedTeacher) {
      if (typeof p.assignedTeacher === 'object' && p.assignedTeacher.name)
        teacherName = p.assignedTeacher.name;
      else if (typeof p.assignedTeacher === 'string' && p.assignedTeacher.trim())
        teacherName = p.assignedTeacher;
    }
    teacherCounts[teacherName] = (teacherCounts[teacherName] || 0) + 1;

    // ── Contact completeness ───────────────────────────────────────────────
    const noEmail = !p.parentEmail || !p.parentEmail.trim();
    const noPhone = !p.contact     || !p.contact.trim();
    if (noEmail) missingEmail++;
    if (noPhone) missingPhone++;
    if (noEmail && noPhone) missingBoth++;

    // ── DOB / Age ──────────────────────────────────────────────────────────
    if (!p.dob) {
      missingDob++;
      ageBands['Unknown']++;
    } else {
      try {
        const birth = new Date(p.dob);
        // Age in completed years
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

        if      (age < 3)  ageBands['Under 3']++;
        else if (age <= 5) ageBands['3 – 5']++;
        else if (age <= 8) ageBands['6 – 8']++;
        else if (age <= 11) ageBands['9 – 11']++;
        else if (age <= 14) ageBands['12 – 14']++;
        else if (age >= 15) ageBands['15+']++;
        else                ageBands['Unknown']++;
      } catch (e) {
        missingDob++;
        ageBands['Unknown']++;
      }
    }
  });

  const total = pupilsSnapshot.size;

  return {
    total,
    gender: { male: totalMale, female: totalFemale, other: totalOther },
    classCounts,
    teacherCounts,
    contact: { missingEmail, missingPhone, missingBoth },
    ageBands,
    missingDob
  };
}

/* ── PDF drawing helpers ─────────────────────────────────────────────────── */

/**
 * Draw a section title with a coloured left bar.
 * Returns the new Y position after drawing.
 */
function drawSectionTitle(doc, text, x, y, pageWidth, colour) {
  const barH = 7;
  // Coloured left accent bar
  doc.setFillColor(...colour);
  doc.rect(x, y - 5.5, 3, barH, 'F');
  // Title text
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...colour);
  doc.text(text, x + 5, y);
  // Thin rule to the right of the title
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(x + 5 + doc.getTextWidth(text) + 3, y - 1, pageWidth - x, y - 1);
  doc.setTextColor(30, 30, 30);
  return y + 5;
}

/**
 * Draw a simple horizontal progress bar.
 * filled  : 0–1 fraction
 * colours : [r,g,b] for the filled portion
 */
function drawBar(doc, x, y, w, h, filled, colour) {
  // Background track
  doc.setFillColor(230, 230, 230);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');
  // Filled portion
  if (filled > 0) {
    doc.setFillColor(...colour);
    doc.roundedRect(x, y, Math.max(h, w * filled), h, h / 2, h / 2, 'F');
  }
}

/**
 * Draw the full analysis section on the current page(s).
 * Returns the Y position after all content is drawn.
 */
function drawAnalysis(doc, analysis, startY, pageWidth, pageHeight, margin) {
  const {
    total, gender, classCounts, teacherCounts, contact, ageBands, missingDob
  } = analysis;

  const colW     = (pageWidth - margin * 2 - 8) / 2; // two-column layout
  const col1X    = margin;
  const col2X    = margin + colW + 8;
  const barW     = colW - 60;                          // width available for bars
  const barH     = 3.5;
  const lineH    = 6;

  // ── Section banner ────────────────────────────────────────────────────────
  doc.setFillColor(33, 150, 243);
  doc.rect(margin, startY, pageWidth - margin * 2, 10, 'F');
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ENROLMENT ANALYSIS', pageWidth / 2, startY + 7, { align: 'center' });

  let y = startY + 16;

  // ════════════════════════════════════════════════════════════════════════
  // ROW 1 — Gender summary (col 1) | Contact completeness (col 2)
  // ════════════════════════════════════════════════════════════════════════

  // ── Col 1: Gender breakdown ───────────────────────────────────────────────
  let c1y = y;
  c1y = drawSectionTitle(doc, 'GENDER BREAKDOWN', col1X, c1y, col1X + colW, [33, 150, 243]);

  const genderRows = [
    { label: 'Male',            count: gender.male,   colour: [33, 150, 243] },
    { label: 'Female',          count: gender.female, colour: [233, 30, 99]  },
    { label: 'Not specified',   count: gender.other,  colour: [158, 158, 158] }
  ];

  genderRows.forEach(row => {
    const pct     = total > 0 ? row.count / total : 0;
    const pctText = `${row.count} (${(pct * 100).toFixed(1)}%)`;

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(row.label, col1X + 2, c1y + 3.5);

    drawBar(doc, col1X + 38, c1y + 0.5, barW, barH, pct, row.colour);

    doc.setFontSize(7.5);
    doc.setTextColor(...row.colour);
    doc.text(pctText, col1X + 40 + barW, c1y + 3.5, { align: 'left' });

    c1y += lineH;
  });

  // Totals line
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(33, 150, 243);
  doc.text(`Total enrolled: ${total}`, col1X + 2, c1y + 2);
  c1y += lineH;

  // ── Col 2: Contact completeness ───────────────────────────────────────────
  let c2y = y;
  c2y = drawSectionTitle(doc, 'CONTACT RECORD COMPLETENESS', col2X, c2y, col2X + colW, [76, 175, 80]);

  const contactRows = [
    {
      label:   'Email on file',
      count:   total - contact.missingEmail,
      missing: contact.missingEmail,
      colour:  [76, 175, 80]
    },
    {
      label:   'Phone on file',
      count:   total - contact.missingPhone,
      missing: contact.missingPhone,
      colour:  [76, 175, 80]
    }
  ];

  contactRows.forEach(row => {
    const pct     = total > 0 ? row.count / total : 0;
    const pctText = `${row.count}/${total}`;

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(row.label, col2X + 2, c2y + 3.5);

    drawBar(doc, col2X + 38, c2y + 0.5, barW, barH, pct, row.colour);

    doc.setFontSize(7.5);
    doc.setTextColor(...row.colour);
    doc.text(pctText, col2X + 40 + barW, c2y + 3.5);

    c2y += lineH;
  });

  // Data quality alert
  if (contact.missingBoth > 0 || missingDob > 0) {
    doc.setFillColor(255, 243, 205);
    doc.rect(col2X, c2y, colW, 10, 'F');
    doc.setDrawColor(255, 193, 7);
    doc.setLineWidth(0.4);
    doc.rect(col2X, c2y, colW, 10, 'S');
    doc.setFontSize(7.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(133, 100, 4);
    doc.text('⚠  Data Quality Flags', col2X + 3, c2y + 4);
    doc.setFont(undefined, 'normal');
    const flags = [];
    if (contact.missingBoth > 0) flags.push(`${contact.missingBoth} pupil(s) missing both email & phone`);
    if (missingDob > 0)          flags.push(`${missingDob} pupil(s) missing date of birth`);
    doc.text(flags.join('   |   '), col2X + 3, c2y + 8.5);
    c2y += 14;
  }

  y = Math.max(c1y, c2y) + 6;

  // ════════════════════════════════════════════════════════════════════════
  // ROW 2 — Enrolment by class (full width table)
  // ════════════════════════════════════════════════════════════════════════

  y = drawSectionTitle(doc, 'ENROLMENT BY CLASS', col1X, y, pageWidth - margin, [103, 58, 183]);

  // Sort classes by total descending
  const sortedClasses = Object.entries(classCounts)
    .sort((a, b) => b[1].total - a[1].total);

  // Mini table header
  const classColX   = [col1X + 2, col1X + 60, col1X + 85, col1X + 108, col1X + 135];
  const classHdrY   = y + 1;

  doc.setFillColor(236, 231, 255);
  doc.rect(col1X, y - 1, pageWidth - margin * 2, 7, 'F');

  doc.setFontSize(7.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(103, 58, 183);
  ['Class', 'Total', 'Male', 'Female', '% of School'].forEach((h, i) => {
    doc.text(h, classColX[i], classHdrY + 4);
  });

  y += 8;

  sortedClasses.forEach(([name, counts], idx) => {
    const pct    = total > 0 ? ((counts.total / total) * 100).toFixed(1) : '0.0';
    const barFill = total > 0 ? counts.total / total : 0;
    const rowBg   = idx % 2 === 0 ? [250, 248, 255] : [255, 255, 255];

    doc.setFillColor(...rowBg);
    doc.rect(col1X, y - 1, pageWidth - margin * 2, 6.5, 'F');

    doc.setFontSize(7.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(30, 30, 30);

    doc.text(name,                col1X + 2,   y + 3.5);
    doc.text(String(counts.total),col1X + 60,  y + 3.5);
    doc.text(String(counts.male), col1X + 85,  y + 3.5);
    doc.text(String(counts.female),col1X + 108, y + 3.5);

    // Inline mini bar for % of school
    drawBar(doc, col1X + 135, y + 0.8, 40, 3, barFill, [103, 58, 183]);
    doc.setFontSize(7);
    doc.setTextColor(103, 58, 183);
    doc.text(`${pct}%`, col1X + 178, y + 3.5);

    y += 7;
  });

  y += 4;

  // ════════════════════════════════════════════════════════════════════════
  // ROW 3 — Teacher load (col 1) | Age distribution (col 2)
  // ════════════════════════════════════════════════════════════════════════

  const row3StartY = y;

  // ── Col 1: Teacher pupil load ─────────────────────────────────────────────
  c1y = row3StartY;
  c1y = drawSectionTitle(doc, 'PUPILS PER TEACHER', col1X, c1y, col1X + colW, [255, 87, 34]);

  const sortedTeachers = Object.entries(teacherCounts)
    .sort((a, b) => b[1] - a[1]);

  const maxTeacherCount = sortedTeachers.length > 0 ? sortedTeachers[0][1] : 1;

  sortedTeachers.forEach(([name, count]) => {
    const fill     = maxTeacherCount > 0 ? count / maxTeacherCount : 0;
    const isUnassigned = name === 'Unassigned';
    const barColour   = isUnassigned ? [200, 200, 200] : [255, 87, 34];

    doc.setFontSize(7.5);
    doc.setFont(undefined, isUnassigned ? 'italic' : 'normal');
    doc.setTextColor(isUnassigned ? 150 : 30, isUnassigned ? 150 : 30, isUnassigned ? 150 : 30);

    // Truncate long teacher names
    const displayName = name.length > 22 ? name.substring(0, 20) + '…' : name;
    doc.text(displayName, col1X + 2, c1y + 3.5);

    drawBar(doc, col1X + 48, c1y + 0.5, barW - 10, barH, fill, barColour);

    doc.setFontSize(7.5);
    doc.setTextColor(...barColour);
    doc.text(String(count), col1X + 50 + barW - 10, c1y + 3.5);

    c1y += lineH;
  });

  // ── Col 2: Age distribution ────────────────────────────────────────────────
  c2y = row3StartY;
  c2y = drawSectionTitle(doc, 'AGE DISTRIBUTION', col2X, c2y, col2X + colW, [0, 150, 136]);

  const ageBandEntries = Object.entries(ageBands);
  const maxAgeBand = Math.max(...ageBandEntries.map(e => e[1]), 1);

  ageBandEntries.forEach(([band, count]) => {
    const fill      = count / maxAgeBand;
    const pct       = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
    const isUnknown = band === 'Unknown';
    const barColour = isUnknown ? [200, 200, 200] : [0, 150, 136];

    doc.setFontSize(7.5);
    doc.setFont(undefined, isUnknown ? 'italic' : 'normal');
    doc.setTextColor(isUnknown ? 150 : 30, isUnknown ? 150 : 30, isUnknown ? 150 : 30);
    doc.text(`${band} yrs`, col2X + 2, c2y + 3.5);

    drawBar(doc, col2X + 30, c2y + 0.5, barW, barH, fill, barColour);

    doc.setFontSize(7.5);
    doc.setTextColor(...barColour);
    doc.text(`${count} (${pct}%)`, col2X + 32 + barW, c2y + 3.5);

    c2y += lineH;
  });

  y = Math.max(c1y, c2y) + 4;

  // ── Closing footnote ──────────────────────────────────────────────────────
  doc.setDrawColor(33, 150, 243);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;
  doc.setFontSize(7);
  doc.setFont(undefined, 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Analysis generated from ${total} pupil record(s) as at ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.  ` +
    'Age bands based on date of birth where available.',
    margin,
    y
  );

  return y + 6;
}

/* ── Main PDF export function ────────────────────────────────────────────── */

async function exportPupilsToPDF() {
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-loading">Generating PDF...</span>';
  }
  
  try {
    window.showToast?.('Preparing PDF export...', 'info', 3000);
    
    const pupilsSnapshot = await window.db.collection('pupils')
      .orderBy('name')
      .get();
    
    if (pupilsSnapshot.empty) {
      window.showToast?.('No pupils data to export', 'warning');
      return;
    }

    // Build analysis before drawing anything
    const analysis = buildAnalysis(pupilsSnapshot);
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin     = 8;
    
    // ── Report header (page 1) ───────────────────────────────────────────────
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(33, 150, 243);
    doc.text('FAHMID NURSERY & PRIMARY SCHOOL', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('Pupils Data Report', pageWidth / 2, 23, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    doc.text(`Generated: ${dateStr}`, pageWidth / 2, 29, { align: 'center' });
    
    // ── Build table rows ─────────────────────────────────────────────────────
    const tableData = [];
    let serialNumber = 1;
    
    pupilsSnapshot.forEach(docSnap => {
      const pupil = docSnap.data();
      
      let className = '-';
      if (pupil.class) {
        if (typeof pupil.class === 'object' && pupil.class.name) className = pupil.class.name;
        else if (typeof pupil.class === 'string')                className = pupil.class;
      }
      
      let teacherName = '-';
      if (pupil.assignedTeacher) {
        if (typeof pupil.assignedTeacher === 'object' && pupil.assignedTeacher.name)
          teacherName = pupil.assignedTeacher.name;
        else if (typeof pupil.assignedTeacher === 'string')
          teacherName = pupil.assignedTeacher;
      }
      
      let dob = '-';
      if (pupil.dob) {
        try { dob = new Date(pupil.dob).toLocaleDateString('en-GB'); }
        catch (e) { dob = pupil.dob; }
      }
      
      tableData.push([
        serialNumber++,
        pupil.name         || '-',
        pupil.admissionNo  || '-',
        dob,
        pupil.gender       || '-',
        className,
        teacherName,
        pupil.parentName   || '-',
        pupil.parentEmail  || '-',
        pupil.contact      || '-',
        pupil.address      || '-'
      ]);
    });
    
    // ── Draw pupils table ────────────────────────────────────────────────────
    doc.autoTable({
      head: [[
        'S/N', 'Full Name', 'Admission No', 'DOB', 'Gender',
        'Class', 'Teacher', 'Parent Name', 'Parent Email', 'Contact', 'Address'
      ]],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: {
        fillColor:     [33, 150, 243],
        textColor:     [255, 255, 255],
        fontStyle:     'bold',
        fontSize:      8,
        halign:        'center',
        minCellHeight: 14
      },
      bodyStyles:          { fontSize: 7, cellPadding: 2 },
      alternateRowStyles:  { fillColor: [245, 247, 250] },
      columnStyles: {
        0:  { halign: 'center', cellWidth: 10 },
        1:  { cellWidth: 32 },
        2:  { halign: 'center', cellWidth: 20 },
        3:  { halign: 'center', cellWidth: 18 },
        4:  { halign: 'center', cellWidth: 15 },
        5:  { cellWidth: 22 },
        6:  { cellWidth: 28 },
        7:  { cellWidth: 28 },
        8:  { cellWidth: 33 },
        9:  { cellWidth: 22 },
        10: { cellWidth: 32 }
      },
      margin:    { left: margin, right: margin },
      showHead:  'everyPage',

      didDrawCell: function (data) {
        if (data.section !== 'head' || data.column.index !== 1) return;
        const cell = data.cell;
        doc.setFontSize(6.5);
        doc.setFont(undefined, 'italic');
        doc.setTextColor(220, 235, 255);
        doc.text('(first name first)', cell.x + cell.width / 2, cell.y + cell.height - 3, { align: 'center' });
        doc.setFont(undefined, 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
      }
    });
    
    // ── Total count ──────────────────────────────────────────────────────────
    let currentY = (doc.lastAutoTable.finalY || 35) + 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(33, 150, 243);
    doc.text(`Total Pupils: ${tableData.length}`, margin, currentY);
    currentY += 10;

    // ── Analysis section ─────────────────────────────────────────────────────
    // Estimate space needed (~120mm). If insufficient on current page, add new page.
    const analysisHeight = 125;
    if (currentY + analysisHeight > pageHeight - 18) {
      doc.addPage();
      currentY = 15;
    }

    drawAnalysis(doc, analysis, currentY, pageWidth, pageHeight, margin);
    
    // ── Page footers — stamped after ALL content is drawn ────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.setFontSize(8);
      doc.text('Fahmid Nursery & Primary School - Confidential Document', pageWidth / 2, pageHeight - 5, { align: 'center' });
    }
    
    // ── Save ─────────────────────────────────────────────────────────────────
    const filename = `Fahmid_Pupils_Data_${today.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    window.showToast?.(
      `✓ PDF exported successfully!\nFile: ${filename}`,
      'success',
      5000
    );
    
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    window.handleError?.(error, 'Failed to export PDF file');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '📄 Export to PDF';
    }
  }
}

// Make functions globally available
window.exportPupilsToExcel = exportPupilsToExcel;
window.exportPupilsToPDF   = exportPupilsToPDF;

console.log('✓ Pupils export module loaded');
