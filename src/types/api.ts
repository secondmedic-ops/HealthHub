export type AppRole =
  | 'super_admin' | 'accounts' | 'manager' | 'hub_lead'
  | 'staff' | 'purchase_manager' | 'field_staff';

export type Snapshot = 'midday' | 'closing';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
}

export interface Hub {
  id: string;
  code: string;
  name: string;
  city: string | null;
  opened_on: string | null;
  monthly_revenue_target: number;
  monthly_breakeven_target: number;
  working_days_per_month: number;
  is_active: boolean;
}

/** Everything staff type in. Generated columns are NOT here — never send them. */
export interface DailyReportInput {
  hub_id: string;
  report_date: string;          // YYYY-MM-DD, IST
  snapshot: Snapshot;

  footfall: number;
  total_bills: number;
  new_customers: number;

  cash_sale: number;
  online_sale: number;
  pathology_sale: number;
  radiology_sale: number;
  homecare_sale: number;
  optical_sale: number;
  opd_revenue: number;

  opd_count: number;
  doctor_visits: number;
  abha_cards: number;
  membership_cards: number;
  home_deliveries: number;
  reminder_calls: number;
  reminder_conversions: number;
  leaflets_distributed: number;

  closing_stock_value: number | null;   // closing only
  variance_reason: string | null;       // closing only

  expected_closing_sale: number | null; // midday only
  gap_action_plan: string | null;       // midday only
  camp_plan_date: string | null;        // midday only, YYYY-MM-DD
}

export interface DailyReport extends DailyReportInput {
  id: string;
  submitted_by: string;        // last saved by
  submitted_at: string;
  pharmacy_sale: number;       // generated: cash + online
  total_revenue: number;       // generated: all revenue lines
  revenue_per_transaction: number | null; // generated
  created_at: string;
  updated_at: string;
}

export interface DailyPerformanceRow {
  id: string;
  hub_id: string;
  hub_code: string;
  hub_name: string;
  report_date: string;
  snapshot: Snapshot;
  total_revenue: number;
  daily_target: number;
  variance: number;
  achievement_pct: number | null;
  footfall: number;
  total_bills: number;
  revenue_per_transaction: number | null;
  pharmacy_sale: number;
  pathology_sale: number;
  radiology_sale: number;
  homecare_sale: number;
  optical_sale: number;
  opd_revenue: number;
  closing_stock_value: number | null;
  variance_reason: string | null;
}

export interface MtdRow {
  hub_id: string;
  hub_code: string;
  hub_name: string;
  period_month: string;        // YYYY-MM-01
  pharmacy_mtd: number;
  pathology_mtd: number;
  radiology_mtd: number;
  homecare_mtd: number;
  optical_mtd: number;
  opd_mtd: number;
  total_mtd: number;
  days_reported: number;
  monthly_revenue_target: number;
  gap_to_target: number;
}

export interface PnlRow {
  hub_id: string;
  hub_code: string;
  hub_name: string;
  period_month: string;
  actual_revenue: number;
  direct_cost: number;
  gross_profit: number;
  total_cost: number;
  net_profit: number;
}

export interface MonthlyCost {
  hub_id: string;
  period_month: string;
  direct_cost: number;
  indirect_cost: number;
  entered_by: string | null;
  updated_at: string;
}

export interface TodayStatusRow {
  hub_id: string;
  snapshot: Snapshot;
  submitted_at: string;
  total_revenue: number;
}

export interface HubStaffRow {
  staff_id: string;
  hub_id: string;
  is_primary: boolean;
}

export interface ManagerHubRow {
  manager_id: string;
  hub_id: string;
}
