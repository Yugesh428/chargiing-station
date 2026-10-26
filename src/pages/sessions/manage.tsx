import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Edit, Trash2, Check, X, Clock, 
  Zap, DollarSign, Save, AlertCircle 
} from 'lucide-react';

const TABS = [
  { id: 'ongoing', label: 'Ongoing', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'pending_payment', label: 'Pending Payment', icon: DollarSign, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { id: 'completed', label: 'Completed', icon: Check, color: 'text-green-600', bg: 'bg-green-50' },
];

const CHARGERS = ['GBT', 'CCS2'];
const PAYMENT_METHODS = ['Cash', 'Bank/QR', 'Credit'];
const PAYMENT_STATUSES = ['Paid', 'Pending', 'Partially Paid'];

export default function ManageSessionsPage() {
  const [activeTab, setActiveTab] = useState('ongoing');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchSessions = () => {
    setLoading(true);
    fetch(`/api/sessions/manage?status=${activeTab}`, { headers })
      .then(r => r.json())
      .then(d => setSessions(d.sessions || []))
      .catch(err => console.error('Failed to load sessions:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSessions();
  }, [activeTab]);

  const startEdit = (session: any) => {
    setEditingId(session.id);
    setEditForm({
      vehicleNo: session.vehicleNo,
      arrivalSoc: session.arrivalSoc,
      departureSoc: session.departureSoc,
      ratePerPercent: session.ratePerPercent,
      chargerType: session.chargerType,
      paymentMethod: session.paymentMethod,
      paymentStatus: session.paymentStatus,
      companyBrand: session.companyBrand || '',
      remarks: session.remarks || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (sessionId: string) => {
    setSaving(true);
    try {
      const r = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(editForm),
      });
      if (r.ok) {
        fetchSessions();
        setEditingId(null);
        setEditForm({});
      } else {
        const d = await r.json();
        alert(`Error: ${d.message}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
    setSaving(false);
  };

  const completeSession = async (sessionId: string) => {
    if (!confirm('Mark this session as completed?')) return;
    try {
      const r = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers,
      });
      if (r.ok) {
        fetchSessions();
      } else {
        const d = await r.json();
        alert(`Error: ${d.message}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    try {
      const r = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers,
      });
      if (r.ok) {
        fetchSessions();
      } else {
        const d = await r.json();
        alert(`Error: ${d.message}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <Layout activeTab="sessions" title="Manage Sessions">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Manage Sessions</h2>
        <p className="text-sm text-slate-500 mt-0.5">View, edit, and track charging sessions</p>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = sessions.length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all whitespace-nowrap ${
                isActive
                  ? `${tab.bg} border-${tab.color.replace('text-', '')} ${tab.color} font-semibold`
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm">{tab.label}</span>
              {isActive && <Badge variant="secondary" className="text-xs">{count}</Badge>}
            </button>
          );
        })}
      </div>

      {/* Sessions List */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">
            {TABS.find(t => t.id === activeTab)?.label} Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No {activeTab.replace('_', ' ')} sessions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map(session => (
                <div
                  key={session.id}
                  className="p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  {editingId === session.id ? (
                    /* EDIT MODE */
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Vehicle No.</Label>
                          <Input
                            value={editForm.vehicleNo}
                            onChange={e => setEditForm({...editForm, vehicleNo: e.target.value})}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Arrival SOC %</Label>
                          <Input
                            type="number"
                            value={editForm.arrivalSoc}
                            onChange={e => setEditForm({...editForm, arrivalSoc: e.target.value})}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Departure SOC %</Label>
                          <Input
                            type="number"
                            value={editForm.departureSoc}
                            onChange={e => setEditForm({...editForm, departureSoc: e.target.value})}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Rate Rs/%</Label>
                          <Input
                            type="number"
                            value={editForm.ratePerPercent}
                            onChange={e => setEditForm({...editForm, ratePerPercent: e.target.value})}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Charger</Label>
                          <select
                            value={editForm.chargerType}
                            onChange={e => setEditForm({...editForm, chargerType: e.target.value})}
                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                          >
                            {CHARGERS.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Payment Method</Label>
                          <select
                            value={editForm.paymentMethod}
                            onChange={e => setEditForm({...editForm, paymentMethod: e.target.value})}
                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                          >
                            {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Payment Status</Label>
                          <select
                            value={editForm.paymentStatus}
                            onChange={e => setEditForm({...editForm, paymentStatus: e.target.value})}
                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                          >
                            {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Company/Brand</Label>
                          <Input
                            value={editForm.companyBrand}
                            onChange={e => setEditForm({...editForm, companyBrand: e.target.value})}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Remarks</Label>
                        <Input
                          value={editForm.remarks}
                          onChange={e => setEditForm({...editForm, remarks: e.target.value})}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => saveEdit(session.id)}
                          disabled={saving}
                          className="bg-green-600 hover:bg-green-700 h-9 gap-2"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save Changes
                        </Button>
                        <Button
                          onClick={cancelEdit}
                          variant="outline"
                          className="h-9"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* VIEW MODE */
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div>
                          <p className="text-xs text-slate-500">Vehicle</p>
                          <p className="text-sm font-semibold text-slate-900">{session.vehicleNo}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">SOC</p>
                          <p className="text-sm font-medium">{session.arrivalSoc}% → {session.departureSoc}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Charged</p>
                          <p className="text-sm font-semibold text-blue-600">
                            <Zap className="h-3 w-3 inline mr-1" />
                            {parseFloat(session.chargedPercent).toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Amount</p>
                          <p className="text-sm font-bold text-green-600">
                            Rs. {parseFloat(session.chargeAmount).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Charger</p>
                          <Badge variant={session.chargerType === 'GBT' ? 'default' : 'secondary'} className="text-xs">
                            {session.chargerType}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Payment</p>
                          <Badge
                            variant={
                              session.paymentStatus === 'Paid' ? 'success' :
                              session.paymentStatus === 'Pending' ? 'warning' :
                              'default'
                            }
                            className="text-xs"
                          >
                            {session.paymentMethod}
                          </Badge>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {activeTab === 'ongoing' && (
                          <Button
                            onClick={() => completeSession(session.id)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 h-8 text-xs gap-1"
                          >
                            <Check className="h-3 w-3" />
                            Complete
                          </Button>
                        )}
                        {activeTab === 'pending_payment' && (
                          <Button
                            onClick={() => completeSession(session.id)}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 h-8 text-xs gap-1"
                          >
                            <DollarSign className="h-3 w-3" />
                            Mark Paid
                          </Button>
                        )}
                        <Button
                          onClick={() => startEdit(session)}
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={() => deleteSession(session.id)}
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
