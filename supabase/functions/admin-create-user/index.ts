// Supabase Edge Function: admin-create-user
//
// Lets an active Super Admin create any HealthHub login (Manager, Hub Lead,
// Purchase Manager, Field Staff, Accounts, Branch Staff…), and lets an
// active Manager create Branch Staff for their own branches — all from
// inside the app, instead of going into the Supabase dashboard.
//
// Security model:
//  - The caller's own JWT (forwarded from the browser) is used ONLY to look
//    up their own profile and confirm role + is_active. This runs through
//    the anon-key client, so normal RLS applies — nobody can spoof another
//    person's role this way.
//  - Only once that check passes do we touch the service-role client, which
//    bypasses RLS and can call the Auth Admin API. The service role key
//    lives only in this function's environment — it is never sent to, or
//    reachable from, the browser bundle.
//  - A Manager is NOT a Super Admin: every Manager-initiated action below is
//    re-checked against manager_hubs server-side (which branches they
//    actually manage) and their created role is hard-forced to 'staff' —
//    the request body's own `role` field is ignored for a manager caller.
//  - A new account gets a random password nobody (not even this function)
//    ever displays or stores. Instead we return a Supabase password-set
//    link that the admin/manager copies and sends the new person over
//    WhatsApp/email/etc, so they choose their own password.
//  - The link points at /set-password on the live site (SITE_URL below) —
//    that route must also be added to Supabase's Authentication → URL
//    Configuration → Redirect URLs allow list, or Supabase will refuse the
//    redirect and silently fall back to the project's default Site URL.
//
// Request shapes (all POST, body.mode selects the action):
//  { full_name, email, role, phone?, hub_id? }
//      Super Admin: create a brand-new account with any role. hub_id is
//      optional — if given, also assigns the new person to that branch.
//      Manager: create a brand-new Branch Staff account. `role` is ignored
//      (forced to 'staff'); hub_id is REQUIRED and must be one of the
//      manager's own branches.
//  { mode: 'resend', email }
//      Super Admin only: re-issue the set-password link for an existing
//      user (their first link expired, or predates the SITE_URL fix).
//  { mode: 'set-password', user_id, password }
//      Super Admin only: set someone's password directly, no link needed.
//  { mode: 'my-team' }
//      Super Admin or Manager: list the people assigned to the caller's
//      branches (all branches, for Super Admin). Read-only.
//  { mode: 'unassign-staff', staff_id, hub_id }
//      Super Admin, or Manager for one of their own branches: remove a
//      person's assignment to that branch (does not delete their account).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ROLES = [
  'staff', 'hub_lead', 'manager', 'accounts', 'purchase_manager', 'field_staff', 'super_admin',
];

