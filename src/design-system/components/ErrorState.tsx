/**
 * GulfHive ERP - Error State Component
 * Clear cause and retry action for failed data fetching or operations.
 */

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button.tsx';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = 'Operation Failed',
  message,
  onRetry,
  retryLabel = 'Retry',
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`p-6 text-center flex flex-col items-center justify-center max-w-sm mx-auto ${className}`}>
      <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs text-rose-700 bg-rose-50/50 p-2.5 rounded border border-rose-100 mb-4 leading-relaxed w-full">
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
