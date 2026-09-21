-- Purchase managers need to see every branch (to pick a hub when recording a
-- purchase), not just the ones they're mapped to via hub_staff. The original
-- hubs_select policy only bypassed the my_hub_ids() scoping for
-- super_admin/accounts; add purchase_manager to that org-wide list.

drop policy if exists hubs_select on hubs;

create policy hubs_select on hubs for select
  using (
    my_role() in ('super_admin', 'accounts', 'purchase_manager')
    or id in (select my_hub_ids())
  );
