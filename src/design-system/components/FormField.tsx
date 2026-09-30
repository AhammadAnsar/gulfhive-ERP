/**
 * GulfHive ERP - FormField Wrapper
 * Clean enterprise label, hint, and error presentation.
 */

import React from 'react';

export interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  hint,
  error,
  required = false,
  htmlFor,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700">
            {label} {required && <span className="text-rose-500 font-bold">*</span>}
          </label>
        </div>
      )}
      {children}
      {hint && !error && <p className="text-[11px] text-slate-500 leading-normal">{hint}</p>}
      {error && <p className="text-[11px] text-rose-600 font-medium leading-normal">{error}</p>}
    </div>
  );
}
