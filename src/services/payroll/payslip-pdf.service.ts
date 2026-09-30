/**
 * GulfHive ERP - Authoritative Payslip PDF Service
 * Generates official corporate A4 payslips using pdfkit with clean typography,
 * bilingual labeling, itemized earnings and deductions, and statutory explainability trace.
 */

import PDFDocument from 'pdfkit';

export interface PayslipPdfData {
  companyNameEn: string;
  companyNameAr?: string | null;
  companyCr?: string | null;
  periodYear: number;
  periodMonth: number;
  runNumber?: string | null;
  employeeNumber: string;
  employeeNameEn: string;
  employeeNameAr?: string | null;
  departmentName?: string | null;
  designationName?: string | null;
  joiningDate?: string | null;
  bankName?: string | null;
  iban?: string | null;
  currency: string;
  basicSalary: string;
  housingAllowance: string;
  transportAllowance: string;
  otherAllowances: string;
  overtimeAmount: string;
  overtimeHours: string;
  unpaidLeaveDeduction: string;
  unpaidLeaveDays: number;
  loanDeduction: string;
  statutoryEmployeeContribution: string;
  statutoryEmployerContribution: string;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  resultLines?: Array<{
    componentCode: string;
    componentName: string;
    lineType: string;
    amount: string;
  }>;
}

