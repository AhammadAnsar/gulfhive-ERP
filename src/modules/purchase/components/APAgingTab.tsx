import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Select, LoadingState } from '../../../design-system/index.ts';
import { Clock, TrendingDown, AlertCircle, DollarSign } from 'lucide-react';

interface APAgingTabProps {
  company: any;
}

export function APAgingTab({ company }: APAgingTabProps) {
  const { language } = useI18n();
  const [currency, setCurrency] = useState(company.baseCurrency || 'KWD');
  const [agingData, setAgingData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAging = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/procurement/reports/aging?currency=${currency}`);
      if (res.ok) {
        const data = await res.json();
        setAgingData(data.agingReport || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAging();
  }, [company.id, currency]);

  // Totals Calculation
  const totalCurrent = agingData.reduce((acc, row) => acc + parseFloat(row.current || 0), 0);
  const total30 = agingData.reduce((acc, row) => acc + parseFloat(row.days30 || 0), 0);
  const total60 = agingData.reduce((acc, row) => acc + parseFloat(row.days60 || 0), 0);
  const total90 = agingData.reduce((acc, row) => acc + parseFloat(row.days90 || 0), 0);
  const totalOver90 = agingData.reduce((acc, row) => acc + parseFloat(row.daysOver90 || 0), 0);
  const grandTotal = agingData.reduce((acc, row) => acc + parseFloat(row.totalOutstanding || 0), 0);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-3xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
            {language === 'ar' ? 'تقرير أعمار الديون وحسابات الدائنين (AP Aging)' : 'Accounts Payable Aging & Vendor Exposure'}
          </h3>
          <p className="text-[11px] text-slate-500">
            {language === 'ar' ? 'تحليل استحقاقات فواتير الموردين حسب الفترات الزمنية' : 'Categorize vendor obligations by maturity brackets to optimize cash flow.'}
          </p>
        </div>

        <div className="w-36">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="KWD">KWD (Kuwait)</option>
            <option value="SAR">SAR (Saudi)</option>
            <option value="AED">AED (UAE)</option>
            <option value="USD">USD</option>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 border rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-500">Current (0-30 Days)</div>
          <div className="text-base font-bold text-slate-900 font-mono mt-0.5">{totalCurrent.toFixed(3)} {currency}</div>
        </div>
        <div className="p-3 bg-slate-50 border rounded-lg">
          <div className="text-[10px] uppercase font-bold text-amber-600">31-60 Days</div>
          <div className="text-base font-bold text-amber-600 font-mono mt-0.5">{total30.toFixed(3)} {currency}</div>
        </div>
        <div className="p-3 bg-slate-50 border rounded-lg">
          <div className="text-[10px] uppercase font-bold text-orange-600">61-90 Days</div>
          <div className="text-base font-bold text-orange-600 font-mono mt-0.5">{total60.toFixed(3)} {currency}</div>
        </div>
        <div className="p-3 bg-slate-50 border rounded-lg">
          <div className="text-[10px] uppercase font-bold text-rose-600">Over 90 Days</div>
          <div className="text-base font-bold text-rose-600 font-mono mt-0.5">{(total90 + totalOver90).toFixed(3)} {currency}</div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Computing accounts payable aging brackets..." />
      ) : agingData.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400">
          {language === 'ar' ? 'لا توجد مستحقات معلقة للموردين في العملة المختارة.' : 'No open accounts payable balance.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left text-slate-900">
            <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3">Vendor</th>
                <th className="p-3 text-right">Current (0-30d)</th>
                <th className="p-3 text-right">31-60d</th>
                <th className="p-3 text-right">61-90d</th>
                <th className="p-3 text-right">&gt; 90d</th>
                <th className="p-3 text-right">Total Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {agingData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 font-semibold text-slate-900">
                    <div>{language === 'ar' ? row.supplierNameAr || row.supplierNameEn : row.supplierNameEn}</div>
                    <div className="text-[10px] font-mono text-slate-500">{row.supplierCode}</div>
                  </td>
                  <td className="p-3 text-right font-mono">{parseFloat(row.current || 0).toFixed(3)}</td>
                  <td className="p-3 text-right font-mono text-amber-700">{parseFloat(row.days30 || 0).toFixed(3)}</td>
                  <td className="p-3 text-right font-mono text-orange-700">{parseFloat(row.days60 || 0).toFixed(3)}</td>
                  <td className="p-3 text-right font-mono text-rose-700 font-semibold">
                    {(parseFloat(row.days90 || 0) + parseFloat(row.daysOver90 || 0)).toFixed(3)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900">
                    {parseFloat(row.totalOutstanding || 0).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
              <tr>
                <td className="p-3 uppercase">Total Accounts Payable</td>
                <td className="p-3 text-right font-mono">{totalCurrent.toFixed(3)}</td>
                <td className="p-3 text-right font-mono">{total30.toFixed(3)}</td>
                <td className="p-3 text-right font-mono">{total60.toFixed(3)}</td>
                <td className="p-3 text-right font-mono">{(total90 + totalOver90).toFixed(3)}</td>
                <td className="p-3 text-right font-mono font-bold text-slate-950">{grandTotal.toFixed(3)} {currency}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
