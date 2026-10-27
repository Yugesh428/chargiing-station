import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { X } from 'lucide-react';

const statusColor: any = { Paid: 'success', Pending: 'warning', 'Partially Paid': 'info' };

export default function VehicleDetail() {
  const router = useRouter();
  const { vehicleNo } = router.query;
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    companyBrand: '',
    ownerName: '',
    ownerContact: '',
    notes: '',
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadData = () => {
    if (!vehicleNo) return;
    setLoading(true);
    fetch(`/api/vehicles/${encodeURIComponent(String(vehicleNo))}`, { headers })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) {
          setNotFound(true);
          return;
        }
        setData(d);
        setFormData({
          companyBrand: d.companyBrand || '',
          ownerName: d.ownerName || '',
          ownerContact: d.ownerContact || '',
          notes: d.notes || '',
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [vehicleNo]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/vehicles/${encodeURIComponent(String(vehicleNo))}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (res.ok) {
        toast({ title: 'Vehicle Updated', description: 'Vehicle info saved successfully.' });
        setShowEditModal(false);
        loadData();
      } else {
        toast({ title: 'Update Failed', description: result.message || 'Failed to update vehicle', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <Layout activeTab="vehicles" title="Vehicle">
      <Toaster />
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    </Layout>
  );

  if (notFound || !data) return (
    <Layout activeTab="vehicles" title="Vehicle">
      <Toaster />
      <div className="text-center py-20">
        <p className="text-slate-500 mb-4">Vehicle not found or no sessions recorded yet.</p>
        <Button variant="outline" onClick={() => router.push('/vehicles')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Vehicles
        </Button>
      </div>
    </Layout>
  );

  const sessions = data.sessions || [];
  const totalAmount = sessions.reduce((s: number, x: any) => s + (Number(x.chargeAmount) || 0), 0);
  const totalOutstanding = sessions.reduce((s: number, x: any) => s + (Number(x.outstanding) || 0), 0);

  return (
    <Layout activeTab="vehicles" title={`Vehicle ${vehicleNo}`}>
      <Toaster />

      {/* Edit Vehicle Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
              <h3 className="text-lg font-bold text-slate-900">Edit Vehicle Info</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Vehicle No.</Label>
                <Input value={String(vehicleNo)} disabled className="h-9 bg-slate-50" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Company/Brand</Label>
                <Input
                  value={formData.companyBrand}
                  onChange={e => setFormData({ ...formData, companyBrand: e.target.value })}
                  placeholder="e.g. BYD, Tata"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Owner Name</Label>
                <Input
                  value={formData.ownerName}
                  onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                  placeholder="Owner's full name"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Owner Contact</Label>
                <Input
                  value={formData.ownerContact}
                  onChange={e => setFormData({ ...formData, ownerContact: e.target.value })}
                  placeholder="Phone number"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notes</Label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes or remarks"
                  className="w-full h-20 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/vehicles')} className="mb-3 text-slate-600 gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Back to Vehicles
          </Button>
          <h2 className="text-2xl font-bold text-slate-900">{vehicleNo}</h2>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            {data.companyBrand && <span className="font-medium text-slate-700">{data.companyBrand}</span>}
            {data.ownerName && <span>Owner: <span className="text-slate-700">{data.ownerName}</span></span>}
            {data.ownerContact && <span>📞 {data.ownerContact}</span>}
          </div>
          {data.notes && (
            <p className="text-sm text-slate-500 mt-1 italic">{data.notes}</p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowEditModal(true)}
          className="gap-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
        >
          <Pencil className="h-4 w-4" /> Edit Info
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Visits', value: data.totalVisits },
          { label: 'Total kWh Used', value: `${(data.totalKwh || 0).toFixed(2)} kWh` },
          { label: 'Total Revenue', value: `Rs. ${(data.totalRevenue || 0).toLocaleString()}`, green: true },
          { label: 'Total Paid', value: `Rs. ${(data.totalPaid || 0).toLocaleString()}` },
          {
            label: 'Outstanding',
            value: data.totalOutstanding > 0 ? `Rs. ${(data.totalOutstanding || 0).toLocaleString()}` : '—',
            red: data.totalOutstanding > 0,
          },
        ].map(stat => (
          <Card key={stat.label} className="border-slate-200 bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{stat.label}</p>
              <p className={`text-lg font-bold mt-1 ${
                (stat as any).red ? 'text-red-600' : (stat as any).green ? 'text-green-700' : 'text-slate-900'
              }`}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Visit info row */}
      <div className="flex gap-6 mb-6 text-sm text-slate-500">
        <span>First visit: <span className="font-medium text-slate-700">{data.firstVisit ? String(data.firstVisit).slice(0, 10) : '—'}</span></span>
        <span>Last visit: <span className="font-medium text-slate-700">{data.lastVisit ? String(data.lastVisit).slice(0, 10) : '—'}</span></span>
        <span>Avg charge: <span className="font-medium text-slate-700">Rs. {(data.avgChargeAmount || 0).toFixed(2)}</span></span>
      </div>

      {/* Session History Table */}
      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-semibold">
            Session History <span className="text-slate-400 font-normal">({sessions.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No sessions recorded yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['#', 'Date', 'Charger', 'kWh Used', 'Charge Amount', 'Credit Paid', 'Outstanding', 'Status', 'Settlement'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s: any, i: number) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2.5 text-sm whitespace-nowrap text-slate-700">{String(s.date).slice(0, 10)}</td>
                      <td className="px-4 py-2.5 text-sm">
                        <Badge variant="info" className="text-xs">{s.chargerType || '—'}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-700">{(Number(s.usedKwh) || 0).toFixed(3)}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-green-700">
                        Rs. {(Number(s.chargeAmount) || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-700">
                        {Number(s.creditPaid) > 0 ? `Rs. ${Number(s.creditPaid).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium text-red-600">
                        {Number(s.outstanding) > 0 ? `Rs. ${Number(s.outstanding).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        <Badge variant={statusColor[s.paymentStatus] || 'default'} className="text-xs">
                          {s.paymentStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">
                        {s.settlementMethod || '—'}
                        {s.settlementDate ? ` · ${String(s.settlementDate).slice(0, 10)}` : ''}
                      </td>
                    </tr>
                  ))}

                  {/* Totals Row */}
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
                    <td colSpan={4} className="px-4 py-2.5 text-sm text-slate-600">Totals ({sessions.length} sessions)</td>
                    <td className="px-4 py-2.5 text-sm text-green-700">
                      Rs. {totalAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-700">
                      Rs. {(data.totalPaid || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-red-600">
                      {totalOutstanding > 0 ? `Rs. ${totalOutstanding.toLocaleString()}` : '—'}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
