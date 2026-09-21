import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyHubs, listReports } from '../api/endpoints';
import type { Hub, DailyReport, Snapshot } from '../types/api';
import {
  todayIST,
  yesterdayIST,
  formatINR,
  displayDate,
  dailyTarget,
} from '../lib/format';
import { Calendar, ChevronRight, CheckCircle2, Clock, AlertCircle, Building2 } from 'lucide-react';

interface DateSummary {
  date: string;
  middayReport?: DailyReport;
  closingReport?: DailyReport;
  totalRevenue: number;
  target: number;
  achievementPct: number | null;
}

export function HistoryScreen() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [selectedHubId, setSelectedHubId] = useState<string>('all');
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const todayStr = todayIST();
  const yesterdayStr = yesterdayIST();

  // Compute 30 days ago in IST
  const thirtyDaysAgo = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d - 30));
    return dt.toISOString().slice(0, 10);
  }, [todayStr]);

  // Load hubs
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const myHubs = await getMyHubs();
        setHubs(myHubs);

        const hubIds = myHubs.map((h) => h.id);
        if (hubIds.length > 0) {
          const list = await listReports(hubIds, thirtyDaysAgo, todayStr);
          setReports(list);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load report history');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [thirtyDaysAgo, todayStr]);

  // Filter reports by selected hub
  const filteredReports = useMemo(() => {
    if (selectedHubId === 'all') return reports;
    return reports.filter((r) => r.hub_id === selectedHubId);
  }, [reports, selectedHubId]);

  // Group reports by date
  const dateSummaries = useMemo(() => {
    const map = new Map<string, DateSummary>();

    // Generate entries for past 30 days
    const [y, m, d] = todayStr.split('-').map(Number);
    for (let i = 0; i <= 30; i++) {
      const dt = new Date(Date.UTC(y, m - 1, d - i));
      const dateStr = dt.toISOString().slice(0, 10);

      // Determine active hub target
      const relevantHubs =
        selectedHubId === 'all'
          ? hubs
          : hubs.filter((h) => h.id === selectedHubId);
      const combinedTarget = relevantHubs.reduce(
        (sum, h) => sum + dailyTarget(h),
        0
      );

      map.set(dateStr, {
        date: dateStr,
        totalRevenue: 0,
        target: combinedTarget,
        achievementPct: null,
      });
    }

    // Populate with existing reports
    filteredReports.forEach((r) => {
      const entry = map.get(r.report_date);
      if (entry) {
        if (r.snapshot === 'midday') {
          entry.middayReport = r;
        } else if (r.snapshot === 'closing') {
          entry.closingReport = r;
          entry.totalRevenue += r.total_revenue;
        }
      }
    });

    // Calculate achievement percentages based on closing reports (or midday if closing not yet available)
    const list = Array.from(map.values()).map((summary) => {
      const activeRevenue = summary.closingReport
        ? summary.closingReport.total_revenue
        : summary.middayReport
        ? summary.middayReport.total_revenue
        : 0;

      const pct =
        summary.target > 0
          ? Math.round((activeRevenue / summary.target) * 100)
          : null;

      return {
        ...summary,
        totalRevenue: activeRevenue,
        achievementPct: pct,
      };
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredReports, todayStr, hubs, selectedHubId]);

  const handleRowClick = (date: string, snapshot: Snapshot, hubId?: string) => {
    const targetHubId =
      hubId || (selectedHubId !== 'all' ? selectedHubId : hubs[0]?.id || '');
    navigate(`/report?hubId=${targetHubId}&date=${date}&snapshot=${snapshot}`);
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-[6px] border border-[#D9DEDA]">
        <div>
          <h2 className="text-lg font-semibold text-[#16324F]">Report history</h2>
          <p className="text-xs text-[#5B6670]">
            Past 30 days of midday reviews and closing reports
          </p>
        </div>

        {/* Hub filter if multiple hubs */}
        {hubs.length > 1 && (
          <div className="w-full sm:w-64">
            <select
              value={selectedHubId}
              onChange={(e) => setSelectedHubId(e.target.value)}
              className="input-ledger w-full text-xs font-medium"
            >
              <option value="all">All mapped branches ({hubs.length})</option>
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-[#FEF3F2] border border-[#FECDCA] rounded-[6px] text-xs text-[#B42318]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-[#5B6670]">
          <div className="w-7 h-7 border-2 border-[#16324F] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading history logs…</p>
        </div>
      ) : (
        <div className="bg-white border border-[#D9DEDA] rounded-[6px] overflow-hidden shadow-xs">
          <div className="divide-y divide-[#D9DEDA]">
            {dateSummaries.map((item) => {
              const hasMidday = !!item.middayReport;
              const hasClosing = !!item.closingReport;
              const isToday = item.date === todayStr;
              const isYesterday = item.date === yesterdayStr;
              const targetSnapshot: Snapshot = hasClosing
                ? 'closing'
                : hasMidday
                ? 'midday'
                : 'closing';

              const reportHubId =
                item.closingReport?.hub_id ||
                item.middayReport?.hub_id ||
                (selectedHubId !== 'all' ? selectedHubId : hubs[0]?.id);

              return (
                <div
                  key={item.date}
                  onClick={() => handleRowClick(item.date, targetSnapshot, reportHubId)}
                  className="p-3.5 sm:p-4 hover:bg-[#F9FAF8] cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Left: Date info and snapshot status badges */}
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-[6px] bg-[#F0F5F9] border border-[#D1E0EC] flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] text-[#5B6670] uppercase font-bold leading-none">
                        {new Date(item.date).toLocaleDateString('en-IN', { month: 'short' })}
                      </span>
                      <span className="text-sm font-semibold text-[#16324F] leading-tight">
                        {item.date.split('-')[2]}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#1D2329]">
                          {displayDate(item.date)}
                        </span>
                        {isToday && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-[4px] bg-[#ECFDF3] text-[#1F7A4D] font-medium border border-[#ABEFC6]">
                            Today
                          </span>
                        )}
                        {isYesterday && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-[4px] bg-[#F0F5F9] text-[#16324F] font-medium border border-[#D1E0EC]">
                            Yesterday
                          </span>
                        )}
                      </div>

                      {/* Snapshot Badges */}
                      <div className="flex items-center gap-2 mt-1.5 text-xs">
                        {/* Mid-day Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border text-[11px] ${
                            hasMidday
                              ? 'bg-[#F0F5F9] border-[#D1E0EC] text-[#16324F]'
                              : 'bg-[#F7F8F6] border-[#D9DEDA] text-[#5B6670]'
                          }`}
                        >
                          {hasMidday ? (
                            <CheckCircle2 className="w-3 h-3 text-[#1F7A4D]" />
                          ) : (
                            <Clock className="w-3 h-3 text-[#5B6670]" />
                          )}
                          Mid-day: {hasMidday ? 'Submitted' : 'Missing'}
                        </span>

                        {/* Closing Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border text-[11px] ${
                            hasClosing
                              ? 'bg-[#ECFDF3] border-[#ABEFC6] text-[#1F7A4D]'
                              : 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
                          }`}
                        >
                          {hasClosing ? (
                            <CheckCircle2 className="w-3 h-3 text-[#1F7A4D]" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-[#B42318]" />
                          )}
                          Closing: {hasClosing ? 'Submitted' : 'Missing'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Revenue, Target and Achievement */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-0 border-[#D9DEDA]">
                    <div className="text-left sm:text-right">
                      <div className="text-sm font-semibold text-[#16324F] tabular-nums">
                        {formatINR(item.totalRevenue)}
                      </div>
                      <div className="text-xs text-[#5B6670] tabular-nums">
                        Target: {formatINR(item.target)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right min-w-[60px]">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-[4px] text-xs font-semibold tabular-nums ${
                            (item.achievementPct || 0) >= 100
                              ? 'bg-[#ECFDF3] text-[#1F7A4D]'
                              : (item.achievementPct || 0) >= 70
                              ? 'bg-[#FEF6EE] text-[#B7791F]'
                              : 'bg-[#FEF3F2] text-[#B42318]'
                          }`}
                        >
                          {item.achievementPct != null ? `${item.achievementPct}%` : '0%'}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#5B6670]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
