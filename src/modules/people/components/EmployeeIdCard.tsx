/**
 * GulfHive ERP - Employee ID Card Generator Component
 * Clean enterprise corporate credential with dual English / Arabic typography, barcode, and print optimization.
 */

import React from 'react';
import { Building2, QrCode, Printer, Shield, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Button } from '../../../design-system/index.ts';

export interface EmployeeIdCardProps {
  employee: any;
  company: any;
  onClose?: () => void;
}

export function EmployeeIdCard({ employee, company, onClose }: EmployeeIdCardProps) {
  const { t, language } = useI18n();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{t('people.id_card.title')}</h3>
          <p className="text-xs text-slate-500">Official enterprise security credential</p>
        </div>
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <Button variant="primary" size="sm" onClick={handlePrint} leftIcon={<Printer className="w-3.5 h-3.5" />}>
            {t('people.id_card.print')}
          </Button>
          {onClose && (
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('action.cancel')}
            </Button>
          )}
        </div>
      </div>

      {/* ID Card Container - Optimized for CR80 Standard Credit Card Dimension */}
      <div className="flex justify-center p-4">
        <div
          id="printable-id-card"
          className="w-80 h-[480px] bg-white rounded-xl border border-slate-300 shadow-md flex flex-col justify-between overflow-hidden relative select-none font-sans"
        >
          {/* Top Brand Banner */}
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b-2 border-amber-500">
            <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
              <div className="w-7 h-7 rounded bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs shadow-2xs">
                GH
              </div>
              <div className="leading-tight">
                <span className="font-bold text-xs tracking-tight block">
                  {language === 'ar' ? company?.legalNameAr : company?.legalNameEn || 'GulfHive Enterprise'}
                </span>
                <span className="text-[10px] text-slate-300 font-mono block">
                  {company?.code || 'CORP'}
                </span>
              </div>
            </div>
            <Shield className="w-4 h-4 text-amber-400 opacity-80" />
          </div>

          {/* Photo & Identity Section */}
          <div className="flex-1 px-5 py-4 flex flex-col items-center text-center">
            {/* Avatar / Photo Box */}
            <div className="w-24 h-24 rounded-lg bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-700 font-bold text-2xl shadow-inner mb-3 overflow-hidden">
              {employee.avatarUrl ? (
                <img src={employee.avatarUrl} alt="Employee" className="w-full h-full object-cover" />
              ) : (
                <span>
                  {employee.firstNameEn?.slice(0, 1)}
                  {employee.lastNameEn?.slice(0, 1)}
                </span>
              )}
            </div>

            {/* Names */}
            <h2 className="text-sm font-bold text-slate-900 leading-tight">
              {employee.firstNameEn} {employee.lastNameEn}
            </h2>
            <p className="text-xs font-arabic font-medium text-slate-600 mt-0.5">
              {employee.firstNameAr} {employee.lastNameAr}
            </p>

            {/* Employee Number & Designation */}
            <div className="mt-2.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-xs font-bold text-slate-800">
              {employee.employeeNumber}
            </div>

            <div className="mt-2 text-center">
              <span className="text-xs font-semibold text-slate-800 block">
                {language === 'ar' ? employee.designationNameAr : employee.designationNameEn || 'Staff Member'}
              </span>
              <span className="text-[11px] text-slate-500 block">
                {language === 'ar' ? employee.departmentNameAr : employee.departmentNameEn || 'General Operations'}
              </span>
            </div>

            {/* Key Metadata Grid */}
            <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-[11px] text-left rtl:text-right font-mono">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Civil ID:</span>
                <span className="font-semibold text-slate-800">{employee.civilIdNumber || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Nationality:</span>
                <span className="font-semibold text-slate-800 truncate block">{employee.nationality}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Joining Date:</span>
                <span className="font-semibold text-slate-800">
                  {new Date(employee.joiningDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Branch:</span>
                <span className="font-semibold text-slate-800">{employee.branchCode || 'HQ'}</span>
              </div>
            </div>
          </div>

          {/* Bottom Security Barcode & Chip Simulation */}
          <div className="bg-slate-50 p-3 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <QrCode className="w-7 h-7 text-slate-700" />
              <div className="leading-tight text-[9px] font-mono text-slate-400">
                <span>SEC-VERIFIED</span>
                <br />
                <span>{company?.countryCode}-GCC</span>
              </div>
            </div>

            <div className="text-right rtl:text-left text-[9px] font-mono text-slate-500">
              <div className="flex items-center space-x-1 rtl:space-x-reverse justify-end">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span className="font-semibold text-emerald-800">AUTHORIZED</span>
              </div>
              <span>ISSUED BY GULFHIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
