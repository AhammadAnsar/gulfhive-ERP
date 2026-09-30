/**
 * GulfHive ERP - Table Component
 * Compact, readable enterprise data grid with sorting, search filtering, and pagination.
 */

import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import { Input } from './Input.tsx';
import { EmptyState } from './EmptyState.tsx';
import { LoadingState } from './LoadingState.tsx';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  pageSize?: number;
  actions?: React.ReactNode;
  className?: string;

  // Row Selection Props
  selectedKeys?: Set<string | number>;
  onSelectionChange?: (selected: Set<string | number>) => void;
  allFilteredSelected?: boolean;
  onAllFilteredSelectedChange?: (allSelected: boolean) => void;
  bulkActions?: React.ReactNode;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are currently no entries matching your query.',
  onRowClick,
  searchable = true,
  searchPlaceholder = 'Search records...',
  searchFilter,
  pageSize = 10,
  actions,
  className = '',
  selectedKeys,
  onSelectionChange,
  allFilteredSelected = false,
  onAllFilteredSelectedChange,
  bulkActions,
}: TableProps<T>) {
  const { direction, language } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter Data
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    if (searchFilter) {
      return data.filter((row) => searchFilter(row, searchQuery));
    }
    // Default search across all string/number fields of row
    const q = searchQuery.toLowerCase();
    return data.filter((row: any) =>
      Object.values(row).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(q)
      )
    );
  }, [data, searchQuery, searchFilter]);

  // Sort Data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a: any, b: any) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      return sortOrder === 'asc' ? 1 : -1;
    });
  }, [filteredData, sortKey, sortOrder]);

  // Paginate Data
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === key) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const PrevIcon = direction === 'rtl' ? ChevronRight : ChevronLeft;
  const NextIcon = direction === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <div className={`bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden ${className}`}>
      {/* Table Action Bar */}
      {(searchable || actions) && (
        <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {searchable ? (
            <div className="w-full sm:max-w-xs">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={searchPlaceholder}
                prefixElement={<Search className="w-3.5 h-3.5" />}
                className="py-1.5"
              />
            </div>
          ) : (
            <div />
          )}

          {actions && <div className="flex items-center space-x-2 rtl:space-x-reverse">{actions}</div>}
        </div>
      )}

      {/* Selection Banner (Select All Filtered & Bulk Actions) */}
      {selectedKeys && onSelectionChange && selectedKeys.size > 0 && (
        <div className="bg-slate-900 text-white px-4 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs font-semibold select-none border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-300 font-mono">
              {selectedKeys.size} {language === 'ar' ? 'محدد' : 'selected'}
            </span>
            {paginatedData.every((row, idx) => selectedKeys.has(keyExtractor(row, idx))) && selectedKeys.size < sortedData.length && !allFilteredSelected && (
              <button
                type="button"
                onClick={() => {
                  const allKeys = new Set(sortedData.map((row, idx) => keyExtractor(row, idx)));
                  onSelectionChange(allKeys);
                  onAllFilteredSelectedChange?.(true);
                }}
                className="text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer ml-2"
              >
                {language === 'ar' ? `تحديد كل الـ ${sortedData.length} سجلات المصفاة` : `Select all ${sortedData.length} filtered records`}
              </button>
            )}
            {allFilteredSelected && (
              <span className="text-emerald-400 font-bold ml-2">
                ({language === 'ar' ? 'تم تحديد جميع السجلات المصفاة' : 'All filtered records are selected'})
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                onSelectionChange(new Set());
                onAllFilteredSelectedChange?.(false);
              }}
              className="text-slate-400 hover:text-slate-200 underline font-semibold cursor-pointer ml-2"
            >
              {language === 'ar' ? 'إلغاء التحديد' : 'Clear selection'}
            </button>
          </div>
          {bulkActions && <div className="flex items-center space-x-2 rtl:space-x-reverse">{bulkActions}</div>}
        </div>
      )}

      {/* Table Grid */}
      <div className="overflow-x-auto no-scrollbar w-full max-w-full">
        <table className="w-full text-left rtl:text-right text-xs table-auto">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
            <tr>
              {/* Optional Selection Column Header */}
              {selectedKeys && onSelectionChange && (
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedData.length > 0 && paginatedData.every((row, idx) => selectedKeys.has(keyExtractor(row, idx)))}
                    onChange={(e) => {
                      const next = new Set(selectedKeys);
                      if (e.target.checked) {
                        paginatedData.forEach((row, idx) => next.add(keyExtractor(row, idx)));
                      } else {
                        paginatedData.forEach((row, idx) => next.delete(keyExtractor(row, idx)));
                        onAllFilteredSelectedChange?.(false);
                      }
                      onSelectionChange(next);
                    }}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer w-3.5 h-3.5"
                  />
                </th>
              )}

              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    onClick={() => handleSort(col.key, col.sortable)}
                    className={`py-2.5 px-3 ${col.sortable ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''} ${
                      col.align === 'right' ? 'text-right rtl:text-left' : col.align === 'center' ? 'text-center' : ''
                    }`}
                  >
                    <div
                      className={`flex items-center space-x-1 rtl:space-x-reverse ${
                        col.align === 'right'
                          ? 'justify-end'
                          : col.align === 'center'
                          ? 'justify-center'
                          : 'justify-start'
                      }`}
                    >
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-slate-400">
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5 text-slate-900" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-900" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5 opacity-60" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={(selectedKeys ? 1 : 0) + columns.length} className="p-0">
                  <LoadingState rows={pageSize} />
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={(selectedKeys ? 1 : 0) + columns.length} className="p-6">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => {
                const rowKey = keyExtractor(row, idx);
                const isSelected = selectedKeys?.has(rowKey) || false;
                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`transition-colors ${
                      isSelected ? 'bg-slate-50/70' : ''
                    } ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/50'}`}
                  >
                    {/* Optional Selection Checkbox Row Cell */}
                    {selectedKeys && onSelectionChange && (
                      <td className="py-2.5 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const next = new Set(selectedKeys);
                            if (e.target.checked) {
                              next.add(rowKey);
                            } else {
                              next.delete(rowKey);
                              onAllFilteredSelectedChange?.(false);
                            }
                            onSelectionChange(next);
                          }}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer w-3.5 h-3.5"
                        />
                      </td>
                    )}

                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`py-2.5 px-3 text-slate-800 ${
                          col.align === 'right' ? 'text-right rtl:text-left' : col.align === 'center' ? 'text-center' : ''
                        }`}
                      >
                        {col.render ? col.render(row, idx) : (row as any)[col.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Count Footer */}
      {!isLoading && sortedData.length > 0 && (
        <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center space-x-1.5 rtl:space-x-reverse font-mono text-[11px]">
            <span>Showing</span>
            <span className="font-semibold text-slate-800">
              {Math.min((currentPage - 1) * pageSize + 1, sortedData.length)}
            </span>
            <span>–</span>
            <span className="font-semibold text-slate-800">
              {Math.min(currentPage * pageSize, sortedData.length)}
            </span>
            <span>of</span>
            <span className="font-semibold text-slate-800">{sortedData.length}</span>
            <span>records</span>
          </div>

          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              aria-label="Previous page"
            >
              <PrevIcon className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px]">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              aria-label="Next page"
            >
              <NextIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
