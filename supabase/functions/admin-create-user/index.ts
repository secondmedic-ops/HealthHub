// Supabase Edge Function: admin-create-user
//
// Lets an active super_admin create a brand-new HealthHub login (Manager,
// Hub Lead, Purchase Manager, Field Staff, Accounts, Branch Staff…) from
// inside the app itself, instead of going into the Supabase dashboard.
//
// Security model:
//  - The caller's own JWT (forwarded from the browser) is used ONLY to look
//    up their own profile and confirm role = 'super_admin' and is_active.
//    This runs through the anon-key client, so normal RLS applies — nobody
//    can spoof another person's role this way.
//  - Only once that check passes do we touch the service-role client, which
//    bypasses RLS and can call the Auth Admin API. The service role key
//    lives only in this function's environment — it is never sent to, or
//    reachable from, the browser bundle.
//  - The new account gets a random password nobody (not even this
//    function) ever displays or stores. Instead we return a Supabase
//    password-set link that the admin copies and sends to the new person
//    over WhatsApp/email/etc, so they choose their own password.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ROLES = [
  'staff', 'hub_lead', 'manager', 'accounts', 'purchase_manager', 'field_staff', 'super_admin',
];

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

    const { data: callerProfile, error: profileErr } = await callerClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profileErr || !callerProfile || callerProfile.role !== 'super_admin' || !callerProfile.is_active) {
      return json({ success: false, error: 'Only an active Super Admin can create accounts.' });
    }

    // 2. Validate input.
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const full_name = String(body.full_name || '').trim();
    const role = String(body.role || 'manager');
    const phone = body.phone ? String(body.phone).trim() : null;

    if (!email || !email.includes('@')) {
      return json({ success: false, error: 'Enter a valid email address.' });
    }
    if (!full_name) {
      return json({ success: false, error: 'Enter the person’s full name.' });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return json({ success: false, error: 'Not a recognised role.' });
    }

    // 3. Privileged actions — service role, bypasses RLS.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

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

    // A link the admin can hand the new person so THEY set their own
    // password. Nobody at SecondMedic has to type or see it.
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
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
