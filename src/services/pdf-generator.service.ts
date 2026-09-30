/**
 * GulfHive ERP - Authoritative PDF Document Generator Service
 * Generates official Employee ID Cards and Employee Master Profile Summary Reports.
 */

import PDFDocument from 'pdfkit';
import { registerArabicFonts } from './pdf-font-helper.ts';

export interface IDCardData {
  employeeNumber: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  designationEn?: string;
  designationAr?: string;
  departmentEn?: string;
  departmentAr?: string;
  branchNameEn?: string;
  civilIdNumber?: string;
  joiningDate?: string;
  avatarUrl?: string;
  companyNameEn: string;
  companyNameAr: string;
  companyLogoUrl?: string;
}

export class PDFGeneratorService {
  /**
   * Generates a printable vector PDF Employee ID Card (CR80 standard size 85.6mm x 54mm @ 72dpi: 242.6pt x 153pt).
   */
  public async generateIDCard(data: IDCardData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [243, 153], // Standard CR80 ID Card dimensions in points
          margin: 0,
        });
        registerArabicFonts(doc);

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // --- Card Background & Framing ---
        doc.rect(0, 0, 243, 153).fill('#F8FAFC');

        // Top Accent Header
        doc.rect(0, 0, 243, 34).fill('#0F172A');
        doc.rect(0, 34, 243, 3).fill('#0284C7');

        // Company Wordmark / Header
        doc.fillColor('#FFFFFF')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(data.companyNameEn.toUpperCase(), 10, 8, { width: 223, align: 'left' });

        doc.fillColor('#94A3B8')
          .fontSize(7)
          .font('Helvetica')
          .text('OFFICIAL EMPLOYEE IDENTIFICATION', 10, 21, { width: 223, align: 'left' });

        // --- Photo Frame ---
        const photoX = 12;
        const photoY = 44;
        const photoW = 54;
        const photoH = 68;

        doc.rect(photoX, photoY, photoW, photoH).fillAndStroke('#E2E8F0', '#CBD5E1');

        // Photo / Avatar Initials Placeholder
        doc.rect(photoX + 2, photoY + 2, photoW - 4, photoH - 4).fill('#0F172A');
        const initials = `${data.firstNameEn.charAt(0)}${data.lastNameEn.charAt(0)}`.toUpperCase();
        doc.fillColor('#38BDF8')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(initials, photoX + 2, photoY + 24, { width: photoW - 4, align: 'center' });

        // --- Employee Details Column ---
        const textX = 74;
        let currentY = 44;

        // Full Name
        const fullName = `${data.firstNameEn} ${data.lastNameEn}`;
        doc.fillColor('#0F172A')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(fullName, textX, currentY, { width: 158, height: 12 });

        if (data.firstNameAr || data.lastNameAr) {
          const fullNameAr = `${data.firstNameAr || ''} ${data.lastNameAr || ''}`.trim();
          doc.fillColor('#0F172A')
            .fontSize(9)
            .font('Amiri-Bold')
            .text(fullNameAr, textX, currentY + 11, { width: 158, align: 'right', features: ['rtla'] });
          currentY += 23;
        } else {
          currentY += 13;
        }

        // Employee Code Badge
        doc.rect(textX, currentY, 68, 12).fill('#0284C7');
        doc.fillColor('#FFFFFF')
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(data.employeeNumber, textX + 2, currentY + 2, { width: 64, align: 'center' });

        currentY += 16;

        // Designation
        doc.fillColor('#475569')
          .fontSize(7)
          .font('Helvetica-Bold')
          .text('DESIGNATION', textX, currentY);
        currentY += 8;

        doc.fillColor('#0F172A')
          .fontSize(8)
          .font('Helvetica')
          .text(data.designationEn || 'Staff Member', textX, currentY, { width: 158 });
        currentY += 12;

        // Department / Branch
        doc.fillColor('#475569')
          .fontSize(7)
          .font('Helvetica-Bold')
          .text('DEPARTMENT', textX, currentY);
        currentY += 8;

        doc.fillColor('#0F172A')
          .fontSize(8)
          .font('Helvetica')
          .text(`${data.departmentEn || 'Operations'} · ${data.branchNameEn || 'Main Branch'}`, textX, currentY, { width: 158 });

        // --- Bottom Security Footer ---
        doc.rect(0, 138, 243, 15).fill('#1E293B');
        doc.fillColor('#94A3B8')
          .fontSize(6)
          .font('Helvetica')
          .text(`CIVIL ID: ${data.civilIdNumber || 'N/A'}  ·  JOINED: ${data.joiningDate ? data.joiningDate.substring(0, 10) : 'N/A'}`, 10, 142, { width: 223, align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a comprehensive A4 Employee Master Profile Report.
   */
  public async generateProfilePDF(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        registerArabicFonts(doc);
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header
        doc.rect(40, 40, 515, 50).fill('#0F172A');
        doc.fillColor('#FFFFFF')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(data.companyNameEn || 'GULFHIVE ERP', 55, 52);
        doc.fillColor('#38BDF8')
          .fontSize(10)
          .font('Helvetica')
          .text('AUTHORITATIVE EMPLOYEE MASTER RECORD', 55, 72);

        doc.fillColor('#FFFFFF')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(data.employeeNumber, 400, 58, { width: 140, align: 'right' });

        let y = 110;

        // Basic Information Box
        doc.rect(40, y, 515, 120).stroke('#CBD5E1');
        doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text(`${data.firstNameEn || ''} ${data.lastNameEn || ''}`, 55, y + 15);
        if (data.firstNameAr || data.lastNameAr) {
          const fullNameAr = `${data.firstNameAr || ''} ${data.lastNameAr || ''}`.trim();
          doc.fillColor('#0F172A').fontSize(11).font('Amiri-Bold').text(fullNameAr, 300, y + 14, { width: 240, align: 'right', features: ['rtla'] });
        }
        doc.fillColor('#64748B').fontSize(9).font('Helvetica').text(`Status: ${data.employmentStatus} · Gender: ${data.gender} · Marital Status: ${data.maritalStatus || 'Single'}`, 55, y + 32);

        doc.moveTo(55, y + 48).lineTo(540, y + 48).stroke('#E2E8F0');

        doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold').text('Department:', 55, y + 58);
        doc.font('Helvetica').text(data.departmentNameEn || 'N/A', 130, y + 58);

        doc.font('Helvetica-Bold').text('Designation:', 300, y + 58);
        doc.font('Helvetica').text(data.designationNameEn || 'N/A', 380, y + 58);

        doc.font('Helvetica-Bold').text('Branch:', 55, y + 78);
        doc.font('Helvetica').text(data.branchNameEn || 'N/A', 130, y + 78);

        doc.font('Helvetica-Bold').text('Joining Date:', 300, y + 78);
        doc.font('Helvetica').text(data.joiningDate ? new Date(data.joiningDate).toISOString().split('T')[0] : 'N/A', 380, y + 78);

        doc.font('Helvetica-Bold').text('Nationality:', 55, y + 98);
        doc.font('Helvetica').text(data.nationality || 'N/A', 130, y + 98);

        doc.font('Helvetica-Bold').text('Civil ID / Passport:', 300, y + 98);
        doc.font('Helvetica').text(`${data.civilIdNumber || 'N/A'} / ${data.passportNumber || 'N/A'}`, 380, y + 98);

        y += 140;

        // Contact Details Section
        doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('Contact & Address', 40, y);
        y += 18;
        doc.rect(40, y, 515, 50).fill('#F8FAFC').stroke('#E2E8F0');
        doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold').text('Work Email:', 55, y + 12);
        doc.font('Helvetica').text(data.workEmail || data.email, 120, y + 12);

        doc.font('Helvetica-Bold').text('Work Phone:', 300, y + 12);
        doc.font('Helvetica').text(data.workPhone || data.phone || 'N/A', 380, y + 12);

        doc.font('Helvetica-Bold').text('Personal Phone:', 55, y + 30);
        doc.font('Helvetica').text(data.personalPhone || 'N/A', 120, y + 30);

        doc.font('Helvetica-Bold').text('Address:', 300, y + 30);
        doc.font('Helvetica').text(data.addressEn || 'N/A', 380, y + 30);

        y += 70;

        // Documents Table
        doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('Identity & Compliance Documents', 40, y);
        y += 18;

        doc.rect(40, y, 515, 20).fill('#0F172A');
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
          .text('DOCUMENT TYPE', 50, y + 6)
          .text('DOCUMENT NO.', 180, y + 6)
          .text('EXPIRY DATE', 340, y + 6)
          .text('STATUS', 460, y + 6);

        y += 20;

        const docs = data.documents || [];
        if (docs.length === 0) {
          doc.rect(40, y, 515, 22).fill('#F8FAFC').stroke('#E2E8F0');
          doc.fillColor('#64748B').fontSize(8).font('Helvetica').text('No document records attached.', 50, y + 7);
          y += 22;
        } else {
          docs.forEach((docItem: any, idx: number) => {
            const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
            doc.rect(40, y, 515, 20).fill(bg).stroke('#E2E8F0');
            doc.fillColor('#0F172A').fontSize(8).font('Helvetica')
              .text(docItem.documentType, 50, y + 6)
              .text(docItem.documentNumber, 180, y + 6)
              .text(docItem.expiryDate ? new Date(docItem.expiryDate).toISOString().split('T')[0] : 'N/A', 340, y + 6)
              .text(docItem.status, 460, y + 6);
            y += 20;
          });
        }

        y += 30;

        // Footer
        doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
          .text(`Generated automatically by GulfHive ERP on ${new Date().toISOString()}`, 40, 780, { width: 515, align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const pdfGeneratorService = new PDFGeneratorService();
