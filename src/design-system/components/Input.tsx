/**
 * GulfHive ERP - Input Component
 * Clean, compact enterprise text, number, and search fields with prefix/suffix support.
 */

import React, { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  prefixElement?: React.ReactNode;
  suffixElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', hasError = false, prefixElement, suffixElement, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {prefixElement && (
          <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
            {prefixElement}
          </div>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={`w-full text-xs rounded border bg-white text-slate-900 transition-colors focus:outline-none focus:ring-1 ${
            prefixElement ? 'ps-9' : 'ps-3'
          } ${suffixElement ? 'pe-9' : 'pe-3'} py-2 ${
            hasError
              ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
              : 'border-slate-300 focus:border-slate-900 focus:ring-slate-900'
          } disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 ${className}`}
          {...props}
        />
        {suffixElement && (
          <div className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none text-slate-400">
            {suffixElement}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
