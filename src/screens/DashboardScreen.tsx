import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyHubs, listReports, getMtd } from '../api/endpoints';
import type { Hub, DailyReport, MtdRow } from '../types/api';
import {
  todayIST,
  hourIST,
  monthStart,
  formatINR,
  dailyTarget,
} from '../lib/format';
import {
  ChevronRight,
  Check,
  AlertTriangle,
  Building2,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';

type Tone = 'good' | 'warning' | 'critical' | 'neutral';

const TONE_STYLES: Record<Tone, { bg: string; border: string; text: string; fill: string; iconBg: string }> = {
  good: { bg: '#ECFDF3', border: '#ABEFC6', text: '#1F7A4D', fill: '#1F7A4D', iconBg: '#DFF7E8' },
  warning: { bg: '#FEF6EE', border: '#FBD9A0', text: '#B7791F', fill: '#B7791F', iconBg: '#FCEBD5' },
  critical: { bg: '#FEF3F2', border: '#FECDCA', text: '#B42318', fill: '#B42318', iconBg: '#FDE1DE' },
  neutral: { bg: '#FFFFFF', border: '#D9DEDA', text: '#16324F', fill: '#16324F', iconBg: '#F0F5F9' },
};

/** A single summary figure: label, compact value, one line of context, and an
 * optional meter. Kept local to this screen — it's a small, single-use shape. */
function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
  meterPct,
  icon: Icon,
  onClick,
  active,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: Tone;
  meterPct?: number;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  active?: boolean;
}) {
  const t = TONE_STYLES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[6px] border p-3.5 sm:p-4 shadow-xs text-left w-full transition-all hover:shadow-sm hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16324F] focus-visible:ring-offset-1"
      style={{
        backgroundColor: t.bg,
        borderColor: active ? t.text : t.border,
        boxShadow: active ? `0 0 0 2px ${t.text}` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: t.text }}>
          {label}
        </p>
        <div
          className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: t.iconBg }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: t.text }} />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-semibold text-[#16324F] mt-1.5 leading-tight">
        {value}
      </p>
      <p className="text-[11px] text-[#5B6670] mt-1">{sub}</p>
      {typeof meterPct === 'number' && (
        <div className="mt-2.5 h-1.5 rounded-full bg-[#EEF0ED] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, meterPct))}%`, backgroundColor: t.fill }}
          />
        </div>
      )}
    </button>
  );
}

type BoardFilter = 'all' | 'onTrack' | 'attention';

interface HubDashboardRow {
  hub: Hub;
  middayReport?: DailyReport;
  closingReport?: DailyReport;
  todayRevenue: number;
  todayTarget: number;
  achievementPct: number;
  mtdRevenue: number;
  monthlyTarget: number;
  monthlyGap: number;
  middayAlert: boolean;
  closingAlert: boolean;
}

