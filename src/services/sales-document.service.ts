import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Money } from '../core/domain/money.ts';

export class SalesDocumentService {
  /**
   * Generates a professional PDF for a Quotation.
   */
  public async generateQuotationPDF(quote: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const currency = quote.currency;

        // --- Brand Header ---
        doc.rect(40, 40, 515, 60).fill('#0F172A');
        doc.fillColor('#FFFFFF')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(quote.client?.tenantNameEn || 'GULFHIVE ERP SERVICES', 55, 50);
        doc.fillColor('#38BDF8')
          .fontSize(10)
          .font('Helvetica')
          .text('OFFICIAL BUSINESS QUOTATION / عرض سعر رسمي', 55, 72);

        // --- Meta Grid ---
        doc.fillColor('#1E293B').fontSize(10);
        
        // Col 1
        doc.font('Helvetica-Bold').text('Quotation No:', 40, 120);
        doc.font('Helvetica').text(quote.quotationNumber, 130, 120);
        doc.font('Helvetica-Bold').text('Date:', 40, 135);
        doc.font('Helvetica').text(quote.quotationDate, 130, 135);
        doc.font('Helvetica-Bold').text('Valid Until:', 40, 150);
        doc.font('Helvetica').text(quote.validUntil || 'N/A', 130, 150);

        // Col 2
        doc.font('Helvetica-Bold').text('Client:', 300, 120);
        doc.font('Helvetica').text(quote.client?.nameEn || 'Client Name', 380, 120);
        doc.font('Helvetica-Bold').text('Reference:', 300, 135);
        doc.font('Helvetica').text(quote.reference || 'N/A', 380, 135);
        doc.font('Helvetica-Bold').text('Payment Terms:', 300, 150);
        doc.font('Helvetica').text(quote.paymentTerms || 'N/A', 380, 150);

        // --- Subject Block ---
        if (quote.subject) {
          doc.rect(40, 175, 515, 25).fill('#F1F5F9');
          doc.fillColor('#0F172A')
            .font('Helvetica-Bold')
            .text(`Subject: ${quote.subject}`, 50, 183);
        }

        // --- Table Headers ---
        const tableY = 215;
        doc.rect(40, tableY, 515, 20).fill('#0F172A');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
        doc.text('SR#', 45, tableY + 6);
        doc.text('DESCRIPTION / الوصف', 80, tableY + 6);
        doc.text('QTY / الكمية', 300, tableY + 6, { width: 50, align: 'right' });
        doc.text('UNIT PRICE', 360, tableY + 6, { width: 80, align: 'right' });
        doc.text('TOTAL / الإجمالي', 450, tableY + 6, { width: 100, align: 'right' });

        // --- Table Rows ---
        let currentY = tableY + 20;
        doc.fillColor('#1E293B').font('Helvetica').fontSize(8);

        quote.lines.forEach((line: any, idx: number) => {
          doc.rect(40, currentY, 515, 20).fill(idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
          doc.fillColor('#0F172A');
          doc.text(String(idx + 1), 45, currentY + 6);
          doc.text(line.description, 80, currentY + 6, { width: 210 });
          doc.text(parseFloat(line.quantity).toFixed(2), 300, currentY + 6, { width: 50, align: 'right' });
          doc.text(Money.create(line.unitPrice, currency).toDecimalString(), 360, currentY + 6, { width: 80, align: 'right' });
          doc.text(Money.create(line.lineTotal, currency).toDecimalString() + ' ' + currency, 450, currentY + 6, { width: 100, align: 'right' });
          currentY += 20;
        });

        // --- Summary Block ---
        currentY += 10;
        doc.rect(340, currentY, 215, 75).stroke('#CBD5E1');

        doc.fillColor('#475569').font('Helvetica-Bold');
        doc.text('Subtotal:', 350, currentY + 10);
        doc.text('Discount:', 350, currentY + 25);
        doc.text('Tax / الضريبة:', 350, currentY + 40);
        doc.text('Grand Total:', 350, currentY + 55);

        doc.fillColor('#0F172A').font('Helvetica');
        doc.text(Money.create(quote.subtotal, currency).toDecimalString(), 440, currentY + 10, { width: 100, align: 'right' });
        doc.text(Money.create(quote.discountTotal, currency).toDecimalString(), 440, currentY + 25, { width: 100, align: 'right' });
        doc.text(Money.create(quote.taxTotal, currency).toDecimalString(), 440, currentY + 40, { width: 100, align: 'right' });
        doc.font('Helvetica-Bold').text(Money.create(quote.grandTotal, currency).toDecimalString() + ' ' + currency, 440, currentY + 55, { width: 100, align: 'right' });

        // --- Notes ---
        if (quote.notes) {
          currentY += 95;
          doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8).text('Terms & Notes / الشروط والأحكام:', 40, currentY);
          doc.fillColor('#1E293B').font('Helvetica').text(quote.notes, 40, currentY + 12, { width: 515 });
        }

        // --- Footer ---
        doc.fillColor('#94A3B8')
          .fontSize(7)
          .text('Generated deterministically by GulfHive ERP · System Document Output', 40, 780, { width: 515, align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a professional PDF for an Invoice.
   */
  public async generateInvoicePDF(inv: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const currency = inv.currency;

        // --- Brand Header ---
        doc.rect(40, 40, 515, 60).fill('#0F172A');
        doc.fillColor('#FFFFFF')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(inv.client?.tenantNameEn || 'GULFHIVE GENERAL TRADING', 55, 50);
        doc.fillColor('#38BDF8')
          .fontSize(10)
          .font('Helvetica')
          .text('TAX INVOICE / فاتورة ضريبية رسمية', 55, 72);

        // --- Meta Grid ---
        doc.fillColor('#1E293B').fontSize(10);
        
        // Col 1
        doc.font('Helvetica-Bold').text('Invoice No:', 40, 120);
        doc.font('Helvetica').text(inv.invoiceNumber, 130, 120);
        doc.font('Helvetica-Bold').text('Date:', 40, 135);
        doc.font('Helvetica').text(inv.invoiceDate, 130, 135);
        doc.font('Helvetica-Bold').text('Due Date:', 40, 150);
        doc.font('Helvetica').text(inv.dueDate, 130, 150);

        // Col 2
        doc.font('Helvetica-Bold').text('Bill To / العميل:', 300, 120);
        doc.font('Helvetica').text(inv.client?.nameEn || 'Customer Name', 380, 120);
        doc.font('Helvetica-Bold').text('Reference:', 300, 135);
        doc.font('Helvetica').text(inv.clientReference || 'N/A', 380, 135);
        doc.font('Helvetica-Bold').text('Status:', 300, 150);
        doc.font('Helvetica-Bold').text(inv.status, 380, 150);

        // --- Table Headers ---
        const tableY = 185;
        doc.rect(40, tableY, 515, 20).fill('#0F172A');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
        doc.text('SR#', 45, tableY + 6);
        doc.text('DESCRIPTION / الوصف', 80, tableY + 6);
        doc.text('QTY / الكمية', 300, tableY + 6, { width: 50, align: 'right' });
        doc.text('UNIT PRICE', 360, tableY + 6, { width: 80, align: 'right' });
        doc.text('TOTAL / الإجمالي', 450, tableY + 6, { width: 100, align: 'right' });

        // --- Table Rows ---
        let currentY = tableY + 20;
        doc.fillColor('#1E293B').font('Helvetica').fontSize(8);

        inv.lines.forEach((line: any, idx: number) => {
          doc.rect(40, currentY, 515, 20).fill(idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
          doc.fillColor('#0F172A');
          doc.text(String(idx + 1), 45, currentY + 6);
          doc.text(line.description, 80, currentY + 6, { width: 210 });
          doc.text(parseFloat(line.quantity).toFixed(2), 300, currentY + 6, { width: 50, align: 'right' });
          doc.text(Money.create(line.unitPrice, currency).toDecimalString(), 360, currentY + 6, { width: 80, align: 'right' });
          doc.text(Money.create(line.lineTotal, currency).toDecimalString() + ' ' + currency, 450, currentY + 6, { width: 100, align: 'right' });
          currentY += 20;
        });

        // --- Summary Block ---
        currentY += 10;
        doc.rect(340, currentY, 215, 90).stroke('#CBD5E1');

        doc.fillColor('#475569').font('Helvetica-Bold');
        doc.text('Subtotal:', 350, currentY + 10);
        doc.text('Discount:', 350, currentY + 25);
        doc.text('Tax / الضريبة:', 350, currentY + 40);
        doc.text('Grand Total:', 350, currentY + 55);
        doc.text('Outstanding:', 350, currentY + 70);

        doc.fillColor('#0F172A').font('Helvetica');
        doc.text(Money.create(inv.subtotal, currency).toDecimalString(), 440, currentY + 10, { width: 100, align: 'right' });
        doc.text(Money.create(inv.discountTotal, currency).toDecimalString(), 440, currentY + 25, { width: 100, align: 'right' });
        doc.text(Money.create(inv.taxTotal, currency).toDecimalString(), 440, currentY + 40, { width: 100, align: 'right' });
        doc.font('Helvetica-Bold').text(Money.create(inv.grandTotal, currency).toDecimalString() + ' ' + currency, 440, currentY + 55, { width: 100, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#B91C1C').text(Money.create(inv.outstandingAmount, currency).toDecimalString() + ' ' + currency, 440, currentY + 70, { width: 100, align: 'right' });

        // --- Notes ---
        if (inv.notes) {
          currentY += 110;
          doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8).text('Invoice Notes / ملاحظات الفاتورة:', 40, currentY);
          doc.fillColor('#1E293B').font('Helvetica').text(inv.notes, 40, currentY + 12, { width: 515 });
        }

        // --- Footer ---
        doc.fillColor('#94A3B8')
          .fontSize(7)
          .text('Generated deterministically by GulfHive ERP · System Document Output', 40, 780, { width: 515, align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a professional PDF for a Receipt.
   */
  public async generateReceiptPDF(rec: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const currency = rec.currency;

        // --- Brand Header ---
        doc.rect(40, 40, 515, 60).fill('#0F172A');
        doc.fillColor('#FFFFFF')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(rec.client?.tenantNameEn || 'GULFHIVE OFFICIAL SYSTEM', 55, 50);
        doc.fillColor('#38BDF8')
          .fontSize(10)
          .font('Helvetica')
          .text('OFFICIAL PAYMENT RECEIPT / سند قبض رسمي', 55, 72);

        // --- Meta Grid ---
        doc.fillColor('#1E293B').fontSize(10);
        
        // Col 1
        doc.font('Helvetica-Bold').text('Receipt No:', 40, 120);
        doc.font('Helvetica').text(rec.receiptNumber, 130, 120);
        doc.font('Helvetica-Bold').text('Date:', 40, 135);
        doc.font('Helvetica').text(rec.receiptDate, 130, 135);
        doc.font('Helvetica-Bold').text('Method:', 40, 150);
        doc.font('Helvetica').text(rec.paymentMethod, 130, 150);

        // Col 2
        doc.font('Helvetica-Bold').text('Received From:', 300, 120);
        doc.font('Helvetica').text(rec.client?.nameEn || 'Customer Name', 390, 120);
        doc.font('Helvetica-Bold').text('Reference No:', 300, 135);
        doc.font('Helvetica').text(rec.referenceNumber || 'N/A', 390, 135);
        doc.font('Helvetica-Bold').text('Amount Received:', 300, 150);
        doc.font('Helvetica-Bold').fillColor('#059669').text(Money.create(rec.amount, currency).toDecimalString() + ' ' + currency, 390, 150);

        // --- Allocations Section ---
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10).text('Allocations to Invoices / توزيع الدفعات:', 40, 185);

        const tableY = 205;
        doc.rect(40, tableY, 515, 20).fill('#0F172A');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
        doc.text('SR#', 45, tableY + 6);
        doc.text('ALLOCATION DATE', 80, tableY + 6);
        doc.text('ENTITY / REFERENCE', 180, tableY + 6);
        doc.text('ALLOCATED AMOUNT / القيمة الموزعة', 400, tableY + 6, { width: 140, align: 'right' });

        let currentY = tableY + 20;
        doc.fillColor('#1E293B').font('Helvetica').fontSize(8);

        if (!rec.allocations || rec.allocations.length === 0) {
          doc.rect(40, currentY, 515, 25).fill('#F8FAFC');
          doc.text('This receipt remains fully unallocated (available as customer credit).', 50, currentY + 9, { align: 'center', width: 515 });
          currentY += 25;
        } else {
          rec.allocations.forEach((alloc: any, idx: number) => {
            doc.rect(40, currentY, 515, 20).fill(idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
            doc.fillColor('#0F172A');
            doc.text(String(idx + 1), 45, currentY + 6);
            doc.text(alloc.allocationDate, 80, currentY + 6);
            doc.text(`Invoice #${alloc.invoiceId || 'N/A'}`, 180, currentY + 6);
            doc.text(Money.create(alloc.allocatedAmount, currency).toDecimalString() + ' ' + currency, 400, currentY + 6, { width: 140, align: 'right' });
            currentY += 20;
          });
        }

        // Unallocated summary
        currentY += 10;
        doc.rect(340, currentY, 215, 45).stroke('#CBD5E1');
        doc.fillColor('#475569').font('Helvetica-Bold');
        doc.text('Allocated Total:', 350, currentY + 10);
        doc.text('Unallocated Balance:', 350, currentY + 25);

        const allocatedTotal = Money.create(rec.amount, currency).subtract(Money.create(rec.unallocatedAmount, currency));
        doc.fillColor('#0F172A').font('Helvetica');
        doc.text(allocatedTotal.toDecimalString(), 450, currentY + 10, { width: 100, align: 'right' });
        doc.font('Helvetica-Bold').text(Money.create(rec.unallocatedAmount, currency).toDecimalString() + ' ' + currency, 450, currentY + 25, { width: 100, align: 'right' });

        // --- Footer ---
        doc.fillColor('#94A3B8')
          .fontSize(7)
          .text('Generated deterministically by GulfHive ERP · System Document Output', 40, 780, { width: 515, align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a professional PDF for a Customer Statement.
   */
  public async generateStatementPDF(stmt: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const currency = stmt.currency;

        // --- Brand Header ---
        doc.rect(40, 40, 515, 60).fill('#0F172A');
        doc.fillColor('#FFFFFF')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(stmt.client?.tenantNameEn || 'GULFHIVE ERP ACCOUNTING', 55, 50);
        doc.fillColor('#38BDF8')
          .fontSize(10)
          .font('Helvetica')
          .text(`CUSTOMER STATEMENT OF ACCOUNT / كشف حساب عميل (${stmt.dateFrom} to ${stmt.dateTo})`, 55, 72);

        // --- Meta Grid ---
        doc.fillColor('#1E293B').fontSize(10);
        
        // Col 1
        doc.font('Helvetica-Bold').text('Customer Code:', 40, 120);
        doc.font('Helvetica').text(stmt.client?.code, 130, 120);
        doc.font('Helvetica-Bold').text('Customer NameEn:', 40, 135);
        doc.font('Helvetica').text(stmt.client?.nameEn, 130, 135);
        doc.font('Helvetica-Bold').text('Customer NameAr:', 40, 150);
        doc.font('Helvetica').text(stmt.client?.nameAr, 130, 150);

        // Col 2
        doc.font('Helvetica-Bold').text('Opening Balance:', 300, 120);
        doc.font('Helvetica').text(Money.create(stmt.openingBalance, currency).toDecimalString() + ' ' + currency, 410, 120, { width: 140, align: 'right' });
        doc.font('Helvetica-Bold').text('Closing Balance:', 300, 135);
        doc.font('Helvetica-Bold').fillColor('#B91C1C').text(Money.create(stmt.closingBalance, currency).toDecimalString() + ' ' + currency, 410, 135, { width: 140, align: 'right' });

        // --- Table Headers ---
        const tableY = 185;
        doc.rect(40, tableY, 515, 20).fill('#0F172A');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
        doc.text('DATE', 45, tableY + 6);
        doc.text('REFERENCE', 95, tableY + 6);
        doc.text('DESCRIPTION', 165, tableY + 6);
        doc.text('DEBIT (+)', 335, tableY + 6, { width: 60, align: 'right' });
        doc.text('CREDIT (-)', 405, tableY + 6, { width: 60, align: 'right' });
        doc.text('BALANCE', 475, tableY + 6, { width: 75, align: 'right' });

        // --- Table Rows ---
        let currentY = tableY + 20;
        doc.fillColor('#1E293B').font('Helvetica').fontSize(7);

        // Print Opening Row
        doc.rect(40, currentY, 515, 18).fill('#F1F5F9');
        doc.fillColor('#0F172A').font('Helvetica-Bold');
        doc.text(stmt.dateFrom, 45, currentY + 5);
        doc.text('OPENING', 95, currentY + 5);
        doc.text('Opening Balance Forward', 165, currentY + 5);
        doc.text(Money.create(stmt.openingBalance, currency).toDecimalString() + ' ' + currency, 475, currentY + 5, { width: 75, align: 'right' });
        currentY += 18;

        doc.font('Helvetica');
        stmt.items.forEach((item: any, idx: number) => {
          doc.rect(40, currentY, 515, 18).fill(idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
          doc.fillColor('#0F172A');
          doc.text(item.date, 45, currentY + 5);
          doc.text(item.reference, 95, currentY + 5);
          doc.text(item.description, 165, currentY + 5, { width: 165 });
          doc.text(parseFloat(item.debit) > 0 ? Money.create(item.debit, currency).toDecimalString() : '-', 335, currentY + 5, { width: 60, align: 'right' });
          doc.text(parseFloat(item.credit) > 0 ? Money.create(item.credit, currency).toDecimalString() : '-', 405, currentY + 5, { width: 60, align: 'right' });
          doc.text(Money.create(item.balance, currency).toDecimalString(), 475, currentY + 5, { width: 75, align: 'right' });
          currentY += 18;
        });

        // --- Footer ---
        doc.fillColor('#94A3B8')
          .fontSize(7)
          .text('Generated deterministically by GulfHive ERP · System Document Output', 40, 780, { width: 515, align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a genuine Excel spreadsheet (XLSX) for a Customer Statement.
   */
  public async generateStatementExcel(stmt: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Statement of Account');

    const currency = stmt.currency;

    // Title & Metadata
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = `${stmt.client?.tenantNameEn || 'GULFHIVE ERP'} - CUSTOMER STATEMENT`;
    worksheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.addRow([]);
    worksheet.addRow(['Customer Code:', stmt.client?.code, 'Opening Balance:', parseFloat(stmt.openingBalance)]);
    worksheet.addRow(['Customer Name:', stmt.client?.nameEn, 'Closing Balance:', parseFloat(stmt.closingBalance)]);
    worksheet.addRow(['Period:', `${stmt.dateFrom} to ${stmt.dateTo}`, 'Currency:', currency]);
    worksheet.addRow([]);

    // Table Headers
    const headers = ['Date', 'Reference', 'Description', `Debit (+ ${currency})`, `Credit (- ${currency})`, `Balance (${currency})`];
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
    });

    // Opening Row
    worksheet.addRow([stmt.dateFrom, 'OPENING', 'Opening Balance Forward', 0, 0, parseFloat(stmt.openingBalance)]);

    // Statement Rows
    stmt.items.forEach((item: any) => {
      worksheet.addRow([
        item.date,
        item.reference,
        item.description,
        parseFloat(item.debit) || 0,
        parseFloat(item.credit) || 0,
        parseFloat(item.balance),
      ]);
    });

    // Set Column Widths & Formats
    worksheet.columns = [
      { width: 12 }, // Date
      { width: 15 }, // Reference
      { width: 35 }, // Description
      { width: 15, numFmt: '#,##0.000' }, // Debit
      { width: 15, numFmt: '#,##0.000' }, // Credit
      { width: 15, numFmt: '#,##0.000' }, // Balance
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as any);
  }
}

export const salesDocumentService = new SalesDocumentService();
