import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Plus, Pencil, Trash2, Car, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';

type Tab = 'sessions' | 'registered';

export default function Vehicles() {
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('sessions');
  const [fromSessions, setFromSessions] = useState<any[]>([]);
  const [ownerRegistered, setOwnerRegistered] = useState<any[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<any[]>([]);
  const [filteredRegistered, setFilteredRegistered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add/Edit modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    vehicleNo: '',
    companyBrand: '',
    ownerName: '',
    ownerContact: '',
    notes: '',
    settlementFrequency: 'monthly',
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadVehicles = () => {
    setLoading(true);
    fetch('/api/vehicles', { headers })
      .then(r => r.json())
      .then(d => {
        setFromSessions(d.fromSessions || []);
        setOwnerRegistered(d.ownerRegistered || []);
        setFilteredSessions(d.fromSessions || []);
        setFilteredRegistered(d.ownerRegistered || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadVehicles(); }, []);

  // Search filter
  useEffect(() => {
    const q = search.toLowerCase();
    if (!q) {
      setFilteredSessions(fromSessions);
      setFilteredRegistered(ownerRegistered);
      return;
    }
    setFilteredSessions(fromSessions.filter((v: any) =>
      v.vehicleNo?.toLowerCase().includes(q) ||
      v.companyBrand?.toLowerCase().includes(q) ||
      v.ownerName?.toLowerCase().includes(q)
    ));
    setFilteredRegistered(ownerRegistered.filter((v: any) =>
      v.vehicleNo?.toLowerCase().includes(q) ||
      v.companyBrand?.toLowerCase().includes(q) ||
      v.ownerName?.toLowerCase().includes(q)
    ));
  }, [search, fromSessions, ownerRegistered]);

  const handleAdd = () => {
    setFormData({ vehicleNo: '', companyBrand: '', ownerName: '', ownerContact: '', notes: '', settlementFrequency: 'monthly' });
    setShowAddModal(true);
  };

  const handleEdit = (vehicle: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingVehicle(vehicle);
    setFormData({
      vehicleNo: vehicle.vehicleNo,
      companyBrand: vehicle.companyBrand || '',
      ownerName: vehicle.ownerName || '',
      ownerContact: vehicle.ownerContact || '',
      notes: vehicle.notes || '',
      settlementFrequency: vehicle.settlementFrequency || 'monthly',
    });
    setShowEditModal(true);
  };

  const handleDelete = async (vehicleNo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete vehicle ${vehicleNo}? This will also delete ALL associated charging sessions. This cannot be undone.`)) return;
    setDeleting(vehicleNo);
    try {
      const res = await fetch(`/api/vehicles/${encodeURIComponent(vehicleNo)}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Vehicle Deleted', description: `Deleted ${vehicleNo} and ${data.deletedSessions} session(s).` });
        loadVehicles();
      } else {
        toast({ title: 'Delete Failed', description: data.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = showEditModal ? `/api/vehicles/${encodeURIComponent(editingVehicle.vehicleNo)}` : '/api/vehicles';
      const method = showEditModal ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(formData) });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: showEditModal ? 'Vehicle Updated' : 'Vehicle Added',
          description: showEditModal
            ? `Updated ${formData.vehicleNo} successfully`
            : `Added ${formData.vehicleNo} successfully`,
        });
        closeModals();
        loadVehicles();
      } else {
        toast({ title: showEditModal ? 'Update Failed' : 'Add Failed', description: data.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingVehicle(null);
    setSaving(false);
  };

  // Shared table columns renderer
  const renderSessionRow = (v: any) => (
    <tr
      key={v.vehicleNo}
      onClick={() => router.push(`/vehicles/${encodeURIComponent(v.vehicleNo)}`)}
      className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
    >
      <td className="px-4 py-2.5">
        <div className="font-bold text-blue-700 text-sm">{v.vehicleNo}</div>
        {v.ownerName && <div className="text-xs text-slate-400 mt-0.5">{v.ownerName}</div>}
      </td>
      <td className="px-4 py-2.5 text-sm text-slate-600">{v.companyBrand || '—'}</td>
      <td className="px-4 py-2.5 text-sm text-slate-500 whitespace-nowrap">{v.firstVisit ? String(v.firstVisit).slice(0, 10) : '—'}</td>
      <td className="px-4 py-2.5 text-sm text-slate-500 whitespace-nowrap">{v.lastVisit ? String(v.lastVisit).slice(0, 10) : '—'}</td>
      <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{v.totalVisits}</td>
      <td className="px-4 py-2.5 text-sm text-slate-700">{parseFloat(v.totalCharged || 0).toFixed(0)}%</td>
      <td className="px-4 py-2.5 text-sm font-semibold text-green-700">Rs. {parseFloat(v.totalRevenue || 0).toLocaleString()}</td>
      <td className="px-4 py-2.5 text-sm text-slate-600">{v.lastRate || '—'}</td>
      <td className="px-4 py-2.5 text-sm font-medium text-red-600">
        {parseFloat(v.totalOutstanding || 0) > 0 ? `Rs. ${parseFloat(v.totalOutstanding).toLocaleString()}` : '—'}
      </td>
      <td className="px-4 py-2.5">
        {v.isRegistered
          ? <Badge variant="success" className="text-xs">Registered</Badge>
          : <Badge variant="warning" className="text-xs">Session Only</Badge>
        }
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <Button onClick={(e) => handleEdit(v, e)} size="sm" variant="outline"
            className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button onClick={(e) => handleDelete(v.vehicleNo, e)} disabled={deleting === v.vehicleNo}
            size="sm" variant="outline"
            className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-700 hover:border-red-300">
            {deleting === v.vehicleNo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </Button>
        </div>
      </td>
    </tr>
  );

  const renderRegisteredRow = (v: any) => (
    <tr
      key={v.vehicleNo}
      onClick={() => router.push(`/vehicles/${encodeURIComponent(v.vehicleNo)}`)}
      className="border-b border-slate-100 hover:bg-purple-50 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3">
        <div className="font-bold text-purple-700 text-sm">{v.vehicleNo}</div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">{v.ownerName || '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{v.ownerContact || '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{v.companyBrand || '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-500">{v.notes || '—'}</td>
      <td className="px-4 py-3">
        {v.hasSessions ? (
          <div className="text-sm">
            <span className="font-medium text-slate-900">{v.totalVisits}</span>
            <span className="text-slate-400 ml-1">visits</span>
            <div className="text-xs text-green-700 font-medium">Rs. {parseFloat(v.totalRevenue || 0).toLocaleString()}</div>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">No sessions yet</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
        {v.registeredAt ? String(v.registeredAt).slice(0, 10) : '—'}
      </td>
      <td className="px-4 py-3">
        {v.hasSessions
          ? <Badge variant="success" className="text-xs">Active</Badge>
          : <Badge variant="default" className="text-xs">Registered</Badge>
        }
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <Button onClick={(e) => handleEdit(v, e)} size="sm" variant="outline"
            className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button onClick={(e) => handleDelete(v.vehicleNo, e)} disabled={deleting === v.vehicleNo}
            size="sm" variant="outline"
            className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-700 hover:border-red-300">
            {deleting === v.vehicleNo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </Button>
        </div>
      </td>
    </tr>
  );

  return (
    <Layout activeTab="vehicles" title="Vehicle Master">
      <Toaster />

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
              <h3 className="text-lg font-bold text-slate-900">
                {showEditModal ? 'Edit Vehicle' : 'Register New Vehicle'}
              </h3>
              <button onClick={closeModals} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Vehicle No. *</Label>
                <Input value={formData.vehicleNo}
                  onChange={e => setFormData({ ...formData, vehicleNo: e.target.value })}
                  placeholder="e.g. BA 1 PA 800" required disabled={showEditModal} className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Owner Name</Label>
                  <Input value={formData.ownerName}
                    onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                    placeholder="Full name" className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Owner Contact</Label>
                  <Input value={formData.ownerContact}
                    onChange={e => setFormData({ ...formData, ownerContact: e.target.value })}
                    placeholder="Phone number" className="h-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Company/Brand</Label>
                <Input value={formData.companyBrand}
                  onChange={e => setFormData({ ...formData, companyBrand: e.target.value })}
                  placeholder="e.g. BYD, Tata, Hyundai" className="h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notes</Label>
                <textarea value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  className="w-full h-20 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Settlement Frequency</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'custom', label: 'Custom' },
                    { value: 'on-demand', label: 'On Demand' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, settlementFrequency: opt.value })}
                      className={`px-2 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                        formData.settlementFrequency === opt.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={closeModals} disabled={saving}>Cancel</Button>
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 px-6">
                  {saving
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{showEditModal ? 'Updating...' : 'Adding...'}</>
                    : showEditModal ? 'Update Vehicle' : 'Register Vehicle'
                  }
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Vehicle Master</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {fromSessions.length} from sessions · {ownerRegistered.length} owner registered
          </p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search vehicle no., brand, owner..." value={search}
            onChange={e => setSearch(e.target.value)} className="w-72 h-9" />
          <Button size="sm" onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 gap-1.5 h-9">
            <Plus className="h-4 w-4" /> New Vehicle
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        <button
          onClick={() => setTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'sessions'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Car className="h-4 w-4" />
          From Sessions
          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
            tab === 'sessions' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {filteredSessions.length}
          </span>
        </button>
        <button
          onClick={() => setTab('registered')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'registered'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <User className="h-4 w-4" />
          Owner Registered
          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
            tab === 'registered' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {filteredRegistered.length}
          </span>
        </button>
      </div>

      {/* FROM SESSIONS TAB */}
      {tab === 'sessions' && (
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Vehicle / Owner', 'Brand', 'First Visit', 'Last Visit', 'Visits', 'Charged%', 'Revenue Rs.', 'Last Rate', 'Outstanding Rs.', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></td></tr>
                  ) : filteredSessions.length === 0 ? (
                    <tr><td colSpan={11} className="py-12 text-center text-slate-400 text-sm">No vehicles found</td></tr>
                  ) : filteredSessions.map(renderSessionRow)}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OWNER REGISTERED TAB */}
      {tab === 'registered' && (
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Vehicle No.', 'Owner Name', 'Phone', 'Brand', 'Notes', 'Session Stats', 'Registered On', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></td></tr>
                  ) : filteredRegistered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center">
                        <User className="h-8 w-8 mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-400 text-sm font-medium">No owner-registered vehicles yet</p>
                        <p className="text-slate-400 text-xs mt-1">Click "New Vehicle" to pre-register an owner's vehicle</p>
                      </td>
                    </tr>
                  ) : filteredRegistered.map(renderRegisteredRow)}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}
