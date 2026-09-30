/**
 * GulfHive ERP - Breadcrumbs Component
 * Quiet path trail with directional RTL/LTR chevrons and accessible navigation.
 */

import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  isCurrent?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  const { direction } = useI18n();
  const Chevron = direction === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs text-slate-500 ${className}`}>
      <ol className="flex items-center space-x-1.5 rtl:space-x-reverse">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={idx} className="flex items-center space-x-1.5 rtl:space-x-reverse">
              {idx > 0 && <Chevron className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              {item.isCurrent || isLast || !item.onClick ? (
                <span
                  className="font-medium text-slate-900 truncate max-w-[200px]"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="hover:text-slate-900 transition-colors truncate max-w-[150px] cursor-pointer"
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
