import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  getMyHubs, listMedicines, addMedicine, getHubStock,
  recordPurchase, recordIssue, listRecentPurchases, listRecentIssues,
} from '../api/endpoints';
import type { Hub, Medicine, HubStockRow, StockPurchase, StockIssue } from '../types/api';
import { formatNum, formatINR } from '../lib/format';
import {
  Package, Plus, ArrowDownCircle, ArrowUpCircle, Loader2, AlertCircle,
} from 'lucide-react';

export function InventoryScreen() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const canPurchase = profile?.role === 'purchase_manager' || profile?.role === 'super_admin';
  const canIssue =
    profile?.role === 'field_staff' ||
    profile?.role === 'purchase_manager' ||
    profile?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [stock, setStock] = useState<HubStockRow[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<StockPurchase[]>([]);
  const [recentIssues, setRecentIssues] = useState<StockIssue[]>([]);

  // Add-medicine form (purchase_manager / super_admin)
  const [showAddMedicine, setShowAddMedicine] = useState(false);
  const [mName, setMName] = useState('');
  const [mUnit, setMUnit] = useState('unit');
  const [mPrice, setMPrice] = useState('');
  const [mSaving, setMSaving] = useState(false);

  // Record-purchase form
  const [pHub, setPHub] = useState('');
  const [pMedicine, setPMedicine] = useState('');
  const [pQty, setPQty] = useState('');
  const [pUnitPrice, setPUnitPrice] = useState('');
  const [pInvoice, setPInvoice] = useState('');
  const [pSaving, setPSaving] = useState(false);

  // Issue-stock form
  const [iHub, setIHub] = useState('');
  const [iMedicine, setIMedicine] = useState('');
  const [iQty, setIQty] = useState('');
  const [iNotes, setINotes] = useState('');
  const [iSaving, setISaving] = useState(false);

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const myHubs = await getMyHubs();
      setHubs(myHubs);
      const hubIds = myHubs.map((h) => h.id);

      const [meds, stockRows, purchases, issues] = await Promise.all([
        listMedicines(),
        getHubStock(hubIds),
        canPurchase ? listRecentPurchases(hubIds, 10) : Promise.resolve([]),
        listRecentIssues(hubIds, 10),
      ]);
      setMedicines(meds);
      setStock(stockRows);
      setRecentPurchases(purchases);
      setRecentIssues(issues);
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default the single-hub case (typically field_staff) so the form doesn't
  // start on an empty selector.
  useEffect(() => {
    if (hubs.length === 1) {
      setPHub((v) => v || hubs[0].id);
      setIHub((v) => v || hubs[0].id);
    }
  }, [hubs]);

  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name || id;
  const medicineName = (id: string) => medicines.find((m) => m.id === id)?.name || id;
  const medicineUnit = (id: string) => medicines.find((m) => m.id === id)?.unit || '';

  const stockRowsSorted = useMemo(
    () =>
      [...stock]
        .filter((r) => r.quantity !== 0 || medicines.length > 0)
        .sort(
          (a, b) =>
            hubName(a.hub_id).localeCompare(hubName(b.hub_id)) ||
            medicineName(a.medicine_id).localeCompare(medicineName(b.medicine_id))
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stock, hubs, medicines]
  );

  async function handleAddMedicine(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(mPrice);
    if (!mName.trim()) {
      toast('Enter a medicine name.', 'error');
      return;
    }
    setMSaving(true);
    try {
      await addMedicine(mName.trim(), mUnit.trim() || 'unit', Number.isFinite(price) ? price : 0);
      toast(`${mName.trim()} added to the catalogue.`, 'success');
      setMName('');
      setMPrice('');
      setShowAddMedicine(false);
      await loadAll();
    } catch (err: any) {
      toast(err.message || 'Could not add medicine.', 'error');
    } finally {
      setMSaving(false);
    }
  }

  async function handlePurchase(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(pQty);
    if (!pHub || !pMedicine || !(qty > 0)) {
      toast('Choose a hub, medicine, and a quantity greater than 0.', 'error');
      return;
    }
    setPSaving(true);
    try {
      await recordPurchase({
        hub_id: pHub,
        medicine_id: pMedicine,
        quantity: qty,
        unit_price: Number(pUnitPrice) || 0,
        invoice_ref: pInvoice.trim() || null,
      });
      toast(`Recorded ${formatNum(qty)} ${medicineUnit(pMedicine)} of ${medicineName(pMedicine)} into ${hubName(pHub)}.`, 'success');
      setPQty('');
      setPInvoice('');
      await loadAll();
    } catch (err: any) {
      toast(err.message || 'Could not record purchase.', 'error');
    } finally {
      setPSaving(false);
    }
  }

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(iQty);
    if (!iHub || !iMedicine || !(qty > 0)) {
      toast('Choose a hub, medicine, and a quantity greater than 0.', 'error');
      return;
    }
    setISaving(true);
    try {
      await recordIssue({
        hub_id: iHub,
        medicine_id: iMedicine,
        quantity: qty,
        notes: iNotes.trim() || null,
      });
      toast(`Issued ${formatNum(qty)} ${medicineUnit(iMedicine)} of ${medicineName(iMedicine)}.`, 'success');
      setIQty('');
      setINotes('');
      await loadAll();
    } catch (err: any) {
      toast(err.message || 'Could not issue stock.', 'error');
    } finally {
      setISaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-[#5B6670]">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-sm">Loading inventory…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#16324F] flex items-center gap-2">
          <Package className="w-5 h-5" />
          Medicine Inventory
        </h1>
        <p className="text-sm text-[#5B6670] mt-0.5">
          {canPurchase
            ? 'Purchase stock into a branch, or issue it out at the point of use.'
            : 'Issue stock as it is used, and see what your branch has on hand.'}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-[#FEF3F2] border border-[#FECDCA] rounded-[6px] text-sm text-[#B42318] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {hubs.length === 0 ? (
        <div className="bg-white rounded-[6px] border border-[#D9DEDA] shadow-sm p-6 text-sm text-[#5B6670]">
          No branches are mapped to your account yet — ask a Super Admin to assign one before recording inventory.
        </div>
      ) : (
        <>
          {canPurchase && (
            <div className="bg-white rounded-[6px] border border-[#D9DEDA] shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[#16324F] flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-[#1F7A4D]" />
                  Record purchase
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAddMedicine((v) => !v)}
                  className="text-xs font-medium text-[#16324F] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New medicine
                </button>
              </div>

              {showAddMedicine && (
                <form
                  onSubmit={handleAddMedicine}
                  className="mb-4 p-3 bg-[#F7F8F6] border border-[#D9DEDA] rounded-[6px] grid grid-cols-1 sm:grid-cols-4 gap-2"
                >
                  <input
                    className="input-ledger sm:col-span-2"
                    placeholder="Medicine name"
                    value={mName}
                    onChange={(e) => setMName(e.target.value)}
                  />
                  <input
                    className="input-ledger"
                    placeholder="Unit (strip, box…)"
                    value={mUnit}
                    onChange={(e) => setMUnit(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <input
                      className="input-ledger flex-1"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Default price"
                      value={mPrice}
                      onChange={(e) => setMPrice(e.target.value)}
                    />
                    <button type="submit" disabled={mSaving} className="btn-primary px-4 shrink-0">
                      {mSaving ? '…' : 'Add'}
                    </button>
                  </div>
                </form>
              )}

              {medicines.length === 0 ? (
                <p className="text-sm text-[#5B6670]">
                  No medicines in the catalogue yet — add one above before recording a purchase.
                </p>
              ) : (
                <form onSubmit={handlePurchase} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <select className="input-ledger" value={pHub} onChange={(e) => setPHub(e.target.value)}>
                    <option value="">Branch…</option>
                    {hubs.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                  <select
                    className="input-ledger lg:col-span-2"
                    value={pMedicine}
                    onChange={(e) => {
                      setPMedicine(e.target.value);
                      const m = medicines.find((x) => x.id === e.target.value);
                      if (m) setPUnitPrice(String(m.unit_price));
                    }}
                  >
                    <option value="">Medicine…</option>
                    {medicines.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                    ))}
                  </select>
                  <input
                    className="input-ledger"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Quantity"
                    value={pQty}
                    onChange={(e) => setPQty(e.target.value)}
                  />
                  <input
                    className="input-ledger"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit price"
                    value={pUnitPrice}
                    onChange={(e) => setPUnitPrice(e.target.value)}
                  />
                  <input
                    className="input-ledger sm:col-span-2 lg:col-span-4"
                    placeholder="Invoice ref (optional)"
                    value={pInvoice}
                    onChange={(e) => setPInvoice(e.target.value)}
                  />
                  <button type="submit" disabled={pSaving} className="btn-primary">
                    {pSaving ? 'Saving…' : 'Record purchase'}
                  </button>
                </form>
              )}
            </div>
          )}

          {canIssue && (
            <div className="bg-white rounded-[6px] border border-[#D9DEDA] shadow-sm p-5">
              <h2 className="text-sm font-semibold text-[#16324F] flex items-center gap-2 mb-4">
                <ArrowUpCircle className="w-4 h-4 text-[#B7791F]" />
                Issue stock
              </h2>
              {medicines.length === 0 ? (
                <p className="text-sm text-[#5B6670]">Nothing in the catalogue yet to issue.</p>
              ) : (
                <form onSubmit={handleIssue} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <select className="input-ledger" value={iHub} onChange={(e) => setIHub(e.target.value)}>
                    <option value="">Branch…</option>
                    {hubs.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                  <select
                    className="input-ledger lg:col-span-2"
                    value={iMedicine}
                    onChange={(e) => setIMedicine(e.target.value)}
                  >
                    <option value="">Medicine…</option>
                    {medicines.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                    ))}
                  </select>
                  <input
                    className="input-ledger"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Quantity"
                    value={iQty}
                    onChange={(e) => setIQty(e.target.value)}
                  />
                  <input
                    className="input-ledger"
                    placeholder="Note (optional)"
                    value={iNotes}
                    onChange={(e) => setINotes(e.target.value)}
                  />
                  <button type="submit" disabled={iSaving} className="btn-secondary sm:col-span-2 lg:col-span-5">
                    {iSaving ? 'Saving…' : 'Issue stock'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Current stock on hand */}
          <div className="bg-white rounded-[6px] border border-[#D9DEDA] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#D9DEDA]">
              <h2 className="text-sm font-semibold text-[#16324F]">Stock on hand</h2>
            </div>
            {stockRowsSorted.length === 0 ? (
              <p className="p-5 text-sm text-[#5B6670]">No stock recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F7F8F6] text-left text-xs text-[#5B6670] uppercase tracking-wide">
                      <th className="px-5 py-2.5 font-medium">Branch</th>
                      <th className="px-5 py-2.5 font-medium">Medicine</th>
                      <th className="px-5 py-2.5 font-medium text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF0ED]">
                    {stockRowsSorted.map((row) => (
                      <tr key={`${row.hub_id}-${row.medicine_id}`}>
                        <td className="px-5 py-2.5 text-[#1D2329]">{hubName(row.hub_id)}</td>
                        <td className="px-5 py-2.5 text-[#1D2329]">{medicineName(row.medicine_id)}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {formatNum(row.quantity)} {medicineUnit(row.medicine_id)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {canPurchase && (
              <div className="bg-white rounded-[6px] border border-[#D9DEDA] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#D9DEDA]">
                  <h2 className="text-sm font-semibold text-[#16324F]">Recent purchases</h2>
                </div>
                {recentPurchases.length === 0 ? (
                  <p className="p-5 text-sm text-[#5B6670]">None yet.</p>
                ) : (
                  <ul className="divide-y divide-[#EEF0ED]">
                    {recentPurchases.map((p) => (
                      <li key={p.id} className="px-5 py-3 text-sm flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[#1D2329]">
                            {formatNum(p.quantity)} {medicineUnit(p.medicine_id)} · {medicineName(p.medicine_id)}
                          </p>
                          <p className="text-xs text-[#5B6670]">{hubName(p.hub_id)} · {p.purchase_date}</p>
                        </div>
                        <span className="tabular-nums text-[#1D2329]">{formatINR(p.total_cost)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="bg-white rounded-[6px] border border-[#D9DEDA] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#D9DEDA]">
                <h2 className="text-sm font-semibold text-[#16324F]">Recent issues</h2>
              </div>
              {recentIssues.length === 0 ? (
                <p className="p-5 text-sm text-[#5B6670]">None yet.</p>
              ) : (
                <ul className="divide-y divide-[#EEF0ED]">
                  {recentIssues.map((i) => (
                    <li key={i.id} className="px-5 py-3 text-sm">
                      <p className="text-[#1D2329]">
                        {formatNum(i.quantity)} {medicineUnit(i.medicine_id)} · {medicineName(i.medicine_id)}
                      </p>
                      <p className="text-xs text-[#5B6670]">
                        {hubName(i.hub_id)} · {i.issue_date}{i.notes ? ` · ${i.notes}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
