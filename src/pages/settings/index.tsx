import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle2, Plus, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const [form, setForm] = useState({
    stationName: '',
    electricityRate: '17',
    neaCostRate: '9.35',
    monthlyStaffCost: '25000',
    monthlyRent: '15000',
    otherFixedCost: '1300',
    defaultPaymentStatus: 'Paid',
  });
  const [rateMaster, setRateMaster] = useState<Record<string, number>>({
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    '11': 11,
    '12': 12,
    '13': 13,
  });
  const [newRateLabel, setNewRateLabel] = useState('');
  const [newRateValue, setNewRateValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch('/api/settings', { headers })
      .then(r => r.json())
      .then(d => {
        if (d.settings) {
          setForm({
            stationName: d.settings.stationName || '',
            electricityRate: String(d.settings.electricityRate || 17),
            neaCostRate: String(d.settings.neaCostRate || 9.35),
            monthlyStaffCost: String(d.settings.monthlyStaffCost || 25000),
            monthlyRent: String(d.settings.monthlyRent || 15000),
            otherFixedCost: String(d.settings.otherFixedCost || 1300),
            defaultPaymentStatus: d.settings.defaultPaymentStatus || 'Paid',
          });
          if (d.settings.rateMaster) {
            setRateMaster(d.settings.rateMaster);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const payload = { ...form, rateMaster };
      const r = await fetch('/api/settings', { method: 'PUT', headers, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  };

  const updateRate = (key: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRateMaster(prev => ({ ...prev, [key]: numValue }));
  };

  const addRate = () => {
    if (!newRateLabel.trim() || !newRateValue) {
      alert('Please enter both label and value');
      return;
    }
    if (rateMaster[newRateLabel]) {
      alert('Rate label already exists');
      return;
    }
    setRateMaster(prev => ({ ...prev, [newRateLabel]: parseFloat(newRateValue) }));
    setNewRateLabel('');
    setNewRateValue('');
  };

  const deleteRate = (key: string) => {
    if (!confirm(`Delete rate "${key}"?`)) return;
    const updated = { ...rateMaster };
    delete updated[key];
    setRateMaster(updated);
  };

  if (loading) return (
    <Layout activeTab="settings" title="Settings">
      <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
    </Layout>
  );

  return (
    <Layout activeTab="settings" title="Settings">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500 mt-0.5">Configure your charging station settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-base">Station Configuration</CardTitle>
              <CardDescription>These values are used for all calculations</CardDescription>
            </CardHeader>
            <CardContent>
              {success && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 mb-4">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-800 font-medium">Settings saved successfully!</p>
                </div>
              )}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Station Name</Label>
                  <Input value={form.stationName} onChange={e => setForm(f => ({ ...f, stationName: e.target.value }))}
                    placeholder="Lekali EV Charging Station" />
                </div>

                <div className="space-y-1.5">
                  <Label>Electricity Rate (Rs/kWh)</Label>
                  <Input type="number" step="0.01" value={form.electricityRate}
                    onChange={e => setForm(f => ({ ...f, electricityRate: e.target.value }))} />
                  <p className="text-xs text-slate-400">Used to calculate kWh: Amount ÷ Rate</p>
                </div>

                <div className="space-y-1.5">
                  <Label>NEA Cost Rate (Rs/kWh)</Label>
                  <Input type="number" step="0.01" value={form.neaCostRate}
                    onChange={e => setForm(f => ({ ...f, neaCostRate: e.target.value }))} />
                  <p className="text-xs text-slate-400">Electricity cost = kWh × NEA rate</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Monthly Staff Cost (Rs)</Label>
                  <Input type="number" value={form.monthlyStaffCost}
                    onChange={e => setForm(f => ({ ...f, monthlyStaffCost: e.target.value }))} />
                </div>

                <div className="space-y-1.5">
                  <Label>Monthly Rent (Rs)</Label>
                  <Input type="number" value={form.monthlyRent}
                    onChange={e => setForm(f => ({ ...f, monthlyRent: e.target.value }))} />
                </div>

                <div className="space-y-1.5">
                  <Label>Other Fixed Monthly Cost (Rs)</Label>
                  <Input type="number" value={form.otherFixedCost}
                    onChange={e => setForm(f => ({ ...f, otherFixedCost: e.target.value }))} />
                </div>

                <div className="space-y-1.5">
                  <Label>Default Payment Status</Label>
                  <select value={form.defaultPaymentStatus}
                    onChange={e => setForm(f => ({ ...f, defaultPaymentStatus: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option>Paid</option>
                    <option>Pending</option>
                  </select>
                </div>

                <div className="sm:col-span-2 pt-2">
                  <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto px-8">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Rate Master - Full CRUD */}
        <div>
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-base">Rate Master</CardTitle>
              <CardDescription>Configure charging rates per % SOC</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Existing Rates */}
              {Object.entries(rateMaster)
                .sort((a, b) => a[1] - b[1]) // Sort by value ascending
                .map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2">
                    <Input 
                      value={key}
                      onChange={e => {
                        const newKey = e.target.value;
                        if (newKey !== key && !rateMaster[newKey]) {
                          const updated = { ...rateMaster };
                          delete updated[key];
                          updated[newKey] = value;
                          setRateMaster(updated);
                        }
                      }}
                      placeholder="Label"
                      className="h-8 text-sm w-20"
                    />
                    <span className="text-xs text-slate-500">:</span>
                    <span className="text-xs text-slate-500">Rs.</span>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      value={value} 
                      onChange={e => updateRate(key, e.target.value)}
                      className="h-8 text-sm flex-1"
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">/ %</span>
                  </div>
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm"
                    onClick={() => deleteRate(key)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              {/* Add New Rate */}
              <div className="border-t pt-3 mt-3">
                <p className="text-xs font-medium text-slate-600 mb-2">Add New Rate</p>
                <div className="flex items-center gap-2">
                  <Input 
                    value={newRateLabel}
                    onChange={e => setNewRateLabel(e.target.value)}
                    placeholder="Label (e.g. 14)"
                    className="h-8 text-sm w-24"
                  />
                  <span className="text-xs text-slate-500">Rs.</span>
                  <Input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    value={newRateValue}
                    onChange={e => setNewRateValue(e.target.value)}
                    placeholder="Value"
                    className="h-8 text-sm flex-1"
                  />
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    onClick={addRate}
                    className="h-8 px-3 gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calculation Info */}
          <Card className="border-slate-200 bg-white mt-4">
            <CardHeader><CardTitle className="text-sm">Calculation Formula</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs text-slate-500">
              <p><span className="font-medium text-slate-700">Charged %</span> = Departure − Arrival SOC</p>
              <p><span className="font-medium text-slate-700">Amount</span> = Charged % × Rate</p>
              <p><span className="font-medium text-slate-700">kWh</span> = Amount ÷ {form.electricityRate}</p>
              <p><span className="font-medium text-slate-700">Elec. Cost</span> = kWh × {form.neaCostRate}</p>
              <p><span className="font-medium text-slate-700">Net Contribution</span> = Amount − Elec. Cost</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
