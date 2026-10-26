import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Plus, X, CheckCircle2, Building2 } from 'lucide-react';

const statusVariant: any = { active: 'success', trial: 'warning', suspended: 'destructive', cancelled: 'secondary' };

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', stationName: '', email: '', phone: '', address: '',
    adminUsername: '', adminEmail: '', adminPassword: '', adminFullName: '',
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const loadTenants = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/tenants', { headers });
      const d = await r.json();
      setTenants(d.tenants || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadTenants(); }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/tenants', { method: 'POST', headers, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setSuccess(`Tenant "${d.tenant.stationName}" created! Admin: ${d.tenant.admin.email}`);
      setShowForm(false);
      setForm({ name: '', stationName: '', email: '', phone: '', address: '', adminUsername: '', adminEmail: '', adminPassword: '', adminFullName: '' });
      loadTenants();
    } catch (err: any) { setError(err.message); }
    setSaving(false);
  };

  const handleToggle = async (tenant: any) => {
    if (!confirm(`${tenant.isActive ? 'Deactivate' : 'Activate'} tenant "${tenant.stationName}"?`)) return;
    await fetch(`/api/tenants/${tenant.id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ isActive: !tenant.isActive }),
    });
    loadTenants();
  };

  return (
    <Layout activeTab="tenants" title="Tenants">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Tenants</h2>
          <p className="text-sm text-slate-500 mt-0.5">{tenants.length} charging station{tenants.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => { setShowForm(true); setError(''); setSuccess(''); }}
          className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="h-4 w-4" /> New Tenant
        </Button>
      </div>

      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 mb-5">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800 font-medium">{success}</p>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <Card className="border-blue-200 bg-blue-50 mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-blue-900">Create New Tenant</CardTitle>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <CardDescription className="text-blue-700">Fill in station info and admin account details</CardDescription>
          </CardHeader>
          <CardContent>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 mb-4 text-sm text-red-700">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase mb-3">Station Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Tenant / Owner Name *</Label>
                    <Input placeholder="e.g. Lekali Pvt. Ltd." value={form.name} onChange={e => set('name', e.target.value)} required className="bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Station Name *</Label>
                    <Input placeholder="e.g. Lekali EV Charging Station" value={form.stationName} onChange={e => set('stationName', e.target.value)} required className="bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <Input type="email" placeholder="station@email.com" value={form.email} onChange={e => set('email', e.target.value)} required className="bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input placeholder="98XXXXXXXX" value={form.phone} onChange={e => set('phone', e.target.value)} className="bg-white" />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Address</Label>
                    <Input placeholder="Kathmandu, Nepal" value={form.address} onChange={e => set('address', e.target.value)} className="bg-white" />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase mb-3">Admin Account</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Full Name *</Label>
                    <Input placeholder="Admin Full Name" value={form.adminFullName} onChange={e => set('adminFullName', e.target.value)} required className="bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Username *</Label>
                    <Input placeholder="lekali_admin" value={form.adminUsername} onChange={e => set('adminUsername', e.target.value)} required className="bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Admin Email *</Label>
                    <Input type="email" placeholder="admin@station.com" value={form.adminEmail} onChange={e => set('adminEmail', e.target.value)} required className="bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password *</Label>
                    <Input type="password" placeholder="Min 8 characters" value={form.adminPassword} onChange={e => set('adminPassword', e.target.value)} required className="bg-white" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saving ? 'Creating...' : 'Create Tenant'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tenants Table */}
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : tenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Building2 className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No tenants yet</p>
              <p className="text-xs mt-1">Click "New Tenant" to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Station Name', 'Owner', 'Email', 'Phone', 'Status', 'Subscription', 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t: any) => (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{t.stationName}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{t.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{t.email}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{t.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={t.isActive ? 'success' : 'secondary'} className="text-xs">
                          {t.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[t.subscriptionStatus] || 'secondary'} className="text-xs capitalize">
                          {t.subscriptionStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                        {String(t.createdAt).slice(0, 10)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => handleToggle(t)}
                          className={t.isActive ? 'text-red-600 hover:bg-red-50 border-red-200' : 'text-green-600 hover:bg-green-50 border-green-200'}>
                          {t.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
