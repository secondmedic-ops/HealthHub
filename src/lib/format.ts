import type { Hub, DailyReportInput, MtdRow } from '../types/api';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const plain = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const formatINR = (n: number | null | undefined): string => inr.format(Number(n ?? 0));
export const formatNum = (n: number | null | undefined): string => plain.format(Number(n ?? 0));

/** Today's date in India as YYYY-MM-DD. Use this for every report date. */
export function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function yesterdayIST(): string {
  const [y, m, d] = todayIST().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().slice(0, 10);
}

export function hourIST(): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date()));
}

/** Before 6 PM IST staff are doing the mid-day review; after, the closing report. */
export const defaultSnapshot = (): 'midday' | 'closing' => (hourIST() < 18 ? 'midday' : 'closing');

export const monthStart = (date: string): string => date.slice(0, 8) + '01';

export function displayDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export const dailyTarget = (h: Hub): number =>
  Math.round(h.monthly_revenue_target / Math.max(1, h.working_days_per_month));

export const dailyBreakeven = (h: Hub): number =>
  Math.round(h.monthly_breakeven_target / Math.max(1, h.working_days_per_month));

/** Mirrors the database's generated columns so the form can show live totals. */
export const pharmacySale = (r: Pick<DailyReportInput, 'cash_sale' | 'online_sale'>): number =>
  (r.cash_sale || 0) + (r.online_sale || 0);

export const totalRevenue = (r: DailyReportInput): number =>
  pharmacySale(r) + (r.pathology_sale || 0) + (r.radiology_sale || 0) +
  (r.homecare_sale || 0) + (r.optical_sale || 0) + (r.opd_revenue || 0);

export const revenuePerBill = (r: DailyReportInput): number | null =>
  r.total_bills > 0 ? Math.round(pharmacySale(r) / r.total_bills) : null;

export function emptyReport(hubId: string, date: string, snapshot: 'midday' | 'closing'): DailyReportInput {
  return {
    hub_id: hubId, report_date: date, snapshot,
    footfall: 0, total_bills: 0, new_customers: 0,
    cash_sale: 0, online_sale: 0, pathology_sale: 0, radiology_sale: 0,
    homecare_sale: 0, optical_sale: 0, opd_revenue: 0,
    opd_count: 0, doctor_visits: 0, abha_cards: 0, membership_cards: 0,
    home_deliveries: 0, reminder_calls: 0, reminder_conversions: 0, leaflets_distributed: 0,
    closing_stock_value: null, variance_reason: null,
    expected_closing_sale: null, gap_action_plan: null, camp_plan_date: null,
  };
}

/** Same text format branches already post in WhatsApp groups, generated from the saved report. */
export function buildWhatsAppText(hub: Hub, r: DailyReportInput, mtd?: MtdRow | null): string {
  const target = dailyTarget(hub);
  const total = totalRevenue(r);
  const line = '━━━━━━━━━━━━━━━━━━━━━━';

  if (r.snapshot === 'midday') {
    return [
      `📋 Daily Branch Review`,
      ``,
      `📅 Date: ${displayDate(r.report_date)}`,
      `🏪 Branch: ${hub.name}`,
      ``,
      `🎯 Today's Target: ${formatINR(target)}`,
      `💰 Sale so far: ${formatINR(total)}`,
      `📉 Gap: ${formatINR(Math.max(0, target - total))}`,
      ``,
      `👣 Footfall: ${formatNum(r.footfall)}`,
      `🧾 Total Bills: ${formatNum(r.total_bills)}`,
      `📞 Reminder Calls: ${formatNum(r.reminder_calls)}`,
      `✅ Reminder Conversions: ${formatNum(r.reminder_conversions)}`,
      `🚚 Home Delivery: ${formatNum(r.home_deliveries)}`,
      `🧪 Pathology: ${formatINR(r.pathology_sale)}`,
      `🩺 OPD: ${formatNum(r.opd_count)}`,
      `📄 Leaflets Distributed: ${formatNum(r.leaflets_distributed)}`,
      r.camp_plan_date ? `🏕️ Camp Plan: ${displayDate(r.camp_plan_date)}` : '',
      ``,
      `🎯 Gap Fill Action Plan:`,
      r.gap_action_plan || '-',
      ``,
      `✅ Expected Sale by Closing: ${formatINR(r.expected_closing_sale)}`,
    ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  }

  return [
    `*Daily Business Update — ${hub.name}*`,
    `Date: ${displayDate(r.report_date)}`,
    line,
    `🎯 TARGET`,
    `Monthly Revenue Target: ${formatINR(hub.monthly_revenue_target)}`,
    `Daily Revenue Target: ${formatINR(target)}`,
    `Daily Break-even: ${formatINR(dailyBreakeven(hub))}`,
    r.closing_stock_value != null ? `Closing stock value: ${formatINR(r.closing_stock_value)}` : '',
    line,
    `💰 PHARMACY`,
    `Customers: ${formatNum(r.total_bills)}`,
    `Cash: ${formatINR(r.cash_sale)}`,
    `Online: ${formatINR(r.online_sale)}`,
    `Total Pharmacy: ${formatINR(pharmacySale(r))}`,
    `Revenue per bill: ${formatINR(revenuePerBill(r))}`,
    `New customers: ${formatNum(r.new_customers)}`,
    line,
    `🧪 Pathology: ${formatINR(r.pathology_sale)}`,
    `🩻 Radiology: ${formatINR(r.radiology_sale)}`,
    `👓 Optical: ${formatINR(r.optical_sale)}`,
    `🏠 Homecare: ${formatINR(r.homecare_sale)}`,
    `🩺 OPD: ${formatNum(r.opd_count)} visits, ${formatINR(r.opd_revenue)}`,
    `ABHA: ${formatNum(r.abha_cards)} · Membership: ${formatNum(r.membership_cards)} · Doctor visits: ${formatNum(r.doctor_visits)}`,
    line,
    mtd ? `📊 MONTH TO DATE` : '',
    mtd ? `Pharmacy: ${formatINR(mtd.pharmacy_mtd)}` : '',
    mtd ? `Pathology: ${formatINR(mtd.pathology_mtd)}` : '',
    mtd ? `Radiology: ${formatINR(mtd.radiology_mtd)}` : '',
    mtd ? `Optical: ${formatINR(mtd.optical_mtd)}` : '',
    mtd ? `OPD: ${formatINR(mtd.opd_mtd)}` : '',
    mtd ? `Total: ${formatINR(mtd.total_mtd)}` : '',
    mtd ? line : '',
    `📈 TODAY vs TARGET`,
    `Target: ${formatINR(target)}`,
    `Actual: ${formatINR(total)}`,
    `Variance: ${formatINR(total - target)}`,
    r.variance_reason ? `Reason: ${r.variance_reason}` : '',
  ].filter(Boolean).join('\n');
}
