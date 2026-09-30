/**
 * GulfHive ERP - Enterprise Sidebar
 * Compact, collapsible, quiet hierarchy adhering to zero-pill and anti-slop rules.
 */

import React from 'react';
import {
  LayoutDashboard,
  Users,
  Clock,
  Coins,
  Briefcase,
  TrendingUp,
  ShoppingCart,
  Package,
  CreditCard,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  X
} from 'lucide-react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import { useLayout } from '../context/LayoutContext.tsx';

export interface SidebarProps {
  activeModule: string;
  onSelectModule: (module: string) => void;
  company?: any;
}

export function Sidebar({ activeModule, onSelectModule, company }: SidebarProps) {
  const { t, language, direction } = useI18n();
  const {
    isSidebarCollapsed,
    toggleSidebar,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
  } = useLayout();

  const navigationItems = [
    { code: 'dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { code: 'people', icon: Users, label: t('nav.people') },
    { code: 'time', icon: Clock, label: t('nav.time') },
    { code: 'payroll', icon: Coins, label: t('nav.payroll') },
    { code: 'projects', icon: Briefcase, label: t('nav.projects') },
    { code: 'sales', icon: TrendingUp, label: t('nav.sales') },
    { code: 'purchase', icon: ShoppingCart, label: t('nav.purchase') },
    { code: 'stock', icon: Package, label: t('nav.stock') },
    { code: 'finance', icon: CreditCard, label: t('nav.finance') },
    { code: 'reports', icon: BarChart3, label: t('nav.reports') },
    { code: 'settings', icon: Settings, label: t('nav.settings') },
  ];

  const CollapseIcon = direction === 'rtl'
    ? isSidebarCollapsed ? ChevronLeft : ChevronRight
    : isSidebarCollapsed ? ChevronRight : ChevronLeft;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 border-e border-slate-800 select-none">
      {/* Brand Identity Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0">
          <div className="w-8 h-8 rounded bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs tracking-wider shrink-0 shadow-xs">
            GH
          </div>
          {!isSidebarCollapsed && (
            <div className="truncate">
              <span className="text-sm font-bold tracking-tight text-white block">
                {t('app.name')}
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                {company?.code || 'GCC ENTERPRISE'}
              </span>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setIsMobileSidebarOpen(false)}
          className="md:hidden text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Modules List */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.code;
          return (
            <button
              key={item.code}
              onClick={() => {
                onSelectModule(item.code);
                setIsMobileSidebarOpen(false);
              }}
              title={isSidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center space-x-3 rtl:space-x-reverse px-2.5 py-2 rounded text-xs font-medium transition-colors cursor-pointer group ${
                isActive
                  ? 'bg-slate-800 text-amber-400 font-semibold shadow-2xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-transform ${
                  isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer & Collapse Toggle */}
      <div className="p-3 border-t border-slate-800 flex items-center justify-between">
        {!isSidebarCollapsed && company && (
          <div className="flex items-center space-x-2 rtl:space-x-reverse text-[11px] text-slate-400 truncate">
            <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">{language === 'ar' ? company.legalNameAr : company.legalNameEn}</span>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className="hidden md:flex items-center justify-center p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0 ms-auto"
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <CollapseIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:block shrink-0 transition-all duration-200 ${
          isSidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="fixed inset-y-0 start-0 z-30 flex flex-col transition-all duration-200"
          style={{ width: isSidebarCollapsed ? '4rem' : '15rem' }}
        >
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs transition-opacity"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative w-64 max-w-xs flex-1 flex flex-col z-10 shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
