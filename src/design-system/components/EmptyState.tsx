/**
 * GulfHive ERP - Empty State Component
 * Minimal, quiet empty placeholder without excessive decorative illustrations.
 */

import React from 'react';
import { Button } from './Button.tsx';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`p-8 text-center flex flex-col items-center justify-center max-w-sm mx-auto ${className}`}>
      {icon && <div className="text-slate-400 mb-3">{icon}</div>}
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      {description && <p className="text-xs text-slate-500 mb-4 leading-relaxed">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
