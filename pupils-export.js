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
    
    // Fetch all pupils data
    const pupilsSnapshot = await window.db.collection('pupils')
      .orderBy('name')
      .get();
    
    if (pupilsSnapshot.empty) {
      window.showToast?.('No pupils data to export', 'warning');
      return;
    }
    
    // Prepare data for Excel
    const excelData = [];
    
    // Add header row with styling info
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
    
    // Add pupil data rows
    let serialNumber = 1;
    pupilsSnapshot.forEach(doc => {
      const pupil = doc.data();
      
      // Extract class name safely
      let className = '-';
      if (pupil.class) {
        if (typeof pupil.class === 'object' && pupil.class.name) {
          className = pupil.class.name;
        } else if (typeof pupil.class === 'string') {
          className = pupil.class;
        }
      }
      
      // Extract teacher name safely
      let teacherName = '-';
      if (pupil.assignedTeacher) {
        if (typeof pupil.assignedTeacher === 'object' && pupil.assignedTeacher.name) {
          teacherName = pupil.assignedTeacher.name;
        } else if (typeof pupil.assignedTeacher === 'string') {
          teacherName = pupil.assignedTeacher;
        }
      }
      
      // Format date of birth
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
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    
    // Set column widths for better readability
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
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Pupils Data');
    
    // Generate filename with current date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const filename = `Fahmid_Pupils_Data_${dateStr}.xlsx`;
    
    // Download the file
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
    
    // Fetch all pupils data
    const pupilsSnapshot = await window.db.collection('pupils')
      .orderBy('name')
      .get();
    
    if (pupilsSnapshot.empty) {
      window.showToast?.('No pupils data to export', 'warning');
      return;
    }
    
    // Create new PDF document (A4 landscape for better table fit)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    // School header
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(33, 150, 243); // Primary blue color
    doc.text('FAHMID NURSERY & PRIMARY SCHOOL', pageWidth / 2, 15, { align: 'center' });
    
    // Subtitle
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('Pupils Data Report', pageWidth / 2, 23, { align: 'center' });
    
    // Export date
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Generated: ${dateStr}`, pageWidth / 2, 29, { align: 'center' });
    
    // Prepare table data
    const tableData = [];
    let serialNumber = 1;
    
    pupilsSnapshot.forEach(doc => {
      const pupil = doc.data();
      
      // Extract class name safely
      let className = '-';
      if (pupil.class) {
        if (typeof pupil.class === 'object' && pupil.class.name) {
          className = pupil.class.name;
        } else if (typeof pupil.class === 'string') {
          className = pupil.class;
        }
      }
      
      // Extract teacher name safely
      let teacherName = '-';
      if (pupil.assignedTeacher) {
        if (typeof pupil.assignedTeacher === 'object' && pupil.assignedTeacher.name) {
          teacherName = pupil.assignedTeacher.name;
        } else if (typeof pupil.assignedTeacher === 'string') {
          teacherName = pupil.assignedTeacher;
        }
      }
      
      // Format date of birth
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
        pupil.contact || '-'
      ]);
    });
    
    // Generate table with beautiful styling
    doc.autoTable({
      head: [[
        'S/N',
        'Full Name',
        'Admission No',
        'DOB',
        'Gender',
        'Class',
        'Teacher',
        'Parent Name',
        'Parent Email',
        'Contact'
      ]],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: {
        fillColor: [33, 150, 243], // Primary blue
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250] // Light gray for alternate rows
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 }, // S/N
        1: { cellWidth: 35 }, // Full Name
        2: { halign: 'center', cellWidth: 22 }, // Admission No
        3: { halign: 'center', cellWidth: 20 }, // DOB
        4: { halign: 'center', cellWidth: 18 }, // Gender
        5: { cellWidth: 25 }, // Class
        6: { cellWidth: 30 }, // Teacher
        7: { cellWidth: 30 }, // Parent Name
        8: { cellWidth: 35 }, // Parent Email
        9: { cellWidth: 25 }  // Contact
      },
      margin: { left: 10, right: 10 },
      didDrawPage: function(data) {
        // Footer with page numbers
        const pageCount = doc.internal.getNumberOfPages();
        const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
        
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text(
          `Page ${currentPage} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
        
        // School footer
        doc.setFontSize(8);
        doc.text(
          'Fahmid Nursery & Primary School - Confidential Document',
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 5,
          { align: 'center' }
        );
      }
    });
    
    // Add total count on last page
    const finalY = doc.lastAutoTable.finalY || 35;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(33, 150, 243);
    doc.text(
      `Total Pupils: ${tableData.length}`,
      15,
      finalY + 10
    );
    
    // Generate filename
    const filename = `Fahmid_Pupils_Data_${today.toISOString().split('T')[0]}.pdf`;
    
    // Save the PDF
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