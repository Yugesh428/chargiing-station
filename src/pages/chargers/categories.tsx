import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Plus, Pencil, Trash2, CheckCircle2, XCircle,
  Tag, Zap, Loader2, Search, ToggleLeft, ToggleRight,
} from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface ChargerCategory {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  powerOutput?: number;
  connectorType?: string;
  voltage?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  name:          '',
  displayName:   '',
  description:   '',
  powerOutput:   '',
  connectorType: '',
  voltage:       '',
};

export default function ChargerCategoriesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [categories, setCategories] = useState<ChargerCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');

  // Modal state
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<ChargerCategory | null>(null);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ChargerCategory | null>(null);
  const [deleting, setDeleting]         = useState(false);

  function authHeaders() {
    const token = localStorage.getItem('token');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  async function fetchCategories() {
    setLoading(true);
    try {
      const res = await fetch('/api/chargers/categories', { headers: authHeaders() });
      if (res.status === 401) { router.push('/'); return; }
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load categories', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCategories(); }, []);

  // ── Open modal ──────────────────────────────────────────────
  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(cat: ChargerCategory) {
    setEditing(cat);
    setForm({
      name:          cat.name,
      displayName:   cat.displayName,
      description:   cat.description   ?? '',
      powerOutput:   cat.powerOutput   != null ? String(cat.powerOutput) : '',
      connectorType: cat.connectorType ?? '',
      voltage:       cat.voltage       != null ? String(cat.voltage) : '',
    });
    setModalOpen(true);
  }

  // ── Save ────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.name.trim())        return toast({ title: 'Name is required', variant: 'destructive' });
    if (!form.displayName.trim()) return toast({ title: 'Display name is required', variant: 'destructive' });

    setSaving(true);
    try {
      const body = {
        name:          form.name,
        displayName:   form.displayName,
        description:   form.description   || null,
        powerOutput:   form.powerOutput   ? Number(form.powerOutput)  : null,
        connectorType: form.connectorType || null,
        voltage:       form.voltage       ? Number(form.voltage)      : null,
      };

      const res = editing
        ? await fetch(`/api/chargers/categories?id=${editing.id}`, {
            method: 'PUT', headers: authHeaders(), body: JSON.stringify(body),
          })
        : await fetch('/api/chargers/categories', {
            method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
          });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Error', description: data.message, variant: 'destructive' });
        return;
      }

      toast({ title: editing ? 'Category updated' : 'Category created', description: data.category.displayName });
      setModalOpen(false);
      fetchCategories();
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle active ───────────────────────────────────────────
  async function toggleActive(cat: ChargerCategory) {
    try {
      const res = await fetch(`/api/chargers/categories?id=${cat.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      if (!res.ok) throw new Error();
      toast({ title: cat.isActive ? 'Category deactivated' : 'Category activated' });
      fetchCategories();
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  }

  // ── Delete ──────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/chargers/categories?id=${deleteTarget.id}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Error', description: data.message, variant: 'destructive' }); return; }
      toast({ title: 'Category deactivated', description: deleteTarget.displayName });
      setDeleteTarget(null);
      fetchCategories();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  // ── Filtered list ───────────────────────────────────────────
  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (c.connectorType ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Connector type badge colour ─────────────────────────────
  function connectorBadge(type?: string) {
    if (!type) return null;
    const color = type.toUpperCase() === 'DC' ? 'bg-blue-100 text-blue-700'
                : type.toUpperCase() === 'AC' ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600';
    return <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', color)}>{type}</span>;
  }

  return (
    <Layout activeTab="charger-categories" title="Charger Categories">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Charger Categories</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage charging connector types and their specifications
          </p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Category
        </Button>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total',    value: categories.length,                          color: 'text-slate-700', bg: 'bg-slate-100' },
          { label: 'Active',   value: categories.filter(c => c.isActive).length,  color: 'text-green-700', bg: 'bg-green-100' },
          { label: 'Inactive', value: categories.filter(c => !c.isActive).length, color: 'text-red-700',   bg: 'bg-red-100'   },
          { label: 'DC',       value: categories.filter(c => c.connectorType?.toUpperCase() === 'DC').length, color: 'text-blue-700', bg: 'bg-blue-100' },
        ].map(s => (
          <Card key={s.label} className="border-slate-200 shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', s.bg)}>
                <Tag className={cn('h-4 w-4', s.color)} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search categories…"
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

      {/* ── Table ── */}
      <Card className="border-slate-200 shadow-none">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-slate-500">Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Tag className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No categories found</p>
              <p className="text-sm mt-1">{search ? 'Try a different search term' : 'Click "Add Category" to create one'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Display Name</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden md:table-cell">Type</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden lg:table-cell">Power</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden lg:table-cell">Voltage</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(cat => (
                    <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                      {/* Name badge */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Zap className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="font-bold text-slate-800">{cat.name}</span>
                        </div>
                      </td>

                      {/* Display name + description */}
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-700">{cat.displayName}</p>
                        {cat.description && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{cat.description}</p>
                        )}
                      </td>

                      {/* Connector type */}
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        {connectorBadge(cat.connectorType) ?? <span className="text-slate-300">—</span>}
                      </td>

                      {/* Power output */}
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        {cat.powerOutput != null
                          ? <span className="font-medium text-slate-700">{cat.powerOutput} <span className="text-xs text-slate-400">kW</span></span>
                          : <span className="text-slate-300">—</span>}
                      </td>

                      {/* Voltage */}
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        {cat.voltage != null
                          ? <span className="font-medium text-slate-700">{cat.voltage} <span className="text-xs text-slate-400">V</span></span>
                          : <span className="text-slate-300">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        {cat.isActive
                          ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Active
                            </span>
                          : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-0.5">
                              <XCircle className="h-3.5 w-3.5" /> Inactive
                            </span>}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Toggle active */}
                          <button
                            onClick={() => toggleActive(cat)}
                            title={cat.isActive ? 'Deactivate' : 'Activate'}
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            {cat.isActive
                              ? <ToggleRight className="h-4 w-4 text-green-500" />
                              : <ToggleLeft  className="h-4 w-4" />}
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => openEdit(cat)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(cat)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create / Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Tag className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    {editing ? 'Edit Category' : 'New Charger Category'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editing ? `Updating ${editing.name}` : 'Define a new connector type'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">

              {/* Row 1: Name + Display Name */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Short Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. GBT"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
                    className="h-9 text-sm uppercase"
                    maxLength={20}
                  />
                  <p className="text-[10px] text-slate-400">Used as a code (auto-uppercased)</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Display Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. GBT Fast Charger"
                    value={form.displayName}
                    onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Row 2: Connector + Power + Voltage */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Connector</Label>
                  <select
                    value={form.connectorType}
                    onChange={e => setForm(f => ({ ...f, connectorType: e.target.value }))}
                    className="w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">—</option>
                    <option value="DC">DC</option>
                    <option value="AC">AC</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Power (kW)</Label>
                  <Input
                    type="number" min={0} placeholder="e.g. 60"
                    value={form.powerOutput}
                    onChange={e => setForm(f => ({ ...f, powerOutput: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Voltage (V)</Label>
                  <Input
                    type="number" min={0} placeholder="e.g. 400"
                    value={form.voltage}
                    onChange={e => setForm(f => ({ ...f, voltage: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Description</Label>
                <textarea
                  rows={2}
                  placeholder="Optional description…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="border-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 min-w-[100px]"
              >
                {saving
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving…</>
                  : editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-1">Deactivate Category?</h3>
            <p className="text-sm text-slate-500 mb-5">
              <span className="font-semibold text-slate-700">"{deleteTarget.displayName}"</span> will be
              marked as inactive. Existing chargers using this category will not be affected.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-slate-300"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Deactivating…</>
                  : 'Deactivate'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
