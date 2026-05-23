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
      { wch: 6 },   // S/N
      { wch: 25 },  // Full Name
      { wch: 15 },  // Admission No
      { wch: 12 },  // Date of Birth
      { wch: 10 },  // Gender
      { wch: 20 },  // Class
      { wch: 25 },  // Assigned Teacher
      { wch: 25 },  // Parent Name
      { wch: 30 },  // Parent Email
      { wch: 18 },  // Contact
      { wch: 35 }   // Address
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
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // ── Header ──────────────────────────────────────────────────────────────
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
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Generated: ${dateStr}`, pageWidth / 2, 29, { align: 'center' });
    
    // ── Build table data ─────────────────────────────────────────────────────
    const tableData = [];
    let serialNumber = 1;
    
    pupilsSnapshot.forEach(docSnap => {
      const pupil = docSnap.data();
      
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
      
      tableData.push([
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
    
    // ── Draw table ───────────────────────────────────────────────────────────
    // The "Full Name" header is split into two lines using autoTable's
    // didDrawCell hook so we can render the italic subtitle in a different
    // style without a separate sub-header row (which would break row shading).
    doc.autoTable({
      head: [[
        'S/N',
        'Full Name',       // italic note added via didDrawCell below
        'Admission No',
        'DOB',
        'Gender',
        'Class',
        'Teacher',
        'Parent Name',
        'Parent Email',
        'Contact',
        'Address'
      ]],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: {
        fillColor: [33, 150, 243],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        // Extra height so the italic subtitle fits comfortably
        minCellHeight: 14
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 2
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      columnStyles: {
        0:  { halign: 'center', cellWidth: 10 },  // S/N
        1:  { cellWidth: 32 },                     // Full Name
        2:  { halign: 'center', cellWidth: 20 },   // Admission No
        3:  { halign: 'center', cellWidth: 18 },   // DOB
        4:  { halign: 'center', cellWidth: 15 },   // Gender
        5:  { cellWidth: 22 },                     // Class
        6:  { cellWidth: 28 },                     // Teacher
        7:  { cellWidth: 28 },                     // Parent Name
        8:  { cellWidth: 33 },                     // Parent Email
        9:  { cellWidth: 22 },                     // Contact
        10: { cellWidth: 32 }                      // Address
      },
      margin: { left: 8, right: 8 },
      showHead: 'everyPage',

      // ── Custom cell drawing for the "Full Name" header ───────────────────
      didDrawCell: function (data) {
        // Only target the header row, column index 1 (Full Name)
        if (data.section !== 'head' || data.column.index !== 1) return;

        const cell = data.cell;

        // Draw the italic subtitle below the bold header text
        doc.setFontSize(6.5);
        doc.setFont(undefined, 'italic');
        doc.setTextColor(220, 235, 255); // light blue-white so it reads on the blue bg

        doc.text(
          '(first name first)',
          cell.x + cell.width / 2,          // horizontally centred in cell
          cell.y + cell.height - 3,          // near the bottom of the header cell
          { align: 'center' }
        );

        // Reset font so autoTable internals are not affected
        doc.setFont(undefined, 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
      }
    });
    
    // ── Total count below table on final page ────────────────────────────────
    const finalY = doc.lastAutoTable.finalY || 35;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(33, 150, 243);
    doc.text(
      `Total Pupils: ${tableData.length}`,
      15,
      finalY + 10
    );
    
    // ── Page footers — added AFTER table so total page count is known ────────
    const totalPages = doc.internal.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(150, 150, 150);
      
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      
      doc.setFontSize(8);
      doc.text(
        'Fahmid Nursery & Primary School - Confidential Document',
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      );
    }
    
    // ── Save ─────────────────────────────────────────────────────────────────
    const filename = `Fahmid_Pupils_Data_${today.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    window.showToast?.(
      `✓ PDF file exported successfully!\nFile: ${filename}`,
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
window.exportPupilsToPDF = exportPupilsToPDF;

console.log('✓ Pupils export module loaded');
