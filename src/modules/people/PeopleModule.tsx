/**
 * GulfHive ERP - People Module Workspace
 * Complete management of Employee Master, Departments, Designations, Contracts, and Expiry Alerts.
 */

import React, { useState, useEffect } from 'react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import {
  Users,
  Building2,
  Briefcase,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  CreditCard,
  Printer,
  Trash2
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Table,
  Column,
  Dialog,
  FormField,
  useToast,
  LoadingState,
  ErrorState
} from '../../design-system/index.ts';
import { EmployeeDetailDrawer } from './components/EmployeeDetailDrawer.tsx';
import { NewEmployeeDialog } from './components/NewEmployeeDialog.tsx';

export interface PeopleModuleProps {
  company: any;
  branches: any[];
  activeBranchId: string;
}

export function PeopleModule({ company, branches, activeBranchId }: PeopleModuleProps) {
  const { t, language } = useI18n();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'designations' | 'expiring_docs'>('employees');

  // Data states
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [designationsList, setDesignationsList] = useState<any[]>([]);
  const [expiringDocsList, setExpiringDocsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected Employee for Detailed Drawer
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Row Selection State for Employees
  const [selectedEmpKeys, setSelectedEmpKeys] = useState<Set<string | number>>(new Set());
  const [allFilteredSelected, setAllFilteredSelected] = useState(false);

  // Bulk Preflight & Execution State
  const [isPreflightLoading, setIsPreflightLoading] = useState(false);
  const [preflightData, setPreflightData] = useState<any | null>(null);
  const [showPreflightDialog, setShowPreflightDialog] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'DELETE' | 'ARCHIVE'>('DELETE');
  const [isExecutingBulk, setIsExecutingBulk] = useState(false);
  const [bulkActionConfirmText, setBulkActionConfirmText] = useState('');

  // Modals
  const [showNewEmpDialog, setShowNewEmpDialog] = useState(false);
  const [showNewDeptDialog, setShowNewDeptDialog] = useState(false);
  const [showNewDesigDialog, setShowNewDesigDialog] = useState(false);

  // Employee Deletion State
  const [empToDelete, setEmpToDelete] = useState<any | null>(null);
  const [isDeletingEmp, setIsDeletingEmp] = useState(false);

  // Department Form
  const [deptForm, setDeptForm] = useState({ code: '', nameEn: '', nameAr: '' });
  const [isSubmittingDept, setIsSubmittingDept] = useState(false);

  // Designation Form
  const [desigForm, setDesigForm] = useState({ code: '', nameEn: '', nameAr: '', departmentId: '', grade: '' });
  const [isSubmittingDesig, setIsSubmittingDesig] = useState(false);

  const loadAllData = async () => {
    if (!company?.id) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSelectedEmpKeys(new Set());
    setAllFilteredSelected(false);

    try {
      const [empRes, deptRes, desigRes, docRes] = await Promise.all([
        fetch(`/api/companies/${company.id}/employees`),
        fetch(`/api/companies/${company.id}/departments`),
        fetch(`/api/companies/${company.id}/designations`),
        fetch(`/api/companies/${company.id}/expiring-documents?daysAhead=90`),
      ]);

      if (empRes.ok) {
        const data = await empRes.json();
        setEmployeesList(data.employees || []);
      }
      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartmentsList(data.departments || []);
      }
      if (desigRes.ok) {
        const data = await desigRes.json();
        setDesignationsList(data.designations || []);
      }
      if (docRes.ok) {
        const data = await docRes.json();
        setExpiringDocsList(data.documents || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load People module data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSelectedEmpKeys(new Set());
    setAllFilteredSelected(false);
  }, [activeTab]);

  const handlePreflightBulkAction = async (action: 'DELETE' | 'ARCHIVE') => {
    if (selectedEmpKeys.size === 0) return;
    setBulkActionType(action);
    setIsPreflightLoading(true);
    setBulkActionConfirmText('');

    try {
      const ids = Array.from(selectedEmpKeys);
      const res = await fetch(`/api/companies/${company.id}/employees/bulk-delete/preflight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: ids,
          allFiltered: allFilteredSelected,
        }),
      });

      if (!res.ok) throw new Error('Bulk action preflight check failed');
      const data = await res.json();
      setPreflightData(data);
      setShowPreflightDialog(true);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Preflight Error',
        message: err.message,
      });
    } finally {
      setIsPreflightLoading(false);
    }
  };

  const handleExecuteBulkAction = async () => {
    if (!preflightData) return;
    if (bulkActionType === 'DELETE' && bulkActionConfirmText !== 'DELETE') {
      addToast({
        type: 'error',
        title: language === 'ar' ? 'تأكيد مطلوب' : 'Confirmation Required',
        message: language === 'ar' ? 'الرجاء كتابة كلمة DELETE للتأكيد' : 'Please type DELETE to confirm permanent deletion',
      });
      return;
    }

    setIsExecutingBulk(true);
    try {
      const ids = Array.from(selectedEmpKeys);
      const res = await fetch(`/api/companies/${company.id}/employees/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: ids,
          allFiltered: allFilteredSelected,
          action: bulkActionType,
          actorId: 'admin_user',
          actorEmail: 'admin@gulfhive.erp',
        }),
      });

      if (!res.ok) throw new Error('Bulk execution failed');
      const result = await res.json();

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم اكتمال العملية الجماعية' : 'Bulk Operation Completed',
        message: language === 'ar'
          ? `المطلوب: ${result.requested}, المحذوف: ${result.deleted}, المؤرشف: ${result.archived}, المحمي: ${result.protected}, الفاشل: ${result.failed}`
          : `Requested: ${result.requested}, Deleted: ${result.deleted}, Archived: ${result.archived}, Protected: ${result.protected}, Failed: ${result.failed}`,
      });

      setShowPreflightDialog(false);
      setPreflightData(null);
      setSelectedEmpKeys(new Set());
      setAllFilteredSelected(false);
      loadAllData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Bulk Error',
        message: err.message,
      });
    } finally {
      setIsExecutingBulk(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [company?.id]);

  const handleOpenDetail = async (empId: string) => {
    try {
      const res = await fetch(`/api/companies/${company.id}/employees/${empId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedEmployee(data.employee);
        setIsDetailOpen(true);
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'Could not fetch employee profile' });
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.code || !deptForm.nameEn || !deptForm.nameAr) return;
    setIsSubmittingDept(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deptForm),
      });
      if (!res.ok) throw new Error('Failed to create department');
      addToast({ type: 'success', title: 'Department Created', message: deptForm.code });
      setShowNewDeptDialog(false);
      setDeptForm({ code: '', nameEn: '', nameAr: '' });
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsSubmittingDept(false);
    }
  };

  const handleCreateDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desigForm.code || !desigForm.nameEn || !desigForm.nameAr) return;
    setIsSubmittingDesig(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/designations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(desigForm),
      });
      if (!res.ok) throw new Error('Failed to create designation');
      addToast({ type: 'success', title: 'Designation Created', message: desigForm.code });
      setShowNewDesigDialog(false);
      setDesigForm({ code: '', nameEn: '', nameAr: '', departmentId: '', grade: '' });
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setIsSubmittingDesig(false);
    }
  };

  // Table Columns
  const confirmDeleteEmployee = async () => {
    if (!empToDelete?.id) return;
    setIsDeletingEmp(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/employees/${empToDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete employee');
      }
      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم حذف الموظف' : 'Employee Deleted',
        message: `${empToDelete.firstNameEn} ${empToDelete.lastNameEn} (${empToDelete.employeeNumber})`,
      });
      setEmpToDelete(null);
      if (selectedEmployee?.id === empToDelete.id) {
        setIsDetailOpen(false);
        setSelectedEmployee(null);
      }
      loadAllData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Delete Error', message: err.message });
    } finally {
      setIsDeletingEmp(false);
    }
  };

  const employeeColumns: Column<any>[] = [
    {
      key: 'employeeNumber',
      header: t('people.field.emp_number'),
      sortable: true,
      width: '12%',
      render: (e) => <span className="font-mono font-bold text-slate-900">{e.employeeNumber}</span>,
    },
    {
      key: 'name',
      header: 'Employee Name',
      sortable: true,
      width: '24%',
      render: (e) => (
        <div>
          <span className="font-semibold text-slate-900 block">
            {language === 'ar' ? `${e.firstNameAr} ${e.lastNameAr}` : `${e.firstNameEn} ${e.lastNameEn}`}
          </span>
          <span className="text-[11px] text-slate-400 block font-mono">
            {e.email}
          </span>
        </div>
      ),
    },
    {
      key: 'designation',
      header: 'Role / Designation',
      sortable: true,
      render: (e) => (
        <span className="font-medium text-slate-800">
          {language === 'ar' ? e.designationNameAr || '—' : e.designationNameEn || '—'}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      render: (e) => (
        <span className="text-slate-600">
          {language === 'ar' ? e.departmentNameAr || '—' : e.departmentNameEn || '—'}
        </span>
      ),
    },
    {
      key: 'branch',
      header: 'Branch',
      render: (e) => <span className="font-mono text-slate-600">{e.branchCode || 'HQ'}</span>,
    },
    {
      key: 'joiningDate',
      header: t('people.field.joining_date'),
      sortable: true,
      render: (e) => (
        <span className="font-mono text-slate-500 text-[11px]">
          {new Date(e.joiningDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => (
        <span className="font-mono text-[11px] font-semibold text-slate-800">
          {e.employmentStatus}
        </span>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (e) => (
        <div className="flex items-center justify-end space-x-1.5 rtl:space-x-reverse">
          <Button size="sm" variant="secondary" onClick={() => handleOpenDetail(e.id)}>
            {t('action.view')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            onClick={(ev) => {
              ev.stopPropagation();
              setEmpToDelete(e);
            }}
            title={language === 'ar' ? 'حذف الموظف' : 'Delete Employee'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const departmentColumns: Column<any>[] = [
    {
      key: 'code',
      header: t('people.field.dept_code'),
      sortable: true,
      width: '20%',
      render: (d) => <span className="font-mono font-bold text-slate-900">{d.code}</span>,
    },
    {
      key: 'nameEn',
      header: t('people.field.dept_name_en'),
      sortable: true,
      render: (d) => <span className="font-medium text-slate-900">{d.nameEn}</span>,
    },
    {
      key: 'nameAr',
      header: t('people.field.dept_name_ar'),
      sortable: true,
      render: (d) => <span className="font-arabic font-medium text-slate-900">{d.nameAr}</span>,
    },
  ];

  const designationColumns: Column<any>[] = [
    {
      key: 'code',
      header: t('people.field.desig_code'),
      sortable: true,
      width: '18%',
      render: (d) => <span className="font-mono font-bold text-slate-900">{d.code}</span>,
    },
    {
      key: 'nameEn',
      header: t('people.field.desig_name_en'),
      sortable: true,
      render: (d) => <span className="font-medium text-slate-900">{d.nameEn}</span>,
    },
    {
      key: 'nameAr',
      header: t('people.field.desig_name_ar'),
      sortable: true,
      render: (d) => <span className="font-arabic font-medium text-slate-900">{d.nameAr}</span>,
    },
    {
      key: 'department',
      header: 'Department',
      render: (d) => <span>{d.departmentNameEn || '—'}</span>,
    },
    {
      key: 'grade',
      header: t('people.field.grade'),
      render: (d) => <span className="font-mono text-slate-500">{d.grade || '—'}</span>,
    },
  ];

  const expiringDocColumns: Column<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sortable: true,
      render: (doc) => (
        <div>
          <span className="font-semibold text-slate-900 block">{doc.employeeNameEn}</span>
          <span className="font-mono text-[11px] text-slate-400">{doc.employeeNumber}</span>
        </div>
      ),
    },
    {
      key: 'documentType',
      header: t('people.field.document_type'),
      sortable: true,
      render: (doc) => <span className="font-mono font-bold text-slate-800">{doc.documentType}</span>,
    },
    {
      key: 'documentNumber',
      header: t('people.field.document_number'),
      render: (doc) => <span className="font-mono text-slate-700">{doc.documentNumber}</span>,
    },
    {
      key: 'expiryDate',
      header: t('people.field.expiry_date'),
      sortable: true,
      render: (doc) => {
        const diff = new Date(doc.expiryDate).getTime() - new Date().getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        const isExpired = days < 0;

        return (
          <div className="font-mono text-xs">
            <span className="text-slate-800 block">{new Date(doc.expiryDate).toLocaleDateString()}</span>
            {isExpired ? (
              <span className="text-rose-600 font-bold text-[10px]">Expired ({Math.abs(days)}d ago)</span>
            ) : (
              <span className="text-amber-600 font-bold text-[10px]">Expires in {days} days</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (doc) => (
        <Button size="sm" variant="secondary" onClick={() => handleOpenDetail(doc.employeeId)}>
          Inspect
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Module Navigation Tabs (Interactive Segmented Filter) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'employees', label: t('people.tab.employees'), count: employeesList.length, icon: Users },
            { id: 'departments', label: t('people.tab.departments'), count: departmentsList.length, icon: Building2 },
            { id: 'designations', label: t('people.tab.designations'), count: designationsList.length, icon: Briefcase },
            { id: 'expiring_docs', label: t('people.tab.expiring_docs'), count: expiringDocsList.length, icon: AlertTriangle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-2 rtl:space-x-reverse transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className="text-[10px] opacity-70 font-mono">({tab.count})</span>
              </button>
            );
          })}
        </div>

        {/* Primary Tab Context Action */}
        <div>
          {activeTab === 'employees' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowNewEmpDialog(true)}
            >
              {t('people.action.new_employee')}
            </Button>
          )}
          {activeTab === 'departments' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowNewDeptDialog(true)}
            >
              {t('people.action.new_department')}
            </Button>
          )}
          {activeTab === 'designations' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowNewDesigDialog(true)}
            >
              {t('people.action.new_designation')}
            </Button>
          )}
        </div>
      </div>

      {errorMsg && <ErrorState message={errorMsg} onRetry={loadAllData} />}

      {/* TAB 1: Employees */}
      {activeTab === 'employees' && (
        <Table
          columns={employeeColumns}
          data={employeesList}
          keyExtractor={(e) => e.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search by name, employee number, email..."
          pageSize={10}
          selectedKeys={selectedEmpKeys}
          onSelectionChange={setSelectedEmpKeys}
          allFilteredSelected={allFilteredSelected}
          onAllFilteredSelectedChange={setAllFilteredSelected}
          bulkActions={
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <Button
                variant="secondary"
                size="sm"
                className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 text-xs py-1 px-2 h-7"
                onClick={() => handlePreflightBulkAction('ARCHIVE')}
                isLoading={isPreflightLoading && bulkActionType === 'ARCHIVE'}
              >
                {language === 'ar' ? 'أرشفة المحددين' : 'Archive Selected'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white border-rose-700 text-xs py-1 px-2 h-7"
                onClick={() => handlePreflightBulkAction('DELETE')}
                isLoading={isPreflightLoading && bulkActionType === 'DELETE'}
              >
                {language === 'ar' ? 'حذف المحددين' : 'Delete Selected'}
              </Button>
            </div>
          }
        />
      )}

      {/* TAB 2: Departments */}
      {activeTab === 'departments' && (
        <Table
          columns={departmentColumns}
          data={departmentsList}
          keyExtractor={(d) => d.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search departments..."
          pageSize={10}
        />
      )}

      {/* TAB 3: Designations */}
      {activeTab === 'designations' && (
        <Table
          columns={designationColumns}
          data={designationsList}
          keyExtractor={(d) => d.id}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder="Search job titles..."
          pageSize={10}
        />
      )}

      {/* TAB 4: Document Expiry Alerts */}
      {activeTab === 'expiring_docs' && (
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center space-x-2 rtl:space-x-reverse">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Central GCC statutory compliance monitoring: tracks Civil ID, Residency Visa, Passport, and Work Permit expirations.
            </span>
          </div>

          <Table
            columns={expiringDocColumns}
            data={expiringDocsList}
            keyExtractor={(d) => d.id}
            isLoading={isLoading}
            searchable={true}
            searchPlaceholder="Search by employee name or document number..."
            emptyTitle="All Documents Compliant"
            emptyDescription="There are currently no identity documents, visas, or passports expiring within the next 90 days."
            pageSize={10}
          />
        </div>
      )}

      {/* Employee Detail Slide-over Drawer */}
      <EmployeeDetailDrawer
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        employee={selectedEmployee}
        company={company}
        onRefresh={() => {
          loadAllData();
          if (selectedEmployee) handleOpenDetail(selectedEmployee.id);
        }}
        onDelete={(emp) => setEmpToDelete(emp)}
      />

      {/* New Employee Wizard Dialog */}
      <NewEmployeeDialog
        isOpen={showNewEmpDialog}
        onClose={() => setShowNewEmpDialog(false)}
        company={company}
        branches={branches}
        departments={departmentsList}
        designations={designationsList}
        onEmployeeCreated={loadAllData}
      />

      {/* New Department Dialog */}
      <Dialog
        isOpen={showNewDeptDialog}
        onClose={() => setShowNewDeptDialog(false)}
        title={t('people.action.new_department')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowNewDeptDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateDepartment} isLoading={isSubmittingDept}>
              {t('action.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateDepartment} className="space-y-3">
          <FormField label={t('people.field.dept_code')} required>
            <Input
              type="text"
              value={deptForm.code}
              onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. FIN, ENG, HR"
              className="font-mono uppercase"
              required
            />
          </FormField>
          <FormField label={t('people.field.dept_name_en')} required>
            <Input
              type="text"
              value={deptForm.nameEn}
              onChange={(e) => setDeptForm({ ...deptForm, nameEn: e.target.value })}
              placeholder="Finance & Accounts"
              required
            />
          </FormField>
          <FormField label={t('people.field.dept_name_ar')} required>
            <Input
              type="text"
              value={deptForm.nameAr}
              onChange={(e) => setDeptForm({ ...deptForm, nameAr: e.target.value })}
              placeholder="المالية والحسابات"
              dir="rtl"
              className="font-arabic text-right"
              required
            />
          </FormField>
        </form>
      </Dialog>

      {/* New Designation Dialog */}
      <Dialog
        isOpen={showNewDesigDialog}
        onClose={() => setShowNewDesigDialog(false)}
        title={t('people.action.new_designation')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowNewDesigDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateDesignation} isLoading={isSubmittingDesig}>
              {t('action.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateDesignation} className="space-y-3">
          <FormField label={t('people.field.desig_code')} required>
            <Input
              type="text"
              value={desigForm.code}
              onChange={(e) => setDesigForm({ ...desigForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. ACC-01"
              className="font-mono uppercase"
              required
            />
          </FormField>
          <FormField label={t('people.field.desig_name_en')} required>
            <Input
              type="text"
              value={desigForm.nameEn}
              onChange={(e) => setDesigForm({ ...desigForm, nameEn: e.target.value })}
              placeholder="Senior Accountant"
              required
            />
          </FormField>
          <FormField label={t('people.field.desig_name_ar')} required>
            <Input
              type="text"
              value={desigForm.nameAr}
              onChange={(e) => setDesigForm({ ...desigForm, nameAr: e.target.value })}
              placeholder="محاسب أول"
              dir="rtl"
              className="font-arabic text-right"
              required
            />
          </FormField>
          <FormField label="Department">
            <Select
              value={desigForm.departmentId}
              onChange={(e) => setDesigForm({ ...desigForm, departmentId: e.target.value })}
            >
              <option value="">Select Department...</option>
              {departmentsList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.nameEn}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('people.field.grade')}>
            <Input
              type="text"
              value={desigForm.grade}
              onChange={(e) => setDesigForm({ ...desigForm, grade: e.target.value })}
              placeholder="e.g. Band 4 / Professional"
            />
          </FormField>
        </form>
      </Dialog>

      {/* Delete Employee Confirmation Dialog */}
      <Dialog
        isOpen={!!empToDelete}
        onClose={() => setEmpToDelete(null)}
        title={language === 'ar' ? 'تأكيد حذف الموظف' : 'Delete Employee'}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEmpToDelete(null)}>
              {t('action.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white border-rose-700"
              onClick={confirmDeleteEmployee}
              isLoading={isDeletingEmp}
            >
              {language === 'ar' ? 'حذف' : 'Delete'}
            </Button>
          </>
        }
      >
        <div className="space-y-2 py-2 text-sm text-slate-700">
          <p>
            {language === 'ar'
              ? `هل أنت تأكد من رغبتك في حذف الموظف ${empToDelete?.firstNameAr || ''} ${empToDelete?.lastNameAr || ''} (${empToDelete?.employeeNumber || ''})؟`
              : `Are you sure you want to delete employee ${empToDelete?.firstNameEn || ''} ${empToDelete?.lastNameEn || ''} (${empToDelete?.employeeNumber || ''})?`}
          </p>
          <p className="text-xs text-rose-600 font-semibold">
            {language === 'ar'
              ? 'سيتم حذف سجل الموظف وكافة البيانات المرتبطة بالعقد والرواتب بشكل نهائي.'
              : 'This action will permanently delete the employee record and all associated contract, salary, and document history.'}
          </p>
        </div>
      </Dialog>

      {/* Bulk Action Preflight / Confirmation Dialog */}
      <Dialog
        isOpen={showPreflightDialog}
        onClose={() => setShowPreflightDialog(false)}
        title={
          bulkActionType === 'DELETE'
            ? (language === 'ar' ? 'مراجعة وتأكيد الحذف الجماعي' : 'Confirm Bulk Employee Deletion')
            : (language === 'ar' ? 'مراجعة وتأكيد الأرشفة الجماعية' : 'Confirm Bulk Employee Archival')
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowPreflightDialog(false)}>
              {t('action.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className={bulkActionType === 'DELETE' ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 font-bold' : 'bg-slate-900 hover:bg-slate-800 text-white'}
              onClick={handleExecuteBulkAction}
              isLoading={isExecutingBulk}
              disabled={bulkActionType === 'DELETE' && bulkActionConfirmText !== 'DELETE'}
            >
              {bulkActionType === 'DELETE'
                ? (language === 'ar' ? `تأكيد حذف ${preflightData?.eligibleCount || 0} موظف` : `Permanently Delete ${preflightData?.eligibleCount || 0} Employees`)
                : (language === 'ar' ? `تأكيد أرشفة ${preflightData?.totalCount || 0} موظف` : `Archive ${preflightData?.totalCount || 0} Employees`)
              }
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2 text-xs">
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <span className="font-semibold block text-slate-800 mb-1">
              {language === 'ar' ? 'ملخص العملية المقترحة' : 'Operation Preflight Summary'}
            </span>
            <div className="grid grid-cols-3 gap-2 text-center mt-2">
              <div className="p-2 bg-white rounded border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-mono">{language === 'ar' ? 'إجمالي المحددين' : 'Total Selected'}</span>
                <span className="text-sm font-bold text-slate-900 font-mono">{preflightData?.totalCount || 0}</span>
              </div>
              <div className="p-2 bg-emerald-50 rounded border border-emerald-100">
                <span className="text-emerald-600 block text-[10px] uppercase font-mono">{language === 'ar' ? 'مؤهلين للحذف' : 'Eligible for Delete'}</span>
                <span className="text-sm font-bold text-emerald-700 font-mono">{preflightData?.eligibleCount || 0}</span>
              </div>
              <div className="p-2 bg-rose-50 rounded border border-rose-100">
                <span className="text-rose-600 block text-[10px] uppercase font-mono">{language === 'ar' ? 'محميين (لا يمكن حذفهم)' : 'Protected (Non-deletable)'}</span>
                <span className="text-sm font-bold text-rose-700 font-mono">{preflightData?.protectedCount || 0}</span>
              </div>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto border border-slate-100 rounded divide-y divide-slate-100 bg-white">
            {preflightData?.items?.map((item: any) => (
              <div key={item.id} className="p-2 flex items-center justify-between gap-3">
                <div>
                  <span className="font-mono font-bold text-slate-900">{item.employeeNumber}</span>
                  <span className="text-slate-500 font-semibold block text-[11px]">{item.nameEn}</span>
                </div>
                <div>
                  {item.isEligibleForDelete ? (
                    <span className="px-2 py-0.5 text-[9px] bg-emerald-50 text-emerald-700 rounded font-semibold border border-emerald-200 uppercase">
                      {language === 'ar' ? 'مؤهل' : 'Eligible'}
                    </span>
                  ) : (
                    <div className="text-right">
                      <span className="px-2 py-0.5 text-[9px] bg-rose-50 text-rose-700 rounded font-semibold border border-rose-200 uppercase">
                        {language === 'ar' ? 'محمي من الحذف' : 'Protected'}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5 max-w-xs truncate">{item.reasons?.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {bulkActionType === 'DELETE' && (
            <div className="p-3 bg-rose-50 rounded border border-rose-200 space-y-2">
              <span className="font-semibold block text-rose-900">
                ⚠️ {language === 'ar' ? 'إجراء تنظيمي مدمر ودائم!' : 'Warning: Destructive, Permanent Deletion!'}
              </span>
              <p className="text-rose-800 leading-relaxed text-[11px]">
                {language === 'ar'
                  ? 'سيتم حذف الموظفين المؤهلين والبيانات المرتبطة بهم نهائيًا من خادم قاعدة البيانات. لا يمكن التراجع عن هذا الإجراء.'
                  : 'Eligible records will be hard-deleted permanently from the secure relational server. Protected employees will be automatically skipped and left intact.'}
              </p>
              <div className="mt-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">
                  {language === 'ar' ? 'اكتب كلمة DELETE للتحقق والمتابعة:' : 'Type DELETE to verify and proceed:'}
                </label>
                <Input
                  type="text"
                  value={bulkActionConfirmText}
                  onChange={(e) => setBulkActionConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono uppercase py-1 border-rose-300 focus:border-rose-500"
                />
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
