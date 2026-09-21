-- ============================================================================
-- SecondMedic HealthHub — seed the 8 real branches from your P&L tracker
-- Targets are left at 0 / working_days_per_month at 26 — fill in the real
-- monthly_revenue_target and monthly_breakeven_target per hub afterwards,
-- either here before running, or later from the Admin screen once the app
-- is live (updateHubTargets already supports this).
-- ============================================================================

insert into hubs (code, name, monthly_revenue_target, monthly_breakeven_target, working_days_per_month)
values
  ('WEL', 'Wellness',          0, 0, 26),
  ('OMX', 'Omaxe',              0, 0, 26),
  ('ASH', 'Ashiana',            0, 0, 26),
  ('RJP', 'Rajaji Puram',       0, 0, 26),
  ('VIK', 'Vikas',              0, 0, 26),
  ('PRJ', 'Prayag Raj',         0, 0, 26),
  ('PRK', 'Prayag Raj Kareli',  0, 0, 26),
  ('SHG', 'Sahadat Ganj',       0, 0, 26)
on conflict (code) do nothing;
