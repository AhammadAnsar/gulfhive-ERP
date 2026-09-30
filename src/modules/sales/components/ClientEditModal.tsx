import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';

interface ClientEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: any;
  companyId: string;
  onSaved: () => void;
}

export function ClientEditModal({ isOpen, onClose, client, companyId, onSaved }: ClientEditModalProps) {
  const { t, language } = useI18n();
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    email: '',
    phone: '',
    website: '',
    crNumber: '',
    paymentTermsId: '30 Days',
    status: 'ACTIVE',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (client) {
      setFormData({
        nameEn: client.nameEn || '',
        nameAr: client.nameAr || '',
        email: client.email || '',
        phone: client.phone || '',
        website: client.website || '',
        crNumber: client.crNumber || '',
        paymentTermsId: client.paymentTermsId || '30 Days',
        status: client.status || 'ACTIVE',
      });
    }
  }, [client]);

  if (!isOpen || !client) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/sales/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم تحديث العميل' : 'Client Updated',
          message: language === 'ar' ? 'تم حفظ التعديلات بنجاح' : 'Client profile updated successfully.',
        });
        onSaved();
        onClose();
      } else {
        const err = await res.json();
        addToast({
          type: 'error',
          title: language === 'ar' ? 'خطأ' : 'Error',
          message: err.error || 'Failed to update client',
        });
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
      title={`${language === 'ar' ? 'تعديل بيانات العميل' : 'Edit Client Profile'}: ${client.code}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {language === 'ar' ? 'كود العميل (غير قابل للتعديل)' : 'Client Code (Read Only)'}
            </label>
            <Input value={client.code} disabled className="bg-slate-100 font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {language === 'ar' ? 'حالة الحساب' : 'Account Status'}
            </label>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="ACTIVE">{language === 'ar' ? 'نشط (Active)' : 'ACTIVE'}</option>
              <option value="INACTIVE">{language === 'ar' ? 'غير نشط (Inactive)' : 'INACTIVE'}</option>
              <option value="SUSPENDED">{language === 'ar' ? 'معلق (Suspended)' : 'SUSPENDED'}</option>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">
            {language === 'ar' ? 'الاسم بالإنجليزية' : 'Legal Name (English)'}
          </label>
          <Input
            required
            value={formData.nameEn}
            onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">
            {language === 'ar' ? 'الاسم بالعربية' : 'Legal Name (Arabic)'}
          </label>
          <Input
            required
            value={formData.nameAr}
            onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {language === 'ar' ? 'السجل التجاري (CR)' : 'CR Number'}
            </label>
            <Input
              value={formData.crNumber}
              onChange={(e) => setFormData({ ...formData, crNumber: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {language === 'ar' ? 'شروط الدفع' : 'Payment Terms'}
            </label>
            <Select
              value={formData.paymentTermsId}
              onChange={(e) => setFormData({ ...formData, paymentTermsId: e.target.value })}
            >
              <option value="Immediate">Immediate / فوري</option>
              <option value="15 Days">15 Days</option>
              <option value="30 Days">30 Days</option>
              <option value="60 Days">60 Days</option>
              <option value="90 Days">90 Days</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Website</label>
          <Input
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          />
        </div>

        <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-3 border-t border-slate-100">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...')
              : (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
