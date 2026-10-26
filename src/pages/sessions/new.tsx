import { useEffect, useState, useCallback } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';

const CHARGERS = ['GBT', 'CCS2'];
const PAYMENT_METHODS = ['Cash', 'Bank/QR', 'Credit'];
const PAYMENT_STATUSES = ['Paid', 'Pending', 'Partially Paid'];

function calcMetrics(arrivalSoc: number, departureSoc: number, rate: number, electricityRate: number, neaCostRate: number) {
  const charged = Math.max(0, departureSoc - arrivalSoc);
  const amount = charged * rate;
  const kwh = amount / electricityRate;
  const cost = kwh * neaCostRate;
  const net = amount - cost;
  return { charged, amount, kwh, cost, net };
}

export default function NewSession() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tenantSettings, setTenantSettings] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      window.location.href = '/';
      return;
    }
    const u = JSON.parse(userData);
    if (u.role === 'super_admin') {
      alert('Super Admin cannot create sessions. Only Tenant Admin and Operators can.');
      window.location.href = '/tenants';
      return;
    }
    setUser(u);
    
    // Fetch tenant settings
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    fetch('/api/settings', { headers })
      .then(r => r.json())
      .then(d => {
        if (d.settings) {
          setTenantSettings(d.settings);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5), // Add time field
    vehicleNo: '',
    arrivalSoc: '',
    departureSoc: '',
    ratePerPercent: '',
    chargerType: 'GBT',
    paymentMethod: 'Cash',
    paymentStatus: 'Paid',
    companyBrand: '',
    remarks: '',
  });

  const [vehicleInfo, setVehicleInfo] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [dupWarning, setDupWarning] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // Live vehicle lookup
  useEffect(() => {
    const v = form.vehicleNo.trim();
    if (v.length < 1) { setVehicleInfo(null); return; }
    const t = setTimeout(async () => {
      setLookingUp(true);
      try {
        const r = await fetch(`/api/vehicles/lookup?vehicleNo=${encodeURIComponent(v)}`, { headers });
        const d = await r.json();
        setVehicleInfo(d);
        if (d.lastRate && !form.ratePerPercent) setForm(f => ({ ...f, ratePerPercent: String(d.lastRate) }));
      } catch { setVehicleInfo(null); }
      setLookingUp(false);
    }, 400);
    return () => clearTimeout(t);
  }, [form.vehicleNo]);

  const metrics = form.arrivalSoc && form.departureSoc && form.ratePerPercent && tenantSettings
    ? calcMetrics(
        Number(form.arrivalSoc), 
        Number(form.departureSoc), 
        Number(form.ratePerPercent),
        Number(tenantSettings.electricityRate || 17),
        Number(tenantSettings.neaCostRate || 9.35)
      )
    : null;

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setDupWarning('');

    if (Number(form.departureSoc) <= Number(form.arrivalSoc))
      return setError('Departure SOC must be greater than Arrival SOC');

    setSaving(true);
    try {
      // Add operator name from logged-in user
      const payload = { ...form, operator: user?.fullName || user?.username };
      const r = await fetch('/api/sessions', { method: 'POST', headers, body: JSON.stringify(payload) });
      const d = await r.json();
      if (r.status === 409) { setDupWarning(d.message); setSaving(false); return; }
      if (!r.ok) throw new Error(d.message);
      setSuccess(`Session saved! Vehicle ${form.vehicleNo} — Visit #${d.session.visitNo} — Rs. ${parseFloat(d.session.chargeAmount).toLocaleString()}`);
      setForm(f => ({ ...f, vehicleNo: '', arrivalSoc: '', departureSoc: '', ratePerPercent: '', companyBrand: '', remarks: '' }));
      setVehicleInfo(null);
    } catch (err: any) { setError(err.message); }
    setSaving(false);
  };

  const handleUndo = async () => {
    if (!confirm('Undo the last charging session? This cannot be undone.')) return;
    try {
      const r = await fetch('/api/sessions?limit=1', { headers });
      const d = await r.json();
      if (!d.sessions?.length) return alert('No sessions to undo');
      const last = d.sessions[0];
      const del = await fetch(`/api/sessions/${last.id}`, { method: 'DELETE', headers });
      if (del.ok) setSuccess(`Undone: ${last.vehicleNo} session on ${last.date}`);
    } catch { setError('Failed to undo'); }
  };

  if (loading) return null;

  return (
    <Layout activeTab="new-session" title="New Session">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">New Charging Session</h2>
          <p className="text-sm text-slate-500 mt-0.5">One-click entry — all calculations are automatic</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleUndo} className="text-slate-600 gap-2">
          <RotateCcw className="h-4 w-4" /> Undo Last
        </Button>
      </div>

      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 mb-5">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800 font-medium">{success}</p>
        </div>
      )}
      {dupWarning && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 mb-5">
          <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800 font-medium">⚠ {dupWarning}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-5">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Session Details</CardTitle>
              <CardDescription>Fields marked * are required</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div className="space-y-1.5">
                  <Label>Date *</Label>
                  <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
                </div>

                <div className="space-y-1.5">
                  <Label>Time</Label>
                  <Input type="time" value={form.time} onChange={e => set('time', e.target.value)} />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Vehicle No. *</Label>
                  <div className="relative">
                    <Input placeholder="e.g. 800, BA 1 PA 800" value={form.vehicleNo}
                      onChange={e => set('vehicleNo', e.target.value)} required />
                    {lookingUp && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Arrival SOC % *</Label>
                  <Input type="number" min="0" max="100" placeholder="0–100" value={form.arrivalSoc}
                    onChange={e => set('arrivalSoc', e.target.value)} required />
                </div>

                <div className="space-y-1.5">
                  <Label>Departure SOC % *</Label>
                  <Input type="number" min="0" max="100" placeholder="0–100" value={form.departureSoc}
                    onChange={e => set('departureSoc', e.target.value)} required />
                </div>

                <div className="space-y-1.5">
                  <Label>Rate Rs/% *</Label>
                  <div className="flex gap-2">
                    <Input type="number" min="1" step="0.01" placeholder="e.g. 7" value={form.ratePerPercent}
                      onChange={e => set('ratePerPercent', e.target.value)} required className="flex-1" />
                    {tenantSettings?.rateMaster && Object.keys(tenantSettings.rateMaster).length > 0 && (
                      <select 
                        value="" 
                        onChange={e => e.target.value && set('ratePerPercent', e.target.value)}
                        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <option value="">Quick Select</option>
                        {Object.entries(tenantSettings.rateMaster)
                          .sort((a: any, b: any) => a[1] - b[1]) // Sort by value ascending
                          .map(([label, value]: [string, any]) => (
                          <option key={label} value={value}>
                            {label}: Rs. {value}/%
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Charger *</Label>
                  <select value={form.chargerType} onChange={e => set('chargerType', e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    {CHARGERS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Payment Method *</Label>
                  <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Payment Status *</Label>
                  <select value={form.paymentStatus} onChange={e => set('paymentStatus', e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Company / Brand</Label>
                  <Input placeholder="e.g. BYD, Tata" value={form.companyBrand} onChange={e => set('companyBrand', e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label>Remarks</Label>
                  <Input placeholder="Optional notes" value={form.remarks} onChange={e => set('remarks', e.target.value)} />
                </div>

                <div className="sm:col-span-2 pt-2">
                  <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 h-10">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {saving ? 'Saving...' : '⚡ Save Session'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview */}
        <div className="space-y-4">
          {/* Vehicle Status */}
          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Vehicle Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!form.vehicleNo ? (
                <p className="text-sm text-slate-400">Enter a vehicle number to check status</p>
              ) : lookingUp ? (
                <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Looking up...</span></div>
              ) : vehicleInfo ? (
                <div className="space-y-2">
                  <Badge variant={vehicleInfo.isNew ? 'warning' : 'success'} className="text-xs">
                    {vehicleInfo.isNew ? '🆕 NEW VEHICLE' : '✅ EXISTING VEHICLE'}
                  </Badge>
                  {!vehicleInfo.isNew && (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Previous Visits</span><span className="font-semibold">{vehicleInfo.visits}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Last Visit</span><span className="font-semibold">{vehicleInfo.lastVisit}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Last Rate</span><span className="font-semibold">Rs. {vehicleInfo.lastRate}/%</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Total Revenue</span><span className="font-semibold">Rs. {parseFloat(vehicleInfo.totalAmount).toLocaleString()}</span></div>
                      {parseFloat(vehicleInfo.totalOutstanding) > 0 && (
                        <div className="flex justify-between text-red-600"><span>Outstanding</span><span className="font-semibold">Rs. {parseFloat(vehicleInfo.totalOutstanding).toLocaleString()}</span></div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Calculation Preview */}
          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Calculated Values</CardTitle>
              <CardDescription className="text-xs">Auto-calculated — read only</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!metrics || !tenantSettings ? (
                <p className="text-slate-400 text-xs">Fill in SOC and Rate to see calculations</p>
              ) : (
                <>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-slate-500">Charged %</span>
                    <span className="font-bold text-blue-600">{metrics.charged.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Charge Amount</span>
                    <span className="font-bold text-green-600">Rs. {metrics.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Used kWh</span>
                    <span className="font-medium">{metrics.kwh.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Electricity Cost</span>
                    <span className="font-medium text-orange-600">Rs. {metrics.cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-slate-500">Net Contribution</span>
                    <span className="font-bold">Rs. {metrics.net.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-slate-400 border-t pt-2 space-y-0.5">
                    <p>Elec. Rate: Rs. {tenantSettings.electricityRate}/kWh</p>
                    <p>NEA Cost: Rs. {tenantSettings.neaCostRate}/kWh</p>
                  </div>
                  {form.paymentMethod === 'Credit' && (
                    <div className="flex justify-between text-red-600 border-t pt-2">
                      <span>Outstanding</span>
                      <span className="font-bold">Rs. {metrics.amount.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
