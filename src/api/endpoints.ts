import { supabase } from '../lib/supabase';
import type {
  Profile, Hub, DailyReport, DailyReportInput, DailyPerformanceRow,
  MtdRow, PnlRow, MonthlyCost, TodayStatusRow, HubStaffRow, ManagerHubRow, Snapshot,
  Medicine, HubStockRow, StockPurchaseInput, StockIssueInput, StockPurchase, StockIssue,
} from '../types/api';

type PgError = { code?: string; message: string; details?: string | null };

/** Turn Postgres/PostgREST errors into a sentence staff can act on. */
export function friendlyError(e: PgError): string {
  const msg = e.message || '';
  if (e.code === '42501' || msg.includes('row-level security'))
    return "You can't change this. Reports can only be saved for your own branch, for today or yesterday.";
  if (e.code === '23505')
    return 'A report for this branch, date and time slot already exists. Open it from History to edit.';
  if (e.code === '23514') {
    if (msg.includes('Insufficient stock')) return msg;
    if (msg.includes('chk_not_future')) return "You can't save a report for a future date.";
    return 'One of the values is not allowed. Check the numbers and try again.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
    return 'No internet connection. Your entries are still on screen — save again when you are back online.';
  return msg;
}

function unwrap<T>(res: { data: T | null; error: PgError | null }): T {
  if (res.error) throw new Error(friendlyError(res.error));
  return res.data as unknown as T;
}

/** PostgREST can return numeric as string; normalise every numeric field. */
function nums<T = any>(row: any): T {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, any> = { ...row };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === 'string' && v !== '' && /^-?\d+(\.\d+)?$/.test(v) && !k.endsWith('_id') && k !== 'id' && k !== 'code')
      out[k] = Number(v);
  }
  return out as T;
}



// ---------- auth ----------
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(error.message === 'Invalid login credentials'
    ? 'Email or password is wrong.' : error.message);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getMyProfile(): Promise<Profile | null> {
  const uid = await getSessionUserId();
  if (!uid) return null;
  return unwrap(await supabase.from('profiles').select('*').eq('id', uid).maybeSingle());
}

// ---------- hubs ----------
/** RLS returns only hubs this user is mapped to (or all, for org-wide roles). */
export async function getMyHubs(): Promise<Hub[]> {
  const rows = unwrap(await supabase.from('hubs').select('*').eq('is_active', true).order('name'));
  return (rows ?? []).map(nums);
}

export async function updateHubTargets(
  hubId: string,
  patch: Pick<Hub, 'monthly_revenue_target' | 'monthly_breakeven_target' | 'working_days_per_month'>,
): Promise<Hub> {
  return nums(unwrap(await supabase.from('hubs').update(patch).eq('id', hubId).select().single()));
}

// ---------- daily reports ----------
export async function getReport(hubId: string, date: string, snapshot: Snapshot): Promise<DailyReport | null> {
  const row = unwrap(await supabase.from('daily_reports').select('*')
    .eq('hub_id', hubId).eq('report_date', date).eq('snapshot', snapshot).maybeSingle());
  return row ? nums(row) : null;
}

/** Insert or update the one report for (hub, date, snapshot). */
export async function saveReport(input: DailyReportInput): Promise<DailyReport> {
  const uid = await getSessionUserId();
  if (!uid) throw new Error('Your session has expired. Sign in again.');
  const row = unwrap(await supabase.from('daily_reports')
    .upsert({ ...input, submitted_by: uid, submitted_at: new Date().toISOString() },
            { onConflict: 'hub_id,report_date,snapshot' })
    .select().single());
  return nums(row) as DailyReport;
}


export async function listReports(hubIds: string[], from: string, to: string): Promise<DailyReport[]> {
  if (hubIds.length === 0) return [];
  const rows = unwrap(await supabase.from('daily_reports').select('*')
    .in('hub_id', hubIds).gte('report_date', from).lte('report_date', to)
    .order('report_date', { ascending: false }).order('snapshot'));
  return (rows ?? []).map(nums);
}

/** Which hubs have submitted which snapshot on a date — for the manager board. */
export async function getStatusForDate(date: string): Promise<TodayStatusRow[]> {
  const rows = unwrap(await supabase.from('daily_reports')
    .select('hub_id,snapshot,submitted_at,total_revenue').eq('report_date', date));
  return (rows ?? []).map(nums);
}

// ---------- performance views (closing reports only) ----------
export async function getDailyPerformance(from: string, to: string, hubId?: string): Promise<DailyPerformanceRow[]> {
  let q = supabase.from('v_daily_performance').select('*')
    .gte('report_date', from).lte('report_date', to).order('report_date');
  if (hubId) q = q.eq('hub_id', hubId);
  return (unwrap(await q) ?? []).map(nums);
}

export async function getMtd(periodMonth: string): Promise<MtdRow[]> {
  const rows = unwrap(await supabase.from('v_mtd_performance').select('*')
    .eq('period_month', periodMonth).order('hub_name'));
  return (rows ?? []).map(nums);
}

