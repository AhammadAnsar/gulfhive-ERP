export interface Supplier {
  id: number;
  tenantId: string;
  code: string;
  nameEn: string;
  nameAr: string;
  email?: string;
  phone?: string;
  crNumber?: string;
  vatNumber?: string;
  paymentTermsId?: string;
  currency?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseRequest {
  id: number;
  requestNumber: string;
  requesterName: string;
  department?: string;
  requiredDate?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ORDERED';
  totalEstimatedAmount: string;
  currency: string;
  notes?: string;
  lines?: any[];
  createdAt?: string;
}

export interface RFQ {
  id: number;
  rfqNumber: string;
  title: string;
  closingDate?: string;
  status: 'OPEN' | 'CLOSED' | 'AWARDED';
  notes?: string;
  lines?: any[];
  quotations?: any[];
}

export interface PurchaseOrder {
  id: number;
  purchaseOrderNumber: string;
  supplierId: number;
  supplier?: Supplier;
  orderDate: string;
  expectedDeliveryDate?: string;
  currency: string;
  status: 'DRAFT' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED';
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  lines?: any[];
}

export interface GoodsReceipt {
  id: number;
  receiptNumber: string;
  purchaseOrderId?: number;
  supplierId: number;
  supplier?: Supplier;
  receivedDate: string;
  status: 'ACCEPTED' | 'PARTIALLY_ACCEPTED' | 'REJECTED';
  lines?: any[];
}

export interface SupplierBill {
  id: number;
  billNumber: string;
  supplierInvoiceNumber?: string;
  supplierId: number;
  supplier?: Supplier;
  purchaseOrderId?: number;
  goodsReceiptId?: number;
  billDate: string;
  dueDate: string;
  currency: string;
  status: 'DRAFT' | 'POSTED' | 'PAID' | 'PARTIALLY_PAID';
  matchStatus?: 'MATCHED' | 'DISCREPANCY' | 'PENDING';
  matchExceptions?: any;
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  paidAmount: string;
  outstandingAmount: string;
  lines?: any[];
}

export interface SupplierPayment {
  id: number;
  paymentNumber: string;
  supplierId: number;
  supplier?: Supplier;
  paymentDate: string;
  currency: string;
  paymentMethod: string;
  amount: string;
  status: 'DRAFT' | 'POSTED' | 'VOID';
  notes?: string;
  allocations?: any[];
}
