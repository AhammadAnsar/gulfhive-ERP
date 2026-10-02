/**
 * GulfHive ERP - Enterprise App Shell
 * Coordinates responsive layout, persistent sidebar, topbar, command palette, and notification drawer.
 */

import React from 'react';
import { Sidebar } from './Sidebar.tsx';
import { TopBar } from './TopBar.tsx';
import { NotificationCenter } from './NotificationCenter.tsx';
import { SearchPalette } from '../components/SearchPalette.tsx';
import { ToastContainer } from '../components/Toast.tsx';
import { Breadcrumbs, BreadcrumbItem } from '../components/Breadcrumbs.tsx';
import { useLayout } from '../context/LayoutContext.tsx';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';

export interface AppShellProps {
  activeModule: string;
  onSelectModule: (module: string) => void;
  company: any;
  branches: any[];
  activeBranchId: string;
  onSelectBranch: (branchId: string) => void;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  currentUser?: {
    displayName?: string;
    email?: string;
    role?: string;
  };
  onLogout?: () => void;
}

export function AppShell({
  activeModule,
  onSelectModule,
  company,
  branches,
  activeBranchId,
  onSelectBranch,
  breadcrumbs,
  actions,
  children,
  currentUser,
  onLogout,
}: AppShellProps) {
  const { t, language } = useI18n();
  const {
    isSearchOpen,
    setIsSearchOpen,
    isNotificationDrawerOpen,
    setIsNotificationDrawerOpen,
  } = useLayout();

  const currentBranch = branches.find((b) => b.id === activeBranchId) || branches[0];

  const defaultBreadcrumbs: BreadcrumbItem[] = breadcrumbs || [
    { label: company ? (language === 'ar' ? company.legalNameAr : company.legalNameEn) : 'GulfHive' },
    { label: t(`nav.${activeModule}`), isCurrent: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans overflow-x-hidden w-full max-w-full">
      <div className="flex flex-1 w-full max-w-full overflow-x-hidden">
        {/* Sidebar Component */}
        <Sidebar activeModule={activeModule} onSelectModule={onSelectModule} company={company} />

        {/* Content Flow Column */}
        <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden">
          {/* Top Bar Header */}
          <TopBar
            company={company}
            branches={branches}
            activeBranchId={activeBranchId}
            onSelectBranch={onSelectBranch}
            currentUser={currentUser}
            onLogout={onLogout}
          />

          {/* Subheader: Breadcrumbs & Action Toolbar */}
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-full overflow-x-hidden">
            <Breadcrumbs items={defaultBreadcrumbs} />
            {actions && (
              <div className="flex flex-wrap items-center gap-1.5 shrink-0 max-w-full">{actions}</div>
            )}
          </div>

          {/* Main Viewport Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0 max-w-full overflow-x-hidden">{children}</main>

          {/* Enterprise Footer */}
          <footer className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3.5 mt-auto max-w-full overflow-x-hidden">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <span className="font-semibold text-slate-700">{t('app.name')}</span>
                <span>•</span>
                <span>{company?.code || 'CORP'}</span>
                <span>•</span>
                <span>{currentBranch?.code || 'HQ'}</span>
              </div>
              <div className="flex items-center space-x-3 rtl:space-x-reverse text-[11px] text-slate-400">
                <span>GCC Statutory Compliance Ready</span>
                <span>•</span>
                <span>Audit Verified</span>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Global Command Search Palette */}
      <SearchPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectModule={onSelectModule}
        companyCode={company?.code}
        activeBranchCode={currentBranch?.code}
      />

      {/* Global Notification Center Drawer */}
      <NotificationCenter
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
      />

      {/* Global Toast Container */}
      <ToastContainer />
    </div>
  );
}