/** Only meaningful for accounts / super_admin — others see zero costs via RLS. */
export async function getPnl(periodMonth: string): Promise<PnlRow[]> {
  const rows = unwrap(await supabase.from('v_hub_pnl').select('*')
    .eq('period_month', periodMonth).order('hub_name'));
  return (rows ?? []).map(nums);
}

// ---------- monthly costs (accounts) ----------
export async function getCosts(periodMonth: string): Promise<MonthlyCost[]> {
  const rows = unwrap(await supabase.from('monthly_costs').select('*').eq('period_month', periodMonth));
  return (rows ?? []).map(nums);
}

export async function saveCost(hubId: string, periodMonth: string, direct_cost: number, indirect_cost: number): Promise<MonthlyCost> {
  const uid = await getSessionUserId();
  return nums(unwrap(await supabase.from('monthly_costs')
    .upsert({ hub_id: hubId, period_month: periodMonth, direct_cost, indirect_cost,
              entered_by: uid, updated_at: new Date().toISOString() },
            { onConflict: 'hub_id,period_month' })
    .select().single()));
}

// ---------- admin: people and mapping ----------
export async function listProfiles(): Promise<Profile[]> {
  return unwrap(await supabase.from('profiles').select('*').order('full_name')) ?? [];
}

export async function updateProfile(id: string, patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'role' | 'is_active'>>): Promise<Profile> {
  return unwrap(await supabase.from('profiles').update(patch).eq('id', id).select().single());
}

export async function listHubStaff(): Promise<HubStaffRow[]> {
  return unwrap(await supabase.from('hub_staff').select('*')) ?? [];
}

export async function assignStaff(staffId: string, hubId: string, isPrimary = true): Promise<void> {
  unwrap(await supabase.from('hub_staff').upsert({ staff_id: staffId, hub_id: hubId, is_primary: isPrimary }));
}

export async function unassignStaff(staffId: string, hubId: string): Promise<void> {
  unwrap(await supabase.from('hub_staff').delete().eq('staff_id', staffId).eq('hub_id', hubId));
}

export async function listManagerHubs(): Promise<ManagerHubRow[]> {
  return unwrap(await supabase.from('manager_hubs').select('*')) ?? [];
}

export async function assignManager(managerId: string, hubId: string): Promise<void> {
  unwrap(await supabase.from('manager_hubs').upsert({ manager_id: managerId, hub_id: hubId }));
}

export async function unassignManager(managerId: string, hubId: string): Promise<void> {
  unwrap(await supabase.from('manager_hubs').delete().eq('manager_id', managerId).eq('hub_id', hubId));
}

// ---------- inventory ----------
export async function listMedicines(): Promise<Medicine[]> {
  const rows = unwrap(await supabase.from('medicines').select('*').eq('is_active', true).order('name'));
  return (rows ?? []).map(nums);
}

export async function addMedicine(name: string, unit: string, unit_price: number, sku?: string | null): Promise<Medicine> {
  return nums(unwrap(await supabase.from('medicines')
    .insert({ name, unit, unit_price, sku: sku || null })
    .select().single()));
}

/** Current stock on hand, scoped by RLS to the caller's hubs (or every hub for purchase_manager/super_admin). */
export async function getHubStock(hubIds: string[]): Promise<HubStockRow[]> {
  if (hubIds.length === 0) return [];
  const rows = unwrap(await supabase.from('hub_stock').select('*').in('hub_id', hubIds));
  return (rows ?? []).map(nums);
}

export async function recordPurchase(input: StockPurchaseInput): Promise<void> {
  const uid = await getSessionUserId();
  if (!uid) throw new Error('Your session has expired. Sign in again.');
  unwrap(await supabase.from('stock_purchases').insert({ ...input, purchased_by: uid }));
}

/** Deducts from hub_stock via a DB trigger; throws the "Insufficient stock" message on overdraw. */
export async function recordIssue(input: StockIssueInput): Promise<void> {
  const uid = await getSessionUserId();
  if (!uid) throw new Error('Your session has expired. Sign in again.');
  unwrap(await supabase.from('stock_issues').insert({ ...input, issued_by: uid }));
}

export async function listRecentPurchases(hubIds: string[], limit = 20): Promise<StockPurchase[]> {
  if (hubIds.length === 0) return [];
  const rows = unwrap(await supabase.from('stock_purchases').select('*')
    .in('hub_id', hubIds).order('created_at', { ascending: false }).limit(limit));
  return (rows ?? []).map(nums);
}

export async function listRecentIssues(hubIds: string[], limit = 20): Promise<StockIssue[]> {
  if (hubIds.length === 0) return [];
  const rows = unwrap(await supabase.from('stock_issues').select('*')
    .in('hub_id', hubIds).order('created_at', { ascending: false }).limit(limit));
  return (rows ?? []).map(nums);
}
