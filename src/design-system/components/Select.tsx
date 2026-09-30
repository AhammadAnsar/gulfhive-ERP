/**
 * GulfHive ERP - Select Component
 * Compact select dropdown with proper RTL and LTR support.
 */

import React, { SelectHTMLAttributes, forwardRef } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', hasError = false, disabled, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        disabled={disabled}
        className={`w-full text-xs rounded border bg-white text-slate-900 transition-colors focus:outline-none focus:ring-1 px-3 py-2 cursor-pointer ${
          hasError
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
            : 'border-slate-300 focus:border-slate-900 focus:ring-slate-900'
        } disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';
