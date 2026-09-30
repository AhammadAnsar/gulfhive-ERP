import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export class ProcurementDocumentService {
  /**
   * Generates a professional bilingual PDF for a Purchase Order (PO).
   */
  public async generatePurchaseOrderPDF(po: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const currency = po.currency || 'KWD';

        // --- Brand Header ---
        doc.rect(40, 40, 515, 60).fill('#0F172A');
        doc.fillColor('#FFFFFF')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(po.supplier?.tenantNameEn || 'GULFHIVE PROCUREMENT', 55, 50);
        doc.fillColor('#F59E0B')
          .fontSize(11)
          .text('PURCHASE ORDER / امر شراء', 55, 75);

        // --- Document Details ---
        doc.fillColor('#334155').fontSize(10).font('Helvetica');
        doc.text(`PO Number: ${po.purchaseOrderNumber}`, 400, 50, { align: 'right' });
        doc.text(`Date: ${po.orderDate}`, 400, 65, { align: 'right' });
        doc.text(`Status: ${po.status}`, 400, 80, { align: 'right' });

        doc.moveDown(4);

        // --- Supplier & Company Info Grid ---
        const startY = doc.y;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A');
        doc.text('SUPPLIER / المورد', 40, startY);
        doc.text('SHIP TO / شحن إلى', 300, startY);

        doc.font('Helvetica').fontSize(9).fillColor('#475569');
        doc.text(`Name: ${po.supplier?.nameEn || 'Supplier Name'}`, 40, startY + 15);
        doc.text(`Code: ${po.supplier?.code || 'N/A'}`, 40, startY + 28);
        doc.text(`CR Number: ${po.supplier?.crNumber || 'N/A'}`, 40, startY + 41);

        doc.text(`Company: GulfHive Corp`, 300, startY + 15);
        doc.text(`Branch: Main HQ Branch`, 300, startY + 28);
        doc.text(`Payment Terms: ${po.paymentTermsId || '30 Days'}`, 300, startY + 41);

        doc.moveDown(4);

        // --- Table Headers ---
        const tableY = doc.y + 15;
        doc.rect(40, tableY, 515, 20).fill('#1E293B');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
        doc.text('Description / الوصف', 45, tableY + 6);
        doc.text('Qty / الكمية', 280, tableY + 6, { width: 50, align: 'right' });
        doc.text('Price / السعر', 350, tableY + 6, { width: 60, align: 'right' });
        doc.text(`Total (${currency}) / الاجمالي`, 440, tableY + 6, { width: 110, align: 'right' });

        // --- Table Rows ---
        let currentY = tableY + 20;
        doc.font('Helvetica').fontSize(8.5).fillColor('#334155');

        po.lines?.forEach((line: any, idx: number) => {
          // Zebra striping
          if (idx % 2 === 1) {
            doc.rect(40, currentY, 515, 18).fill('#F8FAFC');
          }
          doc.fillColor('#334155');
          doc.text(line.description, 45, currentY + 5, { width: 220, ellipsis: true });
          doc.text(parseFloat(line.orderedQuantity).toFixed(3), 280, currentY + 5, { width: 50, align: 'right' });
          doc.text(parseFloat(line.unitPrice).toFixed(3), 350, currentY + 5, { width: 60, align: 'right' });
          doc.text(parseFloat(line.total).toFixed(3), 440, currentY + 5, { width: 110, align: 'right' });
          currentY += 18;
        });

        // --- Summary Block ---
        currentY += 10;
        doc.rect(340, currentY, 215, 75).fill('#F1F5F9');
        doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8.5);

        doc.text('Subtotal / المجموع الفرعي:', 350, currentY + 10);
        doc.text(parseFloat(po.subtotal).toFixed(3), 440, currentY + 10, { width: 105, align: 'right' });

        doc.text('Tax / الضريبة:', 350, currentY + 25);
        doc.text(parseFloat(po.taxTotal || '0').toFixed(3), 440, currentY + 25, { width: 105, align: 'right' });

        doc.text('Discount / الخصم:', 350, currentY + 40);
        doc.text(parseFloat(po.discountTotal || '0').toFixed(3), 440, currentY + 40, { width: 105, align: 'right' });

        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9);
        doc.text('Grand Total / الاجمالي:', 350, currentY + 55);
        doc.text(`${parseFloat(po.grandTotal).toFixed(3)} ${currency}`, 440, currentY + 55, { width: 105, align: 'right' });

        // --- Notes & Signatures ---
        if (po.notes) {
          doc.moveDown(6);
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Terms & Notes / ملاحظات و شروط:');
          doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(po.notes);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a professional PDF for a Supplier Payment Voucher.
   */
  public async generatePaymentVoucherPDF(pay: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const currency = pay.currency || 'KWD';

        // --- Brand Header ---
        doc.rect(40, 40, 515, 60).fill('#0F172A');
        doc.fillColor('#FFFFFF')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(pay.supplier?.tenantNameEn || 'GULFHIVE ERP SYSTEM', 55, 50);
        doc.fillColor('#10B981')
          .fontSize(11)
          .text('PAYMENT VOUCHER / سند صرف دفعات', 55, 75);

        // --- Document Details ---
        doc.fillColor('#334155').fontSize(10).font('Helvetica');
        doc.text(`Voucher Number: ${pay.paymentNumber}`, 400, 50, { align: 'right' });
        doc.text(`Date: ${pay.paymentDate}`, 400, 65, { align: 'right' });
        doc.text(`Status: ${pay.status}`, 400, 80, { align: 'right' });

        doc.moveDown(4);

        // --- Supplier Info ---
        const startY = doc.y;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A');
        doc.text('SUPPLIER DETAILS / تفاصيل المورد', 40, startY);

        doc.font('Helvetica').fontSize(9).fillColor('#475569');
        doc.text(`Supplier Name: ${pay.supplier?.nameEn || 'Supplier Name'}`, 40, startY + 15);
        doc.text(`Supplier Code: ${pay.supplier?.code || 'N/A'}`, 40, startY + 28);
        doc.text(`Method: ${pay.paymentMethodId || 'CASH'}`, 40, startY + 41);
        doc.text(`Reference: ${pay.referenceNumber || 'N/A'}`, 40, startY + 54);

        doc.moveDown(4);

        // --- Payment Amount Summary ---
        const summaryY = doc.y + 10;
        doc.rect(40, summaryY, 515, 30).fill('#ECFDF5');
        doc.fillColor('#047857').font('Helvetica-Bold').fontSize(11);
        doc.text(`TOTAL AMOUNT PAID / المبلغ المدفوع:  ${parseFloat(pay.amount).toFixed(3)} ${currency}`, 55, summaryY + 10);

        doc.moveDown(4);

        // --- Allocation Details Table ---
        if (pay.allocations && pay.allocations.length > 0) {
          const tableY = doc.y + 15;
          doc.rect(40, tableY, 515, 20).fill('#1E293B');
          doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
          doc.text('Allocated Document / المستند المخصص', 45, tableY + 6);
          doc.text('Allocation Date / تاريخ التخصيص', 250, tableY + 6);
          doc.text(`Allocated Amount / قيمة التخصيص (${currency})`, 420, tableY + 6, { width: 130, align: 'right' });

          let currentY = tableY + 20;
          doc.font('Helvetica').fontSize(8.5);
          pay.allocations.forEach((alloc: any, idx: number) => {
            if (idx % 2 === 1) {
              doc.rect(40, currentY, 515, 18).fill('#F8FAFC');
            }
            doc.fillColor('#334155');
            doc.text(`Bill Ref: #${alloc.supplierBillId}`, 45, currentY + 5);
            doc.text(alloc.allocationDate, 250, currentY + 5);
            doc.text(parseFloat(alloc.allocatedAmount).toFixed(3), 420, currentY + 5, { width: 130, align: 'right' });
            currentY += 18;
          });
        }

        // --- Footer signatures ---
        const footerY = 700;
        doc.strokeColor('#E2E8F0').moveTo(40, footerY).lineTo(555, footerY).stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748B');
        doc.text('PREPARED BY / تم الإعداد بواسطة', 60, footerY + 15);
        doc.text('APPROVED BY / تم الاعتماد بواسطة', 400, footerY + 15, { align: 'right' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a professional bilingual PDF for a Supplier Statement.
   */
  public async generateSupplierStatementPDF(stmt: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const currency = stmt.currency || 'KWD';

        // --- Brand Header ---
        doc.rect(40, 40, 515, 60).fill('#0F172A');
        doc.fillColor('#FFFFFF')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(stmt.supplier?.tenantNameEn || 'GULFHIVE PORTAL', 55, 50);
        doc.fillColor('#F59E0B')
          .fontSize(11)
          .text('SUPPLIER STATEMENT OF ACCOUNT / كشف حساب المورد', 55, 75);

        // --- Document Details ---
        doc.fillColor('#334155').fontSize(10).font('Helvetica');
        doc.text(`Supplier: ${stmt.supplier?.nameEn}`, 400, 50, { align: 'right' });
        doc.text(`Period: ${stmt.dateFrom} to ${stmt.dateTo}`, 400, 65, { align: 'right' });

        doc.moveDown(4);

        // --- Summary Grid ---
        const startY = doc.y;
        doc.rect(40, startY, 515, 40).fill('#F8FAFC');
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155');
        doc.text('Opening Balance / الرصيد الافتتاحي', 50, startY + 15);
        doc.text(parseFloat(stmt.openingBalance).toFixed(3), 190, startY + 15, { width: 80, align: 'right' });

        doc.text('Closing Balance / الرصيد النهائي', 300, startY + 15);
        doc.text(`${parseFloat(stmt.closingBalance).toFixed(3)} ${currency}`, 440, startY + 15, { width: 100, align: 'right' });

        doc.moveDown(4);

        // --- Table Headers ---
        const tableY = doc.y + 15;
        doc.rect(40, tableY, 515, 20).fill('#1E293B');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
        doc.text('Date', 45, tableY + 6);
        doc.text('Reference', 110, tableY + 6);
        doc.text('Description', 180, tableY + 6, { width: 150 });
        doc.text('Debit (+)', 340, tableY + 6, { width: 60, align: 'right' });
        doc.text('Credit (-)', 410, tableY + 6, { width: 60, align: 'right' });
        doc.text('Balance', 480, tableY + 6, { width: 70, align: 'right' });

        // --- Table Rows ---
        let currentY = tableY + 20;
        doc.font('Helvetica').fontSize(8).fillColor('#334155');

        // Opening Row
        doc.text(stmt.dateFrom, 45, currentY + 5);
        doc.text('OPENING', 110, currentY + 5);
        doc.text('Opening Balance Forward', 180, currentY + 5, { width: 150 });
        doc.text('0.000', 340, currentY + 5, { width: 60, align: 'right' });
        doc.text('0.000', 410, currentY + 5, { width: 60, align: 'right' });
        doc.text(parseFloat(stmt.openingBalance).toFixed(3), 480, currentY + 5, { width: 70, align: 'right' });
        currentY += 18;

        stmt.items?.forEach((item: any, idx: number) => {
          if (idx % 2 === 1) {
            doc.rect(40, currentY, 515, 18).fill('#F8FAFC');
          }
          doc.fillColor('#334155');
          doc.text(item.date, 45, currentY + 5);
          doc.text(item.reference, 110, currentY + 5);
          doc.text(item.description, 180, currentY + 5, { width: 150, ellipsis: true });
          doc.text(parseFloat(item.debit).toFixed(3), 340, currentY + 5, { width: 60, align: 'right' });
          doc.text(parseFloat(item.credit).toFixed(3), 410, currentY + 5, { width: 60, align: 'right' });
          doc.text(parseFloat(item.balance).toFixed(3), 480, currentY + 5, { width: 70, align: 'right' });
          currentY += 18;
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a genuine Excel spreadsheet (XLSX) for a Supplier Statement.
   */
  public async generateSupplierStatementExcel(stmt: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Statement of Account');

    const currency = stmt.currency || 'KWD';

    // Title & Metadata
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = `${stmt.supplier?.nameEn || 'GULFHIVE SUPPLIER'} - STATEMENT OF ACCOUNT`;
    worksheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.addRow([]);
    worksheet.addRow(['Supplier Code:', stmt.supplier?.code, 'Opening Balance:', parseFloat(stmt.openingBalance)]);
    worksheet.addRow(['Supplier Name:', stmt.supplier?.nameEn, 'Closing Balance:', parseFloat(stmt.closingBalance)]);
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
    stmt.items?.forEach((item: any) => {
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

export const procurementDocumentService = new ProcurementDocumentService();
