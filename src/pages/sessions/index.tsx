import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Upload, X } from 'lucide-react';
import { useRouter } from 'next/router';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';

const CHARGERS = ['GBT', 'CCS2'];
const PAYMENT_METHODS = ['Cash', 'Bank/QR', 'Credit'];
const PAYMENT_STATUSES = ['Paid', 'Pending', 'Partially Paid'];

const statusColor: any = { Paid: 'success', Pending: 'warning', 'Partially Paid': 'info' };

export default function Sessions() {
  const router = useRouter();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', vehicleNo: '', chargerType: '', paymentMethod: '', paymentStatus: '' });
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [settlementData, setSettlementData] = useState({
    settlementMethod: 'Cash',
    settlementDate: new Date().toISOString().slice(0, 10),
    amountPaid: '',
  });
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    vehicleNo: '',
    arrivalSoc: '',
    departureSoc: '',
    ratePerPercent: '',
    chargeAmount: '',
    chargerType: 'GBT',
    paymentMethod: 'Cash',
    paymentStatus: 'Pending',
    companyBrand: '',
    remarks: '',
    creditPaid: '',
    outstanding: '',
    settlementMethod: '',
    settlementDate: '',
  });
  const [saving, setSaving] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50', ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
      const r = await fetch(`/api/sessions?${params}`, { headers });
      const d = await r.json();
      setSessions(d.sessions || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 1);
      setPage(p);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, []);

  const handleEdit = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    setEditingSession(session);
    setFormData({
      date: String(session.date).slice(0, 10),
      time: session.time || '',
      vehicleNo: session.vehicleNo,
      arrivalSoc: String(session.arrivalSoc || ''),
      departureSoc: String(session.departureSoc || ''),
      ratePerPercent: String(session.ratePerPercent || ''),
      chargeAmount: String(session.chargeAmount || ''),
      chargerType: session.chargerType,
      paymentMethod: session.paymentMethod,
      paymentStatus: session.paymentStatus,
      companyBrand: session.companyBrand || '',
      remarks: session.remarks || '',
      creditPaid: String(session.creditPaid || '0'),
      outstanding: String(session.outstanding || '0'),
      settlementMethod: session.settlementMethod || '',
      settlementDate: session.settlementDate ? String(session.settlementDate).slice(0, 10) : '',
    });
    setShowEditModal(true);
  };

  const handleAdd = () => {
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      vehicleNo: '',
      arrivalSoc: '',
      departureSoc: '',
      ratePerPercent: '',
      chargeAmount: '',
      chargerType: 'GBT',
      paymentMethod: 'Cash',
      paymentStatus: 'Pending',
      companyBrand: '',
      remarks: '',
      creditPaid: '',
      outstanding: '',
      settlementMethod: '',
      settlementDate: '',
    });
    setShowAddModal(true);
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowSettleModal(false);
    setEditingSession(null);
    setSelectedSessions([]);
    setSaving(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only validate if both SOC values are provided
    if (formData.arrivalSoc && formData.departureSoc && Number(formData.departureSoc) <= Number(formData.arrivalSoc)) {
      toast({
        title: "Validation Error",
        description: "Departure SOC must be greater than Arrival SOC",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    
    try {
      const url = showEditModal ? `/api/sessions/${editingSession.id}` : '/api/sessions';
      const method = showEditModal ? 'PUT' : 'POST';
      
      // Prepare data - convert empty strings to null for optional fields
      const submitData = {
        ...formData,
        arrivalSoc: formData.arrivalSoc || null,
        departureSoc: formData.departureSoc || null,
        ratePerPercent: formData.ratePerPercent || null,
        chargeAmount: formData.chargeAmount || null,
        companyBrand: formData.companyBrand || null,
        remarks: formData.remarks || null,
        creditPaid: formData.creditPaid !== '' ? Number(formData.creditPaid) : null,
        settlementMethod: formData.settlementMethod || null,
        settlementDate: formData.settlementDate || null,
      };
      
      const r = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(submitData),
      });

      const d = await r.json();
      
      if (r.ok) {
        toast({
          title: showEditModal ? "Session Updated" : "Session Created",
          description: showEditModal 
            ? `Successfully updated session for vehicle ${formData.vehicleNo}`
            : `Successfully created session for vehicle ${formData.vehicleNo}`,
          variant: "default",
        });
        closeModals();
        load(page);
      } else {
        toast({
          title: showEditModal ? "Update Failed" : "Create Failed",
          description: d.message || "An error occurred",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSettlePayment = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const outstanding = parseFloat(String(session.outstanding));
    const chargeAmount = parseFloat(String(session.chargeAmount)) || 0;
    const creditPaid = parseFloat(String(session.creditPaid)) || 0;
    
    // Calculate actual outstanding if not set
    const actualOutstanding = (!isNaN(outstanding) && outstanding !== null) 
      ? outstanding 
      : (chargeAmount - creditPaid);
    
    setSelectedSessions([sessionId]);
    setSettlementData({
      settlementMethod: 'Cash',
      settlementDate: new Date().toISOString().slice(0, 10),
      amountPaid: String(actualOutstanding.toFixed(2)),
    });
    setShowSettleModal(true);
  };

  const handleBulkSettle = () => {
    const pendingSessions = sessions.filter(s => {
      const outstanding = parseFloat(String(s.outstanding));
      const chargeAmount = parseFloat(String(s.chargeAmount)) || 0;
      const creditPaid = parseFloat(String(s.creditPaid)) || 0;
      const actualOutstanding = (!isNaN(outstanding) && outstanding !== null) 
        ? outstanding 
        : (chargeAmount - creditPaid);
      
      // Only include sessions that have outstanding > 0 AND are not fully paid
      return actualOutstanding > 0 && s.paymentStatus !== 'Paid';
    });
    
    if (pendingSessions.length === 0) {
      toast({
        title: "No Pending Payments",
        description: "All sessions are already settled",
        variant: "default",
      });
      return;
    }
    
    const totalOutstanding = pendingSessions.reduce((sum, s) => {
      const outstanding = parseFloat(String(s.outstanding));
      const chargeAmount = parseFloat(String(s.chargeAmount)) || 0;
      const creditPaid = parseFloat(String(s.creditPaid)) || 0;
      
      // Calculate actual outstanding if not set
      const actualOutstanding = (!isNaN(outstanding) && outstanding !== null) 
        ? outstanding 
        : (chargeAmount - creditPaid);
      
      return sum + Math.max(0, actualOutstanding);
    }, 0);
    
    setSelectedSessions(pendingSessions.map(s => s.id));
    setSettlementData({
      settlementMethod: 'Cash',
      settlementDate: new Date().toISOString().slice(0, 10),
      amountPaid: String(totalOutstanding.toFixed(2)),
    });
    setShowSettleModal(true);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const r = await fetch('/api/sessions/settle', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionIds: selectedSessions,
          ...settlementData,
        }),
      });

      const d = await r.json();
      
      if (r.ok) {
        toast({
          title: "Udaro Settled (Payment Received)",
          description: `Successfully cleared ${selectedSessions.length} session(s) - Rs. ${settlementData.amountPaid} received`,
          variant: "default",
        });
        closeModals();
        // Force reload with a small delay to ensure database has updated
        setTimeout(() => load(page), 100);
      } else {
        toast({
          title: "Settlement Failed",
          description: d.message || "An error occurred",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sessionId: string, vehicleNo: string) => {
    if (!confirm(`Delete session for vehicle ${vehicleNo}? This action cannot be undone.`)) return;
    
    setDeleting(sessionId);
    try {
      const r = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers,
      });
      
      if (r.ok) {
        toast({
          title: "Session Deleted",
          description: `Successfully deleted session for vehicle ${vehicleNo}`,
          variant: "default",
        });
        load(page); // Reload current page
      } else {
        const d = await r.json();
        toast({
          title: "Delete Failed",
          description: d.message || "Failed to delete session",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Layout activeTab="sessions" title="Charging Sessions">
      <Toaster />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Charging Sessions</h2>
          <p className="text-sm text-slate-500 mt-0.5">{total.toLocaleString()} total sessions</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleBulkSettle}
            className="gap-2 text-green-700 border-green-300 hover:bg-green-50"
          >
            Settle All Udaro (Credit)
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/sessions/import')} className="gap-2">
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button size="sm" onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
            + New Session
          </Button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {showEditModal ? 'Edit Charging Session' : 'New Charging Session'}
              </h3>
              <button
                onClick={closeModals}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {/* Row 1 - Basic Info */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    required
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Time</Label>
                  <Input
                    type="time"
                    value={formData.time}
                    onChange={e => setFormData({...formData, time: e.target.value})}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label className="text-sm font-medium">Vehicle No. *</Label>
                  <Input
                    value={formData.vehicleNo}
                    onChange={e => setFormData({...formData, vehicleNo: e.target.value})}
                    placeholder="e.g. BA 1 PA 800"
                    required
                    className="h-9"
                  />
                </div>
              </div>

              {/* Row 2 - SOC & Rate */}
              <div className="grid grid-cols-5 gap-4 mb-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Arrival SOC %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.arrivalSoc}
                    onChange={e => setFormData({...formData, arrivalSoc: e.target.value})}
                    placeholder="Optional"
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Departure SOC %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.departureSoc}
                    onChange={e => setFormData({...formData, departureSoc: e.target.value})}
                    placeholder="Optional"
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Rate Rs/%</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.ratePerPercent}
                    onChange={e => setFormData({...formData, ratePerPercent: e.target.value})}
                    placeholder="Optional"
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Charge Amount Rs.</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.chargeAmount}
                    onChange={e => setFormData({...formData, chargeAmount: e.target.value})}
                    placeholder="Or auto-calculated"
                    className="h-9"
                  />
                  <p className="text-xs text-slate-400">Enter manually or auto-calc</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Charger *</Label>
                  <select
                    value={formData.chargerType}
                    onChange={e => setFormData({...formData, chargerType: e.target.value})}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {CHARGERS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 3 - Payment */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Payment Method *</Label>
                  <select
                    value={formData.paymentMethod}
                    onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Payment Status *</Label>
                  <select
                    value={formData.paymentStatus}
                    onChange={e => setFormData({...formData, paymentStatus: e.target.value})}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option>Pending</option>
                    <option>Paid</option>
                    <option>Partially Paid</option>
                  </select>
                  <p className="text-xs text-slate-400">Default: Pending (Unpaid)</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Company/Brand</Label>
                  <Input
                    value={formData.companyBrand}
                    onChange={e => setFormData({...formData, companyBrand: e.target.value})}
                    placeholder="e.g. BYD, Tata"
                    className="h-9"
                  />
                </div>
              </div>

              {/* Row 4 - Remarks */}
              <div className="mb-4">
                <Label className="text-sm font-medium">Remarks</Label>
                <Input
                  value={formData.remarks}
                  onChange={e => setFormData({...formData, remarks: e.target.value})}
                  placeholder="Optional notes"
                  className="h-9 mt-2"
                />
              </div>

              {/* Row 5 - Udaro / Settlement Section (only show in edit mode) */}
              {showEditModal && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-semibold text-green-800 mb-3">Udaro / Settlement Details</p>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-green-700">Credit Paid Rs.</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.creditPaid}
                        onChange={e => {
                          const paid = parseFloat(e.target.value) || 0;
                          const charge = parseFloat(formData.chargeAmount) || parseFloat(String(editingSession?.chargeAmount)) || 0;
                          const remaining = Math.max(0, charge - paid);
                          setFormData({
                            ...formData,
                            creditPaid: e.target.value,
                            outstanding: remaining.toFixed(2),
                            paymentStatus: paid >= charge ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Pending',
                          });
                        }}
                        placeholder="Amount paid so far"
                        className="h-9 border-green-300 focus:ring-green-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-red-600">Outstanding Rs.</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.outstanding}
                        readOnly
                        className="h-9 bg-red-50 border-red-200 font-semibold text-red-700"
                      />
                      <p className="text-xs text-slate-400">Auto-calculated</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-green-700">Settlement Method</Label>
                      <select
                        value={formData.settlementMethod}
                        onChange={e => setFormData({...formData, settlementMethod: e.target.value})}
                        className="h-9 w-full rounded-md border border-green-300 bg-transparent px-3 text-sm"
                      >
                        <option value="">-- Select --</option>
                        <option value="Cash">Cash</option>
                        <option value="Bank/QR">Bank/QR</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-green-700">Settlement Date</Label>
                      <Input
                        type="date"
                        value={formData.settlementDate}
                        onChange={e => setFormData({...formData, settlementDate: e.target.value})}
                        className="h-9 border-green-300"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModals}
                  disabled={saving}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 px-6"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {showEditModal ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    showEditModal ? 'Update Session' : 'Create Session'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {showSettleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="bg-green-600 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
              <h3 className="text-lg font-bold">Settle Payment (Clear Udaro)</h3>
              <button
                onClick={closeModals}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="p-6">
              <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">Sessions to settle: <span className="font-bold">{selectedSessions.length}</span></p>
                <p className="text-sm text-slate-600 mt-1">Customer is paying their credit/udaro</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Settlement Date *</Label>
                  <Input
                    type="date"
                    value={settlementData.settlementDate}
                    onChange={e => setSettlementData({...settlementData, settlementDate: e.target.value})}
                    required
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Settlement Method *</Label>
                  <select
                    value={settlementData.settlementMethod}
                    onChange={e => setSettlementData({...settlementData, settlementMethod: e.target.value})}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank/QR">Bank/QR</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Amount Paid (Rs) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settlementData.amountPaid}
                    onChange={e => setSettlementData({...settlementData, amountPaid: e.target.value})}
                    required
                    className="h-9"
                  />
                  <p className="text-xs text-slate-500">Enter the total amount customer paid</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModals}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Settling...
                    </>
                  ) : (
                    'Settle Payment'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card className="border-slate-200 bg-white mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Input type="date" placeholder="Start date" value={filters.startDate}
              onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
            <Input type="date" placeholder="End date" value={filters.endDate}
              onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
            <Input placeholder="Vehicle No." value={filters.vehicleNo}
              onChange={e => setFilters(f => ({ ...f, vehicleNo: e.target.value }))} />
            <select value={filters.chargerType} onChange={e => setFilters(f => ({ ...f, chargerType: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="">All Chargers</option>
              <option>GBT</option><option>CCS2</option>
            </select>
            <select value={filters.paymentMethod} onChange={e => setFilters(f => ({ ...f, paymentMethod: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="">All Methods</option>
              <option>Cash</option><option>Bank/QR</option><option>Credit</option>
            </select>
            <Button onClick={() => load(1)} className="bg-blue-600 hover:bg-blue-700">Filter</Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-blue-900 text-white">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Time</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Vehicle No.</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Arrival SOC %</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Departure SOC %</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Charged %</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Rate Rs/%</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Charge Amount Rs.</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Visit No.</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Charger</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Payment Method</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Payment Status</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Operator</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Remarks</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Used kWh</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Electricity Rate</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Electricity Cost Rs.</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Net Contribution Rs.</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Credit Paid Rs.</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Udaro/Outstanding Rs.</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Settlement Method</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Settlement Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Company/ Brand</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap sticky right-0 bg-blue-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={24} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></td></tr>
                ) : sessions.length === 0 ? (
                  <tr><td colSpan={24} className="py-12 text-center text-slate-400 text-sm">No sessions found</td></tr>
                ) : sessions.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
                    <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">{String(s.date).slice(0, 10)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{s.time || '—'}</td>
                    <td className="px-3 py-2 text-xs font-bold text-slate-900">{s.vehicleNo}</td>
                    <td className="px-3 py-2 text-xs text-center text-slate-700">{s.arrivalSoc ? parseFloat(s.arrivalSoc).toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-center text-slate-700">{s.departureSoc ? parseFloat(s.departureSoc).toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-center font-medium text-slate-900">{s.chargedPercent ? parseFloat(s.chargedPercent).toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-center text-slate-700">{s.ratePerPercent ? parseFloat(s.ratePerPercent).toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-right font-semibold text-slate-900">{parseFloat(s.chargeAmount || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-center text-slate-600">{s.visitNo}</td>
                    <td className="px-3 py-2 text-xs text-center">
                      <Badge variant={s.chargerType === 'GBT' ? 'default' : 'info'} className="text-xs">{s.chargerType}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-center text-slate-700">{s.paymentMethod}</td>
                    <td className="px-3 py-2 text-xs text-center">
                      <Badge variant={statusColor[s.paymentStatus] || 'default'} className="text-xs">{s.paymentStatus}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{s.operator || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-[150px] truncate">{s.remarks || '—'}</td>
                    <td className="px-3 py-2 text-xs text-right text-slate-700">{parseFloat(s.usedKwh || 0).toFixed(3)}</td>
                    <td className="px-3 py-2 text-xs text-center text-slate-600">{parseFloat(s.electricityRate || 0).toFixed(0)}</td>
                    <td className="px-3 py-2 text-xs text-right text-orange-700">{parseFloat(s.electricityCost || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-right font-medium text-green-700">{parseFloat(s.netContribution || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-right text-slate-700">{parseFloat(s.creditPaid || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-right font-medium text-red-600">
                      {(() => {
                        const outstanding = parseFloat(String(s.outstanding));
                        const chargeAmount = parseFloat(String(s.chargeAmount)) || 0;
                        const creditPaid = parseFloat(String(s.creditPaid)) || 0;
                        const actualOutstanding = (!isNaN(outstanding) && outstanding !== null) 
                          ? outstanding 
                          : (chargeAmount - creditPaid);
                        return actualOutstanding > 0 ? actualOutstanding.toFixed(2) : '0.00';
                      })()}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{s.settlementMethod || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{s.settlementDate ? String(s.settlementDate).slice(0, 10) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{s.companyBrand || '—'}</td>
                    <td className="px-3 py-2 sticky right-0 bg-white">
                      <div className="flex items-center justify-center gap-2">
                        {(() => {
                          const outstanding = parseFloat(String(s.outstanding));
                          const chargeAmount = parseFloat(String(s.chargeAmount)) || 0;
                          const creditPaid = parseFloat(String(s.creditPaid)) || 0;
                          const actualOutstanding = (!isNaN(outstanding) && outstanding !== null) 
                            ? outstanding 
                            : (chargeAmount - creditPaid);
                          
                          // Show Settle button ONLY if outstanding > 0 AND not fully paid
                          const needsSettlement = actualOutstanding > 0 && s.paymentStatus !== 'Paid';
                          
                          return needsSettlement && (
                            <Button
                              onClick={() => handleSettlePayment(s.id)}
                              size="sm"
                              className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700"
                            >
                              Settle
                            </Button>
                          );
                        })()}
                        <Button
                          onClick={() => handleEdit(s.id)}
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(s.id, s.vehicleNo)}
                          disabled={deleting === s.id}
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                        >
                          {deleting === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-500">Page {page} of {totalPages} • {total.toLocaleString()} total sessions</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
