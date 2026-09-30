/**
 * GulfHive ERP - Enterprise Toast Container
 * Minimal, quiet notifications with clean typography and zero-pill discipline.
 */

import React from 'react';
import { useToast, ToastItem } from '../context/ToastContext.tsx';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full px-4 right-0 rtl:right-auto rtl:left-0"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-slate-600 shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-emerald-200 bg-white';
      case 'error':
        return 'border-rose-200 bg-white';
      case 'warning':
        return 'border-amber-200 bg-white';
      case 'info':
      default:
        return 'border-slate-200 bg-white';
    }
  };

  return (
    <div
      className={`pointer-events-auto flex items-start justify-between p-3.5 rounded-lg border shadow-sm transition-all duration-200 ${getBorderColor()}`}
    >
      <div className="flex items-start space-x-2.5 rtl:space-x-reverse">
        <div className="mt-0.5">{getIcon()}</div>
        <div>
          <h4 className="text-xs font-semibold text-slate-900">{toast.title}</h4>
          {toast.message && (
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{toast.message}</p>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-slate-400 hover:text-slate-600 p-1 -mr-1 rtl:-mr-0 rtl:-ml-1 transition cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