// Falls back to the known live URL; override with `supabase secrets set
// SITE_URL=https://your-domain` if the project ever moves.
const SITE_URL = Deno.env.get('SITE_URL') || 'https://healthhub.delvinnadar12.workers.dev';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    // 1. Who is calling, via their own token (RLS still applies here).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ success: false, error: 'Your session has expired. Sign in again.' });
    }
    const callerId = userData.user.id;

    const { data: callerProfile, error: profileErr } = await callerClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', callerId)
      .maybeSingle();

    if (profileErr || !callerProfile || !callerProfile.is_active) {
      return json({ success: false, error: 'Your account is not active.' });
    }

    const isSuperAdmin = callerProfile.role === 'super_admin';
    const isManager = callerProfile.role === 'manager';

    if (!isSuperAdmin && !isManager) {
      return json({ success: false, error: 'Only a Super Admin or Manager can do this.' });
    }

    const body = await req.json().catch(() => ({}));

    // 3. Privileged actions — service role, bypasses RLS.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ---- my-team mode: read-only roster for the caller's branches ----
    if (body.mode === 'my-team') {
      let hubIds: string[];
      if (isSuperAdmin) {
        const { data: allHubs } = await adminClient.from('hubs').select('id');
        hubIds = (allHubs ?? []).map((h: any) => h.id);
      } else {
        const { data: mh } = await adminClient
          .from('manager_hubs')
          .select('hub_id')
          .eq('manager_id', callerId);
        hubIds = (mh ?? []).map((r: any) => r.hub_id);
      }
      if (hubIds.length === 0) return json({ success: true, team: [] });

      const { data: assignments, error: hsErr } = await adminClient
        .from('hub_staff')
        .select('staff_id, hub_id')
        .in('hub_id', hubIds);
      if (hsErr) return json({ success: false, error: hsErr.message });

      const staffIds = [...new Set((assignments ?? []).map((a: any) => a.staff_id))];
      const { data: staffProfiles } = staffIds.length
        ? await adminClient.from('profiles').select('id, full_name, email, phone, role, is_active').in('id', staffIds)
        : { data: [] as any[] };
      const { data: hubRows } = await adminClient.from('hubs').select('id, name, code').in('id', hubIds);
      const hubById = new Map((hubRows ?? []).map((h: any) => [h.id, h]));

      const team = (assignments ?? []).map((a: any) => {
        const p = (staffProfiles ?? []).find((s: any) => s.id === a.staff_id);
        const h = hubById.get(a.hub_id);
        return {
          staff_id: a.staff_id,
          full_name: p?.full_name ?? 'Unknown',
          email: p?.email ?? null,
          phone: p?.phone ?? null,
          role: p?.role ?? 'staff',
          is_active: p?.is_active ?? true,
          hub_id: a.hub_id,
          hub_name: h?.name ?? '',
          hub_code: h?.code ?? '',
        };
      });

      return json({ success: true, team });
    }

    // ---- unassign-staff mode: remove someone from one of the caller's branches ----
    if (body.mode === 'unassign-staff') {
      const staffId = String(body.staff_id || '').trim();
      const hubId = String(body.hub_id || '').trim();
      if (!staffId || !hubId) {
        return json({ success: false, error: 'Missing staff member or branch.' });
      }
      if (isManager) {
        const { data: owns } = await adminClient
          .from('manager_hubs')
          .select('hub_id')
          .eq('manager_id', callerId)
          .eq('hub_id', hubId)
          .maybeSingle();
        if (!owns) {
          return json({ success: false, error: 'You do not manage this branch.' });
        }
      }
      const { error: delErr } = await adminClient
        .from('hub_staff')
        .delete()
        .eq('staff_id', staffId)
        .eq('hub_id', hubId);
      if (delErr) return json({ success: false, error: delErr.message });
      return json({ success: true });
    }

    // ---- set-password mode: Super Admin only, sets it directly, no link needed ----
    if (body.mode === 'set-password') {
      if (!isSuperAdmin) {
        return json({ success: false, error: 'Only a Super Admin can set someone else’s password.' });
      }
      const targetUserId = String(body.user_id || '').trim();
      const newPassword = String(body.password || '');
      if (!targetUserId) {
        return json({ success: false, error: 'Missing user.' });
      }
      if (newPassword.length < 8) {
        return json({ success: false, error: 'Password must be at least 8 characters.' });
      }
      const { error: pwErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
      });
      if (pwErr) {
        return json({ success: false, error: pwErr.message || 'Could not set the password.' });
      }
      return json({ success: true, id: targetUserId, setPasswordLink: null });
    }

    const email = String(body.email || '').trim().toLowerCase();

    // ---- resend mode: Super Admin only ----
    if (body.mode === 'resend') {
      if (!isSuperAdmin) {
        return json({ success: false, error: 'Only a Super Admin can resend a link.' });
      }
      if (!email || !email.includes('@')) {
        return json({ success: false, error: 'Enter a valid email address.' });
      }
      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${SITE_URL}/set-password` },
      });
      if (linkErr || !linkData?.properties?.action_link) {
        return json({ success: false, error: linkErr?.message || 'Could not generate a link for this email.' });
      }
      return json({ success: true, id: null, setPasswordLink: linkData.properties.action_link });
    }

    // ---- create mode ----
    if (!email || !email.includes('@')) {
      return json({ success: false, error: 'Enter a valid email address.' });
    }
    const full_name = String(body.full_name || '').trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    let hubIdToAssign: string | null = body.hub_id ? String(body.hub_id).trim() : null;
    let role: string;

    if (!full_name) {
      return json({ success: false, error: 'Enter the person’s full name.' });
    }

    if (isManager) {
      // A Manager may only create Branch Staff, and only for a branch they
      // actually manage — the request's own `role` is ignored on purpose.
      role = 'staff';
      if (!hubIdToAssign) {
        return json({ success: false, error: 'Choose which branch this person belongs to.' });
      }
      const { data: owns } = await adminClient
        .from('manager_hubs')
        .select('hub_id')
        .eq('manager_id', callerId)
        .eq('hub_id', hubIdToAssign)
        .maybeSingle();
      if (!owns) {
        return json({ success: false, error: 'You do not manage this branch.' });
      }
    } else {
      role = String(body.role || 'manager');
      if (!ALLOWED_ROLES.includes(role)) {
        return json({ success: false, error: 'Not a recognised role.' });
      }
    }

    const tempPassword = crypto.randomUUID() + 'Aa1!';
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createErr || !created?.user) {
      const msg = createErr?.message || '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
        return json({ success: false, error: 'An account with this email already exists.' });
      }
      return json({ success: false, error: msg || 'Could not create the account.' });
    }

    // The on_auth_user_created trigger already inserted a profiles row with
    // role='staff' by default — set it to what was actually asked for.
    const { error: updateErr } = await adminClient
      .from('profiles')
      .update({ role, full_name, phone })
      .eq('id', created.user.id);

    if (updateErr) {
      return json({ success: false, error: updateErr.message });
    }

    // Optional branch assignment (required and pre-verified above for a
    // Manager caller; optional convenience for a Super Admin caller).
    if (hubIdToAssign) {
      const { error: assignErr } = await adminClient
        .from('hub_staff')
        .upsert({ staff_id: created.user.id, hub_id: hubIdToAssign, is_primary: true });
      if (assignErr) {
        return json({ success: false, error: `Account created, but branch assignment failed: ${assignErr.message}` });
      }
    }

    // A link the admin/manager can hand the new person so THEY set their
    // own password. Nobody at SecondMedic has to type or see it.
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${SITE_URL}/set-password` },
    });

    return json({
      success: true,
      id: created.user.id,
      setPasswordLink: linkErr ? null : linkData?.properties?.action_link ?? null,
    });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : 'Unexpected error.' });
  }
});
