import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Plus, Pencil, Trash2, Loader2, Search,
  Zap, CheckCircle2, XCircle, Wrench, AlertCircle,
  Tag, MapPin, Calendar, ToggleLeft, ToggleRight, Filter,
} from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────
type ChargerStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

interface Category {
  id: string;
  name: string;
  displayName: string;
  connectorType?: string;
  powerOutput?: number;
}

interface Charger {
  id: string;
  chargerId: string;
  displayName: string;
  categoryId: string;
  category: Category;
  location?: string;
  status: ChargerStatus;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  installationDate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = {
  categoryId:       '',
  chargerId:        '',
  displayName:      '',
  location:         '',
  status:           'AVAILABLE' as ChargerStatus,
  serialNumber:     '',
  manufacturer:     '',
  model:            '',
  installationDate: '',
  notes:            '',
};

// ─── Status config ────────────────────────────────────────────
const STATUS_CONFIG: Record<ChargerStatus, { label: string; icon: any; badge: string; dot: string }> = {
  AVAILABLE:       { label: 'Available',       icon: CheckCircle2, badge: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500'  },
  OCCUPIED:        { label: 'Occupied',         icon: Zap,          badge: 'bg-blue-100 text-blue-700 border-blue-200',    dot: 'bg-blue-500'   },
  MAINTENANCE:     { label: 'Maintenance',      icon: Wrench,       badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  OUT_OF_SERVICE:  { label: 'Out of Service',   icon: XCircle,      badge: 'bg-red-100 text-red-700 border-red-200',       dot: 'bg-red-500'    },
};

// ─── Page ─────────────────────────────────────────────────────
export default function ChargersPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [chargers,   setChargers]   = useState<Charger[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [filterCat,  setFilterCat]  = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal
  const [modalOpen,     setModalOpen]     = useState(false);
  const [editing,       setEditing]       = useState<Charger | null>(null);
  const [form,          setForm]          = useState(emptyForm);
  const [saving,        setSaving]        = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Charger | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // Status change
  const [statusTarget, setStatusTarget] = useState<Charger | null>(null);
  const [newStatus,    setNewStatus]    = useState<ChargerStatus>('AVAILABLE');
  const [statusSaving, setStatusSaving] = useState(false);

  function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const [cRes, catRes] = await Promise.all([
        fetch('/api/chargers',            { headers: authHeaders() }),
        fetch('/api/chargers/categories', { headers: authHeaders() }),
      ]);
      if (cRes.status === 401 || catRes.status === 401) { router.push('/'); return; }
      const [cData, catData] = await Promise.all([cRes.json(), catRes.json()]);
      setChargers(cData.chargers   || []);
      setCategories((catData.categories || []).filter((c: any) => c.isActive));
    } catch {
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  // ── Modal helpers ─────────────────────────────────────────
  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id || '' });
    setModalOpen(true);
  }

  function openEdit(c: Charger) {
    setEditing(c);
    setForm({
      categoryId:       c.categoryId,
      chargerId:        c.chargerId,
      displayName:      c.displayName,
      location:         c.location         ?? '',
      status:           c.status,
      serialNumber:     c.serialNumber     ?? '',
      manufacturer:     c.manufacturer     ?? '',
      model:            c.model            ?? '',
      installationDate: c.installationDate ?? '',
      notes:            c.notes            ?? '',
    });
    setModalOpen(true);
  }