export function DashboardScreen() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState<string>(todayIST());
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [mtdRows, setMtdRows] = useState<MtdRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [boardFilter, setBoardFilter] = useState<BoardFilter>('all');
  const tableRef = useRef<HTMLDivElement>(null);

  const todayStr = todayIST();
  const currentHour = hourIST();
  const activeMonthStart = monthStart(selectedDate);

  // Fetch hubs, reports for selected date, and MTD
  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const myHubs = await getMyHubs();
        if (!isMounted) return;
        setHubs(myHubs);

        const hubIds = myHubs.map((h) => h.id);
        if (hubIds.length > 0) {
          const [dailyReports, mtdList] = await Promise.all([
            listReports(hubIds, selectedDate, selectedDate),
            getMtd(activeMonthStart),
          ]);
          if (!isMounted) return;
          setReports(dailyReports);
          setMtdRows(mtdList);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load dashboard');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [selectedDate, activeMonthStart]);

  // Compute row data
  const boardRows: HubDashboardRow[] = useMemo(() => {
    const isSelectedToday = selectedDate === todayStr;
    const isPastDay = selectedDate < todayStr;

    return hubs.map((hub) => {
      const midday = reports.find(
        (r) => r.hub_id === hub.id && r.snapshot === 'midday'
      );
      const closing = reports.find(
        (r) => r.hub_id === hub.id && r.snapshot === 'closing'
      );

      const mtd = mtdRows.find((m) => m.hub_id === hub.id);

      const target = dailyTarget(hub);
      // Revenue for today is closing report if submitted, else midday report
      const rev = closing?.total_revenue ?? midday?.total_revenue ?? 0;
      const pct = target > 0 ? Math.round((rev / target) * 100) : 0;

      const mtdRev = mtd?.total_mtd ?? 0;
      const monthlyTgt = hub.monthly_revenue_target;

      const mtdGap = Math.max(0, monthlyTgt - mtdRev);

      // Alert rules:
      // No closing report after 11 PM IST (23:00) or if past day
      const closingAlert =
        !closing && (isPastDay || (isSelectedToday && currentHour >= 23));

      // No midday report after 3 PM IST (15:00) or if past day
      const middayAlert =
        !midday && (isPastDay || (isSelectedToday && currentHour >= 15));

      return {
        hub,
        middayReport: midday,
        closingReport: closing,
        todayRevenue: rev,
        todayTarget: target,
        achievementPct: pct,
        mtdRevenue: mtdRev,
        monthlyTarget: monthlyTgt,
        monthlyGap: mtdGap,
        middayAlert,
        closingAlert,
      };
    }).sort((a, b) => a.achievementPct - b.achievementPct); // lowest first: branches needing a call at the top!
  }, [hubs, reports, mtdRows, selectedDate, todayStr, currentHour]);

  // Compute summary totals row
  const totals = useMemo(() => {
    return boardRows.reduce(
      (acc, row) => ({
        todayRevenue: acc.todayRevenue + row.todayRevenue,
        todayTarget: acc.todayTarget + row.todayTarget,
        mtdRevenue: acc.mtdRevenue + row.mtdRevenue,
        monthlyTarget: acc.monthlyTarget + row.monthlyTarget,
        monthlyGap: acc.monthlyGap + row.monthlyGap,
      }),
      {
        todayRevenue: 0,
        todayTarget: 0,
        mtdRevenue: 0,
        monthlyTarget: 0,
        monthlyGap: 0,
      }
    );
  }, [boardRows]);

  const overallAchievement =
    totals.todayTarget > 0
      ? Math.round((totals.todayRevenue / totals.todayTarget) * 100)
      : 0;

  const mtdAchievement =
    totals.monthlyTarget > 0
      ? Math.round((totals.mtdRevenue / totals.monthlyTarget) * 100)
      : 0;

  const onTrackCount = boardRows.filter((r) => r.achievementPct >= 100).length;
  const attentionCount = boardRows.filter((r) => r.middayAlert || r.closingAlert).length;

  const visibleRows = useMemo(() => {
    if (boardFilter === 'onTrack') return boardRows.filter((r) => r.achievementPct >= 100);
    if (boardFilter === 'attention') return boardRows.filter((r) => r.middayAlert || r.closingAlert);
    return boardRows;
  }, [boardRows, boardFilter]);

  const scrollToTable = () => {
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleFilter = (mode: BoardFilter) => {
    setBoardFilter((current) => (current === mode ? 'all' : mode));
    scrollToTable();
  };

  const formatReportTime = (ts?: string) => {
    if (!ts) return '';
    try {
      const dt = new Date(ts);
      return dt.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  const monthName = new Date(selectedDate + 'T00:00:00').toLocaleDateString(
    'en-IN',
    { month: 'long', year: 'numeric' }
  );

  return (
    <div className="space-y-4">
      {/* Top Header: Title, Month and Date Selector */}
      <div className="bg-white p-4 rounded-[6px] border border-[#D9DEDA] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[#16324F]">Branch board</h2>
            <span className="text-xs px-2 py-0.5 rounded-[4px] bg-[#F0F5F9] text-[#16324F] font-medium border border-[#D1E0EC]">
              {monthName}
            </span>
          </div>
          <p className="text-xs text-[#5B6670] mt-0.5">
            Ranked by daily achievement (lowest first — call branches at the top)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="dashboard-date" className="text-xs font-medium text-[#5B6670]">
            Review date:
          </label>
          <input
            id="dashboard-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-ledger text-xs font-medium"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#FEF3F2] border border-[#FECDCA] rounded-[6px] text-xs text-[#B42318]">
          {error}
        </div>
      )}

      {!loading && !error && boardRows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="Today's revenue"
            value={formatINR(totals.todayRevenue)}
            sub={`of ${formatINR(totals.todayTarget)} target`}
            tone={overallAchievement >= 100 ? 'good' : overallAchievement >= 70 ? 'warning' : 'critical'}
            meterPct={overallAchievement}
            icon={TrendingUp}
            onClick={() => {
              setBoardFilter('all');
              scrollToTable();
            }}
          />
          <StatTile
            label="MTD revenue"
            value={formatINR(totals.mtdRevenue)}
            sub={
              totals.monthlyGap === 0
                ? `Monthly target met`
                : `${formatINR(totals.monthlyGap)} left of ${formatINR(totals.monthlyTarget)}`
            }
            tone="neutral"
            meterPct={mtdAchievement}
            icon={Building2}
            onClick={() => {
              setBoardFilter('all');
              scrollToTable();
            }}
          />
          <StatTile
            label="On track today"
            value={`${onTrackCount} / ${boardRows.length}`}
            sub="branches at or above target"
            tone={onTrackCount === boardRows.length ? 'good' : 'neutral'}
            icon={CheckCircle2}
            onClick={() => toggleFilter('onTrack')}
            active={boardFilter === 'onTrack'}
          />
          <StatTile
            label="Needs attention"
            value={String(attentionCount)}
            sub={attentionCount === 0 ? 'all reports on time' : 'branches with a missing report'}
            tone={attentionCount === 0 ? 'good' : 'critical'}
            icon={AlertTriangle}
            onClick={() => toggleFilter('attention')}
            active={boardFilter === 'attention'}
          />
        </div>
      )}

      {!loading && !error && boardFilter !== 'all' && (
        <div className="flex items-center justify-between gap-2 bg-[#F0F5F9] border border-[#D1E0EC] rounded-[6px] px-3.5 py-2 text-xs text-[#16324F]">
          <span>
            Showing <strong>{visibleRows.length}</strong> of {boardRows.length} branches —{' '}
            {boardFilter === 'onTrack' ? 'at or above target today' : 'need attention'}
          </span>
          <button
            type="button"
            onClick={() => setBoardFilter('all')}
            className="font-medium text-[#16324F] hover:underline shrink-0"
          >
            Clear filter
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-[#5B6670]">
          <div className="w-7 h-7 border-2 border-[#16324F] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading branch board…</p>
        </div>
      ) : (
        <div ref={tableRef} className="bg-white border border-[#D9DEDA] rounded-[6px] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#16324F] text-white border-b border-[#16324F]">
                  <th className="py-3 px-3 sm:px-4 font-semibold">Branch</th>
                  <th className="py-3 px-2 sm:px-3 font-semibold text-center whitespace-nowrap">
                    Mid-day
                  </th>
                  <th className="py-3 px-2 sm:px-3 font-semibold text-center whitespace-nowrap">
                    Closing
                  </th>
                  <th className="py-3 px-3 sm:px-4 font-semibold text-right whitespace-nowrap">
                    Today's revenue
                  </th>
                  <th className="py-3 px-3 sm:px-4 font-semibold text-right whitespace-nowrap">
                    Target
                  </th>
                  <th className="py-3 px-2 sm:px-3 font-semibold text-center whitespace-nowrap">
                    Achievement
                  </th>
                  <th className="py-3 px-3 sm:px-4 font-semibold text-right whitespace-nowrap">
                    MTD revenue
                  </th>
                  <th className="py-3 px-3 sm:px-4 font-semibold text-right whitespace-nowrap">
                    Gap to month target
                  </th>
                  <th className="py-3 px-2 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9DEDA]">
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-sm text-[#5B6670]">
                      No branches match this filter right now.
                    </td>
                  </tr>
                )}
                {visibleRows.map((row, idx) => (
                  <tr
                    key={row.hub.id}
                    onClick={() => navigate(`/hub/${row.hub.id}`)}
                    className={`hover:bg-[#F0F5F9] cursor-pointer transition-colors ${
                      idx % 2 === 1 ? 'bg-[#FAFBFA]' : 'bg-white'
                    }`}
                  >
                    {/* Branch Name & Code */}
                    <td className="py-3 px-3 sm:px-4">
                      <div className="font-semibold text-[#16324F]">{row.hub.name}</div>
                      <div className="text-[11px] text-[#5B6670]">{row.hub.code}</div>
                    </td>

                    {/* Mid-day Status */}
                    <td className="py-3 px-2 sm:px-3 text-center whitespace-nowrap">
                      {row.middayReport ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#1F7A4D] font-medium bg-[#ECFDF3] border border-[#ABEFC6] px-2 py-0.5 rounded-[4px]">
                          <Check className="w-3 h-3" />
                          {formatReportTime(row.middayReport.submitted_at)}
                        </span>
                      ) : (
                        <span
                          className={`inline-block text-[11px] px-2 py-0.5 rounded-[4px] font-medium ${
                            row.middayAlert
                              ? 'bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]'
                              : 'bg-[#F7F8F6] text-[#5B6670] border border-[#D9DEDA]'
                          }`}
                        >
                          Missing
                        </span>
                      )}
                    </td>

                    {/* Closing Status */}
                    <td className="py-3 px-2 sm:px-3 text-center whitespace-nowrap">
                      {row.closingReport ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#1F7A4D] font-medium bg-[#ECFDF3] border border-[#ABEFC6] px-2 py-0.5 rounded-[4px]">
                          <Check className="w-3 h-3" />
                          {formatReportTime(row.closingReport.submitted_at)}
                        </span>
                      ) : (
                        <span
                          className={`inline-block text-[11px] px-2 py-0.5 rounded-[4px] font-medium ${
                            row.closingAlert
                              ? 'bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]'
                              : 'bg-[#F7F8F6] text-[#5B6670] border border-[#D9DEDA]'
                          }`}
                        >
                          Missing
                        </span>
                      )}
                    </td>

                    {/* Today's Revenue */}
                    <td className="py-3 px-3 sm:px-4 text-right font-semibold text-[#1D2329] tabular-nums whitespace-nowrap">
                      {formatINR(row.todayRevenue)}
                    </td>

                    {/* Today's Target */}
                    <td className="py-3 px-3 sm:px-4 text-right text-[#5B6670] tabular-nums whitespace-nowrap">
                      {formatINR(row.todayTarget)}
                    </td>

                    {/* Achievement % */}
                    <td className="py-3 px-2 sm:px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-[4px] font-semibold text-xs tabular-nums ${
                          row.achievementPct >= 100
                            ? 'bg-[#ECFDF3] text-[#1F7A4D]'
                            : row.achievementPct >= 70
                            ? 'bg-[#FEF6EE] text-[#B7791F]'
                            : 'bg-[#FEF3F2] text-[#B42318]'
                        }`}
                      >
                        {row.achievementPct}%
                      </span>
                      <div className="w-16 h-1 rounded-full bg-[#EEF0ED] mx-auto mt-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, row.achievementPct))}%`,
                            backgroundColor:
                              row.achievementPct >= 100
                                ? '#1F7A4D'
                                : row.achievementPct >= 70
                                ? '#B7791F'
                                : '#B42318',
                          }}
                        />
                      </div>
                    </td>

                    {/* MTD Revenue */}
                    <td className="py-3 px-3 sm:px-4 text-right font-medium text-[#16324F] tabular-nums whitespace-nowrap">
                      {formatINR(row.mtdRevenue)}
                    </td>

                    {/* Gap to Monthly Target */}
                    <td className="py-3 px-3 sm:px-4 text-right text-[#5B6670] tabular-nums whitespace-nowrap">
                      {row.monthlyGap === 0 ? (
                        <span className="text-[#1F7A4D] font-medium">Met</span>
                      ) : (
                        formatINR(row.monthlyGap)
                      )}
                    </td>

                    {/* Action icon */}
                    <td className="py-3 px-2 text-center text-[#5B6670]">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Totals Row at the bottom */}
              <tfoot>
                <tr className="bg-[#F0F5F9] font-bold text-[#16324F] border-t-2 border-[#16324F]">
                  <td className="py-3.5 px-3 sm:px-4">Total ({boardRows.length} branches)</td>
                  <td className="py-3.5 px-2 text-center">—</td>
                  <td className="py-3.5 px-2 text-center">—</td>
                  <td className="py-3.5 px-3 sm:px-4 text-right tabular-nums whitespace-nowrap">
                    {formatINR(totals.todayRevenue)}
                  </td>
                  <td className="py-3.5 px-3 sm:px-4 text-right tabular-nums whitespace-nowrap">
                    {formatINR(totals.todayTarget)}
                  </td>
                  <td className="py-3.5 px-2 text-center tabular-nums whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-[4px] text-xs font-bold ${
                        overallAchievement >= 100
                          ? 'bg-[#ECFDF3] text-[#1F7A4D]'
                          : overallAchievement >= 70
                          ? 'bg-[#FEF6EE] text-[#B7791F]'
                          : 'bg-[#FEF3F2] text-[#B42318]'
                      }`}
                    >
                      {overallAchievement}%
                    </span>
                  </td>
                  <td className="py-3.5 px-3 sm:px-4 text-right tabular-nums whitespace-nowrap">
                    {formatINR(totals.mtdRevenue)}
                  </td>
                  <td className="py-3.5 px-3 sm:px-4 text-right tabular-nums whitespace-nowrap">
                    {formatINR(totals.monthlyGap)}
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
