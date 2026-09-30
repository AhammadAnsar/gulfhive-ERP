/**
 * GulfHive ERP - Loading State Component
 * Quiet enterprise loading indicator with optional skeleton rows.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  label?: string;
  rows?: number;
}

export function LoadingState({ label = 'Loading records...', rows = 0 }: LoadingStateProps) {
  if (rows > 0) {
    return (
      <div className="w-full space-y-2 py-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-9 w-full bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
      <Loader2 className="w-5 h-5 animate-spin text-slate-400 mb-2" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
