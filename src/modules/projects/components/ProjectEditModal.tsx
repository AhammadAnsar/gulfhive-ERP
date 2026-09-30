import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';

interface ProjectEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  companyId: string;
  clients: any[];
  suppliers: any[];
  billingProfiles: any[];
  employees: any[];
  onSaved: () => void;
}

export function ProjectEditModal({
  isOpen,
  onClose,
  project,
  companyId,
  clients,
  suppliers,
  billingProfiles,
  employees,
  onSaved,
}: ProjectEditModalProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    projectType: 'General Contract',
    clientId: '',
    principalSupplierId: '',
    billingProfileId: '',
    contractReference: '',
    principalReference: '',
    contractValue: '0.000',
    billingMethod: 'FIXED_CONTRACT',
    startDate: '',
    plannedEndDate: '',
    projectManagerEmployeeId: '',
    status: 'ACTIVE',
    description: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (project) {
      setFormData({
        nameEn: project.nameEn || '',
        nameAr: project.nameAr || '',
        projectType: project.projectType || 'General Contract',
        clientId: String(project.clientId || ''),
        principalSupplierId: project.principalSupplierId ? String(project.principalSupplierId) : '',
        billingProfileId: String(project.billingProfileId || ''),
        contractReference: project.contractReference || '',
        principalReference: project.principalReference || '',
        contractValue: project.contractValue || '0.000',
        billingMethod: project.billingMethod || 'FIXED_CONTRACT',
        startDate: project.startDate || '',
        plannedEndDate: project.plannedEndDate || '',
        projectManagerEmployeeId: project.projectManagerEmployeeId || '',
        status: project.status || 'ACTIVE',
        description: project.description || '',
      });
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          clientId: Number(formData.clientId),
          principalSupplierId: formData.principalSupplierId ? Number(formData.principalSupplierId) : null,
          billingProfileId: Number(formData.billingProfileId),
          projectManagerEmployeeId: formData.projectManagerEmployeeId || null,
        }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم تحديث المشروع' : 'Project Updated',
          message: language === 'ar' ? 'تم حفظ التعديلات بنجاح' : 'Project record updated successfully.',
        });
        onSaved();
        onClose();
      } else {
        const err = await res.json();
        addToast({ type: 'error', title: 'Error', message: err.error || 'Failed to update project' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Network error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`${language === 'ar' ? 'تعديل بيانات المشروع' : 'Edit Project'}: ${project.projectCode}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-1 text-xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Project Code</label>
            <Input value={project.projectCode} disabled className="bg-slate-100 font-mono" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Project Type</label>
            <Select
              value={formData.projectType}
              onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
            >
              <option value="General Contract">General Contract</option>
              <option value="Subcontract">Subcontract (من الباطن)</option>
              <option value="Construction">Construction</option>
              <option value="Cleaning">Cleaning & Hospitality</option>
              <option value="Maintenance">Facility Maintenance</option>
              <option value="Labour Supply">Labour Supply (توريد عمالة)</option>
              <option value="Service">Service Contract</option>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="PLANNED">PLANNED</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ON_HOLD">ON HOLD</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CLOSED">CLOSED</option>
              <option value="CANCELLED">CANCELLED</option>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Billing Method</label>
            <Select
              value={formData.billingMethod}
              onChange={(e) => setFormData({ ...formData, billingMethod: e.target.value })}
            >
              <option value="FIXED_CONTRACT">Fixed Contract (عقد مقطوع)</option>
              <option value="MILESTONE">Milestone Progress</option>
              <option value="MONTHLY_SERVICE">Monthly Recurring Service</option>
              <option value="TIMESHEET_BASED">Timesheet / Man-hour Rate</option>
              <option value="MANUAL">Manual Billing</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Project Name (English)</label>
            <Input
              required
              value={formData.nameEn}
              onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">اسم المشروع (عربي)</label>
            <Input
              required
              value={formData.nameAr}
              onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
            />
          </div>
        </div>

        {/* Commercial Entities Block */}
        <div className="p-3 bg-slate-50 border rounded-lg space-y-3">
          <div className="font-bold text-slate-900 uppercase text-[10px]">
            {language === 'ar' ? 'الأطراف التجارية وهوية الفوترة المعتمدة' : 'Commercial Relationships & Billing Entity'}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 uppercase">End Client (العميل النهائي)</label>
              <Select
                required
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              >
                <option value="">-- Choose Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} - {c.nameEn}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 uppercase">Principal Contractor (المقاول الرئيسي)</label>
              <Select
                value={formData.principalSupplierId}
                onChange={(e) => setFormData({ ...formData, principalSupplierId: e.target.value })}
              >
                <option value="">-- Direct (No Principal) --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} - {s.nameEn}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 uppercase">Authorized Billing Profile (هوية الفوترة)</label>
              <Select
                required
                value={formData.billingProfileId}
                onChange={(e) => setFormData({ ...formData, billingProfileId: e.target.value })}
              >
                <option value="">-- Choose Billing Profile --</option>
                {billingProfiles.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.profileCode} - {b.profileName} {b.isOperatingCompany ? '(Operating Company)' : '(Principal External)'}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Contract Value ({project.currency})</label>
            <Input
              value={formData.contractValue}
              onChange={(e) => setFormData({ ...formData, contractValue: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Start Date</label>
            <Input
              type="date"
              required
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Planned End Date</label>
            <Input
              type="date"
              value={formData.plannedEndDate}
              onChange={(e) => setFormData({ ...formData, plannedEndDate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Project Manager</label>
            <Select
              value={formData.projectManagerEmployeeId}
              onChange={(e) => setFormData({ ...formData, projectManagerEmployeeId: e.target.value })}
            >
              <option value="">-- Unassigned --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.employeeNumber} - {emp.firstNameEn} {emp.lastNameEn}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Description / Scope of Work</label>
          <Input
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2 border-t">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Project Changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
