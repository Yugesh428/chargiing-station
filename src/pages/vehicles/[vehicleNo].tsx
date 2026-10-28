import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Pencil, Download } from 'lucide-react';
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

  // Export state
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);

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

  // ── Export Functions ──────────────────────────────────────────────────────
  const EXPORT_HEADERS = [
    '#', 'Date', 'Charger', 'kWh Used', 'Charge Amount (Rs)', 
    'Credit Paid (Rs)', 'Outstanding (Rs)', 'Payment Status', 
    'Settlement Method', 'Settlement Date'
  ];

  const buildRows = (sessions: any[]): (string | number)[][] =>
    sessions.map((s: any, i: number) => [
      i + 1,
      String(s.date).slice(0, 10),
      s.chargerType || '',
      s.usedKwh ? parseFloat(parseFloat(s.usedKwh).toFixed(3)) : 0,
      s.chargeAmount ? parseFloat(parseFloat(s.chargeAmount).toFixed(2)) : 0,
      s.creditPaid ? parseFloat(parseFloat(s.creditPaid).toFixed(2)) : 0,
      s.outstanding ? parseFloat(parseFloat(s.outstanding).toFixed(2)) : 0,
      s.paymentStatus || '',
      s.settlementMethod || '',
      s.settlementDate ? String(s.settlementDate).slice(0, 10) : '',
    ]);

  const buildFilename = (ext: string) => {
    return `Vehicle_${vehicleNo}_SessionHistory.${ext}`;
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = async () => {
    setExporting('csv');
    try {
      if (!sessions.length) {
        toast({ title: 'No data', description: 'No sessions to export.', variant: 'destructive' });
        return;
      }
      const escape = (v: any) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [
        EXPORT_HEADERS.map(escape).join(','),
        ...buildRows(sessions).map(r => r.map(escape).join(',')),
      ].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = buildFilename('csv');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast({ title: `CSV exported — ${sessions.length} sessions`, description: filename });
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
      if (!sessions.length) {
        toast({ title: 'No data', description: 'No sessions to export.', variant: 'destructive' });
        return;
      }

      const XLSX = (await import('xlsx')).default || await import('xlsx');
      const wsData = [EXPORT_HEADERS, ...buildRows(sessions)];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths
      ws['!cols'] = [
        { wch: 5 },  { wch: 12 }, { wch: 10 }, { wch: 12 },
        { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
        { wch: 18 }, { wch: 16 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Session History');
      const filename = buildFilename('xlsx');
      XLSX.writeFile(wb, filename);
      toast({ title: `Excel exported — ${sessions.length} sessions`, description: filename });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(null);
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

      {/* Simple Header - No gradient */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/vehicles')} 
            className="mb-2 text-slate-600 hover:text-slate-900 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Vehicles
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">{vehicleNo}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
            {data.companyBrand && <span className="font-medium">{data.companyBrand}</span>}
            {data.ownerName && <span>Owner: {data.ownerName}</span>}
            {data.ownerContact && <span>📞 {data.ownerContact}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={exportCSV}
            disabled={exporting === 'csv' || !sessions.length}
            className="gap-1.5"
          >
            {exporting === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportExcel}
            disabled={exporting === 'excel' || !sessions.length}
            className="gap-1.5"
          >
            {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Excel
          </Button>
          <Button
            size="sm"
            onClick={() => setShowEditModal(true)}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </div>
      </div>

      {/* Summary Stats - 4 Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 font-medium uppercase">Total Visits</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{data.totalVisits}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 font-medium uppercase">Total Revenue</p>
            <p className="text-2xl font-bold text-green-900 mt-1">Rs. {(data.totalRevenue || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <p className="text-xs text-orange-600 font-medium uppercase">Total Paid</p>
            <p className="text-2xl font-bold text-orange-900 mt-1">Rs. {(data.totalPaid || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-xs text-red-600 font-medium uppercase">Outstanding</p>
            <p className="text-2xl font-bold text-red-900 mt-1">Rs. {(data.totalOutstanding || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Information */}
      <Card className="border-slate-200 bg-white mb-6">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-semibold">Vehicle Information</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs mb-1">First Visit</p>
              <p className="font-medium text-slate-900">{data.firstVisit ? String(data.firstVisit).slice(0, 10) : '—'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Last Visit</p>
              <p className="font-medium text-slate-900">{data.lastVisit ? String(data.lastVisit).slice(0, 10) : '—'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Company/Brand</p>
              <p className="font-medium text-slate-900">{data.companyBrand || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Avg Charge Amount</p>
              <p className="font-medium text-slate-900">Rs. {(data.avgChargeAmount || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Total kWh Used</p>
              <p className="font-medium text-slate-900">{(data.totalKwh || 0).toFixed(2)} kWh</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Payment Status</p>
              <Badge variant={data.totalOutstanding > 0 ? 'warning' : 'success'} className="text-xs">
                {data.totalOutstanding > 0 ? 'Has Outstanding' : 'All Settled'}
              </Badge>
            </div>
          </div>
          {data.notes && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-slate-500 text-xs mb-1">Notes</p>
              <p className="text-sm text-slate-700 italic">{data.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session History */}
      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-semibold">
            Session History <span className="text-slate-400 font-normal">({sessions.length} sessions)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No sessions recorded yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Charger</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Charge Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Credit Paid</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Outstanding</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Settlement</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s: any, idx: number) => (
                    <tr 
                      key={s.id} 
                      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-700">{String(s.date).slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">{s.chargerType || '—'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        Rs. {parseFloat(s.chargeAmount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        Rs. {parseFloat(s.creditPaid || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">
                        Rs. {parseFloat(s.outstanding || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={statusColor[s.paymentStatus] || 'default'} className="text-xs">
                          {s.paymentStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {s.settlementMethod || '—'}
                        {s.settlementDate && <span className="text-slate-400"> · {String(s.settlementDate).slice(0, 10)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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

    </Layout>
  );
}
