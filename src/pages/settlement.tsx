import { useEffect, useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, CheckCircle, CreditCard, Search, Phone, User, Calendar, Eye, Pencil, Trash2, Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';

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
  const [settlementVehicles, setSettlementVehicles] = useState<any[]>([]); // vehicles with isSettlementVehicle=true
  const [fromSessionVehicles, setFromSessionVehicles] = useState<any[]>([]); // vehicles with pending udaro sessions (not admin-registered)
  const [loading, setLoading] = useState(true);
  const [svFilter, setSvFilter] = useState<'all' | 'from-sessions' | 'settled'>('all'); // Settlement vehicles filter tab

  // Settlement vehicle CRUD states
  const [viewingVehicle, setViewingVehicle] = useState<any>(null);
  const [viewingVehicleHistory, setViewingVehicleHistory] = useState<any[]>([]); // Settlement history sessions
  const [loadingVehicleHistory, setLoadingVehicleHistory] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day'); // Filter period
  const [showViewVehicleModal, setShowViewVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [showEditVehicleModal, setShowEditVehicleModal] = useState(false);
  const [deletingVehicleNo, setDeletingVehicleNo] = useState<string | null>(null);

  const [search, setSearch] = useState('');
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

  // Add Settlement Vehicle modal state
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [registeredVehicles, setRegisteredVehicles] = useState<any[]>([]); // vehicles from /api/vehicles
  const [vehicleDropdownSearch, setVehicleDropdownSearch] = useState('');
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    vehicleNo: '',
    ownerName: '',
    ownerContact: '',
    settlementFrequency: 'monthly',
    settlementDayOfWeek: 1, // Monday
    settlementDayOfMonth: 1,
    customSettlementDays: 30,
    notes: '',
  });

  // Export state
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/sessions?paymentStatus=Pending&limit=500', { headers }).then(r => r.json()),
      fetch('/api/sessions?paymentStatus=Partially+Paid&limit=500', { headers }).then(r => r.json()),
      fetch('/api/sessions?paymentStatus=Paid&limit=500', { headers }).then(r => r.json()), // FETCH PAID SESSIONS TOO
      fetch('/api/vehicles', { headers }).then(r => r.json()),
    ]).then(([pendingData, partialData, paidData, vehicleData]) => {
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

      // Store all registered vehicles (owner registered + from sessions) for dropdown
      setRegisteredVehicles([
        ...(vehicleData.ownerRegistered || []),
        // Add from-session vehicles not already in owner registered
        ...(vehicleData.fromSessions || []).filter(
          (s: any) => !(vehicleData.ownerRegistered || []).find((o: any) => o.vehicleNo === s.vehicleNo)
        ),
      ]);

      // Merge ALL sessions (pending, partial, paid) to calculate accurate totals
      const allSessions = [
        ...(pendingData.sessions || []),
        ...(partialData.sessions || []),
        ...(paidData.sessions || []),
      ];

      // Calculate accurate outstanding per vehicle for ALL sessions
      const vehicleOutstandingMap = new Map<string, number>();
      allSessions.forEach((s: any) => {
        const chargeAmount = Number(s.chargeAmount) || 0;
        const creditPaid = Number(s.creditPaid) || 0;
        const stored = Number(s.outstanding) || 0;
        const actual = stored > 0 ? stored : (chargeAmount - creditPaid);
        
        if (!vehicleOutstandingMap.has(s.vehicleNo)) {
          vehicleOutstandingMap.set(s.vehicleNo, 0);
        }
        vehicleOutstandingMap.set(s.vehicleNo, vehicleOutstandingMap.get(s.vehicleNo)! + actual);
      });

      // Extract only vehicles with isSettlementVehicle=true and enrich with accurate outstanding
      const svList = (vehicleData.ownerRegistered || [])
        .filter((v: any) => v.isSettlementVehicle === true)
        .map((v: any) => ({
          ...v,
          totalOutstanding: vehicleOutstandingMap.get(v.vehicleNo) || 0, // Override with calculated value
        }));
      setSettlementVehicles(svList);

      // Build set of admin-registered settlement vehicle numbers
      const registeredNos = new Set(svList.map((v: any) => v.vehicleNo));

      // Filter ALL sessions with outstanding > 0 (both Udaro and non-Udaro)
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
        // Show ALL sessions with outstanding amount (removed isUdaro filter)
        return chargeAmount > 0 && actual > 0;
      });
      withDues.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setSessions(withDues);

      // FROM-SESSION vehicles: unique vehicles with pending sessions (any unpaid amount) that are NOT admin-registered settlement vehicles
      const sessionVehicleMap = new Map<string, any>();
      withDues.forEach((s: any) => {
        if (!sessionVehicleMap.has(s.vehicleNo)) {
          sessionVehicleMap.set(s.vehicleNo, {
            vehicleNo: s.vehicleNo,
            companyBrand: s.companyBrand || null,
            ownerName: null,
            ownerContact: null,
            sessions: [],
            totalOutstanding: 0,
            totalRevenue: 0,
            totalVisits: 0,
            isRegistered: registeredNos.has(s.vehicleNo),
          });
        }
        const entry = sessionVehicleMap.get(s.vehicleNo);
        entry.sessions.push(s);
        entry.totalOutstanding += Number(s.outstanding) || 0;
        entry.totalRevenue += Number(s.chargeAmount) || 0;
        entry.totalVisits += 1;
      });
      setFromSessionVehicles(Array.from(sessionVehicleMap.values()));
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

  const totalOutstanding = useMemo(() => sessions.reduce((s, x) => s + (Number(x.outstanding) || 0), 0), [sessions]);
  const totalVehicles = useMemo(() => new Set(sessions.map(s => s.vehicleNo)).size, [sessions]);
  const selectedOutstanding = useMemo(() =>
    sessions.filter(s => selectedIds.has(s.id)).reduce((s, x) => s + (Number(x.outstanding) || 0), 0),
    [sessions, selectedIds]
  );

  // ── Export Functions ──────────────────────────────────────────────────────
  const EXPORT_HEADERS = [
    'Vehicle No', 'Owner Name', 'Contact', 'Frequency', 'Payment Schedule',
    'Next Due Date', 'Outstanding (Rs)', 'Visits', 'Notes'
  ];

  const getExportData = () => {
    let displayVehicles = [];
    if (svFilter === 'all') {
      displayVehicles = settlementVehicles;
    } else if (svFilter === 'from-sessions') {
      displayVehicles = fromSessionVehicles;
    } else if (svFilter === 'settled') {
      displayVehicles = settlementVehicles.filter((v: any) => Number(v.totalOutstanding) === 0);
    }
    return displayVehicles;
  };

  const buildRows = (vehicles: any[]): (string | number)[][] =>
    vehicles.map((v: any) => {
      let scheduleLabel = '';
      if (v.settlementFrequency === 'weekly') {
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        scheduleLabel = `Every ${v.settlementDayOfWeek != null ? days[v.settlementDayOfWeek] : '—'}`;
      } else if (v.settlementFrequency === 'monthly') {
        scheduleLabel = `Day ${v.settlementDayOfMonth || '—'} of month`;
      } else if (v.settlementFrequency === 'custom') {
        scheduleLabel = `Every ${v.customSettlementDays || '—'} days`;
      } else {
        scheduleLabel = 'On Demand';
      }

      return [
        v.vehicleNo || '',
        v.ownerName || '',
        v.ownerContact || '',
        FREQ_LABELS[v.settlementFrequency] || v.settlementFrequency || '',
        scheduleLabel,
        v.nextDueDate ? String(v.nextDueDate).slice(0, 10) : '',
        v.totalOutstanding ? parseFloat(parseFloat(v.totalOutstanding).toFixed(2)) : 0,
        v.totalVisits || 0,
        v.notes || '',
      ];
    });

  const buildFilename = (ext: string) => {
    const filterLabel = svFilter === 'all' ? 'All' 
      : svFilter === 'from-sessions' ? 'FromSessions' 
      : 'Settled';
    return `SettlementVehicles_${filterLabel}.${ext}`;
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = async () => {
    setExporting('csv');
    try {
      const vehicles = getExportData();
      if (!vehicles.length) {
        toast({ title: 'No data', description: 'No vehicles to export.', variant: 'destructive' });
        return;
      }
      const escape = (v: any) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [
        EXPORT_HEADERS.map(escape).join(','),
        ...buildRows(vehicles).map(r => r.map(escape).join(',')),
      ].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = buildFilename('csv');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast({ title: `CSV exported — ${vehicles.length} vehicles`, description: filename });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  // ── Export Excel ──────────────────────────────────────────────────────────
  const exportExcel = async () => {
    setExporting('excel');
    try {
      const vehicles = getExportData();
      if (!vehicles.length) {
        toast({ title: 'No data', description: 'No vehicles to export.', variant: 'destructive' });
        return;
      }

      const XLSX = (await import('xlsx')).default || await import('xlsx');
      const wsData = [EXPORT_HEADERS, ...buildRows(vehicles)];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths
      ws['!cols'] = [
        { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
        { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 30 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Settlement Vehicles');
      const filename = buildFilename('xlsx');
      XLSX.writeFile(wb, filename);
      toast({ title: `Excel exported — ${vehicles.length} vehicles`, description: filename });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

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

  // Open view modal for settlement vehicle
  const handleViewVehicle = async (v: any) => {
    setViewingVehicle(v);
    setShowViewVehicleModal(true);
    setLoadingVehicleHistory(true);
    
    // Fetch ALL settlement sessions for this vehicle (both unpaid and paid)
    try {
      const res = await fetch(`/api/sessions?vehicleNo=${encodeURIComponent(v.vehicleNo)}&isUdaro=true&limit=500`, { headers });
      const data = await res.json();
      setViewingVehicleHistory(data.sessions || []);
    } catch (err) {
      console.error('Failed to load settlement history:', err);
      setViewingVehicleHistory([]);
    } finally {
      setLoadingVehicleHistory(false);
    }
  };

  // Open edit modal pre-filled for settlement vehicle
  const handleEditVehicle = (v: any) => {
    setEditingVehicle(v);
    setVehicleForm({
      vehicleNo: v.vehicleNo,
      ownerName: v.ownerName || '',
      ownerContact: v.ownerContact || '',
      settlementFrequency: v.settlementFrequency || 'monthly',
      settlementDayOfWeek: v.settlementDayOfWeek ?? 1,
      settlementDayOfMonth: v.settlementDayOfMonth ?? 1,
      customSettlementDays: v.customSettlementDays ?? 30,
      notes: v.notes || '',
    });
    setShowEditVehicleModal(true);
  };

  // Handle update settlement vehicle
  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVehicle(true);
    try {
      const res = await fetch('/api/vehicles/settlement', {
        method: 'POST', // upsert – reuse the same endpoint
        headers,
        body: JSON.stringify({
          vehicleNo: vehicleForm.vehicleNo.trim(),
          ownerName: vehicleForm.ownerName.trim(),
          ownerContact: vehicleForm.ownerContact.trim(),
          settlementFrequency: vehicleForm.settlementFrequency,
          settlementDayOfWeek: vehicleForm.settlementFrequency === 'weekly' ? vehicleForm.settlementDayOfWeek : null,
          settlementDayOfMonth: vehicleForm.settlementFrequency === 'monthly' ? vehicleForm.settlementDayOfMonth : null,
          customSettlementDays: vehicleForm.settlementFrequency === 'custom' ? vehicleForm.customSettlementDays : null,
          notes: vehicleForm.notes.trim(),
          isSettlementVehicle: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Vehicle Updated', description: `${vehicleForm.vehicleNo} updated successfully` });
        setShowEditVehicleModal(false);
        setEditingVehicle(null);
        loadData();
      } else {
        toast({ title: 'Update Failed', description: data.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingVehicle(false);
    }
  };

  // Handle delete settlement vehicle (remove from settlement arrangement)
  const handleDeleteVehicle = async (vehicleNo: string) => {
    if (!confirm(`Remove ${vehicleNo} from settlement arrangement? This will NOT delete the vehicle or its sessions.`)) return;
    setDeletingVehicleNo(vehicleNo);
    try {
      const res = await fetch(`/api/vehicles/settlement?vehicleNo=${encodeURIComponent(vehicleNo)}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Removed', description: `${vehicleNo} removed from settlement arrangement` });
        loadData();
      } else {
        toast({ title: 'Failed', description: data.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingVehicleNo(null);
    }
  };

  // Handle adding settlement vehicle
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVehicle(true);
    try {
      const res = await fetch('/api/vehicles/settlement', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          vehicleNo: vehicleForm.vehicleNo.trim(),
          ownerName: vehicleForm.ownerName.trim(),
          ownerContact: vehicleForm.ownerContact.trim(),
          settlementFrequency: vehicleForm.settlementFrequency,
          settlementDayOfWeek: vehicleForm.settlementFrequency === 'weekly' ? vehicleForm.settlementDayOfWeek : null,
          settlementDayOfMonth: vehicleForm.settlementFrequency === 'monthly' ? vehicleForm.settlementDayOfMonth : null,
          customSettlementDays: vehicleForm.settlementFrequency === 'custom' ? vehicleForm.customSettlementDays : null,
          notes: vehicleForm.notes.trim(),
          isSettlementVehicle: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'Settlement Vehicle Added',
          description: `${vehicleForm.vehicleNo} registered with ${FREQ_LABELS[vehicleForm.settlementFrequency]} settlement`,
        });
        setShowAddVehicleModal(false);
        setVehicleForm({
          vehicleNo: '',
          ownerName: '',
          ownerContact: '',
          settlementFrequency: 'monthly',
          settlementDayOfWeek: 1,
          settlementDayOfMonth: 1,
          customSettlementDays: 30,
          notes: '',
        });
        loadData();
      } else {
        toast({ title: 'Failed', description: data.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingVehicle(false);
    }
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

      {/* Add Settlement Vehicle Modal */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
              <div>
                <h3 className="text-lg font-bold">Add Settlement Vehicle</h3>
                <p className="text-sm text-purple-100">Register vehicle with payment arrangement (weekly/monthly)</p>
              </div>
              <button onClick={() => setShowAddVehicleModal(false)} className="text-white/80 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddVehicle} className="p-6 space-y-4">
              {/* Vehicle Number - Searchable Dropdown */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Vehicle Number *</Label>
                <div className="relative">
                  <Input
                    value={vehicleDropdownSearch || vehicleForm.vehicleNo}
                    onChange={e => {
                      setVehicleDropdownSearch(e.target.value);
                      setVehicleForm({ ...vehicleForm, vehicleNo: e.target.value, ownerName: '', ownerContact: '' });
                      setShowVehicleDropdown(true);
                    }}
                    onFocus={() => setShowVehicleDropdown(true)}
                    placeholder="Search or type vehicle number..."
                    required
                    className="h-10"
                    autoComplete="off"
                  />
                  {showVehicleDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {registeredVehicles
                        .filter(v =>
                          !vehicleDropdownSearch ||
                          v.vehicleNo.toLowerCase().includes(vehicleDropdownSearch.toLowerCase()) ||
                          (v.ownerName || '').toLowerCase().includes(vehicleDropdownSearch.toLowerCase())
                        )
                        .slice(0, 20)
                        .map(v => (
                          <button
                            key={v.vehicleNo}
                            type="button"
                            className="w-full text-left px-4 py-2.5 hover:bg-purple-50 text-sm border-b border-slate-100 last:border-0"
                            onClick={() => {
                              setVehicleForm({
                                ...vehicleForm,
                                vehicleNo: v.vehicleNo,
                                ownerName: v.ownerName || '',
                                ownerContact: v.ownerContact || '',
                              });
                              setVehicleDropdownSearch('');
                              setShowVehicleDropdown(false);
                            }}
                          >
                            <span className="font-semibold text-slate-900">{v.vehicleNo}</span>
                            {v.ownerName && (
                              <span className="ml-2 text-slate-500">{v.ownerName}</span>
                            )}
                            {v.ownerContact && (
                              <span className="ml-2 text-slate-400 text-xs">{v.ownerContact}</span>
                            )}
                          </button>
                        ))
                      }
                      {registeredVehicles.filter(v =>
                        !vehicleDropdownSearch ||
                        v.vehicleNo.toLowerCase().includes(vehicleDropdownSearch.toLowerCase()) ||
                        (v.ownerName || '').toLowerCase().includes(vehicleDropdownSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-400 text-center">
                          No matching vehicle found. You can still type a new number.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Click outside to close dropdown */}
                {showVehicleDropdown && (
                  <div className="fixed inset-0 z-40" onClick={() => setShowVehicleDropdown(false)} />
                )}
              </div>

              {/* Owner Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Owner Name *</Label>
                  <Input
                    value={vehicleForm.ownerName}
                    onChange={e => setVehicleForm({ ...vehicleForm, ownerName: e.target.value })}
                    placeholder="Full name"
                    required
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Contact Number</Label>
                  <Input
                    value={vehicleForm.ownerContact}
                    onChange={e => setVehicleForm({ ...vehicleForm, ownerContact: e.target.value })}
                    placeholder="Phone number"
                    className="h-10"
                  />
                </div>
              </div>

              {/* Settlement Frequency */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Settlement Frequency *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {['weekly', 'monthly', 'custom'].map(freq => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setVehicleForm({ ...vehicleForm, settlementFrequency: freq })}
                      className={`py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                        vehicleForm.settlementFrequency === freq
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {FREQ_LABELS[freq]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Fields Based on Frequency */}
              {vehicleForm.settlementFrequency === 'weekly' && (
                <div className="space-y-2 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <Label className="text-sm font-medium text-blue-900">Payment Day (Weekly)</Label>
                  <select
                    value={vehicleForm.settlementDayOfWeek}
                    onChange={e => setVehicleForm({ ...vehicleForm, settlementDayOfWeek: Number(e.target.value) })}
                    className="w-full h-10 rounded-md border border-blue-300 bg-white px-3 text-sm"
                  >
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                  <p className="text-xs text-blue-600">Customer will pay every week on this day</p>
                </div>
              )}

              {vehicleForm.settlementFrequency === 'monthly' && (
                <div className="space-y-2 bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <Label className="text-sm font-medium text-purple-900">Payment Date (Monthly)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={vehicleForm.settlementDayOfMonth}
                    onChange={e => setVehicleForm({ ...vehicleForm, settlementDayOfMonth: Number(e.target.value) })}
                    className="h-10 border-purple-300"
                  />
                  <p className="text-xs text-purple-600">Day of month (1-31). Customer will pay every month on this date</p>
                </div>
              )}

              {vehicleForm.settlementFrequency === 'custom' && (
                <div className="space-y-2 bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <Label className="text-sm font-medium text-orange-900">Custom Interval (Days)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={vehicleForm.customSettlementDays}
                    onChange={e => setVehicleForm({ ...vehicleForm, customSettlementDays: Number(e.target.value) })}
                    className="h-10 border-orange-300"
                  />
                  <p className="text-xs text-orange-600">Number of days between payments (e.g., 15 for bi-weekly)</p>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notes</Label>
                <textarea
                  value={vehicleForm.notes}
                  onChange={e => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
                  placeholder="Additional notes about this settlement arrangement..."
                  rows={3}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddVehicleModal(false)}
                  disabled={savingVehicle}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingVehicle}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {savingVehicle ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                  ) : (
                    'Add Settlement Vehicle'
                  )}
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
        <div className="flex gap-2">
          <Button onClick={() => setShowAddVehicleModal(true)} variant="outline" className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600">
            + Add Settlement Vehicle
          </Button>
          <Button onClick={openBulkSettle} disabled={selectedIds.size === 0} className="bg-green-600 hover:bg-green-700 gap-2">
            <CreditCard className="h-4 w-4" />
            Settle Selected
            {selectedIds.size > 0 && (
              <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full ml-1">{selectedIds.size}</span>
            )}
          </Button>
        </div>
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
        <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set(filtered.map(s => s.id)))} className="h-9 text-xs">
          Select All
        </Button>
        {selectedIds.size > 0 && (
          <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())} className="h-9 text-xs text-red-600 hover:text-red-700">
            Clear ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* View Settlement Vehicle Modal */}
      {showViewVehicleModal && viewingVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-lg z-10">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{viewingVehicle.vehicleNo} — Settlement History</h3>
                <p className="text-sm text-slate-600">{viewingVehicle.ownerName || 'Settlement Vehicle'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Export CSV for this vehicle's settlement history
                    const sessions = viewingVehicleHistory;
                    if (!sessions.length) {
                      toast({ title: 'No data', description: 'No sessions to export.', variant: 'destructive' });
                      return;
                    }
                    const headers = ['Date', 'Charged %', 'Amount (Rs)', 'Paid (Rs)', 'Outstanding (Rs)', 'Status', 'Due Date', 'Settlement Method', 'Settlement Date'];
                    const escape = (v: any) => {
                      if (v === null || v === undefined) return '';
                      const s = String(v);
                      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
                    };
                    const rows = sessions.map((s: any) => [
                      String(s.date).slice(0, 10),
                      s.chargedPercent ? parseFloat(s.chargedPercent).toFixed(2) : '',
                      s.chargeAmount ? parseFloat(s.chargeAmount).toFixed(2) : 0,
                      s.creditPaid ? parseFloat(s.creditPaid).toFixed(2) : 0,
                      s.outstanding ? parseFloat(s.outstanding).toFixed(2) : 0,
                      s.paymentStatus || '',
                      s.udaroDueDate ? String(s.udaroDueDate).slice(0, 10) : '',
                      s.settlementMethod || '',
                      s.settlementDate ? String(s.settlementDate).slice(0, 10) : '',
                    ]);
                    const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `Settlement_${viewingVehicle.vehicleNo}_History.csv`; a.click();
                    URL.revokeObjectURL(url);
                    toast({ title: `CSV exported — ${sessions.length} sessions`, description: `Settlement_${viewingVehicle.vehicleNo}_History.csv` });
                  }}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    // Export Excel for this vehicle's settlement history
                    const sessions = viewingVehicleHistory;
                    if (!sessions.length) {
                      toast({ title: 'No data', description: 'No sessions to export.', variant: 'destructive' });
                      return;
                    }
                    try {
                      const XLSX = (await import('xlsx')).default || await import('xlsx');
                      const headers = ['Date', 'Charged %', 'Amount (Rs)', 'Paid (Rs)', 'Outstanding (Rs)', 'Status', 'Due Date', 'Settlement Method', 'Settlement Date'];
                      const rows = sessions.map((s: any) => [
                        String(s.date).slice(0, 10),
                        s.chargedPercent ? parseFloat(s.chargedPercent).toFixed(2) : '',
                        s.chargeAmount ? parseFloat(s.chargeAmount).toFixed(2) : 0,
                        s.creditPaid ? parseFloat(s.creditPaid).toFixed(2) : 0,
                        s.outstanding ? parseFloat(s.outstanding).toFixed(2) : 0,
                        s.paymentStatus || '',
                        s.udaroDueDate ? String(s.udaroDueDate).slice(0, 10) : '',
                        s.settlementMethod || '',
                        s.settlementDate ? String(s.settlementDate).slice(0, 10) : '',
                      ]);
                      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                      ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 16 }];
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, 'Settlement History');
                      XLSX.writeFile(wb, `Settlement_${viewingVehicle.vehicleNo}_History.xlsx`);
                      toast({ title: `Excel exported — ${sessions.length} sessions`, description: `Settlement_${viewingVehicle.vehicleNo}_History.xlsx` });
                    } catch (err: any) {
                      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
                    }
                  }}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  Excel
                </Button>
                <button onClick={() => {setShowViewVehicleModal(false); setViewingVehicleHistory([]);}} className="text-slate-400 hover:text-slate-600 ml-2"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Summary Cards Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium mb-1">Settlement Frequency</p>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${FREQ_COLORS[viewingVehicle.settlementFrequency] || 'bg-slate-100 text-slate-600'}`}>
                    {FREQ_LABELS[viewingVehicle.settlementFrequency] || '—'}
                  </span>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <p className="text-xs text-purple-600 font-medium mb-1">Next Due Date</p>
                  <p className={`font-bold text-lg ${viewingVehicle.nextDueDate && new Date(viewingVehicle.nextDueDate) <= new Date() ? 'text-red-600' : 'text-purple-700'}`}>
                    {viewingVehicle.nextDueDate ? String(viewingVehicle.nextDueDate).slice(0, 10) : '—'}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-xs text-green-600 font-medium mb-1">Total Revenue</p>
                  <p className="font-bold text-lg text-green-700">Rs. {Number(viewingVehicle.totalRevenue || 0).toLocaleString()}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-xs text-red-600 font-medium mb-1">Outstanding</p>
                  <p className={`font-bold text-lg ${Number(viewingVehicle.totalOutstanding) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Rs. {Number(viewingVehicle.totalOutstanding || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Owner Info */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-3">Owner Information</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Owner Name</p>
                    <p className="font-semibold text-slate-900">{viewingVehicle.ownerName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Contact</p>
                    <p className="font-semibold text-slate-900">{viewingVehicle.ownerContact || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Payment Schedule</p>
                    <p className="font-semibold text-slate-900">
                      {viewingVehicle.settlementFrequency === 'weekly'
                        ? `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][viewingVehicle.settlementDayOfWeek] || '—'}`
                        : viewingVehicle.settlementFrequency === 'monthly'
                        ? `Day ${viewingVehicle.settlementDayOfMonth}`
                        : viewingVehicle.settlementFrequency === 'custom'
                        ? `${viewingVehicle.customSettlementDays} days`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Total Visits</p>
                    <p className="font-semibold text-slate-900">{viewingVehicle.totalVisits || 0}</p>
                  </div>
                </div>
                {viewingVehicle.notes && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">Notes</p>
                    <p className="text-sm text-slate-700">{viewingVehicle.notes}</p>
                  </div>
                )}
              </div>

              {/* Settlement History Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-slate-600" />
                    Settlement History ({viewingVehicleHistory.length} sessions)
                  </h4>
                  {viewingVehicleHistory.filter((s: any) => s.paymentStatus !== 'Paid').length > 0 && (
                    <Button 
                      size="sm"
                      onClick={() => {
                        // Select all pending sessions
                        const pendingIds = viewingVehicleHistory
                          .filter((s: any) => s.paymentStatus !== 'Paid')
                          .map((s: any) => s.id);
                        setSelectedIds(new Set(pendingIds));
                      }}
                      className="bg-orange-600 hover:bg-orange-700 text-xs h-8"
                    >
                      Select All Pending
                    </Button>
                  )}
                </div>
                {loadingVehicleHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : viewingVehicleHistory.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-slate-400">No settlement sessions yet</p>
                  </div>
                ) : (
                  <>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-xs">
                          <thead className="bg-purple-700 text-white sticky top-0">
                            <tr>
                              <th className="px-3 py-2.5 text-center font-semibold">
                                <input
                                  type="checkbox"
                                  checked={viewingVehicleHistory.filter((s: any) => s.paymentStatus !== 'Paid').every((s: any) => selectedIds.has(s.id))}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const pendingIds = viewingVehicleHistory
                                        .filter((s: any) => s.paymentStatus !== 'Paid')
                                        .map((s: any) => s.id);
                                      setSelectedIds(new Set([...selectedIds, ...pendingIds]));
                                    } else {
                                      const pendingIds = viewingVehicleHistory
                                        .filter((s: any) => s.paymentStatus !== 'Paid')
                                        .map((s: any) => s.id);
                                      setSelectedIds(new Set([...selectedIds].filter(id => !pendingIds.includes(id))));
                                    }
                                  }}
                                  className="h-4 w-4 cursor-pointer"
                                />
                              </th>
                              <th className="px-3 py-2.5 text-left font-semibold">Date</th>
                              <th className="px-3 py-2.5 text-center font-semibold">Charged %</th>
                              <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                              <th className="px-3 py-2.5 text-right font-semibold">Paid</th>
                              <th className="px-3 py-2.5 text-right font-semibold">Outstanding</th>
                              <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                              <th className="px-3 py-2.5 text-center font-semibold">Due Date</th>
                              <th className="px-3 py-2.5 text-left font-semibold">Settlement Method</th>
                              <th className="px-3 py-2.5 text-left font-semibold">Settlement Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewingVehicleHistory.map((sess: any) => {
                              const isPending = sess.paymentStatus !== 'Paid';
                              const isSelected = selectedIds.has(sess.id);
                              return (
                                <tr key={sess.id} className={`border-b border-slate-100 ${isSelected ? 'bg-green-50' : 'hover:bg-purple-50'}`}>
                                  <td className="px-3 py-2.5 text-center">
                                    {isPending ? (
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          const newSelected = new Set(selectedIds);
                                          if (e.target.checked) {
                                            newSelected.add(sess.id);
                                          } else {
                                            newSelected.delete(sess.id);
                                          }
                                          setSelectedIds(newSelected);
                                        }}
                                        className="h-4 w-4 cursor-pointer"
                                      />
                                    ) : (
                                      <span className="text-green-600">✓</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{String(sess.date).slice(0, 10)}</td>
                                  <td className="px-3 py-2.5 text-center font-medium text-slate-900">{sess.chargedPercent ? parseFloat(sess.chargedPercent).toFixed(1) : '—'}%</td>
                                  <td className="px-3 py-2.5 text-right font-semibold text-slate-900">Rs. {parseFloat(sess.chargeAmount || 0).toFixed(2)}</td>
                                  <td className="px-3 py-2.5 text-right text-green-700">Rs. {parseFloat(sess.creditPaid || 0).toFixed(2)}</td>
                                  <td className="px-3 py-2.5 text-right font-semibold text-red-600">Rs. {parseFloat(sess.outstanding || 0).toFixed(2)}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    <Badge variant={sess.paymentStatus === 'Paid' ? 'success' : sess.paymentStatus === 'Partially Paid' ? 'info' : 'warning'} className="text-xs">
                                      {sess.paymentStatus}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-slate-600">{sess.udaroDueDate ? String(sess.udaroDueDate).slice(0, 10) : '—'}</td>
                                  <td className="px-3 py-2.5 text-slate-600">{sess.settlementMethod || '—'}</td>
                                  <td className="px-3 py-2.5 text-slate-600">{sess.settlementDate ? String(sess.settlementDate).slice(0, 10) : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {/* Settlement Action Box */}
                    {selectedIds.size > 0 && viewingVehicleHistory.some((s: any) => selectedIds.has(s.id)) && (
                      <div className="mt-4 bg-green-50 border-2 border-green-300 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-green-900">
                              {selectedIds.size} session{selectedIds.size > 1 ? 's' : ''} selected
                            </p>
                            <p className="text-sm text-green-700">
                              Total Outstanding: Rs. {viewingVehicleHistory
                                .filter((s: any) => selectedIds.has(s.id))
                                .reduce((sum: number, s: any) => sum + parseFloat(s.outstanding || 0), 0)
                                .toFixed(2)}
                            </p>
                          </div>
                          <Button
                            onClick={() => {
                              // Open bulk settle modal with selected sessions
                              openBulkSettle();
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Settle Selected
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <Button variant="outline" onClick={() => {setShowViewVehicleModal(false); setViewingVehicleHistory([]);}} className="flex-1">Close</Button>
                <Button onClick={() => { setShowViewVehicleModal(false); setViewingVehicleHistory([]); handleEditVehicle(viewingVehicle); }} className="flex-1 bg-purple-600 hover:bg-purple-700">
                  <Pencil className="h-4 w-4 mr-2" /> Edit
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Settlement Vehicle Modal */}
      {showEditVehicleModal && editingVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
              <div>
                <h3 className="text-lg font-bold">Edit — {editingVehicle.vehicleNo}</h3>
                <p className="text-sm text-purple-100">Update settlement arrangement</p>
              </div>
              <button onClick={() => { setShowEditVehicleModal(false); setEditingVehicle(null); }} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleUpdateVehicle} className="p-6 space-y-4">
              {/* Vehicle No - read only in edit */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Vehicle Number</Label>
                <Input value={vehicleForm.vehicleNo} readOnly className="h-10 bg-slate-50 text-slate-500 cursor-not-allowed" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Owner Name *</Label>
                  <Input value={vehicleForm.ownerName} onChange={e => setVehicleForm({ ...vehicleForm, ownerName: e.target.value })} placeholder="Full name" required className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Contact Number</Label>
                  <Input value={vehicleForm.ownerContact} onChange={e => setVehicleForm({ ...vehicleForm, ownerContact: e.target.value })} placeholder="Phone number" className="h-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Settlement Frequency *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {['weekly', 'monthly', 'custom'].map(freq => (
                    <button key={freq} type="button" onClick={() => setVehicleForm({ ...vehicleForm, settlementFrequency: freq })}
                      className={`py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${vehicleForm.settlementFrequency === freq ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                      {FREQ_LABELS[freq]}
                    </button>
                  ))}
                </div>
              </div>
              {vehicleForm.settlementFrequency === 'weekly' && (
                <div className="space-y-2 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <Label className="text-sm font-medium text-blue-900">Payment Day (Weekly)</Label>
                  <select value={vehicleForm.settlementDayOfWeek} onChange={e => setVehicleForm({ ...vehicleForm, settlementDayOfWeek: Number(e.target.value) })} className="w-full h-10 rounded-md border border-blue-300 bg-white px-3 text-sm">
                    {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              {vehicleForm.settlementFrequency === 'monthly' && (
                <div className="space-y-2 bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <Label className="text-sm font-medium text-purple-900">Payment Date (Monthly, 1-31)</Label>
                  <Input type="number" min="1" max="31" value={vehicleForm.settlementDayOfMonth} onChange={e => setVehicleForm({ ...vehicleForm, settlementDayOfMonth: Number(e.target.value) })} className="h-10 border-purple-300" />
                </div>
              )}
              {vehicleForm.settlementFrequency === 'custom' && (
                <div className="space-y-2 bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <Label className="text-sm font-medium text-orange-900">Interval (Days)</Label>
                  <Input type="number" min="1" value={vehicleForm.customSettlementDays} onChange={e => setVehicleForm({ ...vehicleForm, customSettlementDays: Number(e.target.value) })} className="h-10 border-orange-300" />
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notes</Label>
                <textarea value={vehicleForm.notes} onChange={e => setVehicleForm({ ...vehicleForm, notes: e.target.value })} rows={3} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => { setShowEditVehicleModal(false); setEditingVehicle(null); }} disabled={savingVehicle} className="flex-1">Cancel</Button>
                <Button type="submit" disabled={savingVehicle} className="flex-1 bg-purple-600 hover:bg-purple-700">
                  {savingVehicle ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settlement Vehicles Table */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Settlement Vehicles</h3>
            <p className="text-xs text-slate-500">
              {svFilter === 'all' && `${settlementVehicles.length} vehicle${settlementVehicles.length !== 1 ? 's' : ''} on settlement arrangement`}
              {svFilter === 'from-sessions' && `${fromSessionVehicles.filter(v => !v.isRegistered).length} vehicle${fromSessionVehicles.filter(v => !v.isRegistered).length !== 1 ? 's' : ''} with pending Udaro sessions`}
              {svFilter === 'settled' && `${settlementVehicles.filter(v => Number(v.totalOutstanding) === 0).length} vehicle${settlementVehicles.filter(v => Number(v.totalOutstanding) === 0).length !== 1 ? 's' : ''} fully settled`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={exportCSV}
              disabled={exporting === 'csv'}
              className="gap-1.5"
            >
              {exporting === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={exportExcel}
              disabled={exporting === 'excel'}
              className="gap-1.5"
            >
              {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Excel
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSvFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              svFilter === 'all'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Registered ({settlementVehicles.length})
          </button>
          <button
            onClick={() => setSvFilter('from-sessions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              svFilter === 'from-sessions'
                ? 'bg-orange-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            From Sessions ({fromSessionVehicles.filter(v => !v.isRegistered).length})
          </button>
          <button
            onClick={() => setSvFilter('settled')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              svFilter === 'settled'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Settled ({settlementVehicles.filter(v => Number(v.totalOutstanding) === 0).length})
          </button>
        </div>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-purple-900 text-white">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold whitespace-nowrap">#</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Vehicle No.</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Owner Name</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Contact</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Frequency</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Payment Schedule</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Next Due</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Outstanding</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Visits</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Notes</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold whitespace-nowrap sticky right-0 bg-purple-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></td></tr>
                  ) : (() => {
                    // Determine which vehicles to display based on filter
                    let displayVehicles = [];
                    if (svFilter === 'all') {
                      displayVehicles = settlementVehicles;
                    } else if (svFilter === 'from-sessions') {
                      displayVehicles = fromSessionVehicles;
                    } else if (svFilter === 'settled') {
                      displayVehicles = settlementVehicles.filter((v: any) => Number(v.totalOutstanding) === 0);
                    }

                    if (displayVehicles.length === 0) {
                      return (
                        <tr>
                          <td colSpan={11} className="py-12 text-center text-slate-400 text-sm">
                            {svFilter === 'all' && 'No settlement vehicles registered yet. Click "+ Add Settlement Vehicle" to get started.'}
                            {svFilter === 'from-sessions' && 'No vehicles with pending Udaro sessions from session form.'}
                            {svFilter === 'settled' && 'No vehicles with fully settled dues yet.'}
                          </td>
                        </tr>
                      );
                    }

                    return displayVehicles.map((v: any, i: number) => {
                      const isDue = v.nextDueDate && new Date(v.nextDueDate) <= new Date();
                      const scheduleLabel = (() => {
                        if (v.settlementFrequency === 'weekly') {
                          const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                          return `Every ${v.settlementDayOfWeek != null ? days[v.settlementDayOfWeek] : '—'}`;
                        }
                        if (v.settlementFrequency === 'monthly') return `Day ${v.settlementDayOfMonth ?? '—'} / month`;
                        if (v.settlementFrequency === 'custom') return `Every ${v.customSettlementDays ?? '—'} days`;
                        return '—';
                      })();
                      
                      // For "from-sessions" vehicles, show different info
                      const isFromSession = svFilter === 'from-sessions';
                      
                      return (
                        <tr key={v.vehicleNo} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-purple-50 transition-colors`}>
                          <td className="px-4 py-2.5 text-xs text-slate-400">{i + 1}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                            {v.vehicleNo}
                            {isFromSession && <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">From Session</span>}
                          </td>
                          <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>{v.ownerName || <span className="text-slate-300">—</span>}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                            {v.ownerContact
                              ? <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400 shrink-0" />{v.ownerContact}</div>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {isFromSession ? (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                v.sessions && v.sessions.length > 0 && v.sessions[0].paymentStatus === 'Partially Paid'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                {v.sessions && v.sessions.length > 0 ? v.sessions[0].paymentStatus : 'Pending'}
                              </span>
                            ) : (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FREQ_COLORS[v.settlementFrequency] || 'bg-slate-100 text-slate-600'}`}>
                                {FREQ_LABELS[v.settlementFrequency] || v.settlementFrequency || '—'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{isFromSession ? 'Per Session' : scheduleLabel}</td>
                          <td className="px-4 py-2.5 text-center whitespace-nowrap">
                            {v.nextDueDate
                              ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isDue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                  {String(v.nextDueDate).slice(0, 10)}{isDue && ' ⚠️'}
                                </span>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold whitespace-nowrap">
                            {Number(v.totalOutstanding) > 0
                              ? <span className="text-red-600">Rs. {Number(v.totalOutstanding).toLocaleString()}</span>
                              : <span className="text-green-600">Rs. 0</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{v.totalVisits || 0}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[140px] truncate">{v.notes || '—'}</td>
                          <td className="px-4 py-2.5 sticky right-0 bg-white">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => handleViewVehicle(v)}
                                className="h-7 px-2 text-xs hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300">
                                <Eye className="h-3 w-3" />
                              </Button>
                              {!isFromSession && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleEditVehicle(v)}
                                    className="h-7 px-2 text-xs hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300">
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="outline"
                                    onClick={() => handleDeleteVehicle(v.vehicleNo)}
                                    disabled={deletingVehicleNo === v.vehicleNo}
                                    className="h-7 px-2 text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-300">
                                    {deletingVehicleNo === v.vehicleNo
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <Trash2 className="h-3 w-3" />}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
                {(() => {
                  // Calculate totals for currently displayed vehicles
                  let displayVehicles = [];
                  if (svFilter === 'all') {
                    displayVehicles = settlementVehicles;
                  } else if (svFilter === 'from-sessions') {
                    displayVehicles = fromSessionVehicles;
                  } else if (svFilter === 'settled') {
                    displayVehicles = settlementVehicles.filter((v: any) => Number(v.totalOutstanding) === 0);
                  }

                  if (displayVehicles.length === 0) return null;

                  return (
                    <tfoot>
                      <tr className="bg-purple-50 border-t-2 border-purple-200 font-semibold text-sm">
                        <td colSpan={7} className="px-4 py-2.5 text-slate-700">Total ({displayVehicles.length} vehicles)</td>
                        <td className="px-4 py-2.5 text-right text-red-600">
                          Rs. {displayVehicles.reduce((s: number, v: any) => s + (Number(v.totalOutstanding) || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600">
                          {displayVehicles.reduce((s: number, v: any) => s + (Number(v.totalVisits) || 0), 0)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