  // ── Save ─────────────────────────────────────────────────
  async function handleSave() {
    if (!form.categoryId)        return toast({ title: 'Select a category',         variant: 'destructive' });
    if (!form.chargerId.trim())  return toast({ title: 'Charger ID is required',    variant: 'destructive' });
    if (!form.displayName.trim()) return toast({ title: 'Display name is required', variant: 'destructive' });

    setSaving(true);
    try {
      const body = {
        categoryId:       form.categoryId,
        chargerId:        form.chargerId.trim(),
        displayName:      form.displayName.trim(),
        location:         form.location         || null,
        status:           form.status,
        serialNumber:     form.serialNumber     || null,
        manufacturer:     form.manufacturer     || null,
        model:            form.model            || null,
        installationDate: form.installationDate || null,
        notes:            form.notes            || null,
      };

      const res = editing
        ? await fetch(`/api/chargers?id=${editing.id}`, { method: 'PUT',  headers: authHeaders(), body: JSON.stringify(body) })
        : await fetch('/api/chargers',                   { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });

      const data = await res.json();
      if (!res.ok) { toast({ title: 'Error', description: data.message, variant: 'destructive' }); return; }

      toast({ title: editing ? 'Charger updated' : 'Charger created', description: data.charger.displayName });
      setModalOpen(false);
      fetchAll();
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // ── Quick status change ───────────────────────────────────
  async function handleStatusChange() {
    if (!statusTarget) return;
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/chargers?id=${statusTarget.id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Status updated', description: `${statusTarget.displayName} → ${STATUS_CONFIG[newStatus].label}` });
      setStatusTarget(null);
      fetchAll();
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    } finally {
      setStatusSaving(false);
    }
  }

  // ── Toggle active ─────────────────────────────────────────
  async function toggleActive(c: Charger) {
    try {
      const res = await fetch(`/api/chargers?id=${c.id}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ isActive: !c.isActive }),
      });
      if (!res.ok) throw new Error();
      toast({ title: c.isActive ? 'Charger deactivated' : 'Charger activated' });
      fetchAll();
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle status', variant: 'destructive' });
    }
  }

  // ── Delete ───────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/chargers?id=${deleteTarget.id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error();
      toast({ title: 'Charger deactivated', description: deleteTarget.displayName });
      setDeleteTarget(null);
      fetchAll();
    } catch {
      toast({ title: 'Error', description: 'Failed to deactivate', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  // ── Filtered list ─────────────────────────────────────────
  const filtered = chargers.filter(c => {
    const matchSearch = !search ||
      c.chargerId.toLowerCase().includes(search.toLowerCase()) ||
      c.displayName.toLowerCase().includes(search.toLowerCase()) ||
      (c.location ?? '').toLowerCase().includes(search.toLowerCase());
    const matchCat    = !filterCat    || c.categoryId === filterCat;
    const matchStatus = !filterStatus || c.status     === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  // ── Stats ─────────────────────────────────────────────────
  const stats = {
    total:      chargers.length,
    available:  chargers.filter(c => c.status === 'AVAILABLE'      && c.isActive).length,
    occupied:   chargers.filter(c => c.status === 'OCCUPIED'       && c.isActive).length,
    maintenance:chargers.filter(c => c.status === 'MAINTENANCE'    && c.isActive).length,
    offline:    chargers.filter(c => c.status === 'OUT_OF_SERVICE' || !c.isActive).length,
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <Layout activeTab="chargers" title="Chargers">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Chargers</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage all individual charging units</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Charger
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total',       value: stats.total,       color: 'text-slate-700',  bg: 'bg-slate-100',  dot: 'bg-slate-400'  },
          { label: 'Available',   value: stats.available,   color: 'text-green-700',  bg: 'bg-green-100',  dot: 'bg-green-500'  },
          { label: 'Occupied',    value: stats.occupied,    color: 'text-blue-700',   bg: 'bg-blue-100',   dot: 'bg-blue-500'   },
          { label: 'Maintenance', value: stats.maintenance, color: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
          { label: 'Offline',     value: stats.offline,     color: 'text-red-700',    bg: 'bg-red-100',    dot: 'bg-red-500'    },
        ].map(s => (
          <Card key={s.label} className="border-slate-200 shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', s.bg)}>
                <span className={cn('h-3 w-3 rounded-full', s.dot)} />
              </div>
              <div>
                <p className="text-[11px] text-slate-500">{s.label}</p>
                <p className={cn('text-xl font-bold leading-tight', s.color)}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search chargers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 border-slate-300"
          />
        </div>

        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        {(search || filterCat || filterStatus) && (
          <button
            onClick={() => { setSearch(''); setFilterCat(''); setFilterStatus(''); }}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            <Filter className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <Card className="border-slate-200 shadow-none">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-slate-500">Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Zap className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No chargers found</p>
              <p className="text-sm mt-1">
                {search || filterCat || filterStatus
                  ? 'Try different filters'
                  : 'Click "Add Charger" to register your first charger'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Charger ID', 'Category', 'Location', 'Status', 'Manufacturer / Model', 'Active', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(c => {
                    const sc = STATUS_CONFIG[c.status];
                    const StatusIcon = sc.icon;
                    return (
                      <tr key={c.id} className={cn('hover:bg-slate-50 transition-colors', !c.isActive && 'opacity-50')}>

                        {/* Charger ID */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Zap className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{c.chargerId}</p>
                              <p className="text-[11px] text-slate-400">{c.displayName}</p>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3.5">
                          <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-full">
                            <Tag className="h-3 w-3 text-slate-500" />
                            <span className="text-xs font-semibold text-slate-700">{c.category?.name ?? '—'}</span>
                          </div>
                          {c.category?.powerOutput != null && (
                            <p className="text-[11px] text-slate-400 mt-0.5 ml-1">{c.category.powerOutput} kW · {c.category.connectorType}</p>
                          )}
                        </td>

                        {/* Location */}
                        <td className="px-4 py-3.5">
                          {c.location
                            ? <div className="flex items-center gap-1.5 text-slate-600"><MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />{c.location}</div>
                            : <span className="text-slate-300">—</span>}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => { setStatusTarget(c); setNewStatus(c.status); }}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all hover:opacity-80',
                              sc.badge,
                            )}
                          >
                            <span className={cn('h-2 w-2 rounded-full flex-shrink-0', sc.dot.replace('bg-', 'bg-'))} />
                            {sc.label}
                          </button>
                        </td>

                        {/* Manufacturer / Model */}
                        <td className="px-4 py-3.5">
                          {c.manufacturer || c.model
                            ? <div>
                                {c.manufacturer && <p className="text-slate-700 font-medium">{c.manufacturer}</p>}
                                {c.model        && <p className="text-xs text-slate-400">{c.model}</p>}
                              </div>
                            : <span className="text-slate-300">—</span>}
                        </td>

                        {/* Active toggle */}
                        <td className="px-4 py-3.5">
                          <button onClick={() => toggleActive(c)} title={c.isActive ? 'Deactivate' : 'Activate'}>
                            {c.isActive
                              ? <ToggleRight className="h-6 w-6 text-green-500" />
                              : <ToggleLeft  className="h-6 w-6 text-slate-400" />}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══ Create / Edit Modal ══════════════════════════════════ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{editing ? 'Edit Charger' : 'Add New Charger'}</h3>
                  <p className="text-xs text-slate-400">{editing ? `Updating ${editing.chargerId}` : 'Register a new charging unit'}</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4 overflow-y-auto">

              {/* Category + Charger ID */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Category <span className="text-red-500">*</span></Label>
                  <select
                    value={form.categoryId}
                    onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                    className="w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Charger ID <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="e.g. GBT-1"
                    value={form.chargerId}
                    onChange={e => setForm(f => ({ ...f, chargerId: e.target.value }))}
                    className="h-9 text-sm"
                    disabled={!!editing}
                  />
                  <p className="text-[10px] text-slate-400">Unique identifier, cannot change after creation</p>
                </div>
              </div>

              {/* Display name + Location */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Display Name <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="e.g. Bay 1 – GBT"
                    value={form.displayName}
                    onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Location</Label>
                  <Input
                    placeholder="e.g. Bay 1, Zone A"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Status</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.entries(STATUS_CONFIG) as [ChargerStatus, typeof STATUS_CONFIG[ChargerStatus]][]).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, status: key }))}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                          form.status === key
                            ? cn(cfg.badge, 'ring-2 ring-offset-1 ring-current')
                            : 'border-slate-200 text-slate-500 hover:border-slate-300',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Manufacturer + Model + Serial */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Manufacturer</Label>
                  <Input placeholder="e.g. ABB" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Model</Label>
                  <Input placeholder="e.g. Terra 54" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Serial No.</Label>
                  <Input placeholder="Serial number" value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} className="h-9 text-sm" />
                </div>
              </div>

              {/* Installation Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Installation Date</Label>
                <Input
                  type="date"
                  value={form.installationDate}
                  onChange={e => setForm(f => ({ ...f, installationDate: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Notes</Label>
                <textarea
                  rows={2}
                  placeholder="Optional notes…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving} className="border-slate-300">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 min-w-[100px]">
                {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Quick Status Modal ═══════════════════════════════════ */}
      {statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-slate-900 mb-1">Change Status</h3>
            <p className="text-sm text-slate-500 mb-4">Update status for <span className="font-semibold text-slate-700">{statusTarget.chargerId}</span></p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {(Object.entries(STATUS_CONFIG) as [ChargerStatus, typeof STATUS_CONFIG[ChargerStatus]][]).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setNewStatus(key)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                      newStatus === key
                        ? cn(cfg.badge, 'ring-2 ring-offset-1 ring-current')
                        : 'border-slate-200 text-slate-600 hover:border-slate-300',
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />{cfg.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-slate-300" onClick={() => setStatusTarget(null)} disabled={statusSaving}>Cancel</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleStatusChange} disabled={statusSaving}>
                {statusSaving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : 'Update'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Delete Confirm ════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-1">Deactivate Charger?</h3>
            <p className="text-sm text-slate-500 mb-5">
              <span className="font-semibold text-slate-700">"{deleteTarget.displayName}"</span> will be marked as inactive. Historical data is preserved.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-slate-300" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting}>
                {deleting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Deactivating…</> : 'Deactivate'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
