import { useEffect, useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, CheckCircle, CreditCard, Search, ChevronDown, ChevronUp, Phone, User, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';

type ViewMode = 'by-vehicle' | 'by-session';

const FREQ_COLORS: Record<string, string> = {
  weekly: 'bg-blue-100 text-blue-700',
  monthly: 'bg-purple-100 text-purple-700',
  custom: 'bg-orange-100 text-orange-700',
  'on-demand': 'bg-slate-100 text-slate-600',
};
const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom',
  'on-demand': 'On Demand',
};

export default function Settlement() {
  const { toast } = useToast();

  const [sessions, setSessions] = useState<any[]>([]);
  const [vehicleMeta, setVehicleMeta] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('by-vehicle');
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Settle modal state
  const [showModal, setShowModal] = useState(false);
  const [modalVehicle, setModalVehicle] = useState<any>(null); // for per-vehicle settle
  const [settling, setSettling] = useState(false);
  const [settleForm, setSettleForm] = useState({
    amountPaid: '',
    settlementMethod: 'Cash',
    settlementDate: new Date().toISOString().slice(0, 10),
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/sessions?paymentStatus=Pending&limit=500', { headers }).then(r => r.json()),
      fetch('/api/sessions?paymentStatus=Partially+Paid&limit=500', { headers }).then(r => r.json()),
      fetch('/api/vehicles', { headers }).then(r => r.json()),
    ]).then(([pendingData, partialData, vehicleData]) => {
      // Build vehicle metadata map (from registered vehicles)
      const metaMap = new Map<string, any>();
      const allVehicles = [
        ...(vehicleData.fromSessions || []),
        ...(vehicleData.ownerRegistered || []),
      ];
      allVehicles.forEach((v: any) => {
        if (!metaMap.has(v.vehicleNo)) metaMap.set(v.vehicleNo, v);
      });
      setVehicleMeta(metaMap);

      // Merge and filter sessions - ONLY UDARO SESSIONS
      const all = [
        ...(pendingData.sessions || []),
        ...(partialData.sessions || []),
      ];
      const withDues = all.filter(s => {
        const chargeAmount = Number(s.chargeAmount) || 0;
        const creditPaid = Number(s.creditPaid) || 0;
        const stored = Number(s.outstanding) || 0;
        const actual = stored > 0 ? stored : (chargeAmount - creditPaid);
        s.outstanding = actual;
        // ONLY show Udaro sessions in Settlement page
        return s.isUdaro === true && chargeAmount > 0 && actual > 0;
      });
      withDues.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setSessions(withDues);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    if (!search) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(s => {
      const meta = vehicleMeta.get(s.vehicleNo);
      return s.vehicleNo?.toLowerCase().includes(q) ||
        s.companyBrand?.toLowerCase().includes(q) ||
        meta?.ownerName?.toLowerCase().includes(q) ||
        meta?.ownerContact?.includes(q);
    });
  }, [search, sessions, vehicleMeta]);

  // Group by vehicle with owner info merged
  const vehicleGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    filtered.forEach(s => {
      if (!map.has(s.vehicleNo)) map.set(s.vehicleNo, []);
      map.get(s.vehicleNo)!.push(s);
    });
    return Array.from(map.entries()).map(([vehicleNo, sess]) => {
      const meta = vehicleMeta.get(vehicleNo) || {};
      const totalOutstanding = sess.reduce((s, x) => s + (Number(x.outstanding) || 0), 0);
      const totalAmount = sess.reduce((s, x) => s + (Number(x.chargeAmount) || 0), 0);
      const totalPaid = sess.reduce((s, x) => s + (Number(x.creditPaid) || 0), 0);
      return {
        vehicleNo,
        ownerName: meta.ownerName || null,
        ownerContact: meta.ownerContact || null,
        companyBrand: meta.companyBrand || sess.find((s: any) => s.companyBrand)?.companyBrand || null,
        settlementFrequency: meta.settlementFrequency || null,
        sessions: sess,
        totalOutstanding,
        totalAmount,
        totalPaid,
        count: sess.length,
        oldestDate: sess[0]?.date,
      };
    }).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [filtered, vehicleMeta]);

  const totalOutstanding = useMemo(() => sessions.reduce((s, x) => s + (Number(x.outstanding) || 0), 0), [sessions]);
  const totalVehicles = useMemo(() => new Set(sessions.map(s => s.vehicleNo)).size, [sessions]);
  const selectedOutstanding = useMemo(() =>
    sessions.filter(s => selectedIds.has(s.id)).reduce((s, x) => s + (Number(x.outstanding) || 0), 0),
    [sessions, selectedIds]
  );

  const toggleVehicleSelect = (vehicleNo: string) => {
    const vs = sessions.filter(s => s.vehicleNo === vehicleNo);
    const allSel = vs.every(s => selectedIds.has(s.id));
    const next = new Set(selectedIds);
    vs.forEach(s => allSel ? next.delete(s.id) : next.add(s.id));
    setSelectedIds(next);
  };

  const toggleSessionSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const toggleExpand = (vehicleNo: string) => {
    const next = new Set(expandedVehicles);
    next.has(vehicleNo) ? next.delete(vehicleNo) : next.add(vehicleNo);
    setExpandedVehicles(next);
  };

  // Open settle modal for a specific vehicle
  const openVehicleSettle = (group: any) => {
    const next = new Set(selectedIds);
    group.sessions.forEach((s: any) => next.add(s.id));
    setSelectedIds(next);
    setModalVehicle(group);
    setSettleForm({
      amountPaid: group.totalOutstanding.toFixed(2),
      settlementMethod: 'Cash',
      settlementDate: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  // Open settle modal for selected sessions (multi-vehicle)
  const openBulkSettle = () => {
    if (selectedIds.size === 0) {
      toast({ title: 'No sessions selected', description: 'Select at least one session to settle.', variant: 'destructive' });
      return;
    }
    setModalVehicle(null);
    setSettleForm({
      amountPaid: selectedOutstanding.toFixed(2),
      settlementMethod: 'Cash',
      settlementDate: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettling(true);
    try {
      const res = await fetch('/api/sessions/settle', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionIds: Array.from(selectedIds),
          settlementMethod: settleForm.settlementMethod,
          settlementDate: settleForm.settlementDate,
          amountPaid: parseFloat(settleForm.amountPaid),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'Settlement Successful',
          description: `Rs. ${parseFloat(settleForm.amountPaid).toLocaleString()} settled across ${data.sessionsSettled} session(s).`,
        });
        setShowModal(false);
        setModalVehicle(null);
        setSelectedIds(new Set());
        loadData();
      } else {
        toast({ title: 'Settlement Failed', description: data.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSettling(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'Partially Paid') return <Badge variant="info" className="text-xs">Partial</Badge>;
    return <Badge variant="warning" className="text-xs">Pending</Badge>;
  };

  // Sessions currently in modal scope
  const modalSessions = useMemo(() => sessions.filter(s => selectedIds.has(s.id)), [sessions, selectedIds]);
  const modalOutstanding = useMemo(() => modalSessions.reduce((s, x) => s + (Number(x.outstanding) || 0), 0), [modalSessions]);
  const modalVehicleCount = useMemo(() => new Set(modalSessions.map(s => s.vehicleNo)).size, [modalSessions]);

  return (
    <Layout activeTab="settlement" title="Settlement">
      <Toaster />

      {/* Settle Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
              <div>
                <h3 className="text-lg font-bold">
                  {modalVehicle ? `Settle — ${modalVehicle.vehicleNo}` : 'Bulk Settlement'}
                </h3>
                <p className="text-sm text-green-100">
                  {modalVehicle?.ownerName
                    ? `${modalVehicle.ownerName}${modalVehicle.ownerContact ? ` · ${modalVehicle.ownerContact}` : ''}`
                    : `${selectedIds.size} session(s) across ${modalVehicleCount} vehicle(s)`
                  }
                </p>
              </div>
              <button onClick={() => { setShowModal(false); setModalVehicle(null); }} className="text-white/80 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSettle} className="p-6 space-y-4">
              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2">
                {modalVehicle && (
                  <div className="flex justify-between text-sm pb-2 border-b border-slate-200 mb-2">
                    <span className="text-slate-500">Settlement Frequency</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FREQ_COLORS[modalVehicle.settlementFrequency] || 'bg-slate-100 text-slate-600'}`}>
                      {FREQ_LABELS[modalVehicle.settlementFrequency] || 'Not set'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Sessions</span>
                  <span className="font-medium">{selectedIds.size}</span>
                </div>
                {modalVehicle && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Period</span>
                    <span className="font-medium text-slate-700">
                      {modalVehicle.sessions[0] ? String(modalVehicle.sessions[0].date).slice(0, 10) : '—'}
                      {' → '}
                      {modalVehicle.sessions[modalVehicle.sessions.length - 1]
                        ? String(modalVehicle.sessions[modalVehicle.sessions.length - 1].date).slice(0, 10)
                        : '—'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total Billed</span>
                  <span className="font-medium">Rs. {(modalVehicle?.totalAmount ?? modalSessions.reduce((s, x) => s + Number(x.chargeAmount), 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-200 mt-1">
                  <span className="text-red-600">Outstanding</span>
                  <span className="text-red-600">Rs. {modalOutstanding.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Amount Paid (Rs.) *</Label>
                <Input
                  type="number" step="0.01" min="0.01"
                  value={settleForm.amountPaid}
                  onChange={e => setSettleForm({ ...settleForm, amountPaid: e.target.value })}
                  placeholder="Enter amount" required
                  className="h-10 text-lg font-semibold"
                />
                <p className="text-xs text-slate-400">Partial amount distributes oldest-first.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Settlement Method *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['Cash', 'Bank/QR'].map(m => (
                    <button key={m} type="button"
                      onClick={() => setSettleForm({ ...settleForm, settlementMethod: m })}
                      className={`py-2 rounded-md border text-sm font-medium transition-colors ${
                        settleForm.settlementMethod === m
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Settlement Date *</Label>
                <Input type="date" value={settleForm.settlementDate}
                  onChange={e => setSettleForm({ ...settleForm, settlementDate: e.target.value })}
                  required className="h-9" />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowModal(false); setModalVehicle(null); }} disabled={settling} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={settling} className="flex-1 bg-green-600 hover:bg-green-700">
                  {settling
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                    : <><CheckCircle className="h-4 w-4 mr-2" />Confirm Settlement</>
                  }
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Settlement Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Udaro (credit arrangements) - Only shows sessions marked as Settlement</p>
        </div>
        <Button onClick={openBulkSettle} disabled={selectedIds.size === 0} className="bg-green-600 hover:bg-green-700 gap-2">
          <CreditCard className="h-4 w-4" />
          Settle Selected
          {selectedIds.size > 0 && (
            <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full ml-1">{selectedIds.size}</span>
          )}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Total Outstanding</p>
          <p className="text-2xl font-bold text-red-700 mt-1">Rs. {totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Vehicles with Dues</p>
          <p className="text-2xl font-bold text-orange-700 mt-1">{totalVehicles}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-xs text-yellow-700 font-medium uppercase tracking-wide">Pending Sessions</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{sessions.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Selected to Settle</p>
          <p className="text-2xl font-bold text-green-700 mt-1">
            Rs. {selectedOutstanding > 0 ? selectedOutstanding.toLocaleString() : '0'}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search vehicle, owner, phone..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex rounded-md border border-slate-200 overflow-hidden">
          {(['by-vehicle', 'by-session'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === m ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {m === 'by-vehicle' ? 'By Vehicle' : 'By Session'}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set(filtered.map(s => s.id)))} className="h-9 text-xs">
          Select All
        </Button>
        {selectedIds.size > 0 && (
          <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())} className="h-9 text-xs text-red-600 hover:text-red-700">
            Clear ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* BY VEHICLE VIEW */}
      {viewMode === 'by-vehicle' && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" /></div>
          ) : vehicleGroups.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="py-20 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-3" />
                <p className="text-slate-500 font-medium">No Udaro settlements to show</p>
                <p className="text-slate-400 text-sm mt-1">Either all settlements are paid, or no sessions are marked as Udaro.</p>
                <p className="text-slate-400 text-sm mt-2">💡 To create an Udaro session, check "Settlement (Udaro)" when creating a session.</p>
              </CardContent>
            </Card>
          ) : vehicleGroups.map(group => {
            const allSelected = group.sessions.every((s: any) => selectedIds.has(s.id));
            const someSelected = group.sessions.some((s: any) => selectedIds.has(s.id));
            const isExpanded = expandedVehicles.has(group.vehicleNo);

            return (
              <Card key={group.vehicleNo} className={`border transition-all ${someSelected ? 'border-green-300 shadow-sm' : 'border-slate-200'} bg-white`}>
                <CardContent className="p-0">
                  {/* Vehicle header card */}
                  <div className="flex items-start gap-4 px-4 py-4">
                    {/* Checkbox */}
                    <div className="mt-1">
                      <input type="checkbox" checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                        onChange={() => toggleVehicleSelect(group.vehicleNo)}
                        className="h-4 w-4 rounded border-slate-300 accent-green-600 cursor-pointer" />
                    </div>

                    {/* Owner info block */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-base">{group.vehicleNo}</span>
                        {group.companyBrand && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{group.companyBrand}</span>
                        )}
                        {group.settlementFrequency && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${FREQ_COLORS[group.settlementFrequency] || 'bg-slate-100 text-slate-600'}`}>
                            <Calendar className="h-3 w-3" />
                            {FREQ_LABELS[group.settlementFrequency] || group.settlementFrequency}
                          </span>
                        )}
                        <Badge variant="default" className="text-xs">{group.count} session{group.count > 1 ? 's' : ''}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                        {group.ownerName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />{group.ownerName}
                          </span>
                        )}
                        {group.ownerContact && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />{group.ownerContact}
                          </span>
                        )}
                        {group.oldestDate && (
                          <span className="text-slate-400">
                            Since {String(group.oldestDate).slice(0, 10)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount columns */}
                    <div className="hidden sm:flex items-center gap-5 text-sm shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Total Billed</p>
                        <p className="font-medium text-slate-700">Rs. {group.totalAmount.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Paid</p>
                        <p className="font-medium text-green-700">Rs. {group.totalPaid.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Outstanding</p>
                        <p className="text-lg font-bold text-red-600">Rs. {group.totalOutstanding.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" onClick={() => openVehicleSettle(group)}
                        className="bg-green-600 hover:bg-green-700 text-xs h-8 px-3">
                        Settle
                      </Button>
                      <button onClick={() => toggleExpand(group.vehicleNo)}
                        className="text-slate-400 hover:text-slate-600 p-1">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded sessions */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase">
                            <th className="w-10 px-4 py-2"></th>
                            <th className="px-4 py-2 text-left">Date</th>
                            <th className="px-4 py-2 text-left">Charger</th>
                            <th className="px-4 py-2 text-right">Charge Amt</th>
                            <th className="px-4 py-2 text-right">Paid</th>
                            <th className="px-4 py-2 text-right">Outstanding</th>
                            <th className="px-4 py-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.sessions.map((s: any) => (
                            <tr key={s.id} className={`border-t border-slate-100 ${selectedIds.has(s.id) ? 'bg-green-50' : 'hover:bg-slate-50'}`}>
                              <td className="px-4 py-2.5 text-center">
                                <input type="checkbox" checked={selectedIds.has(s.id)}
                                  onChange={() => toggleSessionSelect(s.id)}
                                  className="h-4 w-4 rounded border-slate-300 accent-green-600 cursor-pointer" />
                              </td>
                              <td className="px-4 py-2.5 text-sm text-slate-700 whitespace-nowrap">{String(s.date).slice(0, 10)}</td>
                              <td className="px-4 py-2.5 text-sm">
                                <Badge variant="info" className="text-xs">{s.chargerType}</Badge>
                              </td>
                              <td className="px-4 py-2.5 text-sm text-right font-medium text-slate-700">Rs. {Number(s.chargeAmount).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-sm text-right text-green-700">
                                {Number(s.creditPaid) > 0 ? `Rs. ${Number(s.creditPaid).toLocaleString()}` : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-right font-bold text-red-600">Rs. {Number(s.outstanding).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-center">{statusBadge(s.paymentStatus)}</td>
                            </tr>
                          ))}
                          {/* Sub-total */}
                          <tr className="border-t border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                            <td colSpan={3} className="px-4 py-2">Subtotal ({group.count} sessions)</td>
                            <td className="px-4 py-2 text-right">Rs. {group.totalAmount.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-green-700">Rs. {group.totalPaid.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-red-600">Rs. {group.totalOutstanding.toLocaleString()}</td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* BY SESSION VIEW */}
      {viewMode === 'by-session' && (
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="w-10 px-4 py-2.5"></th>
                    {['Date', 'Vehicle', 'Owner', 'Frequency', 'Charger', 'Charge Amt', 'Paid', 'Outstanding', 'Status'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={10} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-20 text-center">
                        <CheckCircle className="h-10 w-10 mx-auto text-green-400 mb-3" />
                        <p className="text-slate-500">No Udaro settlements found</p>
                        <p className="text-slate-400 text-xs mt-1">Sessions must be marked as "Settlement (Udaro)" to appear here</p>
                      </td>
                    </tr>
                  ) : filtered.map(s => {
                    const meta = vehicleMeta.get(s.vehicleNo) || {};
                    return (
                      <tr key={s.id}
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${selectedIds.has(s.id) ? 'bg-green-50' : 'hover:bg-slate-50'}`}
                        onClick={() => toggleSessionSelect(s.id)}>
                        <td className="px-4 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(s.id)}
                            onChange={() => toggleSessionSelect(s.id)}
                            className="h-4 w-4 rounded border-slate-300 accent-green-600 cursor-pointer" />
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-600 whitespace-nowrap">{String(s.date).slice(0, 10)}</td>
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-bold text-blue-700">{s.vehicleNo}</div>
                          {meta.companyBrand && <div className="text-xs text-slate-400">{meta.companyBrand}</div>}
                        </td>
                        <td className="px-4 py-2.5">
                          {meta.ownerName && <div className="text-sm text-slate-700">{meta.ownerName}</div>}
                          {meta.ownerContact && <div className="text-xs text-slate-400">{meta.ownerContact}</div>}
                        </td>
                        <td className="px-4 py-2.5">
                          {meta.settlementFrequency ? (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FREQ_COLORS[meta.settlementFrequency] || 'bg-slate-100 text-slate-600'}`}>
                              {FREQ_LABELS[meta.settlementFrequency] || meta.settlementFrequency}
                            </span>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5"><Badge variant="info" className="text-xs">{s.chargerType}</Badge></td>
                        <td className="px-4 py-2.5 text-sm font-medium text-slate-700 text-right">Rs. {Number(s.chargeAmount).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-green-700">
                          {Number(s.creditPaid) > 0 ? `Rs. ${Number(s.creditPaid).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-sm font-bold text-red-600 text-right">Rs. {Number(s.outstanding).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-center">{statusBadge(s.paymentStatus)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-sm">
                      <td colSpan={6} className="px-4 py-2.5 text-slate-600">Total ({filtered.length} sessions)</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">Rs. {filtered.reduce((s, x) => s + Number(x.chargeAmount), 0).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-green-700">Rs. {filtered.reduce((s, x) => s + Number(x.creditPaid || 0), 0).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-red-600">Rs. {filtered.reduce((s, x) => s + Number(x.outstanding || 0), 0).toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}
