import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { getPnl, getCosts, saveCost } from '../api/endpoints';
import type { PnlRow, MonthlyCost } from '../types/api';
import { todayIST, monthStart, formatINR } from '../lib/format';
import {
  Calendar,
  Download,
  Check,
  Save,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export function PnlScreen() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const currentMonth = monthStart(todayIST());
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  const [pnlRows, setPnlRows] = useState<PnlRow[]>([]);
  const [costMap, setCostMap] = useState<
    Record<string, { direct: string; indirect: string }>
  >({});
  const [savingCostHubId, setSavingCostHubId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load P&L and Cost rows for the selected month
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [pnlData, costsData] = await Promise.all([
        getPnl(selectedMonth),
        getCosts(selectedMonth),
      ]);

      setPnlRows(pnlData);

      // Populate local editable cost state
      const initialCosts: Record<
        string,
        { direct: string; indirect: string }
      > = {};

      pnlData.forEach((row) => {
        const c = costsData.find((item) => item.hub_id === row.hub_id);
        const derivedIndirect = Math.max(0, (row.total_cost || 0) - (row.direct_cost || 0));
        initialCosts[row.hub_id] = {
          direct: c?.direct_cost != null ? String(c.direct_cost) : String(row.direct_cost || 0),
          indirect: c?.indirect_cost != null ? String(c.indirect_cost) : String(derivedIndirect),
        };
      });
      setCostMap(initialCosts);
    } catch (err: any) {
      setError(err.message || 'Error loading P&L ledger');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle saving an inline cost
  const handleSaveCost = async (hubId: string) => {
    const entry = costMap[hubId];
    if (!entry) return;

    const direct = Math.max(0, Number(entry.direct) || 0);
    const indirect = Math.max(0, Number(entry.indirect) || 0);

    setSavingCostHubId(hubId);
    try {
      await saveCost(hubId, selectedMonth, direct, indirect);
      toast('Cost updated and P&L recalculated', 'success');
      // Re-fetch P&L row
      const updatedPnl = await getPnl(selectedMonth);
      setPnlRows(updatedPnl);
    } catch (err: any) {
      toast(err.message || 'Failed to save costs', 'error');
    } finally {
      setSavingCostHubId(null);
    }
  };

  // Format Net Profit: negative net profit in shortfall colour with minus sign, never brackets
  const renderNetProfit = (val: number) => {
    if (val < 0) {
      return (
        <span className="text-[#B42318] font-bold tabular-nums">
          -{formatINR(Math.abs(val))}
        </span>
      );
    }
    return (
      <span className="text-[#1F7A4D] font-bold tabular-nums">
        {formatINR(val)}
      </span>
    );
  };

  // Totals calculations
  const totals = useMemo(() => {
    return pnlRows.reduce(
      (acc, r) => {
        const indirect = Math.max(0, r.total_cost - r.direct_cost);
        return {
          actual_revenue: acc.actual_revenue + r.actual_revenue,
          direct_cost: acc.direct_cost + r.direct_cost,
          gross_profit: acc.gross_profit + r.gross_profit,
          indirect_cost: acc.indirect_cost + indirect,
          total_cost: acc.total_cost + r.total_cost,
          net_profit: acc.net_profit + r.net_profit,
        };
      },
      {
        actual_revenue: 0,
        direct_cost: 0,
        gross_profit: 0,
        indirect_cost: 0,
        total_cost: 0,
        net_profit: 0,
      }
    );
  }, [pnlRows]);

  // Download CSV button producing identical ledger columns
  const handleDownloadCsv = () => {
    const headers = [
      'Particulars',
      'Branch Code',
      'Month',
      'Actual Revenue',
      'Direct Cost',
      'Gross Profit',
      'Indirect Cost',
      'Total Cost',
      'Net Profit/Loss',
    ];

    const rows = pnlRows.map((r) => {
      const indirect = Math.max(0, r.total_cost - r.direct_cost);
      return [
        `"${r.hub_name.replace(/"/g, '""')}"`,
        r.hub_code,
        r.period_month,
        r.actual_revenue,
        r.direct_cost,
        r.gross_profit,
        indirect,
        r.total_cost,
        r.net_profit,
      ];
    });

    // Add totals row
    rows.push([
      '"Total"',
      '""',
      selectedMonth,
      totals.actual_revenue,
      totals.direct_cost,
      totals.gross_profit,
      totals.indirect_cost,
      totals.total_cost,
      totals.net_profit,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `healthhub_pnl_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('CSV downloaded', 'success');
  };

  // Generate month list for dropdown (last 12 months)
  const monthOptions: { value: string; label: string }[] = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
      const val = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
      list.push({ value: val, label });
    }
    return list;
  }, []);

  return (
    <div className="space-y-4">
      {/* Top Header: Title, Month Selector, Download CSV */}
      <div className="bg-white p-4 rounded-[6px] border border-[#D9DEDA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-[#16324F]">
            Branch profit & loss
          </h2>
          <p className="text-xs text-[#5B6670]">
            Financial performance, cost deductions, and net margins
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month picker */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#5B6670]">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-ledger text-xs font-semibold py-1.5"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Download CSV */}
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={pnlRows.length === 0}
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#FEF3F2] border border-[#FECDCA] rounded-[6px] text-xs text-[#B42318]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-[#5B6670]">
          <div className="w-7 h-7 border-2 border-[#16324F] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Calculating P&L balances…</p>
        </div>
      ) : (
        <div className="bg-white border border-[#D9DEDA] rounded-[6px] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#16324F] text-white border-b border-[#16324F]">
                  <th className="py-3 px-3 sm:px-4 font-semibold">
                    Particulars (Branch)
                  </th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">
                    Actual revenue
                  </th>
                  <th className="py-3 px-3 font-semibold text-center whitespace-nowrap">
                    Direct cost (₹)
                  </th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">
                    Gross profit
                  </th>
                  <th className="py-3 px-3 font-semibold text-center whitespace-nowrap">
                    Indirect cost (₹)
                  </th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">
                    Total cost
                  </th>
                  <th className="py-3 px-3 sm:px-4 font-semibold text-right whitespace-nowrap">
                    Net profit / loss
                  </th>
                  <th className="py-3 px-2 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9DEDA]">
                {pnlRows.map((row) => {
                  const derivedIndirect = Math.max(0, row.total_cost - row.direct_cost);
                  const currentCosts = costMap[row.hub_id] || {
                    direct: String(row.direct_cost || 0),
                    indirect: String(derivedIndirect),
                  };
                  const isDirty =
                    Number(currentCosts.direct) !== row.direct_cost ||
                    Number(currentCosts.indirect) !== derivedIndirect;

                  return (
                    <tr key={row.hub_id} className="hover:bg-[#F9FAF8]">
                      {/* Branch Name */}
                      <td className="py-3 px-3 sm:px-4">
                        <div className="font-semibold text-[#16324F]">
                          {row.hub_name}
                        </div>
                        <div className="text-[11px] text-[#5B6670]">
                          {row.hub_code}
                        </div>
                      </td>

                      {/* Actual Revenue */}
                      <td className="py-3 px-3 text-right font-medium text-[#1D2329] tabular-nums whitespace-nowrap">
                        {formatINR(row.actual_revenue)}
                      </td>

                      {/* Inline Editable Direct Cost */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={currentCosts.direct}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.]/g, '');
                            setCostMap((prev) => ({
                              ...prev,
                              [row.hub_id]: {
                                ...prev[row.hub_id],
                                direct: val,
                              },
                            }));
                          }}
                          className="input-ledger w-28 text-right py-1 px-2 text-xs"
                          placeholder="0"
                        />
                      </td>

                      {/* Gross Profit */}
                      <td className="py-3 px-3 text-right font-medium tabular-nums whitespace-nowrap">
                        <span
                          className={
                            row.gross_profit < 0
                              ? 'text-[#B42318]'
                              : 'text-[#16324F]'
                          }
                        >
                          {row.gross_profit < 0
                            ? `-${formatINR(Math.abs(row.gross_profit))}`
                            : formatINR(row.gross_profit)}
                        </span>
                      </td>

                      {/* Inline Editable Indirect Cost */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={currentCosts.indirect}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.]/g, '');
                            setCostMap((prev) => ({
                              ...prev,
                              [row.hub_id]: {
                                ...prev[row.hub_id],
                                indirect: val,
                              },
                            }));
                          }}
                          className="input-ledger w-28 text-right py-1 px-2 text-xs"
                          placeholder="0"
                        />
                      </td>

                      {/* Total Cost */}
                      <td className="py-3 px-3 text-right text-[#5B6670] tabular-nums whitespace-nowrap">
                        {formatINR(row.total_cost)}
                      </td>

                      {/* Net Profit/Loss */}
                      <td className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                        {renderNetProfit(row.net_profit)}
                      </td>

                      {/* Save cost button (shows if modified) */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        {isDirty && (
                          <button
                            type="button"
                            disabled={savingCostHubId === row.hub_id}
                            onClick={() => handleSaveCost(row.hub_id)}
                            className="btn-primary text-[11px] px-2.5 py-1 min-h-[32px] flex items-center gap-1"
                            title="Save cost changes"
                          >
                            <Save className="w-3 h-3" />
                            <span>
                              {savingCostHubId === row.hub_id ? '…' : 'Save'}
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals Row */}
              <tfoot>
                <tr className="bg-[#F0F5F9] font-bold text-[#16324F] border-t-2 border-[#16324F]">
                  <td className="py-3.5 px-3 sm:px-4">
                    Total ({pnlRows.length} branches)
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {formatINR(totals.actual_revenue)}
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {formatINR(totals.direct_cost)}
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap">
                    <span
                      className={
                        totals.gross_profit < 0 ? 'text-[#B42318]' : ''
                      }
                    >
                      {totals.gross_profit < 0
                        ? `-${formatINR(Math.abs(totals.gross_profit))}`
                        : formatINR(totals.gross_profit)}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {formatINR(totals.indirect_cost)}
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {formatINR(totals.total_cost)}
                  </td>
                  <td className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap">
                    {renderNetProfit(totals.net_profit)}
                  </td>
                  <td className="py-3.5 px-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
