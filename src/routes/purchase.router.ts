/**
 * GulfHive ERP - Purchase, Procurement & Payables Router
 * Handles Suppliers, Purchase Requests, RFQs, Supplier Quotations, Purchase Orders, Goods Receipts, Bills, Supplier Payments, and AP Aging.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { procurementRepository } from '../infrastructure/database/repositories/procurement.repository.ts';
import { procurementDocumentService } from '../services/procurement-document.service.ts';
import { authenticateToken, requireCompanyAccess } from '../core/security/auth.middleware.ts';
import { ValidationError, NotFoundError } from '../core/errors/app-error.ts';
import { logger } from '../core/logging/logger.ts';

export const purchaseRouter = Router();

// Suppliers
purchaseRouter.get('/companies/:companyId/procurement/suppliers', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await procurementRepository.listSuppliers(req.params.companyId);
    res.json({ suppliers: list });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.get('/companies/:companyId/procurement/suppliers/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await procurementRepository.getSupplier(req.params.companyId, Number(req.params.id));
    if (!supplier) throw new NotFoundError('Supplier', req.params.id);
    res.json({ supplier });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/suppliers', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await procurementRepository.createSupplier(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ supplier });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.put('/companies/:companyId/procurement/suppliers/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await procurementRepository.updateSupplier(req.params.companyId, Number(req.params.id), req.body, (req as any).user?.uid || 'admin');
    res.json({ supplier });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.get('/companies/:companyId/procurement/suppliers/:id/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const preflight = await procurementRepository.preflightDeleteSupplier(req.params.companyId, Number(req.params.id));
    res.json({ preflight });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.delete('/companies/:companyId/procurement/suppliers/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const result = await procurementRepository.deleteSupplier(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin', reason);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/suppliers/bulk-delete/preflight', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplierIds } = req.body;
    const preflight = await procurementRepository.preflightBulkDeleteSuppliers(req.params.companyId, supplierIds);
    res.json({ preflight });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/suppliers/bulk-delete', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplierIds, action, reason } = req.body;
    const result = await procurementRepository.bulkDeleteSuppliers(req.params.companyId, {
      supplierIds,
      action: action || 'DELETE',
      actorId: (req as any).user?.uid || 'admin',
      reason,
    });
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// Purchase Requests
purchaseRouter.get('/companies/:companyId/procurement/purchase-requests', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await procurementRepository.listPurchaseRequests(req.params.companyId);
    res.json({ purchaseRequests: list });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.get('/companies/:companyId/procurement/purchase-requests/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pr = await procurementRepository.getPurchaseRequest(req.params.companyId, Number(req.params.id));
    if (!pr) throw new NotFoundError('Purchase Request', req.params.id);
    res.json({ purchaseRequest: pr });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/purchase-requests', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pr = await procurementRepository.createPurchaseRequest(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ purchaseRequest: pr });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.put('/companies/:companyId/procurement/purchase-requests/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pr = await procurementRepository.updatePurchaseRequest(req.params.companyId, Number(req.params.id), req.body, (req as any).user?.uid || 'admin');
    res.json({ purchaseRequest: pr });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/purchase-requests/:id/submit', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pr = await procurementRepository.setPurchaseRequestStatus(req.params.companyId, Number(req.params.id), 'SUBMITTED', (req as any).user?.uid || 'admin');
    res.json({ purchaseRequest: pr });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/purchase-requests/:id/approve', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pr = await procurementRepository.setPurchaseRequestStatus(req.params.companyId, Number(req.params.id), 'APPROVED', (req as any).user?.uid || 'admin');
    res.json({ purchaseRequest: pr });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.delete('/companies/:companyId/procurement/purchase-requests/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await procurementRepository.deletePurchaseRequest(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// RFQs & Supplier Quotations
purchaseRouter.get('/companies/:companyId/procurement/rfqs', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await procurementRepository.listRFQs(req.params.companyId);
    res.json({ rfqs: list });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/rfqs', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rfq = await procurementRepository.createRFQ(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ rfq });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.get('/companies/:companyId/procurement/quotations', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await procurementRepository.listSupplierQuotations(req.params.companyId);
    res.json({ quotations: list });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/quotations', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await procurementRepository.createSupplierQuotation(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ quotation: quote });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/quotations/:id/select', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const quote = await procurementRepository.selectQuotation(req.params.companyId, Number(req.params.id), reason, (req as any).user?.uid || 'admin');
    res.json({ quotation: quote });
  } catch (error) {
    next(error);
  }
});

// Purchase Orders
purchaseRouter.get('/companies/:companyId/procurement/purchase-orders', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await procurementRepository.listPurchaseOrders(req.params.companyId);
    res.json({ purchaseOrders: list });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.get('/companies/:companyId/procurement/purchase-orders/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await procurementRepository.getPurchaseOrder(req.params.companyId, Number(req.params.id));
    if (!po) throw new NotFoundError('Purchase Order', req.params.id);
    res.json({ purchaseOrder: po });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/purchase-orders', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await procurementRepository.createPurchaseOrder(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ purchaseOrder: po });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/purchase-orders/:id/approve', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await procurementRepository.approvePurchaseOrder(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ purchaseOrder: po });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.delete('/companies/:companyId/procurement/purchase-orders/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await procurementRepository.deletePurchaseOrder(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.get('/companies/:companyId/procurement/purchase-orders/:id/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await procurementRepository.getPurchaseOrder(req.params.companyId, Number(req.params.id));
    if (!po) throw new NotFoundError('Purchase Order', req.params.id);

    const pdf = await procurementDocumentService.generatePurchaseOrderPDF(po);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PO_${po.purchaseOrderNumber}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

// Goods / Service Receipts
purchaseRouter.get('/companies/:companyId/procurement/goods-receipts', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await procurementRepository.listGoodsReceipts(req.params.companyId);
    res.json({ goodsReceipts: list });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/goods-receipts', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const grn = await procurementRepository.createGoodsReceipt(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ goodsReceipt: grn });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.delete('/companies/:companyId/procurement/goods-receipts/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await procurementRepository.deleteGoodsReceipt(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// Supplier Bills
purchaseRouter.get('/companies/:companyId/procurement/bills', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await procurementRepository.listSupplierBills(req.params.companyId);
    res.json({ bills: list });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.get('/companies/:companyId/procurement/bills/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bill = await procurementRepository.getSupplierBill(req.params.companyId, Number(req.params.id));
    if (!bill) throw new NotFoundError('Bill', req.params.id);
    res.json({ bill });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/bills', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bill = await procurementRepository.createSupplierBill(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ bill });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/bills/:id/post', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bill = await procurementRepository.postSupplierBill(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ bill });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/bills/:id/void', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const bill = await procurementRepository.voidSupplierBill(req.params.companyId, Number(req.params.id), reason, (req as any).user?.uid || 'admin');
    res.json({ bill });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.delete('/companies/:companyId/procurement/bills/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await procurementRepository.deleteSupplierBill(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// Supplier Payments
purchaseRouter.get('/companies/:companyId/procurement/payments', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await procurementRepository.listSupplierPayments(req.params.companyId);
    res.json({ payments: list });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.get('/companies/:companyId/procurement/payments/:id', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pay = await procurementRepository.getSupplierPayment(req.params.companyId, Number(req.params.id));
    if (!pay) throw new NotFoundError('Supplier payment', req.params.id);
    res.json({ payment: pay });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/payments', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pay = await procurementRepository.createSupplierPayment(req.params.companyId, req.body, (req as any).user?.uid || 'admin');
    res.status(201).json({ payment: pay });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.post('/companies/:companyId/procurement/payments/:id/void', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pay = await procurementRepository.voidSupplierPayment(req.params.companyId, Number(req.params.id), (req as any).user?.uid || 'admin');
    res.json({ payment: pay });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.get('/companies/:companyId/procurement/payments/:id/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pay = await procurementRepository.getSupplierPayment(req.params.companyId, Number(req.params.id));
    if (!pay) throw new NotFoundError('Payment', req.params.id);

    const pdf = await procurementDocumentService.generatePaymentVoucherPDF(pay);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Payment_${pay.paymentNumber}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

// Supplier Statements & Reports
purchaseRouter.get('/companies/:companyId/procurement/suppliers/:id/statement', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo, branchId } = req.query;
    if (!dateFrom || !dateTo) throw new ValidationError('dateFrom and dateTo are required.');
    const stmt = await procurementRepository.getSupplierStatement(
      req.params.companyId,
      Number(req.params.id),
      String(dateFrom),
      String(dateTo),
      branchId ? String(branchId) : undefined
    );
    res.json({ statement: stmt });
  } catch (error) {
    next(error);
  }
});

purchaseRouter.get('/companies/:companyId/procurement/suppliers/:id/statement/pdf', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo, branchId } = req.query;
    if (!dateFrom || !dateTo) throw new ValidationError('dateFrom and dateTo are required.');
    const stmt = await procurementRepository.getSupplierStatement(
      req.params.companyId,
      Number(req.params.id),
      String(dateFrom),
      String(dateTo),
      branchId ? String(branchId) : undefined
    );
    const pdf = await procurementDocumentService.generateSupplierStatementPDF(stmt);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Statement_${stmt.supplier.code}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

purchaseRouter.get('/companies/:companyId/procurement/suppliers/:id/statement/excel', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo, branchId } = req.query;
    if (!dateFrom || !dateTo) throw new ValidationError('dateFrom and dateTo are required.');
    const stmt = await procurementRepository.getSupplierStatement(
      req.params.companyId,
      Number(req.params.id),
      String(dateFrom),
      String(dateTo),
      branchId ? String(branchId) : undefined
    );
    const excelBuffer = await procurementDocumentService.generateSupplierStatementExcel(stmt);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Statement_${stmt.supplier.code}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    next(error);
  }
});

purchaseRouter.get('/companies/:companyId/procurement/reports/aging', authenticateToken, requireCompanyAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await procurementRepository.getAPAgingReport(req.params.companyId);
    res.json({ agingReport: report });
  } catch (error) {
    next(error);
  }
});
