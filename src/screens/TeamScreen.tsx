import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../components/Toast';
import { getMyHubs, listMyTeam, adminCreateUser, unassignTeamMember } from '../api/endpoints';
import type { Hub, TeamMember } from '../types/api';
import { Users, UserPlus, Copy, X, Trash2, Building2 } from 'lucide-react';

export function TeamScreen() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hubId, setHubId] = useState('');
  const [saving, setSaving] = useState(false);
  const [newLink, setNewLink] = useState<{ name: string; link: string | null } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadAll() {
    try {
      setLoading(true);
      const [myHubs, myTeam] = await Promise.all([getMyHubs(), listMyTeam()]);
      setHubs(myHubs);
      setTeam(myTeam);
      if (myHubs.length === 1) setHubId((v) => v || myHubs[0].id);
    } catch (err: any) {
      toast(err.message || 'Failed to load your team.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teamByHub = useMemo(() => {
    const map = new Map<string, TeamMember[]>();
    for (const t of team) {
      const list = map.get(t.hub_id) || [];
      list.push(t);
      map.set(t.hub_id, list);
    }
    return map;
  }, [team]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !hubId) {
      toast('Enter a name, email, and pick a branch.', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await adminCreateUser({
        full_name: name.trim(),
        email: email.trim(),
        role: 'staff',
        phone: phone.trim() || null,
        hub_id: hubId,
      });
      toast(`${name.trim()} added.`, 'success');
      setNewLink({ name: name.trim(), link: result.setPasswordLink });
      setName('');
      setEmail('');
      setPhone('');
      setShowAdd(false);
      await loadAll();
    } catch (err: any) {
      toast(err.message || 'Could not add this person.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (member: TeamMember) => {
    setRemovingId(member.staff_id);
    try {
      await unassignTeamMember(member.staff_id, member.hub_id);
      toast(`${member.full_name} removed from ${member.hub_name}.`, 'success');
      setTeam((prev) => prev.filter((t) => !(t.staff_id === member.staff_id && t.hub_id === member.hub_id)));
    } catch (err: any) {
      toast(err.message || 'Could not remove this person.', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-[#5B6670]">
        <div className="w-7 h-7 border-2 border-[#16324F] border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-sm">Loading your team…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#16324F] flex items-center gap-2">
          <Users className="w-5 h-5" />
          My Team
        </h1>
        <p className="text-sm text-[#5B6670] mt-0.5">
          Add Branch Staff to the branches you manage, and see who's already assigned.
        </p>
      </div>

      {hubs.length === 0 ? (
        <div className="bg-white rounded-[6px] border border-[#D9DEDA] shadow-sm p-6 text-sm text-[#5B6670]">
          No branches are mapped to you yet — ask a Super Admin to assign one.
        </div>
      ) : (
        <>
          {newLink && (
            <div className="bg-[#ECFDF3] border border-[#ABEFC6] p-3.5 rounded-[6px] text-xs text-[#1F7A4D] space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="leading-relaxed font-medium">
                  {newLink.name}'s account is ready. Send them this link so they can set their own password:
                </p>
                <button type="button" onClick={() => setNewLink(null)} className="p-1 hover:opacity-70 shrink-0" aria-label="Dismiss">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {newLink.link ? (
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={newLink.link}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="input-ledger flex-1 text-[11px] font-mono bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(newLink.link || '');
                      toast('Link copied', 'success');
                    }}
                    className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1 shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                </div>
              ) : (
                <p className="text-[11px]">The account was created, but the link couldn't be generated — ask your Super Admin to resend one.</p>
              )}
            </div>
          )}

          <div className="bg-white rounded-[6px] border border-[#D9DEDA] shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div>
                <h2 className="text-sm font-semibold text-[#16324F]">Add Branch Staff</h2>
                <p className="text-xs text-[#5B6670]">Only for the branches mapped to you.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdd((v) => !v)}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {showAdd ? 'Cancel' : 'Add staff'}
              </button>
            </div>

            {showAdd && (
              <form onSubmit={handleAddStaff} className="mt-3 pt-3 border-t border-[#D9DEDA] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <input className="input-ledger" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                <input className="input-ledger" type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="input-ledger" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <select className="input-ledger" value={hubId} onChange={(e) => setHubId(e.target.value)}>
                  <option value="">Branch…</option>
                  {hubs.map((h) => (
                    <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
                  ))}
                </select>
                <button type="submit" disabled={saving} className="btn-primary text-xs lg:col-span-4">
                  {saving ? 'Creating…' : 'Create account'}
                </button>
              </form>
            )}
          </div>

          <div className="space-y-4">
            {hubs.map((hub) => {
              const members = teamByHub.get(hub.id) || [];
              return (
                <div key={hub.id} className="bg-white rounded-[6px] border border-[#D9DEDA] shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#D9DEDA] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#16324F]" />
                    <h2 className="text-sm font-semibold text-[#16324F]">{hub.name}</h2>
                    <span className="text-[11px] text-[#5B6670]">({hub.code})</span>
                  </div>
                  {members.length === 0 ? (
                    <p className="p-5 text-sm text-[#5B6670]">No staff assigned yet.</p>
                  ) : (
                    <ul className="divide-y divide-[#EEF0ED]">
                      {members.map((m) => (
                        <li key={m.staff_id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                          <div>
                            <p className="text-[#1D2329] font-medium">{m.full_name}</p>
                            <p className="text-xs text-[#5B6670]">{m.email} · {m.role}{!m.is_active ? ' · disabled' : ''}</p>
                          </div>
                          <button
                            type="button"
                            disabled={removingId === m.staff_id}
                            onClick={() => handleRemove(m)}
                            title="Remove from this branch"
                            className="p-1.5 text-[#B42318] hover:bg-[#FEF3F2] rounded-[4px] disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
