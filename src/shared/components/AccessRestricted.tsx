/**
 * GulfHive ERP - Access Restricted View Component
 * Clean, informative fallback when user lacks required permission.
 */

import React from 'react';
import { useI18n } from '../i18n/I18nContext.tsx';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../../design-system/index.ts';

export interface AccessRestrictedProps {
  requiredPermission?: string;
  onGoHome?: () => void;
}

export function AccessRestricted({ requiredPermission, onGoHome }: AccessRestrictedProps) {
  const { language } = useI18n();

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-2xs text-center space-y-4 my-6 max-w-lg mx-auto">
      <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
        <ShieldAlert className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          {language === 'ar' ? 'وصول محدود - غير مصرح' : 'Access Restricted'}
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          {language === 'ar'
            ? 'حسابك الحالي لا يملك الصلاحية المطلوبة للوصول إلى هذه الشاشة أو البيانات.'
            : 'Your assigned security role lacks permission to access this module or view this financial/HR data.'}
        </p>
      </div>

      {requiredPermission && (
        <div className="p-2 bg-slate-50 rounded border border-slate-200 font-mono text-[11px] text-slate-600 inline-block">
          Required Permission: <span className="font-bold text-slate-900">{requiredPermission}</span>
        </div>
      )}

      {onGoHome && (
        <div className="pt-2">
          <Button size="sm" variant="secondary" onClick={onGoHome}>
            {language === 'ar' ? 'العودة للرئيسية' : 'Return to Overview'}
          </Button>
        </div>
      )}
    </div>
  );
}
