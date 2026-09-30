import React, { useState, useEffect } from 'react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, useToast, Dialog, LoadingState } from '../../design-system/index.ts';
import { ClientEditModal } from './components/ClientEditModal.tsx';
import { ClientPreflightDeleteModal } from './components/ClientPreflightDeleteModal.tsx';
import { ClientBulkDeleteModal } from './components/ClientBulkDeleteModal.tsx';
import { ClientDetailDrawer } from './components/ClientDetailDrawer.tsx';
import {
  Users,
  FileText,
  Truck,
  TrendingUp,
  Receipt,
  FileCheck,
  Plus,
  Trash2,
  Trash,
  Eye,
  Edit,
  Edit2,
  Settings,
  AlertCircle,
  Calendar,
  Coins,
  Layers,
  Download,
  CheckCircle,
  XCircle,
  RotateCcw,
  Percent,
  Search,
  CheckSquare,
  Square
} from 'lucide-react';

interface SalesModuleProps {
  company: any;
  branches: any[];
  activeBranchId: string;
}

export function SalesModule({ company, branches, activeBranchId }: SalesModuleProps) {
  const { t, language } = useI18n();
  const { addToast } = useToast();

  const [activeTab, setActiveModuleTab] = useState<string>('clients');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // --- Core State ---
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [quotationsList, setQuotationsList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [deliveriesList, setDeliveriesList] = useState<any[]>([]);
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [creditNotesList, setCreditNotesList] = useState<any[]>([]);
  const [receiptsList, setReceiptsList] = useState<any[]>([]);
  const [taxCodesList, setTaxCodesList] = useState<any[]>([]);

  // --- Client Advanced State ---
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [clientStatusFilter, setClientStatusFilter] = useState<string>('ALL');
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [showEditClientModal, setShowEditClientModal] = useState<boolean>(false);
  const [clientToEdit, setClientToEdit] = useState<any | null>(null);
  const [showClientPreflightModal, setShowClientPreflightModal] = useState<boolean>(false);
  const [clientToDelete, setClientToDelete] = useState<any | null>(null);
  const [showBulkClientDeleteModal, setShowBulkClientDeleteModal] = useState<boolean>(false);
  const [drawerClientId, setDrawerClientId] = useState<number | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState<boolean>(false);

  // --- Modal Forms State ---
  const [showClientModal, setShowClientModal] = useState<boolean>(false);
  const [showQuotationModal, setShowQuotationModal] = useState<boolean>(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState<boolean>(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState<boolean>(false);

  // --- Deletion Guard Modal ---
  const [showDeleteGuardModal, setShowDeleteGuardModal] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: any; type: string; details?: any } | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('');

  // --- Detail View Modals ---
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [selectedQuote, setSelectedQuotation] = useState<any | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  // --- Customer Statement Filter ---
  const [stmtClient, setStmtClient] = useState<number | null>(null);
  const [stmtDateFrom, setStmtDateFrom] = useState<string>('2026-01-01');
  const [stmtDateTo, setStmtDateTo] = useState<string>('2026-12-31');
  const [stmtCurrency, setStmtCurrency] = useState<string>('KWD');
  const [activeStatement, setActiveStatement] = useState<any | null>(null);

  // --- Customer Aging Report ---
  const [agingReport, setAgingReport] = useState<any[]>([]);

  // --- Forms Inputs State ---
  const [newClient, setNewClient] = useState({ code: '', nameEn: '', nameAr: '', email: '', phone: '', crNumber: '' });
  const [newQuote, setNewQuotation] = useState({
    clientId: '',
    quotationDate: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    currency: 'KWD',
    paymentTerms: '30 Days',
    subject: '',
    notes: '',
    lines: [{ description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }]
  });
  const [newInvoice, setNewInvoice] = useState({
    clientId: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    currency: 'KWD',
    paymentTerms: '30 Days',
    notes: '',
    lines: [{ description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }]
  });
  const [newReceipt, setNewReceipt] = useState({
    clientId: '',
    receiptDate: new Date().toISOString().slice(0, 10),
    currency: 'KWD',
    paymentMethod: 'CASH',
    amount: '0.000',
    notes: '',
    allocations: [] as { invoiceId: number; amount: string; invoiceNumber: string; outstanding: string }[]
  });
  const [newCreditNote, setNewCreditNote] = useState({
    clientId: '',
    invoiceId: '',
    creditNoteDate: new Date().toISOString().slice(0, 10),
    currency: 'KWD',
    reason: '',
    lines: [{ description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }]
  });
  const [newDelivery, setNewDelivery] = useState({
    salesOrderId: '',
    deliveryDate: new Date().toISOString().slice(0, 10),
    lines: [] as { salesOrderLineId: number; description: string; pendingQty: string; deliverQty: string }[]
  });

  // --- Load Data ---
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const cRes = await fetch(`/api/companies/${company.id}/sales/clients`);
      if (cRes.ok) {
        const d = await cRes.json();
        setClientsList(d.clients || []);
        if (d.clients?.length > 0 && !stmtClient) {
          setStmtClient(d.clients[0].id);
        }
      }

      const qRes = await fetch(`/api/companies/${company.id}/sales/quotations`);
      if (qRes.ok) setQuotationsList((await qRes.json()).quotations || []);

      const oRes = await fetch(`/api/companies/${company.id}/sales/orders`);
      if (oRes.ok) setOrdersList((await oRes.json()).salesOrders || []);

      const dRes = await fetch(`/api/companies/${company.id}/sales/deliveries`);
      if (dRes.ok) setDeliveriesList((await dRes.json()).deliveries || []);

      const iRes = await fetch(`/api/companies/${company.id}/sales/invoices`);
      if (iRes.ok) setInvoicesList((await iRes.json()).invoices || []);

      const rRes = await fetch(`/api/companies/${company.id}/sales/receipts`);
      if (rRes.ok) setReceiptsList((await rRes.json()).receipts || []);

      const cnRes = await fetch(`/api/companies/${company.id}/sales/credit-notes`);
      if (cnRes.ok) setCreditNotesList((await cnRes.json()).creditNotes || []);

      const tRes = await fetch(`/api/companies/${company.id}/sales/tax-codes`);
      if (tRes.ok) setTaxCodesList((await tRes.json()).taxCodes || []);

      // Load aging report
      const agRes = await fetch(`/api/companies/${company.id}/sales/reports/aging?currency=${stmtCurrency}`);
      if (agRes.ok) setAgingReport((await agRes.json()).agingReport || []);

    } catch (err) {
      console.error('Error fetching sales data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [company.id, stmtCurrency]);

  const handleQueryStatement = async () => {
    if (!stmtClient) {
      addToast({ type: 'error', title: 'Error', message: 'Please select a customer first' });
      return;
    }
    try {
      const res = await fetch(`/api/companies/${company.id}/sales/clients/${stmtClient}/statement?dateFrom=${stmtDateFrom}&dateTo=${stmtDateTo}&currency=${stmtCurrency}`);
      if (res.ok) {
        const d = await res.json();
        setActiveStatement(d.statement);
        addToast({ type: 'success', title: 'Success', message: 'Statement calculated successfully' });
      } else {
        addToast({ type: 'error', title: 'Error', message: 'Failed to retrieve statement' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Deletion Guards Logic ---
  const handleRequestDelete = (id: any, type: string, details?: any) => {
    setDeleteTarget({ id, type, details });
    setDeleteReason('');
    setShowDeleteGuardModal(true);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      let endpoint = '';
      if (deleteTarget.type === 'client') endpoint = `/api/companies/${company.id}/sales/clients/${deleteTarget.id}`;
      else if (deleteTarget.type === 'quotation') endpoint = `/api/companies/${company.id}/sales/quotations/${deleteTarget.id}`;
      else if (deleteTarget.type === 'salesOrder') endpoint = `/api/companies/${company.id}/sales/orders/${deleteTarget.id}`;
      else if (deleteTarget.type === 'delivery') endpoint = `/api/companies/${company.id}/sales/deliveries/${deleteTarget.id}`;
      else if (deleteTarget.type === 'invoice') endpoint = `/api/companies/${company.id}/sales/invoices/${deleteTarget.id}`;
      else if (deleteTarget.type === 'receipt') endpoint = `/api/companies/${company.id}/sales/receipts/${deleteTarget.id}`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason })
      });

      if (res.ok) {
        const data = await res.json();
        const act = data.result?.action || 'DELETED';
        addToast({
          type: 'success',
          title: 'Deleted Successfully',
          message: `Record was deleted via [${act}] mode.`
        });
        setShowDeleteGuardModal(false);
        setDeleteTarget(null);
        loadAllData();
        if (activeStatement && stmtClient === deleteTarget.id) {
          setActiveStatement(null);
        }
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Delete Prevented', message: err.error || 'Failed to delete record.' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Create Handlers ---
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/companies/${company.id}/sales/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient)
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Client Created', message: 'Client profile established successfully.' });
        setShowClientModal(false);
        setNewClient({ code: '', nameEn: '', nameAr: '', email: '', phone: '', crNumber: '' });
        loadAllData();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.error || 'Failed to create client' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...newQuote, branchId: activeBranchId };
      const res = await fetch(`/api/companies/${company.id}/sales/quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Quotation Created', message: 'Document generated successfully.' });
        setShowQuotationModal(false);
        setNewQuotation({
          clientId: '',
          quotationDate: new Date().toISOString().slice(0, 10),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          currency: 'KWD',
          paymentTerms: '30 Days',
          subject: '',
          notes: '',
          lines: [{ description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }]
        });
        loadAllData();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.error || 'Failed to create quotation' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...newInvoice, branchId: activeBranchId };
      const res = await fetch(`/api/companies/${company.id}/sales/invoices/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Invoice Generated', message: 'Direct Invoice saved successfully as Draft.' });
        setShowInvoiceModal(false);
        setNewInvoice({
          clientId: '',
          invoiceDate: new Date().toISOString().slice(0, 10),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          currency: 'KWD',
          paymentTerms: '30 Days',
          notes: '',
          lines: [{ description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }]
        });
        loadAllData();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.error || 'Failed to create invoice' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Map active selected allocations
      const activeAllocs = newReceipt.allocations
        .filter((a) => parseFloat(a.amount) > 0)
        .map((a) => ({ invoiceId: a.invoiceId, amount: a.amount }));

      const payload = {
        branchId: activeBranchId,
        clientId: Number(newReceipt.clientId),
        receiptDate: newReceipt.receiptDate,
        currency: newReceipt.currency,
        paymentMethod: newReceipt.paymentMethod,
        amount: newReceipt.amount,
        notes: newReceipt.notes,
        allocations: activeAllocs
      };

      const res = await fetch(`/api/companies/${company.id}/sales/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        addToast({ type: 'success', title: 'Receipt Created', message: 'Official receipt and allocations applied safely.' });
        setShowReceiptModal(false);
        setNewReceipt({
          clientId: '',
          receiptDate: new Date().toISOString().slice(0, 10),
          currency: 'KWD',
          paymentMethod: 'CASH',
          amount: '0.000',
          notes: '',
          allocations: []
        });
        loadAllData();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Allocation Safety Prevented', message: err.error || 'Allocation error' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoadClientInvoicesForAllocation = async (clientIdStr: string) => {
    if (!clientIdStr) return;
    try {
      // Find all unpaid or partially paid posted invoices for this client
      const res = await fetch(`/api/companies/${company.id}/sales/invoices`);
      if (res.ok) {
        const d = await res.json();
        const clientInvoices = d.invoices.filter(
          (i: any) => i.outstandingAmount !== '0.000' && i.status === 'POSTED' && i.currency === newReceipt.currency
        );

        const mapped = clientInvoices.map((i: any) => ({
          invoiceId: i.id,
          invoiceNumber: i.invoiceNumber,
          outstanding: i.outstandingAmount,
          amount: '0.000'
        }));

        setNewReceipt((prev) => ({ ...prev, clientId: clientIdStr, allocations: mapped }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostInvoice = async (invoiceId: number) => {
    try {
      const res = await fetch(`/api/companies/${company.id}/sales/invoices/${invoiceId}/post`, { method: 'POST' });
      if (res.ok) {
        addToast({ type: 'success', title: 'Invoice Posted', message: 'Core financial data locked successfully.' });
        loadAllData();
      } else {
        addToast({ type: 'error', title: 'Error', message: 'Failed to post invoice.' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConvertQuote = async (quoteId: number) => {
    try {
      const res = await fetch(`/api/companies/${company.id}/sales/quotations/${quoteId}/convert`, { method: 'POST' });
      if (res.ok) {
        addToast({ type: 'success', title: 'Converted Successfully', message: 'Sales Order confirmed from Quotation.' });
        loadAllData();
      } else {
        addToast({ type: 'error', title: 'Error', message: 'Failed to convert quotation.' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDeliveryModal = (order: any) => {
    const lines = order.lines.map((l: any) => {
      const pending = parseFloat(l.quantity) - (parseFloat(l.deliveredQuantity) || 0);
      return {
        salesOrderLineId: l.id,
        description: l.description,
        pendingQty: pending.toFixed(3),
        deliverQty: pending.toFixed(3)
      };
    });

    setNewDelivery({
      salesOrderId: String(order.id),
      deliveryDate: new Date().toISOString().slice(0, 10),
      lines
    });
    setShowDeliveryModal(true);
  };

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        salesOrderId: Number(newDelivery.salesOrderId),
        deliveryDate: newDelivery.deliveryDate,
        lines: newDelivery.lines.map((l) => ({ salesOrderLineId: l.salesOrderLineId, quantity: l.deliverQty }))
      };

      const res = await fetch(`/api/companies/${company.id}/sales/deliveries/from-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        addToast({ type: 'success', title: 'Delivery Confirmed', message: 'Operational delivery record dispatched safely.' });
        setShowDeliveryModal(false);
        loadAllData();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.error || 'Failed to dispatch delivery' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        branchId: activeBranchId,
        clientId: Number(newCreditNote.clientId),
        invoiceId: newCreditNote.invoiceId ? Number(newCreditNote.invoiceId) : undefined,
        creditNoteDate: newCreditNote.creditNoteDate,
        currency: newCreditNote.currency,
        reason: newCreditNote.reason,
        lines: newCreditNote.lines
      };

      const res = await fetch(`/api/companies/${company.id}/sales/credit-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        addToast({ type: 'success', title: 'Credit Note Created', message: 'Invoice balance adjusted successfully.' });
        setShowCreditNoteModal(false);
        setNewCreditNote({
          clientId: '',
          invoiceId: '',
          creditNoteDate: new Date().toISOString().slice(0, 10),
          currency: 'KWD',
          reason: '',
          lines: [{ description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }]
        });
        loadAllData();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.error || 'Failed to create Credit Note' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Dynamic Form Add Lines Helpers ---
  const addQuoteLine = () => {
    setNewQuotation((prev) => ({
      ...prev,
      lines: [...prev.lines, { description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }]
    }));
  };

  const addInvoiceLine = () => {
    setNewInvoice((prev) => ({
      ...prev,
      lines: [...prev.lines, { description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }]
    }));
  };

  const addCreditNoteLine = () => {
    setNewCreditNote((prev) => ({
      ...prev,
      lines: [...prev.lines, { description: '', quantity: '1', unitPrice: '0.000', taxCodeId: '' }]
    }));
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-t-lg rtl:space-x-reverse space-x-1">
        {[
          { id: 'clients', label: language === 'ar' ? 'العملاء وكشف الحساب' : 'Clients & Statement', icon: <Users className="w-3.5 h-3.5" /> },
          { id: 'quotations', label: language === 'ar' ? 'عروض الأسعار' : 'Quotations', icon: <FileText className="w-3.5 h-3.5" /> },
          { id: 'orders', label: language === 'ar' ? 'أوامر البيع' : 'Sales Orders', icon: <Layers className="w-3.5 h-3.5" /> },
          { id: 'deliveries', label: language === 'ar' ? 'سندات التسليم' : 'Deliveries', icon: <Truck className="w-3.5 h-3.5" /> },
          { id: 'invoices', label: language === 'ar' ? 'الفواتير' : 'Invoices', icon: <FileCheck className="w-3.5 h-3.5" /> },
          { id: 'credit_notes', label: language === 'ar' ? 'الإشعارات الدائنة' : 'Credit Notes', icon: <RotateCcw className="w-3.5 h-3.5" /> },
          { id: 'receipts', label: language === 'ar' ? 'سندات القبض' : 'Receipts', icon: <Receipt className="w-3.5 h-3.5" /> },
          { id: 'aging', label: language === 'ar' ? 'أعمار الديون والتقارير' : 'Receivables Aging', icon: <TrendingUp className="w-3.5 h-3.5" /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveModuleTab(tab.id)}
            className={`flex items-center space-x-1.5 rtl:space-x-reverse px-4 py-2 text-xs font-semibold transition border-b-2 ${
              activeTab === tab.id
                ? 'border-slate-900 text-slate-900 bg-slate-50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {isLoading && <LoadingState label="Synchronizing transaction balances..." />}

      {/* ==========================================
          TAB 1: CLIENTS & ACCOUNT STATEMENTS
          ========================================== */}
      {activeTab === 'clients' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Clients List Side */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 shadow-3xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
                {language === 'ar' ? 'سجل العملاء' : 'Clients Ledger'}
              </h3>
              <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowClientModal(true)}>
                {language === 'ar' ? 'عميل جديد' : 'New Client'}
              </Button>
            </div>

            {/* Search and Status Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Input
                  placeholder={language === 'ar' ? 'بحث بالاسم أو الكود...' : 'Search by code or name...'}
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="flex space-x-1 rtl:space-x-reverse text-[10px]">
                {['ALL', 'ACTIVE', 'INACTIVE', 'SUSPENDED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setClientStatusFilter(st)}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      clientStatusFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Selection Bar */}
            {selectedClientIds.length > 0 && (
              <div className="p-2 bg-slate-900 text-white rounded flex items-center justify-between text-xs">
                <span>{selectedClientIds.length} {language === 'ar' ? 'محدد' : 'selected'}</span>
                <div className="flex space-x-1.5 rtl:space-x-reverse">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setShowBulkClientDeleteModal(true)}
                  >
                    {language === 'ar' ? 'حذف / أرشفة جماعية' : 'Bulk Delete'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelectedClientIds([])}
                  >
                    {language === 'ar' ? 'إلغاء' : 'Clear'}
                  </Button>
                </div>
              </div>
            )}

            {(() => {
              const filtered = clientsList.filter((cl) => {
                const matchesSearch =
                  !clientSearchQuery ||
                  cl.code?.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                  cl.nameEn?.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                  cl.nameAr?.includes(clientSearchQuery) ||
                  cl.crNumber?.includes(clientSearchQuery);
                const matchesStatus = clientStatusFilter === 'ALL' || cl.status === clientStatusFilter;
                return matchesSearch && matchesStatus;
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-8 text-center text-xs text-slate-400">
                    {language === 'ar' ? 'لا يوجد عملاء يطابقون البحث.' : 'No matching clients found.'}
                  </div>
                );
              }

              const allSelected = filtered.length > 0 && filtered.every((c) => selectedClientIds.includes(c.id));

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <button
                      onClick={() => {
                        if (allSelected) {
                          setSelectedClientIds([]);
                        } else {
                          setSelectedClientIds(filtered.map((c) => c.id));
                        }
                      }}
                      className="flex items-center space-x-1.5 rtl:space-x-reverse hover:text-slate-800 cursor-pointer font-semibold"
                    >
                      {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-slate-900" /> : <Square className="w-3.5 h-3.5" />}
                      <span>{language === 'ar' ? 'تحديد الكل' : 'Select All'} ({filtered.length})</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                    {filtered.map((cl) => {
                      const isChecked = selectedClientIds.includes(cl.id);
                      return (
                        <div
                          key={cl.id}
                          className={`p-2.5 rounded border text-left transition ${
                            selectedClient?.id === cl.id ? 'border-slate-950 bg-slate-50' : 'border-slate-200 hover:bg-slate-50/70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 rtl:space-x-reverse">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (e.target.checked) {
                                    setSelectedClientIds((prev) => [...prev, cl.id]);
                                  } else {
                                    setSelectedClientIds((prev) => prev.filter((id) => id !== cl.id));
                                  }
                                }}
                                className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                              />
                              <span
                                className="font-mono font-bold text-xs text-slate-900 cursor-pointer hover:underline"
                                onClick={() => {
                                  setSelectedClient(cl);
                                  setStmtClient(cl.id);
                                  setActiveStatement(null);
                                }}
                              >
                                {cl.code}
                              </span>
                            </div>
                            <span
                              className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                                cl.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : cl.status === 'SUSPENDED'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {cl.status}
                            </span>
                          </div>

                          <div
                            className="text-xs font-semibold text-slate-800 mt-1 cursor-pointer"
                            onClick={() => {
                              setSelectedClient(cl);
                              setStmtClient(cl.id);
                              setActiveStatement(null);
                            }}
                          >
                            {language === 'ar' ? cl.nameAr : cl.nameEn}
                          </div>

                          {cl.crNumber && (
                            <div className="text-[10px] text-slate-500 mt-0.5">CR: {cl.crNumber}</div>
                          )}

                          {/* Quick Action Buttons */}
                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100 text-xs">
                            <button
                              onClick={() => {
                                setDrawerClientId(cl.id);
                                setShowDetailDrawer(true);
                              }}
                              className="text-[11px] text-slate-600 hover:text-slate-950 flex items-center space-x-1 rtl:space-x-reverse cursor-pointer font-medium"
                              title="View Details"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{language === 'ar' ? 'الملف' : 'Details'}</span>
                            </button>

                            <div className="flex items-center space-x-1 rtl:space-x-reverse">
                              <button
                                onClick={() => {
                                  setClientToEdit(cl);
                                  setShowEditClientModal(true);
                                }}
                                className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100 cursor-pointer"
                                title="Edit Client"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setClientToDelete(cl);
                                  setShowClientPreflightModal(true);
                                }}
                                className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 cursor-pointer"
                                title="Delete / Archive Client"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Statement View Side */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider border-b pb-2">
              {language === 'ar' ? 'فلتر كشف الحساب' : 'Customer Account Statement Filter'}
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Customer</label>
                <Select value={stmtClient || ''} onChange={(e) => setStmtClient(Number(e.target.value))}>
                  <option value="">-- Choose --</option>
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {language === 'ar' ? c.nameAr : c.nameEn}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Date From</label>
                <Input type="date" value={stmtDateFrom} onChange={(e) => setStmtDateFrom(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Date To</label>
                <Input type="date" value={stmtDateTo} onChange={(e) => setStmtDateTo(e.target.value)} />
              </div>

              <Button variant="primary" size="sm" leftIcon={<Search className="w-3.5 h-3.5" />} onClick={handleQueryStatement}>
                {language === 'ar' ? 'عرض الكشف' : 'Query Statement'}
              </Button>
            </div>

            {activeStatement ? (
              <div className="space-y-4 border-t pt-4">
                <div className="flex flex-wrap items-center justify-between bg-slate-50 p-4 rounded border border-slate-200">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900">{language === 'ar' ? activeStatement.client.nameAr : activeStatement.client.nameEn}</div>
                    <div className="text-[10px] text-slate-500">Period: {activeStatement.dateFrom} to {activeStatement.dateTo}</div>
                  </div>

                  <div className="flex space-x-4 rtl:space-x-reverse text-right">
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Opening Balance</div>
                      <div className="text-xs font-bold text-slate-900">{parseFloat(activeStatement.openingBalance).toFixed(3)} {stmtCurrency}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Closing Balance</div>
                      <div className="text-xs font-bold text-rose-600">{parseFloat(activeStatement.closingBalance).toFixed(3)} {stmtCurrency}</div>
                    </div>
                  </div>

                  <div className="flex space-x-2 rtl:space-x-reverse mt-2 sm:mt-0">
                    <a
                      href={`/api/companies/${company.id}/sales/clients/${stmtClient}/statement/pdf?dateFrom=${stmtDateFrom}&dateTo=${stmtDateTo}&currency=${stmtCurrency}`}
                      download
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </a>
                    <a
                      href={`/api/companies/${company.id}/sales/clients/${stmtClient}/statement/excel?dateFrom=${stmtDateFrom}&dateTo=${stmtDateTo}&currency=${stmtCurrency}`}
                      download
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Excel</span>
                    </a>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left text-slate-900">
                    <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3">Description</th>
                        <th className="p-3 text-right">Debit (+)</th>
                        <th className="p-3 text-right">Credit (-)</th>
                        <th className="p-3 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr className="bg-slate-100 font-bold">
                        <td className="p-3">{activeStatement.dateFrom}</td>
                        <td className="p-3">OPENING</td>
                        <td className="p-3">Opening balance forward</td>
                        <td className="p-3 text-right">-</td>
                        <td className="p-3 text-right">-</td>
                        <td className="p-3 text-right font-mono">{parseFloat(activeStatement.openingBalance).toFixed(3)}</td>
                      </tr>
                      {activeStatement.items.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3">{row.date}</td>
                          <td className="p-3 font-mono font-bold text-slate-700">{row.reference}</td>
                          <td className="p-3">{row.description}</td>
                          <td className="p-3 text-right font-mono text-blue-600">
                            {parseFloat(row.debit) > 0 ? parseFloat(row.debit).toFixed(3) : '-'}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-600">
                            {parseFloat(row.credit) > 0 ? parseFloat(row.credit).toFixed(3) : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold">{parseFloat(row.balance).toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-16 text-center text-xs text-slate-400">
                {language === 'ar' ? 'حدد العميل والتواريخ لعرض كشف الحساب.' : 'Select a customer and dates to run account statements.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: QUOTATIONS LIFECYCLE
          ========================================== */}
      {activeTab === 'quotations' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
              {language === 'ar' ? 'عروض الأسعار النشطة' : 'Quotations Pipeline'}
            </h3>
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowQuotationModal(true)}>
              {language === 'ar' ? 'عرض سعر جديد' : 'New Quotation'}
            </Button>
          </div>

          {quotationsList.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400">
              {language === 'ar' ? 'لا يوجد عروض أسعار حالياً.' : 'No quotations generated.'}
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left text-slate-900">
                <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Quote Number</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Valid Until</th>
                    <th className="p-3 text-right">Total Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {quotationsList.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50 cursor-pointer" onClick={async () => {
                      const res = await fetch(`/api/companies/${company.id}/sales/quotations/${q.id}`);
                      if (res.ok) setSelectedQuotation((await res.json()).quotation);
                    }}>
                      <td className="p-3 font-mono font-bold text-slate-700">{q.quotationNumber}</td>
                      <td className="p-3 font-semibold">{language === 'ar' ? q.clientNameAr : q.clientNameEn}</td>
                      <td className="p-3">{q.quotationDate}</td>
                      <td className="p-3">{q.validUntil || 'N/A'}</td>
                      <td className="p-3 text-right font-mono font-bold">{parseFloat(q.grandTotal).toFixed(3)} {q.currency}</td>
                      <td className="p-3">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          q.status === 'CONVERTED' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="p-3 text-right flex justify-end space-x-1.5 rtl:space-x-reverse" onClick={(e) => e.stopPropagation()}>
                        {q.status === 'DRAFT' && (
                          <Button size="sm" variant="success" onClick={() => handleConvertQuote(q.id)}>
                            {language === 'ar' ? 'تحويل لأمر بيع' : 'Convert to Order'}
                          </Button>
                        )}
                        <a
                          href={`/api/companies/${company.id}/sales/quotations/${q.id}/pdf`}
                          download
                          className="px-2.5 py-1.5 bg-slate-900 text-white rounded text-[10px] font-bold hover:bg-slate-800 transition"
                        >
                          PDF
                        </a>
                        <Button size="sm" variant="danger" onClick={() => handleRequestDelete(q.id, 'quotation', q)}>
                          {language === 'ar' ? 'حذف' : 'Delete'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 3: SALES ORDERS
          ========================================== */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
          <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider border-b pb-2">
            {language === 'ar' ? 'أوامر البيع والطلبيات' : 'Sales Orders Ledger'}
          </h3>

          {ordersList.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400">
              {language === 'ar' ? 'لا يوجد طلبات حالياً.' : 'No active sales orders found.'}
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left text-slate-900">
                <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Order Number</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Order Date</th>
                    <th className="p-3 text-right">Grand Total</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ordersList.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50 cursor-pointer" onClick={async () => {
                      const res = await fetch(`/api/companies/${company.id}/sales/orders/${o.id}`);
                      if (res.ok) setSelectedOrder((await res.json()).salesOrder);
                    }}>
                      <td className="p-3 font-mono font-bold text-slate-700">{o.salesOrderNumber}</td>
                      <td className="p-3 font-semibold">{language === 'ar' ? o.clientNameAr : o.clientNameEn}</td>
                      <td className="p-3">{o.orderDate}</td>
                      <td className="p-3 text-right font-mono font-bold">{parseFloat(o.grandTotal).toFixed(3)} {o.currency}</td>
                      <td className="p-3">
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                          {o.status}
                        </span>
                      </td>
                      <td className="p-3 text-right flex justify-end space-x-1.5 rtl:space-x-reverse" onClick={(e) => e.stopPropagation()}>
                        {o.status !== 'DELIVERED' && (
                          <Button size="sm" variant="primary" onClick={() => handleOpenDeliveryModal(o)}>
                            {language === 'ar' ? 'تسليم شحنة' : 'Create Delivery'}
                          </Button>
                        )}
                        <Button size="sm" variant="danger" onClick={() => handleRequestDelete(o.id, 'salesOrder', o)}>
                          {language === 'ar' ? 'حذف' : 'Delete'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 4: DELIVERIES
          ========================================== */}
      {activeTab === 'deliveries' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
          <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider border-b pb-2">
            {language === 'ar' ? 'سجلات التسليم والتوزيع' : 'Delivery Notes Log'}
          </h3>

          {deliveriesList.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400">
              {language === 'ar' ? 'لا يوجد سندات تسليم حالياً.' : 'No delivery notes generated.'}
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left text-slate-900">
                <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Delivery Number</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Delivery Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {deliveriesList.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-700">{d.deliveryNumber}</td>
                      <td className="p-3 font-semibold">{language === 'ar' ? d.clientNameAr : d.clientNameEn}</td>
                      <td className="p-3">{d.deliveryDate}</td>
                      <td className="p-3">
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">
                          {d.status}
                        </span>
                      </td>
                      <td className="p-3 text-right flex justify-end space-x-1.5 rtl:space-x-reverse">
                        <Button size="sm" variant="danger" onClick={() => handleRequestDelete(d.id, 'delivery', d)}>
                          {language === 'ar' ? 'إلغاء السند / حذف' : 'Delete'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 5: INVOICES MANAGEMENT
          ========================================== */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
              {language === 'ar' ? 'فواتير المبيعات' : 'Invoices Ledger'}
            </h3>
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowInvoiceModal(true)}>
              {language === 'ar' ? 'فاتورة مباشرة' : 'New Direct Invoice'}
            </Button>
          </div>

          {invoicesList.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400">
              {language === 'ar' ? 'لا يوجد فواتير مبيعات حالياً.' : 'No invoices generated.'}
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left text-slate-900">
                <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Invoice Number</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">Outstanding</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoicesList.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50 cursor-pointer" onClick={async () => {
                      const res = await fetch(`/api/companies/${company.id}/sales/invoices/${i.id}`);
                      if (res.ok) setSelectedInvoice((await res.json()).invoice);
                    }}>
                      <td className="p-3 font-mono font-bold text-slate-700">{i.invoiceNumber}</td>
                      <td className="p-3 font-semibold">{language === 'ar' ? i.clientNameAr : i.clientNameEn}</td>
                      <td className="p-3">{i.invoiceDate}</td>
                      <td className="p-3">{i.dueDate}</td>
                      <td className="p-3 text-right font-mono font-bold">{parseFloat(i.grandTotal).toFixed(3)} {i.currency}</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600">{parseFloat(i.outstandingAmount).toFixed(3)} {i.currency}</td>
                      <td className="p-3">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          i.status === 'POSTED' ? 'bg-amber-50 text-amber-600' : (i.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600')
                        }`}>
                          {i.status}
                        </span>
                      </td>
                      <td className="p-3 text-right flex justify-end space-x-1.5 rtl:space-x-reverse" onClick={(e) => e.stopPropagation()}>
                        {i.status === 'DRAFT' && (
                          <Button size="sm" variant="success" onClick={() => handlePostInvoice(i.id)}>
                            {language === 'ar' ? 'ترحيل الفاتورة' : 'Post / Freeze'}
                          </Button>
                        )}
                        <a
                          href={`/api/companies/${company.id}/sales/invoices/${i.id}/pdf`}
                          download
                          className="px-2.5 py-1.5 bg-slate-900 text-white rounded text-[10px] font-bold hover:bg-slate-800 transition"
                        >
                          PDF
                        </a>
                        <Button size="sm" variant="danger" onClick={() => handleRequestDelete(i.id, 'invoice', i)}>
                          {language === 'ar' ? 'حذف / إلغاء' : 'Delete'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 6: CREDIT NOTES
          ========================================== */}
      {activeTab === 'credit_notes' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
              {language === 'ar' ? 'الإشعارات الدائنة الصادرة' : 'Credit Notes Adjustment Registry'}
            </h3>
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreditNoteModal(true)}>
              {language === 'ar' ? 'إشعار دائن جديد' : 'New Credit Note'}
            </Button>
          </div>

          {creditNotesList.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400">
              {language === 'ar' ? 'لا يوجد إشعارات دائنة حالياً.' : 'No credit notes created.'}
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left text-slate-900">
                <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Credit Note Number</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">CN Date</th>
                    <th className="p-3 text-right">Amount adjusted</th>
                    <th className="p-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {creditNotesList.map((cn) => (
                    <tr key={cn.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-700">{cn.creditNoteNumber}</td>
                      <td className="p-3 font-semibold">{language === 'ar' ? cn.clientNameAr : cn.clientNameEn}</td>
                      <td className="p-3">{cn.creditNoteDate}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">{parseFloat(cn.grandTotal).toFixed(3)} {cn.currency}</td>
                      <td className="p-3 text-slate-600 italic">{cn.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 7: RECEIPTS & ALLOCATIONS
          ========================================== */}
      {activeTab === 'receipts' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
              {language === 'ar' ? 'سندات القبض والدفعات المستلمة' : 'Customer Receipts & Payments Log'}
            </h3>
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => {
              setNewReceipt({
                clientId: '',
                receiptDate: new Date().toISOString().slice(0, 10),
                currency: 'KWD',
                paymentMethod: 'CASH',
                amount: '0.000',
                notes: '',
                allocations: []
              });
              setShowReceiptModal(true);
            }}>
              {language === 'ar' ? 'سند قبض جديد' : 'New Payment Receipt'}
            </Button>
          </div>

          {receiptsList.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400">
              {language === 'ar' ? 'لا يوجد سندات قبض حالياً.' : 'No receipts collected.'}
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left text-slate-900">
                <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Receipt Number</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Receipt Date</th>
                    <th className="p-3 text-right">Amount Received</th>
                    <th className="p-3 text-right">Unallocated Credit</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {receiptsList.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={async () => {
                      const res = await fetch(`/api/companies/${company.id}/sales/receipts/${r.id}`);
                      if (res.ok) setSelectedReceipt((await res.json()).receipt);
                    }}>
                      <td className="p-3 font-mono font-bold text-slate-700">{r.receiptNumber}</td>
                      <td className="p-3 font-semibold">{language === 'ar' ? r.clientNameAr : r.clientNameEn}</td>
                      <td className="p-3">{r.receiptDate}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">{parseFloat(r.amount).toFixed(3)} {r.currency}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600">{parseFloat(r.unallocatedAmount).toFixed(3)} {r.currency}</td>
                      <td className="p-3 uppercase font-semibold text-slate-600">{r.paymentMethod}</td>
                      <td className="p-3">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3 text-right flex justify-end space-x-1.5" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`/api/companies/${company.id}/sales/receipts/${r.id}/pdf`}
                          download
                          className="px-2.5 py-1.5 bg-slate-900 text-white rounded text-[10px] font-bold hover:bg-slate-800 transition"
                        >
                          PDF
                        </a>
                        <Button size="sm" variant="danger" onClick={() => handleRequestDelete(r.id, 'receipt', r)}>
                          {language === 'ar' ? 'إلغاء سند القبض' : 'Void / Delete'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 8: RECEIVABLES AGING & REPORTS
          ========================================== */}
      {activeTab === 'aging' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
              {language === 'ar' ? 'تقرير أعمار الديون والمبالغ المستحقة' : 'Receivables Aging Summary Report'}
            </h3>
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Currency</label>
              <Select value={stmtCurrency} onChange={(e) => setStmtCurrency(e.target.value)}>
                <option value="KWD">KWD</option>
                <option value="SAR">SAR</option>
                <option value="AED">AED</option>
              </Select>
            </div>
          </div>

          {agingReport.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400">
              {language === 'ar' ? 'لا يوجد أرصدة مستحقة حالياً لهذه العملة.' : 'No outstanding balances for this currency.'}
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left text-slate-900">
                <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Customer Code</th>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3 text-right">Current</th>
                    <th className="p-3 text-right">1-30 Days</th>
                    <th className="p-3 text-right">31-60 Days</th>
                    <th className="p-3 text-right">61-90 Days</th>
                    <th className="p-3 text-right">90+ Days</th>
                    <th className="p-3 text-right">Total Receivables</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {agingReport.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 font-medium">
                      <td className="p-3 font-mono font-bold text-slate-700">{row.clientCode}</td>
                      <td className="p-3">{language === 'ar' ? row.clientNameAr : row.clientNameEn}</td>
                      <td className="p-3 text-right font-mono text-emerald-600">{parseFloat(row.current).toFixed(3)}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{parseFloat(row.aging1to30).toFixed(3)}</td>
                      <td className="p-3 text-right font-mono text-amber-600">{parseFloat(row.aging31to60).toFixed(3)}</td>
                      <td className="p-3 text-right font-mono text-orange-600">{parseFloat(row.aging61to90).toFixed(3)}</td>
                      <td className="p-3 text-right font-mono text-rose-600 font-bold">{parseFloat(row.agingOver90).toFixed(3)}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-950 bg-slate-50">{parseFloat(row.totalOutstanding).toFixed(3)} {stmtCurrency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          MODAL: DELETION GUARD CONFIRMATION
          ========================================== */}
      {showDeleteGuardModal && deleteTarget && (
        <Dialog
          isOpen={showDeleteGuardModal}
          onClose={() => setShowDeleteGuardModal(false)}
          title={language === 'ar' ? 'تأكيد الحذف / الإلغاء الآمن' : 'Safe Record Management Guard'}
          size="md"
        >
          <div className="space-y-4 p-1">
            <div className="flex items-start space-x-3 rtl:space-x-reverse bg-amber-50 p-3 rounded border border-amber-200 text-amber-900 text-xs">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">GulfHive Authorized Deletion Policy</span>
                <p className="text-[11px] leading-relaxed">
                  The system will automatically analyze other active operational dependencies of this record. 
                  Draft records will be physically deleted, while active/posted transactions will use soft-deletions or financial voids to maintain accounting integrity.
                </p>
              </div>
            </div>

            <div className="text-xs space-y-1 bg-slate-50 p-3 rounded border">
              <div className="flex justify-between">
                <span className="text-slate-500">Record Type:</span>
                <span className="font-mono uppercase font-bold text-slate-800">{deleteTarget.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Record ID:</span>
                <span className="font-mono text-slate-800">{deleteTarget.id}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Reason / سبب الإجراء (Required for voids)</label>
              <Input
                placeholder="E.g. Correction / Duplicate entry"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2">
              <Button variant="secondary" onClick={() => setShowDeleteGuardModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={executeDelete}>
                Confirm Delete / Void
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ==========================================
          MODAL: NEW CLIENT
          ========================================== */}
      {showClientModal && (
        <Dialog
          isOpen={showClientModal}
          onClose={() => setShowClientModal(false)}
          title={language === 'ar' ? 'إضافة عميل جديد' : 'Register New Customer Profile'}
          size="md"
        >
          <form onSubmit={handleCreateClient} className="space-y-4 p-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Client Code / كود العميل</label>
                <Input required value={newClient.code} onChange={(e) => setNewClient({ ...newClient, code: e.target.value })} placeholder="CLI-001" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">CR Number / السجل التجاري</label>
                <Input value={newClient.crNumber} onChange={(e) => setNewClient({ ...newClient, crNumber: e.target.value })} placeholder="E.g. 1984210" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Legal Name (English)</label>
              <Input required value={newClient.nameEn} onChange={(e) => setNewClient({ ...newClient, nameEn: e.target.value })} placeholder="Client Legal Name" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">الاسم القانوني (عربي)</label>
              <Input required value={newClient.nameAr} onChange={(e) => setNewClient({ ...newClient, nameAr: e.target.value })} placeholder="اسم الشركة بالعربي" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Email</label>
                <Input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="finance@client.com" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
                <Input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="+965 2200 1100" />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowClientModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save Profile
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ==========================================
          MODAL: NEW QUOTATION
          ========================================== */}
      {showQuotationModal && (
        <Dialog
          isOpen={showQuotationModal}
          onClose={() => setShowQuotationModal(false)}
          title={language === 'ar' ? 'عرض سعر رسمي جديد' : 'New Professional Quotation'}
          size="lg"
        >
          <form onSubmit={handleCreateQuotation} className="space-y-4 p-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Customer</label>
                <Select required value={newQuote.clientId} onChange={(e) => setNewQuotation({ ...newQuote, clientId: e.target.value })}>
                  <option value="">-- Choose Client --</option>
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} - {c.nameEn}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
                <Input required type="date" value={newQuote.quotationDate} onChange={(e) => setNewQuotation({ ...newQuote, quotationDate: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Valid Until</label>
                <Input required type="date" value={newQuote.validUntil} onChange={(e) => setNewQuotation({ ...newQuote, validUntil: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Currency</label>
                <Select value={newQuote.currency} onChange={(e) => setNewQuotation({ ...newQuote, currency: e.target.value })}>
                  <option value="KWD">KWD (Kuwait)</option>
                  <option value="SAR">SAR (Saudi)</option>
                  <option value="AED">AED (UAE)</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Subject / الموضوع</label>
              <Input value={newQuote.subject} onChange={(e) => setNewQuotation({ ...newQuote, subject: e.target.value })} placeholder="E.g. Cleaning Services Proposal" />
            </div>

            {/* Line Items */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase">Line Items / بنود عرض السعر</h4>
                <Button variant="secondary" size="sm" type="button" onClick={addQuoteLine}>Add Item Line</Button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {newQuote.lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center bg-slate-50 p-2 rounded border">
                    <div className="md:col-span-2">
                      <Input
                        required
                        placeholder="Description / الوصف"
                        value={line.description}
                        onChange={(e) => {
                          const updated = [...newQuote.lines];
                          updated[idx].description = e.target.value;
                          setNewQuotation({ ...newQuote, lines: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        required
                        type="number"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) => {
                          const updated = [...newQuote.lines];
                          updated[idx].quantity = e.target.value;
                          setNewQuotation({ ...newQuote, lines: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        required
                        placeholder="Unit Price"
                        value={line.unitPrice}
                        onChange={(e) => {
                          const updated = [...newQuote.lines];
                          updated[idx].unitPrice = e.target.value;
                          setNewQuotation({ ...newQuote, lines: updated });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowQuotationModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save Draft Quotation
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ==========================================
          MODAL: NEW DIRECT INVOICE
          ========================================== */}
      {showInvoiceModal && (
        <Dialog
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          title={language === 'ar' ? 'فاتورة مبيعات مباشرة جديدة' : 'New Direct Sales Invoice'}
          size="lg"
        >
          <form onSubmit={handleCreateInvoice} className="space-y-4 p-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Customer</label>
                <Select required value={newInvoice.clientId} onChange={(e) => setNewInvoice({ ...newInvoice, clientId: e.target.value })}>
                  <option value="">-- Choose Client --</option>
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} - {c.nameEn}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Invoice Date</label>
                <Input required type="date" value={newInvoice.invoiceDate} onChange={(e) => setNewInvoice({ ...newInvoice, invoiceDate: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Due Date</label>
                <Input required type="date" value={newInvoice.dueDate} onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Currency</label>
                <Select value={newInvoice.currency} onChange={(e) => setNewInvoice({ ...newInvoice, currency: e.target.value })}>
                  <option value="KWD">KWD</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                </Select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase">Invoice Items / بنود الفاتورة</h4>
                <Button variant="secondary" size="sm" type="button" onClick={addInvoiceLine}>Add Item Line</Button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {newInvoice.lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center bg-slate-50 p-2 rounded border">
                    <div className="md:col-span-2">
                      <Input
                        required
                        placeholder="Description / الوصف"
                        value={line.description}
                        onChange={(e) => {
                          const updated = [...newInvoice.lines];
                          updated[idx].description = e.target.value;
                          setNewInvoice({ ...newInvoice, lines: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        required
                        type="number"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) => {
                          const updated = [...newInvoice.lines];
                          updated[idx].quantity = e.target.value;
                          setNewInvoice({ ...newInvoice, lines: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        required
                        placeholder="Unit Price"
                        value={line.unitPrice}
                        onChange={(e) => {
                          const updated = [...newInvoice.lines];
                          updated[idx].unitPrice = e.target.value;
                          setNewInvoice({ ...newInvoice, lines: updated });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowInvoiceModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save Draft Invoice
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ==========================================
          MODAL: NEW RECEIPT & ALLOCATIONS
          ========================================== */}
      {showReceiptModal && (
        <Dialog
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          title={language === 'ar' ? 'سند قبض وتوزيع دفعات' : 'New Customer Payment Receipt'}
          size="lg"
        >
          <form onSubmit={handleCreateReceipt} className="space-y-4 p-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Customer</label>
                <Select required value={newReceipt.clientId} onChange={(e) => handleLoadClientInvoicesForAllocation(e.target.value)}>
                  <option value="">-- Choose Client --</option>
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} - {c.nameEn}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Receipt Date</label>
                <Input required type="date" value={newReceipt.receiptDate} onChange={(e) => setNewReceipt({ ...newReceipt, receiptDate: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Currency</label>
                <Select value={newReceipt.currency} onChange={(e) => setNewReceipt({ ...newReceipt, currency: e.target.value })}>
                  <option value="KWD">KWD</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Method</label>
                <Select value={newReceipt.paymentMethod} onChange={(e) => setNewReceipt({ ...newReceipt, paymentMethod: e.target.value })}>
                  <option value="CASH">CASH</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="CHECK">CHECK</option>
                  <option value="CREDIT_CARD">CREDIT CARD</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase font-bold text-slate-900">Amount Received / القيمة المقبوضة</label>
              <Input required value={newReceipt.amount} onChange={(e) => setNewReceipt({ ...newReceipt, amount: e.target.value })} placeholder="0.000" />
            </div>

            {/* Invoices Allocation Section */}
            <div className="space-y-2 border-t pt-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase">Receipt Allocations / ربط الدفعات بالفواتير المستحقة</h4>
              <p className="text-[10px] text-slate-500">
                You can allocate this payment to multiple outstanding posted invoices below. Remaining value will automatically persist as unallocated customer credit.
              </p>

              {newReceipt.allocations.length === 0 ? (
                <div className="p-4 bg-slate-50 text-center text-xs text-slate-400 border rounded">
                  No outstanding posted invoices available in selected currency for this client.
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {newReceipt.allocations.map((alloc, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 items-center bg-slate-50 p-2 rounded border text-xs">
                      <div>
                        <span className="font-bold font-mono text-slate-700">{alloc.invoiceNumber}</span>
                      </div>
                      <div className="text-slate-500">
                        Outstanding: <span className="font-bold text-slate-800">{parseFloat(alloc.outstanding).toFixed(3)}</span>
                      </div>
                      <div>
                        <Input
                          placeholder="Allocated amount"
                          value={alloc.amount}
                          onChange={(e) => {
                            const updated = [...newReceipt.allocations];
                            updated[idx].amount = e.target.value;
                            setNewReceipt({ ...newReceipt, allocations: updated });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowReceiptModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Post Payment Receipt
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ==========================================
          MODAL: NEW DISPATCH DELIVERY
          ========================================== */}
      {showDeliveryModal && (
        <Dialog
          isOpen={showDeliveryModal}
          onClose={() => setShowDeliveryModal(false)}
          title="Dispatch Operational Delivery Note"
          size="md"
        >
          <form onSubmit={handleCreateDelivery} className="space-y-4 p-1">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Delivery Date</label>
              <Input required type="date" value={newDelivery.deliveryDate} onChange={(e) => setNewDelivery({ ...newDelivery, deliveryDate: e.target.value })} />
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase">Items to Dispatch</h4>
              {newDelivery.lines.map((line, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border rounded space-y-1.5 text-xs">
                  <div className="font-semibold">{line.description}</div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500">
                    <span>Pending Order Balance: {line.pendingQty}</span>
                    <div className="w-24">
                      <Input
                        value={line.deliverQty}
                        onChange={(e) => {
                          const updated = [...newDelivery.lines];
                          updated[idx].deliverQty = e.target.value;
                          setNewDelivery({ ...newDelivery, lines: updated });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowDeliveryModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Confirm & Dispatch
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ==========================================
          MODAL: NEW CREDIT NOTE
          ========================================== */}
      {showCreditNoteModal && (
        <Dialog
          isOpen={showCreditNoteModal}
          onClose={() => setShowCreditNoteModal(false)}
          title="New Credit Note"
          size="lg"
        >
          <form onSubmit={handleCreateCreditNote} className="space-y-4 p-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Customer</label>
                <Select required value={newCreditNote.clientId} onChange={(e) => setNewCreditNote({ ...newCreditNote, clientId: e.target.value })}>
                  <option value="">-- Choose Client --</option>
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} - {c.nameEn}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Invoice reference (Optional)</label>
                <Select value={newCreditNote.invoiceId} onChange={(e) => setNewCreditNote({ ...newCreditNote, invoiceId: e.target.value })}>
                  <option value="">-- Independent credit --</option>
                  {invoicesList.filter(i => i.status === 'POSTED').map((i) => (
                    <option key={i.id} value={i.id}>{i.invoiceNumber} (Outstanding: {i.outstandingAmount})</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">CN Date</label>
                <Input required type="date" value={newCreditNote.creditNoteDate} onChange={(e) => setNewCreditNote({ ...newCreditNote, creditNoteDate: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Currency</label>
                <Select value={newCreditNote.currency} onChange={(e) => setNewCreditNote({ ...newCreditNote, currency: e.target.value })}>
                  <option value="KWD">KWD</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Adjustment Reason</label>
              <Input required value={newCreditNote.reason} onChange={(e) => setNewCreditNote({ ...newCreditNote, reason: e.target.value })} placeholder="E.g. Return of goods / Billing correction" />
            </div>

            {/* Credit Note Lines */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase">Adjustment Lines</h4>
                <Button variant="secondary" size="sm" type="button" onClick={addCreditNoteLine}>Add Item Line</Button>
              </div>

              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {newCreditNote.lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center bg-slate-50 p-2 rounded border text-xs">
                    <div className="md:col-span-2">
                      <Input
                        required
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => {
                          const updated = [...newCreditNote.lines];
                          updated[idx].description = e.target.value;
                          setNewCreditNote({ ...newCreditNote, lines: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        required
                        type="number"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) => {
                          const updated = [...newCreditNote.lines];
                          updated[idx].quantity = e.target.value;
                          setNewCreditNote({ ...newCreditNote, lines: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        required
                        placeholder="Unit Price"
                        value={line.unitPrice}
                        onChange={(e) => {
                          const updated = [...newCreditNote.lines];
                          updated[idx].unitPrice = e.target.value;
                          setNewCreditNote({ ...newCreditNote, lines: updated });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowCreditNoteModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Issue Credit Note
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ==========================================
          DETAIL VIEW: INVOICE DETAILS MODAL
          ========================================== */}
      {selectedInvoice && (
        <Dialog
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          title={`Invoice Details: ${selectedInvoice.invoiceNumber}`}
          size="lg"
        >
          <div className="space-y-4 p-1 text-xs text-slate-900">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Customer</span>
                <div className="font-semibold">{selectedInvoice.client?.nameEn}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Invoice Date</span>
                <div>{selectedInvoice.invoiceDate}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Due Date</span>
                <div>{selectedInvoice.dueDate}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Status</span>
                <div className="font-bold text-emerald-600">{selectedInvoice.status}</div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase text-[9px] font-bold">
                  <tr>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedInvoice.lines?.map((line: any, idx: number) => (
                    <tr key={idx}>
                      <td className="p-2">{line.description}</td>
                      <td className="p-2 text-right">{parseFloat(line.quantity).toFixed(2)}</td>
                      <td className="p-2 text-right">{parseFloat(line.unitPrice).toFixed(3)}</td>
                      <td className="p-2 text-right font-semibold">{parseFloat(line.lineTotal).toFixed(3)} {selectedInvoice.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedInvoice(null)}>Close</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ==========================================
          DETAIL VIEW: QUOTATION DETAILS MODAL
          ========================================== */}
      {selectedQuote && (
        <Dialog
          isOpen={!!selectedQuote}
          onClose={() => setSelectedQuotation(null)}
          title={`Quotation Details: ${selectedQuote.quotationNumber}`}
          size="lg"
        >
          <div className="space-y-4 p-1 text-xs text-slate-900">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Customer</span>
                <div className="font-semibold">{selectedQuote.client?.nameEn}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Quotation Date</span>
                <div>{selectedQuote.quotationDate}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Valid Until</span>
                <div>{selectedQuote.validUntil || 'N/A'}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Status</span>
                <div className="font-bold text-blue-600">{selectedQuote.status}</div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase text-[9px] font-bold">
                  <tr>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedQuote.lines?.map((line: any, idx: number) => (
                    <tr key={idx}>
                      <td className="p-2">{line.description}</td>
                      <td className="p-2 text-right">{parseFloat(line.quantity).toFixed(2)}</td>
                      <td className="p-2 text-right">{parseFloat(line.unitPrice).toFixed(3)}</td>
                      <td className="p-2 text-right font-semibold">{parseFloat(line.lineTotal).toFixed(3)} {selectedQuote.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedQuotation(null)}>Close</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ==========================================
          CLIENT MODALS: EDIT, PREFLIGHT, BULK & DRAWER
          ========================================== */}
      {showEditClientModal && clientToEdit && (
        <ClientEditModal
          isOpen={showEditClientModal}
          onClose={() => {
            setShowEditClientModal(false);
            setClientToEdit(null);
          }}
          client={clientToEdit}
          companyId={company.id}
          onSaved={() => {
            loadAllData();
          }}
        />
      )}

      {showClientPreflightModal && clientToDelete && (
        <ClientPreflightDeleteModal
          isOpen={showClientPreflightModal}
          onClose={() => {
            setShowClientPreflightModal(false);
            setClientToDelete(null);
          }}
          client={clientToDelete}
          companyId={company.id}
          onDeleted={() => {
            if (selectedClient?.id === clientToDelete.id) {
              setSelectedClient(null);
              setActiveStatement(null);
            }
            setSelectedClientIds((prev) => prev.filter((id) => id !== clientToDelete.id));
            loadAllData();
          }}
        />
      )}

      {showBulkClientDeleteModal && selectedClientIds.length > 0 && (
        <ClientBulkDeleteModal
          isOpen={showBulkClientDeleteModal}
          onClose={() => setShowBulkClientDeleteModal(false)}
          clientIds={selectedClientIds}
          companyId={company.id}
          onCompleted={() => {
            setSelectedClientIds([]);
            loadAllData();
          }}
        />
      )}

      {showDetailDrawer && drawerClientId && (
        <ClientDetailDrawer
          isOpen={showDetailDrawer}
          onClose={() => {
            setShowDetailDrawer(false);
            setDrawerClientId(null);
          }}
          clientId={drawerClientId}
          companyId={company.id}
          onEdit={(cl) => {
            setClientToEdit(cl);
            setShowEditClientModal(true);
          }}
          onViewStatement={(cId) => {
            setStmtClient(cId);
            setActiveModuleTab('clients');
            const target = clientsList.find((c) => c.id === cId);
            if (target) setSelectedClient(target);
            handleQueryStatement();
          }}
        />
      )}
    </div>
  );
}
