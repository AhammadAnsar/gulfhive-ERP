import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button, Input, Select, Dialog, useToast } from '../../../design-system/index.ts';

interface SupplierEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: any;
  companyId: string;
  onSaved: () => void;
}

export function SupplierEditModal({ isOpen, onClose, supplier, companyId, onSaved }: SupplierEditModalProps) {
  const { language } = useI18n();
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    email: '',
    phone: '',
    crNumber: '',
    vatNumber: '',
    paymentTermsId: '30 Days',
    currency: 'KWD',
    status: 'ACTIVE',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (supplier) {
      setFormData({
        nameEn: supplier.nameEn || '',
        nameAr: supplier.nameAr || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        crNumber: supplier.crNumber || '',
        vatNumber: supplier.vatNumber || '',
        paymentTermsId: supplier.paymentTermsId || '30 Days',
        currency: supplier.currency || 'KWD',
        status: supplier.status || 'ACTIVE',
      });
    }
  }, [supplier]);

  if (!isOpen || !supplier) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/procurement/suppliers/${supplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم تحديث المورد' : 'Supplier Updated',
          message: language === 'ar' ? 'تم حفظ التعديلات بنجاح' : 'Supplier profile updated successfully.',
        });
        onSaved();
        onClose();
      } else {
        const err = await res.json();
        addToast({
          type: 'error',
          title: language === 'ar' ? 'خطأ' : 'Error',
          message: err.error || 'Failed to update supplier',
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
      title={`${language === 'ar' ? 'تعديل بيانات المورد' : 'Edit Vendor Profile'}: ${supplier.code}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {language === 'ar' ? 'كود المورد' : 'Vendor Code'}
            </label>
            <Input value={supplier.code} disabled className="bg-slate-100 font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {language === 'ar' ? 'حالة الحساب' : 'Account Status'}
            </label>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="BLOCKED">BLOCKED</option>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">
            {language === 'ar' ? 'الاسم بالإنجليزية' : 'Vendor Name (English)'}
          </label>
          <Input
            required
            value={formData.nameEn}
            onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">
            {language === 'ar' ? 'الاسم بالعربية' : 'Vendor Name (Arabic)'}
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
              {language === 'ar' ? 'الرقم الضريبي (VAT)' : 'VAT Registration Number'}
            </label>
            <Input
              value={formData.vatNumber}
              onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {language === 'ar' ? 'شروط الدفع' : 'Payment Terms'}
            </label>
            <Select
              value={formData.paymentTermsId}
              onChange={(e) => setFormData({ ...formData, paymentTermsId: e.target.value })}
            >
              <option value="Immediate">Immediate</option>
              <option value="15 Days">15 Days</option>
              <option value="30 Days">30 Days</option>
              <option value="60 Days">60 Days</option>
              <option value="90 Days">90 Days</option>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Currency</label>
            <Select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            >
              <option value="KWD">KWD</option>
              <option value="SAR">SAR</option>
              <option value="AED">AED</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
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
