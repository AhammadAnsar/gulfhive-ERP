/**
 * GulfHive ERP - Sales & Receivables Router
 * Handles Clients, Tax Codes, Quotations, Sales Orders, Delivery Notes, Invoices, Credit Notes, Receipts, Statements, and Receivable Aging.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { salesRepository } from '../infrastructure/database/repositories/sales.repository.ts';
import { salesDocumentService } from '../services/sales-document.service.ts';
import { authenticateToken, requireCompanyAccess } from '../core/security/auth.middleware.ts';
import { ValidationError, NotFoundError } from '../core/errors/app-error.ts';
import { logger } from '../core/logging/logger.ts';

export const salesRouter = Router();

// Clients Management
salesRouter.get('/companies/:companyId/sales/clients', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await salesRepository.listClients(req.params.companyId);
    res.json({ clients: list });
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/companies/:companyId/sales/clients/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await salesRepository.getClient(req.params.companyId, Number(req.params.id));
    if (!client) throw new NotFoundError('Client', req.params.id);
    res.json({ client });
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/companies/:companyId/sales/clients', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await salesRepository.createClient(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ client });
  } catch (error) {
    next(error);
  }
});

salesRouter.put('/companies/:companyId/sales/clients/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await salesRepository.updateClient(req.params.companyId, Number(req.params.id), req.body, (req as any).user?.uid || 'admin');
    res.json({ client });
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/companies/:companyId/sales/clients/:id/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const preflight = await salesRepository.preflightDeleteClient(req.params.companyId, Number(req.params.id));
    res.json({ preflight });
  } catch (error) {
    next(error);
  }
});

salesRouter.delete('/companies/:companyId/sales/clients/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const result = await salesRepository.deleteClient(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/companies/:companyId/sales/clients/bulk-delete/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientIds } = req.body;
    const preflight = await salesRepository.preflightBulkDeleteClients(req.params.companyId, clientIds);
    res.json({ preflight });
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/companies/:companyId/sales/clients/bulk-delete', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientIds, action, reason } = req.body;
    const result = await salesRepository.bulkDeleteClients(req.params.companyId, {
      clientIds,
      action: action || 'DELETE',
      actorId: (req as any).user?.uid || 'admin',
      reason,
    });
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/companies/:companyId/sales/clients/:id/contacts', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = await salesRepository.createClientContact(req.params.companyId, Number(req.params.id), req.body);
    res.status(201).json({ contact });
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/companies/:companyId/sales/clients/:id/sites', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const site = await salesRepository.createClientSite(req.params.companyId, Number(req.params.id), req.body);
    res.status(201).json({ site });
  } catch (error) {
    next(error);
  }
});

// Tax Codes
salesRouter.get('/companies/:companyId/sales/tax-codes', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await salesRepository.listTaxCodes(req.params.companyId);
    res.json({ taxCodes: list });
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/companies/:companyId/sales/tax-codes', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tc = await salesRepository.createTaxCode(req.params.companyId, req.body);
    res.status(201).json({ taxCode: tc });
  } catch (error) {
    next(error);
  }
});

// Quotations
salesRouter.get('/companies/:companyId/sales/quotations', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await salesRepository.listQuotations(req.params.companyId);
    res.json({ quotations: list });
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/companies/:companyId/sales/quotations/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await salesRepository.getQuotation(req.params.companyId, Number(req.params.id));
    if (!quote) throw new NotFoundError('Quotation', req.params.id);
    res.json({ quotation: quote });
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/companies/:companyId/sales/quotations', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await salesRepository.createQuotation(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ quotation: quote });
  } catch (error) {
    next(error);
  }
});

salesRouter.put('/companies/:companyId/sales/quotations/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await salesRepository.updateQuotation(req.params.companyId, Number(req.params.id), req.body, (req as any).user?.uid || 'admin');
    res.json({ quotation: quote });
  } catch (error) {
    next(error);
  }
});

salesRouter.delete('/companies/:companyId/sales/quotations/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const result = await salesRepository.deleteQuotation(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/companies/:companyId/sales/quotations/:id/convert', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await salesRepository.convertQuotationToSalesOrder(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.status(201).json({ salesOrder: order });
  } catch (error) {
    next(error);
  }
});

// Sales Orders
salesRouter.get('/companies/:companyId/sales/orders', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await salesRepository.listSalesOrders(req.params.companyId);
    res.json({ salesOrders: list });
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/companies/:companyId/sales/orders/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await salesRepository.getSalesOrder(req.params.companyId, Number(req.params.id));
    if (!order) throw new NotFoundError('Sales Order', req.params.id);
    res.json({ salesOrder: order });
  } catch (error) {
    next(error);
  }
});

salesRouter.delete('/companies/:companyId/sales/orders/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const result = await salesRepository.deleteSalesOrder(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// Deliveries
salesRouter.get('/companies/:companyId/sales/deliveries', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await salesRepository.listDeliveries(req.params.companyId);
    res.json({ deliveries: list });
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/companies/:companyId/sales/deliveries/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dlv = await salesRepository.getDelivery(req.params.companyId, Number(req.params.id));
    if (!dlv) throw new NotFoundError('Delivery note', req.params.id);
    res.json({ delivery: dlv });
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/companies/:companyId/sales/deliveries/from-order', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dlv = await salesRepository.createDeliveryFromSalesOrder(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ delivery: dlv });
  } catch (error) {
    next(error);
  }
});

salesRouter.delete('/companies/:companyId/sales/deliveries/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const result = await salesRepository.deleteDelivery(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// Invoices
salesRouter.get('/companies/:companyId/sales/invoices', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await salesRepository.listInvoices(req.params.companyId);
    res.json({ invoices: list });
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/companies/:companyId/sales/invoices/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inv = await salesRepository.getInvoice(req.params.companyId, Number(req.params.id));
    if (!inv) throw new NotFoundError('Invoice', req.params.id);
    res.json({ invoice: inv });
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/companies/:companyId/sales/invoices/direct', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inv = await salesRepository.createDirectInvoice(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ invoice: inv });
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/companies/:companyId/sales/invoices/:id/post', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inv = await salesRepository.postInvoice(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ invoice: inv });
  } catch (error) {
    next(error);
  }
});

salesRouter.delete('/companies/:companyId/sales/invoices/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const result = await salesRepository.deleteInvoice(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// Credit Notes
salesRouter.get('/companies/:companyId/sales/credit-notes', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await salesRepository.listCreditNotes(req.params.companyId);
    res.json({ creditNotes: list });
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/companies/:companyId/sales/credit-notes/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cn = await salesRepository.getCreditNote(req.params.companyId, Number(req.params.id));
    if (!cn) throw new NotFoundError('Credit note', req.params.id);
    res.json({ creditNote: cn });
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/companies/:companyId/sales/credit-notes', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cn = await salesRepository.createCreditNote(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ creditNote: cn });
  } catch (error) {
    next(error);
  }
});

// Receipts
salesRouter.get('/companies/:companyId/sales/receipts', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await salesRepository.listReceipts(req.params.companyId);
    res.json({ receipts: list });
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/companies/:companyId/sales/receipts/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rec = await salesRepository.getReceipt(req.params.companyId, Number(req.params.id));
    if (!rec) throw new NotFoundError('Receipt', req.params.id);
    res.json({ receipt: rec });
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/companies/:companyId/sales/receipts', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rec = await salesRepository.createReceipt(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ receipt: rec });
  } catch (error) {
    next(error);
  }
});

salesRouter.delete('/companies/:companyId/sales/receipts/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const result = await salesRepository.deleteReceipt(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// PDFs & Documents
salesRouter.get('/companies/:companyId/sales/quotations/:id/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await salesRepository.getQuotation(req.params.companyId, Number(req.params.id));
    if (!quote) throw new NotFoundError('Quotation', req.params.id);
    const pdf = await salesDocumentService.generateQuotationPDF(quote);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="QUOTATION_${quote.quotationNumber}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/companies/:companyId/sales/invoices/:id/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inv = await salesRepository.getInvoice(req.params.companyId, Number(req.params.id));
    if (!inv) throw new NotFoundError('Invoice', req.params.id);
    const pdf = await salesDocumentService.generateInvoicePDF(inv);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="INVOICE_${inv.invoiceNumber}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/companies/:companyId/sales/receipts/:id/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rec = await salesRepository.getReceipt(req.params.companyId, Number(req.params.id));
    if (!rec) throw new NotFoundError('Receipt', req.params.id);
    const pdf = await salesDocumentService.generateReceiptPDF(rec);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="RECEIPT_${rec.receiptNumber}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

// Customer Statements
salesRouter.get('/companies/:companyId/sales/clients/:id/statement', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo, currency } = req.query;
    if (!dateFrom || !dateTo) {
      throw new ValidationError('dateFrom and dateTo are required query parameters.');
    }
    const stmt = await salesRepository.getCustomerStatement(
      req.params.companyId,
      Number(req.params.id),
      String(dateFrom),
      String(dateTo),
      String(currency || 'KWD')
    );
    res.json({ statement: stmt });
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/companies/:companyId/sales/clients/:id/statement/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo, currency } = req.query;
    if (!dateFrom || !dateTo) throw new ValidationError('dateFrom and dateTo are required.');
    const stmt = await salesRepository.getCustomerStatement(
      req.params.companyId,
      Number(req.params.id),
      String(dateFrom),
      String(dateTo),
      String(currency || 'KWD')
    );
    const pdf = await salesDocumentService.generateStatementPDF(stmt);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Statement_${stmt.client.code}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/companies/:companyId/sales/clients/:id/statement/excel', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo, currency } = req.query;
    if (!dateFrom || !dateTo) throw new ValidationError('dateFrom and dateTo are required.');
    const stmt = await salesRepository.getCustomerStatement(
      req.params.companyId,
      Number(req.params.id),
      String(dateFrom),
      String(dateTo),
      String(currency || 'KWD')
    );
    const excelBuffer = await salesDocumentService.generateStatementExcel(stmt);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Statement_${stmt.client.code}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/companies/:companyId/sales/reports/aging', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currency } = req.query;
    const report = await salesRepository.getReceivableAging(req.params.companyId, String(currency || 'KWD'));
    res.json({ agingReport: report });
  } catch (error) {
    next(error);
  }
});
