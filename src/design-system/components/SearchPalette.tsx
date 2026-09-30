/**
 * GulfHive ERP - Global Search Shell / Command Palette
 * Accessible quick jump search (Cmd/Ctrl + K) with keyboard navigation.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, ArrowLeft, Building2, GitBranch, Shield, Users, Clock, DollarSign, Briefcase, ShoppingCart, Package, BookOpen } from 'lucide-react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import { GULFHIVE_MODULES } from '../../modules/module.manifest.ts';

export interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (moduleCode: string) => void;
  companyCode?: string;
  activeBranchCode?: string;
}

export function SearchPalette({
  isOpen,
  onClose,
  onSelectModule,
  companyCode,
  activeBranchCode,
}: SearchPaletteProps) {
  const { t, language, direction } = useI18n();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const moduleIcons: Record<string, any> = {
    people: Users,
    time: Clock,
    payroll: DollarSign,
    projects: Briefcase,
    sales: ArrowRight,
    purchase: ShoppingCart,
    stock: Package,
    finance: DollarSign,
    reports: BookOpen,
    settings: Shield,
  };

  const allItems = Object.values(GULFHIVE_MODULES).map((mod) => ({
    id: mod.code.toLowerCase(),
    type: 'module',
    title: language === 'ar' ? mod.nameAr : mod.nameEn,
    description: language === 'ar' ? mod.descriptionAr : mod.descriptionEn,
    code: mod.code,
    icon: moduleIcons[mod.code.toLowerCase()] || Building2,
  }));

  const filteredItems = allItems.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((idx) => (idx + 1) % (filteredItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((idx) => (idx - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          onSelectModule(selected.id);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onSelectModule, onClose]);

  if (!isOpen) return null;

  const ArrowIcon = direction === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity" onClick={onClose} />

      {/* Palette Surface */}
      <div className="relative bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden z-10 flex flex-col">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-slate-100 flex items-center space-x-2.5 rtl:space-x-reverse">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={language === 'ar' ? 'البحث السريع في الوحدات والسجلات (أو اضغط ESC)...' : 'Type a module name or keyword... (Esc to close)'}
            className="w-full text-xs text-slate-900 focus:outline-none placeholder-slate-400 bg-transparent"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-72 overflow-y-auto p-2 divide-y divide-slate-50">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              {language === 'ar' ? 'لم يتم العثور على نتائج مطابقة' : 'No matching modules found.'}
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectModule(item.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    isSelected ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-3 rtl:space-x-reverse truncate">
                    <div className={`p-1.5 rounded ${isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-slate-900 block truncate">{item.title}</span>
                      <span className="text-[11px] text-slate-400 truncate block">{item.description}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 rtl:space-x-reverse shrink-0">
                    <span className="text-[10px] font-mono uppercase text-slate-400">{item.code}</span>
                    <ArrowIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-900' : 'text-slate-300'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            {companyCode && (
              <span>
                Scope: <strong className="font-mono text-slate-700">{companyCode}</strong>
                {activeBranchCode && ` / ${activeBranchCode}`}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3 rtl:space-x-reverse font-mono text-[10px]">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
