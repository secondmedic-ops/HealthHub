import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  getMyHubs,
  updateHubTargets,
  listProfiles,
  updateProfile,
  listHubStaff,
  assignStaff,
  unassignStaff,
  listManagerHubs,
  assignManager,
  unassignManager,
  adminCreateUser,
  adminResendSetPasswordLink,
  adminSetPassword,
} from '../api/endpoints';
import type { Hub, Profile, AppRole } from '../types/api';
import { formatINR, dailyTarget } from '../lib/format';
import {
  Building2,
  Users,
  GitFork,
  Save,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  UserPlus,
  Copy,
  X,
  Link2,
  KeyRound,
} from 'lucide-react';

const ROLE_OPTIONS: { role: AppRole; label: string }[] = [
  { role: 'staff', label: 'Branch Staff' },
  { role: 'hub_lead', label: 'Hub Lead' },
  { role: 'manager', label: 'Area Manager' },
  { role: 'accounts', label: 'Accounts Team' },
  { role: 'super_admin', label: 'Super Admin' },
  { role: 'purchase_manager', label: 'Purchase Manager' },
  { role: 'field_staff', label: 'Field Staff' },
];

export function AdminScreen() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'branches' | 'people' | 'mapping'>(
    'branches'
  );

  // Branches Tab State
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [hubEdits, setHubEdits] = useState<
    Record<
      string,
      {
        monthly_revenue_target: string;
        monthly_breakeven_target: string;
        working_days: string;
      }
    >
  >({});
  const [savingHubId, setSavingHubId] = useState<string | null>(null);

  // People Tab State
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);

  // Add-person (create login) form
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [npName, setNpName] = useState('');
  const [npEmail, setNpEmail] = useState('');
  const [npPhone, setNpPhone] = useState('');
  const [npRole, setNpRole] = useState<AppRole>('manager');
  const [npSaving, setNpSaving] = useState(false);
  const [newAccountLink, setNewAccountLink] = useState<{ name: string; link: string | null } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Inline "set password directly" form
  const [pwUserId, setPwUserId] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // Mapping Tab State
  const [selectedMappingHubId, setSelectedMappingHubId] = useState<string>('');
  const [hubStaffProfiles, setHubStaffProfiles] = useState<Profile[]>([]);
  const [hubManagerProfiles, setHubManagerProfiles] = useState<Profile[]>([]);
  const [staffToAdd, setStaffToAdd] = useState<string>('');
  const [managerToAdd, setManagerToAdd] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);

  // Load initial data
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const [hubList, userProfiles] = await Promise.all([
          getMyHubs(),
          listProfiles(),
        ]);
        setHubs(hubList);
        setProfiles(userProfiles);

        // Initialize branch form values
        const edits: Record<string, any> = {};
        hubList.forEach((h) => {
          edits[h.id] = {
            monthly_revenue_target: String(h.monthly_revenue_target),
            monthly_breakeven_target: String(h.monthly_breakeven_target),
            working_days: String(h.working_days_per_month),
          };
        });
        setHubEdits(edits);

        if (hubList.length > 0) {
          setSelectedMappingHubId(hubList[0].id);
        }
      } catch (err: any) {
        toast(err.message || 'Failed to load administration data', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [toast]);

  // Load mapping for selected hub
  useEffect(() => {
    if (!selectedMappingHubId) return;

    async function loadHubMappings() {
      try {
        const [allStaffAssignments, managerList] = await Promise.all([
          listHubStaff(),
          listManagerHubs(),
        ]);

        // Filter staff assigned to this hub
        const assignedStaffIds = allStaffAssignments
          .filter((s) => s.hub_id === selectedMappingHubId)
          .map((s) => s.staff_id);

        const assignedStaff = profiles.filter((p) =>
          assignedStaffIds.includes(p.id)
        );
        setHubStaffProfiles(assignedStaff);

        // Filter managers assigned to this hub
        const managersAssignedToThisHub = managerList
          .filter((m) => m.hub_id === selectedMappingHubId)
          .map((m) => m.manager_id);

        const activeManagers = profiles.filter(
          (p) =>
            p.role === 'manager' && managersAssignedToThisHub.includes(p.id)
        );
        setHubManagerProfiles(activeManagers);
      } catch (err: any) {
        console.warn('Error loading mappings:', err);
      }
    }
    loadHubMappings();
  }, [selectedMappingHubId, profiles]);

  // 1. Branches Tab Handler: Update Target
  const handleSaveHubTargets = async (hubId: string) => {
    const edit = hubEdits[hubId];
    if (!edit) return;

    const revTarget = Math.max(0, Number(edit.monthly_revenue_target) || 0);
    const beTarget = Math.max(0, Number(edit.monthly_breakeven_target) || 0);
    const wDays = Math.max(1, Math.min(31, Number(edit.working_days) || 26));

    setSavingHubId(hubId);
    try {
      const updated = await updateHubTargets(hubId, {
        monthly_revenue_target: revTarget,
        monthly_breakeven_target: beTarget,
        working_days_per_month: wDays,
      });
      setHubs((prev) => prev.map((h) => (h.id === hubId ? updated : h)));
      toast('Branch targets updated successfully', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update branch targets', 'error');
    } finally {
      setSavingHubId(null);
    }
  };

  // 2. People Tab Handler: Update Profile Role or Active Status
  const handleUpdateProfile = async (
    userId: string,
    role: AppRole,
    isActive: boolean
  ) => {
    setSavingProfileId(userId);
    try {
      const updated = await updateProfile(userId, { role, is_active: isActive });
      setProfiles((prev) => prev.map((p) => (p.id === userId ? updated : p)));
      toast('User profile updated', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSavingProfileId(null);
    }
  };

  // 2b. People Tab Handler: Create a brand-new login (Manager, Staff, …)
  const handleCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!npName.trim() || !npEmail.trim()) {
      toast('Enter a name and email.', 'error');
      return;
    }
    setNpSaving(true);
    try {
      const result = await adminCreateUser({
        email: npEmail.trim(),
        full_name: npName.trim(),
        role: npRole,
        phone: npPhone.trim() || null,
      });
      toast(`${npName.trim()} added as ${ROLE_OPTIONS.find((r) => r.role === npRole)?.label || npRole}.`, 'success');
      setNewAccountLink({ name: npName.trim(), link: result.setPasswordLink });
      setNpName('');
      setNpEmail('');
      setNpPhone('');
      setNpRole('manager');
      setShowAddPerson(false);
      const refreshed = await listProfiles();
      setProfiles(refreshed);
    } catch (err: any) {
      toast(err.message || 'Could not create the account.', 'error');
    } finally {
      setNpSaving(false);
    }
  };

  // 2c. People Tab Handler: Resend a set-password link (expired / pre-fix link)
  const handleResendLink = async (userId: string, name: string, email: string | null) => {
    if (!email) {
      toast('This person has no email on file.', 'error');
      return;
    }
    setResendingId(userId);
    try {
      const result = await adminResendSetPasswordLink(email);
      setNewAccountLink({ name, link: result.setPasswordLink });
      toast(`New link generated for ${name}.`, 'success');
    } catch (err: any) {
      toast(err.message || 'Could not generate a link.', 'error');
    } finally {
      setResendingId(null);
    }
  };

  // 2d. People Tab Handler: Super Admin sets a password directly
  const toggleSetPassword = (userId: string) => {
    setPwUserId((cur) => (cur === userId ? null : userId));
    setPwValue('');
    setPwConfirm('');
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwUserId) return;
    if (pwValue.length < 8) {
      toast('Password must be at least 8 characters.', 'error');
      return;
    }
    if (pwValue !== pwConfirm) {
      toast('Passwords do not match.', 'error');
      return;
    }
    setPwSaving(true);
    try {
      await adminSetPassword(pwUserId, pwValue);
      toast('Password updated.', 'success');
      setPwUserId(null);
      setPwValue('');
      setPwConfirm('');
    } catch (err: any) {
      toast(err.message || 'Could not set password.', 'error');
    } finally {
      setPwSaving(false);
    }
  };

  // 3. Mapping Tab Handlers
  const handleAssignStaff = async () => {
    if (!staffToAdd || !selectedMappingHubId) return;
    try {
      await assignStaff(staffToAdd, selectedMappingHubId);
      const addedProfile = profiles.find((p) => p.id === staffToAdd);
      if (addedProfile) {
        setHubStaffProfiles((prev) => [...prev, addedProfile]);
      }
      setStaffToAdd('');
      toast('Staff member assigned to branch', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to assign staff', 'error');
    }
  };

  const handleUnassignStaff = async (userId: string) => {
    if (!selectedMappingHubId) return;
    try {
      await unassignStaff(userId, selectedMappingHubId);
      setHubStaffProfiles((prev) => prev.filter((p) => p.id !== userId));
      toast('Staff unassigned from branch', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to unassign staff', 'error');
    }
  };

  const handleAssignManager = async () => {
    if (!managerToAdd || !selectedMappingHubId) return;
    try {
      await assignManager(managerToAdd, selectedMappingHubId);
      const added = profiles.find((p) => p.id === managerToAdd);
      if (added) {
        setHubManagerProfiles((prev) => [...prev, added]);
      }
      setManagerToAdd('');
      toast('Manager assigned to branch', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to assign manager', 'error');
    }
  };

  const handleUnassignManager = async (managerId: string) => {
    if (!selectedMappingHubId) return;
    try {
      await unassignManager(managerId, selectedMappingHubId);
      setHubManagerProfiles((prev) => prev.filter((p) => p.id !== managerId));
      toast('Manager unassigned from branch', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to unassign manager', 'error');
    }
  };

  const availableStaffCandidates = useMemo(() => {
    const assignedIds = new Set(hubStaffProfiles.map((p) => p.id));
    return profiles.filter(
      (p) =>
        (p.role === 'staff' || p.role === 'hub_lead') &&
        !assignedIds.has(p.id) &&
        p.is_active
    );
  }, [profiles, hubStaffProfiles]);

  const availableManagerCandidates = useMemo(() => {
    const assignedIds = new Set(hubManagerProfiles.map((p) => p.id));
    return profiles.filter(
      (p) => p.role === 'manager' && !assignedIds.has(p.id) && p.is_active
    );
  }, [profiles, hubManagerProfiles]);

  if (loading) {
    return (
      <div className="py-16 text-center text-[#5B6670]">
        <div className="w-7 h-7 border-2 border-[#16324F] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm">Loading admin dashboard…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-[6px] border border-[#D9DEDA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-[#16324F]">Administration</h2>
          <p className="text-xs text-[#5B6670]">
            Manage branch targets, employee roles, and hub assignments
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center border border-[#D9DEDA] rounded-[6px] p-0.5 bg-[#F7F8F6]">
          <button
            type="button"
            onClick={() => setActiveTab('branches')}
            className={`min-h-[38px] px-3.5 py-1 text-xs font-medium rounded-[4px] transition-colors ${
              activeTab === 'branches'
                ? 'bg-[#16324F] text-white shadow-xs'
                : 'text-[#1D2329] hover:bg-[#EAEFEA]'
            }`}
          >
            Branches
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('people')}
            className={`min-h-[38px] px-3.5 py-1 text-xs font-medium rounded-[4px] transition-colors ${
              activeTab === 'people'
                ? 'bg-[#16324F] text-white shadow-xs'
                : 'text-[#1D2329] hover:bg-[#EAEFEA]'
            }`}
          >
            People
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mapping')}
            className={`min-h-[38px] px-3.5 py-1 text-xs font-medium rounded-[4px] transition-colors ${
              activeTab === 'mapping'
                ? 'bg-[#16324F] text-white shadow-xs'
                : 'text-[#1D2329] hover:bg-[#EAEFEA]'
            }`}
          >
            Mapping
          </button>
        </div>
      </div>

      {/* TAB 1: BRANCHES */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#D9DEDA] rounded-[6px] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#D9DEDA]">
              <h3 className="text-sm font-semibold text-[#16324F]">
                Branch financial targets
              </h3>
              <p className="text-xs text-[#5B6670]">
                Monthly target, break-even target, and working days. Daily target is computed live.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#16324F] text-white border-b border-[#16324F]">
                    <th className="py-3 px-3 sm:px-4 font-semibold">Branch</th>
                    <th className="py-3 px-3 font-semibold text-right">
                      Monthly target (₹)
                    </th>
                    <th className="py-3 px-3 font-semibold text-right">
                      Monthly break-even (₹)
                    </th>
                    <th className="py-3 px-3 font-semibold text-center">
                      Working days
                    </th>
                    <th className="py-3 px-3 font-semibold text-right">
                      Computed daily target
                    </th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9DEDA]">
                  {hubs.map((hub) => {
                    const edit = hubEdits[hub.id] || {
                      monthly_revenue_target: String(hub.monthly_revenue_target),
                      monthly_breakeven_target: String(hub.monthly_breakeven_target),
                      working_days: String(hub.working_days_per_month),
                    };

                    const revTgtNum = Number(edit.monthly_revenue_target) || 0;
                    const wDaysNum = Math.max(1, Number(edit.working_days) || 26);
                    const liveComputedDaily = Math.round(revTgtNum / wDaysNum);

                    return (
                      <tr key={hub.id} className="hover:bg-[#F9FAF8]">
                        <td className="py-3 px-3 sm:px-4">
                          <div className="font-semibold text-[#16324F]">
                            {hub.name}
                          </div>
                          <div className="text-[11px] text-[#5B6670]">
                            {hub.code}
                          </div>
                        </td>

                        {/* Monthly Target */}
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={edit.monthly_revenue_target}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setHubEdits((prev) => ({
                                ...prev,
                                [hub.id]: {
                                  ...prev[hub.id],
                                  monthly_revenue_target: val,
                                },
                              }));
                            }}
                            className="input-ledger w-32 text-right py-1 px-2 text-xs"
                          />
                        </td>

                        {/* Monthly Break-even */}
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={edit.monthly_breakeven_target}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setHubEdits((prev) => ({
                                ...prev,
                                [hub.id]: {
                                  ...prev[hub.id],
                                  monthly_breakeven_target: val,
                                },
                              }));
                            }}
                            className="input-ledger w-32 text-right py-1 px-2 text-xs"
                          />
                        </td>

                        {/* Working Days */}
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={edit.working_days}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setHubEdits((prev) => ({
                                ...prev,
                                [hub.id]: {
                                  ...prev[hub.id],
                                  working_days: val,
                                },
                              }));
                            }}
                            className="input-ledger w-16 text-center py-1 px-2 text-xs"
                          />
                        </td>

                        {/* Computed Daily Target */}
                        <td className="py-3 px-3 text-right font-semibold text-[#16324F] tabular-nums whitespace-nowrap">
                          {formatINR(liveComputedDaily)}
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            disabled={savingHubId === hub.id}
                            onClick={() => handleSaveHubTargets(hub.id)}
                            className="btn-primary text-xs px-3 py-1.5 min-h-[36px] flex items-center gap-1 mx-auto"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{savingHubId === hub.id ? '…' : 'Save'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PEOPLE */}
      {activeTab === 'people' && (
        <div className="space-y-4">
          {newAccountLink && (
            <div className="bg-[#ECFDF3] border border-[#ABEFC6] p-3.5 rounded-[6px] text-xs text-[#1F7A4D] space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="leading-relaxed font-medium">
                  {newAccountLink.name}'s account is ready. Send them this link so they can set their own password:
                </p>
                <button
                  type="button"
                  onClick={() => setNewAccountLink(null)}
                  className="p-1 hover:opacity-70 shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {newAccountLink.link ? (
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={newAccountLink.link}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="input-ledger flex-1 text-[11px] font-mono bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(newAccountLink.link || '');
                      toast('Link copied', 'success');
                    }}
                    className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1 shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                </div>
              ) : (
                <p className="text-[11px]">
                  The account was created, but the set-password link couldn't be generated — send a manual password reset from Supabase Authentication instead.
                </p>
              )}
            </div>
          )}

          <div className="bg-white border border-[#D9DEDA] rounded-[6px] p-4 shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div>
                <h3 className="text-sm font-semibold text-[#16324F]">Add a person</h3>
                <p className="text-xs text-[#5B6670]">
                  Create a Manager, Branch Staff, Purchase Manager or any other login right here — no Supabase dashboard needed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPerson((v) => !v)}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {showAddPerson ? 'Cancel' : 'Add person'}
              </button>
            </div>

            {showAddPerson && (
              <form
                onSubmit={handleCreatePerson}
                className="mt-3 pt-3 border-t border-[#D9DEDA] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2"
              >
                <input
                  className="input-ledger sm:col-span-1"
                  placeholder="Full name"
                  value={npName}
                  onChange={(e) => setNpName(e.target.value)}
                />
                <input
                  className="input-ledger sm:col-span-1"
                  type="email"
                  placeholder="Work email"
                  value={npEmail}
                  onChange={(e) => setNpEmail(e.target.value)}
                />
                <input
                  className="input-ledger sm:col-span-1"
                  placeholder="Phone (optional)"
                  value={npPhone}
                  onChange={(e) => setNpPhone(e.target.value)}
                />
                <select
                  className="input-ledger sm:col-span-1"
                  value={npRole}
                  onChange={(e) => setNpRole(e.target.value as AppRole)}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.role} value={r.role}>{r.label}</option>
                  ))}
                </select>
                <button type="submit" disabled={npSaving} className="btn-primary text-xs">
                  {npSaving ? 'Creating…' : 'Create account'}
                </button>
                <p className="sm:col-span-2 lg:col-span-5 text-[11px] text-[#5B6670]">
                  After creating a Manager, assign their branches from the Mapping tab below — one manager can cover multiple branches.
                </p>
              </form>
            )}
          </div>

          <div className="bg-white border border-[#D9DEDA] rounded-[6px] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#D9DEDA]">
              <h3 className="text-sm font-semibold text-[#16324F]">User roster</h3>
              <p className="text-xs text-[#5B6670]">
                Configure permissions and account active status
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#16324F] text-white border-b border-[#16324F]">
                    <th className="py-3 px-3 sm:px-4 font-semibold">Name & Email</th>
                    <th className="py-3 px-3 font-semibold">Phone</th>
                    <th className="py-3 px-3 font-semibold">Assigned Role</th>
                    <th className="py-3 px-3 font-semibold text-center">Status</th>
                    <th className="py-3 px-3 font-semibold text-center">Account access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9DEDA]">
                  {profiles.map((usr) => (
                    <React.Fragment key={usr.id}>
                    <tr className="hover:bg-[#F9FAF8]">
                      <td className="py-3 px-3 sm:px-4">
                        <div className="font-semibold text-[#1D2329]">
                          {usr.full_name}
                        </div>
                        <div className="text-[11px] text-[#5B6670]">{usr.email}</div>
                      </td>

                      <td className="py-3 px-3 text-[#5B6670] tabular-nums">
                        {usr.phone || '—'}
                      </td>

                      {/* Role Dropdown */}
                      <td className="py-2.5 px-3">
                        <select
                          value={usr.role}
                          disabled={savingProfileId === usr.id}
                          onChange={(e) =>
                            handleUpdateProfile(
                              usr.id,
                              e.target.value as AppRole,
                              usr.is_active
                            )
                          }
                          className="input-ledger py-1 px-2 text-xs font-medium"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.role} value={r.role}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Active Toggle */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          disabled={savingProfileId === usr.id}
                          onClick={() =>
                            handleUpdateProfile(usr.id, usr.role, !usr.is_active)
                          }
                          className={`min-h-[36px] px-3 py-1 rounded-[4px] text-xs font-medium border transition-colors ${
                            usr.is_active
                              ? 'bg-[#ECFDF3] border-[#ABEFC6] text-[#1F7A4D]'
                              : 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
                          }`}
                        >
                          {usr.is_active ? 'Active' : 'Disabled'}
                        </button>
                      </td>

                      {/* Account access: resend link, or set a password directly */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            disabled={resendingId === usr.id || usr.id === profile?.id}
                            onClick={() => handleResendLink(usr.id, usr.full_name, usr.email)}
                            title={usr.id === profile?.id ? 'Use Supabase Authentication to reset your own password' : 'Generate a fresh set-password link'}
                            className="min-h-[36px] px-2.5 py-1 rounded-[4px] text-xs font-medium border border-[#D9DEDA] text-[#16324F] hover:bg-[#F0F5F9] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            {resendingId === usr.id ? '…' : 'Resend'}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSetPassword(usr.id)}
                            title="Set this person's password directly"
                            className={`min-h-[36px] px-2.5 py-1 rounded-[4px] text-xs font-medium border flex items-center gap-1 ${
                              pwUserId === usr.id
                                ? 'bg-[#16324F] border-[#16324F] text-white'
                                : 'border-[#D9DEDA] text-[#16324F] hover:bg-[#F0F5F9]'
                            }`}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Set
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline "set password directly" form */}
                    {pwUserId === usr.id && (
                      <tr className="bg-[#F0F5F9]">
                        <td colSpan={5} className="p-3">
                          <form
                            onSubmit={handleSetPassword}
                            className="flex flex-col sm:flex-row sm:items-center gap-2"
                          >
                            <span className="text-xs text-[#16324F] font-medium shrink-0">
                              Set password for {usr.full_name}:
                            </span>
                            <input
                              type="password"
                              autoFocus
                              placeholder="New password (min 8 characters)"
                              value={pwValue}
                              onChange={(e) => setPwValue(e.target.value)}
                              className="input-ledger flex-1 text-xs"
                            />
                            <input
                              type="password"
                              placeholder="Confirm password"
                              value={pwConfirm}
                              onChange={(e) => setPwConfirm(e.target.value)}
                              className="input-ledger flex-1 text-xs"
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <button type="submit" disabled={pwSaving} className="btn-primary text-xs px-3 py-1.5">
                                {pwSaving ? 'Saving…' : 'Save password'}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleSetPassword(usr.id)}
                                className="btn-secondary text-xs px-3 py-1.5"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                          <p className="text-[11px] text-[#5B6670] mt-2">
                            They'll be able to sign in with this password right away — tell them what it is over a call or in person, not written down.
                          </p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MAPPING */}
      {activeTab === 'mapping' && (
        <div className="space-y-6">
          {/* Branch Picker for Mapping */}
          <div className="bg-white p-4 rounded-[6px] border border-[#D9DEDA] shadow-xs">
            <label htmlFor="hub-mapping-picker" className="block text-xs font-semibold text-[#16324F] mb-1.5">
              Select Branch to manage assignments
            </label>
            <select
              id="hub-mapping-picker"
              value={selectedMappingHubId}
              onChange={(e) => setSelectedMappingHubId(e.target.value)}
              className="input-ledger max-w-md w-full text-sm font-semibold"
            >
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Assigned Staff */}
            <div className="bg-white rounded-[6px] border border-[#D9DEDA] shadow-xs p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#16324F]">
                  Assigned Branch Staff & Leads
                </h3>
                <p className="text-xs text-[#5B6670]">
                  Staff who can submit daily reports for this branch
                </p>
              </div>

              {/* Add staff control */}
              <div className="flex gap-2">
                <select
                  value={staffToAdd}
                  onChange={(e) => setStaffToAdd(e.target.value)}
                  className="input-ledger flex-1 text-xs"
                >
                  <option value="">Select staff member to add…</option>
                  {availableStaffCandidates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.role === 'hub_lead' ? 'Lead' : 'Staff'})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAssignStaff}
                  disabled={!staffToAdd}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Staff list */}
              <div className="border border-[#D9DEDA] rounded-[6px] divide-y divide-[#D9DEDA]">
                {hubStaffProfiles.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#5B6670]">
                    No staff currently assigned to this branch.
                  </div>
                ) : (
                  hubStaffProfiles.map((st) => (
                    <div
                      key={st.id}
                      className="p-2.5 flex items-center justify-between text-xs hover:bg-[#F9FAF8]"
                    >
                      <div>
                        <div className="font-semibold text-[#1D2329]">
                          {st.full_name}
                        </div>
                        <div className="text-[11px] text-[#5B6670]">
                          {st.email} · {st.role}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnassignStaff(st.id)}
                        className="p-1.5 text-[#B42318] hover:bg-[#FEF3F2] rounded-[4px]"
                        title="Remove staff assignment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. Assigned Area Managers */}
            <div className="bg-white rounded-[6px] border border-[#D9DEDA] shadow-xs p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#16324F]">
                  Assigned Area Managers
                </h3>
                <p className="text-xs text-[#5B6670]">
                  Managers whose dashboard includes this branch
                </p>
              </div>

              {/* Add manager control */}
              <div className="flex gap-2">
                <select
                  value={managerToAdd}
                  onChange={(e) => setManagerToAdd(e.target.value)}
                  className="input-ledger flex-1 text-xs"
                >
                  <option value="">Select manager to assign…</option>
                  {availableManagerCandidates.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.email})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAssignManager}
                  disabled={!managerToAdd}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign</span>
                </button>
              </div>

              {/* Managers list */}
              <div className="border border-[#D9DEDA] rounded-[6px] divide-y divide-[#D9DEDA]">
                {hubManagerProfiles.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#5B6670]">
                    No area managers assigned to this branch.
                  </div>
                ) : (
                  hubManagerProfiles.map((mgr) => (
                    <div
                      key={mgr.id}
                      className="p-2.5 flex items-center justify-between text-xs hover:bg-[#F9FAF8]"
                    >
                      <div>
                        <div className="font-semibold text-[#1D2329]">
                          {mgr.full_name}
                        </div>
                        <div className="text-[11px] text-[#5B6670]">
                          {mgr.email}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnassignManager(mgr.id)}
                        className="p-1.5 text-[#B42318] hover:bg-[#FEF3F2] rounded-[4px]"
                        title="Remove manager assignment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
