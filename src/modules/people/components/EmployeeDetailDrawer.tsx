/**
 * GulfHive ERP - Employee Detail Drawer
 * Slide-over inspecting authoritative employee record: contract, salary, WPS banking, documents, and history.
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
  Trash2
} from 'lucide-react';
import { EmployeeIdCard } from './EmployeeIdCard.tsx';

export interface EmployeeDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  company: any;
  onRefresh: () => void;
  onDelete?: (employee: any) => void;
}

export function EmployeeDetailDrawer({
  isOpen,
  onClose,
  employee,
  company,
  onRefresh,
  onDelete,
}: EmployeeDetailDrawerProps) {
  const { t, language } = useI18n();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'contract' | 'compensation' | 'documents' | 'history'>('profile');
  const [showIdCardModal, setShowIdCardModal] = useState<boolean>(false);
  const [showAddDocModal, setShowAddDocModal] = useState<boolean>(false);

  // Add Document Form State
  const [docForm, setDocForm] = useState({
    documentType: 'CIVIL_ID',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    issuingAuthority: '',
    issuingCountry: company?.countryCode || 'KW',
    notes: '',
  });
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);

  if (!employee) return null;

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.documentNumber || !docForm.expiryDate) {
      addToast({ type: 'error', title: 'Validation Error', message: 'Document number and expiry date are required.' });
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
        title: language === 'ar' ? 'تمت إضافة الوثيقة' : 'Document Attached',
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
        notes: '',
      });
      onRefresh();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsSubmittingDoc(false);
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
                variant="outline"
                size="sm"
                leftIcon={<Printer className="w-3.5 h-3.5" />}
                onClick={() => window.open(`/api/companies/${company.id}/employees/${employee.id}/id-card`, '_blank')}
              >
                {t('people.action.generate_id_card')}
              </Button>

              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileText className="w-3.5 h-3.5" />}
                onClick={() => window.open(`/api/companies/${company.id}/employees/${employee.id}/profile-pdf`, '_blank')}
              >
                {language === 'ar' ? 'تقرير ملف الموظف' : 'Export Profile PDF'}
              </Button>

              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                  leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
                  onClick={() => onDelete(employee)}
                >
                  {language === 'ar' ? 'حذف الموظف' : 'Delete'}
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
          {/* Header Identity Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center space-x-4 rtl:space-x-reverse">
            <div className="w-12 h-12 rounded bg-slate-900 text-white font-bold text-base flex items-center justify-center shrink-0">
              {employee.firstNameEn?.slice(0, 1)}
              {employee.lastNameEn?.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {language === 'ar' ? `${employee.firstNameAr} ${employee.lastNameAr}` : `${employee.firstNameEn} ${employee.lastNameEn}`}
                </h3>
                <span className="font-mono text-[11px] font-bold text-slate-600">
                  ({employee.employeeNumber})
                </span>
              </div>
              <p className="text-xs text-slate-500 font-arabic truncate">
                {language === 'ar' ? `${employee.firstNameEn} ${employee.lastNameEn}` : `${employee.firstNameAr} ${employee.lastNameAr}`}
              </p>
              <div className="mt-1 flex items-center space-x-2 rtl:space-x-reverse text-[11px] text-slate-500 font-mono">
                <span>{employee.designationNameEn || 'Staff'}</span>
                <span aria-hidden="true">·</span>
                <span>{employee.branchNameEn || 'Head Office'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-800">{employee.employmentStatus}</span>
              </div>
            </div>
          </div>

          {/* Drawer Segmented Controls */}
          <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 text-xs">
            {[
              { id: 'profile', label: 'Personal' },
              { id: 'contract', label: 'Contract' },
              { id: 'compensation', label: 'Compensation & WPS' },
              { id: 'documents', label: `Documents (${employee.documents?.length || 0})` },
              { id: 'history', label: `History (${employee.history?.length || 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-2xs'
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
              {/* Salary Breakdown */}
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

              {/* WPS Bank Routing */}
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
                <h4 className="font-bold text-slate-900">Identity & Statutory Documents</h4>
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
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-slate-100">
                    No documents attached yet.
                  </div>
                ) : (
                  employee.documents.map((doc: any) => {
                    const daysLeft = getDaysUntil(doc.expiryDate);
                    const isExpiring = daysLeft <= 60 && daysLeft >= 0;
                    const isExpired = daysLeft < 0;

                    return (
                      <div
                        key={doc.id}
                        className="p-3.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between font-mono"
                      >
                        <div>
                          <div className="flex items-center space-x-2 rtl:space-x-reverse">
                            <span className="font-bold text-slate-900">{doc.documentType}</span>
                            <span className="text-slate-600 font-semibold">{doc.documentNumber}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-2 rtl:space-x-reverse">
                            <span>Expires: {new Date(doc.expiryDate).toLocaleDateString()}</span>
                            {doc.issuingAuthority && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{doc.issuingAuthority}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right rtl:text-left">
                          {isExpired ? (
                            <span className="font-bold text-rose-600 text-[11px]">Expired ({Math.abs(daysLeft)}d ago)</span>
                          ) : isExpiring ? (
                            <span className="font-bold text-amber-600 text-[11px]">Expiring ({daysLeft}d left)</span>
                          ) : (
                            <span className="font-semibold text-emerald-700 text-[11px]">Valid ({daysLeft}d left)</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 5: Career & Revision History */}
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

      {/* ID Card Generation Dialog Modal */}
      <Dialog
        isOpen={showIdCardModal}
        onClose={() => setShowIdCardModal(false)}
        size="md"
        title={t('people.id_card.title')}
      >
        <EmployeeIdCard
          employee={employee}
          company={company}
          onClose={() => setShowIdCardModal(false)}
        />
      </Dialog>

      {/* Add Document Modal */}
      <Dialog
        isOpen={showAddDocModal}
        onClose={() => setShowAddDocModal(false)}
        size="md"
        title={t('people.action.add_document')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowAddDocModal(false)}>
              {t('action.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddDocument}
              isLoading={isSubmittingDoc}
            >
              {t('action.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddDocument} className="space-y-3.5 text-xs">
          <FormField label={t('people.field.document_type')} required>
            <Select
              value={docForm.documentType}
              onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })}
            >
              <option value="CIVIL_ID">Civil ID / Iqama / National ID</option>
              <option value="PASSPORT">Passport</option>
              <option value="RESIDENCY_VISA">Residency Visa</option>
              <option value="WORK_PERMIT">Work Permit</option>
              <option value="DRIVER_LICENSE">Driver License</option>
              <option value="CONTRACT_COPY">Contract Copy</option>
              <option value="OTHER">Other Credential</option>
            </Select>
          </FormField>

          <FormField label={t('people.field.document_number')} required>
            <Input
              type="text"
              value={docForm.documentNumber}
              onChange={(e) => setDocForm({ ...docForm, documentNumber: e.target.value })}
              placeholder="e.g. 293010101234"
              className="font-mono"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Issue Date">
              <Input
                type="date"
                value={docForm.issueDate}
                onChange={(e) => setDocForm({ ...docForm, issueDate: e.target.value })}
              />
            </FormField>

            <FormField label={t('people.field.expiry_date')} required>
              <Input
                type="date"
                value={docForm.expiryDate}
                onChange={(e) => setDocForm({ ...docForm, expiryDate: e.target.value })}
                required
              />
            </FormField>
          </div>

          <FormField label={t('people.field.issuing_authority')}>
            <Input
              type="text"
              value={docForm.issuingAuthority}
              onChange={(e) => setDocForm({ ...docForm, issuingAuthority: e.target.value })}
              placeholder="e.g. PACI, Ministry of Interior"
            />
          </FormField>
        </form>
      </Dialog>
    </>
  );
}
