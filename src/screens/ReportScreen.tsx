import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  getMyHubs,
  getReport,
  saveReport,
  getMtd,
} from '../api/endpoints';
import type { Hub, DailyReportInput, Snapshot, MtdRow } from '../types/api';
import {
  todayIST,
  yesterdayIST,
  defaultSnapshot,
  monthStart,
  formatINR,
  formatNum,
  dailyTarget,
  dailyBreakeven,
  pharmacySale,
  totalRevenue,
  revenuePerBill,
  emptyReport,
  buildWhatsAppText,
} from '../lib/format';
import { motion } from 'motion/react';
import {
  Building2,
  Calendar,
  Clock,
  Copy,
  CheckCircle,
  AlertTriangle,
  Send,
  AlertCircle,
} from 'lucide-react';

export function ReportScreen() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [selectedHubId, setSelectedHubId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    searchParams.get('date') || todayIST()
  );
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot>(
    (searchParams.get('snapshot') as Snapshot) || defaultSnapshot()
  );

  const [form, setForm] = useState<DailyReportInput | null>(null);
  const [savedTime, setSavedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [showWhatsAppCopy, setShowWhatsAppCopy] = useState<boolean>(false);
  const [mtdData, setMtdData] = useState<MtdRow | null>(null);

  const todayStr = todayIST();
  const yesterdayStr = yesterdayIST();

  const isManagerOrAdmin =
    profile?.role === 'manager' || profile?.role === 'super_admin';
  const isOlderThanYesterday =
    selectedDate < yesterdayStr && !isManagerOrAdmin;

  // 1. Fetch hubs for this user
  useEffect(() => {
    async function loadHubs() {
      try {
        const list = await getMyHubs();
        setHubs(list);
        const queryHub = searchParams.get('hubId');
        if (queryHub && list.some((h) => h.id === queryHub)) {
          setSelectedHubId(queryHub);
        } else if (list.length > 0) {
          setSelectedHubId(list[0].id);
        }
      } catch (err: any) {
        toast(err.message || 'Could not load branch details', 'error');
      }
    }
    loadHubs();
  }, [searchParams, toast]);

  const activeHub = useMemo(
    () => hubs.find((h) => h.id === selectedHubId) || hubs[0],
    [hubs, selectedHubId]
  );

  const draftStorageKey = useMemo(() => {
    if (!selectedHubId) return '';
    return `draft_${selectedHubId}_${selectedDate}_${selectedSnapshot}`;
  }, [selectedHubId, selectedDate, selectedSnapshot]);

  // 2. Load report from database or localStorage draft whenever hub/date/snapshot changes
  useEffect(() => {
    if (!selectedHubId) return;

    let isMounted = true;
    setLoading(true);
    setErrorBanner(null);
    setShowWhatsAppCopy(false);

    async function fetchReportData() {
      try {
        const existing = await getReport(selectedHubId, selectedDate, selectedSnapshot);
        if (!isMounted) return;

        if (existing) {
          // Format saved timestamp
          let timeDisplay = '';
          try {
            const dt = new Date(existing.submitted_at);
            timeDisplay = dt.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            });
          } catch {
            timeDisplay = existing.submitted_at;
          }
          setSavedTime(timeDisplay);

          // Check if there's an unsaved local draft that might be newer or pending
          const localDraftRaw = draftStorageKey ? localStorage.getItem(draftStorageKey) : null;
          if (localDraftRaw) {
            try {
              const draftObj = JSON.parse(localDraftRaw);
              setForm(draftObj);
              return;
            } catch {}
          }

          setForm({
            hub_id: existing.hub_id,
            report_date: existing.report_date,
            snapshot: existing.snapshot,
            footfall: existing.footfall ?? 0,
            total_bills: existing.total_bills ?? 0,
            new_customers: existing.new_customers ?? 0,
            cash_sale: existing.cash_sale ?? 0,
            online_sale: existing.online_sale ?? 0,
            pathology_sale: existing.pathology_sale ?? 0,
            radiology_sale: existing.radiology_sale ?? 0,
            homecare_sale: existing.homecare_sale ?? 0,
            optical_sale: existing.optical_sale ?? 0,
            opd_revenue: existing.opd_revenue ?? 0,
            opd_count: existing.opd_count ?? 0,
            doctor_visits: existing.doctor_visits ?? 0,
            abha_cards: existing.abha_cards ?? 0,
            membership_cards: existing.membership_cards ?? 0,
            home_deliveries: existing.home_deliveries ?? 0,
            reminder_calls: existing.reminder_calls ?? 0,
            reminder_conversions: existing.reminder_conversions ?? 0,
            leaflets_distributed: existing.leaflets_distributed ?? 0,
            closing_stock_value: existing.closing_stock_value,
            variance_reason: existing.variance_reason,
            expected_closing_sale: existing.expected_closing_sale,
            gap_action_plan: existing.gap_action_plan,
            camp_plan_date: existing.camp_plan_date,
          });
        } else {
          setSavedTime(null);
          // Check local draft
          const localDraftRaw = draftStorageKey ? localStorage.getItem(draftStorageKey) : null;
          if (localDraftRaw) {
            try {
              const draftObj = JSON.parse(localDraftRaw);
              setForm(draftObj);
              return;
            } catch {}
          }

          setForm(emptyReport(selectedHubId, selectedDate, selectedSnapshot));
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorBanner(err.message || 'Error loading report');
        setForm(emptyReport(selectedHubId, selectedDate, selectedSnapshot));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchReportData();

    return () => {
      isMounted = false;
    };
  }, [selectedHubId, selectedDate, selectedSnapshot, draftStorageKey]);

  // Keep unsaved form state in localStorage keyed by hub_id|date|snapshot
  const updateFormField = <K extends keyof DailyReportInput>(
    field: K,
    val: DailyReportInput[K]
  ) => {
    if (isOlderThanYesterday) return;
    setForm((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: val };
      if (draftStorageKey) {
        try {
          localStorage.setItem(draftStorageKey, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  };

  const handleNumberInput = (field: keyof DailyReportInput, raw: string) => {
    // Blank treated as 0, reject negatives
    if (raw === '' || raw === '-') {
      updateFormField(field, 0 as any);
      return;
    }
    const clean = raw.replace(/[^0-9.]/g, '');
    const num = Math.max(0, Number(clean) || 0);
    updateFormField(field, num as any);
  };

  const handleNullableNumberInput = (field: keyof DailyReportInput, raw: string) => {
    if (raw === '' || raw === '-') {
      updateFormField(field, null as any);
      return;
    }
    const clean = raw.replace(/[^0-9.]/g, '');
    const num = Math.max(0, Number(clean) || 0);
    updateFormField(field, num as any);
  };

  // Calculations for live sticky target strip
  const target = activeHub ? dailyTarget(activeHub) : 0;
  const breakeven = activeHub ? dailyBreakeven(activeHub) : 0;
  const currentTotal = form ? totalRevenue(form) : 0;
  const gap = Math.max(0, target - currentTotal);
  const progressPct = target > 0 ? Math.min(100, Math.round((currentTotal / target) * 100)) : 0;

  // Bar color based on progress vs breakeven and target
  const barColor = useMemo(() => {
    if (currentTotal >= target) return '#1F7A4D'; // on-target
    if (currentTotal >= breakeven) return '#B7791F'; // caution
    return '#B42318'; // shortfall
  }, [currentTotal, target, breakeven]);

  // Validation before save
  const validateForm = (): string | null => {
    if (!form || !activeHub) return 'Form is not ready';
    if (selectedSnapshot === 'closing') {
      // Reason for variance required when total is below target
      if (currentTotal < target && (!form.variance_reason || !form.variance_reason.trim())) {
        return 'Total is below daily target. Please enter the reason for variance before saving.';
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!form || !activeHub) return;

    const validationError = validateForm();
    if (validationError) {
      setErrorBanner(validationError);
      return;
    }

    setSaving(true);
    setErrorBanner(null);

    try {
      const saved = await saveReport(form);
      // Clear localStorage draft on successful save
      if (draftStorageKey) {
        localStorage.removeItem(draftStorageKey);
      }

      toast('Report saved', 'success');

      // Update saved time
      try {
        const dt = new Date(saved.submitted_at);
        setSavedTime(
          dt.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
        );
      } catch {
        setSavedTime('just now');
      }

      // Fetch MTD for WhatsApp text
      try {
        const mtdList = await getMtd(monthStart(selectedDate));
        const matchingMtd = mtdList.find((m) => m.hub_id === activeHub.id) || null;
        setMtdData(matchingMtd);
      } catch {
        setMtdData(null);
      }

      setShowWhatsAppCopy(true);
    } catch (err: any) {
      // Show thrown message in a banner above the Save button. Never clear form!
      setErrorBanner(err.message || 'Failed to save report. Please check entries and retry.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWhatsApp = async () => {
    if (!activeHub || !form) return;
    try {
      const text = buildWhatsAppText(activeHub, form, mtdData);
      await navigator.clipboard.writeText(text);
      toast('Copied — paste it in your branch group', 'success');
    } catch {
      toast('Could not copy to clipboard. Please copy manually.', 'error');
    }
  };

  if (loading && !form) {
    return (
      <div className="py-12 text-center text-[#5B6670]">
        <div className="w-7 h-7 border-2 border-[#16324F] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm">Loading report details…</p>
      </div>
    );
  }

  if (!activeHub || !form) {
    return (
      <div className="p-6 bg-white border border-[#D9DEDA] rounded-[6px] text-center">
        <p className="text-sm text-[#5B6670]">No branches mapped to your account.</p>
      </div>
    );
  }

  const currentPharmacyTotal = pharmacySale(form);
  const currentPerBill = revenuePerBill(form);

  return (
    <div className="space-y-4 pb-28">
      {/* Top Controls: Branch Picker, Date Chips, Snapshot Switch */}
      <div className="bg-white p-3.5 sm:p-4 rounded-[6px] border border-[#D9DEDA] space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Branch Picker (only if > 1 hub) */}
          {hubs.length > 1 ? (
            <div className="flex-1 max-w-xs">
              <label htmlFor="hub-picker" className="block text-xs font-medium text-[#5B6670] mb-1">
                Branch
              </label>
              <select
                id="hub-picker"
                value={selectedHubId}
                onChange={(e) => {
                  setSelectedHubId(e.target.value);
                  setSearchParams({
                    hubId: e.target.value,
                    date: selectedDate,
                    snapshot: selectedSnapshot,
                  });
                }}
                className="input-ledger w-full text-sm font-medium"
              >
                {hubs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold text-[#16324F]">
              <Building2 className="w-4 h-4 text-[#1F7A4D]" />
              <span>{activeHub.name}</span>
              <span className="text-xs font-normal text-[#5B6670]">({activeHub.code})</span>
            </div>
          )}

          {/* Date Chips: Today / Yesterday */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#5B6670] hidden sm:inline">Report date:</span>
            <div className="flex items-center border border-[#D9DEDA] rounded-[6px] p-0.5 bg-[#F7F8F6]">
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(todayStr);
                  setSearchParams({
                    hubId: selectedHubId,
                    date: todayStr,
                    snapshot: selectedSnapshot,
                  });
                }}
                className={`min-h-[38px] px-3 py-1 text-xs font-medium rounded-[4px] transition-colors ${
                  selectedDate === todayStr
                    ? 'bg-[#16324F] text-white shadow-xs'
                    : 'text-[#1D2329] hover:bg-[#EAEFEA]'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(yesterdayStr);
                  setSearchParams({
                    hubId: selectedHubId,
                    date: yesterdayStr,
                    snapshot: selectedSnapshot,
                  });
                }}
                className={`min-h-[38px] px-3 py-1 text-xs font-medium rounded-[4px] transition-colors ${
                  selectedDate === yesterdayStr
                    ? 'bg-[#16324F] text-white shadow-xs'
                    : 'text-[#1D2329] hover:bg-[#EAEFEA]'
                }`}
              >
                Yesterday
              </button>
            </div>
          </div>
        </div>

        {/* Two-way switch: Mid-day review / Closing report */}
        <div className="flex items-center justify-between pt-1 border-t border-[#D9DEDA]">
          <div className="flex items-center gap-1.5 text-xs text-[#5B6670]">
            <Clock className="w-3.5 h-3.5" />
            {savedTime ? (
              <span className="text-[#1F7A4D] font-medium">Saved at {savedTime} — editing</span>
            ) : (
              <span>Not saved yet today</span>
            )}
          </div>

          <div className="flex items-center border border-[#D9DEDA] rounded-[6px] p-0.5 bg-[#F7F8F6]">
            <button
              type="button"
              onClick={() => {
                setSelectedSnapshot('midday');
                setSearchParams({
                  hubId: selectedHubId,
                  date: selectedDate,
                  snapshot: 'midday',
                });
              }}
              className={`min-h-[38px] px-3 py-1 text-xs font-medium rounded-[4px] transition-colors ${
                selectedSnapshot === 'midday'
                  ? 'bg-[#16324F] text-white shadow-xs'
                  : 'text-[#1D2329] hover:bg-[#EAEFEA]'
              }`}
            >
              Mid-day review
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedSnapshot('closing');
                setSearchParams({
                  hubId: selectedHubId,
                  date: selectedDate,
                  snapshot: 'closing',
                });
              }}
              className={`min-h-[38px] px-3 py-1 text-xs font-medium rounded-[4px] transition-colors ${
                selectedSnapshot === 'closing'
                  ? 'bg-[#16324F] text-white shadow-xs'
                  : 'text-[#1D2329] hover:bg-[#EAEFEA]'
              }`}
            >
              Closing report
            </button>
          </div>
        </div>

        {/* Read-only notification if older than yesterday */}
        {isOlderThanYesterday && (
          <div className="p-2.5 bg-[#F0F5F9] border border-[#D1E0EC] rounded-[6px] text-xs text-[#16324F] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#16324F]" />
            <span>Reports older than yesterday can only be changed by your manager.</span>
          </div>
        )}
      </div>

      {/* Sticky Target Strip under header, always visible while scrolling */}
      <div className="sticky top-0 z-20 bg-white border border-[#D9DEDA] rounded-[6px] p-3 shadow-xs">
        <div className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
          <div>
            <span className="block text-[11px] text-[#5B6670] uppercase tracking-wider">Target</span>
            <span className="font-semibold text-[#1D2329] tabular-nums">
              {formatINR(target)}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-[#5B6670] uppercase tracking-wider">Sale so far</span>
            <span className="font-bold text-[#16324F] tabular-nums text-sm sm:text-base">
              {formatINR(currentTotal)}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-[#5B6670] uppercase tracking-wider">Gap</span>
            <span
              className={`font-semibold tabular-nums ${
                gap === 0 ? 'text-[#1F7A4D]' : 'text-[#B42318]'
              }`}
            >
              {gap === 0 ? 'Met' : formatINR(gap)}
            </span>
          </div>
        </div>

        {/* Dynamic Target Bar Fill */}
        <div className="mt-2.5 w-full bg-[#E8ECE9] h-2.5 rounded-full overflow-hidden relative">
          <motion.div
            className="h-full rounded-full transition-colors duration-300"
            style={{ backgroundColor: barColor }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: 'spring', damping: 20, stiffness: 120 }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-[#5B6670] mt-1">
          <span>Break-even: {formatINR(breakeven)}</span>
          <span className="font-medium">{progressPct}% achieved</span>
        </div>
      </div>

      {/* Form sections: plain titled groups (not cards), separated by space and rule line */}
      <div className="space-y-6 pt-1">
        {/* Section 1: Pharmacy */}
        <div className="space-y-3">
          <div className="border-b border-[#D9DEDA] pb-1.5">
            <h3 className="text-base font-semibold text-[#16324F]">1. Pharmacy</h3>
            <p className="text-xs text-[#5B6670]">Over-the-counter medicine billing and footfall</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Cash sale (₹)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.cash_sale === 0 ? '' : form.cash_sale}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('cash_sale', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Online sale (₹)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.online_sale === 0 ? '' : form.online_sale}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('online_sale', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Total bills
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.total_bills === 0 ? '' : form.total_bills}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('total_bills', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Footfall
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.footfall === 0 ? '' : form.footfall}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('footfall', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                New customers
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.new_customers === 0 ? '' : form.new_customers}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('new_customers', e.target.value)}
                className="input-ledger w-full"
              />
            </div>
          </div>

          {/* Read-only computed Pharmacy Total and Per bill */}
          <div className="bg-[#F0F5F9] border border-[#D1E0EC] rounded-[6px] px-3.5 py-2.5 flex items-center justify-between text-xs sm:text-sm">
            <div>
              <span className="text-[#5B6670] block text-xs">Pharmacy total</span>
              <span className="font-semibold text-[#16324F] tabular-nums">
                {formatINR(currentPharmacyTotal)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[#5B6670] block text-xs">Per bill</span>
              <span className="font-semibold text-[#16324F] tabular-nums">
                {currentPerBill ? formatINR(currentPerBill) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Other services */}
        <div className="space-y-3">
          <div className="border-b border-[#D9DEDA] pb-1.5">
            <h3 className="text-base font-semibold text-[#16324F]">2. Other services</h3>
            <p className="text-xs text-[#5B6670]">Diagnostics, homecare, optical and consultations</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Pathology sale (₹)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.pathology_sale === 0 ? '' : form.pathology_sale}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('pathology_sale', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Radiology sale (₹)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.radiology_sale === 0 ? '' : form.radiology_sale}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('radiology_sale', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Optical sale (₹)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.optical_sale === 0 ? '' : form.optical_sale}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('optical_sale', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Homecare sale (₹)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.homecare_sale === 0 ? '' : form.homecare_sale}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('homecare_sale', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                OPD revenue (₹)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.opd_revenue === 0 ? '' : form.opd_revenue}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('opd_revenue', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                OPD visits
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.opd_count === 0 ? '' : form.opd_count}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('opd_count', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Doctor visits
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.doctor_visits === 0 ? '' : form.doctor_visits}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('doctor_visits', e.target.value)}
                className="input-ledger w-full"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Outreach */}
        <div className="space-y-3">
          <div className="border-b border-[#D9DEDA] pb-1.5">
            <h3 className="text-base font-semibold text-[#16324F]">3. Outreach</h3>
            <p className="text-xs text-[#5B6670]">Customer follow-ups, deliveries, cards and awareness</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Reminder calls
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.reminder_calls === 0 ? '' : form.reminder_calls}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('reminder_calls', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Reminder conversions
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.reminder_conversions === 0 ? '' : form.reminder_conversions}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('reminder_conversions', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Home deliveries
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.home_deliveries === 0 ? '' : form.home_deliveries}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('home_deliveries', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Leaflets distributed
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.leaflets_distributed === 0 ? '' : form.leaflets_distributed}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('leaflets_distributed', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                ABHA cards
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.abha_cards === 0 ? '' : form.abha_cards}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('abha_cards', e.target.value)}
                className="input-ledger w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1D2329] mb-1">
                Membership cards
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.membership_cards === 0 ? '' : form.membership_cards}
                placeholder="0"
                disabled={isOlderThanYesterday}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleNumberInput('membership_cards', e.target.value)}
                className="input-ledger w-full"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Mid-day only — Closing plan */}
        {selectedSnapshot === 'midday' && (
          <div className="space-y-3">
            <div className="border-b border-[#D9DEDA] pb-1.5">
              <h3 className="text-base font-semibold text-[#16324F]">4. Closing plan</h3>
              <p className="text-xs text-[#5B6670]">Afternoon review, expected sales, and action plan</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#1D2329] mb-1">
                  Expected sale by closing (₹)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.expected_closing_sale ?? ''}
                  placeholder="Expected revenue by 9 PM"
                  disabled={isOlderThanYesterday}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleNullableNumberInput('expected_closing_sale', e.target.value)}
                  className="input-ledger w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1D2329] mb-1">
                  Next camp date
                </label>
                <input
                  type="date"
                  value={form.camp_plan_date || ''}
                  disabled={isOlderThanYesterday}
                  onChange={(e) => updateFormField('camp_plan_date', e.target.value || null)}
                  className="input-ledger w-full"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#1D2329] mb-1">
                  Gap fill action plan
                </label>
                <textarea
                  rows={3}
                  value={form.gap_action_plan || ''}
                  placeholder="Specific actions to reach today's target (e.g., patient callouts, camp bookings, doctor follow-ups)..."
                  disabled={isOlderThanYesterday}
                  onChange={(e) => updateFormField('gap_action_plan', e.target.value || null)}
                  className="input-ledger w-full resize-y"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Closing only — Close of day */}
        {selectedSnapshot === 'closing' && (
          <div className="space-y-3">
            <div className="border-b border-[#D9DEDA] pb-1.5">
              <h3 className="text-base font-semibold text-[#16324F]">4. Close of day</h3>
              <p className="text-xs text-[#5B6670]">End-of-day stock audit and variance justification</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#1D2329] mb-1">
                  Closing stock value (₹)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.closing_stock_value ?? ''}
                  placeholder="Closing inventory valuation"
                  disabled={isOlderThanYesterday}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleNullableNumberInput('closing_stock_value', e.target.value)}
                  className="input-ledger w-full max-w-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#1D2329]">
                    Reason for variance
                  </label>
                  {currentTotal < target && (
                    <span className="text-[11px] text-[#B42318] font-medium">
                      Required (Sale is below daily target)
                    </span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={form.variance_reason || ''}
                  placeholder={
                    currentTotal < target
                      ? "Explain why the target wasn't met today (e.g. power outage, low OPD attendance, delayed camp)..."
                      : "Optional notes on today's performance..."
                  }
                  disabled={isOlderThanYesterday}
                  onChange={(e) => updateFormField('variance_reason', e.target.value || null)}
                  className={`input-ledger w-full resize-y ${
                    currentTotal < target && !form.variance_reason?.trim()
                      ? 'border-[#FDA29B] focus:border-[#B42318]'
                      : ''
                  }`}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-14 lg:bottom-0 left-0 right-0 lg:left-64 bg-white/95 backdrop-blur-xs border-t border-[#D9DEDA] px-4 py-3 z-30 shadow-lg">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Error Banner above Save Button */}
          {errorBanner && (
            <div className="p-3 bg-[#FEF3F2] border border-[#FECDCA] rounded-[6px] text-xs text-[#B42318] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorBanner}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || isOlderThanYesterday}
              className="w-full sm:flex-1 btn-primary text-base"
            >
              {saving ? 'Saving…' : 'Save report'}
            </button>

            {/* Copy for WhatsApp Button (appears after save) */}
            {showWhatsAppCopy && (
              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="w-full sm:w-auto btn-secondary text-sm px-4 flex items-center justify-center gap-2 border-[#1F7A4D] text-[#1F7A4D] hover:bg-[#ECFDF3]"
              >
                <Copy className="w-4 h-4" />
                <span>Copy for WhatsApp</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
