import { SUPABASE_URL } from './config';
import type { Hub, Profile, DailyReport, MonthlyCost, HubStaffRow, ManagerHubRow } from '../types/api';
import { todayIST, yesterdayIST, monthStart } from './format';

const IS_MOCK_ENV = SUPABASE_URL.includes('YOUR-PROJECT');

interface MockDB {
  users: Array<{ id: string; email: string; role: string }>;
  profiles: Profile[];
  hubs: Hub[];
  hubStaff: HubStaffRow[];
  managerHubs: ManagerHubRow[];
  dailyReports: DailyReport[];
  monthlyCosts: MonthlyCost[];
  currentUserId: string | null;
}

const STORAGE_KEY = 'HEALTHHUB_MOCK_DB_V1';

function getInitialDB(): MockDB {
  const today = todayIST();
  const yesterday = yesterdayIST();
  const currentMonth = monthStart(today);

  const users = [
    { id: 'usr-admin', email: 'admin@healthhub.in', role: 'super_admin' },
    { id: 'usr-manager', email: 'manager@healthhub.in', role: 'manager' },
    { id: 'usr-staff', email: 'staff@healthhub.in', role: 'staff' },
    { id: 'usr-lead', email: 'lead@healthhub.in', role: 'hub_lead' },
    { id: 'usr-accounts', email: 'accounts@healthhub.in', role: 'accounts' },
    { id: 'usr-field', email: 'field@healthhub.in', role: 'field_staff' },
    { id: 'usr-inactive', email: 'inactive@healthhub.in', role: 'staff' },
  ];

  const profiles: Profile[] = [
    { id: 'usr-admin', full_name: 'Dr. Ramesh Rao', phone: '+91 98450 11223', email: 'admin@healthhub.in', role: 'super_admin', is_active: true, created_at: '2026-01-01T00:00:00Z' },
    { id: 'usr-manager', full_name: 'Priya Sundaram', phone: '+91 97410 44556', email: 'manager@healthhub.in', role: 'manager', is_active: true, created_at: '2026-01-05T00:00:00Z' },
    { id: 'usr-staff', full_name: 'Kavitha Murthy', phone: '+91 99001 77889', email: 'staff@healthhub.in', role: 'staff', is_active: true, created_at: '2026-01-10T00:00:00Z' },
    { id: 'usr-lead', full_name: 'Anand Kumar', phone: '+91 98860 33445', email: 'lead@healthhub.in', role: 'hub_lead', is_active: true, created_at: '2026-01-10T00:00:00Z' },
    { id: 'usr-accounts', full_name: 'Suresh Patel', phone: '+91 94480 55667', email: 'accounts@healthhub.in', role: 'accounts', is_active: true, created_at: '2026-01-02T00:00:00Z' },
    { id: 'usr-field', full_name: 'Vikas Gowda', phone: '+91 93420 88990', email: 'field@healthhub.in', role: 'field_staff', is_active: true, created_at: '2026-01-15T00:00:00Z' },
    { id: 'usr-inactive', full_name: 'Pending Staff', phone: null, email: 'inactive@healthhub.in', role: 'staff', is_active: false, created_at: '2026-02-01T00:00:00Z' },
  ];

  const hubs: Hub[] = [
    { id: 'hub-1', code: 'HH-BLR-01', name: 'Indiranagar HealthHub', city: 'Bengaluru', opened_on: '2024-03-01', monthly_revenue_target: 1500000, monthly_breakeven_target: 950000, working_days_per_month: 26, is_active: true },
    { id: 'hub-2', code: 'HH-BLR-02', name: 'Koramangala HealthHub', city: 'Bengaluru', opened_on: '2024-06-15', monthly_revenue_target: 1800000, monthly_breakeven_target: 1100000, working_days_per_month: 26, is_active: true },
    { id: 'hub-3', code: 'HH-BLR-03', name: 'Whitefield HealthHub', city: 'Bengaluru', opened_on: '2024-09-01', monthly_revenue_target: 2000000, monthly_breakeven_target: 1250000, working_days_per_month: 26, is_active: true },
    { id: 'hub-4', code: 'HH-BLR-04', name: 'Jayanagar HealthHub', city: 'Bengaluru', opened_on: '2025-01-10', monthly_revenue_target: 1400000, monthly_breakeven_target: 850000, working_days_per_month: 26, is_active: true },
  ];

  const hubStaff: HubStaffRow[] = [
    { staff_id: 'usr-staff', hub_id: 'hub-1', is_primary: true },
    { staff_id: 'usr-lead', hub_id: 'hub-2', is_primary: true },
  ];

  const managerHubs: ManagerHubRow[] = [
    { manager_id: 'usr-manager', hub_id: 'hub-1' },
    { manager_id: 'usr-manager', hub_id: 'hub-2' },
    { manager_id: 'usr-manager', hub_id: 'hub-3' },
  ];

  const dailyReports: DailyReport[] = [
    // Yesterday closing for Hub 1
    {
      id: 'rep-1',
      hub_id: 'hub-1',
      report_date: yesterday,
      snapshot: 'closing',
      footfall: 142,
      total_bills: 118,
      new_customers: 24,
      cash_sale: 21500,
      online_sale: 29800,
      pathology_sale: 6400,
      radiology_sale: 1800,
      homecare_sale: 1200,
      optical_sale: 0,
      opd_revenue: 2500,
      opd_count: 5,
      doctor_visits: 8,
      abha_cards: 12,
      membership_cards: 6,
      home_deliveries: 4,
      reminder_calls: 35,
      reminder_conversions: 9,
      leaflets_distributed: 50,
      closing_stock_value: 845000,
      variance_reason: null,
      expected_closing_sale: null,
      gap_action_plan: null,
      camp_plan_date: null,
      submitted_by: 'usr-staff',
      submitted_at: `${yesterday}T20:45:00.000Z`,
      pharmacy_sale: 51300,
      total_revenue: 63200,
      revenue_per_transaction: 435,
      created_at: `${yesterday}T20:45:00.000Z`,
      updated_at: `${yesterday}T20:45:00.000Z`,
    },
    // Yesterday midday for Hub 1
    {
      id: 'rep-2',
      hub_id: 'hub-1',
      report_date: yesterday,
      snapshot: 'midday',
      footfall: 68,
      total_bills: 54,
      new_customers: 11,
      cash_sale: 10500,
      online_sale: 15200,
      pathology_sale: 3200,
      radiology_sale: 900,
      homecare_sale: 600,
      optical_sale: 0,
      opd_revenue: 1000,
      opd_count: 2,
      doctor_visits: 4,
      abha_cards: 6,
      membership_cards: 2,
      home_deliveries: 2,
      reminder_calls: 20,
      reminder_conversions: 5,
      leaflets_distributed: 25,
      closing_stock_value: null,
      variance_reason: null,
      expected_closing_sale: 62000,
      gap_action_plan: 'Following up chronic medication refill reminders and home delivery requests',
      camp_plan_date: '2026-09-28',
      submitted_by: 'usr-staff',
      submitted_at: `${yesterday}T14:15:00.000Z`,
      pharmacy_sale: 25700,
      total_revenue: 31400,
      revenue_per_transaction: 476,
      created_at: `${yesterday}T14:15:00.000Z`,
      updated_at: `${yesterday}T14:15:00.000Z`,
    },
    // Today midday for Hub 1
    {
      id: 'rep-3',
      hub_id: 'hub-1',
      report_date: today,
      snapshot: 'midday',
      footfall: 74,
      total_bills: 62,
      new_customers: 15,
      cash_sale: 13400,
      online_sale: 18600,
      pathology_sale: 4200,
      radiology_sale: 0,
      homecare_sale: 800,
      optical_sale: 0,
      opd_revenue: 1500,
      opd_count: 3,
      doctor_visits: 6,
      abha_cards: 8,
      membership_cards: 4,
      home_deliveries: 3,
      reminder_calls: 28,
      reminder_conversions: 7,
      leaflets_distributed: 30,
      closing_stock_value: null,
      variance_reason: null,
      expected_closing_sale: 60000,
      gap_action_plan: 'Reaching out to diagnostic camp inquiries from last Saturday',
      camp_plan_date: null,
      submitted_by: 'usr-staff',
      submitted_at: `${today}T13:30:00.000Z`,
      pharmacy_sale: 32000,
      total_revenue: 38500,
      revenue_per_transaction: 516,
      created_at: `${today}T13:30:00.000Z`,
      updated_at: `${today}T13:30:00.000Z`,
    },
    // Today midday for Hub 2
    {
      id: 'rep-4',
      hub_id: 'hub-2',
      report_date: today,
      snapshot: 'midday',
      footfall: 85,
      total_bills: 70,
      new_customers: 18,
      cash_sale: 18500,
      online_sale: 24200,
      pathology_sale: 5600,
      radiology_sale: 2100,
      homecare_sale: 1500,
      optical_sale: 800,
      opd_revenue: 2000,
      opd_count: 4,
      doctor_visits: 7,
      abha_cards: 9,
      membership_cards: 5,
      home_deliveries: 5,
      reminder_calls: 40,
      reminder_conversions: 11,
      leaflets_distributed: 60,
      closing_stock_value: null,
      variance_reason: null,
      expected_closing_sale: 75000,
      gap_action_plan: 'Pathology package promotion with local senior citizen club',
      camp_plan_date: '2026-09-25',
      submitted_by: 'usr-lead',
      submitted_at: `${today}T14:05:00.000Z`,
      pharmacy_sale: 42700,
      total_revenue: 54700,
      revenue_per_transaction: 610,
      created_at: `${today}T14:05:00.000Z`,
      updated_at: `${today}T14:05:00.000Z`,
    }
  ];

  const monthlyCosts: MonthlyCost[] = [
    { hub_id: 'hub-1', period_month: currentMonth, direct_cost: 650000, indirect_cost: 210000, entered_by: 'usr-accounts', updated_at: '2026-09-15T10:00:00Z' },
    { hub_id: 'hub-2', period_month: currentMonth, direct_cost: 780000, indirect_cost: 240000, entered_by: 'usr-accounts', updated_at: '2026-09-15T10:00:00Z' },
    { hub_id: 'hub-3', period_month: currentMonth, direct_cost: 850000, indirect_cost: 270000, entered_by: 'usr-accounts', updated_at: '2026-09-15T10:00:00Z' },
    { hub_id: 'hub-4', period_month: currentMonth, direct_cost: 590000, indirect_cost: 195000, entered_by: 'usr-accounts', updated_at: '2026-09-15T10:00:00Z' },
  ];

  return {
    users,
    profiles,
    hubs,
    hubStaff,
    managerHubs,
    dailyReports,
    monthlyCosts,
    currentUserId: 'usr-admin', // default to admin for seamless first view if signed in
  };
}

