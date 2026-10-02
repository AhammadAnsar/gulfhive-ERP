/**
 * GulfHive ERP - Employee Detail Drawer
 * Slide-over inspecting authoritative employee record: photo, documents, contract, salary, WPS banking, and history.
 */

import React, { useState } from 'react';
import { Drawer, Button, Dialog, FormField, Input, Select, useToast } from '../../../design-system/index.ts';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import {
  User,
  FileText,
  DollarSign,
  CreditCard,
  History,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Printer,
  Calendar,
  Building2,
  Mail,
  Phone,
  Globe,
  Trash2,
  Edit2,
  Paperclip,
  ExternalLink,
  Download,
  UploadCloud
} from 'lucide-react';
import { EmployeeIdCard } from './EmployeeIdCard.tsx';
import { EmployeeEditModal } from './EmployeeEditModal.tsx';

export interface EmployeeDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  company: any;
  branches?: any[];
  departments?: any[];
  designations?: any[];
  onRefresh: () => void;
  onDelete?: (employee: any) => void;
}

export function EmployeeDetailDrawer({
  isOpen,
  onClose,
  employee,
  company,
  branches = [],
  departments = [],
  designations = [],
  onRefresh,
  onDelete,
}: EmployeeDetailDrawerProps) {
  const { t, language } = useI18n();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'contract' | 'compensation' | 'documents' | 'history'>('profile');
  const [showIdCardModal, setShowIdCardModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showAddDocModal, setShowAddDocModal] = useState<boolean>(false);

  // Add Document Form State
  const [docForm, setDocForm] = useState({
    documentType: 'CIVIL_ID',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    issuingAuthority: '',
    issuingCountry: company?.countryCode || 'KW',
    fileName: '',
    attachmentUrl: '',
    notes: '',
  });
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);
  const [isDeletingDocId, setIsDeletingDocId] = useState<string | null>(null);

  if (!employee) return null;

  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addToast({
          type: 'error',
          title: language === 'ar' ? 'حجم الملف كبير' : 'File Too Large',
          message: language === 'ar' ? 'يجب ألا يتجاوز حجم الملف 5 ميجابايت' : 'Maximum document size is 5MB',
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setDocForm((prev) => ({
          ...prev,
          fileName: file.name,
          attachmentUrl: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.documentNumber || !docForm.expiryDate) {
      addToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Document number and expiry date are required.',
      });
      return;
    }

    setIsSubmittingDoc(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/employees/${employee.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to attach document');
      }

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تمت إضافة الوثيقة' : 'Document Attached Successfully',
        message: `${docForm.documentType} - ${docForm.documentNumber}`,
      });

      setShowAddDocModal(false);
      setDocForm({
        documentType: 'CIVIL_ID',
        documentNumber: '',
        issueDate: '',
        expiryDate: '',
        issuingAuthority: '',
        issuingCountry: company?.countryCode || 'KW',
        fileName: '',
        attachmentUrl: '',
        notes: '',
      });
      onRefresh();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsSubmittingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string, docType: string) => {
    if (!window.confirm(language === 'ar' ? `هل أنت متأكد من حذف هذه الوثيقة (${docType})؟` : `Are you sure you want to delete document (${docType})?`)) {
      return;
    }

    setIsDeletingDocId(docId);
    try {
      const res = await fetch(`/api/companies/${company.id}/employees/${employee.id}/documents/${docId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete document');
      }

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم حذف الوثيقة' : 'Document Deleted',
        message: docType,
      });

      onRefresh();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Delete Failed', message: err.message });
    } finally {
      setIsDeletingDocId(null);
    }
  };

  const activeSalary = employee.salaries?.[0];
  const activeContract = employee.contracts?.[0];
  const bankDetails = employee.bankDetails;

  const totalCompensation = (
    parseFloat(activeSalary?.basicSalary || '0') +
    parseFloat(activeSalary?.housingAllowance || '0') +
    parseFloat(activeSalary?.transportAllowance || '0') +
    parseFloat(activeSalary?.otherAllowances || '0')
  ).toFixed(3);

  const getDaysUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const hasPhoto = employee.avatarUrl || employee.photoPath;

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        width="lg"
        title={`${employee.firstNameEn} ${employee.lastNameEn}`}
        subtitle={`${employee.employeeNumber} · ${employee.departmentNameEn || 'General'} · ${employee.branchCode || 'HQ'}`}
        footer={
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                onClick={() => setShowEditModal(true)}
              >
                {language === 'ar' ? 'تعديل بيانات الموظف' : 'Edit Employee'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                leftIcon={<Printer className="w-3.5 h-3.5" />}
                onClick={() => setShowIdCardModal(true)}
              >
                {t('people.action.generate_id_card')}
              </Button>

              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileText className="w-3.5 h-3.5" />}
                onClick={() => window.open(`/api/companies/${company.id}/employees/${employee.id}/profile-pdf`, '_blank')}
              >
                {language === 'ar' ? 'تقرير الملف' : 'Profile PDF'}
              </Button>

              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                  leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
                  onClick={() => onDelete(employee)}
                >
                  {language === 'ar' ? 'حذف' : 'Delete'}
                </Button>
              )}
            </div>

            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('action.cancel')}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Header Identity Card with Photo */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center space-x-4 rtl:space-x-reverse shadow-2xs">
            <div className="relative w-14 h-14 rounded-lg bg-slate-900 text-white font-bold text-lg flex items-center justify-center shrink-0 overflow-hidden border border-slate-300 shadow-sm">
              {hasPhoto ? (
                <img src={hasPhoto} alt="Employee Avatar" className="w-full h-full object-cover" />
              ) : (
                <>
                  {employee.firstNameEn?.slice(0, 1)}
                  {employee.lastNameEn?.slice(0, 1)}
                </>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {language === 'ar' ? `${employee.firstNameAr} ${employee.lastNameAr}` : `${employee.firstNameEn} ${employee.lastNameEn}`}
                  </h3>
                  <span className="font-mono text-[11px] font-bold text-slate-600">
                    ({employee.employeeNumber})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Edit2 className="w-3 h-3 text-slate-600" />
                  <span>{language === 'ar' ? 'تعديل' : 'Edit'}</span>
                </button>
              </div>

              <p className="text-xs text-slate-500 font-arabic truncate mt-0.5">
                {language === 'ar' ? `${employee.firstNameEn} ${employee.lastNameEn}` : `${employee.firstNameAr} ${employee.lastNameAr}`}
              </p>

              <div className="mt-1.5 flex items-center space-x-2 rtl:space-x-reverse text-[11px] text-slate-500 font-mono">
                <span>{employee.designationNameEn || employee.designationNameAr || 'Staff'}</span>
                <span aria-hidden="true">·</span>
                <span>{employee.branchNameEn || 'HQ'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-emerald-700">{employee.employmentStatus}</span>
              </div>
            </div>
          </div>

          {/* Drawer Segmented Controls */}
          <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 text-xs">
            {[
              { id: 'profile', label: language === 'ar' ? 'البيانات الشخصية' : 'Personal' },
              { id: 'contract', label: language === 'ar' ? 'العقد والتعيين' : 'Contract' },
              { id: 'compensation', label: language === 'ar' ? 'الراتب وحساب WPS' : 'Compensation & WPS' },
              { id: 'documents', label: language === 'ar' ? `الوثائق (${employee.documents?.length || 0})` : `Documents (${employee.documents?.length || 0})` },
              { id: 'history', label: language === 'ar' ? `السجل (${employee.history?.length || 0})` : `History (${employee.history?.length || 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: Profile & Contact */}
          {activeTab === 'profile' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 bg-white border border-slate-200 rounded-lg font-mono">
                <div>
                  <span className="text-slate-400 block mb-0.5">Nationality:</span>
                  <span className="font-semibold text-slate-900">{employee.nationality}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Gender:</span>
                  <span className="font-semibold text-slate-900">{employee.gender}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Civil ID / National ID:</span>
                  <span className="font-semibold text-slate-900">{employee.civilIdNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Passport Number:</span>
                  <span className="font-semibold text-slate-900">{employee.passportNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Official Email:</span>
                  <span className="text-slate-900 truncate block">{employee.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Phone:</span>
                  <span className="text-slate-900">{employee.phone || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block mb-0.5">Address:</span>
                  <span className="text-slate-900">{employee.addressEn || employee.addressAr || '—'}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Employment & Contract */}
          {activeTab === 'contract' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 bg-white border border-slate-200 rounded-lg font-mono">
                <div>
                  <span className="text-slate-400 block mb-0.5">Contract Number:</span>
                  <span className="font-semibold text-slate-900">{activeContract?.contractNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Contract Type:</span>
                  <span className="font-semibold text-slate-900">{employee.contractType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Joining Date:</span>
                  <span className="font-semibold text-slate-900">
                    {new Date(employee.joiningDate).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Contract End Date:</span>
                  <span className="font-semibold text-slate-900">
                    {activeContract?.endDate ? new Date(activeContract.endDate).toLocaleDateString() : 'Permanent / Unlimited'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Probation Period:</span>
                  <span className="text-slate-900">{activeContract?.probationPeriodDays || 90} Days</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Notice Period:</span>
                  <span className="text-slate-900">{activeContract?.noticePeriodDays || 90} Days</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Compensation & WPS Banking */}
          {activeTab === 'compensation' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 font-bold text-slate-900">
                  <span>Salary Structure</span>
                  <span className="font-mono text-emerald-700">
                    Total: {totalCompensation} {activeSalary?.currency || company?.baseCurrency}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <span className="text-slate-400 block">Basic Salary:</span>
                    <span className="font-bold text-slate-900">{activeSalary?.basicSalary || '0.000'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Housing Allowance:</span>
                    <span className="text-slate-900">{activeSalary?.housingAllowance || '0.000'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Transport Allowance:</span>
                    <span className="text-slate-900">{activeSalary?.transportAllowance || '0.000'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Other Allowances:</span>
                    <span className="text-slate-900">{activeSalary?.otherAllowances || '0.000'}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 font-bold text-slate-900">
                  <div className="flex items-center space-x-1.5 rtl:space-x-reverse">
                    <CreditCard className="w-4 h-4 text-slate-700" />
                    <span>Wage Protection System (WPS) Account</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-emerald-700">Verified</span>
                </div>
                {bankDetails ? (
                  <div className="grid grid-cols-2 gap-3 font-mono">
                    <div>
                      <span className="text-slate-400 block">Bank Name:</span>
                      <span className="font-semibold text-slate-900">{bankDetails.bankName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Routing / WPS Code:</span>
                      <span className="text-slate-900">{bankDetails.bankCode || '—'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block">IBAN:</span>
                      <span className="font-bold text-slate-900 tracking-wider">{bankDetails.iban}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Account Number:</span>
                      <span className="text-slate-900">{bankDetails.accountNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">SWIFT / BIC:</span>
                      <span className="text-slate-900">{bankDetails.swiftBic || '—'}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No bank account registered for WPS transfers.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Identity & Compliance Documents */}
          {activeTab === 'documents' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">
                    {language === 'ar' ? 'الوثائق الثبوتية والشهادات' : 'Identity & Statutory Documents'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {language === 'ar' ? 'متابعة صلاحية البطاقة المدنية، جواز السفر، عقود العمل، والشهادات مع المرفقات.' : 'Track Civil ID, Passport, Work Permit, and Contract validity with attachments.'}
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setShowAddDocModal(true)}
                >
                  {t('people.action.add_document')}
                </Button>
              </div>

              <div className="space-y-2.5">
                {!employee.documents || employee.documents.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                    {language === 'ar' ? 'لا توجد وثائق مرفقة بعد. انقر على "إضافة وثيقة" بالأعلى.' : 'No documents attached yet. Click "Add Document" above.'}
                  </div>
                ) : (
                  employee.documents.map((doc: any) => {
                    const daysLeft = getDaysUntil(doc.expiryDate);
                    const isExpiring = daysLeft <= 60 && daysLeft >= 0;
                    const isExpired = daysLeft < 0;

                    return (
                      <div
                        key={doc.id}
                        className="p-3.5 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono shadow-2xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 rtl:space-x-reverse">
                            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {doc.documentType}
                            </span>
                            <span className="text-slate-800 font-semibold">{doc.documentNumber}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                            <span>Expires: {new Date(doc.expiryDate).toLocaleDateString()}</span>
                            {doc.issuingAuthority && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{doc.issuingAuthority}</span>
                              </>
                            )}
                            {doc.fileName && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-700 flex items-center gap-1 font-sans">
                                  <Paperclip className="w-3 h-3" />
                                  {doc.fileName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 rtl:space-x-reverse shrink-0">
                          <div>
                            {isExpired ? (
                              <span className="font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[10px]">
                                Expired ({Math.abs(daysLeft)}d ago)
                              </span>
                            ) : isExpiring ? (
                              <span className="font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px]">
                                Expiring ({daysLeft}d left)
                              </span>
                            ) : (
                              <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                                Valid ({daysLeft}d left)
                              </span>
                            )}
                          </div>

                          {doc.attachmentUrl && (
                            <a
                              href={doc.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              download={doc.fileName || `${doc.documentType}_${doc.documentNumber}`}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 transition"
                              title="Download Attachment"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <button
                            type="button"
                            disabled={isDeletingDocId === doc.id}
                            onClick={() => handleDeleteDocument(doc.id, doc.documentType)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 5: History */}
          {activeTab === 'history' && (
            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-slate-900 mb-2">Audit & Employment History</h4>
              <div className="relative border-s border-slate-200 ms-3 space-y-4">
                {employee.history?.map((h: any) => (
                  <div key={h.id} className="relative ps-6">
                    <div className="absolute -start-1.5 top-1.5 w-3 h-3 rounded-full bg-slate-900 ring-4 ring-white" />
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{h.changeType}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {new Date(h.effectiveDate).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5">{language === 'ar' ? h.descriptionAr : h.descriptionEn}</p>
                    {h.recordedBy && (
                      <span className="text-[10px] text-slate-400 font-mono block mt-1">Recorded by: {h.recordedBy}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Drawer>

      {/* MODAL: ADD DOCUMENT */}
      {showAddDocModal && (
        <Dialog
          isOpen={showAddDocModal}
          onClose={() => setShowAddDocModal(false)}
          title={language === 'ar' ? 'إرفاق وثيقة ثبوتية جديدة' : 'Attach New Employee Document'}
          description={language === 'ar' ? 'تسجيل وثيقة جديدة للموظف مع تتبع تاريخ الانتهاء ورفع المرفق.' : 'Record employee document with expiry monitoring and attachment file.'}
          footer={
            <div className="flex justify-end space-x-2 rtl:space-x-reverse">
              <Button variant="outline" size="sm" onClick={() => setShowAddDocModal(false)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" size="sm" onClick={handleAddDocument} isLoading={isSubmittingDoc}>
                {language === 'ar' ? 'حفظ الوثيقة' : 'Attach Document'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleAddDocument} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <FormField label={language === 'ar' ? 'نوع الوثيقة' : 'Document Type'} required>
                <Select
                  value={docForm.documentType}
                  onChange={(e) => setDocForm((p) => ({ ...p, documentType: e.target.value }))}
                  options={[
                    { value: 'CIVIL_ID', label: language === 'ar' ? 'البطاقة المدنية (Civil ID)' : 'Civil ID / National ID' },
                    { value: 'PASSPORT', label: language === 'ar' ? 'جواز السفر (Passport)' : 'Passport' },
                    { value: 'RESIDENCY_VISA', label: language === 'ar' ? 'الإقامة / فيزا (Residency)' : 'Residency Visa' },
                    { value: 'WORK_PERMIT', label: language === 'ar' ? 'إذن العمل (Work Permit)' : 'Work Permit' },
                    { value: 'DRIVER_LICENSE', label: language === 'ar' ? 'رخصة القيادة (Driving License)' : 'Driving License' },
                    { value: 'CONTRACT_COPY', label: language === 'ar' ? 'عقد العمل (Contract Copy)' : 'Employment Contract' },
                    { value: 'DIPLOMA', label: language === 'ar' ? 'الشهادة العلمية (Degree)' : 'Educational Certificate' },
                    { value: 'OTHER', label: language === 'ar' ? 'أخرى (Other)' : 'Other Document' },
                  ]}
                />
              </FormField>

              <FormField label={language === 'ar' ? 'رقم الوثيقة' : 'Document Number'} required>
                <Input
                  value={docForm.documentNumber}
                  onChange={(e) => setDocForm((p) => ({ ...p, documentNumber: e.target.value }))}
                  placeholder="290010101234"
                  className="font-mono"
                  required
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}>
                <Input
                  type="date"
                  value={docForm.issueDate}
                  onChange={(e) => setDocForm((p) => ({ ...p, issueDate: e.target.value }))}
                />
              </FormField>
              <FormField label={language === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'} required>
                <Input
                  type="date"
                  value={docForm.expiryDate}
                  onChange={(e) => setDocForm((p) => ({ ...p, expiryDate: e.target.value }))}
                  required
                />
              </FormField>
            </div>

            <FormField label={language === 'ar' ? 'جهة الإصدار' : 'Issuing Authority'}>
              <Input
                value={docForm.issuingAuthority}
                onChange={(e) => setDocForm((p) => ({ ...p, issuingAuthority: e.target.value }))}
                placeholder="e.g. PACI / Ministry of Interior"
              />
            </FormField>

            {/* Document File Attachment */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="font-bold text-slate-800">
                {language === 'ar' ? 'الملف المرفق (PDF أو صورة)' : 'Attachment File (PDF or Image)'}
              </div>
              <div className="flex items-center gap-3">
                <label className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium text-xs hover:bg-slate-100 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs">
                  <UploadCloud className="w-4 h-4 text-slate-600" />
                  <span>{docForm.fileName ? (language === 'ar' ? 'تغيير الملف' : 'Change File') : (language === 'ar' ? 'اختيار ملف' : 'Choose File')}</span>
                  <input type="file" accept=".pdf,image/*" onChange={handleDocFileChange} className="hidden" />
                </label>
                {docForm.fileName && (
                  <span className="font-mono text-emerald-700 text-xs flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" />
                    {docForm.fileName}
                  </span>
                )}
              </div>
            </div>

            <FormField label={language === 'ar' ? 'ملاحظات' : 'Notes'}>
              <Input
                value={docForm.notes}
                onChange={(e) => setDocForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </FormField>
          </form>
        </Dialog>
      )}

      {/* MODAL: EDIT EMPLOYEE */}
      {showEditModal && (
        <EmployeeEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          employee={employee}
          company={company}
          branches={branches}
          departments={departments}
          designations={designations}
          onEmployeeUpdated={() => {
            onRefresh();
          }}
        />
      )}

      {/* MODAL: ID CARD */}
      {showIdCardModal && (
        <Dialog
          isOpen={showIdCardModal}
          onClose={() => setShowIdCardModal(false)}
          title={t('people.action.generate_id_card')}
          size="md"
          footer={
            <div className="flex justify-end space-x-2 rtl:space-x-reverse">
              <Button variant="secondary" size="sm" onClick={() => setShowIdCardModal(false)}>
                {t('action.cancel')}
              </Button>
              <Button variant="primary" size="sm" onClick={() => window.print()}>
                {t('action.print')}
              </Button>
            </div>
          }
        >
          <EmployeeIdCard employee={employee} company={company} />
        </Dialog>
      )}
    </>
  );
}
