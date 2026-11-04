import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  Plus, Loader2, Search, Car, Clock, Zap, Phone,
  CheckCircle2, XCircle, UserCheck, ChevronRight,
  RefreshCw, Bell, AlertCircle, User, Calendar, Eye,
} from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────
type QueueStatus = 'WAITING' | 'CALLED';

interface Vehicle {
  id: string;
  vehicleNo: string;
  companyBrand?: string;
  ownerName?: string;
  ownerContact?: string;
}

interface Staff {
  id: string;
  fullName: string;
  username: string;
}

interface QueueEntry {
  id: string;
  queuePosition: number;
  status: QueueStatus;
  priority: number;
  joinedAt: string;
  calledAt?: string;
  notes?: string;
  vehicle: Vehicle;
  creator: Staff;
  caller?: Staff;
  waitingMinutes: number;
}

interface AllVehicle {
  vehicleNo: string;
  id?: string;
  companyBrand?: string;
  ownerName?: string;
}

// ─── helpers ──────────────────────────────────────────────────
function waitLabel(mins: number) {
  if (mins < 1)  return 'Just arrived';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function waitColor(mins: number) {
  if (mins < 15) return 'text-green-600';
  if (mins < 30) return 'text-yellow-600';
  return 'text-red-600';
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  // If less than 60 minutes ago, show relative time
  if (diffMins < 60) {
    if (diffMins < 1) return 'Just now';
    return `${diffMins}m ago`;
  }
  
  // Otherwise show date and time
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  
  // If today, only show time
  if (date.toDateString() === now.toDateString()) {
    return `Today at ${timeStr}`;
  }
  
  return `${dateStr} at ${timeStr}`;
}

const STATUS_PILL: Record<QueueStatus, string> = {
  WAITING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  CALLED:  'bg-blue-100   text-blue-700   border-blue-200',
};

// ─── Page ─────────────────────────────────────────────────────
export default function ActiveQueuePage() {
  const router   = useRouter();
  const { toast } = useToast();

  const [queue,      setQueue]      = useState<QueueEntry[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');

  // Add to queue modal
  const [addOpen,    setAddOpen]    = useState(false);
  const [vehicles,   setVehicles]   = useState<AllVehicle[]>([]);
  const [vSearch,    setVSearch]    = useState('');
  const [selectedV,  setSelectedV]  = useState<AllVehicle | null>(null);
  const [addNotes,   setAddNotes]   = useState('');
  const [adding,     setAdding]     = useState(false);

  // Assign modal
  const [assignTarget, setAssignTarget] = useState<QueueEntry | null>(null);
  const [chargers,     setChargers]     = useState<{ id: string; chargerId: string; displayName: string; category: { name: string } }[]>([]);
  const [assignForm,   setAssignForm]   = useState({
    chargerId:    '',
    chargerType:  'GBT' as 'GBT' | 'CCS2',
    arrivalSoc:   '',
    ratePerPercent: '',
    paymentMethod: 'Cash',
  });
  const [assigning, setAssigning] = useState(false);

  // Cancel confirm
  const [cancelTarget, setCancelTarget] = useState<QueueEntry | null>(null);
  const [cancelling,   setCancelling]   = useState(false);

  // View details modal
  const [viewTarget, setViewTarget] = useState<QueueEntry | null>(null);

  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  function authH() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };
  }

  // ── Fetch queue ──────────────────────────────────────────────
  const fetchQueue = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    try {
      const res = await fetch('/api/queue', { headers: authH() });
      if (res.status === 401) { router.push('/'); return; }
      const data = await res.json();
      setQueue(data.data?.queue     || []);
      setTotal(data.data?.total     || 0);
    } catch {
      if (!quiet) toast({ title: 'Error', description: 'Failed to load queue', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, toast]);

  // ── Auto-refresh every 30s ───────────────────────────────────
  useEffect(() => {
    fetchQueue();
    autoRefreshRef.current = setInterval(() => fetchQueue(true), 30_000);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [fetchQueue]);

  // ── Load vehicles for add-modal ──────────────────────────────
  async function loadVehicles() {
    try {
      const res  = await fetch('/api/vehicles', { headers: authH() });
      const data = await res.json();
      // merge from sessions + registered
      const all: AllVehicle[] = [];
      const seen = new Set<string>();
      (data.fromSessions || []).forEach((v: any) => {
        if (!seen.has(v.vehicleNo)) { seen.add(v.vehicleNo); all.push(v); }
      });
      (data.ownerRegistered || []).forEach((v: any) => {
        if (!seen.has(v.vehicleNo)) { seen.add(v.vehicleNo); all.push(v); }
      });
      setVehicles(all);
    } catch { /* silent */ }
  }

  // ── Load chargers for assign-modal ───────────────────────────
  async function loadChargers() {
    try {
      const res  = await fetch('/api/chargers', { headers: authH() });
      const data = await res.json();
      setChargers((data.chargers || []).filter((c: any) => c.isActive && c.status === 'AVAILABLE'));
    } catch { /* silent */ }
  }

  // ── Add to queue ─────────────────────────────────────────────
  async function handleAdd() {
    if (!selectedV) return toast({ title: 'Select a vehicle', variant: 'destructive' });

    setAdding(true);
    try {
      // Step 1: use /api/vehicles/find — finds OR auto-creates the Vehicle record and returns its UUID
      const vehicleNoToFind = selectedV.vehicleNo?.trim();
      if (!vehicleNoToFind) {
        toast({ title: 'Invalid vehicle number', variant: 'destructive' });
        setAdding(false);
        return;
      }

      console.log('[handleAdd] Looking up vehicle:', vehicleNoToFind);

      const findRes  = await fetch(
        `/api/vehicles/find?vehicleNo=${encodeURIComponent(vehicleNoToFind)}`,
        { headers: authH() },
      );
      const findData = await findRes.json();

      if (!findRes.ok) {
        toast({ title: 'Error', description: findData.message, variant: 'destructive' });
        return;
      }

      const vehicleId: string = findData.id;

      // Step 2: add to queue
      const res  = await fetch('/api/queue', {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify({ vehicleId, notes: addNotes || null }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msg =
          data.code === 'DUPLICATE_QUEUE_ENTRY' ? 'Vehicle is already in the queue'
          : data.code === 'VEHICLE_CHARGING'    ? 'Vehicle is currently charging'
          : data.message;
        toast({ title: 'Cannot add to queue', description: msg, variant: 'destructive' });
        return;
      }

      toast({ title: 'Added to queue', description: `#${data.data?.queuePosition} — ${selectedV.vehicleNo}` });
      setAddOpen(false);
      setSelectedV(null);
      setAddNotes('');
      setVSearch('');
      fetchQueue();
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  }

  // ── Call vehicle ─────────────────────────────────────────────
  async function handleCall(entry: QueueEntry) {
    try {
      const res = await fetch(`/api/queue/${entry.id}/call`, { method: 'PATCH', headers: authH() });
      if (!res.ok) { const d = await res.json(); toast({ title: 'Error', description: d.message, variant: 'destructive' }); return; }
      toast({ title: `Calling ${entry.vehicle.vehicleNo}`, description: 'Vehicle status updated to CALLED' });
      fetchQueue(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to call vehicle', variant: 'destructive' });
    }
  }

  // ── Assign ───────────────────────────────────────────────────
  async function openAssign(entry: QueueEntry) {
    setAssignTarget(entry);
    setAssignForm({ chargerId: '', chargerType: 'GBT', arrivalSoc: '', ratePerPercent: '', paymentMethod: 'Cash' });
    await loadChargers();
  }

  async function handleAssign() {
    if (!assignTarget) return;
    if (!assignForm.chargerId.trim()) return toast({ title: 'Enter Charger ID', variant: 'destructive' });

    setAssigning(true);
    try {
      const res  = await fetch(`/api/queue/${assignTarget.id}/assign`, {
        method:  'POST',
        headers: authH(),
        body: JSON.stringify({
          chargerId:      assignForm.chargerId.trim(),
          chargerType:    assignForm.chargerType,
          arrivalSoc:     assignForm.arrivalSoc     ? Number(assignForm.arrivalSoc)     : null,
          ratePerPercent: assignForm.ratePerPercent ? Number(assignForm.ratePerPercent) : null,
          paymentMethod:  assignForm.paymentMethod,
          paymentStatus:  'Pending',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msg =
          data.code === 'CHARGER_OCCUPIED'        ? `Charger ${assignForm.chargerId} is occupied`
          : data.code === 'VEHICLE_ALREADY_CHARGING' ? 'Vehicle is already charging'
          : data.message;
        toast({ title: 'Assignment failed', description: msg, variant: 'destructive' });
        return;
      }

      toast({ title: 'Assigned!', description: `${assignTarget.vehicle.vehicleNo} → Charger ${assignForm.chargerId}` });
      setAssignTarget(null);
      fetchQueue();
    } catch {
      toast({ title: 'Error', description: 'Assignment failed', variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  }

  // ── Cancel ───────────────────────────────────────────────────
  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/queue/${cancelTarget.id}/cancel`, { method: 'PATCH', headers: authH() });
      if (!res.ok) { const d = await res.json(); toast({ title: 'Error', description: d.message, variant: 'destructive' }); return; }
      toast({ title: 'Entry cancelled', description: cancelTarget.vehicle.vehicleNo });
      setCancelTarget(null);
      fetchQueue();
    } catch {
      toast({ title: 'Error', description: 'Failed to cancel', variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  }

  // ── Filtered display ─────────────────────────────────────────
  const filtered = queue.filter(q =>
    !search ||
    q.vehicle.vehicleNo.toLowerCase().includes(search.toLowerCase()) ||
    (q.vehicle.ownerName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (q.vehicle.companyBrand ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const waitingCount = queue.filter(q => q.status === 'WAITING').length;
  const calledCount  = queue.filter(q => q.status === 'CALLED').length;

  // ── Vehicle search dropdown ───────────────────────────────────
  const vFiltered = vehicles.filter(v =>
    v.vehicleNo.toLowerCase().includes(vSearch.toLowerCase()) ||
    (v.companyBrand ?? '').toLowerCase().includes(vSearch.toLowerCase()) ||
    (v.ownerName   ?? '').toLowerCase().includes(vSearch.toLowerCase())
  ).slice(0, 8);

  // ─── Render ───────────────────────────────────────────────────
  return (
    <Layout activeTab="queue" title="Active Queue">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Active Queue</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage the real-time vehicle waiting queue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchQueue(true)}
            disabled={refreshing}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
          <Button
            onClick={() => { setAddOpen(true); loadVehicles(); }}
            className="bg-blue-600 hover:bg-blue-700 shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add to Queue
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total in Queue', value: total,        bg: 'bg-slate-100',  text: 'text-slate-700',  dot: 'bg-slate-400'  },
          { label: 'Waiting',        value: waitingCount, bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
          { label: 'Called',         value: calledCount,  bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
          { label: 'Auto-refresh',   value: '30s',        bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
        ].map(s => (
          <Card key={s.label} className="border-slate-200 shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', s.bg)}>
                <span className={cn('h-3 w-3 rounded-full', s.dot)} />
              </div>
              <div>
                <p className="text-[11px] text-slate-500">{s.label}</p>
                <p className={cn('text-xl font-bold leading-tight', s.text)}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by vehicle, owner…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 border-slate-300"
          />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-slate-500 hover:text-slate-800">
            Clear
          </button>
        )}
      </div>

      {/* Queue table */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500">Loading queue…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Car className="h-8 w-8 opacity-40" />
          </div>
          <p className="font-semibold text-slate-600 text-lg">Queue is empty</p>
          <p className="text-sm mt-1 text-slate-400">
            {search ? 'No vehicles match your search' : 'Click "Add to Queue" to register a vehicle'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Created At</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Vehicle No.</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Brand</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Owner</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Wait Time</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Added By</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((entry, idx) => {
                  const isWaiting = entry.status === 'WAITING';
                  const isCalled  = entry.status === 'CALLED';
                  const createdDate = new Date(entry.joinedAt);
                  const dateStr = createdDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
                  const timeStr = createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

                  return (
                    <tr 
                      key={entry.id} 
                      className={cn(
                        'hover:bg-slate-50 transition-colors',
                        isCalled && 'bg-blue-50'
                      )}
                    >
                      {/* Position */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={cn(
                          'inline-flex items-center justify-center h-8 w-8 rounded-lg font-bold text-sm',
                          isCalled ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800'
                        )}>
                          {entry.queuePosition}
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                        <div className="flex flex-col">
                          <span className="font-medium">{dateStr}</span>
                          <span className="text-xs text-slate-500">{timeStr}</span>
                        </div>
                      </td>

                      {/* Vehicle No */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-slate-900">{entry.vehicle.vehicleNo}</span>
                      </td>

                      {/* Brand */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {entry.vehicle.companyBrand || '—'}
                      </td>

                      {/* Owner */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {entry.vehicle.ownerName || '—'}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {entry.vehicle.ownerContact || '—'}
                      </td>

                      {/* Wait Time */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn('text-sm font-semibold', waitColor(entry.waitingMinutes))}>
                          {waitLabel(entry.waitingMinutes)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold',
                          isCalled 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        )}>
                          {isCalled && <Bell className="h-3 w-3" />}
                          {entry.status}
                        </span>
                      </td>

                      {/* Added By */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {entry.creator?.fullName || entry.creator?.username}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {/* View button */}
                          <button
                            onClick={() => setViewTarget(entry)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Call button */}
                          {isWaiting && (
                            <button
                              onClick={() => handleCall(entry)}
                              className="px-3 py-1.5 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-xs font-semibold transition-colors"
                              title="Call Vehicle"
                            >
                              Call
                            </button>
                          )}

                          {/* Assign button */}
                          <button
                            onClick={() => openAssign(entry)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-semibold transition-colors"
                            title="Assign to Charger"
                          >
                            Assign
                          </button>

                          {/* Cancel button */}
                          <button
                            onClick={() => setCancelTarget(entry)}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                            title="Cancel"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Add to Queue Modal ══════════════════════════════════ */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Add Vehicle to Queue</h3>
                  <p className="text-xs text-slate-400">Search and select a vehicle</p>
                </div>
              </div>
              <button onClick={() => { setAddOpen(false); setSelectedV(null); setVSearch(''); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">

              {/* Vehicle search */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Vehicle <span className="text-red-500">*</span></Label>
                {selectedV ? (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-blue-600" />
                      <span className="font-bold text-slate-900">{selectedV.vehicleNo}</span>
                      {selectedV.companyBrand && <span className="text-xs text-slate-500">{selectedV.companyBrand}</span>}
                    </div>
                    <button onClick={() => { setSelectedV(null); setVSearch(''); }} className="text-xs text-slate-400 hover:text-red-600">
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search vehicle no., brand, owner…"
                      value={vSearch}
                      onChange={e => setVSearch(e.target.value)}
                      className="pl-9 h-9"
                      autoFocus
                    />
                    {vSearch && (
                      <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                        {vFiltered.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-slate-400 text-center">
                            No vehicles found — will register "{vSearch}" automatically
                          </div>
                        ) : (
                          vFiltered.map(v => (
                            <button
                              key={v.vehicleNo}
                              onClick={() => { setSelectedV(v); setVSearch(''); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors"
                            >
                              <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <Car className="h-3.5 w-3.5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-slate-800">{v.vehicleNo}</p>
                                <p className="text-xs text-slate-400">{[v.companyBrand, v.ownerName].filter(Boolean).join(' · ') || 'No details'}</p>
                              </div>
                            </button>
                          ))
                        )}
                        {/* Allow manual entry */}
                        {vSearch && !vFiltered.find(v => v.vehicleNo.toUpperCase() === vSearch.toUpperCase()) && (
                          <button
                            onClick={() => { setSelectedV({ vehicleNo: vSearch.toUpperCase() }); setVSearch(''); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-left border-t border-slate-100 transition-colors"
                          >
                            <Plus className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            <span className="text-sm font-medium text-blue-700">Register &amp; add "{vSearch.toUpperCase()}"</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Notes (optional)</Label>
                <Input
                  placeholder="e.g. VIP customer, in a hurry…"
                  value={addNotes}
                  onChange={e => setAddNotes(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => { setAddOpen(false); setSelectedV(null); setVSearch(''); }} disabled={adding} className="flex-1 border-slate-300">
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={adding || !selectedV} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {adding ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Adding…</> : 'Add to Queue'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Assign Modal ════════════════════════════════════════ */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-green-100 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Assign to Charger</h3>
                  <p className="text-xs text-slate-400">Vehicle: <span className="font-semibold text-slate-700">{assignTarget.vehicle.vehicleNo}</span></p>
                </div>
              </div>
              <button onClick={() => setAssignTarget(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">

              {/* Charger selection */}
              {chargers.length > 0 ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Available Chargers</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {chargers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setAssignForm(f => ({
                          ...f,
                          chargerId:   c.chargerId,
                          chargerType: (c.category?.name as 'GBT' | 'CCS2') || 'GBT',
                        }))}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left',
                          assignForm.chargerId === c.chargerId
                            ? 'bg-green-600 text-white border-green-600 shadow-sm'
                            : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50',
                        )}
                      >
                        <Zap className="h-3.5 w-3.5 flex-shrink-0" />
                        <div>
                          <p className="font-bold text-xs">{c.chargerId}</p>
                          <p className={cn('text-[10px]', assignForm.chargerId === c.chargerId ? 'text-green-100' : 'text-slate-400')}>
                            {c.displayName}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Manual charger ID + type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Charger ID <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="e.g. GBT-1"
                    value={assignForm.chargerId}
                    onChange={e => setAssignForm(f => ({ ...f, chargerId: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Charger Type <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2">
                    {(['GBT', 'CCS2'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setAssignForm(f => ({ ...f, chargerType: t }))}
                        className={cn(
                          'flex-1 h-9 rounded-md border text-sm font-semibold transition-all',
                          assignForm.chargerType === t
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-slate-300 text-slate-600 hover:border-blue-300',
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Optional session data */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Arrival SOC %</Label>
                  <Input
                    type="number" min={0} max={100}
                    placeholder="e.g. 20"
                    value={assignForm.arrivalSoc}
                    onChange={e => setAssignForm(f => ({ ...f, arrivalSoc: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Rate / %</Label>
                  <Input
                    type="number" min={0}
                    placeholder="e.g. 7"
                    value={assignForm.ratePerPercent}
                    onChange={e => setAssignForm(f => ({ ...f, ratePerPercent: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Payment method */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Payment Method</Label>
                <div className="flex gap-2">
                  {['Cash', 'Bank/QR'].map(pm => (
                    <button
                      key={pm}
                      onClick={() => setAssignForm(f => ({ ...f, paymentMethod: pm }))}
                      className={cn(
                        'flex-1 h-9 rounded-md border text-sm font-medium transition-all',
                        assignForm.paymentMethod === pm
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'border-slate-300 text-slate-600 hover:border-slate-400',
                      )}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info note */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>An <strong>ongoing</strong> charging session will be created. Update Departure SOC in the Sessions page when charging is complete.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setAssignTarget(null)} disabled={assigning} className="flex-1 border-slate-300">
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={assigning} className="flex-1 bg-green-600 hover:bg-green-700">
                {assigning
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Assigning…</>
                  : <><CheckCircle2 className="h-4 w-4 mr-1.5" />Assign Charger</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Cancel Confirm ═══════════════════════════════════════ */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-1">Remove from Queue?</h3>
            <p className="text-sm text-slate-500 mb-5">
              Vehicle <span className="font-semibold text-slate-800">{cancelTarget.vehicle.vehicleNo}</span> (position #{cancelTarget.queuePosition}) will be cancelled. This is preserved in history.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-slate-300" onClick={() => setCancelTarget(null)} disabled={cancelling}>
                Keep
              </Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Cancelling…</> : 'Cancel Entry'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══ View Details Modal ══════════════════════════════════ */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'h-12 w-12 rounded-xl flex items-center justify-center font-bold text-xl shadow-sm',
                  viewTarget.status === 'CALLED' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'
                )}>
                  {viewTarget.queuePosition}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Queue Entry Details</h3>
                  <p className="text-xs text-slate-500">Position #{viewTarget.queuePosition} in queue</p>
                </div>
              </div>
              <button 
                onClick={() => setViewTarget(null)} 
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Vehicle Information */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Vehicle Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Vehicle Number</Label>
                    <p className="font-bold text-lg text-slate-900">{viewTarget.vehicle.vehicleNo}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Brand / Company</Label>
                    <p className="font-semibold text-slate-700">{viewTarget.vehicle.companyBrand || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Owner Name</Label>
                    <p className="font-semibold text-slate-700">{viewTarget.vehicle.ownerName || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Contact Number</Label>
                    <p className="font-semibold text-slate-700">{viewTarget.vehicle.ownerContact || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Queue Status */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Queue Status</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Status</Label>
                    <span className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold',
                      viewTarget.status === 'CALLED' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    )}>
                      {viewTarget.status === 'CALLED' && <Bell className="h-4 w-4" />}
                      {viewTarget.status}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Wait Time</Label>
                    <p className={cn('font-bold text-lg', waitColor(viewTarget.waitingMinutes))}>
                      {waitLabel(viewTarget.waitingMinutes)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Created At</Label>
                    <p className="font-semibold text-slate-700">
                      {new Date(viewTarget.joinedAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                      <br />
                      <span className="text-sm text-slate-500">
                        {new Date(viewTarget.joinedAt).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Added By</Label>
                    <p className="font-semibold text-slate-700">
                      {viewTarget.creator?.fullName || viewTarget.creator?.username}
                    </p>
                  </div>
                </div>
              </div>

              {/* Called Information (if applicable) */}
              {viewTarget.status === 'CALLED' && viewTarget.caller && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Called Status
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-blue-600">Called By</Label>
                      <p className="font-semibold text-blue-900">
                        {viewTarget.caller.fullName || viewTarget.caller.username}
                      </p>
                    </div>
                    {viewTarget.calledAt && (
                      <div className="space-y-1">
                        <Label className="text-xs text-blue-600">Called At</Label>
                        <p className="font-semibold text-blue-900 text-sm">
                          {new Date(viewTarget.calledAt).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewTarget.notes && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</h4>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-slate-700 italic">"{viewTarget.notes}"</p>
                  </div>
                </div>
              )}

              {!viewTarget.notes && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-400">No notes available for this entry</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              {viewTarget.status === 'WAITING' && (
                <Button 
                  onClick={() => {
                    handleCall(viewTarget);
                    setViewTarget(null);
                  }}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Call Vehicle
                </Button>
              )}
              <Button 
                onClick={() => {
                  openAssign(viewTarget);
                  setViewTarget(null);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Zap className="h-4 w-4 mr-2" />
                Assign to Charger
              </Button>
              <Button 
                variant="outline"
                onClick={() => setViewTarget(null)}
                className="border-slate-300"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