function loadDB(): MockDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load mock DB', e);
  }
  const db = getInitialDB();
  saveDB(db);
  return db;
}

function saveDB(db: MockDB) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Failed to save mock DB', e);
  }
}

export const mockFetch: typeof window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const originalFetch = typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : fetch;
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  if (!urlStr.includes('YOUR-PROJECT.supabase.co')) {
    return originalFetch(input, init);
  }

  const url = new URL(urlStr);
  const pathname = url.pathname;
  const method = init?.method?.toUpperCase() || 'GET';
  const bodyText = typeof init?.body === 'string' ? init.body : '';
  let bodyJson: any = null;
  if (bodyText) {
    try { bodyJson = JSON.parse(bodyText); } catch {}
  }

  const db = loadDB();

    // 1. Auth: password login
    if (pathname.includes('/auth/v1/token') && url.searchParams.get('grant_type') === 'password') {
      const email = bodyJson?.email?.trim().toLowerCase();
      const user = db.users.find(u => u.email.toLowerCase() === email);
      if (!user) {
        return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      db.currentUserId = user.id;
      saveDB(db);

      const authResponse = {
        access_token: `mock-token-${user.id}`,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: `mock-refresh-${user.id}`,
        user: {
          id: user.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: user.email,
        },
      };
      return new Response(JSON.stringify(authResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Auth: get user
    if (pathname.includes('/auth/v1/user')) {
      const uid = db.currentUserId;
      const user = db.users.find(u => u.id === uid);
      if (!user) {
        return new Response(JSON.stringify({ error: 'unauthorized', message: 'User not found' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ id: user.id, email: user.email, role: 'authenticated' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Auth: logout
    if (pathname.includes('/auth/v1/logout')) {
      db.currentUserId = null;
      saveDB(db);
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // PostgREST REST handlers
    const currentUser = db.users.find(u => u.id === db.currentUserId);
    const currentProfile = db.profiles.find(p => p.id === db.currentUserId);
    const userRole = currentProfile?.role || 'super_admin';

    // Profiles table
    if (pathname.includes('/rest/v1/profiles')) {
      if (method === 'PATCH') {
        const idFilter = url.searchParams.get('id');
        const targetId = idFilter?.replace('eq.', '') || '';
        const idx = db.profiles.findIndex(p => p.id === targetId);
        if (idx !== -1) {
          db.profiles[idx] = { ...db.profiles[idx], ...bodyJson };
          saveDB(db);
          return new Response(JSON.stringify(db.profiles[idx]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
      const idParam = url.searchParams.get('id');
      if (idParam && idParam.startsWith('eq.')) {
        const targetId = idParam.replace('eq.', '');
        const p = db.profiles.find(p => p.id === targetId);
        return new Response(JSON.stringify(p || null), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(db.profiles), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Hubs table
    if (pathname.includes('/rest/v1/hubs')) {
      if (method === 'PATCH') {
        const idParam = url.searchParams.get('id');
        const targetId = idParam?.replace('eq.', '') || '';
        const idx = db.hubs.findIndex(h => h.id === targetId);
        if (idx !== -1) {
          db.hubs[idx] = { ...db.hubs[idx], ...bodyJson };
          saveDB(db);
          return new Response(JSON.stringify(db.hubs[idx]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
      // RLS emulation:
      // staff / hub_lead -> only hubs mapped in hubStaff
      // manager -> only hubs mapped in managerHubs
      // super_admin, accounts -> all hubs
      let allowedHubs = db.hubs.filter(h => h.is_active);
      if (userRole === 'staff' || userRole === 'hub_lead') {
        const staffHubIds = db.hubStaff.filter(s => s.staff_id === db.currentUserId).map(s => s.hub_id);
        allowedHubs = allowedHubs.filter(h => staffHubIds.includes(h.id));
      } else if (userRole === 'manager') {
        const mgrHubIds = db.managerHubs.filter(m => m.manager_id === db.currentUserId).map(m => m.hub_id);
        allowedHubs = allowedHubs.filter(h => mgrHubIds.includes(h.id));
      }
      return new Response(JSON.stringify(allowedHubs), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Daily Reports
    if (pathname.includes('/rest/v1/daily_reports')) {
      if (method === 'POST') {
        const item = Array.isArray(bodyJson) ? bodyJson[0] : bodyJson;
        const pharmacy_sale = (Number(item.cash_sale) || 0) + (Number(item.online_sale) || 0);
        const total_revenue = pharmacy_sale +
          (Number(item.pathology_sale) || 0) +
          (Number(item.radiology_sale) || 0) +
          (Number(item.homecare_sale) || 0) +
          (Number(item.optical_sale) || 0) +
          (Number(item.opd_revenue) || 0);
        const total_bills = Number(item.total_bills) || 0;
        const revenue_per_transaction = total_bills > 0 ? Math.round(pharmacy_sale / total_bills) : null;

        const reportRecord: DailyReport = {
          id: `rep-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          pharmacy_sale,
          total_revenue,
          revenue_per_transaction,
          ...item,
        };

        const existingIdx = db.dailyReports.findIndex(
          r => r.hub_id === item.hub_id && r.report_date === item.report_date && r.snapshot === item.snapshot
        );
        if (existingIdx >= 0) {
          reportRecord.id = db.dailyReports[existingIdx].id;
          reportRecord.created_at = db.dailyReports[existingIdx].created_at;
          db.dailyReports[existingIdx] = reportRecord;
        } else {
          db.dailyReports.push(reportRecord);
        }
        saveDB(db);
        return new Response(JSON.stringify(reportRecord), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Query reports
      let results = [...db.dailyReports];
      const hubIdEq = url.searchParams.get('hub_id')?.replace('eq.', '');
      const hubIdIn = url.searchParams.get('hub_id');
      const dateEq = url.searchParams.get('report_date')?.replace('eq.', '');
      const dateGte = url.searchParams.get('report_date');
      const snapEq = url.searchParams.get('snapshot')?.replace('eq.', '');

      if (hubIdEq) results = results.filter(r => r.hub_id === hubIdEq);
      if (hubIdIn && hubIdIn.startsWith('in.(')) {
        const rawList = hubIdIn.replace('in.(', '').replace(')', '').split(',');
        results = results.filter(r => rawList.includes(r.hub_id));
      }
      if (dateEq) results = results.filter(r => r.report_date === dateEq);
      if (snapEq) results = results.filter(r => r.snapshot === snapEq);

      // Range check
      for (const [k, v] of url.searchParams.entries()) {
        if (k === 'report_date' && v.startsWith('gte.')) {
          results = results.filter(r => r.report_date >= v.replace('gte.', ''));
        }
        if (k === 'report_date' && v.startsWith('lte.')) {
          results = results.filter(r => r.report_date <= v.replace('lte.', ''));
        }
      }

      const isSingle = url.searchParams.get('limit') === '1' || (hubIdEq && dateEq && snapEq);
      if (isSingle) {
        return new Response(JSON.stringify(results[0] || null), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(results), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Monthly Costs
    if (pathname.includes('/rest/v1/monthly_costs')) {
      if (method === 'POST') {
        const item = Array.isArray(bodyJson) ? bodyJson[0] : bodyJson;
        const costRecord: MonthlyCost = {
          hub_id: item.hub_id,
          period_month: item.period_month,
          direct_cost: Number(item.direct_cost) || 0,
          indirect_cost: Number(item.indirect_cost) || 0,
          entered_by: item.entered_by || db.currentUserId,
          updated_at: new Date().toISOString(),
        };
        const idx = db.monthlyCosts.findIndex(c => c.hub_id === item.hub_id && c.period_month === item.period_month);
        if (idx >= 0) db.monthlyCosts[idx] = costRecord;
        else db.monthlyCosts.push(costRecord);
        saveDB(db);
        return new Response(JSON.stringify(costRecord), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      const periodEq = url.searchParams.get('period_month')?.replace('eq.', '');
      let list = db.monthlyCosts;
      if (periodEq) list = list.filter(c => c.period_month === periodEq);
      return new Response(JSON.stringify(list), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Views: v_daily_performance
    if (pathname.includes('/rest/v1/v_daily_performance')) {
      const hubId = url.searchParams.get('hub_id')?.replace('eq.', '');
      let from = '';
      let to = '';
      for (const [k, v] of url.searchParams.entries()) {
        if (k === 'report_date' && v.startsWith('gte.')) from = v.replace('gte.', '');
        if (k === 'report_date' && v.startsWith('lte.')) to = v.replace('lte.', '');
      }
      // Generate daily performance rows from closing reports
      const rows = db.dailyReports
        .filter(r => r.snapshot === 'closing')
        .filter(r => (!hubId || r.hub_id === hubId))
        .filter(r => (!from || r.report_date >= from) && (!to || r.report_date <= to))
        .map(r => {
          const hub = db.hubs.find(h => h.id === r.hub_id);
          const dailyTarget = hub ? Math.round(hub.monthly_revenue_target / Math.max(1, hub.working_days_per_month)) : 0;
          const variance = r.total_revenue - dailyTarget;
          const achievement_pct = dailyTarget > 0 ? Math.round((r.total_revenue / dailyTarget) * 100) : 0;
          return {
            id: r.id,
            hub_id: r.hub_id,
            hub_code: hub?.code || '',
            hub_name: hub?.name || '',
            report_date: r.report_date,
            snapshot: r.snapshot,
            total_revenue: r.total_revenue,
            daily_target: dailyTarget,
            variance,
            achievement_pct,
            footfall: r.footfall,
            total_bills: r.total_bills,
            revenue_per_transaction: r.revenue_per_transaction,
            pharmacy_sale: r.pharmacy_sale,
            pathology_sale: r.pathology_sale,
            radiology_sale: r.radiology_sale,
            homecare_sale: r.homecare_sale,
            optical_sale: r.optical_sale,
            opd_revenue: r.opd_revenue,
            closing_stock_value: r.closing_stock_value,
            variance_reason: r.variance_reason,
          };
        });
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Views: v_mtd_performance
    if (pathname.includes('/rest/v1/v_mtd_performance')) {
      const period = url.searchParams.get('period_month')?.replace('eq.', '') || monthStart(todayIST());
      const mtdRows = db.hubs.map(hub => {
        const monthReports = db.dailyReports.filter(
          r => r.hub_id === hub.id && r.snapshot === 'closing' && monthStart(r.report_date) === period
        );
        const pharmacy_mtd = monthReports.reduce((s, r) => s + r.pharmacy_sale, 0);
        const pathology_mtd = monthReports.reduce((s, r) => s + r.pathology_sale, 0);
        const radiology_mtd = monthReports.reduce((s, r) => s + r.radiology_sale, 0);
        const homecare_mtd = monthReports.reduce((s, r) => s + r.homecare_sale, 0);
        const optical_mtd = monthReports.reduce((s, r) => s + r.optical_sale, 0);
        const opd_mtd = monthReports.reduce((s, r) => s + r.opd_revenue, 0);
        const total_mtd = monthReports.reduce((s, r) => s + r.total_revenue, 0);
        const days_reported = monthReports.length;
        const gap_to_target = Math.max(0, hub.monthly_revenue_target - total_mtd);

        return {
          hub_id: hub.id,
          hub_code: hub.code,
          hub_name: hub.name,
          period_month: period,
          pharmacy_mtd,
          pathology_mtd,
          radiology_mtd,
          homecare_mtd,
          optical_mtd,
          opd_mtd,
          total_mtd,
          days_reported,
          monthly_revenue_target: hub.monthly_revenue_target,
          gap_to_target,
        };
      });
      return new Response(JSON.stringify(mtdRows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Views: v_hub_pnl
    if (pathname.includes('/rest/v1/v_hub_pnl')) {
      const period = url.searchParams.get('period_month')?.replace('eq.', '') || monthStart(todayIST());
      const pnlRows = db.hubs.map(hub => {
        const monthReports = db.dailyReports.filter(
          r => r.hub_id === hub.id && r.snapshot === 'closing' && monthStart(r.report_date) === period
        );
        const actual_revenue = monthReports.reduce((s, r) => s + r.total_revenue, 0);
        const cost = db.monthlyCosts.find(c => c.hub_id === hub.id && c.period_month === period);
        const direct_cost = cost ? cost.direct_cost : 0;
        const indirect_cost = cost ? cost.indirect_cost : 0;
        const gross_profit = actual_revenue - direct_cost;
        const total_cost = direct_cost + indirect_cost;
        const net_profit = actual_revenue - total_cost;

        return {
          hub_id: hub.id,
          hub_code: hub.code,
          hub_name: hub.name,
          period_month: period,
          actual_revenue,
          direct_cost,
          gross_profit,
          total_cost,
          net_profit,
        };
      });
      return new Response(JSON.stringify(pnlRows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Admin: hub_staff
    if (pathname.includes('/rest/v1/hub_staff')) {
      if (method === 'POST') {
        const item = Array.isArray(bodyJson) ? bodyJson[0] : bodyJson;
        const idx = db.hubStaff.findIndex(s => s.staff_id === item.staff_id && s.hub_id === item.hub_id);
        if (idx >= 0) db.hubStaff[idx] = item;
        else db.hubStaff.push(item);
        saveDB(db);
        return new Response(JSON.stringify(item), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'DELETE') {
        const sId = url.searchParams.get('staff_id')?.replace('eq.', '');
        const hId = url.searchParams.get('hub_id')?.replace('eq.', '');
        db.hubStaff = db.hubStaff.filter(s => !(s.staff_id === sId && s.hub_id === hId));
        saveDB(db);
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(db.hubStaff), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Admin: manager_hubs
    if (pathname.includes('/rest/v1/manager_hubs')) {
      if (method === 'POST') {
        const item = Array.isArray(bodyJson) ? bodyJson[0] : bodyJson;
        const idx = db.managerHubs.findIndex(m => m.manager_id === item.manager_id && m.hub_id === item.hub_id);
        if (idx >= 0) db.managerHubs[idx] = item;
        else db.managerHubs.push(item);
        saveDB(db);
        return new Response(JSON.stringify(item), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'DELETE') {
        const mId = url.searchParams.get('manager_id')?.replace('eq.', '');
        const hId = url.searchParams.get('hub_id')?.replace('eq.', '');
        db.managerHubs = db.managerHubs.filter(m => !(m.manager_id === mId && m.hub_id === hId));
        saveDB(db);
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(db.managerHubs), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export { IS_MOCK_ENV };