export class PayslipPdfService {
  /**
   * Generates a single official A4 payslip PDF.
   */
  public static async generateSinglePayslip(data: PayslipPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        this.renderPayslipPage(doc, data);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a multi-page PDF containing all payslips in a payroll run.
   */
  public static async generateBatchPayslips(dataList: PayslipPdfData[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: false });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        for (const data of dataList) {
          doc.addPage();
          this.renderPayslipPage(doc, data);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private static renderPayslipPage(doc: typeof PDFDocument, data: PayslipPdfData): void {
    const pageWidth = doc.page.width;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // 1. Header Banner
    doc.rect(margin, margin, contentWidth, 54).fill('#0F172A');
    doc.fillColor('#FFFFFF')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(data.companyNameEn.toUpperCase(), margin + 16, margin + 12);

    doc.fontSize(9)
      .font('Helvetica')
      .fillColor('#94A3B8')
      .text(
        `OFFICIAL SALARY PAYSLIP / قسيمة الراتب الرسمية — PERIOD: ${data.periodYear}-${String(data.periodMonth).padStart(2, '0')}`,
        margin + 16,
        margin + 32
      );

    if (data.companyCr) {
      doc.fontSize(8)
        .fillColor('#CBD5E1')
        .text(`CR: ${data.companyCr}`, pageWidth - margin - 150, margin + 14, { width: 135, align: 'right' });
    }

    // 2. Employee Profile Card
    const infoY = margin + 66;
    doc.rect(margin, infoY, contentWidth, 70).fillAndStroke('#F8FAFC', '#E2E8F0');

    doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
    doc.text('EMPLOYEE NUMBER / الرقم الوظيفي:', margin + 16, infoY + 12);
    doc.text('NAME / الاسم:', margin + 16, infoY + 28);
    doc.text('DEPARTMENT / القسم:', margin + 16, infoY + 44);

    doc.fillColor('#0F172A').font('Helvetica');
    doc.text(data.employeeNumber, margin + 160, infoY + 12);
    doc.text(data.employeeNameEn, margin + 160, infoY + 28);
    doc.text(data.departmentName || 'General Operations', margin + 160, infoY + 44);

    const col2X = margin + contentWidth / 2 + 10;
    doc.fillColor('#334155').font('Helvetica-Bold');
    doc.text('CURRENCY / العملة:', col2X, infoY + 12);
    doc.text('DESIGNATION / المسمى:', col2X, infoY + 28);
    doc.text('BANK & IBAN / الحساب البنكي:', col2X, infoY + 44);

    doc.fillColor('#0F172A').font('Helvetica');
    doc.text(data.currency, col2X + 130, infoY + 12);
    doc.text(data.designationName || 'Staff Member', col2X + 130, infoY + 28);
    const ibanText = data.iban ? `${data.bankName || ''} · ${data.iban.slice(-8)}` : 'Cash / Manual';
    doc.text(ibanText, col2X + 130, infoY + 44);

    // 3. Side-by-Side Earnings and Deductions Table
    const tableY = infoY + 82;
    const halfWidth = (contentWidth - 10) / 2;

    // Left Box: Earnings
    doc.rect(margin, tableY, halfWidth, 24).fill('#0F172A');
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold').text('EARNINGS / المستحقات', margin + 12, tableY + 7);

    // Right Box: Deductions
    doc.rect(margin + halfWidth + 10, tableY, halfWidth, 24).fill('#0F172A');
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold').text('DEDUCTIONS / الاستقطاعات', margin + halfWidth + 22, tableY + 7);

    // Earnings list
    const earnings: Array<{ label: string; amount: string }> = [
      { label: 'Basic Salary / الراتب الأساسي', amount: data.basicSalary },
    ];
    if (parseFloat(data.housingAllowance) > 0) earnings.push({ label: 'Housing Allowance / بدل سكن', amount: data.housingAllowance });
    if (parseFloat(data.transportAllowance) > 0) earnings.push({ label: 'Transport Allowance / بدل نقل', amount: data.transportAllowance });
    if (parseFloat(data.otherAllowances) > 0) earnings.push({ label: 'Other Allowances / بدلات أخرى', amount: data.otherAllowances });
    if (parseFloat(data.overtimeAmount) > 0) earnings.push({ label: `Overtime (${data.overtimeHours}h) / إضافي`, amount: data.overtimeAmount });

    // Deductions list
    const deductions: Array<{ label: string; amount: string }> = [];
    if (parseFloat(data.unpaidLeaveDeduction) > 0) {
      deductions.push({ label: `Unpaid Absence (${data.unpaidLeaveDays}d) / غياب`, amount: data.unpaidLeaveDeduction });
    }
    if (parseFloat(data.loanDeduction) > 0) {
      deductions.push({ label: 'Loan Recovery / قسط سلفة', amount: data.loanDeduction });
    }
    if (parseFloat(data.statutoryEmployeeContribution) > 0) {
      deductions.push({ label: 'Social Insurance (PIFSS/GOSI) / تأمينات', amount: data.statutoryEmployeeContribution });
    }

    const rowCount = Math.max(earnings.length, deductions.length, 5);
    let curY = tableY + 28;

    for (let i = 0; i < rowCount; i++) {
      const isEven = i % 2 === 0;
      const rowBg = isEven ? '#F8FAFC' : '#FFFFFF';

      doc.rect(margin, curY, halfWidth, 20).fill(rowBg);
      doc.rect(margin + halfWidth + 10, curY, halfWidth, 20).fill(rowBg);

      // Earning line
      if (i < earnings.length) {
        doc.fillColor('#334155').fontSize(8).font('Helvetica').text(earnings[i].label, margin + 8, curY + 6);
        doc.fillColor('#0F172A').font('Helvetica-Bold').text(earnings[i].amount, margin + halfWidth - 70, curY + 6, { width: 62, align: 'right' });
      }

      // Deduction line
      if (i < deductions.length) {
        doc.fillColor('#334155').fontSize(8).font('Helvetica').text(deductions[i].label, margin + halfWidth + 18, curY + 6);
        doc.fillColor('#DC2626').font('Helvetica-Bold').text(deductions[i].amount, margin + contentWidth - 70, curY + 6, { width: 62, align: 'right' });
      }

      curY += 20;
    }

    // Totals Bar
    doc.rect(margin, curY, halfWidth, 24).fillAndStroke('#E2E8F0', '#CBD5E1');
    doc.fillColor('#0F172A').fontSize(8).font('Helvetica-Bold').text('GROSS EARNINGS / إجمالي المستحقات', margin + 8, curY + 7);
    doc.text(`${data.grossPay} ${data.currency}`, margin + halfWidth - 110, curY + 7, { width: 102, align: 'right' });

    doc.rect(margin + halfWidth + 10, curY, halfWidth, 24).fillAndStroke('#E2E8F0', '#CBD5E1');
    doc.fillColor('#0F172A').fontSize(8).font('Helvetica-Bold').text('TOTAL DEDUCTIONS / إجمالي الاستقطاعات', margin + halfWidth + 18, curY + 7);
    doc.fillColor('#DC2626').text(`${data.totalDeductions} ${data.currency}`, margin + contentWidth - 110, curY + 7, { width: 102, align: 'right' });

    curY += 34;

    // 4. Net Salary Callout Box
    doc.rect(margin, curY, contentWidth, 42).fillAndStroke('#0284C7', '#0369A1');
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('NET PAYABLE SALARY / صافي الراتب المستحق:', margin + 16, curY + 14);
    doc.fontSize(14).text(`${data.netPay} ${data.currency}`, margin + contentWidth - 210, curY + 12, { width: 195, align: 'right' });

    curY += 54;

    // 5. Employer Statutory Contribution Note
    if (parseFloat(data.statutoryEmployerContribution) > 0) {
      doc.rect(margin, curY, contentWidth, 28).fill('#F1F5F9');
      doc.fillColor('#64748B').fontSize(8).font('Helvetica').text(
        `Employer Social Insurance Contribution (Cost to Company only, not deducted from net pay): ${data.statutoryEmployerContribution} ${data.currency}`,
        margin + 12,
        curY + 9
      );
      curY += 36;
    }

    // 6. Signatures & Audit Footnote
    const footerY = doc.page.height - 90;
    doc.rect(margin, footerY, contentWidth, 1).fill('#CBD5E1');

    doc.fillColor('#475569').fontSize(8).font('Helvetica');
    doc.text('Prepared By: Payroll Officer', margin, footerY + 10);
    doc.text('Approved By: Finance / Authorized Signatory', margin + contentWidth / 2, footerY + 10);

    doc.fillColor('#94A3B8').fontSize(7).text(
      `Generated by GulfHive ERP · Authoritative and immutable calculation snapshot · Confidential document`,
      margin,
      footerY + 36,
      { align: 'center', width: contentWidth }
    );
  }
}
