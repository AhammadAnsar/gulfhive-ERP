import React, { useState, useEffect } from 'react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import { LoadingState, useToast } from '../../design-system/index.ts';
import { SupplierMasterTab } from './components/SupplierMasterTab.tsx';
import { PurchaseRequestsTab } from './components/PurchaseRequestsTab.tsx';
import { RFQsTab } from './components/RFQsTab.tsx';
import { PurchaseOrdersTab } from './components/PurchaseOrdersTab.tsx';
import { GoodsReceiptsTab } from './components/GoodsReceiptsTab.tsx';
import { PurchaseReturnsTab } from './components/PurchaseReturnsTab.tsx';
import { SupplierBillsTab } from './components/SupplierBillsTab.tsx';
import { SupplierPaymentsTab } from './components/SupplierPaymentsTab.tsx';
import { APAgingTab } from './components/APAgingTab.tsx';
import {
  Building2,
  FileSpreadsheet,
  FileCheck2,
  ShoppingBag,
  Truck,
  RotateCcw,
  Receipt,
  CreditCard,
  TrendingDown,
  Layers
} from 'lucide-react';

interface PurchaseModuleProps {
  company: any;
  branches: any[];
  activeBranchId: string;
}

export function PurchaseModule({ company, branches, activeBranchId }: PurchaseModuleProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('suppliers');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Core Data
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [debitNotes, setDebitNotes] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [taxCodes, setTaxCodes] = useState<any[]>([]);

  const loadAllProcurementData = async () => {
    setIsLoading(true);
    try {
      const [
        sRes,
        prRes,
        rfqRes,
        qRes,
        poRes,
        grnRes,
        retRes,
        dnRes,
        bRes,
        payRes,
        taxRes
      ] = await Promise.all([
        fetch(`/api/companies/${company.id}/procurement/suppliers`),
        fetch(`/api/companies/${company.id}/procurement/purchase-requests`),
        fetch(`/api/companies/${company.id}/procurement/rfqs`),
        fetch(`/api/companies/${company.id}/procurement/quotations`),
        fetch(`/api/companies/${company.id}/procurement/purchase-orders`),
        fetch(`/api/companies/${company.id}/procurement/goods-receipts`),
        fetch(`/api/companies/${company.id}/procurement/purchase-returns`),
        fetch(`/api/companies/${company.id}/procurement/debit-notes`),
        fetch(`/api/companies/${company.id}/procurement/supplier-bills`),
        fetch(`/api/companies/${company.id}/procurement/payments`),
        fetch(`/api/companies/${company.id}/sales/tax-codes`),
      ]);

      if (sRes.ok) setSuppliers((await sRes.json()).suppliers || []);
      if (prRes.ok) setRequests((await prRes.json()).purchaseRequests || []);
      if (rfqRes.ok) setRfqs((await rfqRes.json()).rfqs || []);
      if (qRes.ok) setQuotations((await qRes.json()).quotations || []);
      if (poRes.ok) setOrders((await poRes.json()).purchaseOrders || []);
      if (grnRes.ok) setReceipts((await grnRes.json()).goodsReceipts || []);
      if (retRes.ok) setReturns((await retRes.json()).purchaseReturns || []);
      if (dnRes.ok) setDebitNotes((await dnRes.json()).debitNotes || []);
      if (bRes.ok) setBills((await bRes.json()).supplierBills || []);
      if (payRes.ok) setPayments((await payRes.json()).payments || []);
      if (taxRes.ok) setTaxCodes((await taxRes.json()).taxCodes || []);
    } catch (err) {
      console.error('Error fetching procurement data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllProcurementData();
  }, [company.id]);

  const tabs = [
    { id: 'suppliers', label: language === 'ar' ? 'الموردون وكشف الحساب' : 'Vendors & AP Ledger', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'requests', label: language === 'ar' ? 'طلبات الشراء (PR)' : 'Purchase Requests', icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
    { id: 'rfqs', label: language === 'ar' ? 'استدراج وعروض الأسعار' : 'RFQs & Bids', icon: <FileCheck2 className="w-3.5 h-3.5" /> },
    { id: 'orders', label: language === 'ar' ? 'أوامر الشراء (PO)' : 'Purchase Orders', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { id: 'receipts', label: language === 'ar' ? 'استلام البضائع (GRN)' : 'Goods Receipts', icon: <Truck className="w-3.5 h-3.5" /> },
    { id: 'returns', label: language === 'ar' ? 'المرتجعات وإشعارات الخصم' : 'Returns & Debit Notes', icon: <RotateCcw className="w-3.5 h-3.5" /> },
    { id: 'bills', label: language === 'ar' ? 'فواتير الموردين والمطابقة' : 'AP Bills & 3-Way Match', icon: <Receipt className="w-3.5 h-3.5" /> },
    { id: 'payments', label: language === 'ar' ? 'سندات الصرف والتسوية' : 'Supplier Payments', icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: 'aging', label: language === 'ar' ? 'تحليل أعمار الديون' : 'AP Aging Analysis', icon: <TrendingDown className="w-3.5 h-3.5" /> },
  ];

  // Quick stats
  const totalOpenBills = bills.filter((b) => b.status === 'POSTED' && parseFloat(b.outstandingAmount || '1') > 0).length;
  const totalPendingPOs = orders.filter((o) => o.status === 'APPROVED').length;

  return (
    <div className="space-y-4">
      {/* Top Header Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-3xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">{language === 'ar' ? 'إجمالي الموردين النشطين' : 'Active Vendors'}</div>
          <div className="text-lg font-bold text-slate-900 mt-0.5">{suppliers.filter(s => s.status === 'ACTIVE').length}</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-3xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">{language === 'ar' ? 'أوامر شراء معتمدة' : 'Approved POs'}</div>
          <div className="text-lg font-bold text-blue-600 mt-0.5">{totalPendingPOs}</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-3xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">{language === 'ar' ? 'سندات استلام مستودعية' : 'Goods Receipts (GRN)'}</div>
          <div className="text-lg font-bold text-emerald-600 mt-0.5">{receipts.length}</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-3xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">{language === 'ar' ? 'فواتير مستحقة الدفع' : 'Open AP Bills'}</div>
          <div className="text-lg font-bold text-rose-600 mt-0.5">{totalOpenBills}</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-lg px-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-1.5 rtl:space-x-reverse px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap transition border-b-2 cursor-pointer ${
              activeTab === tab.id
                ? 'border-slate-900 text-slate-900 bg-slate-50/70 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {isLoading && <LoadingState label="Synchronizing procurement and accounts payable ledger..." />}

      {/* TAB CONTENT */}
      {activeTab === 'suppliers' && (
        <SupplierMasterTab
          company={company}
          suppliers={suppliers}
          onRefresh={loadAllProcurementData}
        />
      )}

      {activeTab === 'requests' && (
        <PurchaseRequestsTab
          company={company}
          branchId={activeBranchId}
          requests={requests}
          onRefresh={loadAllProcurementData}
          onConvertToPO={(pr) => {
            setActiveTab('orders');
            addToast({ type: 'info', title: 'Create PO', message: `Prefill PO for PR #${pr.requestNumber}` });
          }}
        />
      )}

      {activeTab === 'rfqs' && (
        <RFQsTab
          company={company}
          suppliers={suppliers}
          rfqs={rfqs}
          quotations={quotations}
          onRefresh={loadAllProcurementData}
          onAwardQuote={(quote) => {
            setActiveTab('orders');
            addToast({ type: 'success', title: 'Awarded', message: `Quote awarded. Create official PO.` });
          }}
        />
      )}

      {activeTab === 'orders' && (
        <PurchaseOrdersTab
          company={company}
          branchId={activeBranchId}
          suppliers={suppliers}
          taxCodes={taxCodes}
          orders={orders}
          onRefresh={loadAllProcurementData}
          onCreateGRN={(po) => {
            setActiveTab('receipts');
          }}
          onCreateBill={(po) => {
            setActiveTab('bills');
          }}
        />
      )}

      {activeTab === 'receipts' && (
        <GoodsReceiptsTab
          company={company}
          branchId={activeBranchId}
          suppliers={suppliers}
          orders={orders}
          receipts={receipts}
          onRefresh={loadAllProcurementData}
          onCreateBillFromGRN={(grn) => {
            setActiveTab('bills');
          }}
        />
      )}

      {activeTab === 'returns' && (
        <PurchaseReturnsTab
          company={company}
          branchId={activeBranchId}
          suppliers={suppliers}
          bills={bills}
          returns={returns}
          debitNotes={debitNotes}
          onRefresh={loadAllProcurementData}
        />
      )}

      {activeTab === 'bills' && (
        <SupplierBillsTab
          company={company}
          branchId={activeBranchId}
          suppliers={suppliers}
          orders={orders}
          receipts={receipts}
          bills={bills}
          onRefresh={loadAllProcurementData}
          onPayBill={(bill) => {
            setActiveTab('payments');
          }}
        />
      )}

      {activeTab === 'payments' && (
        <SupplierPaymentsTab
          company={company}
          branchId={activeBranchId}
          suppliers={suppliers}
          bills={bills}
          payments={payments}
          onRefresh={loadAllProcurementData}
        />
      )}

      {activeTab === 'aging' && (
        <APAgingTab company={company} />
      )}
    </div>
  );
}
