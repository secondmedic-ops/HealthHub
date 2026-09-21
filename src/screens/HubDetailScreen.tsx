import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getMyHubs,
  getDailyPerformance,
  listReports,
  getMtd,
} from '../api/endpoints';
import type { Hub, DailyPerformanceRow, DailyReport, MtdRow } from '../types/api';
import {
  todayIST,
  monthStart,
  formatINR,
  displayDate,
  dailyTarget,
} from '../lib/format';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  ArrowLeft,
  Building2,
  Calendar,
  AlertCircle,
  FileEdit,
  TrendingUp,
} from 'lucide-react';

export function HubDetailScreen() {
  const { hubId } = useParams<{ hubId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [hub, setHub] = useState<Hub | null>(null);
  const [perfData, setPerfData] = useState<DailyPerformanceRow[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [mtdRow, setMtdRow] = useState<MtdRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const todayStr = todayIST();
  const currentMonthStart = monthStart(todayStr);

  useEffect(() => {
    if (!hubId) return;

    let isMounted = true;
    async function loadHubDetails() {
      try {
        setLoading(true);
        setError(null);

        const myHubs = await getMyHubs();
        const foundHub = myHubs.find((h) => h.id === hubId);
        if (!foundHub) {
          throw new Error('Branch not found or not accessible by your role.');
        }
        if (!isMounted) return;
        setHub(foundHub);

        // Fetch daily performance for chart, reports for month table, and MTD row
        const activeHubId = hubId!;
        const [perf, monthReports, mtdList] = await Promise.all([
          getDailyPerformance(currentMonthStart, todayStr, activeHubId),
          listReports([activeHubId], currentMonthStart, todayStr),
          getMtd(currentMonthStart),
        ]);

        if (!isMounted) return;
        setPerfData(perf);
        setReports(monthReports);
        setMtdRow(mtdList.find((m) => m.hub_id === activeHubId) || null);
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Error loading branch details');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHubDetails();
    return () => {
      isMounted = false;
    };
  }, [hubId, currentMonthStart, todayStr]);

  // Transform performance data for Recharts
  const chartData = useMemo(() => {
    return perfData.map((d) => {
      const dayNum = d.report_date.split('-')[2];
      return {
        date: d.report_date,
        day: dayNum,
        Revenue: d.total_revenue,
        Target: d.daily_target,
      };
    });
  }, [perfData]);

  // Service Breakdown calculations
  const serviceBreakdown = useMemo(() => {
    if (!mtdRow) return [];
    const total = mtdRow.total_mtd || 1; // avoid / 0

    const items = [
      { name: 'Pharmacy', value: mtdRow.pharmacy_mtd, color: '#16324F' },
      { name: 'Pathology', value: mtdRow.pathology_mtd, color: '#1F7A4D' },
      { name: 'Radiology', value: mtdRow.radiology_mtd, color: '#0284C7' },
      { name: 'Optical', value: mtdRow.optical_mtd, color: '#9333EA' },
      { name: 'Homecare', value: mtdRow.homecare_mtd, color: '#D97706' },
      { name: 'OPD consults', value: mtdRow.opd_mtd, color: '#DC2626' },
    ];

    return items.map((item) => ({
      ...item,
      percentage: Math.round((item.value / total) * 100) || 0,
    }));
  }, [mtdRow]);


  // Table of month's reports sorted by date desc
  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => {
      if (a.report_date !== b.report_date) {
        return b.report_date.localeCompare(a.report_date);
      }
      return a.snapshot === 'closing' ? -1 : 1;
    });
  }, [reports]);

  const canEdit =
    profile?.role === 'manager' || profile?.role === 'super_admin';

  if (loading) {
    return (
      <div className="py-16 text-center text-[#5B6670]">
        <div className="w-7 h-7 border-2 border-[#16324F] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm">Loading branch analytics…</p>
      </div>
    );
  }

  if (error || !hub) {
    return (
      <div className="p-6 bg-white border border-[#D9DEDA] rounded-[6px] text-center space-y-4">
        <p className="text-sm text-[#B42318]">{error || 'Branch not found'}</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="btn-secondary text-xs px-4"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="bg-white p-4 rounded-[6px] border border-[#D9DEDA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[6px] border border-[#D9DEDA] hover:bg-[#F0F2EE] transition-colors text-[#16324F]"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#16324F]">{hub.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded-[4px] bg-[#F0F5F9] text-[#16324F] font-mono border border-[#D1E0EC]">
                {hub.code}
              </span>
            </div>
            <p className="text-xs text-[#5B6670]">
              Monthly target: {formatINR(hub.monthly_revenue_target)} · Daily:{' '}
              {formatINR(dailyTarget(hub))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/report?hubId=${hub.id}`)}
            className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Submit / Edit report</span>
          </button>
        </div>
      </div>

      {/* 1. Line Chart: Daily total_revenue vs daily_target */}
      <div className="bg-white p-4 rounded-[6px] border border-[#D9DEDA] shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#D9DEDA] pb-2">
          <div>
            <h3 className="text-sm font-semibold text-[#16324F]">
              Daily revenue vs daily target
            </h3>
            <p className="text-xs text-[#5B6670]">Current month day-by-day trajectory</p>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full pt-2">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#5B6670]">
              No reports submitted yet for this month.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E8ECE9" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#5B6670' }}
                  tickLine={false}
                  axisLine={{ stroke: '#D9DEDA' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#5B6670' }}
                  tickLine={false}
                  axisLine={{ stroke: '#D9DEDA' }}
                  tickFormatter={(val) => `₹${val >= 1000 ? Math.round(val / 1000) + 'k' : val}`}
                />
                <Tooltip
                  formatter={(val: any) => [formatINR(Number(val) || 0), '']}
                  labelFormatter={(label) => `Day ${label}`}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#D9DEDA',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                />
                <Line
                  type="monotone"
                  dataKey="Revenue"
                  stroke="#16324F"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#16324F' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="Target"
                  stroke="#B7791F"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 2. MTD split by service as horizontal bar list */}
      <div className="bg-white p-4 rounded-[6px] border border-[#D9DEDA] shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#D9DEDA] pb-2">
          <div>
            <h3 className="text-sm font-semibold text-[#16324F]">
              MTD service mix
            </h3>
            <p className="text-xs text-[#5B6670]">
              Total MTD revenue:{' '}
              <strong className="text-[#16324F]">
                {formatINR(mtdRow?.total_mtd || 0)}
              </strong>
            </p>

          </div>
        </div>

        <div className="space-y-3 pt-1">
          {serviceBreakdown.map((srv) => (
            <div key={srv.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#1D2329]">{srv.name}</span>
                <span className="tabular-nums font-semibold text-[#16324F]">
                  {formatINR(srv.value)}{' '}
                  <span className="text-[#5B6670] font-normal">({srv.percentage}%)</span>
                </span>
              </div>
              <div className="w-full bg-[#EAEFEA] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${srv.percentage}%`,
                    backgroundColor: srv.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Table of month's reports (both snapshots) with variance reasons visible */}
      <div className="bg-white rounded-[6px] border border-[#D9DEDA] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#D9DEDA]">
          <h3 className="text-sm font-semibold text-[#16324F]">
            Month's submitted reports
          </h3>
          <p className="text-xs text-[#5B6670]">
            Review all entries and operational variance reasons
            {canEdit && ' (tap any row to edit)'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F0F5F9] text-[#16324F] border-b border-[#D9DEDA]">
                <th className="py-2.5 px-3 sm:px-4 font-semibold">Date</th>
                <th className="py-2.5 px-3 font-semibold">Snapshot</th>
                <th className="py-2.5 px-3 sm:px-4 font-semibold text-right">Revenue</th>
                <th className="py-2.5 px-3 sm:px-4 font-semibold">Variance / Action plan</th>
                <th className="py-2.5 px-3 font-semibold text-right">Bills</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DEDA]">
              {sortedReports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-[#5B6670]">
                    No reports logged yet for this month.
                  </td>
                </tr>
              ) : (
                sortedReports.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() =>
                      canEdit &&
                      navigate(
                        `/report?hubId=${hub.id}&date=${r.report_date}&snapshot=${r.snapshot}`
                      )
                    }
                    className={`transition-colors ${
                      canEdit
                        ? 'hover:bg-[#F9FAF8] cursor-pointer'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-3 sm:px-4 font-medium text-[#1D2329] whitespace-nowrap">
                      {displayDate(r.report_date)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-[4px] text-[11px] font-medium ${
                          r.snapshot === 'closing'
                            ? 'bg-[#ECFDF3] text-[#1F7A4D] border border-[#ABEFC6]'
                            : 'bg-[#F0F5F9] text-[#16324F] border border-[#D1E0EC]'
                        }`}
                      >
                        {r.snapshot === 'closing' ? 'Closing' : 'Mid-day'}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right font-semibold text-[#16324F] tabular-nums whitespace-nowrap">
                      {formatINR(r.total_revenue)}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-xs text-[#5B6670] max-w-xs sm:max-w-md">
                      {r.variance_reason ? (
                        <div className="text-[#B42318] leading-tight">
                          <span className="font-semibold">Variance:</span> {r.variance_reason}
                        </div>
                      ) : r.gap_action_plan ? (
                        <div className="text-[#16324F] leading-tight">
                          <span className="font-semibold">Plan:</span> {r.gap_action_plan}
                        </div>
                      ) : (
                        <span className="text-[#8EA6B9]">On target — no notes</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-[#5B6670] whitespace-nowrap">
                      {r.total_bills ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
