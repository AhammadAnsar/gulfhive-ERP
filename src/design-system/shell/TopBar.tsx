/**
 * GulfHive ERP - Enterprise Top Bar
 * Minimal, compact, quiet header with search shell trigger, branch switch, and profile controls.
 */

import React from 'react';
import {
  Menu,
  Search,
  Bell,
  Globe,
  Building2,
  GitBranch,
  User,
  Shield
} from 'lucide-react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import { useLayout } from '../context/LayoutContext.tsx';

export interface TopBarProps {
  company: any;
  branches: any[];
  activeBranchId: string;
  onSelectBranch: (branchId: string) => void;
  currentUser?: {
    displayName?: string;
    email?: string;
    role?: string;
  };
}

export function TopBar({
  company,
  branches,
  activeBranchId,
  onSelectBranch,
  currentUser = { displayName: 'Administrator', email: 'admin@gulfhive.internal', role: 'COMPANY_ADMIN' },
}: TopBarProps) {
  const { t, language, toggleLanguage } = useI18n();
  const {
    setIsMobileSidebarOpen,
    setIsSearchOpen,
    setIsNotificationDrawerOpen,
  } = useLayout();

  const currentBranch = branches.find((b) => b.id === activeBranchId) || branches[0];

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 w-full max-w-full overflow-x-hidden">
      {/* Left: Mobile Toggle & Search Trigger */}
      <div className="flex items-center space-x-3 rtl:space-x-reverse">
        {/* Mobile Hamburger */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="md:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Shell (Cmd+K) Trigger */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center space-x-2 rtl:space-x-reverse px-3 py-1.5 rounded-lg bg-slate-100/80 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 text-xs transition cursor-pointer w-48 sm:w-64"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate text-left rtl:text-right flex-1">
            {language === 'ar' ? 'بحث سريع...' : 'Quick search...'}
          </span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white rounded border border-slate-200 shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Branch Selector, Language, Notifications, User Profile */}
      <div className="flex items-center space-x-2.5 sm:space-x-3 rtl:space-x-reverse">
        {/* Company & Branch Context */}
        {company && branches.length > 0 && (
          <div className="hidden lg:flex items-center space-x-2 rtl:space-x-reverse text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1">
            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="font-mono font-semibold text-slate-800">{company.code}</span>
            <span className="text-slate-300">/</span>
            <GitBranch className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={activeBranchId}
              onChange={(e) => onSelectBranch(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} ({language === 'ar' ? b.nameAr : b.nameEn})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Language Switcher */}
        <button
          onClick={toggleLanguage}
          className="flex items-center space-x-1 rtl:space-x-reverse px-2.5 py-1 text-xs font-semibold rounded text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer border border-slate-200"
          title={t('label.select_language')}
        >
          <Globe className="w-3.5 h-3.5 text-slate-500" />
          <span>{t('action.switch_language')}</span>
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => setIsNotificationDrawerOpen(true)}
          className="relative p-2 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Open notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
        </button>

        {/* User Profile Info */}
        <div className="flex items-center space-x-2 rtl:space-x-reverse ps-2 border-s border-slate-200">
          <div className="w-8 h-8 rounded bg-slate-900 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
            {currentUser.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : 'AD'}
          </div>
          <div className="hidden xl:block text-left rtl:text-right">
            <span className="text-xs font-semibold text-slate-900 block leading-tight">
              {currentUser.displayName || 'Administrator'}
            </span>
            <span className="text-[10px] font-mono text-slate-400 block leading-tight">
              {currentUser.role || 'COMPANY_ADMIN'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
